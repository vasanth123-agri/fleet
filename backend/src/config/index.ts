import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5050', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3000')
    .split(',')
    .map((s: string) => s.trim()),
  readingLiveThresholdMinutes: parseInt(process.env.READING_LIVE_THRESHOLD_MINUTES || '15', 10),
  readingRecentThresholdMinutes: parseInt(process.env.READING_RECENT_THRESHOLD_MINUTES || '60', 10),
  timezone: process.env.TIMEZONE || 'Asia/Kolkata',
};

