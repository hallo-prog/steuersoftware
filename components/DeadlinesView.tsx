import React from 'react';
import { Deadline } from '../types';
import CalendarIcon from './icons/CalendarIcon';

interface DeadlinesViewProps {
  deadlines: Deadline[];
}

const DeadlineCard: React.FC<{ deadline: Deadline }> = ({ deadline }) => {
    const { title, dueDate, remainingDays } = deadline;

    const getRemainingDaysText = () => {
        if (remainingDays < 0) return "Abgelaufen";
        if (remainingDays === 0) return "Heute fällig";
        if (remainingDays === 1) return "Noch 1 Tag";
        return `Noch ${remainingDays} Tage`;
    };

    const urgencyColorClass = remainingDays <= 7 ? 'text-red-600' : remainingDays <= 30 ? 'text-yellow-600' : 'text-green-600';

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-800">{title}</h3>
            <p className="text-sm text-slate-500 mt-1">
                Fällig am: <span className="font-semibold">{dueDate.toLocaleDateString('de-DE')}</span>
            </p>
            <div className="mt-4 text-2xl font-bold">
                <span className={urgencyColorClass}>
                    {getRemainingDaysText()}
                </span>
            </div>
        </div>
    );
}

const DeadlinesView: React.FC<DeadlinesViewProps> = ({ deadlines }) => {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-slate-800">Steuerfristen</h2>
        <p className="text-slate-500 mt-1">Hier sehen Sie eine Übersicht aller bevorstehenden Abgabefristen.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {deadlines.length > 0 ? (
            deadlines.map(deadline => <DeadlineCard key={deadline.id} deadline={deadline} />)
        ) : (
            <p className="text-slate-500 col-span-2 text-center py-8">
                Alle Fristen für dieses Jahr sind bereits abgelaufen.
            </p>
        )}
      </div>
    </div>
  );
};

export default DeadlinesView;