# CONTRIBUTING.md - IsoBox Contribution Guide

## Welcome! 👋

Thank you for your interest in contributing to IsoBox. This document provides guidelines and instructions for contributing.

## Code of Conduct

We are committed to providing a welcoming and inspiring community. All contributors are expected to:

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites
- Node.js 18+
- TypeScript knowledge
- Basic understanding of V8 Isolates

### Setup Development Environment
```bash
# Clone repository
git clone https://github.com/Arjun-M/isobox.git
cd isobox

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm run test
```

## Development Workflow

### 1. Fork and Create Branch
```bash
# Fork the repository on GitHub
git clone https://github.com/Arjun-M/isobox.git
git checkout -b feature/your-feature-name
```

### 2. Make Changes
- Write code in TypeScript with strict mode
- Follow existing code style
- Add JSDoc comments for public APIs
- Test your changes thoroughly

### 3. Type Checking
```bash
npm run type-check
```

### 4. Format Code
```bash
npm run format
```

### 5. Lint
```bash
npm run lint
```

### 6. Build
```bash
npm run build
```

### 7. Commit and Push
```bash
git add .
git commit -m "feat: add new feature"
git push origin feature/your-feature-name
```

### 8. Create Pull Request
- Provide clear description of changes
- Reference related issues
- Add tests for new functionality
- Update documentation

## Coding Standards

### TypeScript Strict Mode
```typescript
// ✅ DO: Use proper types
const count: number = 0;
interface Options {
  timeout: number;
  code: string;
}

// ❌ DON'T: Use implicit any
const count = 0; // inferred as number - OK
const value: any = ''; // NO - use proper type
```

### JSDoc Comments
```typescript
/**
 * Execute code in isolated context
 * @param code JavaScript code to execute
 * @param options Execution options
 * @returns Promise of execution result
 * @throws Error if code compilation fails
 * @example
 * const result = await isobox.run('1 + 2');
 */
async run(code: string, options?: ExecutionOptions): Promise<any>
```

### Error Handling
```typescript
// ✅ DO: Provide meaningful errors
throw new Error(`Invalid module name: "${name}" is not whitelisted`);

// ❌ DON'T: Generic or unclear errors
throw new Error('Invalid input');
```

### Imports
```typescript
// ✅ DO: Use .js extension for ESM
import { MemFS } from '../filesystem/MemFS.js';

// ❌ DON'T: Omit extension or use .ts
import { MemFS } from '../filesystem/MemFS';
```

## Testing

### Writing Tests
```typescript
// tests/execution.test.ts
import { IsoBox } from '../src/index.js';

describe('IsoBox Execution', () => {
  it('should execute simple code', async () => {
    const isobox = new IsoBox();
    const result = await isobox.run('1 + 2');
    expect(result).toBe(3);
  });

  it('should handle errors', async () => {
    const isobox = new IsoBox();
    try {
      await isobox.run('throw new Error("test")');
    } catch (error) {
      expect(error.message).toContain('test');
    }
  });
});
```

### Run Tests
```bash
npm run test
npm run test -- --coverage
```

### Test Coverage
- Aim for >80% coverage
- Test error cases
- Test edge cases
- Test integrations

## Pull Request Process

1. **Update documentation** if needed
2. **Add tests** for new functionality
3. **Ensure all checks pass**:
   - `npm run type-check` ✅
   - `npm run build` ✅
   - `npm run test` ✅
   - `npm run lint` ✅

4. **Provide clear PR description**:
   - What problem does it solve?
   - How does it work?
   - Any breaking changes?
   - Testing performed

5. **Respond to review feedback** promptly

## Issue Guidelines

### Bug Reports
Include:
- Node.js version
- IsoBox version
- Minimal reproduction
- Expected vs actual behavior
- Error logs/stack traces

### Feature Requests
Include:
- Use case/motivation
- Proposed solution
- Alternative approaches
- Any concerns

## Documentation

### README.md Updates
- Keep installation instructions current
- Add examples for new features
- Update API reference
- Include performance notes

### Code Comments
- Explain "why" not "what"
- Document non-obvious logic
- Add JSDoc for public APIs
- Update docs/ files for major changes

## Performance Considerations

When submitting code:
- [ ] Profile performance-critical paths
- [ ] Avoid unnecessary allocations
- [ ] Cache expensive computations
- [ ] Document performance trade-offs
- [ ] Include benchmarks if applicable

## Security Considerations

All contributions should:
- [ ] Follow security best practices
- [ ] Validate all inputs
- [ ] Avoid unsafe operations (eval, etc.)
- [ ] Sanitize error messages
- [ ] Maintain isolation boundaries
- [ ] Update SECURITY.md if relevant

## File Structure

```
isobox/
├── src/
│   ├── core/          # Core execution engine
│   ├── execution/     # Execution management
│   ├── filesystem/    # Virtual filesystem
│   ├── modules/       # Module system
│   ├── isolate/       # Isolate pooling
│   ├── session/       # Session management
│   ├── context/       # Context building
│   ├── streaming/     # Streaming support
│   ├── metrics/       # Metrics collection
│   ├── security/      # Security utilities
│   ├── utils/         # Utility functions
│   └── project/       # Project loading
├── tests/             # Test files
├── docs/              # Documentation
├── dist/              # Compiled output
└── package.json
```

## Commit Message Format

Use clear, descriptive commit messages:

```
feat: add feature X
fix: resolve issue with Y
docs: update README
test: add tests for X
refactor: improve performance
chore: update dependencies
```

## Release Process

Maintainers handle releases following semver:
- **Major** (X.0.0): Breaking changes
- **Minor** (x.Y.0): New features
- **Patch** (x.y.Z): Bug fixes

## Recognized Contributors

Contributors are recognized in:
- GitHub contributors page
- Release notes
- CONTRIBUTORS.md (if applicable)

## Questions?

- **Issues**: Use GitHub Issues for bugs/features
- **Discussions**: Use GitHub Discussions for questions
- **Email**: arjun@builderengine.space

## Thank You! 💖

Your contributions make IsoBox better for everyone. Thank you for helping improve this project!

---

Happy contributing! 🚀
