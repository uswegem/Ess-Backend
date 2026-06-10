# Manual Steps to Create Loan Mapping for ESS1765974145523

## Step 1: Copy the script to the server
```bash
scp create-loan-for-ess1765974145523.js miracore-prod:/home/uswege/ess/
```

## Step 2: SSH into the server
```bash
ssh miracore-prod
```

## Step 3: Navigate to the project directory
```bash
cd /home/uswege/ess
```

## Step 4: Run the loan creation script
```bash
node create-loan-for-ess1765974145523.js
```

Expected output:
```
✅ Connected to MongoDB

📋 Creating loan mapping for:
   Application Number: ESS1765974145523
   Loan Number: LOAN1765963593440577
   FSP Reference Number: 11915366

✅ Loan mapping saved: [MongoDB ID]
   Status: FINAL_APPROVAL_RECEIVED

🏦 Creating client in CBS...
✅ Client created with ID: [MIFOS Client ID]

💰 Creating loan in CBS...
✅ Loan created with ID: [MIFOS Loan ID]

✅ Approving loan...
✅ Loan approved

💸 Disbursing loan...
✅ Loan disbursed

✅ Updated loan mapping with CBS IDs
   Client ID: [MIFOS Client ID]
   Loan ID: [MIFOS Loan ID]
   Status: DISBURSED

🎉 All done! Loan successfully created in CBS.
```

## Alternative: Quick mapping creation only (without CBS)

If the full script fails, create just the mapping:

```bash
cd /home/uswege/ess
node quick-create-mapping.js
```

This will create the loan mapping in MongoDB so the system can process future requests.

## Verify the mapping was created

```bash
node -e "require('dotenv').config(); const mongoose = require('mongoose'); mongoose.connect(process.env.MONGODB_URI).then(() => { const LoanMapping = require('./src/models/LoanMapping'); return LoanMapping.findOne({essApplicationNumber: 'ESS1765974145523'}); }).then(m => { console.log('Mapping found:', m); process.exit(0); }).catch(e => { console.error('Error:', e.message); process.exit(1); })"
```

## Check PM2 logs after

```bash
pm2 logs ess-app --lines 20
```
