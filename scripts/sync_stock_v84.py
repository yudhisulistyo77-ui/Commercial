#!/usr/bin/env python3
"""Stock & Distribusi V84 — sumber Moka API saja.

Per outlet:
  1. Item Library  /v1/outlets/{id}/items        → stok saat ini (in_stock), alert, track_stock, HPP (cogs)
  2. Item Sales    /v3/outlets/{id}/reports/item_sales → qty terjual 14 hari, 14 hari sebelumnya, 30 hari, 90 hari
     (s.d. kemarin WITA). Selisih dengan Sales Summary dicatat sebagai peringatan, tidak menghentikan stok.
  3. Ditulis per toko lewat commercial_stock_v84_write (snapshot baru terbit hanya jika seluruh baris masuk).

Inventory Summary tidak tersedia di API publik Moka, sehingga tidak dipakai.
Token/kunci hanya dibaca dari environment (GitHub Secrets).
"""
import os, re, sys, json, time
from pathlib import Path
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from moka_sync import Moka, Supa, HttpError, find_store, BRANDS, norm  # noqa: E402

WITA = timezone(timedelta(hours=8))
BATCH = int(os.environ.get('STOCK_BATCH_SIZE', '1000'))
WORKERS = max(1, min(4, int(os.environ.get('STOCK_WORKERS', '3'))))
DRY_RUN = os.environ.get('DRY_RUN', '0').lower() in ('1', 'true', 'yes')


def log(msg):
    print(msg, flush=True)


def summary(md):
    path = os.environ.get('GITHUB_STEP_SUMMARY')
    if path:
        with open(path, 'a', encoding='utf-8') as fh:
            fh.write(md + '\n')


def num(v):
    if v is None or isinstance(v, bool) or str(v).strip() == '':
        return None
    try:
        n = float(v)
    except (TypeError, ValueError):
        return None
    return n if n == n and abs(n) != float('inf') else None


def explain_db_error(e):
    text = str(e)
    if isinstance(e, HttpError):
        if e.code == 402 or 'exceed' in text.lower() or 'quota' in text.lower():
            return 'Supabase menolak permintaan karena kuota paket Free terlampaui (egress/ukuran database). Kurangi ukuran database atau upgrade paket.'
        if 'read-only' in text.lower() or 'read only' in text.lower() or '25006' in text:
            return 'Database Supabase dalam mode READ-ONLY (biasanya karena ukuran database > 500 MB pada paket Free). Kecilkan database lalu matikan read-only di dashboard Supabase.'
        if e.code == 404 or 'PGRST202' in text:
            return 'Fungsi commercial_stock_v84_write belum ada. Jalankan STOCK-V84.sql di Supabase SQL Editor.'
        if e.code in (401, 403):
            return 'Kunci Supabase ditolak. Pastikan secret SUPABASE_SERVICE_KEY berisi secret/service_role key.'
    return text[:400]


# ------------------------------------------------------------------ Moka
def read_catalogue(moka, oid):
    path, params, out, seen = f'/v1/outlets/{oid}/items', {'per_page': 1000}, [], set()
    for _ in range(300):
        d = moka.get(path, params, retries=4)
        batch = d.get('items')
        if not isinstance(batch, list):
            raise ValueError('Item Library tanpa daftar items')
        out.extend(batch)
        nxt = d.get('next_url')
        if nxt and batch:
            if nxt in seen:
                raise ValueError('Pagination Item Library berulang')
            seen.add(nxt)
            path, params = nxt, None
            continue
        total = d.get('total_count')
        if total is not None and int(total) != len(out):
            raise ValueError(f'Item Library belum lengkap ({len(out)} dari {total})')
        return out
    raise ValueError('Batas halaman Item Library tercapai')


