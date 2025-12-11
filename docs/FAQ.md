# Frequently Asked Questions (FAQ)

Answers to common questions about IsoBox.

## General Questions

### What is IsoBox?

IsoBox is a secure sandbox for executing untrusted JavaScript and TypeScript code in isolated environments. It uses `isolated-vm` to provide true V8 isolates with configurable resource limits, filesystem access, and module management.

### When should I use IsoBox?

Use IsoBox when you need to:
- Execute user-provided code safely
- Run plugins or extensions
- Implement a rules engine with dynamic logic
- Process data transformations defined by users
- Build interactive coding environments
- Create serverless function runtimes
- Sandbox third-party scripts

### How is IsoBox different from VM2?

| Feature | VM2 | IsoBox |
|---------|-----|--------|
| Base technology | Node.js `vm` module | isolated-vm |
| Security | Context isolation | True V8 isolates |
| Maintenance | Deprecated | Active |
| API Style | Sync | Async/await |
| TypeScript | External | Built-in |
| Sessions | No | Yes |
| Pooling | No | Yes |

See [Migration Guide](./guides/MIGRATION-FROM-VM2.md) for details.

### Is IsoBox production-ready?

Yes! IsoBox is designed for production use with:
- Comprehensive test coverage
- Security-first design
- Performance optimizations (pooling)
- Active maintenance and updates
- Production-tested at scale

## Security Questions

### How secure is IsoBox?

IsoBox provides strong isolation using `isolated-vm`, which creates separate V8 isolates. This is much more secure than context-based sandboxing. However, no sandbox is 100% secure:

**What IsoBox protects against:**
- ✅ Accessing host objects/functions
- ✅ File system access (unless explicitly enabled)
- ✅ Network access
- ✅ Process manipulation
- ✅ Prototype pollution
- ✅ Infinite loops (with timeout)
- ✅ Memory exhaustion (with limits)

**Limitations:**
- ❌ Cannot prevent CPU-intensive operations within limits
- ❌ Cannot prevent all side-channel attacks
- ❌ Cannot sandbox native addons

### Can sandboxed code escape?

IsoBox uses `isolated-vm` which provides strong isolation. However:
- Stay updated with latest versions for security patches
- Set appropriate resource limits
- Follow security best practices
- Monitor for suspicious behavior

Report any suspected vulnerabilities to security@yourcompany.com.

### Should I trust user code with IsoBox?

IsoBox significantly reduces risk, but defense-in-depth is recommended:

1. **Input validation**: Validate code before execution
2. **Rate limiting**: Limit executions per user
3. **Resource limits**: Set strict timeout/memory limits
4. **Monitoring**: Log and monitor all executions
5. **Isolation**: Run IsoBox in isolated containers/VMs
6. **Principle of least privilege**: Only enable required features

### What data can I safely pass to sandboxed code?

**Safe to pass:**
- Primitives (strings, numbers, booleans)
- Plain objects and arrays
- Serializable data (JSON-compatible)

**Unsafe to pass:**
- Host functions
- Objects with methods
- Symbols, WeakMaps, etc.
- Non-transferable objects

```javascript
// ✅ Safe
await box.run('data.value * 2', {
  sandbox: { data: { value: 42 } }
});

// ❌ Unsafe
await box.run('callback()', {
  sandbox: { callback: () => 'host' }  // Error!
});
```

## Performance Questions

### How fast is IsoBox?

Performance depends on several factors:

**Without pooling:**
- Isolate creation: 50-100ms
- Execution overhead: 1-5ms
- Total: 50-105ms + code execution time

**With pooling:**
- First request: 50-100ms (cold start)
- Subsequent: 1-5ms + code execution time
- Throughput: 1000+ req/sec (with proper sizing)

### When should I use pooling?

Use pooling when:
- ✅ High request volume (>100/sec)
- ✅ Low latency requirements (<10ms)
- ✅ Consistent workload patterns
- ✅ Same modules used frequently

Don't use pooling when:
- ❌ Low request volume (<10/sec)
- ❌ Sporadic usage patterns
- ❌ Memory constrained
- ❌ Different modules each request

### What's the memory overhead?

Per isolate:
- Base overhead: ~5-10MB
- With loaded modules: +10-50MB
- Your code: varies

Recommendations:
- Without pooling: 128MB memory limit
- With pooling (min=5): 1GB+ Node.js heap
- Production: 2-4GB heap recommended

