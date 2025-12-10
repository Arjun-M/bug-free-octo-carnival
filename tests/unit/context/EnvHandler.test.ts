import { EnvHandler } from '../../../src/context/EnvHandler';

describe('EnvHandler', () => {
  let envHandler: EnvHandler;

  beforeEach(() => {
    envHandler = new EnvHandler({ FOO: 'bar' });
  });

  describe('CRUD Operations', () => {
    it('should get variable', () => {
      expect(envHandler.get('FOO')).toBe('bar');
    });

    it('should return undefined for missing variable', () => {
      expect(envHandler.get('MISSING')).toBeUndefined();
    });

    it('should set variable', () => {
      envHandler.set('TEST', 'value');
      expect(envHandler.get('TEST')).toBe('value');
    });

    it('should check existence', () => {
      expect(envHandler.has('FOO')).toBe(true);
      expect(envHandler.has('MISSING')).toBe(false);
    });

    it('should delete variable', () => {
      envHandler.delete('FOO');
      expect(envHandler.has('FOO')).toBe(false);
    });
  });

  describe('Bulk Operations', () => {
    it('should return object', () => {
      const obj = envHandler.toObject();
      expect(obj).toEqual({ FOO: 'bar' });
      expect(obj).not.toBe((envHandler as any).env); // Should be a copy
    });

    it('should clear variables', () => {
      envHandler.clear();
      expect(envHandler.size()).toBe(0);
    });

    it('should get size', () => {
      expect(envHandler.size()).toBe(1);
      envHandler.set('TEST', '1');
      expect(envHandler.size()).toBe(2);
    });

    it('should get keys', () => {
      expect(envHandler.keys()).toEqual(['FOO']);
    });
  });
});
