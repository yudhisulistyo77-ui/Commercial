"""Durable, private Member staging. Never auto-retry authorization failures."""
import copy,hashlib,json,os,time
from moka_member_v47 import (CustomerService,MemberSourceError,profile,payment,customer_cursor_page,
 envelope,page_number,norm,CUSTOMER_PAGE_SIZE,MEMBER_PAGE_SIZE,sync as legacy_sync)

CHECKPOINT_EVERY=25

def rpc(db,name,args):
    try:return db.rpc(name,args)
    except Exception as e:
        raise MemberSourceError('Checkpoint Member gagal ('+type(e).__name__+'). Periksa MEMBER-RESUME-V48.sql, batas penyimpanan dan cakupan checkpoint; data utama tidak diganti.') from None

def sync(db,mapped,stores,aliases,periods,tz,writing=True,progress=None,api=None):
    if not writing:return legacy_sync(db,mapped,stores,aliases,periods,tz,False,progress,api)
    if db is None:raise MemberSourceError('Checkpoint Member memerlukan database privat.')
    api=api or CustomerService(os.environ.get('MOKA_CUSTOMER_ACCESS_TOKEN') or os.environ.get('MOKA_ACCESS_TOKEN'))
    mapping={}
    for name,sid in ([(r['name'],int(r['id'])) for r in stores]+[(r['alias'],int(r['store_id'])) for r in aliases]+[(o['name'],int(sid)) for o,sid in mapped]):
        k=norm(name)
        if k in mapping and mapping[k]!=sid:raise MemberSourceError('Alias outlet ambigu; perbaiki mapping toko.')
        mapping[k]=sid
    scopes=[{'store_id':sid,'date_from':a.isoformat(),'date_to':b.isoformat()} for sid in sorted({int(sid) for _,sid in mapped}) for _,_,a,b in periods]
    identity={'scopes':scopes,'mapping':sorted(mapping.items()),'outlets':sorted(str(o.get('id',o['name'])) for o,_ in mapped),'tz':str(tz),'version':48}
    key=hashlib.sha256(json.dumps(identity,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    initial={'phase':'customers','scopes':scopes,'cursor':None,'list_page':1,'index':0,'page':1,'pages':None,'count':None,'received':0,'unknown':0,'selected':0,'current_selected':0,'current_unknown':0}
    opened=rpc(db,'commercial_member_job_open_v48',{'p_key':key,'p_initial':initial,'p_force':os.environ.get('FORCE_REFRESH','').lower() in ('1','true','yes')})
    state=opened['state'];revision=opened['revision'];profiles=opened['profiles']
    saved_state=copy.deepcopy(state);pending_profiles=[];pending_events=[];finished=[];dirty=0;checkpoint_ok=True
    ids={p['customer_key'] for p in profiles}
    def save(reset_customer=None):
        nonlocal revision,saved_state,dirty,checkpoint_ok
        if not dirty:return
        checkpoint_ok=False
        r=rpc(db,'commercial_member_job_save_v48',{'p_key':key,'p_revision':revision,'p_state':copy.deepcopy(state),'p_profiles':pending_profiles[:],'p_events':pending_events[:],'p_finished':finished[:],'p_reset_customer':reset_customer})
        revision=r['revision'];saved_state=copy.deepcopy(state)
        pending_profiles.clear();pending_events.clear();finished.clear();dirty=0;checkpoint_ok=True
    print(f"Member checkpoint: fase {state['phase']}; {len(profiles)} profil tersimpan; {state['index']} customer selesai; {state['selected']} nota terpilih.",flush=True)
    try:
        while state['phase']=='customers':
            if state['list_page']>10000:raise MemberSourceError('Batas halaman Customer List tercapai. Checkpoint dipertahankan.')
            api.page_index=state['list_page'];params={'type':'ALL','per_page':CUSTOMER_PAGE_SIZE}
            if state['cursor'] is not None:params['cursor']=state['cursor']
            body=api.get('/customer/v3/customers',params);rows,cursor=customer_cursor_page(body)
            if cursor is not None and (cursor==state['cursor'] or not rows):raise MemberSourceError('Cursor berulang atau halaman lanjutan kosong; checkpoint dipertahankan.')
            new_profiles=[profile(r) for r in rows];new_keys=[p['customer_key'] for p in new_profiles]
            if len(new_keys)!=len(set(new_keys)) or set(new_keys)&ids:raise MemberSourceError('Customer ID/halaman berulang; checkpoint dipertahankan.')
            if not profiles and not new_profiles and cursor is None:raise MemberSourceError('Customer List kosong; data utama dipertahankan.')
            for p in new_profiles:
                profiles.append(p);ids.add(p['customer_key']);pending_profiles.append({'ordinal':len(profiles),'profile':p})
            state['cursor']=cursor;state['list_page']+=1
            if cursor is None:state['phase']='history'
            dirty+=1
            if dirty>=CHECKPOINT_EVERY or state['phase']=='history':save()
            if (state['list_page']-1)%100==0:print(f"Member: {len(profiles)} profil terbaca; checkpoint terakhir halaman {saved_state['list_page']-1}.",flush=True)
        if progress:progress(state['index'],len(profiles),state['selected'])
        while state['phase']=='history' and state['index']<len(profiles):
            p=profiles[state['index']];api.customer_ordinal=state['index']+1;api.page_index=state['page']
            if state['page']>10000:raise MemberSourceError('Batas halaman riwayat tercapai; checkpoint dipertahankan.')
            body=api.get('/customer/v1/customers/'+p['source_id']+'/payments',{'page':state['page'],'per_page':MEMBER_PAGE_SIZE})
            raw_rows,pages,count=envelope(body,'payments');pages=page_number(pages,'total_pages');count=page_number(count,'total_count')
            if state['page']>1 and (count!=state['count'] or pages!=state['pages']):
                save()
                state['selected']-=state['current_selected'];state['unknown']-=state['current_unknown']
                state.update(page=1,pages=None,count=None,received=0,current_selected=0,current_unknown=0)
                dirty=1;save(reset_customer=p['customer_key'])
                raise MemberSourceError('Jumlah riwayat berubah. Checkpoint customer ini direset ke halaman 1; progres customer lain tetap. Jalankan lagi dengan cakupan sama.')
            if (count==0 and (raw_rows or pages not in (0,1))) or (count>0 and (not raw_rows or pages<state['page'])):raise MemberSourceError('Pagination riwayat terpotong; checkpoint dipertahankan.')
            received=state['received']+len(raw_rows)
            done=count==0 or state['page']==pages
            if received>count or (done and received!=count):raise MemberSourceError('Jumlah nota tidak sama dengan total_count; checkpoint dipertahankan.')
            # Validate the entire page before changing checkpoint buffers/state.
            events=[];unknown=0;selected=0;page_ids=set()
            for raw in raw_rows:
                row=payment(raw,p,mapping,tz);uid=row['transaction_id']
                if uid in page_ids:raise MemberSourceError('UUID ganda pada halaman riwayat; checkpoint dipertahankan.')
                page_ids.add(uid)
                selected_scope=any(row['store_id']==s['store_id'] and s['date_from']<=row['sale_date']<=s['date_to'] for s in scopes)
                if row['store_id'] is None and any(s['date_from']<=row['sale_date']<=s['date_to'] for s in scopes):unknown+=1
                events.append({'uuid':uid,'customer_key':p['customer_key'],'payload':row if selected_scope else None});selected+=int(selected_scope)
            pending_events.extend(events);state['selected']+=selected;state['unknown']+=unknown;state['current_selected']+=selected;state['current_unknown']+=unknown
            state.update(count=count,pages=pages,received=received,page=state['page']+1)
            if done:
                finished.append(p['customer_key']);state.update(index=state['index']+1,page=1,pages=None,count=None,received=0,current_selected=0,current_unknown=0)
                if state['index']==len(profiles):state['phase']='ready'
            dirty+=1
            if dirty>=CHECKPOINT_EVERY or state['phase']=='ready':save()
            if progress and done and (state['index']%25==0 or state['phase']=='ready'):progress(state['index'],len(profiles),state['selected'])
        if state['phase']!='ready':raise MemberSourceError('Checkpoint belum siap dipublikasikan.')
        result=rpc(db,'commercial_member_job_publish_v48',{'p_key':key,'p_revision':revision})
        return {'status':'WARN' if result['unmapped_payments'] else 'OK','customers':result['customers'],'receipts':result['receipts'],'unmapped_payments':result['unmapped_payments'],'http_requests':api.requests}
    except Exception as e:
        if dirty and checkpoint_ok:
            try:save()
            except MemberSourceError:
                raise MemberSourceError('Proses berhenti dan penyimpanan progres terakhir gagal. Checkpoint sebelumnya tetap tersedia; data utama dipertahankan.') from None
        if isinstance(e,MemberSourceError):
            raise MemberSourceError(str(e)+f" Checkpoint tersimpan: fase {saved_state['phase']}, halaman daftar {saved_state['list_page']-1}, customer selesai {saved_state['index']}. Lanjutkan dengan toko/rentang yang sama tanpa tarik ulang paksa setelah akses pulih.") from None
        raise MemberSourceError('Pemrosesan Member berhenti ('+type(e).__name__+'); checkpoint terakhir dipertahankan, data utama tidak diganti.') from None
