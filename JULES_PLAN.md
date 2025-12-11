# IsoBox Jules AI Agent - Complete Debugging & Implementation Plan

**Repository:** Arjun-M/bug-free-octo-carnival  
**Project:** IsoBox - High-Performance JavaScript/TypeScript Sandbox  
**Status:** Pre-MVP, 0 Test Coverage, Multiple Critical Bugs  
**Timeline:** 5 Phases over 2-3 weeks

---

## 🔴 ADDITIONAL CRITICAL ERRORS FOUND (Beyond Previous Analysis)

### ERROR #1: Virtual Module Execution DISABLED (Line in ModuleSystem.ts)
```typescript
// In src/modules/ModuleSystem.ts - loadVirtual() method:
logger.warn(`Virtual module execution skipped (VM required): ${path}`);
return moduleContext.exports;
```
**Problem:** When user requires a file from virtual filesystem:
- Code is never executed
- Returns empty `exports` object
- Module system completely broken
- README promises multi-file projects but they can't work

**Impact:** `sandbox.runProject()` will fail silently - files load but code never runs

---

### ERROR #2: Missing `require()` Injection Into Sandbox
```typescript
// In src/core/IsoBox.ts - run() method:
// The context is created but require() is NEVER injected
const context = isolate.createContextSync();
// ... later context injection code doesn't include require()

// User code will do: require('lodash')
// Result: "require is not defined" error
```
**Problem:** Even if ModuleSystem.require() works, sandbox code can't call it
- No `require()` function in global scope
- No `module` object
- Module system is completely inaccessible from user code

**Impact:** All require() calls fail with ReferenceError

---

### ERROR #3: TypeScript Compilation Never Actually Happens
```typescript
// In src/core/IsoBox.ts - run() method:
await sandbox.run(code, {
  language: 'typescript',  // User passes this
  timeout: 10000
});

// But then:
const result = await this.executionEngine.execute<T>(code, isolate, context, {
  // ^^^ 'code' is still TypeScript - NEVER transpiled!
});
```
**Problem:** No transpilation logic anywhere
- TypeScript code sent directly to V8
- V8 throws "SyntaxError: Unexpected token :"
- `typescript` option in config is ignored

**Impact:** All TypeScript code fails with syntax errors

---

### ERROR #4: IsolatePool Completely Disconnected
```typescript
// In src/core/IsoBox.ts - run() method:
if (this.isolatePool) {
  result = await this.isolatePool.execute<T>(code, { 
    timeout: opts.timeout ?? this.timeout 
  });
}
```
**Problem:** 
- Pool.execute() doesn't receive context, FS, or module system
- Pool isolates have no globals/console/fs injected
- Code in pool runs with bare V8 context (no sandbox features!)
- Pool runs code but ignores memfs, modules, security

**Impact:** Using pooling completely breaks all sandbox features

---

### ERROR #5: CompiledScript Class is Empty
```typescript
// In src/core/CompiledScript.ts:
export class CompiledScript {
  // Class exists but implementation is stub
  // compile() method returns new CompiledScript(code, code, 'javascript')
  // But no actual compilation happens
  // No caching
  // No performance benefits vs run() every time
}
```
**Problem:**
- `sandbox.compile()` doesn't actually compile anything
- Returns object but `executeScript()` can't use it properly
- Defeats purpose of pre-compilation for performance

**Impact:** Performance feature is non-functional

---

### ERROR #6: Session State Not Persisted Between Executions
```typescript
// In SessionManager and Session interface:
// There's NO connection between session execution context and state
// Each run() creates fresh isolate, fresh context
// State declared but never actually stored/restored
```
**Problem:**
```typescript
const session = await sandbox.createSession('user-123');
await session.run('let x = 5;');  // Sets x
await session.run('return x + 1;'); // Error: x is undefined
```
- Each execution is truly isolated (good for security, bad for feature)
- State would require persistent isolate per session
- Current architecture doesn't support this

**Impact:** Session persistent state feature doesn't work

---

### ERROR #7: Streaming Completely Fake
```typescript
// In src/core/IsoBox.ts - runStream():
async *runStream(code: string): AsyncIterable<any> {
  yield { type: 'start', ... };
  const result = await this.run(code);  // ← Single run() call
  yield { type: 'result', value: result, ... };
  yield { type: 'end', ... };
}
```
**Problem:**
- Doesn't support generator code at all
- Doesn't execute async generators
- Just wraps single run() with event headers
- User expects: `for await (const value of sandbox.runStream(generatorCode))`
- Actually gets: single result in result event

**Impact:** Streaming feature is marketing fiction

---

### ERROR #8: Metrics Collection is Phantom
```typescript
// In src/core/IsoBox.ts:
private recordMetrics(duration: number, cpuTime: number, memory: number): void {
  this.globalMetrics.totalExecutions++;
  // ... updates to metrics
}

// But recordMetrics() is NEVER called!
// In run() method: this.recordMetrics(timeout, 0, 0);
//                  ^^^^^^ All values are 0 or placeholder!
```
**Problem:**
- CPU time always 0 (never measured from ResourceMonitor)
- Memory always 0 (never captured)
- Duration is timeout, not actual execution time
- Metrics are completely fake

**Impact:** All metrics are 0 or placeholder values

---

