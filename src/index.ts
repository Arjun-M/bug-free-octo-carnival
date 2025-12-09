/**
 * @fileoverview IsoBox - Production-grade JavaScript/TypeScript sandbox
 */

export { IsoBox } from './core/IsoBox.js';
export { CompiledScript } from './core/CompiledScript.js';

// Re-export all core types
export type {
  Language,
  ConsoleMode,
  ModuleMode,
  SecuritySeverity,
  SecurityEventType,
  ConsoleOptions,
  RequireOptions,
  FilesystemOptions,
  TypeScriptOptions,
  SecurityOptions,
  MetricsOptions,
  IsoBoxOptions,
  RunOptions,
  ProjectFile,
  ProjectOptions,
  SessionOptions,
  PoolOptions,
  ExecutionMetrics,
  GlobalMetrics,
  SessionMetrics,
  PoolStats,
  FileStats,
  SecurityEvent,
  CompiledScriptData,
  Session,
} from './core/types.js';

export {
  SandboxError,
  TimeoutError,
  MemoryLimitError,
  CPULimitError,
} from './core/types.js';

// Export execution types
export type {
  ResourceUsage,
  ResourceStats,
  TimeoutHandle,
  SanitizedError,
  TimeoutEvent,
  ResourceWarningEvent,
  ExecutionEvent,
} from './core/ExecutionTypes.js';

export { TimeoutReason } from './core/ExecutionTypes.js';

// Export execution engine components
export { ExecutionEngine, type ExecuteOptions, type ExecutionResult } from './execution/ExecutionEngine.js';
export { TimeoutManager } from './execution/TimeoutManager.js';
export { ResourceMonitor } from './execution/ResourceMonitor.js';
export { ExecutionContext } from './execution/ExecutionContext.js';

// Export filesystem
export { MemFS, type MemFSOptions, type FileStats, type QuotaUsage } from './filesystem/MemFS.js';
export { FileNode, type FileNodeOptions } from './filesystem/FileNode.js';
export { FileMetadata, type IFileMetadata } from './filesystem/FileMetadata.js';
export { FSWatcher, type WatchCallback, type WatchSubscription } from './filesystem/FSWatcher.js';
export {
  PERMISSIONS,
  parsePermissions,
  checkPermission,
  formatPermissions,
} from './filesystem/Permissions.js';

// Export module system
export { ModuleSystem } from './modules/ModuleSystem.js';
export { ModuleCache, type CacheStats } from './modules/ModuleCache.js';
export { CircularDeps } from './modules/CircularDeps.js';
export { ImportResolver, type ResolveOptions } from './modules/ImportResolver.js';

// Export project system
export { ProjectLoader, type PreparedProject, type ProjectStats } from './project/ProjectLoader.js';

// Export isolate pool
export { IsolatePool } from './isolate/IsolatePool.js';
export { PooledIsolate } from './isolate/PooledIsolate.js';
export { PoolStatsTracker, type PoolStats as IsolatePoolStats } from './isolate/PoolStats.js';

// Export sessions
export { Session, SessionManager, type SessionInfo } from './session/SessionManager.js';
export { StateStorage } from './session/StateStorage.js';

// Export context & globals
export { ContextBuilder } from './context/ContextBuilder.js';
export { GlobalsInjector } from './context/GlobalsInjector.js';
export { ConsoleHandler, type OutputCallback, type ConsoleMode } from './context/ConsoleHandler.js';
export { EnvHandler } from './context/EnvHandler.js';

// Export utilities
export { Timer } from './utils/Timer.js';
export { logger } from './utils/Logger.js';
export { AsyncQueue } from './utils/AsyncQueue.js';
export {
  isTransferable,
  copyValue,
  serializeForTransfer,
  createSafeProxy,
} from './utils/ObjectUtils.js';

// Export security utilities
export { ErrorSanitizer } from './security/ErrorSanitizer.js';
