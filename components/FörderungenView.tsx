import React, { useState, useEffect } from 'react';
import { FundingOpportunity, UserProfile } from '../types';
import { findFundingOpportunities } from '../services/geminiService';
import SparklesIcon from './icons/SparklesIcon';
import AlertTriangleIcon from './icons/AlertTriangleIcon';

interface FörderungenViewProps {
  userProfile: UserProfile;
  apiKey: string;
}

const FörderungenView: React.FC<FörderungenViewProps> = ({ userProfile, apiKey }) => {
  const [opportunities, setOpportunities] = useState<FundingOpportunity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOpportunities = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const results = await findFundingOpportunities(apiKey, userProfile);
        setOpportunities(results);
      } catch (err) {
        const errorMessage = (err instanceof Error) ? err.message : 'Ein unbekannter Fehler ist aufgetreten.';
        setError(errorMessage);
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOpportunities();
  }, [apiKey, userProfile]);
  
  const SkeletonCard: React.FC = () => (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-slate-200 rounded w-1/2 mb-4"></div>
        <div className="h-3 bg-slate-100 rounded w-full mb-1"></div>
        <div className="h-3 bg-slate-100 rounded w-full mb-3"></div>
        <div className="h-3 bg-slate-100 rounded w-5/6 mb-4"></div>
        <div className="h-10 bg-slate-200 rounded-lg w-32 mt-4"></div>
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-slate-800">Fördermöglichkeiten für Ihr Unternehmen</h2>
        <p className="text-slate-500 mt-1">
            Ihr KI-Agent durchsucht das Internet nach passenden Förderungen, Zuschüssen und Krediten.
            Die Ergebnisse werden auf Ihr Unternehmensprofil zugeschnitten.
        </p>
      </div>
      
      <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 p-4 rounded-r-lg">
        <p className="text-sm">
          <strong>Wichtiger Hinweis:</strong> Die hier angezeigten Informationen sind KI-generiert und dienen als erste Orientierung.
          Prüfen Sie die Details und Voraussetzungen immer auf der offiziellen Seite des Anbieters, bevor Sie eine Förderung beantragen.
          Die Daten werden bei jedem Besuch dieser Seite live aus dem Internet abgerufen.
        </p>
      </div>

      <div>
        {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
            </div>
        ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-lg text-center">
                <AlertTriangleIcon className="w-12 h-12 mx-auto mb-4 text-red-400" />
                <h3 className="text-lg font-semibold">Fehler beim Abrufen der Daten</h3>
                <p className="mt-1">{error}</p>
                 <p className="mt-2 text-sm">Bitte überprüfen Sie Ihren API-Schlüssel in den Einstellungen oder versuchen Sie es später erneut.</p>
            </div>
        ) : opportunities.length === 0 ? (
           <div className="bg-white border-2 border-dashed border-slate-200 p-12 rounded-lg text-center">
                <SparklesIcon className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                <h3 className="text-lg font-semibold text-slate-700">Keine spezifischen Förderungen gefunden</h3>
                <p className="mt-1 text-slate-500">Die KI konnte im Moment keine passenden Förderungen für Ihr Profil finden. <br /> Stellen Sie sicher, dass Ihre Unternehmensdaten im Profil aktuell sind.</p>
            </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {opportunities.map(opp => (
              <div key={opp.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col">
                <h3 className="text-base font-bold text-slate-800">{opp.title}</h3>
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mt-1">{opp.source}</p>
                <p className="text-sm text-slate-600 mt-3 flex-grow">{opp.description}</p>
                <div className="mt-4 pt-4 border-t border-slate-100">
                    <h4 className="text-xs font-semibold text-slate-500 mb-1">Voraussetzungen (Auszug)</h4>
                    <p className="text-sm text-slate-600">{opp.eligibilitySummary}</p>
                </div>
                <a 
                    href={opp.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-block mt-4 bg-blue-50 text-blue-700 hover:bg-blue-100 text-sm font-semibold py-2 px-4 rounded-lg transition-colors text-center"
                >
                  Mehr erfahren
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FörderungenView;