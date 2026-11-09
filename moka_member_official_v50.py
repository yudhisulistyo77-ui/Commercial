"""Member V50 — dari API RESMI Moka (token OAuth yang sama dengan sinkron Sales).

Menggantikan jalur Customer Service internal (token sesi browser, 1 customer per permintaan)
yang diblokir Moka (HTTP 403) karena Moka Bapak memiliki ±87.000 customer.

Sumber:
  * Customer List resmi  : GET /v1/businesses/{id}/customers  (500 per halaman, ±175 halaman)
  * Riwayat belanja      : GET /v3/outlets/{id}/reports/get_latest_transactions
                           (transaksi resmi per toko; setiap nota membawa customer_id)
Hasil ditulis ke fungsi yang sama dengan V47 (commercial_member_replace_v47), per toko-periode,
dengan format profil dan nota yang sama persis, sehingga semua tampilan Member tetap dipakai.
Tidak ada penulisan sebelum seluruh halaman satu cakupan selesai terbaca.
"""
import json, os, re, time, uuid, urllib.error, urllib.parse, urllib.request
from datetime import datetime, timedelta, timezone

from moka_member_v47 import MemberSourceError, norm

MOKA = 'https://api.mokapos.com'
PROFILE_PAGE = 500
TRX_PAGE = 100


class OfficialMoka:
    def __init__(self, token):
        if not token:
            raise MemberSourceError('MOKA_ACCESS_TOKEN belum diisi.')
        self.h = {'Authorization': 'Bearer ' + token.strip(), 'Accept': 'application/json',
                  'User-Agent': 'commercial-dashboard-moka-member-v50'}
        self.requests = 0

    def get(self, url):
        if not url.startswith(MOKA + '/'):
            raise MemberSourceError('URL Moka tidak dikenal; dihentikan demi keamanan token.')
        for attempt in range(6):
            self.requests += 1
            try:
                req = urllib.request.Request(url, headers=self.h)
                with urllib.request.urlopen(req, timeout=180) as r:
                    body = json.loads(r.read())
                return body['data'] if isinstance(body, dict) and 'data' in body else body
            except urllib.error.HTTPError as e:
                if e.code == 401:
                    raise MemberSourceError('Token Moka resmi ditolak (401); perbarui secret MOKA_ACCESS_TOKEN.') from None
                if e.code in (429, 500, 502, 503, 504) and attempt < 5:
                    time.sleep(min(60, 5 * 2 ** attempt)); continue
                raise RuntimeError(f'API Moka HTTP {e.code} pada {urllib.parse.urlsplit(url).path}') from None
            except (urllib.error.URLError, TimeoutError, ConnectionError, OSError):
                if attempt < 5:
                    time.sleep(min(60, 5 * 2 ** attempt)); continue
                raise RuntimeError('Koneksi ke API Moka gagal berulang') from None

    def business_id(self):
        return self.get(MOKA + '/v1/profile/self')['business_id']

    def customers(self, bid, progress=None):
        url = f'{MOKA}/v1/businesses/{bid}/customers?' + urllib.parse.urlencode({'per_page': PROFILE_PAGE, 'page': 1})
        out, pages = {}, 0
        while url:
            d = self.get(url); pages += 1
            rows = d.get('customers') or []
            for c in rows:
                if c.get('is_deleted') or c.get('id') in (None, 0, '0'):
                    continue
                out[str(c['id'])] = c
            if progress and pages % 25 == 0:
                progress(f'Member: Customer List resmi {pages} halaman, {len(out):,} customer.'.replace(',', '.'))
            if d.get('completed') or not rows or not d.get('next_url'):
                break
            url = d['next_url'].replace('access_token=&', '')
            if pages > 2000:
                raise MemberSourceError('Batas halaman Customer List tercapai; data Member tidak diganti.')
        return out

    def transactions(self, oid, since_dt, until_dt):
        url = f'{MOKA}/v3/outlets/{oid}/reports/get_latest_transactions?' + urllib.parse.urlencode(
            {'per_page': TRX_PAGE, 'since': int(since_dt.timestamp()), 'until': int(until_dt.timestamp())})
        seen, out = set(), []
        while url:
            d = self.get(url)
            fresh = [p for p in d.get('payments') or [] if p['id'] not in seen]
            seen.update(p['id'] for p in fresh); out.extend(fresh)
            if d.get('completed') or not d.get('payments') or not fresh:
                break
            url = (d.get('next_url') or '').replace('access_token=&', '')
        return out


def profile(c):
    since = str(c.get('created_at') or '')[:10] or None
    if since and not re.fullmatch(r'\d{4}-\d{2}-\d{2}', since):
        since = None
    name = (c.get('name') or '').strip() or '(tanpa nama)'
    phone = c.get('phone') if isinstance(c.get('phone'), str) and c.get('phone').strip() else None
    city = c.get('city') if isinstance(c.get('city'), str) and c.get('city').strip() else None
    return {'customer_key': 'MOKA:' + str(c['id']), 'source_id': str(c['id']), 'name': name,
            'city': city, 'phone': phone, 'cust_since': since}


