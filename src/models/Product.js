const mongoose = require('mongoose');

const termsConditionSchema = new mongoose.Schema({
  termsConditionNumber: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  effectiveDate: {
    type: Date,
    required: true
  }
}, { _id: false });

const productSchema = new mongoose.Schema({
  // FSP identifiers
  fspCode: {
    type: String,
    required: true,
    default: process.env.FSP_CODE || 'FL8090'
  },
  
  // Product identifiers
  productCode: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  deductionCode: {
    type: String,
    required: true,
    index: true
  },
  
  // Product details
  productName: {
    type: String,
    required: true
  },
  productDescription: {
    type: String
  },
  
  // Tenure configuration
  minTenure: {
    type: Number,
    required: true,
    min: 1
  },
  maxTenure: {
    type: Number,
    required: true
  },
  
  // Rate configuration (percentages)
  interestRate: {
    type: Number,
    required: true
  },
  processingFee: {
    type: Number,
    default: 0
  },
  insurance: {
    type: Number,
    default: 0
  },
  
  // Amount limits
  minAmount: {
    type: Number,
    required: true
  },
  maxAmount: {
    type: Number,
    required: true
  },
  
  // Repayment configuration
  repaymentType: {
    type: String,
    enum: ['Flat', 'Reducing', 'FLAT', 'REDUCING'],
    default: 'Flat'
  },
  
  // Insurance type
  insuranceType: {
    type: String,
    enum: ['DISTRIBUTED', 'UP_FRONT'],
    default: 'DISTRIBUTED'
  },
  
  // Currency
  currency: {
    type: String,
    default: 'TZS'
  },
  
  // Special flags
  forExecutive: {
    type: Boolean,
    default: false
  },
  shariaFacility: {
    type: Boolean,
    default: false
  },
  
  // Terms and conditions
  termsConditions: [termsConditionSchema],
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // MIFOS integration
  mifosProductId: {
    type: Number,
    index: true
  },
  
  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  lastSyncedToUtumishi: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for efficient queries
productSchema.index({ isActive: 1 });
productSchema.index({ deductionCode: 1, productCode: 1 });

// Method to convert to PRODUCT_DETAIL XML format
productSchema.methods.toProductDetailXML = function() {
  const termsXML = this.termsConditions.map(tc => `
            <TermsCondition>
                <TermsConditionNumber>${tc.termsConditionNumber}</TermsConditionNumber>
                <Description>${tc.description}</Description>
                <TCEffectiveDate>${tc.effectiveDate.toISOString().split('T')[0]}</TCEffectiveDate>
            </TermsCondition>`).join('');

  return `
        <MessageDetails>
            <DeductionCode>${this.deductionCode}</DeductionCode>
            <ProductCode>${this.productCode}</ProductCode>
            <ProductName>${this.productName}</ProductName>
            <ProductDescription>${this.productDescription || ''}</ProductDescription>
            <ForExecutive>${this.forExecutive}</ForExecutive>
            <MinimumTenure>${this.minTenure}</MinimumTenure>
            <MaximumTenure>${this.maxTenure}</MaximumTenure>
            <InterestRate>${this.interestRate.toFixed(2)}</InterestRate>
            <ProcessFee>${this.processingFee.toFixed(2)}</ProcessFee>
            <Insurance>${this.insurance.toFixed(2)}</Insurance>
            <MaxAmount>${this.maxAmount}</MaxAmount>
            <MinAmount>${this.minAmount}</MinAmount>
            <RepaymentType>${this.repaymentType}</RepaymentType>
            <Currency>${this.currency}</Currency>
            <InsuranceType>${this.insuranceType}</InsuranceType>
            <ShariaFacility>${this.shariaFacility}</ShariaFacility>${termsXML}
        </MessageDetails>`;
};

module.exports = mongoose.model('Product', productSchema);
