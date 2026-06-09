# Air Freight Cost Calculator
## Enterprise Implementation Blueprint & Miro Mapping Workshop Pack

**Document type:** End-to-end project mapping (Business + Architecture + Build)
**Audience:** IT developer with zero logistics knowledge, Business Analyst, Software Architect, Project Manager
**Carrier in scope:** DHL Express (air freight import)
**Currency / market context:** Saudi Arabia (rates in SAR; surcharge table is DHL KSA)
**Version:** 1.0 (Baseline)
**Status:** Draft for Miro workshop

> How to read this document: Every section is written so it can be lifted directly onto a Miro board. Where you see **[MIRO NODE]**, that is a suggested sticky/shape. Where you see **→**, that is a suggested arrow/relationship. Logistics jargon is explained inline the first time it appears, because the builder is assumed to have no freight background.

---

# 1. Executive Summary

## 1.1 What this project is

The company imports spare parts and goods from abroad using **DHL air freight** (goods flown in by plane rather than shipped by sea or driven by road). Today, someone calculates the cost of each inbound shipment by hand, using DHL rate sheets, a calculator, and tribal knowledge. This is slow, inconsistent, and error-prone.

The **Air Freight Cost Calculator** is a software system that takes the physical facts of a shipment (weight, dimensions, origin country, service type) and automatically produces a **transparent, itemised, auditable freight cost** — exactly the way DHL itself would bill it — *before* the shipment is even booked. It lets procurement and logistics simulate “what will this cost to bring in?” in seconds.

## 1.2 The logistics background (for the zero-knowledge builder)

A few concepts you must internalise before building anything:

- **Air freight is priced by weight bands, not by item.** DHL publishes a **rate table**: rows are weight ranges (e.g. 5.5–20 kg), columns are **zones**. You look up the cell, multiply by weight, and that is the base transport cost.
- **A “zone” is a group of countries.** DHL does not have a price per country; it buckets every origin country into a **zone number** (Zone 1, Zone 2, …). Germany might be Zone 4, China might be Zone 6, etc. You must map *country → zone* to find the right rate column.
- **You are not always charged for what the goods actually weigh.** Light but bulky goods (think a box of foam) take up plane space disproportionate to their weight. So carriers compute a **volumetric weight** (a.k.a. dimensional weight) from the box size, and bill on whichever is larger — actual or volumetric. That larger number is the **chargeable weight**.
- **The headline rate is not the final bill.** On top of base freight, DHL adds **surcharges** (fuel, remote area, dangerous goods, customs handling, etc.). And separately there are **taxes and duties** (VAT, customs duty) which are *government* charges, not DHL freight, and must be handled distinctly.
- **DHL can overrule your numbers.** DHL re-weighs and re-measures shipments at their hub. If their measurement differs from yours, *their* number wins and the bill changes. The system must anticipate this.

## 1.3 Why build it

Manual freight costing fails in predictable ways: people use outdated rate sheets, forget a surcharge, apply the wrong zone, miscalculate volumetric weight, or quietly disagree on rounding. Each error is small but they compound across hundreds of shipments into real money and real disputes with the carrier. A deterministic, versioned, rules-driven calculator removes the human variance, creates an audit trail, and turns freight cost from a guess into a number you can defend line by line.

## 1.4 One-paragraph system description

A web application where a logistics or procurement user enters a shipment’s origin, service mode, weight and dimensions; a backend **calculation engine** computes chargeable weight, resolves the origin country to a DHL zone, looks up the base rate from a versioned rate table, runs a **rules-driven surcharge engine** against the shipment, optionally layers tax/duty estimates, applies rounding, and returns a fully itemised **landed cost breakdown** that can be approved, saved, audited, and pushed into the ERP.

---

# 2. Business Goals

| # | Goal | What it means operationally | How the system delivers it |
|---|------|------------------------------|-----------------------------|
| G1 | Eliminate manual calculation | No spreadsheets, no hand math | Engine computes everything from inputs |
| G2 | Standardise freight calculation | Same inputs → same output, every time, for everyone | Deterministic rules engine + versioned rate/surcharge data |
| G3 | Reduce pricing errors | Fewer disputes with DHL and finance | Validation layer + DHL re-weigh reconciliation |
| G4 | Transparent breakdown | Every charge line is explainable | Itemised output: base + each surcharge + taxes, with the rule that fired |
| G5 | Enable cost simulation | “What if” before committing | Cost Simulator screen, no shipment record required |
| G6 | Auditability | Defend any historical quote | Immutable audit log + data versioning |
| G7 | Future ERP integration | Push costs into SAP/finance | API-first design, export endpoints |
| G8 | Scalability | Add couriers, countries, currencies later | Carrier-agnostic data model |

**Business value framing for the PM:** the ROI case is (a) labour hours saved per shipment, (b) reduction in overpayment/dispute leakage from wrong surcharges, and (c) faster procurement decisions because landed cost is known up front.

---

# 3. User Roles

Role-based access control (RBAC) is mandatory. Define roles as a permission matrix, not as hard-coded checks.

| Role | Primary responsibility | Can do | Cannot do |
|------|------------------------|--------|-----------|
| **Procurement User** | Estimate landed cost before buying | Create shipments, run simulator, view breakdowns, export own quotes | Edit rates, edit surcharges, approve high-value, see other users’ private data |
| **Logistics User** | Operational shipment costing | Everything Procurement can, plus enter actual dimensions/weights, reconcile DHL re-weigh, flag exceptions | Edit master rate/surcharge tables, manage users |
| **Finance User** | Validate cost & tax treatment | View all breakdowns, configure tax/VAT/duty parameters, export for accounting, approve cost above threshold | Edit DHL freight rates, edit surcharge definitions |
| **Admin** | System & master data ownership | Manage users/roles, upload & version rate tables, upload & version surcharge files, manage country→zone mapping, configure rounding/currency | Approve their own high-value shipments (segregation of duties) |
| **Auditor** | Independent oversight | Read-only access to everything incl. audit logs and version history | Any write/edit/approve action |

**[MIRO NODE]** Build this as a swimlane legend in the top-left of the board; every flow node downstream is colour-tagged by which role triggers it.

**Segregation of duties (SoD) rule:** the person who edits master rate data (Admin) must not be the person who approves the financial output (Finance). Enforce in the approval workflow engine.

---

# 4. End-to-End Business Flow

This is the operational spine of the whole system. It is written as a linear flow with decision branches. On Miro this becomes the central horizontal flowchart.

## 4.1 The happy-path flow (nodes and arrows)

```
[START: Shipment Request]
      ↓
[1. Capture Shipment Header]  (origin country, service mode, # pieces, declared value, currency)
      ↓
[2. Dimension & Weight Entry] (per piece: L×W×H cm, actual kg)
      ↓
[3. Chargeable Weight Calculation]
      ├─ is volumetric > actual? → yes → chargeable = volumetric
      └────────────────────────→ no  → chargeable = actual
      ↓
[4. Zone Detection]  (origin country → DHL zone via mapping table)
      ↓
[5. Rate Retrieval]  (weight band × zone → base rate from active rate version)
      ↓
[6. Base Freight Calculation]  (apply 0.5kg-first + per-kg banding rules)
      ↓
[7. Surcharge Calculation]  (rules engine evaluates every surcharge against shipment)
      ↓
[8. Tax & Exclusion Layer]  (VAT, duty, customs handling — kept separate from freight)
      ↓
[9. Validation]  (weights, zone, rate existence, oversize/overweight checks)
      ├─ fail → [EXCEPTION FLOW] → manual review/override → back to 9
      ↓ pass
[10. Final Cost Generation]  (itemised landed cost + rounding)
      ↓
[11. Approval]  (auto-approve if under threshold; else route to approver)
      ↓
[12. Export / Integration]  (save record, push to ERP, generate PDF breakdown)
      ↓
[END: Costed & Recorded Shipment]
```

