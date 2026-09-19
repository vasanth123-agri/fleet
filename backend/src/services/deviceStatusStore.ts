/**
 * DeviceStatusStore — Multi-device, multi-valve status store and normalization engine.
 * 
 * Reuses and expands the existing normalization logic from DeviceCommand.ts
 * and valveStatusStore.ts, avoiding cross-user/cross-device key collisions.
 */

export type ValvePhysicalState = 'OPEN' | 'CLOSED' | 'UNKNOWN';
export type AppliancePhysicalState = 'ON' | 'OFF' | 'UNKNOWN';

export interface DevicePhysicalStateEntry {
  deviceId: string;
  category: 'valve' | 'appliance';
  valve?: 'valve_a' | 'valve_b' | 'A' | 'B';
  state: ValvePhysicalState | AppliancePhysicalState;
  rawStatus: any;
  topic: string;
  lastUpdated: Date;
}

/**
 * Normalizes raw valve status string or number into OPEN, CLOSED, or UNKNOWN.
 * Reuses logic from DeviceCommand.ts & valveStatusStore.ts:
 *   - "Valve A Opened" / "Valve B Opened" / "opened" / "open" / 1 / "1" -> OPEN
 *   - "Valve A Closed" / "Valve B Closed" / "closed" / "close" / 0 / "0" -> CLOSED
 */
export function normalizeValveState(raw: unknown): ValvePhysicalState {
  if (raw === null || raw === undefined) return 'UNKNOWN';

  if (typeof raw === 'number') {
    if (raw === 1) return 'OPEN';
    if (raw === 0) return 'CLOSED';
    return 'UNKNOWN';
  }

  if (typeof raw !== 'string') return 'UNKNOWN';
  const val = raw.trim().toLowerCase();

  if (val === 'open' || val === 'opened' || val === '1' || val === 'active' || val === 'on') {
    return 'OPEN';
  }
  if (val === 'close' || val === 'closed' || val === '0' || val === 'inactive' || val === 'off') {
    return 'CLOSED';
  }
  if (/valve\s+[ab]\s+open(ed)?/.test(val)) {
    return 'OPEN';
  }
  if (/valve\s+[ab]\s+closed?/.test(val)) {
    return 'CLOSED';
  }

  return 'UNKNOWN';
}

/**
 * Normalizes raw appliance status string into ON, OFF, or UNKNOWN.
 * Reuses logic from DeviceCommand.ts:
 *   - "Motor ON" / "on" / "ON" / 1 / "active" -> ON
 *   - "Motor OFF" / "off" / "OFF" / 0 / "inactive" -> OFF
 */
export function normalizeApplianceState(raw: unknown): AppliancePhysicalState {
  if (raw === null || raw === undefined) return 'UNKNOWN';

  if (typeof raw === 'number') {
    if (raw === 1) return 'ON';
    if (raw === 0) return 'OFF';
    return 'UNKNOWN';
  }

  if (typeof raw !== 'string') return 'UNKNOWN';
  const val = raw.trim().toLowerCase();

  if (val === 'on' || val === '1' || val === 'active' || val === 'start' || val === 'running' || val === 'motor on') {
    return 'ON';
  }
  if (val === 'off' || val === '0' || val === 'inactive' || val === 'stop' || val === 'stopped' || val === 'motor off') {
    return 'OFF';
  }

  return 'UNKNOWN';
}

/**
 * Parses raw ACK payload (e.g. from relay/ack or reply/ack)
 * Reuses exact field detection pattern from DeviceCommand.ts:
 *   device | from
 *   state | command | status | valvestatus
 */
