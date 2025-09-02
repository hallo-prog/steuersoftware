<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/18dq3E-RpunBt2enugXlHbdOFCQGzEwso

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create a `.env.local` file with your keys:
```
GEMINI_API_KEY=your_gemini_key
VITE_TAVILY_API_KEY=your_tavily_key # optional for enhanced funding search
```
3. Run the app:
   `npm run dev`

## Intelligent Funding Search (Förderprogramme)

Implemented capabilities:
- Base discovery (Gemini) fallback when no keys.
- Extended web search via Tavily (Deep Search + optional EU programme inclusion).
- Hybrid merging: Tavily raw results → Gemini enrichment (compressed eligibility + level classification Bund/Land/EU).
- Filters: Level (Bund, Land, EU, Sonstige) & Bundesland selector.
- Similar programme suggestions (token overlap heuristic).
- Export: CSV + PDF (client-side, no server required).
- SessionStorage caching (6h TTL) to reduce API calls.
- Service Worker scaffold (`sw.js`) for future background refresh.

Environment priority:
- `GEMINI_API_KEY` (also enterable via UI) for Gemini model calls.
- `VITE_TAVILY_API_KEY` or UI-entered Tavily key for deep web search. No hardcoded API keys in code.

Security note: Do not commit real API keys. `.env.local` is ignored by default (ensure your gitignore covers it).

## Verbindlichkeiten (Liabilities) Modul

Funktionen:
- Erfassung & Bearbeitung von Verbindlichkeiten (Kredite, Leasing, Lieferantenkredite etc.) im UI.
- Supabase Persistenz (Tabelle `liabilities`).
- KI Risikoanalyse (Gemini) mit Score, Summary & Empfehlung.
- Dokument-Upload je Verbindlichkeit (Tabelle `liability_documents`).
- Auto-Kontakt-Extraktion aus hochgeladenen Dokumenten (sofern API-Key vorhanden).
- Verknüpfung von Belegen (`documents.liability_id`) über das Dokument-Detail-Modal.
- E-Mail Assistent (Vorlagen: Ratenzahlung, Zahlungspause) – generiert Betreff & Text (noch kein Senden ohne Backend-Proxy).

## Kontakte Modul

Funktionen:
- Automatische Aggregation von extrahierten Kontakten (Vendor, Gläubiger, Versicherung) – Tabelle `contacts`.
- Live Refresh bei neuen Dokumenten / Uploads (CustomEvent `contacts-updated`).
- KI kann E-Mail/Telefon extrahieren (sofern im Text vorhanden).

## KI E-Mail Assistent

Aktuell Client-seitig:
- Vorlagenauswahl (Ratenzahlung, Zahlungspause) + Parameter.
- KI generiert strukturiert Betreff + Body (JSON → UI Ausgabe).
- Copy-to-Clipboard.

Geplante Erweiterung:
- Sichere Zustellung via Backend (SMTP / OAuth Relay) – nicht im Frontend implementieren (Schlüssel-Sicherheit!).

## Tests (Geplant)

Empfehlung: Vitest + React Testing Library hinzufügen.
Beispiele (TODO):
- Parsing / Mapping Funktionen (Supabase Services Mock).
- KI Prompt Helper (mit Mock für Gemini Aufruf) – Snapshot der Promptstruktur.

## Architektur Hinweise

- Frontend-only MVP: Direkte Supabase Nutzung + Gemini API Aufrufe im Browser (API Key lokal gespeichert – für Produktion Backend-Proxy empfohlen).
- E-Mail Senden erfordert Server-Seite zur Geheimnisverwaltung (API Key / SMTP Credentials nie direkt im Client ausliefern).
- Embeddings: Placeholder Vektor-Generierung; Persistierung im Schema aktuell nicht aktiviert (aus Kostengründen). Reaktivierung möglich durch Erweiterung der `documents` Tabelle.

---

## Ergänzte Features
- Kontakt-Deduplikation (Normalisierung + Merge)
- Risiko-Filter für Verbindlichkeiten (Low/Mid/High basierend auf KI Score)
- Dark Mode (Persistenz via localStorage, Toggle im Header)

## E-Mail Versand (Sichere Architektur Empfehlung)
Aktuell: Nur KI-Generierung von Entwürfen (Client). Kein Versand – Schutz vor Geheimnis-Leak & Missbrauch.

Empfohlenes Pattern:
1. Client POST /api/send-email (subject, body, contactId)
2. Backend (Supabase Edge Function oder Node) validiert Auth + prüft Ownership des Kontakts
3. Rate Limiting (z.B. 30/Tag/User) + Logging (user_id, contact_id, hash(body), timestamp)
4. Versand über SMTP (Postmark/Sendgrid) ODER Gmail/Outlook OAuth (Refresh Tokens verschlüsselt)
5. Antwort mit serverseitiger messageId; UI aktualisiert Status.

Sicherheitsaspekte:
- Kein SMTP/OAuth Secret im Browser
- Sanitizing & Minimal erlaubte Felder
- Audit Trail für Compliance

Pseudo Edge Function (Deno/Supabase):
```ts
import { serve } from 'https://deno.land/std/http/server.ts';
serve(async (req) => { /* JWT prüfen, Payload validieren, Rate Limit, SMTP */ return new Response(JSON.stringify({status:'ok'})); });
```

