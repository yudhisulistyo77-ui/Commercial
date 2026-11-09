#!/usr/bin/env python3
from signed_amount_v45 import signed_money
"""
Sinkronisasi Moka POS -> Supabase (Dashboard Commercial / Store Operation) — V2.

Mode
----
  full  (jadwal harian)  : bulan berjalan sampai KEMARIN ditarik ulang penuh
                           (+ bulan lalu pada tanggal 1–3). Juga memperbarui katalog item & harga.
  live  (tombol Sinkron) : data sampai MENIT INI. Cukup menarik transaksi beberapa hari
                           terakhir (LIVE_DAYS, default 3); hari sebelumnya dibaca dari
                           tabel harian yang sudah tersimpan. Periode lama bisa dilewati melalui checkpoint V41.

Tabel yang diisi
----------------
  sales_type_raw, item_sales, transaksi, ingest_log   (sama dengan menu Upload Data)
  moka_sales_type_daily, moka_hourly, moka_customer_daily, moka_walkin_daily,
  moka_sync_coverage, moka_items, moka_sync_runs       (lihat MOKA-SYNC-V2.sql)
  rpc rebuild_sales_actual

Pengaman: setiap toko-bulan dicocokkan dengan Sales Summary Moka. Selisih karena
transaksi yang baru tersinkron (kasir offline) ditulis dengan status WARN; selisih
lain berstatus ERROR dan data lama tidak disentuh.

Variabel lingkungan
-------------------
  MOKA_ACCESS_TOKEN   wajib (GitHub Secret).
  SUPABASE_URL        default https://qrabkayuwglmlaouliwn.supabase.co
  SUPABASE_KEY        wajib kecuali DRY_RUN=1 (kunci secret/service_role).
  SYNC_MODE           full | live (default full).
  SYNC_MONTHS         opsional "2026-10,2026-11" atau "2026-01..2026-10" (mode full).
  LIVE_DAYS           default 3.
  ONLY_OUTLETS        opsional, nama outlet Moka dipisah koma.
  RUN_ID              id baris moka_sync_runs (diisi tombol Sinkron).
  DRY_RUN             "1" = tidak menulis; hasil di moka-sync-output/.
  WORKERS             default 3.  MOKA_TZ_OFFSET default 7.  LOCAL_TZ_OFFSET default 8 (WITA).
  MOKA_TOKEN_EXPIRES  opsional YYYY-MM-DD.
  BRAND_MAP           opsional JSON {"<brand_id>": "NAMA"} untuk item Moka.
"""
import http.client as httpclient
import json
import os
import re
import sys
import time
import uuid
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta, timezone

MOKA_BASE = "https://api.mokapos.com"
DEFAULT_SUPABASE_URL = "https://qrabkayuwglmlaouliwn.supabase.co"
TOLERANCE = 10.0
NO_SALES_TYPE = "TANPA SALES TYPE"
DEFAULT_BRANDS = {"312098": "Tigalapan", "312497": "MAMU", "5745529": "MYNO", "17343307": "Unbranded"}


def env(name, default=""):
    v = os.environ.get(name)
    return v.strip() if v and v.strip() else default


TZ = timezone(timedelta(hours=float(env("MOKA_TZ_OFFSET", "7"))))
LOCAL_TZ = timezone(timedelta(hours=float(env("LOCAL_TZ_OFFSET", "8"))))
RAW_MODE = env("SYNC_MODE", "full").lower()
MODE, _, selection = RAW_MODE.partition('|')
if '|' in RAW_MODE and not selection: raise ValueError('Pilih komponen sinkron.')
COMPONENTS = set(filter(None, selection.split(','))) if selection else {'sales_type','item_sales','transactions'}
if not COMPONENTS <= {'sales_type','item_sales','transactions','members'}:
    raise ValueError('Komponen sinkron tidak dikenal.')
SALES_COMPONENTS = COMPONENTS & {'sales_type','item_sales','transactions'}
PRICE_ONLY = MODE == "price" or env("SKIP_SALES", "0") == "1"
if MODE == "price": MODE = "live"
if MODE not in ("full", "live"):
    raise ValueError("Mode sinkron tidak valid")
DRY_RUN = env("DRY_RUN", "0").lower() in ("1", "true", "yes")
LIVE_DAYS = max(1, int(env("LIVE_DAYS", "3")))
INCLUDE_LIBRARY = PRICE_ONLY or env("INCLUDE_LIBRARY", "0").lower() in ("1","true","yes")
WORKERS = max(1, min(3, int(env("WORKERS", "2"))))
STOCK_BATCH_SIZE = max(50, min(400, int(env("STOCK_BATCH_SIZE", "250"))))
OUT_DIR = env("OUTPUT_DIR", "moka-sync-output")
STEP_SUMMARY = os.environ.get("GITHUB_STEP_SUMMARY")
LAG_RETRY_WAIT = int(env("LAG_RETRY_WAIT", "180" if MODE == "full" else "45"))
LAG_MAX_SHARE = float(env("LAG_MAX_SHARE", "0.02" if MODE == "full" else "0.05"))
try:
    BRANDS = {**DEFAULT_BRANDS, **json.loads(env("BRAND_MAP", "{}"))}
except ValueError:
    BRANDS = dict(DEFAULT_BRANDS)


def log(msg):
    print(msg, flush=True)


def warn(msg):
    print(f"::warning::{msg}", flush=True)


class HttpError(Exception):
    def __init__(self, code, body, where):
        super().__init__(f"HTTP {code} {where}: {body}")
        self.code, self.body, self.where = code, body, where


def http(method, url, headers, body=None, timeout=180, retries=5, retry_500=True):
    data = json.dumps(body, default=str).encode() if body is not None else None
    where = urllib.parse.urlsplit(url).path
    for attempt in range(retries):
        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                raw = r.read()
                return (json.loads(raw) if raw else None), r.headers
        except urllib.error.HTTPError as e:
            text = e.read()[:400].decode("utf-8", "replace")
            transient = e.code in (408, 429, 502, 503, 504, 520, 521, 522, 523, 524) or (retry_500 and e.code == 500)
            if transient and attempt < retries - 1:
                time.sleep(min(60, 4 * 2 ** attempt))
                continue
            raise HttpError(e.code, text, where) from None
        except (urllib.error.URLError, TimeoutError, ConnectionError, httpclient.HTTPException, OSError) as e:
            if attempt < retries - 1:
                time.sleep(min(60, 4 * 2 ** attempt))
                continue
            raise HttpError(0, str(e), where) from None


