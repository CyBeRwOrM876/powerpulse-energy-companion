CREATE OR REPLACE FUNCTION public.reading_buckets(p_from timestamptz, p_to timestamptz, p_bucket text, p_tz text DEFAULT 'Africa/Lusaka')
RETURNS TABLE(bucket text, kwh numeric, avg_kw numeric, peak_kw numeric, avg_v numeric, units_left numeric, readings bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  WITH src AS (
    SELECT r.created_at, (r.created_at AT TIME ZONE p_tz) AS lt, r.kwh_today, r.total_kw, r.voltage, r.units_left
    FROM public.readings r
    WHERE r.user_id = auth.uid()
      AND r.created_at >= (date_trunc('day', p_from AT TIME ZONE p_tz) AT TIME ZONE p_tz)
      AND r.created_at < p_to
  ), h AS (
    SELECT date_trunc('hour', lt) AS hr,
           max(kwh_today) AS mx,
           avg(total_kw) AS a_kw,
           max(total_kw) AS p_kw,
           avg(voltage) AS a_v,
           (array_agg(units_left ORDER BY created_at DESC))[1] AS u_last,
           count(*) AS n
    FROM src GROUP BY 1
  ), inc AS (
    SELECT hr,
           greatest(0, mx - coalesce(lag(mx) OVER (PARTITION BY date_trunc('day', hr) ORDER BY hr), 0)) AS k,
           a_kw, p_kw, a_v, u_last, n
    FROM h
  )
  SELECT to_char(date_trunc(CASE WHEN p_bucket IN ('hour','day','week','month','year') THEN p_bucket ELSE 'day' END, hr), 'YYYY-MM-DD"T"HH24:MI:SS') AS bucket,
         round(sum(k)::numeric, 4),
         round((sum(a_kw * n) / sum(n))::numeric, 4),
         round(max(p_kw)::numeric, 4),
         round((sum(a_v * n) / sum(n))::numeric, 1),
         round(((array_agg(u_last ORDER BY hr DESC))[1])::numeric, 3),
         sum(n)::bigint
  FROM inc
  WHERE hr >= (p_from AT TIME ZONE p_tz)
  GROUP BY 1 ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.circuit_usage(p_from timestamptz, p_to timestamptz)
RETURNS TABLE(name text, avg_w numeric, peak_w numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT c->>'name' AS name,
         round(avg(coalesce((c->>'w')::numeric, 0)), 1),
         round(max(coalesce((c->>'w')::numeric, 0)), 1)
  FROM public.readings r
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(r.circuits::jsonb) = 'array' THEN r.circuits::jsonb ELSE '[]'::jsonb END) c
  WHERE r.user_id = auth.uid() AND r.created_at >= p_from AND r.created_at < p_to
  GROUP BY 1 ORDER BY 2 DESC;
$$;

REVOKE ALL ON FUNCTION public.reading_buckets(timestamptz, timestamptz, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.circuit_usage(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reading_buckets(timestamptz, timestamptz, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.circuit_usage(timestamptz, timestamptz) TO authenticated;