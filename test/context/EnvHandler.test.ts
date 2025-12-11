import { EnvHandler } from '../../src/context/EnvHandler';

describe('EnvHandler', () => {
  let env: EnvHandler;

  beforeEach(() => {
    env = new EnvHandler({ FOO: 'bar' });
  });

  it('should retrieve env vars', () => {
    expect(env.get('FOO')).toBe('bar');
  });

  it('should return undefined for missing vars', () => {
    expect(env.get('BAZ')).toBeUndefined();
  });
});
