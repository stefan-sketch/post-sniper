import { router, publicProcedure } from '../_core/trpc';
import { z } from 'zod';
import sharp from 'sharp';

export const imageProxyRouter = router({
  /**
   * Optimize image - fetch, resize, compress, and convert to WebP
   */
  optimize: publicProcedure
    .input(z.object({
      url: z.string().url(),
      width: z.number().min(100).max(2000).optional(),
      quality: z.number().min(1).max(100).default(80),
      format: z.enum(['webp', 'jpeg', 'png']).default('webp'),
    }))
    .query(async ({ input }) => {
      try {
        // Fetch the original image
        const response = await fetch(input.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SDL-Media-Bot/1.0)',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        
        // Create sharp instance
        let image = sharp(Buffer.from(buffer));
        
        // Get metadata
        const metadata = await image.metadata();
        
        // Resize if width is specified
        if (input.width) {
          image = image.resize(input.width, null, {
            fit: 'inside',
            withoutEnlargement: true,
          });
        }
        
        // Convert to specified format with quality
        let optimized: Buffer;
        
        switch (input.format) {
          case 'webp':
            optimized = await image
              .webp({ quality: input.quality })
              .toBuffer();
            break;
          case 'jpeg':
            optimized = await image
              .jpeg({ quality: input.quality, progressive: true })
              .toBuffer();
            break;
          case 'png':
            optimized = await image
              .png({ quality: input.quality, compressionLevel: 9 })
              .toBuffer();
            break;
          default:
            optimized = await image
              .webp({ quality: input.quality })
              .toBuffer();
        }
        
        // Calculate compression ratio
        const originalSize = buffer.byteLength;
        const optimizedSize = optimized.byteLength;
        const compressionRatio = ((1 - optimizedSize / originalSize) * 100).toFixed(1);
        
        return {
          data: optimized.toString('base64'),
          format: input.format,
          width: metadata.width,
          height: metadata.height,
          originalSize,
          optimizedSize,
          compressionRatio: `${compressionRatio}%`,
          mimeType: `image/${input.format}`,
        };
      } catch (error: any) {
        console.error('[Image Proxy] Error:', error);
        throw new Error(`Image optimization failed: ${error.message}`);
      }
    }),

  /**
   * Get optimized image as binary data (for direct <img> src usage)
   */
  get: publicProcedure
    .input(z.object({
      url: z.string().url(),
      width: z.number().min(100).max(2000).optional(),
      quality: z.number().min(1).max(100).default(80),
    }))
    .query(async ({ input }) => {
      try {
        const response = await fetch(input.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; SDL-Media-Bot/1.0)',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        
        let image = sharp(Buffer.from(buffer));
        
        if (input.width) {
          image = image.resize(input.width, null, {
            fit: 'inside',
            withoutEnlargement: true,
          });
        }
        
        const optimized = await image
          .webp({ quality: input.quality })
          .toBuffer();
        
        return {
          data: optimized.toString('base64'),
          mimeType: 'image/webp',
        };
      } catch (error: any) {
        console.error('[Image Proxy] Error:', error);
        throw new Error(`Image fetch failed: ${error.message}`);
      }
    }),
});

