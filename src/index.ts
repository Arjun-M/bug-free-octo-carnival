/**
 * IsoBox - A secure, isolated sandbox for untrusted code.
 */

export { IsoBox } from './core/IsoBox.js';
export { CompiledScript } from './core/CompiledScript.js';

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

export type {
  ResourceUsage,
  TimeoutEvent,
  ResourceWarningEvent,
  ExecutionEvent,
} from './core/ExecutionTypes.js';

export type { ResourceStats } from './execution/ResourceMonitor.js';
export type { TimeoutHandle } from './execution/TimeoutManager.js';
export type { SanitizedError } from './security/ErrorSanitizer.js';

export { TimeoutReason } from './core/ExecutionTypes.js';

export { ExecutionEngine, type ExecuteOptions, type ExecutionResult } from './execution/ExecutionEngine.js';
export { TimeoutManager } from './execution/TimeoutManager.js';
export { ResourceMonitor } from './execution/ResourceMonitor.js';
export { ExecutionContext } from './execution/ExecutionContext.js';

// Avoid duplicate identifier exports
export { MemFS, type MemFSOptions, type QuotaUsage } from './filesystem/MemFS.js';
export { FileNode, type FileNodeOptions } from './filesystem/FileNode.js';
export { FileMetadata, type IFileMetadata } from './filesystem/FileMetadata.js';
export { FSWatcher, type WatchCallback, type WatchSubscription } from './filesystem/FSWatcher.js';
export {
  PERMISSIONS,
  parsePermissions,
  checkPermission,
  formatPermissions,
} from './filesystem/Permissions.js';

export { ModuleSystem } from './modules/ModuleSystem.js';
export { ModuleCache, type CacheStats } from './modules/ModuleCache.js';
export { CircularDeps } from './modules/CircularDeps.js';
export { ImportResolver, type ResolveOptions } from './modules/ImportResolver.js';

export { ProjectLoader, type PreparedProject, type ProjectStats } from './project/ProjectLoader.js';

export { IsolatePool } from './isolate/IsolatePool.js';
export { PooledIsolate } from './isolate/PooledIsolate.js';
export { PoolStatsTracker } from './isolate/PoolStats.js';

// Removed Session export here because it's already exported from core/types.js
export { SessionManager, type SessionInfo } from './session/SessionManager.js';
export { StateStorage } from './session/StateStorage.js';

export { ContextBuilder } from './context/ContextBuilder.js';
export { GlobalsInjector } from './context/GlobalsInjector.js';
// Removed ConsoleMode export here because it's already exported from core/types.js
export { ConsoleHandler, type OutputCallback } from './context/ConsoleHandler.js';
export { EnvHandler } from './context/EnvHandler.js';

export { Timer } from './utils/Timer.js';
export { logger } from './utils/Logger.js';
export { AsyncQueue } from './utils/AsyncQueue.js';
export {
  isTransferable,
  copyValue,
  serializeForTransfer,
  createSafeProxy,
} from './utils/ObjectUtils.js';

export { ErrorSanitizer } from './security/ErrorSanitizer.js';
