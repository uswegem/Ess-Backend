// Column headers per Dashboard detail metric, for the server-rendered PDF export
// (pdfGeneratorService.js's generateTablePdf via dashboardController.js's exportPdf route).
// Field names and their order must match DashboardDetail.js's METRIC_CONFIG on the frontend -
// that's the source of truth for the on-screen table; this is a deliberate, lightweight mirror
// of just the header labels, since PDF generation happens server-side and can't reach into the
// frontend's column config directly. Row shapes come from dashboardDetailService.js.

const BUCKET_LABELS = {
  current: 'Current', days_1_30: '1-30 Days', days_31_60: '31-60 Days',
  days_61_90: '61-90 Days', days_90_plus: '90+ Days',
};

// Mirrors DashboardDetail.js's delinquencyBucketConfig() column set exactly - see that
// file's comment for the field sourcing (Fineract loan summary + GET /v1/clients + per-loan
// GET /v1/loans/{id} for lastRepaymentDate; no Mongo join).
const DELINQUENCY_COLUMNS = [
  { field: 'loanAccountNo', headerName: 'Loan Account' },
  { field: 'clientName', headerName: 'Client' },
  { field: 'clientExternalId', headerName: 'NIN' },
  { field: 'mobileNo', headerName: 'Mobile' },
  { field: 'emailAddress', headerName: 'Email' },
  { field: 'principalDisbursed', headerName: 'Principal Disbursed' },
  { field: 'interestCharged', headerName: 'Interest Booked' },
  { field: 'penaltyChargesCharged', headerName: 'Penalty Booked' },
  { field: 'principalPaid', headerName: 'Principal Collected' },
  { field: 'interestPaid', headerName: 'Interest Collected' },
  { field: 'penaltyChargesPaid', headerName: 'Penalty Collected' },
  { field: 'totalCollected', headerName: 'Total Collected' },
  { field: 'principalOutstanding', headerName: 'Principal Outstanding' },
  { field: 'interestOutstanding', headerName: 'Interest Outstanding' },
  { field: 'penaltyChargesOutstanding', headerName: 'Penalty Outstanding' },
  { field: 'totalOutstanding', headerName: 'Total Outstanding' },
  { field: 'pastDueDays', headerName: 'Days Overdue' },
  { field: 'disbursementDate', headerName: 'Disbursement Date' },
  { field: 'lastRepaymentDate', headerName: 'Last Repayment Date' },
];

const METRIC_COLUMNS = {
  portfolio: [
    { field: 'loanAccountNo', headerName: 'Loan Account' },
    { field: 'clientName', headerName: 'Client' },
    { field: 'clientExternalId', headerName: 'NIN' },
    { field: 'principal', headerName: 'Principal' },
    { field: 'principalOutstanding', headerName: 'Outstanding' },
    { field: 'status', headerName: 'Status' },
  ],
  par30: [
    { field: 'loanAccountNo', headerName: 'Loan Account' },
    { field: 'clientName', headerName: 'Client' },
    { field: 'clientExternalId', headerName: 'NIN' },
    { field: 'principalOutstanding', headerName: 'Outstanding' },
    { field: 'pastDueDays', headerName: 'Days Overdue' },
    { field: 'delinquencyBucket', headerName: 'Bucket' },
  ],
  disbursed: [
    { field: 'loanAccountNo', headerName: 'Loan Account' },
    { field: 'clientName', headerName: 'Client' },
    { field: 'clientExternalId', headerName: 'NIN' },
    { field: 'principal', headerName: 'Principal' },
    { field: 'disbursementDate', headerName: 'Disbursement Date' },
  ],
  borrowers: [
    { field: 'clientName', headerName: 'Client' },
    { field: 'clientExternalId', headerName: 'NIN' },
    { field: 'loanCount', headerName: 'Active Loans' },
    { field: 'totalOutstanding', headerName: 'Total Outstanding' },
  ],
  'collection-rate': [
    { field: 'loanAccountNo', headerName: 'Loan Account' },
    { field: 'clientName', headerName: 'Client' },
    { field: 'clientExternalId', headerName: 'NIN' },
    { field: 'totalRepayment', headerName: 'Repaid' },
    { field: 'totalExpectedRepayment', headerName: 'Expected' },
    { field: 'ratePercent', headerName: 'Rate %' },
  ],
  'interest-income': [
    { field: 'date', headerName: 'Date' },
    { field: 'loanAccountNo', headerName: 'Loan Account' },
    { field: 'clientName', headerName: 'Client' },
    { field: 'amount', headerName: 'Amount' },
  ],
  'fee-income': [
    { field: 'date', headerName: 'Date' },
    { field: 'loanAccountNo', headerName: 'Loan Account' },
    { field: 'clientName', headerName: 'Client' },
    { field: 'amount', headerName: 'Amount' },
  ],
};

const METRIC_TITLES = {
  portfolio: 'Total Outstanding Portfolio',
  par30: 'PAR30',
  disbursed: 'Loans Disbursed',
  borrowers: 'Active Borrowers',
  'collection-rate': 'Collection Rate',
  'interest-income': 'Interest Income',
  'fee-income': 'Fee Income',
};

function getMetricColumns(metric) {
  if (metric.startsWith('delinquency-')) return DELINQUENCY_COLUMNS;
  return METRIC_COLUMNS[metric] || [];
}

function getMetricTitle(metric) {
  if (metric.startsWith('delinquency-')) {
    const bucketKey = metric.slice('delinquency-'.length);
    return `Delinquency Bucket - ${BUCKET_LABELS[bucketKey] || bucketKey}`;
  }
  return METRIC_TITLES[metric] || metric;
}

// par30's `delinquencyBucket` field carries the raw bucket key (e.g. "days_31_60") - fine for
// the DataGrid's own valueFormatter on the frontend, but the PDF renderer has no such
// per-column formatting hook, so rows need the friendly label substituted before printing.
function formatRowsForPdf(metric, rows) {
  if (metric !== 'par30') return rows;
  return rows.map((r) => ({ ...r, delinquencyBucket: BUCKET_LABELS[r.delinquencyBucket] || r.delinquencyBucket }));
}

module.exports = { getMetricColumns, getMetricTitle, formatRowsForPdf };
