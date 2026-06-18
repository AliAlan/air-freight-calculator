/**
 * data.js — Reference datasets for the Air Freight Cost Calculator.
 *
 * KSA import model (DHL Express, SAR):
 *   - Zone resolved from ORIGIN country
 *   - All Appendix A surcharges included (45 total)
 *   - Surcharge conditions: ALWAYS | DANGEROUS_GOODS | DG_SUBTYPE | REMOTE_ORIGIN
 *     | RISK_ORIGIN | RESTRICTED_DEST | OVERWEIGHT_PIECES | OVERSIZE_PIECES
 *     | NON_CONVEYABLE_WEIGHT | NON_CONVEYABLE_IRR | NON_STACKABLE | OPTIONAL | FUEL | EVENT
 *   - EVENT surcharges are active:false (added manually post-event, not auto-calculated)
 */

// ---------------------------------------------------------------------------
// 1. ZONES
// ---------------------------------------------------------------------------
const ZONES = [
  { code: 'Z1', name: 'GCC / Gulf',                  factor: 1.0  },
  { code: 'Z2', name: 'Near Middle East & N. Africa', factor: 1.1  },
  { code: 'Z3', name: 'Western Europe',              factor: 1.25 },
  { code: 'Z4', name: 'North America',               factor: 1.4  },
  { code: 'Z5', name: 'Asia Pacific',                factor: 1.55 },
  { code: 'Z6', name: 'Southern Hemisphere',         factor: 1.75 },
  { code: 'Z7', name: 'Remote / Rest of World',      factor: 1.95 },
];

// ---------------------------------------------------------------------------
// 2. COUNTRIES
//    remote   = remote area pickup/delivery surcharge applies
//    risk     = elevated risk surcharge applies
//    gcc      = GCC-origin (customs-duty exempt with proof of origin)
//    restricted = restricted destination (UN Security Council)
// ---------------------------------------------------------------------------
const COUNTRIES = [
  { code: 'BH', name: 'Bahrain',              zone: 'Z1', gcc: true,  remote: false, risk: false, restricted: false },
  { code: 'KW', name: 'Kuwait',               zone: 'Z1', gcc: true,  remote: false, risk: false, restricted: false },
  { code: 'QA', name: 'Qatar',                zone: 'Z1', gcc: true,  remote: false, risk: false, restricted: false },
  { code: 'AE', name: 'United Arab Emirates', zone: 'Z1', gcc: true,  remote: false, risk: false, restricted: false },
  { code: 'OM', name: 'Oman',                 zone: 'Z1', gcc: true,  remote: false, risk: false, restricted: false },
  { code: 'SA', name: 'Saudi Arabia',         zone: 'Z1', gcc: true,  remote: false, risk: false, restricted: false },
  { code: 'JO', name: 'Jordan',               zone: 'Z2', gcc: false, remote: false, risk: false, restricted: false },
  { code: 'EG', name: 'Egypt',                zone: 'Z2', gcc: false, remote: false, risk: false, restricted: false },
  { code: 'TR', name: 'Turkey',               zone: 'Z2', gcc: false, remote: false, risk: false, restricted: false },
  { code: 'LB', name: 'Lebanon',              zone: 'Z2', gcc: false, remote: false, risk: true,  restricted: false },
  { code: 'DE', name: 'Germany',              zone: 'Z3', gcc: false, remote: false, risk: false, restricted: false },
  { code: 'FR', name: 'France',               zone: 'Z3', gcc: false, remote: false, risk: false, restricted: false },
  { code: 'GB', name: 'United Kingdom',       zone: 'Z3', gcc: false, remote: false, risk: false, restricted: false },
  { code: 'IT', name: 'Italy',                zone: 'Z3', gcc: false, remote: false, risk: false, restricted: false },
  { code: 'NL', name: 'Netherlands',          zone: 'Z3', gcc: false, remote: false, risk: false, restricted: false },
  { code: 'ES', name: 'Spain',                zone: 'Z3', gcc: false, remote: false, risk: false, restricted: false },
  { code: 'US', name: 'United States',        zone: 'Z4', gcc: false, remote: false, risk: false, restricted: false },
  { code: 'CA', name: 'Canada',               zone: 'Z4', gcc: false, remote: false, risk: false, restricted: false },
  { code: 'CN', name: 'China',                zone: 'Z5', gcc: false, remote: false, risk: false, restricted: false },
  { code: 'IN', name: 'India',                zone: 'Z5', gcc: false, remote: false, risk: false, restricted: false },
  { code: 'JP', name: 'Japan',                zone: 'Z5', gcc: false, remote: false, risk: false, restricted: false },
  { code: 'KR', name: 'South Korea',          zone: 'Z5', gcc: false, remote: false, risk: false, restricted: false },
  { code: 'SG', name: 'Singapore',            zone: 'Z5', gcc: false, remote: false, risk: false, restricted: false },
  { code: 'BR', name: 'Brazil',               zone: 'Z6', gcc: false, remote: true,  risk: false, restricted: false },
  { code: 'ZA', name: 'South Africa',         zone: 'Z6', gcc: false, remote: false, risk: false, restricted: false },
  { code: 'AU', name: 'Australia',            zone: 'Z6', gcc: false, remote: true,  risk: false, restricted: false },
  { code: 'NG', name: 'Nigeria',              zone: 'Z7', gcc: false, remote: true,  risk: true,  restricted: false },
  { code: 'KZ', name: 'Kazakhstan',           zone: 'Z7', gcc: false, remote: true,  risk: false, restricted: false },
];

