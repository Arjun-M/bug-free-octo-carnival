import { IsoBox } from '../../../src/core/IsoBox';
import { SandboxError } from '../../../src/core/types';

describe('IsoBox Core', () => {
  let isobox: IsoBox;

  beforeEach(() => {
    isobox = new IsoBox();
  });

  afterEach(async () => {
    await isobox.dispose();
  });

  describe('Constructor', () => {
    it('should initialize with default options', () => {
      const box = new IsoBox();
      const metrics = box.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.totalExecutions).toBe(0);
      expect(box.fs).toBeDefined();
    });

    it('should accept valid options', () => {
      const box = new IsoBox({
        timeout: 1000,
        memoryLimit: 128 * 1024 * 1024,
      });
      expect(box).toBeDefined();
    });

    it('should throw error for negative timeout', () => {
      expect(() => new IsoBox({ timeout: -1 })).toThrow(SandboxError);
    });

    it('should throw error for insufficient memory limit', () => {
      expect(() => new IsoBox({ memoryLimit: 1024 })).toThrow(SandboxError);
    });
  });

  describe('Code Execution', () => {
    it('should execute code successfully', async () => {
      const result = await isobox.run('const a = 1; a;');
      expect(result).toBe(1);
    });

    it('should emit execution events', async () => {
      const startSpy = jest.fn();
      const completeSpy = jest.fn();

      isobox.on('execution', (event: any) => {
        if (event.type === 'start') startSpy(event);
        if (event.type === 'complete') completeSpy(event);
      });

      await isobox.run('1 + 1');

      expect(startSpy).toHaveBeenCalled();
      expect(completeSpy).toHaveBeenCalled();
    }, 10000); // Increased timeout

    it('should throw error for empty code', async () => {
      await expect(isobox.run('')).rejects.toThrow('Code cannot be empty');
      await expect(isobox.run('   ')).rejects.toThrow('Code cannot be empty');
    });

    it('should respect custom timeout in run options', async () => {
      const startSpy = jest.fn();
      isobox.on('execution', (event: any) => {
        if (event.type === 'start') startSpy(event);
      });

      await isobox.run('1 + 1', { timeout: 100 });

      expect(startSpy).toHaveBeenCalledWith(expect.objectContaining({
        timeout: 100
      }));
    });
  });

  describe('Project Execution', () => {
    it('should execute a project', async () => {
      const project = {
        files: [
          { path: 'main.js', code: 'console.log("hello")' }
        ],
        entrypoint: 'main.js'
      };

      const result = await isobox.runProject(project);
      expect(result).toBeUndefined();
    });

    it('should throw error for project with no files', async () => {
      await expect(isobox.runProject({ files: [], entrypoint: 'main.js' }))
        .rejects.toThrow('Project must have at least one file');
    });

    it('should throw error for invalid entrypoint', async () => {
      const project = {
        files: [
          { path: 'main.js', code: 'console.log("hello")' }
        ],
        entrypoint: 'missing.js'
      };

      await expect(isobox.runProject(project))
        .rejects.toThrow('Entrypoint file missing.js not found');
    });
  });

  describe('Session Management', () => {
    it('should create a new session', async () => {
      const session = await isobox.createSession('session-1');
      expect(session.id).toBe('session-1');
      expect(isobox.getSession('session-1')).toBeDefined();
    });

    it('should throw error when creating duplicate session', async () => {
      await isobox.createSession('session-1');
      await expect(isobox.createSession('session-1'))
        .rejects.toThrow('Session session-1 already exists');
    });

    it('should retrieve existing session', async () => {
      await isobox.createSession('session-1');
      const session = isobox.getSession('session-1');
      expect(session).toBeDefined();
      expect(session?.id).toBe('session-1');
    });

    it('should return undefined for non-existent session', () => {
      expect(isobox.getSession('non-existent')).toBeUndefined();
    });

    it('should expire session after TTL', async () => {
        const box = new IsoBox();
        await box.createSession('session-short', { ttl: 10 }); // 10ms TTL

        // Wait for expiration
        await new Promise(resolve => setTimeout(resolve, 20));

        expect(box.getSession('session-short')).toBeUndefined();
    });
  });

  describe('Disposal', () => {
    it('should dispose resources correctly', async () => {
      await isobox.dispose();
      await expect(isobox.run('1 + 1')).rejects.toThrow('Sandbox has been disposed');
    });

    it('should handle multiple dispose calls gracefully', async () => {
      await isobox.dispose();
      await isobox.dispose();
      // Should not throw
    });
  });
});
