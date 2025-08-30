import React, { useRef } from 'react';
import LogoutIcon from './icons/LogoutIcon';
import { UserProfile } from '../types';

interface ProfileViewProps {
  userProfile: UserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  onLogout: () => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ userProfile, setUserProfile, onLogout }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserProfile(prev => ({ ...prev, [name]: value }));
  };
  
  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onloadend = () => {
            setUserProfile(prev => ({ ...prev, profilePicture: reader.result as string }));
        };
        reader.readAsDataURL(file);
    }
  };

  const handleImageClick = () => {
      fileInputRef.current?.click();
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-slate-800">Profil & Unternehmensdaten</h2>
        <p className="text-slate-500 mt-1">Verwalten Sie hier Ihre Profildaten. Diese Informationen helfen dem KI-Assistenten, kontextbezogene Antworten zu geben.</p>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <form className="space-y-6">
          <div className="flex items-center space-x-4">
             <div className="relative group flex-shrink-0">
                <img
                  className="h-20 w-20 rounded-full object-cover"
                  src={userProfile.profilePicture || "https://picsum.photos/100/100"}
                  alt="Benutzerprofil"
                />
                <button
                    type="button"
                    onClick={handleImageClick}
                    className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 flex items-center justify-center rounded-full transition-opacity duration-300 opacity-0 group-hover:opacity-100 cursor-pointer"
                    aria-label="Profilbild ändern"
                >
                    <span className="text-white text-xs font-semibold">Ändern</span>
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleProfilePictureChange}
                />
            </div>
            <div className="flex-grow">
              <label htmlFor="name" className="block text-sm font-medium text-slate-700">Vollständiger Name</label>
              <input
                type="text"
                name="name"
                id="name"
                value={userProfile.name}
                onChange={handleChange}
                className="mt-1 block w-full p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          
          <div className="border-t border-slate-200 pt-6">
            <h3 className="text-lg font-semibold text-slate-800">Steuerliche Informationen</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div>
                <label htmlFor="taxId" className="block text-sm font-medium text-slate-700">Steuer-Identifikationsnummer</label>
                <input
                  type="text"
                  name="taxId"
                  id="taxId"
                  value={userProfile.taxId}
                  onChange={handleChange}
                  placeholder="z.B. 01 234 567 890"
                  className="mt-1 block w-full p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="vatId" className="block text-sm font-medium text-slate-700">Umsatzsteuer-Identifikationsnummer</label>
                <input
                  type="text"
                  name="vatId"
                  id="vatId"
                  value={userProfile.vatId}
                  onChange={handleChange}
                  placeholder="z.B. DE123456789"
                  className="mt-1 block w-full p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label htmlFor="taxNumber" className="block text-sm font-medium text-slate-700">Steuernummer</label>
                <input
                  type="text"
                  name="taxNumber"
                  id="taxNumber"
                  value={userProfile.taxNumber}
                  onChange={handleChange}
                  placeholder="z.B. 123/456/7890"
                  className="mt-1 block w-full p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
               <div>
                <label htmlFor="companyForm" className="block text-sm font-medium text-slate-700">Unternehmensform</label>
                <input
                  type="text"
                  name="companyForm"
                  id="companyForm"
                  value={userProfile.companyForm}
                  onChange={handleChange}
                  placeholder="z.B. Einzelunternehmen, GmbH"
                  className="mt-1 block w-full p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </form>
        
        <div className="border-t border-slate-200 mt-6 pt-6">
          <button
            onClick={onLogout}
            className="w-full md:w-auto flex items-center justify-center bg-slate-100 text-slate-700 font-bold py-2 px-4 rounded-lg hover:bg-red-50 hover:text-red-700 transition duration-300"
          >
            <LogoutIcon className="w-5 h-5 mr-2" />
            Abmelden
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfileView;