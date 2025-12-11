# Installation Guide

Complete guide for installing and setting up IsoBox in your project.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [TypeScript Setup](#typescript-setup)
- [Configuration](#configuration)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **Node.js**: Version 16.x or higher
- **npm**: Version 7.x or higher (or yarn 1.22+)
- **Operating System**: Linux, macOS, or Windows (with WSL2)
- **Memory**: Minimum 512MB RAM available
- **Architecture**: x64 or arm64

### Platform-Specific Notes

#### Linux
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install build-essential python3

# RHEL/CentOS/Fedora
sudo yum groupinstall "Development Tools"
sudo yum install python3
```

#### macOS
```bash
# Install Xcode Command Line Tools
xcode-select --install
```

#### Windows
IsoBox requires WSL2 on Windows. Install WSL2 first:
```powershell
wsl --install
```

Then follow Linux installation steps inside WSL2.

## Installation

### Using npm

```bash
npm install isobox
```

### Using yarn

```bash
yarn add isobox
```

### Using pnpm

```bash
pnpm add isobox
```

### Version Pinning

For production, pin to a specific version:

```json
{
  "dependencies": {
    "isobox": "1.0.0"
  }
}
```

### Installing from Source

```bash
git clone https://github.com/yourusername/isobox.git
cd isobox
npm install
npm run build
npm link
```

## TypeScript Setup

### Installation

IsoBox includes TypeScript definitions. Install TypeScript if needed:

```bash
npm install --save-dev typescript @types/node
```

### tsconfig.json

Recommended TypeScript configuration:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Type Definitions

IsoBox exports comprehensive type definitions:

```typescript
import type {
  IsoBox,
  IsoBoxOptions,
  RunOptions,
  ProjectOptions,
  SessionOptions,
  ExecutionMetrics,
  GlobalMetrics,
  SandboxError,
  TimeoutError,
  MemoryLimitError
} from 'isobox';
```

## Configuration

### Basic Configuration

Create a configuration file `isobox.config.js`:

```javascript
module.exports = {
  timeout: 10000,
  memoryLimit: 256 * 1024 * 1024,
  cpuTimeLimit: 15000,

  filesystem: {
    enabled: true,
    maxSize: 128 * 1024 * 1024
  },

  require: {
    mode: 'whitelist',
    whitelist: ['lodash', 'date-fns', 'ramda']
  },

  typescript: {
    enabled: true,
    typeCheck: false,
    target: 'ES2022'
  },

  security: {
    logViolations: true,
    sanitizeErrors: true
  },

  metrics: {
    enabled: true,
    collectCpu: true,
    collectMemory: true
  }
};
```

### Environment Variables

Configure via environment variables:

```bash
# .env file
ISOBOX_TIMEOUT=10000
ISOBOX_MEMORY_LIMIT=268435456
ISOBOX_CPU_TIME_LIMIT=15000
ISOBOX_FS_ENABLED=true
ISOBOX_FS_MAX_SIZE=134217728
ISOBOX_LOG_LEVEL=info
```

Load in your application:

```typescript
import { IsoBox } from 'isobox';
import dotenv from 'dotenv';

dotenv.config();

const box = new IsoBox({
  timeout: parseInt(process.env.ISOBOX_TIMEOUT || '5000'),
  memoryLimit: parseInt(process.env.ISOBOX_MEMORY_LIMIT || '134217728'),
  cpuTimeLimit: parseInt(process.env.ISOBOX_CPU_TIME_LIMIT || '10000')
});
```

### Docker Setup

Using IsoBox in Docker:

**Dockerfile:**
```dockerfile
FROM node:18-alpine

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application
COPY . .

# Build if needed
RUN npm run build

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - ISOBOX_TIMEOUT=10000
      - ISOBOX_MEMORY_LIMIT=268435456
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
```

## Verification

### Test Installation

Create a test file `test-isobox.js`:

```javascript
const { IsoBox } = require('isobox');

async function test() {
  const box = new IsoBox({ timeout: 5000 });

  try {
    const result = await box.run('2 + 2');
    console.log('✓ Basic execution works:', result);

    const contextResult = await box.run('x * 2', {
      sandbox: { x: 21 }
    });
    console.log('✓ Context injection works:', contextResult);

    console.log('\n✅ IsoBox installed correctly!');
  } catch (error) {
    console.error('❌ Installation test failed:', error);
    process.exit(1);
  } finally {
    await box.dispose();
  }
}

test();
```

Run the test:
```bash
node test-isobox.js
```

Expected output:
```
✓ Basic execution works: 4
✓ Context injection works: 42

✅ IsoBox installed correctly!
```

### Check Version

```javascript
const packageJson = require('isobox/package.json');
console.log('IsoBox version:', packageJson.version);
```

### Performance Benchmark

Quick performance check:

```javascript
const { IsoBox } = require('isobox');

async function benchmark() {
  const box = new IsoBox({ usePooling: true, pool: { min: 5, max: 10 } });

  const start = Date.now();
  const iterations = 100;

  for (let i = 0; i < iterations; i++) {
    await box.run('Math.random() * 100');
  }

  const duration = Date.now() - start;
  const avgTime = duration / iterations;

  console.log(`Executed ${iterations} runs in ${duration}ms`);
  console.log(`Average: ${avgTime.toFixed(2)}ms per execution`);

  await box.dispose();
}

benchmark();
```

## Troubleshooting

### Common Issues

#### Issue: "Cannot find module 'isolated-vm'"

**Solution:**
```bash
# Rebuild isolated-vm
npm rebuild isolated-vm

# Or reinstall
npm uninstall isobox
npm install isobox
```

#### Issue: "Error: Not enough memory"

**Solution:**
Increase Node.js memory limit:
```bash
node --max-old-space-size=4096 your-app.js
```

#### Issue: "Python not found" during installation

**Solution:**
Install Python 3:
```bash
# Ubuntu/Debian
sudo apt-get install python3

# macOS
brew install python3

# Windows
# Download from python.org
```

#### Issue: "gyp ERR! build error"

**Solution:**
Install build tools:
```bash
# Linux
sudo apt-get install build-essential

# macOS
xcode-select --install

# Windows (in elevated PowerShell)
npm install --global windows-build-tools
```

#### Issue: "Timeout errors in tests"

**Solution:**
Increase timeout in jest/mocha config:
```javascript
// jest.config.js
module.exports = {
  testTimeout: 30000
};
```

### Logging and Debugging

Enable debug logging:

```javascript
import { IsoBox } from 'isobox';
import { logger } from 'isobox/utils';

// Set log level
logger.setLevel('debug');

const box = new IsoBox();
```

Or via environment variable:
```bash
LOG_LEVEL=debug node your-app.js
```

### Getting Help

If you encounter issues:

1. Check the [Troubleshooting Guide](../TROUBLESHOOTING.md)
2. Search [GitHub Issues](https://github.com/yourusername/isobox/issues)
3. Read the [FAQ](../FAQ.md)
4. Ask on [GitHub Discussions](https://github.com/yourusername/isobox/discussions)

## Next Steps

- Read the [Quick Start Guide](./QUICKSTART.md) to begin using IsoBox
- Learn about [Basic Usage](./BASIC-USAGE.md)
- Explore [Configuration Options](./CONFIGURATION.md)
- Check out [Example Projects](../examples/)

---

**Installation complete!** 🎉 Head over to the [Quick Start Guide](./QUICKSTART.md) to start coding.
