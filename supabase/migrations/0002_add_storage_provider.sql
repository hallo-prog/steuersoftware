-- Migration 0002_add_storage_provider.sql
-- Falls alte Instanz ohne storage_provider existiert
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS storage_provider text;
-- Backfill vorhandene Einträge (nur einmalig sinnvoll)
UPDATE public.documents SET storage_provider = 'supabase' WHERE storage_provider IS NULL AND file_url IS NOT NULL;
