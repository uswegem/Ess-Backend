const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Configuration
const API_URL = 'http://135.181.33.13:3002/api/loan';

// Random Tanzanian names
const firstNames = [
    'Amani', 'Baraka', 'Neema', 'Juma', 'Fatuma', 'Hassan', 'Mariam', 'Omari',
    'Zuhura', 'Asha', 'Hamisi', 'Rehema', 'Salim', 'Halima', 'Rajabu', 'Saida',
    'Selemani', 'Mwanaisha', 'Abdallah', 'Subira', 'Mohamed', 'Zahra', 'Ali',
    'Bahati', 'Emmanuel', 'Grace', 'Joseph', 'Mary', 'Peter', 'Elizabeth'
];

const lastNames = [
    'Mwakasege', 'Ngowi', 'Kassim', 'Kamara', 'Suleiman', 'Msafiri', 'Mbwana',
    'Rashid', 'Mwamba', 'Kimaro', 'Mazengo', 'Komba', 'Lyimo', 'Shoo', 'Mushi',
    'Mollel', 'Nkya', 'Swai', 'Kileo', 'Mduma', 'Mkama', 'Mahenge', 'Mwita',
    'Kitomari', 'Massawe', 'Mtui', 'Kisenge', 'Mwaseba', 'Minja', 'Kaniki'
];

const employerNames = [
    'Ministry of Health', 'Ministry of Education', 'Bank of Tanzania',
    'Tanzania Revenue Authority', 'National Housing Corporation', 'TANESCO',
    'Tanzania Posts Corporation', 'National Insurance Corporation',
    'Tanzania Broadcasting Corporation', 'University of Dar es Salaam',
    'Muhimbili National Hospital', 'Tanzania Ports Authority',
    'Tanzania Railways Corporation', 'Civil Aviation Authority'
];

// Random data generators
function getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function getRandomAmount() {
    const amounts = [1000000, 2000000, 3000000, 5000000, 7000000, 10000000, 15000000];
    return getRandomElement(amounts);
}

function getRandomTenure() {
    const tenures = [12, 18, 24, 36, 48, 60, 72, 84];
    return getRandomElement(tenures);
}

function generateNIN() {
    const timestamp = Date.now().toString();
    return timestamp.substring(timestamp.length - 16);
}

function generatePhoneNumber() {
    const prefixes = ['0712', '0713', '0714', '0715', '0754', '0755', '0756', '0765', '0767', '0768'];
    const prefix = getRandomElement(prefixes);
    const suffix = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    return prefix + suffix;
}

