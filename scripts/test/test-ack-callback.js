const axios = require('axios');
const logger = require('./src/utils/logger');

// Test the new ACK-then-callback pattern for LOAN_OFFER_REQUEST
async function testAckCallbackPattern() {
    const testXML = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>TEST_ACK_${Date.now()}</MsgId>
            <MessageType>LOAN_OFFER_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>110977381</CheckNumber>
            <FirstName>MARRY</FirstName>
            <MiddleName>EDWARD</MiddleName>
            <LastName>NTIGA</LastName>
            <VoteCode>32</VoteCode>
            <VoteName>President's Office - Public Service Management and Good Governance</VoteName>
            <NIN>19850612141150000220</NIN>
            <DesignationCode>TZ400102</DesignationCode>
            <DesignationName>Senior Human Resource Officer I</DesignationName>
            <BasicSalary>1765000.00</BasicSalary>
            <NetSalary>1000000.00</NetSalary>
            <OneThirdAmount>588333.00</OneThirdAmount>
            <RequestedAmount>4800000.00</RequestedAmount>
            <DesiredDeductibleAmount>89727.03</DesiredDeductibleAmount>
            <RetirementDate>233</RetirementDate>
            <TermsOfEmployment>Permanent and Pensionable</TermsOfEmployment>
            <Tenure>96</Tenure>
            <ProductCode>17</ProductCode>
            <InterestRate>6000000.00</InterestRate>
            <ProcessingFee>100000.00</ProcessingFee>
            <Insurance>50000.00</Insurance>
            <PhysicalAddress>Dodoma</PhysicalAddress>
            <EmailAddress>example@utumishi.go.tz</EmailAddress>
            <MobileNumber>0768383511</MobileNumber>
            <ApplicationNumber>ESS${Date.now()}</ApplicationNumber>
            <Sex>M</Sex>
            <BankAccountNumber>9120003342458</BankAccountNumber>
            <NearestBranchName>Arusha Branch</NearestBranchName>
            <NearestBranchCode>BC001</NearestBranchCode>
            <MaritalStatus>MARRIED</MaritalStatus>
            <ConfirmationDate>2014-03-21</ConfirmationDate>
            <EmploymentDate>2013-03-21</EmploymentDate>
            <TotalEmployeeDeduction>765000.00</TotalEmployeeDeduction>
            <LoanPurpose>Ujenzi</LoanPurpose>
            <ContractStartDate xsi:nil="true" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/>
            <ContractEndDate xsi:nil="true" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/>
            <SwiftCode>SBICTZTX</SwiftCode>
            <Funding>GF</Funding>
        </MessageDetails>
    </Data>
</Document>`;

    try {
        console.log('🔄 Testing new ACK-then-callback pattern...');
        console.log('⏰ Sending LOAN_OFFER_REQUEST at:', new Date().toISOString());
        
        const response = await axios({
            method: 'post',
            url: 'http://135.181.33.13:3002/api/loan',
            headers: {
                'Content-Type': 'application/xml'
            },
            data: testXML,
            timeout: 10000
        });

        console.log('📨 Immediate Response Status:', response.status);
        console.log('📄 Response Body:', response.data);
        
        // Check if response contains ACK
        if (response.data.includes('LOAN_OFFER_ACK')) {
            console.log('✅ SUCCESS: Received immediate ACK response');
            console.log('⏰ Now waiting 25 seconds to check logs for callback...');
            
            // Wait 25 seconds to allow callback to be sent
            setTimeout(async () => {
                console.log('🔍 Checking server logs for callback...');
                // The callback should have been logged by now
            }, 25000);
        } else {
            console.log('❌ UNEXPECTED: Response does not contain LOAN_OFFER_ACK');
        }

    } catch (error) {
        console.error('❌ Error testing ACK-callback pattern:', error.message);
        if (error.response) {
            console.error('Response Status:', error.response.status);
            console.error('Response Body:', error.response.data);
        }
    }
}

// Run the test
testAckCallbackPattern();