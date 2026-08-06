const logger = require('../utils/logger');
const Joi = require('joi');

// Common header validation schema
const headerSchema = Joi.object({
  Sender: Joi.string().required(),
  Receiver: Joi.string().required(),
  FSPCode: Joi.string().max(10).required(),
  MsgId: Joi.string().required(),
  MessageType: Joi.string().required()
});

// Common validation for all message types
function validateXML(parsedData) {
  logger.info('Validating XML structure...');
  logger.info('Parsed data keys:', Object.keys(parsedData));

  // Handle different XML structures:
  // Option 1: Direct Data element (from frontend)
  // Option 2: Document > Data structure (proper Miracore format)
  
  let dataElement;
  
  if (parsedData.Data) {
    logger.info(' Found direct Data element (frontend format)');
    dataElement = parsedData.Data;
  } else if (parsedData.Document && parsedData.Document.Data) {
    logger.info(' Found Document > Data structure (proper Miracore format)');
    dataElement = parsedData.Document.Data;
  } else if (parsedData.document && parsedData.document.data) {
    logger.info(' Found document > data structure (lowercase)');
    dataElement = parsedData.document.data;
  } else {
    logger.info('❌ No valid XML structure found');
    return {
      isValid: false,
      errorCode: '8001',
      description: 'Invalid XML structure. Expected <Document><Data>...</Data></Document> or <Data>...</Data>'
    };
  }

  // Validate header exists
  const header = dataElement.Header || dataElement.header;
  if (!header) {
    return {
      isValid: false,
      description: 'Header element is missing'
    };
  }

  // Validate header structure
  const { error } = headerSchema.validate(header);
  if (error) {
    return {
      isValid: false,
      errorCode: '8001',
      description: `Header validation failed: ${error.details[0].message}`
    };
  }

  logger.info('✅ XML structure validation passed');
  return { 
    isValid: true,
    data: dataElement // Return the extracted data element
  };
}

// Message type specific validations remain the same...
function validateMessageType(messageType, dataElement) {
  const validators = {
    'PRODUCT_DETAIL': validateProductDetail,
    'LOAN_CHARGES_REQUEST': validateLoanChargesRequest,
    'LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST': validateLoanChargesRequest, // Uses same validation as LOAN_CHARGES_REQUEST
    'LOAN_OFFER_REQUEST': validateLoanOfferRequest,
    'LOAN_RESTRUCTURE_REQUEST': validateLoanRestructureRequest,
    'TAKEOVER_PAY_OFF_BALANCE_REQUEST': validateTakeoverBalanceRequest,
    'TOP_UP_PAY_0FF_BALANCE_REQUEST': validateTopUpPayOffBalanceRequest,
    'TOP_UP_OFFER_REQUEST': validateTopUpOfferRequest,
    'LOAN_FINAL_APPROVAL_NOTIFICATION': validateLoanFinalApprovalNotification
    // Add more validators as needed
  };

  const validator = validators[messageType];
  if (validator) {
    return validator(dataElement);
  }

  // Default validation for unknown message types
  return { isValid: true };
}

// Update all validator functions to accept dataElement instead of parsedData
function validateProductDetail(dataElement) {
  // Validate product details structure
  const messageDetails = dataElement.MessageDetails || dataElement.messagedetails;
  
  if (!messageDetails) {
    return {
      isValid: false,
      description: 'MessageDetails element is missing'
    };
  }

  const productSchema = Joi.object({
    DeductionCode: Joi.string().max(10).required(),
    ProductCode: Joi.string().max(8).required(),
    ProductName: Joi.string().max(255).required(),
    ProductDescription: Joi.string().max(255).optional(),
    ForExecutive: Joi.string().valid('true', 'false').required(),
    MinimumTenure: Joi.string().required(),
    MaximumTenure: Joi.string().required(),
    InterestRate: Joi.string().required(),
    ProcessFee: Joi.string().optional(),
    Insurance: Joi.string().required(),
    MaxAmount: Joi.string().required(),
    MinAmount: Joi.string().required(),
    RepaymentType: Joi.string().max(10).optional(),
    Currency: Joi.string().max(3).required(),
    InsuranceType: Joi.string().valid('DISTRIBUTED', 'UP_FRONT').required(),
    ShariaFacility: Joi.string().valid('true', 'false').required(),
    TermsCondition: Joi.alternatives().try(
      Joi.array().items(Joi.object({
        TermsConditionNumber: Joi.string().max(20).required(),
        Description: Joi.string().max(255).required(),
        TCEffectiveDate: Joi.string().required()
      })),
      Joi.object({
        TermsConditionNumber: Joi.string().max(20).required(),
        Description: Joi.string().max(255).required(),
        TCEffectiveDate: Joi.string().required()
      })
    ).optional()
  });

  const { error } = productSchema.validate(messageDetails);
  if (error) {
    return {
      isValid: false,
      description: `Product detail validation failed: ${error.details[0].message}`
    };
  }

  return { isValid: true };
}

