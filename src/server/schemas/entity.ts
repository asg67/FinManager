import { z } from "zod";

export const createEntitySchema = z.object({
  name: z.string().min(1).max(255),
});

export const updateEntitySchema = z.object({
  name: z.string().min(1).max(255),
});
