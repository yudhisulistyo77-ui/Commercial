#!/usr/bin/env python3
"""V96 · Kantor Virtual — karyawan AI terjadwal untuk Dashboard Commercial.

Gratis: berjalan di GitHub Actions, membaca Supabase dengan service key (GitHub Secrets),
menyimpan hasil kerja ke tabel commercial_office_*_v96, dan (opsional) mengirim ringkasan ke Telegram.
Tidak ada model AI berbayar; semua angka dihitung dengan aturan yang bisa diperiksa.
Karyawan AI hanya MEMBACA data & MENYIAPKAN usulan. Keputusan (mis. TF stok) menunggu ACC Manager.

Meja:
  sales  · Analis Sales      — sales kemarin & MTD vs target (prorata), toko tertinggal, MoM hari yang sama
  stock  · Admin Stok        — item laris yang stoknya menipis, usulan TF dari DC (perlu ACC Manager)
  visit  · Sekretaris Visit  — jadwal visit besok, itinerary yang belum diisi hasilnya
  sync   · Admin Sinkron     — kesehatan sinkron Moka & snapshot stok

Env: SUPABASE_URL, SUPABASE_KEY (service), TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (opsional),
     OFFICE_DESKS (auto | semua | sales,stock,... | telegram_setup | telegram_test), OFFICE_DRY=1, DASHBOARD_URL.
"""
import json, math, os, subprocess, sys, time, urllib.error, urllib.parse, urllib.request
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from html import escape

WITA = timezone(timedelta(hours=8))
NOW = datetime.now(WITA)
TODAY = date.fromisoformat(os.environ['OFFICE_TODAY']) if os.environ.get('OFFICE_TODAY') else NOW.date()  # uji / ulang tanggal tertentu
YDAY = TODAY - timedelta(days=1)
DRY = os.environ.get("OFFICE_DRY", "0").lower() in ("1", "true", "yes")
DASH = os.environ.get("DASHBOARD_URL", "https://yudhisulistyo77-ui.github.io/commercial/")
ROOT = os.path.dirname(os.path.abspath(__file__))
DESK_NAMES = {"sales": "Analis Sales", "stock": "Admin Stok", "visit": "Sekretaris Visit", "sync": "Admin Sinkron",
              "loss": "Analis Loss", "complain": "Admin Komplain", "csl": "Analis CSL", "review": "Admin Google Review", "stores": "Admin Toko"}
CACHE = {}


def log(*a):
    print(*a, flush=True)


# ------------------------------------------------------------------ HTTP / Supabase
def http(method, url, headers=None, body=None, timeout=60, tries=4):
    data = json.dumps(body).encode() if body is not None else None
    for i in range(tries):
        req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                raw = r.read().decode() or "null"
                return json.loads(raw)
        except urllib.error.HTTPError as e:
            txt = e.read().decode(errors="replace")[:400]
            if e.code >= 500 and i < tries - 1:
                time.sleep(3 * (i + 1)); continue
            raise RuntimeError(f"HTTP {e.code} {url.split('?')[0][-60:]}: {txt}")
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            if i < tries - 1:
                time.sleep(3 * (i + 1)); continue
            raise RuntimeError(f"Koneksi gagal {url.split('?')[0][-60:]}: {e}")


class Supa:
    def __init__(self):
        url, key = os.environ.get("SUPABASE_URL", "").rstrip("/"), os.environ.get("SUPABASE_KEY", "")
        if not url or not key:
            raise SystemExit("SUPABASE_URL / SUPABASE_KEY belum diisi di GitHub Secrets.")
        if key.startswith("sb_publishable_"):
            raise SystemExit("SUPABASE_KEY harus service/secret key, bukan publishable key.")
        self.base = (url if url.endswith("/rest/v1") else url + "/rest/v1") + "/"
        self.h = {"apikey": key, "Content-Type": "application/json"}
        if key.startswith("eyJ"):
            self.h["Authorization"] = "Bearer " + key

    def sel(self, path):
        out, start = [], 0
        while True:
            rows = http("GET", self.base + path, dict(self.h, Range=f"{start}-{start + 999}", **{"Range-Unit": "items"}))
            out.extend(rows or [])
            if not rows or len(rows) < 1000:
                return out
            start += len(rows)

    def insert(self, table, rows, prefer="return=representation", conflict=None):
        if DRY:
            log(f"  [uji] tidak menulis {table}: {len(rows)} baris"); return rows
        q = f"?on_conflict={conflict}" if conflict else ""
        return http("POST", self.base + table + q, dict(self.h, Prefer=prefer), rows)

    def rpc(self, fn, args):
        return http("POST", self.base + "rpc/" + fn, self.h, args, timeout=120)

    def patch(self, table, query, body):
        if DRY:
            log(f"  [uji] tidak mengubah {table}?{query}"); return []
        return http("PATCH", f"{self.base}{table}?{query}", dict(self.h, Prefer="return=minimal"), body)


# ------------------------------------------------------------------ format
def rp(v):
    v = float(v or 0)
    if abs(v) >= 1e9:
        return f"Rp {v / 1e9:,.2f} M".replace(",", "#").replace(".", ",").replace("#", ".")
    if abs(v) >= 1e6:
        return f"Rp {v / 1e6:,.1f} jt".replace(",", "#").replace(".", ",").replace("#", ".")
    return "Rp " + f"{v:,.0f}".replace(",", ".")


def pct(v):
    return "—" if v is None else f"{v * 100:,.0f}%".replace(",", ".")


def num(v):
    return f"{float(v or 0):,.0f}".replace(",", ".")


HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]


def tgl(d):
    d = d if isinstance(d, date) else date.fromisoformat(str(d)[:10])
    return f"{HARI[d.weekday()]} {d.day} {BULAN[d.month - 1]} {d.year}"


