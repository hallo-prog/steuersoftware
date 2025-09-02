import { Liability } from '../types';

export interface LiabilityCategoryStat {
  category: string;
  count: number;
  sumOutstanding: number; // Summe offener Restbeträge
  avgInterest: number | null; // Durchschnittszins oder null falls keine Werte
  topIds: string[]; // erste bis zu 5 IDs für Schnellzugriff
}

export const computeLiabilityCategoryStats = (liabilities: Liability[], categories?: string[]): LiabilityCategoryStat[] => {
  const byCat: Record<string, Liability[]> = {};
  for (const l of liabilities) {
    const cat = l.category || 'Sonstige';
    (byCat[cat] ||= []).push(l);
  }
  const cats = categories && categories.length ? categories : Object.keys(byCat);
  return cats.filter(c=> byCat[c] && byCat[c].length).map(cat => {
    const list = byCat[cat];
    const sumOutstanding = list.reduce((s,l)=> s + (l.outstandingAmount||0),0);
    const interestVals = list.filter(l=> l.interestRatePercent!=null).map(l=> l.interestRatePercent!);
    const avgInterest = interestVals.length? interestVals.reduce((a,b)=>a+b,0)/interestVals.length : null;
    return {
      category: cat,
      count: list.length,
      sumOutstanding,
      avgInterest,
      topIds: list.slice(0,5).map(l=>l.id),
    };
  });
};

export const formatEuro = (value: number) => value.toLocaleString('de-DE') + ' €';