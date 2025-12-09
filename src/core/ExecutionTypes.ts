/**
 * @fileoverview Additional types for execution engine (Session 2)
 */

import type { ResourceUsage, ResourceStats } from '../execution/ResourceMonitor.js';
import type { TimeoutHandle } from '../execution/TimeoutManager.js';
import type { SanitizedError } from '../security/ErrorSanitizer.js';

// Re-export from modules
export type { ResourceUsage, ResourceStats } from '../execution/ResourceMonitor.js';
export type { TimeoutHandle } from '../execution/TimeoutManager.js';
export type { SanitizedError } from '../security/ErrorSanitizer.js';

/**
 * Enum for timeout trigger reasons
 */
export enum TimeoutReason {
  WALL_CLOCK = 'timeout',
  INFINITE_LOOP = 'infinite-loop',
  CPU_LIMIT = 'cpu-limit',
  MEMORY_LIMIT = 'memory-limit',
}

/**
 * Event emitted when timeout occurs
 */
export interface TimeoutEvent {
  id: string;
  reason: string;
  timestamp: number;
}

/**
 * Event emitted for resource warnings
 */
export interface ResourceWarningEvent {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cpuTime?: number;
  cpuLimit?: number;
  usage?: ResourceUsage;
  memoryLimit?: number;
  timestamp?: number;
}

/**
 * Event for execution lifecycle
 */
export interface ExecutionEvent {
  id: string;
  type: 'start' | 'complete' | 'error';
  timeout?: number;
  filename?: string;
  duration?: number;
  cpuTime?: number;
  error?: string;
  code?: string;
  timestamp: number;
}
