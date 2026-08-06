const mongoose = require('mongoose');

const possibleLoanChargesSchema = new mongoose.Schema({
  tenantId: {
    type: String,
    required: false,
    index: true
  },
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true
  },

  productCode: {
    type: String,
    required: true
  },
  productName: {
    type: String,
    default: 'Watumishi Wezesha Loan'
  },
  idNumber: {
    type: String,
    required: true
  },
  idNumberType: {
    type: String,
    enum: ['CHECK_NUMBER', 'NATIONAL_ID'],
    default: 'NATIONAL_ID'
  },
  applicationNumber: {
    type: String
  },
  requestedAmount: {
    type: Number
  },
  requestedTenure: {
    type: Number
  },
  deductibleAmount: {
    type: Number
  },
  desiredDeductibleAmount: {
    type: Number
  },
  affordabilityType: {
    type: String,
    enum: ['FORWARD', 'REVERSE']
  },
  request: {
    type: String, // JSON string of UtumishiOfferRequest
    required: true
  },
  offerRequest: {
    type: String, // JSON string of LoanOfferDTO
  },
  offerData: {
    type: String, // JSON string of loan offer response
  },
  eligibleAmount: {
    type: Number
  },
  monthlyReturnAmount: {
    type: Number
  },
  totalProcessingFees: {
    type: Number
  },
  totalInsurance: {
    type: Number
  },
  otherCharges: {
    type: Number
  },
  totalInterestRateAmount: {
    type: Number
  },
  netLoanAmount: {
    type: Number
  },
  totalAmountToPay: {
    type: Number
  },
  response: {
    type: String, // JSON string of UtumishiOfferResponse
  },
  status: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'FAILED'],
    default: 'PENDING'
  },
  errorMessage: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

possibleLoanChargesSchema.index({ tenantId: 1, applicationNumber: 1 });
possibleLoanChargesSchema.index({ tenantId: 1, idNumber: 1 });
possibleLoanChargesSchema.index({ tenantId: 1, status: 1, createdAt: -1 });

// Update the updatedAt field before saving
possibleLoanChargesSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('PossibleLoanCharges', possibleLoanChargesSchema);