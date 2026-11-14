#!/usr/bin/env python3
"""Read-only schema/access audit. No application rows or user sessions exported."""
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

# Reuse the connection validation and sanitized PostgreSQL errors already installed
# by the successful migration kit. Importing it does not execute its main().
import migrate_supabase as db

SCHEMAS = ['commercial_private', 'public']


def redact(text, password=''):
    if password:
        text = text.replace(password, '[REDACTED_DB_PASSWORD]')
    patterns = [
        (r'postgres(?:ql)?://[^\s\"\'<>]+', '[REDACTED_DB_URI]'),
        (r'sb_(?:secret|publishable)_[A-Za-z0-9_-]+', '[REDACTED_API_KEY]'),
        (r'eyJ[A-Za-z0-9_-]{12,}(?:\.[A-Za-z0-9_-]+){0,2}', '[REDACTED_TOKEN]'),
        (r'\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}', '[REDACTED_PASSWORD_HASH]'),
    ]
    for pattern, replacement in patterns:
        text = re.sub(pattern, replacement, text)
    return text


def collect(env):
    # All statements below are SELECT/SHOW, inside a read-only repeatable-read
    # transaction per query. No table contents, email, PIN, session or credential
    # values are selected. Definitions are metadata required for adapting legacy RPCs.
    names = ','.join(db.literal(s) for s in SCHEMAS)
    def rows(select):
        statement = ("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;\n"
                     "SET LOCAL statement_timeout='60s';\n"
                     "SELECT coalesce(json_agg(a),'[]') FROM (" + select + ") a;\nCOMMIT;")
        # -q removes BEGIN/COMMIT tags so output remains a single JSON document.
        output = db.run(['psql','-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-f','-'], env,
                        data=statement, timeout=120)
        try:
            return json.loads(output.strip())
        except (ValueError, TypeError):
            raise db.MigrationError('Respons audit tidak valid; isi mentah tidak ditampilkan.') from None
    report = {
        'format': 'commercial-access-audit-v1',
        'target_project': db.TARGET,
        'generated_at_utc': datetime.now(timezone.utc).isoformat(),
        'read_only': True,
        'application_rows_exported': False,
        'schemas': SCHEMAS,
    }
    report['relations'] = rows("""SELECT n.nspname AS schema,c.relname AS name,c.relkind::text AS kind,
        pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity AS rls,c.relforcerowsecurity AS force_rls
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname IN ("""+names+""") AND c.relkind IN ('r','p','v','m','S','f')
        AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e')
        ORDER BY 1,2""")
    report['columns'] = rows("""SELECT table_schema AS schema,table_name,column_name,ordinal_position,
        data_type,udt_schema,udt_name,is_nullable,is_identity,is_generated
        FROM information_schema.columns WHERE table_schema IN ("""+names+""") ORDER BY 1,2,4""")
    report['constraints'] = rows("""SELECT n.nspname AS schema,c.relname AS name,k.conname,k.contype::text,
        pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k
        JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname IN ("""+names+""") ORDER BY 1,2,3""")
    report['functions'] = rows("""SELECT n.nspname AS schema,p.proname AS name,
        pg_get_function_identity_arguments(p.oid) AS args,pg_get_userbyid(p.proowner) AS owner,
        p.prokind::text AS kind,p.prosecdef AS security_definer,p.provolatile::text AS volatility,
        p.proconfig AS settings,pg_get_functiondef(p.oid) AS definition
        FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
        WHERE n.nspname IN ("""+names+""") AND p.prokind IN ('f','p')
        AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e')
        ORDER BY 1,2,3""")
    report['views'] = rows("""SELECT n.nspname AS schema,c.relname AS name,c.reloptions AS options,
        pg_get_viewdef(c.oid,true) AS definition FROM pg_class c
        JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname IN ("""+names+""") AND c.relkind IN ('v','m') ORDER BY 1,2""")
    report['policies'] = rows("SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname IN ("+names+") ORDER BY 1,2,3")
    report['triggers'] = rows("""SELECT n.nspname AS schema,c.relname AS name,t.tgname,
        pg_get_triggerdef(t.oid,true) AS definition FROM pg_trigger t
        JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname IN ("""+names+""") AND NOT t.tgisinternal ORDER BY 1,2,3""")
    report['object_grants'] = db.object_grants(env,SCHEMAS)
    report['postgres_defaults'] = db.postgres_defaults(env,SCHEMAS)
    report['api_hooks'] = rows("""SELECT pg_get_userbyid(s.setrole) AS role,
        coalesce(d.datname,'*') AS database,config FROM pg_db_role_setting s
        LEFT JOIN pg_database d ON d.oid=s.setdatabase
        CROSS JOIN LATERAL unnest(s.setconfig) config
        WHERE config LIKE 'pgrst.db_pre_request=%' ORDER BY 1,2""")
    required = {'commercial_pin_login_v1','commercial_pin_session_v1','commercial_master_actor_v1','commercial_scope_v38'}
    found = {f['name'] for f in report['functions'] if f['schema']=='public'}
    report['missing_legacy_functions'] = sorted(required-found)
    return report


def main():
    env = db.connection(os.environ.get('MIGRATION_TARGET_DB_URL',''), db.TARGET, True)
    print('Audit akses: project '+db.TARGET+'; koneksi hanya baca.', flush=True)
    if db.sql(env,'SHOW transaction_read_only;') != 'on':
        raise db.MigrationError('Koneksi audit harus read-only.')
    report = collect(env)
    def sanitized(value):
        if isinstance(value,str):return redact(value,env.get('PGPASSWORD',''))
        if isinstance(value,list):return [sanitized(v) for v in value]
        if isinstance(value,dict):return {k:sanitized(v) for k,v in value.items()}
        return value
    parsed=sanitized(report)
    parsed['known_secret_redactions_applied'] = report != parsed
    output = Path('access-audit-output/commercial-access-audit.json')
    output.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
    output.write_text(json.dumps(parsed,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    output.chmod(0o600)
    print('AUDIT AKSES SELESAI: '+str(len(report['relations']))+' objek; '+str(len(report['functions']))+' fungsi; '+str(len(report['policies']))+' policy.',flush=True)
    print('Tidak mengubah login, izin, tabel, data atau sinkron. Unduh artifact commercial-access-audit.',flush=True)
    if report['missing_legacy_functions']:
        print('Fungsi lama tidak ditemukan: '+', '.join(report['missing_legacy_functions']),flush=True)


if __name__=='__main__':
    try:
        main()
    except db.MigrationError as error:
        print('AUDIT DIHENTIKAN: '+str(error),file=sys.stderr)
        sys.exit(1)
