# Basic Usage Guide

Learn the fundamentals of using IsoBox for secure code execution.

## Table of Contents

- [Creating Sandboxes](#creating-sandboxes)
- [Running Code](#running-code)
- [Context Variables](#context-variables)
- [Error Handling](#error-handling)
- [Resource Cleanup](#resource-cleanup)
- [Working with Files](#working-with-files)
- [Module System](#module-system)
- [Async Code](#async-code)

## Creating Sandboxes

### Basic Sandbox

The simplest way to create a sandbox:

```typescript
import { IsoBox } from 'isobox';

const box = new IsoBox();

// Use the sandbox
const result = await box.run('2 + 2');
console.log(result); // 4

// Always dispose when done
await box.dispose();
```

### With Configuration

Configure timeouts, memory limits, and other options:

```typescript
const box = new IsoBox({
  timeout: 10000,                    // 10 second timeout
  cpuTimeLimit: 15000,               // 15 second CPU limit
  memoryLimit: 256 * 1024 * 1024,    // 256MB memory
  strictTimeout: true                // Enforce strict timeout
});
```

### Reusable Pattern

Use try-finally for guaranteed cleanup:

```typescript
const box = new IsoBox({ timeout: 5000 });

try {
  const result = await box.run(untrustedCode);
  // Process result
} catch (error) {
  // Handle error
} finally {
  await box.dispose(); // Always cleanup
}
```

## Running Code

### Simple Expressions

Execute JavaScript expressions:

```typescript
const box = new IsoBox();

// Math operations
await box.run('2 + 2');                    // 4
await box.run('Math.sqrt(16)');            // 4
await box.run('Math.PI * 2');              // 6.283185307179586

// String operations
await box.run('"hello".toUpperCase()');    // "HELLO"
await box.run('[1,2,3].join(",")');        // "1,2,3"

await box.dispose();
```

### Multi-line Code

Run complete programs:

```typescript
const code = `
  function fibonacci(n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
  }

  fibonacci(10);
`;

const result = await box.run(code);
console.log(result); // 55
```

### With Return Values

The last expression is returned:

```typescript
// Last expression is the return value
await box.run(`
  const x = 10;
  const y = 20;
  x + y;  // This is returned
`); // 30

// Explicit return
await box.run(`
  function calculate() {
    return 42;
  }
  calculate();
`); // 42
```

## Context Variables

### Injecting Variables

Pass data into the sandbox:

```typescript
const result = await box.run('x * y', {
  sandbox: {
    x: 10,
    y: 5
  }
});
console.log(result); // 50
```

### Complex Objects

Pass structured data:

```typescript
const result = await box.run(`
  user.name + ' is ' + user.age + ' years old'
`, {
  sandbox: {
    user: { name: 'Alice', age: 30 }
  }
});
console.log(result); // "Alice is 30 years old"
```

### Arrays and Functions

Note: Functions cannot be passed directly:

```typescript
// ✅ Arrays work
await box.run('numbers.reduce((a, b) => a + b)', {
  sandbox: {
    numbers: [1, 2, 3, 4, 5]
  }
}); // 15

// ❌ Host functions don't work
await box.run('callback()', {
  sandbox: {
    callback: () => 'hello'  // Error: Non-transferable
  }
});

// ✅ Pass data, implement logic in sandbox
await box.run(`
  data.map(x => x * 2)
`, {
  sandbox: {
    data: [1, 2, 3]
  }
}); // [2, 4, 6]
```

## Error Handling

### Catching Errors

Handle errors from untrusted code:

```typescript
try {
  await box.run('throw new Error("Something went wrong")');
} catch (error) {
  console.error('Execution failed:', error.message);
  // "Execution failed: Something went wrong"
}
```

### Timeout Errors

Handle timeout violations:

```typescript
import { TimeoutError } from 'isobox';

const box = new IsoBox({ timeout: 1000 });

try {
  await box.run('while(true) {}'); // Infinite loop
} catch (error) {
  if (error instanceof TimeoutError) {
    console.log('Code took too long');
  }
}
```

### Memory Errors

Handle memory limit violations:

```typescript
import { MemoryLimitError } from 'isobox';

const box = new IsoBox({ memoryLimit: 10 * 1024 * 1024 }); // 10MB

try {
  await box.run('const arr = new Array(10000000).fill("x")');
} catch (error) {
  if (error instanceof MemoryLimitError) {
    console.log('Code used too much memory');
  }
}
```

### Error Event Listeners

Monitor errors with events:

```typescript
box.on('execution', (event) => {
  if (event.type === 'error') {
    console.log('Error occurred:', event.error);
  }
});

box.on('timeout', (event) => {
  console.log('Timeout at', event.timeout, 'ms');
});
```

## Resource Cleanup

### Always Dispose

Failure to dispose causes memory leaks:

```typescript
// ❌ BAD - Memory leak
const box = new IsoBox();
await box.run('2 + 2');
// Missing dispose()

// ✅ GOOD - Proper cleanup
const box = new IsoBox();
try {
  await box.run('2 + 2');
} finally {
  await box.dispose();
}
```

### Multiple Executions

Reuse the same sandbox for multiple runs:

```typescript
const box = new IsoBox();

try {
  // Multiple executions with same sandbox
  await box.run('2 + 2');
  await box.run('3 + 3');
  await box.run('4 + 4');
} finally {
  await box.dispose(); // Dispose once at the end
}
```

### Checking Disposal Status

```typescript
const box = new IsoBox();
await box.run('2 + 2');
await box.dispose();

// Subsequent calls throw error
try {
  await box.run('1 + 1');
} catch (error) {
  console.log(error.message); // "Sandbox disposed"
}
```

## Working with Files

### Enable Filesystem

```typescript
const box = new IsoBox({
  filesystem: {
    enabled: true,
    maxSize: 64 * 1024 * 1024  // 64MB
  }
});
```

### Writing Files from Host

```typescript
// Write from host code
box.fs.write('/config.json', Buffer.from(JSON.stringify({
  apiKey: 'secret',
  timeout: 5000
})));

// Read in sandbox
const result = await box.run(`
  const config = JSON.parse(fs.read('/config.json').toString());
  config.timeout;
`);
console.log(result); // 5000
```

### Reading Files in Sandbox

```typescript
// Sandbox can read files
await box.run(`
  const content = fs.read('/data.txt');
  content.toString().toUpperCase();
`);
```

### Writing Files from Sandbox

```typescript
// Sandbox can write files
await box.run(`
  fs.write('/output.txt', Buffer.from('Hello from sandbox'));
`);

// Read from host
const output = box.fs.read('/output.txt');
console.log(output.toString()); // "Hello from sandbox"
```

### Directory Operations

```typescript
await box.run(`
  // Create directory
  fs.mkdir('/data');

  // Write files
  fs.write('/data/file1.txt', Buffer.from('Content 1'));
  fs.write('/data/file2.txt', Buffer.from('Content 2'));

  // List directory
  fs.readdir('/data'); // ['file1.txt', 'file2.txt']
`);
```

## Module System

### Whitelist Mode

Only allow specific modules:

```typescript
const box = new IsoBox({
  require: {
    mode: 'whitelist',
    whitelist: ['lodash', 'date-fns']
  }
});

// ✅ Allowed
await box.run(`
  const _ = require('lodash');
  _.chunk([1, 2, 3, 4], 2);
`); // [[1, 2], [3, 4]]

// ❌ Blocked
try {
  await box.run(`require('fs')`);
} catch (error) {
  console.log('Module blocked'); // Module not in whitelist
}
```

### Mock Modules

Provide mock implementations:

```typescript
const box = new IsoBox({
  require: {
    mode: 'whitelist',
    whitelist: ['axios'],
    mocks: {
      axios: {
        get: async (url) => ({
          data: { mocked: true, url }
        })
      }
    }
  }
});

const result = await box.run(`
  const axios = require('axios');
  axios.get('https://api.example.com/data');
`);
console.log(result); // { data: { mocked: true, url: '...' } }
```

### Built-in Modules

Control access to Node.js built-ins:

```typescript
const box = new IsoBox({
  require: {
    mode: 'whitelist',
    whitelist: ['path', 'url'],
    allowBuiltins: true
  }
});

await box.run(`
  const path = require('path');
  path.join('/foo', 'bar', 'baz'); // '/foo/bar/baz'
`);
```

## Async Code

### Promises

Sandbox code can use promises:

```typescript
const result = await box.run(`
  new Promise((resolve) => {
    setTimeout(() => resolve(42), 100);
  })
`);
console.log(result); // 42 (after 100ms)
```

### Async/Await

Use async/await in sandbox:

```typescript
await box.run(`
  async function fetchData() {
    await new Promise(r => setTimeout(r, 100));
    return { data: 'loaded' };
  }

  fetchData();
`);
```

### Multiple Promises

```typescript
await box.run(`
  Promise.all([
    Promise.resolve(1),
    Promise.resolve(2),
    Promise.resolve(3)
  ])
`); // [1, 2, 3]
```

### Timeout with Async

Timeouts still apply to async code:

```typescript
const box = new IsoBox({ timeout: 1000 });

try {
  await box.run(`
    new Promise((resolve) => {
      setTimeout(() => resolve('done'), 5000); // Takes 5 seconds
    })
  `);
} catch (error) {
  console.log('Timed out'); // Timeout after 1 second
}
```

## Best Practices

### 1. Set Appropriate Limits

```typescript
const box = new IsoBox({
  timeout: 5000,                     // 5 second timeout
  memoryLimit: 128 * 1024 * 1024,    // 128MB
  cpuTimeLimit: 10000                 // 10 second CPU limit
});
```

### 2. Validate Input

```typescript
function sanitizeCode(code: string): string {
  if (!code || typeof code !== 'string') {
    throw new Error('Invalid code input');
  }
  if (code.length > 100000) {
    throw new Error('Code too large');
  }
  return code.trim();
}

const safeCode = sanitizeCode(untrustedInput);
await box.run(safeCode);
```

### 3. Handle All Errors

```typescript
try {
  const result = await box.run(code);
  return { success: true, result };
} catch (error) {
  if (error instanceof TimeoutError) {
    return { success: false, error: 'timeout' };
  } else if (error instanceof MemoryLimitError) {
    return { success: false, error: 'memory' };
  } else {
    return { success: false, error: 'execution' };
  }
} finally {
  await box.dispose();
}
```

### 4. Use Metrics

```typescript
const result = await box.run(code);
const metrics = box.getMetrics();

console.log(`Executed ${metrics.totalExecutions} times`);
console.log(`Average time: ${metrics.avgTime}ms`);
console.log(`Error rate: ${metrics.errorCount / metrics.totalExecutions}`);
```

## Next Steps

- Learn about [Configuration Options](./CONFIGURATION.md)
- Explore [Advanced Features](../advanced/)
- Read [Security Best Practices](../advanced/SECURITY-BEST-PRACTICES.md)
- Check out [Example Tutorials](../examples/)

---

**Continue learning:** Head to [Configuration Guide](./CONFIGURATION.md) for detailed options.