# ------------------------------------------------------------------ meja: Analis Sales
def desk_sales(db):
    stores = {s["id"]: s["name"] for s in db.sel("stores?select=id,name,is_active") if s.get("is_active") is not False}
    d2 = YDAY
    d1 = d2.replace(day=1)
    pm_end = d1 - timedelta(days=1)
    p1 = pm_end.replace(day=1)
    p2 = min(p1 + (d2 - d1), pm_end)
    rows = db.sel(f"moka_sales_type_daily?select=store_id,sale_date,amount&sale_date=gte.{p1}&sale_date=lte.{d2}")
    cur, prev, yday = defaultdict(float), defaultdict(float), defaultdict(float)
    for r in rows:
        sid, sd, amt = r["store_id"], date.fromisoformat(r["sale_date"]), float(r["amount"] or 0)
        if sid not in stores:
            continue
        if d1 <= sd <= d2:
            cur[sid] += amt
            if sd == d2:
                yday[sid] += amt
        elif p1 <= sd <= p2:
            prev[sid] += amt
    tg = {t["store_id"]: float(t.get("target_total") or 0)
          for t in db.sel(f"targets?select=store_id,target_total&year=eq.{d2.year}&month=eq.{d2.month}")}
    dim = (date(d2.year + (d2.month == 12), d2.month % 12 + 1, 1) - timedelta(days=1)).day
    frac = d2.day / dim
    table = []
    for sid, name in sorted(stores.items(), key=lambda x: -cur.get(x[0], 0)):
        if not cur.get(sid) and not tg.get(sid) and not prev.get(sid):
            continue
        t = tg.get(sid, 0)
        table.append({"store_id": sid, "store": name, "kemarin": round(yday.get(sid, 0)),
                      "target_harian": round(t / dim) if t else None,
                      "ach_kemarin": (yday.get(sid, 0) / (t / dim)) if t else None,
                      "mtd": round(cur.get(sid, 0)), "target_mtd": round(t * frac) if t else None,
                      "ach_mtd": (cur.get(sid, 0) / (t * frac)) if t else None,
                      "prev_mtd": round(prev.get(sid, 0)),
                      "mom": (cur.get(sid, 0) / prev[sid] - 1) if prev.get(sid) else None})
    tot = lambda k: sum(r[k] or 0 for r in table)
    t_all = sum(tg.get(r["store_id"], 0) for r in table)
    ach_y = tot("kemarin") / (t_all / dim) if t_all else None
    ach_m = tot("mtd") / (t_all * frac) if t_all else None
    mom = tot("mtd") / tot("prev_mtd") - 1 if tot("prev_mtd") else None
    behind = sorted([r for r in table if r["ach_mtd"] is not None and r["ach_mtd"] < 0.9], key=lambda r: r["ach_mtd"])
    low_y = sorted([r for r in table if r["ach_kemarin"] is not None and r["ach_kemarin"] < 0.8], key=lambda r: r["ach_kemarin"])
    status = "ok" if not behind else "warn"
    summary = (f"Kemarin {rp(tot('kemarin'))} ({pct(ach_y)} target harian). MTD {rp(tot('mtd'))} = {pct(ach_m)} target s.d. tgl {d2.day}"
               + (f", MoM {'+' if mom >= 0 else ''}{pct(mom)}" if mom is not None else "") + ". "
               + (f"{len(behind)} toko di bawah 90% MTD: " + ", ".join(f"{r['store']} {pct(r['ach_mtd'])}" for r in behind[:4]) + "."
                  if behind else "Semua toko ≥ 90% target MTD."))
    tg_lines = [f"<b>Briefing pagi · {escape(tgl(TODAY))}</b>",
                f"Sales kemarin ({d2.day} {BULAN[d2.month - 1]}): <b>{rp(tot('kemarin'))}</b> · {pct(ach_y)} target harian",
                f"MTD s.d. {d2.day} {BULAN[d2.month - 1]}: <b>{rp(tot('mtd'))}</b> · {pct(ach_m)} target prorata"
                + (f" · MoM {'+' if mom >= 0 else ''}{pct(mom)}" if mom is not None else "")]
    if behind:
        tg_lines.append("\n<b>Di bawah 90% target MTD</b>")
        tg_lines += [f"• {escape(r['store'])}: {pct(r['ach_mtd'])} ({rp(r['mtd'])} / {rp(r['target_mtd'])})" for r in behind[:8]]
    if low_y:
        tg_lines.append("\n<b>Kemarin di bawah 80% target harian</b>")
        tg_lines += [f"• {escape(r['store'])}: {pct(r['ach_kemarin'])}" for r in low_y[:8]]
    return {"status": status, "period": str(d2), "title": f"Briefing sales {tgl(d2)}", "summary": summary,
            "body": {"source": "moka_sales_type_daily (net sales Moka) × targets (prorata hari kalender)",
                     "cur": [str(d1), str(d2)], "prev": [str(p1), str(p2)], "days_in_month": dim,
                     "total": {"kemarin": tot("kemarin"), "mtd": tot("mtd"), "prev_mtd": tot("prev_mtd"), "target_month": t_all,
                               "ach_kemarin": ach_y, "ach_mtd": ach_m, "mom": mom},
                     "rows": table},
            "telegram": "\n".join(tg_lines)}


# ------------------------------------------------------------------ meja: Admin Stok
COVER_DAYS = float(os.environ.get("OFFICE_STOCK_COVER", "7"))      # stok < 7 hari jual = menipis
TARGET_DAYS = float(os.environ.get("OFFICE_STOCK_TARGET", "21"))   # usulan TF memenuhi 21 hari jual


def dc_ids(db, stores):
    raw = db.sel("app_settings?select=value&key=eq.stock_v84_dc")
    if raw:
        try:
            return {int(x) for x in json.loads(raw[0]["value"])}
        except Exception:
            pass
    import re
    return {s["id"] for s in stores if re.search(r"(^|[^A-Z])(DC|GUDANG|WAREHOUSE)([^A-Z]|$)", s["name"].upper())}


