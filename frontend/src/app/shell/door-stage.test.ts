import { describe, expect, it } from 'vitest';
import { bootTrack, doorCrossing, doorStage, nextDoorTrack, wantsWelcome } from './door-stage';

describe('doorStage', () => {
  it('names the landing, sign-in and registration', () => {
    expect(doorStage('/')).toEqual({ key: 'landing', label: 'Source One' });
    expect(doorStage('/sign-in')).toEqual({ key: 'sign-in', label: 'Sign in' });
    expect(doorStage('/register')).toEqual({
      key: 'register',
      label: 'Source One Internal Registration',
    });
  });

  it('keeps every hub page on one stage, including a missing address', () => {
    const hub = { key: 'hub', label: 'welcome back!' };
    expect(doorStage('/atlas')).toEqual(hub);
    expect(doorStage('/atlas/new')).toEqual(hub);
    expect(doorStage('/atlas/some-id/manufacturers')).toEqual(hub);
    expect(doorStage('/accounts')).toEqual(hub);
    expect(doorStage('/theme')).toEqual(hub);
    expect(doorStage('/nowhere')).toEqual(hub);
  });

  it('leaves the other public pages out of the curtain', () => {
    expect(doorStage('/sign-up').label).toBeNull();
    expect(doorStage('/reset-password').label).toBeNull();
    expect(doorStage('/change-password').label).toBeNull();
    expect(doorStage('/sign-up').key).not.toBe(doorStage('/reset-password').key);
  });
});

describe('doorCrossing', () => {
  const landing = doorStage('/');
  const signIn = doorStage('/sign-in');
  const register = doorStage('/register');
  const hub = doorStage('/atlas');
  const accounts = doorStage('/accounts');
  const reset = doorStage('/reset-password');

  it('announces registration, sign-in and the way back to the landing', () => {
    expect(doorCrossing(landing, register, false)).toBe(true);
    expect(doorCrossing(register, signIn, false)).toBe(true);
    expect(doorCrossing(signIn, landing, false)).toBe(true);
    expect(doorCrossing(hub, landing, false)).toBe(true);
  });

  it('welcomes only when sign-in just opened the hub', () => {
    expect(doorCrossing(landing, hub, true)).toBe(true);
    expect(doorCrossing(signIn, hub, true)).toBe(true);
    expect(doorCrossing(landing, hub, false)).toBe(false);
  });

  it('stays quiet inside the hub and beside pages that are not doors', () => {
    expect(doorCrossing(hub, accounts, true)).toBe(false);
    expect(doorCrossing(signIn, reset, false)).toBe(false);
    expect(doorCrossing(reset, signIn, false)).toBe(false);
  });
});

describe('bootTrack', () => {
  it('covers the landing, sign-in and an invite link on the first paint', () => {
    expect(bootTrack('/').curtain?.label).toBe('Source One');
    expect(bootTrack('/sign-in').curtain?.label).toBe('Sign in');
    expect(bootTrack('/register').curtain?.label).toBe('Source One Internal Registration');
  });

  it('leaves a hub address uncovered, so a refresh does not say welcome back', () => {
    expect(bootTrack('/atlas').curtain).toBeNull();
    expect(bootTrack('/sign-up').curtain).toBeNull();
  });
});

describe('nextDoorTrack', () => {
  it('keeps a covered landing while a signed-in visit hops into the hub', () => {
    const covered = bootTrack('/');
    const next = nextDoorTrack(covered, '/atlas', null);
    expect(next.curtain).toBe(covered.curtain);
    expect(next.path).toBe('/atlas');
  });

  it('replaces the curtain when the crossing announces a new screen', () => {
    const next = nextDoorTrack(bootTrack('/register'), '/sign-in', null);
    expect(next.curtain).toEqual({ label: 'Sign in', playId: 1 });
  });

  it('does nothing when the path has not changed', () => {
    const covered = bootTrack('/register');
    expect(nextDoorTrack(covered, '/register', null)).toBe(covered);
  });
});

describe('wantsWelcome', () => {
  it('reads the sign-in flag and nothing else', () => {
    expect(wantsWelcome({ welcome: true })).toBe(true);
    expect(wantsWelcome({ welcome: false })).toBe(false);
    expect(wantsWelcome(null)).toBe(false);
    expect(wantsWelcome(undefined)).toBe(false);
    expect(wantsWelcome('welcome')).toBe(false);
  });
});
