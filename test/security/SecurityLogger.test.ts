import { SecurityLogger } from '../../src/security/SecurityLogger';

describe('SecurityLogger', () => {
  let logger: SecurityLogger;
  let spy: jest.Mock;

  beforeEach(() => {
    logger = new SecurityLogger();
    spy = jest.fn();
    logger.on('security:violation', spy);
  });

  it('should log security events', () => {
    // There is no `warn` method on `SecurityLogger`, it uses `logViolation` or helpers
    // The previous test assumed `warn` existed.
    logger.logViolation({
        type: 'access_violation',
        severity: 'warning',
        details: { message: 'Attempted to access /etc/passwd' }
    });
    expect(spy).toHaveBeenCalled();
  });
});
