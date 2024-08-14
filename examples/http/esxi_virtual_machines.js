/**
 * Domotz Custom Driver
 * Name: ESXi Virtual Machines
 * Description: Retrieves detailed information about virtual machines from an ESXi server
 *
 * Communication protocol is HTTPS
 *
 * Tested on ESXi version: 8.0.0
 *
 * Creates a Custom Driver Table with the following columns
 *    - Name: Name of the virtual machine
 *    - Power State: Current power state of the VM
 *    - Overall Status: Overall status of the VM
 *    - Number MKS Connections: Number of MKS connections
 *    - Guest Full Name: Full name of the guest OS
 *    - Guest State: State of the guest OS
 *    - Guest OS ID: Identifier for the guest OS
 *    - Number of CPUs: Number of virtual CPUs
 *    - Memory: Amount of memory allocated (in MB)
 *    - VMware Tools Status: Status of VMware Tools
 *    - VMware Tools Version Status: Version status of VMware Tools
 *    - VMware Tools Running Status: Running status of VMware Tools
 *    - VM Path Name: Path name of the VM
 *    - Host: Host where the VM is running
 *    - Connection State: Connection state of the VM
 *    - Maximum Memory Usage: Maximum memory usage (in MB)
 *    - Maximum CPU Usage: Maximum CPU usage (in MHz)
 *    - Template: Indicates if the VM is a template
 *    - Number Ethernet Cards: Number of virtual Ethernet cards
 *    - Number Virtual Disks: Number of Virtual Disks assigned to the VM
 *
 **/

// URL endpoint for accessing the vSphere SDK
const url = '/sdk'

// This parameter specifies which VMs to monitor
// Example usage:
// filteredVMIds = ["11", "22"] to monitor specific VMs
// or
// filteredVMIds = ["All"] to monitor all VMs.
const filteredVMIds = D.getParameter('vmID')

// Table to store virtual machine details
var table = D.createTable(
  'Virtual Machines',
  [
    { label: 'Name', valueType: D.valueType.STRING},
    { label: 'Power State', valueType: D.valueType.STRING },
    { label: 'Overall Status', valueType: D.valueType.STRING },
    { label: 'Number MKS Connections', valueType: D.valueType.NUMBER },
    { label: 'Guest Full Name', valueType: D.valueType.STRING },
    { label: 'Guest State', valueType: D.valueType.STRING },
    { label: 'Guest OS ID', valueType: D.valueType.STRING },
    { label: 'Number of CPUs', valueType: D.valueType.NUMBER },
    { label: 'Memory', valueType: D.valueType.NUMBER, unit:'MB'},
    { label: 'VMware Tools Status', valueType: D.valueType.STRING },
    { label: 'VMware Tools Version Status', valueType: D.valueType.STRING },
    { label: 'VMware Tools Running Status', valueType: D.valueType.STRING },
    { label: 'VM Path Name', valueType: D.valueType.STRING },
    { label: 'Host', valueType: D.valueType.STRING },
    { label: 'Connection State', valueType: D.valueType.STRING },
    { label: 'Maximum Memory Usage', valueType: D.valueType.NUMBER, unit:'MB'},
    { label: 'Maximum CPU Usage', valueType: D.valueType.NUMBER, unit:'MHz'},
    { label: 'Template', valueType: D.valueType.STRING },
    { label: 'Number Ethernet Cards', valueType: D.valueType.NUMBER },
    { label: 'Number Virtual Disks', valueType: D.valueType.NUMBER }
  ]
)

/**
 * An array of property paths to retrieve details for each VM
 * Each path corresponds to a specific VM attribute that we want to include in the results
 */
const paths = [
  "config.name", 
  "runtime.powerState",
  "summary.overallStatus",
  "runtime.numMksConnections",
  "config.guestFullName",
  "guest.guestState",
  "summary.config.guestId",
  "config.hardware.numCPU",
  "config.hardware.memoryMB",
  "guest.toolsStatus",
  "guest.toolsVersionStatus2",
  "guest.toolsRunningStatus",
  "summary.config.vmPathName",
  "summary.runtime.host",
  "runtime.connectionState",
  "summary.runtime.maxMemoryUsage",
  "summary.runtime.maxCpuUsage",
  "config.template",
  "summary.config.numEthernetCards",
  "summary.config.numVirtualDisks"
]

