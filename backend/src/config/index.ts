import dotenv from 'dotenv';

dotenv.config();

// Sanitize critical environment variables by trimming quotes and whitespace
const cleanEnv = (val?: string): string | undefined => {
  if (!val) return undefined;
  return val.replace(/^["']|["']$/g, '').trim();
};

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = cleanEnv(process.env.DATABASE_URL)!;
}
if (process.env.DIRECT_URL) {
  process.env.DIRECT_URL = cleanEnv(process.env.DIRECT_URL)!;
}

export const config = {
  port: parseInt(cleanEnv(process.env.PORT) || '5050', 10),
  nodeEnv: cleanEnv(process.env.NODE_ENV) || 'development',
  corsOrigin: (cleanEnv(process.env.CORS_ORIGIN) || 'http://localhost:5173,http://localhost:3000')
    .split(',')
    .map((s: string) => cleanEnv(s) || '')
    .filter(Boolean),
  readingLiveThresholdMinutes: parseInt(cleanEnv(process.env.READING_LIVE_THRESHOLD_MINUTES) || '15', 10),
  readingRecentThresholdMinutes: parseInt(cleanEnv(process.env.READING_RECENT_THRESHOLD_MINUTES) || '60', 10),
  timezone: cleanEnv(process.env.TIMEZONE) || 'Asia/Kolkata',
  databaseUrl: cleanEnv(process.env.DATABASE_URL),
};