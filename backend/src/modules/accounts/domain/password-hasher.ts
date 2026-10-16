/** Turns a password into a stored hash and back. The domain owns this port; infrastructure implements it. */
export interface PasswordHasher {
  hash(password: string): Promise<string>;

  verify(password: string, storedHash: string): Promise<boolean>;
}