function validateLoanChargesRequest(dataElement) {
  const messageDetails = dataElement.MessageDetails || dataElement.messagedetails;
  
  const schema = Joi.object({
    CheckNumber: Joi.string().max(9).required(),
    DesignationCode: Joi.string().max(8).required(),
    DesignationName: Joi.string().max(255).required(),
    BasicSalary: Joi.string().required(),
    NetSalary: Joi.string().required(),
    OneThirdAmount: Joi.string().required(),
    RequestedAmount: Joi.string().optional(),
    DeductibleAmount: Joi.string().required(),
    DesiredDeductibleAmount: Joi.string().optional(),
    RetirementDate: Joi.string().required(),
    TermsOfEmployment: Joi.string().max(30).required(),
    Tenure: Joi.string().optional(),
    ProductCode: Joi.string().max(8).required(),
    VoteCode: Joi.string().max(10).required(),
    TotalEmployeeDeduction: Joi.string().required(),
    JobClassCode: Joi.string().max(10).required()
  });

  const { error } = schema.validate(messageDetails);
  
  if (error) {
    return {
      isValid: false,
      description: `Loan charges request validation failed: ${error.details[0].message}`
    };
  }

  return { isValid: true };
}


function validateLoanOfferRequest(parsedData) {
  const schema = Joi.object({
    CheckNumber: Joi.string().max(9).required(),
    FirstName: Joi.string().max(30).required(),
    MiddleName: Joi.string().max(30).required(),
    LastName: Joi.string().max(30).required(),
    Sex: Joi.string().valid('M', 'F').required(),
    EmploymentDate: Joi.string().isoDate().required(),
    MaritalStatus: Joi.string().max(10).required(),
    ConfirmationDate: Joi.string().isoDate().optional(),
    BankAccountNumber: Joi.string().max(20).required(),
    NearestBranchName: Joi.string().max(50).optional(),
    NearestBranchCode: Joi.string().max(50).optional(),
    VoteCode: Joi.string().max(6).required(),
    VoteName: Joi.string().max(255).required(),
    NIN: Joi.string().max(22).required(),
    DesignationCode: Joi.string().max(8).required(),
    DesignationName: Joi.string().max(255).required(),
    BasicSalary: Joi.number().precision(2).positive().required(),
    NetSalary: Joi.number().precision(2).positive().required(),
    OneThirdAmount: Joi.number().precision(2).positive().required(),
    TotalEmployeeDeduction: Joi.number().precision(2).positive().required(),
    RetirementDate: Joi.number().integer().positive().required(),
    TermsOfEmployment: Joi.string().max(30).required(),
    RequestedAmount: Joi.number().precision(2).positive().optional(),
    DesiredDeductibleAmount: Joi.number().precision(2).positive().optional(),
    Tenure: Joi.number().integer().positive().required(),
    FSPCode: Joi.string().max(10).required(),
    ProductCode: Joi.string().max(8).required(),
    InterestRate: Joi.number().precision(2).positive().required(),
    ProcessingFee: Joi.number().precision(2).positive().required(),
    Insurance: Joi.number().precision(2).positive().required(),
    PhysicalAddress: Joi.string().max(50).required(),
    TelephoneNumber: Joi.string().max(12).optional(),
    EmailAddress: Joi.string().email().max(50).required(),
    MobileNumber: Joi.string().max(12).required(),
    ApplicationNumber: Joi.string().max(15).required(),
    LoanPurpose: Joi.string().max(250).required(),
    ContractStartDate: Joi.string().isoDate().optional(),
    ContractEndDate: Joi.string().isoDate().optional(),
    SwiftCode: Joi.string().max(50).required(),
    Funding: Joi.string().max(50).required()
  });

  const { error } = schema.validate(parsedData.Document.Data.MessageDetails);
  
  if (error) {
    return {
      isValid: false,
      description: `Loan offer request validation failed: ${error.details[0].message}`
    };
  }

  return { isValid: true };
}

