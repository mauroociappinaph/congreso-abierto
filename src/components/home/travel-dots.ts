// DotPlot rows for the travel comparison: one row per distance band, one dot per compared deputy, the band median
// as the bar. Shared by /viajes/ and the deputy fichas.
import type { TravelAnalysis } from '../../lib/viajes.ts';
import { formatNumber } from '../../lib/view.ts';

export interface TravelDotRow {
  label: string;
  median: number;
  emphasis: boolean;
  points: { value: number; label?: string; highlight: boolean; flag: boolean }[];
}

// "Yedlin, Pablo Raúl" -> "Yedlin"
export const surname = (nombre: string) => nombre.split(',')[0].trim();

export function travelDotRows(analysis: TravelAnalysis, nombreById: Map<string, string>, highlightId?: string): TravelDotRow[] {
  return analysis.bands.map(band => {
    const peers = analysis.deputies.filter(d => d.band === band.band && d.eligible);
    return {
      label: band.band,
      median: band.medianLegsPerMonth,
      emphasis: peers.some(d => d.deputyId === highlightId),
      points: peers.map(d => {
        const highlight = d.deputyId === highlightId;
        const marked = highlight || d.flagged;
        return {
          value: d.legsPerMonth,
          highlight,
          flag: d.flagged,
          label: marked ? `${surname(nombreById.get(d.deputyId) ?? '')} ${formatNumber(d.legsPerMonth)}` : undefined,
        };
      }),
    };
  });
}

// "< 100 km: mediana 0,33 (86 diputados); ..." for the SVG description
export const bandsDescription = (analysis: TravelAnalysis) =>
  analysis.bands.map(b => `${b.band}: mediana ${formatNumber(b.medianLegsPerMonth)} (${b.deputies} diputados)`).join('; ');
