const LOAN_CONSTANTS = require('./src/utils/loanConstants');

async function simulateLoanChargesRequest() {
    console.log('Simulating LOAN_CHARGES_REQUEST...');

    const loanData = {
        checkNumber: 'CHK001',
        designationCode: 'D001',
        designationName: 'Teacher',
        basicSalary: 1500000,
        netSalary: 1400000,
        oneThirdAmount: 500000,
        deductibleAmount: 100000,
        retirementDate: '2050-01-01',
        termsOfEmployment: 'PERMANENT',
        requestedAmount: LOAN_CONSTANTS.TEST_LOAN_AMOUNT,
        desiredDeductibleAmount: 150000,
        tenure: LOAN_CONSTANTS.TEST_TENURE,
        fspCode: 'FL8090',
        productCode: '4',
        voteCode: 'V001',
        totalEmployeeDeduction: 100000,
        jobClassCode: 'J001'
    };

    try {
        const result = await LoanCalculate(loanData);
        console.log('✅ LOAN_CHARGES_REQUEST Result:');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

async function simulateLoanOfferRequest() {
    console.log('Simulating LOAN_OFFER_REQUEST...');

    // For LOAN_OFFER_REQUEST, it may call a different function or the same.
    // From the controller, for LOAN_OFFER_REQUEST, it extracts data and calls LoanCalculate or something else.

    // Looking at the code, for LOAN_OFFER_REQUEST, it extracts data and calls LoanCalculate.

    const loanData = {
        checkNumber: 'CHK001',
        firstName: 'John',
        middleName: '',
        lastName: 'Doe',
        sex: 'M',
        employmentDate: '2020-01-01',
        maritalStatus: 'Single',
        bankAccountNumber: '123456789',
        voteCode: 'V001',
        voteName: 'Vote Name',
        nin: '12345678901234567890',
        designationCode: 'D001',
        designationName: 'Designation',
        basicSalary: 100000,
        netSalary: 90000,
        oneThirdAmount: 30000,
        totalEmployeeDeduction: 10000,
        retirementDate: 65,
        termsOfEmployment: 'Permanent',
        requestedAmount: LOAN_CONSTANTS.TEST_LOAN_AMOUNT,
        desiredDeductibleAmount: 150000,
        tenure: 60,
        fspCode: 'FL8090',
        productCode: '4',
        interestRate: 15.0,
        processingFee: 5000,
        insurance: 2500,
        physicalAddress: '123 Main St',
        emailAddress: 'john@example.com',
        mobileNumber: '0712345678',
        applicationNumber: 'APP001',
        loanPurpose: 'Personal',
        swiftCode: 'TANZ1234',
        funding: 'Self'
    };

    // For LOAN_OFFER_REQUEST, the controller calls LoanCalculate with similar data.

    try {
        const result = await LoanCalculate(loanData);
        console.log('✅ LOAN_OFFER_REQUEST Result:');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

async function simulateLoanFinalApprovalNotification() {
    console.log('Simulating LOAN_FINAL_APPROVAL_NOTIFICATION...');

    // This is a notification, so it may create a client and loan in MIFOS.

    // From the controller, it parses the data and calls services to create client and loan.

    // To simulate, perhaps call the relevant functions.

    // But it may be complex.

    console.log('LOAN_FINAL_APPROVAL_NOTIFICATION simulation: Would create client and loan in CBS.');
}

async function main() {
    await simulateLoanChargesRequest();
    await simulateLoanOfferRequest();
    await simulateLoanFinalApprovalNotification();
}

main();