function validateLoanRestructureRequest(parsedData) {
  const schema = Joi.object({
    CheckNumber: Joi.string().max(9).required(),
    FirstName: Joi.string().max(30).required(),
    MiddleName: Joi.string().max(30).required(),
    LastName: Joi.string().max(30).required(),
    Sex: Joi.string().valid('M', 'F').required(),
    EmploymentDate: Joi.string().isoDate().required(),
    MaritalStatus: Joi.string().max(10).required(),
    NearestBranchName: Joi.string().max(50).optional(),
    NearestBranchCode: Joi.string().max(50).optional(),
    VoteCode: Joi.string().max(6).required(),
    VoteName: Joi.string().max(255).required(),
    NIN: Joi.string().max(22).required(),
    DesignationCode: Joi.string().max(8).required(),
    DesignationName: Joi.string().max(255).required(),
    BasicSalary: Joi.number().precision(2).positive().required(),
    NetSalary: Joi.number().precision(2).positive().required(),
    OneThirdAmount: Joi.number().precision(2).positive().required(),
    TotalEmployeeDeduction: Joi.number().precision(2).positive().required(),
    RetirementDate: Joi.number().integer().positive().required(),
    TermsOfEmployment: Joi.string().max(30).required(),
    DesiredDeductibleAmount: Joi.number().precision(2).positive().optional(),
    Tenure: Joi.number().integer().positive().required(),
    FSPCode: Joi.string().max(10).required(),
    ProductCode: Joi.string().max(8).required(),
    InterestRate: Joi.number().precision(2).positive().required(),
    ProcessingFee: Joi.number().precision(2).positive().required(),
    Insurance: Joi.number().precision(2).positive().required(),
    PhysicalAddress: Joi.string().max(50).required(),
    EmailAddress: Joi.string().email().max(50).required(),
    MobileNumber: Joi.string().max(12).required(),
    ApplicationNumber: Joi.string().max(15).required(),
    ContractStartDate: Joi.string().isoDate().optional(),
    ContractEndDate: Joi.string().isoDate().optional(),
    LoanNumber: Joi.string().max(20).required(),
    Funding: Joi.string().max(50).required(),
    FSPReferenceNumber: Joi.string().max(20).optional(),
    LoanPurpose: Joi.string().max(150).required()
  });

  const { error } = schema.validate(parsedData.Document.Data.MessageDetails);
  
  if (error) {
    return {
      isValid: false,
      description: `Loan restructure request validation failed: ${error.details[0].message}`
    };
  }

  return { isValid: true };
}

function validateTakeoverBalanceRequest(parsedData) {
  const schema = Joi.object({
    CheckNumber: Joi.string().max(15).required(),
    LoanNumber: Joi.string().max(25).required(),
    FirstName: Joi.string().max(30).required(),
    MiddleName: Joi.string().max(30).required(),
    LastName: Joi.string().max(30).required(),
    VoteCode: Joi.string().max(6).required(),
    VoteName: Joi.string().max(255).required(),
    DeductionAmount: Joi.number().precision(2).positive().required(),
    DeductionCode: Joi.string().max(8).required(),
    DeductionName: Joi.string().max(255).required(),
    DeductionBalance: Joi.number().precision(2).positive().required(),
    PaymentOption: Joi.string().max(50).required()
  });

  const { error } = schema.validate(parsedData.Document.Data.MessageDetails);
  
  if (error) {
    return {
      isValid: false,
      description: `Takeover balance request validation failed: ${error.details[0].message}`
    };
  }

  return { isValid: true };
}

