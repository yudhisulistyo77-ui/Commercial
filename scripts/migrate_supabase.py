"""Guarded one-time application database migration. Source is read-only.
No API keys, shell interpolation, automatic retries, or destructive target cleanup.
Managed Auth/Storage/Vault/jobs with user content stop the migration explicitly.
"""
import json
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import unquote, urlsplit, parse_qs

SOURCE = 'qrabkayuwglmlaouliwn'
TARGET = 'qtgybtbzebmahzyqhkfd'
MANAGED = ('auth','storage','extensions','graphql','graphql_public','realtime',
           'supabase_migrations','_realtime','_analytics','supabase_internal','pgbouncer','vault','pgsodium','pgsodium_masks','net','cron','supabase_functions')

class MigrationError(Exception):
    pass


def connection(raw, project, readonly):
    try:
        raw = raw.strip()
        if any(c in raw for c in ('\n','\r','\t')):
            raise MigrationError('Connection string mengandung baris baru/tab. Salin URI dalam satu baris.')
        if any(x in raw.lower() for x in ('[your-password]','[password]','<password>')):
            raise MigrationError('Placeholder password belum diganti pada connection string.')
        u = urlsplit(raw)
        raw_password = u.password or ''
        if any(x in raw_password.lower() for x in ('[your-password]','[password]','<password>')):
            raise MigrationError('Placeholder password belum diganti pada connection string.')
        if re.search(r'%(?![0-9a-fA-F]{2})',raw_password):
            raise MigrationError('Karakter persen pada password belum di-URL-encode. Persen literal harus %25.')
        user = unquote(u.username or '')
        password = unquote(u.password or '')
        port = u.port or 5432
        host = u.hostname or ''
        direct = host == 'db.' + project + '.supabase.co'
        pooler = host.endswith('.pooler.supabase.com') and user == 'postgres.' + project
        if (u.scheme not in ('postgres','postgresql') or not (direct or pooler)
                or port != 5432 or not password or unquote(u.path) != '/postgres'
                or (direct and user != 'postgres') or u.fragment):
            raise ValueError()
        params = parse_qs(u.query)
        if any(k not in ('sslmode',) for k in params):
            raise ValueError()
        if params.get('sslmode', ['require'])[-1] not in ('require','verify-ca','verify-full'):
            raise ValueError()
    except (ValueError, TypeError):
        raise MigrationError('Connection string tidak sesuai project/port. Gunakan Connect → Session pooler port 5432, user postgres.PROJECT_REF dan password URL-encoded.') from None
    env = {k:v for k,v in os.environ.items() if not k.startswith('PG')}
    env.update(PGHOST=host, PGPORT=str(port), PGDATABASE='postgres', PGUSER=user,
               PGPASSWORD=password, PGSSLMODE=params.get('sslmode',['require'])[-1], PGCONNECT_TIMEOUT='15',
               PGAPPNAME='commercial-migration-read' if readonly else 'commercial-migration-write',
               PGOPTIONS='-c timezone=UTC -c datestyle=ISO,MDY -c extra_float_digits=3' +
                         (' -c default_transaction_read_only=on' if readonly else ''))
    return env


def permission_detail(stderr, env):
    # Only PostgreSQL permission diagnostics, never SQL/COPY context or raw stderr.
    allowed=re.compile(r'permission denied|must be (?:owner|member|superuser|able to set role)|only superusers|not permitted to|must have .*privilege',re.I)
    details=[]
    for line in (stderr or '').splitlines():
        found=re.search(r'(?:ERROR|FATAL):\s*(.+)',line)
        if not found or not allowed.search(found.group(1)):continue
        value=found.group(1)
        value=re.sub(r"'(?:[^']|'')*'", "'[nilai disembunyikan]'",value)
        value=re.sub(r'postgres(?:ql)?://\S+','[URI disembunyikan]',value)
        if env.get('PGPASSWORD'):value=value.replace(env['PGPASSWORD'],'[password disembunyikan]')
        if value not in details:details.append(value[:240])
        if len(details)>=2:break
    return ' | '.join(details)


