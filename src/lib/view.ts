// Maps legislators to what the card and the detail dialog display.
import { formatArs, type Deputy, type PaySummary, type Senator } from './legislators.ts';

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

export function toDeputyItem(deputy: Deputy, pay: PaySummary): ChamberItem {
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
