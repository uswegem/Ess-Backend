const AuditLog = require('../../models/AuditLog');
const { logSecurityEvent } = require('../../utils/securityEventLogger');

describe('AuditLog security events', () => {
  it('persists security_event records', async () => {
    await logSecurityEvent({
      eventType: 'invalid_jwt',
      description: 'Test invalid JWT',
      tenantId: 'tenant-a',
      metadata: { test: true }
    });

    const record = await AuditLog.findOne({ action: 'security_event' });
    expect(record).toBeTruthy();
    expect(record.status).toBe('failed');
    expect(record.metadata.eventType).toBe('invalid_jwt');
  });
});