def run(args, env, *, data=None, timeout=1800):
    try:
        p = subprocess.run(args, input=data, text=True, capture_output=True, env=env, timeout=timeout)
    except subprocess.TimeoutExpired:
        raise MigrationError('Batas waktu operasi tercapai. Tujuan belum boleh dipakai; periksa log/status sebelum mengulang.') from None
    if p.returncode:
        # Raw stderr may contain connection strings, SQL statements, or customer rows.
        err = (p.stderr or '').lower()
        if 'maxclientsinsessionmode' in err or 'max clients reached' in err: message='Kapasitas Session pooler sedang penuh. Tutup koneksi lain dan coba lagi setelah tersedia.'
        elif 'tenant or user not found' in err: message='Tenant/user pooler tidak ditemukan. Salin ulang HOST dan username dari Connect pada project yang benar.'
        elif 'too many authentication failures' in err: message='Terlalu banyak kegagalan autentikasi. Hentikan percobaan berulang; periksa password dan pembatasan koneksi di Dashboard.'
        elif 'connection timed out' in err or 'timeout expired' in err: message='Koneksi timeout. Periksa host, port dan Network Restrictions project.'
        elif 'password authentication failed' in err: message='Password database ditolak. Periksa Secret, bukan publishable/service-role key.'
        elif 'could not translate host' in err or 'network is unreachable' in err: message='Host tidak terjangkau. Gunakan Session pooler 5432 untuk runner IPv4.'
        elif 'version mismatch' in err: message='Versi pg_dump lebih tua dari server. Perbarui image PostgreSQL pada workflow.'
        elif 'permission denied' in err or permission_detail(p.stderr,env): message='Operasi PostgreSQL ditolak oleh izin database. Koneksi berhasil bukan berarti semua objek sistem dapat dipulihkan.'
        elif 'already exists' in err: message='Objek tujuan bertabrakan dengan backup. Restore dibatalkan; jangan hapus objek otomatis.'
        elif 'no space left' in err or 'disk full' in err: message='Penyimpanan tujuan tidak cukup; migrasi dibatalkan.'
        elif 'does not exist' in err: message='Dependensi role/extension/objek belum tersedia. Restore dibatalkan; periksa konfigurasi tujuan.'
        else: message='Operasi PostgreSQL gagal. Detail mentah disembunyikan agar password/data pelanggan tidak tercetak. Periksa koneksi, versi, dependensi dan kapasitas melalui Dashboard.'
        detail=permission_detail(p.stderr,env)
        if detail:message+=' Detail izin: '+detail
        raise MigrationError(message)
    return p.stdout


def sql(env, text):
    return run(['psql','-X','-A','-t','-v','ON_ERROR_STOP=1','-f','-'], env, data=text, timeout=1200).strip()


def query(env, text):
    out = sql(env, text)
    # psql prints SQL booleans as t/f, not JSON true/false.
    if out == 't':return True
    if out == 'f':return False
    return json.loads(out) if out else None


def quote(name):
    return '"' + name.replace('"','""') + '"'


def literal(value):
    return "'" + value.replace("'", "''") + "'"


def user_schemas(env):
    excluded=','.join(literal(n) for n in MANAGED)
    return query(env, "SELECT coalesce(json_agg(nspname ORDER BY nspname),'[]') FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname <> 'information_schema' AND nspname NOT IN ("+excluded+");")


def inventory(env, schemas):
    names=','.join(literal(n) for n in schemas)
    return query(env, """SELECT coalesce(json_agg(x ORDER BY x.schema,x.name),'[]') FROM (
      SELECT n.nspname AS schema,c.relname AS name,c.relkind::text AS kind,c.relrowsecurity AS rls
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname IN ("""+names+""") AND c.relkind IN ('r','p','v','m','S','f')
      AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e')
    ) x;""")


