/**
 * @fileoverview Session manager for persistent execution contexts
 */

import { SandboxError } from '../core/types.js';
import type { SessionOptions } from '../core/types.js';
import { StateStorage } from './StateStorage.js';
import { logger } from '../utils/Logger.js';

/**
 * Session information
 */
export interface SessionInfo {
  id: string;
  created: number;
  lastAccessed: number;
  expiresAt: number;
  executionCount: number;
  state: Record<string, any>;
}

/**
 * Persistent session with state
 */
export class Session {
  private id: string;
  private state: Map<string, any>;
  private stateStorage: StateStorage;
  private executionCount: number = 0;
  private created: number;
  private lastAccessed: number;
  private ttl: number;
  private maxExecutions: number;

  /**
   * Create a session
   * @param id Session identifier
   * @param stateStorage State storage backend
   * @param options Session options
   */
  constructor(
    id: string,
    stateStorage: StateStorage,
    options: SessionOptions = {}
  ) {
    this.id = id;
    this.stateStorage = stateStorage;
    this.ttl = options.ttl ?? 3600000; // 1 hour default
    this.maxExecutions = options.maxExecutions ?? 0; // 0 = unlimited
    this.created = Date.now();
    this.lastAccessed = Date.now();

    // Load existing state or create new
    const loaded = stateStorage.load(id);
    this.state = loaded ?? new Map();

    logger.debug(
      `Session ${id} created (ttl=${this.ttl}ms, maxExec=${this.maxExecutions})`
    );
  }

  /**
   * Get session ID
   */
  getId(): string {
    return this.id;
  }

  /**
   * Run code in session context
   * @param code Code to execute
   * @returns Promise resolving to execution result
   */
  async run<T = any>(code: string): Promise<T> {
    // Check if expired
    const now = Date.now();
    if (now - this.created > this.ttl) {
      throw new SandboxError('Session has expired', 'SESSION_EXPIRED', {
        sessionId: this.id,
        age: now - this.created,
        ttl: this.ttl,
      });
    }

    // Check max executions
    if (this.maxExecutions > 0 && this.executionCount >= this.maxExecutions) {
      throw new SandboxError(
        'Session max executions reached',
        'MAX_EXECUTIONS_EXCEEDED',
        {
          sessionId: this.id,
          count: this.executionCount,
          max: this.maxExecutions,
        }
      );
    }

    try {
      // Simulate code execution with state injection
      // In real implementation, this would use isolate with context
      const result = eval(code) as T;

      this.executionCount++;
      this.lastAccessed = Date.now();

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Session ${this.id} execution failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Set a value in session state
   * @param key State key
   * @param value State value
   */
  setState(key: string, value: any): void {
    this.state.set(key, value);
    this.stateStorage.set(this.id, key, value);
  }

  /**
   * Get value from session state
   * @param key Optional state key (returns all if omitted)
   * @returns State value or all state as object
   */
  getState(key?: string): any {
    if (key) {
      return this.state.get(key);
    }
    return Object.fromEntries(this.state);
  }

  /**
   * Check if state key exists
   * @param key State key
   * @returns True if key exists
   */
  hasState(key: string): boolean {
    return this.state.has(key);
  }

  /**
   * Delete a state key
   * @param key State key
   */
  deleteState(key: string): void {
    this.state.delete(key);
    this.stateStorage.delete(this.id);
  }

  /**
   * Clear all session state
   */
  clearState(): void {
    this.state.clear();
    this.stateStorage.clear(this.id);
  }

  /**
   * Get session metrics
   */
  getMetrics(): {
    id: string;
    created: number;
    lastAccessed: number;
    age: number;
    executionCount: number;
    isExpired: boolean;
    expiresIn: number;
  } {
    const now = Date.now();
    const age = now - this.created;
    const isExpired = age > this.ttl;
    const expiresIn = Math.max(0, this.ttl - age);

    return {
      id: this.id,
      created: this.created,
      lastAccessed: this.lastAccessed,
      age,
      executionCount: this.executionCount,
      isExpired,
      expiresIn,
    };
  }

  /**
   * Get session info
   */
  getInfo(): SessionInfo {
    return {
      id: this.id,
      created: this.created,
      lastAccessed: this.lastAccessed,
      expiresAt: this.created + this.ttl,
      executionCount: this.executionCount,
      state: Object.fromEntries(this.state),
    };
  }

  /**
   * Check if session is expired
   */
  isExpired(): boolean {
    return Date.now() - this.created > this.ttl;
  }

  /**
   * Check if session has max executions exceeded
   */
  isMaxExecutionsExceeded(): boolean {
    return this.maxExecutions > 0 && this.executionCount >= this.maxExecutions;
  }

  /**
   * Dispose of session
   */
  async dispose(): Promise<void> {
    this.stateStorage.delete(this.id);
    this.state.clear();
    logger.debug(`Session ${this.id} disposed`);
  }

  /**
   * Update last accessed time (called on each operation)
   */
  private updateLastAccessed(): void {
    this.lastAccessed = Date.now();
  }
}

/**
 * Manage multiple sessions
 */
export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private stateStorage: StateStorage;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private cleanupIntervalMs: number;

  /**
   * Create session manager
   * @param cleanupIntervalMs Interval for cleanup (default 60s)
   */
  constructor(cleanupIntervalMs: number = 60000) {
    this.stateStorage = new StateStorage();
    this.cleanupIntervalMs = cleanupIntervalMs;
    this.startCleanupInterval();
  }

  /**
   * Create a new session
   * @param id Session identifier
   * @param options Session options
   * @returns Created session
   */
  createSession(id: string, options: SessionOptions = {}): Session {
    if (this.sessions.has(id)) {
      throw new SandboxError(`Session ${id} already exists`, 'SESSION_EXISTS');
    }

    const session = new Session(id, this.stateStorage, options);
    this.sessions.set(id, session);

    return session;
  }

  /**
   * Get a session by ID
   * @param id Session identifier
   * @returns Session or undefined
   */
  getSession(id: string): Session | undefined {
    const session = this.sessions.get(id);

    if (!session) {
      return undefined;
    }

    // Check if expired
    if (session.isExpired()) {
      this.deleteSession(id);
      return undefined;
    }

    return session;
  }

  /**
   * Delete a session
   * @param id Session identifier
   */
  async deleteSession(id: string): Promise<void> {
    const session = this.sessions.get(id);

    if (session) {
      await session.dispose();
      this.sessions.delete(id);
    }
  }

  /**
   * List all active sessions
   * @returns Array of session info
   */
  listSessions(): SessionInfo[] {
    return Array.from(this.sessions.values())
      .filter((s) => !s.isExpired())
      .map((s) => s.getInfo());
  }

  /**
   * Clean up expired sessions
   */
  async cleanup(): Promise<void> {
    const toDelete: string[] = [];

    for (const [id, session] of this.sessions) {
      if (session.isExpired()) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      await this.deleteSession(id);
    }

    if (toDelete.length > 0) {
      logger.debug(`Cleaned up ${toDelete.length} expired sessions`);
    }
  }

  /**
   * Dispose all sessions
   */
  async disposeAll(): Promise<void> {
    const ids = Array.from(this.sessions.keys());

    for (const id of ids) {
      await this.deleteSession(id);
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    logger.info('SessionManager disposed');
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(
      () => {
        this.cleanup().catch((error) => {
          logger.error(`Cleanup error: ${error}`);
        });
      },
      this.cleanupIntervalMs
    );
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }
}
