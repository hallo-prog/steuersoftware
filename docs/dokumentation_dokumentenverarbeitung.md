# Entwickler-Dokumentation: Automatisierte Verarbeitung und Sortierung von Dokumenten-Briefen

## 1. Einleitung

### 1.1 Zweck der Dokumentation

Diese Dokumentation beschreibt die Entwicklung einer neuen Funktion für eine Dokumenten-Upload- und -Verwaltungssoftware. Die Funktion ermöglicht es Benutzern, Briefe (z. B. Rechnungen, Mahnungen, Dokumente von Behörden wie der Agentur für Arbeit oder Sozialkassen) hochzuladen. Eine integrierte Künstliche Intelligenz (KI) übernimmt die Analyse, Sortierung, Aufgaben-Erstellung und automatisierte Handlungen. Die KI basiert auf einem Modell wie Gemini, das OCR (Optical Character Recognition) für die Texterkennung nutzt.

Die Dokumentation ist allgemein gehalten und vermeidet spezifische Referenzen zu Programmiersprachen, Frameworks oder bestehenden Systemkomponenten. Sie dient als Blaupause für die Implementierung, einschließlich funktionaler und nicht-funktionaler Anforderungen, Architektur-Überlegungen und Teststrategien.

### 1.2 Scope

- **In Scope**: Upload von Briefen, KI-gestützte Analyse (OCR, Inhaltsverständnis, Fristerkennung), Sortierung in Ordner, Erstellung von Aufgaben und Kontakten, automatisierte Benachrichtigungen, Vorschläge für autonome Handlungen (z. B. E-Mail-Versand).
- **Out of Scope**: Integration mit externen Systemen (außer KI-API), Benutzeroberflächen-Design-Details, spezifische Datenspeicherlösungen.

### 1.3 Annahmen

- Die Software verfügt bereits über Basisfunktionen für Dokumenten-Upload und -Speicherung.
- Eine KI-API (z. B. Gemini) ist verfügbar und kann für OCR und natürliche Sprachverarbeitung genutzt werden.
- Benutzer haben Zugriff auf E-Mail- oder andere Kommunikationskanäle für automatisierte Handlungen.

## 2. Funktionale Anforderungen

### 2.1 Upload und Initiale Verarbeitung

- **FR-01**: Der Benutzer lädt ein Dokument (Brief) hoch. Unterstützte Formate: PDF, Bilddateien (z. B. JPG, PNG).
- **FR-02**: Das System leitet das Dokument an die KI weiter, die OCR anwendet, um Text zu extrahieren. Die KI analysiert den Inhalt, um Kategorien zu identifizieren (z. B. Rechnung, Mahnung, Agentur für Arbeit, Sozialkasse).
- **FR-03**: Basierend auf der Analyse sortiert die KI das Dokument in vordefinierte Ordner (z. B. “Rechnungen”, “Mahnungen”, “Behördenkommunikation”). Ordner können dynamisch erweitert werden, falls neue Kategorien erkannt werden.

### 2.2 Inhaltsanalyse und Aufgaben-Erstellung

- **FR-04**: Die KI extrahiert Schlüsselinformationen: Absender, Empfänger, Thema, relevante Daten (z. B. Beträge, Fristen).
- **FR-05**: Wenn ein neuer Absender identifiziert wird, schlägt die KI die Erstellung eines Kontakts vor. Der Kontakt wird in einem separaten Modul (z. B. “Kontakte”) angelegt, inklusive Name, Adresse, E-Mail (falls verfügbar).
- **FR-06**: Die KI erstellt Aufgaben für den Benutzer basierend auf dem Inhalt (z. B. “Rechnung bezahlen”, “Antrag stellen”). Jede Aufgabe enthält eine Beschreibung, Priorität und Zuweisung an den Benutzer.

### 2.3 Fristerkennung und Benachrichtigungen

- **FR-07**: Die KI identifiziert Fristen im Dokument (z. B. Zahlungsfrist, Einspruchsfrist) und speichert diese in der Aufgabe.
- **FR-08**: Das System plant automatische Benachrichtigungen: 2 Tage vor Fristablauf wird der Benutzer per E-Mail, Push-Benachrichtigung oder In-App-Meldung informiert. Die Benachrichtigung enthält Aufgabe-Details und Link zum Dokument.

