# Air Freight Cost Calculator — Blueprint **V2** (Corrected Source of Truth)

**Supersedes:** `air_freight_blueprint.md` (V1, Baseline 1.0)
**Carrier in scope:** DHL Express / Economy Select (air freight import into KSA)
**Currency:** SAR (Express card) / US$ (Economy Select card)
**Status:** Approved correction set — replaces V1 for all future development
**Validated against:**
- `DHL Zone Guide 2026 (1).pdf` (country → zone)
- `Express Calculator logic.xlsx` (ground-truth worked calculation, 250 kg Z5 = **7,984.40 SAR**)
- `DHL Rates Modeling .docx` (rate cards Zone 1–7, Economy Select, DG, surcharge rules)

> **Marker key:** ✅ NEW · ⚠️ CHANGED · ❌ REMOVED. Every change carries Old → New → Why → Impacts.

---

# 1. Executive Summary

The V1 calculator is **systematically wrong on base freight** — the single biggest number in every quote. Three independent errors compound:

1. ⚠️ **Wrong rate values.** V1's rate grid for Zones 2–7 (and partially Z1) is *invented* placeholder data. The real DHL Import Express card (Zone 1–7, SAR) is in the Rates Modeling document and was never used.
2. ⚠️ **Wrong calculation method.** V1 multiplies the *entire* chargeable weight by *one* band rate. The approved method is **progressive/marginal banding** — weight is sliced across every band (like income-tax brackets) and each slice is charged at its band rate, then summed.
3. ⚠️ **Wrong charging unit.** The published rates are **per 0.5 kg increment**, not per kg. V1 treats them as per kg, halving the per-kg portion.

**Combined effect:** V1 **undercharges by 40–65%** on typical shipments. Example: an 18 kg Zone-1 Express shipment is **733.82 SAR** (correct) vs **277.56 SAR** (V1) — a 62% under-quote.

Two further structural gaps:

4. ✅ **Zone source.** Country→zone must come from the **DHL Zone Guide 2026**, not V1's invented "geographic Z1–Z7" buckets. (Conflict noted in §3 — see customised-guide caveat.)
5. ⚠️ **Mode-specific rate cards.** V1 applies the *same* SAR Express grid to Express, Eco and DG. In reality **Economy Select (ETS)** is a **US$ lane-based** card and **DG** has its own SAR/0.5 kg card plus fixed DGD fees. These are different pricing engines, not a divisor tweak.

6. ⚠️ **Fuel base.** Fuel = % of **(freight + oversize + overweight + demand)** only — not "% of freight + every surcharge" as V1's engine computes.

What V1 got **right** and we keep: volumetric divisor per mode (5000 Express / 4000 Eco), chargeable = MAX(actual, volumetric), VAT 15% on CIF, customs duty 5% (GCC-exempt), the surcharge catalogue (Appendix A), and the exclusion-separation principle.

---

# 2. Document Review Summary

| Doc | Purpose | What it is the source of truth for |
|-----|---------|------------------------------------|
| **DHL Zone Guide 2026** | Country → Air/Road zone | Zone determination. Lists every country with an **Air zone (0–10, +1A)** and Road zone. Footer: *"Where a customer has customised zoning, refer to your customised zone guide only."* |
| **Express Calculator logic.xlsx** | A real, approved worked example | The **calculation METHOD**. One sheet: a 250 kg, Zone-5 Express shipment decomposed across all six bands, summed to **7,984.40 SAR**. Proves progressive banding + per-0.5 kg increments. |
| **DHL Rates Modeling .docx** | Commercial rate model + rules | The **rate VALUES** (Import Express Zone 1–7 SAR card), the **Economy Select (US$)** lane card, the **DG** cards, the **fuel base definition**, volumetric divisor, claims/inflation/volume clauses, insurance value thresholds. |

**Ground-truth Import Express card (SAR), rates per additional 0.5 kg:**

