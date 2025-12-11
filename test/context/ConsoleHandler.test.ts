import { ConsoleHandler } from '../../src/context/ConsoleHandler';

describe('ConsoleHandler', () => {
  let handler: ConsoleHandler;
  let logs: string[] = [];

  beforeEach(() => {
    logs = [];
    handler = new ConsoleHandler('redirect', (type, msg) => logs.push(msg));
  });

  it('should handle log calls', () => {
    handler.handleOutput('log', ['test']);
    expect(logs).toContain('test');
  });

  it('should stringify objects', () => {
    handler.handleOutput('log', [{ a: 1 }]);
    expect(logs[0]).toBe('{"a":1}');
  });
});