// ---------------------------------------------------------------------------
// 3. SERVICE MODES (volumetric divisor is per-mode, not global)
// ---------------------------------------------------------------------------
const MODES = [
  { code: 'Express',        name: 'Express (TDI)',          divisor: 5000 },
  { code: 'Eco',            name: 'Eco (DDI)',              divisor: 4000 },
  { code: 'DangerousGoods', name: 'Dangerous Goods (TDI)', divisor: 5000 },
];

// ---------------------------------------------------------------------------
// 4. RATE GRID — DHL Import Express Worldwide Rates (SAR), Zone 1–7
//
//    GROUND TRUTH: "DHL Rates Modeling .docx" + "Express Calculator logic.xlsx".
//    Validated: 250 kg Zone 5 = 7,984.40 SAR (matches the approved Excel).
//
//    Pricing model (Blueprint V2):
//      • firstHalf = flat charge for the first 0.5 kg.
//      • perHalfKg = rate per EACH additional 0.5 kg, within each marginal band
//        (progressive — like tax brackets). `upTo` = band cumulative upper
//        bound (kg); null = open "200 kg +".
//      • "Incremental rates are accounted for every additional 0.5 kg."
//    Valid till 31 Oct 2026; adjusted yearly.
// ---------------------------------------------------------------------------
const RATE_GRID = {
  Z1: { firstHalf: 182.51, perHalfKg: [{ upTo: 5, rate: 16.71 }, { upTo: 20, rate: 15.42 }, { upTo: 50, rate: 14.13 }, { upTo: 200, rate: 11.58 }, { upTo: null, rate: 10.29 }] },
  Z2: { firstHalf: 214.65, perHalfKg: [{ upTo: 5, rate: 21.21 }, { upTo: 20, rate: 17.22 }, { upTo: 50, rate: 15.89 }, { upTo: 200, rate: 14.56 }, { upTo: null, rate: 11.93 }] },
  Z3: { firstHalf: 218.62, perHalfKg: [{ upTo: 5, rate: 21.21 }, { upTo: 20, rate: 19.86 }, { upTo: 50, rate: 17.23 }, { upTo: 200, rate: 15.89 }, { upTo: null, rate: 14.56 }] },
  Z4: { firstHalf: 181.39, perHalfKg: [{ upTo: 5, rate: 16.73 }, { upTo: 20, rate: 16.73 }, { upTo: 50, rate: 14.15 }, { upTo: 200, rate: 14.15 }, { upTo: null, rate: 14.15 }] },
  Z5: { firstHalf: 176.06, perHalfKg: [{ upTo: 5, rate: 20.56 }, { upTo: 20, rate: 19.27 }, { upTo: 50, rate: 16.72 }, { upTo: 200, rate: 15.43 }, { upTo: null, rate: 14.13 }] },
  Z6: { firstHalf: 268.99, perHalfKg: [{ upTo: 5, rate: 34.46 }, { upTo: 20, rate: 30.48 }, { upTo: 50, rate: 27.83 }, { upTo: 200, rate: 25.18 }, { upTo: null, rate: 23.85 }] },
  Z7: { firstHalf: 296.90, perHalfKg: [{ upTo: 5, rate: 52.69 }, { upTo: 20, rate: 48.83 }, { upTo: 50, rate: 45.00 }, { upTo: 200, rate: 42.40 }, { upTo: null, rate: 39.83 }] },
};

