import React from 'react';
import ChatBubbleIcon from './icons/ChatBubbleIcon';
import MenuIcon from './icons/MenuIcon';
import { UserProfile } from '../types';
import { useThemeClasses } from '../hooks/useThemeClasses';

interface HeaderProps {
    onToggleChat: () => void;
    onToggleMobileSidebar: () => void;
    onProfileClick: () => void;
    userProfile: UserProfile;
    onToggleTheme: () => void;
    theme: 'light' | 'dark';
}

const Header: React.FC<HeaderProps> = ({ onToggleChat, onToggleMobileSidebar, onProfileClick, userProfile, onToggleTheme, theme }) => {
  const ui = useThemeClasses();
  return (
  <header className={`flex-shrink-0 ${ui.headerBar} border-b ${ui.border} transition-colors`}>
      <div className="flex items-center justify-between p-4 h-16">
        <div className="flex items-center">
            <button
                onClick={onToggleMobileSidebar}
                className="md:hidden p-2 -ml-2 mr-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300"
                title="Menü öffnen"
            >
                <MenuIcon className="h-6 w-6" />
            </button>
          <h1 className={`text-lg font-semibold ${ui.textPrimary}`}>Belege-Dashboard</h1>
        </div>
        <div className="flex items-center space-x-2">
            <button className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700" title="Benachrichtigungen">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-500 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            </button>
            <button onClick={onToggleChat} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700" title="KI-Chat öffnen/schließen">
                <ChatBubbleIcon className="h-6 w-6 text-slate-500 dark:text-slate-300" />
            </button>
            <button onClick={onToggleTheme} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700" title={`Theme umschalten (aktuell: ${theme})`}>
              {theme==='light' ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364 6.364l-1.414-1.414M8.05 8.05L6.636 6.636m0 10.728l1.414-1.414M17.95 8.05l1.414-1.414M12 8a4 4 0 100 8 4 4 0 000-8z"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
              )}
            </button>
          <button onClick={onProfileClick} title="Profil anzeigen">
            <img
              className="h-9 w-9 rounded-full object-cover"
              src={userProfile.profilePicture || "https://picsum.photos/100/100"}
              alt={userProfile.name}
            />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;