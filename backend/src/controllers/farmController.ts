import { Request, Response } from 'express';
import * as farmService from '../services/farmService.js';
import * as telemetryService from '../services/telemetryService.js';
import * as batteryService from '../services/batteryService.js';
import * as fertigationService from '../services/fertigationService.js';

export async function getFullFarmTelemetry(req: Request, res: Response): Promise<void> {
  try {
    const farmId = String(req.params.farmId);
    const { from, to, range, fresh } = req.query;
    const data = await farmService.getFullFarmTelemetry(farmId, {
      from: from ? String(from) : undefined,
      to: to ? String(to) : undefined,
      range: range ? String(range) : undefined,
      forceFresh: fresh === 'true',
    });

    if (!data) {
      res.status(404).json({ success: false, error: 'Farm not found' });
      return;
    }

    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Error fetching full farm telemetry:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch full farm telemetry' });
  }
}

export async function getFarm(req: Request, res: Response): Promise<void> {
  try {
    const farmId = String(req.params.farmId);
    const farm = await farmService.getFarmById(farmId);
    if (!farm) {
      res.status(404).json({ success: false, error: 'Farm not found' });
      return;
    }
    res.json({ success: true, data: farm });
  } catch (error: any) {
    console.error('Error fetching farm details:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch farm details' });
  }
}

export async function getLatestReading(req: Request, res: Response): Promise<void> {
  try {
    const farmId = String(req.params.farmId);
    const reading = await telemetryService.getLatestReading(farmId);
    res.json({ success: true, data: reading });
  } catch (error: any) {
    console.error('Error fetching latest reading:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch latest reading' });
  }
}

export async function getEnvironmentalHistory(req: Request, res: Response): Promise<void> {
  try {
    const farmId = String(req.params.farmId);
    const { from, to, range } = req.query;
    const history = await telemetryService.getEnvironmentalHistory(farmId, {
      from: from ? String(from) : undefined,
      to: to ? String(to) : undefined,
      range: range ? String(range) : undefined,
    });
    res.json({ success: true, data: history });
  } catch (error: any) {
    console.error('Error fetching environmental history:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch environmental history' });
  }
}

export async function getBatteryHistory(req: Request, res: Response): Promise<void> {
  try {
    const farmId = String(req.params.farmId);
    const { from, to, range } = req.query;
    const history = await batteryService.getBatteryHistory(farmId, {
      from: from ? String(from) : undefined,
      to: to ? String(to) : undefined,
      range: range ? String(range) : undefined,
    });
    res.json({ success: true, data: history });
  } catch (error: any) {
    console.error('Error fetching battery history:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch battery history' });
  }
}

export async function getFarmDevices(req: Request, res: Response): Promise<void> {
  try {
    const farmId = String(req.params.farmId);
    const devices = await farmService.getFarmDevices(farmId);
    res.json({ success: true, data: devices });
  } catch (error: any) {
    console.error('Error fetching farm devices:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch farm devices' });
  }
}

export async function getLatestFertigation(req: Request, res: Response): Promise<void> {
  try {
    const farmId = String(req.params.farmId);
    const fertigation = await fertigationService.getLatestFertigation(farmId);
    res.json({ success: true, data: fertigation });
  } catch (error: any) {
    console.error('Error fetching latest fertigation:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch latest fertigation' });
  }
}

export async function getFertigationHistory(req: Request, res: Response): Promise<void> {
  try {
    const farmId = String(req.params.farmId);
    const { from, to, range } = req.query;
    const history = await fertigationService.getFertigationHistory(farmId, {
      from: from ? String(from) : undefined,
      to: to ? String(to) : undefined,
      range: range ? String(range) : undefined,
    });
    res.json({ success: true, data: history });
  } catch (error: any) {
    console.error('Error fetching fertigation history:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to fetch fertigation history' });
  }
}
