# SECURITY.md - IsoBox Security Guide

## Overview

IsoBox is a production-grade JavaScript/TypeScript sandbox library that provides isolated code execution with strict security controls. This document outlines the security architecture, threat model, and best practices.

## Threat Model

IsoBox protects against the following threat categories:

### 1. **Code Injection Attacks**
- **Protection**: V8 Isolate provides complete memory isolation
- **Implementation**: Each execution runs in a separate V8 context
- **Coverage**: Prevents cross-execution data leaks

### 2. **Resource Exhaustion Attacks**
- **Protection**: Strict timeout enforcement (kills infinite loops)
- **Implementation**: TimeoutManager with proper cleanup
- **Limits**: Configurable CPU time, memory, and iterations
- **Coverage**: Prevents DoS via computational overload

### 3. **Filesystem Access Attacks**
- **Protection**: Virtual in-memory filesystem (MemFS)
- **Implementation**: No access to host filesystem
- **Whitelist**: File paths validated against whitelist
- **Coverage**: Prevents unauthorized file read/write

### 4. **Module Loading Attacks**
- **Protection**: Module whitelist with wildcard support
- **Implementation**: All require/import statements validated
- **Mocking**: Can mock sensitive modules
- **Coverage**: Prevents loading of dangerous packages

### 5. **Global Scope Pollution**
- **Protection**: Safe globals whitelist
- **Implementation**: Only approved globals injected
- **Dangerous Filtered**: `process`, `require`, `__dirname`, `eval`, etc.
- **Coverage**: Prevents escape via global access

### 6. **Process Escalation**
- **Protection**: No access to host process
- **Implementation**: Process object not available
- **Isolation**: Child processes cannot be spawned
- **Coverage**: Prevents privilege escalation

### 7. **Network Access Attacks**
- **Protection**: No network APIs available
- **Implementation**: HTTP, DNS, sockets not exposed
- **Whitelist Control**: Can optionally expose fetch if needed
- **Coverage**: Prevents data exfiltration

### 8. **Session Hijacking**
- **Protection**: Session isolation with TTL
- **Implementation**: SessionManager with timeout
- **State Encryption**: Optional encryption for sensitive state
- **Coverage**: Prevents unauthorized session access

## Security Features

### Strict Type Checking
```typescript
// TypeScript strict mode enabled
// - No implicit any
// - Null/undefined checking
// - Full type coverage
```

### Input Validation
- **Code**: Syntax validation via Function constructor
- **Modules**: Pattern matching for whitelisting
- **Paths**: Directory traversal prevention
- **Inputs**: XSS prevention in console output

### Error Sanitization
```typescript
// Errors are sanitized to prevent information leakage
const message = error.message
  .replace(/\/.*\//g, '[PATH]')      // Hide file paths
  .replace(/at .*:/g, 'at [LOC]:')   // Hide locations
  .replace(/Object\.<anonymous>/g, '[ANON]');
```

### Security Logging
```typescript
// All security events logged
isobox.on('security:violation', (event) => {
  // event.type: 'module_access', 'timeout', 'quota_exceeded', etc
  // event.severity: 'info', 'warn', 'error', 'critical'
  // event.timestamp: ISO string
  // event.context: additional data
});
```

### Metrics & Monitoring
```typescript
// Track security events over time
const violations = isobox.getSecurityViolations({
  type: 'module_access',
  minSeverity: 'warn',
  since: new Date(Date.now() - 3600000) // last hour
});
```

## Known Limitations

### 1. **Side-Channel Attacks**
- Timing attacks possible (not mitigated)
- Memory access patterns observable
- Solution: Use for non-cryptographic operations

### 2. **Spectre/Meltdown Variants**
- Hardware vulnerabilities not mitigated
- Requires OS-level protections
- Solution: Run on patched systems

### 3. **Denial of Service via Allocations**
- Memory limits enforced but can be circumvented with object cycling
- Solution: Use memory quota + monitoring

### 4. **Async Escape Attempts**
- setImmediate/setInterval not fully blocked
- Solution: Timeout applies to full execution

### 5. **Worker Threads**
- Not available in sandbox
- Safe by design

