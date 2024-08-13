/**
 * Domotz Custom Driver
 * Name: ESXi Network Virtual Switch Configuration
 * Description: Monitors the ESXi host Network Virtual Switch Configuration.
 *
 * Communication protocol is HTTPS
 *
 * Tested on ESXi version: 8.0.0
 *
 * Output:
 * Extracts the following information from the data array:
 * - ID
 * - Virtual Switch Name
 * - Virtual Switch Key
 * - Number of Ports
 * - Number of Available Ports
 * - MTU
 * - Port Group
 * - Physical NIC
 * - Specified Number of Ports
 * - Bridge NIC Device
 * - Beacon Interval
 * - Allow Promiscuous
 * - MAC Changes
 * - Forged Transmits
 * - NIC Teaming Policy
 * - Reverse Policy
 * - Notify Switches
 * - Rolling Order
 * - Failure Criteria Check Speed
 * - Failure Criteria Speed
 * - Failure Criteria Check Duplex
 * - Failure Criteria Full Duplex
 * - Failure Criteria Check Error Percent
 * - Failure Criteria Percentage
 * - Failure Criteria Check Beacon
 * - Active NIC
 * - Checksum Offload
 * - TCP Segmentation
 * - Zero Copy Transmit
 * - Shaping Policy Enabled
 *
 **/

// URL endpoint for accessing the vSphere SDK
const url = '/sdk'


