/**
 * Domotz Custom Driver
 * Name: ESXi Datastore Details
 * Description: Monitors the ESXi host Datastore Details.
 *
 * Communication protocol is HTTPS
 *
 * Tested on ESXi version: 8.0.0
 *
 * Output:
 * Extracts the following information from the data array:
 * - ID
 * - Name
 * - Overall Status
 * - Accessible
 * - Virtual Machines
 *
 **/

// URL endpoint for accessing the vSphere SDK
const url = '/sdk'

// Creation of Datastore Details table
const datastoreDetailsTable = D.createTable(
    'Datastore Details',
    [
      {label: 'Name', valueType: D.valueType.STRING},
      {label: 'Overall Status', valueType: D.valueType.STRING},
      {label: 'Accessible', valueType: D.valueType.STRING},
      {label: 'Virtual Machines', valueType: D.valueType.STRING}
    ]
)

/**
 * Sends a SOAP request and returns a promise with the parsed response.
 * @param {string} body  The SOAP request body.
 * @param {function} extractData  A call back function to extract data from body and response.
 * @returns A promise that resolves with the parsed response.
 */
function sendSoapRequest(body, extractData) {
  const d = D.q.defer()

  let config = {
    url,
    protocol: "https",
    rejectUnauthorized: false,
    body,
    port: 46175,
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
function createSoapPayload(soapBody) {
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
function login() {
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
function createAllDataStoreContainer() {
  const payload = createSoapPayload(
      '<CreateContainerView xmlns="urn:vim25">' +
      '    <_this type="ViewManager">ViewManager</_this>' +
      '    <container type="Folder">ha-folder-datastore</container>' +
      '    <type>Datastore</type>' +
      '    <recursive>true</recursive>' +
      '</CreateContainerView>'
  )
  // Send the SOAP request and extract the container ID from the response.
  return sendSoapRequest(payload, getContainerIdFromSoap)
}

/**
 * Extracts the host reference from the SOAP response.
 * @param {string} soapResponse - The SOAP response as a string.
 * @returns {*[]} The list of datastore references extracted from the SOAP response.
 */
function getDataStoreRefFromSoap(soapResponse) {
  const $ = D.htmlParse(soapResponse)
  let datastoreRefs = []
  $('returnval').find('ManagedObjectReference').each(function () {
    datastoreRefs.push($(this).text())
  })
  return datastoreRefs
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
  return sendSoapRequest(payload, getDataStoreRefFromSoap)
}

/**
 * Generates an XML string of object sets for specified Managed Object References (MoRefs) and object type.
 * @param {string[]} refs - Array of MoRefs identifying objects in the vSphere environment.
 * @param {string} type - The object type (e.g., "VirtualMachine", "HostSystem").
 * @returns {string} XML-formatted string of object sets suitable for vSphere SOAP requests.
 */
function generateXmlObjectSetByMoRefAndType(refs, type) {
  return refs.map(function (ref) {
    return '<vim25:objectSet>' +
        '   <vim25:obj type="' + type + '">' + ref + '</vim25:obj>' +
        '</vim25:objectSet>'
  }).join('')
}

/**
 * Constructs and sends a SOAP request to retrieve properties for a specified host reference.
 * @param {string[]} dataStoresRef - The reference ID of a datastore whose properties are to be retrieved.
 * @returns {Promise} A promise that resolves with the properties of the host as extracted from the SOAP response.
 */
function retrieveProprieties(dataStoresRef) {
  const payload = createSoapPayload(
      '<vim25:RetrieveProperties>' +
      '   <vim25:_this type="PropertyCollector">ha-property-collector</vim25:_this>' +
      '   <vim25:specSet>' +
      '      <vim25:propSet>' +
      '         <vim25:type>Datastore</vim25:type>\n' +
      '         <vim25:pathSet>name</vim25:pathSet>\n' +
      '         <vim25:pathSet>summary.capacity</vim25:pathSet>\n' +
      '         <vim25:pathSet>summary.freeSpace</vim25:pathSet>\n' +
      '         <vim25:pathSet>summary.uncommitted</vim25:pathSet>\n' +
      '         <vim25:pathSet>summary.url</vim25:pathSet>\n' +
      '         <vim25:pathSet>summary.accessible</vim25:pathSet>\n' +
      '         <vim25:pathSet>summary.type</vim25:pathSet>\n' +
      '         <vim25:pathSet>host</vim25:pathSet>\n' +
      '         <vim25:pathSet>vm</vim25:pathSet>' +
      '      </vim25:propSet>' +
      generateXmlObjectSetByMoRefAndType(dataStoresRef, "Datastore") +
      '   </vim25:specSet>' +
      '</vim25:RetrieveProperties>'
  )
  // Send the SOAP request and handle the response to generate the desired variables.
  return sendSoapRequest(payload, generateTableOutput)
}

/**
 * Populates a table with Datastore Details.
 */
function populateTable(datastoreDetails) {
  datastoreDetailsTable.insertRecord(datastoreDetails.id, [
    datastoreDetails.name,
    datastoreDetails.overallStatus,
    datastoreDetails.accessible,
    datastoreDetails.virtualMachines
  ]);
}

/**
 * Extracts VM names from the SOAP response.
 * @param {string} soapResponse - The SOAP response as a string.
 * @returns {string} VM names.
 */
function extractVmNames(soapResponse) {
  const $ = D.htmlParse(soapResponse);
  const vmNames = [];
  $('propSet:has(name:contains("name"))').each(function () {
    const vmName = $(this).find('val').text();
    if (vmName) {
      vmNames.push(vmName);
    }
  });
  return vmNames.join(', ');
}

/**
 * Retrieves the names of Virtual Machines given an array of Managed Object References (MoRefs).
 * @param {string[]} vmMoRefs - Array of MoRefs identifying the Virtual Machines.
 * @returns {Promise<string[]>} A promise that resolves to an array of VM names.
 */
function getVmNamesByMoRefs(vmMoRefs) {
  const payload = createSoapPayload(
      '<vim25:RetrieveProperties>' +
      '   <vim25:_this type="PropertyCollector">ha-property-collector</vim25:_this>' +
      '   <vim25:specSet>' +
      '      <vim25:propSet>' +
      '         <vim25:type>VirtualMachine</vim25:type>' +
      '         <vim25:pathSet>name</vim25:pathSet>' +
      '      </vim25:propSet>' +
      generateXmlObjectSetByMoRefAndType(vmMoRefs, "VirtualMachine") +
      '   </vim25:specSet>' +
      '</vim25:RetrieveProperties>'
  )
  // Send the SOAP request and handle the response to generate the desired variables.
  return sendSoapRequest(payload, extractVmNames)
}

/**
 * Parses the SOAP response and generates variables from the retrieved properties.
 * @param {string} soapResponse - The SOAP response as a string.
 * @returns {Array} the output tabel created from the extracted properties.
 */
function generateTableOutput(soapResponse) {
  const $ = D.htmlParse(soapResponse);

  const promises = [];

  $('returnval').each(function () {
    const datastoreInfo = $(this);
    const vmRefs = datastoreInfo.find('propSet:has(name:contains("vm")) ManagedObjectReference').map(function () {
      return $(this).text();
    }).get();

    const promise = getVmNamesByMoRefs(vmRefs).then(function (vmNames) {
      populateTable({
        id: datastoreInfo.find('obj').text(),
        name: datastoreInfo.find('propSet:has(name:contains("name")) val').text() || "N/A",
        overallStatus: datastoreInfo.find('propSet:has(name:contains("overallStatus")) val').text() || "N/A",
        accessible: datastoreInfo.find('propSet:has(name:contains("summary.accessible")) val').text() === 'true' ? 'Yes' : 'No',
        virtualMachines: vmNames
      });
    });
    promises.push(promise);
  });

  D.q.all(promises).then(function () {
    D.success(datastoreDetailsTable);
  });
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate() {
  login()
      .then(function (sessionKey) {
        if (sessionKey && sessionKey.length > 0) {
          D.success();
        }
      })
      .catch(function () {
        D.failure(D.errorType.GENERIC_ERROR);
      });
}

/**
 * @remote_procedure
 * @label Get ESXi Datastore details
 * @documentation This procedure retrieves the ESXi host Datastore details
 */
function get_status() {
  login()
      .then(createAllDataStoreContainer)
      .then(fetchContainer)
      .then(retrieveProprieties)
      .catch(function (err) {
        console.error(err);
        D.failure(D.errorType.GENERIC_ERROR);
      });
}