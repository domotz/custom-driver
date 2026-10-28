// Simulated Azure replies. Shape follows the Microsoft Entra v1 client-credentials token response
// ({ token_type, expires_in, resource, access_token }) from login.microsoftonline.com/<tenant>/oauth2/token and the
// Azure Resource Manager "Virtual Machines - List All" reply (api-version 2021-04-01): { value: [ VirtualMachine ] },
// where storageProfile.dataDisks is an array of DataDisk objects and VM ids are full resource ids.
const reply = require("../../replies");

const TENANT = "11111111-2222-3333-4444-555555555555";
const SUB = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.azure-token";

const vms = {
    value: [
        {
            name: "web-01",
            id: "/subscriptions/" + SUB + "/resourceGroups/Prod-RG/providers/Microsoft.Compute/virtualMachines/web-01",
            type: "Microsoft.Compute/virtualMachines",
            location: "westeurope",
            zones: ["1"],
            properties: {
                vmId: "0a1b2c3d-1111-2222-3333-444455556666",
                hardwareProfile: { vmSize: "Standard_D2s_v3" },
                storageProfile: {
                    imageReference: { publisher: "Canonical", offer: "0001-com-ubuntu-server-jammy", sku: "22_04-lts-gen2", version: "latest", exactVersion: "22.04.202310100" },
                    osDisk: { osType: "Linux", name: "web-01_OsDisk_1", createOption: "FromImage", caching: "ReadWrite", managedDisk: { storageAccountType: "Premium_LRS", id: "/subscriptions/" + SUB + "/resourceGroups/Prod-RG/providers/Microsoft.Compute/disks/web-01_OsDisk_1" } },
                    dataDisks: []
                },
                osProfile: { computerName: "web-01", adminUsername: "azureuser" },
                networkProfile: { networkInterfaces: [{ id: "/subscriptions/" + SUB + "/resourceGroups/Prod-RG/providers/Microsoft.Network/networkInterfaces/web-01-nic" }] },
                additionalCapabilities: { hibernationEnabled: true },
                provisioningState: "Succeeded"
            }
        },
        {
            name: "db-01",
            id: "/subscriptions/" + SUB + "/resourceGroups/Data-RG/providers/Microsoft.Compute/virtualMachines/db-01",
            type: "Microsoft.Compute/virtualMachines",
            location: "northeurope",
            properties: {
                vmId: "9f8e7d6c-aaaa-bbbb-cccc-ddddeeeeffff",
                hardwareProfile: { vmSize: "Standard_E4s_v3" },
                storageProfile: {
                    imageReference: { publisher: "MicrosoftWindowsServer", offer: "WindowsServer", sku: "2019-Datacenter", version: "latest", exactVersion: "17763.4851.2310" },
                    osDisk: { osType: "Windows", name: "db-01_OsDisk_1", createOption: "FromImage" },
                    dataDisks: [{ lun: 0, name: "db-01-data", createOption: "Attach", diskSizeGB: 512 }]
                },
                osProfile: { computerName: "DB01", adminUsername: "azureuser" },
                networkProfile: { networkInterfaces: [
                    { id: "/subscriptions/" + SUB + "/resourceGroups/Data-RG/providers/Microsoft.Network/networkInterfaces/db-01-nic" },
                    { id: "/subscriptions/" + SUB + "/resourceGroups/Data-RG/providers/Microsoft.Network/networkInterfaces/db-01-nic2" }
                ] },
                provisioningState: "Failed"
            }
        }
    ]
};

const calls = () => [
    {
        kind: "http", method: "post", host: "login.microsoftonline.com", target: "/" + TENANT + "/oauth2/token",
        reply: reply.http(200, { token_type: "Bearer", expires_in: "3599", ext_expires_in: "3599", expires_on: "1698400000", resource: "https://management.azure.com/", access_token: TOKEN })
    },
    {
        kind: "http", method: "get", host: "management.azure.com",
        target: "/subscriptions/" + SUB + "/providers/Microsoft.Compute/virtualMachines?api-version=2021-04-01",
        headers: { Authorization: "Bearer " + TOKEN },
        reply: reply.http(200, vms)
    }
];

module.exports = {
    cases: [{
        name: "two vms in two resource groups",
        parameters: { tenantID: TENANT, clientId: "client-id-1", clientSecret: "client-secret-1", subscriptionId: SUB, resourceGroups: ["all"], vmNames: ["all"] },
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