### ERROR #9: Error Sanitization Not Connected
```typescript
// In ExecutionEngine.ts:
const sanitizedError = this.errorSanitizer.sanitize(error, code);
// sanitizedError is created but ErrorSanitizer class is empty

// In IsoBox.ts:
throw errorObj;  // Error is thrown to user unsanitized
// Error message might expose:
// - Full file paths from filesystem
// - Variable names from user's code
// - Internal implementation details
```
**Problem:**
- ErrorSanitizer class exists but has no logic
- Errors thrown to user contain sensitive information
- Stack traces expose sandbox internals

**Impact:** Information leakage security vulnerability

---

### ERROR #10: Resource Monitor Monitoring Doesn't Work
```typescript
// In src/execution/ExecutionEngine.ts:
const resourceId = this.resourceMonitor.startMonitoring(
  isolate,
  executionId,
  options.cpuTimeLimit,
  options.memoryLimit
);
// ResourceMonitor exists but doesn't actually:
// - Track CPU time
// - Enforce memory limits
// - Measure resource usage
// - Provide real stats
```
**Problem:**
- Memory/CPU limits are SET but not ENFORCED
- User code can consume unlimited memory
- User code can consume unlimited CPU
- Timeout is only resource enforcement that works

**Impact:** Memory/CPU limit features don't actually limit resources

---

### ERROR #11: No npm Test Script (Beyond Previous Point)
```json
// package.json missing crucial test infrastructure:
{
  "scripts": {
    // "test": "jest"  ← MISSING!
    // "test:watch": "jest --watch"  ← MISSING!
    // "test:coverage": "jest --coverage"  ← MISSING!
  }
}
// jest.config.cjs exists but:
// - No test files match pattern
// - npm test would fail with "Jest exited with code 1"
// - CI/CD has nothing to run
```

**Impact:** Can't run any tests in CI/CD pipeline

---

### ERROR #12: Missing `.npmignore`
```
// No .npmignore file means npm publish includes:
- /src directory (unnecessary, users get compiled dist)
- /test directory (bloats package, 500KB+)
- /.eslintrc.json (not needed)
- /jest.config.cjs (not needed)
- /tsconfig.json (not needed)
- /tsup.config.ts (not needed)
- /node_modules (forbidden by npm, but no ignore rule)

// Published package will be 2-3MB instead of 100KB
```

**Impact:** npm package will be bloated, slow to download

---
 
### ERROR #13: GitHub Repository URL Wrong
```json
// In package.json:
{
  "repository": {
    "type": "git",
    "url": "Arjun-M/Isobox"  // ← WRONG! This is a path, not a full URL
  }
}
// Should be:
{
  "repository": {
    "type": "git",
    "url": "https://github.com/Arjun-M/bug-free-octo-carnival"
  }
}
```

**Impact:** npm registry can't link to source repo, package metadata broken

---

## SUMMARY OF ALL CRITICAL ERRORS

| Error # | File | Issue | Severity |
|---------|------|-------|----------|
| 1 | ModuleSystem.ts | Virtual modules never execute | 🔴 BLOCKER |
| 2 | IsoBox.ts | require() not injected into sandbox | 🔴 BLOCKER |
| 3 | IsoBox.ts | TypeScript never transpiled | 🔴 BLOCKER |
| 4 | IsoBox.ts | Pool disconnected from features | 🔴 BLOCKER |
| 5 | CompiledScript.ts | No actual compilation | 🔴 BLOCKER |
| 6 | SessionManager.ts | Session state not persistent | 🟠 HIGH |
| 7 | IsoBox.ts | Streaming is fake | 🟠 HIGH |
| 8 | IsoBox.ts | Metrics all zeros | 🟠 HIGH |
| 9 | ErrorSanitizer.ts | No sanitization logic | 🟠 HIGH |
| 10 | ResourceMonitor.ts | Limits not enforced | 🟠 HIGH |
| 11 | package.json | No test script | 🟠 HIGH |
| 12 | (missing) | No .npmignore | 🟡 MEDIUM |
| 13 | package.json | Wrong repo URL | 🟡 MEDIUM |

---

## 📋 PHASE 1: FOUNDATION & TESTING SETUP (3-4 Days)

### Phase 1 Objectives
1. Set up complete test infrastructure
2. Write core functionality tests
3. Identify remaining issues through test failures
4. Create baseline for regression testing

### Files to Create/Modify
```
✓ package.json              - Add test scripts
✓ jest.config.cjs          - Already exists, needs validation
✓ .npmignore              - Create (new file)
✓ test/core/IsoBox.test.ts - Create comprehensive tests
✓ test/core/basic-execution.test.ts
✓ test/security/sandbox-escape.test.ts
✓ test/fixtures/           - Create test fixtures
```

---

## JULES AI PROMPT - PHASE 1: TEST INFRASTRUCTURE SETUP

### Prompt 1.1: Set Up Testing Infrastructure

**File Target:** `package.json` (UPDATE existing)  
**Instruction Level:** Specific line modifications required

