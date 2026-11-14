/* =====================================================================
   COMMERCIAL V28 — tambahan untuk index.html (dimuat paling akhir)
   - Info "data terakhir diperbarui" + tombol Sinkron Moka (live)
   - Perbaikan filter brand di semua menu
   - Dashboard: kolom/kartu Achievement rincian segmen dihapus, tata letak ringkas
   - Menu baru: Jam Ramai (heatmap), Pelanggan & Member, Stok Toko, Akses Pengguna
   - Price List: perbarui langsung dari Library item Moka
   - Login PIN wajib (opsional) + hak akses menu/toko per pengguna
   Semua fungsi lama tetap dipakai; file ini hanya membungkus/menambah.
   ===================================================================== */
(function () {
  'use strict';
  if (window.V28) return;
  const V28 = window.V28 = { run: null, active: null, poll: null, access: null, accessReady: false, revision: null };
  const SEGMENT_BRANDS = ['TIGALAPAN', 'MAMU', 'MYNO', 'DEFECT'];
  const SEGMENT_PAGES = new Set(['dash', 'sales', 'mkt', 'pdca', 'h2h', 'program']);
  const STORE_BRAND_PAGES = new Set(['review', 'trx', 'jam', 'pelanggan']);
  const ADMIN_PAGES = new Set(['upload', 'uploadreset', 'akses']);
  const ACCESS_KEY = 'kpi_access_v28';
  const WITA = 'Asia/Makassar';
  const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  const fmtDT = new Intl.DateTimeFormat('id-ID', { timeZone: WITA, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const fmtD = new Intl.DateTimeFormat('id-ID', { timeZone: WITA, day: '2-digit', month: 'long', year: 'numeric' });
  const num = v => (v == null || v === '' || !Number.isFinite(Number(v))) ? null : Number(v);
  const sum = (a, f) => a.reduce((n, x) => n + (num(f(x)) || 0), 0);
  const ago = iso => { if (!iso) return '—'; const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000); if (s < 60) return 'baru saja'; if (s < 3600) return Math.round(s / 60) + ' menit lalu'; if (s < 86400) return Math.round(s / 3600) + ' jam lalu'; return Math.round(s / 86400) + ' hari lalu'; };
  const dt = iso => iso ? fmtDT.format(new Date(iso)).replace(/\./g, ':') + ' WITA' : '—';
  const isoDate = d => d.toISOString().slice(0, 10);
  const todayWita = () => new Intl.DateTimeFormat('en-CA', { timeZone: WITA }).format(new Date());

  /* ------------------------------------------------------------ CSS */
  document.head.append(el('style', { id: 'v28-css' }, `
.adaptive-data-table td[data-col-role="label"]:not(.sticky1),.adaptive-data-table th[data-col-role="label"]:not(.sticky1){overflow-wrap:normal!important;word-break:normal!important;min-width:9ch}
td.sticky1{overflow-wrap:break-word}
.page .card .tw{max-height:min(66vh,560px);overflow:auto}
.page .card .tw thead th{position:sticky;top:0;z-index:3;background:var(--surface)}
.page .card .tw tfoot td{position:sticky;bottom:0;z-index:2;background:var(--surface)}
.v28-two-col{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(min(100%,460px),1fr));gap:16px;align-items:start}
.v28-two-col>*{min-width:0;margin:0!important}
.v28-sync-btn{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}
.v28-sync-btn{min-height:34px;max-width:100%;line-height:1.3;padding:7px 12px}
.v28-sync-icon{display:inline-flex;width:16px;height:16px;flex:0 0 16px;align-items:center;justify-content:center}
.v28-sync-icon svg,.v28-sync-btn svg{display:block;width:16px!important;height:16px!important;max-width:16px;flex:none}
.modal[data-v28-sync] .box{width:min(560px,100%);max-height:calc(100dvh - 36px);overflow:auto;box-sizing:border-box}
.modal[data-v28-sync] .rowline{display:flex;flex-wrap:nowrap;align-items:flex-start;gap:10px;line-height:1.5;margin:12px 0}
.modal[data-v28-sync] input[type=checkbox]{width:16px;height:16px;flex:0 0 16px;margin:3px 0 0}
.modal[data-v28-sync] .v28-sync-btn{width:auto;justify-content:center;margin-top:6px}
.v28-tools{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:12px!important;align-items:end}
.v28-tools .fld{min-width:0!important;display:grid;gap:5px}
.v28-tools input:not([type=checkbox]),.v28-tools select{width:100%;min-width:0!important;box-sizing:border-box;min-height:34px}
.v28-tools .rowline{align-items:center;min-height:34px}
.v28-two-col .tw{max-width:100%}
.v28-badge{font-size:11px;white-space:nowrap;cursor:pointer}
.v28-spin svg{animation:v28spin 1s linear infinite}@keyframes v28spin{to{transform:rotate(360deg)}}
.v28-update{display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:center}
.v28-update .meta{font-size:12px;color:var(--muted);line-height:1.6}
.v28-update .big{font-size:22px;font-weight:700;line-height:1.2}
.v28-update .acts{display:flex;flex-direction:column;gap:8px;align-items:flex-end}
@media(max-width:760px){.v28-update{grid-template-columns:1fr}.v28-update .acts{align-items:flex-start;flex-direction:row;flex-wrap:wrap}}
.v28-steps{display:grid;gap:6px;margin:10px 0;font-size:13px}
.v28-steps div{display:flex;gap:8px;align-items:center}
.v28-steps i{width:10px;height:10px;border-radius:50%;background:var(--line);display:inline-block}
.v28-steps .on i{background:#b67a00}.v28-steps .ok i{background:#16b84e}.v28-steps .bad i{background:#df4255}
.v28-heat{display:grid;gap:2px;font-size:11px;overflow:auto}
.v28-heat .c{padding:7px 2px;text-align:center;border-radius:4px;min-width:34px;font-variant-numeric:tabular-nums;cursor:default}
.v28-heat .h{font-weight:600;color:var(--muted);text-align:center;padding:4px 0}
.v28-heat .d{font-weight:600;padding:7px 8px 7px 0;white-space:nowrap}
.v28-legend{display:flex;gap:6px;align-items:center;font-size:11px;color:var(--muted);margin-top:8px}
.v28-legend span{width:22px;height:10px;border-radius:3px;display:inline-block}
.v28-seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}
.v28-seg button{border:0;background:transparent;padding:6px 12px;font-size:12px;cursor:pointer;color:inherit}
.v28-seg button[aria-pressed="true"]{background:var(--s1,#bd2579);color:#fff}
.v28-tools{display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin-bottom:12px}
.v28-tools .fld{min-width:160px}
.v28-gate{position:fixed;inset:0;z-index:9999;background:var(--bg,#f5f6f8);display:flex;align-items:center;justify-content:center;padding:20px}
.v28-gate .card{max-width:420px;width:100%}
.v28-user{display:inline-flex;gap:6px;align-items:center;font-size:12px}
.v28-access-row{display:grid;grid-template-columns:minmax(150px,1.2fr) minmax(160px,1fr) minmax(160px,1fr) auto auto;gap:10px;align-items:center;padding:10px 0;border-top:1px solid var(--line)}
@media(max-width:900px){.v28-access-row{grid-template-columns:1fr}}
.note.warn[role=alert]:empty{display:none}
.v28-b2b{font-size:10px;padding:1px 6px;border-radius:9px;background:#6d3fd1;color:#fff;margin-left:6px}
`));

  /* -------------------------------------------------- akses pengguna */
  function accessCfg() {
    const raw = S.settings ? S.settings[ACCESS_KEY] : null;
    let cfg = null;
    try { cfg = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { cfg = null; }
    return Object.assign({ required: false, users: {} }, cfg || {});
  }
  function currentUser() { return MASTER.verified ? MASTER.session?.user || null : null; }
  function isMaster() { return currentUser()?.role === 'master'; }
  function userRule() {
    const u = currentUser(); if (!u || u.role === 'master') return null;
    return accessCfg().users[String(u.id)] || null;
  }
  function viewOnly() { return !!userRule()?.view_only; }
  function pageAllowed(id) {
    if (id === 'akses' || (window.AUTH58 && id === 'set')) return isMaster();
    const r = userRule();
    if (r && r.view_only && ADMIN_PAGES.has(id)) return false;
    if (r && Array.isArray(r.menus) && r.menus.length && !r.menus.includes(id) && !(id === 'members' && r.menus.includes('pelanggan'))) return false;
    return true;
  }
  function allowedStoreSet() {
    const r = userRule();
    return r && Array.isArray(r.stores) && r.stores.length ? new Set(r.stores.map(String)) : null;
  }
  V28.pageAllowed = pageAllowed;
  V28.memberTabAllowed = function (tab) {
    const rule = userRule();
    if (!rule?.menus?.length) return true;
    return tab === 'monthly' ? rule.menus.includes('members') || rule.menus.includes('pelanggan') : rule.menus.includes('members');
  };

  /* ------------------------------------------------ halaman baru */
  function addPage(afterId, page) {
    if (PAGES.some(p => p.id === page.id)) return;
    const i = PAGES.findIndex(p => p.id === afterId);
    PAGES.splice(i < 0 ? PAGES.length : i + 1, 0, page);
  }
  addPage('top', { id: 'jam', t: 'Jam Ramai', ic: 'datatrack' });
  // Customer analytics now live inside Member; no second navigation entry.
  addPage('uploadreset', { id: 'akses', t: 'Akses Pengguna', ic: 'set' });
  const host = $('#p-dash').parentElement;
  for (const id of ['jam', 'pelanggan', 'akses'])
    if (!$('#p-' + id)) host.append(el('section', { class: 'page', id: 'p-' + id }));
  Object.assign(FILTER_VISIBILITY, {
    jam: ['year', 'month', 'brand', 'spv', 'store'],
    pelanggan: ['year', 'month', 'brand', 'spv', 'store'],
    akses: []
  });

  const origBuildNav = buildNav;
  buildNav = function () {
    origBuildNav();
    document.querySelectorAll('#nav button').forEach(b => {
      b.hidden = !pageAllowed(b.dataset.p);
      b.setAttribute('aria-current', String(b.dataset.p === S.page));
    });
    document.querySelectorAll('#nav .navgrp').forEach(g => {
      let n = g.nextElementSibling, any = false;
      while (n && !n.classList.contains('navgrp')) { if (!n.hidden) any = true; n = n.nextElementSibling; }
      g.hidden = !any;
    });
  };
  buildNav();

  const origGo = go;
  go = function (id) {
    if (id === 'pelanggan') { id = 'members'; if (typeof MEM27 !== 'undefined') MEM27.view = 'monthly'; }
    if (!pageAllowed(id)) { const first = PAGES.find(p => p.id && pageAllowed(p.id)); id = first ? first.id : 'dash'; }
    return origGo(id);
  };

  /* ------------------------------------------- filter brand & toko */
  const origActive = activeProductBrands;
  activeProductBrands = function () {
    if (STORE_BRAND_PAGES.has(S.page) && S.page !== 'review') return [];
    return origActive();
  };
  const origStoreOk = storeOk;
  storeOk = function (sid) {
    const allow = allowedStoreSet();
    if (allow && !allow.has(String(sid))) return false;
    if (STORE_BRAND_PAGES.has(S.page) && S.page !== 'review') {
      const st = S.stores.find(s => Number(s.id) === Number(sid)); if (!st) return false;
      const bl = brandList().map(canonicalProductBrand);
      if (bl.length && !bl.includes(canonicalProductBrand(st.brand))) return false;
    }
    return origStoreOk(sid);
  };
  const origScopeIds = scopeStoreIds;
  scopeStoreIds = function () {
    const ids = origScopeIds();
    if (ids === null && allowedStoreSet()) return S.stores.filter(s => storeOk(s.id)).map(s => s.id);
    return ids;
  };
  const origSyncStores = syncStoreOptions;
  syncStoreOptions = function () {
    const allow = allowedStoreSet(), keep = S.stores;
    if (allow) S.stores = S.stores.filter(s => allow.has(String(s.id)));
    const page = S.page, swap = STORE_BRAND_PAGES.has(page) && page !== 'review';
    if (swap) S.page = 'review';
    try { return origSyncStores(); } finally { if (swap) S.page = page; S.stores = keep; }
  };
  function brandOptionsFor(id) {
    const storeBrands = [...new Set(S.stores.map(s => canonicalProductBrand(s.brand)).filter(Boolean))].sort();
    if (STORE_BRAND_PAGES.has(id)) return storeBrands;
    if (SEGMENT_PAGES.has(id)) return SEGMENT_BRANDS;
    return null;
  }
  const origPFB = pageFilterBar;
  pageFilterBar = function (id) {
    const opts = brandOptionsFor(id), box = $('#f-brand');
    if (opts && box) {
      const sel = brandList().map(canonicalProductBrand).filter(b => opts.includes(b));
      S.brand = [...new Set(sel)].join(',');
      multiSelectDropdown(box, opts.map(b => ({ value: b, label: b })), [...new Set(sel)],
        arr => { S.brand = arr.join(','); syncStoreOptions(); S.itemScope = ''; render(); }, { allLabel: 'Semua brand' });
    }
    const wrap = origPFB(id);
    const lbl = (wrap && wrap.querySelector('#f-brand-label')) || $('#f-brand-label');
    if (lbl) lbl.textContent = STORE_BRAND_PAGES.has(id) ? 'Brand toko' : 'Brand';
    return wrap;
  };

  /* view-only: semua tombol simpan/hapus ditolak */
  const origGuard = guard;
  guard = function () {
    if (viewOnly()) { toast('Akun Anda hanya untuk melihat data.'); return true; }
    return origGuard();
  };

  /* ------------------------------------------------ data sinkron Moka */
  const throughDate=r=>r?.data_through||(r?.status==='done'?r?.data_until?.slice(0,10):null)||null;
  const throughLabel=r=>throughDate(r)?fmtD.format(new Date(throughDate(r)+'T12:00:00Z')):'belum terkonfirmasi';
  async function loadRuns() {
    if (!S.key || S.demo) { V28.run = null; V28.active = null; return; }
    try {
      const rows = await DB.sel('moka_sync_runs?select=*&order=requested_at.desc&limit=20');
      V28.tableMissing = false;
      V28.run = rows.find(r => r.status==='done' && throughDate(r) && (!r.components?.length||r.components.some(c=>['sales_type','item_sales','transactions'].includes(c)))) || null;
      V28.libraryRun = rows.find(r => ['done', 'warn'].includes(r.status) && /library: [1-9]\d* OK/i.test(r.message || '')) || null;
      const latestFinished = rows.find(r => ['done','warn','error'].includes(r.status));
      const act = rows.find(r => ['requested', 'running'].includes(r.status) && (!latestFinished || Date.parse(r.requested_at)>Date.parse(latestFinished.requested_at)) && Date.now() - Date.parse(r.requested_at) < 245 * 60000);
      V28.active = act || null;
      const issue=rows.find(r => ['error','warn'].includes(r.status) && (!V28.run || Date.parse(r.requested_at)>Date.parse(V28.run.requested_at)));
      V28.lastError=issue?.status==='error'?issue:null;
      V28.lastWarning=issue?.status==='warn'?issue:null;
    } catch (e) {
      V28.tableMissing = true;
      try {
        const l = await DB.sel("ingest_log?select=created_at,file_name&file_name=like.MOKA%20API*&order=created_at.desc&limit=1");
        V28.run = l[0] ? { finished_at: l[0].created_at, data_until: null, mode: 'full', status: 'done', message: l[0].file_name } : null;
      } catch { V28.run = null; }
    }
    paintBadge();
  }
  V28.loadRuns = loadRuns;

  function syncIcon() { return el('span', { class: 'v28-sync-icon', 'aria-hidden': 'true', html: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>' }); }
  function paintBadge() {
    let bar = $('#v28-bar');
    const conn = $('#conn'); if (!conn) return;
    if (!bar) { bar = el('span', { id: 'v28-bar', style: 'display:inline-flex;gap:8px;align-items:center;flex-wrap:wrap' }); conn.after(bar); }
    bar.replaceChildren();
    if (!S.key || S.demo) return;
    const r = V28.run, a = V28.active;
    const txt = a ? 'Sinkron Moka berjalan…' : r?.data_until ? 'Moka: data s.d. '+throughLabel(r) : 'Moka: cakupan belum tercatat';
    bar.append(el('span', { class: 'pill v28-badge ' + (a ? 'neu' : r ? 'ok' : 'neu'), title: r ? 'Terakhir diperbarui ' + dt(r.finished_at) + (r.data_until ? ' · data s.d. ' + dt(r.data_until) : '') : 'Belum ada sinkron Moka', onclick: openSync }, txt));
    if (!viewOnly()) bar.append(el('button', { class: 'btn sm v28-sync-btn' + (a ? ' v28-spin' : ''), type: 'button', onclick: openSync, title: 'Pilih periode dan jenis data Moka yang diperbarui' }, syncIcon(), a ? 'Sinkron…' : 'Sinkron Moka'));
    const u = currentUser();
    if (u) bar.append(el('span', { class: 'v28-user' }, el('span', { class: 'pill neu' }, u.name + (u.role === 'master' ? ' · master' : viewOnly() ? ' · lihat' : '')),
      el('button', { class: 'btn sm', type: 'button', onclick: async () => { try { await masterLogout(); } catch { masterClear(); } applyAccess(); } }, 'Keluar')));
  }

  /* Kartu "Status data" di dashboard (menggantikan tanggal manual sebagai info utama) */
  const origUpdateCard = appDataUpdateCard;
  appDataUpdateCard = function () {
    if (!S.key || S.demo) return origUpdateCard();
    const r = V28.run, a = V28.active;
    const icon = el('div', { class: 'app-update-icon', 'aria-hidden': 'true', html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/><path d="M12 7v5l3 2"/></svg>' });
    const until = r?.data_until ? 'Data pilihan s.d. ' + throughLabel(r) : r ? 'Waktu data belum tercatat' : 'Belum ada sinkron penjualan';
    const meta = [until, r?.components ? 'Jenis: '+r.components.join(', ') : null,
      r && r.stores_ok != null ? r.stores_ok + ' toko OK' + (r.stores_warn ? ', ' + r.stores_warn + ' menunggu Moka' : '') + (r.stores_error ? ', ' + r.stores_error + ' gagal' : '') : null,
      S.settings?.commercial_price_last_checked_v45 ? 'Price List terakhir dicek: '+dt(S.settings.commercial_price_last_checked_v45) : 'Price List: waktu pemeriksaan belum tercatat',
      S.settings?.commercial_price_last_updated_v45 ? 'Harga terakhir berubah: '+dt(S.settings.commercial_price_last_updated_v45) : null].filter(Boolean).join(' · ');
    const manual = appDataUpdateDate();
    const node = el('section', { class: 'app-data-update v28-update', 'data-update-state': r ? 'today' : 'empty', 'data-v28-update': '' }, icon,
      el('div', {},
        el('div', { class: 'app-update-eyebrow' }, 'STATUS DATA · MOKA POS'),
        el('div', { class: 'app-update-caption' }, a ? (a.status==='requested'?'Menunggu GitHub Actions…':'Sinkron sedang berjalan…') : 'Cakupan data tersimpan'),
        el('div', { class: 'big', role: 'status' }, r?.data_until ? 'Data s.d. '+throughLabel(r) : 'Cakupan data belum terkonfirmasi'),
        el('div', { class: 'meta' }, meta),
        r?.message?.includes('Member gagal:') ? el('div',{class:'meta',style:'color:#b67a00'},r.message) : null,
        V28.lastError ? el('div', { class: 'meta', style: 'color:#df4255' }, (a?'Percobaan sebelumnya gagal: ':'Sinkron terakhir gagal: ') + String(V28.lastError.message || '').slice(0, 160)) : null,
        V28.lastWarning ? el('div',{class:'meta',style:'color:var(--warn,#a66a04)'},(a?'Percobaan sebelumnya belum lengkap: ':'Sinkron terakhir belum lengkap: ')+String(V28.lastWarning.message||'Periksa log; data belum cocok tidak ditulis.').slice(0,220)) : null,
        V28.tableMissing ? el('div', { class: 'meta', style: 'color:#b67a00' }, 'Status sinkron tidak terbaca. Periksa akses database dan PANDUAN-MOKA-V35.md.') : null,
        manual ? el('div', { class: 'meta' }, 'Tanggal manual: ' + fmtD.format(new Date(manual + 'T12:00:00Z'))) : null),
      el('div', { class: 'acts' },
        el('span', { class: 'app-update-badge' }, el('span', { class: 'app-update-dot', 'aria-hidden': 'true' }), a ? (a.status==='requested'?'Menunggu':'Berjalan') : V28.lastError?'Gagal sebagian/seluruhnya':V28.lastWarning?'Belum lengkap':r ? ago(r.finished_at) : 'Belum ada'),
        viewOnly() ? null : el('button', { class: 'btn pri sm v28-sync-btn' + (a ? ' v28-spin' : ''), type: 'button', onclick: openSync }, syncIcon(), a ? 'Lihat progres' : 'Sinkron sekarang'),
        el('button', { class: 'btn sm', type: 'button', onclick: appEditUpdateDate }, 'Edit tanggal manual')));
    return node;
  };
  function repaintUpdateCard() {
    const old = document.querySelector('[data-v28-update]');
    if (old) old.replaceWith(appDataUpdateCard());
  }

  /* ---------------------------------------------- dialog Sinkron */
  async function ensurePin(box, retry) {
    if (MASTER.verified) return true;
    try { await masterResume(); } catch { /* lanjut ke form */ }
    if (MASTER.verified) return true;
    box.append(el('p', { class: 'note' }, 'Masuk dengan PIN master/editor untuk menjalankan sinkron.'), masterLoginForm(retry).node);
    return false;
  }
  async function openSync(options={}) {
    const priceOnly=options.priceOnly===true;
    document.querySelectorAll('.modal[data-v28-sync]').forEach(m => m.remove());
    const { box, modal } = opsModal(priceOnly?'Perbarui Price List dari Moka':'Sinkron data Moka');
    modal.dataset.v28Sync = '1';
    if (S.demo || !S.key) { box.append(el('p', { class: 'note' }, 'Hubungkan Supabase di Pengaturan terlebih dahulu.')); return; }
    if (V28.active) { watchRun(V28.active.id, box); return; }
    if (!(await ensurePin(box, () => { modal.remove(); openSync(options); }))) return;
    if (viewOnly()) { box.append(el('p', { class: 'note warn' }, 'Akun Anda hanya untuk melihat data.')); return; }
    const prev = el('input', { type: 'checkbox' }); prev.checked=true;
    const stableEnd=()=>{const d=new Date(todayWita()+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10);};
    const selection=opsSelect([['month','Bulan'],['year','Tahun penuh'],['range','Rentang tanggal']], 'month', {'aria-label':'Jenis periode sinkron'});
    const year=opsInput(S.year,'number',{min:2000,max:2100,'aria-label':'Tahun sinkron'});
    const month=opsSelect(MONTHS.map((m,i)=>[i+1,m]),S.month||Number(todayWita().slice(5,7)),{'aria-label':'Bulan sinkron'});
    const from=opsInput(todayWita().slice(0,8)+'01','date',{'aria-label':'Tanggal awal sinkron'});
    const to=opsInput(stableEnd(),'date',{'aria-label':'Tanggal akhir sinkron',max:stableEnd()});
    if(Number(todayWita().slice(8))===1){year.value=Number(stableEnd().slice(0,4));month.value=Number(stableEnd().slice(5,7));from.value=stableEnd().slice(0,8)+'01';}
    prev.onchange=()=>{to.max=prev.checked?stableEnd():todayWita();if(to.value>to.max)to.value=to.max;};
    const periodBox=el('div',{class:'v28-tools'},opsField('Periode',selection),opsField('Tahun',year),opsField('Bulan',month),opsField('Dari',from),opsField('Sampai',to));
    const syncFields=()=>{year.closest('.fld').hidden=selection.value==='range';month.closest('.fld').hidden=selection.value!=='month';from.closest('.fld').hidden=to.closest('.fld').hidden=selection.value!=='range';};selection.onchange=syncFields;syncFields();
    const library=el('input',{type:'checkbox'});library.checked=priceOnly;library.disabled=priceOnly;if(priceOnly)periodBox.hidden=true;
    const componentInputs=[['sales_type','Sales Type'],['item_sales','Item Sales'],['transactions','Transaksi'],['members','Member · Customer List / Purchase History']].map(([key,label])=>{const input=el('input',{type:'checkbox','data-sync-component':key});input.checked=options.memberOnly===true?key==='members':key!=='members';if(key==='members')label+=' · Customer Service';return {key,label,input}});
    const componentBox=el('div',{class:'v28-tools'},...componentInputs.map(c=>el('label',{class:'rowline'},c.input,c.label)));componentBox.hidden=priceOnly;
    const skip=el('input',{type:'checkbox'});skip.checked=true;const force=el('input',{type:'checkbox'});
    const err = el('p', { class: 'note warn', role: 'alert' });
    const start = el('button', { class: 'btn pri v28-sync-btn', type: 'button' }, syncIcon(), ' Mulai sinkron');
    box.append(
      periodBox,componentBox,!priceOnly?el('p',{class:'note warn'},'Member memakai Customer List dan Purchase History. Uji Member saja untuk satu bulan terlebih dahulu. Akses token dan kelengkapan pagination diperiksa sebelum penulisan; seluruh histori sumber mungkin perlu dibaca meskipun periode tampilan dipersempit.'):null,el('label',{class:'rowline'},library,'Item Library / Price List · manual saja'),
      el('label',{class:'rowline'},skip,'Lewati periode lama yang sudah lengkap dan cocok'),el('label',{class:'rowline'},force,'Tarik ulang paksa (abaikan checkpoint)'),el('p',{class:'sub'},'Data terbaru tetap diperbarui. Data lama dicek ke ringkasan Moka dan sidik isi database; validasi detail diulang paling lambat 7 hari. Library & Price List tetap diperiksa jika dipilih.'),
      el('p', {}, priceOnly?'Mengambil Item Library Moka langsung menjadi Price List. Katalog mentah tidak disimpan; harga identik tidak ditulis ulang. DC dilewati.':'Bawaan FULL: data stabil sampai kemarin, sama dengan sinkron GitHub. LIVE hari ini tersedia dengan menonaktifkan opsi di bawah; angka sumber dapat berubah selama penarikan. Data belum cocok tidak disimpan.'),
      el('label', { class: 'rowline' }, prev, 'FULL · batasi data s.d. kemarin (disarankan). Nonaktifkan untuk LIVE hari ini.'),
      el('p', { class: 'note' }, 'Cakupan data terakhir: ' + (V28.run ? throughLabel(V28.run) : 'belum ada') + '. Jadwal otomatis dikonfigurasi pukul 04:37 WITA; keberhasilannya mengikuti status proses terakhir.'),
      err, start);
    if(!priceOnly){
      const checkStatus=el('p',{class:'note',role:'status'}),checkButton=el('button',{class:'btn',type:'button'},'Periksa koneksi API Member');
      checkButton.onclick=async()=>{checkButton.disabled=true;checkStatus.replaceChildren();try{const data=await V28.checkMemberSource();checkStatus.append('Pemeriksaan API diminta. Buka ',el('a',{href:data.workflow_url,target:'_blank',rel:'noopener noreferrer'},'hasil GitHub Actions'),', lalu unduh artifact moka-member-check. Belum melakukan sinkron Member.');}catch(e){checkStatus.textContent=e.message;checkButton.disabled=false;}};
      box.append(checkButton,checkStatus);
    }
    if(priceOnly){skip.closest('label').hidden=true;force.closest('label').hidden=true;prev.closest('label').hidden=true;}
    start.onclick = async () => {
      start.disabled = true; err.textContent = '';
      try {
        const y=Number(year.value),m=Number(month.value);
        const selected=componentInputs.filter(c=>c.input.checked).map(c=>c.key);
        if(!priceOnly&&!selected.length)throw Error('Pilih minimal satu jenis data. Gunakan menu Price List untuk update harga saja.');
        const request={mode:priceOnly?'price':(prev.checked?'full':'live')+'|'+selected.join(','),include_library:library.checked,skip_unchanged:skip.checked,force_refresh:force.checked,months:'',date_from:'',date_to:''};
        if(!priceOnly&&selection.value==='range'){
          if(!/^\d{4}-\d{2}-\d{2}$/.test(from.value)||!/^\d{4}-\d{2}-\d{2}$/.test(to.value)||from.value>to.value||to.value>(prev.checked?stableEnd():todayWita()))throw Error('Rentang tanggal tidak valid atau melewati batas mode yang dipilih.');
          request.date_from=from.value;request.date_to=to.value;
        }else if(!priceOnly){
          if(!Number.isInteger(y)||y<2000||y>2100)throw Error('Tahun tidak valid.');
          request.months=selection.value==='year'?y+'-01..'+y+'-12':y+'-'+String(m).padStart(2,'0');
        }
        const token = await masterToken();
        const headers = window.AUTH58 ? DB.h() : { apikey: S.key, 'Content-Type': 'application/json', 'x-commercial-pin-session': token };
        if (!window.AUTH58 && /^eyJ/.test(S.key)) headers.Authorization = 'Bearer ' + S.key;
        const res = await fetch(S.url.replace(/\/$/, '') + '/functions/v1/moka-sync', {
          method: 'POST', headers, signal: AbortSignal.timeout(45000), body: JSON.stringify(request)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok || !data.run_id) {
          if (res.status === 404) throw Error('Fungsi moka-sync belum dipasang di Supabase Edge Functions. Ikuti PANDUAN-MOKA-V35.md bagian Edge Function.');
          throw Error(data.error || ('Permintaan sinkron gagal (' + res.status + ').'));
        }
        try { localStorage.setItem('sc_v28_run', String(data.run_id)); } catch { }
        box.replaceChildren(box.firstChild);
        V28.active = { id: data.run_id, status: 'requested', requested_at: new Date().toISOString() };
        paintBadge(); repaintUpdateCard();
        watchRun(data.run_id, box);
      } catch (e) {
        err.textContent = /Failed to fetch|NetworkError|Load failed/i.test(e.message || '')
          ? 'Browser tidak dapat menghubungi fungsi sinkron. Periksa koneksi dan pasang pembaruan Edge Function moka-sync (termasuk izin CORS/OPTIONS). Data lama tetap tersedia.'
          : /TimeoutError|AbortError/.test(e.name || '') ? 'Permintaan belum terkonfirmasi setelah 45 detik. Tutup lalu buka status sinkron sebelum mencoba lagi.' : e.message;
        start.disabled = false;
      }
    };
  }
  V28.openSync = openSync;
  V28.checkMemberSource=async function(){
    const token=await masterToken();const headers=window.AUTH58?DB.h():{apikey:S.key,'Content-Type':'application/json','x-commercial-pin-session':token};
    if(!window.AUTH58&&/^eyJ/.test(S.key))headers.Authorization='Bearer '+S.key;
    const response=await fetch(S.url.replace(/\/$/,'')+'/functions/v1/moka-sync',{method:'POST',headers,body:JSON.stringify({mode:'member_check'}),signal:AbortSignal.timeout(45000)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.ok||!data.audit_dispatched)throw Error(data.error||'Pemeriksaan Member belum dapat dimulai.');
    return data;
  };


  function watchRun(id, box) {
    const steps = el('div', { class: 'v28-steps' });
    const msg = el('p', { class: 'note', role: 'status' });
    const link = el('p', { class: 'sub' });
    const t0 = Date.now();
    let polling = false;
    box.append(el('p', {}, 'Sinkron #' + id + ' — Anda boleh menutup jendela ini; status tetap terlihat di kanan atas.'), steps, msg, link);
    const paint = r => {
      const st = r?.status || 'requested';
      const s = (txt, state) => el('div', { class: state }, el('i'), txt);
      steps.replaceChildren(
        s('Permintaan diterima', 'ok'),
        s('GitHub Actions memulai proses', st === 'requested' ? 'on' : 'ok'),
        s('Menarik data dari Moka & menyimpan', st === 'running' ? 'on' : st === 'requested' ? '' : ['error','warn'].includes(st) ? 'bad' : 'ok'),
        s('Dashboard dimuat ulang', st==='done'||Number(r?.stores_ok||0)>0 ? 'ok' : ''));
      const secs = Math.round((Date.now() - t0) / 1000);
      msg.textContent = (r?.message || 'Menunggu GitHub Actions (biasanya 20–60 detik)…') + ' · ' + secs + ' detik';
      if (r?.github_run_url) link.replaceChildren(el('a', { href: r.github_run_url, target: '_blank', rel: 'noopener' }, 'Lihat log di GitHub'));
    };
    paint(null);
    clearInterval(V28.poll);
    V28.poll = setInterval(async () => {
      if (polling || document.hidden) return;
      polling = true;
      let r = null;
      try { r = (await DB.sel('moka_sync_runs?select=*&id=eq.' + id))[0]; } catch { } finally { polling = false; }
      if (box.isConnected) paint(r);
      if (r && ['done', 'warn', 'error'].includes(r.status)) {
        clearInterval(V28.poll); V28.poll = null; V28.active = null;
        try { localStorage.removeItem('sc_v28_run'); } catch { }
        if (r.status === 'done' || Number(r.stores_ok || 0) > 0) {
          masterResetCaches(); if (typeof PL24 !== 'undefined') PL24.docs = null;
          await loadAll();
          const unm = (S.unmapped || []).length;
          toast('Data Moka terbaru dimuat' + (unm ? ' · ' + unm + ' Sales Type perlu dipetakan' : '') + '.');
          if (box.isConnected) box.append(...[el('p', { class: 'note' }, r.status === 'error' ? 'Sebagian data berhasil diperbarui; beberapa toko gagal. Periksa log sebelum mengulang sinkron.' : r.status === 'warn' ? 'Sebagian data belum terverifikasi dan tidak ditulis; data sebelumnya dipertahankan. Periksa log atau gunakan FULL s.d. kemarin.' : 'Selesai. Data sudah diperbarui.'),
            unm ? el('p', { class: 'note warn' }, unm + ' Sales Type belum dipetakan sehingga sales belum lengkap. ', el('button', { class: 'btn sm', onclick: () => { document.querySelectorAll('.modal').forEach(m => m.remove()); go('set'); requestAnimationFrame(() => $('#sales-type-pending')?.scrollIntoView({ block: 'start', behavior: 'smooth' })); } }, 'Sesuaikan pemetaan')) : null].filter(Boolean));
        } else {
          await loadRuns(); repaintUpdateCard();
          if (box.isConnected) box.append(el('p', { class: 'note warn' }, (r.status==='warn'?'Data belum cocok; data sebelumnya dipertahankan: ':'Sinkron gagal: ') + (r.message || '')));
        }
      }
      if (Date.now() - t0 > 245 * 60000) {
        clearInterval(V28.poll); V28.poll = null;
        if (box.isConnected) msg.textContent = 'Pemantauan melewati batas 245 menit. Periksa log GitHub dan status terakhir sebelum mengulang sinkron.';
      }
    }, 10000);
  }
  function resumeActive() {
    let id = null; try { id = localStorage.getItem('sc_v28_run'); } catch { }
    if (V28.active && !V28.poll) {
      // pantau di latar belakang supaya dashboard memuat ulang saat selesai
      const box = el('div');
      watchRun(V28.active.id, box);
    } else if (id && !V28.active) { try { localStorage.removeItem('sc_v28_run'); } catch { } }
  }

  /* --------------------------------------------- loadAll + akses */
  const origLoadAll = loadAll;
  loadAll = async function () {
    await origLoadAll.apply(this, arguments);
    V28.accessReady = true;
    try { if (S.key && !S.demo && !MASTER.verified) await masterResume(); } catch { }
    await loadRuns();
    try { localStorage.setItem('sc_v28_gate', accessCfg().required ? '1' : '0'); } catch { }
    applyAccess(false);
    if (S.page === 'dash') repaintUpdateCard();
    resumeActive();
    V28.revision = S.settings?.commercial_moka_revision || V28.revision;
  };

  function applyAccess(rerender = true) {
    const cfg = accessCfg();
    const gate = $('#v28-gate');
    const needLogin = S.key && !S.demo && S.ready && cfg.required && !MASTER.verified;
    if (needLogin && !gate?.querySelector('form')) { gate?.remove(); showGate(); }
    if (!needLogin && gate) gate.remove();
    buildNav();
    paintBadge();
    if (!pageAllowed(S.page)) go('dash');
    else if (rerender) render();
  }
  V28.applyAccess = applyAccess;
  function showGate() {
    const login = masterLoginForm(async () => { $('#v28-gate')?.remove(); applyAccess(); });
    login.node.querySelector('h2').textContent = 'Masuk ke Dashboard Commercial';
    login.node.querySelector('h2').nextElementSibling.textContent = 'Masukkan PIN yang diberikan master untuk melihat data.';
    document.body.append(el('div', { id: 'v28-gate', class: 'v28-gate' }, login.node));
    setTimeout(() => login.pin.focus(), 50);
  }

  /* ------------------------------------------------- mapping notice */
  const origNotice = renderMappingNotice;
  renderMappingNotice = function () {
    origNotice();
    const box = document.querySelector('.sales-mapping-notice');
    if (!box || !S.unmapped?.length) return;
    const names = [...new Set(S.unmapped.map(r => r.sales_type).filter(Boolean))];
    const div = box.querySelector('div');
    if (div && names.length) div.append(el('div', { class: 'sub', style: 'margin-top:4px' }, 'Belum terpetakan: ' + names.slice(0, 8).join(', ') + (names.length > 8 ? ' dan ' + (names.length - 8) + ' lainnya' : '') + '. Data sales belum lengkap sampai pemetaan disesuaikan.'));
  };

  /* ---------------------------------------------------- dashboard */
  const origSegments = dashboardSegments;
  dashboardSegments = function (rows) {
    const node = origSegments(rows);
    node.querySelectorAll('.card').forEach(c => { const h = c.querySelector('header h2'); if (h && /rincian segmen per toko/i.test(h.textContent)) c.remove(); });
    return node;
  };
  const origDash = renderDash;
  renderDash = function () {
    origDash.apply(this, arguments);
    const p = $('#p-dash');
    try {
      // AOV parsial: hitung dari toko-bulan yang sudah punya jumlah transaksi
      const t = trxScope(), okRows = t.filter(r => num(r.jumlah_transaksi) > 0 && r.nilai_transaksi != null);
      const tile = [...p.querySelectorAll('.tile')].find(x => x.querySelector('.k')?.textContent.trim() === 'AOV');
      const tm = trxSummary(t);
      if (tile && tm.aov == null && okRows.length) {
        const aov = sum(okRows, r => r.nilai_transaksi) / sum(okRows, r => r.jumlah_transaksi);
        tile.querySelector('.v').replaceChildren(rp(aov));
        tile.querySelector('.m').textContent = 'dari ' + okRows.length + ' toko-bulan yang ada jumlah transaksinya';
      }
      // Top product/warna/ukuran/kategori: dua kolom
      [...p.children].forEach(c => { if (c.tagName === 'H2' && /Top Product/i.test(c.textContent) && c.nextElementSibling) c.nextElementSibling.classList.add('v28-two-col'); });
    } catch (e) { console.warn('V28 dashboard', e); }
  };

  function patchAov(pageId, key) {
    const p = $('#p-' + pageId); if (!p) return;
    const t = trxScope(), okRows = t.filter(r => num(r.jumlah_transaksi) > 0 && r.nilai_transaksi != null);
    const tileEl = [...p.querySelectorAll('.tile')].find(x => x.querySelector('.k')?.textContent.trim() === key);
    if (tileEl && trxSummary(t).aov == null && okRows.length) {
      tileEl.querySelector('.v').replaceChildren(rp(sum(okRows, r => r.nilai_transaksi) / sum(okRows, r => r.jumlah_transaksi)));
      tileEl.querySelector('.m').textContent = 'dari ' + okRows.length + ' toko-bulan yang ada jumlah transaksinya';
    }
  }
  const origTrx = renderTrx;
  renderTrx = function () { origTrx.apply(this, arguments); try { patchAov('trx', 'AOV'); } catch (e) { console.warn('V28 trx', e); } };

  /* ---------------------------------------------- render halaman baru */
  const origRender = render;
  render = function () {
    if (!pageAllowed(S.page)) { go('dash'); return; }
    if (['jam', 'pelanggan', 'akses'].includes(S.page)) {
      parkFilters();
      ({ jam: renderJam, pelanggan: renderPelanggan, akses: renderAkses })[S.page]();
      renderMappingNotice();
      return;
    }
    return origRender.apply(this, arguments);
  };

  function pageHead(id, title, sub) {
    parkFilters(); const p = $('#p-' + id); p.replaceChildren(el('div', { class: 'phead' }, el('div', {}, el('h1', {}, title), el('p', {}, sub))));
    const pf = pageFilterBar(id); if (pf) p.append(pf);
    return p;
  }
  function needData(p) {
    if (S.demo || !S.key) { p.append(el('div', { class: 'empty' }, el('b', {}, 'Butuh koneksi Supabase'), 'Menu ini membaca data hasil sinkron Moka.')); return true; }
    if (!S.ready) { p.append(el('div', { class: 'empty' }, el('b', {}, 'Data belum termuat'), 'Tekan Muat ulang.')); return true; }
    return false;
  }
  function emptySync(body, title, message) {
    const actions = el('div', { class: 'rowline' });
    if (!viewOnly()) actions.append(el('button', { class: 'btn sm v28-sync-btn', type: 'button', onclick: openSync }, syncIcon(), 'Sinkron Moka'));
    body.append(el('div', { class: 'empty' }, el('b', {}, title), el('p', {}, message), actions));
  }
  function periodDates() {
    const y = Number(S.year); const [m1, m2] = periodM1M2(y);
    const from = `${y}-${String(m1).padStart(2, '0')}-01`;
    const last = new Date(Date.UTC(y, m2, 0)).toISOString().slice(0, 10);
    const t = todayWita();
    return { from, to: last > t ? t : last };
  }
  function sqlMissing(p, e) {
    const m = String(e.message || e);
    p.append(el('p', { class: 'note warn', role: 'alert' }, /PGRST202|42883|404|does not exist|Could not find/i.test(m)
      ? 'Fungsi/tabel analitik Moka tidak tersedia atau tidak dapat dibaca. Periksa pemasangan awal dan akses database; lihat PANDUAN-MOKA-V35.md.'
      : 'Gagal memuat: ' + m));
  }
  const stName = id => S.stores.find(s => Number(s.id) === Number(id))?.name || ('Toko ' + id);

  /* ======================= JAM RAMAI (heatmap) ======================= */
  V28.jam = { metric: 'trx', avg: true };
  async function renderJam() {
    const epoch=V28.jamEpoch=(V28.jamEpoch||0)+1;
    S.month = Number(S.month) || Number(todayWita().slice(5,7)); S.monthRange = null;
    const monthSelect = $('#f-month'); if (monthSelect) monthSelect.value = String(S.month);
    const p = pageHead('jam', 'Jam Ramai', 'Heatmap transaksi per jam × hari (jam WITA) dari data Moka · ' + periodLabel());
    if (needData(p)) return;
    const { from, to } = periodDates();
    const ids = scopeStoreIds();
    const body = el('div'); p.append(body);
    body.append(el('p', { class: 'note' }, 'Memuat heatmap…'));
    let rows, cov;
    try {
      [rows, cov] = await Promise.all([
        DB.rpc('commercial_heatmap_v1', { p_from: from, p_to: to, p_stores: ids }),
        DB.rpc('commercial_coverage_v1', { p_from: from, p_to: to, p_stores: ids })]);
    } catch (e) { body.replaceChildren(); sqlMissing(body, e); return; }
    if (S.page !== 'jam'||epoch!==V28.jamEpoch||!body.isConnected) return;
    body.replaceChildren();
    if (!rows.length) { emptySync(body, 'Belum ada data jam ramai', 'Belum ada transaksi hasil sinkron pada filter ' + from + ' s.d. ' + to + '. Jalankan sinkron, lalu pilih periode/toko yang sudah tercakup.'); return; }
    const firstCov = cov.map(c => c.first_date).sort()[0] || from, lastCov = cov.map(c => c.last_date).sort().slice(-1)[0] || to;
    const dowCount = [0, 0, 0, 0, 0, 0, 0];
    for (let d = new Date(firstCov + 'T12:00:00Z'); isoDate(d) <= lastCov; d.setUTCDate(d.getUTCDate() + 1)) dowCount[(d.getUTCDay() + 6) % 7]++;
    const M = V28.jam;
    const metricVal = r => M.metric === 'trx' ? num(r.trx) : M.metric === 'net' ? num(r.net) : num(r.items);
    const grid = {}; let hmin = 23, hmax = 0;
    for (const r of rows) { const k = r.dow + '|' + r.hour; grid[k] = (grid[k] || 0) + (metricVal(r) || 0); if (r.trx > 0) { hmin = Math.min(hmin, r.hour); hmax = Math.max(hmax, r.hour); } }
    if (hmax < hmin) { hmin = 0; hmax = 23; }
    const val = (d, h) => { const v = grid[d + '|' + h] || 0; return M.avg ? (dowCount[d - 1] ? v / dowCount[d - 1] : 0) : v; };
    let peak = 0; for (let d = 1; d <= 7; d++) for (let h = hmin; h <= hmax; h++) peak = Math.max(peak, val(d, h));
    const fmtV = v => M.metric === 'net' ? (NUMBER_MODE === 'compact' || v >= 1e6 ? (v / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' jt' : Math.round(v).toLocaleString('id-ID')) : Math.round(v).toLocaleString('id-ID');
    const color = v => { const t = peak ? v / peak : 0; if (!v) return 'background:var(--line);color:var(--muted)'; const a = 0.12 + 0.88 * t; return `background:rgba(189,37,121,${a.toFixed(2)});color:${t > 0.55 ? '#fff' : 'inherit'}`; };

    const seg = (opts, key) => el('div', { class: 'v28-seg' }, opts.map(([v, t]) => el('button', { type: 'button', 'aria-pressed': String(M[key] === v), onclick: () => { M[key] = v; renderJam(); } }, t)));
    const ctrls = el('div', { class: 'v28-tools' },
      el('div', { class: 'fld' }, el('label', {}, 'Ukuran'), seg([['trx', 'Transaksi'], ['net', 'Net sales'], ['items', 'Item terjual']], 'metric')),
      el('div', { class: 'fld' }, el('label', {}, 'Tampilan'), seg([[true, 'Rata-rata per hari'], [false, 'Total periode']], 'avg')));
    const hm = el('div', { class: 'v28-heat', style: `grid-template-columns:auto repeat(${hmax - hmin + 1},minmax(34px,1fr))` });
    hm.append(el('div'));
    for (let h = hmin; h <= hmax; h++) hm.append(el('div', { class: 'h' }, String(h).padStart(2, '0')));
    for (let d = 1; d <= 7; d++) {
      hm.append(el('div', { class: 'd' }, DAYS[d - 1]));
      for (let h = hmin; h <= hmax; h++) { const v = val(d, h); hm.append(el('div', { class: 'c', style: color(v), title: `${DAYS[d - 1]} ${String(h).padStart(2, '0')}:00–${String(h + 1).padStart(2, '0')}:00 · ${fmtV(v)}${M.avg ? ' rata-rata/hari' : ''}` }, v ? fmtV(v) : '')); }
    }
    const legend = el('div', { class: 'v28-legend' }, 'Sepi', ...[0.15, 0.35, 0.55, 0.75, 1].map(a => el('span', { style: `background:rgba(189,37,121,${a})` })), 'Ramai',
      el('span', { style: 'width:auto;background:none;margin-left:12px' }, `Data ${firstCov} s.d. ${lastCov} · ${M.metric === 'net' ? 'Rp' : ''}${M.avg ? ' rata-rata per hari' : ' total'}`));
    body.append(card('Heatmap jam × hari', (ids ? ids.length + ' toko' : 'semua toko') + ' · jam WITA', ctrls, hm, legend));

    // slot tersibuk + per toko
    const slots = [];
    for (let d = 1; d <= 7; d++) for (let h = hmin; h <= hmax; h++) slots.push({ d, h, v: val(d, h) });
    slots.sort((a, b) => b.v - a.v);
    const byDow = [1, 2, 3, 4, 5, 6, 7].map(d => ({ d, v: slots.filter(s => s.d === d).reduce((n, s) => n + s.v, 0) })).sort((a, b) => b.v - a.v);
    const perStore = new Map();
    for (const r of rows) {
      const s = perStore.get(r.store_id) || { trx: 0, net: 0, cells: {}, evening: 0 };
      s.trx += num(r.trx) || 0; s.net += num(r.net) || 0;
      const k = r.dow + '|' + r.hour; s.cells[k] = (s.cells[k] || 0) + (num(r.trx) || 0);
      if (r.hour >= 17 && r.hour <= 21) s.evening += num(r.trx) || 0;
      perStore.set(r.store_id, s);
    }
    const covBy = new Map(cov.map(c => [Number(c.store_id), Number(c.days)]));
    const storeRows = [...perStore.entries()].map(([id, s]) => {
      const [k] = Object.entries(s.cells).sort((a, b) => b[1] - a[1])[0] || ['0|0'];
      const hourTot = {}; for (const [kk, v] of Object.entries(s.cells)) { const h = kk.split('|')[1]; hourTot[h] = (hourTot[h] || 0) + v; }
      const ph = Object.entries(hourTot).sort((a, b) => b[1] - a[1])[0]?.[0];
      const days = covBy.get(Number(id)) || 0;
      return [stName(id), ph != null ? String(ph).padStart(2, '0') + ':00' : '—', DAYS[Number(k.split('|')[0]) - 1] + ' ' + String(k.split('|')[1]).padStart(2, '0') + ':00', int(days ? Math.round(s.trx / days) : null), compact(days ? s.net / days : null), pct(s.trx ? s.evening / s.trx : null, 1)];
    }).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
    body.append(el('div', { class: 'v28-two-col' },
      card('Slot tersibuk', 'hari & jam dengan nilai tertinggi', mkTable([H('#', { r: 1 }), H('HARI', { s: 1 }), H('JAM'), H(M.metric === 'net' ? 'NET SALES' : M.metric === 'items' ? 'ITEM' : 'TRANSAKSI', { r: 1 })],
        slots.slice(0, 8).map((s, i) => [String(i + 1), DAYS[s.d - 1], String(s.h).padStart(2, '0') + ':00–' + String(s.h + 1).padStart(2, '0') + ':00', fmtV(s.v)]))),
      card('Hari tersibuk', M.avg ? 'jumlah rata-rata per hari' : 'total periode', mkTable([H('HARI', { s: 1 }), H('NILAI', { r: 1 }), H('PORSI', { r: 1 })],
        byDow.map(x => [DAYS[x.d - 1], fmtV(x.v), pct(byDow.reduce((n, y) => n + y.v, 0) ? x.v / byDow.reduce((n, y) => n + y.v, 0) : null, 1)])))));
    body.append(card('Jam ramai per toko', 'jam puncak & rata-rata harian dari hari yang sudah tersinkron',
      mkTable([H('TOKO', { s: 1 }), H('JAM PUNCAK'), H('SLOT PUNCAK'), H('TRX / HARI', { r: 1 }), H('NET / HARI', { r: 1 }), H('PORSI 17–22', { r: 1 })], storeRows)));
  }

  /* ======================= PELANGGAN & MEMBER ======================= */
  V28.cust = { q: '', b2b: 'all', limit: 200 };
  async function renderPelanggan(memberHost = null) {
    const p = memberHost || pageHead('pelanggan', 'Pelanggan & Member', 'Hari kunjungan, transaksi dan top customer dari data Moka · ' + periodLabel());
    if (memberHost) {
      S.month = Number(S.month) || Number(MEM27.filter.month) || Number(todayWita().slice(5,7)); S.monthRange = null;
      const monthSelect = $('#f-month'); if (monthSelect) monthSelect.value = String(S.month);
      const pf = pageFilterBar('pelanggan');
      if (pf) p.append(pf);
      p.append(el('p', { class: 'note' }, 'Transaksi aktual Moka · ' + periodLabel() + '. Profil lengkap Customer List belum tersedia pada sumber V36; nomor telepon di data lama hanya 4 digit terakhir.'));
    }
    if (needData(p)) return;
    const { from, to } = periodDates(), ids = scopeStoreIds(), C = V28.cust;
    const body = el('div'); p.append(body); body.append(el('p', { class: 'note' }, 'Memuat pelanggan…'));
    let stats, freq, list;
    try {
      [stats, freq, list] = await Promise.all([
        DB.rpc('commercial_customer_stats_v1', { p_from: from, p_to: to, p_stores: ids }),
        DB.rpc('commercial_customer_freq_v1', { p_from: from, p_to: to, p_stores: ids }),
        DB.rpc('commercial_customers_v1', { p_from: from, p_to: to, p_stores: ids, p_query: C.b2b === 'b2b' && !C.q ? 'MK' : C.q || null, p_limit: C.b2b === 'all' ? C.limit : 2000 })]);
    } catch (e) { body.replaceChildren(); sqlMissing(body, e); return; }
    if ((!memberHost && S.page !== 'pelanggan') || (memberHost && (S.page !== 'members' || !memberHost.isConnected || MEM27.view !== 'monthly'))) return;
    body.replaceChildren();
    const s = stats[0] || {};
    if (!num(s.customers) && !num(s.walkin_trx)) { emptySync(body, 'Belum ada data pelanggan', 'Belum ada transaksi hasil sinkron pada filter ' + from + ' s.d. ' + to + '. Jalankan sinkron dan periksa filter toko.'); return; }
    const memberShare = (num(s.member_trx) + num(s.walkin_trx)) ? num(s.member_trx) / (num(s.member_trx) + num(s.walkin_trx)) : null;
    const tiles = el('div', { class: 'grid g4' });
    tiles.append(tile('Pelanggan unik', int(s.customers), String(int(s.new_customers)) + ' pelanggan baru pada periode ini', null),
      tile('Kembali ≥2 hari', pct(num(s.customers) ? num(s.repeat_customers) / num(s.customers) : null, 1), String(int(s.repeat_customers)) + ' pelanggan belanja ≥ 2 hari berbeda', null),
      tile('Akun B2B (MK…)', int(s.b2b_customers), 'nama diawali kode member MK', null),
      tile('Transaksi bernama', pct(memberShare, 1), String(int(s.member_trx)) + ' trx pelanggan · ' + String(int(s.walkin_trx)) + ' tanpa nama', null));
    body.append(tiles);
    const fTot = freq.reduce((n, r) => n + (num(r.customers) || 0), 0);
    body.append(el('div', { class: 'v28-two-col' },
      card('Frekuensi belanja', 'jumlah hari berbeda pelanggan bertransaksi; 2 transaksi di hari yang sama tetap 1 kunjungan',
        mkTable([H('KUNJUNGAN', { s: 1 }), H('PELANGGAN', { r: 1 }), H('PORSI', { r: 1 }), H('NET SALES', { r: 1 })],
          freq.map(r => [r.bucket, int(r.customers), pct(fTot ? num(r.customers) / fTot : null, 1), compact(r.net)]))),
      card('Pelanggan per kelompok', 'B2B vs retail pada daftar teratas',
        (() => { const b = list.filter(r => r.is_b2b), rt = list.filter(r => !r.is_b2b); return mkTable([H('KELOMPOK', { s: 1 }), H('PELANGGAN', { r: 1 }), H('TRANSAKSI', { r: 1 }), H('NET SALES', { r: 1 })],
          [['B2B / member MK', int(b.length), int(sum(b, r => r.trx)), compact(sum(b, r => r.net))], ['Retail bernama', int(rt.length), int(sum(rt, r => r.trx)), compact(sum(rt, r => r.net))]]); })())));
    const q = el('input', { type: 'search', placeholder: 'Cari nama / 4 digit HP', value: C.q, style: 'min-width:220px' });
    q.addEventListener('change', () => { C.q = q.value.trim(); renderPelanggan(); });
    const kind = opsSelect([['all', 'Semua pelanggan'], ['b2b', 'Hanya B2B (MK…)'], ['retail', 'Tanpa B2B']], C.b2b, { 'aria-label': 'Jenis pelanggan' });
    kind.onchange = () => { C.b2b = kind.value; renderPelanggan(); };
    const shown = list.filter(r => C.b2b === 'b2b' ? r.is_b2b : C.b2b === 'retail' ? !r.is_b2b : true).slice(0, C.b2b === 'all' ? C.limit : 500);
    const rows = shown.map((r, i) => [String(i + 1), el('span', {}, r.customer_name || '(tanpa nama)', r.is_b2b ? el('span', { class: 'v28-b2b' }, 'B2B') : null),
      r.phone_last4 ? '…' + r.phone_last4 : '—', r.stores || '—', int(r.visits), int(r.trx), compact(r.net), compact(num(r.trx) ? num(r.net) / num(r.trx) : null), r.last_date || '—']);
    body.append(card('Top pelanggan', 'urut net sales · ' + shown.length + ' pelanggan ditampilkan · HP hanya 4 digit terakhir',
      el('div', { class: 'v28-tools' }, el('div', { class: 'fld' }, el('label', {}, 'Cari'), q), el('div', { class: 'fld' }, el('label', {}, 'Jenis'), kind)),
      mkTable([H('#', { r: 1 }), H('PELANGGAN', { s: 1 }), H('HP'), H('TOKO'), H('KUNJUNGAN', { r: 1 }), H('TRANSAKSI', { r: 1 }), H('NET SALES', { r: 1 }), H('AOV', { r: 1 }), H('TERAKHIR')], rows)));
  }

  V28.renderMemberTransactions = renderPelanggan;

  /* ============================ KATALOG ITEM ============================ */

  /* ======================== AKSES PENGGUNA ======================== */
  async function renderAkses() {
    const p = $('#p-akses');
    if(window.AUTH58)return window.AUTH58.renderAccess(p);
    p.replaceChildren(el('div', { class: 'phead' }, el('div', {}, el('h1', {}, 'Akses Pengguna'), el('p', {}, 'Atur siapa yang boleh membuka aplikasi, menu dan toko apa saja yang terlihat.'))));
    if (S.demo || !S.key) { p.append(el('p', { class: 'note' }, 'Hubungkan Supabase terlebih dahulu.')); return; }
    if (!MASTER.verified) { try { await masterResume(); } catch { } }
    if (!isMaster()) { p.append(el('p', { class: 'note' }, 'Halaman ini khusus PIN master.'), masterLoginForm(() => renderAkses()).node); return; }
    const cfg = structuredClone(accessCfg());
    let users = [];
    try { users = await masterRpc('commercial_pin_list_v1'); } catch (e) { p.append(el('p', { class: 'note warn' }, e.message)); return; }
    const req = el('input', { type: 'checkbox' }); req.checked = !!cfg.required;
    const menuOpts = PAGES.filter(x => x.id && x.id !== 'akses').map(x => ({ value: x.id, label: x.t }));
    const storeOpts = S.stores.map(s => ({ value: String(s.id), label: s.name }));
    const list = el('div');
    list.append(el('div', { class: 'v28-access-row', style: 'font-weight:600;border-top:0' }, el('span', {}, 'PENGGUNA'), el('span', {}, 'MENU YANG TERLIHAT'), el('span', {}, 'TOKO YANG TERLIHAT'), el('span', {}, 'HANYA LIHAT'), el('span', {}, '')));
    for (const u of users) {
      const rule = cfg.users[String(u.id)] = Object.assign({ menus: [], stores: [], view_only: false }, cfg.users[String(u.id)] || {});
      if (u.role === 'master') { list.append(el('div', { class: 'v28-access-row' }, el('span', {}, el('b', {}, u.name), el('div', { class: 'sub' }, 'Master · akses penuh' + (u.enabled ? '' : ' · nonaktif'))), el('span', { class: 'sub' }, 'Semua menu'), el('span', { class: 'sub' }, 'Semua toko'), el('span', {}, '—'), el('span'))); continue; }
      const mBox = el('div'), sBox = el('div'), vo = el('input', { type: 'checkbox' }); vo.checked = !!rule.view_only;
      multiSelectDropdown(mBox, menuOpts, rule.menus, arr => { rule.menus = arr; }, { allLabel: 'Semua menu' });
      multiSelectDropdown(sBox, storeOpts, rule.stores.map(String), arr => { rule.stores = arr; }, { allLabel: 'Semua toko' });
      vo.onchange = () => { rule.view_only = vo.checked; };
      const sync=el('input',{type:'checkbox'});sync.checked=!!rule.can_sync;sync.onchange=()=>{rule.can_sync=sync.checked};mBox.append(el('label',{class:'rowline'},sync,'Boleh sinkron Moka'));
      const pii = el('input', { type: 'checkbox' }); pii.checked = !!rule.customer_pii; pii.onchange = () => { rule.customer_pii = pii.checked; };
      mBox.append(el('label', { class: 'rowline', style: 'margin-top:8px' }, pii, 'Lihat telepon customer lengkap'));
      const quick = el('div', { class: 'sub', style: 'display:flex;gap:6px;margin-top:4px' }, ...SEGMENT_BRANDS.map(b => el('button', { class: 'btn sm', type: 'button', onclick: () => { rule.stores = S.stores.filter(s => canonicalProductBrand(s.brand) === b).map(s => String(s.id)); multiSelectDropdown(sBox, storeOpts, rule.stores, arr => { rule.stores = arr; }, { allLabel: 'Semua toko' }); } }, 'Toko ' + b)));
      list.append(el('div', { class: 'v28-access-row' }, el('span', {}, el('b', {}, u.name), el('div', { class: 'sub' }, (u.role === 'editor' ? 'Editor' : u.role) + (u.enabled ? '' : ' · nonaktif'))), mBox, el('div', {}, sBox, quick), el('label', { class: 'rowline' }, vo, 'Viewer (hanya lihat)'), el('span')));
    }
    const err = el('p', { class: 'note warn', role: 'alert' });
    const save = el('button', { class: 'btn pri', type: 'button', onclick: async () => {
      save.disabled = true; err.textContent = '';
      try {
        cfg.required = req.checked;
        for (const [k, v] of Object.entries(cfg.users)) if (!users.some(u => String(u.id) === k)) delete cfg.users[k];
        await DB.write('app_settings', [{ key: ACCESS_KEY, value: JSON.stringify(cfg) }], 'key');
        S.settings[ACCESS_KEY] = JSON.stringify(cfg);
        toast('Akses pengguna disimpan.'); applyAccess(false);
      } catch (e) { err.textContent = e.message; } finally { save.disabled = false; }
    } }, 'Simpan akses');
    p.append(card('Pengaturan login', 'berlaku untuk semua perangkat',
      el('label', { class: 'rowline' }, req, el('b', {}, 'Wajib masuk dengan PIN untuk membuka aplikasi')),
      el('p', { class: 'note' }, 'Setiap orang memakai PIN miliknya sendiri. Buat atau nonaktifkan PIN lewat tombol Kelola PIN. Kosongkan pilihan menu/toko untuk memberi akses semua. "Hanya lihat" menyembunyikan menu upload/kelola dan menolak semua penyimpanan.'),
      el('p', { class: 'note' }, 'Akses cabang dan telepon pada transaksi Member V37 diperiksa di server. Pembatasan server untuk modul lama masih perlu diaudit sebelum aplikasi dibagikan lebih luas.'),
      el('div', { class: 'rowline' }, el('button', { class: 'btn', type: 'button', onclick: async () => { await masterPinManager(); } }, 'Kelola PIN (tambah / ubah pengguna)'),
        el('button', { class: 'btn', type: 'button', onclick: () => renderAkses() }, 'Muat ulang daftar'))));
    p.append(card('Hak akses per pengguna', users.length + ' PIN terdaftar', list, err, save));
  }

  /* ================= PRICE LIST: perbarui dari Moka ================= */
  if (typeof renderPriceListV24 === 'function') {
    const origPL = renderPriceListV24;
    renderPriceListV24 = async function () {
      await origPL.apply(this, arguments);
      const head = $('#p-pricelist .phead');
      if (head && !head.querySelector('[data-v28-pl]') && S.key && !S.demo && !viewOnly())
        head.append(el('button', { class: 'btn pri', 'data-v28-pl': '', type: 'button', onclick: priceFromMoka, title: 'Bangun Price List dari Library item Moka hasil sinkron terakhir' }, 'Perbarui dari Moka'));
    };
  }
  async function priceFromMoka(){return openSync({priceOnly:true});}
  V28.mokaLibraryDoc=async function(){throw Error('Katalog mentah tidak disimpan lagi. Gunakan Perbarui dari Moka untuk mengambil Price List langsung.');};

  /* ---------------------------------- muat ulang otomatis saat data baru */
  setInterval(async () => {
    if (!S.key || S.demo || !S.ready || document.visibilityState !== 'visible' || document.querySelector('.modal') || V28.active) return;
    try {
      const r = await DB.sel('app_settings?select=value&key=eq.commercial_moka_revision');
      const v = r[0]?.value;
      if (v && V28.revision && v !== V28.revision) { V28.revision = v; masterResetCaches(); await loadAll(); toast('Data Moka terbaru dimuat otomatis.'); }
      else if (v) V28.revision = v;
      else await loadRuns();
    } catch { }
  }, 60000);
  setInterval(() => { paintBadge(); }, 30000);

  /* start: data awal dimuat oleh init() lama sebelum file ini terpasang → tunggu lalu terapkan */
  async function postLoad() {
    V28.accessReady = true;
    try { if (S.key && !S.demo && !MASTER.verified) await masterResume(); } catch { }
    await loadRuns();
    try { localStorage.setItem('sc_v28_gate', accessCfg().required ? '1' : '0'); } catch { }
    applyAccess(false);
    render();
    resumeActive();
    V28.revision = S.settings?.commercial_moka_revision || null;
  }
  // cegah data tampil sekilas sebelum login (diingat dari kunjungan sebelumnya)
  try { if (S.key && localStorage.getItem('sc_v28_gate') === '1' && !document.querySelector('#v28-gate')) document.body.append(el('div', { id: 'v28-gate', class: 'v28-gate' }, el('div', { class: 'card' }, el('p', {}, 'Memuat…')))); } catch { }
  if (!S.key) { $('#v28-gate')?.remove(); paintBadge(); }
  else {
    const boot = setInterval(() => { if (S.ready || S.lastError) { clearInterval(boot); if (!S.ready) $('#v28-gate')?.remove(); postLoad(); } }, 400);
  }
})();
