-- Learning platform: official quiz content, attempts, XP ledger and achievements.
--
-- Security model
--   * Official content (questions, answer options) is never readable directly by clients.
--     It is exposed only through SECURITY DEFINER functions that check ownership and reveal
--     the correct option of a question only after that question is resolved.
--   * Every mutation of attempts, responses, XP and achievement unlocks goes through the
--     functions below. Clients have SELECT on their own rows (RLS) and nothing else.
--   * The browser never sends correctness or XP amounts: both are computed here.
--   * Custom practice quizzes never reach the database. `quiz_attempts.mode` is pinned to
--     'official' so the boundary is explicit in the schema as well.

create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------------------
-- Official content
-- ---------------------------------------------------------------------------

create table public.levels (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  position smallint not null unique,
  name text not null
);

create table public.quizzes (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quiz_localizations (
  quiz_id text not null references public.quizzes (id) on delete cascade,
  language text not null check (language in ('en', 'pt-br')),
  title text not null check (char_length(title) between 1 and 200),
  primary key (quiz_id, language)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id text not null,
  language text not null,
  -- `id` of the question inside data/quizzes/<quiz>/<language>.json
  source_id integer not null check (source_id > 0),
  level_id text not null references public.levels (id),
  prompt text not null,
  explanation text,
  -- Questions removed from the JSON source are deactivated, never deleted, so history survives.
  is_active boolean not null default true,
  unique (quiz_id, language, source_id),
  foreign key (quiz_id, language) references public.quiz_localizations (quiz_id, language) on delete cascade
);

create table public.answer_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  -- 0 = correctAnswer, 1..n = wrongAnswers[n - 1]. Never exposed to clients.
  source_index smallint not null check (source_index >= 0),
  body text not null,
  is_correct boolean not null,
  unique (question_id, source_index)
);
create unique index answer_options_one_correct on public.answer_options (question_id) where is_correct;

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 80), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Official attempts
-- ---------------------------------------------------------------------------

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  quiz_id text not null references public.quizzes (id),
  language text not null,
  mode text not null default 'official' check (mode = 'official'),
  level_filter text not null,
  seconds_per_question integer not null default 0 check (seconds_per_question between 0 and 600),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  total_questions integer not null check (total_questions > 0),
  -- Cached counters, maintained only by the functions below inside the same transaction as
  -- the responses they summarize.
  questions_answered integer not null default 0,
  correct_count integer not null default 0,
  incorrect_count integer not null default 0,
  first_try_count integer not null default 0,
  -- Percentage of questions answered correctly on the first submission. Set on completion.
  accuracy numeric(5, 2),
  xp_earned integer not null default 0,
  completion_bonus integer not null default 0,
  duration_seconds integer not null default 0,
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  completed_at timestamptz,
  abandoned_at timestamptz,
  foreign key (quiz_id, language) references public.quiz_localizations (quiz_id, language),
  check ((status = 'completed') = (completed_at is not null)),
  check ((status = 'abandoned') = (abandoned_at is not null))
);
create index quiz_attempts_user_started on public.quiz_attempts (user_id, started_at desc);

create table public.attempt_questions (
  attempt_id uuid not null references public.quiz_attempts (id) on delete cascade,
  position integer not null check (position > 0),
  question_id uuid not null references public.questions (id),
  -- Presentation order of the options, frozen when the attempt starts.
  option_ids uuid[] not null,
  outcome text not null default 'pending' check (outcome in ('pending', 'correct', 'revealed', 'timed_out')),
  submissions integer not null default 0,
  xp_awarded integer not null default 0,
  resolved_at timestamptz,
  primary key (attempt_id, position),
  unique (attempt_id, question_id),
  check ((outcome = 'pending') = (resolved_at is null))
);

