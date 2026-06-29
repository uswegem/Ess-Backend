const {
  getUtumishiEndpoint,
  getCbsTimeoutMs,
  getApiTimeoutMs
} = require('../runtimeEnv');

describe('runtimeEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.UTUMISHI_ENDPOINT;
    delete process.env.THIRD_PARTY_BASE_URL;
    delete process.env.ESS_CALLBACK_URL;
    delete process.env.CBS_TIMEOUT_MS;
    delete process.env.CBS_TIMEOUT;
    delete process.env.API_TIMEOUT;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getUtumishiEndpoint', () => {
    it('prefers UTUMISHI_ENDPOINT', () => {
      process.env.UTUMISHI_ENDPOINT = 'https://utumishi.example/consume';
      process.env.THIRD_PARTY_BASE_URL = 'https://legacy.example/consume';
      expect(getUtumishiEndpoint()).toBe('https://utumishi.example/consume');
    });

    it('falls back to THIRD_PARTY_BASE_URL', () => {
      process.env.THIRD_PARTY_BASE_URL = 'https://legacy.example/consume';
      expect(getUtumishiEndpoint()).toBe('https://legacy.example/consume');
    });

    it('throws when required and unset', () => {
      expect(() => getUtumishiEndpoint({ required: true })).toThrow('UTUMISHI_ENDPOINT');
    });
  });

  describe('getCbsTimeoutMs', () => {
    it('uses CBS_TIMEOUT_MS when set', () => {
      process.env.CBS_TIMEOUT_MS = '45000';
      expect(getCbsTimeoutMs()).toBe(45000);
    });

    it('falls back to CBS_TIMEOUT', () => {
      process.env.CBS_TIMEOUT = '25000';
      expect(getCbsTimeoutMs()).toBe(25000);
    });

    it('defaults to 30000', () => {
      expect(getCbsTimeoutMs()).toBe(30000);
    });
  });

  describe('getApiTimeoutMs', () => {
    it('uses API_TIMEOUT when set', () => {
      process.env.API_TIMEOUT = '15000';
      expect(getApiTimeoutMs()).toBe(15000);
    });
  });
});