### Can IsoBox handle concurrent requests?

Yes! Use pooling for concurrency:

```javascript
const box = new IsoBox({
  usePooling: true,
  pool: {
    min: 5,   // Minimum 5 concurrent
    max: 50   // Maximum 50 concurrent
  }
});

// Handles concurrent requests
await Promise.all([
  box.run(code1),
  box.run(code2),
  box.run(code3)
]);
```

## Feature Questions

### Can I use npm modules?

Yes, with whitelisting:

```javascript
const box = new IsoBox({
  require: {
    mode: 'whitelist',
    whitelist: ['lodash', 'date-fns', 'ramda']
  }
});

await box.run(`
  const _ = require('lodash');
  _.chunk([1,2,3,4], 2);
`);
```

### Can I use async/await in sandboxed code?

Yes! Async code works natively:

```javascript
await box.run(`
  async function fetchData() {
    await new Promise(r => setTimeout(r, 100));
    return { data: 'loaded' };
  }
  fetchData();
`);
```

### Does IsoBox support TypeScript?

Yes, TypeScript is built-in:

```javascript
const box = new IsoBox({
  typescript: {
    enabled: true,
    typeCheck: false,  // For speed
    target: 'ES2022'
  }
});

await box.run(`
  interface User { name: string; age: number; }
  const user: User = { name: 'Alice', age: 30 };
  user.name;
`, { language: 'typescript' });
```

### Can sandboxed code access files?

Yes, using the in-memory filesystem:

```javascript
const box = new IsoBox({
  filesystem: {
    enabled: true,
    maxSize: 64 * 1024 * 1024
  }
});

// Write from host
box.fs.write('/data.txt', Buffer.from('content'));

// Read in sandbox
await box.run(`
  fs.read('/data.txt').toString();
`);
```

### Can I persist state between executions?

Yes, using sessions:

```javascript
await box.createSession('user-123', {
  ttl: 3600000  // 1 hour
});

const session = box.getSession('user-123');

await session.run('let counter = 0');
await session.run('counter++');
const result = await session.run('counter');  // 1
```

### Can I limit execution time?

Yes, multiple ways:

```javascript
const box = new IsoBox({
  timeout: 5000,         // Wall-clock timeout
  cpuTimeLimit: 10000,   // CPU time limit
  strictTimeout: true    // Immediate termination
});

// Override per-execution
await box.run(code, { timeout: 30000 });
```

### Can I capture console.log output?

Yes:

```javascript
const output = [];

const box = new IsoBox({
  console: {
    mode: 'redirect',
    onOutput: (level, args) => {
      output.push({ level, args });
    }
  }
});

await box.run('console.log("Hello", "World")');
console.log(output);
// [{ level: 'log', args: ['Hello', 'World'] }]
```

## Usage Questions

### Do I need to call dispose()?

Yes! Always dispose to prevent memory leaks:

```javascript
const box = new IsoBox();
try {
  await box.run(code);
} finally {
  await box.dispose();  // Required!
}
```

With pooling, dispose once on shutdown:

```javascript
const box = new IsoBox({ usePooling: true });

// Use for many requests...

// On shutdown
await box.dispose();
```

### Can I reuse a sandbox instance?

Yes, for multiple executions:

```javascript
const box = new IsoBox();

try {
  await box.run(code1);
  await box.run(code2);
  await box.run(code3);
} finally {
  await box.dispose();
}
```

Or use sessions for persistent state.

### How do I handle errors?

Use try-catch with specific error types:

```javascript
import { TimeoutError, MemoryLimitError } from 'isobox';

try {
  await box.run(code);
} catch (error) {
  if (error instanceof TimeoutError) {
    // Handle timeout
  } else if (error instanceof MemoryLimitError) {
    // Handle memory limit
  } else {
    // Handle other errors
  }
}
```

### Can I run multiple sandboxes in parallel?

Yes:

```javascript
const boxes = [
  new IsoBox(),
  new IsoBox(),
  new IsoBox()
];

try {
  const results = await Promise.all(
    boxes.map((box, i) => box.run(codes[i]))
  );
} finally {
  await Promise.all(boxes.map(box => box.dispose()));
}
```

Or use pooling with one instance.

## Deployment Questions

### Can I use IsoBox in Docker?

Yes:

