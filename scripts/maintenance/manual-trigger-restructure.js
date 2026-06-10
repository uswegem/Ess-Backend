const mongoose = require('mongoose');
const { maker } = require('./src/services/cbs.api');
const logger = require('./src/utils/logger');
require('dotenv').config();

/**
 * Manually trigger restructure processing for ESS1766142923684
 * This will call MIFOS reschedule API for the loan
 */

const applicationNumber = 'ESS1766142923684';

console.log('🔄 MANUALLY TRIGGERING RESTRUCTURE PROCESSING');
console.log('='.repeat(70));
console.log('Application Number:', applicationNumber);

async function triggerRestructure() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ess');
        const LoanMapping = require('./src/models/LoanMapping');
        
        // Find loan by restructure application number
        const loan = await LoanMapping.findOne({
            $or: [
                { essApplicationNumber: applicationNumber },
                { restructureApplicationNumber: applicationNumber }
            ]
        });

        if (!loan) {
            console.log('❌ Loan not found for application:', applicationNumber);
            await mongoose.disconnect();
            process.exit(1);
        }

        console.log('\n✅ Found loan mapping');
        console.log('Original Application:', loan.essApplicationNumber);
        console.log('Restructure Application:', loan.restructureApplicationNumber);
        console.log('Check Number:', loan.checkNumber);
        console.log('MIFOS Loan ID:', loan.mifosLoanId);
        console.log('Is Restructure:', loan.isRestructure);
        console.log('Restructure Requested:', loan.restructureRequested);
        console.log('New Tenure:', loan.newTenure);
        console.log('Status:', loan.status);

        // Check if this is a restructure
        const isRestructure = loan.isRestructure || loan.restructureRequested;
        
        if (!isRestructure) {
            console.log('\n❌ This loan is not marked for restructure');
            await mongoose.disconnect();
            process.exit(1);
        }

        if (!loan.mifosLoanId) {
            console.log('\n❌ No MIFOS Loan ID found in mapping');
            await mongoose.disconnect();
            process.exit(1);
        }

        console.log('\n🔄 Detected LOAN RESTRUCTURE - calling MIFOS reschedule API');

        // Prepare reschedule payload
        const rescheduleFromDate = new Date();
        const adjustedDueDate = new Date();
        adjustedDueDate.setMonth(adjustedDueDate.getMonth() + (loan.newTenure || 18));

        const reschedulePayload = {
            dateFormat: "dd MMMM yyyy",
            locale: "en",
            rescheduleFromDate: rescheduleFromDate.toLocaleDateString('en-GB', { 
                day: '2-digit', 
                month: 'long', 
                year: 'numeric' 
            }),
            rescheduleReasonId: 1,
            submittedOnDate: new Date().toLocaleDateString('en-GB', { 
                day: '2-digit', 
                month: 'long', 
                year: 'numeric' 
            }),
            adjustedDueDate: adjustedDueDate.toLocaleDateString('en-GB', { 
                day: '2-digit', 
                month: 'long', 
                year: 'numeric' 
            }),
            graceOnPrincipal: 0,
            graceOnInterest: 0,
            extraTerms: 0,
            rescheduleReasonComment: `Loan restructure approved. New tenure: ${loan.newTenure || 18} months, New amount: ${loan.existingLoanAmount || loan.newTotalAmountToPay}`
        };

        console.log('\n📞 Calling MIFOS reschedule API');
        console.log('Loan ID:', loan.mifosLoanId);
        console.log('Payload:', JSON.stringify(reschedulePayload, null, 2));

        try {
            const api = maker;
            const rescheduleResponse = await api.post(
                `/v1/loans/${loan.mifosLoanId}/schedule`,
                reschedulePayload
            );

            console.log('\n✅ MIFOS reschedule created successfully!');
            console.log('Response:', JSON.stringify(rescheduleResponse.data, null, 2));

            // Update loan mapping with reschedule details
            await LoanMapping.updateOne(
                { _id: loan._id },
                {
                    $set: {
                        rescheduleId: rescheduleResponse.data.resourceId,
                        status: 'RESTRUCTURED',
                        restructuredAt: new Date().toISOString()
                    }
                }
            );

            console.log('\n✅ Loan mapping updated with reschedule details');
            console.log('Status:', 'RESTRUCTURED');
            console.log('Reschedule ID:', rescheduleResponse.data.resourceId);

        } catch (apiError) {
            console.error('\n❌ Error calling MIFOS reschedule API:');
            console.error('Status:', apiError.response?.status);
            console.error('Status Text:', apiError.response?.statusText);
            console.error('Error Data:', JSON.stringify(apiError.response?.data, null, 2));
            console.error('Message:', apiError.message);
            throw apiError;
        }

        await mongoose.disconnect();
        console.log('\n✅ RESTRUCTURE PROCESSING COMPLETED');

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        if (error.stack) {
            console.error('Stack:', error.stack);
        }
        await mongoose.disconnect();
        process.exit(1);
    }
}

triggerRestructure();