// Creation of Network Virtual Switch Configuration table
var networkVirtualSwitchConfigurationTable = D.createTable(
    'Network Virtual Switch Configuration',
    [
        { label: 'Virtual Switch Name', valueType: D.valueType.STRING },
        { label: 'Virtual Switch Key', valueType: D.valueType.STRING },
        { label: 'Number of Ports', valueType: D.valueType.NUMBER },
        { label: 'Number of Available Ports', valueType: D.valueType.NUMBER },
        { label: 'MTU', valueType: D.valueType.NUMBER },
        { label: 'Port Group', valueType: D.valueType.STRING },
        { label: 'Physical NIC', valueType: D.valueType.STRING },
        { label: 'Specified Number of Ports', valueType: D.valueType.NUMBER },
        { label: 'Bridge NIC Device', valueType: D.valueType.STRING },
        { label: 'Beacon Interval', valueType: D.valueType.NUMBER },
        { label: 'Allow Promiscuous', valueType: D.valueType.STRING },
        { label: 'MAC Changes', valueType: D.valueType.STRING },
        { label: 'Forged Transmits', valueType: D.valueType.STRING },
        { label: 'NIC Teaming Policy', valueType: D.valueType.STRING },
        { label: 'Reverse Policy', valueType: D.valueType.STRING },
        { label: 'Notify Switches', valueType: D.valueType.STRING },
        { label: 'Rolling Order', valueType: D.valueType.STRING },
        { label: 'Failure Criteria Check Speed', valueType: D.valueType.STRING },
        { label: 'Failure Criteria Speed', valueType: D.valueType.NUMBER },
        { label: 'Failure Criteria Check Duplex', valueType: D.valueType.STRING },
        { label: 'Failure Criteria Full Duplex', valueType: D.valueType.STRING },
        { label: 'Failure Criteria Check Error', valueType: D.valueType.STRING, unit: "%" },
        { label: 'Failure Criteria', valueType: D.valueType.NUMBER, unit: "%" },
        { label: 'Failure Criteria Check Beacon', valueType: D.valueType.STRING },
        { label: 'Active NIC', valueType: D.valueType.STRING },
        { label: 'Checksum Offload', valueType: D.valueType.STRING },
        { label: 'TCP Segmentation', valueType: D.valueType.STRING },
        { label: 'Zero Copy Transmit', valueType: D.valueType.STRING },
        { label: 'Shaping Policy Enabled', valueType: D.valueType.STRING }
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
      '            <pathSet>config.network.vswitch</pathSet>' +
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
 * Populates a table with Network Virtual Switchs Configuration
 */
function populateTable(vSwitchDetails) {
    networkVirtualSwitchConfigurationTable.insertRecord(vSwitchDetails.id, [
        vSwitchDetails.name,
        vSwitchDetails.key,
        vSwitchDetails.numPorts,
        vSwitchDetails.numPortsAvailable,
        vSwitchDetails.mtu,
        vSwitchDetails.portGroup.join(", "),
        vSwitchDetails.pnic,
        vSwitchDetails.specifiedNumPorts,
        vSwitchDetails.bridgeNicDevice,
        vSwitchDetails.beaconInterval,
        vSwitchDetails.allowPromiscuous,
        vSwitchDetails.macChanges,
        vSwitchDetails.forgedTransmits,
        vSwitchDetails.nicTeamingPolicy,
        vSwitchDetails.reversePolicy,
        vSwitchDetails.notifySwitches,
        vSwitchDetails.rollingOrder,
        vSwitchDetails.failureCriteriaCheckSpeed,
        vSwitchDetails.failureCriteriaSpeed,
        vSwitchDetails.failureCriteriaCheckDuplex,
        vSwitchDetails.failureCriteriaFullDuplex,
        vSwitchDetails.failureCriteriaCheckErrorPercent,
        vSwitchDetails.failureCriteriaPercentage,
        vSwitchDetails.failureCriteriaCheckBeacon,
        vSwitchDetails.activeNic,
        vSwitchDetails.checksumOffload,
        vSwitchDetails.tcpSegmentation,
        vSwitchDetails.zeroCopyTransmit,
        vSwitchDetails.shapingPolicyEnabled
    ]);
}

/**
 * Parses the SOAP response and generates variables from the retrieved properties.
 * @param {string} soapResponse - The SOAP response as a string.
 * @returns {{upsertRecord: function(string, Array<*>): void, getResult: function(): DriverTableResult, insertRecord: function(string, Array<*>): void, isTable: boolean, type: string}} the output tabel created from the extracted properties.
 */
function generateTableOutput(soapResponse) {
    const $ = D.htmlParse(soapResponse);

    $('propSet:has(name:contains("config.network.vswitch")) HostVirtualSwitch').each(function() {
        const vSwitchInfo = $(this);
        const spec = vSwitchInfo.find('spec');
        const policy = spec.find('policy');
        const nicTeaming = policy.find('nicTeaming');
        const failureCriteria = nicTeaming.find('failureCriteria');
        const offloadPolicy = policy.find('offloadPolicy');
        const shapingPolicy = policy.find('shapingPolicy');

        populateTable({
            id: vSwitchInfo.find('key').text() || "N/A",
            name: vSwitchInfo.find('name').text() || "N/A",
            key: vSwitchInfo.find('key').text() || "N/A",
            numPorts: parseInt(vSwitchInfo.find('numPorts').text()) || 0,
            numPortsAvailable: parseInt(vSwitchInfo.find('numPortsAvailable').text()) || 0,
            mtu: parseInt(vSwitchInfo.find('mtu').text()) || 0,
            portGroup: vSwitchInfo.find('portgroup').map(function() { return $(this).text(); }).get(),
            pnic: vSwitchInfo.find('pnic').text() || "N/A",
            specifiedNumPorts: parseInt(spec.find('numPorts').text()) || 0,
            bridgeNicDevice: spec.find('bridge nicDevice').text() || "N/A",
            beaconInterval: parseInt(spec.find('bridge beacon interval').text()) || 0,
            allowPromiscuous: policy.find('security allowPromiscuous').text() === 'true' ? 'Yes' : 'No',
            macChanges: policy.find('security macChanges').text() === 'true' ? 'Yes' : 'No',
            forgedTransmits: policy.find('security forgedTransmits').text() === 'true' ? 'Yes' : 'No',
            nicTeamingPolicy: nicTeaming.find('policy').text() || "N/A",
            reversePolicy: nicTeaming.find('reversePolicy').text() === 'true' ? 'Yes' : 'No',
            notifySwitches: nicTeaming.find('notifySwitches').text() === 'true' ? 'Yes' : 'No',
            rollingOrder: nicTeaming.find('rollingOrder').text() === 'true' ? 'Yes' : 'No',
            failureCriteriaCheckSpeed: failureCriteria.find('checkSpeed').text() || "N/A",
            failureCriteriaSpeed: parseInt(failureCriteria.find('speed').text()) || 0,
            failureCriteriaCheckDuplex: failureCriteria.find('checkDuplex').text() === 'true' ? 'Yes' : 'No',
            failureCriteriaFullDuplex: failureCriteria.find('fullDuplex').text() === 'true' ? 'Yes' : 'No',
            failureCriteriaCheckErrorPercent: failureCriteria.find('checkErrorPercent').text() === 'true' ? 'Yes' : 'No',
            failureCriteriaPercentage: parseInt(failureCriteria.find('percentage').text()) || 0,
            failureCriteriaCheckBeacon: failureCriteria.find('checkBeacon').text() === 'true' ? 'Yes' : 'No',
            activeNic: nicTeaming.find('nicOrder activeNic').text() || "N/A",
            checksumOffload: offloadPolicy.find('csumOffload').text() === 'true' ? 'Yes' : 'No',
            tcpSegmentation: offloadPolicy.find('tcpSegmentation').text() === 'true' ? 'Yes' : 'No',
            zeroCopyTransmit: offloadPolicy.find('zeroCopyXmit').text() === 'true' ? 'Yes' : 'No',
            shapingPolicyEnabled: shapingPolicy.find('enabled').text() === 'true' ? 'Yes' : 'No'
        });
    });

    return networkVirtualSwitchConfigurationTable;
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
 * @label Get ESXi host Network Virtual Switch Configuration
 * @documentation This procedure retrieves the ESXi host Network Virtual Switch Configuration
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