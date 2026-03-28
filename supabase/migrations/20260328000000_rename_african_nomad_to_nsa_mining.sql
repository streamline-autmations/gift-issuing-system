-- Rename company "African Nomad" to "NSA Mining" for admin@africannomad.co.za
UPDATE public.companies
SET name = 'NSA Mining'
WHERE name = 'African Nomad';