create table public.question_responses (
  id uuid primary key default gen_random_uuid(),
  -- Global event order. Streaks are computed over this column.
  seq bigint generated always as identity unique,
  attempt_id uuid not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null,
  -- null means the question timed out.
  option_id uuid references public.answer_options (id),
  is_correct boolean not null,
  submission_number integer not null check (submission_number > 0),
  xp_awarded integer not null default 0 check (xp_awarded in (0, 25, 50)),
  duration_ms integer not null default 0 check (duration_ms >= 0),
  client_event_id uuid not null,
  created_at timestamptz not null default now(),
  unique (attempt_id, question_id, submission_number),
  unique (attempt_id, client_event_id),
  foreign key (attempt_id, question_id) references public.attempt_questions (attempt_id, question_id) on delete cascade
);
create index question_responses_user_seq on public.question_responses (user_id, seq);

create table public.xp_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount integer not null check (amount > 0),
  award_type text not null check (award_type in ('question_correct', 'completion_bonus')),
  attempt_id uuid not null references public.quiz_attempts (id) on delete cascade,
  response_id uuid references public.question_responses (id) on delete cascade,
  event text not null check (event in ('answer_submitted', 'attempt_completed')),
  -- question:<attempt>:<question> or completion:<attempt>. One award per key, ever.
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  check ((award_type = 'question_correct') = (response_id is not null))
);
create index xp_ledger_user_created on public.xp_ledger (user_id, created_at);

-- ---------------------------------------------------------------------------
-- Achievements
-- ---------------------------------------------------------------------------

create function private.valid_achievement_criteria(criteria_type text, config jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case criteria_type
    when 'quizzes_completed' then jsonb_typeof(config -> 'count') = 'number' and (config ->> 'count')::numeric > 0
    when 'correct_answers' then jsonb_typeof(config -> 'count') = 'number' and (config ->> 'count')::numeric > 0
    when 'first_try_correct' then jsonb_typeof(config -> 'count') = 'number' and (config ->> 'count')::numeric > 0
    when 'correct_streak' then jsonb_typeof(config -> 'count') = 'number' and (config ->> 'count')::numeric > 0
    when 'quiz_accuracy' then jsonb_typeof(config -> 'min_accuracy') = 'number'
      and (config ->> 'min_accuracy')::numeric between 0 and 100
      and jsonb_typeof(config -> 'min_questions') = 'number' and (config ->> 'min_questions')::numeric >= 1
    when 'quiz_completed' then jsonb_typeof(config -> 'quiz_id') = 'string'
      and (not config ? 'min_accuracy' or jsonb_typeof(config -> 'min_accuracy') = 'number')
    when 'level_completed' then jsonb_typeof(config -> 'level') = 'string'
      and jsonb_typeof(config -> 'quiz_ids') = 'array' and jsonb_array_length(config -> 'quiz_ids') > 0
    else false
  end;
$$;

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  description text not null,
  -- A lucide icon name, mapped to a component in the app.
  icon text not null,
  category text not null check (category in ('completion', 'accuracy', 'streak', 'milestone', 'exploration')),
  rarity text not null default 'common' check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  criteria_type text not null,
  criteria_config jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (private.valid_achievement_criteria(criteria_type, criteria_config))
);

create table public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (user_id, achievement_id)
);

-- ---------------------------------------------------------------------------
-- Row Level Security and privileges
-- ---------------------------------------------------------------------------

alter table public.levels enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_localizations enable row level security;
alter table public.questions enable row level security;
alter table public.answer_options enable row level security;
alter table public.profiles enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.attempt_questions enable row level security;
alter table public.question_responses enable row level security;
alter table public.xp_ledger enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;

-- Supabase grants everything on new public tables to anon and authenticated by default.
-- Start from nothing and grant only what the app reads.
revoke all on all tables in schema public from anon, authenticated;

grant select on public.levels, public.quizzes, public.quiz_localizations to authenticated;
grant select on public.quiz_attempts, public.attempt_questions, public.question_responses,
  public.xp_ledger, public.achievements, public.user_achievements to authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
-- questions and answer_options: no grants at all. Read them through get_attempt().

create policy "levels are readable by signed-in users" on public.levels
  for select to authenticated using (true);

create policy "published quizzes are readable by signed-in users" on public.quizzes
  for select to authenticated using (is_published);

