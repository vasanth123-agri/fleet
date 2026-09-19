import { Router } from 'express';
import * as customerController from '../controllers/customerController.js';
import * as farmController from '../controllers/farmController.js';
import * as dashboardController from '../controllers/dashboardController.js';
import * as valveApplianceController from '../controllers/valveApplianceController.js';

const router = Router();

// Dashboard Overview & Config
router.get('/dashboard/overview', dashboardController.getOverview);
router.get('/customers/overview/metrics', dashboardController.getOverview);
router.get('/config/thresholds', dashboardController.getConfigThresholds);

// User-wise Valve & Appliance Monitoring Endpoints
router.get('/valves-appliances/status', valveApplianceController.getValveApplianceStatus);
router.get('/valves-appliances/summary', valveApplianceController.getValveApplianceSummary);
router.post('/valves-appliances/ack', valveApplianceController.processAckPayload);
router.get('/admin/user-device-status', valveApplianceController.getValveApplianceStatus);

// Customer Endpoints
router.get('/customers', customerController.listCustomers);
router.get('/customers/:userId', customerController.getCustomer);
router.get('/customers/:userId/farms', customerController.getCustomerFarms);

// Consolidated Farm Full Telemetry (single fast endpoint)
router.get('/farms/:farmId/full-telemetry', farmController.getFullFarmTelemetry);

// Individual Farm Endpoints
router.get('/farms/:farmId', farmController.getFarm);
router.get('/farms/:farmId/latest', farmController.getLatestReading);
router.get('/farms/:farmId/latest-reading', farmController.getLatestReading);
router.get('/farms/:farmId/environmental-history', farmController.getEnvironmentalHistory);
router.get('/farms/:farmId/battery-history', farmController.getBatteryHistory);
router.get('/farms/:farmId/devices', farmController.getFarmDevices);
router.get('/farms/:farmId/fertigation/latest', farmController.getLatestFertigation);
router.get('/farms/:farmId/fertigation/history', farmController.getFertigationHistory);

export default router;

