-- 0007_profile_picture.sql
-- Add profile picture URL column to profiles
alter table public.profiles add column if not exists profile_picture_url text;