create policy "localizations of published quizzes are readable" on public.quiz_localizations
  for select to authenticated
  using (exists (select 1 from public.quizzes q where q.id = quiz_id and q.is_published));

create policy "users read their own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create policy "users rename themselves" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "users read their own attempts" on public.quiz_attempts
  for select to authenticated using (user_id = (select auth.uid()));

create policy "users read questions of their own attempts" on public.attempt_questions
  for select to authenticated
  using (exists (select 1 from public.quiz_attempts a where a.id = attempt_id and a.user_id = (select auth.uid())));

create policy "users read their own responses" on public.question_responses
  for select to authenticated using (user_id = (select auth.uid()));

create policy "users read their own xp" on public.xp_ledger
  for select to authenticated using (user_id = (select auth.uid()));

create policy "active achievements are readable" on public.achievements
  for select to authenticated using (is_active);

create policy "users read their own unlocks" on public.user_achievements
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Scoring rules
-- ---------------------------------------------------------------------------

-- 50 XP on the first submission, 25 on the second, nothing after that or when wrong.
-- Mirrored for display only by lib/domain/scoring.ts; this function is authoritative.
create function private.xp_for_submission(submission_number integer, is_correct boolean) returns integer
language sql immutable set search_path = '' as $$
  select case
    when not is_correct then 0
    when submission_number = 1 then 50
    when submission_number = 2 then 25
    else 0
  end;
$$;

create function private.completion_bonus() returns integer
language sql immutable set search_path = '' as $$ select 500 $$;

create function private.require_user() returns uuid
language plpgsql stable set search_path = '' as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return v_user;
end;
$$;

-- Best and current runs of consecutive correct submissions, in event order. Every official
-- submission counts: a wrong answer (or a timeout) resets the run even when the question is
-- answered correctly on a later try. Revealing an answer is not a submission.
create function private.streaks(p_user uuid, out best integer, out current integer)
language sql stable set search_path = '' as $$
  with ordered as (
    select seq, is_correct,
           count(*) filter (where not is_correct) over (order by seq) as run
    from public.question_responses
    where user_id = p_user
  ), runs as (
    select run, count(*) filter (where is_correct) as len
    from ordered
    group by run
  )
  select coalesce(max(len), 0)::integer,
         coalesce((select len from runs order by run desc limit 1), 0)::integer
  from runs;
$$;

-- Progress of every active achievement for one user, derived from official records only.
create function private.achievement_progress(p_user uuid)
returns table (achievement_id uuid, current_value numeric, target_value numeric, satisfied boolean)
language sql stable set search_path = '' as $$
  with stats as (
    select
      (select count(*) from public.quiz_attempts where user_id = p_user and status = 'completed') as completed,
      (select count(*) from public.question_responses where user_id = p_user and is_correct) as correct,
      (select count(*) from public.question_responses
         where user_id = p_user and is_correct and submission_number = 1) as first_try,
      (select best from private.streaks(p_user)) as best_streak
  ), progress as (
    select
      a.id,
      case a.criteria_type
        when 'quizzes_completed' then s.completed
        when 'correct_answers' then s.correct
        when 'first_try_correct' then s.first_try
        when 'correct_streak' then s.best_streak
        when 'quiz_accuracy' then coalesce((
          select max(qa.accuracy) from public.quiz_attempts qa
          where qa.user_id = p_user and qa.status = 'completed'
            and qa.total_questions >= (a.criteria_config ->> 'min_questions')::integer), 0)
        when 'quiz_completed' then (
          select count(*) from (
            select 1 from public.quiz_attempts qa
            where qa.user_id = p_user and qa.status = 'completed'
              and qa.quiz_id = a.criteria_config ->> 'quiz_id'
              and qa.accuracy >= coalesce((a.criteria_config ->> 'min_accuracy')::numeric, 0)
            limit 1) hit)
        when 'level_completed' then (
          select count(distinct qa.quiz_id) from public.quiz_attempts qa
          where qa.user_id = p_user and qa.status = 'completed'
            and qa.level_filter = a.criteria_config ->> 'level'
            and qa.quiz_id in (select jsonb_array_elements_text(a.criteria_config -> 'quiz_ids')))
      end::numeric as current_value,
      case a.criteria_type
        when 'quiz_accuracy' then (a.criteria_config ->> 'min_accuracy')::numeric
        when 'quiz_completed' then 1
        when 'level_completed' then jsonb_array_length(a.criteria_config -> 'quiz_ids')
        else (a.criteria_config ->> 'count')::numeric
      end as target_value
    from public.achievements a cross join stats s
    where a.is_active
  )
  select id, current_value, target_value, current_value >= target_value from progress;
