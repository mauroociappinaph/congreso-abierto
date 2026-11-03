// Maps legislators to what the card and the detail dialog display.
import { formatArs, type Deputy, type PaySummary, type Senator } from './legislators.ts';
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
}

export interface ChamberItem extends ClientItem {
  card: Field[];
}

const orNa = (value: string) => value || 'N/A';

export const formatNumber = (value: number) => value.toLocaleString('es-AR', { maximumFractionDigits: 2 });

// S4: only "viaja (bastante) más que sus pares", never a judgment about the trips.
export function travelComparison(travel: DeputyTravel): string {
  if (!travel.eligible) return `No comparado (menos de ${MIN_MONTHS} meses en el cargo)`;
  if (!travel.region || travel.regionMedian === null) return 'No comparado (distrito sin región)';
  if (travel.flagged) {
    return `Viaja bastante más que sus pares de ${travel.region} (mediana ${formatNumber(travel.regionMedian)} por mes)`;
  }
  return `En línea con su región (${travel.region})`;
}

const travelFields = (travel: DeputyTravel): Field[] => [
  ['Tramos (últimos 4 semestres)', formatNumber(travel.legs)],
  ['Tramos por mes', formatNumber(travel.legsPerMonth)],
  ['Comparación regional', travelComparison(travel)],
];

export function toDeputyItem(deputy: Deputy, pay: PaySummary, travel?: DeputyTravel): ChamberItem {
  return {
    id: deputy.id,
    nombre: deputy.nombre,
    lugar: deputy.lugar,
    bloque: deputy.bloque,
    foto: '',
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
