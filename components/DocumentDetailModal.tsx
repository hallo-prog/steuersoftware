import React, { useState, useEffect } from 'react';
import { Document, InvoiceType } from '../types';
import useDebounce from '../hooks/useDebounce';
import { XIcon } from './icons/XIcon';

interface DocumentDetailModalProps {
  document: Document;
  onClose: () => void;
  onUpdate: (document: Document) => void;
}

const DocumentDetailModal: React.FC<DocumentDetailModalProps> = ({ document, onClose, onUpdate }) => {
  const [formData, setFormData] = useState(document);
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
  }, [document]); // This effect re-runs whenever the document prop changes.


  useEffect(() => {
    if (JSON.stringify(debouncedFormData) !== JSON.stringify(document)) {
      onUpdate(debouncedFormData);
    }
  }, [debouncedFormData, document, onUpdate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => {
        let finalValue: string | number | Date = value;

        if (type === 'number') {
            finalValue = value === '' ? 0 : parseFloat(value);
        } else if (name === 'date') {
            finalValue = new Date(value);
        }
        
        const updatedDoc = { ...prev, [name]: finalValue };

        if (name === 'date') {
            const date = new Date(value);
            updatedDoc.year = date.getFullYear();
            updatedDoc.quarter = Math.floor((date.getMonth() + 3) / 3);
        }

        return updatedDoc;
    });
  };
  
  const fileType = document.file?.type || '';
  const name = document.name || '';

  const isPdf = fileType === 'application/pdf' || name.toLowerCase().endsWith('.pdf');
  const isImage = fileType.startsWith('image/') || 
                name.toLowerCase().endsWith('.png') || 
                name.toLowerCase().endsWith('.jpg') || 
                name.toLowerCase().endsWith('.jpeg') ||
                name.toLowerCase().endsWith('.gif');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex justify-between items-center flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-800 truncate pr-4">{formData.name}</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100"><XIcon className="w-6 h-6 text-slate-500" /></button>
        </div>
        
        {/* Content */}
        <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
          {/* Preview */}
          <div className="w-full md:w-2/3 h-1/2 md:h-full bg-slate-100 overflow-auto border-b md:border-b-0 md:border-r border-slate-200">
            {isLoadingPreview ? (
                <div className="w-full h-full flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            ) : isPdf && previewUrl ? (
              <iframe src={previewUrl} title={document.name} className="w-full h-full border-0" />
            ) : isImage && previewUrl ? (
              <img src={previewUrl} alt="Document Preview" className="w-full h-full object-contain p-2" />
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-200 text-slate-500 p-4 text-center">
                    <p>Vorschau für diesen Dateityp nicht verfügbar.</p>
                </div>
            )}
          </div>
          
          {/* Form */}
          <form className="w-full md:w-1/3 h-1/2 md:h-full overflow-y-auto p-6 space-y-4">
            <h3 className="text-md font-semibold text-slate-700">Extrahierte Daten</h3>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-600">Dateiname</label>
              <input type="text" name="name" id="name" value={formData.name || ''} onChange={handleChange} className="mt-1 block w-full p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label htmlFor="vendor" className="block text-sm font-medium text-slate-600">Verkäufer</label>
              <input type="text" name="vendor" id="vendor" value={formData.vendor || ''} onChange={handleChange} className="mt-1 block w-full p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" />
            </div>
             <div>
                <label htmlFor="taxCategory" className="block text-sm font-medium text-slate-600">Steuerkategorie</label>
                <input 
                    type="text" 
                    name="taxCategory" 
                    id="taxCategory" 
                    value={formData.taxCategory || ''} 
                    onChange={handleChange} 
                    className="mt-1 block w-full p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
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
              <label htmlFor="invoiceNumber" className="block text-sm font-medium text-slate-600">Rechnungsnummer</label>
              <input type="text" name="invoiceNumber" id="invoiceNumber" value={formData.invoiceNumber || ''} onChange={handleChange} className="mt-1 block w-full p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
                <label htmlFor="date" className="block text-sm font-medium text-slate-600">Datum</label>
                <input type="date" name="date" id="date" value={new Date(formData.date).toISOString().split('T')[0]} onChange={handleChange} className="mt-1 block w-full p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div className="flex space-x-4">
              <div className="w-1/2">
                <label htmlFor="totalAmount" className="block text-sm font-medium text-slate-600">Bruttobetrag</label>
                <input type="number" name="totalAmount" id="totalAmount" value={formData.totalAmount ?? ''} onChange={handleChange} className="mt-1 block w-full p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" step="0.01"/>
              </div>
              <div className="w-1/2">
                <label htmlFor="vatAmount" className="block text-sm font-medium text-slate-600">MwSt.</label>
                <input type="number" name="vatAmount" id="vatAmount" value={formData.vatAmount ?? ''} onChange={handleChange} className="mt-1 block w-full p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" step="0.01"/>
              </div>
            </div>
            <div>
                <label htmlFor="invoiceType" className="block text-sm font-medium text-slate-600">Rechnungstyp</label>
                <select name="invoiceType" id="invoiceType" value={formData.invoiceType} onChange={handleChange} className="mt-1 block w-full p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500">
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