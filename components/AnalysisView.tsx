import React, { useState, useMemo } from 'react';
import { Document, InvoiceType } from '../types';
import ChartBarIcon from './icons/ChartBarIcon';
import { CalculatorIcon } from './icons/CalculatorIcon';

interface AnalysisViewProps {
  documents: Document[];
}

interface AnalysisData {
  count: number;
  expenses: { total: number; vat: number; };
  revenue: { total: number; vat: number; };
}

const StatCard: React.FC<{ title: string; value: string; colorClass?: string; children?: React.ReactNode }> = ({ title, value, colorClass = 'text-slate-800', children }) => (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <p className={`text-2xl font-bold mt-1 ${colorClass}`}>{value}</p>
        {children}
    </div>
);


const AnalysisView: React.FC<AnalysisViewProps> = ({ documents }) => {
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedQuarter, setSelectedQuarter] = useState<string>('all');

  const availableYears = useMemo(() => {
    const years = new Set(documents.map(doc => doc.year));
    return Array.from(years).sort((a, b) => b - a);
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      const yearMatch = selectedYear === 'all' || doc.year === parseInt(selectedYear, 10);
      const quarterMatch = selectedQuarter === 'all' || doc.quarter === parseInt(selectedQuarter, 10);
      return yearMatch && quarterMatch;
    });
  }, [documents, selectedYear, selectedQuarter]);

  const analysisData = useMemo<AnalysisData>(() => {
    return filteredDocuments.reduce((acc, doc) => {
      acc.count++;
      if (doc.invoiceType === InvoiceType.INCOMING) {
        acc.expenses.total += doc.totalAmount || 0;
        acc.expenses.vat += doc.vatAmount || 0;
      } else {
        acc.revenue.total += doc.totalAmount || 0;
        acc.revenue.vat += doc.vatAmount || 0;
      }
      return acc;
    }, { 
      count: 0, 
      expenses: { total: 0, vat: 0 },
      revenue: { total: 0, vat: 0 }
    });
  }, [filteredDocuments]);
  
  const taxBalance = analysisData.revenue.vat - analysisData.expenses.vat;
  const isPaymentDue = taxBalance > 0;
  
  const tableData = useMemo(() => {
    const data: { [key: string]: AnalysisData } = {};
    const groupKey = selectedYear === 'all' ? 'year' : 'quarter';

    filteredDocuments.forEach(doc => {
        const key = doc[groupKey];
        if (!data[key]) {
            data[key] = { 
              count: 0, 
              expenses: { total: 0, vat: 0 },
              revenue: { total: 0, vat: 0 } 
            };
        }
        data[key].count++;
        if (doc.invoiceType === InvoiceType.INCOMING) {
          data[key].expenses.total += doc.totalAmount || 0;
          data[key].expenses.vat += doc.vatAmount || 0;
        } else {
          data[key].revenue.total += doc.totalAmount || 0;
          data[key].revenue.vat += doc.vatAmount || 0;
        }
    });
    
    return Object.entries(data).map(([key, value]) => ({
      label: groupKey === 'year' ? key : `Q${key}`,
      ...value
    })).sort((a,b) => b.label.localeCompare(a.label));
  }, [filteredDocuments, selectedYear]);

  const formatCurrency = (amount: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h2 className="text-3xl font-bold text-slate-800">Auswertung</h2>
        <div className="flex space-x-2 w-full md:w-auto">
          <select 
            value={selectedYear} 
            onChange={e => setSelectedYear(e.target.value)}
            className="bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
          >
            <option value="all">Alle Jahre</option>
            {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
          </select>
          <select 
            value={selectedQuarter} 
            onChange={e => setSelectedQuarter(e.target.value)}
            disabled={selectedYear === 'all'}
            className="bg-white border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 disabled:bg-slate-50"
          >
            <option value="all">Alle Quartale</option>
            {[1, 2, 3, 4].map(q => <option key={q} value={q}>Quartal {q}</option>)}
          </select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="space-y-6">
        {/* Main Result Card */}
        <div className={`bg-white p-6 rounded-xl shadow-sm border-l-4 ${isPaymentDue ? 'border-red-500' : 'border-green-500'}`}>
           <div className="flex items-center">
             <div className={`rounded-lg p-3 mr-4 ${isPaymentDue ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                <CalculatorIcon className="w-8 h-8" />
             </div>
             <div>
                <p className="text-sm font-semibold text-slate-500">{isPaymentDue ? 'Voraussichtliche Umsatzsteuer-Zahllast' : 'Voraussichtlicher Vorsteuer-Überhang'}</p>
                <p className={`text-3xl font-bold ${isPaymentDue ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(Math.abs(taxBalance))}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                    {isPaymentDue ? 'Betrag an das Finanzamt zu zahlen' : 'Erstattung vom Finanzamt zu erwarten'}
                </p>
             </div>
           </div>
        </div>
        
        {/* Detailed cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <StatCard title="Anzahl Belege" value={analysisData.count.toString()} />
            <StatCard title="Gesamte Ausgaben (Brutto)" value={formatCurrency(analysisData.expenses.total)} />
            <StatCard title="davon Vorsteuer" value={formatCurrency(analysisData.expenses.vat)} colorClass="text-green-600" />
            <div className="hidden lg:block"></div> {/* Spacer */}
            <StatCard title="Gesamte Einnahmen (Brutto)" value={formatCurrency(analysisData.revenue.total)} />
            <StatCard title="davon Umsatzsteuer" value={formatCurrency(analysisData.revenue.vat)} colorClass="text-red-600" />
        </div>
      </div>


      {/* Data Table */}
      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-800 mb-4 px-2 sm:px-0">
            {selectedYear === 'all' ? 'Jahresübersicht' : `Quartalsübersicht für ${selectedYear}`}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-500">
            <thead className="text-xs text-slate-700 uppercase bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3">{selectedYear === 'all' ? 'Jahr' : 'Quartal'}</th>
                <th scope="col" className="px-6 py-3 text-right">Anz. Belege</th>
                <th scope="col" className="px-6 py-3 text-right">Brutto-Ausgaben</th>
                <th scope="col" className="px-6 py-3 text-right">Vorsteuer</th>
                <th scope="col" className="px-6 py-3 text-right">Brutto-Einnahmen</th>
                <th scope="col" className="px-6 py-3 text-right">Umsatzsteuer</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map(row => (
                <tr key={row.label} className="bg-white border-b border-slate-200 hover:bg-slate-50">
                  <th scope="row" className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                    {row.label}
                  </th>
                  <td className="px-6 py-4 text-right">{row.count}</td>
                  <td className="px-6 py-4 text-right">{formatCurrency(row.expenses.total)}</td>
                  <td className="px-6 py-4 text-right text-green-600 font-semibold">{formatCurrency(row.expenses.vat)}</td>
                  <td className="px-6 py-4 text-right">{formatCurrency(row.revenue.total)}</td>
                  <td className="px-6 py-4 text-right text-red-600 font-semibold">{formatCurrency(row.revenue.vat)}</td>
                </tr>
              ))}
               {tableData.length === 0 && (
                <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-500">
                        Keine Daten für die aktuelle Auswahl vorhanden.
                    </td>
                </tr>
               )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AnalysisView;