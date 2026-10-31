ALTER TABLE public.profiles ALTER COLUMN tariff_per_kwh SET DEFAULT 2.63;
UPDATE public.profiles SET tariff_per_kwh = 2.63 WHERE tariff_per_kwh = 1.95;