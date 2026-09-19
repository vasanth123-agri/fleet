import { Request, Response } from 'express';
import { getValveApplianceStatusList } from '../services/valveApplianceService.js';
import { deviceStatusStore } from '../services/deviceStatusStore.js';

export async function getValveApplianceStatus(req: Request, res: Response): Promise<void> {
  try {
    const { userId, farmId, deviceId, deviceCategory, status, search, forceFresh } = req.query;

    const data = await getValveApplianceStatusList({
      userId: userId ? parseInt(String(userId), 10) : undefined,
      farmId: farmId ? String(farmId) : undefined,
      deviceId: deviceId ? String(deviceId) : undefined,
      deviceCategory: deviceCategory ? String(deviceCategory) : undefined,
      status: status ? String(status) : undefined,
      search: search ? String(search) : undefined,
      forceFresh: forceFresh === 'true',
    });

    res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    console.error('Error in getValveApplianceStatus:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error fetching valve and appliance status',
    });
  }
}

export async function getValveApplianceSummary(req: Request, res: Response): Promise<void> {
  try {
    const { forceFresh } = req.query;
    const { summary } = await getValveApplianceStatusList({
      forceFresh: forceFresh === 'true',
    });

    res.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    console.error('Error in getValveApplianceSummary:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error fetching summary metrics',
    });
  }
}

export async function processAckPayload(req: Request, res: Response): Promise<void> {
  try {
    const rawPayload = req.body;
    const topic = req.headers['x-mqtt-topic'] ? String(req.headers['x-mqtt-topic']) : 'relay/ack';

    const processed = deviceStatusStore.processIncomingAck(rawPayload, topic);

    res.json({
      success: true,
      processed,
      currentStore: deviceStatusStore.getAll(),
    });
  } catch (error: any) {
    console.error('Error processing ACK payload:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to process ACK payload',
    });
  }
}
