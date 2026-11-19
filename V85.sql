-- =====================================================================
--  V85 · Stock × Loss Sales  +  KPI otomatis (Sales, CSL, Loss) per minggu
--  Prasyarat: STOCK-V84.sql dan modul Sheets V68 (Loss/CSL) sudah terpasang.
--  Aman dijalankan ulang. Tidak mengubah data sumber.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- Token nama item untuk mencocokkan teks Loss Sales dengan SKU Moka
--   PENDEK→PDK, PANJANG→PJG, ANAK/KIDS→KID, XXL→2XL, XXXL→3XL, kata umum dibuang.
-- ---------------------------------------------------------------------
create or replace function public.commercial_stock_v85_tokens(p text)
returns text[] language sql immutable parallel safe as $$
  select coalesce(array_agg(distinct t order by t), '{}')
    from (
      select case x
               when 'PENDEK' then 'PDK' when 'PANJANG' then 'PJG' when 'ANAK' then 'KID' when 'KIDS' then 'KID'
               when 'XXL' then '2XL' when 'XXXL' then '3XL' when 'XXXXL' then '4XL' when 'BLACK' then 'HITAM'
               when 'WHITE' then 'PUTIH' when 'LENGAN' then null when 'KAOS' then null when 'POLOS' then null
               when 'BAJU' then null when 'TSHIRT' then null when 'SHIRT' then null when 'T' then null
               when 'UKURAN' then null when 'SIZE' then null when 'WARNA' then null when 'DAN' then null
               else x end as t
        from regexp_split_to_table(upper(coalesce(p, '')), '[^A-Z0-9]+') x
    ) z
   where t is not null and t <> '';
$$;

-- Token tersimpan (otomatis) + indeks agar pencocokan cepat
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'stock_v84_item' and column_name = 'toks') then
    alter table public.stock_v84_item add column toks text[] generated always as (public.commercial_stock_v85_tokens(item_name || ' ' || coalesce(category, ''))) stored;
  end if;
end $$;
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'stock_v84_item' and column_name = 'ntoks') then
    alter table public.stock_v84_item add column ntoks text[] generated always as (public.commercial_stock_v85_tokens(item_name)) stored;
  end if;
end $$;
create index if not exists stock_v84_item_toks on public.stock_v84_item using gin (toks);
create index if not exists v64_sheet_rows_kind_date on commercial_private.sheet_rows_v64(kind, sale_date);

-- Ukuran dari kolom SIZE/UKURAN pada sheet (bila ada)
create or replace function public.commercial_stock_v85_size(p jsonb)
returns text language sql immutable as $$
  select (select btrim(v) from jsonb_each_text(coalesce(p, '{}')) e(k, v)
           where regexp_replace(upper(k), '[^A-Z0-9]', '', 'g') in ('SIZE', 'UKURAN', 'SIZEPRODUK', 'UKURANPRODUK') and btrim(v) <> '' limit 1);
$$;

-- ---------------------------------------------------------------------
-- Analisa Loss Sales × Stock
--   Loss Sales (Google Sheet) dikelompokkan per toko + produk + warna + ukuran, dicocokkan ke SKU Moka,
--   lalu dibandingkan dengan stok saat ini di toko itu, DC dan toko lain.
--   Tindakan: DISPLAY (stok ada di toko) · TF (stok ada di DC/toko lain) · PRODUKSI (kosong di semua lokasi)
--             · CEK_NAMA (produk belum cocok dengan SKU Moka).
-- ---------------------------------------------------------------------
create or replace function public.commercial_stock_v85_loss(p_stores bigint[] default null, p_from date default null, p_to date default null,
                                                            p_filters jsonb default '{}'::jsonb, p_limit integer default 200, p_offset integer default 0)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare ids bigint[]; dc bigint[]; d1 date; d2 date; act text; q text; result jsonb;
