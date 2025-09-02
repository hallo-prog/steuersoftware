import React, { useState, useEffect } from 'react';
import { Document, InvoiceType, Liability } from '../types';
import useDebounce from '../hooks/useDebounce';
import { XIcon } from './icons/XIcon';
import { updateDocument, fetchLiabilities } from '../services/supabaseDataService';
import { useThemeClasses } from '../hooks/useThemeClasses';

interface DocumentDetailModalProps {
  document: Document;
  userId: string;
  onClose: () => void;
  onUpdate: (document: Document) => void;
}

const DocumentDetailModal: React.FC<DocumentDetailModalProps> = ({ document, userId, onClose, onUpdate }) => {
  const [formData, setFormData] = useState(document);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const debouncedFormData = useDebounce(formData, 500);
  
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(true);

  useEffect(() => {
    setFormData(document);
    setIsLoadingPreview(true);
    setPreviewUrl(''); // Start with a clean slate

    let objectUrl: string | null = null;
    if (document.file) {
      // Create a temporary URL for the file blob. This is more performant and reliable than base64 encoding.
      objectUrl = URL.createObjectURL(document.file);
      setPreviewUrl(objectUrl);
      setIsLoadingPreview(false);
    } else {
      // If there's no file object, we cannot generate a preview.
      setIsLoadingPreview(false);
    }

    // This is a cleanup function. It runs when the component unmounts or before the effect runs again.
    // It's crucial for revoking the temporary URL to avoid memory leaks.
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [document]);

  useEffect(()=>{ (async()=>{ try { const list = await fetchLiabilities(userId); setLiabilities(list); } catch {} })(); },[document.id, userId]);


  useEffect(() => {
    if (JSON.stringify(debouncedFormData) !== JSON.stringify(document)) {
      // Persist to DB
      (async()=>{
        setIsSaving(true);
        try {
          const saved = await updateDocument(document.id, {
            name: debouncedFormData.name,
            vendor: debouncedFormData.vendor,
            taxCategory: debouncedFormData.taxCategory,
            invoiceNumber: debouncedFormData.invoiceNumber,
            date: new Date(debouncedFormData.date),
            totalAmount: debouncedFormData.totalAmount,
            vatAmount: debouncedFormData.vatAmount,
            invoiceType: debouncedFormData.invoiceType,
            liabilityId: (debouncedFormData as any).liabilityId,
          });
          onUpdate(saved);
        } catch (e) { console.warn('Persist Dokument fehlgeschlagen', e); }
        finally { setIsSaving(false); }
      })();
    }
  }, [debouncedFormData, document, onUpdate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => {
        let finalValue: any = value;
        if (type === 'number') {
          if (value === '') {
            finalValue = undefined; // leeres Feld => undefined statt 0, damit kein NaN/0 Geisterwert
          } else {
            const parsed = parseFloat(value.replace(',', '.'));
            finalValue = isFinite(parsed) ? parsed : undefined;
          }
        } else if (name === 'date') {
          const dt = new Date(value);
          finalValue = isNaN(dt.getTime()) ? prev.date : dt;
        }
        const updatedDoc: any = { ...prev, [name]: finalValue };
        if (name === 'date' && finalValue instanceof Date) {
          updatedDoc.year = finalValue.getFullYear();
          updatedDoc.quarter = Math.floor((finalValue.getMonth() + 3) / 3);
        }
        return updatedDoc;
    });
  };
            <div>
              <label htmlFor="liabilityId" className="block text-sm font-medium text-slate-600">Verbindlichkeit</label>
              <select name="liabilityId" value={(formData as any).liabilityId||''} onChange={handleChange} className="mt-1 block w-full p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500">
                <option value="">-- keine --</option>
                {liabilities.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            {isSaving && <div className="text-[10px] text-slate-400">Speichert...</div>}
  
  const fileType = document.file?.type || '';
  const name = document.name || '';

  const isPdf = fileType === 'application/pdf' || name.toLowerCase().endsWith('.pdf');
  const isImage = fileType.startsWith('image/') || 
                name.toLowerCase().endsWith('.png') || 
                name.toLowerCase().endsWith('.jpg') || 
                name.toLowerCase().endsWith('.jpeg') ||
                name.toLowerCase().endsWith('.gif');

  const ui = useThemeClasses();
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className={`${ui.card} rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col ${ui.border}`}>
        {/* Header */}
        <div className={`p-4 ${ui.divider} flex justify-between items-center flex-shrink-0`}>
          <h2 className={`text-lg font-bold truncate pr-4 ${ui.textPrimary}`}>{formData.name}</h2>
          <button onClick={onClose} className={`p-2 rounded-full ${ui.buttonGhost}`}><XIcon className="w-6 h-6" /></button>
        </div>
        
        {/* Content */}
        <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
          {/* Preview */}
          <div className="w-full md:w-2/3 h-1/2 md:h-full bg-slate-100 dark:bg-slate-900/40 overflow-auto border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-700">
            {isLoadingPreview ? (
                <div className="w-full h-full flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            ) : isPdf && previewUrl ? (
              <iframe src={previewUrl} title={document.name} className="w-full h-full border-0" />
            ) : isImage && previewUrl ? (
              <img src={previewUrl} alt="Document Preview" className="w-full h-full object-contain p-2" />
            ) : (
        <div className="w-full h-full flex items-center justify-center bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 p-4 text-center">
          <p>Vorschau für diesen Dateityp nicht verfügbar.</p>
                </div>
            )}
          </div>
          
          {/* Form */}
          <form className="w-full md:w-1/3 h-1/2 md:h-full overflow-y-auto p-6 space-y-4">
            <h3 className={`text-md font-semibold ${ui.textSecondary}`}>Extrahierte Daten</h3>
            <div>
              <label htmlFor="name" className={`block text-sm font-medium ${ui.textSecondary}`}>Dateiname</label>
              <input type="text" name="name" id="name" value={formData.name || ''} onChange={handleChange} className={`mt-1 block w-full p-2 rounded-lg shadow-sm ${ui.input} ${ui.ringFocus}`} />
            </div>
            <div>
              <label htmlFor="vendor" className={`block text-sm font-medium ${ui.textSecondary}`}>Verkäufer</label>
              <input type="text" name="vendor" id="vendor" value={formData.vendor || ''} onChange={handleChange} className={`mt-1 block w-full p-2 rounded-lg shadow-sm ${ui.input} ${ui.ringFocus}`} />
            </div>
             <div>
                <label htmlFor="taxCategory" className={`block text-sm font-medium ${ui.textSecondary}`}>Steuerkategorie</label>
                <input 
                    type="text" 
                    name="taxCategory" 
                    id="taxCategory" 
                    value={formData.taxCategory || ''} 
                    onChange={handleChange} 
                    className={`mt-1 block w-full p-2 rounded-lg shadow-sm ${ui.input} ${ui.ringFocus}`}
                    list="tax-categories"
                />
                <datalist id="tax-categories">
                    <option value="Photovoltaik" />
                    <option value="Einnahmen" />
                    <option value="Material/Waren" />
                    <option value="Kraftstoff" />
                    <option value="Bürobedarf" />
                    <option value="Bewirtungskosten" />
                    <option value="Reisekosten" />
                    <option value="Sonstiges" />
                </datalist>
            </div>
            <div>
              <label htmlFor="invoiceNumber" className={`block text-sm font-medium ${ui.textSecondary}`}>Rechnungsnummer</label>
              <input type="text" name="invoiceNumber" id="invoiceNumber" value={formData.invoiceNumber || ''} onChange={handleChange} className={`mt-1 block w-full p-2 rounded-lg shadow-sm ${ui.input} ${ui.ringFocus}`} />
            </div>
            <div>
                <label htmlFor="date" className={`block text-sm font-medium ${ui.textSecondary}`}>Datum</label>
                <input type="date" name="date" id="date" value={new Date(formData.date).toISOString().split('T')[0]} onChange={handleChange} className={`mt-1 block w-full p-2 rounded-lg shadow-sm ${ui.input} ${ui.ringFocus}`} />
            </div>
            <div className="flex space-x-4">
              <div className="w-1/2">
                <label htmlFor="totalAmount" className={`block text-sm font-medium ${ui.textSecondary}`}>Bruttobetrag</label>
                <input type="number" name="totalAmount" id="totalAmount" value={formData.totalAmount ?? ''} onChange={handleChange} className={`mt-1 block w-full p-2 rounded-lg shadow-sm ${ui.input} ${ui.ringFocus}`} step="0.01"/>
              </div>
              <div className="w-1/2">
                <label htmlFor="vatAmount" className={`block text-sm font-medium ${ui.textSecondary}`}>MwSt.</label>
                <input type="number" name="vatAmount" id="vatAmount" value={formData.vatAmount ?? ''} onChange={handleChange} className={`mt-1 block w-full p-2 rounded-lg shadow-sm ${ui.input} ${ui.ringFocus}`} step="0.01"/>
              </div>
            </div>
            <div>
                <label htmlFor="invoiceType" className={`block text-sm font-medium ${ui.textSecondary}`}>Rechnungstyp</label>
                <select name="invoiceType" id="invoiceType" value={formData.invoiceType} onChange={handleChange} className={`mt-1 block w-full p-2 rounded-lg shadow-sm ${ui.input} ${ui.ringFocus}`}>
                    <option value={InvoiceType.INCOMING}>Eingangsrechnung</option>
                    <option value={InvoiceType.OUTGOING}>Ausgangsrechnung</option>
                </select>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default DocumentDetailModal;