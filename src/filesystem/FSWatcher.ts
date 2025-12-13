/**
 * @file src/filesystem/FSWatcher.ts
 * @description File system watcher for monitoring changes to files and directories. Provides event-based notifications for create, modify, and delete operations.
 * @since 1.0.0
 * @copyright Copyright (c) 2025 Arjun-M. This source code is licensed under the MIT license.
 */

/**
 * Callback function type for file system change events.
 *
 * @callback WatchCallback
 * @param event - Type of change event
 * @param path - Path where change occurred
 */
export type WatchCallback = (event: 'create' | 'modify' | 'delete', path: string) => void;

/**
 * Watch subscription with unique ID for management.
 *
 * @interface WatchSubscription
 */
export interface WatchSubscription {
  id: string;
  path: string;
  callback: WatchCallback;
}

/**
 * Manages file system watches and change notifications.
 *
 * Allows multiple watchers to subscribe to path changes. Notifies both exact path
 * watchers and parent directory watchers when events occur. Handles subscription
 * lifecycle with unique IDs for management.
 *
 * @class FSWatcher
 */
export class FSWatcher {
  private subscriptions: Map<string, WatchSubscription> = new Map();
  private watchesByPath: Map<string, Set<string>> = new Map();
  private idCounter: number = 0;

  /**
   * Subscribe to changes on a path
   * @param path Path to watch
   * @param callback Callback function for changes
   * @returns Watch subscription ID for unsubscribe
   */
  subscribe(path: string, callback: WatchCallback): string {
    const id = `watch-${++this.idCounter}-${Date.now()}`;

    const subscription: WatchSubscription = {
      id,
      path,
      callback,
    };

    this.subscriptions.set(id, subscription);

    // Track subscriptions by path
    if (!this.watchesByPath.has(path)) {
      this.watchesByPath.set(path, new Set());
    }
    this.watchesByPath.get(path)!.add(id);

    return id;
  }

  /**
   * Unsubscribe from watching a path
   * @param watchId Watch subscription ID
   */
  unsubscribe(watchId: string): void {
    const subscription = this.subscriptions.get(watchId);
    if (subscription) {
      const pathWatchers = this.watchesByPath.get(subscription.path);
      if (pathWatchers) {
        pathWatchers.delete(watchId);
        if (pathWatchers.size === 0) {
          this.watchesByPath.delete(subscription.path);
        }
      }
      this.subscriptions.delete(watchId);
    }
  }

  /**
   * Notify all watchers for a path
   * @param path Path that changed
   * @param event Event type
   */
  notify(path: string, event: 'create' | 'modify' | 'delete'): void {
    // Notify exact path watchers
    const pathWatchers = this.watchesByPath.get(path);
    if (pathWatchers) {
      for (const watchId of pathWatchers) {
        const subscription = this.subscriptions.get(watchId);
        if (subscription) {
          try {
            subscription.callback(event, path);
          } catch (err) {
            // Silently ignore watcher errors
          }
        }
      }
    }

    // Notify parent directory watchers
    const parentPath = this.getParentPath(path);
    if (parentPath !== path) {
      const parentWatchers = this.watchesByPath.get(parentPath);
      if (parentWatchers) {
        for (const watchId of parentWatchers) {
          const subscription = this.subscriptions.get(watchId);
          if (subscription) {
            try {
              subscription.callback(event, path);
            } catch (err) {
              // Silently ignore watcher errors
            }
          }
        }
      }
    }
  }

  /**
   * Get parent path of a given path
   * @param path File path
   * @returns Parent directory path
   */
  private getParentPath(path: string): string {
    const parts = path.split('/').filter((p) => p.length > 0);
    if (parts.length <= 1) {
      return '/';
    }
    return '/' + parts.slice(0, -1).join('/');
  }

  /**
   * Get all active watch subscriptions for a path
   * @param path Path to get watchers for
   * @returns Array of active watch IDs
   */
  getWatchers(path: string): string[] {
    const watchers = this.watchesByPath.get(path);
    return watchers ? Array.from(watchers) : [];
  }

  /**
   * Get all active subscriptions
   * @returns Array of all subscriptions
   */
  getAllSubscriptions(): WatchSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Clear all subscriptions
   */
  clear(): void {
    this.subscriptions.clear();
    this.watchesByPath.clear();
  }

  /**
   * Get count of active subscriptions
   */
  count(): number {
    return this.subscriptions.size;
  }
}
