# IsoBox Quick Start Guide

Get up and running with IsoBox in 5 minutes!

## Installation

```bash
npm install isobox
```

or

```bash
yarn add isobox
```

## Your First Sandbox

Create a simple sandbox and run some code:

```typescript
import { IsoBox } from 'isobox';

// Create a sandbox
const box = new IsoBox({
  timeout: 5000,  // 5 second timeout
  memoryLimit: 128 * 1024 * 1024  // 128MB memory limit
});

// Run code
const result = await box.run('2 + 2');
console.log(result); // 4

// Clean up
await box.dispose();
```

## Running Code with Context

Pass variables into the sandbox:

```typescript
const box = new IsoBox();

const result = await box.run('x * y', {
  sandbox: {
    x: 10,
    y: 5
  }
});

console.log(result); // 50

await box.dispose();
```

## Handling Errors

Catch and handle errors from untrusted code:

```typescript
const box = new IsoBox({ timeout: 1000 });

try {
  await box.run('while(true) {}'); // Infinite loop
} catch (error) {
  console.error('Execution failed:', error.message);
  // Error: Execution timeout exceeded
}

await box.dispose();
```

## Using the Filesystem

Enable filesystem access:

```typescript
const box = new IsoBox({
  filesystem: {
    enabled: true,
    maxSize: 64 * 1024 * 1024  // 64MB
  }
});

// Write a file
box.fs.write('/data.txt', Buffer.from('Hello, World!'));

// Read from sandbox
const result = await box.run(`
  const content = fs.read('/data.txt');
  content.toString();
`);

console.log(result); // "Hello, World!"

await box.dispose();
```

## Module Whitelisting

Control which modules can be required:

```typescript
const box = new IsoBox({
  require: {
    mode: 'whitelist',
    whitelist: ['lodash', 'date-fns']
  }
});

const result = await box.run(`
  const _ = require('lodash');
  _.chunk([1, 2, 3, 4], 2);
`);

console.log(result); // [[1, 2], [3, 4]]

await box.dispose();
```

## Using Sessions

Create persistent sessions with state:

```typescript
const box = new IsoBox();

// Create a session
await box.createSession('user-123', {
  ttl: 3600000,  // 1 hour
  maxExecutions: 100
});

const session = box.getSession('user-123');

// Run code in session - state persists
await session.run('let counter = 0');
await session.run('counter++');
await session.run('counter++');

const result = await session.run('counter');
console.log(result); // 2

// Clean up
await box.deleteSession('user-123');
await box.dispose();
```

## Listening to Events

Monitor execution with events:

```typescript
const box = new IsoBox();

box.on('execution', (event) => {
  console.log(`Execution ${event.type}:`, event.id);
});

box.on('timeout', (event) => {
  console.error('Timeout!', event);
});

box.on('resource-warning', (event) => {
  console.warn('Resource warning:', event);
});

await box.run('Math.sqrt(16)');
await box.dispose();
```

## TypeScript Support

Run TypeScript code directly:

```typescript
const box = new IsoBox({
  typescript: {
    enabled: true,
    typeCheck: false,  // Disable type checking for speed
    target: 'ES2022'
  }
});

const result = await box.run(`
  interface User {
    name: string;
    age: number;
  }

  const user: User = { name: 'Alice', age: 30 };
  user.name;
`, { language: 'typescript' });

console.log(result); // "Alice"

await box.dispose();
```

## Best Practices

1. **Always dispose**: Call `dispose()` when done to free resources
   ```typescript
   try {
     const result = await box.run(code);
   } finally {
     await box.dispose();
   }
   ```

2. **Set appropriate limits**: Configure timeout and memory limits
   ```typescript
   const box = new IsoBox({
     timeout: 5000,
     memoryLimit: 128 * 1024 * 1024
   });
   ```

3. **Use sessions for state**: Don't recreate isolates unnecessarily
   ```typescript
   const session = await box.createSession('session-id');
   // Reuse session for multiple executions
   ```

4. **Enable pooling for performance**: Use isolate pooling for high throughput
   ```typescript
   const box = new IsoBox({
     usePooling: true,
     pool: { min: 2, max: 10 }
   });
   ```

5. **Whitelist modules**: Only allow required modules
   ```typescript
   require: {
     mode: 'whitelist',
     whitelist: ['lodash', 'ramda']
   }
   ```

## Next Steps

- Read the [Basic Usage Guide](./BASIC-USAGE.md) for detailed examples
- Learn about [Configuration](./CONFIGURATION.md) options
- Explore [Advanced Features](../advanced/) for power user features
- Check out [Example Tutorials](../examples/) for real-world use cases

## Common Pitfalls

❌ **Don't forget to dispose**
```typescript
const box = new IsoBox();
await box.run('2 + 2');
// Missing dispose() - memory leak!
```

✅ **Always dispose**
```typescript
const box = new IsoBox();
try {
  await box.run('2 + 2');
} finally {
  await box.dispose();
}
```

❌ **Don't pass host objects directly**
```typescript
const hostObject = { method: () => 'host' };
await box.run('obj.method()', { sandbox: { obj: hostObject } });
// Error: Non-transferable value
```

✅ **Pass serializable data**
```typescript
const data = { value: 42, name: 'test' };
await box.run('obj.value', { sandbox: { obj: data } });
```

## Getting Help

- 📖 [Full Documentation](../API.md)
- ❓ [FAQ](../FAQ.md)
- 🐛 [Troubleshooting](../TROUBLESHOOTING.md)
- 💬 [GitHub Issues](https://github.com/yourusername/isobox/issues)

---

**Ready to dive deeper?** Continue to the [Installation Guide](./INSTALLATION.md) for detailed setup instructions.