## Kontakt Deduplikation
Datei: services/contactDedupe.ts
Heuristik:
- Normalisierung: lowercase, Entfernen juristischer Suffixe (gmbh, ag, ug, kg, ohg ...)
- Entfernen Sonderzeichen, Mehrfach-Whitespace komprimiert
- Matching: normalisierter Name ODER identische Email ODER normalisierte Telefonnummer
- Merge: Behalte vorhandene Felder, ergänze fehlende, vereine Tags & sourceIds, nutze jüngstes Datum

Grenzen / Next Steps:
- Optionales DB Feld normalized_name für Index
- Fuzzy Matching (Levenshtein) für Tippfehler
- KI Klassifikation der Branche

## Dark Mode
- ThemeContext in App.tsx
- <html> erhält Klasse `dark` (Tailwind Dark Variants)
- Wichtige Container/Karten mit `dark:` Utilities erweitert
- Persistenz: localStorage('theme')

## Tests
Neu: tests/contactDedupe.test.ts (Normalisierung + Deduplikation)
Geplant: supabaseDataService Mapping, KI Fallback Pfade (kein API Key)

## Dateispeicher-Strategie (Hybrid: Supabase Storage + Option für externen Object Storage)

Aktuell nutzen wir Supabase Storage für Uploads. Perspektivisch kann eine Auslagerung größerer/älterer Dateien in einen externen Object Storage (z.B. Cloudflare R2) erfolgen. Grundidee:

- Schneller Start: Alles in Supabase (Auth + RLS + Public URLs) → minimale Komplexität.
- Skalierung: Wenn Speichergrenze (Free ~1 GB) erreicht: Neue Uploads oder Archiv → extern (R2 / B2 / S3 kompatibel).
- Metadaten: Tabelle `documents` speichert nur (id, user_id, filename, storage_provider, path, public_url, size_bytes, created_at).

Warum nicht Google Drive als Primärspeicher?
- OAuth Verifizierungsaufwand, kein Bucket-Key Pattern, Rate Limits, Compliance Risiko bei Multi-User Speicherung.

Umschalt-Logik (vereinfacht):
1. Heuristik summiert grob Dateigrößen im Supabase Bucket.
2. Liegt Nutzung > konfigurierter Schwelle (`VITE_SUPABASE_USAGE_THRESHOLD`, default 0.8) und externer Storage aktiviert → Upload dorthin.
3. Sonst Supabase.

Env Variablen (Beispiele – externe optional):
```
SUPABASE_URL
SUPABASE_ANON_KEY
VITE_SUPABASE_USAGE_THRESHOLD=0.8
VITE_R2_ENABLED=true             # Flag für Client Umschaltung (optional)
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET
R2_PUBLIC_BASE_URL=https://files.example.com
```

Migrationsidee später:
- Hintergrund-Job verschiebt alte Dateien (>90 Tage) Supabase → R2, aktualisiert Metadaten, löscht Original.
- Duplikate vermeiden durch Hash (SHA-256) vor Upload.

## Supabase Migrationen

Wir nutzen einfache SQL-Dateien unter `supabase/migrations/`.

Erstinitialisierung (manuell im SQL Editor oder via CLI):
1. Datei `supabase/migrations/0001_init.sql` ausführen.
2. Danach weitere Migrationsdateien in numerischer Reihenfolge:
   - `0002_add_storage_provider.sql`
   - `0003_rules_deadlines.sql`
   - `0004_insurance.sql`
   - `0005_liabilities_contacts.sql`
   - `0006_funding.sql`

Supabase CLI Beispiel (optional):
```
supabase db push   # wenn Migrations in config eingebunden (ansonsten einzelne SQLs kopieren)
```

Nur einzelne neue Migration anwenden (falls vorherige bereits live sind):
```
supabase migration up 0006
```

Direkt via psql (Connection URL / Passwort erforderlich):
```
psql "$SUPABASE_DB_URL" -f supabase/migrations/0006_funding.sql
```

Vorhandensein der Funding Tabellen prüfen:
```
select table_name from information_schema.tables where table_name like 'funding_%';
```

Policies prüfen:
```
select policyname, tablename from pg_policies where tablename like 'funding_%';
```

Prüfen ob Spalte hinzugefügt wurde:
```
select column_name from information_schema.columns where table_name='documents' and column_name='storage_provider';
```

Backfill (falls nicht automatisch erfolgt):
```
update documents set storage_provider='supabase' where storage_provider is null and file_url is not null;
```

### Supabase Projekt verknüpfen (CLI)

1. Login:  
```bash
supabase login
```
2. Projekt verlinken (REF im Supabase Dashboard, URL enthält <ref>; falls Fehlermeldung `project is paused` zuerst im Dashboard reaktivieren):  
```bash
supabase link --project-ref <ref>
```
3. Migrationen anwenden:  
```bash
npm run db:migrate
```
4. Status prüfen:  
```bash
npm run db:status
```
5. Neue Migration erzeugen:  
```bash
npm run db:new add_index_documents_vendor
```
6. Env prüfen (prüft jetzt VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY):  
```bash
npm run env:check
```

Lokales Beispiel `.env.local` (siehe `.env.example`):
```
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_ANON_KEY=...
```


