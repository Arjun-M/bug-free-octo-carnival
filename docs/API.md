# API.md - IsoBox Complete API Reference

## Table of Contents

1. [Core Classes](#core-classes)
2. [Execution Options](#execution-options)
3. [Session Management](#session-management)
4. [Module System](#module-system)
5. [Streaming](#streaming)
6. [Metrics & Monitoring](#metrics--monitoring)
7. [Security](#security)
8. [Utilities](#utilities)

---

## Core Classes

### IsoBox

Main class for executing isolated code.

#### Constructor

```typescript
new IsoBox(options?: IsoBoxOptions)
```

**Options:**
```typescript
interface IsoBoxOptions {
  // Execution settings
  execution?: {
    timeout?: number;        // Default timeout in ms (30000)
    memory?: {
      max?: number;          // Max heap in bytes
    };
  };
  
  // Module/Require settings
  require?: {
    whitelist?: string[];    // Whitelisted modules
    mocks?: Record<string, any>;  // Module mocks
  };
  
  // Pooling
  pool?: {
    min?: number;            // Min isolates (2)
    max?: number;            // Max isolates (10)
    idleTimeout?: number;    // Idle timeout ms
  };
  
  // Context settings
  context?: {
    globals?: Record<string, any>;
    env?: Record<string, string>;
  };
}
```

#### Methods

**`run(code: string, options?: ExecutionOptions): Promise<any>`**

Execute code and return result.

```typescript
const result = await isobox.run('1 + 2');
// result = 3
```

**`runStream(code: string, options?: ExecutionOptions): AsyncIterable<any>`**

Execute code with streaming output.

```typescript
for await (const value of isobox.runStream('yield 1; yield 2')) {
  console.log(value); // 1, 2
}
```

**`runProject(project: ProjectOptions): Promise<any>`**

Execute multi-file project.

```typescript
const result = await isobox.runProject({
  files: [
    { path: '/index.js', code: 'require("./utils").add(1, 2)' },
    { path: '/utils.js', code: 'module.exports = { add: (a,b) => a+b }' }
  ],
  entrypoint: '/index.js'
});
// result = 3
```

**`createSession(id: string, options?: SessionOptions): Session`**

Create persistent session.

```typescript
const session = isobox.createSession('user-1');
await session.run('x = 10');
const result = await session.run('x + 5');
// result = 15
```

**`getMetrics(): GlobalMetrics`**

Get global execution metrics.

```typescript
const metrics = isobox.getMetrics();
// {
//   total: 100,
//   errors: 2,
//   avgDuration: 45,
//   ...
// }
```

**`on(event: string, handler: Function): void`**

Register event listener.

```typescript
isobox.on('security:violation', (event) => {
  console.log(`Security: ${event.type}`);
});
```

**`warmupPool(): Promise<void>`**

Pre-allocate isolates.

```typescript
await isobox.warmupPool();
```

**`shutdown(): Promise<void>`**

Clean up resources.

```typescript
await isobox.shutdown();
```

---

## Execution Options

### ExecutionOptions

```typescript
interface ExecutionOptions {
  // Identification
  filename?: string;        // For error messages
  
  // Control
  timeout?: number;         // Execution timeout (ms)
  
  // Context
  context?: any;            // Execution context variables
}
```

### ExecutionResult

```typescript
interface ExecutionResult {
  value: any;              // Return value
  duration: number;        // Execution time (ms)
  memory?: number;         // Memory used (bytes)
  type: string;            // Result type
}
```

---

## Session Management

### Session

Persistent isolated execution environment.

#### Methods

**`run(code: string, options?: ExecutionOptions): Promise<any>`**

Execute code with preserved state.

```typescript
await session.run('let counter = 0');
await session.run('counter++');
await session.run('counter++');
const result = await session.run('counter');
// result = 2
```

**`setState(state: Record<string, any>): void`**

Set session context variables.

```typescript
session.setState({ username: 'alice', role: 'admin' });
const result = await session.run('username'); // 'alice'
```

**`getState(): Record<string, any>`**

Get current session state.

```typescript
const state = session.getState();
```

**`reset(): void`**

Clear session state.

```typescript
session.reset();
```

---

## Module System

### ModuleSystem

Handles require/import statements.

```typescript
const moduleSystem = new ModuleSystem({
  whitelist: ['lodash', 'moment', '@scope/*'],
  mocks: { fs: mockFS }
});

const required = moduleSystem.require('lodash');
```

#### Methods

**`require(moduleName: string): any`**

Load required module.

```typescript
const lodash = moduleSystem.require('lodash');
```

**`isWhitelisted(moduleName: string): boolean`**

Check if module is whitelisted.

```typescript
if (moduleSystem.isWhitelisted('lodash')) {
  // Safe to require
}
```

**`isMocked(moduleName: string): boolean`**

Check if module is mocked.

```typescript
if (moduleSystem.isMocked('fs')) {
  // Using mock
}
```

---

## Streaming

### StreamBuffer

Buffer with backpressure support.

```typescript
const buffer = new StreamBuffer<number>({
  maxSize: 1000,
  highWaterMark: 800,
  lowWaterMark: 200
});

buffer.on('pause', () => console.log('Paused'));
buffer.on('resume', () => console.log('Resumed'));
```

#### Methods

**`push(item: T): boolean`**

Add item to buffer.

```typescript
const canContinue = buffer.push(42);
```

**`shift(): T | undefined`**

Remove and return item.

```typescript
const item = buffer.shift();
```

**`getStats(): BufferStats`**

Get buffer statistics.

```typescript
const stats = buffer.getStats();
// { size: 500, maxSize: 1000, isPaused: false }
```

---

## Metrics & Monitoring

### MetricsCollector

Tracks execution metrics.

```typescript
const metrics = new MetricsCollector();

isobox.on('metrics:recorded', (m) => {
  console.log(`Duration: ${m.duration}ms`);
});
```

#### Methods

**`getMetrics(): GlobalMetrics`**

Get aggregate metrics.

```typescript
const metrics = isobox.getMetrics();
// {
//   executions: 1000,
//   errors: 5,
//   avgDuration: 45,
//   peakMemory: 128MB,
//   errorRate: 0.005
// }
```

**`getHistory(limit?: number): ExecutionMetrics[]`**

Get recent execution metrics.

```typescript
const last10 = metricsCollector.getHistory(10);
```

### PerformanceMetrics

```typescript
const perf = new PerformanceMetrics({
  executionTime: 5000,
  memory: 128 * 1024 * 1024
});

perf.start();
perf.recordMetric('duration', 45, 'ms');
const stats = perf.getMetricStats('duration');
```

### MemoryTracker

```typescript
const memTracker = new MemoryTracker(100); // 100ms interval

memTracker.start();
// ... code ...
memTracker.stop();

const stats = memTracker.getStats();
const hasLeak = memTracker.detectLeak();
```

---

## Security

### SecurityLogger

Logs security events.

```typescript
isobox.on('security:violation', (event) => {
  // event.type: string
  // event.severity: 'info' | 'warn' | 'error' | 'critical'
  // event.timestamp: Date
  // event.context: Record<string, any>
});
```

### Validators

Static validation utilities.

```typescript
import { Validators } from 'isobox';

Validators.validateCode(userCode);
Validators.validateModuleName('lodash');
Validators.validatePath('/src/file.js');
Validators.validateOptions(executionOptions);
```

---

## Utilities

### EventEmitter

Simple event system.

```typescript
const emitter = new EventEmitter();

emitter.on('event', (data) => {
  console.log(data);
});

emitter.emit('event', { message: 'hello' });
```

#### Methods

**`on(event: string, handler: Function): void`**

Register listener.

**`off(event: string, handler: Function): void`**

Remove listener.

**`emit(event: string, ...args: any[]): void`**

Emit event.

**`once(event: string, handler: Function): void`**

Register one-time listener.

### Logger

Logging utility.

```typescript
import { logger } from 'isobox';

logger.debug('Debug message');
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message');
```

---

## Type Definitions

### ExecutionMetrics

```typescript
interface ExecutionMetrics {
  duration: number;
  memory: number;
  cpuUsage: number;
  errorCount: number;
  timestamp: Date;
  context?: Record<string, any>;
}
```

### GlobalMetrics

```typescript
interface GlobalMetrics {
  executions: number;
  errors: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  peakMemory: number;
  errorRate: number;
  totalDuration: number;
}
```

### ProjectFile

```typescript
interface ProjectFile {
  path: string;
  code: string;
  language?: 'javascript' | 'typescript';
}
```

### ProjectOptions

```typescript
interface ProjectOptions {
  files: ProjectFile[];
  entrypoint: string;
  baseDir?: string;
}
```

---

## Examples

### Simple Execution

```typescript
const isobox = new IsoBox();
const result = await isobox.run('2 + 2');
console.log(result); // 4
```

### With Timeout

```typescript
const result = await isobox.run(userCode, {
  timeout: 5000,
  filename: 'user-script.js'
});
```

### With Module Whitelist

```typescript
const isobox = new IsoBox({
  require: {
    whitelist: ['lodash', 'moment'],
    mocks: { fs: mockFS }
  }
});
```

### Sessions

```typescript
const session = isobox.createSession('workflow-1');

await session.run('const data = []');
await session.run('data.push(1)');
await session.run('data.push(2)');

const result = await session.run('data.length'); // 2
```

### Streaming

```typescript
for await (const chunk of isobox.runStream('
  yield 1;
  yield 2;
  yield 3;
')) {
  console.log(chunk);
}
```

### Metrics

```typescript
isobox.on('metrics:recorded', (metrics) => {
  if (metrics.duration > 1000) {
    console.warn('Slow execution:', metrics);
  }
});

const globalMetrics = isobox.getMetrics();
console.log(`Error rate: ${globalMetrics.errorRate}`);
```

---

**Last Updated**: December 2025
**Version**: 1.0.0
