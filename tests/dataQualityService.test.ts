import { describe, it, expect } from 'vitest';
import { computeDataQualityIssues, summarizeIssues } from '../services/dataQualityService';
import { ColumnMeta } from '../services/tableMetadataService';

describe('dataQualityService', () => {
  const cols: ColumnMeta[] = [
    { name: 'id', type: 'uuid', nullable: false, missingFraction: 0 },
    { name: 'description', type: 'string', nullable: true, missingFraction: 0.55 },
    { name: 'amount', type: 'number', nullable: false, missingFraction: 0.25 },
    { name: 'note', type: 'string', nullable: true, missingFraction: 0.08 },
  ];

  it('computes issues with correct severities and order', () => {
    const issues = computeDataQualityIssues(cols);
    expect(issues.length).toBe(3); // id has 0 missing
    expect(issues[0].severity).toBe('critical');
    // ensure ordering by severity then fraction
    const fractions = issues.map(i=>i.missingFraction);
    expect(fractions[0]).toBeGreaterThanOrEqual(fractions[1]);
  });

  it('summarizes issues', () => {
    const issues = computeDataQualityIssues(cols);
    const summary = summarizeIssues(issues);
    expect(summary).toContain('kritisch');
  });

  it('empty summary when no issues', () => {
    const summary = summarizeIssues([]);
    expect(summary.toLowerCase()).toContain('keine');
  });
});
