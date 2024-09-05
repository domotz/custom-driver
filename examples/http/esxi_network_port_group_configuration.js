/**
 * Domotz Custom Driver
 * Name: ESXi Network Port Group Configuration
 * Description: Monitors the ESXi host Network Port Group Configuration.
 *
 * Communication protocol is HTTPS
 *
 * Tested on ESXi version: 8.0.0
 *
 * Output:
 * Extracts the following information from the data array:
 * - Port Group Name
 * - VLAN ID
 * - MAC Address
 * - Allow Promiscuous
 * - MAC Address Changes
 * - Forged Transmits
 * - Reverse Policy
 * - Notify Switches
 * - Rolling Order
 * - Check Speed
 * - Speed
 * - Check Duplex
 * - Full Duplex
 * - Check Error Percentage
 * - Error Percentage
 * - Check Beacon
 * - Active NIC
 * - Checksum Offload
 * - TCP Segmentation
 * - Zero Copy Transmission
 * - Shaping Policy Enabled

 * - vSwitch Name
 * - Security Policy
 * - NIC Teaming Policy
 * - NIC Teaming Failure Criteria
 * - Offload Policy
 * - Shaping Policy
 *
 **/

// URL endpoint for accessing the vSphere SDK
const url = '/sdk'


// Creation of Network Port Group Configuration table
const networkPortGroupConfigurationTable = D.createTable(
    'Network Port Group Configuration',
    [
        { label: 'Port Group Name', valueType: D.valueType.STRING },
        { label: 'VLAN ID', valueType: D.valueType.NUMBER },
        { label: 'MAC Address', valueType: D.valueType.STRING },
        { label: 'Allow Promiscuous', valueType: D.valueType.STRING },
        { label: 'MAC Address Changes', valueType: D.valueType.STRING },
        { label: 'Forged Transmits', valueType: D.valueType.STRING },
        { label: 'Reverse Policy', valueType: D.valueType.STRING },
        { label: 'Notify Switches', valueType: D.valueType.STRING },
        { label: 'Rolling Order', valueType: D.valueType.STRING },
        { label: 'Check Speed', valueType: D.valueType.STRING },
        { label: 'Speed', valueType: D.valueType.NUMBER },
        { label: 'Check Duplex', valueType: D.valueType.STRING },
        { label: 'Full Duplex', valueType: D.valueType.STRING },
        { label: 'Check Error Percentage', valueType: D.valueType.STRING },
        { label: 'Error Percentage', valueType: D.valueType.NUMBER, unit:'%' },
        { label: 'Check Beacon', valueType: D.valueType.STRING },
        { label: 'Active NIC', valueType: D.valueType.STRING },
        { label: 'Checksum Offload', valueType: D.valueType.STRING },
        { label: 'TCP Segmentation', valueType: D.valueType.STRING },
        { label: 'Zero Copy Transmission', valueType: D.valueType.STRING },
        { label: 'Shaping Policy Enabled', valueType: D.valueType.STRING },
        { label: 'vSwitch Name', valueType: D.valueType.STRING },
        { label: 'Security Policy', valueType: D.valueType.STRING },
        { label: 'NIC Teaming Policy', valueType: D.valueType.STRING },
        { label: 'NIC Teaming Failure Criteria', valueType: D.valueType.STRING },
        { label: 'Offload Policy', valueType: D.valueType.STRING },
        { label: 'Shaping Policy', valueType: D.valueType.STRING }
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
      '            <pathSet>config.network.portgroup</pathSet>' +
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
 * Populates a table with Network Port Group Configuration.
 */
function populateTable(portGroupDetails) {
  networkPortGroupConfigurationTable.insertRecord(portGroupDetails.id, [
    portGroupDetails.portGroupName,
    portGroupDetails.vlanId,
    portGroupDetails.macAddress,
    portGroupDetails.allowPromiscuous,
    portGroupDetails.macChanges,
    portGroupDetails.forgedTransmits,
    portGroupDetails.reversePolicy,
    portGroupDetails.notifySwitches,
    portGroupDetails.rollingOrder,
    portGroupDetails.checkSpeed,
    portGroupDetails.speed,
    portGroupDetails.checkDuplex,
    portGroupDetails.fullDuplex,
    portGroupDetails.checkErrorPercentage,
    portGroupDetails.errorPercentage,
    portGroupDetails.checkBeacon,
    portGroupDetails.activeNic,
    portGroupDetails.checksumOffload,
    portGroupDetails.tcpSegmentation,
    portGroupDetails.zeroCopyTransmission,
    portGroupDetails.shapingPolicyEnabled,
    portGroupDetails.vSwitchName,
    portGroupDetails.securityPolicy,
    portGroupDetails.nicTeamingPolicy,
    portGroupDetails.nicTeamingFailureCriteria,
    portGroupDetails.offloadPolicy,
    portGroupDetails.shapingPolicy
  ]);
}

/**
 * Parses the SOAP response and generates variables from the retrieved properties.
 * @param {string} soapResponse - The SOAP response as a string.
 * @returns {{upsertRecord: function(string, Array<*>): void, getResult: function(): DriverTableResult, insertRecord: function(string, Array<*>): void, isTable: boolean, type: string}} the output tabel created from the extracted properties.
 */
function generateTableOutput(soapResponse) {
  const $ = D.htmlParse(soapResponse);

    function getMacAddress(port) {
        let result = []
            port.each(function() {
                result.push( '"' + ($(this).find('mac').text() || "N/A") + " (" + ($(this).find('type').text() || "N/A") + ')"')
            }
        )
        return result.join(', ')
    }

    $('propSet:has(name:contains("config.network.portgroup")) HostPortGroup').each(function() {
    const portGroupInfo = $(this);
    const computedPolicy = portGroupInfo.find('computedPolicy');
    const spec = portGroupInfo.find('spec');

    populateTable({
      id: portGroupInfo.children('key').text() || "N/A",
      portGroupName: spec.find('name').text() || "N/A",
      vlanId: parseInt(spec.find('vlanId').text()) || 0,
      macAddress: getMacAddress(portGroupInfo.find('port')),
      allowPromiscuous: computedPolicy.find('security allowPromiscuous').text() || "N/A",
      macChanges: computedPolicy.find('security macChanges').text() || "N/A",
      forgedTransmits: computedPolicy.find('security forgedTransmits').text() || "N/A",
      reversePolicy: computedPolicy.find('nicTeaming reversePolicy').text() || "N/A",
      notifySwitches: computedPolicy.find('nicTeaming notifySwitches').text() || "N/A",
      rollingOrder: computedPolicy.find('nicTeaming rollingOrder').text() || "N/A",
      checkSpeed: computedPolicy.find('nicTeaming failureCriteria checkSpeed').text() || "N/A",
      speed: parseInt(computedPolicy.find('nicTeaming failureCriteria speed').text()) || 0,
      checkDuplex: computedPolicy.find('nicTeaming failureCriteria checkDuplex').text() || "N/A",
      fullDuplex: computedPolicy.find('nicTeaming failureCriteria fullDuplex').text() || "N/A",
      checkErrorPercentage: computedPolicy.find('nicTeaming failureCriteria checkErrorPercent').text() || "N/A",
      errorPercentage: parseInt(computedPolicy.find('nicTeaming failureCriteria percentage').text()) || 0,
      checkBeacon: computedPolicy.find('nicTeaming failureCriteria checkBeacon').text() || "N/A",
      activeNic: computedPolicy.find('nicTeaming nicOrder activeNic').text() || "N/A",
      checksumOffload: computedPolicy.find('offloadPolicy csumOffload').text() || "N/A",
      tcpSegmentation: computedPolicy.find('offloadPolicy tcpSegmentation').text() || "N/A",
      zeroCopyTransmission: computedPolicy.find('offloadPolicy zeroCopyXmit').text() || "N/A",
      shapingPolicyEnabled: computedPolicy.find('shapingPolicy enabled').text() || "N/A",
      vSwitchName: spec.find('vswitchName').text() || "N/A",
      securityPolicy: spec.find('policy security').text() || "N/A",
      nicTeamingPolicy: spec.find('policy nicTeaming').text() || "N/A",
      nicTeamingFailureCriteria: spec.find('policy nicTeaming failureCriteria').text() || "N/A",
      offloadPolicy: spec.find('policy offloadPolicy').text() || "N/A",
      shapingPolicy: spec.find('policy shapingPolicy').text() || "N/A"
    });
  });

  return networkPortGroupConfigurationTable;
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
 * @label Get ESXi host Network Port Group Configuration
 * @documentation This procedure retrieves the ESXi host Network Port Group Configuration
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