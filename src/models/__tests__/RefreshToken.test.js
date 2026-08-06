const User = require('../User');
const RefreshToken = require('../RefreshToken');
const JWTUtils = require('../../utils/jwtUtils');

describe('RefreshToken model', () => {
  let user;

  beforeEach(async () => {
    user = await User.create({
      username: `refresh-${Date.now()}`,
      email: `refresh-${Date.now()}@test.com`,
      password: 'Password123!',
      fullName: 'Refresh User',
      role: 'user',
      isActive: true
    });
  });

  afterEach(async () => {
    await RefreshToken.deleteMany({});
    await User.deleteMany({});
  });

  it('creates and finds refresh token by raw value', async () => {
    const { rawToken } = await RefreshToken.createForUser({
      userId: user._id,
      expiresAt: JWTUtils.getRefreshExpiresAt()
    });

    const found = await RefreshToken.findByRawToken(rawToken);
    expect(found.userId.toString()).toBe(user._id.toString());
    expect(found.isUsable()).toBe(true);
  });

  it('revokes token on rotation flow', async () => {
    const first = await RefreshToken.createForUser({
      userId: user._id,
      expiresAt: JWTUtils.getRefreshExpiresAt()
    });

    const second = await RefreshToken.createForUser({
      userId: user._id,
      expiresAt: JWTUtils.getRefreshExpiresAt()
    });

    await first.record.revoke(second.record.tokenHash);
    expect(first.record.isUsable()).toBe(false);
  });
});
