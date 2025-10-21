import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";

const MANUS_API_KEY = "sk-MUm0yHQbXecrVv56IYeLMx-UHEQcLM_s4AbJg3fkOZMaCxvaTMNEbEg0V2LVbYaoURDIwnZ7-TzYgnxSvSvOUHSwDxRr";
const MANUS_API_URL = "https://api.manus.ai/v1/tasks";

export const manusRouter = router({
  uploadImage: publicProcedure
    .input(z.object({
      imageUrl: z.string(),
      sessionId: z.string(),
      chatName: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        console.log(`[Manus] Sending image URL to ${input.chatName}...`);
        
        // Send the image URL directly in the prompt
        // Manus AI can view and download images from URLs
        const manusResponse = await fetch(MANUS_API_URL, {
          method: "POST",
          headers: {
            "accept": "application/json",
            "content-type": "application/json",
            "API_KEY": MANUS_API_KEY,
          },
          body: JSON.stringify({
            prompt: `Here is an image from a Facebook post: ${input.imageUrl}`,
            mode: "chat",
            session_id: input.sessionId,
          }),
        });
        
        if (!manusResponse.ok) {
          const errorText = await manusResponse.text();
          console.error("[Manus] API error:", errorText);
          throw new Error(`Manus API error: ${errorText}`);
        }
        
        const result = await manusResponse.json();
        console.log(`[Manus] Success! Task ID: ${result.task_id}`);
        
        return {
          success: true,
          taskId: result.task_id,
          taskUrl: result.task_url,
        };
        
      } catch (error) {
        console.error("[Manus] Upload error:", error);
        throw new Error(`Failed to send to ${input.chatName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }),
});