# --------------------------------------------------------------------- Moka
class Moka:
    def __init__(self, token):
        self.h = {"Authorization": "Bearer " + token, "Accept": "application/json",
                  "User-Agent": "commercial-dashboard-moka-sync"}

    def get(self, path, params=None, retry_500=True, retries=5):
        url = path if path.startswith("http") else MOKA_BASE + path
        if not url.startswith(MOKA_BASE + "/"):
            raise RuntimeError("URL Moka tidak dikenal, dihentikan demi keamanan token")
        if params:
            url += ("&" if "?" in url else "?") + urllib.parse.urlencode(params)
        body, _ = http("GET", url, self.h, retry_500=retry_500, retries=retries)
        return body["data"] if isinstance(body, dict) and "data" in body else body

    def outlets(self):
        prof = self.get("/v1/profile/self")
        outs = self.get(f"/v1/businesses/{prof['business_id']}/outlets")["outlets"]
        return prof, [o for o in outs if not o.get("is_deleted")]

    def sales_summary(self, oid, d1, d2):
        return self.get(f"/v2/outlets/{oid}/reports/sales_summary",
                        {"start": d1.strftime("%d/%m/%Y"), "end": d2.strftime("%d/%m/%Y")})

    def item_sales(self, oid, d1, d2):
        return self.get(f"/v3/outlets/{oid}/reports/item_sales",
                        {"start": d1.strftime("%d/%m/%Y"), "end": d2.strftime("%d/%m/%Y"), "per_page": 1000})

    def transactions(self, oid, since_dt, until_dt, per_page=100):
        """Bound requests to one reporting day; fail rather than return partial pages."""
        out, seen = [], set()
        cursor = since_dt
        while cursor <= until_dt:
            next_day = datetime.combine(cursor.date() + timedelta(days=1), datetime.min.time(), tzinfo=cursor.tzinfo)
            end = min(until_dt, next_day)
            for payment in self._transaction_window(oid, cursor, end, per_page):
                if payment["id"] not in seen:
                    seen.add(payment["id"])
                    out.append(payment)
            cursor = next_day
        return out

    def _transaction_window(self, oid, since_dt, until_dt, per_page):
        url = MOKA_BASE + f"/v3/outlets/{oid}/reports/get_latest_transactions?" + urllib.parse.urlencode(
            {"per_page": min(100, per_page), "since": int(since_dt.timestamp()), "until": int(until_dt.timestamp())})
        seen, pays, visited, attempts = set(), [], set(), defaultdict(int)
        while url:
            if url in visited:
                raise RuntimeError("Pagination transaksi Moka berulang; data tidak disimpan.")
            try:
                d = self.get(url, retry_500=False, retries=1)
            except HttpError as e:
                match = re.search(r"per_page=(\d+)", url)
                if e.code not in (0, 408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524):
                    raise
                attempts[url] += 1
                if match and int(match.group(1)) > 25:
                    url = url.replace(match.group(0), f"per_page={max(25, int(match.group(1)) // 2)}")
                    continue
                if attempts[url] >= 3:
                    raise
                time.sleep(min(16, 4 * attempts[url]))
                continue
            visited.add(url)
            payments = d.get("payments") or []
            fresh = [p for p in payments if p["id"] not in seen]
            seen.update(p["id"] for p in fresh)
            pays.extend(fresh)
            if d.get("completed"):
                return pays
            if not payments or not fresh:
                raise RuntimeError("Pagination transaksi belum dinyatakan selesai; hasil parsial tidak disimpan.")
            url = (d.get("next_url") or "").replace("access_token=&", "")
            if not url:
                raise RuntimeError("Pagination transaksi Moka belum selesai tanpa next_url; data tidak disimpan.")
        return pays

    def items(self, oid):
        url = MOKA_BASE + f"/v1/outlets/{oid}/items?per_page=1000"
        out, guard, visited = [], 0, set()
        while url and guard < 200:
            guard += 1
            if url in visited:
                raise RuntimeError("Pagination item Moka berulang; katalog lama dipertahankan.")
            visited.add(url)
            d = self.get(url)
            out.extend(d.get("items") or [])
            if d.get("completed") or not d.get("items"):
                return out
            if not d.get("next_url"):
                if d.get("completed") is False:
                    raise RuntimeError("Pagination item Moka belum selesai tanpa next_url; katalog lama dipertahankan.")
                return out
            url = d["next_url"].replace("access_token=&", "")
        if url:
            raise RuntimeError("Pagination item melebihi batas 200 halaman; katalog lama dipertahankan.")
        return out


# ------------------------------------------------------------- agregasi
def moka_date(ts):
    return datetime.fromisoformat(ts).astimezone(TZ).date()


def lines_of(p):
    # Baris COMPONENT = isi paket bundling; nilainya sudah ada di baris BUNDLE.
    return [c for c in p.get("checkouts") or []
            if not c.get("is_deleted") and str(c.get("item_type") or "").upper() != "COMPONENT"]


def refund_value(p, seen_refunds):
    """Nilai resmi refund = refund_amount unik per refund_uuid (feed Moka kadang dobel,
    dan refund parsial kadang membawa baris nota penuh)."""
    value = 0.0
    for r in p.get("payment_refunds") or []:
        uid = r.get("refund_uuid") or r.get("uuid")
        if r.get("is_deleted") or (uid and uid in seen_refunds):
            continue
        if uid:
            seen_refunds.add(uid)
        value += abs(signed_money(r.get("refund_amount") or 0))
    if not p.get("payment_refunds"):
        value = abs(signed_money(p.get("total_collected") or 0))
    return value


def aggregate(pays):
    """Hasil per tanggal Moka: sales type, jam (WITA), pelanggan, walk-in."""
    st = defaultdict(lambda: defaultdict(lambda: {"amount": 0.0, "tx": set()}))
    hourly = defaultdict(lambda: {"trx": 0, "net": 0.0, "items": 0.0})
    cust = defaultdict(lambda: {"name": None, "phone": None, "trx": 0, "net": 0.0, "items": 0.0})
    walkin = defaultdict(lambda: {"trx": 0, "net": 0.0})
    seen_refunds = set()
    for p in pays:
        d = moka_date(p["created_at"])
        lines = lines_of(p)
        cid = str(p.get("customer_id") or "").strip()
        if not p.get("is_refunded"):
            for c in lines:
                t = (c.get("sales_type_name") or "").strip() or NO_SALES_TYPE
                g = st[d][t]
                g["amount"] += signed_money(c.get("net_sales") or 0)
                g["tx"].add(p["id"])
            tc = signed_money(p.get("total_collected") or 0)
            qty = sum(float(c.get("quantity") or 0) for c in lines)
            lt = datetime.fromisoformat(p["created_at"]).astimezone(LOCAL_TZ)
            h = hourly[(d, lt.hour)]
            h["trx"] += 1; h["net"] += tc; h["items"] += qty
            if cid and cid != "0":
                k = cust[(d, cid)]
                k["name"] = (p.get("customer_name") or k["name"] or "").strip() or None
                ph = re.sub(r"\D", "", str(p.get("customer_phone") or ""))
                k["phone"] = ph[-4:] if ph else k["phone"]
                k["trx"] += 1; k["net"] += tc; k["items"] += qty
            else:
                w = walkin[d]; w["trx"] += 1; w["net"] += tc
            continue
        value = refund_value(p, seen_refunds)
        if not value:
            continue
        weights = [(c, signed_money(c.get("net_sales") or 0) * (float(c.get("refunded_quantity") or 0) / float(c["quantity"]))
                    if c.get("quantity") else 0.0) for c in lines]
        if sum(w for _, w in weights) <= 0:
            weights = [(c, signed_money(c.get("net_sales") or 0)) for c in lines]
        total_w = sum(w for _, w in weights)
        if total_w <= 0:
            st[d][NO_SALES_TYPE]["amount"] -= value
        else:
            for c, w in weights:
                if w:
                    t = (c.get("sales_type_name") or "").strip() or NO_SALES_TYPE
                    st[d][t]["amount"] -= value * w / total_w
        lt = datetime.fromisoformat(p["created_at"]).astimezone(LOCAL_TZ)
        hourly[(d, lt.hour)]["net"] -= value
        if cid and cid != "0":
            cust[(d, cid)]["net"] -= value
        else:
            walkin[d]["net"] -= value
    return {
        "sales_types": {d: {t: {"amount": round(g["amount"], 2), "trx_count": len(g["tx"])} for t, g in ts.items()}
                        for d, ts in st.items()},
        "hourly": dict(hourly), "customers": dict(cust), "walkin": dict(walkin),
    }


