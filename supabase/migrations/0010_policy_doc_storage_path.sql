-- Migration 0010_policy_doc_storage_path.sql
-- Fügt storage_path Spalte für Versicherungspolicen-Dokumente hinzu
-- Ermöglicht das erneute Ableiten der public URL aus dem Bucketspeicherpfad.

ALTER TABLE public.insurance_policy_documents
  ADD COLUMN IF NOT EXISTS storage_path text;