### 2.4 Autonome Handlungen der KI

- **FR-09**: Die KI bewertet, ob sie die Aufgabe selbst erledigen kann (z. B. E-Mail an Absender senden, wenn es um eine Bestätigung geht).
- **FR-10**: Falls machbar, fragt die KI den Benutzer um Bestätigung: “Soll ich eine E-Mail an [Absender] senden? Was soll der Inhalt sein?” Der Benutzer kann Anweisungen geben (z. B. “Sende eine Zahlungsbestätigung”).
- **FR-11**: Bei Zustimmung führt die KI die Handlung aus (z. B. E-Mail-Versand über einen integrierten Mail-Client). Andernfalls bleibt die Aufgabe beim Benutzer.

### 2.5 Fehlerbehandlung

- **FR-12**: Bei unklarer OCR oder Analyse fordert die KI den Benutzer zur manuellen Korrektur auf.
- **FR-13**: Alle Aktionen protokollieren sich in einem Audit-Log für Nachverfolgbarkeit.

## 3. Nicht-Funktionale Anforderungen

### 3.1 Leistung

- **NFR-01**: Verarbeitungszeit pro Dokument: < 30 Sekunden für OCR und Analyse (abhängig von KI-API).
- **NFR-02**: Skalierbarkeit: Unterstützung für bis zu 100 Uploads pro Benutzer pro Tag.

### 3.2 Sicherheit und Datenschutz

- **NFR-03**: Alle Dokumente und extrahierten Daten werden verschlüsselt gespeichert. Zugriff nur für autorisierte Benutzer.
- **NFR-04**: KI-API-Aufrufe erfolgen über sichere Kanäle (z. B. HTTPS). Sensible Daten (z. B. personenbezogene Informationen) werden anonymisiert, wo möglich.
- **NFR-05**: Einhaltung von Datenschutzvorschriften (z. B. DSGVO): Benutzer-Einwilligung für KI-Verarbeitung einholen.

### 3.3 Benutzbarkeit

- **NFR-06**: Intuitive Integration in die bestehende UI: Upload-Button mit Fortschrittsanzeige.
- **NFR-07**: Mehrsprachige Unterstützung für Dokumente (mindestens Deutsch, Englisch).

### 3.4 Zuverlässigkeit

- **NFR-08**: Fallback-Mechanismus: Bei KI-Ausfall manuelle Sortierung ermöglichen.
- **NFR-09**: Genauigkeit der KI-Analyse: Ziel > 90% für Kategorisierung und Fristerkennung.

## 4. Systemarchitektur

### 4.1 Hochlevel-Design

- **Komponenten**:
  - **Upload-Modul**: Handhabt Datei-Upload und Validierung.
  - **KI-Integrator**: Schnittstelle zur KI-API für OCR, Textanalyse und Entscheidungsfindung.
  - **Datenverwaltung**: Speichert Dokumente, Ordner, Aufgaben, Kontakte und Fristen.
  - **Benachrichtigungs-Modul**: Plant und versendet Erinnerungen.
  - **Automatisierungs-Modul**: Führt benutzerbestätigte Handlungen aus (z. B. E-Mail).
- **Datenfluss**:
  1. Benutzer lädt Dokument hoch → Upload-Modul speichert temporär.
  2. KI-Integrator sendet an KI-API → Erhält Analyse-Ergebnisse (Kategorie, Fristen, etc.).
  3. Basierend auf Ergebnissen: Sortierung in Ordner, Erstellung von Aufgaben/Kontakten.
  4. Fristen triggern Benachrichtigungs-Modul.
  5. Für autonome Handlungen: Benutzer-Interaktion → Ausführung.

### 4.2 Integration mit KI

- Die KI-API wird für folgende Schritte aufgerufen:
  - OCR: Text-Extraktion aus Bild/PDF.
  - Natürliche Sprachverarbeitung: Kategorisierung, Fristerkennung, Aufgaben-Generierung.
  - Prompt-Design: Strukturierte Prompts wie “Analysiere diesen Text: Identifiziere Kategorie, Fristen und mögliche Aufgaben.”
- Fehlercodes von der API handhaben (z. B. Retry bei Timeout).

### 4.3 Datenmodell (konzeptionell)

