// Maps legislators to what the card and the detail dialog display.
import { formatArs, type Deputy, type PaySummary, type Senator } from './legislators.ts';
import { STAGES, type AuthorBills, type Stage } from './proyectos.ts';
import { MIN_MONTHS, type DeputyTravel } from './viajes.ts';

export type Field = [label: string, value: string];

export interface ClientItem {
  id: string;
  nombre: string;
  lugar: string;
  bloque: string;
  detail: Field[];
  detailNote: string;
  foto: string;
  // the legislator's static page
  url: string;
}

export interface ChamberItem extends ClientItem {
  card: Field[];
}

const orNa = (value: string) => value || 'N/A';

export interface SourceLink {
  label: string;
  href: string;
}

// Dataset pages shown next to every metric.
export const DATASETS = {
  legisladores: { label: 'HCDN - Legisladores', href: 'https://datos.hcdn.gob.ar/dataset/legisladores' },
  dietas: { label: 'HCDN - Dietas y Gastos de Representación', href: 'https://datos.hcdn.gob.ar/dataset/dietas-y-gastos-de-representacion-legisladores-as' },
  viajes: { label: 'HCDN - Viajes Nacionales', href: 'https://datos.hcdn.gob.ar/dataset/viajes-nacionales' },
  misiones: { label: 'HCDN - Misiones Oficiales', href: 'https://datos.hcdn.gob.ar/dataset/misiones-oficiales' },
  comisiones: { label: 'HCDN - Comisiones', href: 'https://datos.hcdn.gob.ar/dataset/comisiones' },
  proyectos: { label: 'HCDN - Proyectos Parlamentarios', href: 'https://datos.hcdn.gob.ar/dataset/proyectos-parlamentarios' },
  movimientos: { label: 'HCDN - Movimientos de Proyectos', href: 'https://datos.hcdn.gob.ar/dataset/movimientos-de-proyectos' },
  senadores: { label: 'Senado - Datos Abiertos', href: 'https://www.senado.gob.ar/micrositios/DatosAbiertos/' },
  actas: { label: 'Senado - Actas de votación', href: 'https://www.senado.gob.ar/votaciones/actas' },
} satisfies Record<string, SourceLink>;

export const STAGE_LABELS: Record<Stage, string> = {
  presentado: 'Presentado',
  'en comisión': 'En comisión',
  'con dictamen': 'Con dictamen',
  'media sanción': 'Media sanción',
  sancionado: 'Sancionado',
};

export const formatNumber = (value: number) => value.toLocaleString('es-AR', { maximumFractionDigits: 2 });

// share is 0-1
export const formatShare = (share: number | null) =>
  share === null ? 'N/A' : `${(share * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })} %`;

export const formatDate = (day: string | null) => (day ? day.slice(0, 10).split('-').reverse().join('/') : 'N/A');

export const formatMoney = (totals: Record<string, number>) =>
  Object.entries(totals)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amount]) => `${currency} ${formatNumber(amount)}`)
    .join('; ') || 'Sin datos';

export const cargoLabel = (cargo: string) => cargo.charAt(0).toUpperCase() + cargo.slice(1);

// Totals of several authors; the recent list is per author, so it is left empty.
export function mergeBills(list: AuthorBills[]): AuthorBills {
  const merged: AuthorBills = {
    total: 0,
    byTipo: {},
    stages: Object.fromEntries(STAGES.map(s => [s, 0])) as Record<Stage, number>,
    recent: [],
  };
  for (const bills of list) {
    merged.total += bills.total;
    for (const [tipo, count] of Object.entries(bills.byTipo)) merged.byTipo[tipo] = (merged.byTipo[tipo] ?? 0) + count;
    for (const stage of STAGES) merged.stages[stage] += bills.stages[stage];
  }
  return merged;
}

// S4: only "viaja (bastante) más que sus pares", never a judgment about the trips.
export function travelComparison(travel: DeputyTravel): string {
  if (!travel.eligible) return `No comparado (menos de ${MIN_MONTHS} meses en el cargo)`;
  if (!travel.band || travel.bandMedian === null) return 'No comparado (sin distancia estimada)';
  if (travel.flagged) {
    return `Viaja bastante más que sus pares a distancia similar (mediana ${formatNumber(travel.bandMedian)} por mes)`;
  }
  return 'En línea con sus pares a distancia similar';
}

const HOME_SOURCE = { ruta: 'ruta más frecuente', capital: 'capital de la provincia' } as const;

export function homeDistance(travel: DeputyTravel): string {
  if (travel.homeKm === null || !travel.homeSource) return 'N/A';
  return `${formatNumber(travel.homeKm)} km (${HOME_SOURCE[travel.homeSource]})`;
}

const travelFields = (travel: DeputyTravel): Field[] => [
  ['Tramos (últimos 4 semestres)', formatNumber(travel.legs)],
  ['Tramos por mes', formatNumber(travel.legsPerMonth)],
  ['Distancia estimada', homeDistance(travel)],
  ['Comparación con sus pares', travelComparison(travel)],
];

export function toDeputyItem(deputy: Deputy, pay: PaySummary, travel?: DeputyTravel): ChamberItem {
  return {
    id: deputy.id,
    nombre: deputy.nombre,
    lugar: deputy.lugar,
    bloque: deputy.bloque,
    foto: '',
    url: `/diputados/${deputy.id}/`,
    card: [
      ['Distrito', orNa(deputy.lugar)],
      ['Dieta', formatArs(pay.dieta)],
      ['Gastos de representación', formatArs(pay.gastosRepresentacion)],
    ],
    detail: [
      ['Nombre', deputy.nombre],
      ['Distrito', orNa(deputy.lugar)],
      ['Bloque', deputy.bloque],
      ['Mandato', orNa(deputy.mandato)],
      ['Fecha de jura', orNa(deputy.fechaJura)],
      ['Fecha de inicio', orNa(deputy.fechaInicio)],
      ['Dieta', formatArs(pay.dieta)],
      ['Gastos de representación', formatArs(pay.gastosRepresentacion)],
      ['Total bruto', formatArs(pay.bruto)],
      ['Neto estimado', formatArs(pay.neto)],
      ...(travel ? travelFields(travel) : []),
    ],
    detailNote: 'Montos generales publicados por la Cámara; no son gastos individuales.',
  };
}

export function toSenatorItem(senator: Senator): ChamberItem {
  return {
    id: senator.id,
    nombre: senator.nombre,
    lugar: senator.lugar,
    bloque: senator.bloque,
    foto: senator.foto,
    url: `/senadores/${senator.id}/`,
    card: [
      ['Provincia', orNa(senator.lugar)],
      ['Mandato', orNa(senator.mandato)],
    ],
    detail: [
      ['Nombre', senator.nombre],
      ['Provincia', orNa(senator.lugar)],
      ['Bloque', senator.bloque],
      ['Partido o alianza', orNa(senator.partido)],
      ['Mandato', orNa(senator.mandato)],
      ['Email', orNa(senator.email)],
      ['Teléfono', orNa(senator.telefono)],
    ],
    detailNote: 'El Senado no publica dietas ni gastos en sus datos abiertos.',
  };
}
