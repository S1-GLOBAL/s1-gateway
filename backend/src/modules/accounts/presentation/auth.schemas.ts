import { z } from 'zod';
import type {
  ChangePasswordRequest,
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