def aggregate_sales_types(pays):
    """Bulanan (dipakai uji & kompatibilitas)."""
    out = defaultdict(lambda: {"amount": 0.0, "trx_count": 0})
    for ts in aggregate(pays)["sales_types"].values():
        for t, v in ts.items():
            out[t]["amount"] += v["amount"]
            out[t]["trx_count"] += v["trx_count"]
    return {t: {"amount": round(v["amount"], 2), "trx_count": v["trx_count"]} for t, v in out.items()}


# ----------------------------------------------------------------- Supabase
class Supa:
    def __init__(self, url, key):
        u = url.rstrip("/")
        self.base = (u if u.endswith("/rest/v1") else u + "/rest/v1") + "/"
        self.h = {"apikey": key, "Content-Type": "application/json"}
        if key.startswith("eyJ"):
            self.h["Authorization"] = "Bearer " + key

    def sel(self, path):
        out, start = [], 0
        while True:
            h = dict(self.h, Range=f"{start}-{start + 999}", **{"Range-Unit": "items"})
            rows, _ = http("GET", self.base + path, h)
            out.extend(rows)
            if len(rows) < 1000:
                return out
            start += len(rows)

    def delete(self, table, q):
        http("DELETE", f"{self.base}{table}?{q}", dict(self.h, Prefer="return=minimal"), retry_500=False)

    def insert(self, table, rows, conflict=None, ret=False):
        q = f"?on_conflict={conflict}" if conflict else ""
        pref = ("resolution=merge-duplicates," if conflict else "") + ("return=representation" if ret else "return=minimal")
        out = []
        for i in range(0, len(rows), 500):
            body, _ = http("POST", self.base + table + q, dict(self.h, Prefer=pref), rows[i:i + 500], retry_500=False)
            if ret and body:
                out.extend(body)
        return out

    def patch(self, table, q, body):
        http("PATCH", f"{self.base}{table}?{q}", dict(self.h, Prefer="return=minimal"), body, retry_500=False)

    def rpc_idempotent(self, fn, args):
        # Only use for V36 stage/commit endpoints with stable request IDs.
        body, _ = http("POST", self.base + "rpc/" + fn, self.h, args,
                       timeout=75, retries=3, retry_500=True)
        return body

    def rpc(self, fn, args=None):
        body, _ = http("POST", self.base + "rpc/" + fn, self.h, args or {}, timeout=600, retries=1, retry_500=False)
        return body


def norm(s):
    return re.sub(r"\s+", " ", str(s or "")).upper().strip()


def find_store(name, stores, aliases):
    n = norm(name)
    for a in aliases:
        if norm(a.get("alias")) == n:
            return a["store_id"]
    for s in stores:
        if norm(s.get("name")) == n:
            return s["id"]
    sq = n.replace(" ", "")
    for a in aliases:
        if norm(a.get("alias")).replace(" ", "") == sq:
            return a["store_id"]
    for s in stores:
        if norm(s.get("name")).replace(" ", "") == sq:
            return s["id"]
    return None


# ------------------------------------------------------------------ periode
def periods_for_run(now):
    today=now.date();cutoff=today if MODE=='live' else today-timedelta(days=1)
    spec=env('SYNC_MONTHS');first,last=env('SYNC_FROM'),env('SYNC_TO');months=[]
    if first or last:
        if not first or not last:raise ValueError('Tanggal awal dan akhir wajib diisi.')
        start,end=date.fromisoformat(first),date.fromisoformat(last)
        if start>end or (end-start).days>1096:raise ValueError('Rentang tanggal tidak valid / lebih dari 3 tahun.')
        y,m=start.year,start.month
        while (y,m)<=(end.year,end.month):
            months.append((y,m));y,m=(y+1,1) if m==12 else (y,m+1)
    elif spec:
        for part in filter(None,(p.strip() for p in spec.split(','))):
            if '..' in part:
                aa,bb=part.split('..');y,m=map(int,aa.split('-'));y2,m2=map(int,bb.split('-'))
                date(y,m,1);date(y2,m2,1)
                if (y,m)>(y2,m2):raise ValueError('Rentang bulan terbalik.')
                while (y,m)<=(y2,m2):
                    months.append((y,m));y,m=(y+1,1) if m==12 else (y,m+1)
                    if len(months)>36:raise ValueError('Maksimal 36 bulan per sinkron.')
            else:
                y,m=map(int,part.split('-'));date(y,m,1);months.append((y,m))
    elif MODE=='live':
        start=today-timedelta(days=LIVE_DAYS-1);months=[(start.year,start.month),(today.year,today.month)]
    else:
        months=[(cutoff.year,cutoff.month)]
        if cutoff.day<=3:
            prev=cutoff.replace(day=1)-timedelta(days=1);months.insert(0,(prev.year,prev.month))
    if len(set(months))>36:raise ValueError('Maksimal 36 bulan per sinkron.')
    out=[]
    for y,m in sorted(set(months)):
        if not 2000<=y<=2100:raise ValueError('Tahun tidak valid.')
        d1=date(y,m,1);d2=min(date(y+(m==12),m%12+1,1)-timedelta(days=1),cutoff)
        if d1<=d2:out.append((y,m,d1,d2))
    return out,cutoff


def day_range(d1, d2):
    d = d1
    while d <= d2:
        yield d
        d += timedelta(days=1)


# -------------------------------------------------------------------- kerja
class Ctx:
    def __init__(self, moka, db, now, known_types):
        self.moka, self.db, self.now, self.known_types = moka, db, now, known_types