$$;

-- Unlocks every satisfied achievement that is not unlocked yet and returns only the new ones,
-- so retries and refreshes never notify twice.
create function private.evaluate_achievements(p_user uuid, p_event jsonb) returns jsonb
language sql volatile set search_path = '' as $$
  with newly as (
    insert into public.user_achievements (user_id, achievement_id, metadata)
    select p_user, p.achievement_id, p_event || jsonb_build_object('value', p.current_value)
    from private.achievement_progress(p_user) p
    where p.satisfied
    on conflict (user_id, achievement_id) do nothing
    returning achievement_id, unlocked_at
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id, 'slug', a.slug, 'name', a.name, 'description', a.description,
      'icon', a.icon, 'rarity', a.rarity, 'category', a.category, 'unlocked_at', n.unlocked_at)
    order by a.sort_order), '[]'::jsonb)
  from newly n join public.achievements a on a.id = n.achievement_id;
$$;

-- Completes the attempt once every question is resolved and awards the bonus exactly once.
create function private.try_complete_attempt(p_attempt_id uuid) returns boolean
language plpgsql volatile set search_path = '' as $$
declare
  v_attempt public.quiz_attempts%rowtype;
begin
  update public.quiz_attempts a
     set status = 'completed',
         completed_at = now(),
         accuracy = round(a.first_try_count * 100.0 / a.total_questions, 2),
         completion_bonus = private.completion_bonus()
   where a.id = p_attempt_id
     and a.status = 'in_progress'
     and not exists (
       select 1 from public.attempt_questions q where q.attempt_id = a.id and q.outcome = 'pending')
  returning * into v_attempt;

  if not found then
    return false;
  end if;

  insert into public.xp_ledger (user_id, amount, award_type, attempt_id, event, idempotency_key)
  values (v_attempt.user_id, private.completion_bonus(), 'completion_bonus', v_attempt.id,
          'attempt_completed', 'completion:' || v_attempt.id)
  on conflict (idempotency_key) do nothing;

  return true;
end;
$$;

-- Server-measured time since the previous event of the attempt, capped so that time away from
-- the quiz (or a resumed session) is not counted. Intervals never overlap: each one starts at
-- the previous event.
create function private.elapsed_ms(p_attempt public.quiz_attempts) returns integer
language sql stable set search_path = '' as $$
  select least(
    greatest(extract(epoch from (now() - p_attempt.last_activity_at)) * 1000, 0),
    case when p_attempt.seconds_per_question > 0
      then (p_attempt.seconds_per_question + 5) * 1000
      else 300000 end
  )::integer;
$$;

-- What the client may see about one question of an attempt. The correct option and the
-- explanation are included only once the question is resolved.
create function private.attempt_question_json(p_attempt_id uuid, p_question_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'question_id', aq.question_id,
    'position', aq.position,
    'level', q.level_id,
    'prompt', q.prompt,
    'options', (
      select jsonb_agg(jsonb_build_object('id', o.id, 'body', o.body) order by t.ord)
      from unnest(aq.option_ids) with ordinality as t (option_id, ord)
      join public.answer_options o on o.id = t.option_id),
    'outcome', aq.outcome,
    'submissions', aq.submissions,
    'xp_awarded', aq.xp_awarded,
    'tried_option_ids', coalesce((
      select jsonb_agg(r.option_id order by r.submission_number)
      from public.question_responses r
      where r.attempt_id = aq.attempt_id and r.question_id = aq.question_id and r.option_id is not null),
      '[]'::jsonb),
    'correct_option_id', case when aq.outcome <> 'pending' then (
      select o.id from public.answer_options o where o.question_id = aq.question_id and o.is_correct) end,
    'explanation', case when aq.outcome <> 'pending' then q.explanation end
  )
  from public.attempt_questions aq
  join public.questions q on q.id = aq.question_id
  where aq.attempt_id = p_attempt_id and aq.question_id = p_question_id;
