import React, { useState, useCallback } from 'react';
import { Document, DocumentSource, DocumentStatus, InvoiceType, Rule, RuleSuggestion } from '../types';
import { analyzeDocument, getDocumentStatusFromAnalysis, createSuggestedFileName, embedTexts, extractContactsFromText } from '../services/geminiLazy';
import { uploadFileToBucket, insertDocument, updateDocument } from '../services/supabaseDataService';
import { hybridUpload } from '../services/hybridStorage';
import { upsertContactDedupe } from '../services/contactDedupe';
import { UploadCloudIcon } from './icons/UploadCloudIcon';
import { ComputerIcon } from './icons/ComputerIcon';
import { XIcon } from './icons/XIcon';
import { useThemeClasses } from '../hooks/useThemeClasses';

interface UploadModalProps {
  onClose: () => void;
  setDocuments: React.Dispatch<React.SetStateAction<Document[]>>;
  rules: Rule[];
  onRuleSuggestion: (suggestion: RuleSuggestion) => void;
  apiKey: string;
  userId: string;
  showToast?: (msg:string,type?:'success'|'error'|'info')=>void;
}

type UploadMode = 'manual' | 'local';

const UploadModal: React.FC<UploadModalProps> = ({ onClose, setDocuments, rules, onRuleSuggestion, apiKey, userId, showToast }) => {
  const [mode, setMode] = useState<UploadMode>('manual');
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const ui = useThemeClasses();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFiles(Array.from(event.target.files));
    }
  };

  const processAndUploadFiles = useCallback(() => {
    if (files.length === 0) return;
    setIsProcessing(true);
    onClose();

    const source = mode === 'manual' ? DocumentSource.MANUAL : DocumentSource.LOCAL;
    // Platzhalter lokal anzeigen
    const tempDocs: Document[] = files.map(file => ({
      id: 'temp-'+Math.random().toString(36).slice(2,9),
      name: file.name,
      date: new Date(),
      year: new Date().getFullYear(),
      quarter: Math.floor((new Date().getMonth()+3)/3),
      source,
      status: DocumentStatus.ANALYZING,
      fileUrl: URL.createObjectURL(file),
      file,
      invoiceType: InvoiceType.INCOMING,
    }));
    setDocuments(prev => [...tempDocs, ...prev]);

    (async () => {
      let suggestionMade = false;
      for (const placeholder of tempDocs) {
        const file = placeholder.file!;
        try {
          const result = await analyzeDocument(file, rules, apiKey);
          const date = new Date(result.documentDate || Date.now());
          const originalExtension = file.name.split('.').pop() || 'pdf';
          const storagePath = `${userId}/${date.getFullYear()}/${placeholder.id}.${originalExtension}`;
          let publicUrl = '';
          let storageProvider: 'supabase' | 'r2' | undefined = undefined;
          try {
            // Hybrid Upload: versucht Supabase, wechselt bei Schwelle zu R2 (Pfad mit userId/Jahr)
            const hy = await hybridUpload(file, { prefix: `${userId}/${date.getFullYear()}` });
            publicUrl = hy.publicUrl;
            storageProvider = hy.provider;
          } catch (e) {
            console.warn('Hybrid Upload fehlgeschlagen, Fallback Supabase', e);
            try { publicUrl = await uploadFileToBucket('documents', storagePath, file); } catch (e2) { console.warn('Fallback Upload fehlgeschlagen', e2); }
          }
          const status = await getDocumentStatusFromAnalysis(result, tempDocs);
          const finalDoc: Partial<Document> = {
            name: await createSuggestedFileName(result, originalExtension),
            date,
            year: date.getFullYear(),
            quarter: Math.floor((date.getMonth()+3)/3),
            source,
            status,
            fileUrl: publicUrl || placeholder.fileUrl,
            storageProvider,
            textContent: result.textContent,
            vendor: result.vendor,
            totalAmount: result.totalAmount,
            vatAmount: result.vatAmount,
            invoiceNumber: result.invoiceNumber,
            invoiceType: result.invoiceType,
            taxCategory: result.taxCategory,
          };
          let inserted: Document | null = null;
          try {
            // Embedding berechnen (Text gekürzt für Kostenkontrolle)
            if (apiKey && finalDoc.textContent) {
              const [vec] = await embedTexts(apiKey, [finalDoc.textContent.slice(0,4000)]);
              (finalDoc as any).embedding = vec;
            }
            inserted = await insertDocument(userId, finalDoc);
            showToast?.('Beleg gespeichert','success');
          } catch (e) { console.warn('DB insert fail', e); }
          // Kontakte extrahieren (asynchron, unabhängig von Insert Fehlern)
          if (finalDoc.textContent) {
            (async()=>{
              try {
                const contacts = await extractContactsFromText(apiKey, [finalDoc.textContent.slice(0,8000)]);
                if (contacts && contacts.length) {
                  for (const c of contacts) {
                    try {
                      await upsertContactDedupe(userId, { name: c.name, type: c.type as any, email: c.email, phone: c.phone, sourceIds: inserted? [inserted.id]:[], lastDocumentDate: date.toISOString() });
                    } catch (err) { console.warn('Contact upsert (dedupe) fail', err); }
                  }
                  // Signal an KontakteView zur Aktualisierung
                  window.dispatchEvent(new CustomEvent('contacts-updated'));
                }
              } catch (err) { console.warn('Kontakt Extraktion fehlgeschlagen', err); }
            })();
          }
          // Falls Embedding erst nachträglich möglich (kein API Key beim Upload)
          if (!apiKey && finalDoc.textContent) {
            setTimeout(async () => {
              try {
                if (!inserted) return;
                const [vec] = await embedTexts('', [finalDoc.textContent!.slice(0,4000)]);
                await updateDocument(inserted.id, { embedding: vec } as any);
              } catch {}
            }, 10);
          }
          if (!suggestionMade && finalDoc.vendor && finalDoc.taxCategory && finalDoc.taxCategory !== 'Sonstiges') {
            onRuleSuggestion({ vendor: finalDoc.vendor, taxCategory: finalDoc.taxCategory, invoiceType: finalDoc.invoiceType! });
            suggestionMade = true;
          }
          setDocuments(prev => prev.map(d => d.id===placeholder.id ? (inserted || { ...d, ...finalDoc, id: d.id }) : d));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Analysefehler';
          setDocuments(prev => prev.map(d => d.id===placeholder.id ? { ...d, status: DocumentStatus.ERROR, errorMessage } : d));
        }
      }
    })();
  }, [files, mode, setDocuments, onClose, rules, onRuleSuggestion, apiKey, userId]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`${ui.card} ${ui.border} rounded-xl shadow-xl w-full max-w-2xl transform transition-all`}>
        <div className={`p-5 ${ui.divider}`}>
          <div className="flex justify-between items-center">
            <h2 className={`text-lg font-bold ${ui.textPrimary}`}>Belege hinzufügen</h2>
            <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 transition-colors"><XIcon className="w-5 h-5"/></button>
          </div>
        </div>

        <div className="p-6">
          <div className={`flex ${ui.border} rounded-lg p-1 bg-slate-100 dark:bg-slate-700/50 mb-6`}>
            <button onClick={() => setMode('manual')} className={`w-1/2 py-2 rounded-md text-sm font-semibold transition-all ${mode === 'manual' ? 'bg-white dark:bg-slate-900 shadow-sm text-blue-600' : 'text-slate-600 dark:text-slate-300'}`}>
              Manueller Upload
            </button>
            <button onClick={() => setMode('local')} className={`w-1/2 py-2 rounded-md text-sm font-semibold transition-all ${mode === 'local' ? 'bg-white dark:bg-slate-900 shadow-sm text-blue-600' : 'text-slate-600 dark:text-slate-300'}`}>
              Lokaler Ordner
            </button>
          </div>
          {mode === 'manual' && (
            <div>
              <label htmlFor="file-upload" className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed ${ui.border} rounded-lg cursor-pointer bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors`}>
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <UploadCloudIcon className="w-10 h-10 mb-3 text-slate-400" />
                  <p className="mb-2 text-sm text-slate-500"><span className="font-semibold">Klicken zum Hochladen</span> oder Dateien hierher ziehen</p>
                  <p className="text-xs text-slate-500">PDF, PNG, JPG</p>
                </div>
                <input id="file-upload" type="file" className="hidden" multiple onChange={handleFileChange} />
              </label>
            </div>
          )}
          {mode === 'local' && (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-400 p-4 rounded-r-lg">
                <p className="text-sm text-blue-800">
                  <strong>Hinweis:</strong> Aus Sicherheitsgründen können Webanwendungen nicht automatisch auf Ihre lokalen Ordner zugreifen. Bitte wählen Sie die Dateien manuell aus.
                </p>
              </div>
              <label htmlFor="local-file-upload" className={`w-full flex items-center justify-center py-2.5 px-5 text-sm font-medium ${ui.textPrimary} focus:outline-none bg-white dark:bg-slate-900 rounded-lg ${ui.border} hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-blue-700 focus:z-10 focus:ring-4 focus:ring-slate-100 dark:focus:ring-slate-600 cursor-pointer`}>
                <ComputerIcon className="w-5 h-5 mr-2" />
                Dateien aus Ordner auswählen
              </label>
              <input id="local-file-upload" type="file" className="hidden" multiple onChange={handleFileChange} />
            </div>
          )}
          {files.length > 0 && (
            <div className="mt-4">
              <h4 className={`text-sm font-semibold ${ui.textSecondary}`}>Ausgewählte Dateien:</h4>
              <ul className="mt-2 text-sm text-slate-500 dark:text-slate-400 list-disc list-inside max-h-24 overflow-y-auto">
                {files.map((file, index) => <li key={index} className="truncate">{file.name}</li>)}
              </ul>
            </div>
          )}
        </div>
        <div className={`p-5 ${ui.surfaceSubtle} rounded-b-xl flex justify-end`}>
          <button onClick={onClose} className={`mr-3 py-2 px-4 text-sm font-medium rounded-lg ${ui.buttonSecondary}`}>Abbrechen</button>
          <button
            onClick={processAndUploadFiles}
            disabled={files.length === 0 || isProcessing}
            className="py-2 px-4 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
          >
            {isProcessing ? 'Verarbeite...' : `${files.length} Beleg(e) hochladen`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadModal;