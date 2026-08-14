import { appName } from '../src/index.js';

describe('repository foundation', () => {
  it('exposes the application name', () => {
    expect(appName).toBe('tieout');
  });
});
