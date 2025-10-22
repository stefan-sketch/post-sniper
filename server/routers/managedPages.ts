import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
import { managedPages } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import * as db from "../db";

export const managedPagesRouter = router({
  list: publicProcedure.query(async () => {
    const userId = "public";
    return await db.getManagedPages(userId);
  }),

  create: publicProcedure
    .input(
      z.object({
        profileId: z.string(),
        profileName: z.string(),
        profilePicture: z.string().optional(),
        borderColor: z.string(),
        network: z.string().default("facebook"),
      })
    )
    .mutation(async ({ input }) => {
      const userId = "public";
      const id = nanoid();
      const newPage = await db.createManagedPage({ id, userId, ...input });
      return newPage;
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        profileName: z.string().optional(),
        profilePicture: z.string().optional(),
        borderColor: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await db.updateManagedPage(input.id, input);
      return { success: true };
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await db.deleteManagedPage(input.id);
      return { success: true };
    }),
});

