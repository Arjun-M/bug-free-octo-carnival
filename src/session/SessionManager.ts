/**
 * Manages persistent execution sessions.
 */

import { SandboxError } from '../core/types.js';
import type { SessionOptions, RunOptions } from '../core/types.js';
import { StateStorage } from './StateStorage.js';
import { logger } from '../utils/Logger.js';
import type { IsoBox } from '../core/IsoBox.js';

export interface SessionInfo {
  id: string;
  created: number;
  lastAccessed: number;
  expiresAt: number;
  executionCount: number;
  state: Record<string, any>;
}

export class Session {
  private id: string;
  private state: Map<string, any>;
  private stateStorage: StateStorage;
  private executionCount: number = 0;
  private created: number;
  private lastAccessed: number;
  private ttl: number;
  private maxExecutions: number;
  private isobox: IsoBox;

  constructor(
    id: string,
    stateStorage: StateStorage,
    isobox: IsoBox,
    options: SessionOptions = {}
  ) {
    this.id = id;
    this.stateStorage = stateStorage;
    this.isobox = isobox;
    this.ttl = options.ttl ?? 3600000; // 1 hour
    this.maxExecutions = options.maxExecutions ?? 0;
    this.created = Date.now();
    this.lastAccessed = Date.now();

    const loaded = stateStorage.load(id);
    this.state = loaded ?? new Map();

    logger.debug(
      `Session ${id} created (ttl=${this.ttl}ms)`
    );
  }

  getId(): string {
    return this.id;
  }

  async run<T = any>(code: string, options: RunOptions = {}): Promise<T> {
    const now = Date.now();
    if (now - this.created > this.ttl) {
      throw new SandboxError('Session expired', 'SESSION_EXPIRED');
    }

    if (this.maxExecutions > 0 && this.executionCount >= this.maxExecutions) {
      throw new SandboxError('Max executions reached', 'MAX_EXECUTIONS_EXCEEDED');
    }

    try {
      // Use IsoBox to run code with session context injection
      // We rely on IsoBox.run handling context creation and execution

      // Note: This assumes IsoBox.run can accept pre-filled context/globals
      // Since IsoBox.run doesn't expose context injection directly in public API (RunOptions),
      // we might need to rely on the fact that sessions are stateful containers.
      // But IsoBox instances are stateless regarding JS context usually.

      // Ideally, IsoBox.run should accept a `context` or `globals` override.
      // But we can't change IsoBox signature easily without breaking things.

      // HOWEVER, the user suggested:
      /*
        const contextWithState = {
          ...Object.fromEntries(this.state),
          ...(options?.context || {})
        };
        const result = await this.isobox.run(code, { ...options, context: contextWithState });
      */

      // `RunOptions` in `types.ts` does NOT have `context`.
      // I should add `context?: Record<string, any>` to `RunOptions` in `types.ts` first?
      // Or I can cast options.

      // Let's assume I can pass it and handle it in IsoBox.
      // But `IsoBox.run` implementation needs to look at `opts.context`.

      // I will update types.ts to include `context` in `RunOptions` (as hidden/advanced option maybe?) or just cast it.
      // Let's cast it for now to avoid changing public types too much if not desired,
      // but proper way is to add it.

      // Actually, `IsoBox.run` just creates a fresh context every time in `Phase 0` implementation.
      // If I want to inject state, I need `IsoBox.run` to support it.

      // I will add `sandbox?: Record<string, any>` to `RunOptions` which overrides/merges with global sandbox.
      // `IsoBoxOptions` has `sandbox`. `RunOptions` doesn't.
      // Let's add `sandbox` to `RunOptions`.

      const sessionState = Object.fromEntries(this.state);

      // We use 'sandbox' option to inject state
      const runOpts = {
        ...options,
        sandbox: { ...sessionState, ...(options as any).sandbox }
      };

      const result = await this.isobox.run<T>(code, runOpts);

      this.executionCount++;
      this.lastAccessed = Date.now();

      // Note: We are not capturing state changes back from the execution yet.
      // That requires bi-directional state sync which is complex.
      // For Phase 0, read-only state injection is a good start.

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Session ${this.id} error: ${err.message}`);
      throw err;
    }
  }

  setState(key: string, value: any): void {
    this.state.set(key, value);
    this.stateStorage.set(this.id, key, value);
    this.updateLastAccessed();
  }

  getState(key?: string): any {
    this.updateLastAccessed();
    if (key) {
      return this.state.get(key);
    }
    return Object.fromEntries(this.state);
  }

  hasState(key: string): boolean {
    return this.state.has(key);
  }

  deleteState(key: string): void {
    this.state.delete(key);
    this.stateStorage.delete(this.id);
    this.updateLastAccessed();
  }

  clearState(): void {
    this.state.clear();
    this.stateStorage.clear(this.id);
    this.updateLastAccessed();
  }

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

  isExpired(): boolean {
    return Date.now() - this.created > this.ttl;
  }

  isMaxExecutionsExceeded(): boolean {
    return this.maxExecutions > 0 && this.executionCount >= this.maxExecutions;
  }

  async dispose(): Promise<void> {
    this.stateStorage.delete(this.id);
    this.state.clear();
    logger.debug(`Session ${this.id} disposed`);
  }

  private updateLastAccessed(): void {
    this.lastAccessed = Date.now();
  }
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private stateStorage: StateStorage;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private cleanupIntervalMs: number;
  private isobox: IsoBox;

  constructor(isobox: IsoBox, cleanupIntervalMs: number = 60000) {
    this.isobox = isobox;
    this.stateStorage = new StateStorage();
    this.cleanupIntervalMs = cleanupIntervalMs;
    this.startCleanupInterval();
  }

  createSession(id: string, options: SessionOptions = {}): Session {
    if (this.sessions.has(id)) {
      throw new SandboxError(`Session ${id} exists`, 'SESSION_EXISTS');
    }

    const session = new Session(id, this.stateStorage, this.isobox, options);
    this.sessions.set(id, session);

    return session;
  }

  getSession(id: string): Session | undefined {
    const session = this.sessions.get(id);

    if (!session) return undefined;

    if (session.isExpired()) {
      this.deleteSession(id);
      return undefined;
    }

    return session;
  }

  async deleteSession(id: string): Promise<void> {
    const session = this.sessions.get(id);

    if (session) {
      await session.dispose();
      this.sessions.delete(id);
    }
  }

  listSessions(): SessionInfo[] {
    return Array.from(this.sessions.values())
      .filter((s) => !s.isExpired())
      .map((s) => s.getInfo());
  }

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

  getSessionCount(): number {
    return this.sessions.size;
  }
}
