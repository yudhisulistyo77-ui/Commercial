-- Tahap persiapan. Login PIN tetap tersedia sampai tahap aktivasi terpisah.
begin;
create table if not exists commercial_private.auth_config_v58(id boolean primary key default true check(id),enabled boolean not null default false);
insert into commercial_private.auth_config_v58(id,enabled) values(true,false) on conflict do nothing;
create table if not exists commercial_private.auth_links_v58(
 user_id uuid primary key references auth.users(id) on delete cascade,
 pin_id uuid not null unique references commercial_private.pins(id),
 access_role text not null check(access_role in ('master','editor','viewer')),
 created_at timestamptz not null default now()
);
alter table commercial_private.auth_links_v58 enable row level security;
alter table commercial_private.auth_config_v58 enable row level security;
revoke all on commercial_private.auth_links_v58,commercial_private.auth_config_v58 from public,anon,authenticated;

create or replace function commercial_private.auth_pin_v58() returns uuid language sql stable security definer set search_path='' as $$
 select l.pin_id from commercial_private.auth_links_v58 l join commercial_private.pins p on p.id=l.pin_id
 join auth.users u on u.id=l.user_id where l.user_id=auth.uid() and p.enabled
 and (u.banned_until is null or u.banned_until<=now()) and u.deleted_at is null
$$;

