// Refreshes src/data/senadores.json, the fallback used when the Senate API is down at build time.
import { mkdir, writeFile } from 'node:fs/promises';

const SOURCE = 'https://www.senado.gob.ar/micrositios/DatosAbiertos/ExportarListadoSenadores/json';
const FIELDS = ['ID', 'BLOQUE', 'APELLIDO', 'NOMBRE', 'PROVINCIA', 'PARTIDO O ALIANZA', 'D_LEGAL', 'C_LEGAL', 'EMAIL', 'TELEFONO', 'FOTO'];
const TARGET = new URL('../src/data/senadores.json', import.meta.url);

try {
  const response = await fetch(SOURCE);
  if (!response.ok) throw new Error(`Senate API answered ${response.status}`);
  const rows = (await response.json())?.table?.rows;
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Senate API returned no rows');

  const snapshot = {
    fuente: SOURCE,
    fecha: new Date().toISOString().slice(0, 10),
    rows: rows.map(row => Object.fromEntries(FIELDS.map(f => [f, row[f] ?? '']))),
  };
  await mkdir(new URL('.', TARGET), { recursive: true });
  await writeFile(TARGET, JSON.stringify(snapshot, null, 2) + '\n');
  console.log(`Saved ${rows.length} senators to src/data/senadores.json`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
