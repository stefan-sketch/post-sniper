import sharp from 'sharp';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '../client/public');
const iconsDir = join(publicDir, 'icons');

// PWA icon sizes needed for iOS and Android
const sizes = [
  72, 96, 128, 144, 152, 192, 384, 512
];

// Apple touch icon sizes
const appleSizes = [
  120, 152, 167, 180
];

async function generateIcons() {
  try {
    // Create icons directory
    await mkdir(iconsDir, { recursive: true });

    const logoPath = join(publicDir, 'logo.png');
    
    console.log('🎨 Generating PWA icons...\n');

    // Generate standard PWA icons
    for (const size of sizes) {
      await sharp(logoPath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toFile(join(iconsDir, `icon-${size}x${size}.png`));
      console.log(`✅ Generated icon-${size}x${size}.png`);
    }

    // Generate Apple touch icons
    for (const size of appleSizes) {
      await sharp(logoPath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .png()
        .toFile(join(iconsDir, `apple-touch-icon-${size}x${size}.png`));
      console.log(`✅ Generated apple-touch-icon-${size}x${size}.png`);
    }

    // Generate favicon
    await sharp(logoPath)
      .resize(32, 32)
      .png()
      .toFile(join(publicDir, 'favicon.png'));
    console.log(`✅ Generated favicon.png`);

    // Generate maskable icon (for Android adaptive icons)
    await sharp(logoPath)
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toFile(join(iconsDir, 'maskable-icon-512x512.png'));
    console.log(`✅ Generated maskable-icon-512x512.png`);

    console.log('\n🎉 All icons generated successfully!');
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();

