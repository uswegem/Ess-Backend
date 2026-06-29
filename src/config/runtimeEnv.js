/**
 * Centralized runtime environment resolution.
 * UTUMISHI_ENDPOINT is the canonical external ESS / Utumishi callback URL.
 */

function getUtumishiEndpoint({ required = false } = {}) {
  const url =
    process.env.UTUMISHI_ENDPOINT ||
    process.env.THIRD_PARTY_BASE_URL ||
    process.env.ESS_CALLBACK_URL ||
    null;

  if (!url && required) {
    throw new Error('UTUMISHI_ENDPOINT is not configured in environment');
  }

  return url;
}

function getCbsTimeoutMs() {
  const raw = process.env.CBS_TIMEOUT_MS ?? process.env.CBS_TIMEOUT ?? '30000';
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30000;
}

function getApiTimeoutMs() {
  const raw = process.env.API_TIMEOUT ?? '30000';
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30000;
}

module.exports = {
  getUtumishiEndpoint,
  getCbsTimeoutMs,
  getApiTimeoutMs
};