$$;

create function private.attempt_summary_json(p_attempt_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', a.id, 'status', a.status, 'total_questions', a.total_questions,
    'questions_answered', a.questions_answered, 'correct_count', a.correct_count,
    'incorrect_count', a.incorrect_count, 'first_try_count', a.first_try_count,
    'accuracy', a.accuracy, 'xp_earned', a.xp_earned, 'completion_bonus', a.completion_bonus,
    'duration_seconds', a.duration_seconds, 'completed_at', a.completed_at)
  from public.quiz_attempts a where a.id = p_attempt_id;
$$;

-- ---------------------------------------------------------------------------
-- Client API (SECURITY DEFINER, executable by authenticated users only)
-- ---------------------------------------------------------------------------

create function public.quiz_catalog() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_user();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', z.id,
      'titles', (select jsonb_object_agg(l.language, l.title) from public.quiz_localizations l where l.quiz_id = z.id),
      'counts', (
        select jsonb_object_agg(lv.id, (
          select count(*) from public.questions q
          where q.quiz_id = z.id and q.language = 'en' and q.is_active and q.level_id = lv.id))
        from public.levels lv)
    ) order by z.id)
    from public.quizzes z where z.is_published), '[]'::jsonb);
end;
$$;

create function public.start_attempt(
  p_quiz_id text, p_language text, p_level text, p_count integer, p_seconds_per_question integer
) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid := private.require_user();
  v_ids uuid[];
  v_attempt_id uuid;
begin
  if not exists (select 1 from public.quizzes where id = p_quiz_id and is_published) then
    raise exception 'quiz_not_found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.quiz_localizations where quiz_id = p_quiz_id and language = p_language) then
    raise exception 'invalid_language' using errcode = '22023';
  end if;
  if p_level is null or (p_level <> 'all' and not exists (select 1 from public.levels where id = p_level)) then
    raise exception 'invalid_level' using errcode = '22023';
  end if;
  if p_count is null or p_count < 0 or p_count > 500 then
    raise exception 'invalid_count' using errcode = '22023';
  end if;
  if p_seconds_per_question is null or p_seconds_per_question < 0 or p_seconds_per_question > 600 then
    raise exception 'invalid_time_limit' using errcode = '22023';
  end if;

  select array_agg(id) into v_ids from (
    select q.id from public.questions q
    where q.quiz_id = p_quiz_id and q.language = p_language and q.is_active
      and (p_level = 'all' or q.level_id = p_level)
    order by random()
    limit nullif(p_count, 0)
  ) picked;

  if v_ids is null then
    raise exception 'no_questions' using errcode = 'P0002';
  end if;

  insert into public.profiles (id) values (v_user) on conflict (id) do nothing;

  insert into public.quiz_attempts (user_id, quiz_id, language, level_filter, seconds_per_question, total_questions)
  values (v_user, p_quiz_id, p_language, p_level, p_seconds_per_question, cardinality(v_ids))
  returning id into v_attempt_id;

  insert into public.attempt_questions (attempt_id, position, question_id, option_ids)
  select v_attempt_id, t.ord, t.question_id,
         (select array_agg(o.id order by random()) from public.answer_options o where o.question_id = t.question_id)
  from unnest(v_ids) with ordinality as t (question_id, ord);

  return v_attempt_id;
end;
$$;

