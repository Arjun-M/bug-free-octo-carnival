/**
 * @fileoverview Core type definitions for IsoBox sandbox
 */

/**
 * Supported programming languages for execution
 */
export type Language = 'javascript' | 'typescript' | 'js' | 'ts';

/**
 * Console output mode
 */
export type ConsoleMode = 'inherit' | 'redirect' | 'off';

/**
 * Module system mode
 */
export type ModuleMode = 'whitelist' | 'strict' | 'permissive';

/**
 * Security event severity levels
 */
export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Security event types
 */
export type SecurityEventType =
  | 'forbidden_module_access'
  | 'forbidden_property_access'
  | 'timeout_enforcement'
  | 'memory_limit_exceeded'
  | 'cpu_limit_exceeded'
  | 'filesystem_violation'
  | 'network_attempt'
  | 'other';

/**
 * Configuration for console behavior
 */
export interface ConsoleOptions {
  /** Output mode: inherit (pass-through), redirect (capture), or off (disable) */
  mode: ConsoleMode;
  /** Maximum number of console messages to capture */
  maxMessages?: number;
  /** Callback when output is captured */
  onOutput?: (
    level: 'log' | 'warn' | 'error' | 'info',
    args: any[]
  ) => void;
}

/**
 * Configuration for module resolution and mocking
 */
export interface RequireOptions {
  /** List of allowed module names (whitelist mode) */
  whitelist?: string[];
  /** Mock implementations for modules */
  mocks?: Record<string, any>;
  /** Module resolution mode */
  mode: ModuleMode;
  /** Whether to allow built-in Node.js modules */
  allowBuiltins?: boolean;
}

/**
 * Configuration for filesystem access
 */
export interface FilesystemOptions {
  /** Enable filesystem access */
  enabled: boolean;
  /** Maximum total filesystem size in bytes */
  maxSize: number;
  /** Root directory (defaults to '/') */
  root?: string;
}

/**
 * Configuration for TypeScript support
 */
export interface TypeScriptOptions {
  /** Enable TypeScript transpilation */
  enabled: boolean;
  /** Enable type checking before execution */
  typeCheck: boolean;
  /** Use strict mode for TypeScript */
  strict: boolean;
  /** Target ECMAScript version */
  target: 'ES2020' | 'ES2021' | 'ES2022' | 'ES2023';
}

/**
 * Configuration for security features
 */
export interface SecurityOptions {
  /** Log security violations */
  logViolations: boolean;
  /** Sanitize error messages to prevent information leakage */
  sanitizeErrors: boolean;
  /** Callback for security events */
  onSecurityEvent?: (event: SecurityEvent) => void;
}

/**
 * Configuration for metrics collection
 */
export interface MetricsOptions {
  /** Enable metrics collection */
  enabled: boolean;
  /** Collect CPU time metrics */
  collectCpu: boolean;
  /** Collect memory usage metrics */
  collectMemory: boolean;
  /** Maximum metrics history size */
  maxHistory?: number;
}

/**
 * Main IsoBox configuration options
 */
export interface IsoBoxOptions {
  /** Execution timeout in milliseconds (default: 5000) */
  timeout?: number;
  /** CPU time limit in milliseconds (default: 10000) */
  cpuTimeLimit?: number;
  /** Memory limit in bytes (default: 128MB) */
  memoryLimit?: number;
  /** Enforce strict timeout regardless of running operations */
  strictTimeout?: boolean;
  /** Use isolate pooling */
  usePooling?: boolean;
  /** Pool configuration */
  pool?: PoolOptions;
  /** Sandbox-specific options */
  sandbox?: Record<string, any>;
  /** Console behavior configuration */
  console?: ConsoleOptions;
  /** Module resolution configuration */
  require?: RequireOptions;
  /** Filesystem configuration */
  filesystem?: FilesystemOptions;
  /** TypeScript configuration */
  typescript?: TypeScriptOptions;
  /** Security configuration */
  security?: SecurityOptions;
  /** Metrics configuration */
  metrics?: MetricsOptions;
  /** Interval for cleaning up expired sessions (ms) */
  sessionCleanupInterval?: number;
}

/**
 * Options for running code
 */
export interface RunOptions {
  /** Filename for this execution (for stack traces) */
  filename?: string;
  /** Language of the code ('javascript', 'typescript', etc.) */
  language?: Language;
  /** Override default timeout for this execution */
  timeout?: number;
  /** Override default CPU time limit */
  cpuTimeLimit?: number;
  /** Override default memory limit */
  memoryLimit?: number;
}

/**
 * Represents a file in a project
 */
export interface ProjectFile {
  /** File path (e.g., 'src/index.ts') */
  path: string;
  /** File contents */
  code: string;
  /** Programming language */
  language?: Language;
}

/**
 * Options for running a multi-file project
 */
export interface ProjectOptions {
  /** Array of files in the project */
  files: ProjectFile[];
  /** Path to entry point file (e.g., 'src/index.ts') */
  entrypoint: string;
  /** Override default timeout */
  timeout?: number;
  /** Override default CPU time limit */
  cpuTimeLimit?: number;
}

/**
 * Options for creating a persistent session
 */
export interface SessionOptions {
  /** Session time-to-live in milliseconds */
  ttl?: number;
  /** Maximum number of executions allowed */
  maxExecutions?: number;
  /** Whether to persist state between executions */
  persistent?: boolean;
}