## 4.2 Branch flows to draw separately on Miro

- **DHL Re-weigh branch:** after a shipment is real, DHL may send back a corrected weight/dimension. This re-enters at node 3, recomputes, and produces a **variance record** comparing original vs DHL-adjusted cost. → notify Logistics + Finance.
- **Oversize/Overweight branch:** from node 9, if a piece exceeds DHL handling limits, route to *special approval* rather than failing outright.
- **Simulation branch:** Procurement can run nodes 1–10 *without* creating a persisted shipment (a throwaway quote). Approval/export nodes are skipped.

## 4.3 Plain-English narrative of the flow

A user states where the goods are coming from and which DHL service. They type each box’s size and weight. The system decides whether the box is “heavy” or “bulky” and picks the larger weight to charge on. It figures out which price column applies based on the origin country’s zone, reads the price for that weight band, and multiplies it out. It then walks through a checklist of possible surcharges and adds any that apply. It estimates taxes separately so finance can see freight and tax apart. It checks nothing is impossible or out of DHL’s limits. It rounds per policy, shows the full itemised bill, gets it approved if it is expensive, and files it / sends it to the ERP.

---

# 5. System Architecture

Enterprise, layered, API-first. Each layer is independently deployable and testable.

## 5.1 Layered view

```
┌─────────────────────────────────────────────────────────────┐
│  PRESENTATION (Frontend SPA)                                 │
│  Dashboard · Shipment Create · Cost Simulator · Rate Mgmt ·  │
│  Zone Mgmt · Surcharge Upload · Approvals · Audit Viewer     │
└───────────────▲─────────────────────────────────────────────┘
                │  HTTPS / REST (JSON), JWT auth
┌───────────────┴─────────────────────────────────────────────┐
│  API GATEWAY / BFF  (authn, authz, rate-limit, validation)   │
└───────────────▲─────────────────────────────────────────────┘
                │
┌───────────────┴─────────────────────────────────────────────┐
│  APPLICATION / DOMAIN SERVICES                               │
│  ┌────────────┐ ┌──────────────┐ ┌────────────────────────┐ │
│  │ Shipment   │ │ Calculation  │ │ Surcharge Rules Engine │ │
│  │ Service    │ │ Engine       │ │ (config-driven)        │ │
│  └────────────┘ └──────────────┘ └────────────────────────┘ │
│  ┌────────────┐ ┌──────────────┐ ┌────────────────────────┐ │
│  │ Rate Lookup│ │ Zone Resolver│ │ Tax / Exclusion Service│ │
│  └────────────┘ └──────────────┘ └────────────────────────┘ │
│  ┌────────────┐ ┌──────────────┐ ┌────────────────────────┐ │
│  │ Approval   │ │ File Import  │ │ Notification Service   │ │
│  │ Workflow   │ │ (Excel/CSV)  │ │ (email/in-app)         │ │
│  └────────────┘ └──────────────┘ └────────────────────────┘ │
└───────────────▲─────────────────────────────────────────────┘
                │
┌───────────────┴─────────────────────────────────────────────┐
│  DATA & INFRASTRUCTURE                                        │
│  Relational DB · Object storage (uploaded files) ·           │
│  Audit log store · Cache · Message/Job queue · Secrets vault  │
└──────────────────────────────────────────────────────────────┘
        │                          │
   [DHL APIs (future)]        [ERP / SAP (future)]
```

## 5.2 Component responsibilities

- **Frontend (SPA):** stateless UI; never computes cost itself (single source of truth = backend engine), only collects inputs and renders the returned breakdown. *Why:* prevents the “two calculators disagree” bug.
- **API Gateway / BFF:** authentication (verify identity), authorization (verify role permission), input validation, throttling. *Why:* one choke point for security.
- **Shipment Service:** CRUD for shipments and pieces; owns shipment lifecycle/state.
- **Calculation Engine:** pure, deterministic function `inputs → cost breakdown`. No side effects, no DB writes. *Why:* deterministic = unit-testable + reproducible for audit.
- **Surcharge Rules Engine:** evaluates configurable surcharge rules; explained in §7.
- **Rate Lookup Service:** given (chargeable weight, zone, rate version) returns the matched cell + applied banding logic.
- **Zone Resolver:** country → zone via versioned mapping.
- **Tax / Exclusion Service:** computes VAT/duty/handling estimates and tags them as *excluded from freight*.
- **Approval Workflow:** threshold-based routing and state machine.
- **File Import Service:** parses uploaded Excel/CSV rate and surcharge files, validates, versions, and stages them.
- **Notification Service:** alerts (re-weigh, exceptions, approvals).
- **Logging/Audit:** append-only record of every calculation and every master-data change.

## 5.3 Key architectural principles

1. **Single source of truth for math** — only the backend engine computes cost.
2. **Configuration over code** — rates, zones, surcharges, rounding, tax rates live in data, not in `if` statements, so business can change them without a release.
3. **Everything versioned** — rate tables, surcharge sets, zone maps are versioned and *date-effective*, so a 6-month-old quote can be reproduced exactly.
4. **Deterministic + idempotent** — same inputs + same data version = same output, always.
5. **API-first** — every UI action is a documented API call, which makes ERP integration trivial later.

---

# 6. Database Design

Relational model. Below: tables, key fields, keys, and relationships. Types are indicative.

## 6.1 Entity-relationship overview

```
users ──< approvals >── shipments ──< shipment_pieces
                              │
                              ├──< shipment_charges
                              │
country ──> zone_mapping ──> zones ──< rate_cells >── rate_versions
                                                  
surcharge_versions ──< surcharge_definitions ──< shipment_charges
                                                  
audit_log (references everything by entity + id)
tax_config (per country / per tax type)
```
( `──<` = one-to-many, `>──` = many-to-one )

## 6.2 Table: `users`

| Field | Type | Key | Notes |
|-------|------|-----|-------|
| user_id | UUID | PK | |
| email | varchar | UQ | login |
| display_name | varchar | | |
| role | enum | | Procurement/Logistics/Finance/Admin/Auditor |
| is_active | bool | | |
| created_at / updated_at | timestamp | | |

## 6.3 Table: `countries`

| Field | Type | Key | Notes |
|-------|------|-----|-------|
| country_id | int | PK | |
| iso2 | char(2) | UQ | e.g. DE, CN, US |
| name | varchar | | |
| region | varchar | | optional grouping |

## 6.4 Table: `zones`

| Field | Type | Key | Notes |
|-------|------|-----|-------|
| zone_id | int | PK | |
| zone_number | int | UQ | 1..7 (extensible) |
| description | varchar | | |

## 6.5 Table: `zone_mapping` (country → zone, versioned)

