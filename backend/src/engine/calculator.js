/**
 * calculator.js — The Calculation Engine (KSA import model).
 *
 * Pure functions, no database, no framework.
 *
 * Pipeline (§7 of the enterprise blueprint):
 *   1. validate()          → reject pieces beyond DHL limits
 *   2. computeWeights()    → per-piece volumetric (divisor per mode);
 *                            chargeable = max(actual, vol); shipment = sum
 *   3. resolveZone()       → ORIGIN country → zone
 *   4. computeFreight()    → first-0.5kg flat minimum, else chargeable × band rate
 *   5. computeSurcharges() → all Appendix A surcharges, priority order, FUEL last
 *   6. computeExclusions() → VAT (15% CIF) + customs duty (5%), kept SEPARATE
 *   7. decideApproval()    → DG / forcesApproval / landed ≥ threshold
 *
 * Surcharge conditions supported (see SURCHARGES in data.js):
 *   ALWAYS | DANGEROUS_GOODS | DG_SUBTYPE | REMOTE_ORIGIN | RISK_ORIGIN
 *   RESTRICTED_DEST | OVERWEIGHT_PIECES | OVERSIZE_PIECES
 *   NON_CONVEYABLE_WEIGHT | NON_CONVEYABLE_IRR | NON_STACKABLE
 *   OPTIONAL | FUEL | EVENT (active:false — never fires)
 *
 * Input shape:
 *   originCountry, destinationCountry, mode, dangerousGoods, dgSubtype,
 *   declaredValue, currency,
 *   selectedSurcharges: string[],   ← optional service codes user opts into
 *   nonConveyableIrregular: bool,   ← user flags irregular shape
 *   nonStackable: bool,             ← user flags non-stackable pallet
 *   items: [{ quantity, lengthCm, widthCm, heightCm, weightKg }]
 */

const {
  COUNTRIES, MODES, RATE_GRID, SURCHARGES, TAX, RULES,
} = require('./data');

const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Expand items (quantity > 1) into individual physical pieces and compute flags.
function expandPieces(items, divisor) {
  const pieces = [];
  (items || []).forEach((it) => {
    const qty = Number(it.quantity || 1);
    for (let q = 0; q < qty; q += 1) {
      const L = Number(it.lengthCm);
      const W = Number(it.widthCm);
      const H = Number(it.heightCm);
      const actual = Number(it.weightKg);
      const vol = (L * W * H) / divisor;
      const chargeableExact = Math.max(actual, vol);
      const dims = [L, W, H].sort((a, b) => b - a);

      const isOverweight = actual > RULES.overweightKg;
      const isOversize   = dims[0] > RULES.oversizeLongestCm || dims[1] > RULES.oversizeSecondCm;
      const exceedsMax   = dims[0] > RULES.maxLongestCm || actual > RULES.maxPieceWeightKg;

      // Non-conveyable by weight: 25–70 kg per piece (exclusive of overweight).
      // Oversize exclusion is handled by the claimed[] mechanism in computeSurcharges.
      const isNonConveyableByWeight =
        actual >= RULES.nonConveyableMinKg && actual <= RULES.overweightKg;

      pieces.push({
        lengthCm: L, widthCm: W, heightCm: H,
        actualWeight: actual,
        volumetricWeight: round(vol),
        chargeableWeight: round(chargeableExact),
        chargeableExact,
        isOverweight,
        isOversize,
        exceedsMax,
        isNonConveyableByWeight,
      });
    }
  });
  return pieces;
}

