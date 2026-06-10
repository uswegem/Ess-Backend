const mongoose = require('mongoose');
const axios = require('axios');
const https = require('https');
require('dotenv').config();

async function getLiquidationData() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/miracore');
  
  const LoanMapping = mongoose.model('LoanMapping', new mongoose.Schema({}, { strict: false, collection: 'loanmappings' }));
  const mapping = await LoanMapping.findOne({ essLoanNumberAlias: 'LOAN1765996440393783' });
  
  if (!mapping) {
    console.log('NOT_FOUND');
    process.exit(1);
  }

  // Get current loan balance from MIFOS
  const api = axios.create({
    baseURL: process.env.CBS_BASE_URL,
    timeout: 30000,
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    headers: {
      'Content-Type': 'application/json',
      'Mifos-Platform-TenantId': process.env.CBS_Tenant,
      'Authorization': 'Basic ' + Buffer.from(`${process.env.CBS_MAKER_USERNAME}:${process.env.CBS_MAKER_PASSWORD}`).toString('base64')
    }
  });

  const loanResponse = await api.get(`/v1/loans/${mapping.mifosLoanId}?associations=all`);
  const loan = loanResponse.data;

  const liquidationData = {
    applicationNumber: mapping.essApplicationNumber,
    loanNumber: mapping.essLoanNumberAlias,
    checkNumber: mapping.essCheckNumber,
    fspReferenceNumber: mapping.fspReferenceNumber,
    clientData: mapping.metadata?.clientData || {},
    principalOutstanding: loan.summary?.principalOutstanding || 0,
    totalOutstanding: loan.summary?.totalOutstanding || 0,
    principal: loan.principal,
    mifosLoanId: mapping.mifosLoanId,
    status: loan.status?.value
  };

  console.log(JSON.stringify(liquidationData, null, 2));
  
  await mongoose.connection.close();
}

getLiquidationData().catch(err => { console.error(err); process.exit(1); });