| Field | Type | Key | Notes |
|-------|------|-----|-------|
| mapping_id | UUID | PK | |
| country_id | int | FK → countries | |
| zone_id | int | FK → zones | |
| zone_version_id | UUID | FK → rate_versions (or own version table) | |
| effective_from | date | | |
| effective_to | date | nullable | open-ended = current |

*Why versioned:* DHL re-bands countries over time; an old quote must still resolve to the zone that was valid then.

## 6.6 Table: `rate_versions`

| Field | Type | Key | Notes |
|-------|------|-----|-------|
| rate_version_id | UUID | PK | |
| label | varchar | | e.g. “DHL KSA 2026 H1” |
| currency | char(3) | | SAR |
| effective_from | date | | |
| effective_to | date | nullable | |
| status | enum | | draft/active/archived |
| source_file_id | UUID | FK → file_uploads | provenance |
| created_by | UUID | FK → users | |

## 6.7 Table: `rate_cells` (the rate grid)

| Field | Type | Key | Notes |
|-------|------|-----|-------|
| rate_cell_id | UUID | PK | |
| rate_version_id | UUID | FK → rate_versions | |
| zone_id | int | FK → zones | |
| weight_from_kg | decimal | | band lower bound |
| weight_to_kg | decimal | nullable | band upper bound (null = open “200+”) |
| band_type | enum | | `first_half_kg` (flat 0.5 kg) or `per_kg` (rate × weight) |
| rate_value | decimal | | the SAR number from the grid |

**Worked mapping from the supplied grid (Zone 1 column):** `0.5kg First = 182.51` (band_type=first_half_kg), `1–5 kg = 16.71/kg` (per_kg), `5.5–20 = 15.42/kg`, `20–50 = 14.13/kg`, `50–200 = 11.58/kg`, `200+ = 10.29/kg`.

## 6.8 Table: `surcharge_versions`

| Field | Type | Key | Notes |
|-------|------|-----|-------|
| surcharge_version_id | UUID | PK | |
| label | varchar | | |
| currency | char(3) | | |
| effective_from / effective_to | date | | date-effective |
| status | enum | | draft/active/archived |
| source_file_id | UUID | FK | uploaded Excel provenance |

## 6.9 Table: `surcharge_definitions`

| Field | Type | Key | Notes |
|-------|------|-----|-------|
| surcharge_id | UUID | PK | |
| surcharge_version_id | UUID | FK | |
| code | varchar | | e.g. FUEL, REMOTE_DEL, FULL_DG |
| name | varchar | | “FULL DANGEROUS GOODS” |
| description | text | | from Excel |
| price_mechanism | enum | | per_shipment / per_kg / per_piece / per_line / percentage / per_kg_with_min / percent_or_min |
| price_value | decimal | nullable | flat amount |
| percentage_value | decimal | nullable | for % mechanisms |
| min_charge | decimal | nullable | floor |
| rate_per_kg | decimal | nullable | |
| applies_to | enum | | Domestic / International / All |
| product_scope | varchar | nullable | TDI-5000, DDI-4000, etc. |
| is_optional | bool | | optional vs auto-applied |
| is_stackable | bool | | can co-exist with others |
| priority | int | | evaluation/order rank |
| condition_json | json | | machine-readable trigger (see §7.4) |

## 6.10 Table: `shipments`

| Field | Type | Key | Notes |
|-------|------|-----|-------|
| shipment_id | UUID | PK | |
| reference | varchar | UQ | human ref |
| origin_country_id | int | FK → countries | |
| service_mode | enum | | Express / Eco / DangerousGoods |
| declared_value | decimal | | for VAT/duty/insurance |
| currency | char(3) | | |
| status | enum | | draft/calculated/approved/exported/exception |
| rate_version_id | UUID | FK | which version was used (frozen) |
| surcharge_version_id | UUID | FK | frozen |
| created_by | UUID | FK → users | |
| created_at | timestamp | | |

## 6.11 Table: `shipment_pieces`

| Field | Type | Key | Notes |
|-------|------|-----|-------|
| piece_id | UUID | PK | |
| shipment_id | UUID | FK | |
| length_cm / width_cm / height_cm | decimal | | |
| actual_weight_kg | decimal | | |
| volumetric_weight_kg | decimal | | computed, stored for audit |
| chargeable_weight_kg | decimal | | computed |
| dhl_adjusted_weight_kg | decimal | nullable | set on re-weigh |

## 6.12 Table: `shipment_charges` (the itemised breakdown)

| Field | Type | Key | Notes |
|-------|------|-----|-------|
| charge_id | UUID | PK | |
| shipment_id | UUID | FK | |
| charge_type | enum | | base_freight / surcharge / tax / duty / handling / fine |
| surcharge_id | UUID | FK nullable | which definition fired |
| label | varchar | | display name |
| basis | varchar | | e.g. “18 kg × 15.42” |
| amount | decimal | | |
| is_excluded_from_freight | bool | | true for VAT/duty/handling/fines |
| rule_trace | json | | why it applied (audit) |

## 6.13 Table: `approvals`

| Field | Type | Key | Notes |
|-------|------|-----|-------|
| approval_id | UUID | PK | |
| shipment_id | UUID | FK | |
| required_role | enum | | who must approve |
| approver_user_id | UUID | FK nullable | |
| status | enum | | pending/approved/rejected |
| threshold_amount | decimal | | what triggered it |
| decided_at | timestamp | nullable | |
| comment | text | | |

## 6.14 Table: `audit_log` (append-only)

| Field | Type | Key | Notes |
|-------|------|-----|-------|
| audit_id | UUID | PK | |
| actor_user_id | UUID | FK | |
| action | varchar | | CREATE/UPDATE/CALC/UPLOAD/APPROVE/OVERRIDE |
| entity_type | varchar | | shipment/rate_version/surcharge/etc. |
| entity_id | UUID | | |
| before_json / after_json | json | | state diff |
| created_at | timestamp | | immutable |

## 6.15 Table: `file_uploads`

| Field | Type | Key | Notes |
|-------|------|-----|-------|
| file_id | UUID | PK | |
| filename | varchar | | |
| file_hash | varchar | | dedupe (detect duplicate upload) |
| storage_uri | varchar | | object store path |
| uploaded_by | UUID | FK | |
| uploaded_at | timestamp | | |
| import_status | enum | | pending/parsed/validated/rejected |

## 6.16 Table: `tax_config`

| Field | Type | Key | Notes |
|-------|------|-----|-------|
| tax_config_id | UUID | PK | |
| country_id | int | FK nullable | null = default |
| tax_type | enum | | VAT / sales_tax / customs_duty / gov_service_tax |
| rate_percent | decimal | | e.g. 15.00 for KSA VAT |
| basis | enum | | CIF / freight / value |
| is_active | bool | | |
| effective_from / effective_to | date | | |

---

# 7. Calculation Engine Logic

This is the mathematical heart. It must be a **pure function**: same inputs → same outputs, no hidden state. Below are formulas and decision trees in build-ready detail.

## 7.1 Step 1 — Volumetric weight (per piece)

```
volumetric_weight_kg = (length_cm × width_cm × height_cm) ÷ DIVISOR
```

