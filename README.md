# AgriInverse Fleet — Customer Monitoring & Telemetry Subproject

A dedicated, high-performance monitoring dashboard subproject connecting directly to the production **AgriInverse PostgreSQL Database** as a **strict read-only data source**.

Designed for company staff, farm agronomists, and administrators to observe all registered customers, farm counts, crops, connected NodeRed IoT nodes, live environmental telemetry, battery health time-series charts, and fertigation system status.

---

## Key Features

1. **Strict Read-Only Connection**:
   - Never modifies, deletes, or duplicates the production database records.
   - Dedicated read-only Prisma client instance.

2. **Customer Monitoring**:
   - Dynamic farm count via `COUNT(Farm.id)` (never relies solely on `hasFarm`).
   - Dynamic device count and category breakdown from `NodeRedDeviceDetails`.
   - Crop name extracted from `Plant` or `farmBoundary.cropType`.
   - Live / Recent / Delayed / Offline status dynamically calculated from configurable thresholds.
   - Power & Battery overview with voltage, current, and solar charging states.
   - Fertigation state indicator.

3. **Farm Deep-Dive & Sensor Telemetry**:
   - Full environmental telemetry: Temperature, Relative Humidity, CO2, VPD, Solar Radiation, PAR, Wind Speed, Soil Moisture, Soil Temperature, Soil EC, Soil NPK, and Master pH.
   - Time-series charts for atmospheric microclimate and soil root zone parameters.
   - Historical battery power tracking (24H, 7D, 30D views) with intelligent downsampling.

4. **Fertigation & Hydroponic Oversight**:
   - Dosing system status: `READY`, `ACTIVE`, `ALERT`, `FAILSAFE`, `E-STOP`.
   - Dual EC and pH probe metrics (`m1_ec`, `m2_ec`, `m1_ph`, `m2_ph`) and mixing water level.
   - Visual nutrient tank fill gauges mapped to user-configured `FertigationTankConfig` tanks (Nitrogen, Phosphorous, Potassium, pH Up, pH Down).
   - Time-series dosing history.

5. **Hardware Nodes & Gateway Registry**:
   - NodeRed IoT nodes with cloud online/offline indicators and last heartbeat timestamps.

6. **Timezone & Aesthetics**:
   - All timestamps formatted in **Asia/Kolkata (IST)**.
   - Glassmorphism dark-mode UI with emerald accents and pulsing live indicators.

---

## Directory Structure

```text
Fleet/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma         # AgriInverse PostgreSQL schema
│   ├── src/
│   │   ├── config/               # Read-only DB connection, thresholds, env vars
│   │   ├── controllers/          # Express API controllers
│   │   ├── routes/               # API route definitions
│   │   ├── services/             # Index-optimized service queries
│   │   ├── types/                # TypeScript interfaces & DTO contracts
│   │   ├── utils/                # Timezone & status helpers
│   │   └── server.ts             # Express server entrypoint (Port 5050)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/           # Reusable UI components (Badges, Charts, Cards)
│   │   ├── pages/                # CustomerListPage, CustomerDetailPage, FarmMonitoringPage
│   │   ├── services/             # API client
│   │   ├── types/                # TypeScript DTO models
│   │   ├── App.tsx               # Main routing & layout
│   │   └── main.tsx
│   └── package.json
└── package.json
```

---

## Starting the Application

### 1. Start Backend Dev Server
```bash
npm run dev:backend
# Running on http://localhost:5050
```

### 2. Start Frontend Dev Server
```bash
npm run dev:frontend
# Running on http://localhost:5173
```

---

## API Endpoints

- `GET /api/dashboard/overview` — Aggregated KPI metrics
- `GET /api/customers` — Paginated customer list with search & filter params
- `GET /api/customers/:userId` — Customer profile & registered farms
- `GET /api/farms/:farmId` — Farm profile & plot boundaries
- `GET /api/farms/:farmId/latest-reading` — Latest full environmental sensor payload
- `GET /api/farms/:farmId/environmental-history` — Time-series sensor history (`?range=24h|7d|30d`)
- `GET /api/farms/:farmId/battery-history` — Time-series battery stats (`?range=24h|7d|30d`)
- `GET /api/farms/:farmId/devices` — NodeRed IoT devices linked to farm
- `GET /api/farms/:farmId/fertigation/latest` — Latest fertigation telemetry & mapped tank levels
- `GET /api/farms/:farmId/fertigation/history` — Historical fertigation trends (`?range=24h|7d|30d`)
- `GET /api/config/thresholds` — Configured live/recent threshold minutes