| Band | Z1 | Z2 | Z3 | Z4 | Z5 | Z6 | Z7 |
|------|----|----|----|----|----|----|----|
| 1st 0.5 kg (flat) | 182.51 | 214.65 | 218.62 | 181.39 | **176.06** | 268.99 | 296.90 |
| 1.0–5.0 kg | 16.71 | 21.21 | 21.21 | 16.73 | **20.56** | 34.46 | 52.69 |
| 5.5–20.0 kg | 15.42 | 17.22 | 19.86 | 16.73 | **19.27** | 30.48 | 48.83 |
| 20.0–50.0 kg | 14.13 | 15.89 | 17.23 | 14.15 | **16.72** | 27.83 | 45.00 |
| 50–200 kg | 11.58 | 14.56 | 15.89 | 14.15 | **15.43** | 25.18 | 42.40 |
| 200 kg + | 10.29 | 11.93 | 14.56 | 14.15 | **14.13** | 23.85 | 39.83 |

*Valid till 31 Oct 2026, adjusted yearly. "Incremental rates are accounted for every additional 0.5 kg."*

---

# 3. Gap Analysis (V1 vs New Documents)

| # | Area | V1 (current code) | Ground truth | Verdict |
|---|------|-------------------|--------------|---------|
| G-1 | Rate values | Invented grid (Z5 first-half 245, etc.) | Real card (Z5 first-half 176.06, etc.) | ⚠️ Replace entirely |
| G-2 | Freight method | `W × singleBandRate` | Progressive marginal banding | ⚠️ Rewrite |
| G-3 | Charging unit | per kg | per **0.5 kg** increment | ⚠️ Rewrite |
| G-4 | Weight rounding | none (uses raw kg) | round **up to next 0.5 kg** (DHL practice) | ✅ Add (confirm) |
| G-5 | Zone source | invented geographic buckets | DHL Zone Guide 2026 | ⚠️ Replace data |
| G-6 | Zone count/scheme | Z1–Z7 (7) | Guide uses 0–10/1A; **rate card uses 1–7** | ⚠️ Conflict — see note |
| G-7 | Eco (ETS) pricing | same SAR grid, divisor 4000 | **US$ lane-based** card, fuel-inclusive | ⚠️ New engine |
| G-8 | DG pricing | flat 440 surcharge on Express grid | own SAR/0.5 kg card + DGD fees (SR 1,100 / USD 350) + DG check fee | ⚠️ New card + fees |
| G-9 | Fuel base | freight + **all** surcharge lines | freight + **oversize + overweight + demand** only | ⚠️ Narrow the base |
| G-10 | Demand surcharge | absent | exists (high-demand periods), feeds fuel base | ✅ Add |
| G-11 | VAT / duty | 15% CIF / 5% | same | ✅ Keep |
| G-12 | Volumetric divisor | 5000 / 4000 per mode | same | ✅ Keep |
| G-13 | Insurance value alert | absent | notify DHL if value > €500k (insured) / €1m (uninsured) | ✅ Add validation |
| G-14 | Rate validity / yearly adjust | absent | rates expire 31 Oct 2026; inflation>5% & volume-shortfall>20% reprice clauses | ✅ Add versioning/expiry |

### ⚠️ CONFLICT C-1 — Zone numbering (Guide 0–10/1A vs Rate card 1–7)
- **Conflict:** The Zone Guide 2026 assigns each country an **Air zone 0–10 (+1A)**. The Import Express rate card prices only **Zone 1–7**. They are not the same scale (the Guide has Zone 0, Zone 8–10, Zone 1A that have no rate-card column).
- **Most likely interpretation:** The supplied Zone Guide is the **generic global** guide; the ALJ account has a **customised 7-zone** mapping (the footer explicitly says to use the customised guide if one exists). The 7-zone rate card is the billing reality.
- **Recommendation:** Treat the **7-zone rate card as authoritative for pricing** and **obtain the customer's customised country→zone(1–7) guide** to populate `zone_mapping`. Do **not** hard-code the generic 0–10 numbers against the 1–7 card. Until the customised guide arrives, seed `zone_mapping` from the known worked examples and finance's manual sheets, and **hard-stop on unmapped countries** (never guess a zone).
- **Reasoning:** Pricing a shipment against the wrong zone column is the second-most expensive error after the banding bug; a wrong guess is worse than an explicit "unmapped — needs mapping" exception.

