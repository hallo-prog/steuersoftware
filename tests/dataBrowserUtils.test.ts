import { describe, it, expect } from 'vitest';
import { computeVirtualWindow, applyOptimisticUpdate, mapPostgrestError } from '../services/dataBrowserUtils';
import { extractForeignKeys } from '../services/tableMetadataService';

describe('dataBrowserUtils', () => {
  it('computeVirtualWindow basic', () => {
    const v = computeVirtualWindow(1000, 20, 200, 200, 2);
    // scrollTop 200 -> startIndex ~10
    expect(v.start).toBeGreaterThanOrEqual(8);
    expect(v.end).toBeGreaterThan(v.start);
    expect(v.padTop).toBe(v.start * 20);
  });

  it('applyOptimisticUpdate returns revert', () => {
    const rows = [{id:1, name:'A'},{id:2,name:'B'}];
    const { newRows, revert } = applyOptimisticUpdate(rows, 1, 'name', 'C');
    expect(newRows[1].name).toBe('C');
    const reverted = revert();
    expect(reverted[1].name).toBe('B');
  });

  it('mapPostgrestError duplicate', () => {
    const msg = mapPostgrestError({ code: '23505', message: 'duplicate key value violates unique constraint' });
    expect(msg.toLowerCase()).toContain('konflikt');
  });

  it('extractForeignKeys heuristic', () => {
    const cols = [
      { name:'id', type:'uuid', nullable:false },
      { name:'policy_id', type:'uuid', nullable:true, foreignKeyRef:'policyes' }, // heuristik generiert base + 's'
      { name:'user_id', type:'uuid', nullable:false },
      { name:'liability_id', type:'uuid', nullable:true, foreignKeyRef:'liabilitys' }
    ] as any;
    const fks = extractForeignKeys(cols);
    expect(fks.find(f=>f.column==='policy_id')).toBeTruthy();
    expect(fks.find(f=>f.column==='user_id')).toBeFalsy();
  });
});
