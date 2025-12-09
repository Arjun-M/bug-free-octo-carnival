# ARCHITECTURE.md - IsoBox System Architecture

## Overview

IsoBox is a production-grade JavaScript/TypeScript sandbox library built on isolated-vm for secure, isolated code execution with comprehensive resource management, streaming support, and metrics tracking.

## System Architecture

```
┌─────────────────────────────────────────┐
│         Public API (IsoBox)             │
├─────────────────────────────────────────┤
│  ├─ run()                               │
│  ├─ runStream()                         │
│  ├─ runProject()                        │
│  ├─ createSession()                     │
│  └─ Events: metrics, security, errors   │
└────────┬────────────────────────────────┘
         │
    ┌────┴────────────────────────────────┐
    │                                      │
┌───▼──────────────────┐  ┌──────────────▼─────┐
│  Session Manager     │  │   Isolate Pool     │
│  ├─ State Storage    │  │   ├─ Min/Max       │
│  ├─ TTL Management   │  │   ├─ Reuse         │
│  └─ Isolation        │  │   └─ Auto-scale    │
└───┬──────────────────┘  └────────┬──────────┘
    │                              │
    └───────────────┬──────────────┘
                    │
         ┌──────────▼──────────────┐
         │ Execution Engine        │
         │ ├─ Code Compilation     │
         │ ├─ Context Building     │
         │ ├─ Timeout Management   │
         │ └─ Error Handling       │
         └──────────┬──────────────┘
                    │
    ┌───────────────┼───────────────┐
    │               │               │
┌───▼────────┐ ┌───▼────────┐ ┌───▼────────┐
│  Module    │ │  Streaming │ │  Metrics & │
│  System    │ │  System    │ │  Security  │
│ ├─ Require │ │ ├─ Gener.  │ │ ├─ Logger  │
│ ├─ Imports │ │ ├─ Async   │ │ ├─ Events  │
│ └─ Cache   │ │ └─ Buffer  │ │ └─ Validators
└────────────┘ └────────────┘ └────────────┘
    │               │               │
┌───▼────────────────┴───────────────▼──────┐
│        Context & Globals Management       │
│ ├─ Safe Whitelist                         │
│ ├─ Console Handling                       │
│ ├─ Environment Variables                  │
│ └─ Custom Globals Injection               │
└─────────────────┬──────────────────────────┘
                  │
    ┌─────────────┴──────────────┐
    │                            │
┌───▼──────────────┐ ┌──────────▼──────────┐
│   Virtual MemFS  │ │  Compiled Scripts   │
│ ├─ In-Memory FS  │ │  ├─ Cache           │
│ ├─ Permissions   │ │  ├─ Serialization   │
│ └─ Monitoring    │ │  └─ Reuse           │
└──────────────────┘ └─────────────────────┘
```

## Component Hierarchy

### 1. **Core Layer** (`src/core/`)

**IsoBox** - Main facade
- Orchestrates all subsystems
- Manages lifecycle
- Exposes public API
- Coordinates sessions and pooling

**ExecutionTypes** - Type definitions
- Shared interfaces
- Configuration options
- Result structures

**CompiledScript** - Script caching
- Serializes compiled code
- Prevents recompilation
- Improves performance

### 2. **Execution Layer** (`src/execution/`)

**ExecutionEngine** - Code execution
- Compiles TypeScript to JavaScript
- Handles syntax validation
- Manages execution flow
- Coordinates with other components

**ExecutionContext** - Execution state
- Manages V8 context
- Handles variable binding
- Tracks execution state
- Provides isolation

**TimeoutManager** - Timeout enforcement
- Strict timeout implementation
- Infinite loop detection
- Async timeout handling
- Proper cleanup

**ResourceMonitor** - Resource tracking
- CPU/Memory monitoring
- Quota enforcement
- Statistical collection
- Peak tracking

### 3. **Isolate Management** (`src/isolate/`)

**IsolatePool** - Isolate pooling
- Creates/reuses isolates
- Auto-scaling logic
- Idle timeout handling
- Load balancing

**PooledIsolate** - Isolate wrapper
- Lifecycle management
- Resource isolation
- State tracking
- Cleanup handling

**PoolStats** - Pool statistics
- Allocation tracking
- Performance metrics
- Utilization monitoring

### 4. **Session Management** (`src/session/`)

