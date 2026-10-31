CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  business_name text NOT NULL DEFAULT '',
  business_type text NOT NULL DEFAULT 'retail',
  tariff_per_kwh numeric NOT NULL DEFAULT 1.95,
  profit_per_hour numeric NOT NULL DEFAULT 250,
  stock_value numeric NOT NULL DEFAULT 10000,
  units_balance numeric NOT NULL DEFAULT 300,
  data_source text NOT NULL DEFAULT 'mqtt',
  mqtt_url text NOT NULL DEFAULT 'wss://broker.hivemq.com:8884/mqtt',
  device_id text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_business_type_check CHECK (business_type IN ('butchery','supermarket','pharmacy','bakery','restaurant','hotel','salon','welding','hammermill','office','retail')),
  CONSTRAINT profiles_data_source_check CHECK (data_source IN ('mqtt','demo')),
  CONSTRAINT profiles_lengths CHECK (char_length(full_name) <= 100 AND char_length(business_name) <= 120 AND char_length(device_id) <= 40 AND char_length(mqtt_url) <= 200)
);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  btype text := COALESCE(NEW.raw_user_meta_data->>'business_type', 'retail');
BEGIN
  IF btype NOT IN ('butchery','supermarket','pharmacy','bakery','restaurant','hotel','salon','welding','hammermill','office','retail') THEN
    btype := 'retail';
  END IF;
  INSERT INTO public.profiles (id, full_name, business_name, business_type, device_id)
  VALUES (
    NEW.id,
    LEFT(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''), 100),
    LEFT(COALESCE(NEW.raw_user_meta_data->>'business_name', ''), 120),
    btype,
    'pp-' || substr(replace(NEW.id::text, '-', ''), 1, 8)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.readings (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  total_kw numeric NOT NULL DEFAULT 0,
  voltage numeric NOT NULL DEFAULT 0,
  kwh_today numeric NOT NULL DEFAULT 0,
  units_left numeric NOT NULL DEFAULT 0,
  circuits jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text NOT NULL DEFAULT 'mqtt'
);

CREATE INDEX readings_user_time_idx ON public.readings (user_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.readings TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.readings_id_seq TO authenticated;
GRANT ALL ON public.readings TO service_role;
GRANT ALL ON SEQUENCE public.readings_id_seq TO service_role;
ALTER TABLE public.readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own readings select" ON public.readings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own readings insert" ON public.readings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own readings delete" ON public.readings FOR DELETE TO authenticated USING (auth.uid() = user_id);