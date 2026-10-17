import { describe, expect, it } from 'vitest';
import { InvalidPersonNameError, normalizeFirstName, normalizeLastName, splitFullName } from './person-name.js';

describe('normalizeFirstName and normalizeLastName', () => {
  it('trims and accepts a single character', () => {
    expect(normalizeFirstName('  A  ')).toEqual({ ok: true, value: 'A' });
    expect(normalizeLastName('  B  ')).toEqual({ ok: true, value: 'B' });
  });

  it('accepts 40 characters', () => {
    const name = 'A'.repeat(40);
    expect(normalizeFirstName(name)).toEqual({ ok: true, value: name });
    expect(normalizeLastName(name)).toEqual({ ok: true, value: name });
  });

  it('counts characters, not UTF-16 units, as the column does', () => {
    const name = '😀'.repeat(40);
    expect(normalizeFirstName(name)).toEqual({ ok: true, value: name });
  });

  it('rejects 41 characters under the field it is about', () => {
    const first = normalizeFirstName('A'.repeat(41));
    expect(first.ok).toBe(false);
    if (!first.ok) {
      expect(first.error).toBeInstanceOf(InvalidPersonNameError);
      expect(first.error.code).toBe('VALIDATION_FAILED');
      expect(first.error.message).toBe('Use at most 40 characters.');
      expect(first.error.details).toEqual({ fields: { firstName: ['Use at most 40 characters.'] } });
    }
    const last = normalizeLastName('A'.repeat(41));
    expect(!last.ok && last.error.details).toEqual({ fields: { lastName: ['Use at most 40 characters.'] } });
  });

  it('treats spaces alone as empty', () => {
    const first = normalizeFirstName('  ');
    expect(!first.ok && first.error.details).toEqual({ fields: { firstName: ['Enter your first name.'] } });
    const last = normalizeLastName('  ');
    expect(!last.ok && last.error.details).toEqual({ fields: { lastName: ['Enter your last name.'] } });
  });
});

describe('splitFullName', () => {
  it('splits at the first space, as migration 0008 does', () => {
    expect(splitFullName('Ada Lovelace')).toEqual({ firstName: 'Ada', lastName: 'Lovelace' });
    expect(splitFullName('Ada King Lovelace')).toEqual({ firstName: 'Ada', lastName: 'King Lovelace' });
  });

  it('makes a one-word name the first name, with an empty last name', () => {
    expect(splitFullName('Admin')).toEqual({ firstName: 'Admin', lastName: '' });
  });

  it('cuts each part to 40 characters', () => {
    expect(splitFullName(`${'A'.repeat(45)} ${'B'.repeat(34)}`)).toEqual({
      firstName: 'A'.repeat(40),
      lastName: 'B'.repeat(34),
    });
    expect(splitFullName(`Ada ${'B'.repeat(39)} ${'C'.repeat(30)}`)).toEqual({
      firstName: 'Ada',
      lastName: 'B'.repeat(39),
    });
  });
});