---

# 4. Change Impact Analysis

### CIA-1 — Base Freight: Rate Values ⚠️ CHANGED
- **Old logic:** `RATE_GRID` in `data.js` held placeholder rates for Z1–Z7.
- **New logic:** Replace with the exact Import Express SAR card (table §2).
- **Reason / validating doc:** `DHL Rates Modeling .docx` (rate table) + `Express Calculator logic.xlsx` (Z5 column matches byte-for-byte).
- **Business impact:** Every Express quote changes; most rise substantially.
- **System impact:** Rewrite `RATE_GRID`; reseed `rate_cells`; freeze under a versioned `rate_version` ("DHL Import Express — valid to 2026-10-31").
- **DB impact:** `rate_cells.rate_value` repopulated; add `rate_versions.effective_to = 2026-10-31`.
- **Website impact:** Results/Simulator show higher, correct freight; basis string changes (per-band).
- **Calculation impact:** Combined with CIA-2/-3, +40–65% on typical shipments.
- **Risk if not updated:** Continued systematic under-quoting → procurement decisions on false landed cost; disputes when DHL invoices the real figure.

### CIA-2 — Base Freight: Progressive Banding ⚠️ CHANGED
- **Old logic:** `freightSubtotal = chargeableWeight × bandForWeight().rate` (one band, whole weight). `calculator.js:153`.
- **New logic:** Slice weight across bands; charge each slice at its band rate; sum. (Formula §6.)
- **Reason:** The Excel sums **all six** band amounts (0.5+4.5+15+30+150+50 = 250 kg) to reach 7,984.40. A single-band model yields 7,065 — wrong.
- **Business impact:** Mid/heavy shipments priced correctly (they were grossly under-charged).
- **System impact:** Rewrite `computeFreight()` and `bandForWeight()`.
- **DB/Website impact:** breakdown now shows a freight sub-table (one line per band) — richer Results screen.
- **Risk if not updated:** Heaviest (most valuable) shipments are the most wrong.

### CIA-3 — Charging Unit: per 0.5 kg ⚠️ CHANGED
- **Old logic:** rates treated as per kg (`× weight`).
- **New logic:** rates are per 0.5 kg increment (`× weight ÷ 0.5`, i.e. `× 2`), applied within each band.
- **Reason:** Doc: *"Incremental rates are accounted for every additional 0.5 kg."* Excel: 4.5 kg in the 1–5 band = 9 × 20.56 = 185.04 (not 4.5 × 20.56).
- **Impact:** Doubles the per-kg portion vs V1. Core to matching the 7,984.40 figure.
- **Risk if not updated:** ~2× under-charge on the variable portion.

### CIA-4 — Chargeable-weight rounding ✅ NEW
- **Old:** raw kg used directly.
- **New:** round chargeable weight **up to the next 0.5 kg** before banding.
- **Reason:** DHL bills in 0.5 kg steps; consistent with "every additional 0.5 kg". (Flag to confirm in writing with DHL — Risk R1.)
- **Impact:** Small upward adjustments on fractional weights (e.g. 17.3 → 17.5 kg).

### CIA-5 — Zone determination ⚠️ CHANGED
- **Old:** invented geographic buckets baked into `COUNTRIES[].zone`.
- **New:** versioned `zone_mapping` sourced from the customer's customised DHL zone guide (see Conflict C-1); unmapped country = hard stop.
- **Impact:** Correct rate column selected; auditable, date-effective.

