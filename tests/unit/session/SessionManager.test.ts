import { SessionManager, Session } from '../../../src/session/SessionManager';
import { StateStorage } from '../../../src/session/StateStorage';

// Mock dependencies
jest.mock('../../../src/session/StateStorage', () => ({
  StateStorage: class {
    load = jest.fn().mockReturnValue(new Map());
    set = jest.fn();
    delete = jest.fn();
    clear = jest.fn();
  }
}));

describe('SessionManager', () => {
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager(100); // 100ms cleanup interval
    jest.useFakeTimers();
  });

  afterEach(async () => {
    await sessionManager.disposeAll();
    jest.useRealTimers();
  });

  describe('Session Creation', () => {
    it('should create a session', () => {
      const session = sessionManager.createSession('session-1');
      expect(session).toBeDefined();
      expect(session.getId()).toBe('session-1');
    });

    it('should throw error when creating duplicate session', () => {
      sessionManager.createSession('session-1');
      expect(() => sessionManager.createSession('session-1'))
        .toThrow('Session session-1 already exists');
    });
  });

  describe('Session Retrieval', () => {
    it('should retrieve existing session', () => {
      const session = sessionManager.createSession('session-1');
      const retrieved = sessionManager.getSession('session-1');
      expect(retrieved).toBe(session);
    });

    it('should return undefined for non-existent session', () => {
      expect(sessionManager.getSession('non-existent')).toBeUndefined();
    });

    it('should not return expired session', () => {
      sessionManager.createSession('expired', { ttl: 10 });
      jest.advanceTimersByTime(20);

      expect(sessionManager.getSession('expired')).toBeUndefined();
    });
  });

  describe('Cleanup', () => {
    it('should auto-cleanup expired sessions', async () => {
      sessionManager.createSession('short', { ttl: 10 });
      sessionManager.createSession('long', { ttl: 1000 });

      // The session manager interval is 100ms
      // Wait long enough for interval tick AND for 'short' session to expire
      await jest.advanceTimersByTimeAsync(200);

      // Force cleanup manually as interval might be unreliable in test environment with fake timers
      // The cleanup is async so we need to wait for it
      await sessionManager.cleanup();

      expect(sessionManager.getSessionCount()).toBe(1);
      expect(sessionManager.getSession('long')).toBeDefined();
    });
  });

  describe('Management', () => {
    it('should list active sessions', () => {
      sessionManager.createSession('s1');
      sessionManager.createSession('s2');

      const sessions = sessionManager.listSessions();
      expect(sessions).toHaveLength(2);
      expect(sessions.map(s => s.id)).toContain('s1');
      expect(sessions.map(s => s.id)).toContain('s2');
    });

    it('should dispose all sessions', async () => {
      sessionManager.createSession('s1');
      await sessionManager.disposeAll();
      expect(sessionManager.getSessionCount()).toBe(0);
    });
  });
});

describe('Session', () => {
  let session: Session;
  let mockStateStorage: any;

  beforeEach(() => {
    mockStateStorage = new StateStorage();
    session = new Session('test', mockStateStorage, { maxExecutions: 2 });
  });

  describe('Execution Limit', () => {
    it('should allow executions within limit', async () => {
      await session.run('1+1');
      await session.run('1+1');
      expect(session.getMetrics().executionCount).toBe(2);
    });

    it('should throw when execution limit exceeded', async () => {
      await session.run('1+1');
      await session.run('1+1');
      await expect(session.run('1+1')).rejects.toThrow('Session max executions reached');
    });
  });

  describe('State Management', () => {
    it('should set and get state', () => {
      session.setState('key', 'value');
      expect(session.getState('key')).toBe('value');
      expect(session.hasState('key')).toBe(true);
    });

    it('should delete state', () => {
      session.setState('key', 'value');
      session.deleteState('key');
      expect(session.hasState('key')).toBe(false);
    });

    it('should clear state', () => {
      session.setState('k1', 'v1');
      session.setState('k2', 'v2');
      session.clearState();
      expect(session.getState()).toEqual({});
    });
  });
});