def desk_stock(db):
    stores = [s for s in db.sel("stores?select=id,name,is_active") if s.get("is_active") is not False]
    names = {s["id"]: s["name"] for s in stores}
    dcs = dc_ids(db, stores)
    meta = {r["store_id"]: r for r in db.sel("stock_v84_store?select=store_id,gen,snapshot_at,demand_through,status")}
    if not meta:
        return {"status": "idle", "title": "Belum ada snapshot stok", "summary": "Jalankan sinkron stok terlebih dahulu.", "body": {}}
    snap = {}
    for sid, m in meta.items():
        if sid not in names:
            continue
        q = f"stock_v84_snap?select=sku,qty,cogs,sold14,sold30&store_id=eq.{sid}&gen=eq.{m['gen']}"
        q += "" if sid in dcs else "&sold14=gt.0"
        snap[sid] = {r["sku"]: r for r in db.sel(q)}
    dc_stock = defaultdict(float)
    dc_cogs = {}
    for sid in dcs:
        for sku, r in snap.get(sid, {}).items():
            if float(r["qty"] or 0) > 0:
                dc_stock[sku] += float(r["qty"])
                dc_cogs[sku] = float(r.get("cogs") or 0)
    need = []
    for sid, rows in snap.items():
        if sid in dcs:
            continue
        for sku, r in rows.items():
            rate = float(r["sold14"] or 0) / 14
            if rate <= 0:
                continue
            qty = max(float(r["qty"] or 0), 0)
            cover = qty / rate
            if cover < COVER_DAYS:
                need.append({"store_id": sid, "sku": sku, "qty": qty, "rate": rate, "cover": cover,
                             "want": math.ceil(rate * TARGET_DAYS - qty), "cogs": float(r.get("cogs") or 0)})
    need.sort(key=lambda x: (x["cover"], -x["rate"]))
    skus = sorted({n["sku"] for n in need})
    items = {}
    for i in range(0, len(skus), 120):
        part = ",".join('"' + s.replace('"', '') + '"' for s in skus[i:i + 120])
        for r in db.sel("stock_v84_item?select=sku,item_name,category&sku=in.(" + urllib.parse.quote(part, safe=',"') + ")"):
            items[r["sku"]] = r
    # Kemasan (PLASTIK, dll.) bukan barang dagangan — sama dengan pengaturan "kategori dikecualikan" di dashboard.
    ex = db.sel("app_settings?select=value&key=eq.item_exclude_categories")
    terms = [t.strip().upper() for t in ((ex[0]["value"] if ex else None) or "PLASTIK").split(",") if t.strip()]
    skip = lambda sku: any(t in str((items.get(sku) or {}).get("category") or "").upper() for t in terms)
    need = [n for n in need if not skip(n["sku"])]
    left = dict(dc_stock)
    tf = []
    for n in need:
        give = min(n["want"], int(left.get(n["sku"], 0)))
        if give > 0:
            left[n["sku"]] -= give
            tf.append({**n, "tf": give})
    nm = lambda s: (items.get(s) or {}).get("item_name") or s
    tf_rows = [{"store": names.get(t["store_id"], t["store_id"]), "store_id": t["store_id"], "sku": t["sku"], "item": nm(t["sku"]),
                "stok": t["qty"], "laku_per_hari": round(t["rate"], 2), "cukup_hari": round(t["cover"], 1), "tf": t["tf"],
                "nilai": round(t["tf"] * (t["cogs"] or dc_cogs.get(t["sku"], 0)))} for t in tf]
    no_dc = [n for n in need if not dc_stock.get(n["sku"])]
    empty = [n for n in need if n["qty"] <= 0]
    value = sum(r["nilai"] for r in tf_rows)
    per_store = defaultdict(lambda: {"item": 0, "pcs": 0})
    for r in tf_rows:
        per_store[r["store"]]["item"] += 1
        per_store[r["store"]]["pcs"] += r["tf"]
    snap_at = max((m.get("snapshot_at") or "") for m in meta.values())
    summary = (f"{len(need)} item laris stoknya < {COVER_DAYS:.0f} hari jual ({len(empty)} sudah kosong). "
               f"Usulan TF dari DC: {len(tf_rows)} item, {num(sum(r['tf'] for r in tf_rows))} pcs ke {len(per_store)} toko"
               + (f", nilai HPP {rp(value)}" if value else "") + f". {len(no_dc)} item tidak tersedia di DC.")
    task = None
    if tf_rows:
        task = {"desk": "stock", "kind": "tf", "dedupe": f"tf-{TODAY}", "value": value,
                "title": f"Usulan TF DC {tgl(TODAY)}: {len(tf_rows)} item, {num(sum(r['tf'] for r in tf_rows))} pcs ke {len(per_store)} toko",
                "detail": {"rows": tf_rows, "per_store": per_store, "rule": f"stok < {COVER_DAYS:.0f} hari jual (rata-rata 14 hari), isi sampai {TARGET_DAYS:.0f} hari, dibatasi stok DC",
                           "snapshot_at": snap_at}}
    tg = [f"<b>Admin Stok · {escape(tgl(TODAY))}</b>", escape(summary)]
    if per_store:
        tg.append("\n<b>Usulan TF (menunggu ACC Manager)</b>")
        tg += [f"• {escape(s)}: {v['item']} item / {num(v['pcs'])} pcs" for s, v in sorted(per_store.items(), key=lambda x: -x[1]["pcs"])[:10]]
    return {"status": "warn" if empty else "ok", "period": str(TODAY), "title": f"Stok & usulan TF {tgl(TODAY)}", "summary": summary,
            "body": {"rule": {"cover_days": COVER_DAYS, "target_days": TARGET_DAYS, "rate": "sold14 / 14"}, "snapshot_at": snap_at,
                     "by_store": {str(sid): {"thin": sum(1 for n in need if n["store_id"] == sid), "empty": sum(1 for n in need if n["store_id"] == sid and n["qty"] <= 0),
                                             "tf_item": sum(1 for t in tf if t["store_id"] == sid), "tf_pcs": sum(t["tf"] for t in tf if t["store_id"] == sid)}
                                  for sid in {n["store_id"] for n in need}},
                     "dc": [names.get(i, i) for i in dcs], "tf": tf_rows[:500], "tf_total": len(tf_rows),
                     "thin": [{"store": names.get(n["store_id"]), "item": nm(n["sku"]), "sku": n["sku"], "stok": n["qty"],
                               "laku_per_hari": round(n["rate"], 2), "cukup_hari": round(n["cover"], 1), "dc": dc_stock.get(n["sku"], 0)}
                              for n in need[:300]]},
            "telegram": "\n".join(tg), "task": task}


# ------------------------------------------------------------------ meja: Sekretaris Visit
def desk_visit(db):
    raw = db.sel("app_settings?select=value&key=eq.visit_plan_v87")
    value = raw[0]["value"] if raw else "null"
    out = subprocess.run(["node", os.path.join(ROOT, "scripts", "office_visit.cjs")], input=value or "null",
                         capture_output=True, text=True, cwd=ROOT, timeout=120)
    if out.returncode:
        raise RuntimeError("Rencana visit tidak terbaca: " + out.stderr[-300:])
    plan = json.loads(out.stdout)
    tmr = TODAY + timedelta(days=1)
    sched_t = [r for r in plan["sched"] if r["date"] == str(tmr) and r.get("status", "Planned") not in ("Cancelled",)]
    itin_t = [r for r in plan["itinerary"] if r["date"] == str(tmr)]
    overdue = [r for r in plan["sched"] if r["date"] and r["date"] < str(TODAY) and r.get("status", "Planned") == "Planned"]
    upcoming = sorted([r for r in plan["sched"] if r["date"] and r["date"] > str(tmr)], key=lambda r: r["date"])[:5]
    trips_soon = [t for t in plan["trips"] if t["start"] and str(TODAY) <= t["start"] <= str(TODAY + timedelta(days=14))]
    by_spv = defaultdict(int)
    for r in overdue:
        by_spv[r.get("spv") or "-"] += 1
    if sched_t:
        summary = f"Besok ({tgl(tmr)}): {len(sched_t)} jadwal visit — " + "; ".join(f"{r['spv']} → {r['cabang']} ({r['metode']})" for r in sched_t[:5]) + "."
    else:
        nxt = upcoming[0] if upcoming else None
        summary = f"Besok tidak ada jadwal visit." + (f" Jadwal berikutnya {tgl(nxt['date'])}: {nxt['spv']} → {nxt['cabang']}." if nxt else "")
    if trips_soon:
        summary += " Trip luar kota 14 hari ke depan: " + ", ".join(f"{t['code']} {t['label']} ({t['spvLabel']}, {t['start']})" for t in trips_soon) + "."
    if overdue:
        summary += f" {len(overdue)} jadwal lewat masih berstatus Planned (belum diisi hasilnya)."
    tg = [f"<b>Sekretaris Visit · {escape(tgl(TODAY))}</b>", escape(summary)]
    if sched_t:
        tg.append("\n<b>Jadwal besok</b>")
        tg += [f"• {escape(r['spv'])} → {escape(r['cabang'])} · {escape(r['metode'])}" + (f" · trip {escape(r['trip'])}" if r["trip"] else "") for r in sched_t]
    if itin_t:
        tg.append("\n<b>Itinerary besok</b>")
        tg += [f"• {escape(r['time'])} {escape(r['task'])}: {escape(r['detail'])}" for r in itin_t[:12]]
    if by_spv:
        tg.append("\n<b>Mohon isi hasil visit (Schedule Management)</b>")
        tg += [f"• {escape(k)}: {v} jadwal" for k, v in by_spv.items()]
    return {"status": "warn" if overdue else "ok", "period": str(tmr), "title": f"Agenda visit {tgl(tmr)}", "summary": summary,
            "body": {"tomorrow": sched_t, "itinerary": itin_t, "overdue": overdue[-50:], "overdue_total": len(overdue),
                     "upcoming": upcoming, "trips_soon": trips_soon, "source": "visit-plan-v86.js + app_settings.visit_plan_v87"},
            "telegram": "\n".join(tg)}


