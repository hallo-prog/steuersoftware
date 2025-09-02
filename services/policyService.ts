import { upsertPolicy, fetchPolicies } from './supabaseDataService';
import { InsurancePolicy } from '../types';
import { supabase } from '../src/supabaseClient';

// Snapshot aktueller Zustand einer Policy in policy_versions speichern
export const savePolicyVersion = async (policy: InsurancePolicy, userId?: string) => {
  try {
    await supabase.from('policy_versions').insert({
      policy_id: policy.id,
      snapshot_json: policy,
      changed_by: userId,
    });
  } catch (e) {
    console.warn('Policy version save failed', e);
  }
};

export const listPolicies = fetchPolicies;

export const createOrUpdatePolicy = async (userId: string, patch: Partial<InsurancePolicy>) => {
  const saved = await upsertPolicy(userId, patch);
  // Version snapshot nur bei Update (existierende ID) oder wenn neue Policy erfolgreich gespeichert
  await savePolicyVersion(saved, userId);
  return saved;
};
