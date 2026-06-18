/**
 * fuel.service.js — Live DHL Air fuel surcharge rate.
 *
 * DHL publishes the Express Air fuel surcharge weekly (by calendar week) at:
 *   https://www.dhl.de/en/geschaeftskunden/express/produkte-und-services/zuschlaege/treibstoffzuschlag-air.html
 *
 * We scrape that page's table, take the most recent calendar week (top row),
 * and cache it. The calculation engine uses this rate for the FUEL surcharge.
 *
 * Resilience: an in-memory cache (TTL) avoids hammering DHL; if a refresh
 * fails we keep serving the last good value; if we have never succeeded we
 * fall back to the static default from data.js. The engine therefore never
 * breaks just because DHL is briefly unreachable.
 */
const { SURCHARGES } = require('../engine/data');

const DHL_URL = 'https://www.dhl.de/en/geschaeftskunden/express/produkte-und-services/zuschlaege/treibstoffzuschlag-air.html';
const TTL_MS = 12 * 60 * 60 * 1000;          // refresh at most twice a day
const FETCH_TIMEOUT_MS = 8000;

// Ultimate fallback = the static FUEL value seeded in data.js.
const DEFAULT_RATE = (SURCHARGES.find((s) => s.code === 'FUEL') || {}).value ?? 27.5;

let cache = null;        // { rate, week, all, fetchedAt, source }
let inflight = null;     // de-dupe concurrent refreshes

// Parse the DHL HTML table → [{ week: 27, rate: 42.75 }, ...] newest first.
function parseRates(html) {
  const re = /<td>\s*CW\s*(\d+)\s*<\/td>\s*<td>\s*([\d.,]+)\s*%/gi;
  const rows = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const week = parseInt(m[1], 10);
    const rate = parseFloat(m[2].replace(',', '.'));
    if (!Number.isNaN(week) && !Number.isNaN(rate)) rows.push({ week, rate });
  }
  return rows;
}

async function fetchFromDHL() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(DHL_URL, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AFCC/1.0; +freight-calculator)' },
    });
    if (!res.ok) throw new Error(`DHL responded ${res.status}`);
    const html = await res.text();
    const rows = parseRates(html);
    if (!rows.length) throw new Error('No fuel rows parsed from DHL page');
    const current = rows[0];   // DHL lists the most recent calendar week first
    return {
      rate: current.rate,
      week: `CW ${current.week}`,
      all: rows.map((r) => ({ week: `CW ${r.week}`, rate: r.rate })),
      fetchedAt: new Date().toISOString(),
      source: 'dhl-live',
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Current fuel surcharge info. Uses cache when fresh; otherwise refreshes.
 * Always resolves (never throws) — degrades to last-good or the default.
 */
async function getRate() {
  const fresh = cache && (Date.now() - new Date(cache.fetchedAt).getTime() < TTL_MS);
  if (fresh) return cache;

  if (!inflight) {
    inflight = fetchFromDHL()
      .then((data) => { cache = data; return data; })
      .catch((err) => {
        if (cache) return { ...cache, stale: true, error: err.message };  // last good
        return {                                                          // never-succeeded fallback
          rate: DEFAULT_RATE, week: null, all: [],
          fetchedAt: new Date().toISOString(), source: 'default-fallback', error: err.message,
        };
      })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

// Just the numeric rate (used by the calculation engine).
async function getRateValue() {
  const info = await getRate();
  return info.rate;
}

module.exports = { getRate, getRateValue, parseRates, DEFAULT_RATE };
