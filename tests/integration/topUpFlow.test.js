const request = require('supertest');
const app = require('../../server');
const mongoose = require('mongoose');
const LoanMapping = require('../../src/models/LoanMapping');

describe('Top-Up Loan Flow Integration Tests', () => {
    let testApplicationNumber;
    let testLoanNumber;

    afterAll(async () => {
        // Clean up test data
        await LoanMapping.deleteMany({ essApplicationNumber: /^ESS_TOPUP_TEST/ });
    });

    describe('TOP_UP_PAY_0FF_BALANCE_REQUEST', () => {
        it('should return balance for existing loan', async () => {
            // First create a loan mapping for testing
            const loanMapping = await LoanMapping.create({
                essApplicationNumber: `ESS_TOPUP_TEST_${Date.now()}`,
                essCheckNumber: `CHK${Date.now()}`,
                essLoanNumberAlias: `LOAN${Date.now()}`,
                fspReferenceNumber: `FSP${Date.now()}`,
                productCode: '17',
                requestedAmount: 2000000,
                tenure: 12,
                mifosLoanId: 123, // Mock MIFOS ID
                status: 'DISBURSED'
            });

            const balanceRequestXML = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>TEST_BALANCE_${Date.now()}</MsgId>
            <MessageType>TOP_UP_PAY_0FF_BALANCE_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>${loanMapping.essCheckNumber}</CheckNumber>
            <LoanNumber>${loanMapping.essLoanNumberAlias}</LoanNumber>
            <FirstName>John</FirstName>
            <MiddleName>Doe</MiddleName>
            <LastName>Smith</LastName>
        </MessageDetails>
    </Data>
</Document>`;

            const response = await request(app)
                .post('/api/loan')
                .set('Content-Type', 'application/xml')
                .send(balanceRequestXML);

            expect(response.status).toBe(200);
            expect(response.text).toContain('LOAN_TOP_UP_BALANCE_RESPONSE');
            expect(response.text).toContain('TotalPayoffAmount');
        }, 15000);
    });

    describe('TOP_UP_OFFER_REQUEST', () => {
        it('should process top-up offer and send callback', async () => {
            testApplicationNumber = `ESS_TOPUP_TEST_${Date.now()}`;
            
            const topUpOfferXML = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>TEST_${Date.now()}</MsgId>
            <MessageType>TOP_UP_OFFER_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <ApplicationNumber>${testApplicationNumber}</ApplicationNumber>
            <CheckNumber>CHK${Date.now()}</CheckNumber>
            <FirstName>Jane</FirstName>
            <MiddleName>Mary</MiddleName>
            <LastName>Doe</LastName>
            <Sex>F</Sex>
            <NIN>19900101-12345-67890-12</NIN>
            <MobileNo>255712345678</MobileNo>
            <DateOfBirth>1990-01-01</DateOfBirth>
            <ProductCode>17</ProductCode>
            <RequestedAmount>3000000</RequestedAmount>
            <Tenure>18</Tenure>
            <ExistingLoanNumber>LOAN123456</ExistingLoanNumber>
            <BasicSalary>1200000</BasicSalary>
            <NetSalary>900000</NetSalary>
        </MessageDetails>
    </Data>
</Document>`;

            const response = await request(app)
                .post('/api/loan')
                .set('Content-Type', 'application/xml')
                .send(topUpOfferXML);

            expect(response.status).toBe(200);
            expect(response.text).toContain('RESPONSE');
            expect(response.text).toContain('8000'); // Success code

            // Wait for async callback processing
            await new Promise(resolve => setTimeout(resolve, 3000));

            // Verify loan mapping was created
            const mapping = await LoanMapping.findOne({ essApplicationNumber: testApplicationNumber });
            expect(mapping).toBeTruthy();
            expect(mapping.originalMessageType).toBe('TOP_UP_OFFER_REQUEST');
            expect(mapping.metadata.clientData).toBeDefined();
        }, 25000);

        it('should track callback in loan mapping after 20 seconds', async () => {
            // Wait for callback to be sent (25 seconds total)
            await new Promise(resolve => setTimeout(resolve, 22000));

            const mapping = await LoanMapping.findOne({ essApplicationNumber: testApplicationNumber });
            expect(mapping).toBeTruthy();
            expect(mapping.metadata.callbacksSent).toBeDefined();
            
            const callbacks = mapping.metadata.callbacksSent;
            expect(callbacks.length).toBeGreaterThan(0);
            expect(callbacks[0].type).toBe('LOAN_INITIAL_APPROVAL_NOTIFICATION');
        }, 30000);
    });

    describe('Balance Request Tracking', () => {
        it('should track balance requests in metadata', async () => {
            const loanMapping = await LoanMapping.create({
                essApplicationNumber: `ESS_BALANCE_TRACK_${Date.now()}`,
                essCheckNumber: `CHK${Date.now()}`,
                essLoanNumberAlias: `LOAN${Date.now()}`,
                fspReferenceNumber: `FSP${Date.now()}`,
                productCode: '17',
                requestedAmount: 1500000,
                tenure: 12,
                mifosLoanId: 456,
                status: 'ACTIVE'
            });

            const balanceRequestXML = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>TEST_TRACK_${Date.now()}</MsgId>
            <MessageType>TOP_UP_PAY_0FF_BALANCE_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <CheckNumber>${loanMapping.essCheckNumber}</CheckNumber>
            <LoanNumber>${loanMapping.essLoanNumberAlias}</LoanNumber>
            <FirstName>Test</FirstName>
            <MiddleName>Balance</MiddleName>
            <LastName>Tracking</LastName>
        </MessageDetails>
    </Data>
</Document>`;

            await request(app)
                .post('/api/loan')
                .set('Content-Type', 'application/xml')
                .send(balanceRequestXML);

            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Verify balance request was tracked
            const updatedMapping = await LoanMapping.findOne({ 
                essApplicationNumber: loanMapping.essApplicationNumber 
            });
            
            expect(updatedMapping.metadata).toBeDefined();
            expect(updatedMapping.metadata.balanceRequests).toBeDefined();
            expect(updatedMapping.metadata.balanceRequests.length).toBeGreaterThan(0);
            expect(updatedMapping.metadata.balanceRequests[0].type).toBe('TOP_UP_PAY_0FF_BALANCE_REQUEST');
        }, 15000);
    });
});