### 6. **Child Processes**
- Cannot spawn (child_process not available)
- Safe by design

### 7. **Native Modules**
- Cannot load native addons
- Safe by design

### 8. **Buffer Overflows**
- V8 provides protection
- Safe by design

## Best Practices

### 1. **Validate All Inputs**
```typescript
// Always validate before passing to sandbox
const code = sanitizeInput(userCode);
const validated = Validators.validateCode(code);

if (!validated.valid) {
  throw new Error(`Invalid code: ${validated.errors.join(', ')}`);
}
```

### 2. **Use Module Whitelisting**
```typescript
// Explicitly whitelist required modules
const isobox = new IsoBox({
  require: {
    whitelist: [
      'lodash',
      'moment',
      '@scope/*',  // Wildcard support
      'safe-*'    // Pattern support
    ]
  }
});
```

### 3. **Set Strict Timeouts**
```typescript
// Always set reasonable timeouts
const result = await isobox.run(code, {
  timeout: 5000,  // 5 seconds
  filename: 'user-code.js'
});
```

### 4. **Monitor Security Events**
```typescript
// Log all security violations
isobox.on('security:violation', (event) => {
  logger.warn(`Security: ${event.type}`, {
    severity: event.severity,
    timestamp: event.timestamp,
    context: event.context
  });
});
```

### 5. **Isolate User Code**
```typescript
// Each user gets isolated session
const session = isobox.createSession(`user-${userId}`);
session.setState({ username: 'alice' });
const result = await session.run(userCode);
```

### 6. **Limit Memory Usage**
```typescript
// Set memory quotas
const isobox = new IsoBox({
  execution: {
    memory: {
      max: 128 * 1024 * 1024 // 128MB
    }
  }
});
```

### 7. **Use Sessions for Persistence**
```typescript
// Sessions provide isolated state
const session = isobox.createSession('workflow-1', { ttl: 3600000 });
await session.run('let counter = 0');
await session.run('counter++'); // counter is preserved
const state = session.getState(); // Access state
```

### 8. **Enable Metrics**
```typescript
// Track execution metrics for anomalies
isobox.on('metrics:recorded', (metrics) => {
  if (metrics.duration > 10000) {
    logger.warn('Slow execution detected', metrics);
  }
});
```

## Deployment Security Checklist

- [ ] Enable security logging to persistent storage
- [ ] Monitor security events in real-time
- [ ] Set appropriate memory and timeout limits
- [ ] Use module whitelist (not blacklist)
- [ ] Validate all user inputs before execution
- [ ] Run with least privilege (separate user account)
- [ ] Keep Node.js and dependencies updated
- [ ] Use HTTPS for external communication
- [ ] Implement rate limiting on execution
- [ ] Regular security audits of whitelisted modules
- [ ] Backup security event logs
- [ ] Alert on critical security violations

## Vulnerability Reporting

If you discover a security vulnerability, **please do not open a public issue**. Instead:

1. **Email**: security@isobox.dev (create this before production)
2. **Include**: 
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if available)

3. **Timeline**:
   - We acknowledge within 48 hours
   - We provide timeline for fix
   - We coordinate disclosure date

## Compliance

IsoBox follows security best practices from:
- **OWASP**: Top 10 Web Application Security Risks
- **CWE**: Common Weakness Enumeration
- **NIST**: Cybersecurity Framework

## Security Updates

Security fixes are released as patch versions (X.Y.Z). Subscribe to release notifications to stay informed.

## FAQ

**Q: Can user code access the host filesystem?**
A: No. Only virtual in-memory filesystem (MemFS) is available.

**Q: Can user code escape the sandbox?**
A: Extremely unlikely. V8 Isolate provides strong isolation. Requires V8 or Node.js vulnerability.

**Q: Can user code kill the main process?**
A: No. Each execution is isolated and can be terminated independently.

**Q: Is user code completely isolated from other users?**
A: Yes. Each execution gets its own V8 context and memory space.

**Q: What about timing side-channels?**
A: Not mitigated. Don't use for cryptographic operations.

**Q: Can I trust this in production?**
A: Yes, with proper configuration and monitoring. See Best Practices above.

---

**Last Updated**: December 2025
**Version**: 1.0.0
