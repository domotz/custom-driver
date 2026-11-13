// Simulated macOS 14.5 `diskutil info -all` output. Shape follows diskutil's "Key:   value" listing, one block per
// device introduced by "Device Identifier:" and separated by a line of asterisks; sizes read "494.4 GB (494384795648
// Bytes) (exactly 965595304 512-Byte-Units)". Blocks: the boot APFS volume (mounted on "/", filtered out by the driver),
// two external volumes (an APFS volume in a container, one failing SMART, and an HFS+ backup disk) and a read-only
// disk image.
const reply = require("../../replies");

const STARS = "**********";

const OUTPUT = [
    "   Device Identifier:         disk3s1s1",
    "   Device Node:               /dev/disk3s1s1",
    "   Whole:                     No",
    "   Part of Whole:             disk3",
    "",
    "   Volume Name:               Macintosh HD",
    "   Mounted:                   Yes",
    "   Mount Point:               /",
    "",
    "   File System Personality:   APFS",
    "   Container Total Space:     494.4 GB (494384795648 Bytes) (exactly 965595304 512-Byte-Units)",
    "   Volume Used Space:         11.2 GB (11246223360 Bytes) (exactly 21965280 512-Byte-Units)",
    "   SMART Status:              Verified",
    "",
    STARS,
    "   Device Identifier:         disk4s2",
    "   Device Node:               /dev/disk4s2",
    "   Whole:                     No",
    "   Part of Whole:             disk4",
    "",
    "   Volume Name:               Photos",
    "   Mounted:                   Yes",
    "   Mount Point:               /Volumes/Photos",
    "",
    "   File System Personality:   APFS",
    "   Volume Total Space:        1.0 TB (1000000000000 Bytes) (exactly 1953125000 512-Byte-Units)",
    "   Container Total Space:     1.0 TB (1000000000000 Bytes) (exactly 1953125000 512-Byte-Units)",
    "   Volume Used Space:         250.0 GB (250000000000 Bytes) (exactly 488281250 512-Byte-Units)",
    "   Volume Read-Only:          No",
    "   SMART Status:              Failing",
    "",
    STARS,
    "   Device Identifier:         disk5s1",
    "   Device Node:               /dev/disk5s1",
    "   Whole:                     No",
    "   Part of Whole:             disk5",
    "",
    "   Volume Name:               Backup",
    "   Mounted:                   Yes",
    "   Mount Point:               /Volumes/Backup",
    "",
    "   File System Personality:   Journaled HFS+",
    "   Volume Total Space:        2.0 TB (2000000000000 Bytes) (exactly 3906250000 512-Byte-Units)",
    "   Volume Used Space:         1.5 TB (1500000000000 Bytes) (exactly 2929687500 512-Byte-Units)",
    "   Volume Read-Only:          No",
    "   SMART Status:              Not Supported",
    "",
    STARS,
    "   Device Identifier:         disk6s1",
    "   Device Node:               /dev/disk6s1",
    "   Whole:                     No",
    "   Part of Whole:             disk6",
    "",
    "   Volume Name:               Installer",
    "   Mounted:                   Yes",
    "   Mount Point:               /Volumes/Installer",
    "",
    "   File System Personality:   HFS+",
    "   Volume Total Space:        8.0 GB (8000000000 Bytes) (exactly 15625000 512-Byte-Units)",
    "   Volume Used Space:         8.0 GB (8000000000 Bytes) (exactly 15625000 512-Byte-Units)",
    "   Volume Read-Only:          Yes",
    "   SMART Status:              Not Supported",
    ""
].join("\n");

const call = () => ({ kind: "ssh", method: "sendSSHCommand", target: "diskutil info -all", reply: reply.ssh(OUTPUT) });

module.exports = {
    cases: [{
        name: "macos 14.5",
        entryPoints: {
            validate: { calls: [call()] },
            get_status: { calls: [call()] }
        }
    }]
};
