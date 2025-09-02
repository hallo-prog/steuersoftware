import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchLiabilities, upsertLiability, deleteLiability, fetchLiabilityDocuments, uploadLiabilityDocument, deleteLiabilityDocument } from '../services/supabaseDataService';

// In-Memory Stores
let liabilities: any[] = [];
let liabilityDocs: any[] = [];
let storageUploads: any[] = [];

// Mock supabase client similar zu chatService Tests
vi.mock('../src/supabaseClient', () => {
  return {
    supabase: {
      from: (table: string) => {
        return {
          insert: (row: any) => {
            if (table === 'liabilities') {
              const data = { id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...row };
              liabilities.push(data);
              return { select: () => ({ single: () => ({ data, error: null }) }) } as any;
            }
            if (table === 'liability_documents') {
              const data = { id: crypto.randomUUID(), uploaded_at: new Date().toISOString(), ...row };
              liabilityDocs.push(data);
              return { select: () => ({ single: () => ({ data, error: null }) }) } as any;
            }
            return { select: () => ({ single: () => ({ data: null, error: null }) }) } as any;
          },
          select: () => ({
            eq: (_col: string, val: any) => ({
              order: (_o: any, _opts: any) => {
                if (table === 'liabilities') {
                  const data = liabilities.filter(l => l.user_id === val).sort((a,b)=> new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                  return { data, error: null };
                }
                if (table === 'liability_documents') {
                  const data = liabilityDocs.filter(d => d.liability_id === val).sort((a,b)=> new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
                  return { data, error: null };
                }
                return { data: [], error: null };
              },
              single: () => {
                if (table === 'liabilities') {
                  const data = liabilities.find(l => l.id === val) || null;
                  return { data, error: null };
                }
                return { data: null, error: null };
              }
            })
          }),
          update: (patch: any) => ({
            eq: (_col: string, id: string) => {
              if (table === 'liabilities') {
                liabilities = liabilities.map(l => l.id === id ? { ...l, ...patch, updated_at: new Date().toISOString() } : l);
                const data = liabilities.find(l=>l.id===id);
                return { select: () => ({ single: () => ({ data, error: null }) }) } as any;
              }
              return { select: () => ({ single: () => ({ data: null, error: null }) }) } as any;
            }
          }),
          delete: () => ({
            eq: (_col: string, id: string) => {
              if (table === 'liabilities') {
                liabilities = liabilities.filter(l=>l.id!==id);
              }
              if (table === 'liability_documents') {
                liabilityDocs = liabilityDocs.filter(d=>d.id!==id);
              }
              return { error: null };
            }
          })
        };
      },
      storage: {
        from: (bucket: string) => ({
          upload: async (path: string, _file: File) => { storageUploads.push({ bucket, path }); return { error: null }; },
          getPublicUrl: (path: string) => ({ data: { publicUrl: `https://mock.supabase.co/storage/v1/object/public/${bucket}/${path}` } }),
          remove: async (_paths: string[]) => ({ data: null, error: null })
        })
      }
    }
  };
});

describe('Liabilities Service', () => {
  const userId = 'user-1';
  beforeEach(() => { liabilities = []; liabilityDocs = []; storageUploads = []; });

  it('erstellt neue Verbindlichkeit', async () => {
    const saved = await upsertLiability(userId, { name: 'Darlehen A', outstandingAmount: 5000, category: 'Darlehen' });
    expect(saved.id).toBeDefined();
    const list = await fetchLiabilities(userId);
    expect(list.length).toBe(1);
    expect(list[0].name).toBe('Darlehen A');
    expect(list[0].outstandingAmount).toBe(5000);
  });

  it('aktualisiert bestehende Verbindlichkeit', async () => {
    const saved = await upsertLiability(userId, { name: 'Leasing X', category: 'Leasing' });
    const updated = await upsertLiability(userId, { id: saved.id, name: 'Leasing X2', interestRatePercent: 4.5 });
    expect(updated.name).toBe('Leasing X2');
    expect(updated.interestRatePercent).toBe(4.5);
    const list = await fetchLiabilities(userId);
    expect(list[0].name).toBe('Leasing X2');
  });

  it('löscht Verbindlichkeit', async () => {
    const a = await upsertLiability(userId, { name: 'A' });
    await upsertLiability(userId, { name: 'B' });
    await deleteLiability(a.id);
    const list = await fetchLiabilities(userId);
    expect(list.length).toBe(1);
    expect(list[0].name).toBe('B');
  });

  it('lädt & entfernt Dokumente zu Verbindlichkeit', async () => {
    const liab = await upsertLiability(userId, { name: 'DocTest' });
    // simulate File (JS DOM File not needed for path logic)
    const fakeFile = new File([new Uint8Array([1,2,3])], 'vertrag.pdf', { type: 'application/pdf' });
    const uploaded = await uploadLiabilityDocument(userId, liab.id, fakeFile);
    expect(uploaded.fileName).toBe('vertrag.pdf');
    expect(uploaded.publicUrl).toContain('/liabilities/');
    const docs = await fetchLiabilityDocuments(liab.id);
    expect(docs.length).toBe(1);
    await deleteLiabilityDocument(uploaded.id);
    const after = await fetchLiabilityDocuments(liab.id);
    expect(after.length).toBe(0);
  });
});