def fetch_store_month(ctx, outlet, sid, period):
    """Tarik satu toko-bulan, cocokkan dengan Sales Summary. Mengembalikan dict hasil."""
    y, m, d1, d2 = period
    oid = outlet["id"]
    res = {"outlet": outlet["name"], "outlet_id": oid, "store_id": sid, "year": y, "month": m,
           "start": d1.isoformat(), "end": d2.isoformat(), "errors": [], "status": "OK"}
    try:
        summ = ctx.moka.sales_summary(oid, d1, d2)
        res["summary"] = summ
        net = signed_money(summ.get("net_sales") or 0)
        it = ctx.moka.item_sales(oid, d1, d2) if "item_sales" in COMPONENTS else {}
        res["items"] = it.get("item_sales") or []
        res["item_total"] = sum(signed_money(r.get("net_sales") or 0) for r in res["items"])

        # Hari yang perlu ditarik transaksinya
        fetch_from = d1
        fetch_to = d2
        date_range = bool(env('SYNC_FROM') and env('SYNC_TO'))
        force_refresh=env('FORCE_REFRESH','0').lower() in ('1','true','yes')
        if date_range and not force_refresh:
            want_from=max(d1,date.fromisoformat(env('SYNC_FROM')))
            want_to=min(d2,date.fromisoformat(env('SYNC_TO')))
            if want_from>want_to:raise ValueError('Tidak ada tanggal yang tercakup.')
            have=set()
            if ctx.db:
                cov=ctx.db.sel(f"moka_sync_coverage?select=sale_date&store_id=eq.{sid}&sale_date=gte.{d1}&sale_date=lte.{d2}")
                have={r['sale_date'] for r in cov}
            outside=[d for d in day_range(d1,d2) if d<want_from or d>want_to]
            if all(d.isoformat() in have for d in outside):
                fetch_from,fetch_to=want_from,want_to
            else:
                res['range_note']='Cache di luar rentang belum lengkap; bulan terkait ditarik utuh.'
        if MODE == "live" and ctx.db and not date_range and not force_refresh and d2 == ctx.now.date():
            want = max(d1, ctx.now.date() - timedelta(days=LIVE_DAYS - 1))
            if want > d1:
                cov = ctx.db.sel(f"moka_sync_coverage?select=sale_date&store_id=eq.{sid}"
                                 f"&sale_date=gte.{d1}&sale_date=lt.{want}")
                have = {r["sale_date"] for r in cov}
                if all(d.isoformat() in have for d in day_range(d1, want - timedelta(days=1))):
                    fetch_from = want
        res["fetch_from"] = fetch_from.isoformat()
        res["fetch_to"] = fetch_to.isoformat()
        since = datetime(fetch_from.year, fetch_from.month, fetch_from.day, tzinfo=TZ)
        until = ctx.now if (MODE == "live" and fetch_to == ctx.now.date()) else \
            datetime(fetch_to.year, fetch_to.month, fetch_to.day, tzinfo=TZ) + timedelta(days=1) - timedelta(seconds=1)
        pays = ctx.moka.transactions(oid, since, until) if COMPONENTS & {"sales_type","transactions"} and (net or summ.get("number_of_transactions") or fetch_from != d1) else []
        res["payments"] = len(pays)
        agg = aggregate(pays)
        res["agg"] = agg

        # Sales Type bulanan = hari tersimpan (sebelum fetch_from) + hasil tarikan baru
        monthly = defaultdict(lambda: {"amount": 0.0, "trx_count": 0})
        if "sales_type" in COMPONENTS and (fetch_from > d1 or fetch_to < d2) and ctx.db:
            for r in ctx.db.sel(f"moka_sales_type_daily?select=sales_type,trx_count,amount&store_id=eq.{sid}"
                                f"&sale_date=gte.{d1}&sale_date=lte.{d2}&or=(sale_date.lt.{fetch_from},sale_date.gt.{fetch_to})"):
                monthly[r["sales_type"]]["amount"] += float(r["amount"] or 0)
                monthly[r["sales_type"]]["trx_count"] += int(r["trx_count"] or 0)
        for ts in agg["sales_types"].values():
            for t, v in ts.items():
                monthly[t]["amount"] += v["amount"]
                monthly[t]["trx_count"] += v["trx_count"]
        res["sales_types"] = {t: {"amount": round(v["amount"], 2), "trx_count": v["trx_count"]} for t, v in monthly.items()}
        res["sales_type_total"] = sum(v["amount"] for v in res["sales_types"].values())

        if "item_sales" in COMPONENTS and abs(res["item_total"] - net) > max(TOLERANCE, 0.5 * len(res["items"])):
            res["errors"].append(f"Item Sales {res['item_total']:,.0f} != Sales Summary {net:,.0f}")
        if "sales_type" in COMPONENTS and abs(res["sales_type_total"] - net) > TOLERANCE:
            res["errors"].append(f"Sales Type {res['sales_type_total']:,.0f} != Sales Summary {net:,.0f}")
    except HttpError as e:
        if e.code == 403 and "xpired" in e.body:
            res["status"] = "SKIP"; res["errors"] = ["langganan outlet Moka sudah habis"]
        else:
            res["errors"].append(str(e))
    if res["errors"] and res["status"] != "SKIP":
        res["status"] = "ERROR"
        net = float((res.get("summary") or {}).get("net_sales") or 0)
        details = [v for v in (res.get("item_total"), res.get("sales_type_total")) if v is not None]
        res["lag"] = bool(details) and all("!=" in e for e in res["errors"]) and \
            all(abs(net - v) <= LAG_MAX_SHARE * max(abs(net), 1) for v in details)
    return res


def classify_lag(res):
    net = float(res["summary"].get("net_sales") or 0)
    st, it = res.get("sales_type_total"), res.get("item_total")
    basis = st if st is not None else it
    consistent = st is None or it is None or abs(st - it) <= max(TOLERANCE, 0.5 * len(res.get("items") or []))
    if consistent and basis is not None and abs(net - basis) <= LAG_MAX_SHARE * max(abs(net), 1):
        res["status"] = "WARN"
        res["errors"] = [f"Selisih sumber Moka belum terverifikasi: Summary {net:,.0f} vs "
                         f"detail {basis:,.0f} (selisih {net - basis:,.0f}); periksa sumber sebelum menyatakan rekonsiliasi selesai"]


def process(ctx, outlet, sid, period):
    t0 = time.time()
    try:
        return _process(ctx, outlet, sid, period, t0)
    except Exception as e:  # satu toko gagal tidak boleh menghentikan toko lain
        y, m, d1, d2 = period
        return {"outlet": outlet["name"], "outlet_id": outlet["id"], "store_id": sid, "year": y, "month": m,
                "start": d1.isoformat(), "end": d2.isoformat(), "status": "ERROR",
                "errors": [f"{type(e).__name__}: {str(e)[:300]}"], "seconds": round(time.time() - t0, 1)}


