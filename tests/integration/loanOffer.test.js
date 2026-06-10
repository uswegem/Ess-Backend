const request = require('supertest');
const app = require('../../server');
const mongoose = require('mongoose');
const LoanMapping = require('../../src/models/LoanMapping');

describe('Loan Offer Flow Integration Tests', () => {
    afterAll(async () => {
        // Clean up test database
        await LoanMapping.deleteMany({ essApplicationNumber: /^ESS_TEST/ });
    });

    describe('POST /api/loan - LOAN_OFFER_REQUEST', () => {
        it('should process loan offer request and create loan mapping', async () => {
            const loanOfferXML = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>TEST_${Date.now()}</MsgId>
            <MessageType>LOAN_OFFER_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <ApplicationNumber>ESS_TEST_${Date.now()}</ApplicationNumber>
            <CheckNumber>CHK${Date.now()}</CheckNumber>
            <FirstName>John</FirstName>
            <MiddleName>Doe</MiddleName>
            <LastName>Smith</LastName>
            <Sex>M</Sex>
            <NIN>19900101-12345-67890-12</NIN>
            <MobileNo>255712345678</MobileNo>
            <DateOfBirth>1990-01-01</DateOfBirth>
            <MaritalStatus>SINGLE</MaritalStatus>
            <ProductCode>17</ProductCode>
            <RequestedAmount>5000000</RequestedAmount>
            <Tenure>24</Tenure>
            <EmploymentDate>2020-01-01</EmploymentDate>
            <RetirementDate>2050-01-01</RetirementDate>
            <BasicSalary>1200000</BasicSalary>
            <NetSalary>900000</NetSalary>
        </MessageDetails>
    </Data>
</Document>`;

            const response = await request(app)
                .post('/api/loan')
                .set('Content-Type', 'application/xml')
                .send(loanOfferXML);

            expect(response.status).toBe(200);
            expect(response.text).toContain('RESPONSE');
            expect(response.text).toContain('8000'); // Success code
        }, 15000);

        it('should store client data in loan mapping', async () => {
            const appNumber = `ESS_TEST_${Date.now()}`;
            const loanOfferXML = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>TEST_${Date.now()}</MsgId>
            <MessageType>LOAN_OFFER_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <ApplicationNumber>${appNumber}</ApplicationNumber>
            <CheckNumber>CHK${Date.now()}</CheckNumber>
            <FirstName>Jane</FirstName>
            <MiddleName>Mary</MiddleName>
            <LastName>Johnson</LastName>
            <Sex>F</Sex>
            <NIN>19850505-54321-09876-54</NIN>
            <MobileNo>255723456789</MobileNo>
            <DateOfBirth>1985-05-05</DateOfBirth>
            <MaritalStatus>MARRIED</MaritalStatus>
            <ProductCode>17</ProductCode>
            <RequestedAmount>3000000</RequestedAmount>
            <Tenure>12</Tenure>
            <EmploymentDate>2018-06-15</EmploymentDate>
            <RetirementDate>2048-05-05</RetirementDate>
            <BasicSalary>1500000</BasicSalary>
            <NetSalary>1100000</NetSalary>
        </MessageDetails>
    </Data>
</Document>`;

            await request(app)
                .post('/api/loan')
                .set('Content-Type', 'application/xml')
                .send(loanOfferXML);

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Check if loan mapping was created
            const mapping = await LoanMapping.findOne({ essApplicationNumber: appNumber });
            expect(mapping).toBeTruthy();
            expect(mapping.metadata.clientData.firstName).toBe('Jane');
            expect(mapping.requestedAmount).toBe(3000000);
        }, 15000);

        it('should reject invalid XML format', async () => {
            const invalidXML = 'Not valid XML';

            const response = await request(app)
                .post('/api/loan')
                .set('Content-Type', 'application/xml')
                .send(invalidXML);

            expect(response.status).toBe(200);
            expect(response.text).toContain('8001'); // XML parsing error code
        });
    });

    describe('Callback Processing', () => {
        it('should send LOAN_INITIAL_APPROVAL_NOTIFICATION callback after 20 seconds', async () => {
            const appNumber = `ESS_TEST_CALLBACK_${Date.now()}`;
            const loanOfferXML = `<?xml version="1.0" encoding="UTF-8"?>
<Document>
    <Data>
        <Header>
            <Sender>ESS_UTUMISHI</Sender>
            <Receiver>ZE DONE</Receiver>
            <FSPCode>FL8090</FSPCode>
            <MsgId>TEST_${Date.now()}</MsgId>
            <MessageType>LOAN_OFFER_REQUEST</MessageType>
        </Header>
        <MessageDetails>
            <ApplicationNumber>${appNumber}</ApplicationNumber>
            <CheckNumber>CHK${Date.now()}</CheckNumber>
            <FirstName>Test</FirstName>
            <MiddleName>Callback</MiddleName>
            <LastName>User</LastName>
            <Sex>M</Sex>
            <NIN>19900101-00000-00000-00</NIN>
            <MobileNo>255700000000</MobileNo>
            <DateOfBirth>1990-01-01</DateOfBirth>
            <ProductCode>17</ProductCode>
            <RequestedAmount>2000000</RequestedAmount>
            <Tenure>18</Tenure>
            <BasicSalary>1000000</BasicSalary>
            <NetSalary>750000</NetSalary>
        </MessageDetails>
    </Data>
</Document>`;

            await request(app)
                .post('/api/loan')
                .set('Content-Type', 'application/xml')
                .send(loanOfferXML);

            // Wait for callback to be sent (25 seconds)
            await new Promise(resolve => setTimeout(resolve, 25000));

            // Check if callback was tracked in loan mapping
            const mapping = await LoanMapping.findOne({ essApplicationNumber: appNumber });
            expect(mapping).toBeTruthy();
            expect(mapping.metadata.callbacksSent).toBeDefined();
            expect(mapping.metadata.callbacksSent.length).toBeGreaterThan(0);
            expect(mapping.metadata.callbacksSent[0].type).toBe('LOAN_INITIAL_APPROVAL_NOTIFICATION');
        }, 30000);
    });
});
