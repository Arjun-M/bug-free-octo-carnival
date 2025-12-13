/**
 * @file src/session/StateStorage.ts
 * @description In-memory session state storage with key-value persistence for maintaining session data across executions. Provides CRUD operations for session state management.
 * @since 1.0.0
 * @copyright Copyright (c) 2025 Arjun-M. This source code is licensed under the MIT license.
 */

/**
 * StateStorage - In-memory session state storage.
 *
 * Maintains session state as nested Maps (sessionId -> key-value pairs),
 * providing isolated storage for each session with efficient access patterns.
 *
 * @class
 * @example
 * ```typescript
 * const storage = new StateStorage();
 * storage.set('session-1', 'username', 'alice');
 * const name = storage.get('session-1', 'username'); // 'alice'
 * storage.delete('session-1');
 * ```
 */
export class StateStorage {
  private storage: Map<string, Map<string, any>> = new Map();

  /**
   * Save session state
   * @param sessionId Session identifier
   * @param state State to save
   */
  save(sessionId: string, state: Map<string, any>): void {
    this.storage.set(sessionId, new Map(state));
  }

  /**
   * Load session state
   * @param sessionId Session identifier
   * @returns State map or undefined if not found
   */
  load(sessionId: string): Map<string, any> | undefined {
    const state = this.storage.get(sessionId);
    if (!state) {
      return undefined;
    }
    return new Map(state);
  }

  /**
   * Check if session state exists
   * @param sessionId Session identifier
   * @returns True if state exists
   */
  has(sessionId: string): boolean {
    return this.storage.has(sessionId);
  }

  /**
   * Delete session state
   * @param sessionId Session identifier
   */
  delete(sessionId: string): void {
    this.storage.delete(sessionId);
  }

  /**
   * Get state value
   * @param sessionId Session identifier
   * @param key State key
   * @returns Value or undefined
   */
  get(sessionId: string, key: string): any {
    const state = this.storage.get(sessionId);
    if (!state) {
      return undefined;
    }
    return state.get(key);
  }

  /**
   * Set state value
   * @param sessionId Session identifier
   * @param key State key
   * @param value State value
   */
  set(sessionId: string, key: string, value: any): void {
    if (!this.storage.has(sessionId)) {
      this.storage.set(sessionId, new Map());
    }

    const state = this.storage.get(sessionId)!;
    state.set(key, value);
  }

  /**
   * Clear all state for a session
   * @param sessionId Session identifier
   */
  clear(sessionId: string): void {
    const state = this.storage.get(sessionId);
    if (state) {
      state.clear();
    }
  }

  /**
   * Clear all storage
   */
  clearAll(): void {
    this.storage.clear();
  }

  /**
   * Get all session IDs
   * @returns Array of session IDs
   */
  getSessionIds(): string[] {
    return Array.from(this.storage.keys());
  }

  /**
   * Get session state as plain object
   * @param sessionId Session identifier
   * @returns Plain object or empty object
   */
  toObject(sessionId: string): Record<string, any> {
    const state = this.storage.get(sessionId);
    if (!state) {
      return {};
    }
    return Object.fromEntries(state);
  }
}
