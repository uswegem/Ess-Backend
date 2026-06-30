const { buildEssLoanSummary } = require('../essLoanSummary');

describe('buildEssLoanSummary', () => {
  it('aggregates internal statuses into ESS buckets', () => {
    const summary = buildEssLoanSummary([
      { _id: 'INITIAL_OFFER', count: 2 },
      { _id: 'APPROVED', count: 3 },
      { _id: 'DISBURSED', count: 5 },
      { _id: 'CANCELLED', count: 1 },
      { _id: 'REJECTED', count: 2 },
      { _id: 'COMPLETED', count: 4 },
    ]);

    const byKey = Object.fromEntries(summary.map((item) => [item.key, item.count]));
    expect(byKey.pendingEmployerApproval).toBe(2);
    expect(byKey.pendingFspApproval).toBe(3);
    expect(byKey.activeLoans).toBe(5);
    expect(byKey.cancelled).toBe(1);
    expect(byKey.rejected).toBe(2);
    expect(byKey.closedFullyRepaid).toBe(4);
    expect(summary).toHaveLength(6);
  });
});