- **Dokument-Entity**: ID, Dateipfad, Kategorie, Upload-Datum.
- **Aufgabe-Entity**: ID, Beschreibung, Frist, Status, Zuweisung.
- **Kontakt-Entity**: ID, Name, Adresse, E-Mail.
- **Benachrichtigung-Entity**: ID, Typ, Zeitstempel, Empfänger.

## 5. Implementierungsüberlegungen

### 5.1 Phasen der Entwicklung

- **Phase 1**: Prototyping der KI-Integration (OCR und Basis-Analyse).
- **Phase 2**: Implementierung von Sortierung, Aufgaben und Kontakten.
- **Phase 3**: Fristen und Benachrichtigungen hinzufügen.
- **Phase 4**: Autonome Handlungen mit Benutzer-Interaktion.
- **Phase 5**: Testing und Optimierung.

### 5.2 Risiken und Mitigation

- **Risiko**: Ungenaue KI-Analyse → Mitigation: Manuelle Überprüfungsoption, kontinuierliches Fine-Tuning der Prompts.
- **Risiko**: Datenschutzverstöße → Mitigation: Audit-Logs und Einwilligungs-Checks.
- **Risiko**: Hohe API-Kosten → Mitigation: Caching von Analyse-Ergebnissen.

## 6. Teststrategie

### 6.1 Unit-Tests

- Testen der KI-Prompts auf korrekte Extraktion (z. B. Fristen aus Sample-Dokumenten).

### 6.2 Integration-Tests

- End-to-End: Upload → Analyse → Sortierung → Aufgabe-Erstellung.

### 6.3 System-Tests

- Szenarien: Verschiedene Dokument-Typen (Rechnung mit Frist, Mahnung ohne Frist).
- Edge-Cases: Unleserliche Scans, fehlende Informationen, KI-Ausfälle.

### 6.4 Akzeptanz-Tests

- Benutzer-Feedback: Genauigkeit der Sortierung, Nützlichkeit der Aufgaben.

## 7. Wartung und Erweiterung

- **Monitoring**: Loggen von KI-Genauigkeit und Verarbeitungszeiten.
- **Erweiterungen**: Hinzufügen weiterer Kategorien, Integration mit Kalender-Apps für Fristen.
- **Versionskontrolle**: Dokumentation aktualisieren bei Änderungen.

## 8. Traceability Matrix (Beispiel)

| Anforderung | Testfall-ID | Beschreibung Test | Status |
|-------------|------------|-------------------|--------|
| FR-01 | TC-UP-01 | Upload PDF erfolgreich | Offen |
| FR-07 | TC-DL-02 | Frist extrahiert | Offen |
| NFR-09 | TC-ACC-01 | Genauigkeit > 90% | Offen |

## 9. Qualitäts-KPIs

- Durchschnittliche Verarbeitungszeit pro Dokument
- Erfolgsquote Kategorisierung (% korrekt)
- Recall/Precision Fristerkennung
- Anzahl manueller Korrekturen pro 100 Dokumente
- Kosten pro Dokumentanalyse (API)

## 10. Betrieb & Logging

- Strukturierte Logs (JSON) mit Korrelation-ID pro Dokument.
- Audit-Events: upload_initiated, ocr_completed, classification_done, tasks_created, deadline_parsed, notification_scheduled, user_confirmation_requested, autonomous_action_executed.
- Alerting: Fehlerquote KI > 5% in 15min löst Alarm aus.

## 11. Sicherheit (konkretisiert)

- Verschlüsselung: At-Rest (AES-256), In-Transit (TLS 1.2+).
- Geheimnisse im Secret-Management, kein Plaintext in Logs.
- Data Minimization: Nur benötigte Felder an KI senden.

## 12. Erweiterbare Prompt-Strategie (Beispiel)

```text
SYSTEM: Du extrahierst strukturierte Informationen aus deutschen Verwaltungs- und Finanzdokumenten.
USER: <OCR_TEXT>
ASSISTANT: {
  "kategorie": "Rechnung|Mahnung|Behörde|Sonstiges",
  "absender": "...",
  "betreff": "...",
  "betraege": [ { "typ": "gesamt", "wert": 123.45, "waehrung": "EUR" } ],
  "fristen": [ { "typ": "zahlung", "datum_iso": "2025-09-15" } ],
  "aufgaben": [ { "beschreibung": "Rechnung bezahlen", "prioritaet": "hoch" } ],
  "risiken": [ "Inkasso bei Nichtzahlung" ]
}
```

