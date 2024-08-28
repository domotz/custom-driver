/**
 * Domotz Custom Driver
 * Name: ESXi Network Physical NIC Configuration
 * Description: Monitors the ESXi host Network Physical NIC Configuration.
 *
 * Communication protocol is HTTPS
 *
 * Tested on ESXi version: 8.0.0
 *
 * Output:
 * Extracts the following information from the data array:
 * - ID
 * - Device
 * - PCI Slot
 * - Driver
 * - Link Speed (Mb)
 * - Duplex
 * - Valid Link Speed (Mb)
 * - Valid Link Duplex
 * - DHCP Enabled
 * - IP Address
 * - Subnet Mask
 * - Specified Link Speed (Mb)
 * - Specified Link Duplex
 * - Wake-on-LAN Supported
 * - MAC Address
 *
 **/

// URL endpoint for accessing the vSphere SDK
const url = '/sdk'


// Creation of Network Physical NIC Configuration table
var networkPhysicalNicConfigurationTable = D.createTable(
    'Network Physical NIC Configuration',
    [
        { label: 'Device', valueType: D.valueType.STRING },
        { label: 'PCI Slot', valueType: D.valueType.STRING },
        { label: 'Driver', valueType: D.valueType.STRING },
        { label: 'Link Speed', valueType: D.valueType.NUMBER, unit: "MB" },
        { label: 'Duplex', valueType: D.valueType.STRING },
        { label: 'DHCP Enabled', valueType: D.valueType.STRING },
        { label: 'IP Address', valueType: D.valueType.STRING },
        { label: 'Subnet Mask', valueType: D.valueType.STRING },
        { label: 'Wake-on-LAN Supported', valueType: D.valueType.STRING },
        { label: 'MAC Address', valueType: D.valueType.STRING }
    ]
)

/**
 * Sends a SOAP request and returns a promise with the parsed response.
 * @param {string} body  The SOAP request body.
 * @param {function} extractData  A call back function to extract data from body and response.
 * @returns A promise that resolves with the parsed response.
 */
function sendSoapRequest (body, extractData) {
    const d = D.q.defer()

    let config ={
        url,
        protocol: "https",
        rejectUnauthorized: false,
        body,
        jar: true
    }

    D.device.http.post(config, function (error, response, body) {
        if (error) {
            console.error(error)
            D.failure(D.errorType.GENERIC_ERROR)
        } else if (!response) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE)
        } else if (response.statusCode === 400) {
            D.failure(D.errorType.AUTHENTICATION_ERROR)
        } else if (response.statusCode !== 200) {
            D.failure(D.errorType.GENERIC_ERROR)
        } else {
            const result = extractData(body)
            d.resolve(result)
        }
    })
    return d.promise
}

/**
 * Constructs a SOAP payload with the given body content.
 * @param {string} soapBody - The content to be included in the SOAP body.
 * @returns {string} The complete SOAP payload as a string, including the envelope and body.
 */
function createSoapPayload (soapBody) {
    return '<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:vim25="urn:vim25"><soapenv:Body>'
        + soapBody +
        '</soapenv:Body></soapenv:Envelope>'
}

/**
 * Parses the SOAP response to extract the Session Key.
 * @param {string} soapResponse - The SOAP response as a string.
 * @returns {string} The Session Key extracted from the SOAP response.
 */
function getSessionKey(soapResponse) {
    const $ = D.htmlParse(soapResponse)
    return $('returnval').find('key').first().text()
}

/**
 * Constructs and sends a SOAP login request to the ESXi server.
 * @returns {Promise} A promise that resolves with the response of the login request.
 */
function login () {
    const payload = createSoapPayload(
        '<vim25:Login>' +
        '   <_this type="SessionManager">ha-sessionmgr</_this>' +
        '   <userName>' + D.device.username() + '</userName>' +
        '   <password>' + D.device.password() + '</password>' +
        '</vim25:Login>'
    )
    // Send the SOAP request and handle the response to extract the Session Key.
    return sendSoapRequest(payload, getSessionKey)
}

/**
 * Parses the SOAP response to extract the container ID.
 * @param {string} soapResponse - The SOAP response as a string.
 * @returns {string} The container ID extracted from the SOAP response.
 */
function getContainerIdFromSoap(soapResponse) {
    const $ = D.htmlParse(soapResponse)
    return $('returnval').text();
}

/**
 * Constructs and sends a SOAP request to create a container view for all host systems.
 * @returns {Promise} A promise that resolves with the container ID from the SOAP response.
 */
function createAllHostContainer() {
    const payload = createSoapPayload(
        '<CreateContainerView xmlns="urn:vim25">' +
        '    <_this type="ViewManager">ViewManager</_this>' +
        '    <container type="Folder">ha-folder-root</container>' +
        '    <type>HostSystem</type>' +
        '    <recursive>true</recursive>' +
        '</CreateContainerView>'
    )
    // Send the SOAP request and extract the container ID from the response.
    return sendSoapRequest(payload, getContainerIdFromSoap)
}

