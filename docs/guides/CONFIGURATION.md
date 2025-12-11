# Configuration Guide

Complete reference for all IsoBox configuration options.

## Table of Contents

- [Core Configuration](#core-configuration)
- [Timeout Settings](#timeout-settings)
- [Memory Limits](#memory-limits)
- [Filesystem Configuration](#filesystem-configuration)
- [Module System](#module-system)
- [TypeScript Support](#typescript-support)
- [Security Options](#security-options)
- [Performance Tuning](#performance-tuning)
- [Metrics Collection](#metrics-collection)
- [Session Management](#session-management)

## Core Configuration

### IsoBoxOptions Interface

```typescript
interface IsoBoxOptions {
  // Execution limits
  timeout?: number;
  cpuTimeLimit?: number;
  memoryLimit?: number;
  strictTimeout?: boolean;

  // Performance
  usePooling?: boolean;
  pool?: PoolOptions;

  // Features
  sandbox?: Record<string, any>;
  console?: ConsoleOptions;
  require?: RequireOptions;
  filesystem?: FilesystemOptions;
  typescript?: TypeScriptOptions;
  security?: SecurityOptions;
  metrics?: MetricsOptions;

  // Sessions
  sessionCleanupInterval?: number;
}
```

### Default Values

```typescript
const defaults = {
  timeout: 5000,                      // 5 seconds
  cpuTimeLimit: 10000,                // 10 seconds
  memoryLimit: 128 * 1024 * 1024,     // 128MB
  strictTimeout: true,
  usePooling: false,
  sessionCleanupInterval: 60000       // 1 minute
};
```

## Timeout Settings

### timeout

Maximum wall-clock time for execution.

```typescript
const box = new IsoBox({
  timeout: 10000  // 10 seconds
});
```

**Use cases:**
- Short scripts: 1000-5000ms
- Data processing: 10000-30000ms
- Complex calculations: 30000-60000ms

### cpuTimeLimit

Maximum CPU time (excludes I/O wait time).

```typescript
const box = new IsoBox({
  cpuTimeLimit: 15000  // 15 seconds CPU time
});
```

**Why separate from timeout:**
- CPU time excludes async operations
- Prevents CPU-intensive loops
- More accurate resource measurement

### strictTimeout

Enforce immediate termination on timeout.

```typescript
const box = new IsoBox({
  strictTimeout: true  // Default
});
```

**Options:**
- `true`: Immediate termination (recommended)
- `false`: Graceful shutdown attempt

**When to disable:**
- When cleanup is critical
- When using external resources
- Development/debugging

## Memory Limits

### memoryLimit

Maximum heap memory in bytes.

```typescript
const box = new IsoBox({
  memoryLimit: 256 * 1024 * 1024  // 256MB
});
```

**Recommended limits:**
- Light scripts: 64MB
- Standard usage: 128MB
- Data processing: 256-512MB
- Heavy computation: 512MB-1GB

### Memory Considerations

```typescript
// Calculate based on data size
const dataSize = Buffer.byteLength(JSON.stringify(data));
const memoryLimit = dataSize * 5;  // 5x buffer

const box = new IsoBox({ memoryLimit });
```

## Filesystem Configuration

### Basic Filesystem

```typescript
const box = new IsoBox({
  filesystem: {
    enabled: true,
    maxSize: 64 * 1024 * 1024,  // 64MB
    root: '/'
  }
});
```

### FilesystemOptions Interface

```typescript
interface FilesystemOptions {
  /** Enable filesystem access */
  enabled: boolean;

  /** Maximum total filesystem size in bytes */
  maxSize: number;

  /** Root directory (default: '/') */
  root?: string;
}
```

### Disable Filesystem

```typescript
const box = new IsoBox({
  filesystem: {
    enabled: false  // No filesystem access
  }
});
```

### Size Recommendations

```typescript
const configs = {
  minimal: { maxSize: 16 * 1024 * 1024 },    // 16MB
  standard: { maxSize: 64 * 1024 * 1024 },   // 64MB
  large: { maxSize: 256 * 1024 * 1024 },     // 256MB
  huge: { maxSize: 1024 * 1024 * 1024 }      // 1GB
};
```

## Module System

### Whitelist Mode

Most secure - only allow specific modules:

```typescript
const box = new IsoBox({
  require: {
    mode: 'whitelist',
    whitelist: ['lodash', 'date-fns', 'ramda'],
    allowBuiltins: false
  }
});
```

### Strict Mode

Block dangerous modules:

```typescript
const box = new IsoBox({
  require: {
    mode: 'strict',
    blacklist: ['fs', 'child_process', 'net', 'http']
  }
});
```

### Permissive Mode

Allow all modules (not recommended):

```typescript
const box = new IsoBox({
  require: {
    mode: 'permissive'  // ⚠️ Use with caution
  }
});
```

### Module Mocks

Provide mock implementations:

```typescript
const box = new IsoBox({
  require: {
    mode: 'whitelist',
    whitelist: ['axios', 'database'],
    mocks: {
      axios: {
        get: async (url) => ({ data: mockData }),
        post: async (url, data) => ({ status: 200 })
      },
      database: {
        query: async (sql) => mockQueryResult
      }
    }
  }
});
```

### Built-in Modules

```typescript
const box = new IsoBox({
  require: {
    mode: 'whitelist',
    whitelist: ['path', 'url', 'querystring'],
    allowBuiltins: true  // Enable Node.js built-ins
  }
});
```

## TypeScript Support

### Enable TypeScript

```typescript
const box = new IsoBox({
  typescript: {
    enabled: true,
    typeCheck: false,      // Skip type checking for speed
    strict: false,
    target: 'ES2022'
  }
});
```

### TypeScriptOptions Interface

```typescript
interface TypeScriptOptions {
  /** Enable TypeScript transpilation */
  enabled: boolean;

  /** Enable type checking before execution */
  typeCheck: boolean;

  /** Use strict mode for TypeScript */
  strict: boolean;

  /** Target ECMAScript version */
  target: 'ES2020' | 'ES2021' | 'ES2022' | 'ES2023';
}
```

### Type Checking

```typescript
const box = new IsoBox({
  typescript: {
    enabled: true,
    typeCheck: true,  // Enable type checking
    strict: true      // Strict TypeScript
  }
});

// This will fail type checking
try {
  await box.run(`
    const x: number = "string";  // Type error
  `, { language: 'typescript' });
} catch (error) {
  console.log('Type error:', error.message);
}
```

### Target Version

```typescript
const configs = {
  modern: { target: 'ES2023' },      // Latest features
  compatible: { target: 'ES2020' },  // Broader compatibility
  legacy: { target: 'ES2015' }       // Maximum compatibility
};
```

## Security Options

### Security Configuration

```typescript
const box = new IsoBox({
  security: {
    logViolations: true,
    sanitizeErrors: true,
    onSecurityEvent: (event) => {
      console.log('Security event:', event);
    }
  }
});
```

### SecurityOptions Interface

```typescript
interface SecurityOptions {
  /** Log security violations */
  logViolations: boolean;

  /** Sanitize error messages to prevent information leakage */
  sanitizeErrors: boolean;

  /** Callback for security events */
  onSecurityEvent?: (event: SecurityEvent) => void;
}
```

### Security Event Handler

```typescript
const box = new IsoBox({
  security: {
    logViolations: true,
    onSecurityEvent: (event) => {
      if (event.severity === 'critical') {
        // Alert security team
        alertSecurityTeam(event);
      }

      // Log to security database
      logSecurityEvent({
        type: event.type,
        severity: event.severity,
        details: event.details,
        timestamp: event.timestamp
      });
    }
  }
});
```

## Performance Tuning

### Isolate Pooling

Pre-create isolates for better performance:

```typescript
const box = new IsoBox({
  usePooling: true,
  pool: {
    min: 2,              // Minimum pooled isolates
    max: 10,             // Maximum pooled isolates
    idleTimeout: 30000,  // Remove idle isolates after 30s
    warmupCode: 'const _ = require("lodash")'  // Pre-load modules
  }
});
```

### PoolOptions Interface

```typescript
interface PoolOptions {
  /** Minimum number of pooled isolates */
  min?: number;

  /** Maximum number of pooled isolates */
  max?: number;

  /** Idle timeout before removing excess isolates (ms) */
  idleTimeout?: number;

  /** Code to run on isolate creation for warmup */
  warmupCode?: string;
}
```

### Pool Warmup

```typescript
const box = new IsoBox({
  usePooling: true,
  pool: { min: 5, max: 20 }
});

// Pre-create isolates
await box.warmupPool(`
  const _ = require('lodash');
  const dayjs = require('dayjs');
  // Load commonly used modules
`);

// Now executions are faster
const result = await box.run('_.chunk([1,2,3,4], 2)');
```

### When to Use Pooling

**Use pooling when:**
- High request volume (>100/sec)
- Consistent workload
- Startup time is critical
- Same modules used frequently

**Don't use pooling when:**
- Low request volume
- Sporadic usage
- Memory constrained
- Different modules each time

## Metrics Collection

### Enable Metrics

```typescript
const box = new IsoBox({
  metrics: {
    enabled: true,
    collectCpu: true,
    collectMemory: true,
    maxHistory: 1000
  }
});
```

### MetricsOptions Interface

```typescript
interface MetricsOptions {
  /** Enable metrics collection */
  enabled: boolean;

  /** Collect CPU time metrics */
  collectCpu: boolean;

  /** Collect memory usage metrics */
  collectMemory: boolean;

  /** Maximum metrics history size */
  maxHistory?: number;
}
```

### Reading Metrics

```typescript
// Global metrics
const metrics = box.getMetrics();
console.log({
  totalExecutions: metrics.totalExecutions,
  errorCount: metrics.errorCount,
  avgTime: metrics.avgTime,
  memoryUsed: metrics.memoryUsed,
  cpuTimeUsed: metrics.cpuTimeUsed
});

// Pool metrics
if (box.getPoolStats()) {
  const poolStats = box.getPoolStats();
  console.log({
    active: poolStats.active,
    idle: poolStats.idle,
    totalExecutions: poolStats.totalExecutions
  });
}
```

## Session Management

### Session Configuration

```typescript
const box = new IsoBox({
  sessionCleanupInterval: 30000  // Clean expired sessions every 30s
});

// Create session
await box.createSession('user-123', {
  ttl: 3600000,        // 1 hour lifetime
  maxExecutions: 100,  // Max 100 executions
  persistent: true     // Persist state
});
```

### SessionOptions Interface

```typescript
interface SessionOptions {
  /** Session time-to-live in milliseconds */
  ttl?: number;

  /** Maximum number of executions allowed */
  maxExecutions?: number;

  /** Whether to persist state between executions */
  persistent?: boolean;
}
```

### Session Lifecycle

```typescript
// Create
const session = await box.createSession('session-1', {
  ttl: 1800000,  // 30 minutes
  maxExecutions: 50
});

// Use
await session.run('let counter = 0');
await session.run('counter++');

// Check
const sessions = box.listSessions();
console.log(sessions); // [{ id: 'session-1', ... }]

// Delete
await box.deleteSession('session-1');
```

## Console Configuration

### Console Options

```typescript
const box = new IsoBox({
  console: {
    mode: 'redirect',
    maxMessages: 100,
    onOutput: (level, args) => {
      console.log(`[${level}]`, ...args);
    }
  }
});
```

### ConsoleOptions Interface

```typescript
interface ConsoleOptions {
  /** Output mode: inherit, redirect, or off */
  mode: 'inherit' | 'redirect' | 'off';

  /** Maximum number of console messages to capture */
  maxMessages?: number;

  /** Callback when output is captured */
  onOutput?: (level: 'log' | 'warn' | 'error' | 'info', args: any[]) => void;
}
```

### Console Modes

```typescript
// Inherit - pass through to host console
{ console: { mode: 'inherit' } }

// Redirect - capture and handle
{ console: { mode: 'redirect', onOutput: handleOutput } }

// Off - disable console
{ console: { mode: 'off' } }
```

## Configuration Examples

### Development

```typescript
const devConfig: IsoBoxOptions = {
  timeout: 30000,
  memoryLimit: 512 * 1024 * 1024,
  strictTimeout: false,
  console: { mode: 'inherit' },
  security: {
    logViolations: true,
    sanitizeErrors: false
  },
  metrics: { enabled: true }
};
```

### Production

```typescript
const prodConfig: IsoBoxOptions = {
  timeout: 5000,
  memoryLimit: 128 * 1024 * 1024,
  strictTimeout: true,
  usePooling: true,
  pool: { min: 5, max: 50 },
  console: { mode: 'redirect' },
  security: {
    logViolations: true,
    sanitizeErrors: true,
    onSecurityEvent: alertSecurityTeam
  },
  metrics: { enabled: true },
  require: {
    mode: 'whitelist',
    whitelist: allowedModules
  }
};
```

### High Performance

```typescript
const highPerfConfig: IsoBoxOptions = {
  timeout: 3000,
  memoryLimit: 64 * 1024 * 1024,
  usePooling: true,
  pool: {
    min: 10,
    max: 100,
    idleTimeout: 60000,
    warmupCode: warmupScript
  },
  typescript: {
    enabled: true,
    typeCheck: false
  },
  metrics: { enabled: false }  // Disable for max speed
};
```

## Next Steps

- Learn about [Advanced Configuration](../advanced/PERFORMANCE-TUNING.md)
- Read [Security Best Practices](../advanced/SECURITY-BEST-PRACTICES.md)
- Explore [Scaling Guide](../architecture/SCALING-GUIDE.md)
- Check [Example Configurations](../examples/)

---

**Need help?** See [Troubleshooting Guide](../TROUBLESHOOTING.md) or [FAQ](../FAQ.md).
