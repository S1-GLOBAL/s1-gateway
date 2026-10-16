import { describe, expect, it } from 'vitest';
import { safeNextPath } from './next-path';

describe('safeNextPath', () => {
  it('defaults to the home page', () => {
    expect(safeNextPath(null)).toBe('/');
    expect(safeNextPath(undefined)).toBe('/');
    expect(safeNextPath('')).toBe('/');
  });

  it('keeps a path inside the app, with its query', () => {
    expect(safeNextPath('/accounts')).toBe('/accounts');
    expect(safeNextPath('/theme?x=1#top')).toBe('/theme?x=1#top');
  });

  it('refuses anything that could leave the app', () => {
    expect(safeNextPath('https://evil.example')).toBe('/');
    expect(safeNextPath('//evil.example')).toBe('/');
    expect(safeNextPath('/\\evil.example')).toBe('/');
    expect(safeNextPath('theme')).toBe('/');
  });

  it('maps public paths to the home path', () => {
    expect(safeNextPath('/')).toBe('/');
    expect(safeNextPath('/sign-in')).toBe('/');
    expect(safeNextPath('/sign-in?next=%2Ftheme')).toBe('/');
    expect(safeNextPath('/reset-password?token=abc')).toBe('/');
  });
});