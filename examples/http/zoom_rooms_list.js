/**
 * Domotz Custom Driver
 * Name: Zoom Rooms List
 * Description: This script retrieves information about Zoom Rooms

 * 
 * Communication protocol is HTTPS
 * 
 * Tested on Zoom API v2
 * 
 * requirements:
 *    - Granular Scopes for Zoom Rooms: zoom_rooms:read:list_rooms:admin
 *    - Granular Scopes for Zoom Room location profile: zoom_rooms:read:location:admin
 * 
 * Creates Custom Driver table with the following columns:
 *    - Room Name: The name of a Zoom Room
 *    - Status: The status of the Zoom Room
 *    - Location Name: The name of the location where the Zoom Room is situated
 *    - Time Zone: The time zone of the Zoom Room's location
 * 
 **/

const accountId = D.getParameter("accountId")
const clientId = D.getParameter("clientId")
const clientSecret = D.getParameter("clientSecret")

const zoomLogin = D.createExternalDevice("zoom.us")
const zoomResources = D.createExternalDevice("api.zoom.us")

const roomId = D.getParameter('roomId')

let accessToken
let allRooms = []
let pageSize = 30
let pageToken

// Create a table to display Zoom Rooms information
var zoomRoomsTable = D.createTable(
  "Zoom Rooms",
  [
    { label: "Room Name", valueType: D.valueType.STRING },
    { label: "Status", valueType: D.valueType.STRING },
    { label: "Location Name", valueType: D.valueType.STRING },
    { label: "Time Zone", valueType: D.valueType.STRING }
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
 * Constructs the pagination URL for fetching Zoom Rooms with page token and page size
 * @returns {string} The pagination URL for Zoom API request
 */
function getPaginationUrl() {
  let url = "/v2/rooms?page_size=" + pageSize
  if (pageToken) {
    url += "&next_page_token=" + pageToken
  }
  return url
}

/**
 * Generates the configuration object for the HTTP request
 * @param {string} url The URL to make the request to
 * @returns {Object} The configuration object for the HTTP request
 */
function generateConfig(url) {
  return {
    url: url,
    protocol: "https",
    headers: {
      "Authorization": "Bearer " + accessToken
    },
    rejectUnauthorized: false,
    jar: true
  }
}

/**
 * Retrieves Zoom rooms from the API with paging support
 * @param {string} pageToken The pagination token for subsequent API requests
 * @param {Array} allRooms Accumulated list of rooms from all pages
 * @returns {Promise<Array>} A promise that resolves with all rooms
 */
function retrieveZoomRooms() {
  const d = D.q.defer()
  const url = getPaginationUrl()
  const config = generateConfig(url)
  zoomResources.http.get(config, function(error, response, body) {
    checkHTTPError(error, response)
    if (error) {
      d.reject(error)
      return
    }
    const bodyAsJSON = JSON.parse(body)
    if (!Array.isArray(bodyAsJSON.rooms) || bodyAsJSON.rooms.length === 0) {
      console.error("No rooms found.")
      D.failure(D.errorType.GENERIC_ERROR)
      return
    }
    allRooms = allRooms.concat(extractZoomRoomsInfo(bodyAsJSON))
    if (bodyAsJSON.next_page_token) {
      pageToken = bodyAsJSON.next_page_token
      retrieveZoomRooms()
      .then(function (rooms) {
        d.resolve(rooms)
      }).catch(function (err) {
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
  return zoomRoomsInfo.rooms.map(function(zoomRoom)  {
    return {
      roomId: zoomRoom.room_id, 
      name: zoomRoom.name,
      location: zoomRoom.location_id,
      status: zoomRoom.status
    }
  })
}

/**
 * Retrieves detailed location information for a given location ID from the Zoom API
 * Resolves with location data if successful, or null if the ID is invalid or data is missing
 * @param {string} locationId The ID of the location to retrieve information for
 * @returns {Promise} A promise that resolves to location data (or null) once the request is complete
 */
function retrieveLocationInfo(locationId) {
  const d = D.q.defer()
  if (locationId === "N/A" || !locationId) {
    console.log('Invalid location ID: ', locationId)
    d.resolve(null)
    
  }
  const config = generateConfig('/v2/rooms/locations/' + locationId)  
  zoomResources.http.get(config, function(error, response, body) {
    if (error) {
      console.error('Error retrieving location info for location id: ' + locationId, error)
      d.resolve(null)
      return
    }
    const bodyAsJSON = JSON.parse(body)
    if (bodyAsJSON && bodyAsJSON.basic) {
      d.resolve(bodyAsJSON.basic)
    } else {
      console.error("Location information not foun for location id: " + locationId)
      d.resolve(null)
    }
  })
  return d.promise
}

/**
 * Attaches location information to the list of rooms
 * @param {Array} rooms The list of rooms to be enriched with location information
 */
function attachLocationInfoToRooms(rooms) {
  const locationPromises = rooms.map(function(room) {
    return retrieveLocationInfo(room.location)
    .then(function(locationInfo){
      if (locationInfo) {
        room.locationName = locationInfo.name || "N/A"
        room.timeZone = locationInfo.timezone || "N/A"
      } 
    })
  })
  D.q.all(locationPromises)
    .then(function() {
      insertZoomRooms(rooms)
    })
    .catch(function(err) {
      console.error(err)
      D.failure(D.errorType.GENERIC_ERROR)
    })
}

/**
 * Inserts the Zoom Rooms data into the table for display
 * @param {Array} zoomRooms The list of Zoom Rooms to insert into the table
 */
function insertZoomRooms(zoomRooms) {
  zoomRooms.forEach(function(room) {
    zoomRoomsTable.insertRecord(sanitize(room.roomId), [
      room.name || 'N/A',
      room.status || 'N/A',
      room.locationName || 'N/A',  
      room.timeZone || 'N/A'    
    ])
  })
  D.success(zoomRoomsTable)
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
 * @label Get Zoom Rooms Information
 * @documentation This procedure retrieves the list of Zoom Rooms, filters based on roomId, and populates a table with room details, including location and time zone information
 */
function get_status() {
	login()
    .then(retrieveZoomRooms)
    .then(function(zoomRooms) {
      const filteredRooms = filterZoomRooms(zoomRooms)
      attachLocationInfoToRooms(filteredRooms)
    })
		.catch(function (error) {
			console.error(error)
			D.failure(D.errorType.GENERIC_ERROR)
		})
}