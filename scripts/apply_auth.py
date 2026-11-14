"""Apply reviewed Auth migration to the validated NEW project only. No passwords in inputs."""
import hashlib,json,os,sys
from pathlib import Path
import migrate_supabase as db
ROOT=Path(__file__).resolve().parents[1]

def main():
 mode=os.environ.get('AUTH_MODE','prepare')
 if mode not in ('prepare','activate','rollback'):raise db.MigrationError('Mode Auth tidak valid.')
 if mode in ('activate','rollback') and (os.environ.get('AUTH_WRITES_PAUSED','').lower()!='true' or os.environ.get('AUTH_TARGET_CONFIRMATION','')!=db.TARGET):
  raise db.MigrationError('Hentikan input/sinkron dan isi konfirmasi project tujuan sebelum aktivasi/pemulihan.')
 if mode=='activate' and os.environ.get('AUTH_MASTER_TESTED','').lower()!='true':raise db.MigrationError('Uji login Master pada frontend baru terlebih dahulu.')
 env=db.connection(os.environ.get('MIGRATION_TARGET_DB_URL',''),db.TARGET,False)
 version=db.sql(env,'SHOW server_version_num;')
 if int(version)<170000:raise db.MigrationError('Paket memerlukan PostgreSQL 17 atau lebih baru.')
 exists=db.query(env,"SELECT to_regclass('commercial_private.auth_links_v58') IS NOT NULL;")
 if mode=='prepare' and not exists:
  expected=json.loads((ROOT/'auth-v58/expected-functions.json').read_text())
  for spec in expected:
   actual=db.sql(env,"SELECT md5(pg_get_functiondef(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname="+db.literal(spec['schema'])+" AND p.proname="+db.literal(spec['name'])+" AND pg_get_function_identity_arguments(p.oid)="+db.literal(spec['args'])+";")
   if actual!=spec['md5']:raise db.MigrationError('Definisi fungsi telah berubah sejak audit: '+spec['name']+'. Audit ulang sebelum mengganti login.')
 if mode!='prepare' and not exists:raise db.MigrationError('Jalankan mode prepare terlebih dahulu.')
 if mode=='prepare':
  email=os.environ.get('AUTH_MASTER_EMAIL','').strip()
  if '@' not in email or len(email)>254:raise db.MigrationError('Isi email akun Master yang telah dibuat dan dikonfirmasi di Supabase Authentication.')
  valid=db.query(env,"SELECT EXISTS(SELECT 1 FROM auth.users WHERE lower(email)=lower("+db.literal(email)+") AND email_confirmed_at IS NOT NULL AND deleted_at IS NULL AND coalesce(is_anonymous,false)=false);")
  if not valid:raise db.MigrationError('Email Master belum tersedia/dikonfirmasi di project baru. Buat akun terlebih dahulu; jangan isi password di GitHub.')
  db.sql(env,(ROOT/'auth-v58/01-PASANG-AUTH.sql').read_text())
  linked=db.query(env,"SELECT EXISTS(SELECT 1 FROM commercial_private.auth_links_v58 l JOIN auth.users u ON u.id=l.user_id JOIN commercial_private.pins p ON p.id=l.pin_id WHERE lower(u.email)=lower("+db.literal(email)+") AND l.access_role='master' AND p.enabled);")
  if not linked:db.sql(env,'SELECT public.commercial_auth_bootstrap_v58('+db.literal(email)+');')
  print('PERSIAPAN AUTH LULUS. Akun Master terpetakan. Akses lama belum ditutup. Uji login email/password pada frontend baru.')
 else:
  file='02-AKTIFKAN-AUTH.sql' if mode=='activate' else '03-ROLLBACK-AUTH.sql'
  db.sql(env,(ROOT/'auth-v58'/file).read_text())
  enabled=db.query(env,'SELECT enabled FROM commercial_private.auth_config_v58 WHERE id;')
  if enabled != (mode=='activate'):raise db.MigrationError('Status akhir Auth belum sesuai; periksa database sebelum melanjutkan.')
  print('AUTH AKTIF. Akses Data API memerlukan akun terpetakan; uji aplikasi dan sinkron.' if mode=='activate' else 'PEMULIHAN AKSES LAMA SELESAI. Hak anon/PIN lama terbuka kembali; data bisnis tidak dihapus. Pulihkan frontend lama jika dibutuhkan.')

if __name__=='__main__':
 try:main()
 except db.MigrationError as e:
  print('PEMASANGAN AUTH DIHENTIKAN: '+str(e),file=sys.stderr);sys.exit(1)
