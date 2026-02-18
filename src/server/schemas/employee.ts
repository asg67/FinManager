import { z } from "zod";

export const inviteEmployeeSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).max(255),
  entityIds: z.array(z.string().uuid()).min(1),
  permissions: z.object({
    dds: z.boolean().default(false),
    pdfUpload: z.boolean().default(false),
    analytics: z.boolean().default(false),
    export: z.boolean().default(false),
  }),
});

export const updateEmployeeSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  entityIds: z.array(z.string().uuid()).min(1).optional(),
  permissions: z
    .object({
      dds: z.boolean(),
      pdfUpload: z.boolean(),
      analytics: z.boolean(),
      export: z.boolean(),
    })
    .optional(),
});
