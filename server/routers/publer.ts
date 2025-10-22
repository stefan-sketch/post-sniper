import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import FormData from "form-data";
import fetch from "node-fetch";

const PUBLER_API_KEY = process.env.PUBLER_API_KEY || "";
const PUBLER_WORKSPACE_ID = process.env.PUBLER_WORKSPACE_ID || "";

// Page configurations
const PUBLER_PAGES = {
  "footy-feed": { id: "688e7d0f74c67046be7b456d", name: "The Footy Feed" },
  "football-funnys": { id: "682a16114e1609768a2d06f3", name: "Football Funnys" },
  "football-away-days": { id: "681c989b68152b80ff38da04", name: "Football Away Days" },
};

export const publerRouter = router({
  // Upload media to Publer
  uploadMedia: publicProcedure
    .input(z.object({
      imageData: z.string(), // base64 encoded image
      fileName: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        // Convert base64 to buffer
        const base64Data = input.imageData.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");

        // Create form data
        const form = new FormData();
        form.append("file", buffer, {
          filename: input.fileName,
          contentType: "image/jpeg",
        });
        form.append("direct_upload", "false");
        form.append("in_library", "false");

        // Upload to Publer
        const response = await fetch("https://app.publer.com/api/v1/media", {
          method: "POST",
          headers: {
            "Authorization": `Bearer-API ${PUBLER_API_KEY}`,
            "Publer-Workspace-Id": PUBLER_WORKSPACE_ID,
            ...form.getHeaders(),
          },
          body: form,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Publer upload failed: ${errorText}`);
        }

        const data = await response.json();
        return {
          success: true,
          mediaId: data.id,
          mediaUrl: data.path,
          thumbnail: data.thumbnail,
        };
      } catch (error: any) {
        console.error("Publer upload error:", error);
        return {
          success: false,
          error: error.message || "Failed to upload media",
        };
      }
    }),

  // Create post on selected pages
  createPost: publicProcedure
    .input(z.object({
      mediaId: z.string(),
      caption: z.string(),
      pages: z.array(z.enum(["footy-feed", "football-funnys", "football-away-days"])),
    }))
    .mutation(async ({ input }) => {
      try {
        // Build accounts array from selected pages
        const accounts = input.pages.map(pageKey => ({
          id: PUBLER_PAGES[pageKey].id,
        }));

        // Create post payload
        const payload = {
          bulk: {
            state: "published",
            posts: [
              {
                networks: {
                  facebook: {
                    type: "photo",
                    text: input.caption,
                    media: [
                      {
                        id: input.mediaId,
                        type: "image",
                      },
                    ],
                  },
                },
                accounts,
              },
            ],
          },
        };

        // Post to Publer (immediate publish endpoint)
        const response = await fetch("https://app.publer.com/api/v1/posts/schedule/publish", {
          method: "POST",
          headers: {
            "Authorization": `Bearer-API ${PUBLER_API_KEY}`,
            "Publer-Workspace-Id": PUBLER_WORKSPACE_ID,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Publer post failed: ${errorText}`);
        }

        const data = await response.json();
        console.log("Publer initial response:", JSON.stringify(data, null, 2));
        
        // Publer returns a job_id that we need to poll for status
        const jobId = data.data?.job_id || data.job_id;
        
        if (!jobId) {
          throw new Error("No job ID returned from Publer");
        }

        // Poll job status (wait longer for processing)
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const statusResponse = await fetch(`https://app.publer.com/api/v1/job_status/${jobId}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer-API ${PUBLER_API_KEY}`,
            "Publer-Workspace-Id": PUBLER_WORKSPACE_ID,
          },
        });
        
        const statusData = await statusResponse.json();
        console.log("Publer job status:", JSON.stringify(statusData, null, 2));
        
        const status = statusData.data?.status || statusData.status;
        const result = statusData.data?.result || statusData;
        
        // Check for failures in the payload
        if (result?.payload && Array.isArray(result.payload)) {
          const failures = result.payload.filter((item: any) => item.status === "failed" || item.type === "error");
          
          if (failures.length > 0) {
            console.error("Publer job failures:", failures);
            
            // Extract error messages
            const errorMessages = failures.map((f: any) => {
              const failure = f.failure || {};
              return `${failure.account_name || 'Account'}: ${failure.message || 'Unknown error'}`;
            }).join('; ');
            
            throw new Error(`Post failed: ${errorMessages}`);
          }
        }
        
        // If still working, let user know
        if (status === "working") {
          return {
            success: true,
            jobId,
            status: "processing",
            message: "Post is being processed. Check Publer dashboard for status.",
          };
        }
        
        // Check if all posts succeeded
        const successCount = result?.payload?.filter((item: any) => item.status === "success").length || 0;
        
        return {
          success: true,
          jobId,
          status,
          successCount,
          result,
        };
      } catch (error: any) {
        console.error("Publer post error:", error);
        return {
          success: false,
          error: error.message || "Failed to create post",
        };
      }
    }),

  // Regenerate caption using OpenAI
  regenerateCaption: publicProcedure
    .input(z.object({
      originalCaption: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
        
        if (!OPENAI_API_KEY) {
          throw new Error("OpenAI API key not configured");
        }

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "You are a witty British social media caption writer for football content. Your job is to rephrase captions while maintaining the same humor, tone, and vibe. IMPORTANT: Use British English spelling and expressions only (e.g., 'mate', 'proper', 'absolutely', 'reckon', 'brilliant', 'mental'). Keep it casual, funny, and engaging with British banter. You can change emojis, restructure sentences, or add rhetorical questions, but keep the core message and humor intact. Keep it concise and punchy. Never use American spellings or expressions."
              },
              {
                role: "user",
                content: `Rephrase this caption while keeping the same humor and vibe:\n\n${input.originalCaption}`
              }
            ],
            temperature: 0.9,
            max_tokens: 150,
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`OpenAI API error: ${error}`);
        }

        const data = await response.json() as any;
        const regeneratedCaption = data.choices[0]?.message?.content?.trim() || "";

        return {
          success: true,
          caption: regeneratedCaption,
        };
      } catch (error: any) {
        console.error("Caption regeneration error:", error);
        return {
          success: false,
          error: error.message || "Failed to regenerate caption",
        };
      }
    }),

  // Delete post from Publer
  deletePost: publicProcedure
    .input(z.object({
      postId: z.string(),
    }))
    .mutation(async ({ input }) => {
      try {
        const response = await fetch(`https://app.publer.com/api/v1/posts?post_ids[]=${input.postId}`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer-API ${PUBLER_API_KEY}`,
            "Publer-Workspace-Id": PUBLER_WORKSPACE_ID,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Publer delete failed: ${errorText}`);
        }

        const data = await response.json();
        
        return {
          success: true,
          deletedIds: data.deleted_ids || [],
        };
      } catch (error: any) {
        console.error("Publer delete error:", error);
        return {
          success: false,
          error: error.message || "Failed to delete post",
        };
      }
    }),
});

