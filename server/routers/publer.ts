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
            "Authorization": `Bearer ${PUBLER_API_KEY}`,
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
                  default: {
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

        // Post to Publer
        const response = await fetch("https://app.publer.com/api/v1/posts", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${PUBLER_API_KEY}`,
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
        return {
          success: true,
          postIds: data.posts || [],
        };
      } catch (error: any) {
        console.error("Publer post error:", error);
        return {
          success: false,
          error: error.message || "Failed to create post",
        };
      }
    }),
});

