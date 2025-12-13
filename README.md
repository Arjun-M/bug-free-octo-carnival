# IsoBox: Secure, High-Performance JavaScript/TypeScript Sandbox

[![npm version](https://img.shields.io/npm/v/isobox.svg)](https://www.npmjs.com/package/isobox)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue)](https://www.typescriptlang.org/)

**IsoBox** is a production-grade, high-performance sandbox environment for securely executing untrusted JavaScript and TypeScript code, built on top of V8 Isolates. It is designed as a robust and modern alternative to older VM solutions, offering strict resource control and a secure virtualized environment.

## ✨ Features

IsoBox provides a comprehensive set of features for safe and efficient code execution:

*   **V8 Isolate Security:** Leverages the native security and performance of V8 Isolates via `isolated-vm`, ensuring true process isolation and preventing sandbox escapes.
*   **Strict Resource Control:** Enforces configurable limits on **CPU time**, **wall-clock timeout**, and **memory usage** to prevent denial-of-service attacks from malicious or runaway code.
*   **In-Memory Filesystem (MemFS):** Provides a virtual, ephemeral filesystem with configurable size quotas, ensuring file operations are isolated from the host system.
*   **TypeScript & Multi-File Support:** Seamlessly handles TypeScript execution and complex projects with multiple files and custom module resolution.
*   **Session Management:** Supports persistent execution sessions, allowing for stateful sandboxes without the overhead of re-initializing the entire environment.
*   **Detailed Metrics:** Tracks execution duration, CPU time, and memory consumption for every run.

## 🚀 Installation

IsoBox is available on npm.

```bash
npm install isobox
# or
yarn add isobox
```

## 💡 Quick Start

Execute a simple script with a 5-second timeout.

```typescript
import { IsoBox } from 'isobox';

async function runExample() {
  const sandbox = new IsoBox({
    timeout: 5000, // 5 seconds wall-clock timeout
    memoryLimit: 64 * 1024 * 1024, // 64MB memory limit
  });

  // Write a file to the virtual filesystem
  sandbox.fs.write('/config.json', JSON.stringify({ key: 'value' }));

  const code = `
    // Accesses the virtual filesystem via the injected $fs global
    const fs = globalThis.$fs;
    const config = JSON.parse(fs.read('/config.json').toString());

    let sum = 0;
    for (let i = 0; i < 1000000000; i++) {
      sum += i;
    }
    
    // Accesses the virtual console
    console.log('Calculation complete. Config key:', config.key);
    sum; // The last expression is returned
  `;

  try {
    const result = await sandbox.run(code);
    console.log('Result:', result);
  } catch (error) {
    console.error('Execution failed:', error.message);
  } finally {
    await sandbox.dispose();
  }
}

runExample();
```

## 🛠️ API Highlights

### `new IsoBox(options: IsoBoxOptions)`

Initializes the main sandbox instance.

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `timeout` | `number` | `5000` | Wall-clock timeout in milliseconds. |
| `cpuTimeLimit` | `number` | `10000` | V8 CPU time limit in milliseconds. |
| `memoryLimit` | `number` | `128MB` | Max heap memory in bytes. |
| `filesystem` | `object` | `{}` | Configuration for the in-memory filesystem (MemFS). |
| `require` | `object` | `null` | Configuration for the module system (whitelist, mocks). |

### Core Methods

| Method | Description |
| :--- | :--- |
| `isobox.run<T>(code: string)` | Executes a single string of JavaScript/TypeScript code. |
| `isobox.runProject<T>(project: ProjectOptions)` | Executes a multi-file project with custom entry points. |
| `isobox.createSession(id: string)` | Creates a persistent, stateful execution session. |
| `isobox.fs: MemFS` | Provides direct access to the virtual in-memory filesystem. |
| `isobox.dispose()` | Cleans up all resources and terminates all isolates. |

## 🔒 Security and Isolation

IsoBox's security model is built around **V8 Isolates**. Unlike solutions that rely on JavaScript proxies or simple `with` statements, Isolates provide a strong security boundary:

*   **Separate Heaps:** Each isolate has its own memory space, preventing memory corruption or data leakage between sandboxes.
*   **Host-Guest Communication:** All communication between the host (Node.js) and the guest (sandbox) is done through explicit, safe channels, preventing direct access to Node.js APIs.
*   **Resource Throttling:** The strict CPU and memory limits prevent malicious code from consuming all host resources.

## 🤝 Contributing

We welcome contributions! Please see `CONTRIBUTING.md` for guidelines.

## 📄 License

IsoBox is [MIT licensed](LICENSE).