## 13. Glossar

- OCR: Texterkennung aus Bildern/PDFs.
- NLP: Natürliche Sprachverarbeitung.
- Frist: Datum, bis zu dem eine Aktion erfolgen muss.
- Autonome Handlung: Durch KI ausgeführte Aktion nach Benutzerfreigabe.

## 14. Offene Punkte / TODO

- Definition konkreter Schwellenwerte für Confidence (Kategorisierung, Fristen).
- Evaluierung mehrsprachiger Modelle.
- Datenschutz-Freigabeprozesse spezifizieren.
- Mock-Dataset für Tests erstellen.

## 15. Sequenzdiagramm (Placeholder)

```
Benutzer -> Upload-Modul: Dokument hochladen
Upload-Modul -> KI-Integrator: OCR & Analyse anstoßen
KI-Integrator -> KI-API: Analyse(Text)
KI-API --> KI-Integrator: Ergebnisse
KI-Integrator -> Datenverwaltung: Speichern (Dokument, Aufgaben, Kontakte)
Datenverwaltung -> Benachrichtigungs-Modul: Frist
Benachrichtigungs-Modul -> Benutzer: Erinnerung
KI-Integrator -> Benutzer: Vorschlag autonome Aktion
Benutzer -> Automatisierungs-Modul: Freigabe
Automatisierungs-Modul -> Externer Kanal: E-Mail senden
```

## 16. Detailliertes Datenmodell (logisch)

Hinweis: Technologie-neutral, Bezeichner beispielhaft.

### 16.1 Entitäten & Attribute

- Document
  - id (UUID)
  - storage_uri (String)
  - mime_type (String)
  - detected_language (String?)
  - category (Enum: invoice|reminder|authority|other)
  - ocr_text (Text, ggf. ausgelagert)
  - classification_confidence (Float)
  - created_at / updated_at (Timestamps)
  - hash_sha256 (String, Dedupe)
  - status (Enum: uploaded|processing|analyzed|error)

- ExtractionResult (falls normalisiert)
  - id
  - document_id (FK)
  - payload_json (JSONB)
  - model_version (String)
  - created_at

- Task
  - id
  - document_id (FK?)
  - title (String)
  - description (Text)
  - due_date (Date?)
  - priority (Enum: low|normal|high|critical)
  - status (Enum: open|in_progress|done|cancelled|auto_executed)
  - source (Enum: ai|user|system)
  - created_at / updated_at

- Contact
  - id
  - name
  - address_text
  - email
  - phone
  - first_seen_document_id (FK?)
  - created_at

- Deadline
  - id
  - document_id (FK)
  - task_id (FK?)
  - type (Enum: payment|appeal|other)
  - date
  - confidence (Float)
  - extracted_phrase (String)

- Notification
  - id
  - target_user_id
  - channel (Enum: email|push|in_app)
  - template_key
  - scheduled_for
  - sent_at
  - status (scheduled|sent|failed|cancelled)

- AuditEvent
  - id
  - correlation_id
  - actor_type (user|system|ai)
  - actor_id (nullable)
  - event_type (siehe Liste Abschnitt 10)
  - payload_json
  - created_at

### 16.2 Beziehungen

- Document 1..* Task (optional)
- Document 1..* Deadline
- Document 1..1 ExtractionResult (neueste) oder Historie n..*
- Task 0..1 Deadline (z. B. primäre Frist)
- Document -> Contact (Absender) n..1
- Contact -> Document (erstes Auftreten) 1..*

### 16.3 Index-Strategie (Beispiele)

- document(hash_sha256) UNIQUE (Duplicate Upload Detection)
- task(due_date, status) für Dashboard & Reminder-Jobs
- deadline(date) für Scheduler-Scans
- audit_event(correlation_id) Traceability

### 16.4 Daten-Lifecycle

- OCR-Text nach X Tagen optional in Cold Storage auslagern.
- Audit-Events nach 400 Tagen archivieren (gesetzliche Aufbewahrung prüfen).
- Löschkonzept (Right to be Forgotten) für personenbezogene Felder in Contact & Document.