**SessionManager** - Session lifecycle
- Create/destroy sessions
- TTL management
- Session lookup
- Cleanup on expiry

**StateStorage** - Persistent state
- Variable storage
- State serialization
- State recovery
- Scope isolation

### 5. **Module System** (`src/modules/`)

**ModuleSystem** - Require/import
- Handles require() calls
- Validates module names
- Manages mocks
- Enforces whitelist

**ModuleCache** - Module caching
- Caches loaded modules
- Hit/miss tracking
- Cache invalidation
- Performance optimization

**CircularDeps** - Cycle detection
- Detects circular dependencies
- Prevents infinite loops
- Provides error messages

**RequireResolver** - Module resolution
- Resolves module paths
- Handles built-ins
- Resolves from node_modules
- Virtual module support

### 6. **Virtual Filesystem** (`src/filesystem/`)

**MemFS** - In-memory filesystem
- File CRUD operations
- Directory structure
- Path validation
- Quota enforcement

**FileNode** - File representation
- Content storage
- Metadata tracking
- Permissions handling
- Access control

**FileMetadata** - File metadata
- Timestamps
- Ownership
- Permissions
- Statistics

**FSWatcher** - Change monitoring
- File change detection
- Event emission
- Listener management

**Permissions** - Access control
- Read/write/execute checks
- User ownership
- Permission enforcement
- Quota limits

### 7. **Project Support** (`src/project/`)

**ProjectLoader** - Project loading
- Validates project structure
- Loads multi-file projects
- Resolves entrypoints
- Error handling

**ProjectBuilder** - Virtual FS setup
- Builds file tree
- Creates directories
- Writes files
- Collects stats

**TypeScriptCompiler** - TS compilation
- Transpiles TypeScript
- Type annotation removal
- Syntax validation
- Error handling

**ImportResolver** - Import resolution
- Resolves relative imports
- Resolves absolute imports
- Resolves node modules
- Path normalization

### 8. **Streaming** (`src/streaming/`)

**StreamExecutor** - Streaming execution
- Executes generators
- Handles async generators
- Yields results
- Error propagation

**GeneratorHandler** - Generator utilities
- Detects generators
- Extracts iterators
- Timeout enforcement
- Buffer management

**StreamBuffer** - Stream buffering
- Backpressure handling
- Buffer management
- Pause/resume support
- Statistics

### 9. **Context & Globals** (`src/context/`)

**ContextBuilder** - Context setup
- Initializes V8 context
- Injects globals
- Sets up console
- Configures environment

**GlobalsInjector** - Safe globals
- Provides safe built-ins
- Filters dangerous globals
- Enforces whitelist
- Custom globals support

**ConsoleHandler** - Console redirection
- Captures console output
- Routes to logger
- Supports buffering
- Event emission

**EnvHandler** - Environment variables
- Provides env access
- Validates access
- Prevents sensitive leaks

### 10. **Metrics & Monitoring** (`src/metrics/`)

**MetricsCollector** - Metrics aggregation
- Tracks executions
- Calculates statistics
- Event emission
- History management

**PerformanceMetrics** - Performance tracking
- Records metrics
- Threshold checking
- Statistical analysis
- JSON export

**MemoryTracker** - Memory profiling
- Snapshots memory
- Leak detection
- Growth rate calculation
- Heap analysis

### 11. **Security** (`src/security/`)

**SecurityLogger** - Event logging
- Logs violations
- Filters events
- Maintains history
- Event emission

**Validators** - Input validation
- Code syntax checking
- Module name validation
- Path validation
- Options validation

**ErrorSanitizer** - Error safety
- Removes sensitive info
- Path obfuscation
- Error message cleaning
- Stack trace handling

### 12. **Utilities** (`src/utils/`)

**EventEmitter** - Event system
- Pub/sub pattern
- Listener management
- Error isolation

**Logger** - Logging utility
- Configurable levels
- Formatted output
- Context support

**Timer** - Timeout utility
- Precise timing
- Cleanup support

**AsyncQueue** - Async task queue
- Task queuing
- Execution ordering
- Error handling

**ObjectUtils** - Object utilities
- Deep cloning
- Serialization
- Type checking

## Data Flow

### Simple Execution Flow

