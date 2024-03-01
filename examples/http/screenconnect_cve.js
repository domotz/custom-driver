/**
 * Domotz Custom Driver 
 * Name: ScreenConnect CVE
 * Description: Detect ScreenConnect Server vulnerabilities CVE-2024-1709 and CVE-2024-1708
 *   
 * Communication protocol is HTTP
 * 
 * Tested on:
 *      - ScreenConnect 23.9.10.8817
 *      - Windows 11
 * 
 * Creates the following Custom Driver variables:
 *   - screen-connect-installed: "Yes"" if ScreenConnect was detected, "No" otherwise
 *   - screen-connect-version: ScreenConnect version 
 *   - screen-connect-vulnerable: "Yes" if this version is affected by CVE-2024-1709 and CVE-2024-1708, "No" otherwise
 * 
**/

var screenconnectServerConfig = {
    url: "/Script.ashx",
    port: 8040,
    timeout:5000
};

function publishVariables(installed, version, vulnerable) {
    var variables = [
        D.createVariable("screen-connect-installed", "ScreenConnect Server Installed", installed),
        D.createVariable("screen-connect-version", "ScreenConnect Server Version", version),
        D.createVariable("screen-connect-vulnerable", "ScreenConnect Server Vulnerable", vulnerable)
    ];
    D.success(variables);
}

// Function to make an HTTP GET request to retrieve ScreenConnect version
function getScreenConnecVersion() {
    var d = D.q.defer();
    D.device.http.get(screenconnectServerConfig, 
        function (error, response, body) {
        if (error) {
            console.error("Received error: " + error);
            publishVariables("No", "N/A", "N/A");
        } else if (response && response.statusCode != 200){
            console.error("Received unexpected response code: " + response.statusCode);
            publishVariables("N/A", "N/A", "N/A");
        } else 
            d.resolve(body);
    });
    return d.promise;
}

function compareVersions(version1, version2) {
    const v1 = version1.split('.').map(Number);
    const v2 = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
        if ((v1[i] || 0) < (v2[i] || 0)) return -1;
        if ((v1[i] || 0) > (v2[i] || 0)) return 1;
    }
    
    return 0;
}

// Extracts relevant data from the API response and populates the Custom Driver variables
function extractData(data) 
{
    var version = "N/A";
    var vulnerable = "N/A";

    const productVersionRegex = /productVersion":"([\d.]+)"/;
    const match = data.match(productVersionRegex);
    if (match && match[1])
    {
        version = match[1];
        if (compareVersions(version, "23.9.7") <= 0)
            vulnerable = "Yes";
        else 
            vulnerable = "No";
    }

    publishVariables("Yes", version, vulnerable);
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation Detect if ScreenConnect Server port is open
 */
function validate(){
    D.device.http.get(screenconnectServerConfig, 
        function (error, response, body) {
        if (error) {
            console.error("Received error: " + error);
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        } else 
            D.success();
    });
}

/**
 * @remote_procedure
 * @label Get Device Variables
 * @documentation Detect if the ScreenConnect Server version runing on the device is affected by CVE-2024-1709 and CVE-2024-1708 vulnerabilities
 */
function get_status() {
    getScreenConnecVersion()
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}