### CIA-6 — Economy Select (Eco/ETS) pricing engine ⚠️ CHANGED
- **Old:** Express SAR grid with divisor 4000.
- **New:** **US$ lane-based** card: keyed by (origin city, movement, destination, DG flag) with weight breaks **MINIMUM / +45 / +100 / +300 / +500 / +1000 kg**, rate per kg, **fuel included**, liability max US$100/shipment, insurance @2%. Example lanes: JPN-NGO→JED, USA-LAX→JED, USA-CVG→JED, Bahrain→RUH/JED.
- **Reason:** Rates Modeling doc shows ETS as a distinct US$ structure.
- **Impact:** Eco needs its own rate table, currency handling (US$), and a lane lookup — not the SAR band engine.
- **Risk if not updated:** Eco quotes are entirely fictitious today.

### CIA-7 — Dangerous Goods pricing ⚠️ CHANGED
- **Old:** Express grid + flat FULL_DG 440 surcharge.
- **New:** DG has dedicated cards, e.g. **ETS DG (Bahrain→Saudi), SAR/0.5 kg**: 1st 0.5 kg 60; 1–3 kg 23; 3–5 kg 13; 5–10 kg 7; 10–20 kg 9; 20–70 kg 8 (per 0.5 kg); **>70 kg 11/kg** (per-kg multiplier). Plus **DGD fee SR 1,100** & **Excepted Quantity fee SR 44/shipment**; ETS-DG (US$) adds **DG Check fee USD 125/UN** + **DGD USD 350/shipment**.
- **Impact:** DG is a card + mandatory fees, not a single surcharge.
- **Risk if not updated:** DG quotes wrong; missing mandatory DGD fees.

### CIA-8 — Fuel surcharge base ⚠️ CHANGED
- **Old:** fuel % × (freight + **all** surcharge lines). `calculator.js` fuel block.
- **New:** fuel % × (**freight + oversize + overweight + demand**) only.
- **Reason:** Doc: *"Fuel Surcharge is % of (freight cost + oversize + demand surcharge + overweight)."*
- **Impact:** Fuel slightly lower (narrower base); correct and defensible.
- **Risk if not updated:** Fuel over-charged on customs/optional surcharges that shouldn't be in its base.

### CIA-9 — Demand surcharge ✅ NEW
- Add a **Demand Surcharge** (high-demand periods, DHL-published), part of the fuel base. Event-style: off by default, enabled per period.

### CIA-10 — Insurance value threshold validation ✅ NEW
- If declared value **> €500,000** (insured via DHL) or **> €1,000,000** (uninsured), flag "must notify DHL in advance" and route to approval.

---

# 5. Corrected Business Rules

1. **One mode = one pricing engine.** Express → SAR progressive band card (§2). Eco → US$ lane card. DG → DG card + DGD fees. Never share a card across modes.
2. **Zone is looked up, never inferred** from geography. Unmapped → exception.
3. **Chargeable weight** = MAX(actual, volumetric), volumetric = L×W×H ÷ divisor (5000 Express/DG-TDI, 4000 Eco-DDI), then **rounded up to next 0.5 kg**.
4. **Base freight = progressive sum** of per-0.5 kg increments across bands.
5. **Fuel last**, on the narrow base (freight + oversize + overweight + demand).
6. **Taxes/duties are never freight** (VAT 15% CIF, duty 5%/0% GCC) — separate bucket, into landed cost only.
7. **Everything date-effective & versioned**; rate card expires 2026-10-31; inflation>5% or volume-shortfall>20% triggers re-price.
8. **DHL re-weigh governs** the final bill; store adjusted weight + variance.

---

# 6. Corrected Calculation Logic

### 6.1 Volumetric & chargeable (✅ keep, + rounding)
```
volumetric_kg = (L_cm × W_cm × H_cm) / divisor        # 5000 Express/DG, 4000 Eco
chargeable_kg = MAX(actual_kg, volumetric_kg)
chargeable_kg = ROUND_UP_TO_0.5(chargeable_kg)        # ✅ NEW
```

