# Air Freight Cost Calculator — Live Demo / MVP

A working demo that simulates **DHL Express import air freight into Saudi Arabia
(SAR)**: volumetric vs. actual weight, origin → zone rate lookup, a config-driven
surcharge engine, a clearly separated VAT/duty layer, and a draft → approval
workflow, with a dashboard on top. It executes the enterprise blueprint.

**You get two coherent pieces that share the same calculation engine:**

1. **`frontend/AirFreightCalculator-LiveDemo.html`** — a zero-install, single-file
   web app. Double-click it to open in any browser; no backend required. This is
   the showcase for management/stakeholder demos — all 10 screens, the engine, the
   dummy DHL data and the 5 scenarios run in the browser.
2. **`backend/`** — a runnable REST API (Express + Prisma + SQLite) implementing
   the *same* engine server-side, with auth/RBAC, persistence, approvals, the 5
   seeded scenarios, Docker, tests and a Postman collection.

The two are aligned: the backend produces the **same SAR figures, to the cent**,
as the browser demo for all five scenarios (e.g. Germany→KSA Express = 1,452.31
SAR landed).

> All rates, zones and surcharges are **realistic but fictional**. This is a
> proof-of-concept for demos and workshops, not a real quoting tool.

---

## 1. High-Level Architecture

```
┌──────────────────────┐      HTTPS / JSON      ┌──────────────────────────┐
│   FRONTEND (React)    │  ───────────────────►  │   BACKEND API (Express)   │
│  Login, Dashboard,    │                        │  Controllers → Services → │
│  Create Shipment,     │  ◄───────────────────  │  Repositories             │
│  Approvals, Admin     │     quotes / data      │        │                  │
└──────────────────────┘                        │        ▼                  │
                                                 │  Calculation Engine       │
        single-file demo                         │  (pure, unit-tested)      │
        runs in the browser                      │        │                  │
                                                 │        ▼                  │
                                                 │  Prisma ORM → SQLite/PG   │
                                                 └──────────────────────────┘
```

The **calculation engine** is deliberately a set of pure functions with no
database or framework dependency. That is what makes it trustworthy: it is
tested in isolation (`npm test`) and reused by the API, the seed script, and
the browser demo without modification.

---

## 2. Recommended Tech Stack

| Layer        | Choice                  | Why (in plain terms)                                   |
|--------------|-------------------------|--------------------------------------------------------|
| Frontend     | React + Tailwind        | Fast to build, industry standard, looks corporate.     |
| Backend      | Node.js + Express       | Simple, huge ecosystem, easy for one developer.        |
| Database     | SQLite (default) / Postgres | SQLite = zero setup for demos; Postgres for production. |
| ORM          | Prisma                  | Type-safe DB access; schema doubles as documentation.  |
| Auth         | JWT + bcrypt            | Standard token login, roles for ADMIN/OPERATOR/APPROVER.|
| Validation   | Zod                     | Rejects bad input before it reaches business logic.    |
| Tests        | Jest                    | Verifies the calculation engine automatically.         |
| Deploy       | Docker + docker-compose | One command to run everything.                         |

---

## 3. Project Folder Structure

```
afcc/
├── docker-compose.yml          # run the whole stack in one command
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── .env.example
│   ├── prisma/
│   │   ├── schema.prisma       # all 10 tables + relationships
│   │   └── seed.js             # users + reference data + 5 scenarios
│   ├── tests/
│   │   └── calculator.test.js  # 19 passing unit tests
│   └── src/
│       ├── app.js  server.js
│       ├── config/             # db client, env
│       ├── engine/             # ★ calculation engine + datasets + scenarios
│       │   ├── data.js         #   zones, origin countries, SAR rate grid, surcharges, VAT/duty
│       │   ├── calculator.js   #   the maths (pure functions)
│       │   └── scenarios.js    #   5 demo shipments
│       ├── dtos/               # request validation schemas (Zod)
│       ├── middleware/         # auth, validate, error handler
│       ├── repositories/       # database access only
│       ├── services/           # business logic
│       ├── controllers/        # HTTP request/response
│       ├── routes/             # URL → controller mapping
│       └── utils/              # helpers (ApiError, asyncHandler)
├── frontend/
│   └── AirFreightCalculator-LiveDemo.html  # self-contained clickable demo (open in browser)
└── postman/
    └── AirFreightCostCalculator.postman_collection.json
```