def _process(ctx, outlet, sid, period, t0):
    # Only closed, older periods can skip detail. Recent days always refresh.
    y, m, d1, d2 = period
    if SALES_COMPONENTS and env('SKIP_UNCHANGED','1').lower() in ('1','true','yes') and env('FORCE_REFRESH','0').lower() not in ('1','true','yes') and ctx.db and d2 < ctx.now.date()-timedelta(days=3):
        try:
            summary = ctx.moka.sales_summary(outlet['id'],d1,d2)
            checkpoint = ctx.db.rpc('commercial_moka_check_v45',{'p_store_id':sid,'p_year':y,'p_month':m,'p_from':d1.isoformat(),'p_to':d2.isoformat(),'p_summary':summary,'p_components':sorted(SALES_COMPONENTS)})
            if checkpoint and checkpoint.get('skip') is True:
                return {'outlet':outlet['name'],'outlet_id':outlet['id'],'store_id':sid,'year':y,'month':m,'start':d1.isoformat(),'end':d2.isoformat(),'status':'UNCHANGED','summary':summary,'errors':[],'skip_reason':checkpoint.get('reason'),'seconds':round(time.time()-t0,1)}
        except Exception as e:
            log('Cek cepat tidak tersedia; tarik detail '+outlet['name']+': '+type(e).__name__)
    res = fetch_store_month(ctx, outlet, sid, period)
    if res["status"] == "ERROR" and res.get("lag"):
        time.sleep(LAG_RETRY_WAIT)
        res = fetch_store_month(ctx, outlet, sid, period)
    if res["status"] == "ERROR" and res.get("lag"):
        classify_lag(res)
    res["seconds"] = round(time.time() - t0, 1)
    return res


class WritePlan:
    """Collect rows locally; only one transactional RPC mutates each store-month."""
    def __init__(self):
        self.rows = {}

    def delete(self, table, query):
        pass  # scoped deletes are performed inside the database transaction

    def insert(self, table, rows, conflict=None, ret=False):
        self.rows.setdefault(table, []).extend(rows)
        return []


def write_store_month(db, res, known_types, stamp):
    target_db, db = db, WritePlan()
    sid, y, m = res["store_id"], res["year"], res["month"]
    key = f"store_id=eq.{sid}&year=eq.{y}&month=eq.{m}"
    src = f"MOKA API {stamp}"
    note = f"Moka {res['start']} s.d. {res['end']}" + (f"; {res['errors'][0]}" if res["status"] == "WARN" else "")
    agg = res["agg"]
    f1, f2 = res["fetch_from"], res.get("fetch_to", res["end"])
    rng = f"store_id=eq.{sid}&sale_date=gte.{f1}&sale_date=lte.{f2}"

    # --- harian
    daily = [{"store_id": sid, "sale_date": d.isoformat(), "sales_type": t, "trx_count": v["trx_count"],
              "amount": v["amount"]} for d, ts in agg["sales_types"].items() for t, v in ts.items()]
    hourly = [{"store_id": sid, "sale_date": d.isoformat(), "hour": h, "trx": v["trx"], "net": round(v["net"], 2),
               "items": v["items"]} for (d, h), v in agg["hourly"].items()]
    cust = [{"store_id": sid, "sale_date": d.isoformat(), "customer_key": k, "customer_name": v["name"],
             "phone_last4": v["phone"], "trx": v["trx"], "net": round(v["net"], 2), "items": v["items"]}
            for (d, k), v in agg["customers"].items()]
    walk = [{"store_id": sid, "sale_date": d.isoformat(), "trx": v["trx"], "net": round(v["net"], 2)}
            for d, v in agg["walkin"].items()]
    for table, rows, conflict in (("moka_sales_type_daily", daily, "store_id,sale_date,sales_type"),
                                  ("moka_hourly", hourly, "store_id,sale_date,hour"),
                                  ("moka_customer_daily", cust, "store_id,sale_date,customer_key"),
                                  ("moka_walkin_daily", walk, "store_id,sale_date")):
        db.delete(table, rng)
        if rows:
            db.insert(table, rows, conflict)
    cov = [{"store_id": sid, "sale_date": d.isoformat(), "synced_at": datetime.now(timezone.utc).isoformat()}
           for d in day_range(date.fromisoformat(f1), date.fromisoformat(f2))]
    db.insert("moka_sync_coverage", cov, "store_id,sale_date")

    # --- bulanan (sama dengan Upload Data)
    rows = [{"store_id": sid, "year": y, "month": m, "sales_type": t, "trx_count": v["trx_count"],
             "amount": v["amount"], "source_file": src} for t, v in sorted(res["sales_types"].items())]
    unmapped = [r["sales_type"] for r in rows if norm(r["sales_type"]) not in known_types]
    db.delete("sales_type_raw", key)
    if rows:
        db.insert("sales_type_raw", rows, "store_id,year,month,sales_type")
    db.insert("ingest_log", [{"kind": "SALES_TYPE", "file_name": src, "store_id": sid, "year": y, "month": m,
                              "rows_total": len(rows), "rows_mapped": len(rows) - len(unmapped),
                              "rows_unmapped": len(unmapped), "total_amount": res["sales_type_total"], "status": "OK",
                              "message": note + (f"; belum termapping: {', '.join(unmapped[:8])}" if unmapped else "")}])
    res["unmapped"] = unmapped

    items = [{"store_id": sid, "year": y, "month": m, "item_name": (r.get("name") or "").strip(),
              "item_variant_name": None, "category_name": (r.get("category_name") or "").strip() or None,
              "sku": (r.get("sku") or "").strip() or None, "item_sold": r.get("item_sold") or 0,
              "item_refunded": r.get("item_refunded") or 0, "net_sales": r.get("net_sales") or 0,
              "source_file": src} for r in res["items"] if (r.get("name") or "").strip()]
    db.delete("item_sales", key)
    if items:
        db.insert("item_sales", items)
    db.insert("ingest_log", [{"kind": "ITEM_SALES", "file_name": src, "store_id": sid, "year": y, "month": m,
                              "rows_total": len(items), "rows_mapped": len(items), "rows_unmapped": 0,
                              "total_amount": res["item_total"], "status": "OK", "message": note}])

    s = res["summary"]
    trx = {"store_id": sid, "year": y, "month": m, "jumlah_transaksi": int(s.get("number_of_transactions") or 0),
           "nilai_transaksi": signed_money(s.get("net_sales") or 0), "is_manual": True}
    db.insert("transaksi", [trx], "store_id,year,month")
    db.insert("ingest_log", [{"kind": "TRANSAKSI", "file_name": src, "store_id": sid, "year": y, "month": m,
                              "rows_total": 1, "rows_mapped": 1, "rows_unmapped": 0,
                              "total_amount": trx["nilai_transaksi"], "status": "OK", "message": note}])

    module_tables = {'sales_type': ['moka_sales_type_daily','sales_type_raw'],
                     'item_sales':['item_sales'], 'transactions':['transaksi','moka_hourly','moka_walkin_daily']}
    allowed = {table for component in SALES_COMPONENTS for table in module_tables[component]}
    payload = {table: db.rows.get(table, []) for table in allowed}
    kinds = {'sales_type':'SALES_TYPE','item_sales':'ITEM_SALES','transactions':'TRANSAKSI'}
    payload['ingest_log'] = [row for row in db.rows.get('ingest_log',[]) if row['kind'] in {kinds[c] for c in SALES_COMPONENTS}]
    target_db.rpc('commercial_moka_replace_v45', {
        'p_store_id':sid,'p_year':y,'p_month':m,'p_from':f1,'p_to':f2,
        'p_components':sorted(SALES_COMPONENTS),'p_rows':payload,
        'p_data_from':res['start'],'p_data_to':res['end'],'p_summary':res['summary'],'p_validated':res['status']=='OK'})



