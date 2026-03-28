-- Fix profiles that have a company_id but role = NULL.
-- These users should be operators but the handle_new_user trigger
-- only inserts with role = NULL. This prevents RLS operator policies
-- from matching, silently blocking deletes and other operations.

UPDATE public.profiles
SET role = 'operator'
WHERE company_id IS NOT NULL
  AND role IS NULL;
