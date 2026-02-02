import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '.env');
const result = dotenv.config({ path: envPath, debug: false });

if (result.error) {
  console.warn(`⚠️  Warning: Could not load .env from ${envPath}: ${result.error.message}`);
}
