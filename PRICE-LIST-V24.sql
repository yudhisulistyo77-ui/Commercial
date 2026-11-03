-- Price List only. Existing sales, login and settings are not modified.
BEGIN;
DO $$ BEGIN
 IF to_regprocedure('public.commercial_pin_session_v1()') IS NULL THEN
  RAISE EXCEPTION 'Pasang akses PIN V7 terlebih dahulu; tidak ada perubahan disimpan';
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS public.commercial_price_list_v24(
 outlet text PRIMARY KEY,city text NOT NULL CHECK(city IN('MAKASSAR','PALOPO','TORAJA','SAMARINDA','BONE','POLMAN','PALU','MANADO','KENDARI')),
 data jsonb NOT NULL,version integer NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.commercial_price_list_v24 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.commercial_price_list_v24 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.commercial_price_list_v24 TO anon,authenticated;
DROP POLICY IF EXISTS price_list_read_v24 ON public.commercial_price_list_v24;
CREATE POLICY price_list_read_v24 ON public.commercial_price_list_v24 FOR SELECT TO anon,authenticated USING(true);
CREATE OR REPLACE FUNCTION public.commercial_price_list_save_v24(p_outlet text,p_city text,p_data jsonb,p_version integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor jsonb;prior public.commercial_price_list_v24;g jsonb;v jsonb;result public.commercial_price_list_v24;numcols integer;BEGIN
 actor:=public.commercial_pin_session_v1();
 IF coalesce(actor->>'role','') NOT IN('master','editor') THEN RAISE EXCEPTION 'PIN master/editor diperlukan' USING errcode='42501';END IF;
 IF p_outlet IS NULL OR length(btrim(p_outlet)) NOT BETWEEN 1 AND 160 OR p_city IS NULL OR p_city NOT IN('MAKASSAR','PALOPO','TORAJA','SAMARINDA','BONE','POLMAN','PALU','MANADO','KENDARI') OR p_version IS NULL OR p_version<0 THEN RAISE EXCEPTION 'Identitas toko/kota/versi tidak valid';END IF;
 IF p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR p_data->>'schema' IS DISTINCT FROM '24' OR jsonb_typeof(p_data->'columns') IS DISTINCT FROM 'array' OR jsonb_typeof(p_data->'groups') IS DISTINCT FROM 'array' OR octet_length(p_data::text)>8000000 THEN RAISE EXCEPTION 'Format Price List tidak valid atau lebih dari 8 MB per toko';END IF;
 numcols:=jsonb_array_length(p_data->'columns');
 IF numcols NOT BETWEEN 1 AND 200 OR jsonb_array_length(p_data->'groups')>30000 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_data->'columns') x WHERE jsonb_typeof(x)<>'string' OR length(x#>>'{}') NOT BETWEEN 1 AND 180) THEN RAISE EXCEPTION 'Kolom/baris Price List tidak valid';END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(p_data->'groups'))<>(SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(p_data->'groups') x) THEN RAISE EXCEPTION 'ID profil ganda/tidak tersedia';END IF;
 FOR g IN SELECT value FROM jsonb_array_elements(p_data->'groups') LOOP
  IF coalesce(length(g->>'id'),0) NOT BETWEEN 1 AND 100 OR coalesce(length(g->>'category'),0) NOT BETWEEN 1 AND 240 OR coalesce(length(g->>'brand'),0) NOT BETWEEN 1 AND 160 OR coalesce(length(g->>'item'),0) NOT BETWEEN 1 AND 400 OR jsonb_typeof(g->'prices') IS DISTINCT FROM 'array' OR jsonb_typeof(g->'variants') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Profil Price List tidak valid';END IF;
  IF jsonb_array_length(g->'prices')<>numcols OR jsonb_array_length(g->'variants')>100000 THEN RAISE EXCEPTION 'Jumlah harga/varian tidak sesuai';END IF;
  FOR v IN SELECT value FROM jsonb_array_elements(g->'prices') LOOP
   IF jsonb_typeof(v) NOT IN('null','number') THEN RAISE EXCEPTION 'Harga harus angka/null';END IF;
   IF jsonb_typeof(v)='number' AND (v#>>'{}')::numeric<0 THEN RAISE EXCEPTION 'Harga negatif tidak valid';END IF;
  END LOOP;
  IF g?'cost_override' AND jsonb_typeof(g->'cost_override') NOT IN('null','number') THEN RAISE EXCEPTION 'Cost harus angka/null';END IF;
  IF jsonb_typeof(g->'cost_override')='number' AND (g->>'cost_override')::numeric<0 THEN RAISE EXCEPTION 'Cost negatif tidak valid';END IF;
  FOR v IN SELECT value FROM jsonb_array_elements(g->'variants') LOOP
   IF jsonb_typeof(v) IS DISTINCT FROM 'array' OR jsonb_array_length(v)<>3 OR jsonb_typeof(v->0) IS DISTINCT FROM 'string' OR jsonb_typeof(v->2) NOT IN('null','number') THEN RAISE EXCEPTION 'Varian sumber tidak valid';END IF;
   IF jsonb_typeof(v->2)='number' AND (v->>2)::numeric<0 THEN RAISE EXCEPTION 'Cost varian negatif';END IF;
  END LOOP;
 END LOOP;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('commercial-price-list-v24'),pg_catalog.hashtext(p_outlet));
 SELECT * INTO prior FROM public.commercial_price_list_v24 WHERE outlet=p_outlet FOR UPDATE;
 IF (prior.outlet IS NULL AND p_version<>0) OR (prior.outlet IS NOT NULL AND prior.version<>p_version) THEN RAISE EXCEPTION 'Price List toko sudah berubah di perangkat lain. Muat ulang sebelum menyimpan.' USING errcode='40001';END IF;
 INSERT INTO public.commercial_price_list_v24(outlet,city,data,version,updated_at) VALUES(p_outlet,p_city,p_data,coalesce(prior.version,0)+1,clock_timestamp())
 ON CONFLICT(outlet) DO UPDATE SET city=excluded.city,data=excluded.data,version=excluded.version,updated_at=excluded.updated_at RETURNING * INTO result;
 RETURN jsonb_build_object('outlet',result.outlet,'city',result.city,'version',result.version,'updated_at',result.updated_at);
END $$;
REVOKE ALL ON FUNCTION public.commercial_price_list_save_v24(text,text,jsonb,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.commercial_price_list_save_v24(text,text,jsonb,integer) TO anon,authenticated;
COMMIT;
NOTIFY pgrst,'reload schema';
SELECT count(*) AS toko_tersimpan FROM public.commercial_price_list_v24;
-- Reading uses the app's existing anon/publishable connection. Mutations require a valid PIN session.
-- Initial data is installed through the application's "Simpan data awal" action, not this SQL.
