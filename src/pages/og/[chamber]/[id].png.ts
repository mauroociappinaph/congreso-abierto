// Share image of every legislator page (/og/diputados/<id>.png, /og/senadores/<id>.png): a 1200x630 PNG drawn at
// build time from the snapshot, with the legislator's initials, chamber, district, bloc and one key number.
import type { APIRoute, GetStaticPaths } from 'astro';
import { keyFigure, renderShareImage, type CardInput } from '../../../lib/og-image.ts';
import { loadDeputies, loadEntities, loadSenateVotes, loadSenators, loadTravel } from '../../../lib/sources.ts';

export const getStaticPaths = (async () => {
  const deputies = await loadDeputies();
  const { senators } = await loadSenators();
  const [{ relations }, travel, votes] = await Promise.all([loadEntities(), loadTravel(deputies), loadSenateVotes(senators)]);
  const legsPerMonth = new Map(travel.analysis.deputies.map(t => [t.deputyId, t.legsPerMonth]));
  const card = (person: { id: string; nombre: string; lugar: string }): CardInput => {
    const rel = relations.get(person.id)!;
    return {
      camara: rel.camara,
      nombre: person.nombre,
      distrito: rel.province?.nombre ?? (person.lugar || null),
      bloc: rel.bloc.titulo,
      key: keyFigure({
        camara: rel.camara,
        legsPerMonth: legsPerMonth.get(person.id) ?? null,
        bills: rel.counts.bills,
        asistencia: votes.summary.senators.get(person.id)?.asistencia ?? null,
      }),
    };
  };
  return [
    ...deputies.map(d => ({ params: { chamber: 'diputados', id: d.id }, props: { card: card(d) } })),
    ...senators.map(s => ({ params: { chamber: 'senadores', id: s.id }, props: { card: card(s) } })),
  ];
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const png = await renderShareImage((props as { card: CardInput }).card);
  return new Response(png, { headers: { 'Content-Type': 'image/png' } });
};
