# Aufgaben & Master-Plan: Versicherungen ("Versicherungs-Cockpit 2.0")

> Ziel: Die bestehende Ansicht zu einem hoch-intelligenten, modularen, auditierbaren und KI‑gestützten Versicherungsmanagement-System ausbauen. Fokus: Tiefe Datenmodellierung, Automatisierung, Risiko-/Deckungslücken-Analyse, Claim-Lifecycle, Predictive Insights, Premium-Optimierung, Compliance & DX.

---
## 1. Zielbild (North Star)
Eine ganzheitliche Plattform, die:
- Policen vollautomatisch aus Dokumenten extrahiert & versioniert (#ai, #extraction)
- Laufzeiten, Fristen & Kündigungsfenster überwacht (#deadlines)
- Prämienentwicklungen analysiert & Einsparpotenziale identifiziert (#analytics)
- Claims priorisiert, triagiert und mit relevanten Belegen/Dokumenten anreichert (#claims, #ai)
- Risiko- & Deckungslücken erkennt und konkrete Handlungsempfehlungen gibt (#risk)
- Coverage-Graph: Visualisierung welcher Geschäftsbereich / Vermögenswerte durch welche Policen abgedeckt sind (#visualization)
- Datenqualität bewertet & Lücken mit KI ergänzbar macht (#dataquality)
- DSGVO-konform & revisionssicher arbeitet (#compliance)
- Modular & testbar gebaut ist (#architecture)

---
## 2. High-Level Architektur
```
UI (React Komponenten → Micro-Subcomponents: PolicyCard, ClaimCard, RiskPanel, Timeline, CoverageGraph)
    |  Zustand (Zustands-Slices: policies, claims, documents, riskAssessments, tasks)
Services Layer (supabaseDataService, riskService, claimService, extractionService, anomalyService)
AI Pipelines (Extraction → Normalization → Validation → Enrichment → Persistence)
Data Layer (Supabase: tables + RLS + views + materialized views)
Background Jobs (cron / edge functions: renewals, risk refresh, anomaly scans)
Observability (logs, metrics table, event_audit)
```

---
## 3. Domain Modell (Zukünftig)
| Entity | Beschreibung | Kernelemente |
|--------|--------------|--------------|
| insurance_policies | Basisdaten einer Police | name, type, insurer, policy_number, start_date, end_date, payment_interval, premium_amount, coverage_summary |
| policy_versions | Historisierung jeder Änderung | policy_id, snapshot_json, changed_by, changed_at |
| policy_risk_assessments | KI-Risikoanalyse | policy_id, risk_score (0..1), gaps[], recommendation, model, created_at |
| policy_documents | Verknüpfte Dateien (bestehend) | id, policy_id, file_name, storage_path, extracted_at |
| claims | Schaden-/Rechts-/Zahlungsfälle | policy_id, type, title, description, status, severity, ai_summary, ai_recommendation |
| claim_events | Chronologie & Statuswechsel | claim_id, event_type, payload_json, created_at |
| coverage_items | Atomare Deckungsobjekte | policy_id, label, limit_amount, deductible_amount |
| exclusions | Ausschlüsse je Police | policy_id, label |
| premium_payments | Gezahlte Prämien (optional) | policy_id, amount, date, source_doc_id |
| policy_alerts | Generierte Warnungen | policy_id, alert_type, severity, message, resolved_at |
| anomaly_findings | Abweichungen (Prämien, Deckung, Risiko) | scope (policy|portfolio), kind, value_before, value_after, confidence |
| audit_events | Systemweite Auditspur | actor, entity, entity_id, action, diff_json |

---
## 4. Geplante Tabellen / Migrationen (Skizze)
```sql
-- Versionshistorie
create table if not exists policy_versions (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid references insurance_policies(id) on delete cascade,
  snapshot_json jsonb not null,
  changed_by uuid references profiles(id),
  changed_at timestamptz default now()
);

create table if not exists policy_risk_assessments (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid references insurance_policies(id) on delete cascade,
  risk_score numeric check(risk_score between 0 and 1),
  risk_gaps text[],
  recommendation text,
  model text,
  created_at timestamptz default now()
);

create table if not exists claim_events (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references claims(id) on delete cascade,
  event_type text not null,
  created_at timestamptz default now()
  created_at timestamptz default now()

  confidence numeric check(confidence between 0 and 1),
  created_at timestamptz default now()
);
```
(Details feinjustieren vor Live-Migration. RLS & Index-Plan später unter Punkt 11.)

---
## 5. Feature-Matrix (Ist → Soll)
| Bereich | Aktueller Stand | Ziel (Kurz) |
|---------|-----------------|-------------|
| Policy CRUD | Basis + KI Vorbefüllung | Versionierung, Validierung, Auto-Merge Vorschläge |
| Dokumente | Upload + partielle Extraktion | Stapel-OCR, Duplikat-Erkennung, Auto-Tagging, Policy-Merge |
| Risiko | Einzel-Button | Hintergrund-Refresh + Portfolio-Risiko Heatmap |
| Claims | Einfacher Lifecycle | Statusmaschine + Events + Priorisierung + Dossier Export 2.0 |
| Coverage Items | Zeilen als Text | Strukturierte Items + Limits + Deductibles + Graph |
| Alerts | Keine | Kündigungsfenster, Laufzeit-Ende, Payment-Ausfall, Deckungslücke |
1. Refactor `VersicherungenView` in Subcomponents: `PolicyList`, `PolicyFormModal`, `PolicyDocumentsModal`, `ClaimList`, `ClaimFormModal`, `RiskButton` (#frontend, #refactor) – Teilweise erledigt (FormModal, DocumentsModal, ClaimFormModal, PolicyList & ClaimList extrahiert; weitere Aufteilung + RiskPanel folgt)
2. Einführung `policy_risk_assessments` + Service `riskService.ts` (#backend) – ✅ erledigt
8. Alerts Engine (Renewal 60/30/7 Tage, EndDate, fehlende Policennummer) (#alerts)
9. Auto-Merge Vorschläge nach Dokument-Extraktion (Diff UI) (#ai, #ux)
10. Premium Volatilität Analyse (rolling 12M) (#analytics)

### Phase 3 (P2 – Advanced AI & Prognose)
11. Anomaly Detection (Premium Sprünge, Risk Score Drift) (#ai, #anomaly)
12. Portfolio Optimizer (Erkennung Doppel-Deckung / Lücken) (#ai)
13. Prämien-Forecast (ARIMA oder einfache Exponential Smoothing zuerst) (#analytics)
14. Semantische Suche über Policy Texte & Dokumente (#search)
15. Recommendation Engine: Kündigungs-/Wechsel-Empfehlungen (#ai)

### Phase 4 (P3 – Governance & Polish)
16. Audit-Diff Viewer (JSON Diff hübsch) (#audit, #ux)
17. Export Suite (CSV Policies, Risiko Report PDF, Coverage Map) (#export)
18. Full Accessibilty Pass (WCAG Kontraste, ARIA, Tastatur) (#a11y)
19. Performance Tuning (Virtual List, Suspense, prefetch) (#performance)
20. Usage Metrics / Telemetrie (Feature Adoption) (#observability)

---
## 7. Subcomponent / Code Struktur (geplant)
```
  PolicyDocumentsModal.tsx
  ClaimList.tsx
  ClaimFormModal.tsx
/services/
  policyService.ts (Wrap fetchPolicies / upsertPolicy / version snapshot)
  claimService.ts
  riskService.ts
  alertService.ts
  usePolicies.ts
  useClaims.ts
```
Schrittweises Herauslösen, beginnend mit PolicyFormModal.

---
## 8. KI / ML Pipelines (Detail)
1. Extraction Pipeline:
   - Ingestion (PDF Upload) → OCR (falls kein Text) → Chunking → LLM Extraction → Normalization (Mapping Felder/Enum) → Validation (Regeln: Datum konsistent, Prämie >0) → Suggestion Store
2. Risk Pipeline:
   - Input: Policy normalized + optional externe Benchmarks → LLM Score + Gap detection → Persist in `policy_risk_assessments`
3. Anomaly Detection:
   - Strategy: Z-Score / MAD zunächst, später Prophet/ML
4. Coverage Gap Detection:
   - Regelbasis (if kein Betriebshaftpflicht + Branche=X -> Gap) + LLM Verifikation
5. Recommendation:
   - Aggregation (Risiko hoch + Prämie > Benchmark) => Optimierungsvorschlag

Alle Steps mit `pipeline_run_id` korrelierbar -> Logging in `audit_events`.

---
## 9. Validierungsregeln (Auswahl)
- start_date <= end_date
- premium_amount >= 0
- payment_interval ∈ {monatlich, quartal, jährlich}
- Kündigungsfenster: end_date - notice_period (Konfig: 3 Monate default)
- Risk Score Recompute: wenn coverage_items Count oder exclusions geändert

---
## 10. Alerts (erste Welle)
| Typ | Logik | Severity |
|-----|-------|----------|
| renewal_window | heutig ≥ end_date - 60d (Staffel 60/30/7) | warning/critical |
| missing_policy_number | policy_number IS NULL | info |
Cron/Edge Function ruft `alertService.generate()` täglich.

---
## 11. Performance & Skalierung
- Policy/Claim Listen: Windowing (react-virtualized / eigene leichte Lösung)
- Caching: SWR oder eigener Stale-While-Revalidate Hook
- Normalisierte State Maps (id->entity)
- Lazy Loading risk_assessments (separate fetch)
- Indexe: (policy_number), (type), (end_date), (policy_id) FK Indexe
- Materialized View `policy_risk_latest` (latest risk per policy)
- RLS: row owner enforcement (user_id)
- Audit Logging bei: create/update/delete policy/claim/document/risk_assessment

---
## 13. Observability
- Tabelle `audit_events` + lightweight Event Emitter Utility
- Optional: simple metrics table (metric, value, at)
- Frontend Console Log Reduktion (dedizierter Logger + Level)
- ErrorBoundary bereits vorhanden -> erweitern mit Report-Hook

---
- Policy Detail Drawer statt Modal + Tabs (Übersicht | Risiko | Claims | Dokumente | Historie)
- Coverage Graph: Force-Layout / bipartite (Policy ↔ Coverage Items)
- Risk Heatmap: farbcodierte Grid Cells
- Inline Diff Anzeige bei KI-Vorschlägen (alte vs neue Werte)
- Keyboard Shortcuts: N = neue Police, F = neuer Fall (fokussierte Police), / = Suche

---
## 15. Testing Strategie
- Unit: Services (policyService, riskService mock AI)
- Integration: Extraktion → Vorschlag Generierung
- E2E (später): Cypress Flows (Policy anlegen, Dokument hochladen, Claim erstellen, Risk Score abrufen)
- Snapshot für PolicyCard Rendering mit verschiedenen Risiko-State
- Property Based (optional): Random Coverage Items → Validation invariants

---
## 16. Datenqualität & Governance
Metriken: completeness (% Felder gefüllt), freshness (tage seit letztem risk_assessment), duplication (policy_number duplicates), coverage completeness (#coverage_items vs expected_by_type).
UI Badge: Datenqualität High / Medium / Low.

---
## 17. Rollout Plan
1. (Week 1-2) Refactor + Versionierung + Risk Table
2. (Week 3) Claim Events + Tests + Coverage Items Struktur
3. (Week 4) Alerts Engine + Risk Heatmap
4. (Week 5-6) AI Gap Detection + Anomaly Basic
5. (Week 7) Forecast & Optimizer MVP
6. (Week 8) Governance (Audit Viewer) + Performance Tuning

Feature Flags für: risk_heatmap, anomaly_detection, optimizer.

---
## 18. Risiken & Mitigation
| Risiko | Auswirkung | Mitigation |
|--------|------------|------------|
| KI Halluzinationen | Falsche Empfehlungen | Confidence Scores + Manual Review Step |
| Schema Drift | Runtime Fehler | Migrations + Types re-gen + Contract Tests |
| Performance bei vielen Dokumenten | UI Lag | Virtualization + Lazy fetch |
| Zu breite Modalkomponente | Wartungsaufwand | Modularisierung in Subcomponents |
| Vendor Lock (LLM) | Kosten / Abhängigkeit | Abstrakte `LLMAdapter` Schnittstelle |

---
## 19. Akzeptanzkriterien (Phase 1 Beispiele)
1. Policy Versionierung: Nach jedem Update existiert Eintrag in `policy_versions` mit vollständigem Snapshot (prüfbar via Test). 
2. Risk Assessment: Klick erzeugt neuen Datensatz; Policy zeigt aktuellsten Score + Gaps. 
3. Claim Statuswechsel: Übergang nur gemäß definierter State Machine; unerlaubte Transition wirft Fehler. 
4. Refactored UI: `VersicherungenView` < 300 Zeilen; Subcomponents enthalten klar abgegrenzte Logik. 
5. Tests: Mindestens 15 neue Assertions (Policy Upsert / Version / Risk Insert / Claim Transition / Component Render). 

---
## 20. Sofort Nächste Schritte (Empfehlung)
- [ ] Anlegen der neuen Tabellen (Migration Scripts erzeugen)
- [ ] Extrahieren `PolicyFormModal` in eigene Datei
- [ ] Implementierung `policyService.versionSnapshot(policy)`
- [ ] Neuer Hook `useRiskAssessments(policyIds)`
- [ ] Button "Risk" -> delegiert an `riskService.assess(policy)` + persist assessment
- [ ] Tests für Versionierung & Risk

---
## 21. Tagging-Konventionen
`#frontend`, `#backend`, `#ai`, `#risk`, `#claims`, `#coverage`, `#alerts`, `#anomaly`, `#performance`, `#compliance`, `#observability`, `#refactor`, `#tests`, `#ux`.

---
## 22. Offene Fragen (später klären)
- Multi-User / Rollen (Broker vs Admin vs Viewer)?
- Externe API Integrationen (Vergleichsportale?)
- Kostenmodell / Quotenlimit für KI Aufrufe?
- Benchmark Datenquellen (Risiko & Prämie)?

---
## 23. Schluss
Dieses Dokument dient als lebende Quelle für Vision + Umsetzung. Iterativ ergänzen & abhaken. Nächster operativer Schritt: Phase‑1 Branch erstellen und Refactor starten. 

Viel Erfolg – wir bauen ein erstklassiges Versicherungs-Cockpit.

---
## 24. Advanced Architektur Patterns
- Hexagonal + Ports/Adapter für AI (LLMAdapter), Storage (Repo Interfaces), Notification (Toast/Email/Webhook)
- Event Sourcing Light: Wichtige Mutationen zusätzlich als Domain Events (PolicyUpdated, ClaimStatusChanged, RiskAssessmentCreated)
- CQRS Ansatz: Schreibpfad (Supabase direkte Writes + Event Append) / Lesepfad (Materialized Views `policy_risk_latest`, `policy_summary_overview`)
- Pipeline Orchestrierung: Orchestrator (state machine) vs. einzelne Idempotente Steps (extract → normalize → validate → enrich → suggest)
- Retry/Idempotenz: Jeder Step speichert `pipeline_run_id` + `step_hash`; bei erneutem Aufruf wird übersprungen
- Backpressure Strategie: Upload Queue (in-memory fallback, später durable mit `pgmq` oder Redis)

## 25. Event Storming / Domain Events (Initial)
| Event | Producer | Konsumenten (Reaktion) |
|-------|----------|------------------------|
| PolicyCreated | UI/Service | VersionStore, AlertEngine (renewal schedule) |
| PolicyUpdated | UI/Service | VersionStore, RiskRecomputeTrigger, AlertEngine |
| PolicyRiskAssessmentCreated | riskService | AlertEngine (high risk check), AnomalyDetector |
| PolicyDocumentUploaded | uploadService | ExtractionPipeline, DuplicateDetector |
| ClaimCreated | UI | ClaimTimeline, AlertEngine (open claim counter) |
| ClaimStatusChanged | claimService | ClaimTimeline, SLAWatcher |
| CoverageItemsChanged | coverageService | RiskRecomputeTrigger |
| AlertGenerated | alertService | NotificationBus |
| AnomalyDetected | anomalyService | AlertEngine (wrap), AuditLog |

## 26. Wichtige Sequenzen (ASCII)
Extraction Upload → Policy Suggestion:
```
User -> UploadService: PDF
UploadService -> Storage: storeFile
UploadService -> EventBus: PolicyDocumentUploaded
EventBus -> ExtractionPipeline: start(pipeline_run_id)
ExtractionPipeline -> LLMAdapter: extractFields
LLMAdapter -> ExtractionPipeline: rawJson
ExtractionPipeline -> Normalizer: normalize(rawJson)
Normalizer -> Validator: validate(snapshot)
Validator -> SuggestionStore: save(policy_id?, diff)
SuggestionStore -> UI: (on demand) getSuggestions(policyId)
```

Risk Assessment Trigger:
```
User/UI -> riskService: assess(policyId)
riskService -> policyRepo: get(policyId)
riskService -> LLMAdapter: riskPrompt(policy)
LLMAdapter -> riskService: riskScore,gaps,reco
riskService -> riskRepo: insertAssessment
riskService -> EventBus: PolicyRiskAssessmentCreated
UI <- riskRepo: latestAssessment
```

Claim Status Machine:
```
UI -> claimService: transition(claimId, targetState)
claimService -> RuleEngine: validateTransition(current,target)
RuleEngine -> claimService: ok
claimService -> claimRepo: updateStatus
claimService -> EventBus: ClaimStatusChanged
```

## 27. SLO / SLA / Performance Budgets
- LCP (Policy View initial load) < 2.5s bei 200 Policen
- Risk Assessment Roundtrip (Button → Score sichtbar) P95 < 7s (abhängig LLM)
- PDF Extraktion (einzelnes Dokument) P95 < 25s, Batch linear skaliert (Parallelität max 3)
- Fehlerquote Risk Pipeline < 2% / Tag
- Daten-Delay Risk Heatmap < 5 min gegenüber letztem Assessment
- Uptime Core Services (Policy CRUD) 99.5%

## 28. AI Governance & Prompt Ops
- Prompt Versionierung: `prompts/insurance/` mit `name.prompt.md` + `meta.json` (fields: version, model, temperature)
- Evaluation Dataset: 25 echte/anonimisierte Policen; Metriken: Feld-Recall (% korrekt extrahiert), Risk Gap Precision
- Drift Monitoring: monatlicher Re-Eval → Alert bei Recall < Threshold (z.B. 90%)
- Guardrails: Max Token Cost per Day (Konfig in Settings)
- Sensitive Field Redaction vor Logging (Telefon, E-Mail)

## 29. Security & Threat Model (Kurz)
| Bedrohung | Vektor | Gegenmaßnahme |
|-----------|--------|--------------|
| Unauth. Policy Zugriff | ID Guessing | RLS + UUID + Row Filtering |
| Prompt Injection | Schadhafter Dokumenttext | System Prompt Hardening + Regex Sanitization |
| Data Exfiltration | Public URLs | Signed URLs + Ablauf + Option Hard Delete |
| DoS durch Massenuploads | Bulk Upload | Rate Limit (pro User / Stunde) |
| Kostentreiber LLM | Exzessive Calls | Caching + Debounce + Quota |

## 30. Cost / FinOps
- KPI: EUR / Policy pro Monat (Ziel < 0.15€)
- LLM Kosten Tracking: jede Anfrage -> `ai_cost_logs(model, tokens_in, tokens_out, cost_estimate)`
- Unused Assessments Cleanup nach 180 Tagen
- Storage Lifecycle: Dokumente älter 2 Jahre -> Archiv Bucket

## 31. Observability Spec (Detail)
- Logs: structured (`level, ts, user_id, event, entity, entity_id, latency_ms`)
- Metrics Tabellen: `metric_timeseries(name, value, at)` → Aggregation für Dashboard
- Tracing (optional später): Correlation ID = `req-<uuid>` durchgereicht
- Alert Routing: severity=critical -> E-Mail/Webhook, andere -> UI Badge

## 32. Data Lineage
| Output | Herkunft | Transform Steps |
|--------|----------|-----------------|
| risk_score | policy fields + LLM | policyRepo -> prompt -> LLM -> parse -> persist |
| coverage completeness KPI | coverage_items, policy types | fetch -> group -> ratio |
| anomaly finding | historical premiums | fetch last N -> stats -> threshold |

## 33. Feature Flag Strategie
- Implementierung: lightweight in-memory Map + Supabase Table `feature_flags(user_id, flag, enabled)`
- Flags: `risk_heatmap`, `anomaly_detection`, `optimizer`, `coverage_graph`
- Hook `useFeatureFlag(flag)` für UI gating

## 34. Rollout & Canary
- Phase 1: Hidden hinter Flags für internen Account
- Canary Policies (5%) erhalten neuen Risk Pipeline Pfad
- Auto-Rollback: Bei Fehlerrate >5% oder P95 Latenz > 2x Baseline

## 35. Quality Gates & Definition of Done
| Gate | Kriterium |
|------|-----------|
| Build | Keine Type Errors / ESLint Fehler |
| Tests | >90% Statements in neuen Services, kritische Pfade abgedeckt |
| Security | Keine High Severity Dependency (npm audit) |
| Performance | New UI Render <10% langsamer als vorher |
| Docs | README Abschnitt + Changelog Eintrag |
| Observability | Events & Logs vorhanden für Kernpfad |

## 36. Error Taxonomy
| Code | Kategorie | Beispiel |
|------|----------|----------|
| POL-VAL-001 | Validation | invalid date range |
| POL-RISK-001 | Risk Pipeline | LLM parse error |
| CLM-TRANS-403 | Transition | invalid state change |
| DOC-UP-413 | Upload | file too large |
| AI-RATE-429 | Quota | daily token limit exceeded |

## 37. Naming & Coding Conventions
- React Components PascalCase; Hooks `useX`
- Service Methoden: Verb + Domain (e.g. `assessPolicyRisk`)
- Tabellen: snake_case; Indices: `idx_<table>_<col>`
- Events: Past tense (PolicyUpdated) / Exceptions: DomainError Subclasses (optional später)

## 38. Tech Debt Register (Start)
| ID | Beschreibung | Impact | Geplant |
|----|--------------|--------|---------|
| TD1 | Monolithische `VersicherungenView` | Wartbarkeit | Phase 1 Refactor |
| TD2 | Kein Feature Flag System | Risiko bei Rollout | Phase 2 |
| TD3 | Fehlende Audit Tabelle | Compliance | Phase 1.5 |
| TD4 | Keine Kosten Logs | FinOps Blind Spot | Phase 3 |

## 39. KPI Dashboard (Spec)
Widgets:
- Gesamt Prämie (aktuell / Vorjahr Vergleich)
- Risiko Verteilung Histogramm
- Coverage Completeness Gauge
- Claims Funnel (offen → in_prüfung → abgeschlossen)
- Alerts Open by Severity
- AI Extraction Accuracy Trend (Eval Dataset)

## 40. Zukunft / Erweiterungen
- Broker API Integration (Vergleichsangebote live einblenden)
- Vertragsgenerator (LLM gestützt) für Standard-Policy-Addenda
- Multi-Tenancy Mandantenfähig (org_id)
- Mobile Offline Support (IndexedDB Cache der wichtigsten Policen)
- GraphQL Layer (optional) für externe Integrationen

---
## 41. Executive One-Pager (Kurzfassung)
Ein modularer, KI-gestützter Versicherungs-Cockpit Stack, der Policen automatisiert extrahiert, Risiken quantifiziert, Lücken erkennt und handlungsorientierte Empfehlungen liefert – mit Governance, Kostenkontrolle und Skalierbarkeit als Fundament.

---
## 42. Nächster konkret umsetzbarer Schritt (Aktualisiert)
Abgeschlossen (Phase‑1 Kickoff):
- `policy_versions` Migration + Snapshot Hook ✅
- `riskService.ts` + Persistierung ✅
- Claim State Machine + Events ✅
- Feature Flags Infrastruktur ✅ (zusätzlich zu ursprünglicher Liste)
- Extraktion `PolicyFormModal`, `ClaimFormModal`, `PolicyDocumentsModal` ✅

Neu in Arbeit:
- Weitere Modularisierung: `PolicyUploadZone`, `PolicyList`, `ClaimList` ✅ (erste Version), nächster Schritt: `RiskPanel` & Reduktion `VersicherungenView` < 300 Zeilen
- Vorbereitung Coverage Items Migration + Service (Phase 2 Item 6)
- Hook für Risk History (Trend) vorbereiten

Next Batch (geplant):
1. `RiskPanel` Komponente (Anzeige letzter Score + Trend + Re-Assess Button) (#risk, #frontend) – ✅ erste Version implementiert (einfacher Score + Gaps + Recompute)
2. Migration `coverage_items` + `exclusions` Tabellen + einfacher `coverageService` (#coverage) – ✅ umgesetzt in 0013 Migration + Service
3. UI Editor für Coverage Items in Policy Modal (#coverage, #ux) – ✅ erste Version (`CoverageEditor` in PolicyFormModal bei bestehender Policy)
4. Risk History Hook (`useRiskAssessments(policyId)`) + Trend Badge (#risk) – ✅ implementiert (Hook + Trend im RiskPanel)
5. Alerts Grundgerüst (`policy_alerts` Tabelle + alertService mit renewal_window Regel) (#alerts) – ✅ Basis-Service & UI (Migration 0014, Renewal Multi-Generator, PolicyList Badges, Modal, Resolve)

Optional (falls Zeit im Batch): Virtualized PolicyList (Windowing) (#performance)

Erfolgskriterium Batch: `VersicherungenView` < 300 Zeilen, RiskPanel extrahiert, Coverage Items Schema vorhanden, erster Alert wird erzeugt (dummy script/test).

---
## 43. Erweiterung: Claim Dossier, Artefakt-Uploads & KI Rechtsberater
Ziel: Ein vollständiges digitales Dossier je Versicherungsfall (Schaden / Rechtsfall) mit Chronologie, Dokumentation und KI-gestützter rechtlicher Einordnung basierend auf individuell hochgeladenen AGB.

### Neue Tabellen / Migrationen
```sql
create table if not exists claim_attachments (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references claims(id) on delete cascade,
  kind text check (kind in ('note','hinweis','korrespondenz','media','dokument')),
  title text,
  content text,               -- für Notizen / extrahierten Text
  storage_path text,          -- für Dateien (PDF/Bild)
  mime_type text,
  meta jsonb,                 -- z.B. extrahierte Entities
  created_at timestamptz default now(),
  created_by uuid references profiles(id)
);

create table if not exists claim_dossier_snapshots (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references claims(id) on delete cascade,
  snapshot_json jsonb not null,   -- aggregierte Timeline verdichtet
  model text,
  generated_at timestamptz default now()
);

create table if not exists user_terms_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  file_name text,
  storage_path text,
  extracted_text text,
  uploaded_at timestamptz default now()
);
```

### Services / Layer
- `claimArtifactService`: addAttachment(file|note), listAttachments(claimId), deleteAttachment(id)
- `claimDossierService`: buildTimeline(claimId) → normalisiert Events + Attachments → erstellt Snapshot (persist in `claim_dossier_snapshots`)
- `legalAdvisorService`: nutzt AGB (user_terms_documents.extracted_text) + Claim Daten + Attachments → Prompt für rechtliche Hinweise / Risikoabschätzung / nächste Schritte

### KI / Prompt Elemente
Inputs: Claim Basisdaten, Status-Historie (`claim_events`), Attachments (klassifiziert), User-AGB (Chunking + Retrieval), ggf. Policy Deckungsdaten.
Outputs: 
- Zusammenfassung (aktueller Stand)
- Juristische Einordnung (z.B. Erfolgsaussicht, fehlende Unterlagen Hinweis)
- Nächste empfohlene Aktion
- Offene Lücken / fehlende Dokumente Liste

### UI Anpassungen
- Claim Detail (Modal/Drawer) Tabs: Übersicht | Timeline | Anhänge | KI Beratung | Dossier.
- Upload-Zone innerhalb Claim (Drag & Drop für Medien / PDFs / E-Mails (.eml?))
- Inline Editor für Notizen / Hinweise (Autosave)
- Button „Dossier aktualisieren“ (generiert Snapshot + speichert Version)
- Button „KI Rechtsberatung aktualisieren“ (nutzt aktuelle AGB + Timeline)

### Profilseite Erweiterung (AGB Upload)
- Sektion „Eigene AGB / Vertragsbedingungen“
- Upload (PDF/TXT) → Extraktion → Speicherung in `user_terms_documents` + Textanzeige + Option Löschen / Ersetzen
- Hinweis zur Nutzung (nur intern für KI, kein externes Teilen)

### Backlog Items (Einordnung in Phasen)
- Phase 2 Ergänzung: (neu) 10b. Claim Artefakt Upload & Timeline Konsolidierung (#claims, #ux)
- Phase 3 Ergänzung: (neu) 13b. KI Rechtsberater (AGB Retrieval + Advice) (#ai, #claims, #legal)

### Akzeptanzkriterien (Auszug)
1. Upload eines PDFs/Bildes erscheint als Attachment (kind=dokument/media) und ist dem Claim zugeordnet.
2. Anlage einer Notiz (kind=note) ohne Page Reload, erscheint sofort in Timeline.
3. Dossier Snapshot enthält verdichtete Sequenz (Events + Attachments) als JSON (mind. 1 Eintrag nach Generierung).
4. Rechtsberater Ausgabe referenziert mindestens 1 Abschnitt der hochgeladenen AGB (Citation / Absatz-ID) falls relevant.
5. Löschung eines Attachments entfernt es aus späteren Dossier Snapshots (neuer Snapshot generiert ohne Objekt).

### Sicherheit / Compliance
- RLS für alle neuen Tabellen (claim_id → owner via claims.user_id / user_id match)
- Größenlimit & MIME Validierung bei Upload
- PII Scrubbing Option vor Prompt (konfigurierbar)

### Observability
- Events: ClaimAttachmentAdded, ClaimAttachmentDeleted, ClaimDossierGenerated, LegalAdviceGenerated
- Metrics: avg_attachments_per_claim, dossier_generate_latency_ms, legal_advice_token_cost

### Feature Flags
- `claim_dossier` (Artefakt Upload + Snapshot)
- `legal_advisor` (KI Rechtsberatung)

### Nächste konkrete Schritte (Einplanung nach aktuellem Batch)
1. Migration `claim_attachments`, `claim_dossier_snapshots`, `user_terms_documents`
2. Service Grundgerüst `claimArtifactService` + minimal UI Upload (nur Notizen + PDF)
3. Timeline Aggregation Funktion (Events + Attachments sortiert)
4. Erster Dossier Snapshot Button (ohne KI Konsolidierung)
5. AGB Upload auf Profilseite + Text Extraktion (ggf. reuse bestehendes Extraktionsmodul)
6. Prompt Entwurf (legalAdvisorService) + Guardrails (Max Länge, Chunk Retrieval)

Nach Fertigstellung: Erweiterung Tests (Attachment CRUD, Dossier Snapshot enthält Notiz, LegalAdvice Mock Response verarbeitet).

# Versicherungen Modul - MVP Production Launch Plan

Fokus: Schlank, stabil, professionell. Nur das was für echten Nutzerwert & Betrieb nötig ist.

## Scope (enthalten)
- Policen: CRUD, Versionierung (Snapshot bei Änderung relevanter Felder)
- Deckungen & Ausschlüsse: Separate Tabellen + UI Editor
- Schäden: State Machine (reported -> in_review -> approved/denied -> settled) + Historie
- Risiko-Evaluierung (AI optional, Feature-Gating ohne GEMINI_API_KEY)
- Alerts: Erneuerungsfenster (60/30/7 Tage), Resolve, Modal, Badges
- Coverage Driven Risk Panel & Summaries
- Loading UX: Skeleton für Policy List

## Out of Scope (MVP)
- Komplexe Prämienberechnung
- Automatischer Dokument-Parser für Policen
- Externe Versicherer APIs
- Mehrwährungs-Support

## Tasks & Status
1. Unit Tests coverageService (CRUD) – DONE
2. Unit Tests alertService (threshold + resolve) – DONE
3. UI: Policy Alerts Modal + Badges – DONE
4. Coverage Editor UI + Entfernen Legacy Textareas – DONE
5. AI Feature Gating (Buttons disabled ohne Key) – DONE
6. Loading Skeleton (Policy List) – DONE
7. README Abschnitt Versicherungen – DONE
8. Migration 0014 policy_alerts – DONE
9. Final Env Check (Warnung ohne GEMINI_API_KEY) – DONE
10. Final QA Matrix (Smoke: create policy, add coverage, add exclusion, add claim, progress claim states, trigger alert via date tweak, resolve alert) – DONE (tests/insuranceFlow.test.ts)
11. Build & Smoke Deploy – DONE (vite build)

## QA Hinweise
- Edge Cases: keine Deckungen, nur Ausschlüsse, abgelaufene Policen (keine Alerts), mehrfaches Generieren Alerts idempotent.
- Tests decken CRUD & Schwellenlogik ab; weitere Integrationstests bei Bedarf nach MVP.

## Abschluss
Alle aufgeführten MVP Tasks sind abgeschlossen und durch automatisierte Tests (siehe insuranceFlow.test.ts) verifiziert. Build erfolgte erfolgreich. System bereit für Deployment.

## Nächste Schritte (nach MVP)
- Premium-Kalkulation Pipeline
- Dokumenten OCR & Parsing
- Externe API Integrationen
