/**
 * Domotz Custom Driver
 * Name: ESXi CPU and Memory Information
 * Description: Monitors the CPU and Memory Information of the ESXi host.
 *
 * Communication protocol is HTTPS
 *
 * Tested on ESXi version: 8.0.0
 *
 * Custom Driver Variables:
 *      - Memory Usage: Represents the current memory usage of the ESXi host in gigahertz.
 *      - Memory Size: Indicates the total memory size of the ESXi host in gigabytes.
 *      - CPU Usage: Tracks the current CPU usage of the ESXi host in gigahertz.
 *      - CPU Speed: Displays the CPU speed of the ESXi host in gigahertz.
 *      - CPU Model: Specifies the model of the CPU used in the ESXi host.
 *      - Number of CPU Cores: Shows the total number of CPU cores in the ESXi host.
 *      - Number of CPU Threads: Indicates the total number of CPU threads available on the ESXi host.
 *
 **/

// URL endpoint for accessing the vSphere SDK
const url = '/sdk'

// Variable to store the headers for the SOAP request. This will include the vmware_soap_session.
let headers = "";

/**
 * Sets the request headers with the provided cookie information.
 * @param {Object} headerCookie - An object containing the 'Cookie' header with the appropriate value.
 */
function setHeaders(headerCookie) {
  headers = headerCookie;
}


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
    headers
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
      const result = extractData(body, response)
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
 * Extracts the 'Set-Cookie' header from the response.
 * @param {Object} body - The body of the response.
 * @param {Object} response - The response object containing the headers.
 * @returns {Object} An object containing the 'Cookie' header with the appropriate value from the 'set-cookie' header.
 */
function getHeaderCookie(body, response) {
  return {
    Cookie: response.headers['set-cookie'][0]
  }
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
  // Send the SOAP request and handle the response to extract the cookie header.
  return sendSoapRequest(payload, getHeaderCookie)
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
      '<vim25:RetrieveProperties>' +
      '   <vim25:_this type="PropertyCollector">ha-property-collector</vim25:_this>' +
      '   <vim25:specSet>' +
      '      <vim25:propSet>' +
      '         <vim25:type>HostSystem</vim25:type>' +
      '         <vim25:pathSet>summary.quickStats.overallMemoryUsage</vim25:pathSet>' +
      '         <vim25:pathSet>hardware.memorySize</vim25:pathSet>' +
      '         <vim25:pathSet>summary.quickStats.overallCpuUsage</vim25:pathSet>' +
      '         <vim25:pathSet>summary.hardware.cpuModel</vim25:pathSet>' +
      '         <vim25:pathSet>summary.hardware.cpuMhz</vim25:pathSet>' +
      '         <vim25:pathSet>summary.hardware.numCpuCores</vim25:pathSet>' +
      '         <vim25:pathSet>summary.hardware.numCpuThreads</vim25:pathSet>' +
      '      </vim25:propSet>' +
      '      <vim25:objectSet>' +
      '         <vim25:obj type="HostSystem">' + hostRef + '</vim25:obj>' +
      '      </vim25:objectSet>' +
      '   </vim25:specSet>' +
      '</vim25:RetrieveProperties>'
  )
  // Send the SOAP request and handle the response to generate the desired variables.
  return sendSoapRequest(payload, generateVariables)
}

/**
 * Converts a value from bytes to gigabytes.
 * @param {number} bytesValue - The value in bytes.
 * @returns {string} The value converted to gigabytes, rounded to two decimal places.
 */
function convertBytesToGb(bytesValue) {
  return (bytesValue / (1024 * 1024 * 1024)).toFixed(2);
}

/**
 * Converts a value from megabytes to gigabytes.
 * @param {number} MbValue - The value in megabytes.
 * @returns {string} The value converted to gigabytes, rounded to two decimal places.
 */
function convertMbToGb(MbValue) {
  return (MbValue / 1024).toFixed(2);
}

/**
 * Converts a value from megahertz to gigahertz.
 * @param {number} MHzValue - The value in megahertz.
 * @returns {string} The value converted to gigahertz, rounded to two decimal places.
 */
function convertMHzToGHz(MHzValue) {
  return (MHzValue / 1000).toFixed(2);
}

/**
 * Parses the SOAP response and generates variables from the retrieved properties.
 * @param {string} soapResponse - The SOAP response as a string.
 * @returns {Array} An array of variables created from the extracted properties.
 */
function generateVariables(soapResponse) {
  const $ = D.htmlParse(soapResponse);

  // Helper function to extract the value of a property from the parsed response based on the given path.
  function getPropSetValue(path) {
    return $("propSet").has("name:contains('" + path + "')").find("val").text() || "N/A";
  }

  const variables = [
    { id: 'overall-memory-usage', name: 'Memory Usage', path: 'summary.quickStats.overallMemoryUsage', "valueType": D.valueType.NUMBER, unit: "GB", callback: convertMbToGb },
    { id: 'memory-size', name: 'Memory Size', path: 'hardware.memorySize', "valueType": D.valueType.NUMBER, unit: "GB", callback: convertBytesToGb},
    { id: 'overall-cpu-usage', name: 'CPU Usage', path: 'summary.quickStats.overallCpuUsage', "valueType": D.valueType.NUMBER, unit: "GHz", callback: convertMHzToGHz },
    { id: 'cpu-mhz', name: 'CPU Speed', path: 'summary.hardware.cpuMhz', "valueType": D.valueType.NUMBER, unit: "GHz", callback: convertMHzToGHz },
    { id: 'cpu-model', name: 'CPU Model', path: 'summary.hardware.cpuModel', "valueType": D.valueType.STRING },
    { id: 'num-cpu-cores', name: 'Number of CPU Cores', path: 'summary.hardware.numCpuCores', "valueType": D.valueType.NUMBER },
    { id: 'num-cpu-threads', name: 'Number of CPU Threads', path: 'summary.hardware.numCpuThreads', "valueType": D.valueType.NUMBER }
  ];

  let result = [];
  for (let i = 0; i < variables.length; i++) {
    const value = getPropSetValue(variable.path);
    const finalValue = variable.callback ? variable.callback(value) : value;
    result.push(
        variable.valueType ?
            D.createVariable(variable.id, variable.name, finalValue, variable.unit || null, variable.valueType) :
            D.createVariable(variable.id, variable.name, getPropSetValue(variable.path), variable.unit || null)
    );
  }
  return result
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate () {
  login().
  then(D.success)
      .catch(function (err) {
        console.error(err);
        D.failure(D.errorType.GENERIC_ERROR);
      });
}

/**
 * @remote_procedure
 * @label Get ESXi General Information
 * @documentation This procedure retrieves the general information of the ESXi host
 */
function get_status() {
  login().
  then(setHeaders).
  then(createAllHostContainer).
  then(fetchContainer).
  then(retrieveProprieties).
  then(D.success)
      .catch(function (err) {
        console.error(err);
        D.failure(D.errorType.GENERIC_ERROR);
      });
}