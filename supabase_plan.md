# Supabase Integrationsplan

## Tabellen (siehe `supabase_schema.sql`)
- profiles
- documents
- rules
- funding_opportunities
- funding_favorites
- insurance_policies
- insurance_claims
- insurance_policy_documents
- insurance_claim_documents
- deadlines

## Migration Schritte
1. SQL Schema im Supabase Dashboard ausführen (oder CLI: `supabase db push`).
2. Env Variablen in `.env` anlegen:
```
VITE_SUPABASE_URL=... (Projekt URL)
VITE_SUPABASE_ANON_KEY=... (anon public key)
```
3. Client nutzen: `import { supabase } from './src/supabaseClient';`

## Sync-Strategie (geplant)
- Beim Login: Session holen, Profil laden oder initial anlegen.
- Lokale States (documents, rules, policies, claims) durch Supabase-Queries ersetzen.
- Offline-first optional via Caching (später IndexedDB Layer).

## Nächste Implementierungsetappen
1. Auth UI (SignIn/SignUp via Supabase Auth) ersetzen derzeitiges Fake-Login.
2. Laden/Speichern von `documents` (select, insert, update, delete) + Re-Write UploadModal.
3. Regeln synchronisieren.
4. Versicherungen (policies/claims) persistieren.
5. Favoriten Förderungen persistieren.
6. Realtime Channel für Dokument-Änderungen (optional).

## Sicherheits-Hinweise
- RLS Policies begrenzen Zugriff strikt auf `auth.uid()`.
- Service Role Key NICHT im Client bundlen (nur Anon Key!).