```
User Code
    ↓
IsoBox.run()
    ↓
Get/Create Isolate from Pool
    ↓
Create V8 Context
    ↓
Build Context (globals, console, env)
    ↓
Compile Code (TS → JS)
    ↓
Setup Module System
    ↓
Setup Timeout
    ↓
Execute in V8
    ↓
Collect Metrics
    ↓
Log Events
    ↓
Return Result
    ↓
Release Isolate to Pool
```

### Project Execution Flow

```
Project Definition
    ↓
Validate Files
    ↓
Load TypeScript Compiler
    ↓
Create MemFS
    ↓
Build Virtual FS
    ↓
Write All Files
    ↓
Setup Module System (with ImportResolver)
    ↓
Get Entrypoint Code
    ↓
Execute (like simple flow)
```

### Streaming Flow

```
Generator Code
    ↓
Execute Setup
    ↓
Detect Generator
    ↓
Get Iterator
    ↓
Loop: next()
    ↓
Yield Value
    ↓
Check Timeout
    ↓
Return to User
    ↓
(Repeat until done)
```

## Key Design Patterns

### 1. **Pooling Pattern**
- Reuses expensive resources (isolates)
- Auto-scaling based on load
- Idle timeout cleanup
- Performance optimization

### 2. **Event System**
- Decoupled communication
- Security event logging
- Metrics collection
- External integration

### 3. **Whitelist Security**
- Explicit allowlist (not blacklist)
- Pattern matching (wildcards)
- Module mocking support
- Global filtering

### 4. **Isolation Layers**
- V8 Isolate (memory isolation)
- V8 Context (scope isolation)
- Session isolation (state)
- Module isolation (code)

### 5. **Timeout Enforcement**
- Strict CPU time limits
- Async-aware (catches awaits)
- Proper cleanup on timeout
- Prevents infinite loops

### 6. **Resource Monitoring**
- Per-execution tracking
- Aggregate statistics
- Peak detection
- Quota enforcement

## Performance Characteristics

### Memory Usage

```
Per Isolate: ~40MB (V8 heap allocation)
Per Context: ~10KB (minimal)
Per Session: O(state_size)
Per String: ~56 bytes (V8 overhead)

With Pooling (5 isolates):
  Total: ~200MB
  Amortized per execution: ~5-10MB
```

### Execution Time

```
Cold Start (new isolate):    ~50ms
Pool Reuse (cached):         ~5ms
Code Compilation (TS→JS):    ~10ms
Average with pool:           ~25ms
Streaming (per item):        ~1ms
```

### Scaling

```
Sequential: O(n) time
Pooled: O(n/pool_size) time
Streaming: O(1) memory per item
Projects: O(file_count) setup time
```

## Security Architecture

### Layers

1. **Code Level**: Input validation, sanitization
2. **VM Level**: V8 isolate isolation
3. **Context Level**: Safe globals, whitelist
4. **Module Level**: Whitelist, mocking
5. **Filesystem Level**: Virtual MemFS
6. **Monitoring Level**: Security logging

### Threat Mitigation

| Threat | Layer | Mechanism |
|--------|-------|-----------|
| Code injection | VM | Isolate isolation |
| Resource exhaustion | Execution | Timeout + quotas |
| FS access | Filesystem | MemFS + whitelist |
| Module loading | Module | Whitelist + validation |
| Global escape | Context | Safe globals |
| Process escape | Context | No process access |
| Network access | Context | No network APIs |
| Side channels | Monitoring | Security logging |

## Extension Points

### Custom Globals

```typescript
const isobox = new IsoBox({
  context: {
    globals: {
      customAPI: myAPI
    }
  }
});
```

### Module Mocking

```typescript
const isobox = new IsoBox({
  require: {
    mocks: {
      'fs': mockFS,
      'http': mockHTTP
    }
  }
});
```

### Event Hooks

```typescript
isobox.on('metrics:recorded', handler);
isobox.on('security:violation', handler);
isobox.on('error', handler);
```

### Sessions

```typescript
const session = isobox.createSession('id');
session.setState({ data: value });
// State persists across executions
```

## Testing Architecture

### Unit Tests
- Individual component testing
- Mocked dependencies
- Edge case coverage

### Integration Tests
- Component interaction testing
- Real isolate usage
- Lifecycle testing

### Security Tests
- Escape attempt testing
- Isolation verification
- Resource limit testing

### Performance Tests
- Execution benchmarks
- Memory profiling
- Scaling tests

---

**Last Updated**: December 2025
**Version**: 1.0.0
