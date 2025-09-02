import React from 'react';
import { Deadline } from '../types';
import CalendarIcon from './icons/CalendarIcon';
import { useThemeClasses } from '../hooks/useThemeClasses';

interface DeadlinesViewProps {
  deadlines: Deadline[];
}

const DeadlineCard: React.FC<{ deadline: Deadline }> = ({ deadline }) => {
  const ui = useThemeClasses();
    const { title, dueDate, remainingDays } = deadline;

    const getRemainingDaysText = () => {
        if (remainingDays < 0) return "Abgelaufen";
        if (remainingDays === 0) return "Heute fällig";
        if (remainingDays === 1) return "Noch 1 Tag";
        return `Noch ${remainingDays} Tage`;
    };

  const urgencyColorClass = remainingDays <= 7 ? ui.statusNegativeText : remainingDays <= 30 ? ui.statusWarningText : ui.statusPositiveText;

    return (
    <div className={`${ui.card} ${ui.border} p-6 rounded-xl shadow-sm`}>
      <h3 className={`text-lg font-bold ${ui.textPrimary}`}>{title}</h3>
      <p className={`text-sm mt-1 ${ui.textMuted}`}>
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
  const ui = useThemeClasses();
  return (
    <div className="space-y-8">
      <div>
    <h2 className={`text-3xl font-bold ${ui.textPrimary}`}>Steuerfristen</h2>
    <p className={`${ui.textMuted} mt-1`}>Hier sehen Sie eine Übersicht aller bevorstehenden Abgabefristen.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {deadlines.length > 0 ? (
            deadlines.map(deadline => <DeadlineCard key={deadline.id} deadline={deadline} />)
        ) : (
            <p className={`${ui.textMuted} col-span-2 text-center py-8`}>
                Alle Fristen für dieses Jahr sind bereits abgelaufen.
            </p>
        )}
      </div>
    </div>
  );
};

export default DeadlinesView;