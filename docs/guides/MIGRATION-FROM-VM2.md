# Migration Guide: From VM2 to IsoBox

Complete guide for migrating from VM2 to IsoBox.

## Table of Contents

- [Why Migrate](#why-migrate)
- [Key Differences](#key-differences)
- [API Mapping](#api-mapping)
- [Breaking Changes](#breaking-changes)
- [Step-by-Step Migration](#step-by-step-migration)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)

## Why Migrate

### VM2 is Deprecated

VM2 is no longer maintained and has known security vulnerabilities. IsoBox provides:

- ✅ **Active maintenance** and security updates
- ✅ **Better security** with isolated-vm
- ✅ **More features** (sessions, pooling, metrics)
- ✅ **TypeScript support** out of the box
- ✅ **Better performance** with pooling
- ✅ **Modern API** with async/await

### Security Improvements

IsoBox uses `isolated-vm` which provides true V8 isolates, offering better security than VM2's `vm` module-based approach.

## Key Differences

### Architecture

| Feature | VM2 | IsoBox |
|---------|-----|--------|
| Base | Node.js `vm` module | isolated-vm |
| Isolation | Context isolation | V8 isolates |
| Async | Callbacks | Promises/async-await |
| TypeScript | External | Built-in |
| Sessions | No | Yes |
| Pooling | No | Yes |
| Metrics | Basic | Comprehensive |

### API Philosophy

**VM2:**
- Synchronous by default
- Class-based (VM, NodeVM)
- Limited configuration

**IsoBox:**
- Async by default
- Promise-based
- Extensive configuration
- Event-driven

## API Mapping

### Basic Execution

**VM2:**
```javascript
const { VM } = require('vm2');

const vm = new VM({
  timeout: 1000,
  sandbox: { x: 10 }
});

const result = vm.run('x * 2');
```

**IsoBox:**
```javascript
const { IsoBox } = require('isobox');

const box = new IsoBox({ timeout: 1000 });

const result = await box.run('x * 2', {
  sandbox: { x: 10 }
});

await box.dispose();
```

### Node VM

**VM2:**
```javascript
const { NodeVM } = require('vm2');

const vm = new NodeVM({
  console: 'inherit',
  sandbox: {},
  require: {
    external: true,
    builtin: ['fs', 'path']
  }
});

vm.run('console.log("Hello")');
```

**IsoBox:**
```javascript
const { IsoBox } = require('isobox');

const box = new IsoBox({
  console: { mode: 'inherit' },
  require: {
    mode: 'whitelist',
    whitelist: ['fs', 'path'],
    allowBuiltins: true
  }
});

await box.run('console.log("Hello")');
await box.dispose();
```

### Module Whitelisting

**VM2:**
```javascript
const vm = new NodeVM({
  require: {
    external: ['lodash', 'axios'],
    builtin: ['path']
  }
});
```

**IsoBox:**
```javascript
const box = new IsoBox({
  require: {
    mode: 'whitelist',
    whitelist: ['lodash', 'axios', 'path'],
    allowBuiltins: true
  }
});
```

### Module Mocking

**VM2:**
```javascript
const vm = new NodeVM({
  require: {
    mock: {
      fs: {
        readFileSync: () => 'mocked content'
      }
    }
  }
});
```

**IsoBox:**
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

### Filesystem Access

**VM2:**
```javascript
// No built-in filesystem
// Must provide via module mocking
```

**IsoBox:**
```javascript
const box = new IsoBox({
  filesystem: {
    enabled: true,
    maxSize: 64 * 1024 * 1024
  }
});

box.fs.write('/file.txt', Buffer.from('content'));
```

## Breaking Changes

### 1. Async API

**VM2** methods are synchronous:
```javascript
const result = vm.run(code);  // Synchronous
```

**IsoBox** methods are async:
```javascript
const result = await box.run(code);  // Async
```

**Migration:**
```javascript
// Before
function execute(code) {
  return vm.run(code);
}

// After
async function execute(code) {
  return await box.run(code);
}
```

### 2. Resource Cleanup

**VM2** doesn't require explicit cleanup:
```javascript
const vm = new VM();
vm.run(code);
// No cleanup needed
```

**IsoBox** requires disposal:
```javascript
const box = new IsoBox();
await box.run(code);
await box.dispose();  // Required!
```

**Migration pattern:**
```javascript
// Before
function runCode(code) {
  const vm = new VM();
  return vm.run(code);
}

// After
async function runCode(code) {
  const box = new IsoBox();
  try {
    return await box.run(code);
  } finally {
    await box.dispose();
  }
}
```

### 3. Context Variables

**VM2** uses `sandbox` in constructor:
```javascript
const vm = new VM({
  sandbox: { x: 10, y: 20 }
});
```

**IsoBox** passes context per execution:
```javascript
const box = new IsoBox();
await box.run(code, {
  sandbox: { x: 10, y: 20 }
});
```

### 4. Error Handling

**VM2** throws directly:
```javascript
try {
  vm.run(code);
} catch (error) {
  // Handle error
}
```

**IsoBox** has specific error types:
```javascript
import { TimeoutError, MemoryLimitError } from 'isobox';

try {
  await box.run(code);
} catch (error) {
  if (error instanceof TimeoutError) {
    // Handle timeout
  } else if (error instanceof MemoryLimitError) {
    // Handle memory limit
  }
}
```

## Step-by-Step Migration

### Step 1: Install IsoBox

```bash
npm uninstall vm2
npm install isobox
```

### Step 2: Update Imports

```javascript
// Before
const { VM, NodeVM } = require('vm2');

// After
const { IsoBox } = require('isobox');
```

### Step 3: Convert to Async

```javascript
// Before
function executeCode(code, context) {
  const vm = new VM({ sandbox: context });
  return vm.run(code);
}

// After
async function executeCode(code, context) {
  const box = new IsoBox();
  try {
    return await box.run(code, { sandbox: context });
  } finally {
    await box.dispose();
  }
}
```

### Step 4: Update Configuration

```javascript
// Before
const vm = new NodeVM({
  console: 'inherit',
  sandbox: {},
  timeout: 5000,
  require: {
    external: ['lodash'],
    builtin: ['path', 'fs']
  }
});

// After
const box = new IsoBox({
  timeout: 5000,
  console: { mode: 'inherit' },
  require: {
    mode: 'whitelist',
    whitelist: ['lodash', 'path', 'fs'],
    allowBuiltins: true
  }
});
```

### Step 5: Add Resource Cleanup

```javascript
// Before
app.post('/execute', (req, res) => {
  const vm = new VM();
  const result = vm.run(req.body.code);
  res.json({ result });
});

// After
app.post('/execute', async (req, res) => {
  const box = new IsoBox();
  try {
    const result = await box.run(req.body.code);
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await box.dispose();
  }
});
```

### Step 6: Test Thoroughly

```javascript
// Create comprehensive tests
describe('Migration tests', () => {
  it('should execute basic code', async () => {
    const box = new IsoBox();
    try {
      const result = await box.run('2 + 2');
      expect(result).toBe(4);
    } finally {
      await box.dispose();
    }
  });

  it('should handle context variables', async () => {
    const box = new IsoBox();
    try {
      const result = await box.run('x * y', {
        sandbox: { x: 10, y: 5 }
      });
      expect(result).toBe(50);
    } finally {
      await box.dispose();
    }
  });
});
```

## Common Patterns

### Pattern 1: Simple Script Execution

**VM2:**
```javascript
const { VM } = require('vm2');

const vm = new VM({
  timeout: 1000,
  sandbox: { data: [1, 2, 3] }
});

const result = vm.run('data.reduce((a, b) => a + b)');
console.log(result); // 6
```

**IsoBox:**
```javascript
const { IsoBox } = require('isobox');

async function execute() {
  const box = new IsoBox({ timeout: 1000 });
  try {
    const result = await box.run('data.reduce((a, b) => a + b)', {
      sandbox: { data: [1, 2, 3] }
    });
    console.log(result); // 6
  } finally {
    await box.dispose();
  }
}

execute();
```

### Pattern 2: Module Usage

**VM2:**
```javascript
const { NodeVM } = require('vm2');

const vm = new NodeVM({
  require: {
    external: ['lodash']
  }
});

vm.run(`
  const _ = require('lodash');
  _.chunk([1, 2, 3, 4], 2);
`);
```

**IsoBox:**
```javascript
const { IsoBox } = require('isobox');

async function execute() {
  const box = new IsoBox({
    require: {
      mode: 'whitelist',
      whitelist: ['lodash']
    }
  });

  try {
    const result = await box.run(`
      const _ = require('lodash');
      _.chunk([1, 2, 3, 4], 2);
    `);
    console.log(result); // [[1, 2], [3, 4]]
  } finally {
    await box.dispose();
  }
}

execute();
```

### Pattern 3: Multiple Executions

**VM2:**
```javascript
const vm = new VM();

const result1 = vm.run('2 + 2');
const result2 = vm.run('3 + 3');
const result3 = vm.run('4 + 4');
```

**IsoBox:**
```javascript
async function execute() {
  const box = new IsoBox();

  try {
    const result1 = await box.run('2 + 2');
    const result2 = await box.run('3 + 3');
    const result3 = await box.run('4 + 4');
  } finally {
    await box.dispose();
  }
}
```

### Pattern 4: Error Handling

**VM2:**
```javascript
try {
  const vm = new VM({ timeout: 1000 });
  vm.run('while(true) {}');
} catch (error) {
  console.error('Error:', error.message);
}
```

**IsoBox:**
```javascript
import { TimeoutError } from 'isobox';

async function execute() {
  const box = new IsoBox({ timeout: 1000 });

  try {
    await box.run('while(true) {}');
  } catch (error) {
    if (error instanceof TimeoutError) {
      console.error('Timeout exceeded');
    } else {
      console.error('Error:', error.message);
    }
  } finally {
    await box.dispose();
  }
}
```

## Advanced Migration

### Using Sessions (VM2 Equivalent)

In VM2, you could reuse VM instances. In IsoBox, use sessions:

**VM2:**
```javascript
const vm = new VM({ sandbox: {} });

vm.run('var counter = 0');
vm.run('counter++');
const result = vm.run('counter'); // 1
```

**IsoBox:**
```javascript
const box = new IsoBox();

await box.createSession('my-session');
const session = box.getSession('my-session');

await session.run('var counter = 0');
await session.run('counter++');
const result = await session.run('counter'); // 1

await box.dispose();
```

### Performance Optimization

**VM2:**
```javascript
// Create once, reuse
const vm = new VM();

app.post('/execute', (req, res) => {
  const result = vm.run(req.body.code);
  res.json({ result });
});
```

**IsoBox with Pooling:**
```javascript
// Use pooling for better performance
const box = new IsoBox({
  usePooling: true,
  pool: { min: 5, max: 20 }
});

app.post('/execute', async (req, res) => {
  try {
    const result = await box.run(req.body.code);
    res.json({ result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dispose on shutdown
process.on('SIGTERM', async () => {
  await box.dispose();
  process.exit(0);
});
```

## Troubleshooting

### Issue: "Cannot find module 'vm2'"

After migration, old imports still reference vm2.

**Solution:**
```bash
# Search for vm2 references
grep -r "require('vm2')" src/
grep -r "from 'vm2'" src/

# Replace all
sed -i "s/require('vm2')/require('isobox')/g" src/**/*.js
```

### Issue: Code runs but doesn't work as expected

Context variables might not be passed correctly.

**Solution:**
```javascript
// VM2
const vm = new VM({ sandbox: { data: [1, 2, 3] } });
vm.run('data.length'); // Works

// IsoBox - context per execution
const box = new IsoBox();
await box.run('data.length', {
  sandbox: { data: [1, 2, 3] }  // Pass here
});
```

### Issue: Performance degradation

Creating/disposing boxes per request is expensive.

**Solution:**
```javascript
// Use pooling
const box = new IsoBox({
  usePooling: true,
  pool: { min: 5, max: 50 }
});

// Or use sessions
await box.createSession('session-id');
const session = box.getSession('session-id');
```

### Issue: Tests failing

Async/await changes might not be fully applied.

**Solution:**
```javascript
// Before
it('should execute code', () => {
  const result = vm.run('2 + 2');
  expect(result).toBe(4);
});

// After
it('should execute code', async () => {
  const box = new IsoBox();
  try {
    const result = await box.run('2 + 2');
    expect(result).toBe(4);
  } finally {
    await box.dispose();
  }
});
```

## Migration Checklist

- [ ] Install IsoBox: `npm install isobox`
- [ ] Uninstall VM2: `npm uninstall vm2`
- [ ] Update all imports
- [ ] Convert all execution methods to async
- [ ] Add `await box.dispose()` calls
- [ ] Update context passing to per-execution
- [ ] Update error handling for specific error types
- [ ] Update configuration options
- [ ] Add resource cleanup in finally blocks
- [ ] Update tests to be async
- [ ] Enable pooling for performance
- [ ] Test thoroughly with production-like data
- [ ] Monitor memory usage
- [ ] Update documentation

## Next Steps

- Read [Configuration Guide](./CONFIGURATION.md)
- Explore [Advanced Features](../advanced/)
- Check [Performance Tuning](../advanced/PERFORMANCE-TUNING.md)
- Review [Security Best Practices](../advanced/SECURITY-BEST-PRACTICES.md)

## Need Help?

- Check the [FAQ](../FAQ.md)
- Visit [Troubleshooting Guide](../TROUBLESHOOTING.md)
- Ask on [GitHub Discussions](https://github.com/yourusername/isobox/discussions)

---

**Successfully migrated?** Share your experience in our [migration showcase](https://github.com/yourusername/isobox/discussions)!