begin
  ids := public.commercial_scope_v38('stock', p_stores);
  if to_regclass('commercial_private.sheet_rows_v64') is null then raise exception 'Data Loss Sales (modul Sheets) belum tersedia'; end if;
  d2 := coalesce(p_to, (now() at time zone 'Asia/Makassar')::date);
  d1 := coalesce(p_from, date_trunc('month', d2)::date);  -- bawaan: bulan berjalan
  if d1 > d2 or d2 - d1 > 366 then raise exception 'Periode Loss Sales tidak valid (maksimal 1 tahun)'; end if;
  if p_limit not between 1 and 5000 or p_offset < 0 then raise exception 'Paging tidak valid'; end if;
  dc := public.commercial_stock_v84_dc();
  act := nullif(p_filters->>'action', '');
  q := nullif(btrim(coalesce(p_filters->>'query', '')), '');

  -- V85.1: dicocokkan per "tanda" produk (kata produk+warna+ukuran+brand toko), bukan per baris/toko,
  -- dan stok dijumlah sekali — agar tetap di bawah batas waktu query Supabase.
  create temp table if not exists v85_loss_rows(store_id bigint, item text, color text, size text, category text, qty numeric, amount numeric,
     rows_n bigint, last_date date, reasons text, sig text, toks text[], must text[], mamu boolean, skus int, sample text, score numeric,
     here numeric, at_dc numeric, at_other numeric, donors jsonb, action text, store_name text) on commit drop;
  truncate v85_loss_rows;
  insert into v85_loss_rows(store_id, item, color, size, category, qty, amount, rows_n, last_date, reasons, toks, must, mamu, store_name)
  select l.store_id, l.item, l.color, l.size, l.category, l.qty, l.amount, l.rows_n, l.last_date, l.reasons,
         public.commercial_stock_v85_tokens(l.item || ' ' || l.color || ' ' || l.size),
         public.commercial_stock_v85_tokens(l.color || ' ' || l.size),
         coalesce(upper(st.brand) like '%MAMU%' or upper(st.name) like '%MAMU%', false), st.name
    from (
      select r.store_id, upper(btrim(r.item)) as item, upper(btrim(r.color)) as color,
             upper(coalesce(public.commercial_stock_v85_size(r.payload), '')) as size, max(r.category) as category,
             sum(coalesce(r.qty, 0)) as qty, sum(coalesce(r.amount, 0)) as amount, count(*) as rows_n,
             max(r.sale_date) as last_date, string_agg(distinct nullif(btrim(r.reason), ''), ' · ') as reasons
        from commercial_private.sheet_rows_v64 r
       where r.kind = 'loss' and r.sale_date between d1 and d2 and r.store_id is not null
         and (ids is null or r.store_id = any(ids))
       group by 1, 2, 3, 4
    ) l join stores st on st.id = l.store_id;
  update v85_loss_rows set sig = array_to_string(toks, ' ') || '|' || array_to_string(must, ' ') || '|' || mamu::text
   where sig is null;  -- Supabase (safeupdate) menolak UPDATE tanpa WHERE

  create temp table if not exists v85_sig(sig text primary key, toks text[], must text[], mamu boolean) on commit drop;
  truncate v85_sig;
  insert into v85_sig select distinct on (sig) sig, toks, must, mamu from v85_loss_rows where cardinality(toks) > 0;

  create temp table if not exists v85_match(sig text, sku text, score numeric) on commit drop;
  create index if not exists v85_match_sig on v85_match(sig);
  truncate v85_match;
  insert into v85_match
  select sig, sku, score from (
    select g.sig, i.sku, m.score, rank() over (partition by g.sig order by m.score desc, ((('MAMU' = any(i.toks)) = g.mamu)) desc, m.prec desc) rk
      from v85_sig g
      join stock_v84_item i on i.toks @> g.must and i.toks && g.toks and i.sku not like 'ID:%'
       and ('DEFECT' = any(g.toks) or not ('DEFECT' = any(i.toks)))
      cross join lateral (select count(*) as hit from unnest(g.toks) x where x = any(i.toks)) h
      cross join lateral (select h.hit::numeric / cardinality(g.toks) as score,
                                 h.hit::numeric / greatest(cardinality(i.ntoks), 1) as prec) m
     where h.hit::numeric / cardinality(g.toks) >= 0.75
  ) z where rk = 1;

  -- stok saat ini per tanda per lokasi (sekali)
  create temp table if not exists v85_pos(sig text, store_id bigint, qty numeric, primary key(sig, store_id)) on commit drop;
  truncate v85_pos;
  insert into v85_pos
  select m.sig, x.store_id, sum(greatest(coalesce(x.qty, 0), 0))
    from v85_match m
    join stock_v84_snap x on x.sku = m.sku
    join stock_v84_store s on s.store_id = x.store_id and s.gen = x.gen
   group by 1, 2;
  analyze v85_match; analyze v85_pos; analyze v85_loss_rows;

  update v85_loss_rows r set skus = k.n, sample = k.sample, score = k.score
    from (select m.sig, count(*) n, min(i.item_name) sample, max(m.score) score from v85_match m join stock_v84_item i on i.sku = m.sku group by 1) k
   where k.sig = r.sig;
  update v85_loss_rows r set
      here = coalesce((select p.qty from v85_pos p where p.sig = r.sig and p.store_id = r.store_id), 0),
      at_dc = coalesce((select sum(p.qty) from v85_pos p where p.sig = r.sig and p.store_id = any(dc)), 0),
      at_other = coalesce((select sum(p.qty) from v85_pos p where p.sig = r.sig and p.store_id <> r.store_id and not p.store_id = any(dc)), 0),
      donors = (select jsonb_agg(jsonb_build_object('store_id', p.store_id, 'name', st.name, 'qty', p.qty, 'is_dc', p.store_id = any(dc))
                                 order by (p.store_id = any(dc)) desc, p.qty desc)
                  from (select * from v85_pos p where p.sig = r.sig and p.store_id <> r.store_id and p.qty > 0
                         order by (p.store_id = any(dc)) desc, p.qty desc limit 3) p join stores st on st.id = p.store_id)
   where r.skus is not null;
  update v85_loss_rows set skus = coalesce(skus, 0), here = coalesce(here, 0), at_dc = coalesce(at_dc, 0), at_other = coalesce(at_other, 0),
     action = case when coalesce(skus, 0) = 0 then 'CEK_NAMA' when here > 0 then 'DISPLAY' when at_dc + at_other > 0 then 'TF' else 'PRODUKSI' end
   where action is null;

  with rowsx as (select * from v85_loss_rows), f as (
    select * from rowsx
     where (act is null or action = act)
       and (q is null or item ilike '%' || q || '%' or color ilike '%' || q || '%' or coalesce(sample, '') ilike '%' || q || '%' or coalesce(reasons, '') ilike '%' || q || '%')
  )
  select jsonb_build_object(
    'from', d1, 'to', d2,
    'total', (select count(*) from f),
    'totals', (select jsonb_build_object('qty', coalesce(sum(qty), 0), 'amount', coalesce(sum(amount), 0), 'rows', coalesce(sum(rows_n), 0)) from rowsx),
    'actions', (select coalesce(jsonb_object_agg(action, jsonb_build_object('groups', n, 'qty', qy, 'amount', am)), '{}')
                  from (select action, count(*) n, sum(qty) qy, sum(amount) am from rowsx group by action) z),
    'stores', (select coalesce(jsonb_agg(jsonb_build_object('store_id', store_id, 'name', store_name, 'qty', qy, 'amount', am,
                         'display', d, 'tf', tf, 'produksi', pr, 'cek', ck) order by am desc), '[]')
                 from (select store_id, store_name, sum(qty) qy, sum(amount) am,
                              sum(qty) filter (where action = 'DISPLAY') d, sum(qty) filter (where action = 'TF') tf,
                              sum(qty) filter (where action = 'PRODUKSI') pr, sum(qty) filter (where action = 'CEK_NAMA') ck
                         from rowsx group by 1, 2) z),
    'reasons', (select coalesce(jsonb_agg(jsonb_build_object('reason', reason, 'qty', qy, 'amount', am) order by am desc nulls last), '[]')
                  from (select coalesce(nullif(btrim(r.reason), ''), '(tanpa alasan)') reason, sum(coalesce(r.qty, 0)) qy, sum(coalesce(r.amount, 0)) am
                          from commercial_private.sheet_rows_v64 r
                         where r.kind = 'loss' and r.sale_date between d1 and d2 and r.store_id is not null and (ids is null or r.store_id = any(ids))
                         group by 1 order by 3 desc nulls last limit 12) z),
    'unmapped_store_rows', (select count(*) from commercial_private.sheet_rows_v64 r where r.kind = 'loss' and r.sale_date between d1 and d2 and r.store_id is null),
    'rows', coalesce((select jsonb_agg(to_jsonb(z) - 'score' - 'sig' - 'toks' - 'must' - 'mamu' || jsonb_build_object('score', round(z.score, 2))) from (
               select * from f order by amount desc nulls last, qty desc, store_id, item limit p_limit offset p_offset) z), '[]')
  ) into result;
  return result;
