const mongoose = require('mongoose');
require('dotenv').config();

async function checkRestructureError() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/miracore');
        console.log('✅ Connected to MongoDB\n');

        // Get audit logs collection
        const AuditLog = mongoose.connection.collection('auditlogs');

        // Find latest LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST entries
        console.log('🔍 Searching for latest LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST entries...\n');
        
        const logs = await AuditLog.find({
            messageType: 'LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST'
        })
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray();

        if (logs.length === 0) {
            console.log('❌ No LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST logs found');
        } else {
            console.log(`📋 Found ${logs.length} recent logs:\n`);
            
            logs.forEach((log, index) => {
                console.log(`${'='.repeat(80)}`);
                console.log(`Log ${index + 1}:`);
                console.log(`${'='.repeat(80)}`);
                console.log('Timestamp:', log.createdAt);
                console.log('Message Type:', log.messageType);
                console.log('Status:', log.status);
                console.log('Message ID:', log.messageId);
                
                if (log.requestData) {
                    console.log('\n📥 Request Data:');
                    const requestData = typeof log.requestData === 'string' 
                        ? JSON.parse(log.requestData) 
                        : log.requestData;
                    console.log('  CheckNumber:', requestData.CheckNumber);
                    console.log('  RequestedAmount:', requestData.RequestedAmount);
                    console.log('  Tenure:', requestData.Tenure);
                    console.log('  BasicSalary:', requestData.BasicSalary);
                    console.log('  NetSalary:', requestData.NetSalary);
                    console.log('  LoanNumber:', requestData.LoanNumber);
                }
                
                if (log.responseData) {
                    console.log('\n📤 Response Data:');
                    const responseData = typeof log.responseData === 'string' 
                        ? JSON.parse(log.responseData) 
                        : log.responseData;
                    console.log(JSON.stringify(responseData, null, 2));
                }
                
                if (log.error || log.errorMessage) {
                    console.log('\n❌ ERROR:');
                    console.log(log.error || log.errorMessage);
                }
                
                if (log.metadata) {
                    console.log('\n📊 Metadata:');
                    console.log(JSON.stringify(log.metadata, null, 2));
                }
                
                console.log('\n');
            });
        }

        // Also check for recent 400 errors
        console.log(`${'='.repeat(80)}`);
        console.log('🔍 Checking for recent 400 errors...\n');
        
        const errorLogs = await AuditLog.find({
            $or: [
                { status: 'error' },
                { status: 'failed' },
                { 'metadata.statusCode': 400 }
            ],
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
        })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray();

        if (errorLogs.length > 0) {
            console.log(`📋 Found ${errorLogs.length} error logs in last 24 hours:\n`);
            
            errorLogs.forEach((log, index) => {
                console.log(`${index + 1}. ${log.messageType || 'Unknown'} - ${log.createdAt}`);
                console.log(`   Status: ${log.status}`);
                if (log.error || log.errorMessage) {
                    console.log(`   Error: ${log.error || log.errorMessage}`);
                }
                if (log.metadata && log.metadata.statusCode) {
                    console.log(`   Status Code: ${log.metadata.statusCode}`);
                }
                console.log('');
            });
        } else {
            console.log('✅ No error logs found in last 24 hours');
        }

        await mongoose.connection.close();
        console.log('\n✅ Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Error:', error);
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
        }
        process.exit(1);
    }
}

checkRestructureError();
