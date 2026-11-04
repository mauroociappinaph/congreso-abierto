// Official committee names with accents and Spanish capitalization. The HCDN committee list publishes them
// uppercase without accents ("ACCION SOCIAL Y SALUD PUBLICA"); titleCase cannot restore what is missing.
// Wording as in the committee list; accents as on each committee page title of
// https://www.hcdn.gob.ar/comisiones/permanentes/ (read 2026-11-03), e.g. "Comisión Permanente de Acción Social y
// Salud Pública". Where a page title abbreviates or rewords the name, only its accents are taken.
// HCDN00064 is missing from the list (published without a name), so it has no entry here.
import { normalizeText } from './legislators.ts';

export const COMMITTEE_NAMES: Readonly<Record<string, string>> = {
  HCDN00022: 'Asuntos Municipales',
  HCDN00023: 'Vivienda y Ordenamiento Urbano',
  HCDN00024: 'Peticiones, Poderes y Reglamento',
  HCDN00025: 'Juicio Político',
  HCDN00026: 'Recursos Naturales y Conservación del Ambiente Humano',
  HCDN00027: 'Turismo',
  HCDN00028: 'Economía',
  HCDN00029: 'Minería',
  HCDN00031: 'Deportes',
  HCDN00033: 'Análisis y Seguimiento del Cumplimiento de Normas Tributarias y Previsionales',
  HCDN00034: 'Derechos Humanos y Garantías',
  HCDN00035: 'Intereses Marítimos, Fluviales, Pesqueros y Portuarios',
  HCDN00036: 'Cultura',
  HCDN00038: 'Asuntos Cooperativos, Mutuales y Organizaciones no Gubernamentales',
  HCDN00039: 'Mercosur',
  HCDN00041: 'Libertad de Expresión',
  HCDN00042: 'Seguridad Interior',
  HCDN00043: 'Pequeñas y Medianas Empresas',
  HCDN00044: 'Discapacidad',
  HCDN00045: 'Asuntos Constitucionales',
  HCDN00046: 'Legislación General',
  HCDN00047: 'Relaciones Exteriores y Culto',
  HCDN00048: 'Presupuesto y Hacienda',
  HCDN00049: 'Educación',
  HCDN00051: 'Justicia',
  HCDN00052: 'Previsión y Seguridad Social',
  HCDN00053: 'Acción Social y Salud Pública',
  HCDN00055: 'Legislación Penal',
  HCDN00056: 'Legislación del Trabajo',
  HCDN00057: 'Defensa Nacional',
  HCDN00058: 'Obras Públicas',
  HCDN00059: 'Agricultura y Ganadería',
  HCDN00060: 'Finanzas',
  HCDN00061: 'Industria',
  HCDN00062: 'Comercio',
  HCDN00063: 'Energía y Combustibles',
  HCDN00065: 'Transportes',
  HCDN00066: 'Economías y Desarrollo Regional',
  HCDN00133: 'Prevención de Adicciones y Control del Narcotráfico',
  HCDN00157: 'Población y Desarrollo Humano',
  HCDN00167: 'Defensa del Consumidor, del Usuario y de la Competencia',
  HCDN00184: 'De las Personas Mayores',
  HCDN00185: 'Ciencia, Tecnología e Innovación Productiva',
  HCDN00221: 'Familias, Niñez y Juventudes',
  HCDN00222: 'Mujeres y Diversidad',
};

const nameKey = (value: string) => normalizeText(value).replace(/\s+/g, ' ').trim();
const BY_NAME = new Map(Object.values(COMMITTEE_NAMES).map(nombre => [nameKey(nombre), nombre]));

// By id first; a committee whose id changed keeps its official name when the published name still matches.
export function committeeName(id: string, nombre: string): string | undefined {
  return COMMITTEE_NAMES[id] ?? BY_NAME.get(nameKey(nombre));
}