def refund_value(p, seen):
    v = 0.0
    for r in p.get('payment_refunds') or []:
        uid = r.get('refund_uuid') or r.get('uuid')
        if r.get('is_deleted') or (uid and uid in seen):
            continue
        if uid:
            seen.add(uid)
        v += float(r.get('refund_amount') or 0)
    if not p.get('payment_refunds'):
        v = float(p.get('total_collected') or 0)
    return v


def rows_for_scope(payments, sid, customers, tz):
    """Nota bercustomer → format baris V47 (refund bernilai minus)."""
    rows, extra, seen_ref = [], {}, set()
    for p in payments:
        cid = str(p.get('customer_id') or '').strip()
        if not cid or cid == '0':
            continue
        try:
            tid = str(uuid.UUID(str(p['id'])))
        except (ValueError, KeyError):
            continue
        refund = bool(p.get('is_refunded'))
        net = -refund_value(p, seen_ref) if refund else float(p.get('total_collected') or 0)
        if refund and not net:
            continue
        dt = datetime.fromisoformat(str(p['created_at']).replace('Z', '+00:00'))
        key = 'MOKA:' + cid
        c = customers.get(cid)
        if c is None and key not in extra:  # customer terhapus/baru: profil minimal dari nota
            extra[key] = {'customer_key': key, 'source_id': cid,
                          'name': (p.get('customer_name') or '').strip() or '(tanpa nama)', 'city': None,
                          'phone': (p.get('customer_phone') or None), 'cust_since': None}
        name = (p.get('customer_name') or '').strip()
        rows.append({'store_id': sid, 'transaction_id': tid, 'customer_key': key,
                     'customer_name': name or (c and (c.get('name') or '').strip()) or '(tanpa nama)',
                     'name_basis': 'history' if name else 'customer_list_at_import',
                     'created_at': dt.isoformat(), 'sale_date': dt.astimezone(tz).date().isoformat(),
                     'net': f'{net:.2f}', 'kind': 'refund' if refund else 'sale'})
    return rows, extra


def sync(db, mapped, stores, aliases, periods, tz, writing=True, progress=None, api=None):
    log = (lambda m: print(m, flush=True))
    api = api or OfficialMoka(os.environ.get('MOKA_ACCESS_TOKEN'))
    log('Member V50: membaca Customer List resmi Moka (±175 halaman, ±10 menit)…')
    try:
        custs = api.customers(api.business_id(), log)
    except RuntimeError as e:
        raise MemberSourceError(f'Customer List resmi gagal dibaca: {e}. Data Member lama dipertahankan.') from None
    if not custs:
        raise MemberSourceError('Customer List resmi kosong; data Member lama dipertahankan.')
    log(f'Member V50: {len(custs):,} customer terdaftar.'.replace(',', '.'))
    now = datetime.now(tz)
    total_rows, total_profiles, done, failures, skipped = 0, set(), 0, [], 0
    for _, _, d1, d2 in periods:
        since = datetime(d1.year, d1.month, d1.day, tzinfo=tz)
        until = min(datetime(d2.year, d2.month, d2.day, tzinfo=tz) + timedelta(days=1) - timedelta(seconds=1), now)
        for outlet, sid in mapped:
            label = f"{outlet['name']} {d1:%Y-%m}"
            try:
                pays = api.transactions(outlet['id'], since, until)
                rows, extra = rows_for_scope(pays, int(sid), custs, tz)
                keys = {r['customer_key'] for r in rows}
                # Customer yang sudah tercatat pada cakupan ini ikut dikirim, supaya nota yang
                # sudah dibatalkan di Moka ikut terhapus dan hari bisa ditandai lengkap.
                old = set()
                if db is not None:
                    try:
                        old = {r['customer_key'] for r in db.sel(
                            f"moka_purchase_history_v47?select=customer_key&store_id=eq.{int(sid)}"
                            f"&sale_date=gte.{d1.isoformat()}&sale_date=lte.{d2.isoformat()}")}
                    except Exception:
                        old = set()
                send = sorted(keys | {k for k in old if k[5:] in custs})
                profs = [profile(custs[k[5:]]) if k[5:] in custs else extra[k] for k in send]
                if not profs:
                    skipped += 1
                    log(f'Member V50: {label} — tidak ada nota bercustomer, dilewati.')
                    continue
                scope = [{'store_id': int(sid), 'date_from': d1.isoformat(), 'date_to': d2.isoformat()}]
                if writing:
                    db.rpc('commercial_member_replace_v47', {'p_scopes': scope, 'p_profiles': profs, 'p_rows': rows, 'p_complete': True})
                total_rows += len(rows); total_profiles |= keys; done += 1
                log(f'Member V50: {label} — {len(rows)} nota/refund, {len(keys)} customer'
                    + ('' if writing else ' (uji coba, tidak ditulis)'))
            except MemberSourceError:
                raise
            except Exception as e:  # satu cakupan gagal tidak menghentikan cakupan lain
                msg = str(getattr(e, 'body', '') or e)[:220]
                failures.append(f'{label}: {msg}')
                log(f'Member V50: {label} — GAGAL: {msg}')
    if failures:
        raise MemberSourceError(f'{len(failures)} cakupan Member gagal ({"; ".join(failures[:3])}). '
                                f'{done} cakupan lain tersimpan.')
    return {'status': 'OK', 'customers': len(total_profiles), 'receipts': total_rows,
            'unmapped_payments': 0, 'http_requests': api.requests}