/**
 * Extracts the host reference from the SOAP response.
 * @param {string} soapResponse - The SOAP response as a string.
 * @returns {string} The host reference extracted from the SOAP response.
 */
function getHostRefFromSoap(soapResponse) {
    const $ = D.htmlParse(soapResponse)
    return $('returnval').find('ManagedObjectReference').first().text()
}

/**
 * Constructs and sends a SOAP request to fetch details from a container view by its ID.
 * @param {string} containerId - The ID of the container view to fetch.
 * @returns {Promise} A promise that resolves with the host reference extracted from the SOAP response.
 */
function fetchContainer(containerId) {
    const payload = createSoapPayload(
        '<Fetch xmlns="urn:vim25">' +
        '    <_this type="ContainerView">' + containerId + '</_this>' +
        '    <prop>view</prop>' +
        '</Fetch>'
    )
    // Send the SOAP request and extract the host reference from the response.
    return sendSoapRequest(payload, getHostRefFromSoap)
}

/**
 * Constructs and sends a SOAP request to retrieve properties for a specified host reference.
 * @param {string} hostRef - The reference ID of the host whose properties are to be retrieved.
 * @returns {Promise} A promise that resolves with the properties of the host as extracted from the SOAP response.
 */
function retrieveProprieties(hostRef) {
    const payload = createSoapPayload(
        '<RetrieveProperties xmlns="urn:vim25">' +
        '    <_this type="PropertyCollector">ha-property-collector</_this>' +
        '    <specSet>' +
        '        <propSet>' +
        '            <type>HostSystem</type>' +
        '            <pathSet>config.network.pnic</pathSet>' +
        '        </propSet>' +
        '        <objectSet>' +
        '            <obj type="HostSystem">' + hostRef + '</obj>' +
        '        </objectSet>' +
        '    </specSet>' +
        '</RetrieveProperties>'
    )
    // Send the SOAP request and handle the response to generate the desired variables.
    return sendSoapRequest(payload, generateTableOutput)
}

/**
 * Populates a table with Network Physical NICs Configuration
 */
function populateTable(pnicDetails) {
    networkPhysicalNicConfigurationTable.insertRecord(pnicDetails.id, [
        pnicDetails.device,
        pnicDetails.pciSlot,
        pnicDetails.driver,
        pnicDetails.linkSpeedMb,
        pnicDetails.duplex,
        pnicDetails.dhcpEnabled,
        pnicDetails.ipAddress,
        pnicDetails.subnetMask,
        pnicDetails.wakeOnLanSupported,
        pnicDetails.macAddress
    ]);
}

/**
 * Parses the SOAP response and generates variables from the retrieved properties.
 * @param {string} soapResponse - The SOAP response as a string.
 * @returns {{upsertRecord: function(string, Array<*>): void, getResult: function(): DriverTableResult, insertRecord: function(string, Array<*>): void, isTable: boolean, type: string}} the output tabel created from the extracted properties.
 */
function generateTableOutput(soapResponse) {
    const $ = D.htmlParse(soapResponse);

    $('propSet:has(name:contains("config.network.pnic")) PhysicalNic').each(function() {
        const pnicInfo = $(this);
        const linkSpeed = pnicInfo.find('linkSpeed');
        const spec = pnicInfo.find('spec');

        populateTable({
            id: pnicInfo.find('key').text(),
            device: pnicInfo.find('device').text() || "N/A",
            pciSlot: pnicInfo.find('pci').text() || "N/A",
            driver: pnicInfo.find('driver').text() || "N/A",
            linkSpeedMb: parseInt(linkSpeed.find('speedMb').text()) || 0,
            duplex: linkSpeed.find('duplex').text() === 'true' ? 'Full' : 'Half',
            dhcpEnabled: spec.find('ip dhcp').text() === 'true' ? 'Yes' : 'No',
            ipAddress: spec.find('ip ipAddress').text() || "N/A",
            subnetMask: spec.find('ip subnetMask').text() || "N/A",
            wakeOnLanSupported: pnicInfo.find('wakeOnLanSupported').text() === 'true' ? 'Yes' : 'No',
            macAddress: pnicInfo.find('mac').text() || "N/A"
        });
    });

    return networkPhysicalNicConfigurationTable;
}
/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate () {
    login()
        .then(function (sessionKey) {
            if(sessionKey && sessionKey.length > 0){
                D.success();
            }
        })
        .catch(function () {
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

/**
 * @remote_procedure
 * @label Get ESXi host Network Physical NIC Configuration
 * @documentation This procedure retrieves the ESXi host Network Physical NIC Configuration
 */
function get_status() {
    login().
    then(createAllHostContainer).
    then(fetchContainer).
    then(retrieveProprieties).
    then(D.success)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}