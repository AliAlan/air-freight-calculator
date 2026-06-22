/**
 * demoShipments.js — Deterministically generates ~50 realistic demo shipments
 * for seeding. Each entry is { ref, input, status, daysAgo } where `input`
 * is the exact calculation input (so the shipment is fully editable) and
 * `status`/`daysAgo` drive the dashboard picture (status mix + trend over time).
 *
 * Deterministic (fixed PRNG seed) so re-seeding produces a stable dataset.
 */

// mulberry32 PRNG — small, fast, deterministic.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260622);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const ri = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const rf = (min, max, d = 1) => +(rand() * (max - min) + min).toFixed(d);

// Origin countries (all exist in data.js COUNTRIES), weighted toward common lanes.
const ORIGINS = [
  'CN', 'CN', 'CN', 'DE', 'DE', 'DE', 'US', 'US', 'JP', 'JP',
  'IN', 'IN', 'GB', 'IT', 'FR', 'NL', 'ES', 'KR', 'SG', 'AE',
  'TR', 'BH', 'QA', 'AU', 'BR', 'ZA', 'PK', 'VN', 'ID', 'MO',
  'DK', 'LU', 'PT', 'CA', 'EG',
];
const MODES = ['Express', 'Express', 'Express', 'Eco', 'Eco', 'DangerousGoods'];
const DG_SUBTYPES = ['DRY_ICE', 'LI_ION_966', 'LI_METAL_969', 'EXC_QTY', 'LTD_QTY', 'CONS_COMM', 'FULL_DG'];
const OPTIONALS = ['SHIP_INS', 'SAT_DEL', 'DEL_SIG', 'DED_DEL', 'RES_ADDR', 'CLEAR_AUTH', 'IOR', 'EXPORT_DECL', 'GOGREEN', 'SHIP_PREP', 'PKG_ITEM'];

// Deterministic Fisher–Yates shuffle.
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const COUNT = 50;

// Status mix → a clear dashboard (approved sum, pending queue, drafts, rejects).
const statusMix = shuffle([
  ...Array(20).fill('APPROVED'),
  ...Array(9).fill('PENDING'),
  ...Array(13).fill('DRAFT'),
  ...Array(8).fill('REJECTED'),
]);

const out = [];
for (let i = 0; i < COUNT; i += 1) {
  const mode = pick(MODES);
  const isDG = mode === 'DangerousGoods';

  // 1–4 pieces; occasionally heavy (overweight) or long (oversize) for variety.
  const pieceCount = ri(1, 4);
  const items = [];
  for (let p = 0; p < pieceCount; p += 1) {
    const heavy = rand() < 0.18;     // ~18% pieces are 70–95 kg (overweight surcharge)
    const long = rand() < 0.15;      // ~15% pieces have a >100cm edge (oversize)
    items.push({
      quantity: ri(1, 3),
      lengthCm: long ? ri(101, 110) : ri(25, 95),
      widthCm: ri(20, 70),
      heightCm: ri(15, 70),
      weightKg: heavy ? rf(70, 95) : rf(3, 60),
    });
  }

  // Occasional optional services / pallet flags.
  const selectedSurcharges = [];
  if (rand() < 0.45) selectedSurcharges.push(pick(OPTIONALS));
  if (rand() < 0.15) selectedSurcharges.push(pick(OPTIONALS));

  const input = {
    originCountry: pick(ORIGINS),
    destinationCountry: 'SA',
    mode,
    dangerousGoods: isDG,
    dgSubtype: isDG ? pick(DG_SUBTYPES) : null,
    declaredValue: ri(800, 75000),
    currency: 'SAR',
    selectedSurcharges: [...new Set(selectedSurcharges)],
    nonConveyableIrregular: rand() < 0.1,
    nonStackable: rand() < 0.08,
    items,
  };

  out.push({
    ref: `AF-${1001 + i}`,
    input,
    status: statusMix[i],
    daysAgo: ri(0, 78),       // spread over ~11 weeks for the trend chart
  });
}

module.exports = out;
