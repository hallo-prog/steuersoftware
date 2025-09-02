import { describe, it, expect } from 'vitest';
import { normalizeContactName, dedupeContactsArray } from '../services/contactDedupe';

describe('contactDedupe', () => {
  it('normalizes company suffixes and spacing', () => {
    expect(normalizeContactName('ACME GmbH & Co. KG')).toBe('acme');
    expect(normalizeContactName('  ACME   gmbh ')).toBe('acme');
  });

  it('dedupes by normalized name, email, and phone', () => {
    const input = [
      { name: 'Acme GmbH', email: 'info@acme.de', sourceIds: ['a'] },
      { name: 'ACME', phone: '+49 30 123', sourceIds: ['b'] },
      { name: 'Other AG', email: 'sales@other.de', sourceIds: ['c'] },
      { name: 'Other', email: 'sales@other.de', sourceIds: ['d'] },
    ];
    const out = dedupeContactsArray(input);
    // Should merge first two
    const acme = out.find(c => c.name?.toLowerCase().includes('acme'))!;
    expect(acme.sourceIds?.length).toBe(2);
    // Should merge other entries by identical email
    const other = out.find(c => c.email==='sales@other.de')!;
    expect(other.sourceIds?.length).toBe(2);
  });
});