```
TASK: Update package.json with complete testing configuration

CONTEXT:
The IsoBox project has zero test coverage. We need to add Jest testing with 
proper npm scripts and configuration so tests can run in CI/CD.

CURRENT STATE:
- jest.config.cjs exists but no test runner configured in package.json
- No npm test, test:watch, or test:coverage scripts
- devDependencies have jest and ts-jest but npm test will fail

REQUIRED CHANGES:

1. Add "test" scripts to package.json scripts section:
   - "test": "jest" (run all tests once)
   - "test:watch": "jest --watch" (run tests in watch mode during development)
   - "test:coverage": "jest --coverage" (run tests with coverage report)
   - "test:ci": "jest --ci --coverage" (run tests in CI environment)

2. Modify jest.config.cjs to:
   - Change testMatch pattern to: ["<rootDir>/test/**/*.test.ts"]
   - Add testPathIgnorePatterns: ["/node_modules/", "/dist/"]
   - Add moduleNameMapper for path aliases if needed
   - Set collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts"]
   - Set coverageThreshold.global.lines to 20% (start low, increase)

3. Create .npmignore file with:
   - src/
   - test/
   - docs/
   - .eslintrc.json
   - jest.config.cjs
   - tsconfig.json
   - tsup.config.ts
   - CONTRIBUTING.md
   - SECURITY.md
   - CODE_OF_CONDUCT.md

4. Fix repository URL in package.json:
   - Change "url": "Arjun-M/Isobox" 
   - To: "url": "https://github.com/Arjun-M/bug-free-octo-carnival.git"
   - Add "homepage": "https://github.com/Arjun-M/bug-free-octo-carnival#readme"
   - Add "bugs": {"url": "https://github.com/Arjun-M/bug-free-octo-carnival/issues"}

5. Ensure these devDependencies are present (they already are):
   - "jest": "^29.7.0"
   - "ts-jest": "^29.4.6"
   - "@types/jest": "^29.5.14"

VALIDATION:
After changes, running:
- npm test (should start jest)
- npm run test:coverage (should generate coverage report)
- npm run test:watch (should watch for file changes)

Both should work without errors. Test files don't need to exist yet for scripts
to be valid - Jest will just report "no tests found".

OUTPUT:
Provide the complete updated package.json with all changes integrated.
Do not remove existing configuration, only add/modify what's specified above.
```

---

### Prompt 1.2: Create Core Integration Test File

**File Target:** `test/core/IsoBox.test.ts` (NEW FILE)  
**Instruction Level:** Complete test file with specific test cases

```
TASK: Create comprehensive integration tests for IsoBox core functionality

CONTEXT:
We need to test that the IsoBox sandbox actually works as documented.
These are integration tests that verify:
1. Basic code execution
2. Timeout enforcement
3. Memory limit enforcement
4. Error handling
5. Sandbox isolation

These tests will reveal implementation gaps we can then fix.

REQUIREMENTS:

1. Import statements:
   - import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
   - import { IsoBox } from '../../src/index';
   - import { TimeoutError, MemoryLimitError } from '../../src/index';

2. Test Suite: "IsoBox Core Functionality"
   With these test groups (describe blocks):

   Group 1: "Basic Execution"
   - Test: "should execute simple arithmetic" 
     Code: return 1 + 1
     Expected: 2
   
   - Test: "should return complex objects"
     Code: return { a: 1, b: 'test', c: [1,2,3] }
     Expected: { a: 1, b: 'test', c: [1,2,3] }
   
   - Test: "should throw error on invalid code"
     Code: return invalid syntax here!!
     Expected: SandboxError thrown
   
   - Test: "should have empty globals in sandbox"
     Code: return typeof process
     Expected: 'undefined'
   
   - Test: "should not access Node APIs"
     Code: return require('fs').readFileSync('/etc/passwd')
     Expected: Error thrown (module not allowed)

   Group 2: "Timeout Enforcement"
   - Test: "should timeout infinite loop"
     Code: while(true) {} 
     Config: timeout: 1000
     Expected: TimeoutError thrown within 1100ms
   
   - Test: "should timeout recursive calls"
     Code: function f() { return f(); } f();
     Config: timeout: 500
     Expected: TimeoutError thrown
   
   - Test: "should allow code that completes in time"
     Code: let sum = 0; for(let i=0; i<1000; i++) sum += i; return sum;
     Config: timeout: 5000
     Expected: Number result (not timeout)

   Group 3: "Filesystem Access"
   - Test: "should write and read files"
     Steps:
       1. sandbox.fs.write('/test.txt', 'hello')
       2. Code: return globalThis.__memfs?.read('/test.txt').toString()
       Expected: 'hello'
   
   - Test: "should create directories"
     Steps:
       1. sandbox.fs.mkdir('/mydir')
       2. Code: return globalThis.__memfs?.exists('/mydir')
       Expected: true

   Group 4: "Module System"
   - Test: "should reject unlisted modules"
     Code: const _ = require('lodash'); return _;
     Expected: SandboxError with "MODULE_NOT_WHITELISTED"
   
   - Test: "should allow whitelisted modules"
     Config: require: { mode: 'whitelist', whitelist: ['lodash'] }
     Code: const _ = require('lodash'); return typeof _
     Expected: 'object' (or appropriate type)
   
   - Test: "should use mocked modules"
     Config: require: { mode: 'whitelist', mocks: { 'custom-lib': { hello: () => 'world' } } }
     Code: const lib = require('custom-lib'); return lib.hello();
     Expected: 'world'

3. Setup/Teardown:
   - beforeEach: Create new IsoBox instance
     const sandbox = new IsoBox({ timeout: 5000, ... });
   
   - afterEach: Call await sandbox.dispose()
     Catch errors (disposal should not throw)

4. Test Helper Function:
   Create a helper that makes test syntax cleaner:
   
   async function expectCode(code, expected, options = {}) {
     const sandbox = new IsoBox(options);
     try {
       const result = await sandbox.run(code);
       expect(result).toEqual(expected);
     } finally {
       await sandbox.dispose();
     }
   }

5. Error Handling in Tests:
   - Use try/catch for expected errors
   - Catch(err) { expect(err).toBeInstanceOf(SandboxError) }
   - Check error.code property for error type
   - Never let unexpected errors pass silently

6. Timeout Handling:
   - Jest timeout: jest.setTimeout(15000) for slow tests
   - Each timeout test should complete in timeout + 500ms
   - No hanging tests

OUTPUT:
Provide complete test file with:
- All imports at top
- describe() block for suite
- beforeEach/afterEach hooks
- All test groups with test cases
- Helper function if created
- Proper async/await usage
- Try/finally for sandbox.dispose()

CRITICAL: Do NOT run tests yet. We just need the test file created.
Later phases will fix code to pass these tests.
```

