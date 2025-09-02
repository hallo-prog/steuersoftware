import { useEffect, useState, useCallback } from 'react';
import { fetchFeatureFlags, setFeatureFlag } from '../services/featureFlagService';
import { FeatureFlagsMap } from '../types';

export const useFeatureFlags = (userId?: string) => {
  const [flags, setFlags] = useState<FeatureFlagsMap>({});
  const [loading, setLoading] = useState(false);
  useEffect(()=>{ if(!userId) return; let active = true; (async()=>{ setLoading(true); try { const f = await fetchFeatureFlags(userId); if(active) setFlags(f); } finally { if(active) setLoading(false); } })(); return ()=>{ active=false; }; },[userId]);

  const toggle = useCallback(async (flag: string, value: boolean) => {
    if(!userId) return;
    setFlags(prev => ({ ...prev, [flag]: value }));
    try { await setFeatureFlag(userId, flag, value); } catch { /* rollback? minimal */ }
  }, [userId]);

  return { flags, loading, toggle };
};

export const useFeatureFlag = (flag: string, userId?: string) => {
  const { flags, loading } = useFeatureFlags(userId);
  return { enabled: !!flags[flag], loading };
};