def brand_name(brand_id, categories):
    b = BRANDS.get(str(brand_id))
    if b:
        return b
    joined = " ".join(categories).upper()
    if "MAMU" in joined:
        return "MAMU"
    if "MYNO" in joined:
        return "MYNO"
    return f"BRAND {brand_id}" if brand_id else "(Tanpa brand)"


def item_rows(outlet, sid, items):
    cats_by_brand = defaultdict(list)
    for it in items:
        cats_by_brand[it.get("brand_id")].append(((it.get("category") or {}).get("name")) or "")
    rows = []
    for it in items:
        if it.get("is_deleted"):
            continue
        cat = ((it.get("category") or {}).get("name") or "").strip() or None
        brand = brand_name(it.get("brand_id"), cats_by_brand[it.get("brand_id")])
        for v in it.get("item_variants") or []:
            if v.get("is_deleted"):
                continue
            name = (it.get("name") or "").strip()
            if (v.get("name") or "").strip():
                name = f"{name} {v['name'].strip()}"
            prices = {}
            for st in v.get("sales_type_items") or []:
                nm = (st.get("sales_type_name") or "").strip()
                if not nm:
                    continue
                # sama dengan file export Item Library Moka:
                # ada harga -> harga; harga bebas (variable) -> kosong; terhubung tanpa harga -> 0
                if st.get("sales_type_price") is not None:
                    prices[nm] = st["sales_type_price"]
                elif st.get("is_variable_price"):
                    prices[nm] = None
                else:
                    prices[nm] = 0
            rows.append({"store_id": sid, "outlet_name": outlet["name"], "variant_id": v["id"],
                         "sku": (v.get("sku") or "").strip() or None, "item_name": name, "category": cat,
                         "brand": brand, "cogs": v.get("cogs"), "basic_price": v.get("price"), "prices": prices,
                         "updated_at": datetime.now(timezone.utc).isoformat()})
    return rows



def process_items(ctx, outlet, sid):
    t0 = time.time()
    res = {"outlet": outlet["name"], "store_id": sid, "status": "OK", "errors": []}
    if re.match(r'^(?:DC|DISTRIBUTION CENTER|GUDANG)(?:[\s._-]|$)',outlet['name'].strip(),re.I):
        res.update(status='SKIP',rows=0,price_result={'outlet':outlet['name'],'status':'skipped','reason':'DC tidak diambil untuk Price List'})
        res['seconds']=round(time.time()-t0,1);return res
    try:
        res['phase']='library_read'
        rows = item_rows(outlet, sid, ctx.moka.items(outlet["id"]))
        res["rows"] = len(rows)
        if ctx.db and not DRY_RUN:
            res['phase']='price_list'
            res['price_result']=refresh_price_list(outlet['name'],rows,sid)
    except HttpError as e:
        res['status']='ERROR'
        res['errors'].append(str(e))
    except Exception as e:
        res["status"] = "ERROR"; res["errors"].append(f"{type(e).__name__}: {str(e)[:300]}")
    res["seconds"] = round(time.time() - t0, 1)
    return res


def rp(x):
    return f"Rp{x:,.0f}".replace(",", ".")


def refresh_price_list(outlet_name,rows=None,store_id=None):
    if re.match(r'^(?:DC|DISTRIBUTION CENTER|GUDANG)(?:[\s._-]|$)',outlet_name.strip(),re.I):
        return {'outlet':outlet_name,'status':'skipped','reason':'DC/gudang tidak dimasukkan ke Price List'}
    task=subprocess.run(['node','moka_price_sync_v38.cjs',outlet_name],capture_output=True,text=True,timeout=330,input=json.dumps({'rows':rows,'store_id':store_id}))
    if task.returncode:
        raise RuntimeError((task.stderr or task.stdout or 'Helper gagal')[-400:].strip())
    markers=[line.removeprefix('PRICE_RESULT_JSON=') for line in task.stdout.splitlines() if line.startswith('PRICE_RESULT_JSON=')]
    if not markers:raise RuntimeError('Status helper tidak tersedia; perbarui moka_price_sync_v38.cjs dari paket V43.')
    receipt=json.loads(markers[-1])
    if receipt.get('status') not in ('saved','unchanged','skipped') or receipt.get('outlet')!=outlet_name:raise RuntimeError('Status helper tidak valid')
    return receipt