### 6.2 Base freight — Express (⚠️ REWRITTEN, progressive per-0.5 kg)
```
BOUNDS      = [0.5, 5, 20, 50, 200, ∞]      # marginal upper bounds (kg)
RATE[0]     = first_0.5kg flat (e.g. Z5 = 176.06)
RATE[1..5]  = per-0.5kg band rates           (e.g. Z5 = 20.56,19.27,16.72,15.43,14.13)

W = chargeable_kg
if W <= 0.5:            base = RATE[0]
else:
    base = RATE[0]                            # first 0.5 kg flat
    prev = 0.5
    for i in 1..5:
        upper = BOUNDS[i]
        if W > prev:
            span_kg     = min(W, upper) - prev
            increments  = span_kg / 0.5
            base       += increments × RATE[i]
            prev        = upper
        if W <= upper: break
```

**Old formula:** `base = W × singleBandRate`
**New formula:** `base = RATE0 + Σ (span_kg/0.5 × RATEi)`
**Explanation:** each 0.5 kg above the first is charged at the rate of the band it lands in.
**Worked example (Z5, 250 kg):** 176.06 + 9×20.56 + 30×19.27 + 60×16.72 + 300×15.43 + 100×14.13 = **7,984.40 SAR** ✅ (matches Excel).
**Worked example (Z1, 18 kg):** 182.51 + 9×16.71 + 26×15.42 = **733.82 SAR** (V1 gave 277.56).

### 6.3 Base freight — Eco / Economy Select (✅ NEW engine)
```
lane = ets_lane(origin_city, dest, dg_flag)           # US$ card
break = highest weight-break ≤ chargeable_kg          # MIN,+45,+100,+300,+500,+1000
amount_usd = MAX(lane.minimum, chargeable_kg × lane.rate_at(break))   # fuel already included
```

### 6.4 Base freight — DG card (✅ NEW)
```
base = progressive_per_0.5kg(DG_CARD)  for ≤70 kg
     + (kg above 70) × DG_CARD.per_kg_over_70
fees = DGD_fee (SR1,100 ETS / USD350 ETS-US$) + ExceptedQty SR44 [+ DG check USD125/UN]
```

### 6.5 Surcharges (✅ keep mechanisms; ⚠️ fuel base; ✅ demand)
Mechanisms unchanged (per_shipment/piece/kg/kg_min/percent/percent_or_min). Priority order unchanged. **Fuel** now: `fuel% × (freight + oversize + overweight + demand)`.

### 6.6 Exclusions (✅ keep) & 6.7 Totals (✅ keep)
```
total_freight    = base_freight + Σ freight_surcharges (incl. fuel)
total_exclusions = VAT(15% × CIF) + duty + customs_handling + fines
total_landed     = total_freight + total_exclusions
```

---

# 7. Excel Validation Findings

- **Worksheet "Sheet1" purpose:** an approved single-shipment Express cost worksheet (250 kg, Zone 5).
- **Formula purpose (per row):** `amount = (kg_in_band ÷ 0.5) × zone_rate`; first row is flat first-0.5 kg; final row sums all bands.
- **Business purpose:** the finance-approved reference for how a quote must total.
- **Reproduced exactly** by the V2 engine: **7,984.40 SAR** ✅.
- **Mismatch vs V1:** V1 would compute `250 × 15.30` (placeholder Z5 200+ rate) ≈ 3,825 SAR — **52% under**. Even with correct rates but single-band, 7,065 SAR — still wrong. Only progressive + per-0.5 kg + real rates reproduce the truth.

---

# 8. Updated Blueprint V2 (delta over V1)
Sections **1–6, 8–18 and Appendices B/C of V1 remain valid** except where overridden here. The authoritative replacements are:
- **§6.7 `rate_cells`** → reseed with §2 card; add per-mode card type (`express_sar` | `ets_usd` | `dg_card`).
- **§7.4 Rate retrieval** → replace with §6.2 progressive algorithm.
- **Appendix (rate worked mapping)** → replace Zone-1 example numbers with §2 full card.
- **§7.5 fuel** → narrow base (§6.5).
- **New Appendix D** (below) — Economy Select & DG cards.
- **Zone data** → from customised DHL guide (§3 C-1).
Everything in V1 about architecture, RBAC, audit, versioning, exceptions, security remains the standard.