-- Preserve old implementation under a private name; same active pins drive legacy RPC authorization.
create or replace function commercial_private.session_pin_legacy_v58() returns uuid language sql stable security definer set search_path='' as $$
 select s.pin_id from commercial_private.pin_sessions s join commercial_private.pins p on p.id=s.pin_id
 where s.token_hash=encode(sha256(convert_to(coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-commercial-pin-session',''),'UTF8')),'hex')
 and s.expires_at>now() and p.enabled
$$;
create or replace function commercial_private.session_pin() returns uuid language plpgsql stable security definer set search_path='' as $$
declare result uuid;
begin
 if auth.uid() is not null then return commercial_private.auth_pin_v58();end if;
 if (select enabled from commercial_private.auth_config_v58 where id) then return null;end if;
 return commercial_private.session_pin_legacy_v58();
end $$;

create or replace function public.commercial_auth_session_v58() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;cfg jsonb;pid uuid;
begin
 pid:=commercial_private.auth_pin_v58();
 if pid is null then raise exception 'Akun belum dipetakan Master atau sudah nonaktif.' using errcode='42501';end if;
 select value::jsonb into cfg from public.app_settings where key='kpi_access_v28';
 if jsonb_typeof(cfg)='string' then cfg:=(cfg#>>'{}')::jsonb;end if;
 select jsonb_build_object('id',p.id,'name',p.name,'role',p.role,'access_role',l.access_role,
 'auth_user_id',l.user_id,'expires_at',coalesce((nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'exp')::bigint,extract(epoch from now()+interval '1 hour')::bigint),
 'rule',coalesce(cfg->'users'->p.id::text,'{}'::jsonb)) into result
 from commercial_private.pins p join commercial_private.auth_links_v58 l on l.pin_id=p.id where p.id=pid;
 return result;
end $$;
create or replace function public.commercial_pin_session_v1() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is not null then return public.commercial_auth_session_v58();end if;
 if (select enabled from commercial_private.auth_config_v58 where id) then raise exception 'Masuk dengan akun aplikasi diperlukan.' using errcode='42501';end if;
 select jsonb_build_object('id',p.id,'name',p.name,'role',p.role,'expires_at',extract(epoch from s.expires_at)::bigint) into result
 from commercial_private.pins p join commercial_private.pin_sessions s on s.pin_id=p.id
 where p.id=commercial_private.session_pin_legacy_v58() and s.token_hash=encode(sha256(convert_to(coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-commercial-pin-session',''),'UTF8')),'hex');
 if result is null then raise exception 'Sesi berakhir. Masuk kembali.' using errcode='42501';end if;
 return result;
end $$;

create or replace function commercial_private.auth_master_v58() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from commercial_private.pins where id=commercial_private.auth_pin_v58() and role='master' and enabled)
$$;
create or replace function public.commercial_auth_users_v58() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not commercial_private.auth_master_v58() then raise exception 'Hanya Master dapat mengelola akun.' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('user_id',l.user_id,'id',p.id,'email',u.email,'name',p.name,'role',l.access_role,'enabled',p.enabled) order by p.name),'[]'::jsonb)
 from commercial_private.auth_links_v58 l join commercial_private.pins p on p.id=l.pin_id join auth.users u on u.id=l.user_id);
end $$;

create or replace function public.commercial_auth_save_v58(p_user_id uuid,p_name text,p_role text,p_enabled boolean default true,p_rule jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare pid uuid;old_role text;old_enabled boolean;cfg jsonb;secret text;
begin
 if not commercial_private.auth_master_v58() then raise exception 'Hanya Master dapat mengelola akun.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(1738701,58);
 if p_role not in ('master','editor','viewer') or p_role is null or p_enabled is null or length(btrim(p_name)) not between 1 and 80 or p_name is null
 or jsonb_typeof(p_rule) is distinct from 'object' then raise exception 'Nama, peran, status atau aturan akun tidak valid.';end if;
 if not exists(select 1 from auth.users where id=p_user_id and deleted_at is null and coalesce(is_anonymous,false)=false) then raise exception 'Akun Auth belum tersedia.';end if;
 if jsonb_typeof(coalesce(p_rule->'menus','[]'))<>'array' or jsonb_typeof(coalesce(p_rule->'stores','[]'))<>'array' then raise exception 'Daftar menu/toko tidak valid.';end if;
 if exists(select 1 from jsonb_array_elements_text(coalesce(p_rule->'stores','[]')) s(v) where v !~ '^[0-9]+$' or not exists(select 1 from public.stores t where t.id::text=s.v)) then raise exception 'Toko tidak dikenal.';end if;
 p_rule:=jsonb_set(p_rule,'{stores}',coalesce((select jsonb_agg(v) from jsonb_array_elements_text(coalesce(p_rule->'stores','[]'::jsonb)) a(v)),'[]'::jsonb),true);
 select p.id,l.access_role,p.enabled into pid,old_role,old_enabled from commercial_private.auth_links_v58 l join commercial_private.pins p on p.id=l.pin_id where l.user_id=p_user_id;
 if old_role='master' and old_enabled and (not p_enabled or p_role<>'master') and not exists(select 1 from commercial_private.auth_links_v58 l join commercial_private.pins p on p.id=l.pin_id join auth.users u on u.id=l.user_id where l.user_id<>p_user_id and l.access_role='master' and p.enabled and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())) then raise exception 'Minimal satu akun Master aktif harus dipertahankan.';end if;
 if pid is null then
  secret:=gen_random_uuid()::text||gen_random_uuid()::text;pid:=gen_random_uuid();
  insert into commercial_private.pins(id,name,role,pin_lookup,pin_hash,enabled) values(pid,btrim(p_name),case when p_role='master' then 'master' else 'editor' end,commercial_private.lookup_pin(secret),commercial_private.hash_pin(secret),p_enabled);
  insert into commercial_private.auth_links_v58(user_id,pin_id,access_role) values(p_user_id,pid,p_role);
 else
  update commercial_private.pins set name=btrim(p_name),role=case when p_role='master' then 'master' else 'editor' end,enabled=p_enabled,updated_at=clock_timestamp() where id=pid;
  update commercial_private.auth_links_v58 set access_role=p_role where user_id=p_user_id;
 end if;
 select value::jsonb into cfg from public.app_settings where key='kpi_access_v28' for update;
 if jsonb_typeof(cfg)='string' then cfg:=(cfg#>>'{}')::jsonb;end if;
 cfg:=coalesce(cfg,'{"required":true,"users":{}}'::jsonb);cfg:=jsonb_set(cfg,'{users}',coalesce(cfg->'users','{}'::jsonb),true);
 cfg:=jsonb_set(cfg,array['users',pid::text],p_rule||jsonb_build_object('view_only',p_role='viewer'),true);
 insert into public.app_settings(key,value) values('kpi_access_v28',cfg::text) on conflict(key) do update set value=excluded.value;
 delete from commercial_private.pin_sessions where pin_id=pid;
 return jsonb_build_object('saved',true,'id',pid,'user_id',p_user_id);
end $$;

create or replace function public.commercial_auth_link_email_v58(p_email text,p_name text,p_role text,p_enabled boolean default true,p_rule jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid;
begin
 if not commercial_private.auth_master_v58() then raise exception 'Hanya Master dapat mengelola akun.' using errcode='42501';end if;
 select id into uid from auth.users where lower(email)=lower(btrim(p_email)) and deleted_at is null and email_confirmed_at is not null;
 if uid is null then raise exception 'Email belum tersedia atau belum dikonfirmasi di Supabase Auth.';end if;
 return public.commercial_auth_save_v58(uid,p_name,p_role,p_enabled,p_rule);
end $$;
revoke all on function public.commercial_auth_link_email_v58(text,text,text,boolean,jsonb) from public,anon;
grant execute on function public.commercial_auth_link_email_v58(text,text,text,boolean,jsonb) to authenticated;

-- Run only in SQL Editor, after creating the first confirmed Auth user. No public bootstrap.
create or replace function public.commercial_auth_bootstrap_v58(p_email text) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid;pid uuid;secret text;
begin
 if session_user not in ('postgres','supabase_admin') or coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb ? 'role' then raise exception 'Bootstrap hanya melalui SQL Editor.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(1738701,58);
 if exists(select 1 from commercial_private.auth_links_v58) then raise exception 'Bootstrap sudah dilakukan. Gunakan Master untuk mengelola akun berikutnya.';end if;
 select id into uid from auth.users where lower(email)=lower(btrim(p_email)) and email_confirmed_at is not null and deleted_at is null and coalesce(is_anonymous,false)=false;
 if uid is null then raise exception 'Buat dan konfirmasi akun email tersebut di Authentication Users terlebih dahulu.';end if;
 secret:=gen_random_uuid()::text||gen_random_uuid()::text;pid:=gen_random_uuid();
 insert into commercial_private.pins(id,name,role,pin_lookup,pin_hash,enabled) values(pid,'Master Commercial','master',commercial_private.lookup_pin(secret),commercial_private.hash_pin(secret),true);
 insert into commercial_private.auth_links_v58(user_id,pin_id,access_role) values(uid,pid,'master');
 return jsonb_build_object('created',true,'user_id',uid,'id',pid);
end $$;

revoke all on all tables in schema commercial_private from anon,authenticated;
revoke all on function commercial_private.auth_pin_v58(),commercial_private.auth_master_v58(),commercial_private.session_pin_legacy_v58() from public,anon,authenticated;
revoke all on function public.commercial_auth_bootstrap_v58(text) from public,anon,authenticated,service_role;
revoke all on function public.commercial_auth_session_v58(),public.commercial_auth_users_v58(),public.commercial_auth_save_v58(uuid,text,text,boolean,jsonb) from public,anon;
grant execute on function public.commercial_auth_session_v58(),public.commercial_auth_users_v58(),public.commercial_auth_save_v58(uuid,text,text,boolean,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
