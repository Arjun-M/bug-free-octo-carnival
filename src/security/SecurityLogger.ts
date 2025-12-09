/**
 * @fileoverview Security event logging
 */

import { EventEmitter } from '../utils/EventEmitter.js';
import { logger } from '../utils/Logger.js';

/**
 * Security event
 */
export interface SecurityEvent {
  type: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  details: Record<string, any>;
  code?: string;
  timestamp?: number;
}

/**
 * Security filter
 */
export interface SecurityFilter {
  type?: string;
  severity?: string;
  since?: number;
}

/**
 * Logs security events
 */
export class SecurityLogger {
  private events: SecurityEvent[] = [];
  private eventEmitter: EventEmitter;

  constructor() {
    this.eventEmitter = new EventEmitter();
    logger.debug('SecurityLogger initialized');
  }

  /**
   * Log security violation
   * @param event Security event
   */
  logViolation(event: SecurityEvent): void {
    const fullEvent: SecurityEvent = {
      ...event,
      timestamp: event.timestamp ?? Date.now(),
    };

    this.events.push(fullEvent);

    // Keep last 1000 events
    if (this.events.length > 1000) {
      this.events.shift();
    }

    logger.warn(`Security event: ${event.type}`, event);
    this.eventEmitter.emit('security:violation', fullEvent);

    // Emit by severity
    this.eventEmitter.emit(`security:${event.severity}`, fullEvent);
  }

  /**
   * Log module access
   * @param module Module name
   * @param allowed Whether access was allowed
   */
  logModuleAccess(module: string, allowed: boolean): void {
    this.logViolation({
      type: allowed ? 'module_access' : 'unauthorized_require',
      severity: allowed ? 'info' : 'warning',
      details: { module, allowed },
    });
  }

  /**
   * Log file access
   * @param path File path
   * @param operation Operation type
   * @param allowed Whether access was allowed
   */
  logFileAccess(path: string, operation: string, allowed: boolean = true): void {
    this.logViolation({
      type: 'file_access',
      severity: allowed ? 'info' : 'warning',
      details: { path, operation, allowed },
    });
  }

  /**
   * Log timeout violation
   * @param code Code that timed out
   * @param duration Duration in milliseconds
   */
  logTimeout(code: string, duration: number): void {
    this.logViolation({
      type: 'timeout',
      severity: 'warning',
      details: { duration, codeLength: code.length },
      code,
    });
  }

  /**
   * Log quota exceeded
   * @param type Quota type
   * @param usage Usage amount
   * @param limit Limit amount
   */
  logQuotaExceeded(type: string, usage: number, limit: number): void {
    this.logViolation({
      type: 'quota_exceeded',
      severity: 'error',
      details: { quotaType: type, usage, limit },
    });
  }

  /**
   * Log suspicious code pattern
   * @param code Suspicious code
   * @param reason Reason
   */
  logSuspiciousCode(code: string, reason: string): void {
    this.logViolation({
      type: 'suspicious_code',
      severity: 'warning',
      details: { reason, codeLength: code.length },
      code,
    });
  }

  /**
   * Get security events
   * @param filter Optional filter
   * @returns Filtered events
   */
  getEvents(filter?: SecurityFilter): SecurityEvent[] {
    let events = this.events;

    if (filter) {
      if (filter.type) {
        events = events.filter((e) => e.type === filter.type);
      }
      if (filter.severity) {
        events = events.filter((e) => e.severity === filter.severity);
      }
      if (filter.since) {
        events = events.filter((e) => (e.timestamp ?? 0) >= filter.since!);
      }
    }

    return events;
  }

  /**
   * Get event statistics
   */
  getStats(): Record<string, number> {
    const stats: Record<string, number> = {};

    for (const event of this.events) {
      const key = `${event.type}:${event.severity}`;
      stats[key] = (stats[key] ?? 0) + 1;
    }

    return stats;
  }

  /**
   * Get events by type
   * @param type Event type
   */
  getEventsByType(type: string): SecurityEvent[] {
    return this.events.filter((e) => e.type === type);
  }

  /**
   * Get events by severity
   * @param severity Event severity
   */
  getEventsBySeverity(severity: string): SecurityEvent[] {
    return this.events.filter((e) => e.severity === severity);
  }

  /**
   * Clear events
   */
  clear(): void {
    this.events = [];
    logger.debug('Security events cleared');
    this.eventEmitter.emit('security:cleared');
  }

  /**
   * Listen to security events
   * @param event Event name
   * @param handler Handler function
   */
  on(event: string, handler: Function): void {
    this.eventEmitter.on(event, handler as any);
  }

  /**
   * Remove event listener
   * @param event Event name
   * @param handler Handler function
   */
  off(event: string, handler: Function): void {
    this.eventEmitter.off(event, handler as any);
  }

  /**
   * Check if violations exceeded threshold
   * @param type Event type
   * @param threshold Threshold count
   */
  hasExceededThreshold(type: string, threshold: number): boolean {
    const count = this.getEventsByType(type).length;
    return count > threshold;
  }
}
