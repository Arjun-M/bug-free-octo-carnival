# IsoBox

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/tests-235%20passing-brightgreen)](#testing)

> Production-grade JavaScript/TypeScript sandbox with strict timeouts, memory filesystem, and multi-file support

IsoBox is a secure, high-performance sandbox for executing untrusted JavaScript and TypeScript code with comprehensive resource controls, virtual filesystem access, and module resolution.

## Features

- **Secure Isolation**: Execute untrusted code in isolated V8 contexts
- **Resource Limits**: Enforce strict timeout, memory, and CPU limits
- **Virtual Filesystem**: In-memory filesystem with quota enforcement and permissions
- **Module Support**: Whitelist-based module resolution with mocking capabilities
- **TypeScript Support**: Built-in TypeScript transpilation
- **Session Management**: Persistent execution contexts with state management
- **Streaming Execution**: Support for async generators and streaming results
- **Connection Pooling**: Reusable isolate pools for high-throughput scenarios
- **Multi-file Projects**: Execute complex projects with multiple files
- **Security Logging**: Track and audit security violations
- **Error Sanitization**: Prevent information leakage through error messages
- **Performance Metrics**: Detailed execution metrics and profiling

## Installation

```bash
npm install isobox
```

### Prerequisites

- Node.js >= 18.0.0
- `isolated-vm` package (automatically installed as a dependency)

## Quick Start

### Basic Usage

```typescript
import { IsoBox } from 'isobox';

// Create a sandbox instance
const sandbox = new IsoBox({
  timeout: 5000,          // 5 second timeout
  memoryLimit: 128 * 1024 * 1024,  // 128MB memory limit
  cpuTimeLimit: 10000,    // 10 second CPU time limit
});

// Execute untrusted code
const result = await sandbox.run('return 1 + 1;');
console.log(result); // 2

// Clean up
await sandbox.dispose();
```

### With Filesystem Access

```typescript
const sandbox = new IsoBox({
  filesystem: {
    enabled: true,
    maxSize: 64 * 1024 * 1024, // 64MB
    root: '/',
  },
});

// Write files
sandbox.fs.write('/config.json', JSON.stringify({ key: 'value' }));

// Execute code that reads files
const code = `
  const fs = globalThis.__memfs;
  const config = JSON.parse(fs.read('/config.json').toString());
  return config.key;
`;

const result = await sandbox.run(code);
console.log(result); // 'value'
```

### With Module Support

```typescript
const sandbox = new IsoBox({
  require: {
    mode: 'whitelist',
    whitelist: ['lodash', 'moment'],
    mocks: {
      'custom-module': {
        hello: () => 'Hello from mock!',
      },
    },
  },
});

const code = `
  const _ = require('lodash');
  const custom = require('custom-module');
  return custom.hello() + ' ' + _.capitalize('world');
`;

const result = await sandbox.run(code);
```

### Session Management

```typescript
const sandbox = new IsoBox();

// Create a persistent session
const session = await sandbox.createSession('user-123', {
  ttl: 3600000,  // 1 hour
  persistent: true,
});

// Execute code in session context
await session.run('let counter = 0;');
await session.run('counter++;');
const result = await session.run('return counter;');
console.log(result); // 1

// List all sessions
const sessions = sandbox.listSessions();
```

### Multi-file Projects

```typescript
const sandbox = new IsoBox();

const result = await sandbox.runProject({
  files: [
    {
      path: 'src/utils.ts',
      code: 'export function add(a: number, b: number) { return a + b; }',
      language: 'typescript',
    },
    {
      path: 'src/index.ts',
      code: `
        import { add } from './utils';
        export default add(10, 20);
      `,
      language: 'typescript',
    },
  ],
  entrypoint: 'src/index.ts',
  timeout: 10000,
});

console.log(result); // 30
```

## API Documentation

### IsoBox Constructor

```typescript
new IsoBox(options?: IsoBoxOptions)
```

#### IsoBoxOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `timeout` | `number` | `5000` | Execution timeout in milliseconds |
| `cpuTimeLimit` | `number` | `10000` | CPU time limit in milliseconds |
| `memoryLimit` | `number` | `128MB` | Memory limit in bytes |
| `strictTimeout` | `boolean` | `true` | Enforce strict timeout regardless of operations |
| `usePooling` | `boolean` | `false` | Enable isolate connection pooling |
| `pool` | `PoolOptions` | - | Pool configuration |
| `filesystem` | `FilesystemOptions` | - | Virtual filesystem configuration |
| `require` | `RequireOptions` | - | Module resolution configuration |
| `security` | `SecurityOptions` | - | Security settings |
| `metrics` | `MetricsOptions` | - | Metrics collection settings |

### Core Methods

#### `run<T>(code: string, options?: RunOptions): Promise<T>`

Execute code in the sandbox.

```typescript
const result = await sandbox.run<number>('return 42;');
```

#### `compile(code: string): CompiledScript`

Pre-compile code for faster repeated execution.

```typescript
const script = sandbox.compile('return 1 + 1;');
// Execute later with better performance
```

#### `runProject<T>(project: ProjectOptions): Promise<T>`

Execute a multi-file project.

#### `runStream(code: string): AsyncIterable<any>`

Execute code with streaming results.

```typescript
for await (const chunk of sandbox.runStream(generatorCode)) {
  console.log(chunk);
}
```

#### `createSession(id: string, options?: SessionOptions): Promise<Session>`

Create a persistent execution session.

#### `dispose(): Promise<void>`

Clean up all resources. Always call this when done.

### Filesystem API

Access via `sandbox.fs`:

- `write(path: string, content: string | Buffer): void`
- `read(path: string): Buffer`
- `readdir(path: string): string[]`
- `mkdir(path: string, recursive?: boolean): void`
- `delete(path: string, recursive?: boolean): void`
- `exists(path: string): boolean`
- `stat(path: string): FileStats`
- `clear(): void`
- `getQuotaUsage(): QuotaUsage`

### Event System

```typescript
sandbox.on('execution', (event) => {
  console.log(`Execution ${event.type}: ${event.id}`);
});

sandbox.on('timeout', (event) => {
  console.error('Execution timed out:', event);
});

sandbox.on('resource-warning', (event) => {
  console.warn('Resource warning:', event);
});
```

## Configuration

### Security Options

```typescript
const sandbox = new IsoBox({
  security: {
    logViolations: true,
    sanitizeErrors: true,
    onSecurityEvent: (event) => {
      console.log('Security event:', event);
    },
  },
});
```

### Connection Pooling

For high-throughput scenarios:

```typescript
const sandbox = new IsoBox({
  usePooling: true,
  pool: {
    min: 2,
    max: 10,
    idleTimeout: 60000,
    warmupCode: 'const _ = require("lodash");', // Pre-load modules
  },
});

// Warm up the pool
await sandbox.warmupPool();
```

### TypeScript Support

```typescript
const sandbox = new IsoBox({
  typescript: {
    enabled: true,
    typeCheck: false, // Set to true for type checking
    strict: true,
    target: 'ES2022',
  },
});

await sandbox.run('const x: number = 42; return x;', {
  language: 'typescript',
});
```

## Testing

IsoBox comes with comprehensive unit tests covering critical components.

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Test Coverage

Current test coverage for core modules:

- **Filesystem**: 86.3% (MemFS, FileNode, Permissions)
- **Security**: 98.14% (ErrorSanitizer)
- **Core Types**: 100% (Error classes, type definitions)
- **Utilities**: 97.34% (AsyncQueue)
- **Overall**: 235 tests passing

## Development

### Project Structure

```
src/
├── core/              # Core sandbox implementation
│   ├── IsoBox.ts     # Main sandbox class
│   ├── types.ts      # Type definitions
│   └── CompiledScript.ts
├── execution/        # Code execution engine
│   ├── ExecutionEngine.ts
│   ├── TimeoutManager.ts
│   └── ResourceMonitor.ts
├── filesystem/       # Virtual filesystem
│   ├── MemFS.ts      # In-memory filesystem
│   ├── FileNode.ts
│   └── Permissions.ts
├── isolate/          # V8 isolate management
│   ├── IsolatePool.ts
│   └── IsolateManager.ts
├── modules/          # Module resolution
│   ├── ModuleSystem.ts
│   └── ImportResolver.ts
├── security/         # Security features
│   ├── ErrorSanitizer.ts
│   └── SecurityLogger.ts
├── session/          # Session management
│   └── SessionManager.ts
└── utils/            # Utility functions
    ├── AsyncQueue.ts
    └── Logger.ts
```

### Build

```bash
# Build for production
npm run build

# Build and watch for changes
npm run dev

# Type check
npm run type-check

# Lint
npm run lint

# Format code
npm run format
```

### Testing Conventions

When writing tests:

1. Use descriptive test names: `it('should return user when valid ID provided')`
2. Test happy paths, edge cases, and error conditions
3. Mock external dependencies appropriately
4. Keep tests isolated and independent
5. Aim for >80% code coverage

Example test structure:

```typescript
describe('Component', () => {
  describe('method', () => {
    it('should handle normal case', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = component.method(input);

      // Assert
      expect(result).toBe('expected');
    });

    it('should handle edge case', () => {
      // Test edge case
    });

    it('should throw error for invalid input', () => {
      expect(() => component.method(null)).toThrow();
    });
  });
});
```

## Security Considerations

### Sandbox Escape Prevention

IsoBox uses `isolated-vm` to provide true V8 isolate-level separation:

- No access to Node.js APIs by default
- No access to `require()`, `process`, `Buffer`, etc.
- Module access strictly controlled via whitelist
- Error messages sanitized to prevent information leakage

### Resource Limits

Always set appropriate limits:

```typescript
const sandbox = new IsoBox({
  timeout: 5000,        // Prevent infinite loops
  memoryLimit: 128 * 1024 * 1024,  // Prevent memory exhaustion
  cpuTimeLimit: 10000,  // Prevent CPU hogging
  filesystem: {
    maxSize: 64 * 1024 * 1024,  // Prevent disk exhaustion
  },
});
```

### Best Practices

1. **Always call `dispose()`** when done with a sandbox
2. **Set strict timeouts** for untrusted code
3. **Use whitelist mode** for module resolution
4. **Enable error sanitization** to prevent information leakage
5. **Monitor security events** via event listeners
6. **Validate input** before passing to sandbox
7. **Use connection pooling** for high-throughput scenarios
8. **Set appropriate memory limits** based on expected workload

## Performance Tips

### Use Compiled Scripts

For repeated execution of the same code:

```typescript
const script = sandbox.compile(code);
// Execute multiple times with better performance
await script.run(context, isolate);
```

### Enable Connection Pooling

For high-throughput scenarios:

```typescript
const sandbox = new IsoBox({
  usePooling: true,
  pool: { min: 5, max: 20 },
});
```

### Optimize Module Loading

Pre-load frequently used modules in warmup:

```typescript
await sandbox.warmupPool('const _ = require("lodash");');
```

## Troubleshooting

### Common Issues

#### Timeout Errors

If you're experiencing timeout errors:

1. Increase timeout: `timeout: 10000`
2. Use `strictTimeout: false` for non-critical scenarios
3. Check for infinite loops in user code

#### Memory Limit Errors

If hitting memory limits:

1. Increase `memoryLimit`
2. Check for memory leaks in user code
3. Reduce filesystem quota if not needed

#### Module Not Found

If modules aren't resolving:

1. Ensure module is in `whitelist`
2. Check module name spelling
3. Verify `require.mode` is set correctly

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Write tests for new functionality
4. Ensure all tests pass: `npm test`
5. Follow the existing code style
6. Submit a pull request

### Code Review Process

- All PRs require passing tests
- Maintain or improve code coverage
- Follow TypeScript best practices
- Document new features and APIs
- Add examples for new functionality

## License

MIT License - see [LICENSE](LICENSE) file for details

## Credits

Created by Arjun-M

Built with:
- [isolated-vm](https://github.com/laverdet/isolated-vm) - Secure V8 isolate implementation
- [TypeScript](https://www.typescriptlang.org/) - Type-safe development
- [Vitest](https://vitest.dev/) - Lightning-fast unit testing

## Support

- Issues: [GitHub Issues](https://github.com/Arjun-M/Isobox/issues)
- Discussions: [GitHub Discussions](https://github.com/Arjun-M/Isobox/discussions)

## Changelog

### v1.0.0

- Initial release
- Secure JavaScript/TypeScript execution
- Virtual filesystem with quota management
- Module resolution with whitelist support
- Session management
- Connection pooling
- Comprehensive test suite
- Full TypeScript support