def read_item_sales(moka, oid, start, end):
    """Satu jendela tanggal. Mengikuti next_url bila ada. Mengembalikan (rows, catatan)."""
    path = f'/v3/outlets/{oid}/reports/item_sales'
    params = {'start': start.strftime('%d/%m/%Y'), 'end': end.strftime('%d/%m/%Y'), 'per_page': 1000}
    rows, seen = [], set()
    for _ in range(200):
        d = moka.get(path, params, retries=4)
        batch = d.get('item_sales')
        if not isinstance(batch, list):
            raise ValueError('Item Sales tanpa daftar baris')
        rows.extend(batch)
        nxt = d.get('next_url')
        if nxt and batch and nxt not in seen:
            seen.add(nxt)
            path, params = nxt, None
            continue
        break
    note = None
    try:
        ss = moka.sales_summary(oid, start, end)
        expected = num(ss.get('net_sales'))
        actual = sum(num(r.get('net_sales')) or 0 for r in rows)
        gap = abs(actual - expected) if expected is not None else 0
        if expected is not None and gap > max(10, 0.5 * len(rows)) + 0.005 * abs(expected):
            note = f'Item Sales {actual:,.0f} vs Sales Summary {expected:,.0f} ({start:%d/%m}-{end:%d/%m})'
            if gap > 0.02 * max(abs(expected), 1):
                note = '!' + note
    except Exception as e:  # ringkasan hanya untuk pengecekan
        note = 'Sales Summary tidak terbaca: ' + str(e)[:120]
    return rows, note


# ------------------------------------------------------------------ olah
def name_key(name):
    """V86: kunci nama item lintas toko (huruf/angka saja, kapital)."""
    return re.sub(r'[^A-Z0-9]', '', str(name or '').upper())


def variant_name(item, v):
    return ' '.join(x for x in (str(item.get('name') or '').strip(), str(v.get('name') or '').strip()) if x)


def global_name_index(catalogues):
    """V86: indeks lintas SELURUH lokasi agar varian tanpa SKU tetap tercocok dengan item yang sama di DC/toko lain.
    * nama → SKU (hanya bila nama itu punya tepat 1 SKU di semua lokasi)
    * id varian Moka → nama kanonik (nama terbanyak untuk id itu; menangani item yang diganti nama di satu toko)"""
    seen, vid_names = {}, {}
    for items in catalogues:
        for item in items or []:
            if item.get('is_deleted'):
                continue
            for v in item.get('item_variants') or []:
                if v.get('is_deleted'):
                    continue
                nk, sku = name_key(variant_name(item, v)), norm(v.get('sku'))
                if sku:
                    seen.setdefault(nk, set()).add(sku)
                elif v.get('id') is not None and nk:
                    c = vid_names.setdefault(str(v['id']), {})
                    c[nk] = c.get(nk, 0) + 1
    out = {k: next(iter(v)) for k, v in seen.items() if k and len(v) == 1}
    out['__vid__'] = {vid: max(c.items(), key=lambda kv: (kv[1], kv[0]))[0] for vid, c in vid_names.items()}
    return out


def build_rows(items, reports, gindex=None):
    """Gabung variant per SKU (SKU sama dalam satu toko dijumlah).
    V86: varian tanpa SKU memakai SKU item bernama sama di lokasi lain; bila tidak ada, kunci NM:<nama>
    (sama di semua toko) — sebelumnya ID:<variant> yang unik per toko sehingga stok DC/toko lain tidak tercocok."""
    gindex = gindex or {}
    by_key, name_index = {}, {}
    untracked = 0
    for item in items:
        if item.get('is_deleted'):
            continue
        variants = item.get('item_variants') or []
        cat = item.get('category')
        cat = (cat or {}).get('name') if isinstance(cat, dict) else cat
        brand = BRANDS.get(str(item.get('brand_id'))) or 'LAINNYA'
        for v in variants:
            if v.get('is_deleted'):
                continue
            sku = norm(v.get('sku'))
            name = variant_name(item, v)
            nk = name_key(name)
            canon = (gindex.get('__vid__') or {}).get(str(v.get('id'))) or nk
            key = sku or gindex.get(nk) or gindex.get(canon) or (f"NM:{canon}" if canon else f"ID:{v.get('id')}")
            tracked = not (v.get('track_stock') is False or item.get('track_stock') is False)
            qty = num(v.get('in_stock'))
            r = by_key.get(key)
            if r is None:
                r = by_key[key] = {'sku': key, 'item_name': name or key, 'category': cat or '', 'brand': norm(brand),
                                   'qty': None, 'alert': None, 'cogs': None, 'tracked': tracked,
                                   'sold14': 0.0, 'prior14': 0.0, 'sold30': 0.0, 'sold90': 0.0, 'net90': 0.0,
                                   'created_on': str(v.get('created_at') or item.get('created_at') or '')[:10] or None}
            else:
                r['tracked'] = r['tracked'] or tracked
            if qty is not None:
                r['qty'] = (r['qty'] or 0) + qty
            a = num(v.get('stock_alert'))
            if a is not None and v.get('alert') is not False:
                r['alert'] = max(r['alert'] or 0, a)
            c = num(v.get('cogs'))
            if c is not None and c > 0:
                r['cogs'] = c
            name_index.setdefault(name_key(name), set()).add(key)
            if not tracked:
                untracked += 1
    unmatched = 0
    for period, rows in reports.items():
        for rep in rows:
            sku = norm(rep.get('sku'))
            key = sku if sku in by_key else None
            if key is None:
                cand = name_index.get(name_key(rep.get('name')), set())
                key = next(iter(cand)) if len(cand) == 1 else None
            if key is None:
                unmatched += 1
                continue
            sold = num(rep.get('item_sold')) or 0
            refund = num(rep.get('item_refunded')) or 0
            r = by_key[key]
            r[period] += max(sold - refund, 0)
            if period == 'sold90':
                r['net90'] += num(rep.get('net_sales')) or 0
    return by_key, unmatched, untracked


