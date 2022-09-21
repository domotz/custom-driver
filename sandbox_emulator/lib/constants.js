module.exports = {
    errorTypes: {
        MISSING_DEVICE_ERROR: "No device was found for execution",
        RESOURCE_UNAVAILABLE: "The Resource you are trying to access is not available",
        AUTHENTICATION_ERROR: "Authentication with the device has failed",
        PARSING_ERROR: "Failed to parse the response",
        TIMEOUT_ERROR: "The remote call has resulted in a timeout",
        IMPORT_NOT_ALLOWED: "Import statements are not allowed in the sandbox enviroment",
        REQUIRE_NOT_ALLOWED: "Require statements are not allowed in the sandbox enviroment",
        GENERIC_ERROR: "Generic/Unknown error has occurred",
    },
    valueTypes: {
        STRING: "STRING",
        NUMBER: "NUMBER",
        DATETIME: "DATETIME",
        RATE: "RATE",
        MONOTONE_RATE: "MONOTONE_RATE",

    },
}