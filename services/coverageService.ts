import { supabase } from '../src/supabaseClient';

export interface CoverageItem {
  id: string;
  policy_id: string;
  label: string;
  limit_amount?: number|null;
  deductible_amount?: number|null;
  created_at: string;
}

export interface ExclusionItem {
  id: string;
  policy_id: string;
  label: string;
  created_at: string;
}

export const fetchCoverageItems = async (policyId: string): Promise<CoverageItem[]> => {
  const { data, error } = await supabase.from('coverage_items').select('*').eq('policy_id', policyId).order('created_at');
  if (error) throw error; return data as CoverageItem[];
};

export const upsertCoverageItem = async (policyId: string, item: Partial<CoverageItem>): Promise<CoverageItem> => {
  const payload: any = { ...item, policy_id: policyId };
  const { data, error } = await supabase.from('coverage_items').upsert(payload).select().single();
  if (error) throw error; return data as CoverageItem;
};

export const deleteCoverageItem = async (id: string) => {
  const { error } = await supabase.from('coverage_items').delete().eq('id', id);
  if (error) throw error;
};

export const fetchExclusions = async (policyId: string): Promise<ExclusionItem[]> => {
  const { data, error } = await supabase.from('exclusions').select('*').eq('policy_id', policyId).order('created_at');
  if (error) throw error; return data as ExclusionItem[];
};

export const upsertExclusion = async (policyId: string, item: Partial<ExclusionItem>): Promise<ExclusionItem> => {
  const payload: any = { ...item, policy_id: policyId };
  const { data, error } = await supabase.from('exclusions').upsert(payload).select().single();
  if (error) throw error; return data as ExclusionItem;
};

export const deleteExclusion = async (id: string) => {
  const { error } = await supabase.from('exclusions').delete().eq('id', id);
  if (error) throw error;
};