def functions(env, schemas):
    names=','.join(literal(n) for n in schemas)
    return query(env, """SELECT coalesce(json_agg(x ORDER BY x.schema,x.name,x.args),'[]') FROM (
      SELECT n.nspname AS schema,p.proname AS name,pg_get_function_identity_arguments(p.oid) AS args,
      p.prosecdef AS security_definer,md5(pg_get_functiondef(p.oid)) AS definition_md5
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname IN ("""+names+""") AND p.prokind IN ('f','p')
      AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
    ) x;""")


def policies(env, schemas):
    names=','.join(literal(n) for n in schemas)
    return query(env, "SELECT coalesce(json_agg(x ORDER BY x.schemaname,x.tablename,x.policyname),'[]') FROM (SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname IN ("+names+")) x;")


def fingerprints(env, tables):
    result=[]
    for t in tables:
        if t['kind'] not in ('r','p','m'): continue
        # row hash totals are order-independent; avoids returning actual customer data.
        name=quote(t['schema'])+'.'+quote(t['name'])
        value=query(env,"SELECT json_build_object('count',count(*),'hash1',coalesce(sum(('x'||substr(md5(row_to_json(t)::text),1,16))::bit(64)::bigint)::text,'0'),'hash2',coalesce(sum(('x'||substr(md5(row_to_json(t)::text),17,16))::bit(64)::bigint)::text,'0')) FROM "+name+" t;")
        result.append({'schema':t['schema'],'name':t['name'],**value})
    return result


def sequence_state(env, tables):
    result=[]
    for t in tables:
        if t['kind']!='S':continue
        v=query(env,"SELECT json_build_object('last_value',last_value::text,'is_called',is_called) FROM "+quote(t['schema'])+'.'+quote(t['name'])+';')
        result.append({'schema':t['schema'],'name':t['name'],**v})
    return result


def target_empty(env, schemas):
    if inventory(env, schemas) or functions(env, schemas):
        raise MigrationError('Tujuan sudah berisi tabel/view/sequence/fungsi aplikasi. Tidak ditimpa. Gunakan tujuan baru yang kosong atau audit hasil percobaan sebelumnya.')
    names=','.join(literal(n) for n in schemas)
    custom_types=query(env,"SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname IN ("+names+") AND t.typtype IN ('e','d','c','r','m') AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_type'::regclass AND d.objid=t.oid AND d.deptype='e');")
    if custom_types:raise MigrationError('Tujuan memiliki tipe SQL aplikasi. Migrasi tidak menimpa schema yang telah dipakai.')


def managed_checks(env):
    checks={'auth.users':'User Supabase Auth','storage.objects':'File Storage','storage.buckets':'Bucket Storage','vault.secrets':'Secret terenkripsi Vault','cron.job':'Jadwal cron','supabase_functions.hooks':'Database webhook'}
    for table,label in checks.items():
        if query(env,'SELECT to_regclass('+literal(table)+') IS NOT NULL;'):
            if int(sql(env,'SELECT count(*) FROM '+'.'.join(quote(n) for n in table.split('.'))+';')):
                raise MigrationError(label+' ditemukan. Kit ini tidak menyalin layanan platform tersebut otomatis; perlu migrasi khusus sebelum melanjutkan agar tidak ada data/pekerjaan yang diam-diam terlewat.')


def extension_list(env):
    return query(env,"SELECT coalesce(json_agg(x ORDER BY x.name),'[]') FROM (SELECT e.extname AS name,n.nspname AS schema,e.extversion AS version FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname <> 'plpgsql') x;")


def filter_toc(text):
    # Fresh Supabase already owns public. Keep its ACL/comment; omit only CREATE SCHEMA public.
    return '\n'.join(line for line in text.splitlines() if not re.match(r'^\d+; \d+ \d+ SCHEMA - public(?: |$)',line))+'\n'