---

## 4. Database Schema (10 tables)

`Role, User, Zone, Country, Rate, Surcharge, Shipment, ShipmentItem,
Approval, AuditLog` — full definitions with primary keys and relationships are
in `backend/prisma/schema.prisma`. Key relationships:

- A **User** has one **Role** and creates many **Shipments**.
- A **Country** belongs to a **Zone**; a **Shipment** has an origin and a
  destination country.
- A **Shipment** has many **ShipmentItems** and many **Approvals**.
- **Rate** rows belong to a **Zone**; **Surcharge** rows are global and editable.

---

## 5–8. Backend, Frontend, API & Calculation Logic

### Calculation pipeline (the engine)
1. **Validate** — reject pieces beyond DHL handling limits (>300 cm edge or
   >300 kg per piece) → exception / special-approval flow.
2. **Weights** — per piece `volumetric = (L×W×H)/divisor` (divisor 5000 for
   Express/DG, 4000 for Eco); `chargeable = max(actual, volumetric)`; the
   shipment chargeable weight is the **sum** of per-piece chargeable weights.
3. **Zone** — **origin** country → zone Z1–Z7 (destination is always KSA, so the
   origin is what selects the rate column).
4. **Freight** — first 0.5 kg is a flat minimum; above that
   `chargeable × per-kg band rate` from the active SAR rate grid.
5. **Surcharges** (config-driven, priority order): overweight & oversize
   (per piece, mutually exclusive), full dangerous goods (flat + forces
   approval), security (per kg), remote-area (per kg with minimum), elevated
   risk (flat), and **fuel last** as a % of base freight + freight surcharges.
6. **Exclusions (NOT freight)** — **Import VAT 15% on CIF** (goods + freight) and
   **Customs Duty 5%** on goods value (0% for GCC origin). Shown separately as
   *“Excluded / estimated externally”* and rolled into Total Landed Cost only.
7. **Approval** — dangerous goods OR total landed ≥ 1,500 SAR → status `PENDING`.

### REST API
| Method | Route | Purpose | Auth |
|--------|-------|---------|------|
| POST | `/api/auth/login` | Get JWT | public |
| POST | `/api/shipments/preview` | Calculate without saving | any |
| POST | `/api/shipments` | Create + calculate + save | any |
| GET  | `/api/shipments` | List (optional `?status=`) | any |
| GET  | `/api/shipments/:id` | Full detail + quote snapshot | any |
| POST | `/api/shipments/:id/decision` | Approve / reject | APPROVER, ADMIN |
| GET  | `/api/shipments/dashboard` | KPIs + charts data | any |
| GET  | `/api/reference/{countries,zones,rates,surcharges}` | Reference data | any |
| PATCH| `/api/reference/{rates,surcharges}/:id` | Edit rate card | ADMIN |

Request shape (preview/create): `{ originCountry, destinationCountry:"SA",
mode:"Express"|"Eco"|"DangerousGoods", dangerousGoods, declaredValue, currency:"SAR",
items:[{quantity,lengthCm,widthCm,heightCm,weightKg}] }`. Every response is
wrapped: `{ "success": true, "data": ... }` or
`{ "success": false, "error": { "message", "details" } }`.

### Frontend screens
Login, Dashboard, Create / Simulate Shipment, Shipment List, Shipment Details,
Rate Management, Surcharge Management, Approval Queue, Settings, Error state —
all present in the single-file demo (`frontend/AirFreightCalculator-LiveDemo.html`).

---

