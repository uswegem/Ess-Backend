const mongoose = require('mongoose');

// Shared conditional-required validator: these fields are mandatory for a real, submittable
// product (status: 'active') but genuinely optional while status: 'draft' - a draft exists
// specifically to be saved incomplete and finished later.
//
// Works correctly in both validation contexts this schema is validated under:
//  - `.save()` (POST /products) - `this` is the document itself, so `this.status` is read
//    directly.
//  - `findOneAndUpdate` with `runValidators: true` (PUT /products/:id) - `this` is the Query,
//    not the document, UNLESS `context: 'query'` is also passed (which the PUT route does).
//    Under that context, sibling fields being written in the same update are read via
//    `this.get(field)`, not `this.field` directly.
//
// Caveat: this reads the *incoming* status being written, not the document's current stored
// status - if a future PUT call updates other fields without including `status` in its body,
// `this.get('status')` returns undefined here and these fields are treated as not-required for
// that call. Every current caller (updateProduct() in the frontend) always sends `status`
// (buildProductPayload defaults it to 'active'), so this doesn't bite today, but a future
// partial-update caller that omits `status` needs to be aware of this.
function requiredWhenActive() {
  const status = typeof this.get === 'function' ? this.get('status') : this.status;
  return status === 'active';
}

// Kept in sync with every field above whose `required` is requiredWhenActive - used by the
// findOneAndUpdate whole-document check below, since Mongoose's per-path update validators
// alone aren't enough here (see that hook's comment for why).
const REQUIRED_WHEN_ACTIVE_FIELDS = [
  'deductionCode', 'productName', 'minTenure', 'maxTenure', 'interestRate', 'minAmount', 'maxAmount'
];

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
    required: true,
    index: true
  },
  deductionCode: {
    type: String,
    required: requiredWhenActive,
    index: true
  },

  // Product details
  productName: {
    type: String,
    required: requiredWhenActive
  },
  productDescription: {
    type: String
  },

  // Tenure configuration
  minTenure: {
    type: Number,
    required: requiredWhenActive,
    min: 1
  },
  maxTenure: {
    type: Number,
    required: requiredWhenActive
  },

  // Rate configuration (percentages)
  interestRate: {
    type: Number,
    required: requiredWhenActive
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
    required: requiredWhenActive
  },
  maxAmount: {
    type: Number,
    required: requiredWhenActive
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
  
  // Workflow status - draft (still being filled in, not yet a real usable product) vs
  // active (fully saved/submittable). Separate from isActive below, which is a soft-delete
  // flag applied to either status, not a workflow state.
  status: {
    type: String,
    enum: ['draft', 'active'],
    default: 'active',
    index: true
  },

  // Soft-delete flag
  isActive: {
    type: Boolean,
    default: true
  },

  // Whether Utumishi has this product's current data (via PRODUCT_DETAIL). Read/written by
  // the frontend for a while before this field actually existed here - same class of bug as
  // `status` above (Mongoose strict mode silently dropped it), so every product always
  // displayed as "not submitted" regardless of its real state.
  utumishiSyncStatus: {
    type: String,
    enum: ['NOT_SUBMITTED', 'SUBMITTED', 'EDITED_SINCE_SUBMIT', 'SYNC_FAILED'],
    default: 'NOT_SUBMITTED'
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

// Mongoose's findOneAndUpdate + runValidators only validates the paths actually present in
// that update's $set - it does NOT re-validate the full resulting document. So an update that
// only sets { status: 'active' } on a draft that's still missing productName/minTenure/etc.
// sails through per-path validation with nothing to say no, even though the field-level
// requiredWhenActive validators above are working exactly as designed for the paths they
// actually see. This hook closes that gap: whenever an update would result in status being
// 'active', it fetches the current document, merges in this update, and rejects if any
// required-when-active field is still missing from the merged result - the same guarantee
// `.save()` gets for free by validating the whole document every time.
productSchema.pre('findOneAndUpdate', async function(next) {
  const update = this.getUpdate() || {};
  const setOps = update.$set || update;
  const newStatus = setOps.status;

  // Only the transition INTO active needs this extra check - .save() already validates a
  // full draft-or-active document correctly on its own, and an update that isn't touching
  // status/doesn't result in active doesn't need the merged-document check at all.
  if (newStatus !== 'active') {
    return next();
  }

  try {
    const existing = await this.model.findOne(this.getQuery()).lean();
    const missing = REQUIRED_WHEN_ACTIVE_FIELDS.filter((field) => {
      const incoming = setOps[field];
      const effective = incoming !== undefined ? incoming : existing?.[field];
      return effective === undefined || effective === null || effective === '';
    });

    if (missing.length > 0) {
      return next(new Error(
        `Cannot activate product: missing required field(s): ${missing.join(', ')}`
      ));
    }

    return next();
  } catch (err) {
    return next(err);
  }
});

// Index for efficient queries
productSchema.index({ tenantId: 1, productCode: 1 }, { unique: true, sparse: true });
productSchema.index({ tenantId: 1, deductionCode: 1 });
productSchema.index({ tenantId: 1, isActive: 1 });
productSchema.index({ tenantId: 1, mifosProductId: 1 }, { sparse: true });
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
