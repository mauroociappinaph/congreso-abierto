// Pure assembly of each current legislator's detail from the linked sources (committees, bills, missions,
// Senate votes). Sources keyed by other ids (former legislators, the other chamber) are ignored.
import type { DeputyCommittee } from './comisiones.ts';
import type { DeputyMissions } from './misiones.ts';
import { STAGES, type AuthorBills, type RecentBill, type Stage } from './proyectos.ts';
import type { SenatorVotes } from './senado-votos.ts';

export interface BillsProfile {
  total: number;
  // most frequent first
  porTipo: { tipo: string; count: number }[];
  // in stage order; alcanzado = bills whose furthest stage is this one or a later one
  funnel: { stage: Stage; count: number; alcanzado: number }[];
  recent: RecentBill[];
}

export type MissionsProfile = Omit<DeputyMissions, 'deputyId'>;

export interface DeputyProfile {
  id: string;
  committees: DeputyCommittee[];
  bills: BillsProfile | null;
  missions: MissionsProfile | null;
}

export interface SenatorProfile {
  id: string;
  votes: SenatorVotes | null;
  bills: BillsProfile | null;
}

export function billsProfile(bills: AuthorBills): BillsProfile {
  const porTipo = Object.entries(bills.byTipo)
    .map(([tipo, count]) => ({ tipo, count }))
    .sort((a, b) => b.count - a.count || a.tipo.localeCompare(b.tipo, 'es'));
  const funnel = STAGES.map((stage, i) => ({
    stage,
    count: bills.stages[stage],
    alcanzado: STAGES.slice(i).reduce((sum, s) => sum + bills.stages[s], 0),
  }));
  return { total: bills.total, porTipo, funnel, recent: bills.recent };
}

export function buildDeputyProfiles(
  deputies: { id: string }[],
  sources: { committees: Map<string, DeputyCommittee[]>; bills: Map<string, AuthorBills>; missions: DeputyMissions[] },
): Map<string, DeputyProfile> {
  const missions = new Map(sources.missions.map(({ deputyId, ...rest }) => [deputyId, rest]));
  return new Map(deputies.map(({ id }) => {
    const bills = sources.bills.get(id);
    return [id, { id, committees: sources.committees.get(id) ?? [], bills: bills ? billsProfile(bills) : null, missions: missions.get(id) ?? null }];
  }));
}

export function buildSenatorProfiles(
  senators: { id: string }[],
  sources: { votes: Map<string, SenatorVotes>; bills: Map<string, AuthorBills> },
): Map<string, SenatorProfile> {
  return new Map(senators.map(({ id }) => {
    const bills = sources.bills.get(id);
    return [id, { id, votes: sources.votes.get(id) ?? null, bills: bills ? billsProfile(bills) : null }];
  }));
}
