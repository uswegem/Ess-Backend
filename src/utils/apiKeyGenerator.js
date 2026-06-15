const { generateApiKey, generateApiSecret } = require('./tenantSecretCrypto');

function createLiveApiKey() {
  return generateApiKey('mk_live');
}

function createTestApiKey() {
  return generateApiKey('mk_test');
}

module.exports = {
  generateApiKey,
  generateApiSecret,
  createLiveApiKey,
  createTestApiKey
};
