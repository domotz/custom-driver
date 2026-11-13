// Simulated Azure replies. Shape follows the Microsoft Entra v1 client-credentials token response and the Azure Cost
// Management "Query - Usage" reply (api-version 2023-11-01): { id, name, type, location, sku, eTag, properties: { nextLink,
// columns: [ { name, type } ], rows: [ [ ... ] ] } }. With a daily Usage query grouped by Meter, MeterSubcategory,
// ResourceGroup, ServiceName and ResourceLocation, the columns are PreTaxCost (Number), UsageDate (Number, yyyymmdd),
// the five grouping dimensions (String) and Currency (String); Cost Management returns resource group names in lower case.
// The subscription is billed in USD.
const reply = require("../../replies");

const TENANT = "11111111-2222-3333-4444-555555555555";
const SUB = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.azure-token";

const COST = {
    id: "subscriptions/" + SUB + "/providers/Microsoft.CostManagement/query/00000000-0000-0000-0000-000000000000",
    name: "00000000-0000-0000-0000-000000000000",
    type: "Microsoft.CostManagement/query",
    location: null,
    sku: null,
    eTag: null,
    properties: {
        nextLink: null,
        columns: [
            { name: "PreTaxCost", type: "Number" },
            { name: "UsageDate", type: "Number" },
            { name: "Meter", type: "String" },
            { name: "MeterSubcategory", type: "String" },
            { name: "ResourceGroup", type: "String" },
            { name: "ServiceName", type: "String" },
            { name: "ResourceLocation", type: "String" },
            { name: "Currency", type: "String" }
        ],
        rows: [
            [3.456789, 20260114, "D2s v3", "Dsv3 Series", "prod-rg", "Virtual Machines", "EU West", "USD"],
            [0.2, 20260114, "P10 Disks", "Premium SSD Managed Disks", "prod-rg", "Storage", "EU West", "USD"],
            [12.5, 20260114, "E4s v3", "Esv3 Series", "data-rg", "Virtual Machines", "EU North", "USD"],
            [7.004, 20260114, "Standard Data Transfer Out", "Data Transfer", "dev-rg", "Bandwidth", "Zone 1", "USD"]
        ]
    }
};

const calls = () => [
    {
        kind: "http", method: "post", host: "login.microsoftonline.com", target: "/" + TENANT + "/oauth2/token",
        reply: reply.http(200, { token_type: "Bearer", expires_in: "3599", ext_expires_in: "3599", expires_on: "1698400000", resource: "https://management.azure.com/", access_token: TOKEN })
    },
    {
        kind: "http", method: "post", host: "management.azure.com",
        target: "/subscriptions/" + SUB + "/providers/Microsoft.CostManagement/query?api-version=2023-11-01",
        headers: { Authorization: "Bearer " + TOKEN },
        reply: reply.http(200, COST)
    }
];

module.exports = {
    cases: [{
        name: "four cost rows, dev-rg not selected",
        parameters: { tenantId: TENANT, clientId: "client-id-1", clientSecret: "client-secret-1", subscriptionId: SUB, resourceGroups: ["Prod-RG", "Data-RG"] },
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
