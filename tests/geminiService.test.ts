import { describe, it, expect } from 'vitest';
import { createEmailFromTemplate } from '../services/geminiService';

// Simple mock test (no real API key) to ensure deterministic mock branch works

describe('createEmailFromTemplate (mock)', () => {
  it('returns mock draft without api key', async () => {
    const res = await createEmailFromTemplate('', { template: 'ratenzahlung', params: { rate: '500' } });
    expect(res.subject).toContain('ratenzahlung');
    expect(res.body.toLowerCase()).toContain('demo');
  });
});
