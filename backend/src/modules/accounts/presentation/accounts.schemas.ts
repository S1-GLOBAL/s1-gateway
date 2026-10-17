import { z } from 'zod';
import type { CreateInviteRequest } from '../../../contracts/accounts.js';

/* The request's shape only. Whether the address is allowed is the domain's call. */

export const createInviteRequestSchema = z.object({
  email: z.string(),
}) satisfies z.ZodType<CreateInviteRequest>;

/** An invite's id: anything else names no invite, so it is answered 404 before any query. */
export const inviteIdSchema = z.guid();
