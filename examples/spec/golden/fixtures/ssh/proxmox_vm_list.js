// Simulated Proxmox VE 8.0.3 replies. `qm list` prints "VMID NAME STATUS MEM(MB) BOOTDISK(GB) PID" columns and
// `qm config <vmid>` prints "key: value" lines (cores, sockets, memory, net0, numa, ostype, ...), as documented
// in the qm man page / Proxmox VE admin guide (virtual machine settings). A stopped VM has PID 0.
const reply = require("../../replies");

const QM_LIST = [
    "      VMID NAME                 STATUS     MEM(MB)    BOOTDISK(GB) PID       ",
    "       100 web01                running    2048              32.00 1234      ",
    "       101 db01                 stopped    4096              64.00 0         ",
    "       102 file server          running    8192             500.00 5678      ",
    ""
].join("\n");

const CONFIG_100 = [
    "boot: order=scsi0;ide2;net0",
    "cores: 2",
    "ide2: none,media=cdrom",
    "memory: 2048",
    "name: web01",
    "net0: virtio=BC:24:11:AA:BB:01,bridge=vmbr0,firewall=1",
    "numa: 0",
    "ostype: l26",
    "scsi0: local-lvm:vm-100-disk-0,iothread=1,size=32G",
    "scsihw: virtio-scsi-single",
    "smbios1: uuid=8f1c1c3e-3a53-4f4b-9a0f-0d6b7d9a1e01",
    "sockets: 1",
    "vmgenid: 5d3b2d1a-8c1e-4f66-a4c2-1f1d7f3b9e01",
    ""
].join("\n");

const CONFIG_101 = [
    "boot: order=scsi0",
    "cores: 4",
    "memory: 4096",
    "name: db01",
    "net0: e1000=BC:24:11:AA:BB:02,bridge=vmbr1",
    "numa: 1",
    "ostype: l26",
    "scsi0: local-lvm:vm-101-disk-0,size=64G",
    "sockets: 2",
    ""
].join("\n");

const CONFIG_102 = [
    "boot: order=scsi0",
    "cores: 4",
    "memory: 8192",
    "name: file server",
    "net0: virtio=BC:24:11:AA:BB:03,bridge=vmbr0",
    "numa: 0",
    "ostype: win10",
    "scsi0: local-lvm:vm-102-disk-0,size=500G",
    "sockets: 1",
    ""
].join("\n");

const calls = () => [
    { kind: "ssh", method: "sendSSHCommand", target: "qm list", reply: reply.ssh(QM_LIST) },
    { kind: "ssh", method: "sendSSHCommand", target: "qm config 100", reply: reply.ssh(CONFIG_100) },
    { kind: "ssh", method: "sendSSHCommand", target: "qm config 101", reply: reply.ssh(CONFIG_101) },
    { kind: "ssh", method: "sendSSHCommand", target: "qm config 102", reply: reply.ssh(CONFIG_102) }
];

module.exports = {
    cases: [{
        name: "proxmox 8.0.3 three VMs",
        entryPoints: {
            validate: { calls: [calls()[0]] },
            get_status: { calls: calls() }
        }
    }]
};
