import test from 'node:test';
import assert from 'node:assert/strict';
import { CAPITALS, endpointKey, estimateHome, haversineKm, OBELISCO, type EndpointTable } from './distance.ts';

const near = (actual: number, expected: number, tolerance: number) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);

test('haversineKm measures great-circle distance in km', () => {
  assert.equal(haversineKm(OBELISCO, OBELISCO), 0);
  // one degree of latitude ≈ 111.2 km
  near(haversineKm({ lat: 0, lon: 0 }, { lat: 1, lon: 0 }), 111.19, 0.01);
  // Obelisco → Córdoba ≈ 646 km
  near(haversineKm(OBELISCO, CAPITALS.cordoba), 646, 5);
  assert.equal(haversineKm(OBELISCO, CAPITALS.salta), haversineKm(CAPITALS.salta, OBELISCO));
});

test('endpointKey normalizes accents, punctuation and unrecoverable mojibake to one key', () => {
  assert.equal(endpointKey(' Aeropuerto de  BAHÍA Blanco '), 'aeropuerto de bahia blanco');
  assert.equal(endpointKey('AEROPUERTO DE BAHA?A BLANCO'), endpointKey('AEROPUERTO DE BAHÃA BLANCO'));
  assert.equal(endpointKey('LINIERS - GRAL. PAZ 10868 (LÍMITE CON CIUDADELA)'), 'liniers gral paz 10868 limite con ciudadela');
});

test('CAPITALS covers the 24 districts', () => {
  assert.equal(Object.keys(CAPITALS).length, 24);
  assert.equal(CAPITALS['buenos aires'].place, 'La Plata');
  assert.equal(CAPITALS['tierra del fuego'].place, 'Ushuaia');
});

const endpoints: EndpointTable = {
  'aeroparque internacional jorge newbery': { lat: -34.5592, lon: -58.4156, provincia: 'CIUDAD DE BUENOS AIRES', kind: 'airport', hub: true },
  'aeropuerto internacional ministro pistarini': { lat: -34.8222, lon: -58.5358, provincia: 'BUENOS AIRES', kind: 'airport', hub: true },
  retiro: { lat: -34.5925, lon: -58.3747, provincia: 'CIUDAD DE BUENOS AIRES', kind: 'bus', hub: true },
  'aeropuerto internacional astor piazzolla': { lat: -37.9342, lon: -57.5733, provincia: 'BUENOS AIRES', kind: 'airport' },
  necochea: { lat: -38.5545, lon: -58.7396, provincia: 'BUENOS AIRES', kind: 'bus' },
  'aeropuerto internacional islas malvinas': { lat: -32.9036, lon: -60.785, provincia: 'SANTA FE', kind: 'airport' },
};
const leg = (origen: string, destino: string) => ({ origen, destino });
const AEP = 'AEROPARQUE INTERNACIONAL JORGE NEWBERY';
const MDQ = 'AEROPUERTO INTERNACIONAL ASTOR PIAZZOLLA';

test('estimateHome uses the most frequent non-hub endpoint in the deputy district', () => {
  const legs = [leg(AEP, MDQ), leg(MDQ, AEP), leg(AEP, MDQ), leg('NECOCHEA', 'RETIRO'), leg('RETIRO', 'Necochea')];
  const home = estimateHome('Buenos Aires', legs, endpoints)!;
  assert.equal(home.source, 'ruta');
  assert.equal(home.place, 'aeropuerto internacional astor piazzolla');
  assert.deepEqual([home.lat, home.lon], [-37.9342, -57.5733]);
  near(home.km, 377, 5);
});

test('estimateHome ignores hubs and endpoints outside the deputy district', () => {
  // Ezeiza is in the province but is a hub; Rosario is in Santa Fe.
  const legs = Array.from({ length: 6 }, () => leg('AEROPUERTO INTERNACIONAL MINISTRO PISTARINI', 'AEROPUERTO INTERNACIONAL ISLAS MALVINAS'));
  const home = estimateHome('BUENOS AIRES', legs, endpoints)!;
  assert.equal(home.source, 'capital');
  assert.equal(home.place, 'La Plata');
  near(home.km, 53, 3);
});

test('estimateHome falls back to the capital with fewer than 3 legs touching the endpoint', () => {
  const legs = [leg(AEP, MDQ), leg(MDQ, AEP), leg('UNKNOWN', 'NOWHERE')];
  const home = estimateHome('BUENOS AIRES', legs, endpoints)!;
  assert.equal(home.source, 'capital');
  assert.equal(home.place, 'La Plata');
  assert.equal(estimateHome('BUENOS AIRES', [...legs, leg(AEP, MDQ)], endpoints)!.source, 'ruta');
});

test('estimateHome counts a leg once even when both ends are the same endpoint, ties alphabetical', () => {
  const legs = [leg('NECOCHEA', 'NECOCHEA'), leg('NECOCHEA', AEP), leg('NECOCHEA', AEP), leg(MDQ, AEP), leg(MDQ, AEP), leg(MDQ, AEP)];
  const home = estimateHome('BUENOS AIRES', legs, endpoints)!;
  // 3 legs each: "aeropuerto internacional astor piazzolla" < "necochea"
  assert.equal(home.place, 'aeropuerto internacional astor piazzolla');
});

test('estimateHome puts a CABA deputy at the city and returns null for an unknown district', () => {
  const home = estimateHome('CIUDAD DE BUENOS AIRES', [leg(AEP, 'RETIRO'), leg(AEP, 'RETIRO'), leg(AEP, 'RETIRO')], endpoints)!;
  assert.equal(home.source, 'capital');
  assert.equal(home.km, 0);
  assert.equal(estimateHome('ATLANTIDA', [], endpoints), null);
});