```dockerfile
FROM node:18-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

CMD ["node", "dist/index.js"]
```

### Can I use IsoBox in serverless (Lambda, Cloud Functions)?

Yes, but consider:
- Cold start time (~100ms)
- Memory requirements (512MB+)
- Timeout limits (adjust accordingly)
- Use pooling sparingly (costs)

```javascript
// Lambda handler
exports.handler = async (event) => {
  const box = new IsoBox({ timeout: 5000 });
  try {
    const result = await box.run(event.code);
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (error) {
    return { statusCode: 500, body: error.message };
  } finally {
    await box.dispose();
  }
};
```

### How do I monitor IsoBox in production?

```javascript
// Metrics
const metrics = box.getMetrics();
console.log({
  executions: metrics.totalExecutions,
  errorRate: metrics.errorCount / metrics.totalExecutions,
  avgTime: metrics.avgTime
});

// Events
box.on('execution', (event) => {
  if (event.type === 'error') {
    logger.error('Execution error', event);
  }
});

box.on('timeout', (event) => {
  logger.warn('Timeout', event);
});

// Health check
app.get('/health', (req, res) => {
  const poolStats = box.getPoolStats();
  res.json({
    status: poolStats ? 'healthy' : 'no-pool',
    pool: poolStats
  });
});
```

### What are recommended production settings?

```javascript
const productionConfig = {
  // Conservative limits
  timeout: 5000,
  cpuTimeLimit: 10000,
  memoryLimit: 128 * 1024 * 1024,
  strictTimeout: true,

  // Performance
  usePooling: true,
  pool: {
    min: 5,
    max: 50,
    idleTimeout: 60000
  },

  // Security
  security: {
    logViolations: true,
    sanitizeErrors: true,
    onSecurityEvent: alertSecurityTeam
  },

  // Features
  require: {
    mode: 'whitelist',
    whitelist: allowedModules
  },

  // Monitoring
  metrics: {
    enabled: true,
    collectCpu: true,
    collectMemory: true
  }
};
```

## Comparison Questions

### IsoBox vs eval()?

Never use `eval()` for untrusted code!

| eval() | IsoBox |
|--------|--------|
| No isolation | True isolation |
| Full host access | Sandboxed |
| No resource limits | Configurable limits |
| Extremely dangerous | Production-safe |

### IsoBox vs Worker Threads?

Different use cases:

**Worker Threads:**
- For parallel computation
- Shared memory
- Node.js APIs available
- Still same process

**IsoBox:**
- For untrusted code
- Complete isolation
- Restricted APIs
- True V8 isolates

### IsoBox vs Docker containers?

Complementary, not competing:

```
Docker Container (OS-level isolation)
  └── Node.js Process
       └── IsoBox (V8-level isolation)
            └── Untrusted Code
```

Use both for defense-in-depth.

## Troubleshooting

### My code runs locally but not in IsoBox

Common issues:

1. **Using host globals:**
   ```javascript
   // ❌ Doesn't work
   await box.run('process.env.NODE_ENV');

   // ✅ Pass as context
   await box.run('env', {
     sandbox: { env: process.env.NODE_ENV }
   });
   ```

2. **Module not whitelisted:**
   ```javascript
   const box = new IsoBox({
     require: {
       mode: 'whitelist',
       whitelist: ['lodash']  // Add your modules
     }
   });
   ```

3. **Timeout too short:**
   ```javascript
   const box = new IsoBox({ timeout: 10000 });
   ```

### How do I debug sandboxed code?

1. **Use console output:**
   ```javascript
   const box = new IsoBox({
     console: { mode: 'inherit' }
   });
   await box.run('console.log("Debug:", value)');
   ```

2. **Return debug info:**
   ```javascript
   await box.run(`
     const debug = { step1: result1, step2: result2 };
     { result, debug };
   `);
   ```

3. **Enable debug logging:**
   ```javascript
   import { logger } from 'isobox/utils';
   logger.setLevel('debug');
   ```

## More Questions?

- Check [Troubleshooting Guide](./TROUBLESHOOTING.md)
- Read the [Documentation](./guides/)
- Search [GitHub Issues](https://github.com/yourusername/isobox/issues)
- Ask on [Discussions](https://github.com/yourusername/isobox/discussions)

---

**Don't see your question?** [Ask on GitHub Discussions](https://github.com/yourusername/isobox/discussions/new)
