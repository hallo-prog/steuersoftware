# Projekt Aufgabenplan (KI-gestützt)

Ziel: Erweiterung der Anwendung um einen neuen Menüpunkt "Datenbanken" mit einer intelligenten, generischen Tabellen- und Daten-Explorer-/Editor-Oberfläche für alle fachlich relevanten Supabase-Tabellen (Belege, Versicherungen, Versicherungsfälle, Kontakte, Verbindlichkeiten, Regeln, Profile ...). Schrittweise Umsetzung mit klaren, überprüfbaren Teilaufgaben.

---
## Legende Status
- [ ] Offen
- [~] In Arbeit
- [x] Erledigt
- [>] Folge/Nächster Schritt nach Abhängigkeiten
- [!] Entscheidung/Architekturpunkt

## High-Level Meilensteine
1. Basis-Integration & Navigation (View + Menüpunkt + Platzhalter)  
2. Metadaten & Tabellenauflistung (Spalten/Counts dynamisch)  
3. Datentabellen-Viewer (Pagination, Sort, Filter, Suche)  
4. CRUD (Insert, Inline-Edit, Delete, Optimistic Updates, Fehlermeldungen)  
5. Relationen & Kontext (FK-Auflösung, Drill-Down, verknüpfte Datensätze)  
6. KI-Unterstützung (Automatische Schema-Zusammenfassung, Anomaly-/Datenqualitäts-Hinweise)  
7. Sicherheit & RLS-Checks (sichtbare Hinweise, wenn Operationen blockiert)  
8. UX-Polish & Performance (Virtuelles Scrolling bei >1k Rows, Caching)  
9. Tests (Unit + Integrations-Mocking Supabase)  
10. Doku & Developer Experience (README Abschnitt, Architekturnotizen)

---
## Detaillierte Aufgaben

### M1: Basis-Integration & Navigation
- [x] A1: View-Enum um `DATENBANKEN` erweitern
- [x] A2: Lazy Import `DataBrowserView` in `App.tsx`
- [x] A3: Sidebar-Navi-Eintrag "Datenbanken" hinzufügen
- [x] A4: Platzhalter-Komponente `DataBrowserView` mit Grundlayout + Liste definierter Tabellen + Counts (documents, insurance_policies, insurance_claims, liabilities, contacts, rules)
- [x] A5: Fehlertoleranz & Ladezustände (Skeleton / Spinner / Error Message) Grundgerüst
- [x] A6: Aufgabenplan aktualisieren (Task 1 abschließen, nächsten Block aktivieren)

### M2: Metadaten & Tabellenauflistung
- [x] B1: Spalten-Inferenz (Heuristik via Sample Rows, Caching in Memory + localStorage) Grundversion
- [x] B2: Signatur/Hash für Cache-Invalidierung vorbereitet
- [x] B3: Typ-Badges mit Farbcode + Tooltip Sample Wert
- [x] B4: Parallele Count-Abfragen robust (Timeout + Retry + allSettled)
- [x] B2: Caching der Spaltenmetadaten (in Memory + optional localStorage Keyed by hash) – erweitert mit Versionierung & Signature
- [x] B3: Anzeige von Spalten-Typ-Badges & Nullability (inkl. FK-Badge)
- [x] B4: Performance: parallele Kopf-Abfragen (HEAD Count) mit Fehler-Multiplexing (bereits in Count-Loader umgesetzt)

### M3: Datentabellen-Viewer
- [x] C1: Paginierter Abruf (limit/offset) generisch (Page, PageSize Steuerung)
- [x] C2: Sortierbare Spalten (Server Query, UI Header Toggle)
- [x] C3: Textsuche (LIKE über heuristisch string Spalten, Debounce, Limit auf 4 Spalten)
- [x] C4: Virtuelles Scrolling (Windowing + Pads) – Basis (Responsiveness Feinschliff offen)

### M4: CRUD
- [x] D1: Inline-Edit Grundgerüst (Doppelklick -> Input, Speichern mit Update, Optimistic Refresh)
- [x] D2: Create Row Dialog (Grundform, Default leere Strings, User-Zuordnung)
- [x] D3: Delete mit Undo Snackbar (Insert-Restore)
- [x] D4: Optimistic UI + Rollback bei Update Fehlern (Revert Mechanismus)
- [x] D5: Fehler-Mapping (Postgrest Codes -> Menschlich)

### M5: Relationen & Kontext
- [x] E1: FK-Erkennung (Namensheuristik *_id + Metadaten) -> Tooltip + Jump
- [x] E2: Drilldown: Klick auf ID öffnet Detail-Drawer (Row JSON + verknüpfte Rows)
- [x] E3: Quick-Link von Dokument zu Policy / Liability / Contact (Heuristik über *_id Buttons)

### M6: KI-Unterstützung
- [x] F1: Schema-Zusammenfassung (Gemini Prompt mit Spaltenliste) – Service + UI Panel (Fallback Heuristik)
- [x] F2: Datenqualitätsanalyse (Missing Ratio > Threshold – Hinweis)
- [ ] F3: Anomalie-Schnappschuss (z.B. Ausreißer Amount-Spalten, Z-Score simpel)
- [ ] F4: KI Query-Helfer ("Zeige alle Dokumente ohne vendor") -> generiert Filter

### M7: Sicherheit & RLS
- [ ] G1: Erkennen von 401/403 -> Badge "RLS blockiert"
- [ ] G2: Read-only Modus f. Tabellen mit fehlenden Write-Policies
- [ ] G3: Hinweis-Karte zu Supabase Rollen / Policy Troubleshooting

### M8: UX & Performance
- [ ] H1: Virtuelles Scrolling (Intersection Observer / Windowing)
- [ ] H2: Prefetch nächste Seite beim Scroll 70%
- [ ] H3: Debounced Multi-Filter Panel
- [ ] H4: Persistierung zuletzt besuchter Tabelle (localStorage)

### M9: Tests
- [ ] I1: Unit: Metadaten-Inferenz
- [ ] I2: Unit: CRUD Optimistic Reducer
- [ ] I3: Integrations-Stubs: Laden + Edit + Rollback

### M10: Doku & DX
- [ ] J1: README Abschnitt "Datenbrowser"
- [ ] J2: Architekturdoku (Datenfluss, Fehlerstrategie, Caching)
- [ ] J3: Erweiterungsleitfaden (Neue Tabelle registrieren)

---
## Architekturentscheidungen (geplant)
- [!] Generic TableDescriptor Array als Startpunkt, später dynamisch über Katalog
- [!] State Management lokal (React useState) – kein globaler Store initial
- [!] Fehler / Loading Patterns: pro Table Kachel parallele Abfragen -> Promise.allSettled
- [!] Spaltenbreite Auto + Resize optional später

---
## Nächste Aktive Aufgabe
Implementierung E3 (Quick-Links zwischen verknüpften Datensätzen) + Vorbereitung F1 (Schema-Zusammenfassung KI) – UI Platzhalter & Service-Funktion.

(Automatisch aktualisiert am: 2025-08-31)
