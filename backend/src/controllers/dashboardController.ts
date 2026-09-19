import { Request, Response } from 'express';
import * as overviewService from '../services/overviewService.js';
import { config } from '../config/index.js';

export async function getOverview(req: Request, res: Response): Promise<void> {
  try {
    const forceFresh = req.query.fresh === 'true';
    const overview = await overviewService.getDashboardOverview(forceFresh);
    res.json({ success: true, data: overview });
  } catch (error: any) {
    console.error('Error fetching dashboard overview:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch overview metrics' });
  }
}

export function getConfigThresholds(req: Request, res: Response): void {
  res.json({
    success: true,
    data: {
      liveThresholdMinutes: config.readingLiveThresholdMinutes,
      recentThresholdMinutes: config.readingRecentThresholdMinutes,
      timezone: config.timezone,
    },
  });
}
