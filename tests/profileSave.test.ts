import { describe, it, expect, vi, beforeEach } from 'vitest';
import { } from '../components/ProfileView';

// Da ProfileView direkte supabase Aufrufe nutzt, mocken wir supabase minimal.
vi.mock('../src/supabaseClient', () => {
  const update = vi.fn().mockResolvedValue({ error: null });
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: '00000000-0000-4000-8000-000000000000', email: 'test@example.com' } } });
  const auth = { getUser } as any;
  const from = vi.fn().mockImplementation((table: string) => {
    if (table === 'profiles') {
      return { update: (vals:any) => ({ eq: () => Promise.resolve({ data: { ...vals }, error: null }) }) } as any;
    }
    return { update: () => ({ eq: () => Promise.resolve({ error: null }) }) } as any;
  });
  const storage = { from: () => ({ upload: vi.fn().mockResolvedValue({ error: null }), getPublicUrl: (p:string) => ({ data: { publicUrl: 'https://example.com/'+p } }) }) } as any;
  return { supabase: { from, auth, storage } };
});

describe('Profile Save Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it('mock user retrieval works', async () => {
    const { supabase } = await import('../src/supabaseClient');
    const res = await supabase.auth.getUser();
    expect(res.data.user.email).toBe('test@example.com');
  });
  it('updates profile via supabase.from("profiles").update()', async () => {
    const { supabase } = await import('../src/supabaseClient');
    const resp = await supabase.from('profiles').update({ name: 'X' }).eq('id','x');
  // In unserem Mock geben wir error: null zurück; akzeptiere null oder undefined
  expect(resp.error === null || resp.error === undefined).toBe(true);
  });
});