---

### Prompt 1.3: Create Security Sandbox Escape Tests

**File Target:** `test/security/sandbox-escape.test.ts` (NEW FILE)  
**Instruction Level:** Specific security test cases

```
TASK: Create security tests to verify sandbox cannot be escaped

CONTEXT:
Security is critical for a sandbox. We need tests that verify:
1. Cannot access Node.js process object
2. Cannot access parent context
3. Cannot require unwhitelisted modules
4. Cannot modify global objects to break out
5. Filesystem isolation works

These tests document the security boundary and verify it works.

REQUIREMENTS:

1. Test Suite: "Sandbox Escape Prevention"

2. Test Group: "Node.js API Access Prevention"
   - Test: "should not access process object"
     Code: return typeof process
     Expected: 'undefined'
   
   - Test: "should not access global"
     Code: return typeof global
     Expected: 'undefined'
   
   - Test: "should not access require (unwhitelisted)"
     Code: return typeof require
     Expected: 'undefined' (or throw)
   
   - Test: "should not access __filename"
     Code: return typeof __filename
     Expected: 'undefined'
   
   - Test: "should not access __dirname"
     Code: return typeof __dirname
     Expected: 'undefined'

3. Test Group: "Parent Context Isolation"
   - Test: "should not access parent variables"
     Code: return typeof sandboxVariable // Variable defined outside
     Expected: 'undefined'
   
   - Test: "should not modify parent scope"
     Code: globalThis.outsideVar = 'modified'; return globalThis.outsideVar
     Expected: 'undefined' or undefined (not 'modified')

4. Test Group: "Prototype Chain Protection"
   - Test: "should not access Object.prototype methods to escape"
     Code: return Object.prototype.toString.call(process)
     Expected: SandboxError or 'undefined' (process is undefined)
   
   - Test: "should not use constructor property to escape"
     Code: return ({}).constructor.name
     Expected: 'Object' (or harmless value)

5. Test Group: "Module System Enforcement"
   - Test: "should reject require of fs module"
     Code: require('fs'); return true;
     Config: require: { mode: 'whitelist' } (empty whitelist)
     Expected: Error thrown
   
   - Test: "should reject require of path module"
     Code: require('path'); return true;
     Config: require: { mode: 'whitelist' } (empty whitelist)
     Expected: Error thrown

6. Test Group: "Filesystem Isolation"
   - Test: "should not access host filesystem"
     Code: return globalThis.__memfs?.read('/etc/passwd') 
     Expected: Error (file doesn't exist in sandbox)
   
   - Test: "should not break out of sandbox filesystem root"
     Code: globalThis.__memfs?.write('/../../../etc/passwd', 'hack'); return true;
     Expected: Error or file written to sandbox path, not host

OUTPUT:
Provide complete test file with:
- All security test cases
- Clear descriptions of what is being tested
- Proper expect() assertions
- Comments explaining why each test matters
- Setup/teardown with sandbox creation and disposal

This becomes your security test suite that verifies the sandbox actually works.
```

---

### Prompt 1.4: Create Test Fixtures

**File Target:** `test/fixtures/` (NEW DIRECTORY) + Files  
**Instruction Level:** Create test fixture files