/**
 * Sends a SOAP request and returns a promise with the parsed response
 * @param {string} body The SOAP request body
 * @param {function} extractData  A call back function to extract data from body and response
 * @returns A promise that resolves with the parsed response
 */
function sendSoapRequest (body, extractData) {
  const d = D.q.defer()
  const config ={
    url,
    protocol: 'https',
    body,
    jar: true,
    rejectUnauthorized: false
  }
  D.device.http.post(config, function (error, response, body) {
    if (error) {
      console.log(error)
      D.failure(D.errorType.GENERIC_ERROR)
    }
    const $ = D.htmlParse(body)
    const faultCode = $('faultcode').text()
    const faultString = $('faultstring').text()
    if (faultCode && faultString) {
      if (faultCode.includes('ServerFaultCode') && faultString.includes('Cannot complete login due to an incorrect user name or password.')) {
        D.failure(D.errorType.AUTHENTICATION_ERROR)
      } else {
        D.failure(D.errorType.GENERIC_ERROR)
      }
    } else if (!body) {
      D.failure(D.errorType.RESOURCE_UNAVAILABLE)
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
 * Constructs a SOAP payload with the given body content
 * @param {string} soapBody The content to be included in the SOAP body
 * @returns {string} The complete SOAP payload as a string, including the envelope and body
 */
function createSoapPayload (soapBody) {
  return '<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:vim25="urn:vim25"><soapenv:Body>'
         + soapBody + '</soapenv:Body></soapenv:Envelope>'
}

/**
 * Parses the SOAP response to extract the Session Key
 * @param {string} soapResponse The SOAP response as a string
 * @returns {string} The Session Key extracted from the SOAP response
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
    '  <_this type="SessionManager">ha-sessionmgr</_this>' +
    '  <userName>' + D.device.username() + '</userName>' +
    '  <password>' + D.device.password() + '</password>' +
    '</vim25:Login>'
  )
  return sendSoapRequest(payload, getSessionKey)
}

/**
 * Extracts VM IDs from the SOAP response
 * @param {string} soapResponse The SOAP response as a string
 * @returns {string} The ManagedObjectReference IDs of VMs
 */
function getVMs(soapResponse) {
  const $ = D.htmlParse(soapResponse)
  return $('ManagedObjectReference').map(function() {
    return $(this).text()
  }).get()
}

/**
 * Retrieves the list of VM IDs from the ESXi server
 * @returns {Promise} A promise that resolves with the list of VM IDs
 */
function retrieveProprieties() {
  const payload = createSoapPayload(
    '<vim25:RetrieveProperties>' +
    '  <vim25:_this type="PropertyCollector">ha-property-collector</vim25:_this>' +
    '  <vim25:specSet>' +
    '    <vim25:propSet>' +
    '      <vim25:type>Folder</vim25:type>' +
    '      <vim25:all>false</vim25:all>' +
    '      <vim25:pathSet>childEntity</vim25:pathSet>' +
    '    </vim25:propSet>' +
    '    <vim25:objectSet>' +
    '      <vim25:obj type="Folder">ha-folder-vm</vim25:obj>' +
    '      <vim25:skip>false</vim25:skip>' +
    '    </vim25:objectSet>' +
    '  </vim25:specSet>' +
    '</vim25:RetrieveProperties>' 
  )
  return sendSoapRequest(payload, getVMs)
}

/**
 * Generates the path set for retrieving VM properties
 * @returns {string} The path set XML elements
 */
function generatesPathSet() {
  return paths.map(function(path) {
    return '<vim25:pathSet>' + path + '</vim25:pathSet>'
  }).join(' ')
}

/**
 * Retrieves detailed information about VMs 
 * @param {Array} vmIds The IDs of the VMs to retrieve details for
 * @returns {Promise} A promise that resolves with the detailed VM information
 */
function retrieveVMDetails(vmIds) {
  const objectSets = (filteredVMIds.length === 1 && filteredVMIds[0].toLowerCase() === 'all' ? vmIds : vmIds.filter(function(vmID) { return filteredVMIds.includes(vmID)}))
  .map(function(vmID) { 
    return '<vim25:objectSet>' + 
    '  <vim25:obj type="VirtualMachine">' + vmID + '</vim25:obj>' +
    '</vim25:objectSet>'
  }).join('')
  const payload =  createSoapPayload(
    '<vim25:RetrieveProperties>' + 
    '  <vim25:_this type="PropertyCollector">ha-property-collector</vim25:_this>' + 
    '  <vim25:specSet>' + 
    '    <vim25:propSet>' + 
    '      <vim25:type>VirtualMachine</vim25:type>' + 
    generatesPathSet() +
    '    </vim25:propSet>' + objectSets +
    '  </vim25:specSet>' + 
    '</vim25:RetrieveProperties>' 
  )
  return sendSoapRequest(payload, parseVMDetails)
}

/**
 * Parses the SOAP response to extract VM details
 * @param {string} soapResponse The SOAP response as a string
 * @returns {Object} An array of objects containing VM details
 */
function parseVMDetails(soapResponse) {
  const $ = D.htmlParse(soapResponse)
  const vmDetailsList = []

  $('returnval').each(function() {
    const recordId = $(this).find('obj').text()
    const properties = {}
    $(this).find('propSet').each(function() {
      const name = $(this).find('name').text()
      const val = $(this).find('val').text()
      properties[name] = val
    })
    const vmDetails = { recordId }
    paths.forEach(function(path) {
      vmDetails[path] = properties[path]
    })
    vmDetailsList.push(vmDetails)
  })
  vmDetailsList.forEach(populateTable)
  D.success(table)
}

/**
 * Populates the table with VM details
 * @param {Object} vmDetails The details of VM
 */
function populateTable(vmDetails) {
  table.insertRecord(vmDetails.recordId, [
    vmDetails['config.name'] || 'N/A',
    vmDetails['runtime.powerState'] || 'N/A',
    vmDetails['summary.overallStatus'] || 'N/A',
    vmDetails['runtime.numMksConnections'] || 0,
    vmDetails['config.guestFullName'] || 'N/A',
    vmDetails['guest.guestState'] || 'N/A',
    vmDetails['summary.config.guestId'] || 'N/A',
    vmDetails['config.hardware.numCPU'] || 0,
    vmDetails['config.hardware.memoryMB'] || 0,
    vmDetails['guest.toolsStatus'] || 'N/A',
    vmDetails['guest.toolsVersionStatus2'] || 'N/A',
    vmDetails['guest.toolsRunningStatus'] || 'N/A',
    vmDetails['summary.config.vmPathName'] || 'N/A',
    vmDetails['summary.runtime.host'] || 'N/A',
    vmDetails['runtime.connectionState'] || 'N/A',
    vmDetails['summary.runtime.maxMemoryUsage'] || 0,
    vmDetails['summary.runtime.maxCpuUsage'] || 0,
    vmDetails['config.template'] || 'N/A',
    vmDetails['summary.config.numEthernetCards'] || 0,
    vmDetails['summary.config.numVirtualDisks'] || 0
  ]);
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate () {
  login()
    .then(function (sessionKey) {
      console.log('Login successful')
      if(sessionKey && sessionKey.length > 0){
        return retrieveProprieties()
      }
    })
    .then(function(vmIds) {
      if (vmIds.length > 0) {
        console.log('VMs found. Validation successful')
        D.success()
      } else {
        D.failure(D.errorType.RESOURCE_UNAVAILABLE)
      }
    })
    .catch(function () {
      D.failure(D.errorType.GENERIC_ERROR)
    })
}

/**
 * @remote_procedure
 * @label Get VM Details
 * @documentation This procedure retrieves details for all VMs
 */
function get_status() {
  login()
    .then(retrieveProprieties)
    .then(retrieveVMDetails)  
    .catch(function (err) {
      console.error(err)
      D.failure(D.errorType.GENERIC_ERROR)
    })
}