create function public.get_attempt(p_attempt_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := private.require_user();
  v_attempt public.quiz_attempts%rowtype;
begin
  select * into v_attempt from public.quiz_attempts where id = p_attempt_id and user_id = v_user;
  if not found then
    raise exception 'attempt_not_found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'attempt', to_jsonb(v_attempt) - 'user_id',
    'quiz_title', (select title from public.quiz_localizations
                   where quiz_id = v_attempt.quiz_id and language = v_attempt.language),
    'questions', (
      select jsonb_agg(private.attempt_question_json(aq.attempt_id, aq.question_id) order by aq.position)
      from public.attempt_questions aq where aq.attempt_id = v_attempt.id),
    'responses', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', r.id, 'question_id', r.question_id, 'option_id', r.option_id, 'is_correct', r.is_correct,
          'submission_number', r.submission_number, 'xp_awarded', r.xp_awarded,
          'duration_ms', r.duration_ms, 'created_at', r.created_at)
        order by r.seq)
      from public.question_responses r where r.attempt_id = v_attempt.id), '[]'::jsonb),
    'unlocked_achievements', coalesce((
      select jsonb_agg(jsonb_build_object('slug', a.slug, 'name', a.name, 'icon', a.icon, 'unlocked_at', ua.unlocked_at)
        order by ua.unlocked_at)
      from public.user_achievements ua join public.achievements a on a.id = ua.achievement_id
      where ua.user_id = v_user and ua.metadata ->> 'attempt_id' = v_attempt.id::text), '[]'::jsonb)
  );
end;
$$;

-- Records one answer. `p_option_id` null means the question's timer ran out.
-- `p_client_event_id` is generated once per submission by the client: replaying the same id
-- returns the original result and changes nothing.
create function public.submit_answer(
  p_attempt_id uuid, p_question_id uuid, p_option_id uuid, p_client_event_id uuid
) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid := private.require_user();
  v_attempt public.quiz_attempts%rowtype;
  v_aq public.attempt_questions%rowtype;
  v_existing public.question_responses%rowtype;
  v_is_correct boolean;
  v_submission integer;
  v_xp integer;
  v_outcome text;
  v_response_id uuid;
  v_completed boolean;
  v_unlocked jsonb;
