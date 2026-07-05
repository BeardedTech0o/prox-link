import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AppBar from '@/components/AppBar';
import Icon from '@/components/Icon';
import { PageShell, Spinner, TaskProgress } from '@/components/ui';
import { api, ApiError, pvePath } from '@/lib/client/fetcher';
import { useHosts } from '@/lib/client/hooks';
import type { GuestType } from '@/lib/proxmox/endpoints';

interface StorageRow {
  storage: string;
  content: string;
}
interface ContentRow {
  volid: string;
}

const inputCls =
  'w-full px-3 py-2 bg-surface rounded-xl border border-border text-sm outline-none focus:ring-2 focus:ring-accent/50 focus:border-transparent';
const selectCls =
  'w-full px-3 py-2 bg-surface rounded-xl border border-border text-sm outline-none focus:ring-2 focus:ring-accent/50';

export default function CreatePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const hostsQ = useHosts();

  const [hostId, setHostId] = useState('');
  const [node, setNode] = useState('');
  const [type, setType] = useState<GuestType>('qemu');
  const [vmid, setVmid] = useState('');
  const [name, setName] = useState('');
  const [cores, setCores] = useState('2');
  const [memory, setMemory] = useState('2048');
  const [diskGB, setDiskGB] = useState('16');
  const [diskStorage, setDiskStorage] = useState('');
  const [image, setImage] = useState(''); // iso volid or template volid
  const [bridge, setBridge] = useState('vmbr0');
  const [password, setPassword] = useState('');

  // host → nodes
  const nodesQ = useQuery({
    enabled: !!hostId,
    queryKey: ['nodes', hostId],
    queryFn: () =>
      api<{ data: { node: string }[] }>(pvePath(hostId, '/nodes')).then((r) => r.data || []),
  });
  useEffect(() => {
    if (nodesQ.data && nodesQ.data.length && !node) setNode(nodesQ.data[0].node);
  }, [nodesQ.data, node]);

  // nextid
  const nextidQ = useQuery({
    enabled: !!hostId,
    queryKey: ['nextid', hostId],
    queryFn: () => api<{ data: string }>(pvePath(hostId, '/cluster/nextid')).then((r) => r.data),
  });
  useEffect(() => {
    if (nextidQ.data && !vmid) setVmid(String(nextidQ.data));
  }, [nextidQ.data, vmid]);

  // node → storages
  const storagesQ = useQuery({
    enabled: !!hostId && !!node,
    queryKey: ['storages', hostId, node],
    queryFn: () =>
      api<{ data: StorageRow[] }>(pvePath(hostId, `/nodes/${node}/storage`)).then(
        (r) => r.data || [],
      ),
  });

  const diskStores = useMemo(
    () =>
      (storagesQ.data || []).filter((s) =>
        (s.content || '').includes(type === 'qemu' ? 'images' : 'rootdir'),
      ),
    [storagesQ.data, type],
  );
  useEffect(() => {
    if (diskStores.length && !diskStorage) setDiskStorage(diskStores[0].storage);
  }, [diskStores, diskStorage]);

  const imageContent = type === 'qemu' ? 'iso' : 'vztmpl';
  const imageStores = useMemo(
    () => (storagesQ.data || []).filter((s) => (s.content || '').includes(imageContent)),
    [storagesQ.data, imageContent],
  );

  const imagesQ = useQuery({
    enabled: imageStores.length > 0,
    queryKey: ['content', hostId, node, imageContent, imageStores.map((s) => s.storage)],
    queryFn: async () => {
      const all: ContentRow[] = [];
      await Promise.all(
        imageStores.map(async (s) => {
          const r = await api<{ data: ContentRow[] }>(
            pvePath(hostId, `/nodes/${node}/storage/${s.storage}/content`, {
              content: imageContent,
            }),
          );
          all.push(...(r.data || []));
        }),
      );
      return all;
    },
  });

  // ISO-from-URL helper
  const [isoUrl, setIsoUrl] = useState('');
  const [isoName, setIsoName] = useState('');
  const [isoNameTouched, setIsoNameTouched] = useState(false);
  const [isoStore, setIsoStore] = useState('');
  useEffect(() => {
    if (imageStores.length && !isoStore) setIsoStore(imageStores[0].storage);
  }, [imageStores, isoStore]);

  // The URL's own filename almost always already has the right extension —
  // derive it automatically so the user isn't required to retype it (and
  // isn't left with a mismatched, unexplained "wrong extension" rejection
  // from a filename they never meant to type from scratch). Only autofills
  // while the user hasn't typed into the filename field themselves.
  useEffect(() => {
    if (isoNameTouched || !isoUrl) return;
    try {
      const base = decodeURIComponent(new URL(isoUrl).pathname.split('/').pop() || '');
      if (base) setIsoName(base);
    } catch {
      // Not a complete/valid URL yet — leave the filename alone.
    }
  }, [isoUrl, isoNameTouched]);

  // Proxmox rejects download-url with a bare "Parameter verification failed"
  // (no detail shown anywhere in the UI) if the filename's extension doesn't
  // match its content type — validate client-side so the user gets an
  // actionable message instead of a round trip to find out.
  const isoExtHint = type === 'qemu' ? '.iso or .img' : '.tar.gz, .tar.xz, .tar.zst, or .tgz';
  const isoExtRe = type === 'qemu' ? /\.(iso|img)$/i : /\.(tar\.gz|tar\.xz|tar\.zst|tgz)$/i;
  const isoNameValid = !isoName || isoExtRe.test(isoName);

  // Both the ISO download and the guest create call kick off an async PVE
  // task (returned as a UPID) rather than finishing inline. Track whichever
  // one is in flight and poll it for a stage-by-stage progress display —
  // Proxmox doesn't report a numeric percentage for either, so the task's
  // own log tail is the only real signal of "what's happening right now".
  const [activeTask, setActiveTask] = useState<{
    node: string;
    upid: string;
    kind: 'iso' | 'create';
  } | null>(null);

  const taskProgressQ = useQuery({
    enabled: !!activeTask,
    queryKey: ['create-task-progress', hostId, activeTask?.upid],
    refetchInterval: (q) => (q.state.data?.running === false ? false : 1200),
    queryFn: async () => {
      const { node: taskNode, upid } = activeTask!;
      const [statusRes, logRes] = await Promise.all([
        api<{ data: { status: string; exitstatus?: string } }>(
          pvePath(hostId, `/nodes/${taskNode}/tasks/${encodeURIComponent(upid)}/status`),
        ),
        api<{ data: { n: number; t: string }[] }>(
          pvePath(hostId, `/nodes/${taskNode}/tasks/${encodeURIComponent(upid)}/log`),
        ).catch(() => ({ data: [] as { n: number; t: string }[] })),
      ]);
      const running = statusRes.data.status === 'running';
      const lines = logRes.data || [];
      const lastLine = lines.length ? lines[lines.length - 1].t : '';
      return {
        running,
        ok: !running && (!statusRes.data.exitstatus || statusRes.data.exitstatus === 'OK'),
        stage: lastLine || (running ? 'Working…' : ''),
      };
    },
  });
  const taskRunning = !!activeTask && taskProgressQ.data?.running !== false;
  const taskFailed = !!activeTask && taskProgressQ.data?.running === false && !taskProgressQ.data.ok;

  useEffect(() => {
    if (!activeTask || !taskProgressQ.data || taskProgressQ.data.running || !taskProgressQ.data.ok) {
      return;
    }
    if (activeTask.kind === 'iso') {
      setIsoUrl('');
      setIsoName('');
      setIsoNameTouched(false);
      qc.invalidateQueries({ queryKey: ['content'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setActiveTask(null);
    } else {
      qc.invalidateQueries({ queryKey: ['guests'] });
      router.push(`/guest/${hostId}/${type}/${vmid}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskProgressQ.data, activeTask]);

  const isoDownload = useMutation({
    mutationFn: () =>
      api<{ data: string }>(pvePath(hostId, `/nodes/${node}/storage/${isoStore}/download-url`), {
        method: 'POST',
        body: JSON.stringify({ content: imageContent, url: isoUrl, filename: isoName }),
      }),
    onSuccess: (res) => setActiveTask({ node, upid: res.data, kind: 'iso' }),
  });

  const create = useMutation({
    mutationFn: () => {
      const id = Number(vmid);
      if (type === 'qemu') {
        const body: Record<string, any> = {
          vmid: id,
          name: name || undefined,
          cores: Number(cores),
          memory: Number(memory),
          sockets: 1,
          net0: `virtio,bridge=${bridge}`,
          scsihw: 'virtio-scsi-single',
          scsi0: `${diskStorage}:${diskGB}`,
          ostype: 'l26',
        };
        if (image) body.ide2 = `${image},media=cdrom`;
        return api<{ data: string }>(pvePath(hostId, `/nodes/${node}/qemu`), {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }
      const body: Record<string, any> = {
        vmid: id,
        hostname: name || undefined,
        cores: Number(cores),
        memory: Number(memory),
        ostemplate: image,
        rootfs: `${diskStorage}:${diskGB}`,
        net0: `name=eth0,bridge=${bridge},ip=dhcp`,
        password: password || undefined,
        unprivileged: 1,
      };
      return api<{ data: string }>(pvePath(hostId, `/nodes/${node}/lxc`), {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setActiveTask({ node, upid: res.data, kind: 'create' });
    },
  });

  const canCreate =
    hostId && node && vmid && cores && memory && diskStorage && diskGB &&
    (type === 'qemu' || image); // LXC requires a template

  return (
    <>
      <AppBar title="Create guest" back="/" />
      <PageShell>
        <div className="card flex flex-col gap-4">
          <Field label="Host">
            <select
              className={selectCls}
              value={hostId}
              onChange={(e) => {
                setHostId(e.target.value);
                setNode('');
                setVmid('');
                setDiskStorage('');
                setIsoStore('');
              }}
            >
              <option value="">Select a host…</option>
              {hostsQ.data?.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </Field>

          {hostId && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Node">
                  <select className={selectCls} value={node} onChange={(e) => setNode(e.target.value)}>
                    {nodesQ.data?.map((n) => (
                      <option key={n.node} value={n.node}>
                        {n.node}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Type">
                  <select
                    className={selectCls}
                    value={type}
                    onChange={(e) => {
                      setType(e.target.value as GuestType);
                      setImage('');
                      setDiskStorage('');
                    }}
                  >
                    <option value="qemu">QEMU VM</option>
                    <option value="lxc">LXC container</option>
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="VM ID">
                  <input className={inputCls} inputMode="numeric" value={vmid} onChange={(e) => setVmid(e.target.value)} />
                </Field>
                <Field label={type === 'qemu' ? 'Name' : 'Hostname'}>
                  <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Cores">
                  <input className={inputCls} inputMode="numeric" value={cores} onChange={(e) => setCores(e.target.value)} />
                </Field>
                <Field label="Memory (MiB)">
                  <input className={inputCls} inputMode="numeric" value={memory} onChange={(e) => setMemory(e.target.value)} />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Disk storage">
                  <select className={selectCls} value={diskStorage} onChange={(e) => setDiskStorage(e.target.value)}>
                    {diskStores.map((s) => (
                      <option key={s.storage} value={s.storage}>
                        {s.storage}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Disk size (GiB)">
                  <input className={inputCls} inputMode="numeric" value={diskGB} onChange={(e) => setDiskGB(e.target.value)} />
                </Field>
              </div>

              <Field label={type === 'qemu' ? 'Installation ISO' : 'Container template'} hint={type === 'lxc' ? 'Required' : 'Optional — attach an install CD'}>
                <select className={selectCls} value={image} onChange={(e) => setImage(e.target.value)}>
                  <option value="">{type === 'qemu' ? 'None' : 'Select a template…'}</option>
                  {imagesQ.data?.map((c) => (
                    <option key={c.volid} value={c.volid}>
                      {c.volid.split('/').pop()}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Network bridge">
                <input className={inputCls} value={bridge} onChange={(e) => setBridge(e.target.value)} />
              </Field>

              {type === 'lxc' && (
                <Field label="Root password" hint="Required for container login">
                  <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </Field>
              )}

              {/* ISO / template from URL */}
              {imageStores.length > 0 && (
                <details className="panel-elevated p-3">
                  <summary className="text-sm font-medium cursor-pointer flex items-center gap-2">
                    <Icon name="cloud_download" size={18} /> Download {type === 'qemu' ? 'ISO' : 'template'} from URL
                  </summary>
                  <div className="flex flex-col gap-2 mt-3">
                    <select className={selectCls} value={isoStore} onChange={(e) => setIsoStore(e.target.value)}>
                      {imageStores.map((s) => (
                        <option key={s.storage} value={s.storage}>
                          {s.storage}
                        </option>
                      ))}
                    </select>
                    <input className={inputCls} placeholder="https://…/image.iso" value={isoUrl} onChange={(e) => setIsoUrl(e.target.value)} />
                    <input
                      className={inputCls}
                      placeholder="filename (e.g. debian-12.iso)"
                      value={isoName}
                      onChange={(e) => {
                        setIsoName(e.target.value);
                        setIsoNameTouched(true);
                      }}
                    />
                    {!isoNameValid && (
                      <p className="text-sm text-warning">Filename must end in {isoExtHint}</p>
                    )}
                    {isoDownload.isError && (
                      <p className="text-sm text-danger">
                        {(isoDownload.error as ApiError).fieldErrors
                          ? Object.values((isoDownload.error as ApiError).fieldErrors!).join('; ')
                          : (isoDownload.error as Error).message}
                      </p>
                    )}
                    {activeTask?.kind === 'iso' ? (
                      taskFailed ? (
                        <TaskFailure
                          stage={taskProgressQ.data?.stage}
                          onDismiss={() => setActiveTask(null)}
                        />
                      ) : (
                        <TaskProgress stage={taskProgressQ.data?.stage ?? 'Starting download…'} />
                      )
                    ) : (
                      <button
                        onClick={() => isoDownload.mutate()}
                        disabled={!isoUrl || !isoName || !isoStore || !isoNameValid || isoDownload.isPending || taskRunning}
                        className="px-4 py-2 rounded-xl bg-elevated text-sm font-medium hover:bg-border/40 transition-colors disabled:opacity-40 flex items-center gap-2 w-fit"
                      >
                        {isoDownload.isPending && <Spinner size={16} />} Start download
                      </button>
                    )}
                  </div>
                </details>
              )}

              {create.isError && <p className="text-sm text-danger">{(create.error as Error).message}</p>}
              {activeTask?.kind === 'create' ? (
                taskFailed ? (
                  <TaskFailure
                    stage={taskProgressQ.data?.stage}
                    onDismiss={() => setActiveTask(null)}
                  />
                ) : (
                  <TaskProgress stage={taskProgressQ.data?.stage ?? 'Starting…'} />
                )
              ) : (
                <button
                  onClick={() => create.mutate()}
                  disabled={!canCreate || create.isPending || taskRunning}
                  className="px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {create.isPending && <Spinner size={16} />} Create {type === 'qemu' ? 'VM' : 'container'}
                </button>
              )}
            </>
          )}
        </div>
      </PageShell>
    </>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
      {hint && <p className="text-xs text-secondary">{hint}</p>}
    </div>
  );
}

function TaskFailure({ stage, onDismiss }: { stage?: string; onDismiss: () => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-danger/20 bg-danger/10 p-3">
      <p className="text-sm text-danger">{stage || 'The task failed.'}</p>
      <button
        onClick={onDismiss}
        className="px-3 py-1.5 rounded-xl bg-elevated text-sm font-medium hover:bg-border/40 transition-colors w-fit"
      >
        Dismiss
      </button>
    </div>
  );
}