def summarise(by_key):
    tracked = [r for r in by_key.values() if r['tracked']]
    q = lambda r: r['qty'] or 0
    return {
        'tracked_skus': len(tracked),
        'tracked_in': sum(1 for r in tracked if q(r) > 0),
        'tracked_empty': sum(1 for r in tracked if q(r) <= 0),
        'tracked_low': sum(1 for r in tracked if q(r) > 0 and (r['alert'] or 0) > 0 and q(r) <= r['alert']),
        'tracked_negative': sum(1 for r in tracked if q(r) < 0),
        'untracked_skus': sum(1 for r in by_key.values() if not r['tracked']),
        'qty_total': round(sum(q(r) for r in tracked), 2),
        'value_total': round(sum(max(q(r), 0) * (r['cogs'] or 0) for r in tracked), 2),
    }


def keep(r):
    """Hemat database: simpan yang punya stok, penjualan 90 hari, atau stok minus."""
    if not r['tracked']:
        return r['sold90'] > 0
    return (r['qty'] or 0) != 0 or r['sold90'] > 0


# ------------------------------------------------------------------ main
def process(moka, db, run, outlet, sid, cut, items=None, gindex=None):
    t0 = time.time()
    oid, name = outlet['id'], outlet['name']
    notes = []
    if items is None:
        log(f'Stock {name}: membaca Item Library…')
        items = read_catalogue(moka, oid)
    windows = {
        'sold14': (cut - timedelta(days=13), cut),
        'prior14': (cut - timedelta(days=27), cut - timedelta(days=14)),
        'd28_29': (cut - timedelta(days=29), cut - timedelta(days=28)),
        'd30_89': (cut - timedelta(days=89), cut - timedelta(days=30)),
    }
    raw = {}
    for k, (a, b) in windows.items():
        log(f'Stock {name}: Item Sales {a:%d/%m}–{b:%d/%m}…')
        rows, note = read_item_sales(moka, oid, a, b)
        raw[k] = rows
        if note:
            notes.append(note)
    reports = {
        'sold14': raw['sold14'],
        'prior14': raw['prior14'],
        'sold30': raw['sold14'] + raw['prior14'] + raw['d28_29'],
        'sold90': raw['sold14'] + raw['prior14'] + raw['d28_29'] + raw['d30_89'],
    }
    by_key, unmatched, _ = build_rows(items, reports, gindex)
    if not by_key:
        raise ValueError('Item Library kosong; snapshot lama dipertahankan')
    if unmatched:
        notes.append(f'info: {unmatched} baris penjualan tanpa SKU aktif (item dihapus/berganti SKU)')
    stats = summarise(by_key)
    rows = [{**r, 'qty': None if r['qty'] is None else round(r['qty'], 3),
             'sold14': round(r['sold14'], 3), 'prior14': round(r['prior14'], 3), 'sold30': round(r['sold30'], 3),
             'sold90': round(r['sold90'], 3), 'net90': round(r['net90'], 2)}
            for r in by_key.values() if keep(r)]
    if DRY_RUN:
        log(f'Stock {name}: DRY RUN {len(by_key)} SKU, disimpan {len(rows)} · {json.dumps(stats)}')
        return {'outlet': name, 'status': 'warn' if any(n.startswith('!') for n in notes) else 'done', 'rows': len(rows), 'skus': len(by_key), 'notes': notes, 'stats': stats,
                'seconds': round(time.time() - t0, 1)}
    for i in range(0, len(rows), BATCH):
        db.rpc('commercial_stock_v84_write', {'p_action': 'rows', 'p_run': run, 'p_store': sid, 'p_data': {'rows': rows[i:i + BATCH]}})
    status = 'warn' if any(n.startswith('!') for n in notes) else 'done'
    notes = [n.lstrip('!') for n in notes]
    db.rpc('commercial_stock_v84_write', {'p_action': 'commit', 'p_run': run, 'p_store': sid, 'p_data': {
        **stats, 'expected': len(rows), 'outlet_id': oid, 'outlet_name': name,
        'snapshot_at': datetime.now(timezone.utc).isoformat(), 'demand_through': cut.isoformat(),
        'status': status, 'message': '; '.join(notes)[:1500]}})
    log(f"Stock {name}: OK · {stats['tracked_skus']} SKU dilacak · {len(rows)} baris disimpan · {round(time.time() - t0)} dtk"
        + (' · ' + '; '.join(notes) if notes else ''))
    return {'outlet': name, 'status': status, 'rows': len(rows), 'skus': len(by_key), 'notes': notes, 'stats': stats,
            'seconds': round(time.time() - t0, 1)}


