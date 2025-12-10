import { SecurityLogger, SecurityEvent } from '../../../src/security/SecurityLogger';

describe('SecurityLogger', () => {
  let securityLogger: SecurityLogger;

  beforeEach(() => {
    securityLogger = new SecurityLogger();
  });

  describe('Logging', () => {
    it('should log security violation', () => {
      const event: SecurityEvent = {
        type: 'test_violation',
        severity: 'warning',
        details: { foo: 'bar' }
      };

      const spy = jest.fn();
      securityLogger.on('security:violation', spy);
      securityLogger.on('security:warning', spy);

      securityLogger.logViolation(event);

      expect(spy).toHaveBeenCalledTimes(2);
      expect(securityLogger.getEvents()).toHaveLength(1);
      expect(securityLogger.getEvents()[0]).toMatchObject(event);
    });

    it('should log module access', () => {
      securityLogger.logModuleAccess('fs', false);

      const events = securityLogger.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('unauthorized_require');
      expect(events[0].severity).toBe('warning');
      expect(events[0].details).toEqual({ module: 'fs', allowed: false });
    });

    it('should log file access', () => {
      securityLogger.logFileAccess('/tmp/file', 'read');

      const events = securityLogger.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('file_access');
      expect(events[0].severity).toBe('info');
    });

    it('should log timeout', () => {
      securityLogger.logTimeout('code', 1000);

      const events = securityLogger.getEvents();
      expect(events[0].type).toBe('timeout');
      expect(events[0].severity).toBe('warning');
    });

    it('should log quota exceeded', () => {
      securityLogger.logQuotaExceeded('memory', 200, 100);

      const events = securityLogger.getEvents();
      expect(events[0].type).toBe('quota_exceeded');
      expect(events[0].severity).toBe('error');
    });

    it('should log suspicious code', () => {
      securityLogger.logSuspiciousCode('eval()', 'eval usage');

      const events = securityLogger.getEvents();
      expect(events[0].type).toBe('suspicious_code');
      expect(events[0].severity).toBe('warning');
    });
  });

  describe('Filtering and Stats', () => {
    beforeEach(() => {
      securityLogger.logModuleAccess('fs', false); // warning
      securityLogger.logFileAccess('/etc/passwd', 'read', false); // warning
      securityLogger.logFileAccess('/tmp/file', 'read', true); // info
    });

    it('should filter events', () => {
      expect(securityLogger.getEvents({ severity: 'warning' })).toHaveLength(2);
      expect(securityLogger.getEvents({ type: 'file_access' })).toHaveLength(2);
    });

    it('should get stats', () => {
      const stats = securityLogger.getStats();
      expect(stats['unauthorized_require:warning']).toBe(1);
      expect(stats['file_access:warning']).toBe(1);
      expect(stats['file_access:info']).toBe(1);
    });

    it('should get events by type', () => {
      expect(securityLogger.getEventsByType('file_access')).toHaveLength(2);
    });

    it('should get events by severity', () => {
      expect(securityLogger.getEventsBySeverity('warning')).toHaveLength(2);
    });

    it('should check thresholds', () => {
      expect(securityLogger.hasExceededThreshold('file_access', 1)).toBe(true);
      expect(securityLogger.hasExceededThreshold('file_access', 5)).toBe(false);
    });
  });

  describe('Management', () => {
    it('should clear events', () => {
      securityLogger.logModuleAccess('fs', false);
      expect(securityLogger.getEvents()).toHaveLength(1);

      securityLogger.clear();
      expect(securityLogger.getEvents()).toHaveLength(0);
    });

    it('should limit event history', () => {
      for (let i = 0; i < 1100; i++) {
        securityLogger.logViolation({
          type: 'test',
          severity: 'info',
          details: {}
        });
      }

      expect(securityLogger.getEvents()).toHaveLength(1000);
    });
  });
});
