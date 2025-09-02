import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createChatThread, renameChatThread, fetchChatThreads, appendChatMessage, fetchChatMessages, deleteChatThread } from '../services/supabaseDataService';

// In-Memory DB
let threads: any[] = [];
let messages: any[] = [];

vi.mock('../src/supabaseClient', () => {
  return {
    supabase: {
      from: (table: string) => {
        return {
          insert: (row: any) => {
            if (table === 'chat_threads') {
              const data = { id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...row };
              threads.push(data);
              return { select: () => ({ single: () => ({ data, error: null }) }) } as any;
            }
            if (table === 'chat_messages') {
              const data = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row };
              messages.push(data);
              return { select: () => ({ single: () => ({ data, error: null }) }) } as any;
            }
            return { select: () => ({ single: () => ({ data: null, error: null }) }) } as any;
          },
          select: () => ({
            eq: (col: string, val: any) => ({
              order: (_: any, opts: any) => {
                if (table === 'chat_threads') {
                  const data = threads.filter(t => t.user_id === val).sort((a,b)=> new Date(b.updated_at).getTime()-new Date(a.updated_at).getTime());
                  return { data, error: null };
                }
                if (table === 'chat_messages') {
                  const data = messages.filter(m => m.thread_id === val).sort((a,b)=> new Date(a.created_at).getTime()-new Date(b.created_at).getTime());
                  return { data, error: null };
                }
                return { data: [], error: null };
              },
              single: () => {
                if (table === 'chat_threads') {
                  const data = threads.find(t => t.id === val) || null;
                  return { data, error: null };
                }
                return { data: null, error: null };
              }
            })
          }),
          update: (patch: any) => ({
            eq: (_col: string, id: string) => {
              if (table === 'chat_threads') {
                threads = threads.map(t => t.id === id ? { ...t, ...patch, updated_at: new Date().toISOString() } : t);
              }
              return { };
            }
          }),
          delete: () => ({
            eq: (_col: string, id: string) => {
              if (table === 'chat_threads') {
                threads = threads.filter(t=>t.id!==id);
                messages = messages.filter(m=>m.thread_id!==id);
              }
              return { error: null };
            }
          })
        };
      }
    }
  };
});

describe('Chat Service CRUD', () => {
  const userId = 'user-1';
  beforeEach(() => { threads = []; messages = []; });

  it('creates thread and auto-lists it', async () => {
    await createChatThread(userId, 'Test Thread');
    const list = await fetchChatThreads(userId);
    expect(list.length).toBe(1);
    expect(list[0].title).toBe('Test Thread');
  });

  it('renames thread', async () => {
    const th = await createChatThread(userId, 'Alt');
    await renameChatThread(th.id, 'Neu');
    const list = await fetchChatThreads(userId);
    expect(list[0].title).toBe('Neu');
  });

  it('appends and fetches messages', async () => {
    const th = await createChatThread(userId, 'Msg');
    await appendChatMessage(th.id, 'user', 'Hallo');
    await appendChatMessage(th.id, 'model', 'Hi');
    const msgs = await fetchChatMessages(th.id);
    expect(msgs.map(m=>m.content)).toEqual(['Hallo','Hi']);
  });

  it('deletes thread cascades messages', async () => {
    const th = await createChatThread(userId, 'Del');
    await appendChatMessage(th.id, 'user', 'x');
    await deleteChatThread(th.id);
    const list = await fetchChatThreads(userId);
    expect(list.length).toBe(0);
  });
});
