/**
 * Shared types for the execution engine.
 */

import type { ResourceUsage } from '../execution/ResourceMonitor.js';

export type { ResourceUsage } from '../execution/ResourceMonitor.js';

export enum TimeoutReason {
  WALL_CLOCK = 'timeout',
  INFINITE_LOOP = 'infinite-loop',
  CPU_LIMIT = 'cpu-limit',
  MEMORY_LIMIT = 'memory-limit',
}

export interface TimeoutEvent {
  id: string;
  reason: string;
  timestamp: number;
}

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
