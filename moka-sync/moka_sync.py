#!/usr/bin/env python3
"""
Sinkronisasi Moka POS -> Supabase (Dashboard Commercial / Store Operation).

Menarik data per toko per bulan dari API Moka dan mengisi tabel yang sama
dengan menu "Upload Data" di dashboard:

  sales_type_raw  <- Sales Type (dihitung dari transaksi, cocok dengan laporan Sales Type Moka)
  item_sales      <- laporan Item Sales Moka
  transaksi       <- jumlah transaksi & net sales dari Sales Summary Moka
  ingest_log      <- catatan setiap sinkronisasi
  rpc rebuild_sales_actual  <- hitung ulang sales_actual setelah Sales Type masuk

Setiap toko-bulan direkonsiliasi dulu dengan Sales Summary Moka. Kalau totalnya
tidak cocok, data lama di database TIDAK disentuh dan statusnya ERROR di log.

Hanya memakai pustaka standar Python 3.9+ (tanpa pip install).

Variabel lingkungan
-------------------
  MOKA_ACCESS_TOKEN     wajib. Token OAuth Moka (simpan di GitHub Secrets, jangan di repo).
  SUPABASE_URL          default https://qrabkayuwglmlaouliwn.supabase.co
  SUPABASE_KEY          wajib kecuali DRY_RUN=1. Disarankan kunci secret/service_role.
  SYNC_MONTHS           opsional. "2026-10,2026-11" atau rentang "2026-01..2026-10".
                        Kosong = bulan berjalan s.d. kemarin (+ bulan lalu bila tanggal <= 3).
  ONLY_OUTLETS          opsional. Nama outlet Moka dipisah koma.
  DRY_RUN               "1" = tidak menulis ke Supabase; hasil disimpan ke moka-sync-output/.
  PARTS                 default "sales_type,item,trx".
  WORKERS               default 3 (permintaan paralel ke Moka).
  MOKA_TZ_OFFSET        default 7 (zona waktu akun Moka; batas hari mengikuti Back Office Moka).
  MOKA_TOKEN_EXPIRES    opsional, YYYY-MM-DD. Memunculkan peringatan bila token hampir habis.
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta, timezone

MOKA_BASE = "https://api.mokapos.com"
DEFAULT_SUPABASE_URL = "https://qrabkayuwglmlaouliwn.supabase.co"
TOLERANCE = 10.0          # selisih pembulatan (Rp) yang masih dianggap cocok
NO_SALES_TYPE = "TANPA SALES TYPE"


def env(name, default=""):
    v = os.environ.get(name)
    return v.strip() if v and v.strip() else default


TZ = timezone(timedelta(hours=float(env("MOKA_TZ_OFFSET", "7"))))
DRY_RUN = env("DRY_RUN", "0").lower() in ("1", "true", "yes")
PARTS = {p.strip() for p in env("PARTS", "sales_type,item,trx").split(",") if p.strip()}
WORKERS = max(1, int(env("WORKERS", "3")))
OUT_DIR = env("OUTPUT_DIR", "moka-sync-output")
STEP_SUMMARY = os.environ.get("GITHUB_STEP_SUMMARY")


def log(msg):
    print(msg, flush=True)


def warn(msg):
    # format anotasi GitHub Actions; tetap terbaca di terminal biasa
    print(f"::warning::{msg}", flush=True)


class HttpError(Exception):
    def __init__(self, code, body, where):
        super().__init__(f"HTTP {code} {where}: {body}")
        self.code, self.body, self.where = code, body, where


def http(method, url, headers, body=None, timeout=180, retries=5, retry_500=True):
    data = json.dumps(body).encode() if body is not None else None
    where = urllib.parse.urlsplit(url).path       # jangan pernah mencetak query/token
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
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
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
        return body["data"] if isinstance(body, dict) and "data" in body else body   # /profile/self tanpa "data"

    def outlets(self):
        prof = self.get("/v1/profile/self")
        outs = self.get(f"/v1/businesses/{prof['business_id']}/outlets")["outlets"]
        return prof, [o for o in outs if not o.get("is_deleted")]

    def sales_summary(self, oid, d1, d2):
        return self.get(f"/v2/outlets/{oid}/reports/sales_summary",
                        {"start": d1.strftime("%d/%m/%Y"), "end": d2.strftime("%d/%m/%Y")})

    def item_sales(self, oid, d1, d2):
        return self.get(f"/v3/outlets/{oid}/reports/item_sales",
                        {"start": d1.strftime("%d/%m/%Y"), "end": d2.strftime("%d/%m/%Y"),
                         "per_page": 1000})   # batas Moka 1–1000; laporan ini mengembalikan semua item sekaligus

    def transactions(self, oid, d1, d2, per_page=300):
        since = int(datetime(d1.year, d1.month, d1.day, tzinfo=TZ).timestamp())
        until = int(datetime(d2.year, d2.month, d2.day, tzinfo=TZ).timestamp()) + 86400 - 1
        url = MOKA_BASE + f"/v3/outlets/{oid}/reports/get_latest_transactions?" + urllib.parse.urlencode(
            {"per_page": per_page, "since": since, "until": until})
        seen, pays = set(), []
        while url:
            try:
                d = self.get(url, retry_500=False)
            except HttpError as e:
                m = re.search(r"per_page=(\d+)", url)
                if e.code == 500 and m and int(m.group(1)) > 25:   # halaman terlalu besar -> perkecil
                    url = url.replace(m.group(0), f"per_page={int(m.group(1)) // 2}")
                    continue
                raise
            fresh = [p for p in d.get("payments") or [] if p["id"] not in seen]
            seen.update(p["id"] for p in fresh)
            pays.extend(fresh)
            if d.get("completed") or not d.get("payments") or not fresh:
                break
            url = (d.get("next_url") or "").replace("access_token=&", "")
        return pays


def aggregate_sales_types(pays):
    """Sales Type per baris item. Refund (is_refunded=True) mengurangi nilai.
    trx_count = jumlah transaksi penjualan (bukan refund) yang memuat sales type itu."""
    agg, seen_refunds = {}, set()

    def bucket(c):
        t = (c.get("sales_type_name") or "").strip() or NO_SALES_TYPE
        return agg.setdefault(t, {"amount": 0.0, "tx": set()})

    for p in pays:
        # Baris COMPONENT adalah isi paket bundling; nilainya sudah ada di baris BUNDLE.
        lines = [c for c in p.get("checkouts") or []
                 if not c.get("is_deleted") and str(c.get("item_type") or "").upper() != "COMPONENT"]
        if not p.get("is_refunded"):
            for c in lines:
                g = bucket(c)
                g["amount"] += float(c.get("net_sales") or 0)
                g["tx"].add(p["id"])
            continue
        # Catatan refund: nilai resmi = refund_amount (unik per refund_uuid; feed Moka kadang
        # mengirim refund yang sama dua kali, dan refund parsial kadang membawa baris nota penuh).
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
        if not value:
            continue
        # Bagi nilai refund ke sales type sesuai item yang benar-benar direfund.
        weights = [(c, float(c.get("net_sales") or 0) * (float(c.get("refunded_quantity") or 0) / float(c["quantity"]))
                    if c.get("quantity") else 0.0) for c in lines]
        if sum(w for _, w in weights) <= 0:
            weights = [(c, float(c.get("net_sales") or 0)) for c in lines]
        total_w = sum(w for _, w in weights)
        if total_w <= 0:
            bucket({})["amount"] -= value
            continue
        for c, w in weights:
            if w:
                bucket(c)["amount"] -= value * w / total_w
    return {t: {"amount": round(g["amount"], 2), "trx_count": len(g["tx"])} for t, g in agg.items()}


# ----------------------------------------------------------------- Supabase
class Supa:
    def __init__(self, url, key):
        self.base = url.rstrip("/") + "/rest/v1/"
        self.h = {"apikey": key, "Content-Type": "application/json"}
        if key.startswith("eyJ"):                     # kunci JWT lama boleh sebagai Bearer
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

    def insert(self, table, rows, conflict=None):
        q = f"?on_conflict={conflict}" if conflict else ""
        pref = "resolution=merge-duplicates,return=minimal" if conflict else "return=minimal"
        for i in range(0, len(rows), 500):
            http("POST", self.base + table + q, dict(self.h, Prefer=pref), rows[i:i + 500], retry_500=False)

    def rpc(self, fn, args=None):
        body, _ = http("POST", self.base + "rpc/" + fn, self.h, args or {}, timeout=600, retry_500=False)
        return body


def norm(s):
    return re.sub(r"\s+", " ", str(s or "")).upper().strip()


def find_store(name, stores, aliases):
    """Sama dengan findStore() di index.html: alias dulu, lalu nama toko, lalu tanpa spasi."""
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
def month_list():
    today = datetime.now(TZ).date()
    cutoff = today - timedelta(days=1)                # hanya hari yang sudah tutup
    spec = env("SYNC_MONTHS")
    months = []
    if spec:
        for part in [p.strip() for p in spec.split(",") if p.strip()]:
            if ".." in part:
                a, b = [x.strip() for x in part.split("..")]
                y, m = map(int, a.split("-"))
                y2, m2 = map(int, b.split("-"))
                while (y, m) <= (y2, m2):
                    months.append((y, m))
                    y, m = (y + 1, 1) if m == 12 else (y, m + 1)
            else:
                y, m = map(int, part.split("-"))
                months.append((y, m))
    else:
        months.append((cutoff.year, cutoff.month))
        if cutoff.day <= 3:
            prev = cutoff.replace(day=1) - timedelta(days=1)
            months.insert(0, (prev.year, prev.month))
    periods = []
    for y, m in sorted(set(months)):
        first = date(y, m, 1)
        last = (date(y + (m == 12), m % 12 + 1, 1) - timedelta(days=1))
        last = min(last, cutoff)
        if first > cutoff:
            log(f"  - {y}-{m:02d} dilewati: belum ada hari yang tutup")
            continue
        periods.append((y, m, first, last))
    return periods, cutoff


# -------------------------------------------------------------------- kerja
LAG_RETRY_WAIT = int(env("LAG_RETRY_WAIT", "180"))   # detik
LAG_MAX_SHARE = float(env("LAG_MAX_SHARE", "0.02"))    # selisih maks. 2% dari net


def fetch_one(moka, outlet, period):
    """Tarik satu toko-bulan. Kalau Sales Summary Moka lebih dulu memuat transaksi yang
    baru tersinkron (kasir offline), laporan item & feed transaksi Moka sering tertinggal
    beberapa menit/jam. Skrip menunggu lalu mencoba lagi; kalau masih tertinggal tetapi
    Item Sales dan Sales Type saling cocok dan selisihnya kecil, data tetap ditulis
    dengan status WARN dan akan terkoreksi otomatis pada sinkron berikutnya."""
    t0 = time.time()
    res = _fetch_once(moka, outlet, period)
    if res["status"] == "ERROR" and res.get("lag"):
        time.sleep(LAG_RETRY_WAIT)
        res = _fetch_once(moka, outlet, period)
    if res["status"] == "ERROR" and res.get("lag"):
        net = float(res["summary"].get("net_sales") or 0)
        st, it = res.get("sales_type_total"), res.get("item_total")
        consistent = st is None or it is None or abs(st - it) <= max(TOLERANCE, 0.5 * len(res.get("items") or []))
        basis = st if st is not None else it
        if consistent and basis is not None and abs(net - basis) <= LAG_MAX_SHARE * max(abs(net), 1):
            res["status"] = "WARN"
            res["errors"] = [f"Moka belum selesai memproses transaksi yang telat tersinkron: "
                             f"Summary {net:,.0f} vs detail {basis:,.0f} (selisih {net - basis:,.0f}); "
                             f"terkoreksi di sinkron berikutnya"]
    res["seconds"] = round(time.time() - t0, 1)
    return res


def _fetch_once(moka, outlet, period):
    y, m, d1, d2 = period
    oid, name = outlet["id"], outlet["name"]
    res = {"outlet": name, "outlet_id": oid, "year": y, "month": m, "start": d1.isoformat(),
           "end": d2.isoformat(), "errors": [], "status": "OK"}
    try:
        summ = moka.sales_summary(oid, d1, d2)
        res["summary"] = summ
        net = float(summ.get("net_sales") or 0)
        if "item" in PARTS:
            it = moka.item_sales(oid, d1, d2)
            rows = it.get("item_sales") or []
            res["items"] = rows
            s = sum(float(r.get("net_sales") or 0) for r in rows)
            res["item_total"] = s
            # laporan item dibulatkan per baris -> toleransi ikut jumlah baris
            if abs(s - net) > max(TOLERANCE, 0.5 * len(rows)):
                res["errors"].append(f"Item Sales {s:,.0f} != Sales Summary {net:,.0f}")
        if "sales_type" in PARTS:
            pays = moka.transactions(oid, d1, d2) if net or summ.get("number_of_transactions") else []
            st = aggregate_sales_types(pays)
            res["sales_types"] = st
            res["payments"] = len(pays)
            s = sum(v["amount"] for v in st.values())
            res["sales_type_total"] = s
            if abs(s - net) > TOLERANCE:
                res["errors"].append(f"Sales Type {s:,.0f} != Sales Summary {net:,.0f}")
    except HttpError as e:
        if e.code == 403 and "Expired" in e.body:
            res["status"] = "SKIP"
            res["errors"].append("langganan outlet Moka sudah habis")
        else:
            res["errors"].append(str(e))
    if res["errors"] and res["status"] != "SKIP":
        res["status"] = "ERROR"
        # Summary lebih besar dari detail = pola transaksi telat tersinkron
        net = float((res.get("summary") or {}).get("net_sales") or 0)
        details = [v for v in (res.get("item_total"), res.get("sales_type_total")) if v is not None]
        res["lag"] = bool(details) and all(net > v for v in details) and \
            all("!=" in e for e in res["errors"])
    return res


def write_one(db, res, store_id, known_types, stamp):
    y, m = res["year"], res["month"]
    key = f"store_id=eq.{store_id}&year=eq.{y}&month=eq.{m}"
    period_note = f"{res['start']} s.d. {res['end']}"
    src = f"MOKA API {stamp}"
    if "sales_type" in PARTS and "sales_types" in res:
        rows = [{"store_id": store_id, "year": y, "month": m, "sales_type": t, "trx_count": v["trx_count"],
                 "amount": v["amount"], "source_file": src} for t, v in sorted(res["sales_types"].items())]
        unmapped = [r["sales_type"] for r in rows if norm(r["sales_type"]) not in known_types]
        db.delete("sales_type_raw", key)
        if rows:
            db.insert("sales_type_raw", rows, "store_id,year,month,sales_type")
        db.insert("ingest_log", [{
            "kind": "SALES_TYPE", "file_name": src, "store_id": store_id, "year": y, "month": m,
            "rows_total": len(rows), "rows_mapped": len(rows) - len(unmapped), "rows_unmapped": len(unmapped),
            "total_amount": res["sales_type_total"], "status": "OK",
            "message": f"Moka {period_note}" + (f"; {res['errors'][0]}" if res.get("status") == "WARN" else "") + (f"; belum termapping: {', '.join(unmapped[:8])}" if unmapped else "")}])
        res["unmapped"] = unmapped
    if "item" in PARTS and "items" in res:
        rows = [{"store_id": store_id, "year": y, "month": m, "item_name": (r.get("name") or "").strip(),
                 "item_variant_name": None, "category_name": (r.get("category_name") or "").strip() or None,
                 "sku": (r.get("sku") or "").strip() or None, "item_sold": r.get("item_sold") or 0,
                 "item_refunded": r.get("item_refunded") or 0, "net_sales": r.get("net_sales") or 0,
                 "source_file": src} for r in res["items"] if (r.get("name") or "").strip()]
        db.delete("item_sales", key)
        if rows:
            db.insert("item_sales", rows)
        db.insert("ingest_log", [{
            "kind": "ITEM_SALES", "file_name": src, "store_id": store_id, "year": y, "month": m,
            "rows_total": len(rows), "rows_mapped": len(rows), "rows_unmapped": 0,
            "total_amount": res["item_total"], "status": "OK"}])
    if "trx" in PARTS:
        s = res["summary"]
        row = {"store_id": store_id, "year": y, "month": m,
               "jumlah_transaksi": int(s.get("number_of_transactions") or 0),
               "nilai_transaksi": float(s.get("net_sales") or 0), "is_manual": True}
        db.insert("transaksi", [row], "store_id,year,month")
        db.insert("ingest_log", [{
            "kind": "TRANSAKSI", "file_name": src, "store_id": store_id, "year": y, "month": m,
            "rows_total": 1, "rows_mapped": 1, "rows_unmapped": 0,
            "total_amount": row["nilai_transaksi"], "status": "OK"}])


def rp(x):
    return f"Rp{x:,.0f}".replace(",", ".")


def main():
    token = env("MOKA_ACCESS_TOKEN")
    if not token:
        sys.exit("MOKA_ACCESS_TOKEN belum diisi (GitHub → Settings → Secrets and variables → Actions).")
    exp = env("MOKA_TOKEN_EXPIRES")
    if exp:
        left = (date.fromisoformat(exp) - datetime.now(TZ).date()).days
        if left <= 30:
            warn(f"Token Moka habis dalam {left} hari ({exp}). Buat token baru lalu perbarui secret MOKA_ACCESS_TOKEN.")

    moka = Moka(token)
    try:
        prof, outlets = moka.outlets()
    except HttpError as e:
        if e.code == 401:
            sys.exit("Token Moka ditolak (401): kemungkinan sudah kedaluwarsa atau dicabut.")
        raise
    only = {norm(x) for x in env("ONLY_OUTLETS").split(",") if x.strip()}
    if only:
        outlets = [o for o in outlets if norm(o["name"]) in only]
    log(f"Moka: {prof.get('business_name')} — {len(outlets)} outlet")

    db, stores, aliases, known_types = None, [], [], set()
    supa_key = env("SUPABASE_KEY")
    if supa_key:
        db = Supa(env("SUPABASE_URL", DEFAULT_SUPABASE_URL), supa_key)
        stores = db.sel("stores?select=id,name,is_active")
        aliases = db.sel("store_aliases?select=alias,store_id")
        known_types = {norm(r["sales_type"]) for r in db.sel("sales_type_map?select=sales_type")}
    elif not DRY_RUN:
        sys.exit("SUPABASE_KEY belum diisi. Isi secret SUPABASE_SERVICE_KEY, atau jalankan dengan DRY_RUN=1.")

    mapped = []
    for o in outlets:
        sid = find_store(o["name"], stores, aliases) if db else None
        if db and sid is None:
            log(f"  - {o['name']}: belum ada di daftar toko/alias dashboard → dilewati")
            continue
        mapped.append((o, sid))

    periods, cutoff = month_list()
    log(f"Periode: {', '.join(f'{y}-{m:02d} ({a.day}–{b.day})' for y, m, a, b in periods) or '-'}"
        f" · data sampai {cutoff.isoformat()} · {'DRY RUN' if DRY_RUN else 'TULIS KE SUPABASE'}")
    jobs = [(o, sid, p) for p in periods for o, sid in mapped]
    results = []
    stamp = datetime.now(TZ).strftime("%Y-%m-%d %H:%M")
    with ThreadPoolExecutor(WORKERS) as ex:
        futs = {ex.submit(fetch_one, moka, o, p): (o, sid) for o, sid, p in jobs}
        for f in as_completed(futs):
            o, sid = futs[f]
            res = f.result()
            res["store_id"] = sid
            if res["status"] in ("OK", "WARN") and db and not DRY_RUN:
                try:
                    write_one(db, res, sid, known_types, stamp)
                except HttpError as e:
                    res["status"] = "ERROR"
                    res["errors"].append("tulis Supabase: " + str(e))
            if res["status"] == "ERROR" and db and not DRY_RUN:
                try:
                    db.insert("ingest_log", [{"kind": "SALES_TYPE", "file_name": f"MOKA API {stamp}", "store_id": sid,
                                              "year": res["year"], "month": res["month"], "rows_total": 0,
                                              "rows_mapped": 0, "rows_unmapped": 0, "status": "ERROR",
                                              "message": "; ".join(res["errors"])[:500]}])
                except HttpError:
                    pass
            net = float((res.get("summary") or {}).get("net_sales") or 0)
            log(f"  {'✓' if res['status'] == 'OK' else '!' if res['status'] == 'WARN' else '·' if res['status'] == 'SKIP' else '✗'} "
                f"{res['outlet']:<26} {res['year']}-{res['month']:02d}  net {rp(net):>17}  "
                f"trx {int((res.get('summary') or {}).get('number_of_transactions') or 0):>6}  "
                f"{len(res.get('sales_types') or {}):>3} sales type  {len(res.get('items') or []):>5} item  "
                f"{res['seconds']:>6}s {'; '.join(res['errors'])}")
            results.append(res)

    if db and not DRY_RUN and "sales_type" in PARTS and any(r["status"] in ("OK", "WARN") for r in results):
        try:
            db.rpc("rebuild_sales_actual")
            log("✓ rebuild_sales_actual selesai")
        except HttpError as e:
            warn("Sales Type tersimpan, tetapi rebuild_sales_actual gagal: " + str(e))

    if DRY_RUN:
        os.makedirs(OUT_DIR, exist_ok=True)
        slim = [{k: v for k, v in r.items() if k != "items"} | {"item_rows": len(r.get("items") or [])}
                for r in results]
        with open(os.path.join(OUT_DIR, "hasil.json"), "w", encoding="utf-8") as fh:
            json.dump(slim, fh, ensure_ascii=False, indent=1, default=str)
        log(f"Hasil uji coba disimpan di {OUT_DIR}/hasil.json")

    ok = [r for r in results if r["status"] in ("OK", "WARN")]
    bad = [r for r in results if r["status"] == "ERROR"]
    if STEP_SUMMARY:
        with open(STEP_SUMMARY, "a", encoding="utf-8") as fh:
            fh.write(f"### Sinkron Moka {'(uji coba)' if DRY_RUN else ''} — data s.d. {cutoff.isoformat()}\n\n")
            fh.write("| Toko | Bulan | Net Sales | Transaksi | Sales Type | Item | Status |\n|---|---|---:|---:|---:|---:|---|\n")
            for r in sorted(results, key=lambda r: (r["year"], r["month"], r["outlet"])):
                s = r.get("summary") or {}
                fh.write(f"| {r['outlet']} | {r['year']}-{r['month']:02d} | {rp(float(s.get('net_sales') or 0))} | "
                         f"{int(s.get('number_of_transactions') or 0):,} | {len(r.get('sales_types') or {})} | "
                         f"{len(r.get('items') or [])} | {r['status']} {'; '.join(r['errors'])} |\n")
            unm = sorted({t for r in results for t in r.get("unmapped") or []})
            if unm:
                fh.write(f"\n**Sales Type belum termapping:** {', '.join(unm)} — atur di Upload Data → Mapping.\n")
    for r in results:
        if r["status"] == "WARN":
            warn(f"{r['outlet']} {r['year']}-{r['month']:02d}: {r['errors'][0]}")
    log(f"Selesai: {len(ok)} OK, {len(bad)} gagal, {len(results) - len(ok) - len(bad)} dilewati")
    if bad:
        sys.exit(1)


if __name__ == "__main__":
    main()
