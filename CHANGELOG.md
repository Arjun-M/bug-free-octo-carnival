# Changelog

All notable changes to IsoBox will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive JSDoc documentation for all public APIs
- Complete documentation suite:
  - Quick Start Guide
  - Installation Guide
  - Basic Usage Guide
  - Configuration Guide
  - Migration Guide from VM2
  - Troubleshooting Guide
  - FAQ
  - Advanced guides
  - Example tutorials
  - Architecture documentation

## [1.0.0] - 2025-01-15

### Added
- 🎉 Initial stable release
- Core sandbox execution with isolated-vm
- Timeout enforcement with strict and graceful modes
- Memory limit enforcement
- CPU time limit tracking
- In-memory filesystem (MemFS) with permissions
- Module system with whitelist/strict/permissive modes
- Module mocking support
- Session management with TTL and execution limits
- State persistence between executions
- Connection pooling for performance
- Isolate pool with warmup support
- TypeScript transpilation support
- Security logging and event system
- Error sanitization
- Metrics collection (CPU, memory, execution time)
- Event emitter for execution lifecycle
- Streaming execution with async generators
- Project execution (multi-file support)
- Compiled script caching
- Console output capture and redirection
- Context injection for sandbox variables
- Comprehensive test suite
- Full TypeScript type definitions
- Production-ready error handling
- Resource cleanup and disposal management

### Security
- V8 isolate-based isolation
- No access to process object
- No access to require() (unless whitelisted)
- No access to filesystem (unless explicitly enabled)
- No network access
- Prototype pollution protection
- Stack trace sanitization
- Security event logging

### Performance
- Isolate pooling for 10-100x speedup
- Compiled script caching
- Efficient resource monitoring
- Optimized context initialization

### Developer Experience
- Full TypeScript support
- Comprehensive documentation
- Example projects
- Migration guide from VM2
- Detailed error messages
- Debug logging
- Extensive configuration options

## [0.9.0] - 2024-12-15

### Added
- Beta release for testing
- Core execution engine
- Basic timeout support
- Memory limits
- Simple filesystem
- Module whitelisting

### Changed
- Improved error handling
- Better resource cleanup

### Fixed
- Memory leaks in dispose()
- Timeout race conditions

## [0.8.0] - 2024-11-15

### Added
- Alpha release
- Proof of concept
- Basic isolated-vm integration

### Known Issues
- Memory leaks under heavy load
- Timeout enforcement not strict
- Limited documentation

## Release Process

### Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR version**: Incompatible API changes
- **MINOR version**: Backwards-compatible functionality additions
- **PATCH version**: Backwards-compatible bug fixes

### Release Checklist

Before each release:

- [ ] All tests passing
- [ ] Documentation updated
- [ ] CHANGELOG updated
- [ ] Version bumped in package.json
- [ ] Git tag created
- [ ] npm publish
- [ ] GitHub release created
- [ ] Announcement posted

### Breaking Changes

Breaking changes will be clearly marked with:
- Version bump to next MAJOR
- "BREAKING CHANGE" in changelog
- Migration guide in documentation
- Deprecation warnings in previous MINOR version (if possible)

## Upgrade Guides

### Upgrading to 1.0.0

First stable release - no breaking changes from 0.9.0.

**Changes:**
- Finalized API surface
- Production-ready documentation
- Comprehensive test coverage
- Performance improvements

**Migration:**
```bash
npm install isobox@1.0.0
```

No code changes required from 0.9.0.

## Support Policy

| Version | Status | Support Until |
|---------|--------|---------------|
| 1.x     | Active | Current + 12 months after 2.0 release |
| 0.x     | Deprecated | No support |

## Deprecation Policy

Features will be deprecated with:
1. Deprecation warning in console (minor version)
2. Documentation marked as deprecated
3. Alternative provided
4. Removed in next major version (minimum 6 months after deprecation)

Example:
```
Version 1.5: Feature X deprecated (warning added)
Version 1.6-1.9: Feature X still works with warning
Version 2.0: Feature X removed
```

## Future Roadmap

### Planned for 1.1.0
- WebAssembly support
- Better streaming support
- Improved TypeScript type checking
- Performance monitoring dashboard
- Plugin system

### Planned for 1.2.0
- Distributed execution support
- Redis-backed session storage
- Advanced caching strategies
- Real-time metrics export

### Planned for 2.0.0
- Breaking: New module system API
- Breaking: Simplified configuration
- Major performance improvements
- Enterprise features

## Links

- [Homepage](https://isobox.dev)
- [Documentation](https://docs.isobox.dev)
- [GitHub](https://github.com/yourusername/isobox)
- [npm](https://www.npmjs.com/package/isobox)
- [Issues](https://github.com/yourusername/isobox/issues)
- [Discussions](https://github.com/yourusername/isobox/discussions)

---

**Last Updated**: 2025-01-15