- **DIVISOR = 5000** for DHL Express **Time Definite International (TDI / Express)** service.
- **DIVISOR = 4000** for **Day Definite (DDI / Eco)** service. *(This is confirmed in the supplied surcharge file note: “TDI-5000, DDI-4000”. The divisor is therefore a property of the service mode, not a global constant — store it per service mode in config.)*
- For reference, the IATA generic air-freight divisor is 6000; DHL Express uses the denser 5000, which yields a *higher* volumetric weight (more revenue on bulky cargo). Do not hard-code 5000 globally — drive it from service mode.

## 7.2 Step 2 — Chargeable weight (per piece)

```
chargeable_weight_kg = MAX(actual_weight_kg, volumetric_weight_kg)
```

**Decision tree:**
```
if volumetric_weight > actual_weight:
        chargeable = volumetric   (shipment is "bulky/light")
else:
        chargeable = actual       (shipment is "dense/heavy")
```

Worked example (from brief): actual = 12 kg, volumetric = 18 kg → **chargeable = 18 kg**.

**Multi-piece rule:** decide explicitly with the business whether chargeable weight is summed per piece then totalled, or computed on the consolidated shipment. DHL Express typically charges per-shipment on the **sum of chargeable weights of all pieces**, but **piece-level surcharges** (oversize/overweight) are evaluated per individual piece. Implement both: a shipment-level chargeable total *and* per-piece flags.

## 7.3 Step 3 — Zone detection

```
zone = zone_mapping.lookup(origin_country, as_of = shipment_date)
if zone not found → EXCEPTION: "Unmapped country" (see §8)
```

## 7.4 Step 4 — Rate retrieval & base freight (decision tree)

The rate grid mixes two band types. The first half-kilo is a **flat charge**; everything above is **per-kg**. Read the band carefully.

```
W = chargeable_weight_kg (shipment total)
Z = zone

# 1) the mandatory first 0.5 kg is a flat fee
base = rate_cell(Z, band_type=first_half_kg).rate_value      # e.g. Zone1 = 182.51

# 2) remaining weight above 0.5 kg is charged per-kg at the band that W falls into
if W <= 0.5:
        base_freight = base
else:
        band = rate_cell(Z, per_kg band containing W)         # e.g. 5.5–20 kg
        base_freight = base + (W - 0.5) × band.rate_value
```

> **Implementation note / confirm with DHL:** carriers differ on whether the “first 0.5 kg” flat fee stacks on top of the per-kg charge, or whether the per-kg bands are *all-inclusive* for shipments above 1 kg (i.e. for a 10 kg shipment you simply do `10 × band_rate`). The supplied grid strongly implies the latter for ≥1 kg (the per-kg numbers like 15.42 are full per-kg rates, and 182.51 is a separate “first 0.5 kg” minimum for tiny shipments). **Recommended baseline logic:**
> ```
> if W <= 0.5:          base_freight = first_half_kg_rate
> elif W < 1.0:         base_freight = first_half_kg_rate        # sub-1kg uses the flat minimum
> else:                 base_freight = W × per_kg_band_rate(W)   # ≥1kg: weight × band rate
> ```
> Make this rule a single configurable strategy object so it can be switched without code changes once DHL confirms.

**Band matching edge rule:** define bands as half-open intervals `[from, to)` to avoid double-matching at boundaries (e.g. exactly 20 kg belongs to the 20–50 band, not 5.5–20). Document the convention and unit-test the boundaries.

## 7.5 Step 5 — Surcharge engine

The surcharge engine walks every active surcharge definition and asks: *does this shipment match your condition?* Matching surcharges produce charge lines.

**Surcharge calculation by `price_mechanism`:**

| Mechanism | Formula |
|-----------|---------|
| per_shipment | amount = price_value |
| per_piece | amount = price_value × matching_piece_count |
| per_kg | amount = rate_per_kg × chargeable_weight |
| per_kg_with_min | amount = MAX(rate_per_kg × weight, min_charge) |
| per_line | amount = price_value × line_count |
| percentage | amount = percentage_value × base_for_percent |
| percent_or_min | amount = MAX(percentage_value × value, min_charge) |

**Application order (priority) — this matters because some surcharges are computed on others:**

```
1. Base freight                       (computed in §7.4)
2. Weight/zone/conditional surcharges  (per_piece, per_kg, per_shipment flat)
3. Percentage-on-transport surcharges  (FUEL = % of transport + applicable charges) ← must run AFTER 1 & 2
4. Risk/destination surcharges         (Elevated Risk, Restricted Destination)
5. Customs/handling surcharges         (kept separate, see §7.6)
```

**Stackable vs exclusive:** the supplied data encodes mutual exclusions — e.g. *Oversize Piece does not apply to a piece already charged Overweight Piece*; *Non-Conveyable does not apply to pieces already Overweight/Oversize*. Model these as `excludes: [CODE,...]` in `condition_json`. Evaluate higher-priority surcharges first; once a piece is “claimed” by Overweight, suppress the excluded ones.

**Fuel surcharge special case:** FUEL is a **percentage applied to transportation charges and applicable surcharges**, and its percentage is published by DHL monthly (jet-fuel index). Store the current fuel % in config (date-effective), apply it last among transport-related charges, and never bake it into the base rate.

## 7.6 Step 6 — Tax & exclusion layer (the “NOT freight” bucket)

These are **not DHL freight** and must be visually and structurally separated in the output. They are estimates the system can show for *total landed cost* but are flagged `is_excluded_from_freight = true`.

| Exclusion | Nature | KSA context | Mandatory/Optional | Configurable |
|-----------|--------|-------------|--------------------|--------------|
| **VAT** | Government tax on import | **15%** standard, applied to **all imports regardless of value**; basis = **CIF (goods + insurance + freight)** | Mandatory (informational) | Yes (rate + basis per country) |
| **Customs duty** | Government tariff | Typically **5%** standard; 0% for exempt goods (books, many medical devices); up to 100% (tobacco); GCC-origin exemptions; personal ≤ SAR 1,000 duty-exempt (VAT still applies) | Mandatory where applicable | Yes (per commodity/country) |
| **Customs handling fee** | DHL service to clear goods | DHL charges clearance/processing surcharges (e.g. Duty Tax Paid 2% or 100 min; Duty Tax Processing 110 or 2%; Clearance Authorization 50; Permits & Licences 198; Multiline Entry 10/line) | Conditional | Yes |
| **Sales/equivalent tax** | Alt. consumption tax | N/A in KSA (VAT regime) but keep field for multi-country | Optional | Yes |
| **Gov. service tax** | Misc. state levy | Country-specific | Optional | Yes |
| **Fines / penalties** | Post-event charges | e.g. storage after free period (Bonded Storage), post-clearance modification | Exceptional, manual | Manual entry |

**International vs local VAT handling (the brief asks to investigate):** VAT on imports is governed by the *destination* country, not the origin. For KSA imports, **import VAT = 15% on the CIF value** and is collected at customs clearance. This differs from *domestic/local* VAT on services. Because the company imports into KSA, model VAT as a **destination-country rule** (here KSA 15% on CIF), but keep the engine country-parameterised so a future deployment in another country applies that country’s rate/basis. Always keep VAT a separate line — never folded into the freight rate.

