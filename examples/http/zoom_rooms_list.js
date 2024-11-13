/**
 * Domotz Custom Driver
 * Name: Zoom Rooms List
 * Description: This script retrieves information about Zoom Rooms
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on Zoom API v2
 * 
 * Creates Custom Driver table with the following columns:
 *    - Name: The name of a Zoom Room
 *    - Location: The parent location ID of the Zoom Room
 *    - Status: The status of the Zoom Room
 * 
 **/

const accountId = D.getParameter("accountId")
const clientId = D.getParameter("clientId")
const clientSecret = D.getParameter("clientSecret")

const zoomLogin = D.createExternalDevice("zoom.us")
const zoomResources = D.createExternalDevice("api.zoom.us")

const roomId = D.getParameter('roomId')

let accessToken

var zoomRoomsTable = D.createTable(
  "Zoom Rooms",
  [
    { label: "Name", valueType: D.valueType.STRING },
    { label: "Location", valueType: D.valueType.STRING },
    { label: "Status", valueType: D.valueType.STRING }    
  ]
)

/**
 * Checks for HTTP errors in the response and handles them by triggering appropriate failures
 * @param {Object} error The error object returned from the HTTP request
 * @param {Object} response The HTTP response object
 */
function checkHTTPError(error, response) {
  if (error) {
    console.error(error)
    D.failure(D.errorType.GENERIC_ERROR)
  } else if (response.statusCode === 404) {
    D.failure(D.errorType.RESOURCE_UNAVAILABLE)
  } else if (response.statusCode === 401 || response.statusCode === 403) {
    D.failure(D.errorType.AUTHENTICATION_ERROR)
  } else if (response.statusCode !== 200) {
    D.failure(D.errorType.GENERIC_ERROR)
  }
}

/**
 * Processes the login response and extracts the access token
 * @param {Object} d  The deferred promise object
 * @returns {Function} A function to process the HTTP response
 */
function processLoginResponse(d) {
	return function process(error, response, body) {
		checkHTTPError(error, response)
		const bodyAsJSON = JSON.parse(body)
		if (bodyAsJSON.access_token) {
			accessToken = bodyAsJSON.access_token
			d.resolve()
		} else {
			console.error("Access token not found in response body")
			D.failure(D.errorType.AUTHENTICATION_ERROR)
		}
	}
}

/**
 * Retrieves Zoom rooms from the API with paging support
 * @param {string} pageToken The pagination token for subsequent API requests
 * @param {Array} allRooms Accumulated list of rooms from all pages
 * @returns {Promise<Array>} A promise that resolves with all rooms
 */
function retrieveZoomRooms(pageToken, allRooms = []) {
  const d = D.q.defer()
  let url = "/v2/rooms?page_size=30"
  if (pageToken) {
    url += "&next_page_token=" + pageToken
  }
  const config = {
    url: url,
    protocol: "https",
    headers: {
      "Authorization": "Bearer " + accessToken
    },
    rejectUnauthorized: false,
    jar: true
  }
  zoomResources.http.get(config, function(error, response, body) {
    checkHTTPError(error, response)
    if (error) {
      d.reject(error)
      return
    }
    const bodyAsJSON = JSON.parse(body)
    console.log(bodyAsJSON)
    if (!Array.isArray(bodyAsJSON.rooms) || bodyAsJSON.rooms.length === 0) {
      console.error("No rooms found.")
      D.failure(D.errorType.GENERIC_ERROR)
      return
    }
    allRooms = allRooms.concat(bodyAsJSON.rooms.map(extractZoomRoomsInfo))
    if (bodyAsJSON.next_page_token) {
      retrieveZoomRooms(bodyAsJSON.next_page_token, allRooms)
        .then(function(rooms) {
          d.resolve(rooms) 
        })
        .catch(function(err) {
          console.error("Error fetching next page of rooms:", err)
          d.reject(err) 
        })
    } else {
      console.log("All rooms retrieved successfully.")
      d.resolve(allRooms) 
    }
  })
  return d.promise
}

/**
 * Extracts relevant information from a Zoom room response
 * @param {Object} zoomRoomsInfo The raw Zoom room data
 * @returns {Object} A simplified object with only necessary fields
 */
function extractZoomRoomsInfo(zoomRoomsInfo) {
  return {
    roomId: zoomRoomsInfo.room_id, 
    name: zoomRoomsInfo.name,
    location: zoomRoomsInfo.location_id,
    status: zoomRoomsInfo.status
  }
}


/**
 * Sanitizes the output by removing reserved words and formatting it
 * @param {string} output The string to be sanitized
 * @returns {string} The sanitized string
 */
function sanitize(output) {
  const recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history']
  const recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join('|'), 'g')
  return output.replace(recordIdSanitizationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase()
}

/**
 * Processes the response from the Zoom Rooms API call and populates the table
 * @param {Array} zoomRooms The list of Zoom rooms to process
 */
function insertZoomRooms(zoomRooms) {
  zoomRooms.forEach(function(room) {
    zoomRoomsTable.insertRecord(sanitize(room.roomId), [
      room.name,
      room.location,
      room.status
    ])
  })
  D.success(zoomRoomsTable)
}

/**
 * Filters the Zoom rooms based on the provided roomId parameter
 * @param {Array} zoomRooms The list of Zoom rooms to filter
 * @returns {Array} A filtered list of rooms
 */
function filterZoomRooms(zoomRooms) {
  return zoomRooms.filter(function (zoomRoom) {
    const associatedRooms = zoomRoom.roomId
    const roomFilter = (roomId.length === 1 && roomId[0].toLowerCase() === 'all') || roomId.some(function (id) {
      return id.toLowerCase() === associatedRooms.toLowerCase()
    }) 
    return roomFilter
  })
}

/**
 * Logs in to Zoom using the provided credentials and retrieves an access token
 * @returns {Promise} A promise that resolves when login is successful
 */
function login() {
	const d = D.q.defer()
	const config = {
		url: "/oauth/token", 
		protocol: "https", 
		headers: {
			"Content-Type": "application/x-www-form-urlencoded",
			"Authorization": "Basic " + D._unsafe.buffer.from(clientId + ":" + clientSecret).toString("base64")
		}, 
		form: {
      "grant_type": "account_credentials",
      "account_id": accountId
    },
		rejectUnauthorized: false, 
		jar: true
	}
	zoomLogin.http.post(config, processLoginResponse(d))
	return d.promise
}

/**
 * @remote_procedure
 * @label Validate Zoom connection
 * @documentation This procedure is used to validate if the Zoom API is accessible and if the login credentials are correct
 */
function validate() {
	login()
    .then(retrieveZoomRooms)
		.then(function () {
			D.success()
		})
		.catch(function (error) {
			console.error(error)
			D.failure(D.errorType.GENERIC_ERROR)
		})
}

/**
 * @remote_procedure
 * @label Get Zoom Rooms Inforamtion
 * @documentation This procedure retrieves the list of Zoom Rooms, filters based on roomId, and populates a table with room details
 */
function get_status() {
	login()
    .then(retrieveZoomRooms)
    .then(function(zoomRooms) {
      const filteredZoomRooms = filterZoomRooms(zoomRooms)
      insertZoomRooms(filteredZoomRooms)
    })
		.catch(function (error) {
			console.error(error)
			D.failure(D.errorType.GENERIC_ERROR)
		})
}