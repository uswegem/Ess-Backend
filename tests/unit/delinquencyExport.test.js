jest.mock('../../src/services/cbs.api', () => ({ maker: { get: jest.fn() } }));

const { maker: cbsApi } = require('../../src/services/cbs.api');
const DashboardController = require('../../src/controllers/dashboardController');

const TOTAL = 450;
const loans = Array.from({ length: TOTAL }, (_, i) => ({ id: i + 1, accountNo: `A${i + 1}`, status: { value: 'Active' }, summary: {} }));

const detail = async (query) => {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await DashboardController.detail({
    params: { metric: 'delinquency-current' }, query,
    tenant: { tenantId: 'legacy-zedone' }, user: { role: 'super_admin' }, authContext: { isSuperAdmin: true }
  }, res);
  return res.json.mock.calls[0][0].data;
};

describe('delinquency detail rows', () => {
  beforeEach(() => {
    cbsApi.get.mockImplementation(async (url) => (url === '/v1/loans'
      ? { data: { pageItems: loans } }
      : { data: loans[Number(url.match(/loans\/(\d+)/)[1]) - 1] }));
  });

  test('all=true returns the whole bucket', async () => {
    const data = await detail({ all: 'true' });
    expect(data.rows).toHaveLength(TOTAL);
    expect(data.pagination).toEqual({ page: 1, limit: TOTAL, total: TOTAL, pages: 1 });
  });

  test('ordinary paging is still capped at 200', async () => {
    const data = await detail({ limit: '10000' });
    expect(data.rows).toHaveLength(200);
    expect(data.pagination).toMatchObject({ total: TOTAL, pages: 3 });
  });
});