**Where exclusions appear in architecture:** computed by the **Tax/Exclusion Service** (§5), stored as `shipment_charges` rows with `is_excluded_from_freight = true`, rendered in a separate “Taxes & Duties (not freight)” panel, and summed into **Total Landed Cost** but excluded from **Total Freight Cost**.

## 7.7 Step 7 — Totals & rounding

```
total_freight      = base_freight + Σ(freight surcharges incl. fuel)
total_exclusions   = VAT + duty + customs handling + fines
total_landed_cost  = total_freight + total_exclusions
```

**Rounding rules (make configurable):**
- Compute internally at full precision; round **only at presentation/charge-line level**.
- Recommended: round each charge line to **2 decimals (SAR)** using half-up rounding; sum the rounded lines so the displayed total equals the sum of displayed lines (avoids the “off by 0.01” complaint).
- Store both the unrounded and rounded value in `shipment_charges` for audit.
- Currency precision and rounding mode must be per-currency config (future multi-currency).

---

# 8. Exception Handling

Every exception needs: a detection point, a severity, a user-facing message, a resolution path, and an audit entry.

| Exception | Detected at | Behaviour | Resolution path |
|-----------|-------------|-----------|-----------------|
| **Invalid weight** (≤0, non-numeric, absurd) | Input validation (node 2) | Block, inline error | User corrects input |
| **Dimension missing** but volumetric needed | Node 3 | Block or fall back to actual-only with warning | User supplies dims |
| **Missing rate** (no cell for zone/band) | Rate lookup (node 5) | Hard stop, flag shipment `exception` | Admin checks rate version; logistics escalates |
| **Invalid / unmapped zone** (country not mapped) | Zone resolver (node 4) | Hard stop | Admin adds country→zone mapping |
| **Oversize piece** (> DHL dimension limits) | Validation (node 9) | Flag + apply Oversize surcharge; if beyond max → special approval | Logistics requests DHL special approval |
| **Overweight piece** (> 70 kg per piece) | Validation (node 9) | Apply Overweight surcharge; if beyond DHL max → may be rejected | Special approval / split shipment |
| **Missing surcharge data** (referenced code not in active version) | Surcharge engine | Warn, compute partial, mark `incomplete` | Admin re-uploads surcharge file |
| **Duplicate upload** (same file hash) | File import | Reject, show prior version | Admin confirms or supersedes |
| **Currency mismatch** (shipment vs rate version) | Calc engine | Block; require FX policy | Apply currency-adjustment / convert per config |
| **DHL re-weigh variance** | Reconciliation | Create variance record, recompute, notify | Logistics + Finance review |

## 8.1 Manual override logic

Any user with sufficient role (Logistics/Finance/Admin per policy) may override a computed value (e.g. force a chargeable weight, waive a surcharge). Rules for overrides:
1. Override requires a **reason** (free text, mandatory).
2. Original computed value is preserved; override stored alongside.
3. Override **always** writes an `audit_log` row (`action = OVERRIDE`, before/after).
4. Overridden shipments may require **elevated approval** regardless of amount.
5. Overrides are reportable (auditor can list every override).

## 8.2 DHL validation rules (re-weigh / re-measure)

- DHL may re-weigh or re-measure at their hub; **their figure governs the bill**.
- On receiving a DHL adjustment, store `dhl_adjusted_weight_kg`, recompute, and produce a **variance line** (original vs adjusted cost + delta).
- System must **notify** the company (ALJ) when recalculation occurs (Notification Service → email + in-app).
- Shipments exceeding DHL’s **maximum weight or volumetric capacity** are: *rejected*, *flagged*, or *require special approval* — model these as distinct outcomes with their own approval/exception sub-flow.
- Every re-weigh event is **audit-logged**.

**[MIRO NODE]** Draw exception handling as a side “rail” beneath the main flow, with red arrows feeding back into the relevant node numbers.

---

# 9. Workflow Automation

| Automation | Trigger | Action |
|------------|---------|--------|
| **Re-weigh alert** | DHL adjustment ingested | Email + in-app to Logistics & Finance; flag shipment |
| **Exception alert** | Any hard-stop exception | Notify owner + Admin; create task |
| **Approval routing** | Cost ≥ threshold, or override used | Route to required role; reminders on SLA breach |
| **Audit tracking** | Any calc / data change / approval | Append-only audit_log; no human action |
| **Scheduled surcharge update** | Monthly fuel %, periodic rate refresh | Reminder to Admin; optional auto-ingest from DHL feed (future) |
| **ERP push** | Shipment approved | Queue job → ERP API; retry on failure |
| **Rate/surcharge expiry warning** | effective_to approaching | Notify Admin to upload new version |

**Approval routing decision tree:**
```
if simulation_only: no approval
elif total_landed_cost < auto_approve_threshold and not overridden:
        auto-approve
elif total_landed_cost < high_value_threshold:
        route → Logistics/Finance
else:
        route → Finance (and Admin for awareness); SoD enforced
```

---

# 10. UI/UX Screen Mapping

Field-by-field. Frontend collects inputs; backend computes. Every screen lists role visibility.

## 10.1 Dashboard (all roles)
KPIs: shipments costed (period), total freight, total landed cost, pending approvals, open exceptions, active rate/surcharge version + expiry. Quick actions: New Shipment, Run Simulator. Charts: cost by zone, cost by service mode, surcharge contribution.

## 10.2 Shipment Creation (Procurement/Logistics)
**Header fields:** reference (auto/manual), origin country (dropdown, drives zone), service mode (Express/Eco/Dangerous Goods), declared value + currency, commodity/HS hint (for duty), notes.
**Pieces (repeatable rows):** length cm, width cm, height cm, actual weight kg → live-computed volumetric, chargeable (read-only), piece flags (oversize/overweight auto-badged).
**Actions:** Calculate, Save Draft, Submit for Approval. **Validation:** positive numbers, required dims when volumetric matters.

## 10.3 Cost Simulator (Procurement/Logistics/Finance)
Same inputs as creation but **non-persistent**. Shows full itemised breakdown instantly: base freight (with basis “W × rate”), each surcharge line (name + basis + amount), taxes/duties in a separate “not freight” panel, totals (freight / exclusions / landed). Toggle: include/exclude tax estimate. Export to PDF.

## 10.4 Rate Management (Admin)
List rate versions (label, currency, effective dates, status). Upload new rate Excel → preview parsed grid → validate → publish/version. Grid editor (read mostly), diff vs previous version, set effective dates, archive.

## 10.5 Zone Management (Admin)
Country→zone mapping table; search country; assign/change zone; versioned with effective dates; bulk import; highlight unmapped countries.

## 10.6 Surcharge Upload (Admin)
Upload surcharge Excel → parse → preview table (code, name, mechanism, price, applies_to, optional, stackable, priority, condition) → validate → publish version. Duplicate-file detection by hash. Per-surcharge edit of priority/stackable/condition before publish.

## 10.7 Audit Logs (Auditor/Admin)
Filter by actor, action, entity, date. Columns: timestamp, actor, action, entity, before→after. Export. Read-only. Special view: all overrides; all re-weigh variances.

## 10.8 Approval Screens (Finance/Logistics/Admin)
Queue of pending approvals: shipment ref, requester, amount, what triggered approval (threshold/override). Drill-in shows full breakdown + rule trace. Approve/Reject with mandatory comment. SLA timer.

