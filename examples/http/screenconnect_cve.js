/**
 * Domotz Custom Driver 
 * Name: ScreenConnect CVE
 * Description: Detect ScreenConnect Server vulnerabilities CVE-2024-1709 and CVE-2024-1708
 *   
 * Communication protocol is HTTP
 * 
 * Tested on Windows Versions:
 *      - Windows 11
 * 
 * Creates a Custom Driver table with the following columns:
 *   - Detected: "Yes"" if ScreenConnect was detected, "No" otherwise
 *   - Version: ScreenConnect version 
 *   - Vulnerable: "Yes" if this version is affected by CVE-2024-1709 and CVE-2024-1708, "No" otherwise
 * 
**/
// Create a Custom Driver table to store software vulnerabilities
var table = D.createTable(
    "Software vulnerabilities",
    [                                       
        { label: "Detected", valueType: D.valueType.STRING },
        { label: "Version", valueType: D.valueType.STRING },
        { label: "Is vulnerable", valueType: D.valueType.STRING }
    ]
);

// Function to make an HTTP GET request to retrieve ScreenConnect version
function getScreenConnecVersion() {
    var d = D.q.defer();
    D.device.http.get({
        url: "/Script.ashx",
        protocol: "http:",
        port: 8040
    }, function (error, response, body) {
        if (error || response.statusCode != 200) {
            console.error(error + "\nStatus Code: " + response.statusCode);
            table.insertRecord("screenconnect-server", [ "No", "N/A", "N/A" ]);
            D.success(table);
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

// Extracts relevant data from the API response and populates the Custom Driver Table
function extractData(data) 
{
     var installed = "Yes";
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

    table.insertRecord("screenconnect-server", [ "Yes", version, vulnerable]);
    D.success(table);
}

/**
 * @remote_procedure
 * @label Validate Get Software Vulnerabilties custom script
 * @documentation The script is validated by default because if ScreenConnect server is not present the script populates the result table as well.
 */
function validate(){
    D.success();
}

/**
 * @remote_procedure
 * @label Get Software Vulnerabilties on ScreenConnect Server
 * @documentation This procedure retrieves Software Vulnerabilities on ScreenConnect Server
 */
function get_status() {
    getScreenConnecVersion()
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}