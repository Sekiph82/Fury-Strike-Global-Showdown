import { describe, expect, it } from 'vitest';

import { GAME_PROFILES, resolveStartupProfile } from './profiles';

describe('resolveStartupProfile', () => {
  it('provides a wide landscape fight viewport with vertical room for rising special moves', () => {
    expect(GAME_PROFILES.landscape).toMatchObject({ width: 2048, height: 1280 });
    expect(GAME_PROFILES.portrait).toMatchObject({ width: 720, height: 1536 });
  });

  it('uses the query string when the profile is valid', () => {
    expect(resolveStartupProfile('?profile=portrait')).toBe('portrait');
  });

  it('falls back to the provided default profile when the query string is missing', () => {
    expect(resolveStartupProfile('', 'landscape')).toBe('landscape');
  });

  it('defaults to landscape when no explicit default is provided', () => {
    expect(resolveStartupProfile('')).toBe('landscape');
  });
});
