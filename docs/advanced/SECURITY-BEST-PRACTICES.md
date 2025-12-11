# Security Best Practices

Advanced security hardening for production IsoBox deployments.

## Table of Contents

- [Input Validation](#input-validation)
- [Resource Limits](#resource-limits)
- [Module Whitelisting](#module-whitelisting)
- [Defense in Depth](#defense-in-depth)
- [Monitoring and Alerting](#monitoring-and-alerting)
- [Incident Response](#incident-response)

## Input Validation

### Validate All Input

Never trust user input:

```typescript
function validateCode(code: string): string {
  // Check type
  if (typeof code !== 'string') {
    throw new SecurityError('Code must be a string');
  }

  // Check length
  if (code.length === 0) {
    throw new SecurityError('Code cannot be empty');
  }

  if (code.length > 100000) {  // 100KB limit
    throw new SecurityError('Code exceeds maximum length');
  }

  // Check for suspicious patterns
  const suspiciousPatterns = [
    /eval\s*\(/,
    /Function\s*\(/,
    /constructor\s*\(/,
    /__proto__/,
    /prototype\s*\[/
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(code)) {
      throw new SecurityError(`Suspicious pattern detected: ${pattern}`);
    }
  }

  return code.trim();
}
```

### Sanitize Context Variables

```typescript
function sanitizeContext(context: any): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(context)) {
    // Only allow primitives and plain objects
    if (value === null || value === undefined) {
      sanitized[key] = value;
    } else if (typeof value === 'function') {
      throw new SecurityError(`Functions not allowed in context: ${key}`);
    } else if (typeof value === 'object') {
      // Deep sanitization needed
      sanitized[key] = JSON.parse(JSON.stringify(value));
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
```

## Resource Limits

### Conservative Defaults

```typescript
const SECURITY_DEFAULTS = {
  // Execution limits
  timeout: 5000,              // 5 seconds
  cpuTimeLimit: 10000,        // 10 seconds
  memoryLimit: 128 * 1024 * 1024,  // 128MB
  strictTimeout: true,

  // Filesystem
  filesystem: {
    enabled: false,           // Disabled by default
    maxSize: 64 * 1024 * 1024  // 64MB if enabled
  },

  // Modules
  require: {
    mode: 'whitelist',
    whitelist: [],            // Empty by default
    allowBuiltins: false
  },

  // Security
  security: {
    logViolations: true,
    sanitizeErrors: true
  }
};

const box = new IsoBox(SECURITY_DEFAULTS);
```

### Per-User Limits

```typescript
const USER_TIERS = {
  free: {
    timeout: 3000,
    memoryLimit: 64 * 1024 * 1024,
    maxExecutionsPerHour: 100
  },
  pro: {
    timeout: 10000,
    memoryLimit: 256 * 1024 * 1024,
    maxExecutionsPerHour: 1000
  },
  enterprise: {
    timeout: 30000,
    memoryLimit: 512 * 1024 * 1024,
    maxExecutionsPerHour: 10000
  }
};

function createUserBox(userId: string, tier: string) {
  const limits = USER_TIERS[tier] || USER_TIERS.free;

  return new IsoBox({
    timeout: limits.timeout,
    memoryLimit: limits.memoryLimit,
    security: {
      logViolations: true,
      onSecurityEvent: (event) => {
        logSecurityEvent(userId, event);
      }
    }
  });
}
```

## Module Whitelisting

### Strict Whitelist

```typescript
const SAFE_MODULES = [
  // Utilities (no I/O)
  'lodash',
  'ramda',
  'date-fns',

  // Math/Crypto (pure functions)
  'mathjs',
  'crypto-js',

  // Data processing
  'jsonpath',
  'xml2js'
];

const box = new IsoBox({
  require: {
    mode: 'whitelist',
    whitelist: SAFE_MODULES,
    allowBuiltins: false  // No Node.js built-ins
  }
});
```

### Mock Dangerous Modules

```typescript
const box = new IsoBox({
  require: {
    mode: 'whitelist',
    whitelist: ['fs', 'axios'],
    mocks: {
      // Mock fs with safe in-memory version
      fs: {
        readFileSync: (path) => {
          if (!path.startsWith('/safe/')) {
            throw new Error('Access denied');
          }
          return box.fs.read(path);
        },
        writeFileSync: (path, data) => {
          if (!path.startsWith('/safe/')) {
            throw new Error('Access denied');
          }
          box.fs.write(path, Buffer.from(data));
        }
      },

      // Mock axios to prevent network access
      axios: {
        get: async (url) => {
          // Log attempt
          logNetworkAttempt(url);
          // Return cached data
          return { data: getCachedData(url) };
        }
      }
    }
  }
});
```

## Defense in Depth

### Layer 1: Network Security

```yaml
# nginx rate limiting
limit_req_zone $binary_remote_addr zone=execute:10m rate=10r/s;

server {
  location /api/execute {
    limit_req zone=execute burst=20 nodelay;
    proxy_pass http://backend;
  }
}
```

### Layer 2: Application Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';

const executeLimit = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,  // limit each IP to 100 requests per window
  message: 'Too many execution requests',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logRateLimitExceeded(req.ip);
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: res.getHeader('Retry-After')
    });
  }
});

app.post('/api/execute', executeLimit, executeHandler);
```

### Layer 3: Per-User Quotas

```typescript
const userQuotas = new Map<string, {
  count: number;
  resetAt: number;
}>();

async function checkQuota(userId: string, limit: number): Promise<boolean> {
  const now = Date.now();
  const hourStart = Math.floor(now / 3600000) * 3600000;

  let quota = userQuotas.get(userId);

  if (!quota || quota.resetAt !== hourStart) {
    quota = { count: 0, resetAt: hourStart };
    userQuotas.set(userId, quota);
  }

  if (quota.count >= limit) {
    return false;
  }

  quota.count++;
  return true;
}

app.post('/api/execute', async (req, res) => {
  const userId = req.user.id;
  const tier = req.user.tier;
  const limit = USER_TIERS[tier].maxExecutionsPerHour;

  if (!await checkQuota(userId, limit)) {
    return res.status(429).json({
      error: 'Quota exceeded',
      limit,
      resetAt: new Date(...)
    });
  }

  // Execute code
});
```

### Layer 4: Container Isolation

```dockerfile
FROM node:18-alpine

# Run as non-root user
RUN addgroup -g 1001 -S isobox && \\
    adduser -u 1001 -S isobox -G isobox

# Set working directory
WORKDIR /app

# Copy and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application
COPY --chown=isobox:isobox . .

# Switch to non-root user
USER isobox

# Run with limited capabilities
CMD ["node", "--max-old-space-size=512", "dist/index.js"]
```

```yaml
# docker-compose.yml
services:
  isobox:
    build: .
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE  # Only if needed
    read_only: true
    tmpfs:
      - /tmp
    mem_limit: 1g
    cpus: "0.5"
```

## Monitoring and Alerting

### Security Event Logging

```typescript
interface SecurityLog {
  timestamp: number;
  userId: string;
  sessionId?: string;
  eventType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: any;
  stackTrace?: string;
}

class SecurityLogger {
  private logs: SecurityLog[] = [];

  log(event: SecurityLog) {
    this.logs.push(event);

    // Send to logging service
    this.sendToSplunk(event);

    // Alert on critical events
    if (event.severity === 'critical') {
      this.alertSecurityTeam(event);
    }

    // Store in database
    this.persistToDb(event);
  }

  private alertSecurityTeam(event: SecurityLog) {
    // Send email, Slack, PagerDuty, etc.
  }
}

const securityLogger = new SecurityLogger();

const box = new IsoBox({
  security: {
    onSecurityEvent: (event) => {
      securityLogger.log({
        timestamp: Date.now(),
        userId: getCurrentUserId(),
        eventType: event.type,
        severity: event.severity,
        details: event.details
      });
    }
  }
});
```

### Metrics Monitoring

```typescript
// Prometheus metrics
import { register, Counter, Histogram, Gauge } from 'prom-client';

const executionCounter = new Counter({
  name: 'isobox_executions_total',
  help: 'Total number of code executions',
  labelNames: ['status', 'userId']
});

const executionDuration = new Histogram({
  name: 'isobox_execution_duration_seconds',
  help: 'Execution duration in seconds',
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

const activeIsolates = new Gauge({
  name: 'isobox_active_isolates',
  help: 'Number of active isolates'
});

box.on('execution', (event) => {
  if (event.type === 'complete') {
    executionCounter.inc({ status: 'success', userId: event.userId });
    executionDuration.observe(event.duration / 1000);
  } else if (event.type === 'error') {
    executionCounter.inc({ status: 'error', userId: event.userId });
  }
});

// Update active isolates
setInterval(() => {
  const stats = box.getPoolStats();
  if (stats) {
    activeIsolates.set(stats.active);
  }
}, 5000);

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
});
```

## Incident Response

### Detection

```typescript
class ThreatDetector {
  private suspiciousPatterns = new Map<string, number>();

  detectAnomalies(userId: string, code: string, metrics: any) {
    // Pattern 1: Repeated timeout attempts
    if (metrics.timedOut) {
      const count = (this.suspiciousPatterns.get(`timeout:${userId}`) || 0) + 1;
      this.suspiciousPatterns.set(`timeout:${userId}`, count);

      if (count > 5) {
        this.flagUser(userId, 'repeated-timeouts');
      }
    }

    // Pattern 2: Memory exhaustion attempts
    if (metrics.memoryExhausted) {
      const count = (this.suspiciousPatterns.get(`memory:${userId}`) || 0) + 1;
      this.suspiciousPatterns.set(`memory:${userId}`, count);

      if (count > 3) {
        this.flagUser(userId, 'memory-exhaustion');
      }
    }

    // Pattern 3: Suspicious code patterns
    if (this.hasSuspiciousPatterns(code)) {
      this.flagUser(userId, 'suspicious-code');
    }
  }

  private flagUser(userId: string, reason: string) {
    // Log incident
    incidentLogger.log({ userId, reason, timestamp: Date.now() });

    // Temporarily ban user
    userBans.set(userId, {
      until: Date.now() + 3600000,  // 1 hour
      reason
    });

    // Alert security team
    securityTeam.alert({ userId, reason });
  }
}
```

### Response Playbook

1. **Detect**: Automated monitoring identifies suspicious activity
2. **Contain**: Automatically ban user temporarily
3. **Investigate**: Review logs and code samples
4. **Respond**: Permanent ban or restore access
5. **Learn**: Update detection rules

## Security Checklist

- [ ] Input validation on all user code
- [ ] Conservative resource limits
- [ ] Strict module whitelisting
- [ ] No built-in modules unless necessary
- [ ] Error sanitization enabled
- [ ] Security logging enabled
- [ ] Rate limiting implemented
- [ ] Per-user quotas enforced
- [ ] Container isolation configured
- [ ] Monitoring and alerting set up
- [ ] Incident response plan documented
- [ ] Regular security audits scheduled
- [ ] Dependencies kept up-to-date
- [ ] Security patches applied promptly

## Further Reading

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Isolated-VM Documentation](https://github.com/laverdet/isolated-vm)
- [IsoBox Security Policy](../../SECURITY.md)

---

**Remember**: Security is a process, not a product. Stay vigilant and keep learning!
