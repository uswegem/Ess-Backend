// gateway.ess.utumishi.go.tz doesn't send its intermediate certificate
// (confirmed via openssl s_client: only depth=0, the leaf, is presented).
// Its issuer, DigiCert Global G2 TLS RSA SHA256 2020 CA1, is a completely
// standard, already-trusted public CA -- supplying the missing intermediate
// ourselves fixes the chain without weakening verification for anything else.
//
// NODE_EXTRA_CA_CERTS does NOT work for this under PM2: it's only read
// during Node's native process bootstrap, before any JavaScript (including
// PM2's own env-injection, which happens via process.env assignment from
// its process-container wrapper, itself JS) has run -- confirmed by testing
// a bare pm2 start/restart with the var genuinely absent from the running
// process's real environment despite pm2 reporting it as configured.
// Loading it explicitly into a dedicated https.Agent, at application
// runtime, works regardless of process-manager env timing.
const fs = require('fs');
const https = require('https');
const tls = require('tls');
const path = require('path');

let agent = null;

function getUtumishiHttpsAgent() {
  if (agent) return agent;

  const certPath = path.join(__dirname, '..', '..', 'certs', 'digicert-global-g2-tls-rsa-sha256-2020-ca1.pem');
  const extraCert = fs.readFileSync(certPath, 'utf8');

  agent = new https.Agent({
    ca: [...tls.rootCertificates, extraCert]
  });

  return agent;
}

module.exports = { getUtumishiHttpsAgent };
