import { upsertClaim } from './supabaseDataService';
import { InsuranceClaim, ClaimEvent } from '../types';
import { supabase } from '../src/supabaseClient';

// Definierte Statuswerte
export type ClaimStatus = 'offen' | 'in_pruefung' | 'dokumentation' | 'abgeschlossen' | 'abgelehnt';

// Erlaubte Transitionen (DAG)
const allowed: Record<ClaimStatus, ClaimStatus[]> = {
  offen: ['in_pruefung','abgelehnt'],
  in_pruefung: ['dokumentation','abgelehnt'],
  dokumentation: ['abgeschlossen','abgelehnt'],
  abgeschlossen: [],
  abgelehnt: [],
};

export const allowedTransitions = (from?: string): ClaimStatus[] => {
  const f = (from as ClaimStatus) || 'offen';
  return allowed[f] || [];
};

export class ClaimTransitionError extends Error {
  constructor(public from: string, public to: string) {
    super(`Ungültige Claim Transition: ${from} -> ${to}`);
    this.name = 'ClaimTransitionError';
  }
}

export const createClaim = async (userId: string, data: Omit<InsuranceClaim,'id'|'createdAt'|'documents'|'status'> & { status?: ClaimStatus }): Promise<InsuranceClaim> => {
  const saved = await upsertClaim(userId, { ...data, status: data.status||'offen' });
  await logEvent(saved.id, 'created', { status: saved.status });
  return saved;
};

export const transitionClaim = async (userId: string, claim: InsuranceClaim, target: ClaimStatus): Promise<InsuranceClaim> => {
  const from = (claim.status as ClaimStatus) || 'offen';
  if (!allowed[from].includes(target)) {
    throw new ClaimTransitionError(from, target);
  }
  const saved = await upsertClaim(userId, { id: claim.id, policyId: claim.policyId, type: claim.type as any, title: claim.title, description: claim.description, status: target, aiSummary: claim.aiSummary, aiRecommendation: claim.aiRecommendation });
  await logEvent(claim.id, 'status_changed', { from, to: target });
  return saved;
};

export const logEvent = async (claimId: string, event: string, payload?: any) => {
  try { await supabase.from('claim_events').insert({ claim_id: claimId, event_type: event, payload_json: payload }); } catch (e) { console.warn('claim event log failed', e); }
};

export const fetchClaimEvents = async (claimId: string): Promise<ClaimEvent[]> => {
  try {
    const { data, error } = await supabase.from('claim_events').select('*').eq('claim_id', claimId).order('created_at',{ascending:true});
    if (error) throw error;
    return (data||[]).map(r => ({ id: r.id, claimId: r.claim_id, eventType: r.event_type, payloadJson: r.payload_json, createdAt: r.created_at }));
  } catch { return []; }
};