## 17. API-Vertragsentwürfe (Beispiele, REST-Stil)

```
POST /documents
Body: { "filename": "...", "content_base64": "..." }
Response: { "document_id": "...", "status": "uploaded" }

GET /documents/{id}
Response: { "id": "...", "category": "invoice", "status": "analyzed", "tasks": [...], "deadlines": [...] }

POST /tasks/{id}/confirm-auto-action
Body: { "approved": true, "instructions": "Sende Zahlungsbestätigung" }
Response: { "task_id": "...", "status": "auto_executed" }

GET /contacts?query=Acme
Response: [ { "id": "...", "name": "Acme GmbH" } ]
```

Fehler-Codierung:
- 400 Validation
- 409 Duplicate (hash match)
- 422 Low OCR Confidence (Benutzer-Eingriff erforderlich)
- 503 KI-Backend nicht verfügbar (Retry-Header)

## 18. Event-Schema (Pub/Sub intern)

| Event | Key-Felder | Trigger | Konsumenten |
|-------|-----------|---------|-------------|
| document.uploaded | document_id | Upload abgeschlossen | OCR Worker |
| document.analyzed | document_id, category | KI-Auswertung fertig | Task Engine, Notifier |
| task.created | task_id, priority | Neue Aufgabe | Notification Scheduler |
| deadline.detected | document_id, date | Frist extrahiert | Reminder Service |
| task.auto_action.proposed | task_id | KI schlägt Aktion vor | UI Push |
| task.auto_action.executed | task_id | Aktion ausgeführt | Audit Logger |

## 19. Risiko-Register (erweitert)

| ID | Risiko | Kategorie | Auswirkung | Eintrittswahrsch. | Score | Mitigation | Owner |
|----|--------|----------|-----------|-------------------|-------|-----------|-------|
| R1 | Falsche Frist | Qualität | Versäumte Zahlung | M | H | Confidence-Threshold + Benutzer-Review | PO |
| R2 | KI-Ausfall | Verfügbarkeit | Verzögerte Verarbeitung | M | M | Fallback manuell + Queue Retry | Tech Lead |
| R3 | Datenschutzverletzung | Compliance | Bußgelder | L | H | Data Minimization, Verschlüsselung | DPO |
| R4 | Kostenexplosion API | Finanzen | Budgetüberschreitung | M | M | Caching, Sampling, Limits | Finance |
| R5 | Prompt Injection | Sicherheit | Manipulierte Aktionen | L | H | Input-Filter, System-Prompt Hardening | Security |
| R6 | Duplicate Upload Spam | Performance | Ressourcenverbrauch | M | M | Hash-Dedupe, Rate Limits | Backend |

Score Heuristik: Auswirkung (L/M/H) + Eintritt (L/M/H) gemappt auf numerische Skala für Priorisierung.

## 20. Threat Modeling (STRIDE Übersicht)

| STRIDE | Szenario | Gegenmaßnahmen |
|--------|----------|----------------|
| Spoofing | Gefälschte Benutzer-Token | Standardisierte Auth, Signierte Tokens |
| Tampering | Manipulation OCR-Text in Transit | TLS, HMAC Signaturen, Checksums |
| Repudiation | Abstreiten einer Aktion | AuditEvent unveränderlich (Append-only) |
| Information Disclosure | Leck sensibler Daten in Logs | Log Scrubber, PII Masking |
| Denial of Service | Massen-Uploads | Rate Limiting, Backpressure |
| Elevation of Privilege | Zugriff auf fremde Dokumente | Row-Level Security / ACL |

## 21. Akzeptanzkriterien (Auszug)

- FR-01: Upload einer 2MB PDF liefert innerhalb 5s eine Antwort mit Status=uploaded.
- FR-02/03: Eine Beispielrechnung wird als invoice erkannt (Confidence ≥ 0.8) und in den Ordner "Rechnungen" einsortiert.
- FR-07: Frist im Format "zahlbar bis 15.09.2025" wird korrekt als ISO-Datum extrahiert.
- FR-09/10: Bei erkennbarer Standard-E-Mail (Zahlungsbestätigung) erscheint ein Vorschlag innerhalb von 3s nach Analyse.
- NFR-09: Testset von 200 klassifizierten Dokumenten erreicht ≥ 90% Accuracy.

