import { z } from 'zod';
import type {
  ChangePasswordRequest,
  RegisterRequest,
  ResetPasswordRequest,
  SignInRequest,
  SignUpRequest,
} from '../../../contracts/accounts.js';

export const signUpRequestSchema = z.object({
  email: z.string(),
  fullName: z.string(),
  password: z.string(),
}) satisfies z.ZodType<SignUpRequest>;

export const signInRequestSchema = z.object({
  email: z.string(),
  password: z.string(),
}) satisfies z.ZodType<SignInRequest>;

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string(),
}) satisfies z.ZodType<ChangePasswordRequest>;

export const resetPasswordRequestSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string(),
}) satisfies z.ZodType<ResetPasswordRequest>;

/**
 * No `email`: zod drops any sent, and the account takes the invite's. An
 * empty token is any other unknown one, so it is not refused here as 400.
 */
export const registerRequestSchema = z.object({
  token: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  password: z.string(),
  confirmPassword: z.string(),
}) satisfies z.ZodType<RegisterRequest>;
