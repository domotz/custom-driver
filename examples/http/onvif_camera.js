/**
 * Domotz Custom Driver
 * Name: ONVIF camera monitoring
 * Description: Monitors the video capturing status of an ONVIF camera to check if capturing is still working or has stopped.
 *
 * Communication protocol is ONVIF
 *
 * Tested on LILIN camera model LD2222
 *
 * Creates a Custom Driver table  with the following columns:
 *       - ProfileName: Name of the camera profile
 *       - Streaming status: Video capturing status for each camera profiles
 *
 **/

// Device credentials
const username = D.device.username()
const password = D.device.password()

// Table for Streaming status
const table = D.createTable(
  'Video Streaming Status',
  [
    { label: 'Profile name', valueType: D.valueType.STRING },
    { label: 'Streaming status', valueType: D.valueType.STRING }
  ]
)

// HTTP request parameters
const url = '/onvif/device_service'

// This parameter specifies which camera profile's video capturing status to monitor
// Example usage:
// profileName = ["Profile1", "Profile2"] to monitor specific profiles
// or
// profileName = ["All"] to monitor all profiles.
const filterProfileName = D.getParameter('profileName')

// ONVIF port parameter
// The port number can be found in the camera's manual or through the camera's admin web app settings. Default is 80.
const onvifPort = D.getParameter('onvifPort')

const telnetParams = {
  negotiationMandatory: false,
  port: 554
}

// Generate nonce for digest authentication
const nonce = Math.random().toString(36).substring(2, 7)
const currentDate = new Date()

// The current timestamp in UTC format required for the Created element in the digest authentication
const created = currentDate.getUTCFullYear() + '-' +
              ((currentDate.getUTCMonth() + 1) < 10 ? '0' : '') + (currentDate.getUTCMonth() + 1) + '-' +
              (currentDate.getUTCDate() < 10 ? '0' : '') + currentDate.getUTCDate() + 'T' +
              (currentDate.getUTCHours() < 10 ? '0' : '') + currentDate.getUTCHours() + ':' +
              (currentDate.getUTCMinutes() < 10 ? '0' : '') + currentDate.getUTCMinutes() + ':' +
              (currentDate.getUTCSeconds() < 10 ? '0' : '') + currentDate.getUTCSeconds() + 'Z'

// Combine nonce, created timestamp, and password to create the string for hashing
const combinedString = nonce + created + password
// Hash the combined string using SHA1 and encode it in base64 for the Password Digest
const passwordDigest = D.crypto.hash(combinedString, 'sha1', null, 'base64')

/**
 * Generates the security envelope for SOAP requests.
 * @returns {string} The security envelope
 */
function getSecurityEnvelope () {
  return '<wsse:Security>' +
           '<wsse:UsernameToken>' +
           '<wsse:Username>' + username + '</wsse:Username>' +
           '<wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">' + passwordDigest + '</wsse:Password>' +
           '<wsse:Nonce>' + D._unsafe.buffer.from(nonce).toString('base64') + '</wsse:Nonce>' +
           '<wsse:Created>' + created + '</wsse:Created>' +
           '</wsse:UsernameToken>' +
           '</wsse:Security>'
}

/**
 * Sends a SOAP request and returns a promise with the parsed response.
 * @param {string} body  The SOAP request body.
 * @param {function} parseResponse  A function to parse the response body.
 * @returns A promise that resolves with the parsed response.
 */
function sendSoapRequest (body, parseResponse) {
  const d = D.q.defer()
  const config = {
    url,
    username,
    password,
    port: onvifPort,
    body
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
      const result = parseResponse(body)
      d.resolve(result)
    }
  })
  return d.promise
}

/**
 * Retrieves profiles information.
 * @returns A promise that resolves with an array of profiles information.
 */
function getProfilesInfo () {
  const payload = '<?xml version="1.0" encoding="UTF-8"?>' +
                  '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:trt="http://www.onvif.org/ver10/media/wsdl" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext1.0.xsd">' +
                  '<soap:Header>' + getSecurityEnvelope() + '</soap:Header>' +
                  '<soap:Body>' +
                  '<trt:GetProfiles/>' +
                  '</soap:Body>' +
                  '</soap:Envelope>'
  return sendSoapRequest(payload, function (body) {
    const $ = D.htmlParse(body)
    const profiles = $('trt\\:Profiles')
    const profilesInfo = []
    profiles.each(function (index, element) {
      const profileToken = $(element).attr('token')
      const profileName = $(element).find('tt\\:Name').first().text()
      if ((filterProfileName.length === 1 && filterProfileName[0].toLowerCase() === 'all') || filterProfileName.indexOf(profileName) !== -1) {
        profilesInfo.push({ profileToken, profileName })
      }
    })
    return profilesInfo
  })
}

/**
 * Retrieves the stream URIs for each profile.
 * @param {Array} profilesInfo - Array of objects containing profile tokens and names.
 * @returns A promise that resolves with an array of objects containing profile names and corresponding stream URIs.
 */