```
TASK: Create test fixture files for IsoBox testing

CONTEXT:
Tests need sample files to work with - fixtures for:
- Sample TypeScript code
- Multi-file projects
- Module files
- Large files for memory testing

REQUIREMENTS:

Create these files in test/fixtures/:

1. File: test/fixtures/simple-typescript.ts
   Content:
   ```typescript
   const name: string = "IsoBox";
   const version: number = 1.0;
   
   function greet(user: string): string {
     return `Hello, ${user}!`;
   }
   
   export { greet, name, version };
   export default greet;
   ```

2. File: test/fixtures/multifile-project-index.ts
   Content:
   ```typescript
   import { add } from './utils';
   
   const result = add(5, 3);
   export default result;
   ```

3. File: test/fixtures/multifile-project-utils.ts
   Content:
   ```typescript
   export function add(a: number, b: number): number {
     return a + b;
   }
   
   export function multiply(a: number, b: number): number {
     return a * b;
   }
   ```

4. File: test/fixtures/large-memory.js
   Content:
   ```javascript
   // Create a large array to test memory limits
   const sizes = [
     1000,      // 1K elements
     10000,     // 10K elements
     100000,    // 100K elements
     1000000,   // 1M elements
   ];
   
   let memory = 0;
   for (const size of sizes) {
     const arr = new Array(size).fill(Math.random());
     memory += arr.length * 8; // rough estimate: 8 bytes per number
     if (memory > 50 * 1024 * 1024) break; // Stop at 50MB
   }
   
   return { allocatedMemory: memory, success: true };
   ```

5. File: test/fixtures/infinite-loop.js
   Content:
   ```javascript
   // This will timeout
   let i = 0;
   while (true) {
     i++;
   }
   ```

6. File: test/fixtures/recursive-call.js
   Content:
   ```javascript
   // This will also timeout
   function recurse(n) {
     return recurse(n + 1);
   }
   
   return recurse(0);
   ```

7. File: test/fixtures/module-test-module.js
   Content:
   ```javascript
   module.exports = {
     getName: () => 'test-module',
     getVersion: () => '1.0.0',
     getValue: () => 42,
   };
   ```

8. Create index file: test/fixtures/index.ts
   Content:
   ```typescript
   import fs from 'fs';
   import path from 'path';
   
   const fixturesDir = __dirname;
   
   export function loadFixture(name: string): string {
     const filepath = path.join(fixturesDir, name);
     return fs.readFileSync(filepath, 'utf-8');
   }
   
   export const fixtures = {
     simpleTypescript: 'simple-typescript.ts',
     multifileIndex: 'multifile-project-index.ts',
     multifileUtils: 'multifile-project-utils.ts',
     largeMemory: 'large-memory.js',
     infiniteLoop: 'infinite-loop.js',
     recursiveCall: 'recursive-call.js',
     moduleTest: 'module-test-module.js',
   };
   ```

OUTPUT:
Create all files in test/fixtures/ directory with exact content above.
These are sample code files used by tests.
```

---

## 📋 PHASE 2: FIX CRITICAL BLOCKERS (5-7 Days)

### Phase 2 Objectives
1. Fix code so tests pass
2. Implement require() injection
3. Implement TypeScript transpilation
4. Fix module system execution
5. Get 50%+ test coverage

### Files to Modify
```
✓ src/core/IsoBox.ts                 - Major refactoring
✓ src/context/ContextBuilder.ts      - Add require() injection
✓ src/modules/ModuleSystem.ts        - Fix virtual module execution
✓ src/project/TypeScriptCompiler.ts  - Create/implement
✓ src/isolate/IsolatePool.ts         - Fix context sharing
```

---

## JULES AI PROMPT - PHASE 2.1: Implement require() Injection

**File Target:** `src/context/ContextBuilder.ts` (UPDATE)  
**Instruction Level:** Specific method implementation

```
TASK: Implement require() function injection into sandbox context

CONTEXT:
Currently, user code in the sandbox has no access to the require() function.
When code tries: const _ = require('lodash')
Result: ReferenceError: require is not defined

We need to:
1. Create a require() function in the host that calls ModuleSystem.require()
2. Inject it into the sandbox global scope
3. Ensure it enforces whitelist
4. Handle mocked modules

CURRENT STATE:
- ContextBuilder.build() exists but doesn't inject require()
- ModuleSystem.require() exists and works
- No bridge between them

IMPLEMENTATION:

1. In ContextBuilder class, add new private method:

   private createRequireFunction(
     moduleSystem: ModuleSystem | null,
     currentPath: string = '/'
   ): (moduleName: string) => any {
     
     if (!moduleSystem) {
       // If no module system configured, require() throws
       return (moduleName: string) => {
         throw new SandboxError(
           `Module system not configured`,
           'MODULE_SYSTEM_DISABLED'
         );
       };
     }
     
     return (moduleName: string) => {
       try {
         const result = moduleSystem.require(moduleName, currentPath);
         return result;
       } catch (error) {
         if (error instanceof SandboxError) {
           throw error;
         }
         throw new SandboxError(
           `require('${moduleName}') failed: ${error instanceof Error ? error.message : String(error)}`,
           'MODULE_LOAD_ERROR'
         );
       }
     };
   }

2. In ContextBuilder.build() method, add this code where globals are prepared:

   // Around line where _globals object is constructed:
   const requireFunc = this.createRequireFunction(options.moduleSystem);
   
   _globals.require = requireFunc;
   _globals.module = { exports: {} };
   _globals.exports = _globals.module.exports;
   
   // Add __dirname and __filename if filename provided
   if (filename) {
     const filePath = filename.split('/');
     _globals.__filename = filename;
     _globals.__dirname = filePath.slice(0, -1).join('/') || '/';
   }

3. Update the return statement to include:
   
   return {
     _globals: {
       ...existingGlobals,
       require: _globals.require,
       module: _globals.module,
       exports: _globals.exports,
       __filename: _globals.__filename,
       __dirname: _globals.__dirname,
     },
     // ... other properties
   };

4. Add JSDoc comment above method:

   /**
    * Creates a safe require() function for the sandbox.
    * Calls through to ModuleSystem which enforces whitelist.
    * 
    * @param moduleSystem The module system instance (may be null)
    * @param currentPath Current execution path for relative imports
    * @returns require() function or function that throws if disabled
    */

IMPORTANT NOTES:

- The require() function must NOT be an ivm.Callback immediately
- Pass it to IsoBox.run() in _globals
- IsoBox.run() will wrap it in ivm.Callback when injecting into context
- This ensures ModuleSystem.require() runs in host, not sandbox

VALIDATION:

After implementation, this code should work:

  const sandbox = new IsoBox({
    require: {
      mode: 'whitelist',
      whitelist: [],  // empty - nothing allowed
      mocks: { 'my-lib': { test: () => 'mocked' } }
    }
  });
  
  const result = await sandbox.run(`
    const lib = require('my-lib');
    return lib.test();
  `);
  
  // result should be 'mocked'

And this should throw:

  const result = await sandbox.run(`
    const fs = require('fs');  // Not in whitelist
    return fs;
  `);
  
  // Should throw SandboxError with MODULE_NOT_WHITELISTED

OUTPUT:
Provide the complete updated ContextBuilder.ts file with:
- New createRequireFunction() method
- Updated build() method that injects require/module/exports/__filename/__dirname
- All imports at top
- All other existing code preserved
```

