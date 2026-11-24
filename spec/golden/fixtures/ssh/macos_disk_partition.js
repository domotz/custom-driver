// Simulated macOS 14.5 `diskutil info -all` output. Shape follows diskutil's "Key:   value" listing, one block per
// device introduced by "Device Identifier:" and separated by a line of asterisks; sizes read "494.4 GB (494384795648
// Bytes) (exactly 965595304 512-Byte-Units)". Blocks: the boot volume (mounted on "/", filtered out by the driver),
// two APFS volumes of the same external disk4 (the driver reports one row per parent disk), an HFS+ backup disk5 nearly
// full, and a read-only disk image.
const reply = require("../../replies");

const STARS = "**********";

const OUTPUT = [
    "   Device Identifier:         disk3s1s1",
    "   Device Node:               /dev/disk3s1s1",
    "   Whole:                     No",
    "   Part of Whole:             disk3",
    "   Volume Name:               Macintosh HD",
    "   Mounted:                   Yes",
    "   Mount Point:               /",
    "   File System Personality:   APFS",
    "   Container Total Space:     494.4 GB (494384795648 Bytes) (exactly 965595304 512-Byte-Units)",
    "   Container Free Space:      276.8 GB (276820406272 Bytes) (exactly 540664075 512-Byte-Units)",
    "",
    STARS,
    "   Device Identifier:         disk4s2",
    "   Device Node:               /dev/disk4s2",
    "   Whole:                     No",
    "   Part of Whole:             disk4",
    "   Volume Name:               Photos",
    "   Mounted:                   Yes",
    "   Mount Point:               /Volumes/Photos",
    "   File System Personality:   APFS",
    "   Container Total Space:     1.0 TB (1000000000000 Bytes) (exactly 1953125000 512-Byte-Units)",
    "   Container Free Space:      750.0 GB (750000000000 Bytes) (exactly 1464843750 512-Byte-Units)",
    "",
    STARS,
    "   Device Identifier:         disk4s3",
    "   Device Node:               /dev/disk4s3",
    "   Whole:                     No",
    "   Part of Whole:             disk4",
    "   Volume Name:               Videos",
    "   Mounted:                   Yes",
    "   Mount Point:               /Volumes/Videos",
    "   File System Personality:   APFS",
    "   Container Total Space:     1.0 TB (1000000000000 Bytes) (exactly 1953125000 512-Byte-Units)",
    "   Container Free Space:      750.0 GB (750000000000 Bytes) (exactly 1464843750 512-Byte-Units)",
    "",
    STARS,
    "   Device Identifier:         disk5s1",
    "   Device Node:               /dev/disk5s1",
    "   Whole:                     No",
    "   Part of Whole:             disk5",
    "   Volume Name:               Backup",
    "   Mounted:                   Yes",
    "   Mount Point:               /Volumes/Backup",
    "   File System Personality:   Journaled HFS+",
    "   Volume Total Space:        2.0 TB (2000000000000 Bytes) (exactly 3906250000 512-Byte-Units)",
    "   Volume Free Space:         100.0 GB (100000000000 Bytes) (exactly 195312500 512-Byte-Units)",
    "",
    STARS,
    "   Device Identifier:         disk6s1",
    "   Device Node:               /dev/disk6s1",
    "   Whole:                     No",
    "   Part of Whole:             disk6",
    "   Volume Name:               Installer",
    "   Mounted:                   Yes",
    "   Mount Point:               /Volumes/Installer",
    "   File System Personality:   HFS+",
    "   Volume Total Space:        8.0 GB (8000000000 Bytes) (exactly 15625000 512-Byte-Units)",
    "   Volume Free Space:         0 B (0 Bytes) (exactly 0 512-Byte-Units)",
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
