// Worked examples for /metodologia/: the same formulas as the site's algorithms, with their intermediate steps.
// Jaro-Winkler and the modified z mirror src/lib/linkage.ts and src/lib/viajes.ts; the tests pin them to those.
import { modifiedZScores, Z_THRESHOLD, type DeputyTravel } from '../../lib/viajes.ts';

export interface JaroSteps {
  a: string;
  b: string;
  // characters match only within this distance of each other
  window: number;
  matches: number;
  // half the matched characters out of order
  transpositions: number;
  jaro: number;
  // common prefix, at most 4 letters
  prefix: number;
  jw: number;
  aMatched: boolean[];
  bMatched: boolean[];
  // [index in a, index in b] of each matched character
  pairs: [number, number][];
}

export function jaroSteps(a: string, b: string): JaroSteps {
  const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatched = new Array<boolean>(a.length).fill(false);
  const bMatched = new Array<boolean>(b.length).fill(false);
  const pairs: [number, number][] = [];
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const end = Math.min(i + window + 1, b.length);
    for (let j = Math.max(0, i - window); j < end; j++) {
      if (bMatched[j] || a[i] !== b[j]) continue;
      aMatched[i] = bMatched[j] = true;
      pairs.push([i, j]);
      matches++;
      break;
    }
  }
  let outOfOrder = 0;
  for (let i = 0, j = 0; i < a.length; i++) {
    if (!aMatched[i]) continue;
    while (!bMatched[j]) j++;
    if (a[i] !== b[j]) outOfOrder++;
    j++;
  }
  const transpositions = outOfOrder / 2;
  let prefix = 0;
  while (prefix < 4 && prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  const jaro = a === b ? 1 : matches ? (matches / a.length + matches / b.length + (matches - transpositions) / matches) / 3 : 0;
  const jw = a === b ? 1 : matches ? jaro + prefix * 0.1 * (1 - jaro) : 0;
  return { a, b, window, matches, transpositions, jaro, prefix, jw, aMatched, bMatched, pairs };
}

// Rice cohesion of one bloc in one acta; null when nobody voted yes or no.
export function riceIndex(yes: number, no: number): number | null {
  return yes + no > 0 ? Math.abs(yes - no) / (yes + no) : null;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((x, y) => x - y);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export interface ZSteps {
  median: number;
  deviations: number[];
  mad: number;
  z: number[];
}

export function zSteps(values: number[]): ZSteps {
  const med = median(values);
  const deviations = values.map(x => Math.abs(x - med));
  return { median: med, deviations, mad: median(deviations), z: modifiedZScores(values) };
}

type TravelRow = Pick<DeputyTravel, 'deputyId' | 'region' | 'legsPerMonth' | 'eligible' | 'flagged' | 'band' | 'homeKm' | 'topRoute'>;

export interface RegionalOutlier extends TravelRow {
  z: number;
  // still flagged by the distance comparison the site uses
  flaggedByBand: boolean;
}

// The earlier comparison: peers by region instead of distance band, same z and threshold. The legs per month
// come rounded to two decimals, so the z values are a close recalculation, not the original run.
export function regionalOutliers(deputies: TravelRow[]): RegionalOutlier[] {
  const byRegion = new Map<string, TravelRow[]>();
  for (const d of deputies) {
    if (!d.eligible || !d.region) continue;
    byRegion.set(d.region, [...(byRegion.get(d.region) ?? []), d]);
  }
  const result: RegionalOutlier[] = [];
  for (const peers of byRegion.values()) {
    modifiedZScores(peers.map(d => d.legsPerMonth)).forEach((z, i) => {
      if (z > Z_THRESHOLD) result.push({ ...peers[i], z, flaggedByBand: peers[i].flagged });
    });
  }
  return result.sort((x, y) => y.z - x.z);
}
