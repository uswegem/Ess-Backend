const https = require('https');
const tls = require('tls');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

// gateway.ess.utumishi.go.tz's TLS handshake sends only its leaf certificate
// (CN=ess.utumishi.go.tz) - it never sends the intermediate CA that chains it up to a
// trusted root (a server-side misconfiguration, confirmed via `openssl s_client -showcerts`).
// Node doesn't fetch missing intermediates itself, so any plain HTTPS client fails with
// "unable to verify the first certificate" against this host, regardless of message type
// or which code path is calling it - PRODUCT_DETAIL, loan callbacks, everything.
//
// The intermediate (DigiCert Global G2 TLS RSA SHA256 2020 CA1, chaining to DigiCert Global
// Root G2 - both public, standard DigiCert certs, not anything Utumishi-specific) is bundled
// here so Node can complete the chain itself instead of relying on the server to send it.
//
// IMPORTANT: passing `ca` to https.Agent *replaces* Node's default trusted root list, it
// doesn't extend it - so this must include tls.rootCertificates (Node's own bundled roots,
// which is where "DigiCert Global Root G2" actually lives) alongside the missing intermediate,
// or every other HTTPS call made through this agent would stop trusting anything else.
const MISSING_INTERMEDIATE_CERT_PATH = path.join(
  __dirname,
  '../config/certs/digicert-global-g2-tls-rsa-sha256-2020-ca1.pem'
);

let cachedAgent = null;

function getUtumishiHttpsAgent() {
  if (cachedAgent) return cachedAgent;

  let extraCa = null;
  try {
    extraCa = fs.readFileSync(MISSING_INTERMEDIATE_CERT_PATH, 'utf8');
  } catch (err) {
    logger.error(
      `Could not read bundled Utumishi intermediate CA cert (${MISSING_INTERMEDIATE_CERT_PATH}): ${err.message}. ` +
      'Falling back to Node\'s default trust store only - calls to gateway.ess.utumishi.go.tz will likely fail ' +
      'TLS verification since that server does not send its own intermediate certificate.'
    );
  }

  cachedAgent = new https.Agent({
    keepAlive: true,
    ca: extraCa ? [...tls.rootCertificates, extraCa] : undefined
  });

  return cachedAgent;
}

module.exports = { getUtumishiHttpsAgent };
