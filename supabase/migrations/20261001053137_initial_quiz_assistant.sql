-- Foodi Quiz Assistant: private corpus; application gates all service-role access.
create table public.members (
 id uuid primary key references auth.users(id) on delete cascade,
 email text not null, role text not null check (role in ('employee','super_admin')) default 'employee',
 active boolean not null default true, created_at timestamptz not null default now()
);
create table public.app_settings (
 id integer primary key check (id=1) default 1,
 answer_model text not null default '', crawler_model text not null default '',
 cron_expression text not null default '0 */12 * * *', timezone text not null default 'Asia/Dhaka',
 schedule_enabled boolean not null default false, next_run_at timestamptz,
 daily_budget_usd numeric not null default 0 check(daily_budget_usd>=0),
 max_call_usd numeric not null default 0 check(max_call_usd>=0),
 max_pages integer not null default 100 check(max_pages between 1 and 200),
 stale_hours integer not null default 36 check(stale_hours between 1 and 168),
 worker_seen_at timestamptz, updated_at timestamptz not null default now()
);
insert into public.app_settings(id) values(1);
create table public.jobs (
 id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('crawl','publish')),
 status text not null default 'queued' check(status in ('queued','running','completed','failed')),
 requested_by uuid references public.members(id), created_at timestamptz not null default now(),
 started_at timestamptz, finished_at timestamptz, lease_token uuid, lease_until timestamptz,
 stats jsonb not null default '{}'::jsonb, error_code text
);
create unique index one_active_job_per_kind on public.jobs(kind) where status in ('queued','running');
create table public.source_pages (
 id uuid primary key default gen_random_uuid(), url text not null unique, title text not null,
 content text not null default '', hash text not null default '', observed_hash text,
 eligible boolean not null default false, state text not null default 'pending',
 checked_at timestamptz, verified_at timestamptz, revision text,
 coverage_notes jsonb not null default '[]'::jsonb,
 search_document tsvector generated always as (to_tsvector('simple',title || ' ' || content)) stored
);
create index source_search on public.source_pages using gin(search_document);
create table public.candidates (
 id uuid primary key default gen_random_uuid(), page_id uuid not null references public.source_pages(id),
 url text not null, title text not null, content text not null, previous_content text, hash text not null,
 storage_path text not null, coverage_notes jsonb not null default '[]'::jsonb,
 status text not null default 'pending' check(status in ('pending','approved','rejected','published','superseded')),
 reviewed_by uuid references public.members(id), reviewed_at timestamptz, created_at timestamptz not null default now(),
 unique(page_id,hash)
);
create index candidate_review_queue on public.candidates(status,created_at);
create table public.dataset_state (
 id integer primary key check(id=1) default 1, revision text, digest text,
 sheet_verified_at timestamptz, blocked boolean not null default true
);
insert into public.dataset_state(id) values(1);
create table public.publications (
 revision text primary key, digest text not null, manifest jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.publications enable row level security;
revoke all on public.publications from anon,authenticated;
grant all on public.publications to service_role;
create table public.usage_events (
 id uuid primary key default gen_random_uuid(), user_id uuid references public.members(id),
 model text not null, purpose text not null check(purpose in ('quiz','crawl')),
 reserved_usd numeric not null check(reserved_usd>=0), actual_usd numeric check(actual_usd>=0),
 status text not null default 'reserved', created_at timestamptz not null default now()
);
create index usage_daily on public.usage_events(created_at);
create index usage_user_rate on public.usage_events(user_id,created_at);
create table public.audit_events (
 id bigint generated always as identity primary key, actor_id uuid references public.members(id),
 action text not null, object_id text, created_at timestamptz not null default now()
);
-- No corpus or settings access through the public Data API; all users go through authenticated routes.
alter table public.members enable row level security;
alter table public.app_settings enable row level security;
alter table public.jobs enable row level security;
alter table public.source_pages enable row level security;
alter table public.candidates enable row level security;
alter table public.dataset_state enable row level security;
alter table public.usage_events enable row level security;
alter table public.audit_events enable row level security;
revoke all on public.members,public.app_settings,public.jobs,public.source_pages,public.candidates,public.dataset_state,public.usage_events,public.audit_events from anon,authenticated;
grant all on public.members,public.app_settings,public.jobs,public.source_pages,public.candidates,public.dataset_state,public.usage_events,public.audit_events to service_role;
grant usage,select on sequence public.audit_events_id_seq to service_role;
-- Every RPC runs as caller, not as owner. Only the trusted service role can execute it.
create function public.reserve_usage(p_user uuid,p_model text,p_purpose text,p_amount numeric)
returns uuid language plpgsql security invoker set search_path=public as $$
declare cfg public.app_settings; spent numeric; reservation uuid;
begin
 select * into cfg from app_settings where id=1 for update;
 if p_amount<0 or p_amount>cfg.max_call_usd or cfg.daily_budget_usd<=0 or cfg.max_call_usd<=0 then raise exception 'Budget disabled or call cap exceeded'; end if;
 select coalesce(sum(coalesce(actual_usd,reserved_usd)),0) into spent from usage_events where created_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
 if spent+p_amount>cfg.daily_budget_usd then raise exception 'Daily budget exhausted'; end if;
 if p_user is not null and (select count(*) from usage_events where user_id=p_user and created_at>now()-interval '1 minute')>=10 then raise exception 'Rate limit reached'; end if;
 insert into usage_events(user_id,model,purpose,reserved_usd) values(p_user,p_model,p_purpose,p_amount) returning id into reservation;
 return reservation;
end $$;
create function public.claim_job() returns setof public.jobs language plpgsql security invoker set search_path=public as $$
declare picked uuid;
begin
 if not pg_try_advisory_xact_lock(820401) then return; end if;
 -- Failed leases need explicit reruns: no duplicate charged model calls on ambiguous crashes.
 update jobs set status='failed',error_code='worker_lease_expired',finished_at=now() where status='running' and lease_until<now();
 if exists(select 1 from jobs where status='running') then return; end if;
 select id into picked from jobs where status='queued' order by created_at for update skip locked limit 1;
 if picked is null then return; end if;
 return query update jobs set status='running',started_at=now(),lease_token=gen_random_uuid(),lease_until=now()+interval '3 minutes' where id=picked returning *;
end $$;
create function public.search_sources(p_terms text[],p_stale_hours integer) returns setof public.source_pages language sql stable security invoker set search_path=public as $$
 select p.* from source_pages p where p.eligible and p.verified_at>now()-make_interval(hours=>p_stale_hours)
 and p.search_document @@ to_tsquery('simple',array_to_string(p_terms,' | '))
 order by ts_rank(p.search_document,to_tsquery('simple',array_to_string(p_terms,' | '))) desc limit 6;
$$;
create function public.activate_dataset(p_revision text,p_digest text,p_pages jsonb) returns void language plpgsql security invoker set search_path=public as $$
declare row jsonb;
begin
 if not exists(select 1 from publications where revision=p_revision and digest=p_digest) then raise exception 'Unregistered publication'; end if;
 perform 1 from dataset_state where id=1 for update;
 for row in select * from jsonb_array_elements(p_pages) loop
  update source_pages set title=row->>'title',content=row->>'content',hash=row->>'hash',revision=p_revision,
   eligible=(observed_hash=row->>'hash' and state not in ('revoked','access_denied','not_found','coverage_gap')),
   state=case when observed_hash=row->>'hash' and state not in ('revoked','access_denied','not_found','coverage_gap') then 'approved' else state end
   where id=(row->>'id')::uuid;
  update candidates set status='published' where page_id=(row->>'id')::uuid and hash=row->>'hash' and status='approved';
 end loop;
 update source_pages set eligible=false where id not in (select (v->>'id')::uuid from jsonb_array_elements(p_pages) v);
 update dataset_state set revision=p_revision,digest=p_digest,sheet_verified_at=now(),blocked=false where id=1;
end $$;
revoke execute on function public.reserve_usage(uuid,text,text,numeric),public.claim_job(),public.search_sources(text[],integer),public.activate_dataset(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.reserve_usage(uuid,text,text,numeric),public.claim_job(),public.search_sources(text[],integer),public.activate_dataset(text,text,jsonb) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('crawl-snapshots','crawl-snapshots',false,5242880,array['application/json']) on conflict(id) do nothing;
-- No storage.objects policy grants employee access. Snapshots stay worker/admin only.