---

# 11. Miro Board Structure  ★ (priority)

This section tells the workshop facilitator exactly how to lay out the board. Treat the board as a wide canvas read left-to-right, top-to-bottom.

## 11.1 Top-level frames (left → right)

```
┌──────────┬───────────────┬───────────────┬──────────────┬─────────────┬────────────┐
│ FRAME A  │ FRAME B        │ FRAME C        │ FRAME D       │ FRAME E      │ FRAME F     │
│ Context  │ Business Flow  │ Calculation    │ Architecture  │ Data Model   │ Build/Plan  │
│ & Roles  │ (swimlanes)    │ Engine (logic) │ (layers)      │ (ERD)        │ (roadmap)   │
└──────────┴───────────────┴───────────────┴──────────────┴─────────────┴────────────┘
```

## 11.2 Frame A — Context & Roles (top-left)
- Project one-liner sticky (yellow).
- **Role legend** with the 5 colour codes (used everywhere): Procurement = blue, Logistics = green, Finance = purple, Admin = orange, Auditor = grey.
- Glossary stickies for the 5 logistics terms (zone, chargeable weight, volumetric, surcharge, landed cost).

## 11.3 Frame B — Business Flow (swimlanes)
- **Swimlanes (horizontal rows)** = roles (same colours). 
- **Columns** = the 12 flow stages from §4.1.
- Use **rectangle nodes** for process steps, **diamonds** for decisions (chargeable-weight choice, validation pass/fail, approval threshold), **rounded** for start/end.
- Red arrows loop back from validation/exception nodes to the exception rail beneath the lanes.

## 11.4 Frame C — Calculation Engine (decision-tree zone)
- A vertical decision-tree flowchart of §7: volumetric → chargeable (diamond MAX) → zone lookup → rate band match (diamond per band) → base freight → surcharge loop → tax layer → rounding → totals.
- Put the **formulas** in code-style stickies next to each node.
- A separate boxed sub-area “Surcharge Engine” showing priority order 1→5 and the stackable/exclusion logic.
- A clearly bordered **“NOT FREIGHT”** box (red border) for VAT/duty/handling/fines to visually enforce the separation.

## 11.5 Frame D — System Architecture (layers)
- Stack the 4 layers (Presentation / Gateway / Services / Data) as horizontal bands.
- Service components as stickies inside the Services band.
- Dotted arrows out to future **DHL API** and **ERP/SAP** boxes (greyed = future).

## 11.6 Frame E — Database ERD
- One box per table (§6) with key fields.
- Crow’s-foot connectors for relationships (one-to-many).
- Cluster: master data (countries/zones/rates/surcharges) on the left, transactional (shipments/pieces/charges/approvals) on the right, audit at the bottom spanning both.

## 11.7 Frame F — Build & Plan
- Roadmap phases (§16) as a timeline.
- MVP scope box (green) vs later phases (greyed).
- Risk register stickies (§18) with red flags.

## 11.8 Colour & shape legend (global)
| Element | Convention |
|---------|-----------|
| Process step | Rectangle |
| Decision | Diamond |
| Start/End | Rounded rectangle |
| Data store/table | Cylinder/box |
| Role ownership | Border/fill colour per role legend |
| Exception/risk | Red |
| Future/optional | Grey, dashed border |
| Formula/code | Monospace sticky |

## 11.9 Suggested arrows (relationships to draw)
Shipment Request → Dimension Entry → Chargeable Weight (diamond) → Zone Detection → Rate Retrieval → Surcharge Engine → Tax Layer (red box) → Validation (diamond) → Final Cost → Approval (diamond) → Export. Plus feedback arrows: Validation —fail→ Exception Rail —resolve→ back; DHL Re-weigh ⟲ into Chargeable Weight.

---

# 12. Integration Possibilities

| System | Direction | Purpose | Approach |
|--------|-----------|---------|----------|
| **SAP / ERP** | Out (and ref data in) | Push approved freight/landed cost to procurement & finance; pull PO/vendor refs | REST/IDoc/BAPI; queue + retry; idempotent keys |
| **DHL APIs** | In | Live rates, tracking, re-weigh data, fuel index | Scheduled + on-demand pulls; map to internal rate/surcharge model |
| **Excel import** | In | Rate tables & surcharge files (current method) | File Import Service: parse → validate → version |
| **CSV upload** | In | Bulk country→zone, bulk shipments | Same import pipeline, schema-validated |
| **Power BI** | Out | Analytics on freight spend, surcharge mix, zone trends | Read replica / data export / OData feed |
| **Email/SMTP** | Out | Alerts, approvals, re-weigh notices | Notification Service |

**Design rule:** keep DHL-specific logic behind an adapter interface so a second carrier (FedEx/UPS) plugs into the same calculation contract.

---

# 13. Security & Permissions

- **Role-based access control (RBAC):** enforce the §3 matrix at the API gateway; never trust the frontend. Default-deny.
- **Segregation of duties:** master-data editors ≠ financial approvers.
- **Authentication:** SSO/OAuth2/OIDC + JWT; MFA for Admin/Finance.
- **Audit trails:** append-only `audit_log`, immutable, covering calc, data change, upload, approval, override; tamper-evident (hash-chain optional).
- **Encryption:** TLS in transit; encryption at rest for DB and object storage; secrets in a vault, never in code.
- **Sensitive logistics data:** declared values, vendor identities, and pricing are commercially sensitive — restrict by role, mask declared value for Procurement viewing others’ shipments.
- **File-upload security:** validate type/size, scan for malware, parse in a sandbox, reject macros, verify schema before ingest, hash to detect duplicates, store originals immutably for provenance.
- **Data retention & compliance:** retain audit and versioned rate data per policy; right-to-reproduce any historical quote.

---

# 14. Scalability Considerations

- **Multi-courier support:** carrier as a first-class dimension; rate/surcharge/zone tables keyed by carrier; calculation contract shared, carrier adapters differ.
- **FedEx / UPS integration:** add adapters + their rate cards; reuse engine. (Note divisor differences: many use 5000; IATA 6000 — keep divisor per carrier+service.)
- **Multi-country deployment:** tax/VAT/duty already country-parameterised; zone maps per origin set; localise currency, language, rounding.
- **Multi-currency:** store currency on every monetary field; FX rate table (date-effective); currency-adjustment surcharge; present in user currency, store in source currency.
- **AI forecasting:** predict landed cost trends, surcharge exposure, fuel-index impact; anomaly detection on quotes vs DHL invoices.
- **Shipment analytics:** spend by zone/mode/surcharge; dispute leakage tracking; carrier benchmarking.
- **Performance:** rate lookups cached; calculation engine stateless and horizontally scalable; heavy imports and ERP pushes on a job queue.

---

# 15. Recommended Tech Stack

