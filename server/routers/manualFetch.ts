import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { backgroundJobService } from "../backgroundJob";

export const manualFetchRouter = router({
  triggerFetch: publicProcedure.mutation(async () => {
    try {
      console.log("[ManualFetch] Manual fetch triggered");
      await backgroundJobService.fetchAndCachePosts();
      return { success: true, message: "Posts fetched successfully" };
    } catch (error) {
      console.error("[ManualFetch] Error:", error);
      return { success: false, message: "Failed to fetch posts" };
    }
  }),
});