/**
 * Options for resource pooling
 */
export interface PoolOptions {
  /** Minimum number of pooled isolates */
  min?: number;
  /** Maximum number of pooled isolates */
  max?: number;
  /** Idle timeout before removing excess isolates (ms) */
  idleTimeout?: number;
  /** Code to run on isolate creation for warmup */
  warmupCode?: string;
}

/**
 * Execution metrics for a single run
 */
export interface ExecutionMetrics {
  /** Total execution time in milliseconds */
  duration: number;
  /** CPU time consumed in milliseconds */
  cpuTime: number;
  /** Memory statistics */
  memory: {
    /** Peak memory usage in bytes */
    peak: number;
    /** Final memory usage in bytes */
    final: number;
    /** External memory in bytes */
    external: number;
  };
  /** Call statistics */
  callStats: {
    /** Number of function calls */
    totalCalls: number;
    /** Average call duration in microseconds */
    avgCallDuration: number;
  };
  /** Array of errors encountered */
  errors: Array<{
    message: string;
    stack?: string;
    timestamp: number;
  }>;
}

/**
 * Global metrics across all executions
 */
export interface GlobalMetrics {
  /** Total number of executions */
  totalExecutions: number;
  /** Number of failed executions */
  errorCount: number;
  /** Average execution time in milliseconds */
  avgTime: number;
  /** Total memory used in bytes */
  memoryUsed: number;
  /** Total CPU time used in milliseconds */
  cpuTimeUsed: number;
  /** Timestamp of first execution */
  startTime: number;
  /** Timestamp of last execution */
  lastExecutionTime: number;
}

/**
 * Session-specific metrics
 */
export interface SessionMetrics {
  /** Number of executions in this session */
  executionCount: number;
  /** Current session state (object) */
  state: Record<string, any>;
  /** Session creation timestamp */
  created: number;
  /** Last access timestamp */
  lastAccessed: number;
  /** Accumulated metrics for this session */
  metrics: ExecutionMetrics[];
}

/**
 * Resource pool statistics
 */
export interface PoolStats {
  /** Number of isolates created so far */
  created: number;
  /** Number of currently active isolates */
  active: number;
  /** Number of currently idle isolates */
  idle: number;
  /** Total executions across all pooled isolates */
  totalExecutions: number;
  /** Average execution time in milliseconds */
  avgTime: number;
}

/**
 * Filesystem file statistics
 */
export interface FileStats {
  /** File size in bytes */
  size: number;
  /** Creation timestamp */
  created: number;
  /** Last modified timestamp */
  modified: number;
  /** File permissions (Unix-style) */
  permissions: number;
  /** Whether this is a directory */
  isDirectory: boolean;
}

/**
 * Security event information
 */
export interface SecurityEvent {
  /** Event timestamp */
  timestamp: number;
  /** Type of security violation */
  type: SecurityEventType;
  /** Severity level */
  severity: SecuritySeverity;
  /** Detailed description */
  details: string;
  /** Code snippet that triggered the event (if available) */
  code?: string;
  /** User/session ID (if applicable) */
  userId?: string;
}

/**
 * Compiled and ready-to-execute script
 */
export interface CompiledScriptData {
  /** Original source code */
  code: string;
  /** Compiled/transpiled version */
  compiled: string;
  /** Language of the original code */
  language: Language;
  /** Compilation timestamp */
  compiledAt: number;
}

/**
 * Custom error class for sandbox-specific errors
 */
export class SandboxError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'SANDBOX_ERROR',
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = 'SandboxError';
    Object.setPrototypeOf(this, SandboxError.prototype);
  }
}

/**
 * Custom error class for timeout violations
 */
export class TimeoutError extends SandboxError {
  constructor(
    message: string = 'Execution timeout exceeded',
    public readonly timeout: number = 0,
    context?: Record<string, any>
  ) {
    super(message, 'TIMEOUT_ERROR', context);
    this.name = 'TimeoutError';
    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * Custom error class for memory limit violations
 */
export class MemoryLimitError extends SandboxError {
  constructor(
    message: string = 'Memory limit exceeded',
    public readonly limit: number = 0,
    context?: Record<string, any>
  ) {
    super(message, 'MEMORY_LIMIT_ERROR', context);
    this.name = 'MemoryLimitError';
    Object.setPrototypeOf(this, MemoryLimitError.prototype);
  }
}

/**
 * Custom error class for CPU time limit violations
 */
export class CPULimitError extends SandboxError {
  constructor(
    message: string = 'CPU time limit exceeded',
    public readonly limit: number = 0,
    context?: Record<string, any>
  ) {
    super(message, 'CPU_LIMIT_ERROR', context);
    this.name = 'CPULimitError';
    Object.setPrototypeOf(this, CPULimitError.prototype);
  }
}

/**
 * Represents a persistent execution session
 */
export interface Session {
  /** Unique session ID */
  id: string;
  /** Session creation timestamp */
  created: number;
  /** Session expiration timestamp */
  expiresAt: number;
  /** Current session state */
  state: Record<string, any>;
  /** Number of executions */
  executionCount: number;
  /** Maximum allowed executions (0 = unlimited) */
  maxExecutions: number;
  /** Last access timestamp */
  lastAccessed: number;
  /** Whether to persist state between executions */
  persistent: boolean;
}
