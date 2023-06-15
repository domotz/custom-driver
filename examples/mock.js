function validate(){
    D.success();
};
function get_status(){
    var d = new Date();
    var myVariable1 = D.device.createVariable("seconds", "Second", d.getSeconds(), "seconds");
    var myVariable2 = D.device.createVariable("month", "Month", d.getMonth(), "months");
    var myVariable3 = D.device.createVariable("day", "Day", d.getDay(), "days");
    D.success([myVariable1, myVariable2, myVariable3]);
}