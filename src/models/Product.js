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

  // Fixed other charges (legal fees, etc.) used by the loan-charges calculation flow
  // (loanChargesHandler.js and friends). ess2-internal only - there is no corresponding
  // Utumishi PRODUCT_DETAIL field, so this is deliberately NOT in PRODUCT_DETAIL_FIELDS
  // below and never goes out over the wire. Default matches the previous global
  // LOAN_CONSTANTS.OTHER_CHARGES value so existing products behave the same until an
  // operator edits this per product.
  otherCharges: {
    type: Number,
    default: 50000
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

// PRODUCT_DETAIL's MessageDetails as a plain object - the same shape every other outgoing
// message type (LOAN_CHARGES_RESPONSE etc.) already builds and hands straight to
// digitalSignature.createSignedXML(). This used to be a hand-assembled XML string that
// sendOutgoingMessage then parsed back into an object before signing - the only message
// type in the codebase doing that string round trip - which was the actual "8009 Invalid
// Signature" culprit (free-text fields like ProductDescription went out unescaped instead of
// getting xml2js.Builder's automatic XML escaping). Confirmed fixed: Utumishi now responds
// with real XSD validation errors instead of a signature rejection.
//
// ForExecutive/ShariaFacility: Utumishi's schema defines these as XSD boolean, which only
// accepts "true"/"false" (confirmed directly via their own validator response -
// "cvc-datatype-valid.1.2.1: 'N' is not a valid value for 'boolean'" - after this file
// briefly changed them to "Y"/"N" based on a stale example template elsewhere in this app,
// which was wrong for this specific field). String(boolean) reproduces the original
// template-literal's "true"/"false" output, which was correct for this field all along.
productSchema.methods.toProductDetailFragment = function() {
  return {
    DeductionCode: this.deductionCode,
    ProductCode: this.productCode,
    ProductName: this.productName,
    ProductDescription: this.productDescription || '',
    ForExecutive: String(this.forExecutive),
    // Joi's string schema in outgoingMessageValidator doesn't coerce numbers - these are
    // Mongoose Number fields, so (unlike the old template-literal version, which stringified
    // everything for free) they need an explicit String() or validateOutgoingMessageDetails
    // rejects the submission before it ever reaches Utumishi.
    MinimumTenure: String(this.minTenure),
    MaximumTenure: String(this.maxTenure),
    InterestRate: this.interestRate.toFixed(2),
    ProcessFee: this.processingFee.toFixed(2),
    Insurance: this.insurance.toFixed(2),
    MaxAmount: String(this.maxAmount),
    MinAmount: String(this.minAmount),
    RepaymentType: this.repaymentType,
    Currency: this.currency,
    InsuranceType: this.insuranceType,
    ShariaFacility: String(this.shariaFacility),
    TermsCondition: this.termsConditions.map(tc => ({
      TermsConditionNumber: tc.termsConditionNumber,
      Description: tc.description,
      TCEffectiveDate: tc.effectiveDate.toISOString().split('T')[0]
    }))
  };
};

// BROKEN / unused - no callers found anywhere in the codebase. Predates the change above and
// assumed toProductDetailFragment() returned a string; now that it returns an object this
// would produce "<MessageDetails>[object Object]</MessageDetails>" if ever called. Left as-is
// rather than guessing at a rewrite for a function nothing currently exercises - fix properly
// (build via xml2js.Builder like everything else) if this is ever revived.
productSchema.methods.toProductDetailXML = function() {
  return `
        <MessageDetails>${this.toProductDetailFragment()}
        </MessageDetails>`;
};

module.exports = mongoose.model('Product', productSchema);
