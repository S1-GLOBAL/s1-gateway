/**
 * Where to go after signing in. Only a path inside this app is accepted, so
 * `?next=` can never send someone to another site, and never back to a page
 * that is itself signed-out only.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return '/';
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/';
  const path = next.split(/[?#]/, 1)[0] ?? '';
  if (PUBLIC_PATHS.includes(path)) return '/';
  return next;
}

/** `/sign-in` is the old address of the front door, so it cannot be a return path. */
const PUBLIC_PATHS = ['/', '/sign-in', '/sign-up', '/register', '/reset-password'];
