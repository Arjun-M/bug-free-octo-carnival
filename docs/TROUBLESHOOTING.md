# Troubleshooting Guide

Solutions to common issues when using IsoBox.

## Table of Contents

- [Installation Issues](#installation-issues)
- [Timeout Errors](#timeout-errors)
- [Memory Issues](#memory-issues)
- [Module Loading Failures](#module-loading-failures)
- [Performance Problems](#performance-problems)
- [Security Violations](#security-violations)
- [TypeScript Issues](#typescript-issues)
- [Filesystem Problems](#filesystem-problems)
- [Session Issues](#session-issues)
- [Production Debugging](#production-debugging)

## Installation Issues

### Error: "Cannot find module 'isolated-vm'"

**Symptom:**
```
Error: Cannot find module 'isolated-vm'
```

**Solutions:**

1. **Rebuild isolated-vm:**
   ```bash
   npm rebuild isolated-vm
   ```

2. **Reinstall from scratch:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. **Check Node.js version:**
   ```bash
   node --version  # Should be 16.x or higher
   ```

4. **Install build tools:**
   ```bash
   # Ubuntu/Debian
   sudo apt-get install build-essential python3

   # macOS
   xcode-select --install

   # Windows
   npm install --global windows-build-tools
   ```

### Error: "gyp ERR! build error"

**Symptom:**
```
gyp ERR! build error
gyp ERR! stack Error: `make` failed with exit code: 2
```

**Solutions:**

1. **Install required dependencies:**
   ```bash
   # Linux
   sudo apt-get update
   sudo apt-get install build-essential python3 make g++

   # macOS
   brew install python3
   ```

2. **Use correct Node.js version:**
   ```bash
   nvm install 18
   nvm use 18
   npm install
   ```

3. **Clear npm cache:**
   ```bash
   npm cache clean --force
   npm install
   ```

### Error: "Python not found"

**Symptom:**
```
Error: Could not find Python
```

**Solutions:**

1. **Install Python 3:**
   ```bash
   # Ubuntu/Debian
   sudo apt-get install python3

   # macOS
   brew install python3

   # Windows
   # Download from python.org
   ```

2. **Set Python path:**
   ```bash
   npm config set python /usr/bin/python3
   ```

## Timeout Errors

### Basic Timeout

**Symptom:**
```
TimeoutError: Execution timeout exceeded
```

**Solutions:**

1. **Increase timeout:**
   ```javascript
   const box = new IsoBox({
     timeout: 10000  // Increase from default 5000
   });
   ```

2. **Per-execution timeout:**
   ```javascript
   await box.run(code, {
     timeout: 30000  // Override for this execution
   });
   ```

3. **Check for infinite loops:**
   ```javascript
   // Bad - infinite loop
   await box.run('while(true) {}');

   // Good - bounded loop
   await box.run('for(let i = 0; i < 1000; i++) {}');
   ```

4. **Disable strict timeout temporarily:**
   ```javascript
   const box = new IsoBox({
     strictTimeout: false  // Allow graceful shutdown
   });
   ```

### CPU Time Limit

**Symptom:**
```
CPULimitError: CPU time limit exceeded
```

**Solutions:**

1. **Increase CPU limit:**
   ```javascript
   const box = new IsoBox({
     cpuTimeLimit: 30000  // 30 seconds
   });
   ```

2. **Optimize algorithm:**
   ```javascript
   // Bad - O(n²) complexity
   for(let i = 0; i < arr.length; i++) {
     for(let j = 0; j < arr.length; j++) {
       // ...
     }
   }

   // Good - O(n) complexity
   for(let item of arr) {
     // ...
   }
   ```

3. **Break up work:**
   ```javascript
   // Process in chunks
   const chunks = _.chunk(largeArray, 100);
   for (const chunk of chunks) {
     await box.run(processChunk, { sandbox: { chunk } });
   }
   ```

## Memory Issues

### Memory Limit Exceeded

**Symptom:**
```
MemoryLimitError: Memory limit exceeded
```

**Solutions:**

1. **Increase memory limit:**
   ```javascript
   const box = new IsoBox({
     memoryLimit: 512 * 1024 * 1024  // 512MB
   });
   ```

2. **Check data size:**
   ```javascript
   const dataSize = Buffer.byteLength(JSON.stringify(data));
   console.log(`Data size: ${dataSize / 1024 / 1024}MB`);

   // Adjust memory limit accordingly
   const memoryLimit = dataSize * 3;  // 3x buffer
   ```

3. **Stream large data:**
   ```javascript
   // Bad - load all at once
   const allData = await loadAllData();
   await box.run(process, { sandbox: { data: allData } });

   // Good - process in chunks
   for await (const chunk of dataStream()) {
     await box.run(process, { sandbox: { chunk } });
   }
   ```

4. **Clean up references:**
   ```javascript
   await box.run(`
     let data = processLargeData();
     const result = extractResult(data);
     data = null;  // Release memory
     result;
   `);
   ```

### Node.js Out of Memory

**Symptom:**
```
FATAL ERROR: Reached heap limit
```

**Solutions:**

1. **Increase Node.js heap:**
   ```bash
   node --max-old-space-size=4096 your-app.js
   ```

2. **Use isolate pooling:**
   ```javascript
   const box = new IsoBox({
     usePooling: true,
     pool: { min: 2, max: 10 }
   });
   ```

3. **Dispose properly:**
   ```javascript
   // Always dispose to free memory
   try {
     await box.run(code);
   } finally {
     await box.dispose();
   }
   ```

## Module Loading Failures

### Module Not in Whitelist

**Symptom:**
```
Error: Module 'lodash' not in whitelist
```

**Solutions:**

1. **Add to whitelist:**
   ```javascript
   const box = new IsoBox({
     require: {
       mode: 'whitelist',
       whitelist: ['lodash', 'axios']  // Add module here
     }
   });
   ```

2. **Check spelling:**
   ```javascript
   // Wrong
   whitelist: ['loadsh']  // Typo

   // Correct
   whitelist: ['lodash']
   ```

### Built-in Module Not Available

**Symptom:**
```
Error: Module 'fs' not available
```

**Solutions:**

1. **Enable built-ins:**
   ```javascript
   const box = new IsoBox({
     require: {
       mode: 'whitelist',
       whitelist: ['fs', 'path'],
       allowBuiltins: true  // Enable built-in modules
     }
   });
   ```

2. **Use mock instead:**
   ```javascript
   const box = new IsoBox({
     require: {
       mode: 'whitelist',
       whitelist: ['fs'],
       mocks: {
         fs: {
           readFileSync: () => 'mocked content'
         }
       }
     }
   });
   ```

### Module Mock Not Working

**Symptom:**
Module mock not being used

**Solutions:**

1. **Ensure module is whitelisted:**
   ```javascript
   const box = new IsoBox({
     require: {
       mode: 'whitelist',
       whitelist: ['mymodule'],  // Must be in whitelist
       mocks: {
         mymodule: { ... }
       }
     }
   });
   ```

2. **Check mock structure:**
   ```javascript
   // Mock should match module exports
   mocks: {
     axios: {
       get: async (url) => ({ data: {} }),
       post: async (url, data) => ({ data: {} })
     }
   }
   ```

## Performance Problems

### Slow Execution

**Symptom:**
Code takes longer than expected to execute

**Solutions:**

1. **Enable pooling:**
   ```javascript
   const box = new IsoBox({
     usePooling: true,
     pool: {
       min: 5,
       max: 20,
       warmupCode: 'const _ = require("lodash")'
     }
   });
   ```

2. **Warm up pool:**
   ```javascript
   await box.warmupPool();  // Pre-create isolates
   ```

3. **Use sessions for repeated execution:**
   ```javascript
   await box.createSession('session-id');
   const session = box.getSession('session-id');

   // Faster repeated execution
   await session.run(code1);
   await session.run(code2);
   ```

4. **Disable metrics:**
   ```javascript
   const box = new IsoBox({
     metrics: { enabled: false }  // Slight performance gain
   });
   ```

### High Latency on First Request

**Symptom:**
First execution is slow, subsequent ones are fast

**Solutions:**

1. **Pre-warm isolates:**
   ```javascript
   const box = new IsoBox({
     usePooling: true,
     pool: { min: 3 }
   });

   // Before handling requests
   await box.warmupPool();
   ```

2. **Keep pool alive:**
   ```javascript
   const box = new IsoBox({
     usePooling: true,
     pool: {
       min: 2,
       idleTimeout: 300000  // 5 minutes
     }
   });
   ```

### Memory Leaks

**Symptom:**
Memory usage increases over time

**Solutions:**

1. **Check dispose calls:**
   ```javascript
   // Leak - no dispose
   app.post('/execute', async (req, res) => {
     const box = new IsoBox();
     const result = await box.run(req.body.code);
     res.json({ result });
     // Missing dispose!
   });

   // Fixed
   app.post('/execute', async (req, res) => {
     const box = new IsoBox();
     try {
       const result = await box.run(req.body.code);
       res.json({ result });
     } finally {
       await box.dispose();
     }
   });
   ```

2. **Use pooling:**
   ```javascript
   // Single instance with pooling
   const box = new IsoBox({ usePooling: true });

   app.post('/execute', async (req, res) => {
     const result = await box.run(req.body.code);
     res.json({ result });
   });

   // Dispose on shutdown
   process.on('SIGTERM', () => box.dispose());
   ```

3. **Monitor metrics:**
   ```javascript
   setInterval(() => {
     const metrics = box.getMetrics();
     console.log('Memory:', metrics.memoryUsed);

     if (metrics.memoryUsed > threshold) {
       // Alert or restart
     }
   }, 60000);
   ```

## Security Violations

### Forbidden Property Access

**Symptom:**
```
SecurityError: Forbidden property access
```

**Solutions:**

1. **Enable property access:**
   ```javascript
   const box = new IsoBox({
     security: {
       allowDangerousProperties: true  // Use with caution
     }
   });
   ```

2. **Provide safe alternative:**
   ```javascript
   // Instead of allowing dangerous properties
   // Provide safe wrapper
   await box.run(code, {
     sandbox: {
       safeProcess: {
         env: { NODE_ENV: 'production' }
       }
     }
   });
   ```

### Network Attempt Blocked

**Symptom:**
```
SecurityError: Network attempt blocked
```

**Solutions:**

1. **Use mocked HTTP client:**
   ```javascript
   const box = new IsoBox({
     require: {
       mode: 'whitelist',
       whitelist: ['axios'],
       mocks: {
         axios: mockAxios  // Provide mock
       }
     }
   });
   ```

2. **Pre-fetch data:**
   ```javascript
   // Fetch data in host
   const data = await fetch('https://api.example.com');

   // Pass to sandbox
   await box.run(process, {
     sandbox: { data }
   });
   ```

## TypeScript Issues

### Type Checking Errors

**Symptom:**
TypeScript type errors prevent execution

**Solutions:**

1. **Disable type checking:**
   ```javascript
   const box = new IsoBox({
     typescript: {
       enabled: true,
       typeCheck: false  // Skip type checking
     }
   });
   ```

2. **Fix type errors:**
   ```javascript
   // Fix the TypeScript code
   await box.run(`
     const x: number = 42;  // Not "42"
     x + 1;
   `, { language: 'typescript' });
   ```

### Transpilation Failures

**Symptom:**
```
Error: TypeScript transpilation failed
```

**Solutions:**

1. **Check syntax:**
   ```javascript
   // Invalid TypeScript
   await box.run('const x: number = ');

   // Valid TypeScript
   await box.run('const x: number = 42');
   ```

2. **Use compatible features:**
   ```javascript
   const box = new IsoBox({
     typescript: {
       enabled: true,
       target: 'ES2022'  // Adjust target
     }
   });
   ```

## Filesystem Problems

### File Not Found

**Symptom:**
```
Error: File not found: /path/to/file
```

**Solutions:**

1. **Check file exists:**
   ```javascript
   if (box.fs.exists('/data.txt')) {
     const content = box.fs.read('/data.txt');
   }
   ```

2. **Use correct path:**
   ```javascript
   // Wrong
   box.fs.write('data.txt', buffer);

   // Correct
   box.fs.write('/data.txt', buffer);
   ```

### Filesystem Size Exceeded

**Symptom:**
```
Error: Filesystem size limit exceeded
```

**Solutions:**

1. **Increase limit:**
   ```javascript
   const box = new IsoBox({
     filesystem: {
       enabled: true,
       maxSize: 256 * 1024 * 1024  // 256MB
     }
   });
   ```

2. **Clean up files:**
   ```javascript
   await box.run(`
     // Clean up temporary files
     fs.unlink('/temp.txt');
   `);
   ```

## Session Issues

### Session Expired

**Symptom:**
```
Error: Session expired or not found
```

**Solutions:**

1. **Increase TTL:**
   ```javascript
   await box.createSession('session-id', {
     ttl: 3600000  // 1 hour
   });
   ```

2. **Check expiration:**
   ```javascript
   const sessions = box.listSessions();
   const session = sessions.find(s => s.id === 'session-id');
   if (session && Date.now() < session.expiresAt) {
     // Session still valid
   }
   ```

### Max Executions Reached

**Symptom:**
```
Error: Maximum executions reached for session
```

**Solutions:**

1. **Increase limit:**
   ```javascript
   await box.createSession('session-id', {
     maxExecutions: 1000  // Increase limit
   });
   ```

2. **Create new session:**
   ```javascript
   await box.deleteSession('old-session');
   await box.createSession('new-session');
   ```

## Production Debugging

### Enable Debug Logging

```javascript
import { logger } from 'isobox/utils';

logger.setLevel('debug');

const box = new IsoBox();
// Now logs debug information
```

### Monitor Metrics

```javascript
setInterval(() => {
  const metrics = box.getMetrics();
  console.log({
    executions: metrics.totalExecutions,
    errors: metrics.errorCount,
    avgTime: metrics.avgTime,
    memory: metrics.memoryUsed / 1024 / 1024  // MB
  });
}, 60000);
```

### Event Listeners

```javascript
box.on('execution', (event) => {
  console.log(`[${event.type}] ${event.id}`);
});

box.on('timeout', (event) => {
  console.error('Timeout:', event);
});

box.on('resource-warning', (event) => {
  console.warn('Resource warning:', event);
});

box.on('error', (error) => {
  console.error('Error:', error);
});
```

### Health Check Endpoint

```javascript
app.get('/health', (req, res) => {
  const metrics = box.getMetrics();
  const poolStats = box.getPoolStats();

  res.json({
    status: 'healthy',
    metrics: {
      totalExecutions: metrics.totalExecutions,
      errorRate: metrics.errorCount / metrics.totalExecutions,
      avgTime: metrics.avgTime
    },
    pool: poolStats ? {
      active: poolStats.active,
      idle: poolStats.idle
    } : null
  });
});
```

## Getting More Help

If your issue isn't covered here:

1. **Check the FAQ:** [FAQ.md](./FAQ.md)
2. **Search GitHub Issues:** [github.com/yourusername/isobox/issues](https://github.com/yourusername/isobox/issues)
3. **Ask on Discussions:** [github.com/yourusername/isobox/discussions](https://github.com/yourusername/isobox/discussions)
4. **Read the guides:**
   - [Installation Guide](./guides/INSTALLATION.md)
   - [Configuration Guide](./guides/CONFIGURATION.md)
   - [Advanced Documentation](./advanced/)

## Reporting Bugs

When reporting issues, please include:

- Node.js version: `node --version`
- IsoBox version: `npm list isobox`
- Operating system
- Minimal reproduction code
- Full error message and stack trace
- Expected vs actual behavior

---

**Still stuck?** Open an issue on [GitHub](https://github.com/yourusername/isobox/issues/new) with details.