def main():
    token = os.environ.get('MOKA_ACCESS_TOKEN', '')
    url = os.environ.get('SUPABASE_URL', '')
    key = os.environ.get('SUPABASE_KEY', '')
    if not token:
        raise SystemExit('Secret MOKA_ACCESS_TOKEN belum diisi.')
    if not DRY_RUN and (not url or not key or key.startswith('sb_publishable_')):
        raise SystemExit('Secret SUPABASE_URL dan SUPABASE_SERVICE_KEY (secret/service_role) diperlukan.')
    moka = Moka(token)
    db = Supa(url, key) if url and key else None

    # 1) Pemeriksaan awal: tulis ke database diizinkan?
    if not DRY_RUN:
        try:
            db.rpc('commercial_stock_v84_write', {'p_action': 'ping', 'p_run': None, 'p_store': None, 'p_data': {}})
        except Exception as e:
            msg = explain_db_error(e)
            summary('### Stock V84 berhenti sebelum menarik data\n\n' + msg)
            raise SystemExit('Pemeriksaan database gagal: ' + msg)

    stores = db.sel('stores?select=id,name,is_active') if db else []
    aliases = db.sel('store_aliases?select=alias,store_id') if db else []
    _, outlets = moka.outlets()
    only = {norm(x) for x in os.environ.get('ONLY_OUTLETS', '').split(',') if x.strip()}
    if only:
        outlets = [o for o in outlets if norm(o['name']) in only]
    mapped, used, skipped = [], set(), []
    for o in outlets:
        sid = find_store(o['name'], stores, aliases) if db else len(mapped) + 1
        if sid is None:
            skipped.append(o['name'] + ' (belum dipetakan di stores/store_aliases)')
            continue
        if sid in used:
            skipped.append(o['name'] + f' (toko {sid} sudah dipakai outlet lain)')
            continue
        used.add(sid)
        mapped.append((o, sid))
    for s in skipped:
        log('::warning::Stock: outlet dilewati: ' + s)
    if not mapped:
        raise SystemExit('Tidak ada outlet Moka yang cocok dengan stores/store_aliases.')

    cut = datetime.now(WITA).date() - timedelta(days=1)
    run_url = (f"{os.environ.get('GITHUB_SERVER_URL')}/{os.environ.get('GITHUB_REPOSITORY')}/actions/runs/{os.environ.get('GITHUB_RUN_ID')}"
               if os.environ.get('GITHUB_RUN_ID') else None)
    who = 'jadwal' if os.environ.get('GITHUB_EVENT_NAME') == 'schedule' else 'manual'
    run = None
    if not DRY_RUN:
        run = db.rpc('commercial_stock_v84_write', {'p_action': 'run_start', 'p_run': None, 'p_store': None, 'p_data': {
            'requested_by': who, 'total': len(mapped), 'github_run_url': run_url,
            'message': f'Menarik stok saat ini + penjualan s.d. {cut:%d/%m/%Y}'}})['run']

    def update(**fields):
        if run is None:
            return
        try:
            db.rpc('commercial_stock_v84_write', {'p_action': 'run_update', 'p_run': run, 'p_store': None, 'p_data': fields})
        except Exception as e:
            log('::warning::Status Stock tidak tersimpan: ' + explain_db_error(e))

    # V86: baca Item Library semua lokasi dulu → indeks nama↔SKU lintas toko, baru hitung per lokasi.
    catalogues = {}
    def read_one(o):
        log(f"Stock {o['name']}: membaca Item Library…")
        return read_catalogue(moka, o['id'])
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futs = {pool.submit(read_one, o): o for o, _ in mapped}
        for fut in as_completed(futs):
            try:
                catalogues[futs[fut]['id']] = fut.result()
            except Exception as e:  # dicatat sebagai gagal pada tahap berikut
                catalogues[futs[fut]['id']] = e
    gindex = global_name_index([c for c in catalogues.values() if not isinstance(c, Exception)])
    log(f'Stock: indeks nama↔SKU lintas lokasi {len(gindex):,} item')
    def run_one(o, sid):
        items = catalogues.get(o['id'])
        if isinstance(items, Exception):
            raise items
        return process(moka, db, run, o, sid, cut, items, gindex)

    results = []
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futs = {pool.submit(run_one, o, sid): (o, sid) for o, sid in mapped}
        for fut in as_completed(futs):
            o, sid = futs[fut]
            try:
                res = fut.result()
            except Exception as e:
                msg = explain_db_error(e)
                log(f"::error::Stock {o['name']}: {msg}")
                res = {'outlet': o['name'], 'status': 'error', 'rows': 0, 'notes': [msg]}
                if not DRY_RUN:
                    try:
                        db.rpc('commercial_stock_v84_write', {'p_action': 'store_error', 'p_run': run, 'p_store': sid,
                                                              'p_data': {'outlet_id': o['id'], 'outlet_name': o['name'], 'message': msg}})
                    except Exception:
                        pass
            results.append(res)
            bad = [r for r in results if r['status'] == 'error']
            update(status='running', done=len(results), total=len(mapped),
                   message=f"{len(results)}/{len(mapped)} lokasi · terakhir {res['outlet']} ({res['status']})"
                           + (f' · {len(bad)} gagal' if bad else ''))

    bad = [r for r in results if r['status'] == 'error']
    warn = [r for r in results if r['status'] == 'warn']
    final = 'error' if bad and len(bad) == len(results) else 'warn' if bad or warn else 'done'
    msg = (f"{len(results) - len(bad)}/{len(results)} lokasi diperbarui; stok saat ini, penjualan s.d. {cut:%d/%m/%Y}"
           + ('; gagal: ' + ', '.join(r['outlet'] + ' — ' + '; '.join(r['notes'])[:160] for r in bad) if bad else '')
           + ('; outlet tanpa pemetaan toko: ' + ', '.join(s.split(' (')[0] for s in skipped) if skipped else '')
           + ('; peringatan: ' + ', '.join(r['outlet'] for r in warn) if warn else ''))
    update(status=final, done=len(results), total=len(mapped), message=msg)
    lines = ['### Stock & Distribusi V84', '', msg, '', '| Lokasi | Status | Baris | Catatan |', '|---|---|---:|---|']
    lines += [f"| {r['outlet']} | {r['status']} | {r.get('rows', 0):,} | {'; '.join(r.get('notes') or [])[:300]} |" for r in sorted(results, key=lambda r: r['outlet'])]
    summary('\n'.join(lines))
    log(msg)
    return 1 if final == 'error' else 0


if __name__ == '__main__':
    sys.exit(main())
