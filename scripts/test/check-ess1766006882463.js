const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/miracore', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const LoanMapping = require('./src/models/LoanMapping');

async function checkLoanMapping() {
    try {
        console.log('🔍 Searching for loan mapping: ESS1766006882463\n');
        console.log('='.repeat(80));
        
        // Find the loan mapping
        const mapping = await LoanMapping.findOne({ 
            essApplicationNumber: 'ESS1766006882463' 
        });
        
        if (!mapping) {
            console.log('❌ No loan mapping found for ESS1766006882463');
            return;
        }

        console.log('✅ LOAN MAPPING FOUND\n');
        console.log('='.repeat(80));
        
        // Display all fields
        console.log('\n📋 BASIC INFORMATION:');
        console.log('   Application Number:', mapping.essApplicationNumber);
        console.log('   Check Number:', mapping.essCheckNumber);
        console.log('   Loan Number Alias:', mapping.essLoanNumberAlias);
        console.log('   FSP Reference Number:', mapping.fspReferenceNumber);
        console.log('   Product Code:', mapping.productCode);
        console.log('   Status:', mapping.status);
        
        console.log('\n💰 LOAN DETAILS:');
        console.log('   Requested Amount:', mapping.requestedAmount);
        console.log('   Tenure (months):', mapping.tenure);
        
        console.log('\n🏦 CBS IDENTIFIERS:');
        console.log('   MIFOS Client ID:', mapping.mifosClientId || 'Not yet created');
        console.log('   MIFOS Loan ID:', mapping.mifosLoanId || 'Not yet created');
        console.log('   MIFOS Loan Account Number:', mapping.mifosLoanAccountNumber || 'Not assigned');
        
        console.log('\n📅 TIMESTAMPS:');
        console.log('   Created At:', mapping.createdAt);
        console.log('   Updated At:', mapping.updatedAt);
        console.log('   Initial Offer Sent At:', mapping.initialOfferSentAt || 'N/A');
        console.log('   Final Approval Received At:', mapping.finalApprovalReceivedAt || 'N/A');
        console.log('   Client Created At:', mapping.clientCreatedAt || 'N/A');
        console.log('   Loan Created At:', mapping.loanCreatedAt || 'N/A');
        console.log('   Disbursed At:', mapping.disbursedAt || 'N/A');
        console.log('   Disbursement Failure Notification Sent At:', mapping.disbursementFailureNotificationSentAt || 'N/A');
        
        if (mapping.metadata) {
            console.log('\n📊 METADATA:');
            
            if (mapping.metadata.clientData) {
                console.log('\n   👤 CLIENT DATA:');
                console.log('      Full Name:', mapping.metadata.clientData.fullName);
                console.log('      First Name:', mapping.metadata.clientData.firstName);
                console.log('      Middle Name:', mapping.metadata.clientData.middleName);
                console.log('      Last Name:', mapping.metadata.clientData.lastName);
                console.log('      NIN:', mapping.metadata.clientData.nin);
                console.log('      Mobile Number:', mapping.metadata.clientData.mobileNumber);
                console.log('      Sex:', mapping.metadata.clientData.sex);
                console.log('      Date of Birth:', mapping.metadata.clientData.dateOfBirth);
                console.log('      Marital Status:', mapping.metadata.clientData.maritalStatus);
                console.log('      Physical Address:', mapping.metadata.clientData.physicalAddress);
                console.log('      Email:', mapping.metadata.clientData.emailAddress);
                console.log('      Bank Account:', mapping.metadata.clientData.bankAccountNumber);
                console.log('      Swift Code:', mapping.metadata.clientData.swiftCode);
                console.log('      Employment Date:', mapping.metadata.clientData.employmentDate);
                console.log('      Confirmation Date:', mapping.metadata.clientData.confirmationDate);
            }
            
            if (mapping.metadata.loanData) {
                console.log('\n   💳 LOAN DATA:');
                console.log('      Requested Amount:', mapping.metadata.loanData.requestedAmount);
                console.log('      Desired Deductible Amount:', mapping.metadata.loanData.desiredDeductibleAmount);
                console.log('      Tenure:', mapping.metadata.loanData.tenure);
                console.log('      Product Code:', mapping.metadata.loanData.productCode);
                console.log('      Interest Rate:', mapping.metadata.loanData.interestRate);
                console.log('      Processing Fee:', mapping.metadata.loanData.processingFee);
                console.log('      Insurance:', mapping.metadata.loanData.insurance);
                console.log('      Loan Purpose:', mapping.metadata.loanData.loanPurpose);
                console.log('      Contract Start Date:', mapping.metadata.loanData.contractStartDate);
                console.log('      Contract End Date:', mapping.metadata.loanData.contractEndDate);
                console.log('      Funding:', mapping.metadata.loanData.funding);
            }
            
            if (mapping.metadata.employmentData) {
                console.log('\n   💼 EMPLOYMENT DATA:');
                console.log('      Designation Code:', mapping.metadata.employmentData.designationCode);
                console.log('      Designation Name:', mapping.metadata.employmentData.designationName);
                console.log('      Basic Salary:', mapping.metadata.employmentData.basicSalary);
                console.log('      Net Salary:', mapping.metadata.employmentData.netSalary);
                console.log('      One Third Amount:', mapping.metadata.employmentData.oneThirdAmount);
                console.log('      Total Employee Deduction:', mapping.metadata.employmentData.totalEmployeeDeduction);
                console.log('      Retirement Date:', mapping.metadata.employmentData.retirementDate);
                console.log('      Terms of Employment:', mapping.metadata.employmentData.termsOfEmployment);
                console.log('      Vote Code:', mapping.metadata.employmentData.voteCode);
                console.log('      Vote Name:', mapping.metadata.employmentData.voteName);
                console.log('      Nearest Branch Name:', mapping.metadata.employmentData.nearestBranchName);
                console.log('      Nearest Branch Code:', mapping.metadata.employmentData.nearestBranchCode);
            }
            
            console.log('\n   ℹ️ OTHER METADATA:');
            if (mapping.metadata.offerReceivedAt) {
                console.log('      Offer Received At:', mapping.metadata.offerReceivedAt);
            }
            if (mapping.metadata.updatedVia) {
                console.log('      Updated Via:', mapping.metadata.updatedVia);
            }
            if (mapping.metadata.createdVia) {
                console.log('      Created Via:', mapping.metadata.createdVia);
            }
        }
        
        if (mapping.errorLogs && mapping.errorLogs.length > 0) {
            console.log('\n⚠️ ERROR LOGS:');
            mapping.errorLogs.forEach((log, index) => {
                console.log(`\n   Error ${index + 1}:`);
                console.log('      Stage:', log.stage);
                console.log('      Error:', log.error);
                console.log('      Timestamp:', log.timestamp);
            });
        }
        
        console.log('\n' + '='.repeat(80));
        console.log('\n📄 FULL JSON OBJECT:\n');
        console.log(JSON.stringify(mapping.toObject(), null, 2));
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ Database connection closed');
    }
}

checkLoanMapping();
