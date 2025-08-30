import React from 'react';
import ChatBubbleIcon from './icons/ChatBubbleIcon';
import MenuIcon from './icons/MenuIcon';
import { UserProfile } from '../types';

interface HeaderProps {
    onToggleChat: () => void;
    onToggleMobileSidebar: () => void;
    onProfileClick: () => void;
    userProfile: UserProfile;
}

const Header: React.FC<HeaderProps> = ({ onToggleChat, onToggleMobileSidebar, onProfileClick, userProfile }) => {
  return (
    <header className="flex-shrink-0 bg-white border-b border-slate-200">
      <div className="flex items-center justify-between p-4 h-16">
        <div className="flex items-center">
            <button
                onClick={onToggleMobileSidebar}
                className="md:hidden p-2 -ml-2 mr-2 text-slate-500 hover:bg-slate-100 rounded-full"
                title="Menü öffnen"
            >
                <MenuIcon className="h-6 w-6" />
            </button>
          <h1 className="text-lg font-semibold text-slate-800">Belege-Dashboard</h1>
        </div>
        <div className="flex items-center space-x-2">
            <button className="p-2 rounded-full hover:bg-slate-100" title="Benachrichtigungen">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            </button>
            <button onClick={onToggleChat} className="p-2 rounded-full hover:bg-slate-100" title="KI-Chat öffnen/schließen">
                <ChatBubbleIcon className="h-6 w-6 text-slate-500" />
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