import type { AccountInvite } from '../domain/account-invite.js';

/** An invite as the application hands it outward. Never its token or the token's hash. */
export interface AccountInviteDto {
  id: string;
  email: string;
  expiresAt: string;
}

/** What the public registration page may know about an invite before it is used. */
export interface InviteDetailsDto {
  email: string;
  expiresAt: string;
}

export function toAccountInviteDto(invite: AccountInvite): AccountInviteDto {
  return {
    id: invite.id,
    email: invite.email,
    expiresAt: invite.expiresAt.toISOString(),
  };
}
