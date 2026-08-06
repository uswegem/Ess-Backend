const logger = require('./logger');


const RESPONSE_MESSAGES = {
    8000: "Successful/Received",
    8001: "Required header is not given",
    8002: "Unauthorized",
    8003: "Invalid Financial service provider code",
    8004: "Service provider is not active",
    8005: "General Failure",
    8006: "Duplicate Request/Already received",
    8007: "Invalid bank account",
    8008: "Bank account not active",
    8009: "Invalid Signature",
    8010: "Invalid Signature Configuration missing one of parameter (passphrase, key alias, filename)",
    8011: "Error on processing request",
    8012: "Request cannot be completed at this time, try later",
    8013: "Inactive communication protocol",
    8014: "Invalid code, mismatch of supplied code on information and header",
    8015: "Invalid deduction code",
    8016: "Check Number does not exist",
    8017: "Vote code does not exist",
    8018: "Invalid product code",
    8019: "Invalid Application number",
    8020: "Payment reference number does not exist",
};

function sendResponse(res, code, message, data = null) {
    const description = RESPONSE_MESSAGES[code] || "Unknown response code";

    return res.status(code === 8000 ? 200 : 400).json({
        responseCode: code,
        message,
        description,
        data, // optional, can carry extra payload
    });
}

module.exports = { sendResponse, RESPONSE_MESSAGES };