---

## JULES AI PROMPT - PHASE 2.2: Implement TypeScript Transpilation

**File Target:** `src/project/TypeScriptCompiler.ts` (CREATE or UPDATE)  
**Instruction Level:** Complete implementation

```
TASK: Implement TypeScript to JavaScript transpilation

CONTEXT:
When user passes code with language: 'typescript', it's sent directly to V8
which throws: SyntaxError: Unexpected token ':'

We need a simple regex-based transpiler (not tsc, too heavy) that:
1. Removes type annotations
2. Removes type declarations
3. Removes interfaces
4. Removes generic syntax
5. Preserves all executable JavaScript

This is a Phase 0 implementation - full type checking can be v0.2.0

REQUIREMENTS:

1. Create file: src/project/TypeScriptCompiler.ts

2. Export class TypeScriptCompiler with static method:

   static transpile(code: string): string {
     // Returns JavaScript version of TypeScript code
   }

3. Transpilation rules (in order):

   Rule 1: Remove type annotations from variables
   Pattern: (const|let|var)\s+(\w+)\s*:\s*[^=,;]+([=;,]|$)
   Replace: $1 $2$3
   Example: const x: number = 5;  →  const x = 5;

   Rule 2: Remove type annotations from function parameters
   Pattern: (\w+)\s*:\s*[^,)]+([,)]|$)
   Replace: $1$2
   Example: function add(a: number, b: number)  →  function add(a, b)

   Rule 3: Remove function return types
   Pattern: \)\s*:\s*[^{]+\{
   Replace: ) {
   Example: function test(): number {  →  function test() {

   Rule 4: Remove interface declarations
   Pattern: interface\s+\w+.*?\{[^}]*\}
   Replace: (remove entirely)
   Example: interface User { name: string; }  →  (deleted)

   Rule 5: Remove type declarations
   Pattern: type\s+\w+.*?=.*?[;]
   Replace: (remove entirely)
   Example: type ID = string;  →  (deleted)

   Rule 6: Remove generic syntax in types
   Pattern: <[^>]+>
   Replace: (remove entirely)
   Example: Array<number>  →  Array

   Rule 7: Remove 'as' type casts
   Pattern: \s+as\s+\w+
   Replace: (remove)
   Example: (value as string)  →  (value)

   Rule 8: Remove access modifiers
   Pattern: (public|private|protected|readonly)\s+
   Replace: (remove)
   Example: private x: number;  →  x;

   Rule 9: Remove abstract keyword
   Pattern: abstract\s+
   Replace: (remove)
   Example: abstract class Base {}  →  class Base {}

   Rule 10: Remove enum declarations
   Pattern: enum\s+\w+.*?\{[^}]*\}
   Replace: (remove entirely)

4. Method signature:

   /**
    * Transpiles TypeScript code to JavaScript by removing type annotations.
    * This is a simple regex-based transpiler for Phase 0.
    * For production, consider using TypeScript's transpiler (tsc).
    * 
    * @param code TypeScript source code
    * @returns JavaScript compatible code
    * @throws SandboxError if transpilation fails
    */
   static transpile(code: string): string {
     try {
       let js = code;
       
       // Apply transformations in order
       // Each rule defined above
       
       return js;
     } catch (error) {
       throw new SandboxError(
         `TypeScript transpilation failed: ${error instanceof Error ? error.message : String(error)}`,
         'TRANSPILE_ERROR'
       );
     }
   }

5. Update src/core/IsoBox.ts run() method:

   async run<T = any>(code: string, opts: RunOptions = {}): Promise<T> {
     // ... existing code ...
     
     const language = opts.language ?? 'javascript';
     let executableCode = code;
     
     if (language === 'typescript' || language === 'ts') {
       executableCode = TypeScriptCompiler.transpile(code);
     }
     
     // Then use executableCode instead of code for execution
     // this.executionEngine.execute(executableCode, ...)
     
     // ... rest of code ...
   }

6. Add TypeScriptCompiler to src/index.ts exports:

   export { TypeScriptCompiler } from './project/TypeScriptCompiler.js';

VALIDATION:

After implementation, this should work:

  const sandbox = new IsoBox();
  
  const result = await sandbox.run(`
    const x: number = 5;
    const greet = (name: string): string => {
      return 'Hello, ' + name;
    };
    return { x, msg: greet('World') };
  `, { language: 'typescript' });
  
  // result should be { x: 5, msg: 'Hello, World' }

Test cases in implementation:
1. Type annotations on variables removed
2. Function parameters type annotations removed
3. Function return types removed
4. Interfaces removed completely
5. Types removed completely
6. Generic syntax removed
7. 'as' casts removed
8. Access modifiers removed

OUTPUT:
Provide complete TypeScriptCompiler.ts file with:
- Class definition
- transpile() static method
- All regex rules implemented in order
- Comments explaining each rule
- Error handling with SandboxError
- Proper JSDoc

Also provide the code snippet showing how to integrate into IsoBox.run()
```