### Appendix D ✅ NEW — Economy Select (US$) & DG cards
- **ETS (US$), per kg, fuel-incl., liability US$100/shipment, insurance 2%:** lanes incl. JPN-NGO→JED (MIN 49…), USA-LAX→JED (MIN 895, +100 8.66, +300 6.92, +500 6.19, +1000 5.88), USA-CVG→JED (MIN 940, +100 10.46, +300 8.72, +500 7.99, +1000 7.70). DG lanes carry higher minimums + DG check USD125/UN + DGD USD350.
- **ETS DG (SAR/0.5 kg, Bahrain→Saudi):** 60 / 23 / 13 / 7 / 9 / 8 across bands to 70 kg; >70 kg = 11/kg; + DGD SR1,100 + Excepted Qty SR44.
- **Demurrage (Jeddah):** 0.50 SR/kg/day to customs yard; 0.40 SR/kg/day after day 4.

---

# 9. Website Modification Requirements

**Shipment Entry screen**
- ⚠️ Mode selector now drives **which rate card** (Express SAR / Eco US$ / DG). When Eco → require **origin city + lane**; when DG → require UN number(s) + DG type.
- ✅ Currency shown per mode (SAR vs US$).
- ✅ Declared-value alert at €500k/€1m thresholds.

**Rate screen**
- ⚠️ Show three card types; Express as the 7-zone × 6-band SAR grid with effective-to date; Eco as lane table; DG card + fees.

