import { supabase } from '../src/supabaseClient';

export const fetchFeatureFlags = async (userId: string): Promise<Record<string, boolean>> => {
  const { data, error } = await supabase.from('feature_flags').select('*').eq('user_id', userId);
  if (error) throw error;
  const map: Record<string, boolean> = {};
  for (const row of data||[]) map[row.flag] = !!row.enabled;
  return map;
};

export const setFeatureFlag = async (userId: string, flag: string, enabled: boolean) => {
  const { error } = await supabase.from('feature_flags').upsert({ user_id: userId, flag, enabled });
  if (error) throw error;
};
