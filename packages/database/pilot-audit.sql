-- Read-only schema inventory for the Supabase SQL editor, as project owner.
-- Produces metadata only: no profile values, reports, saves, or tokens.
-- Review every result set. This is not a substitute for two-account testing
-- or verification of Auth settings, email delivery, and hosted configuration.
begin read only;

-- Missing tables and disabled RLS require investigation before release.
with expected(schema_name, table_name) as (values
  ('public', 'users'), ('public', 'user_preferences'),
  ('public', 'recommendations'), ('public', 'calendar_connections'),
  ('public', 'user_reported_events'), ('public', 'chat_usage')
)
select e.table_name,
  case when c.oid is null then 'missing' when c.relrowsecurity then 'enabled' else 'disabled' end as row_security
from expected e
left join pg_class c on c.oid = to_regclass(e.schema_name || '.' || e.table_name)
order by e.table_name;

-- Extra permissive policies can broaden access even when expected policies exist.
select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename in
  ('users', 'user_preferences', 'recommendations', 'calendar_connections', 'user_reported_events', 'chat_usage')
order by tablename, policyname;

-- Required migration columns; a null type means the column is missing.
with expected(table_name, column_name) as (values
  ('recommendations', 'save_key'), ('recommendations', 'end_time'),
  ('user_reported_events', 'moderation_status'), ('chat_usage', 'usage_date'),
  ('chat_usage', 'requests'), ('chat_usage', 'last_request_at')
)
select e.table_name, e.column_name, c.data_type, c.is_nullable
from expected e
left join information_schema.columns c on c.table_schema = 'public'
  and c.table_name = e.table_name and c.column_name = e.column_name
order by e.table_name, e.column_name;

-- Check definitions and foreign keys. NOT VALID report constraints preserve
-- legacy rows but still constrain new writes; review those legacy rows separately.
select c.relname as table_name, k.conname, k.contype,
  k.convalidated, pg_get_constraintdef(k.oid) as definition
from pg_constraint k join pg_class c on c.oid = k.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in
  ('user_preferences', 'recommendations', 'user_reported_events', 'chat_usage')
order by c.relname, k.conname;

-- Cloud save identity requires uniqueness on (user_id, save_key).
select indexname, indexdef from pg_indexes
where schemaname = 'public' and tablename = 'recommendations'
order by indexname;

-- Table grants are an inventory, not proof of access: RLS must still apply.
with expected(table_name) as (values ('users'), ('user_preferences'),
  ('recommendations'), ('calendar_connections'), ('user_reported_events'), ('chat_usage')),
roles(role_name) as (values ('anon'), ('authenticated'))
select e.table_name, roles.role_name, r.oid is not null as role_exists,
  case when c.oid is not null and r.oid is not null then has_table_privilege(r.oid, c.oid, 'SELECT') end as can_select,
  case when c.oid is not null and r.oid is not null then has_table_privilege(r.oid, c.oid, 'INSERT') end as can_insert,
  case when c.oid is not null and r.oid is not null then has_table_privilege(r.oid, c.oid, 'UPDATE') end as can_update,
  case when c.oid is not null and r.oid is not null then has_table_privilege(r.oid, c.oid, 'DELETE') end as can_delete
from expected e cross join roles
left join pg_roles r on r.rolname = roles.role_name
left join pg_class c on c.oid = to_regclass('public.' || e.table_name)
order by e.table_name, roles.role_name;

-- Chat allowance must be security-definer, have a restricted search_path,
-- and allow authenticated execution while denying anon/PUBLIC execution.
with expected(function_name) as (values ('public.consume_chat_allowance()'), ('public.handle_new_auth_user()')),
roles(role_name) as (values ('anon'), ('authenticated'))
select e.function_name, p.oid is not null as function_exists,
  p.prosecdef as security_definer, p.proconfig as settings, roles.role_name,
  case when p.oid is not null and r.oid is not null then has_function_privilege(r.oid, p.oid, 'EXECUTE') end as can_execute,
  case when p.oid is not null then exists (
    select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ) end as public_can_execute
from expected e cross join roles
left join pg_proc p on p.oid = to_regprocedure(e.function_name)
left join pg_roles r on r.rolname = roles.role_name
order by e.function_name, roles.role_name;

-- Trigger must be enabled and point to the reviewed profile-sync function.
select 'on_auth_user_created' as trigger_name,
  t.oid is not null as trigger_exists, t.tgenabled as enabled,
  pg_get_triggerdef(t.oid) as definition
from (values (1)) placeholder(value)
left join pg_trigger t on t.tgrelid = to_regclass('auth.users')
  and t.tgname = 'on_auth_user_created' and not t.tgisinternal;

rollback;