## 9–10. Dummy Data & Demo Scenarios

The seed loads 3 users, 7 zones, 28 origin countries, the SAR rate card, 7
surcharges and these 5 scenarios (see `src/engine/scenarios.js`). The figures
below are produced by the engine and are **identical in the browser demo and the
backend**:

| Ref | Route | Highlights | Landed (SAR) | Status |
|-----|-------|-----------|--------------|--------|
| AF-1001 | DE → SA, Express | volumetric (24 kg) beats actual (18 kg) | 1,452.31 | DRAFT |
| AF-1002 | CN → SA, Dangerous Goods | DG surcharge + mandatory approval | 2,692.24 | PENDING |
| AF-1003 | US → SA, Express | 320 cm edge > DHL max → rejected | — | REJECTED |
| AF-1004 | AU → SA, Express (remote) | remote-area per-kg-with-min surcharge | 1,277.76 | DRAFT |
| AF-1005 | CN → SA, Eco, 3 pcs | chargeable weight aggregated (58.78 kg) | 2,588.28 | PENDING |

Landed cost = freight (base + surcharges) + the separate VAT/duty estimate.

**Demo logins** (password `demo1234`): `admin@afcc.demo`,
`operator@afcc.demo`, `approver@afcc.demo`. The browser demo also offers
one-click login for all five blueprint roles (Procurement, Logistics, Finance,
Admin, Auditor).

---

## 11. Docker / Deployment

```bash
# from the afcc/ folder
docker compose up --build
# API is now on http://localhost:4000  (schema + seed run automatically)
```

To use PostgreSQL instead of SQLite: uncomment the `db` service in
`docker-compose.yml`, set the backend `DATABASE_URL` to the Postgres URL, and
change `provider = "postgresql"` in `prisma/schema.prisma`.

---

## 12. Local Installation Guide (no Docker)

You need **Node.js 18+** installed. Then:

```bash
cd backend
cp .env.example .env          # 1. create config
npm install                   # 2. install dependencies
npm run setup                 # 3. create schema + seed demo data
npm run dev                   # 4. start the API (http://localhost:4000)
```

`npm run setup` runs `prisma generate`, `prisma db push`, and the seed.
The first install downloads Prisma's database engine, so you need internet
access that first time.

Test it works:
```bash
curl http://localhost:4000/api/health
```

**The clickable UI demo** (`frontend/AirFreightCalculator-LiveDemo.html`) is fully
self-contained — it runs in the browser with built-in data and needs no backend
to demonstrate the workflow. To wire it to the live API later, replace its
in-memory store calls with `fetch()` to the endpoints in section 8.

---

## 13. QA / Test Examples

```bash
cd backend
npm test
```
Runs 19 unit tests covering volumetric maths (both divisors), chargeable-weight selection,
multi-piece aggregation, zone resolution, each surcharge type, DG approval, and
oversize rejection. Import `postman/...json` into Postman for API testing —
run **Login** first and the token is reused automatically.

Edge cases covered: oversized piece, dangerous goods, remote destination,
minimum-charge floor, volumetric == actual tie (volumetric wins).

---

## 14. Future Enhancements

- Multiple carriers and a "best rate" comparison.
- Real fuel-surcharge feed and FX rates.
- Customer accounts with negotiated rate cards.
- PDF quote export and email delivery.
- ERP integration (the `resultJson` snapshot is already ERP-ready).
- Full audit trail UI (the `AuditLog` table already exists).

---

## 15. Production Readiness Recommendations

- Move secrets to a secret manager; rotate `JWT_SECRET`.
- Switch to PostgreSQL with managed backups and Prisma migrations
  (`prisma migrate deploy`) instead of `db push`.
- Add rate limiting, request logging, and HTTPS termination at the proxy.
- Add refresh tokens and password policies.
- Put the rate card behind an approval/version history (rates change often).
- Add integration tests against a disposable test database in CI.
- Containerise the frontend and serve it behind the same domain as the API.