// ---------------------------------------------------------------------------
// 1. Validation
// ---------------------------------------------------------------------------
function validate(input, pieces) {
  const errors = [];
  if (!input.originCountry) errors.push('Origin country is required.');
  if (!COUNTRIES.find((c) => c.code === input.originCountry)) {
    errors.push(`Unmapped origin country "${input.originCountry}".`);
  }
  if (!MODES.find((m) => m.code === input.mode)) {
    errors.push(`Unknown service mode "${input.mode}".`);
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    errors.push('At least one shipment item is required.');
  }
  pieces.forEach((p, i) => {
    if (p.exceedsMax) {
      errors.push(
        `Piece ${i + 1} exceeds DHL maximum (>${RULES.maxLongestCm} cm edge or `
        + `>${RULES.maxPieceWeightKg} kg) — requires special approval / split shipment.`,
      );
    }
  });
  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// 2. Weights
// ---------------------------------------------------------------------------
function computeWeights(items, mode) {
  const modeDef = MODES.find((m) => m.code === mode) || MODES[0];
  const pieces = expandPieces(items, modeDef.divisor);
  const actual       = round(pieces.reduce((s, p) => s + p.actualWeight, 0));
  const volumetric   = round(pieces.reduce((s, p) => s + p.volumetricWeight, 0));
  const chargeableExact = pieces.reduce((s, p) => s + p.chargeableExact, 0);
  return {
    pieces,
    divisor: modeDef.divisor,
    actualWeight: actual,
    volumetricWeight: volumetric,
    chargeableWeight: round(chargeableExact),
    chargeableExact,
    chargeableBasis: volumetric > actual ? 'VOLUMETRIC' : 'ACTUAL',
  };
}

// ---------------------------------------------------------------------------
// 3. Zone (from ORIGIN country)
// ---------------------------------------------------------------------------
function resolveZone(originCode) {
  const country = COUNTRIES.find((c) => c.code === originCode);
  if (!country) return null;
  return { country, zoneCode: country.zone };
}

// ---------------------------------------------------------------------------
// 4. Base freight
// ---------------------------------------------------------------------------
function bandForWeight(zoneCode, w) {
  const grid = RATE_GRID[zoneCode];
  return grid.bands.find((b) => w >= b.from && (b.to === null || w < b.to))
    || grid.bands[grid.bands.length - 1];
}

function computeFreight({ chargeableWeight, zoneCode }) {
  const grid = RATE_GRID[zoneCode];
  if (chargeableWeight < 1) {
    return {
      bracket: 'first 0.5 kg',
      effectiveRate: grid.firstHalf,
      minCharge: grid.firstHalf,
      appliedMinimum: true,
      freightSubtotal: round(grid.firstHalf),
      basis: `flat first-0.5kg minimum (${zoneCode})`,
    };
  }
  const band    = bandForWeight(zoneCode, chargeableWeight);
  const subtotal = round(chargeableWeight * band.rate);
  return {
    bracket:       `${band.from}-${band.to || '∞'} kg`,
    effectiveRate:  band.rate,
    minCharge:      0,
    appliedMinimum: false,
    freightSubtotal: subtotal,
    basis: `${round(chargeableWeight)} kg × ${band.rate} (${zoneCode})`,
  };
}

// ---------------------------------------------------------------------------
// 5. Surcharge engine (all Appendix A conditions)
// ---------------------------------------------------------------------------
function computeSurcharges(ctx) {
  // Only active surcharges; sort by priority (lower = evaluated first).
  const active = SURCHARGES
    .filter((s) => s.active !== false)
    .sort((a, b) => a.priority - b.priority);

  const lines        = [];
  let forcesApproval = false;
  // claimed[i] = list of surcharge codes that "claimed" piece i.
  // Exclusion logic: if surcharge X has excludes:[Y], and X claimed piece i,
  // then Y is suppressed on piece i.
  const claimed      = ctx.pieces.map(() => []);

  // Helper — check if piece i is suppressed by a code already claimed on it.
  function isSuppressed(pieceIdx, surchargeCode) {
    return claimed[pieceIdx].some((claimedCode) => {
      const claimedDef = SURCHARGES.find((x) => x.code === claimedCode);
      return (claimedDef?.excludes || []).includes(surchargeCode);
    });
  }

  active.forEach((s) => {
    if (s.condition === 'FUEL') return; // handled after the loop
    if (s.condition === 'EVENT') return; // never auto-fires

    let amount  = 0;
    let detail  = '';
    let matched = false;

    switch (s.condition) {

      // ── Always-on surcharges ───────────────────────────────────────────
      case 'ALWAYS':
        if (s.type === 'PER_KG') {
          amount  = round(s.value * ctx.chargeableWeight);
          detail  = `${s.value}/kg × ${round(ctx.chargeableWeight)} kg`;
          matched = true;
        } else if (s.type === 'FLAT') {
          amount  = s.value;
          detail  = 'flat per shipment';
          matched = true;
        }
        break;

      // ── Dangerous goods — full DG (IATA class 2,3,4,5,6,8,9) ─────────
      case 'DANGEROUS_GOODS':
        if (ctx.dangerousGoods && !ctx.dgSubtype) {
          // Only fires when DG is set but no specific sub-type is chosen
          // (i.e. the user selected the "Full DG" option).
          amount  = s.value;
          detail  = 'flat per shipment (full DG)';
          matched = true;
          if (s.forcesApproval) forcesApproval = true;
        }
        break;

      // ── DG sub-type (one fires per shipment based on dgSubtype input) ─
      case 'DG_SUBTYPE':
        if (ctx.dangerousGoods && ctx.dgSubtype && ctx.dgSubtype === s.dgSubtype) {
          amount  = s.value;
          detail  = `flat per shipment (${s.name})`;
          matched = true;
          if (s.forcesApproval) forcesApproval = true;
        }
        break;

      // ── Remote area delivery (origin country flagged remote) ──────────
      case 'REMOTE_ORIGIN':
        if (ctx.isRemote) {
          amount  = Math.max(s.value * ctx.chargeableWeight, s.min || 0);
          detail  = `max(${s.value}/kg × ${round(ctx.chargeableWeight)} kg, min ${s.min})`;
          matched = true;
        }
        break;

      // ── Elevated risk origin ──────────────────────────────────────────
      case 'RISK_ORIGIN':
        if (ctx.isRisk) {
          amount  = s.value;
          detail  = 'flat (elevated risk origin)';
          matched = true;
        }
        break;

      // ── Restricted destination (destination country flagged restricted) ─
      case 'RESTRICTED_DEST':
        if (ctx.isRestricted) {
          amount  = s.value;
          detail  = 'flat (restricted destination)';
          matched = true;
          if (s.forcesApproval) forcesApproval = true;
        }
        break;

      // ── Overweight pieces (>70 kg/piece) ─────────────────────────────
      case 'OVERWEIGHT_PIECES': {
        const idx = ctx.pieces
          .map((p, i) => (p.isOverweight ? i : -1))
          .filter((i) => i >= 0);
        idx.forEach((i) => claimed[i].push(s.code));
        if (idx.length) {
          amount  = s.value * idx.length;
          detail  = `${s.value} SAR × ${idx.length} piece(s) >${RULES.overweightKg} kg`;
          matched = true;
        }
        break;
      }

      // ── Oversize pieces (longest >100cm or 2nd >80cm) ─────────────────
      case 'OVERSIZE_PIECES': {
        const idx = ctx.pieces
          .map((p, i) => (p.isOversize && !isSuppressed(i, s.code) ? i : -1))
          .filter((i) => i >= 0);
        idx.forEach((i) => claimed[i].push(s.code)); // so NONCONV can be suppressed
        if (idx.length) {
          amount  = s.value * idx.length;
          detail  = `${s.value} SAR × ${idx.length} oversized piece(s)`;
          matched = true;
        }
        break;
      }

      // ── Non-conveyable by weight (25–70 kg/piece, auto) ───────────────
      // Blueprint: "Piece 25–70kg; excl. if Over*"
      case 'NON_CONVEYABLE_WEIGHT': {
        const idx = ctx.pieces
          .map((p, i) => (p.isNonConveyableByWeight && !isSuppressed(i, s.code) ? i : -1))
          .filter((i) => i >= 0);
        if (idx.length) {
          amount  = s.value * idx.length;
          detail  = `${s.value} SAR × ${idx.length} piece(s) ${RULES.nonConveyableMinKg}–${RULES.overweightKg} kg`;
          matched = true;
        }
        break;
      }

      // ── Non-conveyable irregular (user flags irregular shape) ─────────
      // Blueprint: "Non-conveyable remark; excl. if Over*"
      case 'NON_CONVEYABLE_IRR': {
        if (!ctx.nonConveyableIrregular) break;
        const validPieces = ctx.pieces.filter((_, i) => !isSuppressed(i, s.code));
        if (validPieces.length) {
          amount  = s.value * validPieces.length;
          detail  = `${s.value} SAR × ${validPieces.length} irregular piece(s)`;
          matched = true;
        }
        break;
      }

      // ── Non-stackable pallet (user flags) ────────────────────────────
      case 'NON_STACKABLE': {
        if (!ctx.nonStackable) break;
        amount  = s.value * ctx.pieces.length;
        detail  = `${s.value} SAR × ${ctx.pieces.length} piece(s)`;
        matched = true;
        break;
      }

      // ── Optional services (user explicitly opts in) ───────────────────
      // Handles: FLAT, PER_KG, PER_KG_MIN, PERCENT_OR_MIN mechanisms
      case 'OPTIONAL': {
        if (!ctx.selectedSurcharges?.includes(s.code)) break;
        const declared = Number(ctx.declaredValue || 0);
        if (s.type === 'FLAT') {
          amount  = s.value;
          detail  = 'per shipment';
        } else if (s.type === 'PER_KG') {
          amount  = round(s.value * ctx.chargeableWeight);
          detail  = `${s.value}/kg × ${round(ctx.chargeableWeight)} kg`;
        } else if (s.type === 'PER_KG_MIN') {
          const raw = s.value * ctx.chargeableWeight;
          amount    = Math.max(raw, s.min || 0);
          detail    = `max(${s.value}/kg × ${round(ctx.chargeableWeight)} kg, min ${s.min})`;
        } else if (s.type === 'PERCENT_OR_MIN') {
          // e.g. DUTY_TAX_PAID: max(2% × declared, 100)
          const pct  = (s.percent || 0) / 100;
          amount     = Math.max(pct * declared, s.min || 0);
          detail     = `max(${s.percent}% × ${declared}, min ${s.min})`;
        }
        matched = true;
        if (s.forcesApproval) forcesApproval = true;
        break;
      }

      default:
        break;
    }

    if (matched) {
      lines.push({
        code:   s.code,
        name:   s.name,
        type:   s.type,
        detail,
        amount: round(amount),
      });
    }
  });

  // ── FUEL last: % of (base freight + all freight surcharges above) ─────────
  const fuel = active.find((s) => s.condition === 'FUEL');
  if (fuel) {
    const fuelBase = ctx.freightSubtotal + lines.reduce((sum, l) => sum + l.amount, 0);
    lines.push({
      code:   fuel.code,
      name:   fuel.name,
      type:   'PERCENT',
      detail: `${fuel.value}% × ${round(fuelBase)}`,
      amount: round((fuel.value / 100) * fuelBase),
    });
  }

  return {
    lines,
    total: round(lines.reduce((s, l) => s + l.amount, 0)),
    forcesApproval,
  };
}

// ---------------------------------------------------------------------------
// 6. Exclusions (NOT freight): VAT on CIF + customs duty (Appendix C)
// ---------------------------------------------------------------------------
function computeExclusions({ declaredValue, totalFreight, gcc }) {
  const declared  = Number(declaredValue || 0);
  const dutyApplies = !(TAX.gccDutyExempt && gcc);
  const duty  = dutyApplies ? round(declared * (TAX.dutyPercent / 100)) : 0;
  const cif   = declared + totalFreight;
  const vat   = round(cif * (TAX.vatPercent / 100));
  const lines = [
    {
      code:   'DUTY',
      name:   dutyApplies ? `Customs Duty ${TAX.dutyPercent}%` : 'Customs Duty (GCC exempt)',
      amount: duty,
      basis:  dutyApplies ? `${declared} × ${TAX.dutyPercent}%` : 'GCC-origin proof of origin',
      note:   'Excluded / estimated externally',
    },
    {
      code:   'VAT',
      name:   `Import VAT ${TAX.vatPercent}%`,
      amount: vat,
      basis:  `(goods ${declared} + freight ${totalFreight}) × ${TAX.vatPercent}% [CIF]`,
      note:   'Excluded / estimated externally',
    },
  ];
  return { lines, total: round(lines.reduce((s, l) => s + l.amount, 0)) };
}

// ---------------------------------------------------------------------------
// 7. Approval decision
// ---------------------------------------------------------------------------
function decideApproval({ dangerousGoods, forcesApproval, totalLanded }) {
  const reasons = [];
  if (dangerousGoods || forcesApproval) reasons.push('Dangerous goods (mandatory manual approval)');
  if (totalLanded >= RULES.approvalThreshold) {
    reasons.push(`Landed cost >= ${RULES.approvalThreshold} ${RULES.currency} threshold`);
  }
  return { requiresApproval: reasons.length > 0, reasons };
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------
/**
 * @param {object} input
 *   originCountry, destinationCountry, mode,
 *   dangerousGoods (bool), dgSubtype (string|null),
 *   declaredValue, currency,
 *   selectedSurcharges (string[]),
 *   nonConveyableIrregular (bool), nonStackable (bool),
 *   items: [{ quantity, lengthCm, widthCm, heightCm, weightKg }]
 */
function calculateQuote(input) {
  const weights = computeWeights(input.items, input.mode);
  const v       = validate(input, weights.pieces);
  if (!v.ok) return { rejected: true, status: 'REJECTED', errors: v.errors, weights };

  const zoneInfo  = resolveZone(input.originCountry);
  const destCountry = COUNTRIES.find((c) => c.code === (input.destinationCountry || 'SA'));

  const freight = computeFreight({
    chargeableWeight: weights.chargeableExact,
    zoneCode:         zoneInfo.zoneCode,
  });

  // Resolve DG sub-type: if mode is DangerousGoods and no dgSubtype specified,
  // treat as FULL_DG. dgSubtype='FULL_DG' also maps to DANGEROUS_GOODS condition.
  const isDG       = input.dangerousGoods || input.mode === 'DangerousGoods';
  const dgSubtype  = (isDG && input.dgSubtype && input.dgSubtype !== 'FULL_DG')
    ? input.dgSubtype
    : null; // null → DANGEROUS_GOODS condition fires FULL_DG

  const surcharges = computeSurcharges({
    pieces:                  weights.pieces,
    chargeableWeight:        weights.chargeableExact,
    freightSubtotal:         freight.freightSubtotal,
    dangerousGoods:          isDG,
    dgSubtype,
    isRemote:                zoneInfo.country.remote,
    isRisk:                  zoneInfo.country.risk,
    isRestricted:            destCountry?.restricted || false,
    nonConveyableIrregular:  !!input.nonConveyableIrregular,
    nonStackable:            !!input.nonStackable,
    selectedSurcharges:      Array.isArray(input.selectedSurcharges) ? input.selectedSurcharges : [],
    declaredValue:           Number(input.declaredValue || 0),
  });

  const totalFreight  = round(freight.freightSubtotal + surcharges.total);
  const exclusions    = computeExclusions({
    declaredValue: input.declaredValue,
    totalFreight,
    gcc: zoneInfo.country.gcc,
  });
  const totalLanded   = round(totalFreight + exclusions.total);
  const approval      = decideApproval({
    dangerousGoods: isDG,
    forcesApproval: surcharges.forcesApproval,
    totalLanded,
  });

  return {
    rejected: false,
    status:   approval.requiresApproval ? 'PENDING' : 'DRAFT',
    weights,
    zone:        { code: zoneInfo.zoneCode, name: zoneInfo.zoneCode, factor: 1 },
    destination: { code: zoneInfo.country.code, name: zoneInfo.country.name, remote: zoneInfo.country.remote },
    origin:      { code: zoneInfo.country.code, name: zoneInfo.country.name, remote: zoneInfo.country.remote, gcc: zoneInfo.country.gcc },
    freight,
    surcharges,
    exclusions:      exclusions.lines,
    totalFreight,
    totalExclusions: exclusions.total,
    totalLanded,
    currency:        input.currency || RULES.currency,
    approval,
  };
}

module.exports = {
  expandPieces, validate, computeWeights, resolveZone, bandForWeight,
  computeFreight, computeSurcharges, computeExclusions, decideApproval,
  calculateQuote, round,
};