# ------------------------------------------------------------------ meja: Admin Sinkron
def desk_sync(db):
    stores = {s["id"]: s["name"] for s in db.sel("stores?select=id,name,is_active") if s.get("is_active") is not False}
    runs = db.sel("moka_sync_runs?select=id,mode,status,message,data_until,stores_ok,stores_warn,stores_error,finished_at&order=requested_at.desc&limit=8")
    cov = db.sel(f"moka_sync_coverage?select=store_id,sale_date&sale_date=gte.{TODAY - timedelta(days=10)}")
    last = defaultdict(str)
    for r in cov:
        last[r["store_id"]] = max(last[r["store_id"]], r["sale_date"])
    synced = {sid for sid in last}
    late = [(stores[s], d) for s, d in last.items() if s in stores and d < str(YDAY)]
    stock = db.sel("stock_v84_store?select=store_id,snapshot_at,status")
    stock_old = [stores.get(r["store_id"], r["store_id"]) for r in stock
                 if r.get("snapshot_at") and datetime.fromisoformat(r["snapshot_at"].replace("Z", "+00:00")) < NOW - timedelta(hours=48)]
    lr = next((r for r in runs if r["status"] in ("done", "warn", "error", "failed")), None)
    bad = lr and (lr["status"] not in ("done",) or (lr.get("stores_error") or 0) > 0)
    summary = (f"Sinkron Moka terakhir: {lr['status'] if lr else '—'}"
               + (f" ({lr.get('stores_ok') or 0} ok, {lr.get('stores_warn') or 0} warn, {lr.get('stores_error') or 0} gagal)" if lr else "")
               + f". {len(synced & set(stores))} toko punya data s.d. "
               + (min(d for s, d in last.items() if s in stores) if last else "—") + ". "
               + (f"Tertinggal: {', '.join(f'{n} ({d})' for n, d in late)}. " if late else "Semua toko lengkap s.d. kemarin. ")
               + (f"Snapshot stok > 2 hari: {', '.join(map(str, stock_old))}." if stock_old else "Snapshot stok terbaru."))
    tg = [f"<b>Admin Sinkron · {escape(tgl(TODAY))}</b>", escape(summary)]
    return {"status": "warn" if (bad or late or stock_old) else "ok", "period": str(YDAY), "title": f"Kesehatan data {tgl(TODAY)}",
            "summary": summary, "body": {"last_run": lr, "runs": runs, "late": late, "stock_old": stock_old,
                                         "coverage": {stores.get(s, s): d for s, d in last.items()}},
            "telegram": "\n".join(tg) if (bad or late or stock_old) else None}


# ------------------------------------------------------------------ data bersama
import re as _re


def store_list(db):
    if "stores" not in CACHE:
        CACHE["stores"] = [s for s in db.sel("stores?select=id,name,is_active") if s.get("is_active") is not False]
    return CACHE["stores"]


def physical_stores(db):
    return [s for s in store_list(db) if _re.sub(r"[^A-Z0-9]", "", s["name"].upper()) not in ("MAMUTSM", "DCTIGALAPAN", "MARKETPLACE")
            and not _re.search(r"(^|[^A-Z])(DC|GUDANG|WAREHOUSE)([^A-Z]|$)", s["name"].upper())]


def nkey(t):
    return _re.sub(r"[^A-Z0-9]", "", str(t or "").upper())


def match_store(db, sid, name):
    """Baris sheet kadang hanya punya nama toko; cocokkan ke master toko."""
    if sid:
        return int(sid)
    k = nkey(name)
    if not k:
        return None
    best = None
    for s in store_list(db):
        sk = nkey(s["name"])
        if k == sk:
            return s["id"]
        short = sk.replace("TIGALAPANKAOS", "").replace("TIGALAPAN", "")
        if short and (short in k or k in sk) and (best is None or len(sk) > len(best[1])):
            best = (s["id"], sk)
    return best[0] if best else None


def sheet_rows(db, kind, d1, d2):
    key = (kind, str(d1), str(d2))
    if key not in CACHE:
        try:
            rows = db.rpc("commercial_office_sheet_v99", {"p_kind": kind, "p_from": str(d1), "p_to": str(d2)}) or []
        except RuntimeError as e:
            if "PGRST202" in str(e) or "Could not find" in str(e):
                raise RuntimeError("Jalankan V99.sql di Supabase (fungsi commercial_office_sheet_v99 belum ada).")
            raise
        for r in rows:
            r["sid"] = match_store(db, r.get("store_id"), r.get("store_name"))
        CACHE[key] = rows
    return CACHE[key]