| Layer | Recommendation | Pros | Cons / watch-outs |
|-------|----------------|------|-------------------|
| **Frontend** | React + TypeScript (Next.js) | Mature, typed, component ecosystem, strong forms/tables | Build complexity; SSR optional |
| *(alt)* | Angular | Batteries-included, enterprise-friendly | Heavier, steeper curve |
| **Backend** | .NET (C#) or Java Spring Boot | Strong typing, enterprise auth, great for deterministic engines & rules | Verbose; team skill dependent |
| *(alt)* | Node.js (NestJS) | Same language as FE, fast dev | Numeric precision needs care (use decimal lib) |
| **Calc precision** | Decimal/BigDecimal types everywhere | Avoids float rounding bugs in money | Must be disciplined—never use float for SAR |
| **Database** | PostgreSQL | JSON columns (condition_json), strong constraints, versioning-friendly, free | Ops overhead vs managed |
| **Rules engine** | Config-driven (JSON conditions) evaluated in-app; or Drools/JSON-Rules | Business-editable, no redeploy | Don’t over-engineer; start simple |
| **Object storage** | S3-compatible | Cheap, durable file provenance | Lifecycle policy needed |
| **Cache/queue** | Redis + a queue (SQS/RabbitMQ) | Fast lookups, reliable async jobs | Extra infra |
| **Cloud** | Azure (if SAP/Microsoft shop) or AWS | Managed DB, auth, storage, scaling | Cost governance |
| **Auth** | OAuth2/OIDC (Azure AD / Keycloak) + MFA | Standards-based SSO, RBAC | Integration effort |
| **Reporting** | Power BI | Native to MS estate, rich | License cost |
| **CI/CD & IaC** | Git + pipeline + Terraform | Repeatable, auditable infra | Setup time |

**Single most important stack rule:** use a **decimal money type** end-to-end and centralise rounding — currency bugs are the #1 source of freight-cost disputes.

---

# 16. Developer Task Breakdown

## 16.1 MVP definition (what must exist to deliver value)
A user can: enter a shipment, get correct chargeable weight, correct zone, correct base freight from an uploaded rate table, apply a core set of surcharges, see a separated tax estimate, view an itemised breakdown, and save it — with an audit log. No ERP, no live DHL API yet.

## 16.2 Phased roadmap

| Phase | Theme | Key deliverables | Priority |
|-------|-------|------------------|----------|
| **0 — Foundations** | Skeleton & data model | Repo, CI/CD, DB schema (§6), auth, RBAC, audit log | P0 |
| **1 — Core engine (MVP)** | Deterministic costing | Volumetric/chargeable math, zone resolver, rate import + lookup, base freight, breakdown API, unit tests | P0 |
| **2 — Surcharges** | Rules engine | Surcharge import + versioning, condition evaluation, priority/stacking/exclusions, fuel % | P0/P1 |
| **3 — Tax & exclusions** | Landed cost | VAT/duty/handling layer (KSA 15% VAT, 5% duty), separation in UI | P1 |
| **4 — Workflow** | Approvals & exceptions | Threshold approvals, override + reason, exception rail, notifications | P1 |
| **5 — Re-weigh & reconcile** | DHL variance | Adjusted weight, variance record, alerts, audit | P1 |
| **6 — UX polish & reporting** | Dashboards | Simulator UX, dashboard KPIs, PDF export, Power BI feed | P2 |
| **7 — Integration** | ERP & DHL APIs | SAP push, DHL rate/fuel pulls, adapters | P2/P3 |
| **8 — Scale** | Multi-carrier/currency/AI | Carrier adapters, multi-currency, forecasting | P3 |

## 16.3 Sprint suggestions (2-week sprints, indicative)
S1: Phase 0. S2–S3: Phase 1 (engine + rate import). S4: Phase 2 surcharge core. S5: surcharge conditions/fuel + Phase 3 tax. S6: Phase 4 approvals/exceptions. S7: Phase 5 re-weigh. S8: Phase 6 UX/reporting. S9+: integration & scale.

## 16.4 Priority key
P0 = must-have for any usable release · P1 = needed for production trust · P2 = efficiency/insight · P3 = strategic expansion.

---

# 17. QA & Testing Strategy

| Test type | Focus | Examples |
|-----------|-------|----------|
| **Unit tests** | Pure engine functions | volumetric formula (incl. 5000 vs 4000 divisor), MAX chargeable, band boundary `[from,to)`, each surcharge mechanism, rounding half-up |
| **Rate validation** | Lookup correctness | every cell of supplied grid; boundary weights 0.5/1.0/5.0/5.5/20/50/200; open “200+” band |
| **Logistics scenario tests** | Real shipments | 12kg actual/18kg vol → 18kg; bulky light box; multi-piece with one oversize; dangerous goods mode surcharge |
| **Surcharge stacking/exclusion** | Rule interactions | Overweight suppresses Oversize on same piece; fuel % applied after transport; remote-area min charge |
| **Tax separation** | Exclusion bucket | VAT 15% on CIF shown separately; landed = freight + exclusions; freight total excludes tax |
| **Edge cases** | Failure paths | zero/negative weight, unmapped country, missing rate cell, duplicate upload (hash), currency mismatch, beyond-DHL-max |
| **Versioning/repro** | Audit | reproduce a historical quote with old rate+surcharge+zone versions → identical output |
| **UAT** | Business sign-off | Logistics/Finance run their real backlog through simulator and compare to known-good manual numbers |
| **Security tests** | RBAC & uploads | role can’t exceed permissions; malicious file rejected; audit immutability |
| **Performance** | Load | concurrent simulations, large multi-piece shipments, bulk import |
| **Regression** | After rate/surcharge updates | golden-master breakdowns re-verified |

**Golden-master approach:** capture a set of known-correct itemised breakdowns and assert byte-for-byte on every build — the cheapest insurance against silent cost drift.

---

# 18. Risks & Mitigation

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|-----------|------------|
| R1 | **DHL banding logic misunderstood** (first-0.5kg vs per-kg stacking) | Systematic over/under-charge | High | Confirm with DHL in writing; make banding a configurable strategy; validate against real invoices in UAT |
| R2 | **Floating-point money errors** | Penny disputes, eroded trust | Med | Decimal types end-to-end; centralised rounding; golden-master tests |
| R3 | **Stale rates/surcharges** | Wrong quotes | High | Date-effective versioning; expiry alerts; provenance to source file |
| R4 | **DHL re-weigh not reconciled** | Budget surprises | High | Re-weigh ingestion + variance record + alerts |
| R5 | **Country→zone errors** | Wrong rate column | Med | Versioned mapping; unmapped-country hard stop; admin review |
| R6 | **Surcharge stacking/exclusion wrong** | Over/under charge | Med | Encode exclusions in data; dedicated interaction tests |
| R7 | **VAT/duty mis-treatment** (folded into freight) | Tax & accounting errors | Med | Hard structural separation (`is_excluded_from_freight`); finance-owned tax config |
| R8 | **File-upload security / bad data** | Breach or corrupt rates | Med | Schema validation, malware scan, sandbox parse, dedupe, immutable originals |
| R9 | **Scope creep into full TMS** | Delay | Med | Strict MVP; phased roadmap; carrier-agnostic but DHL-first |
| R10 | **Over-engineered rules engine** | Cost/complexity | Med | Start with JSON-condition evaluator; adopt heavyweight engine only if needed |
| R11 | **Currency/multi-country assumptions baked in** | Rework | Low/Med | Parameterise currency, tax, divisor, rounding from day one |
| R12 | **Single point of math truth violated** (FE computes too) | Divergent numbers | Low | Backend-only calculation; FE renders only |

---

# Appendix A — Real Surcharge Reference Data (DHL KSA, SAR)

These are the actual surcharges from the supplied file, normalised for seeding `surcharge_definitions`. `applies_to`: D=Domestic, I=International, A=All. Mechanism abbreviations per §6.9.

| Code (suggested) | Name | Mechanism | Price (SAR) | Applies | Notes / condition |
|------------------|------|-----------|-------------|---------|-------------------|
| REMOTE_PU | Remote Area Pickup | per_kg_with_min | 1.10/kg, min 52.80 | D | Remote pickup, billed to dest/3rd party |
| REMOTE_DEL | Remote Area Delivery | per_kg_with_min | 2.20/kg, min 105.60 | I | Remote/inaccessible destination |
| ADDR_CORR | Address Correction | per_shipment | 49 | D/I | Incomplete/incorrect address |
| DATA_ENTRY | Data Entry | per_shipment | 44 | A | Label not electronic/correct |
| DRY_ICE | Dry Ice UN1845 | per_shipment | 52.80 | A | Freezing agent, non-DG |
| LI_ION_966 | Lithium Ion PI966 | per_shipment | 22 | A | IATA PI966 Section II |
| FULL_DG | Full Dangerous Goods | per_shipment | 440 | A | IATA DG class 2,3,4,5,6,8,9 |
| EXC_QTY | Excepted Quantities | per_shipment | 44 | A | DG excepted quantities |
| LTD_QTY | Limited Quantities | per_shipment | 110 | A | ADR ltd qty, ≤30kg/piece |
| LI_METAL_969 | Lithium Metal PI969 | per_shipment | 22 | A | IATA PI969 Section II |
| CONS_COMM | Consumer Commodity | per_shipment | 110 | A | ID8000 B2C goods |
| ADR_LOAD_EXEMPT | ADR Load Exemptions | per_shipment | 22 | A | ADR 1.1.3.6 limits |
| DUTY_TAX_PAID | Duty Tax Paid | percent_or_min | 2% or 100 min | A | DHL clears & invoices duties at origin |
| IOR | Importer of Record | per_shipment | 80 | A | Bill-to/ship-to IOR service |
| FUEL | Fuel Surcharge | percentage | % on transport + charges | A | DHL monthly jet-fuel index; apply last |
| ELEV_RISK | Elevated Risk | per_shipment | 132 | A | War/unrest/terrorism destinations |
| RESTR_DEST | Restricted Destination | per_shipment | 132 | A | UN Security Council restricted |
| OVERSIZE | Oversized Piece (dimension) | per_piece | 52.80 (D) / 88 (I) | D/I | Longest >100cm or 2nd >80cm; excl. if Overweight |
| OVERWEIGHT | Overweight Piece | per_piece | 220 (D) / 418 (I) | D/I | Piece >70kg |
| NONCONV_WT | Non-Conveyable (weight) | per_piece | 52.80 (D) / 88 (I) | D/I | Piece 25–70kg; excl. if Over* |
| NONCONV_IRR | Non-Conveyable (irregular) | per_piece | 48.15 (D) / 80.50 (I) | D/I | “Non-conveyable” remark; excl. if Over* |
| NONSTACK | Non-Stackable Pallet | per_piece | 660 (D) / 1320 (I) | D/I | Pallet ≥25kg, not stackable |
| GOGREEN | GoGreen Plus (CO2 reduced) | per_kg | 0.69 | I | SAF; auto on qualifying TDI |
| TEMP_IMP_EXP | Temporary Import/Export | per_shipment | 200 | A | Repair/testing/exhibition |
| CLEAR_AUTH | Clearance Authorization | per_shipment | 50 | A | Importer asked to be contacted pre-clearance |
| REL_BROKER | Release to Broker | per_shipment | 200 | A | Release to designated broker |
| BROKER_NOTIF | Broker Notification | per_shipment | 52.80 | A | Paperwork to broker |
| BONDED_STOR | Bonded Storage | per_shipment_per_day | 1/kg/day, min 48.40/day after 3 days | A | Customs hold storage |
| PERMITS_LIC | Permits & Licences | per_shipment | 198 | A | Controlled commodities |
| MULTILINE | Multiline Entry | per_line | 10 | A | >5 lines on clearance |
| PREF_ORIGIN | Preferential Origin | per_shipment | 44 | A | EUR1/ATR certificates |
| EXPORT_DECL | Export Declaration | per_shipment | 44 | A | Controlled/over-threshold |
| NEUTRAL_DEL | Neutral Delivery | per_shipment | 22 | A | Hide declared value |
| RES_ADDR | Residential Address | per_shipment | 22 | A | Home delivery notify |
| SHIP_INS | Shipment Insurance | percent_or_min | 75 or 2% of value | A | Valuable goods |
| EXT_LIAB | Extended Liability | per_shipment | 30 (D) / 40 (I) | D/I | Valuable documents |
| SHIP_PREP | Shipment Preparation | per_shipment | 110 | A | DHL preps shipment |
| PKG_ITEM | Packaging Item | per_shipment | 15 | A | Packaging in stacks |
| CHG_BILLING | Change of Billing | per_shipment | 52.80 | A | Reissue invoice |
| DEL_SIG | Delivery Signature | per_shipment | 25 | A | Hard-copy signature |
| DIRECT_SIG | Direct Signature | per_shipment | 25 | A | Consignee-only signature |
| VERBAL_NOTIF | Verbal Delivery Notification | per_shipment | 25 | A | Phone notification |
| SAT_DEL | Saturday Delivery | per_shipment | 176 | A | ≤250kg, Saturday |
| SAT_PU | Saturday Pickup | per_shipment | 132 | A | Saturday pickup |
| DED_DEL | Dedicated Delivery | per_kg_with_min | 2.20/kg, min 180 | A | Non-routine delivery |
| DED_PU | Dedicated Pickup | per_kg_with_min | 2.20/kg, min 132 | A | Non-routine pickup |
| DUTY_TAX_PROC | Duty Tax Processing | percent_or_min | 110 or 2% | A | Non-account duty/tax processing |
| POST_CLEAR_MOD | Post Clearance Modification | per_shipment | 352 | A | Correct value/commodity post-clearance |
| PHYS_INTERV | Physical Intervention | per_shipment | 90 | I | Non-routine customs inspection |

# Appendix B — Volumetric Divisor Reference (from supplied file)

`Volumetric Weight (kg) = L × W × H (cm³) ÷ Standard Conversion Factor`, where the factor is **5000 for TDI (Time Definite International / Express)** and **4000 for DDI (Day Definite International / Eco)**. Store the divisor per service mode, not as a global constant.

# Appendix C — KSA Tax/Duty Quick Reference (verified)

- **Import VAT: 15%**, applied to **all imports regardless of value**, basis = **CIF (goods + insurance + freight)**, collected at customs clearance. VAT is a destination-country rule; keep it country-parameterised.
- **Customs duty:** standard **5%**; **0%** for exempt categories (books, many medical devices with SFDA permit, certain staple foods); up to **100%** (tobacco). **GCC-origin** goods exempt with proof of origin. Personal shipments **≤ SAR 1,000** duty-exempt (VAT still applies).
- Treat all of the above as **excluded from freight** (`is_excluded_from_freight = true`) and surface them in a separate “Taxes & Duties (not freight)” panel that rolls into Total Landed Cost.
