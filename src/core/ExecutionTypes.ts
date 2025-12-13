/**
 * @file src/core/ExecutionTypes.ts
 * @description Shared type definitions for the execution engine, including timeout reasons, resource usage tracking, and execution event interfaces. These types are used throughout the execution lifecycle for monitoring and error handling.
 * @since 1.0.0
 * @copyright Copyright (c) 2025 Arjun-M. This source code is licensed under the MIT license.
 */

import type { ResourceUsage } from '../execution/ResourceMonitor.js';

export type { ResourceUsage } from '../execution/ResourceMonitor.js';

/**
 * Enumeration of possible timeout reasons during code execution.
 *
 * @enum {string}
 */
export enum TimeoutReason {
  WALL_CLOCK = 'timeout',
  INFINITE_LOOP = 'infinite-loop',
  CPU_LIMIT = 'cpu-limit',
  MEMORY_LIMIT = 'memory-limit',
}

/**
 * Event data emitted when a timeout occurs.
 *
 * @interface
 */
export interface TimeoutEvent {
  /** Unique execution identifier */
  id: string;
  /** Reason for timeout (e.g., 'timeout', 'infinite-loop', 'cpu-limit', 'memory-limit') */
  reason: string;
  /** Timestamp when timeout occurred */
  timestamp: number;
}

/**
 * Event data emitted when resource usage approaches or exceeds limits.
 *
 * @interface
 */
export interface ResourceWarningEvent {
  /** Unique execution identifier */
  id: string;
  /** Warning type (e.g., 'cpu-warning-80', 'memory-warning-95') */
  type: string;
  /** Warning severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Current CPU time in milliseconds */
  cpuTime?: number;
  /** CPU time limit in milliseconds */
  cpuLimit?: number;
  /** Current resource usage snapshot */
  usage?: ResourceUsage;
  /** Memory limit in bytes */
  memoryLimit?: number;
  /** Timestamp when warning was issued */
  timestamp?: number;
}

/**
 * Event data emitted during execution lifecycle (start, complete, error).
 *
 * @interface
 */
export interface ExecutionEvent {
  /** Unique execution identifier */
  id: string;
  /** Event type in the execution lifecycle */
  type: 'start' | 'complete' | 'error';
  /** Execution timeout in milliseconds (start event) */
  timeout?: number;
  /** Optional filename for better error messages (start event) */
  filename?: string;
  /** Execution duration in milliseconds (complete/error events) */
  duration?: number;
  /** CPU time consumed in milliseconds (complete event) */
  cpuTime?: number;
  /** Error message if execution failed (error event) */
  error?: string;
  /** Error code if execution failed (error event) */
  code?: string;
  /** Timestamp when event occurred */
  timestamp: number;
}
