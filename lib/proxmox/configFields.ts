import type { GuestType } from './endpoints';

// Curated, grouped list of Proxmox's documented QEMU/LXC config keys, used to
// populate the "add a field" dropdown in the guest config editor so users
// pick a real parameter name instead of typing one blind. Not exhaustive
// (PVE has a long tail of rarely-used keys) — the editor's "Custom field…"
// option is the escape hatch for anything not listed here.
export interface FieldGroup {
  label: string;
  fields: string[];
}

const QEMU_GROUPS: FieldGroup[] = [
  {
    label: 'General',
    fields: ['name', 'description', 'tags', 'onboot', 'startup', 'protection', 'ostype', 'boot', 'bootdisk', 'agent', 'hookscript', 'template'],
  },
  {
    label: 'CPU & memory',
    fields: ['cores', 'sockets', 'cpu', 'cpulimit', 'cpuunits', 'vcpus', 'numa', 'memory', 'balloon', 'shares', 'hugepages', 'keephugepages'],
  },
  {
    label: 'Display & devices',
    fields: [
      'vga', 'machine', 'bios', 'scsihw', 'keyboard', 'tablet', 'kvm', 'acpi', 'hotplug',
      'tpmstate0', 'rng0', 'watchdog', 'ivshmem',
      'usb0', 'usb1', 'usb2', 'usb3',
      'serial0', 'serial1', 'serial2', 'serial3',
      'parallel0', 'parallel1', 'parallel2',
    ],
  },
  {
    label: 'Storage',
    fields: [
      'efidisk0',
      'ide0', 'ide1', 'ide2', 'ide3',
      'sata0', 'sata1', 'sata2', 'sata3', 'sata4', 'sata5',
      'scsi0', 'scsi1', 'scsi2', 'scsi3', 'scsi4', 'scsi5', 'scsi6', 'scsi7',
      'virtio0', 'virtio1', 'virtio2', 'virtio3',
    ],
  },
  {
    label: 'Network',
    fields: ['net0', 'net1', 'net2', 'net3', 'net4', 'net5', 'net6', 'net7'],
  },
  {
    label: 'Cloud-init',
    fields: ['citype', 'ciuser', 'cipassword', 'cicustom', 'searchdomain', 'nameserver', 'sshkeys', 'ipconfig0', 'ipconfig1', 'ipconfig2', 'ipconfig3'],
  },
  {
    label: 'Migration & other',
    fields: [
      'migrate_downtime', 'migrate_speed', 'freeze', 'localtime', 'reboot',
      'smbios1', 'spice_enhancements', 'startdate', 'tdf', 'vmgenid', 'vmstatestorage',
      'hostpci0', 'hostpci1', 'hostpci2', 'hostpci3',
    ],
  },
];

const LXC_GROUPS: FieldGroup[] = [
  {
    label: 'General',
    fields: ['hostname', 'description', 'tags', 'onboot', 'startup', 'protection', 'ostype', 'unprivileged', 'features', 'hookscript', 'template'],
  },
  {
    label: 'CPU & memory',
    fields: ['cores', 'cpulimit', 'cpuunits', 'memory', 'swap'],
  },
  {
    label: 'Storage',
    fields: ['rootfs', 'mp0', 'mp1', 'mp2', 'mp3', 'mp4', 'mp5', 'mp6', 'mp7', 'mp8', 'mp9'],
  },
  {
    label: 'Network',
    fields: ['net0', 'net1', 'net2', 'net3', 'net4', 'net5', 'net6', 'net7'],
  },
  {
    label: 'Other',
    fields: ['nameserver', 'searchdomain', 'tty', 'console', 'cmode'],
  },
];

export function fieldGroups(type: GuestType): FieldGroup[] {
  return type === 'lxc' ? LXC_GROUPS : QEMU_GROUPS;
}