function generateDateOfBirth() {
    const year = 1970 + Math.floor(Math.random() * 30); // 1970-2000
    const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function generateEmploymentDate() {
    const year = 2005 + Math.floor(Math.random() * 20); // 2005-2025
    const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function generateBankAccount() {
    return Math.floor(Math.random() * 9000000000 + 1000000000).toString();
}

// Create loan application data
function createLoanApplication(index) {
    const firstName = getRandomElement(firstNames);
    const middleName = Math.random() > 0.5 ? getRandomElement(firstNames) : '';
    const lastName = getRandomElement(lastNames);
    const fullName = middleName ? `${firstName} ${middleName} ${lastName}` : `${firstName} ${lastName}`;
    const timestamp = Date.now() + index;
    
    return {
        applicationNumber: `APP_${timestamp}`,
        checkNumber: `CHK${String(1000 + index).padStart(6, '0')}`,
        nin: generateNIN(),
        firstName,
        middleName,
        lastName,
        fullName,
        sex: Math.random() > 0.5 ? 'M' : 'F',
        dateOfBirth: generateDateOfBirth(),
        mobileNo: generatePhoneNumber(),
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
        employerName: getRandomElement(employerNames),
        employmentDate: generateEmploymentDate(),
        bankAccountNumber: generateBankAccount(),
        swiftCode: getRandomElement(['CRDBTZTZ', 'NMBZTZTZ', 'CORUTZTZ', 'BARBTZTZ']),
        requestedAmount: getRandomAmount(),
        productCode: '17',
        tenure: getRandomTenure(),
        interestRate: '28',
        processingFee: '500',
        insurance: '200'
    };
}

// Send LOAN_CHARGES_REQUEST
async function sendLoanChargesRequest(data) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>CHG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}</MsgId>
            <MessageType>LOAN_CHARGES_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <ProductCode>${data.productCode}</ProductCode>
            <RequestedAmount>${data.requestedAmount}</RequestedAmount>
            <Tenure>${data.tenure}</Tenure>
        </MessageDetails>
    </Data>
</Document>`;

    return await axios.post(API_URL, xml, {
        headers: { 'Content-Type': 'application/xml' }
    });
}

// Send LOAN_OFFER_REQUEST
async function sendLoanOfferRequest(data) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>OFFER_${Date.now()}_${Math.random().toString(36).substr(2, 9)}</MsgId>
            <MessageType>LOAN_OFFER_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <ApplicationNumber>${data.applicationNumber}</ApplicationNumber>
            <CheckNumber>${data.checkNumber}</CheckNumber>
            <NIN>${data.nin}</NIN>
            <FirstName>${data.firstName}</FirstName>
            <MiddleName>${data.middleName}</MiddleName>
            <LastName>${data.lastName}</LastName>
            <FullName>${data.fullName}</FullName>
            <Sex>${data.sex}</Sex>
            <DateOfBirth>${data.dateOfBirth}</DateOfBirth>
            <MobileNo>${data.mobileNo}</MobileNo>
            <Email>${data.email}</Email>
            <EmployerName>${data.employerName}</EmployerName>
            <EmploymentDate>${data.employmentDate}</EmploymentDate>
            <BankAccountNumber>${data.bankAccountNumber}</BankAccountNumber>
            <SwiftCode>${data.swiftCode}</SwiftCode>
            <RequestedAmount>${data.requestedAmount}</RequestedAmount>
            <ProductCode>${data.productCode}</ProductCode>
            <Tenure>${data.tenure}</Tenure>
            <InterestRate>${data.interestRate}</InterestRate>
            <ProcessingFee>${data.processingFee}</ProcessingFee>
            <Insurance>${data.insurance}</Insurance>
        </MessageDetails>
    </Data>
</Document>`;

    return await axios.post(API_URL, xml, {
        headers: { 'Content-Type': 'application/xml' }
    });
}

// Send LOAN_FINAL_APPROVAL_NOTIFICATION
async function sendFinalApprovalNotification(data, loanNumber) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>FINAL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}</MsgId>
            <MessageType>LOAN_FINAL_APPROVAL_NOTIFICATION</MessageType>
        </Header>
        <MessageDetails>
            <ApplicationNumber>${data.applicationNumber}</ApplicationNumber>
            <FSPReferenceNumber>${data.checkNumber}</FSPReferenceNumber>
            <LoanNumber>${loanNumber}</LoanNumber>
            <Approval>APPROVED</Approval>
            <NIN>${data.nin}</NIN>
            <FirstName>${data.firstName}</FirstName>
            <MiddleName>${data.middleName}</MiddleName>
            <LastName>${data.lastName}</LastName>
            <MobileNo>${data.mobileNo}</MobileNo>
            <Sex>${data.sex}</Sex>
            <DateOfBirth>${data.dateOfBirth}</DateOfBirth>
            <EmploymentDate>${data.employmentDate}</EmploymentDate>
            <BankAccountNumber>${data.bankAccountNumber}</BankAccountNumber>
            <SwiftCode>${data.swiftCode}</SwiftCode>
            <CheckNumber>${data.checkNumber}</CheckNumber>
            <RequestedAmount>${data.requestedAmount}</RequestedAmount>
            <ProductCode>${data.productCode}</ProductCode>
            <Tenure>${data.tenure}</Tenure>
            <InterestRate>${data.interestRate}</InterestRate>
            <ProcessingFee>${data.processingFee}</ProcessingFee>
            <Insurance>${data.insurance}</Insurance>
            <ApprovalDate>${new Date().toISOString().split('T')[0]}</ApprovalDate>
        </MessageDetails>
    </Data>
