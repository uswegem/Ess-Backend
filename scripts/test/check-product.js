const cbsApi = require('./src/services/cbs.api');
const api = cbsApi.maker;

(async () => {
  try {
    const response = await api.get('/v1/loanproducts/17');
    console.log(JSON.stringify(response.data, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
