import React from 'react';
import { Deadline } from '../types';
import CalendarIcon from './icons/CalendarIcon';
import { XIcon } from './icons/XIcon';

interface DeadlineNotificationProps {
  deadline: Deadline;
  onClose: () => void;
}

const DeadlineNotification: React.FC<DeadlineNotificationProps> = ({ deadline, onClose }) => {
  const { title, remainingDays } = deadline;
  
  const getMessage = () => {
    if (remainingDays <= 1) {
        return `Die Frist für "${title}" läuft heute oder morgen ab!`;
    }
    return `Die Frist für "${title}" läuft in ${remainingDays} Tagen ab.`;
  };

  return (
    <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10 w-full max-w-4xl px-4 sm:px-6 lg:px-8 mt-4">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 p-4 rounded-lg shadow-md flex items-center justify-between">
          <div className="flex items-center">
            <CalendarIcon className="w-6 h-6 mr-3 text-yellow-500" />
            <p className="text-sm">
              <span className="font-bold">Erinnerung:</span> {getMessage()}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-yellow-100">
            <XIcon className="w-5 h-5 text-yellow-700" />
          </button>
        </div>
    </div>
  );
};

export default DeadlineNotification;