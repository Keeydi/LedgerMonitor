/**
 * Script to clear all captured images from the server
 * Run with: node server/clear_captured_images.js
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdir, unlink, stat } from 'fs/promises';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CAPTURED_IMAGES_DIR = join(__dirname, 'captured_images');

async function clearCapturedImages() {
  try {
    console.log('🧹 Clearing all captured images...\n');
    
    // Check if directory exists
    if (!existsSync(CAPTURED_IMAGES_DIR)) {
      console.log('ℹ️  Captured images directory does not exist. Nothing to clean.');
      process.exit(0);
    }
    
    // Read all files in the directory
    const files = await readdir(CAPTURED_IMAGES_DIR);
    
    // Filter for image files (jpg, jpeg, png)
    const imageFiles = files.filter(file => 
      /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
    );
    
    if (imageFiles.length === 0) {
      console.log('ℹ️  No image files found in captured_images directory.');
      process.exit(0);
    }
    
    console.log(`📸 Found ${imageFiles.length} image file(s) to delete...\n`);
    
    let deletedCount = 0;
    let errorCount = 0;
    let totalSize = 0;
    
    // Delete each image file
    for (const file of imageFiles) {
      try {
        const filePath = join(CAPTURED_IMAGES_DIR, file);
        
        // Get file size before deletion
        const fileStats = await stat(filePath);
        totalSize += fileStats.size;
        
        // Delete the file
        await unlink(filePath);
        deletedCount++;
        console.log(`✅ Deleted: ${file} (${(fileStats.size / 1024).toFixed(2)} KB)`);
      } catch (error) {
        errorCount++;
        console.error(`❌ Failed to delete ${file}:`, error.message);
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`📊 Summary:`);
    console.log(`   ✅ Deleted: ${deletedCount} file(s)`);
    if (errorCount > 0) {
      console.log(`   ❌ Errors: ${errorCount} file(s)`);
    }
    console.log(`   💾 Total size freed: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log('='.repeat(50));
    console.log('\n✅ Cleanup completed successfully!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing captured images:', error);
    process.exit(1);
  }
}

// Run the cleanup
clearCapturedImages();
