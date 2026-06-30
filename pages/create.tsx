import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AppBar from '@/components/AppBar';
import Icon from '@/components/Icon';
import { PageShell, Spinner } from '@/components/ui';
import { api, pvePath } from '@/lib/client/fetcher';
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
  const [isoStore, setIsoStore] = useState('');
  useEffect(() => {
    if (imageStores.length && !isoStore) setIsoStore(imageStores[0].storage);
  }, [imageStores, isoStore]);

  const isoDownload = useMutation({
    mutationFn: () =>
      api(pvePath(hostId, `/nodes/${node}/storage/${isoStore}/download-url`), {
        method: 'POST',
        body: JSON.stringify({ content: imageContent, url: isoUrl, filename: isoName }),
      }),
    onSuccess: () => {
      setIsoUrl('');
      setIsoName('');
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
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
        return api(pvePath(hostId, `/nodes/${node}/qemu`), {
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
      return api(pvePath(hostId, `/nodes/${node}/lxc`), {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guests'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
      router.push('/');
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
                    <input className={inputCls} placeholder="filename (e.g. debian-12.iso)" value={isoName} onChange={(e) => setIsoName(e.target.value)} />
                    {isoDownload.isError && <p className="text-sm text-danger">{(isoDownload.error as Error).message}</p>}
                    {isoDownload.isSuccess && <p className="text-sm text-success">Download started — check Tasks.</p>}
                    <button
                      onClick={() => isoDownload.mutate()}
                      disabled={!isoUrl || !isoName || !isoStore || isoDownload.isPending}
                      className="px-4 py-2 rounded-xl bg-elevated text-sm font-medium hover:bg-border/40 transition-colors disabled:opacity-40 flex items-center gap-2 w-fit"
                    >
                      {isoDownload.isPending && <Spinner size={16} />} Start download
                    </button>
                  </div>
                </details>
              )}

              {create.isError && <p className="text-sm text-danger">{(create.error as Error).message}</p>}
              <button
                onClick={() => create.mutate()}
                disabled={!canCreate || create.isPending}
                className="px-4 py-2.5 rounded-xl bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {create.isPending && <Spinner size={16} />} Create {type === 'qemu' ? 'VM' : 'container'}
              </button>
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
