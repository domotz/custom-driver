/**
 * Domotz Custom Driver
 * Name: ESXi General Information
 * Description: Monitors the general information of the ESXi host.
 *
 * Communication protocol is HTTPS
 *
 * Tested on ESXi version: 8.0.0
 *
 * Custom Driver Variables:
 *      - Name: Represents the name of the ESXi host.
 *      - Connection State: Tracks the current connection status of the ESXi host.
 *      - System Model: Indicates the hardware model of the ESXi host.
 *      - System Vendor: Identifies the vendor of the ESXi host's hardware.
 *      - Number Of NICs: Displays the number of Network Interface Cards (NICs) present in the ESXi host.
 *      - Number Of HBAs: Shows the number of Host Bus Adapters (HBAs) available in the ESXi host.
 *      - Product Version: Specifies the version of the ESXi host software.
 *      - API Version: Details the version of the API available on the ESXi host.
 *      - OS Type: The operating system type running on the ESXi host.
 *      - Product Line ID: Identifies the product line of the ESXi host.
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
      '         <vim25:pathSet>runtime.connectionState</vim25:pathSet>' +
      '         <vim25:pathSet>hardware.systemInfo.model</vim25:pathSet>' +
      '         <vim25:pathSet>hardware.systemInfo.vendor</vim25:pathSet>' +
      '         <vim25:pathSet>summary.hardware.numNics</vim25:pathSet>' +
      '         <vim25:pathSet>summary.hardware.numHBAs</vim25:pathSet>' +
      '         <vim25:pathSet>summary.config.name</vim25:pathSet>' +
      '         <vim25:pathSet>summary.config.product.version</vim25:pathSet>' +
      '         <vim25:pathSet>summary.config.product.build</vim25:pathSet>' +
      '         <vim25:pathSet>summary.config.product.apiVersion</vim25:pathSet>' +
      '         <vim25:pathSet>summary.config.product.osType</vim25:pathSet>' +
      '         <vim25:pathSet>summary.config.product.productLineId</vim25:pathSet>' +
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
    { id: 'name', name: 'Name', path: 'summary.config.name', "valueType": D.valueType.STRING},
    { id: 'connection-state', name: 'Connection State', path: 'runtime.connectionState', "valueType": D.valueType.STRING },
    { id: 'model', name: 'System Model', path: 'hardware.systemInfo.model', "valueType": D.valueType.STRING },
    { id: 'vendor', name: 'System Vendor', path: 'hardware.systemInfo.vendor', "valueType": D.valueType.STRING },
    { id: 'num-nics', name: 'Number of NICs', path: 'summary.hardware.numNics', "valueType": D.valueType.NUMBER },
    { id: 'num-hbas', name: 'Number of HBAs', path: 'summary.hardware.numHBAs', "valueType": D.valueType.NUMBER },
    { id: 'product-version', name: 'Product Version', path: 'summary.config.product.version', "valueType": D.valueType.STRING },
    { id: 'api-version', name: 'API Version', path: 'summary.config.product.apiVersion', "valueType": D.valueType.STRING },
    { id: 'os-type', name: 'OS Type', path: 'summary.config.product.osType', "valueType": D.valueType.STRING },
    { id: 'product-line-id', name: 'Product Line ID', path: 'summary.config.product.productLineId', "valueType": D.valueType.STRING }
  ];
  let result = [];

  for (let i = 0; i < variables.length; i++) {
    const variable = variables[i]
    result.push( variable.valueType ?
            D.createVariable(variable.id, variable.name, getPropSetValue(variable.path), variable.unit || null, variable.valueType) :
            D.createVariable(variable.id, variable.name, getPropSetValue(variable.path), variable.unit || null)
    )
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