def fnum(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def top(counter, n=5):
    return sorted(counter.items(), key=lambda x: -x[1])[:n]


# ------------------------------------------------------------------ meja: Analis Loss
def desk_loss(db):
    d2 = YDAY
    w1, p1, p2 = d2 - timedelta(days=6), d2 - timedelta(days=13), d2 - timedelta(days=7)
    m1 = d2.replace(day=1)
    pm2 = m1 - timedelta(days=1)
    pm1 = pm2.replace(day=1)
    pm_to = min(pm1 + (d2 - m1), pm2)
    rows = sheet_rows(db, "loss", min(p1, pm1), d2)
    names = {s["id"]: s["name"] for s in store_list(db)}
    def agg(a, b):
        sel = [r for r in rows if r.get("sale_date") and a <= date.fromisoformat(r["sale_date"][:10]) <= b]
        return sel, sum(fnum(r.get("amount")) for r in sel), sum(fnum(r.get("qty")) for r in sel)
    wk, wk_rp, wk_q = agg(w1, d2)
    pw, pw_rp, pw_q = agg(p1, p2)
    mtd, mtd_rp, mtd_q = agg(m1, d2)
    pm, pm_rp, _ = agg(pm1, pm_to)
    by_item, by_reason, by_store = defaultdict(float), defaultdict(float), defaultdict(lambda: {"rp": 0.0, "qty": 0.0, "prev_rp": 0.0})
    for r in wk:
        by_item[r.get("item") or "(tanpa nama)"] += fnum(r.get("amount"))
        by_reason[(r.get("reason") or "(tanpa alasan)").upper()] += fnum(r.get("amount"))
        if r["sid"]:
            by_store[r["sid"]]["rp"] += fnum(r.get("amount")); by_store[r["sid"]]["qty"] += fnum(r.get("qty"))
    for r in pw:
        if r["sid"]:
            by_store[r["sid"]]["prev_rp"] += fnum(r.get("amount"))
    wow = wk_rp / pw_rp - 1 if pw_rp else None
    jumps = sorted([(names.get(k, k), v) for k, v in by_store.items() if v["prev_rp"] and v["rp"] > v["prev_rp"] * 1.5 and v["rp"] - v["prev_rp"] > 500000],
                   key=lambda x: -(x[1]["rp"] - x[1]["prev_rp"]))
    if not rows:
        return {"status": "idle", "period": str(d2), "title": "Belum ada data loss", "summary": "Data Loss Sales belum tersinkron dari Google Sheet.", "body": {}}
    summary = (f"7 hari terakhir loss {rp(wk_rp)} ({num(wk_q)} pcs)" + (f", {'naik' if wow > 0 else 'turun'} {pct(abs(wow))} vs 7 hari sebelumnya" if wow is not None else "")
               + f". MTD {rp(mtd_rp)}" + (f" vs bulan lalu {rp(pm_rp)}" if pm_rp else "") + ". "
               + ("Alasan utama: " + ", ".join(f"{k.title()} {rp(v)}" for k, v in top(by_reason, 2)) + ". " if by_reason else "")
               + (f"Lonjakan: {', '.join(n for n, _ in jumps[:3])}." if jumps else ""))
    tg = [f"<b>Analis Loss · {escape(tgl(TODAY))}</b>", escape(summary)]
    if by_item:
        tg.append("\n<b>Item loss terbesar (7 hari)</b>")
        tg += [f"• {escape(k)}: {rp(v)}" for k, v in top(by_item, 5)]
    return {"status": "warn" if (jumps or (wow is not None and wow > 0.3)) else "ok", "period": str(d2), "title": f"Loss sales s.d. {tgl(d2)}", "summary": summary,
            "body": {"week": [str(w1), str(d2)], "prev_week": [str(p1), str(p2)], "total": {"week_rp": wk_rp, "week_qty": wk_q, "prev_week_rp": pw_rp, "wow": wow, "mtd_rp": mtd_rp, "mtd_qty": mtd_q, "prev_mtd_rp": pm_rp},
                     "top_items": [{"item": k, "rp": round(v)} for k, v in top(by_item, 15)], "reasons": [{"alasan": k, "rp": round(v)} for k, v in top(by_reason, 10)],
                     "by_store": {str(k): {"store": names.get(k, k), "rp": round(v["rp"]), "qty": v["qty"], "prev_rp": round(v["prev_rp"])} for k, v in by_store.items()},
                     "source": "Google Sheet Loss Sales (menu Loss Sales)"},
            "telegram": "\n".join(tg) if (jumps or (wow is not None and wow > 0.3)) else None}


# ------------------------------------------------------------------ meja: Admin Komplain
CLOSED = _re.compile(r"SELESAI|CLOSE|DONE|SOLVED|TUNTAS|BERES|FINISH", _re.I)
BREACH = _re.compile(r"LEWAT|MELEBIHI|OVER|TELAT|TERLAMBAT|TIDAK\s*SESUAI|BREACH", _re.I)


def desk_complain(db):
    d2 = YDAY
    m1 = d2.replace(day=1)
    since = d2 - timedelta(days=60)
    names = {s["id"]: s["name"] for s in store_list(db)}
    rows = []
    for kind, label in (("service", "Pelayanan"), ("product", "Produk")):
        try:
            for r in sheet_rows(db, kind, since, d2):
                rows.append({**r, "jenis": label})
        except RuntimeError as e:
            if "V99" in str(e):
                raise
    if not rows:
        return {"status": "idle", "period": str(d2), "title": "Belum ada data komplain", "summary": "Data komplain belum tersinkron dari Google Sheet.", "body": {}}
    mtd = [r for r in rows if r.get("sale_date", "")[:10] >= str(m1)]
    open_ = [r for r in rows if not CLOSED.search(str(r.get("status") or ""))]
    breach = [r for r in rows if BREACH.search(str(r.get("sla") or ""))]
    by_store = defaultdict(lambda: {"mtd": 0, "open": 0, "breach": 0})
    for r in mtd:
        if r["sid"]: by_store[r["sid"]]["mtd"] += 1
    for r in open_:
        if r["sid"]: by_store[r["sid"]]["open"] += 1
    for r in breach:
        if r["sid"] and r.get("sale_date", "")[:10] >= str(m1): by_store[r["sid"]]["breach"] += 1
    cats = defaultdict(int)
    for r in mtd:
        cats[(r.get("category") or r.get("reason") or "(tanpa kategori)").strip().title()] += 1
    summary = (f"Bulan ini {len(mtd)} komplain ({sum(1 for r in mtd if r['jenis'] == 'Pelayanan')} pelayanan, {sum(1 for r in mtd if r['jenis'] == 'Produk')} produk). "
               f"{len(open_)} belum selesai (60 hari terakhir), {sum(v['breach'] for v in by_store.values())} melewati SLA bulan ini. "
               + ("Terbanyak: " + ", ".join(f"{k} ({v})" for k, v in top(cats, 3)) + "." if cats else ""))
    oldest = sorted(open_, key=lambda r: r.get("sale_date") or "")[:30]
    tg = [f"<b>Admin Komplain · {escape(tgl(TODAY))}</b>", escape(summary)]
    if oldest:
        tg.append("\n<b>Belum selesai (terlama)</b>")
        tg += [f"• {escape(r.get('sale_date', '')[:10])} {escape(names.get(r['sid'], r.get('store_name') or '-'))}: {escape((r.get('category') or r.get('reason') or r.get('item') or '')[:60])}" for r in oldest[:6]]
    return {"status": "warn" if open_ else "ok", "period": str(d2), "title": f"Komplain {tgl(d2)}", "summary": summary,
            "body": {"open": [{"tanggal": r.get("sale_date", "")[:10], "jenis": r["jenis"], "toko": names.get(r["sid"], r.get("store_name")), "kategori": r.get("category"),
                               "alasan": r.get("reason"), "status": r.get("status"), "sla": r.get("sla")} for r in oldest],
                     "open_total": len(open_), "mtd_total": len(mtd), "categories": [{"kategori": k, "jumlah": v} for k, v in top(cats, 10)],
                     "by_store": {str(k): {"store": names.get(k, k), **v} for k, v in by_store.items()},
                     "rule": "Selesai bila kolom status berisi SELESAI/CLOSE/DONE; melewati SLA bila kolom SLA berisi LEWAT/MELEBIHI/TELAT",
                     "source": "Google Sheet Komplain pelayanan & produk (menu Komplain)"},
            "telegram": "\n".join(tg) if open_ else None}


# ------------------------------------------------------------------ meja: Analis CSL
CSL_MIN = float(os.environ.get("OFFICE_CSL_MIN", "4.0"))


def desk_csl(db):
    d2 = YDAY
    m1 = d2.replace(day=1)
    pm2 = m1 - timedelta(days=1)
    pm1 = pm2.replace(day=1)
    rows = sheet_rows(db, "csl", pm1, d2)
    names = {s["id"]: s["name"] for s in store_list(db)}
    if not rows:
        return {"status": "idle", "period": str(d2), "title": "Belum ada data CSL", "summary": "Data CSL belum tersinkron dari Google Sheet.", "body": {}}
    def avg(sel, f):
        v = [fnum(r.get(f)) for r in sel if r.get(f) not in (None, "")]
        return (sum(v) / len(v), len(v)) if v else (None, 0)
    cur = [r for r in rows if r.get("sale_date", "")[:10] >= str(m1)]
    prev = [r for r in rows if r.get("sale_date", "")[:10] < str(m1)]
    by_store = {}
    for sid in {r["sid"] for r in cur if r["sid"]}:
        sel = [r for r in cur if r["sid"] == sid]
        on, non = avg(sel, "online"); off, noff = avg(sel, "offline")
        pon, _ = avg([r for r in prev if r["sid"] == sid], "offline")
        by_store[str(sid)] = {"store": names.get(sid, sid), "responden": len(sel), "online": on, "offline": off, "offline_prev": pon}
    on, _ = avg(cur, "online"); off, _ = avg(cur, "offline")
    low = sorted([v for v in by_store.values() if (v["offline"] is not None and round(v["offline"], 2) < CSL_MIN) or (v["online"] is not None and round(v["online"], 2) < CSL_MIN)],
                 key=lambda v: min(x for x in (v["online"], v["offline"]) if x is not None))
    f2 = lambda v: "—" if v is None else f"{v:.2f}".replace(".", ",")
    summary = (f"Bulan ini {len(cur)} responden CSL. Rata-rata pelayanan offline {f2(off)}, online {f2(on)} (skala 1–5). "
               + (f"Di bawah {f2(CSL_MIN)}: " + ", ".join(v['store'] + ' ' + " / ".join(f"{lbl} {f2(v[k])}" for k, lbl in (("offline", "offline"), ("online", "online")) if v[k] is not None and round(v[k], 2) < CSL_MIN) for v in low[:4]) + "."
                  if low else f"Semua toko ≥ {f2(CSL_MIN)}."))
    return {"status": "warn" if low else "ok", "period": str(d2), "title": f"CSL {BULAN[d2.month - 1]} {d2.year}", "summary": summary,
            "body": {"avg": {"online": on, "offline": off}, "responden": len(cur), "min": CSL_MIN, "by_store": by_store, "source": "Google Form CSL (menu CSL)"},
            "telegram": f"<b>Analis CSL · {escape(tgl(TODAY))}</b>\n{escape(summary)}" if low else None}


# ------------------------------------------------------------------ meja: Admin Google Review
def desk_review(db):
    d2 = YDAY
    per = f"{d2.year}-{d2.month:02d}"
    days = db.sel(f"app_settings?select=key,value&key=like.google_review_v1_day_*_{per}-*")
    conf = db.sel(f"app_settings?select=key,value&key=like.google_review_v1_month_*_{per}")
    names = {s["id"]: s["name"] for s in store_list(db)}
    stores = {s["id"]: s["name"] for s in physical_stores(db)}
    def js(v):
        try:
            return json.loads(v) if isinstance(v, str) else (v or {})
        except Exception:
            return {}
    cfg = {}
    for r in conf:
        m = _re.match(r"google_review_v1_month_(\d+)_", r["key"])
        if m:
            cfg[int(m.group(1))] = js(r["value"])
    daily = defaultdict(list)
    for r in days:
        m = _re.match(r"google_review_v1_day_(\d+)_(\d{4}-\d{2}-\d{2})$", r["key"])
        if m:
            daily[int(m.group(1))].append({**js(r["value"]), "date": m.group(2)})
    dim = (date(d2.year + (d2.month == 12), d2.month % 12 + 1, 1) - timedelta(days=1)).day
    by_store = {}
    for sid, name in stores.items():
        rows = sorted(daily.get(sid, []), key=lambda r: r["date"])
        c = cfg.get(sid, {})
        prev = c.get("baseline")
        prev = fnum(prev) if prev not in (None, "") else None
        actual = 0.0
        for r in rows:
            if r.get("input_mode") == "total" and r.get("total_reviews") not in (None, ""):
                t = fnum(r["total_reviews"])
                if prev is not None:
                    actual += t - prev
                prev = t
            else:
                actual += fnum(r.get("reviews"))
                prev = None if prev is None else prev + fnum(r.get("reviews"))
        target = fnum(c.get("target")) if c.get("target") not in (None, "") else None
        rating = next((fnum(r["rating"]) for r in reversed(rows) if r.get("rating") not in (None, "")), None)
        last = rows[-1]["date"] if rows else None
        by_store[str(sid)] = {"store": name, "actual": actual, "target": target, "pace": (target * d2.day / dim) if target else None,
                              "ach_pace": (actual / (target * d2.day / dim)) if target else None, "rating": rating, "last_input": last,
                              "missing_yday": last != str(d2)}
    behind = [v for v in by_store.values() if v["ach_pace"] is not None and v["ach_pace"] < 0.9]
    missing = [v for v in by_store.values() if v["missing_yday"]]
    tot_a = sum(v["actual"] for v in by_store.values())
    tot_t = sum(v["target"] or 0 for v in by_store.values())
    summary = (f"Review baru bulan ini {num(tot_a)}" + (f" dari target {num(tot_t)} ({pct(tot_a / tot_t)})" if tot_t else "") + ". "
               + (f"{len(behind)} toko di bawah pace target: " + ", ".join(f"{v['store']} {pct(v['ach_pace'])}" for v in behind[:4]) + ". " if behind else "")
               + (f"{len(missing)} toko belum input kemarin." if missing else "Semua toko sudah input kemarin."))
    return {"status": "warn" if (behind or missing) else "ok", "period": str(d2), "title": f"Google Review {BULAN[d2.month - 1]} {d2.year}", "summary": summary,
            "body": {"by_store": by_store, "total": {"actual": tot_a, "target": tot_t}, "source": "Input harian menu Google Review"},
            "telegram": f"<b>Admin Google Review · {escape(tgl(TODAY))}</b>\n{escape(summary)}" if (behind or missing) else None}


# ------------------------------------------------------------------ meja: Admin per toko
def short_name(n):
    n = str(n).upper().replace("TIGALAPANKAOS", "TK").replace("TIGALAPAN KAOS", "TK")
    return n.title().replace("Tk ", "TK ").replace("Btp", "BTP")


def desk_stores(db):
    parts = {}
    for key in ("sales", "stock", "loss", "complain", "csl", "review"):
        if key not in CACHE:
            try:
                CACHE[key] = DESKS[key](db)
            except Exception as e:
                CACHE[key] = {"status": "error", "body": {}, "summary": str(e)}
        parts[key] = CACHE[key].get("body") or {}
    sales = {str(r["store_id"]): r for r in parts["sales"].get("rows", [])}
    reports, lines = [], []
    f2 = lambda v: "—" if v is None else f"{v:.2f}".replace(".", ",")
    for s in physical_stores(db):
        k = str(s["id"])
        sa, st = sales.get(k, {}), parts["stock"].get("by_store", {}).get(k, {})
        lo, co = parts["loss"].get("by_store", {}).get(k, {}), parts["complain"].get("by_store", {}).get(k, {})
        cs, rv = parts["csl"].get("by_store", {}).get(k, {}), parts["review"].get("by_store", {}).get(k, {})
        issues = []
        if sa.get("ach_mtd") is not None and sa["ach_mtd"] < 0.9: issues.append(f"sales MTD {pct(sa['ach_mtd'])} target")
        if st.get("empty"): issues.append(f"{st['empty']} item laris kosong")
        if co.get("open"): issues.append(f"{co['open']} komplain belum selesai")
        csl_v = cs.get("offline") if cs.get("offline") is not None else cs.get("online")
        if csl_v is not None and round(csl_v, 2) < CSL_MIN: issues.append(f"CSL {f2(csl_v)}")
        if rv.get("ach_pace") is not None and rv["ach_pace"] < 0.9: issues.append(f"review {pct(rv['ach_pace'])} pace")
        if rv.get("missing_yday"): issues.append("review kemarin belum diinput")
        if lo.get("prev_rp") and lo.get("rp", 0) > lo["prev_rp"] * 1.5 and lo["rp"] - lo["prev_rp"] > 500000: issues.append("loss naik tajam")
        facts = [f"Sales kemarin {rp(sa.get('kemarin'))}, MTD {rp(sa.get('mtd'))} ({pct(sa.get('ach_mtd'))} target"
                 + (f", MoM {'+' if sa['mom'] >= 0 else ''}{pct(sa['mom'])}" if sa.get("mom") is not None else "") + ")" if sa else "Belum ada data sales",
                 f"stok tipis {st.get('thin', 0)} item" + (f", usulan TF {st.get('tf_item', 0)} item/{num(st.get('tf_pcs', 0))} pcs" if st.get("tf_item") else ""),
                 f"loss 7 hari {rp(lo.get('rp', 0))}", f"komplain bulan ini {co.get('mtd', 0)}" + (f" ({co['open']} terbuka)" if co.get("open") else ""),
                 f"CSL {f2(csl_v)} ({cs.get('responden', 0)} responden)" if cs else "CSL belum ada responden",
                 (f"review {num(rv.get('actual'))}/{num(rv.get('target'))}" if rv.get("target") else f"review {num(rv.get('actual', 0))}") + (f", rating {f2(rv['rating'])}" if rv.get("rating") else "")]
        summary = ("Perlu perhatian: " + "; ".join(issues) + ". " if issues else "Semua indikator aman. ") + "; ".join(facts) + "."
        reports.append({"desk": f"store-{s['id']}", "status": "warn" if issues else "ok", "period": str(YDAY), "title": f"Admin {short_name(s['name'])} · {tgl(YDAY)}",
                        "summary": summary, "body": {"store_id": s["id"], "store": s["name"], "issues": issues, "sales": sa, "stock": st, "loss": lo, "complain": co, "csl": cs, "review": rv,
                                                     "ach_mtd": sa.get("ach_mtd")}})
        lines.append(f"{'⚠️' if issues else '✅'} <b>{escape(short_name(s['name']))}</b>: " + (escape("; ".join(issues)) if issues else f"MTD {pct(sa.get('ach_mtd'))}"))
    warn = sum(1 for r in reports if r["status"] == "warn")
    return {"multi": reports, "status": "warn" if warn else "ok", "period": str(YDAY), "title": f"Admin Toko {tgl(YDAY)}",
            "summary": f"{len(reports)} toko dianalisa, {warn} perlu perhatian.",
            "telegram": f"<b>Admin Toko · {escape(tgl(TODAY))}</b>\n" + "\n".join(lines)}


DESKS = {"sales": desk_sales, "stock": desk_stock, "visit": desk_visit, "sync": desk_sync,
         "loss": desk_loss, "complain": desk_complain, "csl": desk_csl, "review": desk_review, "stores": desk_stores}


# ------------------------------------------------------------------ Telegram
def tg_conf():
    return os.environ.get("TELEGRAM_BOT_TOKEN", "").strip(), os.environ.get("TELEGRAM_CHAT_ID", "").strip()


def tg_send(text):
    token, chat = tg_conf()
    if not token or not chat or not text:
        return False
    if DRY:
        log("  [uji] Telegram:\n" + text); return True
    chunks, cur = [], ""
    for line in text.split("\n"):
        if len(cur) + len(line) > 3800:
            chunks.append(cur); cur = ""
        cur += line + "\n"
    chunks.append(cur)
    for c in chunks:
        http("POST", f"https://api.telegram.org/bot{token}/sendMessage", {"Content-Type": "application/json"},
             {"chat_id": chat, "text": c, "parse_mode": "HTML", "disable_web_page_preview": True})
    return True


def telegram_setup():
    token, _ = tg_conf()
    if not token:
        raise SystemExit("Isi secret TELEGRAM_BOT_TOKEN dulu (dari @BotFather).")
    me = http("GET", f"https://api.telegram.org/bot{token}/getMe")
    log(f"Bot: @{me['result'].get('username')} ({me['result'].get('first_name')})")
    up = http("GET", f"https://api.telegram.org/bot{token}/getUpdates")
    chats = {}
    for u in up.get("result", []):
        for k in ("message", "my_chat_member", "channel_post"):
            c = (u.get(k) or {}).get("chat")
            if c:
                chats[c["id"]] = c.get("title") or c.get("username") or c.get("first_name")
    if not chats:
        log("Belum ada pesan. Masukkan bot ke grup, kirim pesan apa saja di grup (mis. /start), lalu jalankan lagi.")
    for cid, title in chats.items():
        log(f"CHAT ID: {cid}   ← {title}")
    log("Salin CHAT ID grup ke GitHub Secret TELEGRAM_CHAT_ID (angka grup biasanya diawali tanda minus).")


# ------------------------------------------------------------------ jalan
def pick_desks():
    sel = os.environ.get("OFFICE_DESKS", "auto").strip().lower()
    if sel in ("semua", "all"):
        return list(DESKS)
    if sel == "auto":
        return ["visit"] if NOW.hour >= 12 else ["sync", "sales", "stock", "loss", "complain", "csl", "review", "stores"]
    return [d.strip() for d in sel.split(",") if d.strip() in DESKS]


def notify_decisions(db):
    rows = db.sel("commercial_office_tasks_v96?select=id,title,status,decided_by,note&notified=eq.false&status=in.(approved,rejected)&order=decided_at.asc")
    if not rows:
        return
    txt = ["<b>Keputusan Manager</b>"] + [f"• {'✅ Disetujui' if r['status'] == 'approved' else '❌ Ditolak'}: {escape(r['title'])}"
                                         + (f" — {escape(r['decided_by'] or '')}" if r.get("decided_by") else "")
                                         + (f" ({escape(r['note'])})" if r.get("note") else "") for r in rows]
    if tg_send("\n".join(txt)) or not all(tg_conf()):
        db.patch("commercial_office_tasks_v96", "id=in.(" + ",".join(str(r["id"]) for r in rows) + ")", {"notified": True})


# ------------------------------------------------------------------ Gemini (gratis, opsional)
GEMINI_BASE = os.environ.get("GEMINI_BASE", "https://generativelanguage.googleapis.com/v1beta")


def gemini_key():
    return os.environ.get("GEMINI_API_KEY", "").strip()


def gemini_model(key):
    """Nama model Gemini sering berganti; pilih otomatis model Flash/Flash-Lite stabil yang tersedia di akun."""
    want = os.environ.get("GEMINI_MODEL", "").strip()
    if want:
        return want if want.startswith("models/") else "models/" + want
    lst = http("GET", f"{GEMINI_BASE}/models?pageSize=200", {"x-goog-api-key": key}).get("models", [])
    ok = [m["name"] for m in lst if "generateContent" in (m.get("supportedGenerationMethods") or [])]
    def rank(n):
        x = n.lower()
        bad = any(t in x for t in ("preview", "exp", "image", "tts", "audio", "live", "embedding", "thinking", "pro"))
        ver = [float(v) for v in _re.findall(r"gemini-(\d+(?:\.\d+)?)", x)] or [0]
        return (bad, 0 if "flash-lite" in x else 1 if "flash" in x else 2, -ver[0], len(x))
    cand = sorted([n for n in ok if "gemini" in n.lower()], key=rank)
    if not cand:
        raise RuntimeError("Tidak ada model Gemini yang bisa dipakai di akun ini.")
    return cand[0]


def gemini_json(prompt, schema_hint):
    key = gemini_key()
    model = gemini_model(key)
    body = {"contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.3, "responseMimeType": "application/json", "maxOutputTokens": 4096}}
    for attempt in range(3):
        try:
            out = http("POST", f"{GEMINI_BASE}/{model}:generateContent", {"x-goog-api-key": key, "Content-Type": "application/json"}, body, timeout=120, tries=2)
            break
        except RuntimeError as e:
            if "429" in str(e) and attempt < 2:
                time.sleep(25 * (attempt + 1)); continue
            raise
    txt = "".join(p.get("text", "") for c in out.get("candidates", [])[:1] for p in c.get("content", {}).get("parts", []))
    txt = txt.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return model.split("/")[-1], json.loads(txt)


def gemini_brief(results):
    """Kirim HANYA ringkasan angka agregat (tanpa nama/nomor pelanggan) ke Gemini, minta analisa & tindakan."""
    core, stores = {}, []
    for key, res in results.items():
        if key == "stores":
            for m in res.get("multi") or []:
                stores.append({"desk": m["desk"], "toko": m["body"].get("store"), "isu": m["body"].get("issues", []),
                               "ringkas": _re.sub(r"\s+", " ", m.get("summary", ""))[:400]})
        elif res.get("summary"):
            core[key] = {"meja": DESK_NAMES.get(key, key), "status": res.get("status"), "ringkas": res["summary"][:700]}
    if not core and not stores:
        return None
    payload = json.dumps({"tanggal": str(TODAY), "meja": core, "toko": stores}, ensure_ascii=False)
    prompt = ("Kamu adalah asisten analis Commercial untuk jaringan toko fashion MAMU & TIGALAPANKAOS di Sulawesi dan Kalimantan. "
              "Berikut ringkasan kerja hari ini dari karyawan AI berbasis aturan (angka sudah dihitung, jangan mengubah atau mengarang angka). "
              "Tulis dalam Bahasa Indonesia yang singkat, sopan, dan bisa langsung dikerjakan tim toko. "
              "Kembalikan JSON persis dengan bentuk: "
              '{"briefing": ["3-5 poin terpenting hari ini, sebut toko & angka"], '
              '"meja": {"<kode meja>": {"analisa": "1-2 kalimat", "tindakan": ["1-3 tindakan konkret"]}}, '
              '"toko": {"<desk toko, mis. store-12>": {"analisa": "1 kalimat", "tindakan": ["1-2 tindakan konkret untuk admin/SPV toko"]}}}. '
              "Hanya pakai kode meja dan desk toko yang ada di data. Jangan memberi saran yang butuh data yang tidak ada.\n\nDATA:\n" + payload)
    return gemini_json(prompt, None)


def main():
    mode = os.environ.get("OFFICE_DESKS", "auto").strip().lower()
    if mode == "telegram_setup":
        return telegram_setup()
    if mode == "telegram_test":
        ok = tg_send(f"<b>Kantor Virtual Commercial</b>\nTes kirim berhasil · {escape(tgl(TODAY))} {NOW:%H:%M} WITA\n{DASH}")
        raise SystemExit(0 if ok else "TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID belum diisi.")
    if mode == "gemini_test":
        if not gemini_key():
            raise SystemExit("Secret GEMINI_API_KEY belum diisi.")
        m, out = gemini_json('Balas JSON {"ok": true, "pesan": "Gemini siap membantu Kantor Virtual"}', None)
        log(f"Model: {m} → {out}")
        return
    db = Supa()
    failed = 0
    results, timing = {}, {}
    # Fase 1: semua meja bekerja (belum disimpan)
    for key in pick_desks():
        t0 = time.time()
        try:
            res = CACHE[key] if key in CACHE and key != "stores" else DESKS[key](db)
            CACHE[key] = res
        except Exception as e:  # satu meja gagal tidak menghentikan meja lain
            failed += 1
            res = {"status": "error", "title": f"{DESK_NAMES[key]} gagal bekerja", "summary": str(e)[:400], "body": {"error": str(e)[:2000]},
                   "telegram": f"<b>{DESK_NAMES[key]}</b> gagal: {escape(str(e)[:300])}"}
        results[key] = dict(res)
        timing[key] = time.time() - t0
    # Fase 2: Gemini (opsional) menambahkan analisa & saran tindakan
    ai = None
    if gemini_key() and any(k != "visit" for k in results):
        try:
            model, ai = gemini_brief(results)
            log(f"✓ Gemini ({model}) memberi analisa untuk {len((ai or {}).get('meja', {}))} meja & {len((ai or {}).get('toko', {}))} toko")
            ai["model"] = model
        except Exception as e:
            log(f"  ! Gemini dilewati: {str(e)[:300]}")
    # Fase 3: simpan, kirim, catat
    for key, res in results.items():
        multi = res.pop("multi", None)
        task = res.pop("task", None)
        text = res.pop("telegram", None)
        if ai:
            m = (ai.get("meja") or {}).get(key)
            if m and isinstance(res.get("body"), dict):
                res["body"]["ai"] = {**m, "model": ai["model"]}
            if m and text and m.get("tindakan"):
                text += "\n\n<b>Saran AI</b>\n" + "\n".join("• " + escape(str(t)) for t in m["tindakan"][:3])
            for mm in multi or []:
                t = (ai.get("toko") or {}).get(mm["desk"])
                if t:
                    mm["body"]["ai"] = {**t, "model": ai["model"]}
        sent = False
        if text:
            try:
                sent = tg_send(text + f"\n\n<a href=\"{DASH}\">Buka Kantor Virtual</a>")
            except Exception as e:
                log(f"  ! Telegram gagal: {e}")
        if multi is not None:
            if multi:
                db.insert("commercial_office_reports_v96", [{**m, "telegram_sent": sent} for m in multi], prefer="return=minimal")
        else:
            db.insert("commercial_office_reports_v96", [{"desk": key, "status": res["status"], "period": res.get("period"), "title": res["title"],
                                                         "summary": res.get("summary"), "body": res.get("body") or {}, "telegram_sent": sent}],
                      prefer="return=minimal")
        if task:
            db.patch("commercial_office_tasks_v96", f"desk=eq.{key}&kind=eq.{task['kind']}&status=eq.pending&dedupe=neq.{task['dedupe']}",
                     {"status": "expired", "note": "Digantikan usulan yang lebih baru"})
            db.insert("commercial_office_tasks_v96", [task], prefer="resolution=ignore-duplicates,return=minimal", conflict="dedupe")
        log(f"{'✓' if res['status'] in ('ok', 'idle') else '!' if res['status'] == 'warn' else '✗'} {DESK_NAMES[key]:<17} {timing[key]:5.1f}s  {res['summary']}")
    if ai and ai.get("briefing"):
        brief = [str(b) for b in ai["briefing"]][:6]
        db.insert("commercial_office_reports_v96", [{"desk": "ai", "status": "ok", "period": str(TODAY), "title": f"Analisa AI {tgl(TODAY)}",
                                                     "summary": " ".join(brief)[:900], "body": {"briefing": brief, "model": ai["model"],
                                                     "catatan": "Disusun Gemini (gratis) dari ringkasan angka agregat; tanpa data pribadi pelanggan."}}],
                  prefer="return=minimal")
        try:
            tg_send("<b>Analisa AI · " + escape(tgl(TODAY)) + "</b>\n" + "\n".join("• " + escape(b) for b in brief))
        except Exception as e:
            log(f"  ! Telegram gagal: {e}")
    try:
        if not DRY and NOW.hour < 12:
            db.rpc("commercial_office_cleanup_v99", {})
    except Exception as e:
        log(f"  ! Pembersihan laporan lama dilewati: {e}")
    try:
        notify_decisions(db)
    except Exception as e:
        log(f"  ! Notifikasi keputusan gagal: {e}")
    if failed:
        raise SystemExit(f"{failed} meja gagal bekerja (lihat log).")


if __name__ == "__main__":
    main()
