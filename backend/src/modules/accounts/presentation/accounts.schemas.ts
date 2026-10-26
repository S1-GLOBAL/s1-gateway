import { z } from 'zod';
import type { CreateInviteRequest, SetAccountRoleRequest } from '../../../contracts/accounts.js';
import { ACCOUNT_ROLES } from '../domain/account.js';

/* The request's shape only. Whether the address is allowed is the domain's call. */

export const createInviteRequestSchema = z.object({
  email: z.string(),
}) satisfies z.ZodType<CreateInviteRequest>;

/** Any other role is refused with 400 VALIDATION_FAILED. */
export const setAccountRoleRequestSchema = z.object({
  role: z.enum(ACCOUNT_ROLES),
}) satisfies z.ZodType<SetAccountRoleRequest>;

/** An invite's id: anything else names no invite, so it is answered 404 before any query. */
export const inviteIdSchema = z.guid();
