begin;
set local lock_timeout='5s';set local statement_timeout='120s';
alter table commercial_private.sheet_sources_v64 add column if not exists snapshot_hash_v68 text;
alter table commercial_private.sheet_sources_v64 add column if not exists last_updated_v68 integer;
create table if not exists commercial_private.sheet_jobs_v68(id uuid primary key default gen_random_uuid(),kind text not null references commercial_private.sheet_sources_v64(kind),owner_id uuid,worker boolean not null,source jsonb not null,headers jsonb,started_at timestamptz not null default now(),done boolean not null default false);
create unique index if not exists sheet_job_active_v68 on commercial_private.sheet_jobs_v68(kind)where not done;
create table if not exists commercial_private.sheet_stage_v68(job_id uuid not null references commercial_private.sheet_jobs_v68(id)on delete cascade,row_no integer not null,row_data jsonb not null,primary key(job_id,row_no));
revoke all on commercial_private.sheet_jobs_v68,commercial_private.sheet_stage_v68 from public,anon,authenticated;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed)values('commercial_sheet_sync_v68',array['loss','complaints','csl'],true)on conflict(name)do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
create or replace function public.commercial_sheet_sync_v68(p_kind text,p_action text,p_run uuid default null,p_data jsonb default '{}')returns jsonb language plpgsql security definer set search_path=''as $$
declare worker boolean:=coalesce(auth.role()='service_role',false);ids bigint[];j commercial_private.sheet_jobs_v68%rowtype;s commercial_private.sheet_sources_v64%rowtype;bad bigint;n bigint:=0;changed bigint:=0;skipped bigint:=0;total bigint;stored bigint;expected bigint;cursor_value integer;source_key text;
begin
 if p_kind not in('loss','service','product','csl')or p_action not in('begin','batch','commit','abort')then raise exception 'Jenis/aksi tidak valid';end if;
 if not worker then ids:=commercial_private.sheet_scope_v64(p_kind,true);end if;
 perform pg_advisory_xact_lock(hashtext('sheet-'||p_kind));
 select *into s from commercial_private.sheet_sources_v64 where kind=p_kind for update;
 if not found then raise exception 'Sumber belum dikonfigurasi';end if;
 source_key:=s.spreadsheet||'#'||s.gid::text;
 if p_action='begin'then
  -- Expired staging only: published business data is never deleted here.
  delete from commercial_private.sheet_jobs_v68 where (kind=p_kind and started_at<now()-interval '15 minutes')or(done and started_at<now()-interval '1 hour');
  if exists(select 1 from commercial_private.sheet_jobs_v68 where kind=p_kind and not done)then raise exception 'Tarikan sumber ini masih berjalan. Tunggu selesai atau 15 menit untuk memulihkan sesi terputus.';end if;
  insert into commercial_private.sheet_jobs_v68(kind,owner_id,worker,source)values(p_kind,auth.uid(),worker,to_jsonb(s))returning *into j;
  return jsonb_build_object('run_id',j.id,'source',j.source||jsonb_build_object('stored_rows_v68',(select count(*)from commercial_private.sheet_rows_v64 where kind=p_kind and spreadsheet=source_key)));
 end if;
 select *into j from commercial_private.sheet_jobs_v68 where id=p_run and kind=p_kind for update;
 if not found or j.done or j.worker<>worker or(not worker and j.owner_id is distinct from auth.uid())then raise exception 'Sesi tarikan tidak tersedia/di luar izin'using errcode='42501';end if;
 if p_action='abort'then delete from commercial_private.sheet_jobs_v68 where id=j.id;return jsonb_build_object('aborted',true);end if;
 if j.started_at<now()-interval '15 minutes'then delete from commercial_private.sheet_jobs_v68 where id=j.id;raise exception 'Sesi tarikan kedaluwarsa. Coba ulang.';end if;
 if s.spreadsheet is distinct from j.source->>'spreadsheet'or s.gid is distinct from(j.source->>'gid')::bigint or s.updated_at is distinct from(j.source->>'updated_at')::timestamptz then raise exception 'Sumber berubah selama tarikan. Muat ulang.';end if;
 if p_action='batch'then
  if jsonb_typeof(p_data->'rows')is distinct from'array'or jsonb_array_length(p_data->'rows')not between 1 and 500 or jsonb_typeof(p_data->'headers')is distinct from'array'or jsonb_array_length(p_data->'headers')not between 1 and 100 then raise exception 'Batch/header tidak valid';end if;
  if j.headers is not null and j.headers<>p_data->'headers'then raise exception 'Header antar batch berubah';end if;
  if exists(select 1 from jsonb_to_recordset(p_data->'rows')r(row_no integer,date date,payload jsonb,qty numeric,amount numeric,online numeric,offline numeric)where row_no is null or row_no<2 or date is null or date not between '2000-01-01'and '2100-12-31'or jsonb_typeof(payload)is distinct from'object'or length(payload::text)>100000 or qty::text in('NaN','Infinity','-Infinity')or amount::text in('NaN','Infinity','-Infinity')or online not between 1 and 5 or offline not between 1 and 5)then raise exception 'Baris sumber tidak valid; data lama dipertahankan';end if;
  if exists(select 1 from jsonb_array_elements(p_data->'rows')r group by r->>'row_no'having count(*)>1)then raise exception 'Nomor baris ganda dalam batch';end if;
  if exists(select 1 from jsonb_array_elements(p_data->'rows')r join commercial_private.sheet_stage_v68 t on t.job_id=j.id and t.row_no=(r->>'row_no')::integer where t.row_data<>r)then raise exception 'Isi batch berubah saat dikirim ulang';end if;
  insert into commercial_private.sheet_stage_v68(job_id,row_no,row_data)select j.id,(r->>'row_no')::integer,r from jsonb_array_elements(p_data->'rows')r on conflict do nothing;
  update commercial_private.sheet_jobs_v68 set headers=p_data->'headers'where id=j.id;return jsonb_build_object('staged',jsonb_array_length(p_data->'rows'));
 end if;
 expected:=(p_data->>'expected')::bigint;cursor_value:=(p_data->>'cursor')::integer;
 if expected is null or expected<1 or cursor_value is null or cursor_value<2 or coalesce(p_data->>'hash','')!~'^[a-f0-9]{64}$'then raise exception 'Ringkasan sumber tidak valid';end if;
 if s.snapshot_hash_v68 is not null and s.snapshot_hash_v68=p_data->>'hash'and s.cursor=cursor_value and expected=(select count(*)from commercial_private.sheet_rows_v64 where kind=p_kind and spreadsheet=source_key)then
  update commercial_private.sheet_sources_v64 set checked_at=clock_timestamp(),last_new=0,last_updated_v68=0,last_skipped=expected where kind=p_kind;
  delete from commercial_private.sheet_jobs_v68 where id=j.id;return jsonb_build_object('inserted',0,'updated',0,'skipped',expected,'unchanged',true);
 end if;
 select count(*)into total from commercial_private.sheet_stage_v68 where job_id=j.id;
 if total<>expected or exists(select 1 from commercial_private.sheet_stage_v68 where job_id=j.id and row_no>cursor_value)then raise exception 'Batch belum lengkap; data utama tidak diganti';end if;
 -- Refuse source deletions/vanished row slots. An empty/partial download cannot remove history.
 if exists(select 1 from commercial_private.sheet_rows_v64 t where t.kind=p_kind and t.spreadsheet=source_key and not exists(select 1 from commercial_private.sheet_stage_v68 x where x.job_id=j.id and x.row_no=t.row_no))then raise exception 'Ada baris lama yang hilang/kosong di sumber. Pulihkan baris sumber atau periksa sebelum rekonsiliasi; data lama dipertahankan.';end if;
 drop table if exists pg_temp.sheet_candidates_v68;
 create temporary table sheet_candidates_v68(like commercial_private.sheet_rows_v64 including defaults)on commit drop;
 truncate pg_temp.sheet_candidates_v68;
 insert into pg_temp.sheet_candidates_v68(kind,spreadsheet,row_no,sale_date,store_id,store_name,customer,category,color,reason,item,qty,amount,online,offline,duration,status,sla,payload)
 select p_kind,source_key,r.row_no,r.date,(select case when count(distinct a.id)=1 then min(a.id)end from(select id,name from public.stores union all select store_id,alias from public.store_aliases)a where regexp_replace(upper(a.name),'[^A-Z0-9]','','g')=regexp_replace(upper(r.store),'[^A-Z0-9]','','g')),coalesce(nullif(btrim(r.store),''),'(Toko belum diisi)'),coalesce(r.customer,''),coalesce(r.category,''),coalesce(r.color,''),coalesce(r.reason,''),coalesce(r.item,''),r.qty,r.amount,r.online,r.offline,r.duration,coalesce(r.status,''),coalesce(r.sla,''),coalesce((select jsonb_object_agg(k,v)from jsonb_each(r.payload)e(k,v)where not(p_kind='loss'and regexp_replace(upper(k),'[^A-Z0-9]','','g')in('KODETIM','NOINVOICE','HARGA','BULAN'))and not(p_kind='service'and upper(k)like'%INVOICE%')),'{}')
 from commercial_private.sheet_stage_v68 t cross join lateral jsonb_to_record(t.row_data)r(row_no integer,date date,store text,customer text,category text,color text,reason text,item text,qty numeric,amount numeric,online numeric,offline numeric,duration numeric,status text,sla text,payload jsonb)where t.job_id=j.id;
 if ids is not null then
  -- A complete-source reconciliation cannot be published by an account limited to a subset of stores.
  if exists(select 1 from pg_temp.sheet_candidates_v68 where store_id is null or not(store_id=any(ids)))then raise exception 'Rekonsiliasi sumber lengkap memerlukan Master atau akun sinkron dengan akses seluruh toko.'using errcode='42501';end if;
 end if;
 select count(*)into n from pg_temp.sheet_candidates_v68 x where not exists(select 1 from commercial_private.sheet_rows_v64 t where t.kind=x.kind and t.spreadsheet=x.spreadsheet and t.row_no=x.row_no);
 select count(*)into changed from pg_temp.sheet_candidates_v68 x join commercial_private.sheet_rows_v64 t using(kind,spreadsheet,row_no)where(to_jsonb(t)-'imported_at')is distinct from(to_jsonb(x)-'imported_at');
 insert into commercial_private.sheet_rows_v64 as t select *from pg_temp.sheet_candidates_v68
 on conflict(kind,spreadsheet,row_no)do update set sale_date=excluded.sale_date,store_id=excluded.store_id,store_name=excluded.store_name,customer=excluded.customer,category=excluded.category,color=excluded.color,reason=excluded.reason,item=excluded.item,qty=excluded.qty,amount=excluded.amount,online=excluded.online,offline=excluded.offline,duration=excluded.duration,status=excluded.status,sla=excluded.sla,payload=excluded.payload,imported_at=clock_timestamp()
 where(to_jsonb(t)-'imported_at')is distinct from(to_jsonb(excluded)-'imported_at');
 skipped:=total-n-changed;
 update commercial_private.sheet_sources_v64 set headers=j.headers,cursor=cursor_value,last_anchor=null,snapshot_hash_v68=p_data->>'hash',checked_at=clock_timestamp(),updated_at=clock_timestamp(),last_new=n,last_updated_v68=changed,last_skipped=skipped where kind=p_kind;
 delete from commercial_private.sheet_jobs_v68 where id=j.id;
 return jsonb_build_object('inserted',n,'updated',changed,'skipped',skipped,'cursor',cursor_value);
end$$;
revoke all on function public.commercial_sheet_sync_v68(text,text,uuid,jsonb)from public,anon;
grant execute on function public.commercial_sheet_sync_v68(text,text,uuid,jsonb)to authenticated,service_role;
notify pgrst,'reload schema';
commit;