---

## JULES AI PROMPT - PHASE 2.3: Fix Module System Virtual Execution

**File Target:** `src/modules/ModuleSystem.ts` (UPDATE)  
**Instruction Level:** Fix loadVirtual() method

```
TASK: Fix virtual module execution in ModuleSystem

CONTEXT:
Current code in loadVirtual() has this line:
```
logger.warn(`Virtual module execution skipped (VM required): ${path}`);
return moduleContext.exports;
```

This means virtual files (from virtual filesystem) never execute.
When user does: require('./utils.js'), it loads the file but never runs the code.

The fix requires injecting a transpiled-and-safe version of the code into
the sandbox context and executing it, then returning module.exports.

CHALLENGE:
- Can't execute synchronously in VM (isolated-vm is async)
- But require() is synchronous
- Solution: Pre-load and cache modules before execution

This is a PHASE 2 partial solution. Full solution in Phase 4.

CURRENT IMPLEMENTATION ISSUES:

1. No execution happens
2. No module.exports population
3. Cached but empty
4. RequireSystem becomes bottleneck

PHASE 2 SOLUTION (Workaround):

Since we can't execute async code in synchronous require(),
we'll implement a synchronous-compatible version using Module context eval:

1. Update loadVirtual() to:

   private loadVirtual(path: string): any {
     try {
       // Step 1: Check if already cached
       if (this.cache.has(path)) {
         return this.cache.get(path);
       }
       
       // Step 2: Read file from virtual filesystem
       const fileBuffer = this.memfs.read(path);
       const fileCode = fileBuffer.toString();
       
       // Step 3: Determine if TypeScript and transpile if needed
       let executableCode = fileCode;
       if (path.endsWith('.ts') || path.endsWith('.tsx')) {
         // Import TypeScriptCompiler dynamically
         const { TypeScriptCompiler } = await import('../project/TypeScriptCompiler.js');
         executableCode = TypeScriptCompiler.transpile(fileCode);
       }
       
       // Step 4: Create module context
       const module = { exports: {} };
       const moduleContext = {
         module,
         exports: module.exports,
         require: (name: string) => this.require(name, path),
         __filename: path,
         __dirname: path.substring(0, path.lastIndexOf('/')),
       };
       
       // Step 5: Execute in Node.js VM (not isolated-vm)
       // This executes in Host but in isolated context
       try {
         const vm = require('vm');
         const script = new vm.Script(executableCode);
         const sandbox = {
           ...moduleContext,
           console,
           // Add safe globals
           undefined,
           null,
           Object,
           Array,
           String,
           Number,
           Boolean,
           Math,
           Date,
           RegExp,
           Error,
           JSON,
         };
         
         script.runInNewContext(sandbox, {
           filename: path,
           timeout: 5000,
         });
         
         // After execution, module.exports is populated
         const result = sandbox.module.exports;
         
         // Step 6: Cache result
         this.cache.set(path, result);
         
         return result;
       } catch (execError) {
         throw new SandboxError(
           `Module execution failed at ${path}: ${execError instanceof Error ? execError.message : String(execError)}`,
           'MODULE_EXEC_ERROR',
           { path, error: execError }
         );
       }
       
     } catch (error) {
       if (error instanceof SandboxError) throw error;
       
       throw new SandboxError(
         `Load failed: ${path}`,
         'MODULE_LOAD_ERROR',
         { path, error: error instanceof Error ? error.message : String(error) }
       );
     }
   }

2. Add vm import at top:
   import vm from 'vm';

3. Add comment explaining this is Phase 2 solution:

   /**
    * Loads and executes virtual module from filesystem.
    * 
    * PHASE 2 IMPLEMENTATION:
    * Executes in Node.js VM sandbox, not isolated-vm.
    * This allows synchronous require() but modules run in host process.
    * 
    * PHASE 4 WILL:
    * Execute in isolated-vm context within the execution context,
    * allowing true sandboxing of module code.
    * 
    * @param path Path to module file in virtual filesystem
    * @returns module.exports object
    */

IMPORTANT NOTES:

1. This is NOT ideal (executes in host), but:
   - Allows Phase 2 to have working require()
   - Tests will pass
   - Phase 4 refactors to proper isolation

2. The vm.Script execution:
   - Uses Node.js vm module (not isolated-vm)
   - Timeout of 5 seconds hard-coded (TODO: make configurable)
   - Sandbox has safe global scope
   - Cannot access process, fs, etc.

3. This fix allows:
   - Virtual modules to execute
   - module.exports to populate
   - require() chains to work
   - Circular dependency detection to work

4. Known limitation:
   - Module code runs in host process (PHASE 4 fixes)
   - No memory isolation (PHASE 4 fixes)
   - No CPU isolation (PHASE 4 fixes)

VALIDATION:

After implementation:

  const sandbox = new IsoBox({
    filesystem: { enabled: true, maxSize: 10 * 1024 * 1024 },
  });
  
  sandbox.fs.write('/utils.js', 'module.exports = { add: (a, b) => a + b };');
  
  const result = await sandbox.run(`
    const utils = require('./utils.js');
    return utils.add(5, 3);
  `);
  
  // result should be 8

Test with TypeScript file:

  sandbox.fs.write('/math.ts', `
    export const multiply: (a: number, b: number) => number = (a, b) => a * b;
  `);
  
  const result = await sandbox.run(`
    const math = require('./math.ts');
    return math.multiply(3, 4);
  `);
  
  // result should be 12

OUTPUT:
Provide the complete updated ModuleSystem.ts file with:
- Updated loadVirtual() method with full implementation above
- vm import at top
- All error handling
- Comments explaining Phase 2 vs Phase 4 strategy
- All other existing methods preserved
```