def main():
    token = env("MOKA_ACCESS_TOKEN")
    if not token:
        raise RuntimeError("MOKA_ACCESS_TOKEN belum diisi di GitHub Actions Secrets.")
    exp = env("MOKA_TOKEN_EXPIRES")
    if exp:
        left = (date.fromisoformat(exp) - datetime.now(TZ).date()).days
        if left <= 30:
            warn(f"Token Moka habis dalam {left} hari ({exp}). Perbarui secret MOKA_ACCESS_TOKEN.")

    now = datetime.now(TZ)
    db = None
    supa_key = env("SUPABASE_KEY")
    if supa_key:
        db = Supa(env("SUPABASE_URL", DEFAULT_SUPABASE_URL), supa_key)
    elif not DRY_RUN:
        sys.exit("SUPABASE_KEY belum diisi. Isi secret SUPABASE_SERVICE_KEY, atau jalankan dengan DRY_RUN=1.")
    writing = db is not None and not DRY_RUN

    run_id = env("RUN_ID")
    CRASH["db"], CRASH["writing"] = db, writing
    run_url = (f"{os.environ.get('GITHUB_SERVER_URL')}/{os.environ.get('GITHUB_REPOSITORY')}/actions/runs/"
               f"{os.environ.get('GITHUB_RUN_ID')}") if os.environ.get("GITHUB_RUN_ID") else None

    def run_update(**fields):
        if not writing:
            return
        try:
            nonlocal run_id
            if run_id:
                db.patch("moka_sync_runs", f"id=eq.{run_id}", fields)
            else:
                who = "jadwal" if os.environ.get("GITHUB_EVENT_NAME") == "schedule" else "manual"
                got = db.insert("moka_sync_runs", [dict({"mode": MODE, "requested_by": who}, **fields)], ret=True)
                run_id = str(got[0]["id"]) if got else None
            CRASH["run_id"] = run_id
        except HttpError as e:
            warn("Status sinkron tidak tersimpan (periksa SQL V35/V36): " + str(e)[:200])

    run_update(status="running", started_at=datetime.now(timezone.utc).isoformat(), github_run_url=run_url,
               message="Sedang menarik data Moka…")

    moka = Moka(token)
    try:
        prof, outlets = moka.outlets()
    except HttpError as e:
        run_update(status="error", finished_at=datetime.now(timezone.utc).isoformat(),
                   message="Token Moka ditolak" if e.code == 401 else str(e)[:400])
        if e.code == 401:
            sys.exit("Token Moka ditolak (401): kemungkinan sudah kedaluwarsa atau dicabut.")
        raise
    only = {norm(x) for x in env("ONLY_OUTLETS").split(",") if x.strip()}
    if only:
        outlets = [o for o in outlets if norm(o["name"]) in only]
    log(f"Moka: {prof.get('business_name')} — {len(outlets)} outlet · mode {MODE.upper()}")

    stores, aliases, known_types = [], [], set()
    if db:
        stores = db.sel("stores?select=id,name,is_active")
        aliases = db.sel("store_aliases?select=alias,store_id")
        known_types = {norm(r["sales_type"]) for r in db.sel("sales_type_map?select=sales_type")}
    mapped = []
    for o in outlets:
        sid = find_store(o["name"], stores, aliases) if db else o["id"]
        if sid is None:
            log(f"  - {o['name']}: belum ada di daftar toko/alias dashboard → dilewati")
            continue
        mapped.append((o, sid))

    if not mapped:
        raise RuntimeError("Tidak ada outlet Moka yang cocok dengan stores/store_aliases. Tidak ada data ditulis.")
    if len({sid for _, sid in mapped}) != len(mapped):
        raise RuntimeError("Beberapa outlet Moka dipetakan ke toko yang sama. Perbaiki store_aliases sebelum sinkron.")
    periods, cutoff = periods_for_run(now)
    if not periods:
        raise RuntimeError("Tidak ada periode valid untuk disinkronkan.")
    until_txt = (now.astimezone(LOCAL_TZ).strftime("%Y-%m-%d %H:%M WITA") if MODE == "live" else cutoff.isoformat())
    log(f"Periode: {', '.join(f'{y}-{m:02d} ({a.day}–{b.day})' for y, m, a, b in periods) or '-'}"
        f" · data sampai {until_txt} · {'DRY RUN' if DRY_RUN else 'TULIS KE SUPABASE'}")
    ctx = Ctx(moka, db, now, known_types)
    stamp = now.astimezone(LOCAL_TZ).strftime("%Y-%m-%d %H:%M")
    results, item_results = [], []

    with ThreadPoolExecutor(WORKERS) as ex:
        futs = {} if PRICE_ONLY or not SALES_COMPONENTS else {ex.submit(process, ctx, o, sid, p): (o, sid) for p in periods for o, sid in mapped}

        for f in as_completed(futs):
            o, tag = futs[f]
            try:
                res = f.result()
            except Exception as e:
                res = {"outlet": o["name"], "status": "ERROR", "errors": [str(e)[:300]], "seconds": 0}
                if tag != "items":
                    raise
            if tag == "items":
                item_results.append(res)
                log(f"  {'✓' if res['status'] == 'OK' else '·' if res['status'] == 'SKIP' else '✗'} "
                    f"{res['outlet']:<26} library item: {res.get('rows', 0):>6} SKU"
                    f"  {res['seconds']:>6}s {'; '.join(res['errors'])}")
                continue
            if res["status"] in ("OK", "WARN") and writing:
                try:
                    write_store_month(db, res, known_types, stamp)
                except HttpError as e:
                    res["status"] = "ERROR"; res["errors"].append("tulis Supabase: " + str(e))
            if res["status"] == "ERROR" and writing:
                try:
                    db.insert("ingest_log", [{"kind": "SALES_TYPE", "file_name": f"MOKA API {stamp}",
                                              "store_id": res["store_id"], "year": res["year"], "month": res["month"],
                                              "rows_total": 0, "rows_mapped": 0, "rows_unmapped": 0,
                                              "status": "ERROR", "message": "; ".join(res["errors"])[:500]}])
                except HttpError:
                    pass
            s = res.get("summary") or {}
            mark = {"OK": "✓", "WARN": "!", "SKIP": "·", "UNCHANGED": "↷"}.get(res["status"], "✗")
            log(f"  {mark} {res['outlet']:<26} {res['year']}-{res['month']:02d}  net {rp(float(s.get('net_sales') or 0)):>17}"
                f"  trx {int(s.get('number_of_transactions') or 0):>6}  {len(res.get('sales_types') or {}):>3} sales type"
                f"  {len(res.get('items') or []):>5} item  dari {res.get('fetch_from', '-')}"
                f"  {res['seconds']:>6}s {'; '.join(res['errors'])}" + (" · dilewati: "+res['skip_reason'] if res.get('skip_reason') else ''))
            results.append(res)

    member_result=None;member_error=None
    if 'members' in COMPONENTS and not PRICE_ONLY:
        try:
            from moka_member_v47 import sync as sync_members,MemberSourceError
            log('Member: membaca Customer List dan seluruh halaman Purchase History…')
            member_result=sync_members(db,mapped,stores,aliases,periods,TZ,writing,
                progress=lambda done,total,receipts:log(f'Member: {done}/{total} customer diperiksa; {receipts} nota pada cakupan pilihan.'))
            log(f"Member API OK: {member_result['customers']} customer; {member_result['receipts']} nota/refund; {member_result['http_requests']} request sumber.")
        except Exception as e:
            member_error=str(e) if type(e).__name__=='MemberSourceError' else 'Pemrosesan Member gagal ('+type(e).__name__+'); periksa SQL V47 dan konfigurasi sumber.'
            warn(member_error)

    if INCLUDE_LIBRARY:
        log("Penjualan selesai diproses. Memproses Item Library langsung menjadi Price List (tanpa menyimpan katalog mentah)…")
        for o, sid in mapped:
            res = process_items(ctx, o, sid)
            item_results.append(res)
            mark = {"OK": "✓", "SKIP": "·", "UNCHANGED": "↷"}.get(res["status"], "✗")
            log(f"  {mark} {res['outlet']:<26} library item: {res.get('rows', 0):>6} SKU"
                f"  {res['seconds']:>6}s {'; '.join(res['errors'])}")

    if writing and any(r.get('status') in ('saved','unchanged') for r in [i.get('price_result',{}) for i in item_results]):
        db.insert('app_settings',[{'key':'commercial_price_last_checked_v45','value':datetime.now(timezone.utc).isoformat()}],'key')
    if writing and any(i.get('price_result',{}).get('status')=='saved' for i in item_results):
        db.insert('app_settings',[{'key':'commercial_price_last_updated_v45','value':datetime.now(timezone.utc).isoformat()}],'key')
    price_results=[r['price_result'] for r in item_results if r.get('price_result')]
    price_errors=[{'outlet':r['outlet'],'status':'ERROR','errors':r['errors']} for r in item_results if r.get('phase')=='price_list' and r['status']=='ERROR']
    price_results.extend(price_errors)
    for receipt in price_results:
        verb={'saved':'diperbarui','unchanged':'tetap sama','skipped':'dilewati','ERROR':'gagal'}[receipt['status']]
        log('· Price List '+verb+': '+receipt['outlet'])
    rebuild_error = None
    if writing and (any(r["status"] in ("OK", "WARN", "UNCHANGED") for r in results) or any(r["status"] == "OK" for r in item_results)):
        try:
            if "sales_type" in COMPONENTS and any(r["status"] in ("OK", "WARN", "UNCHANGED") for r in results):
                db.rpc("rebuild_sales_actual")
                log("✓ rebuild_sales_actual selesai")
        except HttpError as e:
            rebuild_error = str(e)
            warn("Sales Type tersimpan, tetapi rebuild_sales_actual gagal: " + str(e))
        try:
            rev = datetime.now(timezone.utc).isoformat()
            db.insert("app_settings", [{"key": "commercial_moka_revision", "value": rev}], "key")
        except HttpError:
            pass

    ok = [r for r in results if r["status"] == "OK"]
    unchanged = [r for r in results if r["status"] == "UNCHANGED"]
    wr = [r for r in results if r["status"] == "WARN"]
    sales_bad = [r for r in results if r["status"] == "ERROR"]
    library_bad = [r for r in item_results if r["status"] == "ERROR" and r.get("phase")!="price_list"]
    price_saved=sum(r["status"]=="saved" for r in price_results)
    price_same=sum(r["status"]=="unchanged" for r in price_results)
    price_skipped=sum(r["status"]=="skipped" for r in price_results)
    bad = sales_bad + library_bad + price_errors
    for r in wr:
        warn(f"{r['outlet']} {r['year']}-{r['month']:02d}: {r['errors'][0]}")
    member_blocked = bool(member_error)
    if member_blocked:
        warn('Member belum selesai: '+member_error)
    actual_end=max(p[3] for p in periods)
    data_until = now if MODE == "live" and actual_end == now.date() else datetime(actual_end.year, actual_end.month, actual_end.day, 23, 59, 59, tzinfo=TZ)
    library_ok = [r for r in item_results if r["status"] == "OK"]
    run_update(status="error" if bad or rebuild_error or (member_blocked and not SALES_COMPONENTS) else "warn" if wr or member_blocked or (member_result and member_result["status"]=="WARN") else "done",
               finished_at=datetime.now(timezone.utc).isoformat(), data_until=data_until.isoformat() if results or member_result else None,
               data_through=actual_end.isoformat() if (results or member_result) and not sales_bad and not member_error and not (member_result and member_result["status"]!="OK") else None, components=sorted(COMPONENTS) if not PRICE_ONLY else ["price_list"],
               stores_ok=len(ok)+len(unchanged)+(len(mapped) if member_result and not results else 0), stores_warn=len(wr), stores_error=len(bad),
               message=(("Member gagal: "+member_error+". " if member_error else (f"Member API OK: {member_result['customers']} customer, {member_result['receipts']} nota/refund, {member_result['unmapped_payments']} pembayaran belum terpetakan. " if member_result else "")) + f"Komponen {','.join(sorted(COMPONENTS))}; Sales: {len(ok)} OK, {len(unchanged)} dilewati (sesuai), {len(wr)} menunggu Moka, {len(sales_bad)} gagal; Price List {price_saved} diperbarui, {price_same} sama, {price_skipped} dilewati, {len(price_errors)} gagal; library: {len(library_ok)} OK, {len(library_bad)} gagal" + ("; hitung ulang sales gagal: " + rebuild_error[:160] if rebuild_error else "") +
                        (f" · library {len([r for r in item_results if r['status'] == 'OK'])} toko" if item_results else "") +
                        ("; " + "; ".join(f"{r['outlet']}: {r['errors'][0][:120]}" for r in bad[:3]) if bad else ""))[:900])

    if DRY_RUN:
        os.makedirs(OUT_DIR, exist_ok=True)
        slim = [{k: v for k, v in r.items() if k not in ("items", "agg")} | {"item_rows": len(r.get("items") or [])}
                for r in results]
        with open(os.path.join(OUT_DIR, "hasil.json"), "w", encoding="utf-8") as fh:
            json.dump({"months": slim, "items": item_results}, fh, ensure_ascii=False, indent=1, default=str)
        log(f"Hasil uji coba disimpan di {OUT_DIR}/hasil.json")

    if STEP_SUMMARY:
        with open(STEP_SUMMARY, "a", encoding="utf-8") as fh:
            if member_error: fh.write("**Member gagal:** "+member_error+"\n\n")
            elif member_result: fh.write(f"**Member API OK:** {member_result['customers']} customer, {member_result['receipts']} nota/refund.\n\n")
            fh.write(f"### Sinkron Moka {MODE.upper()} {'(uji coba)' if DRY_RUN else ''} — data s.d. {until_txt}\n\n")
            fh.write("| Toko | Bulan | Net Sales | Transaksi | Sales Type | Item | Status |\n|---|---|---:|---:|---:|---:|---|\n")
            for r in sorted(results, key=lambda r: (r["year"], r["month"], r["outlet"])):
                s = r.get("summary") or {}
                fh.write(f"| {r['outlet']} | {r['year']}-{r['month']:02d} | {rp(float(s.get('net_sales') or 0))} | "
                         f"{int(s.get('number_of_transactions') or 0):,} | {len(r.get('sales_types') or {})} | "
                         f"{len(r.get('items') or [])} | {r['status']} {'; '.join(r['errors'])} |\n")
            if item_results:
                fh.write("\n| Toko | SKU Library | Status |\n|---|---:|---|\n")
                for r in sorted(item_results, key=lambda r: r["outlet"]):
                    fh.write(f"| {r['outlet']} | {r.get('rows', 0):,} | {r['status']} {'; '.join(r['errors'])} |\n")
            if price_results:
                fh.write("\n| Price List toko | Status | Keterangan |\n|---|---|---|\n")
                for r in price_results:
                    fh.write(f"| {r['outlet']} | {r['status']} | {r.get('reason') or '; '.join(r.get('errors',[]))} |\n")
            unm = sorted({t for r in results for t in r.get("unmapped") or []})
            if unm:
                fh.write(f"\n**Sales Type belum termapping:** {', '.join(unm)} — atur di Pengaturan → Pemetaan Sales Type.\n")
    log(f"Selesai: sales {len(ok)} OK, {len(unchanged)} dilewati, {len(wr)} WARN, {len(sales_bad)} gagal; library {len(library_ok)} OK, {len(library_bad)} gagal; Price List {price_saved} diperbarui, {price_same} sama, {price_skipped} dilewati, {len(price_errors)} gagal")
    if bad or rebuild_error or member_error:
        sys.exit(1)


CRASH = {"db": None, "writing": False, "run_id": None}

if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except BaseException as e:  # tandai run gagal supaya tombol Sinkron tidak tertahan "berjalan"
        if CRASH["writing"] and CRASH["run_id"]:
            try:
                CRASH["db"].patch("moka_sync_runs", f"id=eq.{CRASH['run_id']}",
                                  {"status": "error", "finished_at": datetime.now(timezone.utc).isoformat(),
                                   "message": f"Berhenti karena error: {type(e).__name__}: {str(e)[:300]}"})
            except Exception:
                pass
        raise
