const handleMifosWebhook = require('../src/controllers/handlers/mifosWebhookHandler');

describe('Mifos Webhook Handler', () => {
  test('should send success response', () => {
    const mockReq = {};
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn()
    };

    handleMifosWebhook(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.send).toHaveBeenCalled();
  });
});