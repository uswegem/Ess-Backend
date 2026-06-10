const axios = require('axios');
const digitalSignature = require('./src/utils/signatureUtils');
const logger = require('./src/utils/logger');

/**
 * Test LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST implementation
 */
async function testLoanRestructureAffordabilityRequest() {
  console.log('🚀 Testing LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST Implementation\n');

  try {
    // Prepare test data based on the new structure
    const testRequestData = {
      Document: {
        Data: {
          Header: {
            Sender: 'ESS_UTUMISHI',
            Receiver: 'ZE DONE',
            FSPCode: 'FL8090',
            MsgId: `RESTRUCTURE_AFF_TEST_${Date.now()}`,
            MessageType: 'LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST'
          },
          MessageDetails: {
            CheckNumber: `CHK${Date.now()}`,
            DesignationCode: 'DG001',
            DesignationName: 'Senior Officer',
            BasicSalary: '2500000',
            NetSalary: '1800000',
            OneThirdAmount: '833333',
            RequestedAmount: '5000000',
            DeductibleAmount: '600000',
            DesiredDeductibleAmount: '500000',
            RetirementDate: '2040-12-31',
            TermsOfEmployment: 'Permanent',
            Tenure: '36',
            ProductCode: '17',
            VoteCode: 'V001',
            TotalEmployeeDeduction: '200000',
            JobClassCode: 'JC001',
            LoanNumber: `LOAN${Date.now()}`
          }
        }
      }
    };

    console.log('📋 Test Request Details:');
    console.log('  Check Number:', testRequestData.Document.Data.MessageDetails.CheckNumber);
    console.log('  Basic Salary:', testRequestData.Document.Data.MessageDetails.BasicSalary);
    console.log('  Net Salary:', testRequestData.Document.Data.MessageDetails.NetSalary);
    console.log('  Requested Amount:', testRequestData.Document.Data.MessageDetails.RequestedAmount);
    console.log('  Desired Deductible:', testRequestData.Document.Data.MessageDetails.DesiredDeductibleAmount);
    console.log('  Tenure:', testRequestData.Document.Data.MessageDetails.Tenure, 'months');

    // Create signed XML
    const signedXML = digitalSignature.createSignedXML(testRequestData.Document.Data);
    console.log('\n✅ XML request created and signed');

    // Send request to the API
    const apiUrl = process.env.API_BASE_URL || 'http://localhost:3002';
    const endpoint = `${apiUrl}/api/loan`;

    console.log(`\n📤 Sending request to: ${endpoint}`);
    
    const response = await axios.post(endpoint, signedXML, {
      headers: {
        'Content-Type': 'application/xml',
        'Accept': 'application/xml'
      },
      timeout: 30000
    });

    console.log('\n📥 Response received:');
    console.log('  Status Code:', response.status);
    console.log('  Content Type:', response.headers['content-type']);

    // Parse the response XML to extract key information
    const xml2js = require('xml2js');
    const parser = new xml2js.Parser({ explicitArray: false });
    
    try {
      const parsedResponse = await parser.parseStringPromise(response.data);
      const responseData = parsedResponse.Document.Data;
      
      if (responseData.Header.MessageType === 'LOAN_RESTRUCTURE_AFFORDABILITY_RESPONSE') {
        console.log('\n✅ LOAN_RESTRUCTURE_AFFORDABILITY_RESPONSE received successfully!');
        console.log('\n📊 Response Details:');
        const messageDetails = responseData.MessageDetails;
        
        console.log('  Desired Deductible Amount:', messageDetails.DesiredDeductibleAmount);
        console.log('  Total Insurance:', messageDetails.TotalInsurance);
        console.log('  Total Processing Fees:', messageDetails.TotalProcessingFees);
        console.log('  Total Interest Amount:', messageDetails.TotalInterestRateAmount);
        console.log('  Other Charges:', messageDetails.OtherCharges);
        console.log('  Net Loan Amount:', messageDetails.NetLoanAmount);
        console.log('  Total Amount To Pay:', messageDetails.TotalAmountToPay);
        console.log('  Tenure:', messageDetails.Tenure, 'months');
        console.log('  Eligible Amount:', messageDetails.EligibleAmount);
        console.log('  Monthly Return Amount:', messageDetails.MonthlyReturnAmount);

        // Validate response structure
        const requiredFields = [
          'DesiredDeductibleAmount', 'TotalInsurance', 'TotalProcessingFees',
          'TotalInterestRateAmount', 'OtherCharges', 'NetLoanAmount',
          'TotalAmountToPay', 'Tenure', 'EligibleAmount', 'MonthlyReturnAmount'
        ];

        const missingFields = requiredFields.filter(field => !messageDetails[field]);
        
        if (missingFields.length === 0) {
          console.log('\n✅ All required response fields are present');
        } else {
          console.log('\n⚠️ Missing response fields:', missingFields.join(', '));
        }

        return {
          success: true,
          message: 'LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST processed successfully',
          response: messageDetails
        };

      } else if (responseData.MessageDetails && responseData.MessageDetails.ResponseCode) {
        console.log('\n❌ Error response received:');
        console.log('  Response Code:', responseData.MessageDetails.ResponseCode);
        console.log('  Description:', responseData.MessageDetails.Description);
        
        return {
          success: false,
          error: responseData.MessageDetails.Description,
          responseCode: responseData.MessageDetails.ResponseCode
        };
      } else {
        console.log('\n⚠️ Unexpected response format:', JSON.stringify(responseData, null, 2));
        return {
          success: false,
          error: 'Unexpected response format'
        };
      }

    } catch (parseError) {
      console.log('\n❌ Failed to parse response XML:', parseError.message);
      console.log('Raw response:', response.data);
      return {
        success: false,
        error: 'Failed to parse response XML: ' + parseError.message
      };
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    if (error.response) {
      console.log('  Status:', error.response.status);
      console.log('  Response:', error.response.data);
    }

    return {
      success: false,
      error: error.message,
      recommendations: [
        'Ensure the ESS application is running',
        'Check that LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST handler is properly implemented',
        'Verify the loan calculator service is available',
        'Check database connectivity for audit logging',
        'Ensure digital signature configuration is correct'
      ]
    };
  }
}

// Export for use in other modules
module.exports = { testLoanRestructureAffordabilityRequest };

// Run test if called directly
if (require.main === module) {
  require('dotenv').config();
  
  testLoanRestructureAffordabilityRequest()
    .then(result => {
      console.log('\n🎯 Test completed:', result.success ? 'SUCCESS' : 'FAILED');
      
      if (result.success) {
        console.log('\n🎉 LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST implementation is working correctly!');
      } else {
        console.log('\n💡 Recommendations:');
        if (result.recommendations) {
          result.recommendations.forEach(rec => console.log(`  - ${rec}`));
        }
      }
    })
    .catch(error => {
      console.error('\n💥 Test execution failed:', error.message);
    });
}