</Document>`;

    return await axios.post(API_URL, xml, {
        headers: { 'Content-Type': 'application/xml' }
    });
}

// Extract loan number from response
function extractLoanNumber(xmlResponse) {
    const match = xmlResponse.match(/<LoanNumber>(.*?)<\/LoanNumber>/);
    return match ? match[1] : null;
}

// Main simulation function
async function simulateLoanApplications() {
    console.log('🚀 Starting Simulation: 15 Loan Applications with Random Statuses');
    console.log('=' .repeat(80));

    const results = [];
    
    for (let i = 1; i <= 15; i++) {
        try {
            console.log(`\n📋 Application ${i}/15`);
            console.log('-'.repeat(80));
            
            const loanData = createLoanApplication(i);
            console.log(`👤 Applicant: ${loanData.fullName}`);
            console.log(`💰 Amount: ${(loanData.requestedAmount / 1000000).toFixed(1)}M TZS`);
            console.log(`📅 Tenure: ${loanData.tenure} months`);
            console.log(`🏢 Employer: ${loanData.employerName}`);
            
            // Decide which stage this loan should reach
            const random = Math.random();
            let finalStatus = '';
            let loanNumber = null;

            // 20% - Only LOAN_CHARGES_REQUEST
            if (random < 0.2) {
                console.log('📤 Stage 1: Sending LOAN_CHARGES_REQUEST only...');
                await sendLoanChargesRequest(loanData);
                finalStatus = 'CHARGES_REQUESTED';
                await sleep(500);
            }
            // 30% - LOAN_CHARGES_REQUEST + LOAN_OFFER_REQUEST
            else if (random < 0.5) {
                console.log('📤 Stage 1: Sending LOAN_CHARGES_REQUEST...');
                await sendLoanChargesRequest(loanData);
                await sleep(1000);
                
                console.log('📤 Stage 2: Sending LOAN_OFFER_REQUEST...');
                const offerResponse = await sendLoanOfferRequest(loanData);
                loanNumber = extractLoanNumber(offerResponse.data);
                finalStatus = 'OFFER_SUBMITTED';
                await sleep(500);
            }
            // 50% - Full flow: LOAN_CHARGES + LOAN_OFFER + FINAL_APPROVAL
            else {
                console.log('📤 Stage 1: Sending LOAN_CHARGES_REQUEST...');
                await sendLoanChargesRequest(loanData);
                await sleep(1000);
                
                console.log('📤 Stage 2: Sending LOAN_OFFER_REQUEST...');
                const offerResponse = await sendLoanOfferRequest(loanData);
                loanNumber = extractLoanNumber(offerResponse.data);
                await sleep(1500);
                
                console.log('📤 Stage 3: Sending LOAN_FINAL_APPROVAL_NOTIFICATION...');
                await sendFinalApprovalNotification(loanData, loanNumber);
                finalStatus = 'FINAL_APPROVAL_RECEIVED';
                await sleep(500);
            }

            results.push({
                index: i,
                applicationNumber: loanData.applicationNumber,
                name: loanData.fullName,
                amount: loanData.requestedAmount,
                status: finalStatus,
                loanNumber: loanNumber
            });

            console.log(`✅ Application ${i} completed - Status: ${finalStatus}`);
            
            // Add delay between applications
            await sleep(2000);
            
        } catch (error) {
            console.error(`❌ Application ${i} failed:`, error.message);
            results.push({
                index: i,
                status: 'FAILED',
                error: error.message
            });
        }
    }

    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 SIMULATION SUMMARY');
    console.log('='.repeat(80));
    
    const statusCounts = {};
    results.forEach(r => {
        statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    });

    console.log('\n📈 Status Distribution:');
    Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`   ${status}: ${count} applications (${(count/results.length*100).toFixed(1)}%)`);
    });

    console.log('\n📋 Detailed Results:');
    console.log('-'.repeat(80));
    results.forEach(r => {
        if (r.applicationNumber) {
            console.log(`${r.index}. ${r.name}`);
            console.log(`   App: ${r.applicationNumber}`);
            console.log(`   Amount: ${(r.amount / 1000000).toFixed(1)}M TZS`);
            console.log(`   Status: ${r.status}`);
            if (r.loanNumber) {
                console.log(`   Loan#: ${r.loanNumber}`);
            }
            console.log('');
        }
    });

    console.log('='.repeat(80));
    console.log(`✅ Simulation completed: ${results.length} applications processed`);
    console.log(`📊 Success rate: ${(results.filter(r => r.status !== 'FAILED').length / results.length * 100).toFixed(1)}%`);
    console.log('');
    console.log('💡 You can now view these applications in the admin portal:');
    console.log('   http://5.75.185.137/loans');
    console.log('='.repeat(80));
}

// Helper function to sleep
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Run simulation
simulateLoanApplications()
    .then(() => {
        console.log('\n✨ Simulation completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Simulation failed:', error);
        process.exit(1);
    });
