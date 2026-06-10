const mongoose = require('mongoose');

const possibleLoanChargesSchema = new mongoose.Schema({
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

// Update the updatedAt field before saving
possibleLoanChargesSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('PossibleLoanCharges', possibleLoanChargesSchema);