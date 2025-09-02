import React, { useRef, useState, useEffect } from 'react';
import { useThemeClasses } from '../hooks/useThemeClasses';
import LogoutIcon from './icons/LogoutIcon';
import { UserProfile } from '../types';
import { supabase } from '../src/supabaseClient';

interface ProfileViewProps {
  userProfile: UserProfile;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  onLogout: () => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ userProfile, setUserProfile, onLogout }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [debouncedProfile, setDebouncedProfile] = useState(userProfile);
  const [originalProfile, setOriginalProfile] = useState(userProfile);
  // Debounce
  useEffect(() => { const t = setTimeout(()=> setDebouncedProfile(userProfile), 600); return () => clearTimeout(t); }, [userProfile]);
  // Persist on debounced change
  useEffect(() => { (async () => {
    if (!dirty) return;
    try {
      setSaving(true); setSaveError(null); setSaveSuccess(false);
      const { error } = await supabase.from('profiles').update({
        name: debouncedProfile.name,
        tax_id: debouncedProfile.taxId,
        vat_id: debouncedProfile.vatId,
        tax_number: debouncedProfile.taxNumber,
        company_form: debouncedProfile.companyForm,
        employees: debouncedProfile.employees,
        location_state: debouncedProfile.locationState,
        location_country: (debouncedProfile as any).locationCountry,
        location_city: (debouncedProfile as any).locationCity,
        industry: debouncedProfile.industry,
        founding_year: debouncedProfile.foundingYear,
      }).eq('id', (await supabase.auth.getUser()).data.user?.id || '');
      if (error) throw error;
      setSaveSuccess(true);
      setTimeout(()=> setSaveSuccess(false), 2500);
      setDirty(false);
    } catch(e:any) {
      setSaveError(e.message||'Speicherfehler');
    } finally { setSaving(false); }
  })(); }, [debouncedProfile]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserProfile(prev => ({ ...prev, [name]: value }));
    setDirty(true);
  };
  
  const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    try {
      setSaving(true); setSaveError(null); setSaveSuccess(false);
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('Nicht angemeldet');
      const path = `${user.id}/avatar/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = pub.publicUrl;
      setUserProfile(prev => ({ ...prev, profilePicture: url }));
      const { error: updErr } = await supabase.from('profiles').update({ profile_picture_url: url }).eq('id', user.id);
      if (updErr) throw updErr;
      setOriginalProfile(p => ({ ...p, profilePicture: url }));
      setSaveSuccess(true);
      setTimeout(()=> setSaveSuccess(false), 2500);
    } catch(e:any) {
      setSaveError(e.message||'Upload fehlgeschlagen');
    } finally { setSaving(false); }
  };

  const handleImageClick = () => { fileInputRef.current?.click(); };

  const handleCancel = () => {
    setUserProfile(originalProfile);
    setDirty(false); setSaveError(null); setSaveSuccess(false);
  };

  const ui = useThemeClasses();
  return (
    <div className="space-y-8">
      <div>
        <h2 className={`text-3xl font-bold ${ui.textPrimary}`}>Profil & Unternehmensdaten</h2>
  <p className={`${ui.textMuted} mt-1`}>Verwalten Sie hier Ihre Profildaten. Diese Informationen helfen dem KI-Assistenten, kontextbezogene Antworten zu geben und Förderrichtlinien zu prüfen.</p>
      </div>

      <div className={`${ui.card} ${ui.border} p-6 rounded-xl shadow-sm`}>
        <form className="space-y-6">
          {(saving || saveError || saveSuccess) && (
            <div className="flex items-center gap-3 text-xs">
              {saving && <span className="text-blue-600 dark:text-blue-400 animate-pulse">Speichere…</span>}
              {saveSuccess && !saving && <span className="text-green-600 dark:text-green-400">Gespeichert ✓</span>}
              {saveError && <span className="text-red-600 dark:text-red-400">{saveError}</span>}
              {dirty && !saving && !saveError && <span className="text-amber-600 dark:text-amber-400">Änderungen…</span>}
            </div>
          )}
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
              <label htmlFor="name" className={`block text-sm font-medium ${ui.textSecondary}`}>Vollständiger Name</label>
              <input
                type="text"
                name="name"
                id="name"
                value={userProfile.name}
                onChange={handleChange}
                className={`mt-1 block w-full p-2 rounded-lg shadow-sm ${ui.input} ${ui.ringFocus}`}
              />
            </div>
          </div>
          
          <div className={`border-t pt-6 ${ui.border}`}>
            <h3 className={`text-lg font-semibold ${ui.textPrimary}`}>Steuerliche Informationen</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div>
                <label htmlFor="taxId" className={`block text-sm font-medium ${ui.textSecondary}`}>Steuer-Identifikationsnummer</label>
                <input
                  type="text"
                  name="taxId"
                  id="taxId"
                  value={userProfile.taxId}
                  onChange={handleChange}
                  placeholder="z.B. 01 234 567 890"
                  className={`mt-1 block w-full p-2 rounded-lg shadow-sm ${ui.input} ${ui.ringFocus}`}
                />
              </div>
              <div>
                <label htmlFor="vatId" className={`block text-sm font-medium ${ui.textSecondary}`}>Umsatzsteuer-Identifikationsnummer</label>
                <input
                  type="text"
                  name="vatId"
                  id="vatId"
                  value={userProfile.vatId}
                  onChange={handleChange}
                  placeholder="z.B. DE123456789"
                  className={`mt-1 block w-full p-2 rounded-lg shadow-sm ${ui.input} ${ui.ringFocus}`}
                />
              </div>
              <div>
                <label htmlFor="taxNumber" className={`block text-sm font-medium ${ui.textSecondary}`}>Steuernummer</label>
                <input
                  type="text"
                  name="taxNumber"
                  id="taxNumber"
                  value={userProfile.taxNumber}
                  onChange={handleChange}
                  placeholder="z.B. 123/456/7890"
                  className={`mt-1 block w-full p-2 rounded-lg shadow-sm ${ui.input} ${ui.ringFocus}`}
                />
              </div>
               <div>
                <label htmlFor="companyForm" className={`block text-sm font-medium ${ui.textSecondary}`}>Unternehmensform</label>
                <input
                  type="text"
                  name="companyForm"
                  id="companyForm"
                  value={userProfile.companyForm}
                  onChange={handleChange}
                  placeholder="z.B. Einzelunternehmen, GmbH"
                  className={`mt-1 block w-full p-2 rounded-lg shadow-sm ${ui.input} ${ui.ringFocus}`}
                />
              </div>
            </div>
          </div>

          <div className={`border-t pt-6 ${ui.border}`}>
            <h3 className={`text-lg font-semibold ${ui.textPrimary}`}>Unternehmensstruktur & Standort</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
              <div>
                <label className={`block text-sm font-medium ${ui.textSecondary}`}>Mitarbeiterzahl</label>
                <input type="number" name="employees" value={userProfile.employees || ''} onChange={handleChange} placeholder="z.B. 25" className={`mt-1 block w-full p-2 rounded-lg ${ui.input} ${ui.ringFocus}`} />
              </div>
              <div>
                <label className={`block text-sm font-medium ${ui.textSecondary}`}>Bundesland</label>
                <input type="text" name="locationState" value={userProfile.locationState || ''} onChange={handleChange} placeholder="z.B. Nordrhein-Westfalen" className={`mt-1 block w-full p-2 rounded-lg ${ui.input} ${ui.ringFocus}`} />
              </div>
              <div>
                <label className={`block text-sm font-medium ${ui.textSecondary}`}>Stadt</label>
                <input type="text" name="locationCity" value={userProfile.locationCity || ''} onChange={handleChange} placeholder="z.B. Köln" className={`mt-1 block w-full p-2 rounded-lg ${ui.input} ${ui.ringFocus}`} />
              </div>
              <div>
                <label className={`block text-sm font-medium ${ui.textSecondary}`}>Land</label>
                <input type="text" name="locationCountry" value={userProfile.locationCountry || ''} onChange={handleChange} placeholder="Deutschland" className={`mt-1 block w-full p-2 rounded-lg ${ui.input} ${ui.ringFocus}`} />
              </div>
              <div>
                <label className={`block text-sm font-medium ${ui.textSecondary}`}>Branche</label>
                <input type="text" name="industry" value={userProfile.industry || ''} onChange={handleChange} placeholder="z.B. Erneuerbare Energien" className={`mt-1 block w-full p-2 rounded-lg ${ui.input} ${ui.ringFocus}`} />
              </div>
              <div>
                <label className={`block text-sm font-medium ${ui.textSecondary}`}>Gründungsjahr</label>
                <input type="number" name="foundingYear" value={userProfile.foundingYear || ''} onChange={handleChange} placeholder="z.B. 2018" className={`mt-1 block w-full p-2 rounded-lg ${ui.input} ${ui.ringFocus}`} />
              </div>
            </div>
          </div>
        </form>
        
    <div className={`border-t mt-6 pt-6 ${ui.border}`}>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={()=> { setDirty(true); setDebouncedProfile(userProfile); }}
              className={`px-4 py-2 rounded-lg text-xs font-semibold ${dirty? 'bg-blue-600 text-white hover:bg-blue-700':'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400'} disabled:opacity-40`}
            >Speichern</button>
            <button
              type="button"
              disabled={saving || !dirty}
              onClick={handleCancel}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40"
            >Abbrechen</button>
            <button
              type="button"
              onClick={onLogout}
              className={`flex items-center justify-center font-bold py-2 px-4 rounded-lg ${ui.buttonSecondary} hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 transition duration-300`}
            >
              <LogoutIcon className="w-5 h-5 mr-2" />
              Abmelden
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileView;