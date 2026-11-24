// Source: `df -Th` on Ubuntu 22.04 (the version the driver was tested on), with the snap loop
// mounts a desktop install has.
const reply = require("../../replies");

const DF = [
    "Filesystem     Type      Size  Used Avail Use% Mounted on",
    "tmpfs          tmpfs     392M  1.7M  390M   1% /run",
    "/dev/sda2      ext4       98G   21G   72G  23% /",
    "tmpfs          tmpfs     2.0G     0  2.0G   0% /dev/shm",
    "tmpfs          tmpfs     5.0M  4.0K  5.0M   1% /run/lock",
    "/dev/loop0     squashfs   64M   64M     0 100% /snap/core20/1828",
    "/dev/loop1     squashfs   50M   50M     0 100% /snap/snapd/18357",
    "/dev/sda1      vfat      512M  6.1M  506M   2% /boot/efi",
    "tmpfs          tmpfs     392M  4.0K  392M   1% /run/user/1000",
    ""
].join("\n");

module.exports = {
    cases: [{
        name: "ubuntu 22.04",
        entryPoints: {
            validate: {
                calls: [{ kind: "ssh", method: "sendSSHCommand", target: "df -Th", reply: reply.ssh(DF) }]
            },
            get_status: {
                calls: [{ kind: "ssh", method: "sendSSHCommand", target: "df -Th", reply: reply.ssh(DF) }]
            }
        }
    }]
};
