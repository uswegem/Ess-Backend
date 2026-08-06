const mongoose = require('mongoose');

// Required-ness for these subdocument fields (and several top-level Product fields below)
// is intentionally NOT enforced here - a draft product can be saved incomplete. Completeness
// is checked explicitly in the products.js controller only when status is being set to 'active'.
const termsConditionSchema = new mongoose.Schema({
  termsConditionNumber: {
    type: String
  },
  description: {
    type: String
  },
  effectiveDate: {
    type: Date
  }
}, { _id: false });

const productSchema = new mongoose.Schema({
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

  // FSP identifiers
  fspCode: {
    type: String,
    required: true,
    default: process.env.FSP_CODE || 'FL8090'
  },
  
  // Product identifiers
  productCode: {
    type: String,
    index: true
  },
  deductionCode: {
    type: String,
    index: true
  },

  // Product details
  productName: {
    type: String
  },
  productDescription: {
    type: String
  },

  // Tenure configuration
  minTenure: {
    type: Number,
    min: 1
  },
  maxTenure: {
    type: Number
  },

  // Rate configuration (percentages)
  interestRate: {
    type: Number
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
    type: Number
  },
  maxAmount: {
    type: Number
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

  // Publish state, independent of isActive (which means "not soft-deleted"). A draft can be
  // saved incomplete via the Add Product "Save Draft" flow and resumed later; 'active' means
  // the product has passed the completeness check and is a real, usable product.
  status: {
    type: String,
    enum: ['draft', 'active'],
    default: 'active',
    index: true
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
  },

  // Utumishi PRODUCT_DETAIL sync state. Independent of `status` (draft/active, which is about
  // form completeness) - this tracks whether Utumishi has been notified of the product's
  // *current* data. Saving/editing a product never changes this except to flip a previously
  // SUBMITTED product to EDITED_SINCE_SUBMIT (see pre-save hook below) - only the Review modal's
  // explicit Submit action can move it to SUBMITTED or SYNC_FAILED.
  utumishiSyncStatus: {
    type: String,
    enum: ['NOT_SUBMITTED', 'SUBMITTED', 'SYNC_FAILED', 'EDITED_SINCE_SUBMIT'],
    default: 'NOT_SUBMITTED',
    index: true
  },
  lastSubmitError: {
    type: String
  }
}, {
  timestamps: true
});

// Fields that feed into the PRODUCT_DETAIL message. If any of these change on a product that
// was already SUBMITTED, the saved data no longer matches what Utumishi has - flip the sync
// status so the product list/Review modal can tell the operator a re-submit is needed.
const PRODUCT_DETAIL_FIELDS = [
  'productCode', 'deductionCode', 'productName', 'productDescription',
  'minTenure', 'maxTenure', 'interestRate', 'processingFee', 'insurance',
  'minAmount', 'maxAmount', 'repaymentType', 'currency', 'insuranceType',
  'forExecutive', 'shariaFacility', 'termsConditions'
];

productSchema.pre('save', function markEditedSinceSubmit(next) {
  if (this.utumishiSyncStatus === 'SUBMITTED' && PRODUCT_DETAIL_FIELDS.some((f) => this.isModified(f))) {
    this.utumishiSyncStatus = 'EDITED_SINCE_SUBMIT';
  }
  next();
});

// Index for efficient queries
productSchema.index({ tenantId: 1, productCode: 1 }, { unique: true, sparse: true });
productSchema.index({ tenantId: 1, deductionCode: 1 });
productSchema.index({ tenantId: 1, isActive: 1 });
productSchema.index({ tenantId: 1, mifosProductId: 1 }, { sparse: true });
productSchema.index({ isActive: 1 });
productSchema.index({ deductionCode: 1, productCode: 1 });

// Inner PRODUCT_DETAIL fields only (no <MessageDetails> wrapper) - this is what
// outgoingMessageService.sendOutgoingMessage expects as an XML-fragment MessageDetails string,
// since it wraps whatever it's given in its own <MessageDetails> element before parsing.
productSchema.methods.toProductDetailFragment = function() {
  const termsXML = this.termsConditions.map(tc => `
            <TermsCondition>
                <TermsConditionNumber>${tc.termsConditionNumber}</TermsConditionNumber>
                <Description>${tc.description}</Description>
                <TCEffectiveDate>${tc.effectiveDate.toISOString().split('T')[0]}</TCEffectiveDate>
            </TermsCondition>`).join('');

  return `
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
            <ShariaFacility>${this.shariaFacility}</ShariaFacility>${termsXML}`;
};

// Method to convert to PRODUCT_DETAIL XML format (full fragment, wrapped - used by the
// multi-product sync preview which concatenates several products under one message).
productSchema.methods.toProductDetailXML = function() {
  return `
        <MessageDetails>${this.toProductDetailFragment()}
        </MessageDetails>`;
};

module.exports = mongoose.model('Product', productSchema);