export function parseAckPayload(raw: Record<string, unknown>): {
  deviceId: string | null;
  state: 'on' | 'off' | 'open' | 'close' | null;
  valveTarget?: 'valve_a' | 'valve_b' | null;
  rawStatus: any;
  timestamp: Date;
} | null {
  if (!raw || typeof raw !== 'object') return null;

  const deviceId = typeof raw.device === 'string' && raw.device.trim()
    ? raw.device.trim()
    : typeof raw.from === 'string' && raw.from.trim()
    ? raw.from.trim()
    : null;

  if (!deviceId) return null;

  const statusStr = raw.status ?? raw.state ?? raw.command ?? raw.valvestatus;
  let valveTarget: 'valve_a' | 'valve_b' | null = null;

  if (typeof statusStr === 'string') {
    const lower = statusStr.trim().toLowerCase();
    if (lower.includes('valve a')) valveTarget = 'valve_a';
    else if (lower.includes('valve b')) valveTarget = 'valve_b';
  }

  let state: 'on' | 'off' | 'open' | 'close' | null = null;
  const normalizedValve = normalizeValveState(statusStr);
  const normalizedAppliance = normalizeApplianceState(statusStr);

  if (normalizedValve === 'OPEN') state = 'open';
  else if (normalizedValve === 'CLOSED') state = 'close';
  else if (normalizedAppliance === 'ON') state = 'on';
  else if (normalizedAppliance === 'OFF') state = 'off';

  const timestamp = raw.timestamp ? new Date(String(raw.timestamp)) : new Date();

  return {
    deviceId,
    state,
    valveTarget,
    rawStatus: statusStr,
    timestamp: isNaN(timestamp.getTime()) ? new Date() : timestamp,
  };
}

class DeviceStatusStore {
  private static instance: DeviceStatusStore;
  // Key format: `${deviceId}` or `${deviceId}:${valve}`
  private store: Map<string, DevicePhysicalStateEntry> = new Map();

  private constructor() {}

  public static getInstance(): DeviceStatusStore {
    if (!DeviceStatusStore.instance) {
      DeviceStatusStore.instance = new DeviceStatusStore();
    }
    return DeviceStatusStore.instance;
  }

  public setValveState(
    deviceId: string,
    valve: 'valve_a' | 'valve_b' | 'A' | 'B' | undefined,
    state: ValvePhysicalState,
    rawStatus: any,
    topic: string = 'relay/ack',
    timestamp: Date = new Date()
  ) {
    const key = valve ? `${deviceId}:${valve.toLowerCase()}` : deviceId;
    this.store.set(key, {
      deviceId,
      category: 'valve',
      valve,
      state,
      rawStatus,
      topic,
      lastUpdated: timestamp,
    });
  }

  public setApplianceState(
    deviceId: string,
    state: AppliancePhysicalState,
    rawStatus: any,
    topic: string = 'relay/ack',
    timestamp: Date = new Date()
  ) {
    this.store.set(deviceId, {
      deviceId,
      category: 'appliance',
      state,
      rawStatus,
      topic,
      lastUpdated: timestamp,
    });
  }

  public getStatus(deviceId: string, valve?: string): DevicePhysicalStateEntry | undefined {
    if (valve) {
      const valveKey = `${deviceId}:${valve.toLowerCase()}`;
      if (this.store.has(valveKey)) return this.store.get(valveKey);
    }
    return this.store.get(deviceId);
  }

  public processIncomingAck(raw: Record<string, unknown>, topic: string = 'relay/ack'): boolean {
    const parsed = parseAckPayload(raw);
    if (!parsed || !parsed.deviceId) return false;

    if (parsed.state === 'open' || parsed.state === 'close') {
      this.setValveState(
        parsed.deviceId,
        parsed.valveTarget || undefined,
        parsed.state === 'open' ? 'OPEN' : 'CLOSED',
        parsed.rawStatus,
        topic,
        parsed.timestamp
      );
      return true;
    }

    if (parsed.state === 'on' || parsed.state === 'off') {
      this.setApplianceState(
        parsed.deviceId,
        parsed.state === 'on' ? 'ON' : 'OFF',
        parsed.rawStatus,
        topic,
        parsed.timestamp
      );
      return true;
    }

    return false;
  }

  public getAll(): DevicePhysicalStateEntry[] {
    return Array.from(this.store.values());
  }

  public clear(): void {
    this.store.clear();
  }
}

export const deviceStatusStore = DeviceStatusStore.getInstance();
