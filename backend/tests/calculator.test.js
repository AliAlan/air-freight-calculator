/**
 * Engine unit tests (KSA import model, SAR). Pure functions, no DB needed.
 * Run: npm test
 */
const {
  computeWeights, resolveZone, computeFreight, computeSurcharges,
  computeExclusions, calculateQuote, round,
} = require('../src/engine/calculator');
const scenarios = require('../src/engine/scenarios');

const byRef = (r) => scenarios.find((s) => s.ref === r);

describe('Weight calculations', () => {
  test('volumetric uses (LxWxH)/divisor, Express divisor = 5000', () => {
    const w = computeWeights([{ quantity: 1, lengthCm: 60, widthCm: 40, heightCm: 50, weightKg: 18 }], 'Express');
    expect(w.divisor).toBe(5000);
    expect(w.volumetricWeight).toBe(24);          // 120000 / 5000
    expect(w.chargeableWeight).toBe(24);          // max(18, 24)
    expect(w.chargeableBasis).toBe('VOLUMETRIC');
  });

  test('Eco mode uses divisor 4000', () => {
    const w = computeWeights([{ quantity: 1, lengthCm: 50, widthCm: 40, heightCm: 30, weightKg: 9 }], 'Eco');
    expect(w.divisor).toBe(4000);
    expect(w.volumetricWeight).toBe(15);          // 60000 / 4000
  });

  test('actual weight wins when heavier than volumetric', () => {
    const w = computeWeights([{ quantity: 1, lengthCm: 40, widthCm: 30, heightCm: 30, weightKg: 22 }], 'Express');
    expect(w.volumetricWeight).toBe(7.2);
    expect(w.chargeableWeight).toBe(22);
    expect(w.chargeableBasis).toBe('ACTUAL');
  });

  test('multi-piece chargeable weight aggregates per piece (full precision)', () => {
    const w = computeWeights(byRef('AF-1005').items, 'Eco');
    expect(w.chargeableWeight).toBe(58.78);       // 15 + 30 + 13.78125 -> 58.78
    expect(round(w.chargeableExact)).toBe(58.78);
  });
});

describe('Zone resolution (from ORIGIN)', () => {
  test('Germany resolves to Zone 3', () => {
    expect(resolveZone('DE').zoneCode).toBe('Z3');
  });
  test('GCC origin (Bahrain) resolves to Zone 1 and is duty-exempt', () => {
    const z = resolveZone('BH');
    expect(z.zoneCode).toBe('Z1');
    expect(z.country.gcc).toBe(true);
  });
});

describe('Freight (rate grid)', () => {
  test('24 kg in Zone 3 uses the 20-50 band (17.10/kg)', () => {
    const f = computeFreight({ chargeableWeight: 24, zoneCode: 'Z3' });
    expect(f.effectiveRate).toBe(17.1);
    expect(f.freightSubtotal).toBe(410.4);        // 24 * 17.10
  });
  test('sub-1kg uses the flat first-0.5kg minimum', () => {
    const f = computeFreight({ chargeableWeight: 0.4, zoneCode: 'Z1' });
    expect(f.freightSubtotal).toBe(182.51);
  });
});

describe('Surcharges', () => {
  test('security (per-kg) + fuel (% applied last) on a plain shipment', () => {
    const s = computeSurcharges({ pieces: [], chargeableWeight: 24, freightSubtotal: 410.4, dangerousGoods: false, isRemote: false, isRisk: false });
    const codes = s.lines.map((l) => l.code);
    expect(codes).toEqual(['SECURITY', 'FUEL']);
    expect(s.lines.find((l) => l.code === 'SECURITY').amount).toBe(7.2);   // 0.30 * 24
    expect(s.lines.find((l) => l.code === 'FUEL').amount).toBe(114.84);    // 27.5% of (410.40 + 7.20)
  });
  test('dangerous goods adds DG flat surcharge and forces approval', () => {
    const s = computeSurcharges({ pieces: [], chargeableWeight: 22, freightSubtotal: 462, dangerousGoods: true, isRemote: false, isRisk: false });
    expect(s.lines.find((l) => l.code === 'FULL_DG').amount).toBe(440);
    expect(s.forcesApproval).toBe(true);
  });
  test('remote origin applies the per-kg-with-minimum (floor wins)', () => {
    const s = computeSurcharges({ pieces: [], chargeableWeight: 16, freightSubtotal: 406.4, dangerousGoods: false, isRemote: true, isRisk: false });
    expect(s.lines.find((l) => l.code === 'REMOTE_DEL').amount).toBe(105.6); // max(35.2, 105.60)
  });
  test('overweight piece suppresses oversize on the same piece (exclusion)', () => {
    const pieces = [{ isOverweight: true, isOversize: true }];
    const s = computeSurcharges({ pieces, chargeableWeight: 80, freightSubtotal: 100, dangerousGoods: false, isRemote: false, isRisk: false });
    const codes = s.lines.map((l) => l.code);
    expect(codes).toContain('OVERWEIGHT');
    expect(codes).not.toContain('OVERSIZE');
  });
});

describe('Exclusions (NOT freight)', () => {
  test('VAT on CIF + duty (non-GCC origin)', () => {
    const e = computeExclusions({ declaredValue: 4200, totalFreight: 532.44, gcc: false });
    expect(e.lines.find((l) => l.code === 'DUTY').amount).toBe(210);       // 5% of 4200
    expect(e.lines.find((l) => l.code === 'VAT').amount).toBe(709.87);     // 15% of (4200 + 532.44)
  });
  test('GCC origin is customs-duty exempt', () => {
    const e = computeExclusions({ declaredValue: 4200, totalFreight: 500, gcc: true });
    expect(e.lines.find((l) => l.code === 'DUTY').amount).toBe(0);
  });
});

describe('Full quotes (the 5 seeded scenarios)', () => {
  const expected = {
    'AF-1001': { freight: 532.44, landed: 1452.31, status: 'DRAFT' },
    'AF-1002': { freight: 1158.47, landed: 2692.24, status: 'PENDING' },
    'AF-1004': { freight: 658.92, landed: 1277.76, status: 'DRAFT' },
    'AF-1005': { freight: 1311.55, landed: 2588.28, status: 'PENDING' },
  };
  Object.entries(expected).forEach(([ref, ex]) => {
    test(`${ref} totals & status`, () => {
      const q = calculateQuote(byRef(ref));
      expect(q.totalFreight).toBe(ex.freight);
      expect(q.totalLanded).toBe(ex.landed);
      expect(q.status).toBe(ex.status);
    });
  });

  test('AF-1003 (320 cm edge) is rejected by validation', () => {
    const q = calculateQuote(byRef('AF-1003'));
    expect(q.rejected).toBe(true);
    expect(q.status).toBe('REJECTED');
    expect(q.errors[0]).toMatch(/exceeds DHL maximum/);
  });
});
