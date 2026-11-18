#!/usr/bin/env python3
"""Pemeriksaan awal sinkron (V84): token Moka & izin tulis Supabase.

Tidak mengubah data: uji tulis memakai PATCH ke baris yang tidak ada (id = -1).
Pada database READ-ONLY / kuota habis, Postgres/Supabase tetap menolaknya sehingga penyebab terlihat jelas
di ringkasan GitHub Actions, alih-alih proses berhenti tanpa catatan di aplikasi.
"""
import os, sys, json, urllib.request, urllib.error

OLD_REF = 'qrabkayuwglmlaouliwn'
NEW_REF = os.environ.get('EXPECTED_SUPABASE_REF', 'qtgybtbzebmahzyqhkfd')


def out(md):
    print(md.replace('**', ''), flush=True)
    path = os.environ.get('GITHUB_STEP_SUMMARY')
    if path:
        with open(path, 'a', encoding='utf-8') as fh:
            fh.write(md + '\n')


def call(method, url, headers, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.read()[:300].decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read()[:400].decode('utf-8', 'replace')
    except Exception as e:  # jaringan
        return 0, str(e)[:300]


def main():
    problems = []
    token = os.environ.get('MOKA_ACCESS_TOKEN', '')
    code, text = call('GET', 'https://api.mokapos.com/v1/profile/self', {'Authorization': 'Bearer ' + token, 'Accept': 'application/json'})
    if code != 200:
        problems.append(f'Token Moka ditolak (HTTP {code}). Perbarui secret MOKA_ACCESS_TOKEN.' if code in (401, 403)
                        else f'Moka API tidak dapat dihubungi (HTTP {code}): {text[:150]}')

    base = os.environ.get('SUPABASE_URL', '').rstrip('/')
    ref = base.split('//')[-1].split('.')[0]
    if ref == OLD_REF:
        problems.append(f'Secret SUPABASE_URL masih menunjuk project Supabase LAMA ({OLD_REF}). Aplikasi sudah memakai project {NEW_REF} '
                        'sejak 14 Nov 2026, sehingga hasil sinkron tidak terlihat di aplikasi. Ganti secret SUPABASE_URL dan '
                        'SUPABASE_SERVICE_KEY ke project baru.')
    base = base if base.endswith('/rest/v1') else base + '/rest/v1'
    key = os.environ.get('SUPABASE_KEY') or os.environ.get('SUPABASE_SERVICE_KEY', '')
    h = {'apikey': key, 'Content-Type': 'application/json', 'Prefer': 'return=minimal'}
    if key.startswith('eyJ'):
        h['Authorization'] = 'Bearer ' + key
    code, text = call('GET', base + '/stores?select=id&limit=1', h)
    if code != 200:
        if code == 402 or 'quota' in text.lower() or 'exceed' in text.lower():
            problems.append('Supabase membatasi project karena kuota paket Free terlampaui (egress/ukuran DB). '
                            'Buka Supabase → Usage; kecilkan database / tunggu siklus baru / upgrade.')
        elif code in (401, 403):
            problems.append(f'Kunci Supabase ditolak (HTTP {code}). Isi SUPABASE_SERVICE_KEY dengan secret/service_role key.')
        else:
            problems.append(f'Supabase tidak dapat dibaca (HTTP {code}): {text[:200]}')
    else:
        code, text = call('PATCH', base + '/moka_sync_runs?id=eq.-1', h, {'message': 'health-check'})
        if code not in (200, 204):
            low = text.lower()
            if 'read-only' in low or 'read only' in low or '25006' in text:
                problems.append('Database Supabase dalam mode READ-ONLY (umumnya karena ukuran database > 500 MB di paket Free). '
                                'Data tidak bisa disimpan sampai ukuran database diturunkan dan mode read-only dimatikan.')
            elif code == 402 or 'quota' in low or 'exceed' in low:
                problems.append('Supabase menolak penulisan karena kuota terlampaui. Buka Supabase → Usage.')
            else:
                problems.append(f'Uji tulis Supabase gagal (HTTP {code}): {text[:200]}')

    if problems:
        out('### Sinkron dihentikan sebelum menarik data\n\n' + '\n'.join('- ' + p for p in problems))
        return 1
    out(f'Pemeriksaan awal OK: token Moka aktif dan Supabase project {ref} dapat ditulis.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
