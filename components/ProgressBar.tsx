import React from 'react';

interface ProgressBarProps {
  done: number;
  total: number;
  className?: string;
  barClassName?: string;
  showLabel?: boolean;
  labelPosition?: 'inside' | 'above' | 'none';
  labelFormatter?: (done:number,total:number)=>string;
  heightClass?: string; // Tailwind Höhe (z.B. h-2)
}

/**
 * Leichte, wiederverwendbare Fortschrittsanzeige.
 * - Nutzt reine Tailwind Utility Klassen
 * - Keine Abhängigkeit zu Zustand, rein Präsentation
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  done,
  total,
  className = 'w-full rounded bg-slate-200 dark:bg-slate-700 overflow-hidden',
  barClassName = 'bg-blue-600 dark:bg-blue-500 transition-all duration-150',
  showLabel = true,
  labelPosition = 'above',
  labelFormatter = (d,t)=> `${d}/${t}`,
  heightClass = 'h-2'
}) => {
  const pct = total > 0 ? (done/total)*100 : 0;
  const label = showLabel ? labelFormatter(done,total) : undefined;
  return (
    <div className="w-full">
      {labelPosition === 'above' && label && (
        <div className="mb-1 text-[10px] text-center text-slate-600 dark:text-slate-400 select-none">{label}</div>
      )}
      <div className={`${className} ${heightClass}`}> 
        <div className={`${barClassName} ${heightClass}`} style={{width: pct+'%'}} />
      </div>
      {labelPosition === 'inside' && label && (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-white font-medium mix-blend-difference">{label}</div>
      )}
    </div>
  );
};

export default ProgressBar;