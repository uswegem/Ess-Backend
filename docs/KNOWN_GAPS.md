# Known Gaps

## Test suite is not runnable in this deployed environment

**Status:** open, tracked here as of 2026-08-06.

This production host was deployed with `src/` only — `tests/`, `scripts/`, and `docs/`
(prior to this file) were never shipped here. As a result:

- `package.json` declares `"jest": "^30.2.0"` as a devDependency, but it is **not**
  actually installed — there is no `jest` binary in `node_modules/.bin/`.
- Jest's config points `setupFilesAfterEnv` at `tests/setup.js`, which does not exist
  anywhere on disk in this deployment.
- Running `npx jest ...` here fails immediately with a validation error before any test
  can execute:
  ```
  ● Validation Error:
    Module <rootDir>/tests/setup.js in the setupFilesAfterEnv option was not found.
  ```

**Impact:** the test suite cannot be run locally on this host as currently configured.
Any change needs to be verified by other means here (manual tracing, `node -c` syntax
checks, direct runtime/log verification) or run in a separate environment where `tests/`
is actually deployed and dependencies are fully installed.

**Update (2026-08-06):** the 7-file Product-model switch has now been implemented.
`calculateCharges(loanAmount, adminFeeRate, insuranceRate, otherCharges)` no longer has
an internal `LOAN_CONSTANTS` fallback — all three rate params are required, and every
live caller (`loanChargesHandler.js`, `loanOfferHandler.js`,
`loanRestructureAffordabilityHandler.js`, `topUpOfferHandler.js`) now sources them from
a tenant-scoped `Product` record via `loanUtils.resolveProductForCalculation()`.
`loanCalculations.test.js`'s `calculateCharges` test was updated in the same change to
pass explicit params, plus a new test asserting the old single-arg call now throws.
**This was verified only by manual trace and `node -c` syntax checking** — it could not
be run against a real jest install in this environment (see above). If a runnable
`tests/` environment becomes available, running `loanCalculations.test.js` there is the
first thing worth doing to confirm this change behaves as traced.

## Forgot/Reset Password pages built against pre-redesign Login styling

**Status:** open, tracked here as of 2026-08-07.

A UI redesign of the admin panel (design tokens/`theme.js`, card+gradient Login styling,
per the handoff in `/opt/ess2/frontend/design/`) was started and then paused before any
screens were implemented — the work stalled at the planning stage for the shared
App Shell/Login layer (brand wordmark, design-token reconciliation with `theme.js`, Topbar
logout behavior).

While that work was paused, a real "Forgot Password" feature was built (frontend:
`src/pages/login/ForgotPassword.jsx` and `src/pages/login/ResetPassword.jsx`). Since the
redesign hadn't landed yet, both pages were deliberately styled to match the *current*
Login page (`LoginPaper` + `login.css` classes) rather than the paused redesign's tokens —
matching what exists today, not anticipating a design that wasn't implemented yet.

**Impact:** when the paused UI-redesign work resumes, `ForgotPassword.jsx`/
`ResetPassword.jsx` must be included in its scope alongside `Login.jsx` itself. If the
redesign only touches `Login.jsx`, these two pages will be left visually inconsistent
(old card style/tokens) with the rest of the redesigned app. They're easy to miss since
they aren't on the README's original numbered "Screens" list (that list predates this
feature).

## No date-format normalization on the manual-trigger outgoing-message path

**Status:** open, tracked here as of 2026-08-07 - not implemented, no evidence yet.

`/opt/ess`'s generic manual-trigger endpoint (`outgoingMessagesController.js`) has a
`normalizeMessageDetails()` step that auto-formats known date-shaped `MessageDetails`
field names into Utumishi's expected date format before sending - two hardcoded `Set`s
of field names, one for full datetime fields (`DisbursementDate`, `ValidityDate`,
`LastRepaymentDate`, `MaturityDate`, `PaymentDate`, etc.) and one for date-only fields
(`TCEffectiveDate`, `EmploymentDate`, `ConfirmationDate`, `ContractStartDate`, etc.).
ess2's equivalent (`outgoingMessageService.js`'s `sendOutgoingMessage()` /
`validateMessageDetailsXml()`) has no such step - a date typed in the wrong format in the
manual-trigger XML editor would go out to Utumishi as-is.

**Checked for real evidence before deciding whether to implement (per the "wait for
evidence" approach used elsewhere this session):** queried all 16 retained `failed`
outgoing `MessageLog` entries (the complete available history, not a sample) for
date/format-suggestive error text. **Zero matches.** Every real failure on record is TLS
cert-chain issues, the `ForExecutive` boolean-value bug, or Invalid Signature rejections -
all already root-caused and fixed earlier this session - plus one request timeout. No
loan has ever actually failed on a malformed date field.

**Decision: not implementing this normalization step now**, per the explicit "don't
implement speculatively without evidence" instruction this was investigated under. If a
future `MessageLog` failure's error text suggests a date/format rejection, that would be
the trigger to revisit this - at which point legacy's two `Set`s are a reasonable
starting point, but should be verified against the real failure rather than copied blind
(legacy's own field-name lists were themselves never checked against a real schema
either).

## `mifosWebhookHandler.js`'s `LOAN_INITIAL_APPROVAL_NOTIFICATION` uses a different field shape than every other caller

**Status:** open, tracked here as of 2026-08-07 - pre-existing in both `/opt/ess` and
ess2 identically, not introduced by any change this session.

Found while cross-comparing legacy vs. ess2 field lists for the 13 outgoing message
types with real construction code in `/opt/ess`. Five call sites build
`LOAN_INITIAL_APPROVAL_NOTIFICATION` in ess2 (`loanOfferHandler.js` x2,
`topUpOfferHandler.js`, `takeoverOfferHandler.js`, `loanRestructureHandler.js`) - four of
them agree on the same shape: `ApplicationNumber`, `Reason`, `FSPReferenceNumber`,
`LoanNumber`, `TotalAmountToPay`, `OtherCharges`, `Approval` (this matches
`REQUIRED_FIELDS_BY_MESSAGE_TYPE.LOAN_INITIAL_APPROVAL_NOTIFICATION` exactly). The fifth,
`mifosWebhookHandler.js`'s `sendLoanInitialApprovalNotification()`, builds a completely
different field set instead: `CheckNumber`, `LoanNumber`, `ApplicationNumber`, `FSPCode`
(duplicated inside `MessageDetails`), `ApprovedAmount`, `Tenure`, `MonthlyInstallment`,
`InterestRate`, `ProcessingFee`, `Insurance`, `ApprovalDate`, `DisbursementDate` - no
`Reason`/`FSPReferenceNumber`/`TotalAmountToPay`/`OtherCharges`/`Approval` at all. **This
divergence exists byte-identically in `/opt/ess`** - confirmed by direct comparison, not
something ess2 introduced.

**Impact:** if `mifosWebhookHandler.js`'s webhook-triggered approval path were ever
validated against `REQUIRED_FIELDS_BY_MESSAGE_TYPE` (it currently isn't - the manual-
trigger validate endpoint is a separate code path from webhook-triggered sends), it would
fail every one of the 5 required fields that path doesn't populate. Whether this shape
is actually correct per Utumishi's real spec (and the other four call sites are what's
wrong), or vice versa, isn't established either way - no evidence found for which one
Utumishi actually expects. Flagging for a future investigation, not fixing speculatively
here since scope was comparison/cataloging only.