// Flat bracket list for DB seeding / Reference screen. `perKg` here is the
// per-0.5kg incremental rate (the unit the published card uses).
const RATE_BRACKETS = [
  { minKg: 0,   maxKg: 0.5,   perKg: 0,     minCharge: 182.51 },
  { minKg: 0.5, maxKg: 5,     perKg: 16.71, minCharge: 0 },
  { minKg: 5,   maxKg: 20,    perKg: 15.42, minCharge: 0 },
  { minKg: 20,  maxKg: 50,    perKg: 14.13, minCharge: 0 },
  { minKg: 50,  maxKg: 200,   perKg: 11.58, minCharge: 0 },
  { minKg: 200, maxKg: 99999, perKg: 10.29, minCharge: 0 },
];

// ---------------------------------------------------------------------------
// 5. SURCHARGES — Appendix A (DHL KSA, SAR), all 45 surcharges
//
//  Fields:
//    code         — unique identifier
//    name         — display name
//    type         — FLAT | PER_KG | PER_KG_MIN | PER_PIECE | PERCENT | PERCENT_OR_MIN
//    value        — base value (SAR); for PERCENT_OR_MIN: the fallback minimum
//    percent      — percentage rate (for PERCENT and PERCENT_OR_MIN types)
//    min          — minimum amount for PER_KG_MIN and PERCENT_OR_MIN
//    condition    — when to fire (see calculator.js)
//    dgSubtype    — for DG_SUBTYPE condition: which user-selected DG type
//    priority     — evaluation order (lower = earlier); FUEL must be last
//    excludes     — codes to suppress on the same piece when this fires
//    forcesApproval — true → shipment → PENDING regardless of cost threshold
//    active       — false → stored in DB for reference but never calculated
// ---------------------------------------------------------------------------
const SURCHARGES = [

  // ── Priority 5: Overweight piece (>70 kg/piece) ─────────────────────────
  // Blueprint: 418 SAR/piece international; excludes OVERSIZE, NONCONV_WT, NONCONV_IRR
  { code: 'OVERWEIGHT',      name: 'Overweight Piece',            type: 'PER_PIECE',     value: 418,    condition: 'OVERWEIGHT_PIECES',    priority: 5,  excludes: ['OVERSIZE', 'NONCONV_WT', 'NONCONV_IRR'], forcesApproval: false, active: true },

  // ── Priority 10: Oversize piece (longest >100cm or 2nd >80cm) ───────────
  // Blueprint: 88 SAR/piece international; excludes NONCONV_WT, NONCONV_IRR
  { code: 'OVERSIZE',        name: 'Oversized Piece',             type: 'PER_PIECE',     value: 88,     condition: 'OVERSIZE_PIECES',      priority: 10, excludes: ['NONCONV_WT', 'NONCONV_IRR'],             forcesApproval: false, active: true },

  // ── Priority 15: Non-stackable pallet (user declares ≥25kg pallet) ──────
  // Blueprint: 1320 SAR/piece international
  { code: 'NONSTACK',        name: 'Non-Stackable Pallet',        type: 'PER_PIECE',     value: 1320,   condition: 'NON_STACKABLE',        priority: 15, excludes: [],                                        forcesApproval: false, active: true },

  // ── Priority 20: Non-conveyable by weight (25–70 kg, auto) ──────────────
  // Blueprint: 88 SAR/piece international; excluded if piece already OVERWEIGHT or OVERSIZE
  { code: 'NONCONV_WT',      name: 'Non-Conveyable (weight)',     type: 'PER_PIECE',     value: 88,     condition: 'NON_CONVEYABLE_WEIGHT', priority: 20, excludes: [],                                       forcesApproval: false, active: true },

  // ── Priority 25: Non-conveyable irregular (user flags irregular shape) ───
  // Blueprint: 80.50 SAR/piece international; excluded if OVERWEIGHT or OVERSIZE
  { code: 'NONCONV_IRR',     name: 'Non-Conveyable (irregular)',  type: 'PER_PIECE',     value: 80.50,  condition: 'NON_CONVEYABLE_IRR',   priority: 25, excludes: [],                                        forcesApproval: false, active: true },

  // ── Priority 30: DG — Full dangerous goods (IATA class 2,3,4,5,6,8,9) ──
  // Blueprint: 440 SAR flat; forces manual approval
  { code: 'FULL_DG',         name: 'Full Dangerous Goods',        type: 'FLAT',          value: 440,    condition: 'DANGEROUS_GOODS',      priority: 30, excludes: [],                                        forcesApproval: true,  active: true },

  // ── Priority 31-37: DG sub-types (user selects exactly one) ─────────────
  // These are mutually exclusive with each other and with FULL_DG;
  // the user sets dgSubtype = one of these codes; only that row fires.
  { code: 'DRY_ICE',         name: 'Dry Ice (UN1845)',            type: 'FLAT',          value: 52.80,  condition: 'DG_SUBTYPE', dgSubtype: 'DRY_ICE',         priority: 31, excludes: [], forcesApproval: false, active: true },
  { code: 'LI_ION_966',      name: 'Lithium Ion PI966',           type: 'FLAT',          value: 22,     condition: 'DG_SUBTYPE', dgSubtype: 'LI_ION_966',      priority: 32, excludes: [], forcesApproval: false, active: true },
  { code: 'LI_METAL_969',    name: 'Lithium Metal PI969',         type: 'FLAT',          value: 22,     condition: 'DG_SUBTYPE', dgSubtype: 'LI_METAL_969',    priority: 33, excludes: [], forcesApproval: false, active: true },
  { code: 'EXC_QTY',         name: 'Excepted Quantities',         type: 'FLAT',          value: 44,     condition: 'DG_SUBTYPE', dgSubtype: 'EXC_QTY',         priority: 34, excludes: [], forcesApproval: false, active: true },
  { code: 'LTD_QTY',         name: 'Limited Quantities',          type: 'FLAT',          value: 110,    condition: 'DG_SUBTYPE', dgSubtype: 'LTD_QTY',         priority: 35, excludes: [], forcesApproval: false, active: true },
  { code: 'CONS_COMM',       name: 'Consumer Commodity ID8000',   type: 'FLAT',          value: 110,    condition: 'DG_SUBTYPE', dgSubtype: 'CONS_COMM',       priority: 36, excludes: [], forcesApproval: false, active: true },
  { code: 'ADR_LOAD_EXEMPT', name: 'ADR Load Exemptions',         type: 'FLAT',          value: 22,     condition: 'DG_SUBTYPE', dgSubtype: 'ADR_LOAD_EXEMPT', priority: 37, excludes: [], forcesApproval: false, active: true },

  // ── Priority 40: Security (always — DHL KSA standard) ───────────────────
  { code: 'SECURITY',        name: 'Security Surcharge',          type: 'PER_KG',        value: 0.30,   condition: 'ALWAYS',               priority: 40, excludes: [],                                        forcesApproval: false, active: true },

  // ── Priority 50: Remote area (auto from country flag) ───────────────────
  // REMOTE_DEL: international, origin in remote area
  // REMOTE_PU:  domestic only (active:false for our international model)
  { code: 'REMOTE_DEL',      name: 'Remote Area Delivery',        type: 'PER_KG_MIN',    value: 2.20,   min: 105.60, condition: 'REMOTE_ORIGIN',       priority: 50, excludes: [],                             forcesApproval: false, active: true  },
  { code: 'REMOTE_PU',       name: 'Remote Area Pickup',          type: 'PER_KG_MIN',    value: 1.10,   min: 52.80,  condition: 'REMOTE_PICKUP',       priority: 51, excludes: [],                             forcesApproval: false, active: false },

  // ── Priority 55: Risk / restricted destinations ──────────────────────────
  { code: 'ELEV_RISK',       name: 'Elevated Risk',               type: 'FLAT',          value: 132,    condition: 'RISK_ORIGIN',          priority: 55, excludes: [],                                        forcesApproval: false, active: true },
  { code: 'RESTR_DEST',      name: 'Restricted Destination',      type: 'FLAT',          value: 132,    condition: 'RESTRICTED_DEST',      priority: 56, excludes: [],                                        forcesApproval: true,  active: true },

  // ── Priority 60–89: Optional services (user ticks in the UI) ─────────────
  // Delivery options
  { code: 'SAT_DEL',         name: 'Saturday Delivery',           type: 'FLAT',          value: 176,    condition: 'OPTIONAL', priority: 60, excludes: [], forcesApproval: false, active: true },
  { code: 'DED_DEL',         name: 'Dedicated Delivery',          type: 'PER_KG_MIN',    value: 2.20,   min: 180,    condition: 'OPTIONAL', priority: 61, excludes: [], forcesApproval: false, active: true },
  { code: 'DEL_SIG',         name: 'Delivery Signature',          type: 'FLAT',          value: 25,     condition: 'OPTIONAL', priority: 62, excludes: [], forcesApproval: false, active: true },
  { code: 'DIRECT_SIG',      name: 'Direct Signature',            type: 'FLAT',          value: 25,     condition: 'OPTIONAL', priority: 63, excludes: [], forcesApproval: false, active: true },
  { code: 'VERBAL_NOTIF',    name: 'Verbal Delivery Notification', type: 'FLAT',         value: 25,     condition: 'OPTIONAL', priority: 64, excludes: [], forcesApproval: false, active: true },
  { code: 'RES_ADDR',        name: 'Residential Address',         type: 'FLAT',          value: 22,     condition: 'OPTIONAL', priority: 65, excludes: [], forcesApproval: false, active: true },
  // Pickup options
  { code: 'SAT_PU',          name: 'Saturday Pickup',             type: 'FLAT',          value: 132,    condition: 'OPTIONAL', priority: 66, excludes: [], forcesApproval: false, active: true },
  { code: 'DED_PU',          name: 'Dedicated Pickup',            type: 'PER_KG_MIN',    value: 2.20,   min: 132,    condition: 'OPTIONAL', priority: 67, excludes: [], forcesApproval: false, active: true },
  // Customs options
  { code: 'CLEAR_AUTH',      name: 'Clearance Authorization',     type: 'FLAT',          value: 50,     condition: 'OPTIONAL', priority: 68, excludes: [], forcesApproval: false, active: true },
  { code: 'REL_BROKER',      name: 'Release to Broker',           type: 'FLAT',          value: 200,    condition: 'OPTIONAL', priority: 69, excludes: [], forcesApproval: false, active: true },
  { code: 'BROKER_NOTIF',    name: 'Broker Notification',         type: 'FLAT',          value: 52.80,  condition: 'OPTIONAL', priority: 70, excludes: [], forcesApproval: false, active: true },
  { code: 'IOR',             name: 'Importer of Record',          type: 'FLAT',          value: 80,     condition: 'OPTIONAL', priority: 71, excludes: [], forcesApproval: false, active: true },
  { code: 'PERMITS_LIC',     name: 'Permits & Licences',          type: 'FLAT',          value: 198,    condition: 'OPTIONAL', priority: 72, excludes: [], forcesApproval: false, active: true },
  // Duty/tax payment options (percent_or_min: max(2% × declared, min))
  { code: 'DUTY_TAX_PAID',   name: 'Duty Tax Paid',               type: 'PERCENT_OR_MIN', value: 0, percent: 2, min: 100, condition: 'OPTIONAL', priority: 73, excludes: [], forcesApproval: false, active: true },
  { code: 'DUTY_TAX_PROC',   name: 'Duty Tax Processing',         type: 'PERCENT_OR_MIN', value: 0, percent: 2, min: 110, condition: 'OPTIONAL', priority: 74, excludes: [], forcesApproval: false, active: true },
  // Origin documentation
  { code: 'PREF_ORIGIN',     name: 'Preferential Origin',         type: 'FLAT',          value: 44,     condition: 'OPTIONAL', priority: 75, excludes: [], forcesApproval: false, active: true },
  { code: 'EXPORT_DECL',     name: 'Export Declaration',          type: 'FLAT',          value: 44,     condition: 'OPTIONAL', priority: 76, excludes: [], forcesApproval: false, active: true },
  // Insurance (percent_or_min: max(2% × declared, min))
  { code: 'SHIP_INS',        name: 'Shipment Insurance',          type: 'PERCENT_OR_MIN', value: 0, percent: 2, min: 75, condition: 'OPTIONAL', priority: 77, excludes: [], forcesApproval: false, active: true },
  { code: 'EXT_LIAB',        name: 'Extended Liability',          type: 'FLAT',          value: 40,     condition: 'OPTIONAL', priority: 78, excludes: [], forcesApproval: false, active: true },
  // Misc optional services
  { code: 'TEMP_IMP_EXP',    name: 'Temporary Import/Export',     type: 'FLAT',          value: 200,    condition: 'OPTIONAL', priority: 79, excludes: [], forcesApproval: false, active: true },
  { code: 'NEUTRAL_DEL',     name: 'Neutral Delivery',            type: 'FLAT',          value: 22,     condition: 'OPTIONAL', priority: 80, excludes: [], forcesApproval: false, active: true },
  { code: 'SHIP_PREP',       name: 'Shipment Preparation',        type: 'FLAT',          value: 110,    condition: 'OPTIONAL', priority: 81, excludes: [], forcesApproval: false, active: true },
  { code: 'PKG_ITEM',        name: 'Packaging Item',              type: 'FLAT',          value: 15,     condition: 'OPTIONAL', priority: 82, excludes: [], forcesApproval: false, active: true },
  // Environmental
  { code: 'GOGREEN',         name: 'GoGreen Plus (CO2 reduced)',  type: 'PER_KG',        value: 0.69,   condition: 'OPTIONAL', priority: 83, excludes: [], forcesApproval: false, active: true },

  // ── Priority 90: FUEL (percentage; always last — applied to all freight charges above) ──
  // Blueprint: DHL monthly jet-fuel index, currently 27.5%
  { code: 'FUEL',            name: 'Fuel Surcharge',              type: 'PERCENT',       value: 27.5,   condition: 'FUEL',                 priority: 90, excludes: [],                                        forcesApproval: false, active: true },

  // ── Priority 99: Event-based (active:false — not auto-calculated; added manually) ──
  { code: 'ADDR_CORR',       name: 'Address Correction',          type: 'FLAT',          value: 49,     condition: 'EVENT', priority: 99, excludes: [], forcesApproval: false, active: false },
  { code: 'DATA_ENTRY',      name: 'Data Entry',                  type: 'FLAT',          value: 44,     condition: 'EVENT', priority: 99, excludes: [], forcesApproval: false, active: false },
  { code: 'BONDED_STOR',     name: 'Bonded Storage (per day)',    type: 'FLAT',          value: 48.40,  condition: 'EVENT', priority: 99, excludes: [], forcesApproval: false, active: false },
  { code: 'MULTILINE',       name: 'Multiline Entry (per line)',  type: 'FLAT',          value: 10,     condition: 'EVENT', priority: 99, excludes: [], forcesApproval: false, active: false },
  { code: 'CHG_BILLING',     name: 'Change of Billing',           type: 'FLAT',          value: 52.80,  condition: 'EVENT', priority: 99, excludes: [], forcesApproval: false, active: false },
  { code: 'POST_CLEAR_MOD',  name: 'Post Clearance Modification', type: 'FLAT',          value: 352,    condition: 'EVENT', priority: 99, excludes: [], forcesApproval: false, active: false },
  { code: 'PHYS_INTERV',     name: 'Physical Intervention',       type: 'FLAT',          value: 90,     condition: 'EVENT', priority: 99, excludes: [], forcesApproval: false, active: false },
];

