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
DESK_NAMES = {"sales": "Analis Sales", "stock": "Admin Stok", "visit": "Sekretaris Visit", "sync": "Admin Sinkron"}


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


DESKS = {"sales": desk_sales, "stock": desk_stock, "visit": desk_visit, "sync": desk_sync}


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
        return ["visit"] if NOW.hour >= 12 else ["sync", "sales", "stock"]
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


def main():
    mode = os.environ.get("OFFICE_DESKS", "auto").strip().lower()
    if mode == "telegram_setup":
        return telegram_setup()
    if mode == "telegram_test":
        ok = tg_send(f"<b>Kantor Virtual Commercial</b>\nTes kirim berhasil · {escape(tgl(TODAY))} {NOW:%H:%M} WITA\n{DASH}")
        raise SystemExit(0 if ok else "TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID belum diisi.")
    db = Supa()
    failed = 0
    for key in pick_desks():
        t0 = time.time()
        try:
            res = DESKS[key](db)
        except Exception as e:  # satu meja gagal tidak menghentikan meja lain
            failed += 1
            res = {"status": "error", "title": f"{DESK_NAMES[key]} gagal bekerja", "summary": str(e)[:400], "body": {"error": str(e)[:2000]},
                   "telegram": f"<b>{DESK_NAMES[key]}</b> gagal: {escape(str(e)[:300])}"}
        task = res.pop("task", None)
        text = res.pop("telegram", None)
        sent = False
        if text:
            try:
                sent = tg_send(text + f"\n\n<a href=\"{DASH}\">Buka Kantor Virtual</a>")
            except Exception as e:
                log(f"  ! Telegram gagal: {e}")
        db.insert("commercial_office_reports_v96", [{"desk": key, "status": res["status"], "period": res.get("period"), "title": res["title"],
                                                     "summary": res.get("summary"), "body": res.get("body") or {}, "telegram_sent": sent}],
                  prefer="return=minimal")
        if task:
            db.patch("commercial_office_tasks_v96", f"desk=eq.{key}&kind=eq.{task['kind']}&status=eq.pending&dedupe=neq.{task['dedupe']}",
                     {"status": "expired", "note": "Digantikan usulan yang lebih baru"})
            db.insert("commercial_office_tasks_v96", [task], prefer="resolution=ignore-duplicates,return=minimal", conflict="dedupe")
        log(f"{'✓' if res['status'] in ('ok', 'idle') else '!' if res['status'] == 'warn' else '✗'} {DESK_NAMES[key]:<17} {time.time() - t0:5.1f}s  {res['summary']}")
    try:
        notify_decisions(db)
    except Exception as e:
        log(f"  ! Notifikasi keputusan gagal: {e}")
    if failed:
        raise SystemExit(f"{failed} meja gagal bekerja (lihat log).")


if __name__ == "__main__":
    main()
