function validate(){
    D.success();
};
function get_status(){
    var d = new Date();
    testParam = D.getParameter("testParam");
    var myVariable1 = D.device.createVariable("secondss", "Second", d.getSeconds(), "seconds");
    var myVariable2 = D.device.createVariable("month", "Month", d.getMonth(), "months");
    var myVariable3 = D.device.createVariable("day", "Day", d.getDay(), "days");
    var myVariable4 = D.device.createVariable("p", "Param", testParam);
    D.success([myVariable1, myVariable2, myVariable3, myVariable4]);
}