// ---------------------------------------------------------------------------
// 6. TAX / EXCLUSIONS — NOT freight; shown separately (Appendix C)
// ---------------------------------------------------------------------------
const TAX = { vatPercent: 15, dutyPercent: 5, gccDutyExempt: true };

const EXCLUSIONS = [
  { code: 'DUTY', name: 'Customs Duty' },
  { code: 'VAT',  name: 'Import VAT'  },
];

// ---------------------------------------------------------------------------
// 7. CURRENCIES
// ---------------------------------------------------------------------------
const CURRENCIES = [
  { code: 'SAR', name: 'Saudi Riyal', rate: 1.0,   symbol: 'SAR' },
  { code: 'USD', name: 'US Dollar',   rate: 0.267, symbol: '$'   },
  { code: 'AED', name: 'UAE Dirham',  rate: 0.979, symbol: 'AED' },
];

// ---------------------------------------------------------------------------
// 8. BUSINESS RULES
// ---------------------------------------------------------------------------
const RULES = {
  oversizeLongestCm:    100,   // longest edge > this → oversized
  oversizeSecondCm:     80,    // 2nd-longest edge > this → oversized
  overweightKg:         70,    // single piece > this → overweight (per piece)
  nonConveyableMinKg:   25,    // piece ≥ this kg triggers NONCONV_WT (if not OW/OS)
  maxLongestCm:         300,   // beyond DHL handling → exception / split shipment
  maxPieceWeightKg:     300,   // beyond DHL handling → exception / split shipment
  approvalThreshold:    1500,  // landed cost ≥ this (SAR) → manual approval
  currency:             'SAR',
};

// DG sub-type options (shown in the UI when DG mode is selected)
const DG_SUBTYPES = [
  { code: 'FULL_DG',         name: 'Full DG (IATA class 2/3/4/5/6/8/9)' },
  { code: 'DRY_ICE',         name: 'Dry Ice (UN1845)'                    },
  { code: 'LI_ION_966',      name: 'Lithium Ion – PI966 Sec II'          },
  { code: 'LI_METAL_969',    name: 'Lithium Metal – PI969 Sec II'        },
  { code: 'EXC_QTY',         name: 'Excepted Quantities'                 },
  { code: 'LTD_QTY',         name: 'Limited Quantities (ADR ≤30kg)'      },
  { code: 'CONS_COMM',       name: 'Consumer Commodity (ID8000)'         },
  { code: 'ADR_LOAD_EXEMPT', name: 'ADR Load Exemptions (1.1.3.6)'       },
];

module.exports = {
  ZONES, COUNTRIES, MODES, RATE_GRID, RATE_BRACKETS,
  SURCHARGES, TAX, EXCLUSIONS, CURRENCIES, RULES, DG_SUBTYPES,
};
