const xml2js = require('xml2js');

// Extracts the ResponseCode/StatusDesc ESS returns in its XML reply, so the frontend can
// show them without re-implementing XML parsing client-side. Best-effort: returns nulls
// if the response isn't XML or doesn't contain these fields, never throws.
async function parseEssResponseCode(rawXml) {
  if (!rawXml || typeof rawXml !== 'string') {
    return { responseCode: null, statusDesc: null };
  }
  try {
    const parsed = await xml2js.parseStringPromise(rawXml, { explicitArray: false, trim: true });
    const details = parsed?.Document?.Data?.MessageDetails || parsed?.Data?.MessageDetails || {};
    return {
      responseCode: details.ResponseCode ?? details.StatusCode ?? null,
      statusDesc: details.StatusDesc ?? details.Description ?? null
    };
  } catch (error) {
    return { responseCode: null, statusDesc: null };
  }
}

module.exports = { parseEssResponseCode };
