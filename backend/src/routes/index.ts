import { Router, Request, Response } from 'express';
import * as customerController from '../controllers/customerController.js';
import * as farmController from '../controllers/farmController.js';
import * as dashboardController from '../controllers/dashboardController.js';
import * as valveApplianceController from '../controllers/valveApplianceController.js';
import { apiCache, invalidateCache } from '../middleware/cacheMiddleware.js';
import { hybridCache } from '../utils/cache.js';

const router = Router();

// ── Cache Diagnostics & Management Endpoints ──────────────────────────────
router.get('/cache/status', async (req: Request, res: Response) => {
  try {
    const diagnostics = await hybridCache.getDiagnostics();
    res.json({
      success: true,
      data: diagnostics,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/cache/flush', async (req: Request, res: Response) => {
  try {
    const { prefix } = req.body || {};
    if (prefix) {
      await hybridCache.flushByPrefix(String(prefix));
    } else {
      await hybridCache.clear();
    }
    res.json({
      success: true,
      message: prefix ? `Cache flushed for prefix "${prefix}"` : 'All cache cleared successfully',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Dashboard Overview & Config ───────────────────────────────────────────
router.get('/dashboard/overview', apiCache(30), dashboardController.getOverview);
router.get('/customers/overview/metrics', apiCache(30), dashboardController.getOverview);
router.get('/config/thresholds', apiCache(300), dashboardController.getConfigThresholds);

// ── User-wise Valve & Appliance Monitoring Endpoints ───────────────────────
router.get('/valves-appliances/status', apiCache(20), valveApplianceController.getValveApplianceStatus);
router.get('/valves-appliances/summary', apiCache(20), valveApplianceController.getValveApplianceSummary);
router.get('/admin/user-device-status', apiCache(20), valveApplianceController.getValveApplianceStatus);

// Invalidate valve cache upon receiving ACK payload
router.post(
  '/valves-appliances/ack',
  async (req, res, next) => {
    invalidateCache('valves').catch(() => {});
    invalidateCache('api:/valves-appliances').catch(() => {});
    next();
  },
  valveApplianceController.processAckPayload
);

// ── Customer Fleet Endpoints ──────────────────────────────────────────────
// 20-second TTL for paginated customer fleet records to keep farm reading metrics fresh
router.get('/customers', apiCache(20), customerController.listCustomers);
router.get('/customers/:userId', apiCache(20), customerController.getCustomer);
router.get('/customers/:userId/farms', apiCache(20), customerController.getCustomerFarms);

// ── Farm Full Telemetry & Sensor Endpoints ─────────────────────────────────
router.get('/farms/:farmId/full-telemetry', apiCache(30), farmController.getFullFarmTelemetry);

// Individual Farm Endpoints
router.get('/farms/:farmId', apiCache(30), farmController.getFarm);
router.get('/farms/:farmId/latest', apiCache(15), farmController.getLatestReading);
router.get('/farms/:farmId/latest-reading', apiCache(15), farmController.getLatestReading);
router.get('/farms/:farmId/environmental-history', apiCache(30), farmController.getEnvironmentalHistory);
router.get('/farms/:farmId/battery-history', apiCache(30), farmController.getBatteryHistory);
router.get('/farms/:farmId/devices', apiCache(30), farmController.getFarmDevices);
router.get('/farms/:farmId/fertigation/latest', apiCache(15), farmController.getLatestFertigation);
router.get('/farms/:farmId/fertigation/history', apiCache(30), farmController.getFertigationHistory);

export default router;