def verify(a,b,label):
    if a!=b:raise MigrationError('Verifikasi '+label+' tidak cocok. Jangan alihkan aplikasi; tujuan perlu diperiksa. Sumber tetap dipertahankan.')


def inspect_connections():
    result={};failures=[]
    for label,project,secret,readonly in (
        ('LAMA',SOURCE,'MIGRATION_SOURCE_DB_URL',True),
        ('BARU',TARGET,'MIGRATION_TARGET_DB_URL',False)):
        print('Memeriksa '+label+' ('+project+') — Secret '+secret+'...',flush=True)
        try:
            env=connection(os.environ.get(secret,''),project,readonly)
            version=int(sql(env,'SHOW server_version_num;'))
            print(label+': KONEKSI OK (PostgreSQL '+str(version//10000)+').',flush=True)
            result[label]=(env,version)
        except MigrationError as error:
            print(label+': GAGAL — '+str(error),flush=True)
            failures.append(label+' / '+secret)
    if failures:
        raise MigrationError('Perbaiki hanya koneksi yang gagal: '+', '.join(failures)+'. Belum ada proses restore.')
    return result['LAMA'],result['BARU']


def main():
    mode=os.environ.get('MIGRATION_MODE','check')
    if mode not in ('check','migrate'):raise MigrationError('Mode harus check atau migrate.')
    if mode=='migrate' and (os.environ.get('MIGRATION_WRITES_PAUSED','').lower()!='true' or os.environ.get('MIGRATION_TARGET_CONFIRMATION','')!=TARGET):
        raise MigrationError('Untuk migrate, hentikan semua penulisan dan isi konfirmasi project tujuan.')
    for tool in ('psql','pg_dump','pg_restore'):
        if not shutil.which(tool):raise MigrationError('Alat PostgreSQL tidak tersedia pada runner: '+tool)
    print('Memeriksa koneksi lama dan baru; sumber hanya dibaca.',flush=True)
    (source,source_version),(target,target_version)=inspect_connections()
    if target_version//10000 < source_version//10000:raise MigrationError('Versi major PostgreSQL tujuan lebih lama dari sumber.')
    print('Memeriksa schema aplikasi, layanan managed dan tujuan kosong...',flush=True)
    schemas=user_schemas(source)
    if not schemas or 'public' not in schemas:raise MigrationError('Schema public sumber tidak ditemukan.')
    managed_checks(source);managed_checks(target);target_empty(target,schemas)
    objects=inventory(source,schemas);funcs=functions(source,schemas);rules=policies(source,schemas)
    custom_definers=query(source,"SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prosecdef AND n.nspname IN ("+','.join(literal(n) for n in schemas)+") AND pg_get_userbyid(p.proowner) <> 'postgres' AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e');")
    if custom_definers:raise MigrationError('Fungsi SECURITY DEFINER dimiliki role selain postgres. Diperlukan migrasi role/owner khusus agar izin tidak berubah.')
    source_bytes=int(sql(source,"SELECT coalesce(sum(pg_total_relation_size(c.oid)),0) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','m') AND n.nspname IN ("+','.join(literal(n) for n in schemas)+");"))
    target_bytes=int(sql(target,'SELECT pg_database_size(current_database());'))
    print('Estimasi data+index aplikasi: '+str(round(source_bytes/1024/1024,1))+' MiB; database tujuan saat ini: '+str(round(target_bytes/1024/1024,1))+' MiB.',flush=True)
    if source_bytes+target_bytes>500*1024*1024:raise MigrationError('Estimasi ukuran gabungan melebihi 500 MiB. Audit ukuran tabel/index sebelum migrasi Free Plan; tidak menghapus data otomatis.')
    if any(t['kind']=='f' for t in objects):raise MigrationError('Foreign table ditemukan; sumber eksternal tidak dapat dipindahkan sebagai data lokal otomatis.')
    if not any(t['name']=='stores' and t['schema']=='public' for t in objects):raise MigrationError('Tabel stores tidak ditemukan di sumber. Periksa project asal.')
    exts=extension_list(source)
    unsupported=[e for e in exts if e['schema'] in schemas]
    if unsupported:raise MigrationError('Extension di schema aplikasi ditemukan. Pindahkan/konfigurasikan extension melalui rencana migrasi khusus terlebih dahulu; tidak dibongkar otomatis.')
    target_ext={x['name'] for x in extension_list(target)}
    missing=[x['name'] for x in exts if x['name'] not in target_ext]
    if missing:raise MigrationError('Aktifkan extension yang sama pada tujuan melalui Database → Extensions: '+', '.join(missing))
    extra_target=set(user_schemas(target))-set(schemas)
    if extra_target:raise MigrationError('Tujuan memiliki schema aplikasi tambahan; periksa dahulu agar tidak mencampur dua aplikasi.')
    print('Koneksi OK. Tujuan kosong; schema '+', '.join(schemas)+'. Objek '+str(len(objects))+', fungsi '+str(len(funcs))+', policy '+str(len(rules))+'.',flush=True)
    if mode=='check':
        print('CHECK LULUS. Belum ada data atau struktur yang ditulis ke tujuan.');return
    before=fingerprints(source,objects);seq=sequence_state(source,objects)
    with tempfile.TemporaryDirectory(prefix='commercial-migration-') as td:
        os.chmod(td,0o700);dump=Path(td)/'database.dump';listing=Path(td)/'restore.list'
        args=['pg_dump','--format=custom','--no-owner','--file',str(dump)]
        for name in schemas:args+=['--schema',name]
        print('Membuat snapshot struktur dan data. Jangan aktifkan sinkron/input.',flush=True)
        run(args,source)
        os.chmod(dump,0o600)
        verify(before,fingerprints(source,objects),'sumber tetap stabil selama backup')
        listing.write_text(filter_toc(run(['pg_restore','--list',str(dump)],source)))
        # Restore DDL, data, indexes, grants, RLS and functions in one transaction. No --clean.
        print('Memulihkan snapshot ke tujuan dalam satu transaksi.',flush=True)
        run(['pg_restore','--no-owner','--exit-on-error','--single-transaction','--use-list',str(listing),'--dbname','postgres',str(dump)],target)
    verify(objects,inventory(target,schemas),'tabel/view/sequence dan RLS')
    verify(funcs,functions(target,schemas),'definisi fungsi')
    verify(rules,policies(target,schemas),'policy akses')
    verify(before,fingerprints(target,objects),'jumlah baris dan sidik isi')
    verify(seq,sequence_state(target,objects),'sequence ID')
    verify(before,fingerprints(source,objects),'sumber tidak berubah sampai akhir')
    sql(target,"NOTIFY pgrst, 'reload schema';")
    print('MIGRASI DAN VERIFIKASI DATABASE LULUS. Sumber tidak dihapus. Aplikasi/Secrets sinkron belum dialihkan.',flush=True)
    print('Uji login PIN, sales, SSSG, Member, CSV/PNG dan sinkron sebelum mengalihkan produksi.',flush=True)
    summary=os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary,'a') as f:f.write('## Migrasi database lulus\n\nStruktur, fungsi, RLS, jumlah/sidik baris dan sequence cocok.\n\nProject lama dipertahankan. Koneksi aplikasi, workflow, Storage, Auth config dan Edge Functions tidak dialihkan otomatis. Uji aplikasi sebelum cutover.\n')

if __name__=='__main__':
    try:main()
    except (MigrationError,json.JSONDecodeError) as e:
        print('MIGRASI DIHENTIKAN: '+str(e) if isinstance(e,MigrationError) else 'MIGRASI DIHENTIKAN: respons pemeriksaan database tidak valid.',flush=True)
        raise SystemExit(1)
