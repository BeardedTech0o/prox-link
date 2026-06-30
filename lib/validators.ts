import { z } from 'zod';

// Proxmox API token id: user@realm!tokenname
export const tokenIdSchema = z
  .string()
  .regex(/^[^@!\s]+@[^@!\s]+![^@!\s]+$/, 'Token ID must look like user@realm!tokenname');

export const addHostSchema = z.object({
  name: z.string().min(1).max(64),
  baseUrl: z.string().url('Base URL must be a valid URL'),
  tokenId: tokenIdSchema,
  secret: z.string().min(1).max(256),
  verifyTls: z.boolean().optional().default(false),
  tlsFingerprint: z.string().optional(),
});

export type AddHostInput = z.infer<typeof addHostSchema>;
