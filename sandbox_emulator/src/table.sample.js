var _var = D.device.createVariable;
var sampleRows = [
    [1, 2, 3],
    [10, 20, 30],
    [100, 200, 300],
    [1000, 2000, 3000],
];
var table = D.createTable(
    "Example Driver Table",
    [
        { label: "Label A" },
        { label: "Label B", unit: "%" },
        { label: "Label C", unit: "$" }
    ]
);
/**
* @remote_procedure
* @label Nothing
* @documentation Does nothing
*/
function validate() {
    console.info("Nothing ... ");
    D.success();
}
/**
* @remote_procedure
* @label Get Table Status
* @documentation My Mock Example for tables
*/
function get_status() {
    table.insertRecord(
        "one", sampleRows[0]
    );
    table.insertRecord(
        "two", sampleRows[1]
    );
    table.insertRecord(
        "three", sampleRows[2]
    );
    D.success([_var(1, "Label 1", "Value 1"), _var(2, "Label 2", "Value 2")], table);

}