begin
  if p_client_event_id is null then
    raise exception 'invalid_event_id' using errcode = '22023';
  end if;

  -- Serialize every official event of this user (multiple tabs, retries).
  perform 1 from public.profiles where id = v_user for update;

  select * into v_attempt from public.quiz_attempts where id = p_attempt_id and user_id = v_user for update;
  if not found then
    raise exception 'attempt_not_found' using errcode = 'P0002';
  end if;

  select * into v_existing from public.question_responses
   where attempt_id = p_attempt_id and client_event_id = p_client_event_id;
  if found then
    if v_existing.question_id <> p_question_id or v_existing.option_id is distinct from p_option_id then
      raise exception 'idempotency_conflict' using errcode = '22023';
    end if;
    return jsonb_build_object(
      'replayed', true,
      'response_id', v_existing.id,
      'is_correct', v_existing.is_correct,
      'submission_number', v_existing.submission_number,
      'xp_awarded', v_existing.xp_awarded,
      'question', private.attempt_question_json(p_attempt_id, p_question_id),
      'attempt', private.attempt_summary_json(p_attempt_id),
      'attempt_completed', false,
      'unlocked_achievements', '[]'::jsonb);
  end if;

  if v_attempt.status <> 'in_progress' then
    raise exception 'attempt_closed' using errcode = '55000';
  end if;

  select * into v_aq from public.attempt_questions where attempt_id = p_attempt_id and question_id = p_question_id;
  if not found then
    raise exception 'question_not_in_attempt' using errcode = 'P0002';
  end if;
  if v_aq.outcome <> 'pending' then
    raise exception 'question_resolved' using errcode = '55000';
  end if;
  if p_option_id is not null then
    if not (p_option_id = any (v_aq.option_ids)) then
      raise exception 'invalid_option' using errcode = '22023';
    end if;
    if exists (select 1 from public.question_responses
               where attempt_id = p_attempt_id and question_id = p_question_id and option_id = p_option_id) then
      raise exception 'option_already_tried' using errcode = '55000';
    end if;
  end if;

  v_is_correct := p_option_id is not null and exists (
    select 1 from public.answer_options where id = p_option_id and question_id = p_question_id and is_correct);
  v_submission := v_aq.submissions + 1;
  v_xp := private.xp_for_submission(v_submission, v_is_correct);
  v_outcome := case when v_is_correct then 'correct' when p_option_id is null then 'timed_out' else 'pending' end;

  insert into public.question_responses (
    attempt_id, user_id, question_id, option_id, is_correct, submission_number, xp_awarded,
    duration_ms, client_event_id)
  values (p_attempt_id, v_user, p_question_id, p_option_id, v_is_correct, v_submission, v_xp,
          private.elapsed_ms(v_attempt), p_client_event_id)
  returning id into v_response_id;

  if v_xp > 0 then
    insert into public.xp_ledger (user_id, amount, award_type, attempt_id, response_id, event, idempotency_key)
    values (v_user, v_xp, 'question_correct', p_attempt_id, v_response_id, 'answer_submitted',
            format('question:%s:%s', p_attempt_id, p_question_id))
    on conflict (idempotency_key) do nothing;
    if not found then
      -- Defensive: the question already earned XP in this attempt.
      v_xp := 0;
      update public.question_responses set xp_awarded = 0 where id = v_response_id;
    end if;
  end if;

  update public.attempt_questions
     set submissions = v_submission,
         outcome = v_outcome,
         xp_awarded = xp_awarded + v_xp,
         resolved_at = case when v_outcome <> 'pending' then now() end
   where attempt_id = p_attempt_id and question_id = p_question_id;

  update public.quiz_attempts
     set questions_answered = questions_answered + (v_outcome <> 'pending')::integer,
         correct_count = correct_count + v_is_correct::integer,
         incorrect_count = incorrect_count + (v_outcome = 'timed_out')::integer,
         first_try_count = first_try_count + (v_is_correct and v_submission = 1)::integer,
         xp_earned = xp_earned + v_xp,
         duration_seconds = (select coalesce(sum(duration_ms), 0) / 1000 from public.question_responses
                             where attempt_id = p_attempt_id),
         last_activity_at = now()
   where id = p_attempt_id;

  v_completed := private.try_complete_attempt(p_attempt_id);
  v_unlocked := private.evaluate_achievements(v_user, jsonb_build_object(
    'event', case when v_completed then 'attempt_completed' else 'answer_submitted' end,
    'attempt_id', p_attempt_id, 'response_id', v_response_id));

  return jsonb_build_object(
    'replayed', false,
    'response_id', v_response_id,
    'is_correct', v_is_correct,
    'submission_number', v_submission,
    'xp_awarded', v_xp,
    'question', private.attempt_question_json(p_attempt_id, p_question_id),
    'attempt', private.attempt_summary_json(p_attempt_id),
    'attempt_completed', v_completed,
    'unlocked_achievements', v_unlocked);
end;
$$;

