# Known Gaps

## Interest Income uses max(daily-accrual, actually-paid) per loan - a deliberate design choice, not a stopgap

**Status:** resolved as designed, documented here for future reference.

`dashboardController.js`'s `earnedInterestAsOf()` computes interest genuinely earned as of a
date by taking `max(sum of Accrual-transaction interestPortion, sum of Repayment-transaction
interestPortion)` from each loan's own transaction history. This was built after finding that
a pure time-elapsed accrual figure (whether from the repayment schedule's per-period
`totalAccruedInterest`, or Fineract's own daily "Accrual" COB-job transactions - both were
checked; the daily COB job is confirmed running correctly on this deployment, not broken)
could read *lower* than `summary.interestPaid` on real loans. Root cause: a customer who
pays ahead of schedule (confirmed on real loans here - e.g. paying far more than the
contractual monthly installment) has genuinely already paid interest tied to installment
periods whose calendar due date hasn't arrived yet. A pure time-elapsed model has no way to
represent "this obligation was already settled early" - it only measures how much calendar
time has passed. Once collected, that interest is unambiguously earned regardless of the
calendar, so the `max()` floor is the correct fix, not an approximation being tolerated.

**What a more complete model would need, if this ever matters again:** the `max()` floor
means a loan that is *ahead* of schedule reports paid-to-date as its income figure (accrual
hasn't caught up), while a loan *behind* schedule correctly reports its calendar accrual
(nothing paid yet to floor against). This is the right answer for "how much have we earned
so far", but it does mean the figure isn't a pure day-count accrual series - a downstream
consumer wanting genuine day-by-day accrual-only figures (e.g. for a real accrual-basis P&L
close, distinct from a cash/collections view) would need the two components
(`accrual`/`paid`) reported separately rather than pre-maxed, so they can choose which one
they actually need instead of getting the blended figure this dashboard shows.

## DashboardDetail.js's interest-income caption needs a follow-up update (frontend, out of scope for this backend-only fix)

**Status:** open, tracked here as of 2026-09-12.

The interest-income detail page (`DashboardDetail.js`) currently shows a caption stating the
list is "lifetime accrued interest ... not scoped to the date range below". That caption was
accurate when written, but this backend change makes `GET /dashboard/detail/interest-income`
genuinely respect `from`/`to` now (via `earnedInterestInRange`), so the caption is now
**incorrect** - it should either be removed (letting the normal date-range caption show,
since the list is now truly range-scoped like every other metric) or updated to reflect the
new, real scoping behavior. Not fixed here since this fix was confined to
`/opt/ess2/backend` only.