end $$;

-- ---------------------------------------------------------------------
-- KPI otomatis per minggu (W1=1–7, W2=8–14, W3=15–21, W4=22–28, W5=29–akhir)
--   sales : total harian Moka (dipakai sebagai porsi mingguan atas angka Sales & Target)
--   csl   : (rata-rata online + rata-rata offline) ÷ jumlah kanal yang memiliki nilai
--   loss  : nilai & qty Loss Sales
-- ---------------------------------------------------------------------
create or replace function public.commercial_kpi_auto_v85(p_year integer)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare ids bigint[]; d1 date; d2 date; result jsonb; extra jsonb;
begin
  ids := public.commercial_scope_v38('kpi', null);
  if p_year not between 2000 and 2100 then raise exception 'Tahun tidak valid'; end if;
  d1 := make_date(p_year, 1, 1); d2 := make_date(p_year, 12, 31);
  with wk as (
    select extract(month from g)::int as month, least((extract(day from g)::int - 1) / 7 + 1, 5) as week, g::date as day
      from generate_series(d1, d2, interval '1 day') g
  ), sales as (
    select w.month, w.week, sum(s.amount) as amount, max(s.sale_date) as last_day
      from moka_sales_type_daily s join wk w on w.day = s.sale_date
     where s.sale_date between d1 and d2 and (ids is null or s.store_id = any(ids))
     group by 1, 2
  )
  select jsonb_build_object(
    'year', p_year,
    'sales', coalesce((select jsonb_agg(jsonb_build_object('month', month, 'week', week, 'amount', amount, 'last_day', last_day) order by month, week) from sales), '[]'),
    'csl', '[]'::jsonb, 'loss', '[]'::jsonb, 'sheets', false
  ) into result;
  if to_regclass('commercial_private.sheet_rows_v64') is not null then
    execute $q$
      with wk as (
        select extract(month from g)::int as month, least((extract(day from g)::int - 1) / 7 + 1, 5) as week, g::date as day
          from generate_series($1::date, $2::date, interval '1 day') g
      ), csl as (
        select w.month, w.week, avg(r.online) as onl, avg(r.offline) as offl, count(*) as n
          from commercial_private.sheet_rows_v64 r join wk w on w.day = r.sale_date
         where r.kind = 'csl' and r.sale_date between $1 and $2 and ($3::bigint[] is null or r.store_id is null or r.store_id = any($3))
         group by grouping sets ((w.month, w.week), (w.month))
      ), loss as (
        select w.month, w.week, sum(coalesce(r.amount, 0)) as amount, sum(coalesce(r.qty, 0)) as qty, count(*) as n
          from commercial_private.sheet_rows_v64 r join wk w on w.day = r.sale_date
         where r.kind = 'loss' and r.sale_date between $1 and $2 and ($3::bigint[] is null or r.store_id = any($3))
         group by grouping sets ((w.month, w.week), (w.month))
      )
      select jsonb_build_object(
        'sheets', true,
        'csl', coalesce((select jsonb_agg(jsonb_build_object('month', month, 'week', week, 'n', n,
                   'value', round(((coalesce(onl, 0) + coalesce(offl, 0)) / nullif((onl is not null)::int + (offl is not null)::int, 0))::numeric, 4))
                   order by month, week nulls first) from csl), '[]'::jsonb),
        'loss', coalesce((select jsonb_agg(jsonb_build_object('month', month, 'week', week, 'amount', amount, 'qty', qty, 'n', n)
                   order by month, week nulls first) from loss), '[]'::jsonb))
    $q$ into extra using d1, d2, ids;
    result := result || extra;
  end if;
  return result;
end $$;

revoke all on function public.commercial_stock_v85_loss(bigint[], date, date, jsonb, integer, integer) from public;
revoke all on function public.commercial_kpi_auto_v85(integer) from public;
grant execute on function public.commercial_stock_v85_loss(bigint[], date, date, jsonb, integer, integer) to anon, authenticated;
grant execute on function public.commercial_kpi_auto_v85(integer) to anon, authenticated;
grant execute on function public.commercial_stock_v85_tokens(text) to anon, authenticated, service_role;
grant execute on function public.commercial_stock_v85_size(jsonb) to anon, authenticated, service_role;

do $$
begin
  if to_regclass('commercial_private.auth_resources_v58') is not null then
    insert into commercial_private.auth_resources_v58(name, menus, write_allowed) values
      ('commercial_stock_v85_loss', array['stock'], false),
      ('commercial_kpi_auto_v85', array['kpi'], false)
    on conflict (name) do update set menus = excluded.menus, write_allowed = excluded.write_allowed;
  end if;
end $$;

commit;
