import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { nanoid } from "nanoid";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

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
      let tempFilePath: string | null = null;
      
      try {
        // 1. Download the image from Facebook
        const imageResponse = await fetch(input.imageUrl);
        if (!imageResponse.ok) {
          throw new Error("Failed to download image");
        }
        
        const imageBuffer = await imageResponse.arrayBuffer();
        const buffer = Buffer.from(imageBuffer);
        
        // 2. Save to temp file
        const tempFileName = `manus-upload-${nanoid()}.jpg`;
        tempFilePath = join(tmpdir(), tempFileName);
        await writeFile(tempFilePath, buffer);
        
        // 3. Upload to Manus CDN using manus-upload-file utility
        const { stdout } = await execAsync(`manus-upload-file "${tempFilePath}"`);
        
        // Extract CDN URL from output (format: "CDN URL: https://...")
        const cdnUrlMatch = stdout.match(/CDN URL: (https:\/\/[^\s]+)/);
        if (!cdnUrlMatch) {
          throw new Error("Failed to extract CDN URL from upload output");
        }
        const cdnUrl = cdnUrlMatch[1];
        
        // 4. Get file size for the attachment
        const fileSize = buffer.length;
        
        // 5. Send to Manus chat using the tasks API
        const manusResponse = await fetch(MANUS_API_URL, {
          method: "POST",
          headers: {
            "accept": "application/json",
            "content-type": "application/json",
            "API_KEY": MANUS_API_KEY,
          },
          body: JSON.stringify({
            prompt: "Facebook post image",
            mode: "chat",
            session_id: input.sessionId,
            attachments: [
              {
                filename: "facebook-post.jpg",
                url: cdnUrl,
                mime_type: "image/jpeg",
                size_bytes: fileSize,
              }
            ]
          }),
        });
        
        if (!manusResponse.ok) {
          const errorText = await manusResponse.text();
          throw new Error(`Manus API error: ${errorText}`);
        }
        
        const result = await manusResponse.json();
        
        return {
          success: true,
          taskId: result.task_id,
          taskUrl: result.task_url,
        };
        
      } catch (error) {
        console.error("Manus upload error:", error);
        throw new Error(`Failed to upload to ${input.chatName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        // Clean up temp file
        if (tempFilePath) {
          try {
            await unlink(tempFilePath);
          } catch (err) {
            console.error("Failed to delete temp file:", err);
          }
        }
      }
    }),
});