function validateTopUpPayOffBalanceRequest(parsedData) {
  const schema = Joi.object({
    CheckNumber: Joi.string().max(15).required(),
    LoanNumber: Joi.string().max(25).required(),
    FirstName: Joi.string().max(30).required(),
    MiddleName: Joi.string().max(30).required(),
    LastName: Joi.string().max(30).required(),
    VoteCode: Joi.string().max(6).required(),
    VoteName: Joi.string().max(255).required(),
    DeductionAmount: Joi.number().precision(2).positive().required(),
    DeductionCode: Joi.string().max(8).required(),
    DeductionName: Joi.string().max(255).required(),
    DeductionBalance: Joi.number().precision(2).positive().required(),
    PaymentOption: Joi.string().max(50).required()
  });

  const { error } = schema.validate(parsedData.Document.Data.MessageDetails);
  
  if (error) {
    return {
      isValid: false,
      description: `Top-up pay-off balance request validation failed: ${error.details[0].message}`
    };
  }

  return { isValid: true };
}

function validateTopUpOfferRequest(parsedData) {
  const schema = Joi.object({
    CheckNumber: Joi.string().max(15).required(), // Mandatory field
    ExistingLoanNumber: Joi.string().max(25).required(),
    FirstName: Joi.string().max(30).required(),
    MiddleName: Joi.string().max(30).optional(), // Handle missing gracefully
    LastName: Joi.string().max(30).required(),
    Sex: Joi.string().valid('M', 'F').required(), // Gender options now configured
    EmploymentDate: Joi.string().isoDate().required(), // For datatable
    MaritalStatus: Joi.string().max(10).optional(),
    ConfirmationDate: Joi.string().isoDate().optional(),
    BankAccountNumber: Joi.string().max(20).required(), // For datatable
    NearestBranchName: Joi.string().max(50).optional(),
    NearestBranchCode: Joi.string().max(50).optional(),
    VoteCode: Joi.string().max(6).required(),
    VoteName: Joi.string().max(255).required(),
    NIN: Joi.string().max(22).required(), // Used as external ID
    DesignationCode: Joi.string().max(8).required(),
    DesignationName: Joi.string().max(255).required(),
    BasicSalary: Joi.number().precision(2).positive().required(),
    NetSalary: Joi.number().precision(2).positive().required(),
    OneThirdAmount: Joi.number().precision(2).positive().required(),
    TotalEmployeeDeduction: Joi.number().precision(2).positive().required(),
    RetirementDate: Joi.number().integer().positive().required(),
    TermsOfEmployment: Joi.string().max(30).required(),
    RequestedTopUpAmount: Joi.number().precision(2).positive().required(),
    ProductCode: Joi.string().max(10).required(),
    InterestRate: Joi.number().precision(2).min(0).max(100).required(),
    ProcessingFee: Joi.number().precision(2).min(0).required(),
    Insurance: Joi.number().precision(2).min(0).required(),
    Tenure: Joi.number().integer().positive().required(),
    SwiftCode: Joi.string().max(20).optional(), // For datatable
    MobileNo: Joi.string().max(15).optional() // For client creation with country code
  });

  const { error } = schema.validate(parsedData.Document.Data.MessageDetails);
  
  if (error) {
    return {
      isValid: false,
      description: `Top-up offer request validation failed: ${error.details[0].message}`
    };
  }

  return { isValid: true };
}

function validateLoanFinalApprovalNotification(dataElement) {
  const messageDetails = dataElement.MessageDetails || dataElement.messagedetails;
  
  if (!messageDetails) {
    return {
      isValid: false,
      description: 'MessageDetails element is missing'
    };
  }

  // Validate required fields for loan final approval
  const requiredFields = ['ApplicationNumber', 'FSPReferenceNumber', 'LoanNumber', 'Approval'];
  
  for (const field of requiredFields) {
    if (!messageDetails[field] && !messageDetails[field.toLowerCase()]) {
      return {
        isValid: false,
        description: `${field} is required for loan final approval notification`
      };
    }
  }

  // If NIN is provided, validate customer data is also present
  const nin = messageDetails.NIN || messageDetails.nin;
  if (nin) {
    const customerFields = ['FirstName', 'LastName', 'MobileNo'];
    for (const field of customerFields) {
      if (!messageDetails[field] && !messageDetails[field.toLowerCase()]) {
        return {
          isValid: false,
          description: `${field} is required when NIN is provided`
        };
      }
    }
  }

  return { isValid: true };
}


// Add other validation functions as needed...

module.exports = {
  validateXML,
  validateMessageType
};