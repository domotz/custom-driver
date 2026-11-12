// Simulated macOS 14.5 `system_profiler SPNVMeDataType SPStorageDataType -json`. Shape follows system_profiler's JSON:
// SPNVMeDataType is one "spnvme_controller" item whose _items are the drives (bsd_name, device_model, device_serial,
// size_in_bytes, smart_status), SPStorageDataType lists the volumes (file_system, free_space_in_bytes, size_in_bytes,
// physical_drive.device_name). Two drives: the internal SSD (two APFS volumes sharing one container) and an external
// NVMe whose SMART status is "Failing" with an ExFAT volume.
const reply = require("../../replies");

const OUTPUT = JSON.stringify({
    SPNVMeDataType: [{
        _name: "spnvme_controller",
        _items: [
            {
                _name: "APPLE SSD AP0512Z",
                bsd_name: "disk0",
                detachable_drive: "no",
                device_model: "APPLE SSD AP0512Z",
                device_revision: "553.100.",
                device_serial: "0ba01d6c0d0a7f45",
                partition_map_type: "guid_partition_map_type",
                removable_media: "no",
                size: "500.28 GB",
                size_in_bytes: 500277792768,
                smart_status: "Verified",
                spnvme_trim_support: "yes"
            },
            {
                _name: "Samsung SSD 970 EVO Plus 1TB",
                bsd_name: "disk4",
                detachable_drive: "yes",
                device_model: "Samsung SSD 970 EVO Plus 1TB",
                device_revision: "2B2QEXM7",
                device_serial: "S4EWNX0M123456A",
                partition_map_type: "guid_partition_map_type",
                removable_media: "no",
                size: "1 TB",
                size_in_bytes: 1000204886016,
                smart_status: "Failing",
                spnvme_trim_support: "yes"
            }
        ]
    }],
    SPStorageDataType: [
        {
            _name: "Macintosh HD",
            bsd_name: "disk3s1s1",
            file_system: "APFS",
            free_space_in_bytes: 276820406272,
            ignore_ownership: "no",
            mount_point: "/",
            physical_drive: {
                device_name: "APPLE SSD AP0512Z",
                is_internal_disk: "yes",
                medium_type: "ssd",
                protocol: "Apple Fabric",
                smart_status: "Verified"
            },
            size_in_bytes: 494384795648,
            volume_uuid: "B4E0C1A2-7C3D-4A57-9F0B-6A1D2E3F4051",
            writable: "no"
        },
        {
            _name: "Data",
            bsd_name: "disk3s5",
            file_system: "APFS",
            free_space_in_bytes: 276820406272,
            ignore_ownership: "no",
            mount_point: "/System/Volumes/Data",
            physical_drive: {
                device_name: "APPLE SSD AP0512Z",
                is_internal_disk: "yes",
                medium_type: "ssd",
                protocol: "Apple Fabric",
                smart_status: "Verified"
            },
            size_in_bytes: 494384795648,
            volume_uuid: "C5F1D2B3-8D4E-4B68-A01C-7B2E3F405162",
            writable: "yes"
        },
        {
            _name: "Scratch",
            bsd_name: "disk4s2",
            file_system: "ExFAT",
            free_space_in_bytes: 120000000000,
            ignore_ownership: "yes",
            mount_point: "/Volumes/Scratch",
            physical_drive: {
                device_name: "Samsung SSD 970 EVO Plus 1TB",
                is_internal_disk: "no",
                medium_type: "ssd",
                protocol: "USB",
                smart_status: "Failing"
            },
            size_in_bytes: 1000000000000,
            volume_uuid: "D6A2E3C4-9E5F-4C79-B12D-8C3F40516273",
            writable: "yes"
        }
    ]
}, null, 2) + "\n";

const call = () => ({ kind: "ssh", method: "sendSSHCommand", target: "system_profiler SPNVMeDataType SPStorageDataType -json", reply: reply.ssh(OUTPUT) });

module.exports = {
    cases: [{
        name: "macos 14.5",
        entryPoints: {
            validate: { calls: [call()] },
            get_status: { calls: [call()] }
        }
    }]
};
