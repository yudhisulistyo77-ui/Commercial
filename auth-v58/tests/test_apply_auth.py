import importlib.util,os,sys,unittest
from pathlib import Path
from unittest.mock import patch
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts'))
spec=importlib.util.spec_from_file_location('apply_auth',ROOT/'scripts/apply_auth.py');a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
class ApplyTests(unittest.TestCase):
 def test_activate_needs_master_test_before_connect(self):
  with patch.dict(os.environ,{'AUTH_MODE':'activate','AUTH_WRITES_PAUSED':'true','AUTH_TARGET_CONFIRMATION':a.db.TARGET,'AUTH_MASTER_TESTED':'false'}),patch.object(a.db,'connection') as conn:
   with self.assertRaises(a.db.MigrationError):a.main()
   conn.assert_not_called()
 def test_wrong_confirmation_blocks_rollback(self):
  with patch.dict(os.environ,{'AUTH_MODE':'rollback','AUTH_WRITES_PAUSED':'true','AUTH_TARGET_CONFIRMATION':'wrong'}),patch.object(a.db,'connection') as conn:
   with self.assertRaises(a.db.MigrationError):a.main()
   conn.assert_not_called()
 def test_unknown_mode_blocks_connect(self):
  with patch.dict(os.environ,{'AUTH_MODE':'anything'}),patch.object(a.db,'connection') as conn:
   with self.assertRaises(a.db.MigrationError):a.main()
   conn.assert_not_called()
 def test_changed_function_prevents_install(self):
  with patch.dict(os.environ,{'AUTH_MODE':'prepare'}),patch.object(a.db,'connection',return_value={}),patch.object(a.db,'query',return_value=False),patch.object(a.db,'sql',side_effect=['170000','DIFFERENT']) as sql:
   with self.assertRaisesRegex(a.db.MigrationError,'berubah sejak audit'):a.main()
   self.assertEqual(sql.call_count,2);self.assertNotIn('CREATE',sql.call_args.args[1])
 def test_missing_auth_user_prevents_install(self):
  with patch.dict(os.environ,{'AUTH_MODE':'prepare','AUTH_MASTER_EMAIL':'master@example.invalid'}),patch.object(a.db,'connection',return_value={}),patch.object(a.db,'query',side_effect=[True,False]),patch.object(a.db,'sql',return_value='170000') as sql:
   with self.assertRaisesRegex(a.db.MigrationError,'belum tersedia'):a.main()
   self.assertEqual(sql.call_count,1)
if __name__=='__main__':unittest.main()