-- Gives up on a question after at least one wrong submission. Earns nothing; idempotent.
create function public.reveal_answer(p_attempt_id uuid, p_question_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid := private.require_user();
  v_attempt public.quiz_attempts%rowtype;
  v_aq public.attempt_questions%rowtype;
  v_completed boolean := false;
  v_unlocked jsonb := '[]'::jsonb;
begin
  perform 1 from public.profiles where id = v_user for update;

  select * into v_attempt from public.quiz_attempts where id = p_attempt_id and user_id = v_user for update;
  if not found then
    raise exception 'attempt_not_found' using errcode = 'P0002';
  end if;

  select * into v_aq from public.attempt_questions where attempt_id = p_attempt_id and question_id = p_question_id;
  if not found then
    raise exception 'question_not_in_attempt' using errcode = 'P0002';
  end if;

  if v_aq.outcome = 'pending' then
    if v_attempt.status <> 'in_progress' then
      raise exception 'attempt_closed' using errcode = '55000';
    end if;
    if v_aq.submissions = 0 then
      raise exception 'answer_first' using errcode = '55000';
    end if;

    update public.attempt_questions set outcome = 'revealed', resolved_at = now()
     where attempt_id = p_attempt_id and question_id = p_question_id;
    update public.quiz_attempts
       set questions_answered = questions_answered + 1,
           incorrect_count = incorrect_count + 1,
           last_activity_at = now()
     where id = p_attempt_id;

    v_completed := private.try_complete_attempt(p_attempt_id);
    if v_completed then
      v_unlocked := private.evaluate_achievements(v_user, jsonb_build_object(
        'event', 'attempt_completed', 'attempt_id', p_attempt_id));
    end if;
  end if;

  return jsonb_build_object(
    'question', private.attempt_question_json(p_attempt_id, p_question_id),
    'attempt', private.attempt_summary_json(p_attempt_id),
    'attempt_completed', v_completed,
    'unlocked_achievements', v_unlocked);
end;
$$;

create function public.abandon_attempt(p_attempt_id uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid := private.require_user();
begin
  update public.quiz_attempts set status = 'abandoned', abandoned_at = now()
   where id = p_attempt_id and user_id = v_user and status = 'in_progress';
  if not found then
    raise exception 'attempt_not_found' using errcode = 'P0002';
  end if;
end;
$$;

create function public.my_achievements()
returns table (
  id uuid, slug text, name text, description text, icon text, category text, rarity text,
  criteria_type text, criteria_config jsonb, sort_order integer,
  current_value numeric, target_value numeric, unlocked_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := private.require_user();
begin
  return query
    select a.id, a.slug, a.name, a.description, a.icon, a.category, a.rarity,
           a.criteria_type, a.criteria_config, a.sort_order,
           least(p.current_value, p.target_value), p.target_value, ua.unlocked_at
    from public.achievements a
    join private.achievement_progress(v_user) p on p.achievement_id = a.id
    left join public.user_achievements ua on ua.achievement_id = a.id and ua.user_id = v_user
    order by a.sort_order, a.slug;
end;
$$;

create function public.my_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := private.require_user();
  v_streaks record;
begin
  select * into v_streaks from private.streaks(v_user);
  return jsonb_build_object(
    'total_xp', (select coalesce(sum(amount), 0) from public.xp_ledger where user_id = v_user),
    'completed_attempts', (select count(*) from public.quiz_attempts where user_id = v_user and status = 'completed'),
    'in_progress_attempts', (select count(*) from public.quiz_attempts where user_id = v_user and status = 'in_progress'),
    'correct_answers', (select count(*) from public.question_responses where user_id = v_user and is_correct),
    'first_try_correct', (select count(*) from public.question_responses
                          where user_id = v_user and is_correct and submission_number = 1),
    'submissions', (select count(*) from public.question_responses where user_id = v_user),
    'questions_completed', (select coalesce(sum(total_questions), 0) from public.quiz_attempts
                            where user_id = v_user and status = 'completed'),
    'first_try_in_completed', (select coalesce(sum(first_try_count), 0) from public.quiz_attempts
                               where user_id = v_user and status = 'completed'),
    'total_time_seconds', (select coalesce(sum(duration_seconds), 0) from public.quiz_attempts where user_id = v_user),
    'current_streak', v_streaks.current,
    'best_streak', v_streaks.best,
    'by_level', coalesce((
      select jsonb_object_agg(level_id, jsonb_build_object('questions', questions, 'first_try', first_try, 'correct', correct))
      from (
        select q.level_id,
               count(*) as questions,
               count(*) filter (where aq.outcome = 'correct' and aq.submissions = 1) as first_try,
               count(*) filter (where aq.outcome = 'correct') as correct
        from public.attempt_questions aq
        join public.quiz_attempts a on a.id = aq.attempt_id
        join public.questions q on q.id = aq.question_id
        where a.user_id = v_user and aq.outcome <> 'pending'
        group by q.level_id) lv), '{}'::jsonb)
  );
end;
$$;

-- Only the client API above is callable. Internal helpers live in the private schema, which
-- clients cannot use at all.
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function
  public.quiz_catalog(),
  public.start_attempt(text, text, text, integer, integer),
  public.get_attempt(uuid),
  public.submit_answer(uuid, uuid, uuid, uuid),
  public.reveal_answer(uuid, uuid),
  public.abandon_attempt(uuid),
  public.my_achievements(),
  public.my_stats()
to authenticated;