## 22. Monitoring & Observability

Metrics (Beispiele):
- document_processing_latency_seconds (Histogram)
- ocr_confidence (Gauge)
- classification_accuracy_running_avg (Gauge)
- auto_action_accept_rate (Counter/Rate)
- api_calls_total{provider="ki"}
- cost_per_document_eur (Gauge, berechnet batchweise)

Traces: Span-Kette: upload -> ocr -> classify -> extract_deadlines -> persist -> notify.

Logs: Korrelation über correlation_id; Felder: stage, latency_ms, model_version.

Dashboards: Latenz P95, Fehlerquote, Acceptance Rate Auto-Aktionen, Deadline-Vorwarnungen pro Tag.

Alert Regeln (Beispiele):
- Fehlerquote (5xx) > 2% 10min
- ocr_confidence_avg < 0.7 30min
- processing_latency_p95 > 25s 15min

## 23. Versionierung & Migration

- SemVer für externe API (MAJOR.MINOR.PATCH).
- Datenbank-Migrationen strikt vor Deploy ausführen (Forward-only, Rollback via Hotfix-Skripte).
- Modell-Version (model_version) in ExtractionResult speichern für Re-Processing.
- Feature Flags zur schrittweisen Aktivierung neuer Kategorien.

## 24. Rollout-Strategie & Feature Flags

Phasen: internal -> beta users (10%) -> staged 50% -> full.

Kill-Switch: Environment Flag deaktiviert KI-Automatismen (Fallback auf manuelle Sortierung).

Progressive Exposure: Auto-Aktionen erst lesend ("dry-run") protokollieren, später aktivieren.

## 25. Performance & Caching

- OCR-Ergebnisse (hash_sha256) 24h cachen (identische Dateien).
- Prompt-Response Cache keyed by (model_version, doc_hash, prompt_key).
- Batch-Verarbeitung nachts für Re-Scoring (kein User-Latenzpfad).
- Parallelisierung: I/O-Bound KI-Aufrufe via Async Queue.

## 26. Datenschutz & DSGVO Checkliste

| Punkt | Status | Notiz |
|-------|--------|-------|
| Verarbeitungsverzeichnis aktualisiert | Offen | Eintrag KI-Analyse |
| Einwilligung Nutzer | Offen | UI Checkbox vor Upload |
| Auftragsverarbeitungsvertrag (AVV) KI-Anbieter | Offen | Juristische Prüfung |
| Datenminimierung umgesetzt | Teilweise | Filter implementieren |
| Rechte auf Löschung | Offen | Endpoint definieren |
| Pseudonymisierung wo möglich | Offen | Hash statt Klartext für IDs |

## 27. Prompt Evaluierung & Guardrails

- Regression Suite mit 50 Beispiel-Dokumenten (golden outputs).
- Toxic / Leaky Inhaltserkennung (Blocklist, Pattern Checks) vor KI-Senden.
- Max Tokens Limit, Temperature konservativ (z. B. 0.2) für Extraktion.
- Prompt Templates versionieren (prompt_version) speichern.

## 28. Testdaten & Anonymisierung

- Generierung synthetischer Rechnungen (Varianten Beträge, Fristen, Absender).
- Maskierung personenbezogener Felder (Regex Email, IBAN, Adresse) bevor Logs.
- Kennzeichnung Test vs. Produktion via metadata.is_test.

## 29. Wartungs-Playbooks (Kurzfassung)

- Incident: KI 503 Fehleranstieg -> Scale Out + Circuit Breaker aktivieren.
- Niedrige Accuracy -> Prompt Regression ausführen, Modell-Version vergleichen.
- Kostenanstieg > Budgetlinie -> Cache Hit Rate Report prüfen, Sampling erhöhen.
- Fristen falsch extrahiert -> Beispiele sammeln, Few-Shot Prompt erweitern.

## 30. Nächste Schritte (priorisiert)

1. Confidence Thresholds definieren (Kategorisierung 0.75, Fristen 0.7 initial).
2. Prompt Versionierung & golden dataset erstellen.
3. Hash-Dedupe & Duplicate Handling implementieren.
4. Event-Bus Schema formalisieren.
5. Monitoring Dashboard MVP.
6. Datenschutz-Checkliste schließen.

---
Stand: 2025-09-02 (erweitert)
