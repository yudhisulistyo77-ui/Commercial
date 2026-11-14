-- Jalankan TERAKHIR setelah akun Master Auth dan frontend baru diuji.
begin;
set local lock_timeout='10s';
do $$begin
 if not exists(select 1 from commercial_private.auth_links_v58 l join commercial_private.pins p on p.id=l.pin_id join auth.users u on u.id=l.user_id where p.enabled and l.access_role='master' and u.deleted_at is null and u.email_confirmed_at is not null and (u.banned_until is null or u.banned_until<=now())) then raise exception 'Master Auth aktif belum tersedia. Jangan menutup login lama.';end if;
end $$;
create table if not exists commercial_private.auth_resources_v58(name text primary key,menus text[] not null,write_allowed boolean not null default false);
revoke all on commercial_private.auth_resources_v58 from public,anon,authenticated;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('app_settings',array['bazar','brand','dash','datatrack','h2h','item','jam','kpi','links','members','mkt','pdca','present','pricelist','program','review','sales','schedule','set','tasks','top','trx','upload','uploadreset'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('brand_targets',array['brand','dash','h2h','mkt','pdca','program','sales','trx','upload'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('category_brand',array['brand','dash','h2h','item','program','top','upload'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('channel_targets',array['brand','dash','h2h','mkt','pdca','program','sales','trx','upload'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_auth_session_v58',array['bazar','brand','dash','datatrack','h2h','item','jam','kpi','links','members','mkt','pdca','present','pricelist','program','review','sales','schedule','set','tasks','top','trx','upload','uploadreset'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_auth_users_v58',array['akses'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_bazar_invoices',array['bazar'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_bazar_targets',array['bazar'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_bazar_write_v10',array['bazar'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_brand_monthly_v38',array['brand','dash','h2h','item','mkt','pdca','program','sales','top','trx','upload'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_brand_store_cache',array['brand','dash','h2h','item','program','top','upload'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_brand_stores_v1',array['bazar','brand','dash','datatrack','h2h','item','jam','kpi','links','members','mkt','pdca','present','pricelist','program','review','sales','schedule','set','tasks','top','trx','upload','uploadreset'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_comparison_rollup_v10',array['brand','dash','h2h','item','program','top','upload'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_coverage_v1',array['bazar','brand','dash','datatrack','h2h','item','jam','kpi','links','members','mkt','pdca','present','pricelist','program','review','sales','schedule','set','tasks','top','trx','upload','uploadreset'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_customer_daily_v47',array['members'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_customer_freq_v1',array['members'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_customer_stats_v1',array['members'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_customers_v1',array['members'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_heatmap_v1',array['jam'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_item_data_v1',array['brand','dash','h2h','item','program','top','upload'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_item_detail_v16',array['brand','dash','h2h','item','program','top','upload'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_item_group_v51',array['brand','dash','h2h','item','program','top','upload'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_item_rollup_v1',array['brand','dash','h2h','item','program','top','upload'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_item_rows_v1',array['brand','dash','h2h','item','program','top','upload'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_master_catalog_v1',array['set','upload'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_master_mutate_v1',array['bazar','brand','dash','datatrack','h2h','item','jam','kpi','links','members','mkt','pdca','present','pricelist','program','review','sales','schedule','set','tasks','top','trx','upload','uploadreset'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_master_rows_v1',array['set','upload'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_master_settings_delete_v1',array['bazar','brand','dash','datatrack','h2h','item','jam','kpi','links','members','mkt','pdca','present','pricelist','program','review','sales','schedule','set','tasks','top','trx','upload','uploadreset'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_master_settings_save_v1',array['bazar','brand','dash','datatrack','h2h','item','jam','kpi','links','members','mkt','pdca','present','pricelist','program','review','sales','schedule','set','tasks','top','trx','upload','uploadreset'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_master_settings_snapshot_v1',array['bazar','brand','dash','datatrack','h2h','item','jam','kpi','links','members','mkt','pdca','present','pricelist','program','review','sales','schedule','set','tasks','top','trx','upload','uploadreset'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_member_cities_v51',array['members'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_member_complete_v47',array['members'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_member_customer_v51',array['members'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_member_data_v27',array['members'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_member_detail_v47',array['members'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_member_directory_v51',array['members'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_member_items_v51',array['members'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_member_manual_detail_v47',array['members'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_member_manual_view_v47',array['members'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_member_monthly_v37',array['members'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_member_profiles_v47',array['members'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_member_receipt_items_v51',array['members'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_member_search_v51',array['members'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_member_snapshot_v27',array['members'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_member_sssg_v51',array['members'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_member_view_agent_v41',array['members'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_member_view_detail_v39',array['members'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_member_view_profile_v40',array['members'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_member_view_v38',array['members'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_member_view_v39',array['members'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_moka_outlets_v35',array['bazar','brand','dash','datatrack','h2h','item','jam','kpi','links','members','mkt','pdca','present','pricelist','program','review','sales','schedule','set','tasks','top','trx','upload','uploadreset'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_pin_session_v1',array['bazar','brand','dash','datatrack','h2h','item','jam','kpi','links','members','mkt','pdca','present','pricelist','program','review','sales','schedule','set','tasks','top','trx','upload','uploadreset'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_price_list_save_v24',array['pricelist'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_price_list_v24',array['pricelist'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_program_item_catalog_v1',array['program'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_program_item_rollup_v1',array['program'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_scope_v38',array['bazar','brand','dash','datatrack','h2h','item','jam','kpi','links','members','mkt','pdca','present','pricelist','program','review','sales','schedule','set','tasks','top','trx','upload','uploadreset'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('commercial_trx_sales_v1',array['brand','dash','h2h','mkt','pdca','program','sales','trx','upload'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('ingest_log',array['dash','datatrack','upload','uploadreset'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('item_categories',array['brand','dash','h2h','item','program','top','upload'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('item_categories_scoped',array['brand','dash','h2h','item','program','top','upload'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('item_rollup',array['brand','dash','h2h','item','program','top','upload'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('item_sales',array['brand','dash','h2h','item','program','top','upload'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('item_top',array['brand','dash','h2h','item','program','top','upload'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('item_totals',array['brand','dash','h2h','item','program','top','upload'],false) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('kpi_entries',array['kpi'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('kpi_metrics',array['kpi'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('kpi_weekly',array['kpi'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('moka_customer_daily',array['members'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('moka_customer_profiles_v37',array['members'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('moka_customers_v47',array['members'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('moka_hourly',array['jam'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('moka_member_coverage_v39',array['members'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('moka_member_coverage_v47',array['members'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('moka_member_detail_v39',array['members'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('moka_member_items_v51',array['members'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('moka_member_jobs_v48',array['members'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('moka_member_stage_events_v48',array['members'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('moka_member_stage_profiles_v48',array['members'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('moka_purchase_history_v47',array['members'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('moka_sales_type_daily',array['brand','dash','h2h','mkt','pdca','program','sales','trx','upload'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('moka_sync_coverage',array['dash','datatrack','jam','members'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('moka_sync_runs',array['bazar','brand','dash','datatrack','h2h','item','jam','kpi','links','members','mkt','pdca','present','pricelist','program','review','sales','schedule','set','tasks','top','trx','upload','uploadreset'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('moka_walkin_daily',array['jam','members'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('pdca',array['pdca'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('people',array['bazar','brand','dash','datatrack','h2h','item','jam','kpi','links','members','mkt','pdca','present','pricelist','program','review','sales','schedule','set','tasks','top','trx','upload','uploadreset'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('pica',array['pdca','tasks'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('product_master',array['brand','dash','h2h','item','program','top','upload'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('rebuild_sales_actual',array['brand','dash','h2h','mkt','pdca','program','sales','trx','upload'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('recompute_item_enrich',array['brand','dash','h2h','item','program','top','upload'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('sales_actual',array['brand','dash','h2h','mkt','pdca','program','sales','trx','upload'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('sales_type_map',array['brand','dash','h2h','mkt','pdca','program','sales','trx','upload'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('sales_type_raw',array['brand','dash','h2h','mkt','pdca','program','sales','trx','upload'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('store_aliases',array['bazar','brand','dash','datatrack','h2h','item','jam','kpi','links','members','mkt','pdca','present','pricelist','program','review','sales','schedule','set','tasks','top','trx','upload','uploadreset'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('store_marketplace_override',array['dash','mkt','sales'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('stores',array['bazar','brand','dash','datatrack','h2h','item','jam','kpi','links','members','mkt','pdca','present','pricelist','program','review','sales','schedule','set','tasks','top','trx','upload','uploadreset'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('targets',array['brand','dash','h2h','mkt','pdca','program','sales','trx','upload'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('transaksi',array['brand','dash','h2h','mkt','pdca','program','sales','trx','upload'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('v_growth',array['brand','dash','h2h','mkt','pdca','program','sales','trx','upload'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('v_item_enriched',array['brand','dash','h2h','item','program','top','upload'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('v_marketplace',array['brand','dash','h2h','mkt','pdca','program','sales','trx','upload'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('v_sales_dashboard',array['brand','dash','h2h','mkt','pdca','program','sales','trx','upload'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('v_transaksi',array['brand','dash','h2h','mkt','pdca','program','sales','trx','upload'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;
insert into commercial_private.auth_resources_v58(name,menus,write_allowed) values('v_unmapped_sales_type',array['brand','dash','h2h','mkt','pdca','program','sales','trx','upload'],true) on conflict(name) do update set menus=excluded.menus,write_allowed=excluded.write_allowed;

create or replace function commercial_private.auth_context_v58() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare cached text;
begin
 cached:=current_setting('commercial.auth_context_v58',true);
 if cached is not null and cached<>'' then return cached::jsonb;end if;
 if commercial_private.auth_pin_v58() is null then return '{}'::jsonb;end if;
 return public.commercial_auth_session_v58();
end $$;
create or replace function commercial_private.auth_resource_v58(p_name text,p_context jsonb) returns boolean language sql stable security definer set search_path='' as $$
 select case when p_context->>'role'='master' then true
 when p_context->>'id' is null then false
 when jsonb_array_length(coalesce(p_context->'rule'->'menus','[]'::jsonb))=0 then exists(select 1 from commercial_private.auth_resources_v58 where name=p_name)
 else exists(select 1 from commercial_private.auth_resources_v58 r where r.name=p_name and exists(select 1 from unnest(r.menus) m where coalesce(p_context->'rule'->'menus','[]'::jsonb) ? m or (m='members' and coalesce(p_context->'rule'->'menus','[]'::jsonb) ? 'pelanggan'))) end
$$;
create or replace function public.commercial_auth_row_v58(p_table text,p_row jsonb,p_write boolean default false) returns boolean language plpgsql stable security definer set search_path='' as $$
declare ctx jsonb;stores jsonb;sid text;k text;menus text[];v jsonb;
begin
 if not (select enabled from commercial_private.auth_config_v58 where id) then return true;end if;
 if coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb->>'role'='service_role' then return true;end if;
 ctx:=commercial_private.auth_context_v58();if ctx->>'id' is null then return false;end if;
 if ctx->>'role'='master' then return true;end if;
 if p_write and (ctx->>'access_role'='viewer' or coalesce((ctx->'rule'->>'view_only')::boolean,false)) then return false;end if;
 if not commercial_private.auth_resource_v58(p_table,ctx) then return false;end if;
 if p_write and p_table=any(array['stores','store_aliases','people','sales_type_map','product_master','category_brand','kpi_metrics']) then return false;end if;
 if p_table='app_settings' then
  k:=p_row->>'key';
  if p_write and (k='kpi_access_v28' or k is null or k !~ '^(ops_v1_|google_review_v1_|sales_programs_json$|program_sales_type_categories$|ops_color_map$|kpi_)') then return false;end if;
  if k like 'ops_v1_task_%' or k like 'ops_v1_daily_notes_%' then menus:=array['tasks'];
  elsif k like 'ops_v1_schedule_%' then menus:=array['schedule'];
  elsif k like 'ops_v1_link_%' then menus:=array['links'];
  elsif k like 'ops_v1_present_%' then menus:=array['present'];
  elsif k like 'google_review_v1_%' then menus:=array['review'];
  elsif k in ('sales_programs_json','program_sales_type_categories') then menus:=array['program'];
  elsif k like 'ops_v1_pica_%' then menus:=array['pdca','tasks'];
  elsif k like 'kpi_%' and k<>'kpi_access_v28' then menus:=array['kpi'];
  end if;
  if menus is not null and jsonb_array_length(coalesce(ctx->'rule'->'menus','[]'::jsonb))>0 and not exists(select 1 from unnest(menus) m where ctx->'rule'->'menus' ? m) then return false;end if;
 end if;
 stores:=coalesce(ctx->'rule'->'stores','[]'::jsonb);
 -- Whole legacy profiling documents cannot be safely split by a store policy.
 if p_table='commercial_member_data_v27' then return jsonb_array_length(stores)=0 and coalesce((ctx->'rule'->>'customer_pii')::boolean,false);end if;
 if p_table='commercial_price_list_v24' and jsonb_array_length(stores)>0 then return exists(select 1 from public.stores t where stores ? t.id::text and lower(btrim(t.name))=lower(btrim(p_row->>'outlet'))) or exists(select 1 from public.store_aliases a where stores ? a.store_id::text and lower(btrim(a.alias))=lower(btrim(p_row->>'outlet')));end if;
 if jsonb_array_length(stores)=0 then return true;end if;
 sid:=case when p_table='stores' then p_row->>'id' else p_row->>'store_id' end;
 if sid is not null then return stores ? sid;end if;
 if p_table='app_settings' then
  if k ~ '^google_review_v1_(day|month|store)_[0-9]+' then return stores ? substring(k from '^google_review_v1_(?:day|month|store)_([0-9]+)');end if;
  begin v:=(p_row->>'value')::jsonb;exception when others then v:=null;end;
  if v->>'store_id' is not null then return stores ? (v->>'store_id');end if;
 end if;
 -- Shared lookup/configuration rows contain no single-store fact.
 return p_table=any(array['app_settings','people','category_brand','product_master','sales_type_map','kpi_metrics','kpi_weekly','pdca','pica','commercial_bazar_invoices','commercial_bazar_targets','moka_sync_runs','commercial_price_list_v24']);
end $$;
revoke all on function public.commercial_auth_row_v58(text,jsonb,boolean) from public,anon;
grant execute on function public.commercial_auth_row_v58(text,jsonb,boolean) to authenticated;

-- Hook checks mapped identity on every Data API request. JWT validation is performed by Supabase.
create or replace function public.commercial_auth_gate_v58() returns void language plpgsql security definer set search_path='' as $$
declare claims jsonb;ctx jsonb;path text;resource text;method text;reading boolean;
begin
 if not (select enabled from commercial_private.auth_config_v58 where id) then return;end if;
 claims:=coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
 if claims->>'role'='service_role' then return;end if;
 if claims->>'role' is distinct from 'authenticated' or auth.uid() is null then raise exception 'Login akun aplikasi diperlukan.' using errcode='42501';end if;
 ctx:=public.commercial_auth_session_v58();perform set_config('commercial.auth_context_v58',ctx::text,true);
 path:=coalesce(current_setting('request.path',true),'');method:=coalesce(current_setting('request.method',true),'GET');resource:=regexp_replace(path,'^.*/','');
 if resource like 'commercial_pin_%' and resource<>'commercial_pin_session_v1' then raise exception 'Kelola akses melalui akun Auth.' using errcode='42501';end if;
 if ctx->>'role'='master' then return;end if;
 if not commercial_private.auth_resource_v58(resource,ctx) then raise exception 'Menu atau endpoint tidak diizinkan.' using errcode='42501';end if;
 reading:=method in ('GET','HEAD','OPTIONS');
 if path like '%/rpc/%' then select not write_allowed into reading from commercial_private.auth_resources_v58 where name=resource;end if;
 if not coalesce(reading,false) and (ctx->>'access_role'='viewer' or coalesce((ctx->'rule'->>'view_only')::boolean,false)) then raise exception 'Viewer hanya dapat membaca data.' using errcode='42501';end if;
end $$;
revoke all on function public.commercial_auth_gate_v58() from public,anon;
grant execute on function public.commercial_auth_gate_v58() to authenticated,anon,service_role;

-- Restrictive policies are ANDed with old permissive policies, never replaced with another OR grant.
alter table public."app_settings" enable row level security;
drop policy if exists auth_v58_select on public."app_settings";
create policy auth_v58_select on public."app_settings" as restrictive for select to authenticated using(public.commercial_auth_row_v58('app_settings',jsonb_build_object('key',key,'value',value),false));
drop policy if exists auth_v58_insert on public."app_settings";
create policy auth_v58_insert on public."app_settings" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('app_settings',jsonb_build_object('key',key,'value',value),true));
drop policy if exists auth_v58_update on public."app_settings";
create policy auth_v58_update on public."app_settings" as restrictive for update to authenticated using(public.commercial_auth_row_v58('app_settings',jsonb_build_object('key',key,'value',value),true)) with check(public.commercial_auth_row_v58('app_settings',jsonb_build_object('key',key,'value',value),true));
drop policy if exists auth_v58_delete on public."app_settings";
create policy auth_v58_delete on public."app_settings" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('app_settings',jsonb_build_object('key',key,'value',value),true));
alter table public."brand_targets" enable row level security;
drop policy if exists auth_v58_select on public."brand_targets";
create policy auth_v58_select on public."brand_targets" as restrictive for select to authenticated using(public.commercial_auth_row_v58('brand_targets','{}'::jsonb,false));
drop policy if exists auth_v58_insert on public."brand_targets";
create policy auth_v58_insert on public."brand_targets" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('brand_targets','{}'::jsonb,true));
drop policy if exists auth_v58_update on public."brand_targets";
create policy auth_v58_update on public."brand_targets" as restrictive for update to authenticated using(public.commercial_auth_row_v58('brand_targets','{}'::jsonb,true)) with check(public.commercial_auth_row_v58('brand_targets','{}'::jsonb,true));
drop policy if exists auth_v58_delete on public."brand_targets";
create policy auth_v58_delete on public."brand_targets" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('brand_targets','{}'::jsonb,true));
alter table public."category_brand" enable row level security;
drop policy if exists auth_v58_select on public."category_brand";
create policy auth_v58_select on public."category_brand" as restrictive for select to authenticated using(public.commercial_auth_row_v58('category_brand','{}'::jsonb,false));
drop policy if exists auth_v58_insert on public."category_brand";
create policy auth_v58_insert on public."category_brand" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('category_brand','{}'::jsonb,true));
drop policy if exists auth_v58_update on public."category_brand";
create policy auth_v58_update on public."category_brand" as restrictive for update to authenticated using(public.commercial_auth_row_v58('category_brand','{}'::jsonb,true)) with check(public.commercial_auth_row_v58('category_brand','{}'::jsonb,true));
drop policy if exists auth_v58_delete on public."category_brand";
create policy auth_v58_delete on public."category_brand" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('category_brand','{}'::jsonb,true));
alter table public."channel_targets" enable row level security;
drop policy if exists auth_v58_select on public."channel_targets";
create policy auth_v58_select on public."channel_targets" as restrictive for select to authenticated using(public.commercial_auth_row_v58('channel_targets',jsonb_build_object('store_id',store_id),false));
drop policy if exists auth_v58_insert on public."channel_targets";
create policy auth_v58_insert on public."channel_targets" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('channel_targets',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_update on public."channel_targets";
create policy auth_v58_update on public."channel_targets" as restrictive for update to authenticated using(public.commercial_auth_row_v58('channel_targets',jsonb_build_object('store_id',store_id),true)) with check(public.commercial_auth_row_v58('channel_targets',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_delete on public."channel_targets";
create policy auth_v58_delete on public."channel_targets" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('channel_targets',jsonb_build_object('store_id',store_id),true));
alter table public."commercial_bazar_invoices" enable row level security;
drop policy if exists auth_v58_select on public."commercial_bazar_invoices";
create policy auth_v58_select on public."commercial_bazar_invoices" as restrictive for select to authenticated using(public.commercial_auth_row_v58('commercial_bazar_invoices','{}'::jsonb,false));
drop policy if exists auth_v58_insert on public."commercial_bazar_invoices";
create policy auth_v58_insert on public."commercial_bazar_invoices" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('commercial_bazar_invoices','{}'::jsonb,true));
drop policy if exists auth_v58_update on public."commercial_bazar_invoices";
create policy auth_v58_update on public."commercial_bazar_invoices" as restrictive for update to authenticated using(public.commercial_auth_row_v58('commercial_bazar_invoices','{}'::jsonb,true)) with check(public.commercial_auth_row_v58('commercial_bazar_invoices','{}'::jsonb,true));
drop policy if exists auth_v58_delete on public."commercial_bazar_invoices";
create policy auth_v58_delete on public."commercial_bazar_invoices" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('commercial_bazar_invoices','{}'::jsonb,true));
alter table public."commercial_bazar_targets" enable row level security;
drop policy if exists auth_v58_select on public."commercial_bazar_targets";
create policy auth_v58_select on public."commercial_bazar_targets" as restrictive for select to authenticated using(public.commercial_auth_row_v58('commercial_bazar_targets','{}'::jsonb,false));
drop policy if exists auth_v58_insert on public."commercial_bazar_targets";
create policy auth_v58_insert on public."commercial_bazar_targets" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('commercial_bazar_targets','{}'::jsonb,true));
drop policy if exists auth_v58_update on public."commercial_bazar_targets";
create policy auth_v58_update on public."commercial_bazar_targets" as restrictive for update to authenticated using(public.commercial_auth_row_v58('commercial_bazar_targets','{}'::jsonb,true)) with check(public.commercial_auth_row_v58('commercial_bazar_targets','{}'::jsonb,true));
drop policy if exists auth_v58_delete on public."commercial_bazar_targets";
create policy auth_v58_delete on public."commercial_bazar_targets" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('commercial_bazar_targets','{}'::jsonb,true));
alter table public."commercial_brand_store_cache" enable row level security;
drop policy if exists auth_v58_select on public."commercial_brand_store_cache";
create policy auth_v58_select on public."commercial_brand_store_cache" as restrictive for select to authenticated using(public.commercial_auth_row_v58('commercial_brand_store_cache',jsonb_build_object('store_id',store_id),false));
drop policy if exists auth_v58_insert on public."commercial_brand_store_cache";
create policy auth_v58_insert on public."commercial_brand_store_cache" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('commercial_brand_store_cache',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_update on public."commercial_brand_store_cache";
create policy auth_v58_update on public."commercial_brand_store_cache" as restrictive for update to authenticated using(public.commercial_auth_row_v58('commercial_brand_store_cache',jsonb_build_object('store_id',store_id),true)) with check(public.commercial_auth_row_v58('commercial_brand_store_cache',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_delete on public."commercial_brand_store_cache";
create policy auth_v58_delete on public."commercial_brand_store_cache" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('commercial_brand_store_cache',jsonb_build_object('store_id',store_id),true));
alter table public."commercial_master_audit" enable row level security;
drop policy if exists auth_v58_select on public."commercial_master_audit";
create policy auth_v58_select on public."commercial_master_audit" as restrictive for select to authenticated using(public.commercial_auth_row_v58('commercial_master_audit','{}'::jsonb,false));
drop policy if exists auth_v58_insert on public."commercial_master_audit";
create policy auth_v58_insert on public."commercial_master_audit" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('commercial_master_audit','{}'::jsonb,true));
drop policy if exists auth_v58_update on public."commercial_master_audit";
create policy auth_v58_update on public."commercial_master_audit" as restrictive for update to authenticated using(public.commercial_auth_row_v58('commercial_master_audit','{}'::jsonb,true)) with check(public.commercial_auth_row_v58('commercial_master_audit','{}'::jsonb,true));
drop policy if exists auth_v58_delete on public."commercial_master_audit";
create policy auth_v58_delete on public."commercial_master_audit" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('commercial_master_audit','{}'::jsonb,true));
alter table public."commercial_master_users" enable row level security;
drop policy if exists auth_v58_select on public."commercial_master_users";
create policy auth_v58_select on public."commercial_master_users" as restrictive for select to authenticated using(public.commercial_auth_row_v58('commercial_master_users','{}'::jsonb,false));
drop policy if exists auth_v58_insert on public."commercial_master_users";
create policy auth_v58_insert on public."commercial_master_users" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('commercial_master_users','{}'::jsonb,true));
drop policy if exists auth_v58_update on public."commercial_master_users";
create policy auth_v58_update on public."commercial_master_users" as restrictive for update to authenticated using(public.commercial_auth_row_v58('commercial_master_users','{}'::jsonb,true)) with check(public.commercial_auth_row_v58('commercial_master_users','{}'::jsonb,true));
drop policy if exists auth_v58_delete on public."commercial_master_users";
create policy auth_v58_delete on public."commercial_master_users" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('commercial_master_users','{}'::jsonb,true));
alter table public."commercial_member_data_v27" enable row level security;
drop policy if exists auth_v58_select on public."commercial_member_data_v27";
create policy auth_v58_select on public."commercial_member_data_v27" as restrictive for select to authenticated using(public.commercial_auth_row_v58('commercial_member_data_v27','{}'::jsonb,false));
drop policy if exists auth_v58_insert on public."commercial_member_data_v27";
create policy auth_v58_insert on public."commercial_member_data_v27" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('commercial_member_data_v27','{}'::jsonb,true));
drop policy if exists auth_v58_update on public."commercial_member_data_v27";
create policy auth_v58_update on public."commercial_member_data_v27" as restrictive for update to authenticated using(public.commercial_auth_row_v58('commercial_member_data_v27','{}'::jsonb,true)) with check(public.commercial_auth_row_v58('commercial_member_data_v27','{}'::jsonb,true));
drop policy if exists auth_v58_delete on public."commercial_member_data_v27";
create policy auth_v58_delete on public."commercial_member_data_v27" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('commercial_member_data_v27','{}'::jsonb,true));
alter table public."commercial_price_list_v24" enable row level security;
drop policy if exists auth_v58_select on public."commercial_price_list_v24";
create policy auth_v58_select on public."commercial_price_list_v24" as restrictive for select to authenticated using(public.commercial_auth_row_v58('commercial_price_list_v24',jsonb_build_object('outlet',outlet,'city',city),false));
drop policy if exists auth_v58_insert on public."commercial_price_list_v24";
create policy auth_v58_insert on public."commercial_price_list_v24" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('commercial_price_list_v24',jsonb_build_object('outlet',outlet,'city',city),true));
drop policy if exists auth_v58_update on public."commercial_price_list_v24";
create policy auth_v58_update on public."commercial_price_list_v24" as restrictive for update to authenticated using(public.commercial_auth_row_v58('commercial_price_list_v24',jsonb_build_object('outlet',outlet,'city',city),true)) with check(public.commercial_auth_row_v58('commercial_price_list_v24',jsonb_build_object('outlet',outlet,'city',city),true));
drop policy if exists auth_v58_delete on public."commercial_price_list_v24";
create policy auth_v58_delete on public."commercial_price_list_v24" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('commercial_price_list_v24',jsonb_build_object('outlet',outlet,'city',city),true));
alter table public."ingest_log" enable row level security;
drop policy if exists auth_v58_select on public."ingest_log";
create policy auth_v58_select on public."ingest_log" as restrictive for select to authenticated using(public.commercial_auth_row_v58('ingest_log',jsonb_build_object('store_id',store_id),false));
drop policy if exists auth_v58_insert on public."ingest_log";
create policy auth_v58_insert on public."ingest_log" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('ingest_log',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_update on public."ingest_log";
create policy auth_v58_update on public."ingest_log" as restrictive for update to authenticated using(public.commercial_auth_row_v58('ingest_log',jsonb_build_object('store_id',store_id),true)) with check(public.commercial_auth_row_v58('ingest_log',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_delete on public."ingest_log";
create policy auth_v58_delete on public."ingest_log" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('ingest_log',jsonb_build_object('store_id',store_id),true));
alter table public."item_sales" enable row level security;
drop policy if exists auth_v58_select on public."item_sales";
create policy auth_v58_select on public."item_sales" as restrictive for select to authenticated using(public.commercial_auth_row_v58('item_sales',jsonb_build_object('store_id',store_id),false));
drop policy if exists auth_v58_insert on public."item_sales";
create policy auth_v58_insert on public."item_sales" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('item_sales',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_update on public."item_sales";
create policy auth_v58_update on public."item_sales" as restrictive for update to authenticated using(public.commercial_auth_row_v58('item_sales',jsonb_build_object('store_id',store_id),true)) with check(public.commercial_auth_row_v58('item_sales',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_delete on public."item_sales";
create policy auth_v58_delete on public."item_sales" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('item_sales',jsonb_build_object('store_id',store_id),true));
alter table public."kpi_entries" enable row level security;
drop policy if exists auth_v58_select on public."kpi_entries";
create policy auth_v58_select on public."kpi_entries" as restrictive for select to authenticated using(public.commercial_auth_row_v58('kpi_entries',jsonb_build_object('store_id',store_id),false));
drop policy if exists auth_v58_insert on public."kpi_entries";
create policy auth_v58_insert on public."kpi_entries" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('kpi_entries',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_update on public."kpi_entries";
create policy auth_v58_update on public."kpi_entries" as restrictive for update to authenticated using(public.commercial_auth_row_v58('kpi_entries',jsonb_build_object('store_id',store_id),true)) with check(public.commercial_auth_row_v58('kpi_entries',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_delete on public."kpi_entries";
create policy auth_v58_delete on public."kpi_entries" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('kpi_entries',jsonb_build_object('store_id',store_id),true));
alter table public."kpi_metrics" enable row level security;
drop policy if exists auth_v58_select on public."kpi_metrics";
create policy auth_v58_select on public."kpi_metrics" as restrictive for select to authenticated using(public.commercial_auth_row_v58('kpi_metrics','{}'::jsonb,false));
drop policy if exists auth_v58_insert on public."kpi_metrics";
create policy auth_v58_insert on public."kpi_metrics" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('kpi_metrics','{}'::jsonb,true));
drop policy if exists auth_v58_update on public."kpi_metrics";
create policy auth_v58_update on public."kpi_metrics" as restrictive for update to authenticated using(public.commercial_auth_row_v58('kpi_metrics','{}'::jsonb,true)) with check(public.commercial_auth_row_v58('kpi_metrics','{}'::jsonb,true));
drop policy if exists auth_v58_delete on public."kpi_metrics";
create policy auth_v58_delete on public."kpi_metrics" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('kpi_metrics','{}'::jsonb,true));
alter table public."kpi_weekly" enable row level security;
drop policy if exists auth_v58_select on public."kpi_weekly";
create policy auth_v58_select on public."kpi_weekly" as restrictive for select to authenticated using(public.commercial_auth_row_v58('kpi_weekly','{}'::jsonb,false));
drop policy if exists auth_v58_insert on public."kpi_weekly";
create policy auth_v58_insert on public."kpi_weekly" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('kpi_weekly','{}'::jsonb,true));
drop policy if exists auth_v58_update on public."kpi_weekly";
create policy auth_v58_update on public."kpi_weekly" as restrictive for update to authenticated using(public.commercial_auth_row_v58('kpi_weekly','{}'::jsonb,true)) with check(public.commercial_auth_row_v58('kpi_weekly','{}'::jsonb,true));
drop policy if exists auth_v58_delete on public."kpi_weekly";
create policy auth_v58_delete on public."kpi_weekly" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('kpi_weekly','{}'::jsonb,true));
alter table public."moka_customer_daily" enable row level security;
drop policy if exists auth_v58_select on public."moka_customer_daily";
create policy auth_v58_select on public."moka_customer_daily" as restrictive for select to authenticated using(public.commercial_auth_row_v58('moka_customer_daily',jsonb_build_object('store_id',store_id),false));
drop policy if exists auth_v58_insert on public."moka_customer_daily";
create policy auth_v58_insert on public."moka_customer_daily" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('moka_customer_daily',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_update on public."moka_customer_daily";
create policy auth_v58_update on public."moka_customer_daily" as restrictive for update to authenticated using(public.commercial_auth_row_v58('moka_customer_daily',jsonb_build_object('store_id',store_id),true)) with check(public.commercial_auth_row_v58('moka_customer_daily',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_delete on public."moka_customer_daily";
create policy auth_v58_delete on public."moka_customer_daily" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('moka_customer_daily',jsonb_build_object('store_id',store_id),true));
alter table public."moka_customer_profiles_v37" enable row level security;
drop policy if exists auth_v58_select on public."moka_customer_profiles_v37";
create policy auth_v58_select on public."moka_customer_profiles_v37" as restrictive for select to authenticated using(public.commercial_auth_row_v58('moka_customer_profiles_v37','{}'::jsonb,false));
drop policy if exists auth_v58_insert on public."moka_customer_profiles_v37";
create policy auth_v58_insert on public."moka_customer_profiles_v37" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('moka_customer_profiles_v37','{}'::jsonb,true));
drop policy if exists auth_v58_update on public."moka_customer_profiles_v37";
create policy auth_v58_update on public."moka_customer_profiles_v37" as restrictive for update to authenticated using(public.commercial_auth_row_v58('moka_customer_profiles_v37','{}'::jsonb,true)) with check(public.commercial_auth_row_v58('moka_customer_profiles_v37','{}'::jsonb,true));
drop policy if exists auth_v58_delete on public."moka_customer_profiles_v37";
create policy auth_v58_delete on public."moka_customer_profiles_v37" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('moka_customer_profiles_v37','{}'::jsonb,true));
alter table public."moka_customers_v47" enable row level security;
drop policy if exists auth_v58_select on public."moka_customers_v47";
create policy auth_v58_select on public."moka_customers_v47" as restrictive for select to authenticated using(public.commercial_auth_row_v58('moka_customers_v47','{}'::jsonb,false));
drop policy if exists auth_v58_insert on public."moka_customers_v47";
create policy auth_v58_insert on public."moka_customers_v47" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('moka_customers_v47','{}'::jsonb,true));
drop policy if exists auth_v58_update on public."moka_customers_v47";
create policy auth_v58_update on public."moka_customers_v47" as restrictive for update to authenticated using(public.commercial_auth_row_v58('moka_customers_v47','{}'::jsonb,true)) with check(public.commercial_auth_row_v58('moka_customers_v47','{}'::jsonb,true));
drop policy if exists auth_v58_delete on public."moka_customers_v47";
create policy auth_v58_delete on public."moka_customers_v47" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('moka_customers_v47','{}'::jsonb,true));
alter table public."moka_hourly" enable row level security;
drop policy if exists auth_v58_select on public."moka_hourly";
create policy auth_v58_select on public."moka_hourly" as restrictive for select to authenticated using(public.commercial_auth_row_v58('moka_hourly',jsonb_build_object('store_id',store_id),false));
drop policy if exists auth_v58_insert on public."moka_hourly";
create policy auth_v58_insert on public."moka_hourly" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('moka_hourly',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_update on public."moka_hourly";
create policy auth_v58_update on public."moka_hourly" as restrictive for update to authenticated using(public.commercial_auth_row_v58('moka_hourly',jsonb_build_object('store_id',store_id),true)) with check(public.commercial_auth_row_v58('moka_hourly',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_delete on public."moka_hourly";
create policy auth_v58_delete on public."moka_hourly" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('moka_hourly',jsonb_build_object('store_id',store_id),true));
alter table public."moka_item_brand_v43" enable row level security;
drop policy if exists auth_v58_select on public."moka_item_brand_v43";
create policy auth_v58_select on public."moka_item_brand_v43" as restrictive for select to authenticated using(public.commercial_auth_row_v58('moka_item_brand_v43',jsonb_build_object('store_id',store_id),false));
drop policy if exists auth_v58_insert on public."moka_item_brand_v43";
create policy auth_v58_insert on public."moka_item_brand_v43" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('moka_item_brand_v43',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_update on public."moka_item_brand_v43";
create policy auth_v58_update on public."moka_item_brand_v43" as restrictive for update to authenticated using(public.commercial_auth_row_v58('moka_item_brand_v43',jsonb_build_object('store_id',store_id),true)) with check(public.commercial_auth_row_v58('moka_item_brand_v43',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_delete on public."moka_item_brand_v43";
create policy auth_v58_delete on public."moka_item_brand_v43" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('moka_item_brand_v43',jsonb_build_object('store_id',store_id),true));
alter table public."moka_member_coverage_v39" enable row level security;
drop policy if exists auth_v58_select on public."moka_member_coverage_v39";
create policy auth_v58_select on public."moka_member_coverage_v39" as restrictive for select to authenticated using(public.commercial_auth_row_v58('moka_member_coverage_v39',jsonb_build_object('store_id',store_id),false));
drop policy if exists auth_v58_insert on public."moka_member_coverage_v39";
create policy auth_v58_insert on public."moka_member_coverage_v39" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('moka_member_coverage_v39',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_update on public."moka_member_coverage_v39";
create policy auth_v58_update on public."moka_member_coverage_v39" as restrictive for update to authenticated using(public.commercial_auth_row_v58('moka_member_coverage_v39',jsonb_build_object('store_id',store_id),true)) with check(public.commercial_auth_row_v58('moka_member_coverage_v39',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_delete on public."moka_member_coverage_v39";
create policy auth_v58_delete on public."moka_member_coverage_v39" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('moka_member_coverage_v39',jsonb_build_object('store_id',store_id),true));
alter table public."moka_member_coverage_v47" enable row level security;
drop policy if exists auth_v58_select on public."moka_member_coverage_v47";
create policy auth_v58_select on public."moka_member_coverage_v47" as restrictive for select to authenticated using(public.commercial_auth_row_v58('moka_member_coverage_v47',jsonb_build_object('store_id',store_id),false));
drop policy if exists auth_v58_insert on public."moka_member_coverage_v47";
create policy auth_v58_insert on public."moka_member_coverage_v47" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('moka_member_coverage_v47',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_update on public."moka_member_coverage_v47";
create policy auth_v58_update on public."moka_member_coverage_v47" as restrictive for update to authenticated using(public.commercial_auth_row_v58('moka_member_coverage_v47',jsonb_build_object('store_id',store_id),true)) with check(public.commercial_auth_row_v58('moka_member_coverage_v47',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_delete on public."moka_member_coverage_v47";
create policy auth_v58_delete on public."moka_member_coverage_v47" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('moka_member_coverage_v47',jsonb_build_object('store_id',store_id),true));
alter table public."moka_member_detail_v39" enable row level security;
drop policy if exists auth_v58_select on public."moka_member_detail_v39";
create policy auth_v58_select on public."moka_member_detail_v39" as restrictive for select to authenticated using(public.commercial_auth_row_v58('moka_member_detail_v39',jsonb_build_object('store_id',store_id),false));
drop policy if exists auth_v58_insert on public."moka_member_detail_v39";
create policy auth_v58_insert on public."moka_member_detail_v39" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('moka_member_detail_v39',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_update on public."moka_member_detail_v39";
create policy auth_v58_update on public."moka_member_detail_v39" as restrictive for update to authenticated using(public.commercial_auth_row_v58('moka_member_detail_v39',jsonb_build_object('store_id',store_id),true)) with check(public.commercial_auth_row_v58('moka_member_detail_v39',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_delete on public."moka_member_detail_v39";
create policy auth_v58_delete on public."moka_member_detail_v39" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('moka_member_detail_v39',jsonb_build_object('store_id',store_id),true));
alter table public."moka_member_items_v51" enable row level security;
drop policy if exists auth_v58_select on public."moka_member_items_v51";
create policy auth_v58_select on public."moka_member_items_v51" as restrictive for select to authenticated using(public.commercial_auth_row_v58('moka_member_items_v51',jsonb_build_object('store_id',store_id),false));
drop policy if exists auth_v58_insert on public."moka_member_items_v51";
create policy auth_v58_insert on public."moka_member_items_v51" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('moka_member_items_v51',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_update on public."moka_member_items_v51";
create policy auth_v58_update on public."moka_member_items_v51" as restrictive for update to authenticated using(public.commercial_auth_row_v58('moka_member_items_v51',jsonb_build_object('store_id',store_id),true)) with check(public.commercial_auth_row_v58('moka_member_items_v51',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_delete on public."moka_member_items_v51";
create policy auth_v58_delete on public."moka_member_items_v51" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('moka_member_items_v51',jsonb_build_object('store_id',store_id),true));
alter table public."moka_member_jobs_v48" enable row level security;
drop policy if exists auth_v58_select on public."moka_member_jobs_v48";
create policy auth_v58_select on public."moka_member_jobs_v48" as restrictive for select to authenticated using(public.commercial_auth_row_v58('moka_member_jobs_v48','{}'::jsonb,false));
drop policy if exists auth_v58_insert on public."moka_member_jobs_v48";
create policy auth_v58_insert on public."moka_member_jobs_v48" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('moka_member_jobs_v48','{}'::jsonb,true));
drop policy if exists auth_v58_update on public."moka_member_jobs_v48";
create policy auth_v58_update on public."moka_member_jobs_v48" as restrictive for update to authenticated using(public.commercial_auth_row_v58('moka_member_jobs_v48','{}'::jsonb,true)) with check(public.commercial_auth_row_v58('moka_member_jobs_v48','{}'::jsonb,true));
drop policy if exists auth_v58_delete on public."moka_member_jobs_v48";
create policy auth_v58_delete on public."moka_member_jobs_v48" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('moka_member_jobs_v48','{}'::jsonb,true));
alter table public."moka_member_stage_events_v48" enable row level security;
drop policy if exists auth_v58_select on public."moka_member_stage_events_v48";
create policy auth_v58_select on public."moka_member_stage_events_v48" as restrictive for select to authenticated using(public.commercial_auth_row_v58('moka_member_stage_events_v48','{}'::jsonb,false));
drop policy if exists auth_v58_insert on public."moka_member_stage_events_v48";
create policy auth_v58_insert on public."moka_member_stage_events_v48" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('moka_member_stage_events_v48','{}'::jsonb,true));
drop policy if exists auth_v58_update on public."moka_member_stage_events_v48";
create policy auth_v58_update on public."moka_member_stage_events_v48" as restrictive for update to authenticated using(public.commercial_auth_row_v58('moka_member_stage_events_v48','{}'::jsonb,true)) with check(public.commercial_auth_row_v58('moka_member_stage_events_v48','{}'::jsonb,true));
drop policy if exists auth_v58_delete on public."moka_member_stage_events_v48";
create policy auth_v58_delete on public."moka_member_stage_events_v48" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('moka_member_stage_events_v48','{}'::jsonb,true));
alter table public."moka_member_stage_profiles_v48" enable row level security;
drop policy if exists auth_v58_select on public."moka_member_stage_profiles_v48";
create policy auth_v58_select on public."moka_member_stage_profiles_v48" as restrictive for select to authenticated using(public.commercial_auth_row_v58('moka_member_stage_profiles_v48','{}'::jsonb,false));
drop policy if exists auth_v58_insert on public."moka_member_stage_profiles_v48";
create policy auth_v58_insert on public."moka_member_stage_profiles_v48" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('moka_member_stage_profiles_v48','{}'::jsonb,true));
drop policy if exists auth_v58_update on public."moka_member_stage_profiles_v48";
create policy auth_v58_update on public."moka_member_stage_profiles_v48" as restrictive for update to authenticated using(public.commercial_auth_row_v58('moka_member_stage_profiles_v48','{}'::jsonb,true)) with check(public.commercial_auth_row_v58('moka_member_stage_profiles_v48','{}'::jsonb,true));
drop policy if exists auth_v58_delete on public."moka_member_stage_profiles_v48";
create policy auth_v58_delete on public."moka_member_stage_profiles_v48" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('moka_member_stage_profiles_v48','{}'::jsonb,true));
alter table public."moka_purchase_history_v47" enable row level security;
drop policy if exists auth_v58_select on public."moka_purchase_history_v47";
create policy auth_v58_select on public."moka_purchase_history_v47" as restrictive for select to authenticated using(public.commercial_auth_row_v58('moka_purchase_history_v47',jsonb_build_object('store_id',store_id),false));
drop policy if exists auth_v58_insert on public."moka_purchase_history_v47";
create policy auth_v58_insert on public."moka_purchase_history_v47" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('moka_purchase_history_v47',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_update on public."moka_purchase_history_v47";
create policy auth_v58_update on public."moka_purchase_history_v47" as restrictive for update to authenticated using(public.commercial_auth_row_v58('moka_purchase_history_v47',jsonb_build_object('store_id',store_id),true)) with check(public.commercial_auth_row_v58('moka_purchase_history_v47',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_delete on public."moka_purchase_history_v47";
create policy auth_v58_delete on public."moka_purchase_history_v47" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('moka_purchase_history_v47',jsonb_build_object('store_id',store_id),true));
alter table public."moka_sales_type_daily" enable row level security;
drop policy if exists auth_v58_select on public."moka_sales_type_daily";
create policy auth_v58_select on public."moka_sales_type_daily" as restrictive for select to authenticated using(public.commercial_auth_row_v58('moka_sales_type_daily',jsonb_build_object('store_id',store_id),false));
drop policy if exists auth_v58_insert on public."moka_sales_type_daily";
create policy auth_v58_insert on public."moka_sales_type_daily" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('moka_sales_type_daily',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_update on public."moka_sales_type_daily";
create policy auth_v58_update on public."moka_sales_type_daily" as restrictive for update to authenticated using(public.commercial_auth_row_v58('moka_sales_type_daily',jsonb_build_object('store_id',store_id),true)) with check(public.commercial_auth_row_v58('moka_sales_type_daily',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_delete on public."moka_sales_type_daily";
create policy auth_v58_delete on public."moka_sales_type_daily" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('moka_sales_type_daily',jsonb_build_object('store_id',store_id),true));
alter table public."moka_sync_checkpoint_v41" enable row level security;
drop policy if exists auth_v58_select on public."moka_sync_checkpoint_v41";
create policy auth_v58_select on public."moka_sync_checkpoint_v41" as restrictive for select to authenticated using(public.commercial_auth_row_v58('moka_sync_checkpoint_v41',jsonb_build_object('store_id',store_id),false));
drop policy if exists auth_v58_insert on public."moka_sync_checkpoint_v41";
create policy auth_v58_insert on public."moka_sync_checkpoint_v41" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('moka_sync_checkpoint_v41',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_update on public."moka_sync_checkpoint_v41";
create policy auth_v58_update on public."moka_sync_checkpoint_v41" as restrictive for update to authenticated using(public.commercial_auth_row_v58('moka_sync_checkpoint_v41',jsonb_build_object('store_id',store_id),true)) with check(public.commercial_auth_row_v58('moka_sync_checkpoint_v41',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_delete on public."moka_sync_checkpoint_v41";
create policy auth_v58_delete on public."moka_sync_checkpoint_v41" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('moka_sync_checkpoint_v41',jsonb_build_object('store_id',store_id),true));
alter table public."moka_sync_component_v45" enable row level security;
drop policy if exists auth_v58_select on public."moka_sync_component_v45";
create policy auth_v58_select on public."moka_sync_component_v45" as restrictive for select to authenticated using(public.commercial_auth_row_v58('moka_sync_component_v45',jsonb_build_object('store_id',store_id),false));
drop policy if exists auth_v58_insert on public."moka_sync_component_v45";
create policy auth_v58_insert on public."moka_sync_component_v45" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('moka_sync_component_v45',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_update on public."moka_sync_component_v45";
create policy auth_v58_update on public."moka_sync_component_v45" as restrictive for update to authenticated using(public.commercial_auth_row_v58('moka_sync_component_v45',jsonb_build_object('store_id',store_id),true)) with check(public.commercial_auth_row_v58('moka_sync_component_v45',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_delete on public."moka_sync_component_v45";
create policy auth_v58_delete on public."moka_sync_component_v45" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('moka_sync_component_v45',jsonb_build_object('store_id',store_id),true));
alter table public."moka_sync_coverage" enable row level security;
drop policy if exists auth_v58_select on public."moka_sync_coverage";
create policy auth_v58_select on public."moka_sync_coverage" as restrictive for select to authenticated using(public.commercial_auth_row_v58('moka_sync_coverage',jsonb_build_object('store_id',store_id),false));
drop policy if exists auth_v58_insert on public."moka_sync_coverage";
create policy auth_v58_insert on public."moka_sync_coverage" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('moka_sync_coverage',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_update on public."moka_sync_coverage";
create policy auth_v58_update on public."moka_sync_coverage" as restrictive for update to authenticated using(public.commercial_auth_row_v58('moka_sync_coverage',jsonb_build_object('store_id',store_id),true)) with check(public.commercial_auth_row_v58('moka_sync_coverage',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_delete on public."moka_sync_coverage";
create policy auth_v58_delete on public."moka_sync_coverage" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('moka_sync_coverage',jsonb_build_object('store_id',store_id),true));
alter table public."moka_sync_runs" enable row level security;
drop policy if exists auth_v58_select on public."moka_sync_runs";
create policy auth_v58_select on public."moka_sync_runs" as restrictive for select to authenticated using(public.commercial_auth_row_v58('moka_sync_runs','{}'::jsonb,false));
drop policy if exists auth_v58_insert on public."moka_sync_runs";
create policy auth_v58_insert on public."moka_sync_runs" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('moka_sync_runs','{}'::jsonb,true));
drop policy if exists auth_v58_update on public."moka_sync_runs";
create policy auth_v58_update on public."moka_sync_runs" as restrictive for update to authenticated using(public.commercial_auth_row_v58('moka_sync_runs','{}'::jsonb,true)) with check(public.commercial_auth_row_v58('moka_sync_runs','{}'::jsonb,true));
drop policy if exists auth_v58_delete on public."moka_sync_runs";
create policy auth_v58_delete on public."moka_sync_runs" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('moka_sync_runs','{}'::jsonb,true));
alter table public."moka_walkin_daily" enable row level security;
drop policy if exists auth_v58_select on public."moka_walkin_daily";
create policy auth_v58_select on public."moka_walkin_daily" as restrictive for select to authenticated using(public.commercial_auth_row_v58('moka_walkin_daily',jsonb_build_object('store_id',store_id),false));
drop policy if exists auth_v58_insert on public."moka_walkin_daily";
create policy auth_v58_insert on public."moka_walkin_daily" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('moka_walkin_daily',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_update on public."moka_walkin_daily";
create policy auth_v58_update on public."moka_walkin_daily" as restrictive for update to authenticated using(public.commercial_auth_row_v58('moka_walkin_daily',jsonb_build_object('store_id',store_id),true)) with check(public.commercial_auth_row_v58('moka_walkin_daily',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_delete on public."moka_walkin_daily";
create policy auth_v58_delete on public."moka_walkin_daily" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('moka_walkin_daily',jsonb_build_object('store_id',store_id),true));
alter table public."pdca" enable row level security;
drop policy if exists auth_v58_select on public."pdca";
create policy auth_v58_select on public."pdca" as restrictive for select to authenticated using(public.commercial_auth_row_v58('pdca',jsonb_build_object('store_id',store_id),false));
drop policy if exists auth_v58_insert on public."pdca";
create policy auth_v58_insert on public."pdca" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('pdca',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_update on public."pdca";
create policy auth_v58_update on public."pdca" as restrictive for update to authenticated using(public.commercial_auth_row_v58('pdca',jsonb_build_object('store_id',store_id),true)) with check(public.commercial_auth_row_v58('pdca',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_delete on public."pdca";
create policy auth_v58_delete on public."pdca" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('pdca',jsonb_build_object('store_id',store_id),true));
alter table public."people" enable row level security;
drop policy if exists auth_v58_select on public."people";
create policy auth_v58_select on public."people" as restrictive for select to authenticated using(public.commercial_auth_row_v58('people','{}'::jsonb,false));
drop policy if exists auth_v58_insert on public."people";
create policy auth_v58_insert on public."people" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('people','{}'::jsonb,true));
drop policy if exists auth_v58_update on public."people";
create policy auth_v58_update on public."people" as restrictive for update to authenticated using(public.commercial_auth_row_v58('people','{}'::jsonb,true)) with check(public.commercial_auth_row_v58('people','{}'::jsonb,true));
drop policy if exists auth_v58_delete on public."people";
create policy auth_v58_delete on public."people" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('people','{}'::jsonb,true));
alter table public."pica" enable row level security;
drop policy if exists auth_v58_select on public."pica";
create policy auth_v58_select on public."pica" as restrictive for select to authenticated using(public.commercial_auth_row_v58('pica',jsonb_build_object('store_id',store_id),false));
drop policy if exists auth_v58_insert on public."pica";
create policy auth_v58_insert on public."pica" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('pica',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_update on public."pica";
create policy auth_v58_update on public."pica" as restrictive for update to authenticated using(public.commercial_auth_row_v58('pica',jsonb_build_object('store_id',store_id),true)) with check(public.commercial_auth_row_v58('pica',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_delete on public."pica";
create policy auth_v58_delete on public."pica" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('pica',jsonb_build_object('store_id',store_id),true));
alter table public."product_master" enable row level security;
drop policy if exists auth_v58_select on public."product_master";
create policy auth_v58_select on public."product_master" as restrictive for select to authenticated using(public.commercial_auth_row_v58('product_master','{}'::jsonb,false));
drop policy if exists auth_v58_insert on public."product_master";
create policy auth_v58_insert on public."product_master" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('product_master','{}'::jsonb,true));
drop policy if exists auth_v58_update on public."product_master";
create policy auth_v58_update on public."product_master" as restrictive for update to authenticated using(public.commercial_auth_row_v58('product_master','{}'::jsonb,true)) with check(public.commercial_auth_row_v58('product_master','{}'::jsonb,true));
drop policy if exists auth_v58_delete on public."product_master";
create policy auth_v58_delete on public."product_master" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('product_master','{}'::jsonb,true));
alter table public."sales_actual" enable row level security;
drop policy if exists auth_v58_select on public."sales_actual";
create policy auth_v58_select on public."sales_actual" as restrictive for select to authenticated using(public.commercial_auth_row_v58('sales_actual',jsonb_build_object('store_id',store_id),false));
drop policy if exists auth_v58_insert on public."sales_actual";
create policy auth_v58_insert on public."sales_actual" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('sales_actual',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_update on public."sales_actual";
create policy auth_v58_update on public."sales_actual" as restrictive for update to authenticated using(public.commercial_auth_row_v58('sales_actual',jsonb_build_object('store_id',store_id),true)) with check(public.commercial_auth_row_v58('sales_actual',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_delete on public."sales_actual";
create policy auth_v58_delete on public."sales_actual" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('sales_actual',jsonb_build_object('store_id',store_id),true));
alter table public."sales_type_map" enable row level security;
drop policy if exists auth_v58_select on public."sales_type_map";
create policy auth_v58_select on public."sales_type_map" as restrictive for select to authenticated using(public.commercial_auth_row_v58('sales_type_map','{}'::jsonb,false));
drop policy if exists auth_v58_insert on public."sales_type_map";
create policy auth_v58_insert on public."sales_type_map" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('sales_type_map','{}'::jsonb,true));
drop policy if exists auth_v58_update on public."sales_type_map";
create policy auth_v58_update on public."sales_type_map" as restrictive for update to authenticated using(public.commercial_auth_row_v58('sales_type_map','{}'::jsonb,true)) with check(public.commercial_auth_row_v58('sales_type_map','{}'::jsonb,true));
drop policy if exists auth_v58_delete on public."sales_type_map";
create policy auth_v58_delete on public."sales_type_map" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('sales_type_map','{}'::jsonb,true));
alter table public."sales_type_raw" enable row level security;
drop policy if exists auth_v58_select on public."sales_type_raw";
create policy auth_v58_select on public."sales_type_raw" as restrictive for select to authenticated using(public.commercial_auth_row_v58('sales_type_raw',jsonb_build_object('store_id',store_id),false));
drop policy if exists auth_v58_insert on public."sales_type_raw";
create policy auth_v58_insert on public."sales_type_raw" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('sales_type_raw',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_update on public."sales_type_raw";
create policy auth_v58_update on public."sales_type_raw" as restrictive for update to authenticated using(public.commercial_auth_row_v58('sales_type_raw',jsonb_build_object('store_id',store_id),true)) with check(public.commercial_auth_row_v58('sales_type_raw',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_delete on public."sales_type_raw";
create policy auth_v58_delete on public."sales_type_raw" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('sales_type_raw',jsonb_build_object('store_id',store_id),true));
alter table public."store_aliases" enable row level security;
drop policy if exists auth_v58_select on public."store_aliases";
create policy auth_v58_select on public."store_aliases" as restrictive for select to authenticated using(public.commercial_auth_row_v58('store_aliases',jsonb_build_object('store_id',store_id),false));
drop policy if exists auth_v58_insert on public."store_aliases";
create policy auth_v58_insert on public."store_aliases" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('store_aliases',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_update on public."store_aliases";
create policy auth_v58_update on public."store_aliases" as restrictive for update to authenticated using(public.commercial_auth_row_v58('store_aliases',jsonb_build_object('store_id',store_id),true)) with check(public.commercial_auth_row_v58('store_aliases',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_delete on public."store_aliases";
create policy auth_v58_delete on public."store_aliases" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('store_aliases',jsonb_build_object('store_id',store_id),true));
alter table public."store_marketplace_override" enable row level security;
drop policy if exists auth_v58_select on public."store_marketplace_override";
create policy auth_v58_select on public."store_marketplace_override" as restrictive for select to authenticated using(public.commercial_auth_row_v58('store_marketplace_override',jsonb_build_object('store_id',store_id),false));
drop policy if exists auth_v58_insert on public."store_marketplace_override";
create policy auth_v58_insert on public."store_marketplace_override" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('store_marketplace_override',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_update on public."store_marketplace_override";
create policy auth_v58_update on public."store_marketplace_override" as restrictive for update to authenticated using(public.commercial_auth_row_v58('store_marketplace_override',jsonb_build_object('store_id',store_id),true)) with check(public.commercial_auth_row_v58('store_marketplace_override',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_delete on public."store_marketplace_override";
create policy auth_v58_delete on public."store_marketplace_override" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('store_marketplace_override',jsonb_build_object('store_id',store_id),true));
alter table public."stores" enable row level security;
drop policy if exists auth_v58_select on public."stores";
create policy auth_v58_select on public."stores" as restrictive for select to authenticated using(public.commercial_auth_row_v58('stores',jsonb_build_object('id',id),false));
drop policy if exists auth_v58_insert on public."stores";
create policy auth_v58_insert on public."stores" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('stores',jsonb_build_object('id',id),true));
drop policy if exists auth_v58_update on public."stores";
create policy auth_v58_update on public."stores" as restrictive for update to authenticated using(public.commercial_auth_row_v58('stores',jsonb_build_object('id',id),true)) with check(public.commercial_auth_row_v58('stores',jsonb_build_object('id',id),true));
drop policy if exists auth_v58_delete on public."stores";
create policy auth_v58_delete on public."stores" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('stores',jsonb_build_object('id',id),true));
alter table public."targets" enable row level security;
drop policy if exists auth_v58_select on public."targets";
create policy auth_v58_select on public."targets" as restrictive for select to authenticated using(public.commercial_auth_row_v58('targets',jsonb_build_object('store_id',store_id),false));
drop policy if exists auth_v58_insert on public."targets";
create policy auth_v58_insert on public."targets" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('targets',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_update on public."targets";
create policy auth_v58_update on public."targets" as restrictive for update to authenticated using(public.commercial_auth_row_v58('targets',jsonb_build_object('store_id',store_id),true)) with check(public.commercial_auth_row_v58('targets',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_delete on public."targets";
create policy auth_v58_delete on public."targets" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('targets',jsonb_build_object('store_id',store_id),true));
alter table public."transaksi" enable row level security;
drop policy if exists auth_v58_select on public."transaksi";
create policy auth_v58_select on public."transaksi" as restrictive for select to authenticated using(public.commercial_auth_row_v58('transaksi',jsonb_build_object('store_id',store_id),false));
drop policy if exists auth_v58_insert on public."transaksi";
create policy auth_v58_insert on public."transaksi" as restrictive for insert to authenticated with check(public.commercial_auth_row_v58('transaksi',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_update on public."transaksi";
create policy auth_v58_update on public."transaksi" as restrictive for update to authenticated using(public.commercial_auth_row_v58('transaksi',jsonb_build_object('store_id',store_id),true)) with check(public.commercial_auth_row_v58('transaksi',jsonb_build_object('store_id',store_id),true));
drop policy if exists auth_v58_delete on public."transaksi";
create policy auth_v58_delete on public."transaksi" as restrictive for delete to authenticated using(public.commercial_auth_row_v58('transaksi',jsonb_build_object('store_id',store_id),true));
alter view public."commercial_customer_daily_v47" set(security_invoker=true);
alter view public."commercial_member_complete_v47" set(security_invoker=true);
alter view public."commercial_member_detail_v47" set(security_invoker=true);
alter view public."commercial_member_profiles_v47" set(security_invoker=true);
alter view public."v_growth" set(security_invoker=true);
alter view public."v_item_enriched" set(security_invoker=true);
alter view public."v_marketplace" set(security_invoker=true);
alter view public."v_sales_dashboard" set(security_invoker=true);
alter view public."v_transaksi" set(security_invoker=true);
alter view public."v_unmapped_sales_type" set(security_invoker=true);
alter function public.commercial_brand_stores_v1(p_exclude text[]) security invoker;
alter function public.commercial_coverage_v1(p_from date, p_to date, p_stores bigint[]) security invoker;
alter function public.commercial_customer_freq_v1(p_from date, p_to date, p_stores bigint[]) security invoker;
alter function public.commercial_customer_stats_v1(p_from date, p_to date, p_stores bigint[]) security invoker;
alter function public.commercial_customers_v1(p_from date, p_to date, p_stores bigint[], p_query text, p_limit integer) security invoker;
alter function public.commercial_heatmap_v1(p_from date, p_to date, p_stores bigint[]) security invoker;
alter function public.commercial_master_rows_v1(p_table text, p_query text, p_offset integer, p_limit integer) security invoker;
alter function public.commercial_master_settings_snapshot_v1(p_keys text[]) security invoker;
CREATE OR REPLACE FUNCTION commercial_private.auth_mutate_core_v58(p_table text, p_action text, p_key jsonb, p_patch jsonb DEFAULT '{}'::jsonb, p_version text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare keys text[];old_row jsonb;new_row jsonb;where_sql text;sets text;col text;is_generated boolean;
begin
 if not public.commercial_is_master_v1() then raise exception 'Akses master diperlukan' using errcode='42501';end if;
 if not public.commercial_master_allowed_v1(p_table) or pg_catalog.to_regclass(format('public.%I',p_table)) is null then raise exception 'Tabel tidak diizinkan';end if;
 if p_action not in ('update','delete','setting') then raise exception 'Aksi tidak diizinkan';end if;
 if jsonb_typeof(p_key)<>'object' or p_key='{}'::jsonb then raise exception 'Kunci lengkap diperlukan';end if;
 keys:=public.commercial_master_keys_v1(p_table);
 if coalesce(cardinality(keys),0)=0 or (select count(*) from jsonb_object_keys(p_key))<>cardinality(keys) or exists(select 1 from unnest(keys) k where not p_key?k or p_key->k='null'::jsonb) then raise exception 'Kunci baris tidak valid';end if;
 if p_table='app_settings' and (coalesce(p_key->>'key','') !~ '^(ops_v1_(task|schedule|link|present|daily_notes|pica|kpi_spv|upload_reset)_|google_review_v1_|sales_programs_json$|program_sales_type_categories$|ops_color_map$|kpi_)') then raise exception 'Pengaturan koneksi/rahasia tidak dapat diubah melalui pengelola input';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('commercial_master:'||p_table),pg_catalog.hashtext(p_key::text));
 select string_agg(format('to_jsonb(t)->>%L = $1->>%L',k,k),' and ') into where_sql from unnest(keys) k;
 execute format('select to_jsonb(t) from public.%I t where %s for update',p_table,where_sql) into old_row using p_key;
 if p_action='setting' then
  if (old_row is null and p_version is not null) or (old_row is not null and (p_version is null or md5(old_row::text)<>p_version)) then raise exception 'Data sudah berubah. Muat ulang sebelum mengedit.' using errcode='40001';end if;
  if p_table<>'app_settings' or (select count(*) from jsonb_object_keys(p_patch))<>1 or not p_patch?'value' then raise exception 'Aksi setting hanya menerima value';end if;
  insert into public.app_settings(key,value) values(p_key->>'key',p_patch->>'value') on conflict(key) do update set value=excluded.value returning to_jsonb(app_settings.*) into new_row;
 else
  if old_row is null then raise exception 'Baris sudah tidak ada';end if;
  if p_version is null or md5(old_row::text)<>p_version then raise exception 'Data sudah berubah. Muat ulang sebelum mengedit.' using errcode='40001';end if;
  if p_action='delete' then
   execute format('delete from public.%I t where %s',p_table,where_sql) using p_key;
   if p_table='pica' then delete from public.app_settings where key='ops_v1_pica_'||(old_row->>'id');end if;
  else
   if jsonb_typeof(p_patch)<>'object' or p_patch='{}'::jsonb then raise exception 'Tidak ada perubahan';end if;
   if p_table='targets' and old_row?'target_komersial' and old_row?'target_user' and (p_patch?'target_komersial' or p_patch?'target_user' or p_patch?'target_total') and exists(select 1 from pg_catalog.pg_attribute where attrelid='public.targets'::regclass and attname='target_total' and attgenerated='') then
    if p_patch?'target_total' and not(p_patch?'target_komersial' or p_patch?'target_user') then raise exception 'Total target dihitung dari Komersial + User. Ubah target segmennya.';end if;
    p_patch:=p_patch||jsonb_build_object('target_total',coalesce(((old_row||p_patch)->>'target_komersial')::numeric,0)+coalesce(((old_row||p_patch)->>'target_user')::numeric,0));
   end if;
   for col in select jsonb_object_keys(p_patch) loop
    select (a.attgenerated<>'' or a.attidentity<>'' or a.attname in ('id','created_at','updated_at') or (p_table='people' and a.attname='name') or (p_table='app_settings' and a.attname='key')) into is_generated from pg_catalog.pg_attribute a where a.attrelid=pg_catalog.to_regclass(format('public.%I',p_table)) and a.attname=col and a.attnum>0 and not a.attisdropped;
    if is_generated is null or is_generated then raise exception 'Kolom % tidak dapat diubah',col;end if;
   end loop;
   select string_agg(format('%I=p.%I',k,k),',') into sets from jsonb_object_keys(p_patch) k;
   execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I,$2) p where %s returning to_jsonb(t)',p_table,sets,p_table,where_sql) into new_row using p_key,p_patch;
  end if;
 end if;
 if p_table='pica' and p_action='update' and new_row->>'status' is distinct from old_row->>'status' then
  insert into public.app_settings(key,value) values('ops_v1_pica_'||(new_row->>'id'),jsonb_build_object('progress',case when new_row->>'status'='DONE' then 100 else 0 end)::text) on conflict(key) do update set value=(coalesce(nullif(app_settings.value,'')::jsonb,'{}'::jsonb)||jsonb_build_object('progress',case when new_row->>'status'='DONE' then 100 else 0 end))::text;
 end if;
 insert into public.app_settings(key,value) values('commercial_data_revision',clock_timestamp()::text) on conflict(key) do update set value=excluded.value;
 if p_table in ('sales_type_raw','sales_type_map') then perform pg_catalog.set_config('search_path','public,pg_temp',true);perform public.rebuild_sales_actual();perform pg_catalog.set_config('search_path','',true);end if;
 insert into public.commercial_master_audit(user_id,table_name,action,record_key,before_data,after_data) values(public.commercial_master_actor_v1(),p_table,p_action,p_key,old_row,new_row);
 return jsonb_build_object('saved',true,'row',new_row,'recalculated',p_table in ('sales_type_raw','sales_type_map'));
end $function$
;
revoke all on function commercial_private.auth_mutate_core_v58(text,text,jsonb,jsonb,text) from public,anon,authenticated;
create or replace function public.commercial_master_mutate_v1(p_table text,p_action text,p_key jsonb,p_patch jsonb default '{}'::jsonb,p_version text default null::text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare keys text[];where_sql text;old_row jsonb;new_row jsonb;
begin
 if not public.commercial_master_allowed_v1(p_table) or pg_catalog.to_regclass(format('public.%I',p_table)) is null then raise exception 'Tabel tidak diizinkan';end if;
 keys:=public.commercial_master_keys_v1(p_table);
 if cardinality(keys) is null or cardinality(keys)=0 or jsonb_typeof(p_key) is distinct from 'object' then raise exception 'Kunci tidak valid';end if;
 select string_agg(format('to_jsonb(t)->>%L = $1->>%L',k,k),' and ') into where_sql from unnest(keys) k;
 execute format('select to_jsonb(t) from public.%I t where %s for update',p_table,where_sql) into old_row using p_key;
 if old_row is not null and not public.commercial_auth_row_v58(p_table,old_row,true) then raise exception 'Data lama di luar hak akses.' using errcode='42501';end if;
 new_row:=coalesce(old_row,p_key)||p_patch;
 if not public.commercial_auth_row_v58(p_table,new_row,true) then raise exception 'Perubahan di luar hak akses.' using errcode='42501';end if;
 return commercial_private.auth_mutate_core_v58(p_table,p_action,p_key,p_patch,p_version);
end $$;
-- Retain editor business operations, but exclude Viewer even for internal RPC calls.
create or replace function public.commercial_is_master_v1() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from commercial_private.pins p where p.id=commercial_private.session_pin() and p.enabled)
 and coalesce(commercial_private.auth_context_v58()->>'access_role','')<>'viewer'
 and not coalesce((commercial_private.auth_context_v58()->'rule'->>'view_only')::boolean,false)
$$;
grant EXECUTE on FUNCTION public."commercial_access_settings_guard_v37"() to authenticated;
grant EXECUTE on FUNCTION public."commercial_bazar_data_v10"() to authenticated;
grant EXECUTE on FUNCTION public."commercial_bazar_write_v10"(p_kind text, p_action text, p_records jsonb) to authenticated;
grant EXECUTE on FUNCTION public."commercial_brand_monthly_v38"(p_menu text, p_stores bigint[]) to authenticated;
grant EXECUTE on FUNCTION public."commercial_brand_store_cache_add"() to authenticated;
grant EXECUTE on FUNCTION public."commercial_brand_store_cache_add"() to authenticated;
grant EXECUTE on FUNCTION public."commercial_brand_stores_v1"(p_exclude text[]) to authenticated;
grant EXECUTE on FUNCTION public."commercial_brand_stores_v1"(p_exclude text[]) to authenticated;
grant EXECUTE on FUNCTION public."commercial_city_key_v51"(p_city text) to authenticated;
grant EXECUTE on FUNCTION public."commercial_city_key_v51"(p_city text) to authenticated;
grant EXECUTE on FUNCTION public."commercial_comparison_rollup_v10"(p_year integer, p_m1 integer, p_m2 integer, p_stores integer[], p_brands text[], p_categories text[], p_exclude text[], p_dim text) to authenticated;
grant EXECUTE on FUNCTION public."commercial_coverage_v1"(p_from date, p_to date, p_stores bigint[]) to authenticated;
grant EXECUTE on FUNCTION public."commercial_coverage_v1"(p_from date, p_to date, p_stores bigint[]) to authenticated;
grant EXECUTE on FUNCTION public."commercial_customer_freq_v1"(p_from date, p_to date, p_stores bigint[]) to authenticated;
grant EXECUTE on FUNCTION public."commercial_customer_freq_v1"(p_from date, p_to date, p_stores bigint[]) to authenticated;
grant EXECUTE on FUNCTION public."commercial_customer_stats_v1"(p_from date, p_to date, p_stores bigint[]) to authenticated;
grant EXECUTE on FUNCTION public."commercial_customer_stats_v1"(p_from date, p_to date, p_stores bigint[]) to authenticated;
grant EXECUTE on FUNCTION public."commercial_customers_v1"(p_from date, p_to date, p_stores bigint[], p_query text, p_limit integer) to authenticated;
grant EXECUTE on FUNCTION public."commercial_customers_v1"(p_from date, p_to date, p_stores bigint[], p_query text, p_limit integer) to authenticated;
grant EXECUTE on FUNCTION public."commercial_heatmap_v1"(p_from date, p_to date, p_stores bigint[]) to authenticated;
grant EXECUTE on FUNCTION public."commercial_heatmap_v1"(p_from date, p_to date, p_stores bigint[]) to authenticated;
grant EXECUTE on FUNCTION public."commercial_is_master_v1"() to authenticated;
grant EXECUTE on FUNCTION public."commercial_item_data_v1"(p_year integer, p_m1 integer, p_m2 integer, p_stores integer[], p_brands text[], p_categories text[], p_exclude text[]) to authenticated;
grant EXECUTE on FUNCTION public."commercial_item_data_v1"(p_year integer, p_m1 integer, p_m2 integer, p_stores integer[], p_brands text[], p_categories text[], p_exclude text[]) to authenticated;
grant EXECUTE on FUNCTION public."commercial_item_detail_v16"(p_year integer, p_m1 integer, p_m2 integer, p_stores integer[], p_brands text[], p_categories text[], p_exclude text[]) to authenticated;
grant EXECUTE on FUNCTION public."commercial_item_group_v51"(p_name text) to authenticated;
grant EXECUTE on FUNCTION public."commercial_item_group_v51"(p_name text) to authenticated;
grant EXECUTE on FUNCTION public."commercial_item_rollup_v1"(p_year integer, p_m1 integer, p_m2 integer, p_stores integer[], p_brands text[], p_categories text[], p_exclude text[], p_dim text, p_limit integer) to authenticated;
grant EXECUTE on FUNCTION public."commercial_item_rollup_v1"(p_year integer, p_m1 integer, p_m2 integer, p_stores integer[], p_brands text[], p_categories text[], p_exclude text[], p_dim text, p_limit integer) to authenticated;
grant EXECUTE on FUNCTION public."commercial_item_rows_v1"(p_year integer, p_m1 integer, p_m2 integer, p_stores integer[], p_brands text[], p_categories text[], p_exclude text[]) to authenticated;
grant EXECUTE on FUNCTION public."commercial_item_rows_v1"(p_year integer, p_m1 integer, p_m2 integer, p_stores integer[], p_brands text[], p_categories text[], p_exclude text[]) to authenticated;
grant EXECUTE on FUNCTION public."commercial_master_allowed_v1"(p_table text) to authenticated;
grant EXECUTE on FUNCTION public."commercial_master_catalog_v1"() to authenticated;
grant EXECUTE on FUNCTION public."commercial_master_keys_v1"(p_table text) to authenticated;
grant EXECUTE on FUNCTION public."commercial_master_mutate_v1"(p_table text, p_action text, p_key jsonb, p_patch jsonb, p_version text) to authenticated;
grant EXECUTE on FUNCTION public."commercial_master_rows_v1"(p_table text, p_query text, p_offset integer, p_limit integer) to authenticated;
grant EXECUTE on FUNCTION public."commercial_master_settings_delete_v1"(p_rows jsonb) to authenticated;
grant EXECUTE on FUNCTION public."commercial_master_settings_save_v1"(p_rows jsonb) to authenticated;
grant EXECUTE on FUNCTION public."commercial_master_settings_snapshot_v1"(p_keys text[]) to authenticated;
grant EXECUTE on FUNCTION public."commercial_member_cities_v51"(p_stores bigint[]) to authenticated;
grant EXECUTE on FUNCTION public."commercial_member_customer_v51"(p_customer_key text, p_year integer, p_stores bigint[]) to authenticated;
grant EXECUTE on FUNCTION public."commercial_member_directory_v51"(p_query text, p_since_from date, p_since_to date, p_kind text, p_status text, p_stores bigint[], p_limit integer, p_offset integer, p_cities text[]) to authenticated;
grant EXECUTE on FUNCTION public."commercial_member_import_v39"(p_from date, p_to date, p_stores bigint[], p_rows jsonb, p_complete boolean, p_file text) to authenticated;
grant EXECUTE on FUNCTION public."commercial_member_items_v51"(p_year integer, p_m1 integer, p_d1 integer, p_m2 integer, p_d2 integer, p_stores bigint[], p_align boolean, p_compare integer, p_customers text[], p_kind text, p_query text, p_rank_year integer, p_limit integer, p_since_from date, p_since_to date, p_cities text[]) to authenticated;
grant EXECUTE on FUNCTION public."commercial_member_manual_detail_v47"(p_customer text, p_from date, p_to date, p_stores bigint[], p_offset integer) to authenticated;
grant EXECUTE on FUNCTION public."commercial_member_manual_view_v47"(p_from date, p_to date, p_compare_from date, p_compare_to date, p_stores bigint[], p_source text) to authenticated;
grant EXECUTE on FUNCTION public."commercial_member_monthly_v37"(p_year integer, p_month integer, p_stores bigint[]) to authenticated;
grant EXECUTE on FUNCTION public."commercial_member_profiles_save_v37"(p_rows jsonb) to authenticated;
grant EXECUTE on FUNCTION public."commercial_member_receipt_items_v51"(p_customer text, p_from date, p_to date, p_stores bigint[]) to authenticated;
grant EXECUTE on FUNCTION public."commercial_member_save_v27"(p_data jsonb, p_version integer) to authenticated;
grant EXECUTE on FUNCTION public."commercial_member_search_v51"(p_query text, p_stores bigint[], p_limit integer) to authenticated;
grant EXECUTE on FUNCTION public."commercial_member_snapshot_v27"() to authenticated;
grant EXECUTE on FUNCTION public."commercial_member_sssg_v51"(p_years integer[], p_m1 integer, p_d1 integer, p_m2 integer, p_d2 integer, p_stores bigint[], p_query text, p_kind text, p_sort text, p_limit integer, p_offset integer, p_rank integer, p_align boolean, p_rank_year integer, p_compare integer, p_customers text[], p_since_from date, p_since_to date, p_cities text[]) to authenticated;
grant EXECUTE on FUNCTION public."commercial_member_view_agent_v41"(p_year integer, p_month integer, p_compare_year integer, p_compare_month integer, p_stores bigint[]) to authenticated;
grant EXECUTE on FUNCTION public."commercial_member_view_detail_v39"(p_customer text, p_from date, p_to date, p_stores bigint[], p_offset integer) to authenticated;
grant EXECUTE on FUNCTION public."commercial_member_view_profile_v40"(p_year integer, p_compare integer, p_from text, p_to text, p_month integer, p_stores bigint[]) to authenticated;
grant EXECUTE on FUNCTION public."commercial_member_view_v38"(p_year integer, p_month integer, p_stores bigint[]) to authenticated;
grant EXECUTE on FUNCTION public."commercial_member_view_v39"(p_from date, p_to date, p_compare_from date, p_compare_to date, p_stores bigint[], p_source text) to authenticated;
grant EXECUTE on FUNCTION public."commercial_moka_check_v41"(p_store_id bigint, p_year integer, p_month integer, p_from date, p_to date, p_summary jsonb) to authenticated;
grant EXECUTE on FUNCTION public."commercial_moka_digest_v41"(p_store bigint, p_year integer, p_month integer, p_from date, p_to date) to authenticated;
grant EXECUTE on FUNCTION public."commercial_moka_outlets_v35"() to authenticated;
grant EXECUTE on FUNCTION public."commercial_moka_replace_v41"(p_store_id bigint, p_year integer, p_month integer, p_from date, p_to date, p_rows jsonb, p_period_from date, p_period_to date, p_summary jsonb, p_validated boolean) to authenticated;
grant EXECUTE on FUNCTION public."commercial_pin_list_v1"() to authenticated;
grant EXECUTE on FUNCTION public."commercial_pin_login_v1"(p_pin text, p_remember boolean) to authenticated;
grant EXECUTE on FUNCTION public."commercial_pin_logout_v1"() to authenticated;
grant EXECUTE on FUNCTION public."commercial_pin_save_v1"(p_id uuid, p_name text, p_pin text, p_role text, p_enabled boolean) to authenticated;
grant EXECUTE on FUNCTION public."commercial_pin_session_v1"() to authenticated;
grant EXECUTE on FUNCTION public."commercial_price_list_auto_v38"(p_outlet text, p_city text, p_data jsonb, p_version integer) to authenticated;
grant EXECUTE on FUNCTION public."commercial_price_list_auto_v42"(p_outlet text, p_city text, p_data jsonb, p_version integer) to authenticated;
grant EXECUTE on FUNCTION public."commercial_price_list_save_v24"(p_outlet text, p_city text, p_data jsonb, p_version integer) to authenticated;
grant EXECUTE on FUNCTION public."commercial_price_sync_v43"(p_outlet text, p_city text, p_data jsonb, p_version integer, p_store_id bigint, p_brands jsonb) to authenticated;
grant EXECUTE on FUNCTION public."commercial_program_item_catalog_v1"(p_categories text[], p_exclude text[]) to authenticated;
grant EXECUTE on FUNCTION public."commercial_program_item_catalog_v1"(p_categories text[], p_exclude text[]) to authenticated;
grant EXECUTE on FUNCTION public."commercial_program_item_rollup_v1"(p_year integer, p_m1 integer, p_m2 integer, p_stores integer[], p_brands text[], p_categories text[], p_exclude text[], p_items jsonb) to authenticated;
grant EXECUTE on FUNCTION public."commercial_program_item_rollup_v1"(p_year integer, p_m1 integer, p_m2 integer, p_stores integer[], p_brands text[], p_categories text[], p_exclude text[], p_items jsonb) to authenticated;
grant EXECUTE on FUNCTION public."commercial_scope_v38"(p_menu text, p_stores bigint[]) to authenticated;
grant EXECUTE on FUNCTION public."commercial_touch_revision_v1"() to authenticated;
grant EXECUTE on FUNCTION public."commercial_trx_sales_v1"() to authenticated;
grant EXECUTE on FUNCTION public."item_categories"() to authenticated;
grant EXECUTE on FUNCTION public."item_categories"() to authenticated;
grant EXECUTE on FUNCTION public."item_categories_scoped"(p_year integer, p_m1 integer, p_m2 integer, p_stores bigint[]) to authenticated;
grant EXECUTE on FUNCTION public."item_categories_scoped"(p_year integer, p_m1 integer, p_m2 integer, p_stores bigint[]) to authenticated;
grant EXECUTE on FUNCTION public."item_rollup"(p_dim text, p_year integer, p_m1 integer, p_m2 integer, p_stores bigint[], p_brand text, p_exclude text[], p_limit integer) to authenticated;
grant EXECUTE on FUNCTION public."item_rollup"(p_dim text, p_year integer, p_m1 integer, p_m2 integer, p_stores bigint[], p_brand text, p_exclude text[], p_limit integer) to authenticated;
grant EXECUTE on FUNCTION public."item_rollup"(p_dim text, p_year integer, p_m1 integer, p_m2 integer, p_stores bigint[], p_brand text, p_exclude text[], p_limit integer, p_category text) to authenticated;
grant EXECUTE on FUNCTION public."item_rollup"(p_dim text, p_year integer, p_m1 integer, p_m2 integer, p_stores bigint[], p_brand text, p_exclude text[], p_limit integer, p_category text) to authenticated;
grant EXECUTE on FUNCTION public."item_top"(p_year integer, p_m1 integer, p_m2 integer, p_stores bigint[], p_category text, p_exclude text[], p_limit integer) to authenticated;
grant EXECUTE on FUNCTION public."item_top"(p_year integer, p_m1 integer, p_m2 integer, p_stores bigint[], p_category text, p_exclude text[], p_limit integer) to authenticated;
grant EXECUTE on FUNCTION public."item_totals"(p_year integer, p_m1 integer, p_m2 integer, p_stores bigint[], p_category text, p_exclude text[]) to authenticated;
grant EXECUTE on FUNCTION public."item_totals"(p_year integer, p_m1 integer, p_m2 integer, p_stores bigint[], p_category text, p_exclude text[]) to authenticated;
grant EXECUTE on FUNCTION public."rebuild_sales_actual"(p_year integer, p_month integer) to authenticated;
grant EXECUTE on FUNCTION public."rebuild_sales_actual"(p_year integer, p_month integer) to authenticated;
grant EXECUTE on FUNCTION public."rebuild_transaksi_from_raw"(p_year integer, p_month integer) to authenticated;
grant EXECUTE on FUNCTION public."rebuild_transaksi_from_raw"(p_year integer, p_month integer) to authenticated;
grant EXECUTE on FUNCTION public."recompute_item_enrich"(p_ids bigint[]) to authenticated;
grant EXECUTE on FUNCTION public."recompute_item_enrich"(p_ids bigint[]) to authenticated;
grant EXECUTE on FUNCTION public."trg_item_enrich"() to authenticated;
grant EXECUTE on FUNCTION public."trg_item_enrich"() to authenticated;
grant EXECUTE on FUNCTION public."trg_refresh_item_enrich_from_catbrand"() to authenticated;
grant EXECUTE on FUNCTION public."trg_refresh_item_enrich_from_catbrand"() to authenticated;
grant EXECUTE on FUNCTION public."trg_refresh_item_enrich_from_master"() to authenticated;
grant EXECUTE on FUNCTION public."trg_refresh_item_enrich_from_master"() to authenticated;
grant DELETE on TABLE public."app_settings" to authenticated;
grant INSERT on TABLE public."app_settings" to authenticated;
grant MAINTAIN on TABLE public."app_settings" to authenticated;
grant REFERENCES on TABLE public."app_settings" to authenticated;
grant SELECT on TABLE public."app_settings" to authenticated;
grant TRIGGER on TABLE public."app_settings" to authenticated;
grant TRUNCATE on TABLE public."app_settings" to authenticated;
grant UPDATE on TABLE public."app_settings" to authenticated;
grant DELETE on TABLE public."brand_targets" to authenticated;
grant INSERT on TABLE public."brand_targets" to authenticated;
grant MAINTAIN on TABLE public."brand_targets" to authenticated;
grant REFERENCES on TABLE public."brand_targets" to authenticated;
grant SELECT on TABLE public."brand_targets" to authenticated;
grant TRIGGER on TABLE public."brand_targets" to authenticated;
grant TRUNCATE on TABLE public."brand_targets" to authenticated;
grant UPDATE on TABLE public."brand_targets" to authenticated;
grant DELETE on TABLE public."category_brand" to authenticated;
grant INSERT on TABLE public."category_brand" to authenticated;
grant MAINTAIN on TABLE public."category_brand" to authenticated;
grant REFERENCES on TABLE public."category_brand" to authenticated;
grant SELECT on TABLE public."category_brand" to authenticated;
grant TRIGGER on TABLE public."category_brand" to authenticated;
grant TRUNCATE on TABLE public."category_brand" to authenticated;
grant UPDATE on TABLE public."category_brand" to authenticated;
grant DELETE on TABLE public."channel_targets" to authenticated;
grant INSERT on TABLE public."channel_targets" to authenticated;
grant MAINTAIN on TABLE public."channel_targets" to authenticated;
grant REFERENCES on TABLE public."channel_targets" to authenticated;
grant SELECT on TABLE public."channel_targets" to authenticated;
grant TRIGGER on TABLE public."channel_targets" to authenticated;
grant TRUNCATE on TABLE public."channel_targets" to authenticated;
grant UPDATE on TABLE public."channel_targets" to authenticated;
grant SELECT on TABLE public."commercial_bazar_invoices" to authenticated;
grant SELECT on TABLE public."commercial_bazar_targets" to authenticated;
grant DELETE on TABLE public."commercial_brand_store_cache" to authenticated;
grant INSERT on TABLE public."commercial_brand_store_cache" to authenticated;
grant MAINTAIN on TABLE public."commercial_brand_store_cache" to authenticated;
grant REFERENCES on TABLE public."commercial_brand_store_cache" to authenticated;
grant SELECT on TABLE public."commercial_brand_store_cache" to authenticated;
grant TRIGGER on TABLE public."commercial_brand_store_cache" to authenticated;
grant TRUNCATE on TABLE public."commercial_brand_store_cache" to authenticated;
grant UPDATE on TABLE public."commercial_brand_store_cache" to authenticated;
grant SELECT on TABLE public."commercial_price_list_v24" to authenticated;
grant DELETE on TABLE public."ingest_log" to authenticated;
grant INSERT on TABLE public."ingest_log" to authenticated;
grant MAINTAIN on TABLE public."ingest_log" to authenticated;
grant REFERENCES on TABLE public."ingest_log" to authenticated;
grant SELECT on TABLE public."ingest_log" to authenticated;
grant TRIGGER on TABLE public."ingest_log" to authenticated;
grant TRUNCATE on TABLE public."ingest_log" to authenticated;
grant UPDATE on TABLE public."ingest_log" to authenticated;
grant DELETE on TABLE public."item_sales" to authenticated;
grant INSERT on TABLE public."item_sales" to authenticated;
grant MAINTAIN on TABLE public."item_sales" to authenticated;
grant REFERENCES on TABLE public."item_sales" to authenticated;
grant SELECT on TABLE public."item_sales" to authenticated;
grant TRIGGER on TABLE public."item_sales" to authenticated;
grant TRUNCATE on TABLE public."item_sales" to authenticated;
grant UPDATE on TABLE public."item_sales" to authenticated;
grant DELETE on TABLE public."kpi_entries" to authenticated;
grant INSERT on TABLE public."kpi_entries" to authenticated;
grant MAINTAIN on TABLE public."kpi_entries" to authenticated;
grant REFERENCES on TABLE public."kpi_entries" to authenticated;
grant SELECT on TABLE public."kpi_entries" to authenticated;
grant TRIGGER on TABLE public."kpi_entries" to authenticated;
grant TRUNCATE on TABLE public."kpi_entries" to authenticated;
grant UPDATE on TABLE public."kpi_entries" to authenticated;
grant DELETE on TABLE public."kpi_metrics" to authenticated;
grant INSERT on TABLE public."kpi_metrics" to authenticated;
grant MAINTAIN on TABLE public."kpi_metrics" to authenticated;
grant REFERENCES on TABLE public."kpi_metrics" to authenticated;
grant SELECT on TABLE public."kpi_metrics" to authenticated;
grant TRIGGER on TABLE public."kpi_metrics" to authenticated;
grant TRUNCATE on TABLE public."kpi_metrics" to authenticated;
grant UPDATE on TABLE public."kpi_metrics" to authenticated;
grant DELETE on TABLE public."kpi_weekly" to authenticated;
grant INSERT on TABLE public."kpi_weekly" to authenticated;
grant MAINTAIN on TABLE public."kpi_weekly" to authenticated;
grant REFERENCES on TABLE public."kpi_weekly" to authenticated;
grant SELECT on TABLE public."kpi_weekly" to authenticated;
grant TRIGGER on TABLE public."kpi_weekly" to authenticated;
grant TRUNCATE on TABLE public."kpi_weekly" to authenticated;
grant UPDATE on TABLE public."kpi_weekly" to authenticated;
grant DELETE on TABLE public."moka_customer_daily" to authenticated;
grant INSERT on TABLE public."moka_customer_daily" to authenticated;
grant MAINTAIN on TABLE public."moka_customer_daily" to authenticated;
grant REFERENCES on TABLE public."moka_customer_daily" to authenticated;
grant SELECT on TABLE public."moka_customer_daily" to authenticated;
grant TRIGGER on TABLE public."moka_customer_daily" to authenticated;
grant TRUNCATE on TABLE public."moka_customer_daily" to authenticated;
grant UPDATE on TABLE public."moka_customer_daily" to authenticated;
grant DELETE on TABLE public."moka_hourly" to authenticated;
grant INSERT on TABLE public."moka_hourly" to authenticated;
grant MAINTAIN on TABLE public."moka_hourly" to authenticated;
grant REFERENCES on TABLE public."moka_hourly" to authenticated;
grant SELECT on TABLE public."moka_hourly" to authenticated;
grant TRIGGER on TABLE public."moka_hourly" to authenticated;
grant TRUNCATE on TABLE public."moka_hourly" to authenticated;
grant UPDATE on TABLE public."moka_hourly" to authenticated;
grant DELETE on TABLE public."moka_sales_type_daily" to authenticated;
grant INSERT on TABLE public."moka_sales_type_daily" to authenticated;
grant MAINTAIN on TABLE public."moka_sales_type_daily" to authenticated;
grant REFERENCES on TABLE public."moka_sales_type_daily" to authenticated;
grant SELECT on TABLE public."moka_sales_type_daily" to authenticated;
grant TRIGGER on TABLE public."moka_sales_type_daily" to authenticated;
grant TRUNCATE on TABLE public."moka_sales_type_daily" to authenticated;
grant UPDATE on TABLE public."moka_sales_type_daily" to authenticated;
grant DELETE on TABLE public."moka_sync_coverage" to authenticated;
grant INSERT on TABLE public."moka_sync_coverage" to authenticated;
grant MAINTAIN on TABLE public."moka_sync_coverage" to authenticated;
grant REFERENCES on TABLE public."moka_sync_coverage" to authenticated;
grant SELECT on TABLE public."moka_sync_coverage" to authenticated;
grant TRIGGER on TABLE public."moka_sync_coverage" to authenticated;
grant TRUNCATE on TABLE public."moka_sync_coverage" to authenticated;
grant UPDATE on TABLE public."moka_sync_coverage" to authenticated;
grant DELETE on TABLE public."moka_sync_runs" to authenticated;
grant INSERT on TABLE public."moka_sync_runs" to authenticated;
grant MAINTAIN on TABLE public."moka_sync_runs" to authenticated;
grant REFERENCES on TABLE public."moka_sync_runs" to authenticated;
grant SELECT on TABLE public."moka_sync_runs" to authenticated;
grant TRIGGER on TABLE public."moka_sync_runs" to authenticated;
grant TRUNCATE on TABLE public."moka_sync_runs" to authenticated;
grant UPDATE on TABLE public."moka_sync_runs" to authenticated;
grant DELETE on TABLE public."moka_walkin_daily" to authenticated;
grant INSERT on TABLE public."moka_walkin_daily" to authenticated;
grant MAINTAIN on TABLE public."moka_walkin_daily" to authenticated;
grant REFERENCES on TABLE public."moka_walkin_daily" to authenticated;
grant SELECT on TABLE public."moka_walkin_daily" to authenticated;
grant TRIGGER on TABLE public."moka_walkin_daily" to authenticated;
grant TRUNCATE on TABLE public."moka_walkin_daily" to authenticated;
grant UPDATE on TABLE public."moka_walkin_daily" to authenticated;
grant DELETE on TABLE public."pdca" to authenticated;
grant INSERT on TABLE public."pdca" to authenticated;
grant MAINTAIN on TABLE public."pdca" to authenticated;
grant REFERENCES on TABLE public."pdca" to authenticated;
grant SELECT on TABLE public."pdca" to authenticated;
grant TRIGGER on TABLE public."pdca" to authenticated;
grant TRUNCATE on TABLE public."pdca" to authenticated;
grant UPDATE on TABLE public."pdca" to authenticated;
grant DELETE on TABLE public."people" to authenticated;
grant INSERT on TABLE public."people" to authenticated;
grant MAINTAIN on TABLE public."people" to authenticated;
grant REFERENCES on TABLE public."people" to authenticated;
grant SELECT on TABLE public."people" to authenticated;
grant TRIGGER on TABLE public."people" to authenticated;
grant TRUNCATE on TABLE public."people" to authenticated;
grant UPDATE on TABLE public."people" to authenticated;
grant DELETE on TABLE public."pica" to authenticated;
grant INSERT on TABLE public."pica" to authenticated;
grant MAINTAIN on TABLE public."pica" to authenticated;
grant REFERENCES on TABLE public."pica" to authenticated;
grant SELECT on TABLE public."pica" to authenticated;
grant TRIGGER on TABLE public."pica" to authenticated;
grant TRUNCATE on TABLE public."pica" to authenticated;
grant UPDATE on TABLE public."pica" to authenticated;
grant DELETE on TABLE public."product_master" to authenticated;
grant INSERT on TABLE public."product_master" to authenticated;
grant MAINTAIN on TABLE public."product_master" to authenticated;
grant REFERENCES on TABLE public."product_master" to authenticated;
grant SELECT on TABLE public."product_master" to authenticated;
grant TRIGGER on TABLE public."product_master" to authenticated;
grant TRUNCATE on TABLE public."product_master" to authenticated;
grant UPDATE on TABLE public."product_master" to authenticated;
grant DELETE on TABLE public."sales_actual" to authenticated;
grant INSERT on TABLE public."sales_actual" to authenticated;
grant MAINTAIN on TABLE public."sales_actual" to authenticated;
grant REFERENCES on TABLE public."sales_actual" to authenticated;
grant SELECT on TABLE public."sales_actual" to authenticated;
grant TRIGGER on TABLE public."sales_actual" to authenticated;
grant TRUNCATE on TABLE public."sales_actual" to authenticated;
grant UPDATE on TABLE public."sales_actual" to authenticated;
grant DELETE on TABLE public."sales_type_map" to authenticated;
grant INSERT on TABLE public."sales_type_map" to authenticated;
grant MAINTAIN on TABLE public."sales_type_map" to authenticated;
grant REFERENCES on TABLE public."sales_type_map" to authenticated;
grant SELECT on TABLE public."sales_type_map" to authenticated;
grant TRIGGER on TABLE public."sales_type_map" to authenticated;
grant TRUNCATE on TABLE public."sales_type_map" to authenticated;
grant UPDATE on TABLE public."sales_type_map" to authenticated;
grant DELETE on TABLE public."sales_type_raw" to authenticated;
grant INSERT on TABLE public."sales_type_raw" to authenticated;
grant MAINTAIN on TABLE public."sales_type_raw" to authenticated;
grant REFERENCES on TABLE public."sales_type_raw" to authenticated;
grant SELECT on TABLE public."sales_type_raw" to authenticated;
grant TRIGGER on TABLE public."sales_type_raw" to authenticated;
grant TRUNCATE on TABLE public."sales_type_raw" to authenticated;
grant UPDATE on TABLE public."sales_type_raw" to authenticated;
grant DELETE on TABLE public."store_aliases" to authenticated;
grant INSERT on TABLE public."store_aliases" to authenticated;
grant MAINTAIN on TABLE public."store_aliases" to authenticated;
grant REFERENCES on TABLE public."store_aliases" to authenticated;
grant SELECT on TABLE public."store_aliases" to authenticated;
grant TRIGGER on TABLE public."store_aliases" to authenticated;
grant TRUNCATE on TABLE public."store_aliases" to authenticated;
grant UPDATE on TABLE public."store_aliases" to authenticated;
grant SELECT on TABLE public."store_marketplace_override" to authenticated;
grant DELETE on TABLE public."stores" to authenticated;
grant INSERT on TABLE public."stores" to authenticated;
grant MAINTAIN on TABLE public."stores" to authenticated;
grant REFERENCES on TABLE public."stores" to authenticated;
grant SELECT on TABLE public."stores" to authenticated;
grant TRIGGER on TABLE public."stores" to authenticated;
grant TRUNCATE on TABLE public."stores" to authenticated;
grant UPDATE on TABLE public."stores" to authenticated;
grant DELETE on TABLE public."targets" to authenticated;
grant INSERT on TABLE public."targets" to authenticated;
grant MAINTAIN on TABLE public."targets" to authenticated;
grant REFERENCES on TABLE public."targets" to authenticated;
grant SELECT on TABLE public."targets" to authenticated;
grant TRIGGER on TABLE public."targets" to authenticated;
grant TRUNCATE on TABLE public."targets" to authenticated;
grant UPDATE on TABLE public."targets" to authenticated;
grant DELETE on TABLE public."transaksi" to authenticated;
grant INSERT on TABLE public."transaksi" to authenticated;
grant MAINTAIN on TABLE public."transaksi" to authenticated;
grant REFERENCES on TABLE public."transaksi" to authenticated;
grant SELECT on TABLE public."transaksi" to authenticated;
grant TRIGGER on TABLE public."transaksi" to authenticated;
grant TRUNCATE on TABLE public."transaksi" to authenticated;
grant UPDATE on TABLE public."transaksi" to authenticated;
grant SELECT on SEQUENCE public."brand_targets_id_seq" to authenticated;
grant UPDATE on SEQUENCE public."brand_targets_id_seq" to authenticated;
grant USAGE on SEQUENCE public."brand_targets_id_seq" to authenticated;
grant SELECT on SEQUENCE public."channel_targets_id_seq" to authenticated;
grant UPDATE on SEQUENCE public."channel_targets_id_seq" to authenticated;
grant USAGE on SEQUENCE public."channel_targets_id_seq" to authenticated;
grant SELECT on SEQUENCE public."commercial_master_audit_id_seq" to authenticated;
grant UPDATE on SEQUENCE public."commercial_master_audit_id_seq" to authenticated;
grant USAGE on SEQUENCE public."commercial_master_audit_id_seq" to authenticated;
grant SELECT on SEQUENCE public."ingest_log_id_seq" to authenticated;
grant UPDATE on SEQUENCE public."ingest_log_id_seq" to authenticated;
grant USAGE on SEQUENCE public."ingest_log_id_seq" to authenticated;
grant SELECT on SEQUENCE public."item_sales_id_seq" to authenticated;
grant UPDATE on SEQUENCE public."item_sales_id_seq" to authenticated;
grant USAGE on SEQUENCE public."item_sales_id_seq" to authenticated;
grant SELECT on SEQUENCE public."kpi_entries_id_seq" to authenticated;
grant UPDATE on SEQUENCE public."kpi_entries_id_seq" to authenticated;
grant USAGE on SEQUENCE public."kpi_entries_id_seq" to authenticated;
grant SELECT on SEQUENCE public."kpi_metrics_id_seq" to authenticated;
grant UPDATE on SEQUENCE public."kpi_metrics_id_seq" to authenticated;
grant USAGE on SEQUENCE public."kpi_metrics_id_seq" to authenticated;
grant SELECT on SEQUENCE public."kpi_weekly_id_seq" to authenticated;
grant UPDATE on SEQUENCE public."kpi_weekly_id_seq" to authenticated;
grant USAGE on SEQUENCE public."kpi_weekly_id_seq" to authenticated;
grant SELECT on SEQUENCE public."moka_sync_runs_id_seq" to authenticated;
grant UPDATE on SEQUENCE public."moka_sync_runs_id_seq" to authenticated;
grant USAGE on SEQUENCE public."moka_sync_runs_id_seq" to authenticated;
grant SELECT on SEQUENCE public."pdca_id_seq" to authenticated;
grant UPDATE on SEQUENCE public."pdca_id_seq" to authenticated;
grant USAGE on SEQUENCE public."pdca_id_seq" to authenticated;
grant SELECT on SEQUENCE public."people_id_seq" to authenticated;
grant UPDATE on SEQUENCE public."people_id_seq" to authenticated;
grant USAGE on SEQUENCE public."people_id_seq" to authenticated;
grant SELECT on SEQUENCE public."pica_id_seq" to authenticated;
grant UPDATE on SEQUENCE public."pica_id_seq" to authenticated;
grant USAGE on SEQUENCE public."pica_id_seq" to authenticated;
grant SELECT on SEQUENCE public."sales_actual_id_seq" to authenticated;
grant UPDATE on SEQUENCE public."sales_actual_id_seq" to authenticated;
grant USAGE on SEQUENCE public."sales_actual_id_seq" to authenticated;
grant SELECT on SEQUENCE public."sales_type_map_id_seq" to authenticated;
grant UPDATE on SEQUENCE public."sales_type_map_id_seq" to authenticated;
grant USAGE on SEQUENCE public."sales_type_map_id_seq" to authenticated;
grant SELECT on SEQUENCE public."sales_type_raw_id_seq" to authenticated;
grant UPDATE on SEQUENCE public."sales_type_raw_id_seq" to authenticated;
grant USAGE on SEQUENCE public."sales_type_raw_id_seq" to authenticated;
grant SELECT on SEQUENCE public."store_aliases_id_seq" to authenticated;
grant UPDATE on SEQUENCE public."store_aliases_id_seq" to authenticated;
grant USAGE on SEQUENCE public."store_aliases_id_seq" to authenticated;
grant SELECT on SEQUENCE public."stores_id_seq" to authenticated;
grant UPDATE on SEQUENCE public."stores_id_seq" to authenticated;
grant USAGE on SEQUENCE public."stores_id_seq" to authenticated;
grant SELECT on SEQUENCE public."targets_id_seq" to authenticated;
grant UPDATE on SEQUENCE public."targets_id_seq" to authenticated;
grant USAGE on SEQUENCE public."targets_id_seq" to authenticated;
grant SELECT on SEQUENCE public."transaksi_id_seq" to authenticated;
grant UPDATE on SEQUENCE public."transaksi_id_seq" to authenticated;
grant USAGE on SEQUENCE public."transaksi_id_seq" to authenticated;
grant USAGE on SCHEMA public to authenticated;
grant USAGE on SCHEMA public to authenticated;
grant SELECT on TABLE public."v_growth" to authenticated;
grant SELECT on TABLE public."v_item_enriched" to authenticated;
grant SELECT on TABLE public."v_marketplace" to authenticated;
grant SELECT on TABLE public."v_sales_dashboard" to authenticated;
grant SELECT on TABLE public."v_transaksi" to authenticated;
grant SELECT on TABLE public."v_unmapped_sales_type" to authenticated;
revoke all on TABLE public."app_settings" from anon,public;
revoke all on TABLE public."brand_targets" from anon,public;
revoke all on SEQUENCE public."brand_targets_id_seq" from anon,public;
revoke all on TABLE public."category_brand" from anon,public;
revoke all on TABLE public."channel_targets" from anon,public;
revoke all on SEQUENCE public."channel_targets_id_seq" from anon,public;
revoke all on TABLE public."commercial_bazar_invoices" from anon,public;
revoke all on TABLE public."commercial_bazar_targets" from anon,public;
revoke all on TABLE public."commercial_brand_store_cache" from anon,public;
revoke all on TABLE public."commercial_customer_daily_v47" from anon,public;
revoke all on TABLE public."commercial_master_audit" from anon,public;
revoke all on SEQUENCE public."commercial_master_audit_id_seq" from anon,public;
revoke all on TABLE public."commercial_master_users" from anon,public;
revoke all on TABLE public."commercial_member_complete_v47" from anon,public;
revoke all on TABLE public."commercial_member_data_v27" from anon,public;
revoke all on TABLE public."commercial_member_detail_v47" from anon,public;
revoke all on TABLE public."commercial_member_profiles_v47" from anon,public;
revoke all on TABLE public."commercial_price_list_v24" from anon,public;
revoke all on TABLE public."ingest_log" from anon,public;
revoke all on SEQUENCE public."ingest_log_id_seq" from anon,public;
revoke all on TABLE public."item_sales" from anon,public;
revoke all on SEQUENCE public."item_sales_id_seq" from anon,public;
revoke all on TABLE public."kpi_entries" from anon,public;
revoke all on SEQUENCE public."kpi_entries_id_seq" from anon,public;
revoke all on TABLE public."kpi_metrics" from anon,public;
revoke all on SEQUENCE public."kpi_metrics_id_seq" from anon,public;
revoke all on TABLE public."kpi_weekly" from anon,public;
revoke all on SEQUENCE public."kpi_weekly_id_seq" from anon,public;
revoke all on TABLE public."moka_customer_daily" from anon,public;
revoke all on TABLE public."moka_customer_profiles_v37" from anon,public;
revoke all on TABLE public."moka_customers_v47" from anon,public;
revoke all on TABLE public."moka_hourly" from anon,public;
revoke all on TABLE public."moka_item_brand_v43" from anon,public;
revoke all on TABLE public."moka_member_coverage_v39" from anon,public;
revoke all on TABLE public."moka_member_coverage_v47" from anon,public;
revoke all on TABLE public."moka_member_detail_v39" from anon,public;
revoke all on TABLE public."moka_member_items_v51" from anon,public;
revoke all on TABLE public."moka_member_jobs_v48" from anon,public;
revoke all on TABLE public."moka_member_stage_events_v48" from anon,public;
revoke all on TABLE public."moka_member_stage_profiles_v48" from anon,public;
revoke all on TABLE public."moka_purchase_history_v47" from anon,public;
revoke all on TABLE public."moka_sales_type_daily" from anon,public;
revoke all on TABLE public."moka_sync_checkpoint_v41" from anon,public;
revoke all on TABLE public."moka_sync_component_v45" from anon,public;
revoke all on TABLE public."moka_sync_coverage" from anon,public;
revoke all on TABLE public."moka_sync_runs" from anon,public;
revoke all on SEQUENCE public."moka_sync_runs_id_seq" from anon,public;
revoke all on TABLE public."moka_walkin_daily" from anon,public;
revoke all on TABLE public."pdca" from anon,public;
revoke all on SEQUENCE public."pdca_id_seq" from anon,public;
revoke all on TABLE public."people" from anon,public;
revoke all on SEQUENCE public."people_id_seq" from anon,public;
revoke all on TABLE public."pica" from anon,public;
revoke all on SEQUENCE public."pica_id_seq" from anon,public;
revoke all on TABLE public."product_master" from anon,public;
revoke all on TABLE public."sales_actual" from anon,public;
revoke all on SEQUENCE public."sales_actual_id_seq" from anon,public;
revoke all on TABLE public."sales_type_map" from anon,public;
revoke all on SEQUENCE public."sales_type_map_id_seq" from anon,public;
revoke all on TABLE public."sales_type_raw" from anon,public;
revoke all on SEQUENCE public."sales_type_raw_id_seq" from anon,public;
revoke all on TABLE public."store_aliases" from anon,public;
revoke all on SEQUENCE public."store_aliases_id_seq" from anon,public;
revoke all on TABLE public."store_marketplace_override" from anon,public;
revoke all on TABLE public."stores" from anon,public;
revoke all on SEQUENCE public."stores_id_seq" from anon,public;
revoke all on TABLE public."targets" from anon,public;
revoke all on SEQUENCE public."targets_id_seq" from anon,public;
revoke all on TABLE public."transaksi" from anon,public;
revoke all on SEQUENCE public."transaksi_id_seq" from anon,public;
revoke all on TABLE public."v_growth" from anon,public;
revoke all on TABLE public."v_item_enriched" from anon,public;
revoke all on TABLE public."v_marketplace" from anon,public;
revoke all on TABLE public."v_sales_dashboard" from anon,public;
revoke all on TABLE public."v_transaksi" from anon,public;
revoke all on TABLE public."v_unmapped_sales_type" from anon,public;
revoke all on function public.commercial_access_settings_guard_v37() from anon,public;
revoke all on function public.commercial_bazar_data_v10() from anon,public;
revoke all on function public.commercial_bazar_write_v10(p_kind text, p_action text, p_records jsonb) from anon,public;
revoke all on function public.commercial_brand_monthly_v38(p_menu text, p_stores bigint[]) from anon,public;
revoke all on function public.commercial_brand_store_cache_add() from anon,public;
revoke all on function public.commercial_brand_stores_v1(p_exclude text[]) from anon,public;
revoke all on function public.commercial_city_key_v51(p_city text) from anon,public;
revoke all on function public.commercial_comparison_rollup_v10(p_year integer, p_m1 integer, p_m2 integer, p_stores integer[], p_brands text[], p_categories text[], p_exclude text[], p_dim text) from anon,public;
revoke all on function public.commercial_coverage_v1(p_from date, p_to date, p_stores bigint[]) from anon,public;
revoke all on function public.commercial_customer_freq_v1(p_from date, p_to date, p_stores bigint[]) from anon,public;
revoke all on function public.commercial_customer_stats_v1(p_from date, p_to date, p_stores bigint[]) from anon,public;
revoke all on function public.commercial_customers_v1(p_from date, p_to date, p_stores bigint[], p_query text, p_limit integer) from anon,public;
revoke all on function public.commercial_heatmap_v1(p_from date, p_to date, p_stores bigint[]) from anon,public;
revoke all on function public.commercial_is_master_v1() from anon,public;
revoke all on function public.commercial_item_data_v1(p_year integer, p_m1 integer, p_m2 integer, p_stores integer[], p_brands text[], p_categories text[], p_exclude text[]) from anon,public;
revoke all on function public.commercial_item_detail_v16(p_year integer, p_m1 integer, p_m2 integer, p_stores integer[], p_brands text[], p_categories text[], p_exclude text[]) from anon,public;
revoke all on function public.commercial_item_group_v51(p_name text) from anon,public;
revoke all on function public.commercial_item_rollup_v1(p_year integer, p_m1 integer, p_m2 integer, p_stores integer[], p_brands text[], p_categories text[], p_exclude text[], p_dim text, p_limit integer) from anon,public;
revoke all on function public.commercial_item_rows_v1(p_year integer, p_m1 integer, p_m2 integer, p_stores integer[], p_brands text[], p_categories text[], p_exclude text[]) from anon,public;
revoke all on function public.commercial_master_actor_v1() from anon,public;
revoke all on function public.commercial_master_allowed_v1(p_table text) from anon,public;
revoke all on function public.commercial_master_catalog_v1() from anon,public;
revoke all on function public.commercial_master_keys_v1(p_table text) from anon,public;
revoke all on function public.commercial_master_mutate_v1(p_table text, p_action text, p_key jsonb, p_patch jsonb, p_version text) from anon,public;
revoke all on function public.commercial_master_rows_v1(p_table text, p_query text, p_offset integer, p_limit integer) from anon,public;
revoke all on function public.commercial_master_settings_delete_v1(p_rows jsonb) from anon,public;
revoke all on function public.commercial_master_settings_save_v1(p_rows jsonb) from anon,public;
revoke all on function public.commercial_master_settings_snapshot_v1(p_keys text[]) from anon,public;
revoke all on function public.commercial_member_cities_v51(p_stores bigint[]) from anon,public;
revoke all on function public.commercial_member_customer_v51(p_customer_key text, p_year integer, p_stores bigint[]) from anon,public;
revoke all on function public.commercial_member_customers_upsert_v51(p_profiles jsonb) from anon,public;
revoke all on function public.commercial_member_directory_v51(p_query text, p_since_from date, p_since_to date, p_kind text, p_status text, p_stores bigint[], p_limit integer, p_offset integer, p_cities text[]) from anon,public;
revoke all on function public.commercial_member_import_v39(p_from date, p_to date, p_stores bigint[], p_rows jsonb, p_complete boolean, p_file text) from anon,public;
revoke all on function public.commercial_member_items_replace_v51(p_store_id bigint, p_from date, p_to date, p_rows jsonb, p_reset boolean) from anon,public;
revoke all on function public.commercial_member_items_v51(p_year integer, p_m1 integer, p_d1 integer, p_m2 integer, p_d2 integer, p_stores bigint[], p_align boolean, p_compare integer, p_customers text[], p_kind text, p_query text, p_rank_year integer, p_limit integer, p_since_from date, p_since_to date, p_cities text[]) from anon,public;
revoke all on function public.commercial_member_job_open_v48(p_key text, p_initial jsonb, p_force boolean) from anon,public;
revoke all on function public.commercial_member_job_publish_v48(p_key text, p_revision bigint) from anon,public;
revoke all on function public.commercial_member_job_save_v48(p_key text, p_revision bigint, p_state jsonb, p_profiles jsonb, p_events jsonb, p_finished jsonb, p_reset_customer text) from anon,public;
revoke all on function public.commercial_member_manual_detail_v47(p_customer text, p_from date, p_to date, p_stores bigint[], p_offset integer) from anon,public;
revoke all on function public.commercial_member_manual_view_v47(p_from date, p_to date, p_compare_from date, p_compare_to date, p_stores bigint[], p_source text) from anon,public;
revoke all on function public.commercial_member_monthly_v37(p_year integer, p_month integer, p_stores bigint[]) from anon,public;
revoke all on function public.commercial_member_profiles_save_v37(p_rows jsonb) from anon,public;
revoke all on function public.commercial_member_receipt_items_v51(p_customer text, p_from date, p_to date, p_stores bigint[]) from anon,public;
revoke all on function public.commercial_member_replace_v47(p_scopes jsonb, p_profiles jsonb, p_rows jsonb, p_complete boolean) from anon,public;
revoke all on function public.commercial_member_save_v27(p_data jsonb, p_version integer) from anon,public;
revoke all on function public.commercial_member_search_v51(p_query text, p_stores bigint[], p_limit integer) from anon,public;
revoke all on function public.commercial_member_snapshot_v27() from anon,public;
revoke all on function public.commercial_member_sssg_v51(p_years integer[], p_m1 integer, p_d1 integer, p_m2 integer, p_d2 integer, p_stores bigint[], p_query text, p_kind text, p_sort text, p_limit integer, p_offset integer, p_rank integer, p_align boolean, p_rank_year integer, p_compare integer, p_customers text[], p_since_from date, p_since_to date, p_cities text[]) from anon,public;
revoke all on function public.commercial_member_view_agent_v41(p_year integer, p_month integer, p_compare_year integer, p_compare_month integer, p_stores bigint[]) from anon,public;
revoke all on function public.commercial_member_view_detail_v39(p_customer text, p_from date, p_to date, p_stores bigint[], p_offset integer) from anon,public;
revoke all on function public.commercial_member_view_profile_v40(p_year integer, p_compare integer, p_from text, p_to text, p_month integer, p_stores bigint[]) from anon,public;
revoke all on function public.commercial_member_view_v38(p_year integer, p_month integer, p_stores bigint[]) from anon,public;
revoke all on function public.commercial_member_view_v39(p_from date, p_to date, p_compare_from date, p_compare_to date, p_stores bigint[], p_source text) from anon,public;
revoke all on function public.commercial_moka_check_v41(p_store_id bigint, p_year integer, p_month integer, p_from date, p_to date, p_summary jsonb) from anon,public;
revoke all on function public.commercial_moka_check_v45(p_store_id bigint, p_year integer, p_month integer, p_from date, p_to date, p_summary jsonb, p_components text[]) from anon,public;
revoke all on function public.commercial_moka_digest_v41(p_store bigint, p_year integer, p_month integer, p_from date, p_to date) from anon,public;
revoke all on function public.commercial_moka_digest_v45(p_store bigint, p_year integer, p_month integer, p_from date, p_to date, p_component text) from anon,public;
revoke all on function public.commercial_moka_enqueue_v35(p_mode text, p_requested_by text) from anon,public;
revoke all on function public.commercial_moka_insert_v35(p_table text, p_rows jsonb) from anon,public;
revoke all on function public.commercial_moka_outlets_v35() from anon,public;
revoke all on function public.commercial_moka_replace_v35(p_store_id bigint, p_year integer, p_month integer, p_from date, p_to date, p_rows jsonb) from anon,public;
revoke all on function public.commercial_moka_replace_v41(p_store_id bigint, p_year integer, p_month integer, p_from date, p_to date, p_rows jsonb, p_period_from date, p_period_to date, p_summary jsonb, p_validated boolean) from anon,public;
revoke all on function public.commercial_moka_replace_v45(p_store_id bigint, p_year integer, p_month integer, p_from date, p_to date, p_components text[], p_rows jsonb, p_data_from date, p_data_to date, p_summary jsonb, p_validated boolean) from anon,public;
revoke all on function public.commercial_moka_tables_v45(p_component text) from anon,public;
revoke all on function public.commercial_pin_bootstrap_v1(p_name text, p_pin text) from anon,public;
revoke all on function public.commercial_pin_list_v1() from anon,public;
revoke all on function public.commercial_pin_login_v1(p_pin text, p_remember boolean) from anon,public;
revoke all on function public.commercial_pin_logout_v1() from anon,public;
revoke all on function public.commercial_pin_save_v1(p_id uuid, p_name text, p_pin text, p_role text, p_enabled boolean) from anon,public;
revoke all on function public.commercial_pin_session_v1() from anon,public;
revoke all on function public.commercial_price_list_auto_v38(p_outlet text, p_city text, p_data jsonb, p_version integer) from anon,public;
revoke all on function public.commercial_price_list_auto_v42(p_outlet text, p_city text, p_data jsonb, p_version integer) from anon,public;
revoke all on function public.commercial_price_list_save_v24(p_outlet text, p_city text, p_data jsonb, p_version integer) from anon,public;
revoke all on function public.commercial_price_sync_v43(p_outlet text, p_city text, p_data jsonb, p_version integer, p_store_id bigint, p_brands jsonb) from anon,public;
revoke all on function public.commercial_program_item_catalog_v1(p_categories text[], p_exclude text[]) from anon,public;
revoke all on function public.commercial_program_item_rollup_v1(p_year integer, p_m1 integer, p_m2 integer, p_stores integer[], p_brands text[], p_categories text[], p_exclude text[], p_items jsonb) from anon,public;
revoke all on function public.commercial_scope_v38(p_menu text, p_stores bigint[]) from anon,public;
revoke all on function public.commercial_touch_revision_v1() from anon,public;
revoke all on function public.commercial_trx_sales_v1() from anon,public;
revoke all on function public.item_categories() from anon,public;
revoke all on function public.item_categories_scoped(p_year integer, p_m1 integer, p_m2 integer, p_stores bigint[]) from anon,public;
revoke all on function public.item_rollup(p_dim text, p_year integer, p_m1 integer, p_m2 integer, p_stores bigint[], p_brand text, p_exclude text[], p_limit integer) from anon,public;
revoke all on function public.item_rollup(p_dim text, p_year integer, p_m1 integer, p_m2 integer, p_stores bigint[], p_brand text, p_exclude text[], p_limit integer, p_category text) from anon,public;
revoke all on function public.item_top(p_year integer, p_m1 integer, p_m2 integer, p_stores bigint[], p_category text, p_exclude text[], p_limit integer) from anon,public;
revoke all on function public.item_totals(p_year integer, p_m1 integer, p_m2 integer, p_stores bigint[], p_category text, p_exclude text[]) from anon,public;
revoke all on function public.rebuild_sales_actual(p_year integer, p_month integer) from anon,public;
revoke all on function public.rebuild_transaksi_from_raw(p_year integer, p_month integer) from anon,public;
revoke all on function public.recompute_item_enrich(p_ids bigint[]) from anon,public;
revoke all on function public.trg_item_enrich() from anon,public;
revoke all on function public.trg_refresh_item_enrich_from_catbrand() from anon,public;
revoke all on function public.trg_refresh_item_enrich_from_master() from anon,public;


-- Protect the complete legacy profiling document and outlet-scoped Price List writes.
alter function public.commercial_member_snapshot_v27() security invoker;
grant select on public.commercial_member_data_v27 to authenticated;
drop policy if exists auth_v58_legacy_read on public.commercial_member_data_v27;
create policy auth_v58_legacy_read on public.commercial_member_data_v27 for select to authenticated using(true);
CREATE OR REPLACE FUNCTION commercial_private.auth_price_core_v58(p_outlet text, p_city text, p_data jsonb, p_version integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE actor jsonb;prior public.commercial_price_list_v24;g jsonb;v jsonb;result public.commercial_price_list_v24;numcols integer;BEGIN
 actor:=public.commercial_pin_session_v1();
 IF coalesce(actor->>'role','') NOT IN('master','editor') THEN RAISE EXCEPTION 'PIN master/editor diperlukan' USING errcode='42501';END IF;
 IF p_outlet IS NULL OR length(btrim(p_outlet)) NOT BETWEEN 1 AND 160 OR p_city IS NULL OR p_city NOT IN('MAKASSAR','PALOPO','TORAJA','SAMARINDA','BONE','POLMAN','PALU','MANADO','KENDARI') OR p_version IS NULL OR p_version<0 THEN RAISE EXCEPTION 'Identitas toko/kota/versi tidak valid';END IF;
 IF p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR p_data->>'schema' IS DISTINCT FROM '24' OR jsonb_typeof(p_data->'columns') IS DISTINCT FROM 'array' OR jsonb_typeof(p_data->'groups') IS DISTINCT FROM 'array' OR octet_length(p_data::text)>8000000 THEN RAISE EXCEPTION 'Format Price List tidak valid atau lebih dari 8 MB per toko';END IF;
 numcols:=jsonb_array_length(p_data->'columns');
 IF numcols NOT BETWEEN 1 AND 200 OR jsonb_array_length(p_data->'groups')>30000 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_data->'columns') x WHERE jsonb_typeof(x)<>'string' OR length(x#>>'{}') NOT BETWEEN 1 AND 180) THEN RAISE EXCEPTION 'Kolom/baris Price List tidak valid';END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(p_data->'groups'))<>(SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(p_data->'groups') x) THEN RAISE EXCEPTION 'ID profil ganda/tidak tersedia';END IF;
 IF p_data?'price_vectors' THEN
  IF jsonb_typeof(p_data->'price_vectors') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Vektor harga tidak valid';END IF;
  IF jsonb_array_length(p_data->'price_vectors')>30000 THEN RAISE EXCEPTION 'Terlalu banyak vektor harga';END IF;
  FOR v IN SELECT value FROM jsonb_array_elements(p_data->'price_vectors') LOOP
   IF jsonb_typeof(v) IS DISTINCT FROM 'array' OR jsonb_array_length(v)<>numcols THEN RAISE EXCEPTION 'Panjang vektor harga tidak valid';END IF;
  END LOOP;
 END IF;
 FOR g IN SELECT value FROM jsonb_array_elements(p_data->'groups') LOOP
  IF p_data?'price_vectors' THEN
   IF jsonb_typeof(g->'price_ref') IS DISTINCT FROM 'number' OR (g->>'price_ref')!~'^[0-9]+$' OR (g->>'price_ref')::numeric>=jsonb_array_length(p_data->'price_vectors') THEN RAISE EXCEPTION 'Referensi harga tidak valid';END IF;
   g:=jsonb_set(g,'{prices}',p_data->'price_vectors'->((g->>'price_ref')::integer));
  END IF;
  IF g?'source_count' AND (jsonb_typeof(g->'source_count') IS DISTINCT FROM 'number' OR (g->>'source_count')!~'^[0-9]+$') THEN RAISE EXCEPTION 'Jumlah sumber tidak valid';END IF;
  IF coalesce(length(g->>'id'),0) NOT BETWEEN 1 AND 100 OR coalesce(length(g->>'category'),0) NOT BETWEEN 1 AND 240 OR coalesce(length(g->>'brand'),0) NOT BETWEEN 1 AND 160 OR coalesce(length(g->>'item'),0) NOT BETWEEN 1 AND 400 OR jsonb_typeof(g->'prices') IS DISTINCT FROM 'array' OR jsonb_typeof(g->'variants') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Profil Price List tidak valid';END IF;
  IF jsonb_array_length(g->'prices')<>numcols OR jsonb_array_length(g->'variants')>100000 THEN RAISE EXCEPTION 'Jumlah harga/varian tidak sesuai';END IF;
  FOR v IN SELECT value FROM jsonb_array_elements(g->'prices') LOOP
   IF jsonb_typeof(v) NOT IN('null','number') THEN RAISE EXCEPTION 'Harga harus angka/null';END IF;
   IF jsonb_typeof(v)='number' AND (v#>>'{}')::numeric<0 THEN RAISE EXCEPTION 'Harga negatif tidak valid';END IF;
  END LOOP;
  IF g?'cost_override' AND jsonb_typeof(g->'cost_override') NOT IN('null','number') THEN RAISE EXCEPTION 'Cost harus angka/null';END IF;
  IF jsonb_typeof(g->'cost_override')='number' AND (g->>'cost_override')::numeric<0 THEN RAISE EXCEPTION 'Cost negatif tidak valid';END IF;
  FOR v IN SELECT value FROM jsonb_array_elements(g->'variants') LOOP
   IF jsonb_typeof(v) IS DISTINCT FROM 'array' OR jsonb_array_length(v)<>3 OR jsonb_typeof(v->0) IS DISTINCT FROM 'string' OR jsonb_typeof(v->2) NOT IN('null','number') THEN RAISE EXCEPTION 'Varian sumber tidak valid';END IF;
   IF jsonb_typeof(v->2)='number' AND (v->>2)::numeric<0 THEN RAISE EXCEPTION 'Cost varian negatif';END IF;
  END LOOP;
 END LOOP;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('commercial-price-list-v24'),pg_catalog.hashtext(p_outlet));
 SELECT * INTO prior FROM public.commercial_price_list_v24 WHERE outlet=p_outlet FOR UPDATE;
 IF (prior.outlet IS NULL AND p_version<>0) OR (prior.outlet IS NOT NULL AND prior.version<>p_version) THEN RAISE EXCEPTION 'Price List toko sudah berubah di perangkat lain. Muat ulang sebelum menyimpan.' USING errcode='40001';END IF;
 INSERT INTO public.commercial_price_list_v24(outlet,city,data,version,updated_at) VALUES(p_outlet,p_city,p_data,coalesce(prior.version,0)+1,clock_timestamp())
 ON CONFLICT(outlet) DO UPDATE SET city=excluded.city,data=excluded.data,version=excluded.version,updated_at=excluded.updated_at RETURNING * INTO result;
 RETURN jsonb_build_object('outlet',result.outlet,'city',result.city,'version',result.version,'updated_at',result.updated_at);
END $function$
;
revoke all on function commercial_private.auth_price_core_v58(text,text,jsonb,integer) from public,anon,authenticated;
create or replace function public.commercial_price_list_save_v24(p_outlet text,p_city text,p_data jsonb,p_version integer)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.commercial_auth_row_v58('commercial_price_list_v24',jsonb_build_object('outlet',p_outlet,'city',p_city),true) then raise exception 'Price List di luar hak akses.' using errcode='42501';end if;
 return commercial_private.auth_price_core_v58(p_outlet,p_city,p_data,p_version);
end $$;
grant EXECUTE on FUNCTION public."commercial_brand_store_cache_add"() to service_role;
grant EXECUTE on FUNCTION public."commercial_brand_stores_v1"(p_exclude text[]) to service_role;
grant EXECUTE on FUNCTION public."commercial_city_key_v51"(p_city text) to service_role;
grant EXECUTE on FUNCTION public."commercial_coverage_v1"(p_from date, p_to date, p_stores bigint[]) to service_role;
grant EXECUTE on FUNCTION public."commercial_customer_freq_v1"(p_from date, p_to date, p_stores bigint[]) to service_role;
grant EXECUTE on FUNCTION public."commercial_customer_stats_v1"(p_from date, p_to date, p_stores bigint[]) to service_role;
grant EXECUTE on FUNCTION public."commercial_customers_v1"(p_from date, p_to date, p_stores bigint[], p_query text, p_limit integer) to service_role;
grant EXECUTE on FUNCTION public."commercial_heatmap_v1"(p_from date, p_to date, p_stores bigint[]) to service_role;
grant EXECUTE on FUNCTION public."commercial_item_data_v1"(p_year integer, p_m1 integer, p_m2 integer, p_stores integer[], p_brands text[], p_categories text[], p_exclude text[]) to service_role;
grant EXECUTE on FUNCTION public."commercial_item_group_v51"(p_name text) to service_role;
grant EXECUTE on FUNCTION public."commercial_item_rollup_v1"(p_year integer, p_m1 integer, p_m2 integer, p_stores integer[], p_brands text[], p_categories text[], p_exclude text[], p_dim text, p_limit integer) to service_role;
grant EXECUTE on FUNCTION public."commercial_item_rows_v1"(p_year integer, p_m1 integer, p_m2 integer, p_stores integer[], p_brands text[], p_categories text[], p_exclude text[]) to service_role;
grant EXECUTE on FUNCTION public."commercial_program_item_catalog_v1"(p_categories text[], p_exclude text[]) to service_role;
grant EXECUTE on FUNCTION public."commercial_program_item_rollup_v1"(p_year integer, p_m1 integer, p_m2 integer, p_stores integer[], p_brands text[], p_categories text[], p_exclude text[], p_items jsonb) to service_role;
grant EXECUTE on FUNCTION public."item_categories"() to service_role;
grant EXECUTE on FUNCTION public."item_categories_scoped"(p_year integer, p_m1 integer, p_m2 integer, p_stores bigint[]) to service_role;
grant EXECUTE on FUNCTION public."item_rollup"(p_dim text, p_year integer, p_m1 integer, p_m2 integer, p_stores bigint[], p_brand text, p_exclude text[], p_limit integer) to service_role;
grant EXECUTE on FUNCTION public."item_rollup"(p_dim text, p_year integer, p_m1 integer, p_m2 integer, p_stores bigint[], p_brand text, p_exclude text[], p_limit integer, p_category text) to service_role;
grant EXECUTE on FUNCTION public."item_top"(p_year integer, p_m1 integer, p_m2 integer, p_stores bigint[], p_category text, p_exclude text[], p_limit integer) to service_role;
grant EXECUTE on FUNCTION public."item_totals"(p_year integer, p_m1 integer, p_m2 integer, p_stores bigint[], p_category text, p_exclude text[]) to service_role;
grant EXECUTE on FUNCTION public."rebuild_sales_actual"(p_year integer, p_month integer) to service_role;
grant EXECUTE on FUNCTION public."rebuild_transaksi_from_raw"(p_year integer, p_month integer) to service_role;
grant EXECUTE on FUNCTION public."recompute_item_enrich"(p_ids bigint[]) to service_role;
grant EXECUTE on FUNCTION public."trg_item_enrich"() to service_role;
grant EXECUTE on FUNCTION public."trg_refresh_item_enrich_from_catbrand"() to service_role;
grant EXECUTE on FUNCTION public."trg_refresh_item_enrich_from_master"() to service_role;
grant USAGE on SCHEMA public to service_role;


-- Guard mutating SECURITY DEFINER functions independently of the HTTP endpoint.
create or replace function commercial_private.auth_write_guard_v58(p_function text) returns void language plpgsql stable security definer set search_path='' as $$
declare claims jsonb;ctx jsonb;
begin
 if not (select enabled from commercial_private.auth_config_v58 where id) then return;end if;
 claims:=coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
 if claims->>'role'='service_role' or (claims->>'role' is null and session_user in ('postgres','supabase_admin')) then return;end if;
 ctx:=commercial_private.auth_context_v58();
 if ctx->>'id' is null then raise exception 'Akun aktif diperlukan.' using errcode='42501';end if;
 if ctx->>'access_role'='viewer' or coalesce((ctx->'rule'->>'view_only')::boolean,false) then raise exception 'Viewer hanya dapat membaca data.' using errcode='42501';end if;
 if ctx->>'role'='master' then return;end if;
 if not commercial_private.auth_resource_v58(p_function,ctx) then raise exception 'Operasi ini memerlukan hak Master.' using errcode='42501';end if;
end $$;
revoke all on function commercial_private.auth_write_guard_v58(text) from public,anon,authenticated;
CREATE OR REPLACE FUNCTION public.commercial_bazar_write_v10(p_kind text, p_action text, p_records jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid;record jsonb;d jsonb;old_row jsonb;new_row jsonb;key uuid;expected timestamptz;store_name text;invoice_name text;item jsonb;result jsonb='[]'::jsonb;table_name text;begin
 perform commercial_private.auth_write_guard_v58('commercial_bazar_write_v10');

 actor:=public.commercial_master_actor_v1();if actor is null then raise exception 'Masuk dengan PIN master/editor untuk mengelola Bazar' using errcode='42501';end if;
 if p_kind not in ('invoice','target') or p_action not in ('save','delete') or jsonb_typeof(p_records) is distinct from 'array' or jsonb_array_length(p_records)<1 or jsonb_array_length(p_records)>5000 then raise exception 'Permintaan Bazar tidak valid (maksimal 5000 record)';end if;
 perform pg_catalog.pg_advisory_xact_lock(1738701,10);table_name:=case when p_kind='invoice' then 'commercial_bazar_invoices' else 'commercial_bazar_targets' end;
 for record in select value from jsonb_array_elements(p_records) loop
  old_row:=null;new_row:=null;key:=nullif(record->>'id','')::uuid;expected:=nullif(record->>'version','')::timestamptz;
  if key is not null then execute format('select to_jsonb(t) from public.%I t where id=$1 for update',table_name) into old_row using key;if old_row is null then raise exception 'Data Bazar sudah dihapus; muat ulang' using errcode='40001';end if;if expected is null or expected is distinct from (old_row->>'version')::timestamptz then raise exception 'Data Bazar sudah berubah; muat ulang sebelum menyimpan' using errcode='40001';end if;
  elsif expected is not null or p_action='delete' then raise exception 'ID dan versi data diperlukan';end if;
  if p_action='delete' then execute format('delete from public.%I where id=$1',table_name) using key;
  else
   d:=record->'data';if jsonb_typeof(d) is distinct from 'object' or octet_length(d::text)>2000000 then raise exception 'Data Bazar tidak valid atau terlalu besar';end if;store_name:=btrim(d->>'store');if store_name is null or length(store_name) not between 1 and 160 then raise exception 'Nama Bazar wajib diisi (maksimal 160 karakter)';end if;
   if p_kind='invoice' then
    invoice_name:=upper(btrim(d->>'invoice'));if invoice_name is null or length(invoice_name) not between 1 and 160 or coalesce(d->>'date','')!~'^\d{4}-\d{2}-\d{2}$' then raise exception 'Invoice dan tanggal wajib valid';end if;
    perform (d->>'date')::date;if coalesce(d->>'time','')<>'' then perform (d->>'time')::time;end if;
    if jsonb_typeof(d->'qty') is distinct from 'number' or (d->>'qty')::numeric<0 or (d->>'qty')::numeric<>trunc((d->>'qty')::numeric) or jsonb_typeof(d->'net') is distinct from 'number' or (d->>'net')::numeric<0 or jsonb_typeof(d->'refund') is distinct from 'number' or (d->>'refund')::numeric<0 then raise exception 'Qty, refund atau net transaksi tidak valid';end if;
    if jsonb_typeof(d->'items') is distinct from 'array' or jsonb_array_length(d->'items')<1 or jsonb_array_length(d->'items')>2000 then raise exception 'Invoice memerlukan 1–2000 baris item';end if;
    for item in select value from jsonb_array_elements(d->'items') loop
     if length(coalesce(btrim(item->>'item'),'')) not between 1 and 300 or jsonb_typeof(item->'qty') is distinct from 'number' or (item->>'qty')::numeric<0 or (item->>'qty')::numeric<>trunc((item->>'qty')::numeric) or jsonb_typeof(item->'subtotal') is distinct from 'number' or (item->>'subtotal')::numeric<0 then raise exception 'Detail item tidak valid';end if;
    end loop;
    d:=jsonb_build_object('store',store_name,'invoice',invoice_name,'date',d->>'date','time',coalesce(d->>'time',''),'period',left(coalesce(d->>'period',''),300),'payment',left(coalesce(d->>'payment',''),100),'sales_type',left(coalesce(d->>'sales_type',''),100),'qty',(d->>'qty')::numeric,'refund',round((d->>'refund')::numeric,2),'net',round((d->>'net')::numeric,2),'items',d->'items','note',left(coalesce(d->>'note',''),4000),'source_file',left(coalesce(d->>'source_file',''),300));
    if key is null then
     if exists(select 1 from public.commercial_bazar_invoices where lower(btrim(store))=lower(store_name) and upper(btrim(invoice))=invoice_name) then raise exception 'Invoice sudah ada. Muat ulang sebelum upload agar tidak menimpa perubahan.' using errcode='40001';end if;
     insert into public.commercial_bazar_invoices(store,invoice,data) values(store_name,invoice_name,d) returning to_jsonb(commercial_bazar_invoices.*) into new_row;
    else update public.commercial_bazar_invoices set store=store_name,invoice=invoice_name,data=d,version=clock_timestamp() where id=key returning to_jsonb(commercial_bazar_invoices.*) into new_row;end if;
   else
    if coalesce(d->>'start_date','')!~'^\d{4}-\d{2}-\d{2}$' or coalesce(d->>'end_date','')!~'^\d{4}-\d{2}-\d{2}$' or (d->>'end_date')::date<(d->>'start_date')::date or jsonb_typeof(d->'amount') is distinct from 'number' or (d->>'amount')::numeric<0 then raise exception 'Tanggal atau nominal target tidak valid';end if;
    if exists(select 1 from public.commercial_bazar_targets where lower(btrim(store))=lower(store_name) and (key is null or id<>key) and start_date<=(d->>'end_date')::date and end_date>=(d->>'start_date')::date) then raise exception 'Rentang target untuk Bazar ini tumpang tindih. Edit target yang sudah ada.';end if;
    if key is null then insert into public.commercial_bazar_targets(store,start_date,end_date,amount,period,note) values(store_name,(d->>'start_date')::date,(d->>'end_date')::date,round((d->>'amount')::numeric,2),left(coalesce(d->>'period',''),300),left(coalesce(d->>'note',''),2000)) returning to_jsonb(commercial_bazar_targets.*) into new_row;
    else update public.commercial_bazar_targets set store=store_name,start_date=(d->>'start_date')::date,end_date=(d->>'end_date')::date,amount=round((d->>'amount')::numeric,2),period=left(coalesce(d->>'period',''),300),note=left(coalesce(d->>'note',''),2000),version=clock_timestamp() where id=key returning to_jsonb(commercial_bazar_targets.*) into new_row;end if;
   end if;
  end if;
  insert into public.commercial_master_audit(user_id,table_name,action,record_key,before_data,after_data) values(actor,table_name,p_action,jsonb_build_object('id',coalesce(new_row->>'id',key::text)),old_row,new_row);
  result:=result||jsonb_build_array(jsonb_build_object('id',coalesce(new_row->>'id',key::text),'version',new_row->>'version'));
 end loop;
 return jsonb_build_object('saved',true,'records',result);
end $function$
;
CREATE OR REPLACE FUNCTION public.commercial_master_settings_delete_v1(p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare row jsonb;result jsonb='[]'::jsonb;
begin
 perform commercial_private.auth_write_guard_v58('commercial_master_settings_delete_v1');

 if not public.commercial_is_master_v1() then raise exception 'Akses master diperlukan' using errcode='42501';end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>5000 then raise exception 'Batch maksimal 5000 input';end if;
 for row in select value from jsonb_array_elements(p_rows) order by value->>'key' loop result:=result||jsonb_build_array(public.commercial_master_mutate_v1('app_settings','delete',jsonb_build_object('key',row->>'key'),'{}'::jsonb,row->>'version'));end loop;return result;
end $function$
;
CREATE OR REPLACE FUNCTION public.commercial_member_customers_upsert_v51(p_profiles jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
 SET statement_timeout TO '90s'
AS $function$
declare n integer;
begin
 perform commercial_private.auth_write_guard_v58('commercial_member_customers_upsert_v51');

  if jsonb_typeof(p_profiles) is distinct from 'array' or jsonb_array_length(p_profiles) not between 1 and 10000 then
    raise exception 'Payload profil Member tidak valid';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_profiles) p(customer_key text, source_id text)
             where p.customer_key is distinct from 'MOKA:' || p.source_id or nullif(btrim(p.source_id), '') is null) then
    raise exception 'Identitas Customer List tidak valid';
  end if;
  insert into moka_customers_v47 (customer_key, source_id, name, city, phone, cust_since, checked_at)
  select distinct on (p.customer_key) p.customer_key, p.source_id, coalesce(nullif(btrim(p.name), ''), '(tanpa nama)'),
         nullif(btrim(p.city), ''), nullif(btrim(p.phone), ''), p.cust_since, now()
  from jsonb_to_recordset(p_profiles) p(customer_key text, source_id text, name text, city text, phone text, cust_since date)
  order by p.customer_key
  on conflict (customer_key) do update
    set source_id = excluded.source_id, name = excluded.name, city = excluded.city, phone = excluded.phone,
        cust_since = excluded.cust_since, checked_at = now();
  get diagnostics n = row_count;
  return jsonb_build_object('profiles', n);
end
$function$
;
CREATE OR REPLACE FUNCTION public.commercial_member_import_v39(p_from date, p_to date, p_stores bigint[], p_rows jsonb, p_complete boolean DEFAULT false, p_file text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
 SET statement_timeout TO '55s'
AS $function$
declare actor jsonb;n integer;
begin
 perform commercial_private.auth_write_guard_v58('commercial_member_import_v39');

 actor:=public.commercial_pin_session_v1();
 if actor->>'role' is distinct from 'master' then raise exception 'Hanya master dapat mengimpor detail Customer List' using errcode='42501';end if;
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>1096 or coalesce(cardinality(p_stores),0)=0 then raise exception 'Rentang/toko impor tidak valid';end if;
 if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)>50000 then raise exception 'Maksimal 50.000 nota per impor; pecah per bulan/toko';end if;
 if exists(select 1 from unnest(p_stores) x where not exists(select 1 from stores s where s.id=x)) then raise exception 'Toko tidak dikenal';end if;
 if exists(select 1 from jsonb_to_recordset(p_rows) as r(store_id bigint,transaction_id text,customer_key text,customer_name text,sale_date date,net numeric,kind text,identity_basis text)
  where store_id is null or not(store_id=any(p_stores)) or sale_date is null or sale_date not between p_from and p_to
   or nullif(btrim(transaction_id),'') is null or nullif(btrim(customer_key),'') is null or nullif(btrim(customer_name),'') is null or net is null
   or coalesce(kind,'sale') not in('sale','refund') or (kind='refund' and net>0) or (coalesce(kind,'sale')='sale' and net<0) or identity_basis not in('source_id','name_snapshot')) then raise exception 'Baris impor tidak valid: periksa nota, identitas, toko, tanggal dan nilai refund negatif';end if;
 if exists(select 1 from jsonb_to_recordset(p_rows) as r(store_id bigint,transaction_id text) group by r.store_id,r.transaction_id having count(*)>1) then raise exception 'Nota ganda dalam file. Gunakan satu baris per nota, bukan baris item';end if;
 perform pg_advisory_xact_lock(hashtext('member-import-v39'));
 -- Never move an existing receipt from another date/customer silently.
 if exists(select 1 from jsonb_to_recordset(p_rows) as r(store_id bigint,transaction_id text,sale_date date) join moka_member_detail_v39 d using(store_id,transaction_id)
  where d.sale_date not between p_from and p_to) then raise exception 'ID nota sudah digunakan di luar rentang impor';end if;
 delete from moka_member_detail_v39 where store_id=any(p_stores) and sale_date between p_from and p_to;
 insert into moka_member_detail_v39(store_id,transaction_id,customer_key,customer_name,sale_date,net,items,kind,identity_basis,source_file)
 select store_id,btrim(transaction_id),btrim(customer_key),btrim(customer_name),sale_date,net,items,coalesce(kind,'sale'),coalesce(identity_basis,'source_id'),p_file
 from jsonb_to_recordset(p_rows) as r(store_id bigint,transaction_id text,customer_key text,customer_name text,sale_date date,net numeric,items numeric,kind text,identity_basis text);
 get diagnostics n=row_count;
 delete from moka_member_coverage_v39 where store_id=any(p_stores) and sale_date between p_from and p_to;
 if p_complete then
  insert into moka_member_coverage_v39(store_id,sale_date,source_file)
  select s,d::date,p_file from unnest(p_stores) s cross join generate_series(p_from,p_to,interval '1 day') d;
 end if;
 return jsonb_build_object('receipts',n,'complete',p_complete,'from',p_from,'to',p_to);
end $function$
;
CREATE OR REPLACE FUNCTION public.commercial_member_items_replace_v51(p_store_id bigint, p_from date, p_to date, p_rows jsonb, p_reset boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
 SET statement_timeout TO '90s'
AS $function$
declare n integer;
begin
 perform commercial_private.auth_write_guard_v58('commercial_member_items_replace_v51');

  if p_store_id is null or p_from is null or p_to is null or p_from > p_to or p_to - p_from > 366
     or not exists (select 1 from stores where id = p_store_id)
     or jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) > 20000 then
    raise exception 'Payload item Member tidak valid';
  end if;
  if exists (select 1 from jsonb_to_recordset(p_rows) r(sale_date date, customer_key text, item_name text)
             where r.sale_date is null or r.sale_date not between p_from and p_to
                or nullif(btrim(r.customer_key), '') is null or nullif(btrim(r.item_name), '') is null) then
    raise exception 'Baris item Member di luar cakupan';
  end if;
  if p_reset then
    delete from moka_member_items_v51 where store_id = p_store_id and sale_date between p_from and p_to;
  end if;
  insert into moka_member_items_v51 (store_id, transaction_id, line_no, customer_key, sale_date, item_name, variant_name, category_name, qty, net)
  select p_store_id, r.transaction_id, r.line_no, r.customer_key, r.sale_date, r.item_name, nullif(r.variant_name, ''), nullif(r.category_name, ''),
         coalesce(r.qty, 0), coalesce(r.net, 0)
  from jsonb_to_recordset(p_rows) r(transaction_id uuid, line_no integer, customer_key text, sale_date date, item_name text,
                                    variant_name text, category_name text, qty numeric, net numeric)
  on conflict (store_id, transaction_id, line_no) do update
    set customer_key = excluded.customer_key, sale_date = excluded.sale_date, item_name = excluded.item_name,
        variant_name = excluded.variant_name, category_name = excluded.category_name, qty = excluded.qty, net = excluded.net;
  get diagnostics n = row_count;
  return jsonb_build_object('rows', n);
end
$function$
;
CREATE OR REPLACE FUNCTION public.commercial_member_job_open_v48(p_key text, p_initial jsonb, p_force boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare j moka_member_jobs_v48;
begin
 perform commercial_private.auth_write_guard_v58('commercial_member_job_open_v48');

 if p_key is null or p_key !~ '^[a-f0-9]{64}$' or p_initial->>'phase' is distinct from 'customers' or jsonb_typeof(p_initial->'scopes') is distinct from 'array' then raise exception 'Checkpoint tidak valid';end if;
 perform pg_advisory_xact_lock(hashtext('member-resume-v48'));
 delete from moka_member_jobs_v48 where expires_at<now() or (coalesce(p_force,false) and job_key=p_key);
 if exists(select 1 from moka_member_jobs_v48 where job_key<>p_key) then raise exception 'Ada checkpoint rentang/toko lain. Lanjutkan cakupan yang sama; penghapusan checkpoint cakupan lain memerlukan admin database';end if;
 insert into moka_member_jobs_v48(job_key,state) values(p_key,p_initial) on conflict do nothing;
 select * into j from moka_member_jobs_v48 where job_key=p_key;
 return jsonb_build_object('revision',j.revision,'state',j.state,'profiles',coalesce((select jsonb_agg(profile order by ordinal) from moka_member_stage_profiles_v48 where job_key=p_key),'[]'));
end $function$
;
CREATE OR REPLACE FUNCTION public.commercial_member_job_publish_v48(p_key text, p_revision bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
 SET statement_timeout TO '100s'
AS $function$
declare j moka_member_jobs_v48;profiles jsonb;rows jsonb;r jsonb;n bigint;
begin
 perform commercial_private.auth_write_guard_v58('commercial_member_job_publish_v48');

 select * into j from moka_member_jobs_v48 where job_key=p_key for update;
 if not found or j.revision<>p_revision or j.expires_at<now() or j.state->>'phase' is distinct from 'ready' then raise exception 'Checkpoint belum lengkap atau berubah';end if;
 select coalesce(jsonb_agg(profile order by ordinal),'[]'),count(*) into profiles,n from moka_member_stage_profiles_v48 where job_key=p_key;
 if n=0 or n<>(j.state->>'index')::bigint then raise exception 'Jumlah customer selesai tidak sesuai';end if;
 select coalesce(jsonb_agg(payload),'[]') into rows from moka_member_stage_events_v48 where job_key=p_key and payload is not null;
 if jsonb_array_length(rows)<>(j.state->>'selected')::bigint then raise exception 'Jumlah nota tidak sesuai checkpoint';end if;
 r:=public.commercial_member_replace_v47(j.state->'scopes',profiles,rows,coalesce((j.state->>'unknown')::bigint,0)=0);
 -- Publish and temporary cleanup are one transaction; an error preserves both old main data and staging.
 delete from moka_member_jobs_v48 where job_key=p_key;
 return r||jsonb_build_object('customers',n,'unmapped_payments',(j.state->>'unknown')::bigint);
end $function$
;
CREATE OR REPLACE FUNCTION public.commercial_member_job_save_v48(p_key text, p_revision bigint, p_state jsonb, p_profiles jsonb, p_events jsonb, p_finished jsonb, p_reset_customer text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
 SET statement_timeout TO '60s'
AS $function$
declare j moka_member_jobs_v48;v bigint;
begin
 perform commercial_private.auth_write_guard_v58('commercial_member_job_save_v48');

 select * into j from moka_member_jobs_v48 where job_key=p_key for update;
 if not found or j.revision<>p_revision or j.expires_at<now() then raise exception 'Checkpoint kedaluwarsa atau berubah';end if;
 if coalesce(p_state->>'phase','') not in('customers','history','ready') or (p_state->'scopes') is distinct from (j.state->'scopes')
 or jsonb_typeof(p_profiles) is distinct from 'array' or jsonb_array_length(p_profiles)>1000
 or jsonb_typeof(p_events) is distinct from 'array' or jsonb_array_length(p_events)>1000
 or jsonb_typeof(p_finished) is distinct from 'array' then raise exception 'Payload checkpoint tidak valid';end if;
 if p_reset_customer is not null then
  if not exists(select 1 from moka_member_stage_profiles_v48 where job_key=p_key and customer_key=p_reset_customer) then raise exception 'Customer reset tidak dikenal';end if;
  delete from moka_member_stage_events_v48 where job_key=p_key and customer_key=p_reset_customer;
 end if;
 insert into moka_member_stage_profiles_v48(job_key,customer_key,ordinal,profile)
 select p_key,x->'profile'->>'customer_key',(x->>'ordinal')::bigint,x->'profile' from jsonb_array_elements(p_profiles) x;
 if (select count(*) from moka_member_stage_profiles_v48 where job_key=p_key)>100000 then raise exception 'Batas profil checkpoint';end if;
 -- UUID duplicates stop the job; they are never silently summed/upserted.
 insert into moka_member_stage_events_v48(job_key,transaction_id,customer_key,payload)
 select p_key,(x->>'uuid')::uuid,x->>'customer_key',nullif(x->'payload','null'::jsonb) from jsonb_array_elements(p_events) x;
 -- Receipt IDs outside selected scope are needed only while that customer's pages are validated.
 delete from moka_member_stage_events_v48 where job_key=p_key and payload is null and customer_key in(select jsonb_array_elements_text(p_finished));
 if (select count(*) from moka_member_stage_events_v48 where job_key=p_key and payload is not null)>500000 then raise exception 'Batas nota checkpoint';end if;
 update moka_member_jobs_v48 set state=p_state,revision=revision+1 where job_key=p_key returning revision into v;
 return jsonb_build_object('revision',v);
end $function$
;
CREATE OR REPLACE FUNCTION public.commercial_member_profiles_save_v37(p_rows jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare actor jsonb; n integer;
begin
 perform commercial_private.auth_write_guard_v58('commercial_member_profiles_save_v37');

 actor:=public.commercial_pin_session_v1();
 if actor->>'role' is distinct from 'master' then raise exception 'Hanya master dapat memetakan profil customer' using errcode='42501'; end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>10000 then raise exception 'Profil tidak valid'; end if;
 if exists(select 1 from jsonb_array_elements(p_rows) r where nullif(btrim(r->>'customer_key'),'') is null) then
 raise exception 'Customer ID Moka wajib diisi; nama/telepon tidak dijadikan kunci otomatis'; end if;
 insert into public.moka_customer_profiles_v37(customer_key,name,city,phone,cust_since,source)
 select customer_key,name,city,phone,cust_since,coalesce(source,'{}'::jsonb)
 from jsonb_to_recordset(p_rows) as r(customer_key text,name text,city text,phone text,cust_since date,source jsonb)
 on conflict(customer_key) do update set name=excluded.name,city=excluded.city,phone=excluded.phone,cust_since=excluded.cust_since,source=excluded.source,updated_at=now();
 get diagnostics n=row_count;return n;
end $function$
;
CREATE OR REPLACE FUNCTION public.commercial_member_replace_v47(p_scopes jsonb, p_profiles jsonb, p_rows jsonb, p_complete boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
 SET statement_timeout TO '90s'
AS $function$
declare n integer;
begin
 perform commercial_private.auth_write_guard_v58('commercial_member_replace_v47');

 if jsonb_typeof(p_scopes) is distinct from 'array' or jsonb_array_length(p_scopes) not between 1 and 1200
 or jsonb_typeof(p_profiles) is distinct from 'array' or jsonb_array_length(p_profiles) not between 1 and 100000
 or jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows)>500000 then raise exception 'Payload Member tidak valid';end if;
 if exists(select 1 from jsonb_to_recordset(p_scopes) s(store_id bigint,date_from date,date_to date)
 where store_id is null or date_from is null or date_to is null or date_from>date_to or date_to-date_from>366
 or not exists(select 1 from stores st where st.id=s.store_id)) then raise exception 'Cakupan toko/tanggal tidak valid';end if;
 if exists(select 1 from jsonb_to_recordset(p_profiles) p(customer_key text,source_id text,name text)
 where customer_key is distinct from 'MOKA:'||source_id or nullif(btrim(source_id),'') is null or nullif(btrim(name),'') is null) then raise exception 'Identitas Customer List tidak valid';end if;
 if exists(select 1 from jsonb_to_recordset(p_profiles) p(customer_key text) group by customer_key having count(*)>1) then raise exception 'Customer ID ganda';end if;
 if exists(select 1 from jsonb_to_recordset(p_rows) r(transaction_id uuid,store_id bigint,customer_key text,customer_name text,name_basis text,created_at timestamptz,sale_date date,net numeric,kind text)
 where transaction_id is null or customer_key is null or store_id is null or sale_date is null or created_at is null or nullif(btrim(customer_name),'') is null
 or name_basis not in('history','customer_list_at_import') or name_basis is null or net is null or net::text in('NaN','Infinity','-Infinity')
 or kind not in('sale','refund') or kind is null or (kind='sale' and net<0) or (kind='refund' and net>0)
 or not exists(select 1 from jsonb_to_recordset(p_scopes) s(store_id bigint,date_from date,date_to date) where s.store_id=r.store_id and r.sale_date between s.date_from and s.date_to)
 or not exists(select 1 from jsonb_to_recordset(p_profiles) p(customer_key text) where p.customer_key=r.customer_key)) then raise exception 'Nota/refund keluar cakupan atau tidak valid';end if;
 if exists(select 1 from jsonb_to_recordset(p_rows) r(transaction_id uuid) group by transaction_id having count(*)>1) then raise exception 'UUID nota/refund ganda';end if;
 perform pg_advisory_xact_lock(hashtext('member-purchase-history-v47'));
 -- Do not silently reassign a historical UUID to another customer/store or reporting date.
 if exists(select 1 from jsonb_to_recordset(p_rows) r(transaction_id uuid,store_id bigint,customer_key text,sale_date date)
 join moka_purchase_history_v47 d using(transaction_id)
 where d.store_id<>r.store_id or d.customer_key<>r.customer_key or d.sale_date<>r.sale_date) then raise exception 'Identitas/cabang/tanggal UUID berubah; perlu verifikasi';end if;
 insert into moka_customers_v47(customer_key,source_id,name,city,phone,cust_since)
 select customer_key,source_id,name,city,phone,cust_since from jsonb_to_recordset(p_profiles) p(customer_key text,source_id text,name text,city text,phone text,cust_since date)
 on conflict(customer_key) do update set name=excluded.name,city=excluded.city,phone=excluded.phone,cust_since=excluded.cust_since,checked_at=now();
 -- Preserve earlier API history for customers no longer returned by Customer List.
 -- Delete only vanished receipts of fetched customers within the explicitly selected scope.
 delete from moka_purchase_history_v47 d where exists(select 1 from jsonb_to_recordset(p_scopes) s(store_id bigint,date_from date,date_to date) where s.store_id=d.store_id and d.sale_date between s.date_from and s.date_to)
 and exists(select 1 from jsonb_to_recordset(p_profiles) p(customer_key text) where p.customer_key=d.customer_key)
 and not exists(select 1 from jsonb_to_recordset(p_rows) r(transaction_id uuid) where r.transaction_id=d.transaction_id);
 insert into moka_purchase_history_v47(store_id,transaction_id,customer_key,customer_name,name_basis,created_at,sale_date,net,kind)
 select store_id,transaction_id,customer_key,customer_name,name_basis,created_at,sale_date,net,kind from jsonb_to_recordset(p_rows) r(store_id bigint,transaction_id uuid,customer_key text,customer_name text,name_basis text,created_at timestamptz,sale_date date,net numeric,kind text)
 on conflict(store_id,transaction_id) do update set net=excluded.net,kind=excluded.kind,created_at=excluded.created_at,checked_at=now(),
 customer_name=case when excluded.name_basis='history' then excluded.customer_name else moka_purchase_history_v47.customer_name end,
 name_basis=case when excluded.name_basis='history' then 'history' else moka_purchase_history_v47.name_basis end;
 get diagnostics n=row_count;
 insert into moka_member_coverage_v47(store_id,sale_date,complete)
 select distinct s.store_id,d::date,
 (coalesce(p_complete,false) and d::date<(now() at time zone 'Asia/Makassar')::date and not exists(select 1 from moka_purchase_history_v47 old where old.store_id=s.store_id and old.sale_date between s.date_from and s.date_to and not exists(select 1 from jsonb_to_recordset(p_profiles) p(customer_key text) where p.customer_key=old.customer_key)))
 from jsonb_to_recordset(p_scopes) s(store_id bigint,date_from date,date_to date) cross join lateral generate_series(s.date_from,s.date_to,interval '1 day') d
 on conflict(store_id,sale_date) do update set complete=excluded.complete,checked_at=now();
 insert into app_settings(key,value) values('commercial_member_source_v47','customer_list_purchase_history'),('commercial_member_checked_v47',now()::text)
 on conflict(key) do update set value=excluded.value;
 return jsonb_build_object('receipts',n,'profiles',jsonb_array_length(p_profiles),'source','customer_list_purchase_history');
end $function$
;
CREATE OR REPLACE FUNCTION public.commercial_member_save_v27(p_data jsonb, p_version integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE actor jsonb;r jsonb;v jsonb;k text;p jsonb;prior integer;result public.commercial_member_data_v27;BEGIN
 perform commercial_private.auth_write_guard_v58('commercial_member_save_v27');

 actor:=public.commercial_pin_session_v1();IF coalesce(actor->>'role','') NOT IN('master','editor') THEN RAISE EXCEPTION 'PIN master/editor diperlukan' USING errcode='42501';END IF;
 IF p_version IS NULL OR p_version<0 OR p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR p_data->>'schema' IS DISTINCT FROM '27' OR jsonb_typeof(p_data->'records') IS DISTINCT FROM 'array' OR jsonb_typeof(p_data->'periods') IS DISTINCT FROM 'object' OR octet_length(p_data::text)>8000000 THEN RAISE EXCEPTION 'Payload Data Member tidak valid / lebih dari 8 MB';END IF;
 IF jsonb_array_length(p_data->'records')>20000 THEN RAISE EXCEPTION 'Maksimal 20000 customer per snapshot';END IF;
 FOR k,p IN SELECT * FROM jsonb_each(p_data->'periods') LOOP
  IF k!~'^20[0-9]{2}$' OR p->>'year' IS DISTINCT FROM k OR coalesce(p->>'kind','') NOT IN('annual','ytd') OR coalesce(p->>'month','')!~'^(?:[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Periode revenue tidak valid';END IF;
  IF p->>'kind'='annual' AND p->>'month'<>'12' THEN RAISE EXCEPTION 'Periode tahunan harus bulan 12';END IF;
  IF p->>'as_of' IS NOT NULL THEN
   IF (p->>'as_of')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR extract(year FROM (p->>'as_of')::date)::text<>k OR extract(month FROM (p->>'as_of')::date)::integer<>(p->>'month')::integer THEN RAISE EXCEPTION 'Tanggal cakupan YTD tidak sesuai';END IF;
  END IF;
 END LOOP;
 IF (SELECT count(*) FROM jsonb_array_elements(p_data->'records'))<>(SELECT count(DISTINCT x->>'key') FROM jsonb_array_elements(p_data->'records') x) THEN RAISE EXCEPTION 'ID customer ganda/tidak tersedia';END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(p_data->'records') LOOP
  IF coalesce(length(r->>'key'),0) NOT BETWEEN 1 AND 600 OR coalesce(length(r->>'name'),0) NOT BETWEEN 1 AND 400 OR coalesce(length(r->>'branch'),0) NOT BETWEEN 1 AND 160 OR jsonb_typeof(r->'revenues') IS DISTINCT FROM 'object' OR coalesce(length(r->>'category'),0)>160 OR coalesce(length(r->>'status'),0)>160 THEN RAISE EXCEPTION 'Identitas customer tidak valid';END IF;
  IF r->>'since' IS NOT NULL THEN PERFORM (r->>'since')::date;END IF;IF r->>'last' IS NOT NULL THEN PERFORM (r->>'last')::date;END IF;
  FOR k,v IN SELECT * FROM jsonb_each(r->'revenues') LOOP
   IF k!~'^20[0-9]{2}$' OR NOT(p_data->'periods'?k) OR (jsonb_typeof(v) NOT IN('null','number') AND v IS DISTINCT FROM '"not_member"'::jsonb) THEN RAISE EXCEPTION 'Nilai revenue tidak valid';END IF;
   IF jsonb_typeof(v)='number' AND abs((v#>>'{}')::numeric)>9007199254740991 THEN RAISE EXCEPTION 'Revenue melebihi presisi angka aplikasi';END IF;
  END LOOP;
 END LOOP;
 IF p_data?'transactions' THEN
  IF jsonb_typeof(p_data->'transactions') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Frekuensi tidak valid';END IF;
  FOR k,p IN SELECT * FROM jsonb_each(p_data->'transactions') LOOP
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_data->'records') x WHERE x->>'key'=k) OR jsonb_typeof(p) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Customer frekuensi tidak dikenali';END IF;
   IF (SELECT count(*) FROM jsonb_object_keys(p))>120 THEN RAISE EXCEPTION 'Maksimal 120 periode frekuensi/customer';END IF;
   FOR k,v IN SELECT * FROM jsonb_each(p) LOOP
    IF k!~'^20[0-9]{2}-(0[1-9]|1[0-2])$' OR jsonb_typeof(v) IS DISTINCT FROM 'number' OR (v#>>'{}')!~'^[0-9]+$' OR (v#>>'{}')::numeric>1000000000 THEN RAISE EXCEPTION 'Jumlah transaksi bulanan tidak valid';END IF;
   END LOOP;
  END LOOP;
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(270027,1);SELECT version INTO prior FROM public.commercial_member_data_v27 WHERE id=1 FOR UPDATE;
 IF coalesce(prior,0)<>p_version THEN RAISE EXCEPTION 'Data Member sudah berubah di perangkat lain. Muat ulang sebelum menyimpan.' USING errcode='40001';END IF;
 INSERT INTO public.commercial_member_data_v27(id,data,version,updated_at) VALUES(1,p_data,coalesce(prior,0)+1,clock_timestamp()) ON CONFLICT(id) DO UPDATE SET data=excluded.data,version=excluded.version,updated_at=excluded.updated_at RETURNING * INTO result;
 RETURN jsonb_build_object('version',result.version,'updated_at',result.updated_at);
END $function$
;
CREATE OR REPLACE FUNCTION public.commercial_moka_enqueue_v35(p_mode text, p_requested_by text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare r public.moka_sync_runs%rowtype;
begin
 perform commercial_private.auth_write_guard_v58('commercial_moka_enqueue_v35');

  if p_mode not in ('live','full') then raise exception 'Mode tidak valid'; end if;
  perform pg_advisory_xact_lock(hashtext('commercial_moka_enqueue_v35'));
  select * into r from public.moka_sync_runs
    where status in ('requested','running') and requested_at > now() - interval '245 minutes'
    order by requested_at desc limit 1;
  if found then return jsonb_build_object('run_id',r.id,'existing',true); end if;
  insert into public.moka_sync_runs(mode,status,requested_at,requested_by,message)
    values(p_mode,'requested',now(),left(p_requested_by,80),'Menunggu GitHub Actions') returning * into r;
  return jsonb_build_object('run_id',r.id,'existing',false);
end $function$
;
CREATE OR REPLACE FUNCTION public.commercial_moka_insert_v35(p_table text, p_rows jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare cols text; updates text;
begin
 perform commercial_private.auth_write_guard_v58('commercial_moka_insert_v35');

  if p_table <> all(array['moka_sales_type_daily','moka_hourly','moka_customer_daily','moka_walkin_daily',
    'moka_sync_coverage','sales_type_raw','item_sales','transaksi','ingest_log','moka_items']) then
    raise exception 'Table not allowed';
  end if;
  if p_rows is null or jsonb_array_length(p_rows)=0 then return; end if;
  select string_agg(format('%I',k),', ' order by k),
         string_agg(format('%I=excluded.%I',k,k),', ' order by k)
    into cols,updates from jsonb_object_keys(p_rows->0) as t(k);
  if p_table='transaksi' then
    execute format('insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I,$1) on conflict(store_id,year,month) do update set %s',p_table,cols,cols,p_table,updates) using p_rows;
  else
    execute format('insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I,$1)',p_table,cols,cols,p_table) using p_rows;
  end if;
end $function$
;
CREATE OR REPLACE FUNCTION public.commercial_moka_replace_v35(p_store_id bigint, p_year integer, p_month integer, p_from date, p_to date, p_rows jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare tbl text;
begin
 perform commercial_private.auth_write_guard_v58('commercial_moka_replace_v35');

  if p_from>p_to or extract(year from p_from)<>p_year or extract(month from p_from)<>p_month
    or extract(year from p_to)<>p_year or extract(month from p_to)<>p_month then
    raise exception 'Invalid sync date range'; end if;
  perform pg_advisory_xact_lock(hashtext('moka-store:'||p_store_id::text));
  foreach tbl in array array['moka_sales_type_daily','moka_hourly','moka_customer_daily','moka_walkin_daily','moka_sync_coverage'] loop
    execute format('delete from public.%I where store_id=$1 and sale_date between $2 and $3',tbl) using p_store_id,p_from,p_to;
  end loop;
  foreach tbl in array array['sales_type_raw','item_sales'] loop
    execute format('delete from public.%I where store_id=$1 and year=$2 and month=$3',tbl) using p_store_id,p_year,p_month;
  end loop;
  foreach tbl in array array['moka_sales_type_daily','moka_hourly','moka_customer_daily','moka_walkin_daily',
    'moka_sync_coverage','sales_type_raw','item_sales','transaksi','ingest_log'] loop
    perform public.commercial_moka_insert_v35(tbl,p_rows->tbl);
  end loop;
end $function$
;
CREATE OR REPLACE FUNCTION public.commercial_moka_replace_v41(p_store_id bigint, p_year integer, p_month integer, p_from date, p_to date, p_rows jsonb, p_period_from date, p_period_to date, p_summary jsonb, p_validated boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
 SET statement_timeout TO '55s'
AS $function$
declare n integer;amt numeric;item_amt numeric;
begin
 perform commercial_private.auth_write_guard_v58('commercial_moka_replace_v41');

 if p_period_from is null or p_period_to is null or p_period_from<>make_date(p_year,p_month,1) or p_period_to<p_period_from or extract(month from p_period_to)<>p_month or extract(year from p_period_to)<>p_year or p_from<p_period_from or p_to>p_period_to then raise exception 'Cakupan checkpoint tidak valid';end if;
 perform public.commercial_moka_replace_v35(p_store_id,p_year,p_month,p_from,p_to,p_rows);
 delete from moka_sync_checkpoint_v41 where store_id=p_store_id and year=p_year and month=p_month;
 select count(*) into n from moka_sync_coverage where store_id=p_store_id and sale_date between p_period_from and p_period_to;
 select coalesce(sum(amount),0) into amt from sales_type_raw where store_id=p_store_id and year=p_year and month=p_month;
 select coalesce(sum(net_sales),0) into item_amt from item_sales where store_id=p_store_id and year=p_year and month=p_month;
 if p_validated and p_summary ? 'net_sales' and p_summary ? 'number_of_transactions' and n=p_period_to-p_period_from+1
 and (select jumlah_transaksi from transaksi where store_id=p_store_id and year=p_year and month=p_month)=(p_summary->>'number_of_transactions')::numeric
 and abs(amt-(p_summary->>'net_sales')::numeric)<=10
 and abs(item_amt-(p_summary->>'net_sales')::numeric)<=greatest(10,0.5*(select count(*) from item_sales where store_id=p_store_id and year=p_year and month=p_month)) then
  insert into moka_sync_checkpoint_v41 values(p_store_id,p_year,p_month,p_period_from,p_period_to,p_summary,
   public.commercial_moka_digest_v41(p_store_id,p_year,p_month,p_period_from,p_period_to),now());
 end if;
end $function$
;
CREATE OR REPLACE FUNCTION public.commercial_moka_replace_v45(p_store_id bigint, p_year integer, p_month integer, p_from date, p_to date, p_components text[], p_rows jsonb, p_data_from date, p_data_to date, p_summary jsonb, p_validated boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
 SET statement_timeout TO '55s'
AS $function$
declare component_name text;tbl text;allowed text[]:=array['ingest_log'];tables text[];r jsonb;
begin
 perform commercial_private.auth_write_guard_v58('commercial_moka_replace_v45');

 if p_store_id is null or p_components is null or cardinality(p_components)=0 or p_rows is null or jsonb_typeof(p_rows)<>'object'
 or p_from is null or p_to is null or p_data_from is null or p_data_to is null
 or p_from>p_to or p_data_from>p_from or p_data_to<p_to
 or p_data_from<>make_date(p_year,p_month,1) or extract(year from p_data_to)<>p_year or extract(month from p_data_to)<>p_month then raise exception 'Cakupan sinkron tidak valid';end if;
 foreach component_name in array p_components loop
  tables:=public.commercial_moka_tables_v45(component_name);
  if tables is null then raise exception 'Komponen belum tersedia: %',component_name;end if;
  allowed:=allowed||tables;
 end loop;
 if exists(select 1 from jsonb_object_keys(p_rows) k where not k=any(allowed)) then raise exception 'Payload berisi tabel di luar komponen pilihan';end if;
 -- Check every row before any deletion. Never accept another store/month/day in a service payload.
 foreach tbl in array allowed loop
  if not(p_rows ? tbl) or jsonb_typeof(p_rows->tbl)<>'array' then raise exception 'Array tabel wajib ada: %',tbl;end if;
  for r in select value from jsonb_array_elements(p_rows->tbl) loop
   if (r->>'store_id')::bigint is distinct from p_store_id then raise exception 'Payload keluar dari toko pilihan';end if;
   if tbl=any(array['sales_type_raw','item_sales','transaksi','ingest_log']) then
    if (r->>'year')::integer is distinct from p_year or (r->>'month')::integer is distinct from p_month then raise exception 'Payload keluar dari periode';end if;
   elsif (r->>'sale_date') is null or (r->>'sale_date')::date not between p_from and p_to then raise exception 'Tanggal payload keluar cakupan';end if;
  end loop;
 end loop;
 perform pg_advisory_xact_lock(hashtext('moka-store:'||p_store_id::text));
 foreach component_name in array p_components loop
  foreach tbl in array public.commercial_moka_tables_v45(component_name) loop
   if tbl=any(array['sales_type_raw','item_sales']) then
    execute format('delete from public.%I where store_id=$1 and year=$2 and month=$3',tbl) using p_store_id,p_year,p_month;
   elsif tbl<>'transaksi' then
    execute format('delete from public.%I where store_id=$1 and sale_date between $2 and $3',tbl) using p_store_id,p_from,p_to;
   end if;
   perform public.commercial_moka_insert_v35(tbl,p_rows->tbl);
  end loop;
  insert into public.moka_sync_component_v45(store_id,component,year,month,date_from,date_to,summary,digest,validated)
   values(p_store_id,component_name,p_year,p_month,p_data_from,p_data_to,p_summary,
    public.commercial_moka_digest_v45(p_store_id,p_year,p_month,p_data_from,p_data_to,component_name),
    coalesce(p_validated,false) and p_from=p_data_from and p_to=p_data_to)
   on conflict(store_id,component,year,month) do update set date_from=excluded.date_from,date_to=excluded.date_to,
    summary=excluded.summary,digest=excluded.digest,validated=excluded.validated,checked_at=now();
 end loop;
 perform public.commercial_moka_insert_v35('ingest_log',p_rows->'ingest_log');
 -- Global old coverage and Customer daily cache are intentionally untouched.
end $function$
;
CREATE OR REPLACE FUNCTION public.commercial_pin_login_v1(p_pin text, p_remember boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare client text;attempt commercial_private.pin_attempts;credential commercial_private.pins;token text;expires timestamptz;begin
 perform commercial_private.auth_write_guard_v58('commercial_pin_login_v1');

 -- Global cap also limits attempts when client IP headers are missing or changed.
 perform pg_catalog.pg_advisory_xact_lock(1738701,7);
 delete from commercial_private.pin_sessions where expires_at<=now();
 delete from commercial_private.pin_attempts where started_at<now()-interval '1 day';
 client:='ip:'||encode(sha256(convert_to(coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-forwarded-for','shared'),'UTF8')),'hex');
 insert into commercial_private.pin_attempts values('global',now(),0),(client,now(),0) on conflict do nothing;
 update commercial_private.pin_attempts set count=0,started_at=now() where bucket in ('global',client) and started_at<=now()-interval '15 minutes';
 if exists(select 1 from commercial_private.pin_attempts where (bucket='global' and count>=500) or (bucket=client and count>=10)) then return jsonb_build_object('ok',false,'error','Terlalu banyak percobaan. Coba lagi dalam 15 menit.');end if;
 update commercial_private.pin_attempts set count=count+1 where bucket='global';
 if p_pin ~ '^[0-9]{6,12}$' then select * into credential from commercial_private.pins where pin_lookup=commercial_private.lookup_pin(p_pin) and enabled;end if;
 if credential.id is null or not coalesce(commercial_private.check_pin(p_pin,credential.pin_hash),false) then
  update commercial_private.pin_attempts set count=count+1 where bucket=client;
  return jsonb_build_object('ok',false,'error','PIN salah atau tidak aktif. Hubungi master jika belum memiliki PIN.');
 end if;
 token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');expires:=now()+case when coalesce(p_remember,false) then interval '30 days' else interval '12 hours' end;
 insert into commercial_private.pin_sessions(token_hash,pin_id,expires_at) values(encode(sha256(convert_to(token,'UTF8')),'hex'),credential.id,expires);
 delete from commercial_private.pin_sessions where token_hash in (select token_hash from commercial_private.pin_sessions where pin_id=credential.id order by created_at desc,expires_at desc offset 20);
 return jsonb_build_object('ok',true,'access_token',token,'expires_at',extract(epoch from expires)::bigint,'user',jsonb_build_object('id',credential.id,'name',credential.name,'role',credential.role));
end $function$
;
CREATE OR REPLACE FUNCTION public.commercial_pin_logout_v1()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ begin
 perform commercial_private.auth_write_guard_v58('commercial_pin_logout_v1');
 delete from commercial_private.pin_sessions where token_hash=encode(sha256(convert_to(coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-commercial-pin-session',''),'UTF8')),'hex');return true;end $function$
;
CREATE OR REPLACE FUNCTION public.commercial_pin_save_v1(p_id uuid, p_name text, p_pin text DEFAULT NULL::text, p_role text DEFAULT 'editor'::text, p_enabled boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare actor uuid;result uuid;begin
 perform commercial_private.auth_write_guard_v58('commercial_pin_save_v1');

 perform pg_catalog.pg_advisory_xact_lock(1738701,7);
 actor:=commercial_private.session_pin();
 if not exists(select 1 from commercial_private.pins where id=actor and role='master' and enabled) then raise exception 'Hanya master dapat mengelola PIN' using errcode='42501';end if;
 result:=commercial_private.save_pin(p_id,p_name,p_pin,p_role,p_enabled);
 insert into public.commercial_master_audit(user_id,table_name,action,record_key,after_data) values(actor,'pin_access',case when p_id is null then 'create' else 'update' end,jsonb_build_object('id',result),jsonb_build_object('name',trim(p_name),'role',p_role,'enabled',p_enabled,'pin_changed',p_pin is not null));
 return jsonb_build_object('saved',true,'id',result);
end $function$
;
CREATE OR REPLACE FUNCTION public.commercial_price_list_auto_v38(p_outlet text, p_city text, p_data jsonb, p_version integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE actor jsonb;prior public.commercial_price_list_v24;g jsonb;v jsonb;result public.commercial_price_list_v24;numcols integer;BEGIN
 perform commercial_private.auth_write_guard_v58('commercial_price_list_auto_v38');

 -- Only service_role can execute this function; clients keep the PIN/CAS function.
 IF p_outlet IS NULL OR length(btrim(p_outlet)) NOT BETWEEN 1 AND 160 OR p_city IS NULL OR p_city NOT IN('MAKASSAR','PALOPO','TORAJA','SAMARINDA','BONE','POLMAN','PALU','MANADO','KENDARI') OR p_version IS NULL OR p_version<0 THEN RAISE EXCEPTION 'Identitas toko/kota/versi tidak valid';END IF;
 IF p_data IS NULL OR jsonb_typeof(p_data)<>'object' OR p_data->>'schema' IS DISTINCT FROM '24' OR jsonb_typeof(p_data->'columns') IS DISTINCT FROM 'array' OR jsonb_typeof(p_data->'groups') IS DISTINCT FROM 'array' OR octet_length(p_data::text)>8000000 THEN RAISE EXCEPTION 'Format Price List tidak valid atau lebih dari 8 MB per toko';END IF;
 numcols:=jsonb_array_length(p_data->'columns');
 IF numcols NOT BETWEEN 1 AND 200 OR jsonb_array_length(p_data->'groups')>30000 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_data->'columns') x WHERE jsonb_typeof(x)<>'string' OR length(x#>>'{}') NOT BETWEEN 1 AND 180) THEN RAISE EXCEPTION 'Kolom/baris Price List tidak valid';END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(p_data->'groups'))<>(SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(p_data->'groups') x) THEN RAISE EXCEPTION 'ID profil ganda/tidak tersedia';END IF;
 IF p_data?'price_vectors' THEN
  IF jsonb_typeof(p_data->'price_vectors') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Vektor harga tidak valid';END IF;
  IF jsonb_array_length(p_data->'price_vectors')>30000 THEN RAISE EXCEPTION 'Terlalu banyak vektor harga';END IF;
  FOR v IN SELECT value FROM jsonb_array_elements(p_data->'price_vectors') LOOP
   IF jsonb_typeof(v) IS DISTINCT FROM 'array' OR jsonb_array_length(v)<>numcols THEN RAISE EXCEPTION 'Panjang vektor harga tidak valid';END IF;
  END LOOP;
 END IF;
 FOR g IN SELECT value FROM jsonb_array_elements(p_data->'groups') LOOP
  IF p_data?'price_vectors' THEN
   IF jsonb_typeof(g->'price_ref') IS DISTINCT FROM 'number' OR (g->>'price_ref')!~'^[0-9]+$' OR (g->>'price_ref')::numeric>=jsonb_array_length(p_data->'price_vectors') THEN RAISE EXCEPTION 'Referensi harga tidak valid';END IF;
   g:=jsonb_set(g,'{prices}',p_data->'price_vectors'->((g->>'price_ref')::integer));
  END IF;
  IF g?'source_count' AND (jsonb_typeof(g->'source_count') IS DISTINCT FROM 'number' OR (g->>'source_count')!~'^[0-9]+$') THEN RAISE EXCEPTION 'Jumlah sumber tidak valid';END IF;
  IF coalesce(length(g->>'id'),0) NOT BETWEEN 1 AND 100 OR coalesce(length(g->>'category'),0) NOT BETWEEN 1 AND 240 OR coalesce(length(g->>'brand'),0) NOT BETWEEN 1 AND 160 OR coalesce(length(g->>'item'),0) NOT BETWEEN 1 AND 400 OR jsonb_typeof(g->'prices') IS DISTINCT FROM 'array' OR jsonb_typeof(g->'variants') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Profil Price List tidak valid';END IF;
  IF jsonb_array_length(g->'prices')<>numcols OR jsonb_array_length(g->'variants')>100000 THEN RAISE EXCEPTION 'Jumlah harga/varian tidak sesuai';END IF;
  FOR v IN SELECT value FROM jsonb_array_elements(g->'prices') LOOP
   IF jsonb_typeof(v) NOT IN('null','number') THEN RAISE EXCEPTION 'Harga harus angka/null';END IF;
   IF jsonb_typeof(v)='number' AND (v#>>'{}')::numeric<0 THEN RAISE EXCEPTION 'Harga negatif tidak valid';END IF;
  END LOOP;
  IF g?'cost_override' AND jsonb_typeof(g->'cost_override') NOT IN('null','number') THEN RAISE EXCEPTION 'Cost harus angka/null';END IF;
  IF jsonb_typeof(g->'cost_override')='number' AND (g->>'cost_override')::numeric<0 THEN RAISE EXCEPTION 'Cost negatif tidak valid';END IF;
  FOR v IN SELECT value FROM jsonb_array_elements(g->'variants') LOOP
   IF jsonb_typeof(v) IS DISTINCT FROM 'array' OR jsonb_array_length(v)<>3 OR jsonb_typeof(v->0) IS DISTINCT FROM 'string' OR jsonb_typeof(v->2) NOT IN('null','number') THEN RAISE EXCEPTION 'Varian sumber tidak valid';END IF;
   IF jsonb_typeof(v->2)='number' AND (v->>2)::numeric<0 THEN RAISE EXCEPTION 'Cost varian negatif';END IF;
  END LOOP;
 END LOOP;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('commercial-price-list-v24'),pg_catalog.hashtext(p_outlet));
 SELECT * INTO prior FROM public.commercial_price_list_v24 WHERE outlet=p_outlet FOR UPDATE;
 IF (prior.outlet IS NULL AND p_version<>0) OR (prior.outlet IS NOT NULL AND prior.version<>p_version) THEN RAISE EXCEPTION 'Price List toko sudah berubah di perangkat lain. Muat ulang sebelum menyimpan.' USING errcode='40001';END IF;
 INSERT INTO public.commercial_price_list_v24(outlet,city,data,version,updated_at) VALUES(p_outlet,p_city,p_data,coalesce(prior.version,0)+1,clock_timestamp())
 ON CONFLICT(outlet) DO UPDATE SET city=excluded.city,data=excluded.data,version=excluded.version,updated_at=excluded.updated_at RETURNING * INTO result;
 RETURN jsonb_build_object('outlet',result.outlet,'city',result.city,'version',result.version,'updated_at',result.updated_at);
END $function$
;
CREATE OR REPLACE FUNCTION public.commercial_price_list_auto_v42(p_outlet text, p_city text, p_data jsonb, p_version integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare n integer;packed boolean;prior public.commercial_price_list_v24;result public.commercial_price_list_v24;
begin
 perform commercial_private.auth_write_guard_v58('commercial_price_list_auto_v42');

 if p_outlet is null or length(btrim(p_outlet)) not between 1 and 160 or p_outlet ~* '^\s*(DC|DISTRIBUTION CENTER|GUDANG)([ ._-]|$)' or p_city is null or p_city not in('MAKASSAR','PALOPO','TORAJA','SAMARINDA','BONE','POLMAN','PALU','MANADO','KENDARI') or p_version is null or p_version<0 then raise exception 'Identitas toko/kota/versi tidak valid; DC tidak disimpan';end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or p_data->>'schema' is distinct from '24' or jsonb_typeof(p_data->'columns') is distinct from 'array' or jsonb_typeof(p_data->'groups') is distinct from 'array' or octet_length(p_data::text)>8000000 then raise exception 'Format Price List tidak valid atau lebih dari 8 MB';end if;
 n:=jsonb_array_length(p_data->'columns');packed:=p_data?'price_vectors';
 if n not between 1 and 200 or jsonb_array_length(p_data->'groups')>30000 or exists(select 1 from jsonb_array_elements(p_data->'columns') x where jsonb_typeof(x)<>'string' or length(x#>>'{}') not between 1 and 180) then raise exception 'Kolom/baris Price List tidak valid';end if;
 if (select count(*) from jsonb_array_elements(p_data->'groups'))<>(select count(distinct g->>'id') from jsonb_array_elements(p_data->'groups')g) then raise exception 'ID profil ganda/tidak tersedia';end if;
 if exists(select 1 from jsonb_array_elements(p_data->'groups')g where jsonb_typeof(g)<>'object' or coalesce(length(g->>'id'),0) not between 1 and 100 or coalesce(length(g->>'category'),0) not between 1 and 240 or coalesce(length(g->>'brand'),0) not between 1 and 160 or coalesce(length(g->>'item'),0) not between 1 and 400 or jsonb_typeof(g->'variants') is distinct from 'array' or (g?'source_count' and (jsonb_typeof(g->'source_count') is distinct from 'number' or (g->>'source_count')!~'^[0-9]+$')) or (g?'cost_override' and jsonb_typeof(g->'cost_override') not in('null','number'))) then raise exception 'Profil/cost Price List tidak valid';end if;
 if exists(select 1 from jsonb_array_elements(p_data->'groups')g where jsonb_array_length(g->'variants')>100000 or (jsonb_typeof(g->'cost_override')='number' and (g->>'cost_override')::numeric<0)) then raise exception 'Varian/cost Price List tidak valid';end if;
 if packed then
  if jsonb_typeof(p_data->'price_vectors') is distinct from 'array' then raise exception 'Vektor harga tidak valid';end if;
  if jsonb_array_length(p_data->'price_vectors')>30000 or exists(select 1 from jsonb_array_elements(p_data->'price_vectors')v where case when jsonb_typeof(v)='array' then jsonb_array_length(v)<>n else true end) then raise exception 'Panjang vektor harga tidak valid';end if;
  if exists(select 1 from jsonb_array_elements(p_data->'groups')g where jsonb_typeof(g->'price_ref') is distinct from 'number' or (g->>'price_ref')!~'^[0-9]+$') then raise exception 'Referensi harga tidak valid';end if;
  if exists(select 1 from jsonb_array_elements(p_data->'groups')g where (g->>'price_ref')::numeric>=jsonb_array_length(p_data->'price_vectors')) then raise exception 'Referensi harga di luar vektor';end if;
 else
  if exists(select 1 from jsonb_array_elements(p_data->'groups')g where case when jsonb_typeof(g->'prices')='array' then jsonb_array_length(g->'prices')<>n else true end) then raise exception 'Jumlah harga tidak sesuai';end if;
 end if;
 if exists(select 1 from jsonb_array_elements(case when packed then p_data->'price_vectors' else (select coalesce(jsonb_agg(g->'prices'),'[]') from jsonb_array_elements(p_data->'groups')g) end) a cross join lateral jsonb_array_elements(a)v where jsonb_typeof(v) not in('null','number')) then raise exception 'Harga harus angka/null';end if;
 if exists(select 1 from jsonb_array_elements(case when packed then p_data->'price_vectors' else (select coalesce(jsonb_agg(g->'prices'),'[]') from jsonb_array_elements(p_data->'groups')g) end) a cross join lateral jsonb_array_elements(a)v where jsonb_typeof(v)='number' and (v#>>'{}')::numeric<0) then raise exception 'Harga negatif tidak valid';end if;
 if exists(select 1 from jsonb_array_elements(p_data->'groups')g cross join lateral jsonb_array_elements(g->'variants')v where case when jsonb_typeof(v)='array' then jsonb_array_length(v)<>3 or jsonb_typeof(v->0) is distinct from 'string' or jsonb_typeof(v->2) not in('null','number') else true end) then raise exception 'Varian sumber tidak valid';end if;
 if exists(select 1 from jsonb_array_elements(p_data->'groups')g cross join lateral jsonb_array_elements(g->'variants')v where jsonb_typeof(v->2)='number' and (v->>2)::numeric<0) then raise exception 'Cost varian negatif';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('commercial-price-list-v24'),pg_catalog.hashtext(p_outlet));
 select * into prior from public.commercial_price_list_v24 where outlet=p_outlet for update;
 if (prior.outlet is null and p_version<>0) or (prior.outlet is not null and prior.version<>p_version) then raise exception 'Price List toko sudah berubah di perangkat lain. Muat ulang sebelum menyimpan.' using errcode='40001';end if;
 if prior.outlet is not null and prior.city=p_city and prior.data-'imported_at'-'source_name'=p_data-'imported_at'-'source_name' then return jsonb_build_object('status','unchanged','outlet',prior.outlet,'version',prior.version,'updated_at',prior.updated_at);end if;
 insert into public.commercial_price_list_v24(outlet,city,data,version,updated_at) values(p_outlet,p_city,p_data,coalesce(prior.version,0)+1,clock_timestamp()) on conflict(outlet) do update set city=excluded.city,data=excluded.data,version=excluded.version,updated_at=excluded.updated_at returning * into result;
 return jsonb_build_object('status','saved','outlet',result.outlet,'version',result.version,'updated_at',result.updated_at);
end $function$
;
CREATE OR REPLACE FUNCTION public.commercial_price_sync_v43(p_outlet text, p_city text, p_data jsonb, p_version integer, p_store_id bigint, p_brands jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
 SET statement_timeout TO '55s'
AS $function$
declare result jsonb;changed boolean;
begin
 perform commercial_private.auth_write_guard_v58('commercial_price_sync_v43');

 if p_store_id is null or not exists(select 1 from stores where id=p_store_id) then raise exception 'Toko pemetaan brand tidak valid';end if;
 if jsonb_typeof(p_brands) is distinct from 'array' or jsonb_array_length(p_brands)=0 or jsonb_array_length(p_brands)>100000 then raise exception 'Kunci brand harus berisi 1–100.000 baris';end if;
 if exists(select 1 from jsonb_to_recordset(p_brands)r(sku text,item_name text,brand text) where sku is null or nullif(btrim(item_name),'') is null or length(item_name)>1000 or length(sku)>300 or length(brand)>160) then raise exception 'Kunci brand tidak valid';end if;
 if exists(select 1 from jsonb_to_recordset(p_brands)r(sku text,item_name text) group by r.sku,r.item_name having count(*)>1) then raise exception 'Kunci brand ganda';end if;
 perform pg_advisory_xact_lock(hashtext('moka-store:'||p_store_id::text));
 result:=public.commercial_price_list_auto_v42(p_outlet,p_city,p_data,p_version);
 select exists((select sku,item_name,brand from moka_item_brand_v43 where store_id=p_store_id except select sku,item_name,brand from jsonb_to_recordset(p_brands)r(sku text,item_name text,brand text))
 union all (select sku,item_name,brand from jsonb_to_recordset(p_brands)r(sku text,item_name text,brand text) except select sku,item_name,brand from moka_item_brand_v43 where store_id=p_store_id)) into changed;
 if changed then
  delete from moka_item_brand_v43 where store_id=p_store_id;
  insert into moka_item_brand_v43 select p_store_id,sku,item_name,brand from jsonb_to_recordset(p_brands)r(sku text,item_name text,brand text);
 end if;
 return result||jsonb_build_object('brand_keys',jsonb_array_length(p_brands),'brand_changed',changed);
end $function$
;
CREATE OR REPLACE FUNCTION public.rebuild_sales_actual(p_year integer DEFAULT NULL::integer, p_month integer DEFAULT NULL::integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare n int;
begin
 perform commercial_private.auth_write_guard_v58('rebuild_sales_actual');

  insert into sales_actual (store_id, year, month,
      sales_komersial, sales_user,
      sales_komersial_tigalapan, sales_user_tigalapan, sales_user_mamu, is_manual)
  select r.store_id, r.year, r.month,
      sum(case when m.keterangan = 'KOMERSIAL' then r.amount else 0 end),
      sum(case when m.keterangan = 'USER'      then r.amount else 0 end),
      sum(case when m.segmen = 'KOMERSIAL TIGALAPAN' then r.amount else 0 end),
      sum(case when m.segmen = 'USER TIGALAPAN'      then r.amount else 0 end),
      sum(case when m.segmen = 'USER MAMU'           then r.amount else 0 end),
      false
  from sales_type_raw r
  join sales_type_map m on upper(btrim(m.sales_type)) = upper(btrim(r.sales_type))
  where (p_year is null or r.year = p_year)
    and (p_month is null or r.month = p_month)
  group by r.store_id, r.year, r.month
  on conflict (store_id, year, month) do update set
      sales_komersial           = excluded.sales_komersial,
      sales_user                = excluded.sales_user,
      sales_komersial_tigalapan = excluded.sales_komersial_tigalapan,
      sales_user_tigalapan      = excluded.sales_user_tigalapan,
      sales_user_mamu           = excluded.sales_user_mamu,
      updated_at                = now()
  where sales_actual.is_manual = false;   -- input manual tidak ditimpa
  get diagnostics n = row_count;
  return n;
end $function$
;
CREATE OR REPLACE FUNCTION public.rebuild_transaksi_from_raw(p_year integer DEFAULT NULL::integer, p_month integer DEFAULT NULL::integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare n int;
begin
 perform commercial_private.auth_write_guard_v58('rebuild_transaksi_from_raw');

  insert into transaksi (store_id, year, month, jumlah_transaksi, nilai_transaksi)
  select r.store_id, r.year, r.month, sum(r.trx_count), sum(r.amount)
  from sales_type_raw r
  where (p_year is null or r.year = p_year) and (p_month is null or r.month = p_month)
  group by r.store_id, r.year, r.month
  on conflict (store_id, year, month) do update set
      jumlah_transaksi = excluded.jumlah_transaksi, nilai_transaksi = excluded.nilai_transaksi, updated_at = now()
  where not coalesce(transaksi.is_manual,false);
  get diagnostics n = row_count;
  return n;
end $function$
;
do $$declare existing text;begin
 select split_part(config,'=',2) into existing from pg_db_role_setting s cross join lateral unnest(s.setconfig) config
 where s.setrole=(select oid from pg_roles where rolname='authenticator') and config like 'pgrst.db_pre_request=%' limit 1;
 if existing is not null and existing not in ('','public.commercial_auth_gate_v58') then raise exception 'Pre-request hook lain ditemukan: %. Gabungkan dahulu; jangan ditimpa.',existing;end if;
 execute 'alter role authenticator set pgrst.db_pre_request = ''public.commercial_auth_gate_v58''';
end $$;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;
alter default privileges for role postgres revoke execute on functions from public;
update commercial_private.auth_config_v58 set enabled=true where id;
notify pgrst,'reload config';notify pgrst,'reload schema';
commit;