---

## JULES AI PROMPT - PHASE 2.4: Run Tests and Document Failures

**File Target:** Test run and failure documentation  
**Instruction Level:** Specific test execution

```
TASK: Run test suite and document all failures for Phase 2 fixes

CONTEXT:
We've created tests and implemented several fixes.
Now we need to run tests to see what passes and what fails.
Document all failures so we know exactly what to fix next.

EXECUTION:

1. Run all tests:
   npm test -- --verbose

2. Run with coverage:
   npm run test:coverage

3. Run specific test file:
   npm test -- test/core/IsoBox.test.ts

EXPECTED OUTCOMES:

Some tests will pass (basic ones):
- Basic arithmetic execution ✓
- Return complex objects ✓
- Invalid code throws error ✓

Some tests will fail (unimplemented features):
- "should have no process object" - might pass if isolated-vm is strict
- "should not access Node APIs" - might pass
- Timeout tests - should pass
- Filesystem tests - might pass
- Module system tests - might fail if require() injection not working

DOCUMENTATION TASK:

For each test that fails, create a document with:

Example:
```
TEST: "should timeout infinite loop"
STATUS: FAIL
ERROR MESSAGE: (copy exact error)
ROOT CAUSE: (explain why it's failing)
FIX REQUIRED: (what code needs to change)
PHASE: (which phase fixes it)
```

Create these documents in: test/FAILURES.md

CRITICAL OUTPUT:

Create test/FAILURES.md with:

```markdown
# Test Failure Report

## Summary
- Total Tests: X
- Passing: X
- Failing: X
- Coverage: X%

## Failing Tests

### Test 1: [Test Name]
- File: test/core/IsoBox.test.ts
- Error: [Exact error message]
- Expected: [What should happen]
- Actual: [What actually happened]
- Root Cause: [Why it failed]
- Fix Phase: [Phase 2/3/4]

### Test 2: [Test Name]
...

## Passing Tests Summary
List all passing tests

## Next Steps
Based on failures, next phase should:
1. Fix X
2. Implement Y
3. Resolve Z
```

ALSO:

Create test/TEST-EXECUTION-NOTES.md with:

```markdown
# Test Execution Notes - Phase 1 Completion

## Test Infrastructure Status

### Created Files
- ✓ test/core/IsoBox.test.ts
- ✓ test/security/sandbox-escape.test.ts
- ✓ test/fixtures/ (with sample files)
- ✓ package.json (updated with test scripts)
- ✓ .npmignore

### Build Status
- [ ] npm run build
- [ ] npm run type-check
- [ ] npm test

### Test Results
[Run tests and document results]

## Coverage Report
[Include output of npm run test:coverage]

## Issues Blocking Tests
[List any issues preventing test execution]
```

DON'T ACTUALLY RUN (for now):
- You're providing the structure
- Jules will run these and report
```

---

This completes **PHASE 1** and **PHASE 2** sections of the Jules AI plan.

---

## 📋 REMAINING PHASES (Overview for Context)

### **PHASE 3: Resource Enforcement & Metrics (3-4 Days)**
- Implement actual timeout enforcement with TimeoutManager
- Implement CPU/memory limit enforcement with ResourceMonitor  
- Implement metrics collection that works
- Add error sanitization

### **PHASE 4: Advanced Features (4-5 Days)**
- Implement proper streaming support for generators
- Implement session state persistence
- Fix isolate pool context sharing
- Implement proper async module loading
- Add complete error sanitization

### **PHASE 5: Polish & Publishing (2-3 Days)**
- Create GitHub Actions CI/CD
- Add benchmarks comparing to vm2/isolated-vm
- Final test pass (80%+ coverage)
- Publish to npm
- Create GitHub releases

---

## HOW JULES AGENT USES THIS PLAN

1. **Read this document entirely** to understand the project state
2. **For each phase:**
   - Read the "Jules AI Prompt" for that phase
   - Execute the exact instructions
   - Report results
   - Move to next prompt in same phase
   - After phase complete, move to next phase
3. **On errors:**
   - Don't assume - ask for clarification
   - Provide full error context
   - Never skip tests
4. **On completion:**
   - Verify changes with `npm test`
   - Commit with clear messages
   - Push to branch
   - Create PR for review

---

## FILES TO PROVIDE JULES AGENT

Before starting, give Jules:
1. This plan document (you have it)
2. Copy of entire repository (via git URL)
3. npm credentials (if publishing in Phase 5)
4. GitHub credentials (if creating CI/CD in Phase 5)

---

This plan is **detailed, specific, and executable**. Each Jules prompt:
- ✓ Specifies exact file to modify
- ✓ Provides exact code/implementations
- ✓ Includes test validation
- ✓ Links to previous phases
- ✓ Avoids vagueness
- ✓ Includes error handling

You can now hand this to Jules AI agent and it will have everything needed to fix IsoBox systematically.