function getStreamURIs (profilesInfo) {
  const startPayload = '<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:trt="http://www.onvif.org/ver10/media/wsdl">' +
                       '<soap:Header>' + getSecurityEnvelope() + '</soap:Header>' +
                       '<soap:Body>'
  const endPayload = '</soap:Body></soap:Envelope>'
  const promises = profilesInfo.map(function (profile) {
    const payload = startPayload + '<trt:GetStreamUri>' +
                                    '<trt:StreamSetup>' +
                                    '<trt:Stream xmlns:trt="http://www.onvif.org/ver10/media/wsdl">RTP-Unicast</trt:Stream>' +
                                    '<trt:Transport xmlns:trt="http://www.onvif.org/ver10/media/wsdl">' +
                                    '<trt:Protocol>RTSP</trt:Protocol>' +
                                    '</trt:Transport>' +
                                    '</trt:StreamSetup>' +
                                    '<trt:ProfileToken>' + profile.profiletoken + '</trt:ProfileToken>' +
                                    '</trt:GetStreamUri>' + endPayload
    return sendSoapRequest(payload, function (body) {
      const $ = D.htmlParse(body)
      const uris = []
      $('tt\\:Uri').each(function (index, element) {
        uris.push($(element).text())
      })
      return { profileName: profile.profileName, uris }
    })
  })
  return D.q.all(promises)
}

/**
 * Retrieves the nonce and realm values from the WWW-Authenticate header of an RTSP DESCRIBE request.
 * @param {string} uri The RTSP URI to send the DESCRIBE request to.
 * @returns {Promise} A promise that resolves with an object containing the realm and nonce values.
 */
function getNonceAndRealm (uri) {
  const d = D.q.defer()
  const command = 'DESCRIBE ' + uri + ' RTSP/1.0\r\nCSeq: 1\r\n'
  telnetParams.command = command
  D.device.sendTelnetCommand(telnetParams, function (out, err) {
    if (err) {
      d.reject('Initial request failed: ' + err)
    } else {
      const authenticateHeaderArray = out.match(/WWW-Authenticate: (.+)/)
      if (authenticateHeaderArray && authenticateHeaderArray[1]) {
        const authenticateHeader = authenticateHeaderArray[1]
        const realmMatch = authenticateHeader.match(/realm="([^"]*)"/)
        const nonceMatch = authenticateHeader.match(/nonce="([^"]*)"/)
        if (realmMatch && nonceMatch) {
          const realm = realmMatch[1]
          const nonce = nonceMatch[1]
          d.resolve({ realm, nonce })
        } else {
          d.reject('realm or nonce not found in WWW-Authenticate header')
        }
      } else {
        d.resolve({ realm: '', nonce: '' })
      }
    }
  })
  return d.promise
}

/**
 * Generates the Digest Authorization header for RTSP requests.
 * @param {string} realm The realm value from the WWW-Authenticate header.
 * @param {string} nonce The nonce value from the WWW-Authenticate header.
 * @param {string} uri The RTSP URI.
 * @param {string} method The RTSP method
 * @returns {string} The Digest Authorization header.
 */
function generateDigestAuth (realm, nonce, uri, method) {
  const hash1 = D.crypto.hash(username + ':' + realm + ':' + password, 'md5', 'utf8', 'hex')
  const hash2 = D.crypto.hash(method + ':' + uri, 'md5', 'utf8', 'hex')
  const response = D.crypto.hash(hash1 + ':' + nonce + ':' + hash2, 'md5', 'utf8', 'hex')
  const authHeader = 'Digest username="' + username + '", realm="' + realm + '", nonce="' + nonce + '", uri="' + uri + '", response="' + response + '"'
  return authHeader
}

/**
 * Checks the health of the camera connection.
 * @param {Array} streamUrisProfiles Array of objects containing profile names and corresponding stream URIs.
 * @returns A promise that resolves with an array of health statuses.
 */
function healthCheck (streamUrisProfiles) {
  const healthPromises = []
  streamUrisProfiles.forEach(function (stream) {
    stream.uris.forEach(function (uri) {
      const d = D.q.defer()
      getNonceAndRealm(uri)
        .then(function (digestParams) {
          const authHeader = generateDigestAuth(digestParams.realm, digestParams.nonce, stream.uris, 'DESCRIBE')
          const command = 'DESCRIBE ' + stream.uris + ' RTSP/1.0\r\nCSeq: 2\r\nAuthorization: ' + authHeader + '\r\n'
          telnetParams.command = command
          telnetParams.timeout = 1000
          D.device.sendTelnetCommand(telnetParams, function (out, err) {
            if (err) {
              console.log(err)
            } else {
              d.resolve({ healthStatus: out, profileName: stream.profileName })
            }
          })
        }).catch(function (error) {
          console.log(error)
          d.resolve({ healthStatus: 'NOT OK', profileName: stream.profileName })
        })

      healthPromises.push(d.promise)
    })
  })
  return D.q.all(healthPromises)
}

function sanitize (output) {
  const recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history']
  const recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g')
  return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase()
}

// Retrieves the capturing status and populates the Custom Driver Table
function getCapturingStatus (data) {
  data.forEach(function (response, index) {
    let status
    if (response.healthStatus.indexOf('200 OK') !== -1) {
      status = 'OK'
    } else {
      status = 'NOT OK'
    }

    const name = response.profileName
    const recordId = (index + 1) + '-' + name
    table.insertRecord(sanitize(recordId), [name, status])
  })
  D.success(table)
}

function failure (err) {
  console.error(err)
  D.failure(D.errorType.GENERIC_ERROR)
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate () {
  getProfilesInfo()
    .then(getStreamURIs)
    .then(healthCheck)
    .then(function (output) {
      if (output) {
        console.info('Validation successful')
        D.success()
      } else {
        console.error('Unexpected output from ONVIF Camera')
        D.failure(D.errorType.GENERIC_ERROR)
      }
    })
    .catch(failure)
}

/**
* @remote_procedure
* @label Get Video Capturing Status
* @documentation This procedure retrieves the current status of video capturing from the camera's streams
*/
function get_status () {
  getProfilesInfo()
    .then(getStreamURIs)
    .then(healthCheck)
    .then(getCapturingStatus)
    .catch(failure)
}
