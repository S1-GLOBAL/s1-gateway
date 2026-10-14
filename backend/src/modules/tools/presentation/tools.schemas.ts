import { z } from 'zod';
import type { CreateToolRequest } from '../../../contracts/tools.js';

/** The request's shape only. The rules (lengths, URL scheme) belong to the domain. */
export const createToolRequestSchema = z.object({
  name: z.string(),
  url: z.string(),
  description: z.string().optional(),
  category: z.string(),
}) satisfies z.ZodType<CreateToolRequest>;
