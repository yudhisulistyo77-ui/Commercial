#!/usr/bin/env python3
"""
Sinkronisasi Moka POS -> Supabase (Dashboard Commercial / Store Operation) — V2.

Mode
----
  full  (jadwal harian)  : bulan berjalan sampai KEMARIN ditarik ulang penuh
                           (+ bulan lalu pada tanggal 1–3). Juga memperbarui item & stok.
  live  (tombol Sinkron) : data sampai MENIT INI. Cukup menarik transaksi beberapa hari
                           terakhir (LIVE_DAYS, default 3); hari sebelumnya dibaca dari
                           tabel harian yang sudah tersimpan. Stok ikut bila INCLUDE_STOCK=1.

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
  INCLUDE_STOCK       "1" = tarik item & stok (default 1 untuk full, 0 untuk live).
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
MODE = env("SYNC_MODE", "full").lower()
if MODE not in ("full", "live"):
    MODE = "full"
DRY_RUN = env("DRY_RUN", "0").lower() in ("1", "true", "yes")
LIVE_DAYS = max(1, int(env("LIVE_DAYS", "3")))
INCLUDE_STOCK = env("INCLUDE_STOCK", "1" if MODE == "full" else "0").lower() in ("1", "true", "yes")
WORKERS = max(1, int(env("WORKERS", "3")))
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
            transient = e.code in (408, 429, 502, 503, 504) or (retry_500 and e.code == 500)
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

    def get(self, path, params=None, retry_500=True):
        url = path if path.startswith("http") else MOKA_BASE + path
        if not url.startswith(MOKA_BASE + "/"):
            raise RuntimeError("URL Moka tidak dikenal, dihentikan demi keamanan token")
        if params:
            url += ("&" if "?" in url else "?") + urllib.parse.urlencode(params)
        body, _ = http("GET", url, self.h, retry_500=retry_500)
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

    def transactions(self, oid, since_dt, until_dt, per_page=300):
        url = MOKA_BASE + f"/v3/outlets/{oid}/reports/get_latest_transactions?" + urllib.parse.urlencode(
            {"per_page": per_page, "since": int(since_dt.timestamp()), "until": int(until_dt.timestamp())})
        seen, pays, visited = set(), [], set()
        while url:
            if url in visited:
                raise RuntimeError("Pagination transaksi Moka berulang; data tidak disimpan.")
            visited.add(url)
            try:
                d = self.get(url, retry_500=False)
            except HttpError as e:
                m = re.search(r"per_page=(\d+)", url)
                if e.code == 500 and m and int(m.group(1)) > 25:
                    url = url.replace(m.group(0), f"per_page={int(m.group(1)) // 2}")
                    continue
                raise
            fresh = [p for p in d.get("payments") or [] if p["id"] not in seen]
            seen.update(p["id"] for p in fresh)
            pays.extend(fresh)
            if d.get("completed") or not d.get("payments") or not fresh:
                break
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
                raise RuntimeError("Pagination item Moka berulang; stok lama dipertahankan.")
            visited.add(url)
            d = self.get(url)
            out.extend(d.get("items") or [])
            if d.get("completed") or not d.get("items"):
                return out
            if not d.get("next_url"):
                if d.get("completed") is False:
                    raise RuntimeError("Pagination item Moka belum selesai tanpa next_url; stok lama dipertahankan.")
                return out
            url = d["next_url"].replace("access_token=&", "")
        if url:
            raise RuntimeError("Pagination item melebihi batas 200 halaman; stok lama dipertahankan.")
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
        value += float(r.get("refund_amount") or 0)
    if not p.get("payment_refunds"):
        value = float(p.get("total_collected") or 0)
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
                g["amount"] += float(c.get("net_sales") or 0)
                g["tx"].add(p["id"])
            tc = float(p.get("total_collected") or 0)
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
        weights = [(c, float(c.get("net_sales") or 0) * (float(c.get("refunded_quantity") or 0) / float(c["quantity"]))
                    if c.get("quantity") else 0.0) for c in lines]
        if sum(w for _, w in weights) <= 0:
            weights = [(c, float(c.get("net_sales") or 0)) for c in lines]
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

    def rpc(self, fn, args=None):
        body, _ = http("POST", self.base + "rpc/" + fn, self.h, args or {}, timeout=600, retry_500=False)
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
    today = now.date()
    if MODE == "live":
        cutoff = today
        start = today - timedelta(days=LIVE_DAYS - 1)
        months = sorted({(start.year, start.month), (today.year, today.month)})
    else:
        cutoff = today - timedelta(days=1)
        spec = env("SYNC_MONTHS")
        months = []
        if spec:
            for part in [p.strip() for p in spec.split(",") if p.strip()]:
                if ".." in part:
                    a, b = [x.strip() for x in part.split("..")]
                    y, m = map(int, a.split("-")); y2, m2 = map(int, b.split("-"))
                    while (y, m) <= (y2, m2):
                        months.append((y, m))
                        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
                else:
                    y, m = map(int, part.split("-")); months.append((y, m))
        else:
            months.append((cutoff.year, cutoff.month))
            if cutoff.day <= 3:
                prev = cutoff.replace(day=1) - timedelta(days=1)
                months.insert(0, (prev.year, prev.month))
    out = []
    for y, m in sorted(set(months)):
        first = date(y, m, 1)
        last = min(date(y + (m == 12), m % 12 + 1, 1) - timedelta(days=1), cutoff)
        if first > cutoff:
            continue
        out.append((y, m, first, last))
    return out, cutoff


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
        net = float(summ.get("net_sales") or 0)
        it = ctx.moka.item_sales(oid, d1, d2)
        res["items"] = it.get("item_sales") or []
        res["item_total"] = sum(float(r.get("net_sales") or 0) for r in res["items"])

        # Hari yang perlu ditarik transaksinya
        fetch_from = d1
        if MODE == "live" and ctx.db:
            want = max(d1, ctx.now.date() - timedelta(days=LIVE_DAYS - 1))
            if want > d1:
                cov = ctx.db.sel(f"moka_sync_coverage?select=sale_date&store_id=eq.{sid}"
                                 f"&sale_date=gte.{d1}&sale_date=lt.{want}")
                have = {r["sale_date"] for r in cov}
                if all(d.isoformat() in have for d in day_range(d1, want - timedelta(days=1))):
                    fetch_from = want
        res["fetch_from"] = fetch_from.isoformat()
        since = datetime(fetch_from.year, fetch_from.month, fetch_from.day, tzinfo=TZ)
        until = ctx.now if (MODE == "live" and d2 == ctx.now.date()) else \
            datetime(d2.year, d2.month, d2.day, tzinfo=TZ) + timedelta(days=1) - timedelta(seconds=1)
        pays = ctx.moka.transactions(oid, since, until) if (net or summ.get("number_of_transactions") or fetch_from != d1) else []
        res["payments"] = len(pays)
        agg = aggregate(pays)
        res["agg"] = agg

        # Sales Type bulanan = hari tersimpan (sebelum fetch_from) + hasil tarikan baru
        monthly = defaultdict(lambda: {"amount": 0.0, "trx_count": 0})
        if fetch_from > d1 and ctx.db:
            for r in ctx.db.sel(f"moka_sales_type_daily?select=sales_type,trx_count,amount&store_id=eq.{sid}"
                                f"&sale_date=gte.{d1}&sale_date=lt.{fetch_from}"):
                monthly[r["sales_type"]]["amount"] += float(r["amount"] or 0)
                monthly[r["sales_type"]]["trx_count"] += int(r["trx_count"] or 0)
        for ts in agg["sales_types"].values():
            for t, v in ts.items():
                monthly[t]["amount"] += v["amount"]
                monthly[t]["trx_count"] += v["trx_count"]
        res["sales_types"] = {t: {"amount": round(v["amount"], 2), "trx_count": v["trx_count"]} for t, v in monthly.items()}
        res["sales_type_total"] = sum(v["amount"] for v in res["sales_types"].values())

        if abs(res["item_total"] - net) > max(TOLERANCE, 0.5 * len(res["items"])):
            res["errors"].append(f"Item Sales {res['item_total']:,.0f} != Sales Summary {net:,.0f}")
        if abs(res["sales_type_total"] - net) > TOLERANCE:
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
        res["errors"] = [f"Moka belum selesai memproses transaksi terbaru/telat tersinkron: Summary {net:,.0f} vs "
                         f"detail {basis:,.0f} (selisih {net - basis:,.0f}); terkoreksi di sinkron berikutnya"]


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
    f1, f2 = res["fetch_from"], res["end"]
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
           "nilai_transaksi": float(s.get("net_sales") or 0), "is_manual": True}
    db.insert("transaksi", [trx], "store_id,year,month")
    db.insert("ingest_log", [{"kind": "TRANSAKSI", "file_name": src, "store_id": sid, "year": y, "month": m,
                              "rows_total": 1, "rows_mapped": 1, "rows_unmapped": 0,
                              "total_amount": trx["nilai_transaksi"], "status": "OK", "message": note}])

    target_db.rpc("commercial_moka_replace_v35", {
        "p_store_id": sid, "p_year": y, "p_month": m,
        "p_from": f1, "p_to": f2, "p_rows": db.rows,
    })


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
                         "in_stock": v.get("in_stock"), "stock_alert": v.get("stock_alert"),
                         "track_stock": v.get("track_stock"), "updated_at": datetime.now(timezone.utc).isoformat()})
    return rows


def process_items(ctx, outlet, sid):
    t0 = time.time()
    res = {"outlet": outlet["name"], "store_id": sid, "status": "OK", "errors": []}
    try:
        rows = item_rows(outlet, sid, ctx.moka.items(outlet["id"]))
        res["rows"] = len(rows)
        res["stock"] = sum(float(r["in_stock"] or 0) for r in rows if r["track_stock"] is not False)
        if ctx.db and not DRY_RUN:
            ctx.db.rpc("commercial_moka_stock_replace_v35", {"p_store_id": sid, "p_rows": rows})
    except HttpError as e:
        res["status"] = "SKIP" if (e.code == 403 and "xpired" in e.body) else "ERROR"
        res["errors"].append(str(e))
    except Exception as e:
        res["status"] = "ERROR"; res["errors"].append(f"{type(e).__name__}: {str(e)[:300]}")
    res["seconds"] = round(time.time() - t0, 1)
    return res


def rp(x):
    return f"Rp{x:,.0f}".replace(",", ".")


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
            warn("Status sinkron tidak tersimpan (jalankan MOKA-SYNC-V2.sql?): " + str(e)[:200])

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
        futs = {} if env("SKIP_SALES") == "1" else {ex.submit(process, ctx, o, sid, p): (o, sid) for p in periods for o, sid in mapped}
        if INCLUDE_STOCK:
            for o, sid in mapped:
                futs[ex.submit(process_items, ctx, o, sid)] = (o, "items")
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
                    f"{res['outlet']:<26} item & stok: {res.get('rows', 0):>6} SKU  stok {res.get('stock', 0):>10,.0f}"
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
            mark = {"OK": "✓", "WARN": "!", "SKIP": "·"}.get(res["status"], "✗")
            log(f"  {mark} {res['outlet']:<26} {res['year']}-{res['month']:02d}  net {rp(float(s.get('net_sales') or 0)):>17}"
                f"  trx {int(s.get('number_of_transactions') or 0):>6}  {len(res.get('sales_types') or {}):>3} sales type"
                f"  {len(res.get('items') or []):>5} item  dari {res.get('fetch_from', '-')}"
                f"  {res['seconds']:>6}s {'; '.join(res['errors'])}")
            results.append(res)

    rebuild_error = None
    if writing and any(r["status"] in ("OK", "WARN") for r in results):
        try:
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
    wr = [r for r in results if r["status"] == "WARN"]
    bad = [r for r in results if r["status"] == "ERROR"] + [r for r in item_results if r["status"] == "ERROR"]
    for r in wr:
        warn(f"{r['outlet']} {r['year']}-{r['month']:02d}: {r['errors'][0]}")
    data_until = now if MODE == "live" else datetime(cutoff.year, cutoff.month, cutoff.day, 23, 59, 59, tzinfo=TZ)
    run_update(status="error" if bad or rebuild_error else "warn" if wr else "done",
               finished_at=datetime.now(timezone.utc).isoformat(), data_until=data_until.isoformat(),
               stores_ok=len(ok), stores_warn=len(wr), stores_error=len(bad),
               message=(f"{len(ok)} OK, {len(wr)} menunggu Moka, {len(bad)} gagal" + ("; hitung ulang sales gagal: " + rebuild_error[:160] if rebuild_error else "") +
                        (f" · stok {len([r for r in item_results if r['status'] == 'OK'])} toko" if item_results else "") +
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
            fh.write(f"### Sinkron Moka {MODE.upper()} {'(uji coba)' if DRY_RUN else ''} — data s.d. {until_txt}\n\n")
            fh.write("| Toko | Bulan | Net Sales | Transaksi | Sales Type | Item | Status |\n|---|---|---:|---:|---:|---:|---|\n")
            for r in sorted(results, key=lambda r: (r["year"], r["month"], r["outlet"])):
                s = r.get("summary") or {}
                fh.write(f"| {r['outlet']} | {r['year']}-{r['month']:02d} | {rp(float(s.get('net_sales') or 0))} | "
                         f"{int(s.get('number_of_transactions') or 0):,} | {len(r.get('sales_types') or {})} | "
                         f"{len(r.get('items') or [])} | {r['status']} {'; '.join(r['errors'])} |\n")
            if item_results:
                fh.write("\n| Toko | SKU | Total stok | Status |\n|---|---:|---:|---|\n")
                for r in sorted(item_results, key=lambda r: r["outlet"]):
                    fh.write(f"| {r['outlet']} | {r.get('rows', 0):,} | {r.get('stock', 0):,.0f} | {r['status']} {'; '.join(r['errors'])} |\n")
            unm = sorted({t for r in results for t in r.get("unmapped") or []})
            if unm:
                fh.write(f"\n**Sales Type belum termapping:** {', '.join(unm)} — atur di Pengaturan → Pemetaan Sales Type.\n")
    log(f"Selesai: {len(ok)} OK, {len(wr)} WARN, {len(bad)} gagal")
    if bad or rebuild_error:
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
