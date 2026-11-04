// Home "¿En qué usan fondos?" rankings. The only per-deputy money the Cámara publishes is the viáticos of official
// missions abroad; domestic trips are published as legs without a cost. Amounts are summed per currency and never
// converted; a mission without a published amount counts as a mission and is shown as text, never as 0.
import type { Deputy } from '../../lib/legislators.ts';
import type { DeputyMissions, Mission, Money } from '../../lib/misiones.ts';
import type { DeputyTravel } from '../../lib/viajes.ts';
import { formatDate, formatNumber } from '../../lib/view.ts';

export const TOP = 10;
export const NO_AMOUNT = 'sin monto publicado';
// S4 wording for deputies well above the median of their distance band
export const FLAG_NOTE = 'viaja bastante más que sus pares a distancia similar';
export const TRAVEL_COST_NOTE = 'La Cámara publica los tramos, no su costo.';

export interface PersonRef {
  id: string;
  nombre: string;
  url: string;
  bloque: { titulo: string; url: string | null };
  provincia: { nombre: string; url: string | null };
}

export interface MissionRow {
  desde: string;
  hasta: string;
  lugar: string;
  motivo: string;
  institucion: string;
  dias: string;
  otorgado: string;
  consumido: string;
}

export interface SpendingDeputy extends PersonRef {
  missions: number;
  // per currency, only missions with a published amount
  otorgado: Record<string, number>;
  consumido: Record<string, number>;
  usdOtorgado: number;
  usdConsumido: number;
  // missions without a published granted amount
  sinMonto: number;
  // newest first, undated last
  rows: MissionRow[];
}

export interface OtherCurrency {
  id: string;
  nombre: string;
  url: string;
  currency: string;
  otorgado: number;
  consumido: number;
}

export interface MissionSpending {
  ranked: SpendingDeputy[];
  top: SpendingDeputy[];
  otherCurrencies: OtherCurrency[];
  totals: { deputies: number; missions: number; usdOtorgado: number; usdConsumido: number; sinMonto: number };
}

export interface TravelRow extends PersonRef {
  legs: number;
  legsPerMonth: number;
  months: number;
  band: string | null;
  route: string;
  flag: string | null;
}

const byName = (a: { nombre: string }, b: { nombre: string }) => a.nombre.localeCompare(b.nombre, 'es');
const round2 = (n: number) => Math.round(n * 100) / 100;

export const moneyLabel = (money: Money | null) => (money ? `${money.currency} ${formatNumber(money.amount)}` : NO_AMOUNT);

// the part of LegislatorRelations shown here
type Relation = { url: string; bloc: { titulo: string; url: string }; province: { nombre: string; url: string } | null };

// Name, ficha, bloc and province of every deputy in office; the published bloc and district when there are no relations.
export function personRefs(deputies: Deputy[], relations: Map<string, Relation>): Map<string, PersonRef> {
  return new Map(
    deputies.map(d => {
      const rel = relations.get(d.id);
      return [
        d.id,
        {
          id: d.id,
          nombre: d.nombre,
          url: rel?.url ?? `/diputados/${d.id}/`,
          bloque: rel ? { titulo: rel.bloc.titulo, url: rel.bloc.url } : { titulo: d.bloque, url: null },
          provincia: rel?.province ? { nombre: rel.province.nombre, url: rel.province.url } : { nombre: d.lugar, url: null },
        },
      ];
    }),
  );
}

const add = (totals: Record<string, number>, money: Money | null) => {
  if (money) totals[money.currency] = round2((totals[money.currency] ?? 0) + money.amount);
};

const newestFirst = (a: Mission, b: Mission) =>
  a.fechaInicio === b.fechaInicio ? 0 : a.fechaInicio === null ? 1 : b.fechaInicio === null ? -1 : b.fechaInicio.localeCompare(a.fechaInicio);

const missionRow = (m: Mission): MissionRow => ({
  desde: formatDate(m.fechaInicio),
  hasta: formatDate(m.fechaFin),
  lugar: m.lugar,
  motivo: m.motivo,
  institucion: m.institucion,
  dias: m.viaticosDias === null ? '—' : formatNumber(m.viaticosDias),
  otorgado: moneyLabel(m.viaticosOtorgados),
  consumido: moneyLabel(m.viaticosConsumidos),
});

// Deputies in office with official missions, by USD granted (ties by name).
export function missionSpending(missions: DeputyMissions[], people: Map<string, PersonRef>, top = TOP): MissionSpending {
  const ranked = missions
    .flatMap(own => {
      const ref = people.get(own.deputyId);
      if (!ref || own.missions.length === 0) return [];
      const otorgado: Record<string, number> = {};
      const consumido: Record<string, number> = {};
      for (const m of own.missions) {
        add(otorgado, m.viaticosOtorgados);
        add(consumido, m.viaticosConsumidos);
      }
      const deputy: SpendingDeputy = {
        ...ref,
        missions: own.missions.length,
        otorgado,
        consumido,
        usdOtorgado: otorgado.USD ?? 0,
        usdConsumido: consumido.USD ?? 0,
        sinMonto: own.missions.filter(m => m.viaticosOtorgados === null).length,
        rows: [...own.missions].sort(newestFirst).map(missionRow),
      };
      return [deputy];
    })
    .sort((a, b) => b.usdOtorgado - a.usdOtorgado || byName(a, b));
  const otherCurrencies = ranked.flatMap(d =>
    [...new Set([...Object.keys(d.otorgado), ...Object.keys(d.consumido)])]
      .filter(c => c !== 'USD')
      .sort()
      .map(currency => ({ id: d.id, nombre: d.nombre, url: d.url, currency, otorgado: d.otorgado[currency] ?? 0, consumido: d.consumido[currency] ?? 0 })),
  );
  const sum = (pick: (d: SpendingDeputy) => number) => round2(ranked.reduce((t, d) => t + pick(d), 0));
  return {
    ranked,
    top: ranked.slice(0, top),
    otherCurrencies,
    totals: {
      deputies: ranked.length,
      missions: sum(d => d.missions),
      usdOtorgado: sum(d => d.usdOtorgado),
      usdConsumido: sum(d => d.usdConsumido),
      sinMonto: sum(d => d.sinMonto),
    },
  };
}

// Deputies in office with legs in the window, by legs (then legs per month, then name).
export function travelRanking(travel: DeputyTravel[], people: Map<string, PersonRef>, top = TOP): TravelRow[] {
  return travel
    .flatMap(t => {
      const ref = people.get(t.deputyId);
      if (!ref || t.legs === 0) return [];
      const row: TravelRow = {
        ...ref,
        legs: t.legs,
        legsPerMonth: t.legsPerMonth,
        months: t.months,
        band: t.band,
        route: t.topRoute ? `${t.topRoute.origen} ↔ ${t.topRoute.destino} (${t.topRoute.count})` : '—',
        flag: t.flagged ? FLAG_NOTE : null,
      };
      return [row];
    })
    .sort((a, b) => b.legs - a.legs || b.legsPerMonth - a.legsPerMonth || byName(a, b))
    .slice(0, top);
}