**Summary / Results screen**
- ⚠️ Base freight rendered as a **per-band breakdown** (each band's kg, increments, rate, amount) summing to base.
- ⚠️ Fuel line shows its **narrow base**.
- ✅ DGD/Excepted-Quantity fee lines for DG.

**Approval screen**
- ✅ New trigger: high declared value (insurance thresholds) and DG always route to approval.

---

# 10. Database Modification Requirements
- ⚠️ `rate_cells`: add `card_type` (`express_sar|ets_usd|dg_card`), `unit` (`per_0.5kg|per_kg|flat`), `currency`. Repopulate Express from §2.
- ✅ New `ets_lanes` (origin_city, movement, dest, dg_flag, minimum, break_45/100/300/500/1000, currency).
- ✅ New `dg_fees` (dgd_fee, excepted_qty_fee, dg_check_per_un, currency).
- ⚠️ `zones`: align to 7 billing zones; `zone_mapping` sourced from customised guide; keep `effective_from/to`.
- ✅ `surcharge_definitions`: add `DEMAND` (feeds fuel base); tag which codes are in the fuel base (`in_fuel_base bool`).
- ✅ `rate_versions.effective_to = 2026-10-31`; add reprice-trigger metadata (inflation/volume clauses).
- ✅ `shipments`: add `origin_city`, `ets_lane_id?`, `declared_value_ccy`.

---

# 11. API Modification Requirements
- `POST /shipments/preview` & `/shipments`: accept `originCity`, `dgUnNumbers[]`, return **per-band freight breakdown** array.
- Calculation service: split into `expressCard`, `etsCard`, `dgCard` strategies behind one `computeFreight(mode, ...)` contract.
- Validation service: zone-unmapped hard stop; declared-value threshold rule.
- Reference API: expose card_type, currency, effective-to.

---

# 12. Migration Plan
- **Phase 1 — Freight correctness (P0):** rewrite `computeFreight` (progressive, per-0.5 kg, rounding); replace `RATE_GRID` with §2; reseed; golden-master test = 7,984.40. *No schema break.*
- **Phase 2 — Zones (P0):** load customised country→zone(1–7) guide; unmapped hard-stop; backfill `zone_mapping`.
- **Phase 3 — Modes (P1):** add ETS US$ lane engine + DG card/fees; mode-driven card selection; currency on UI.
- **Phase 4 — Fuel/Demand/Value & versioning (P1):** narrow fuel base, add Demand, declared-value alerts, rate-expiry/reprice metadata, re-quote historical via versions.

---

# 13. QA Test Cases

| ID | Input | Expected | Reason / failure to watch |
|----|-------|----------|---------------------------|
| **TC-001** | Express, Z5, 250 kg | Freight **7,984.40 SAR** | Golden master (Excel). Fails if single-band or per-kg. |
| **TC-002** | Express, Z1, 18 kg | **733.82 SAR** | Progressive 3-band. V1 gave 277.56. |
| **TC-003** | Express, Z5, 0.3 kg | **176.06 SAR** | ≤0.5 kg → flat first-half only. |
| **TC-004** | Express, Z3, 12 kg | **687.55 SAR** | Crosses 1st/1-5/5.5-20 bands. |
| **TC-005** | Express, Z1, 75 kg | **2,222.30 SAR** | Spans 5 bands incl. 50-200. |
| **TC-006** | Express, Z5, 17.3 kg | charge **17.5 kg** → **842.85 SAR** | Round-up-to-0.5 rule. Fails if raw kg used. |
| **TC-007** | actual 12 kg, vol 18 kg, Z1 | chargeable **18 kg** → 733.82 | MAX(actual,vol). |
| **TC-008** | Z5 250 kg + 1 oversize pc, fuel 27.5% | fuel = 27.5% × (7984.40 + 88) = **2,219.92** | Fuel narrow base incl. oversize, excl. customs. |
| **TC-009** | Z5 250 kg + clearance auth 50, fuel 27.5% | fuel base **excludes** the 50 | Fuel must ignore customs/optional. |
| **TC-010** | Eco, USA-LAX→JED, 600 kg | US$ MAX(895, 600×6.19=3,714) = **US$3,714** | ETS lane engine, US$, +500 break, fuel-incl. |
| **TC-011** | DG, Bahrain→JED, 40 kg | DG card sum + **SR1,100 DGD + SR44** | DG card + mandatory fees. |
| **TC-012** | Unmapped origin country | **Hard-stop exception** | Never guess a zone. |
| **TC-013** | declared value €600k insured | route to approval + "notify DHL" | Insurance threshold. |
| **TC-014** | VAT on TC-001 (goods 50,000) | VAT 15% × (50,000 + freight + ins) | CIF basis, separate line. |

---

# 14. Regression Testing Checklist
- ❗ **Every existing saved Express quote will change** (rise 40–65%). Re-quote all open shipments; archive old totals under V1 rate version for audit.
- ❗ Dashboard KPIs (total freight, freight-by-mode) shift upward — expected, not a bug.
- ❗ Eco shipments previously priced on the SAR grid are invalid — re-price on ETS card.
- ❗ DG shipments missing DGD/Excepted-Qty fees — recompute.
- ❗ Fuel amounts drop slightly where customs/optional surcharges existed (narrower base).
- ❗ Any test asserting old `W × bandRate` numbers must be rewritten to the §13 golden masters.
- ❗ Approval queue grows (DG + high-value now always route).
- Screens: Results (per-band table), Rate (3 card types), Entry (origin city/UN), Approvals (new triggers).
- APIs: preview/create payload + response shape changed (breakdown array, originCity).

---

# 15. Final Recommendations
1. **Ship Phase 1 immediately** — the freight rewrite is the single highest-value fix; it is self-contained and validated against the 7,984.40 golden master.
2. **Get the customised DHL zone guide** before trusting any zone in production (Conflict C-1). Until then, hard-stop unmapped countries.
3. **Confirm two rules with DHL in writing:** (a) round-up-to-0.5 kg, (b) the exact fuel base composition. Both are coded as config strategies so a change is data, not a release.
4. **Treat Eco and DG as first-class cards**, not Express variants — they are different currencies and structures.
5. **Version and date-effect everything**; the Express card expires 2026-10-31 and has inflation/volume reprice clauses — wire expiry alerts now.
6. **Keep the V1 wins:** divisors, MAX-chargeable, VAT/duty separation, surcharge catalogue, audit/versioning architecture — they were correct.
```
```
