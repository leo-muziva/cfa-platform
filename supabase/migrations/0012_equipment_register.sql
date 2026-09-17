-- Equipment register: the club's inventory of weapons, masks, lames, kit and
-- wires. Ported from the standalone prototypes in docs/register-docs/, which
-- kept it in browser localStorage and then a local SQLite file. Coaches and
-- admins manage the register; ordinary members never see it.

create table public.equipment_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code_prefix text not null unique check (code_prefix ~ '^[A-Z]{2}$'),
  category text not null check (category in ('weapons','masks','lames','clothing','gloves','wires','accessories')),
  requires_size boolean not null default false,
  requires_hand boolean not null default false,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.equipment_types (name,code_prefix,category,requires_size,requires_hand,sort_order)
values
  ('Foil','WF','weapons',false,true,1),
  ('Épée','WE','weapons',false,true,2),
  ('Sabre','WS','weapons',false,true,3),
  ('Foil Mask','MF','masks',true,false,4),
  ('Épée Mask','ME','masks',true,false,5),
  ('Sabre Mask','MS','masks',true,false,6),
  ('Foil Lamé','LF','lames',true,false,7),
  ('Sabre Lamé','LS','lames',true,false,8),
  ('Jacket','JK','clothing',true,false,9),
  ('Plastron','PT','clothing',true,true,10),
  ('Chest Protector','CP','clothing',true,false,11),
  ('Breeches','BR','clothing',true,false,12),
  ('Glove','GL','gloves',true,true,13),
  ('Manchette','MN','gloves',false,true,14),
  ('Foil Wire','FW','wires',false,false,15),
  ('Épée Wire','EW','wires',false,false,16),
  ('Mask Clip','MC','accessories',false,false,17)
on conflict (name) do nothing;

create table public.equipment_items (
  id uuid primary key default gen_random_uuid(),
  type_id uuid not null references public.equipment_types(id) on delete restrict,
  code text not null unique check (code ~ '^[A-Z]{2}[0-9]{3,}$'),
  hand text check (hand is null or hand in ('left','right')),
  size text check (size is null or size in ('XS','S','M','L','XL','XXL')),
  condition text not null check (condition in ('good','fair','poor','broken')),
  status text not null check (status in ('in_storage','with_member','awaiting_repair')),
  notes text,
  -- Nullable, and deliberately not tied to status by a check constraint: the
  -- old paper book did record who took an item out, but the seeded
  -- 'with_member' rows predate that, so their holder is genuinely unknown.
  -- The column exists now so naming the member later isn't a retrofit.
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index equipment_items_type_id_idx on public.equipment_items(type_id);
create index equipment_items_assigned_to_idx on public.equipment_items(assigned_to);

-- Joins on the two-letter code prefix rather than the type name. Every prefix
-- is distinct and every code is prefix + 3 digits, so this is unambiguous and
-- it keeps the accented type names out of the 117-row block below.
insert into public.equipment_items (type_id,code,hand,size,condition,status,notes)
select t.id,v.code,nullif(v.hand,''),nullif(v.size,''),v.condition,v.status,nullif(v.notes,'')
from (values
  ('WF001','right','','good','in_storage',''),
  ('WF002','right','','good','in_storage',''),
  ('WF003','right','','fair','in_storage',''),
  ('WF004','right','','good','with_member',''),
  ('WF005','right','','fair','with_member',''),
  ('WF006','right','','fair','in_storage','Grip worn'),
  ('WF007','right','','poor','awaiting_repair','Blade cracked'),
  ('WF008','left','','good','in_storage',''),
  ('WF009','left','','fair','with_member',''),
  ('WF010','right','','good','in_storage','Junior size'),
  ('WE001','right','','good','in_storage',''),
  ('WE002','right','','good','in_storage',''),
  ('WE003','right','','fair','with_member',''),
  ('WE004','right','','fair','in_storage','Point spring weak'),
  ('WE005','left','','good','in_storage',''),
  ('WE006','right','','poor','awaiting_repair','Blade bent'),
  ('WS001','right','','good','in_storage',''),
  ('WS002','right','','good','in_storage',''),
  ('WS003','right','','fair','with_member',''),
  ('WS004','left','','fair','in_storage',''),
  ('MF001','','XS','good','in_storage',''),
  ('MF002','','S','good','in_storage',''),
  ('MF003','','S','fair','with_member',''),
  ('MF004','','M','good','in_storage',''),
  ('MF005','','M','good','with_member',''),
  ('MF006','','M','fair','in_storage',''),
  ('MF007','','L','good','in_storage',''),
  ('MF008','','L','poor','awaiting_repair','Mesh damaged'),
  ('ME001','','S','good','in_storage',''),
  ('ME002','','M','good','in_storage',''),
  ('ME003','','M','fair','with_member',''),
  ('ME004','','L','good','in_storage',''),
  ('ME005','','L','fair','in_storage','Padding worn'),
  ('MS001','','S','good','in_storage',''),
  ('MS002','','M','good','in_storage',''),
  ('MS003','','M','fair','with_member',''),
  ('LF001','','XS','good','in_storage',''),
  ('LF002','','S','good','in_storage',''),
  ('LF003','','S','fair','with_member',''),
  ('LF004','','M','good','in_storage',''),
  ('LF005','','M','fair','in_storage','Conductivity patchy'),
  ('LF006','','L','good','in_storage',''),
  ('LS001','','S','good','in_storage',''),
  ('LS002','','M','good','with_member',''),
  ('LS003','','M','fair','in_storage',''),
  ('LS004','','L','poor','awaiting_repair','Conductivity failing'),
  ('JK001','','XS','good','in_storage','Kids'),
  ('JK002','','XS','fair','in_storage','Kids'),
  ('JK003','','S','good','in_storage',''),
  ('JK004','','S','good','with_member',''),
  ('JK005','','M','good','in_storage',''),
  ('JK006','','M','good','in_storage',''),
  ('JK007','','M','fair','with_member',''),
  ('JK008','','L','good','in_storage',''),
  ('JK009','','L','fair','in_storage',''),
  ('JK010','','XL','good','in_storage',''),
  ('JK011','','M','poor','awaiting_repair','Zip broken'),
  ('PT001','right','XS','good','in_storage','Kids'),
  ('PT002','right','S','good','in_storage',''),
  ('PT003','right','S','good','with_member',''),
  ('PT004','right','M','good','in_storage',''),
  ('PT005','right','M','fair','in_storage',''),
  ('PT006','right','L','good','in_storage',''),
  ('PT007','left','M','good','in_storage',''),
  ('CP001','','XS','good','in_storage',''),
  ('CP002','','S','good','in_storage',''),
  ('CP003','','M','good','with_member',''),
  ('CP004','','L','fair','in_storage',''),
  ('BR001','','XS','good','in_storage','Kids'),
  ('BR002','','S','good','in_storage',''),
  ('BR003','','S','good','with_member',''),
  ('BR004','','M','good','in_storage',''),
  ('BR005','','M','good','in_storage',''),
  ('BR006','','M','fair','with_member',''),
  ('BR007','','L','good','in_storage',''),
  ('BR008','','XL','fair','in_storage',''),
  ('GL001','right','XS','good','in_storage','Kids'),
  ('GL002','right','S','good','in_storage',''),
  ('GL003','right','S','fair','with_member',''),
  ('GL004','right','M','good','in_storage',''),
  ('GL005','right','M','good','with_member',''),
  ('GL006','right','L','fair','awaiting_repair','Stitching loose'),
  ('GL007','left','S','good','in_storage',''),
  ('GL008','left','M','good','in_storage',''),
  ('MN001','right','','good','in_storage',''),
  ('MN002','right','','good','with_member',''),
  ('MN003','right','','fair','in_storage',''),
  ('MN004','left','','good','in_storage',''),
  ('FW001','','','good','in_storage',''),
  ('FW002','','','good','in_storage',''),
  ('FW003','','','good','in_storage',''),
  ('FW004','','','good','with_member',''),
  ('FW005','','','good','with_member',''),
  ('FW006','','','fair','in_storage',''),
  ('FW007','','','fair','in_storage',''),
  ('FW008','','','fair','with_member',''),
  ('FW009','','','poor','awaiting_repair','Prong bent'),
  ('FW010','','','broken','awaiting_repair','Internal break'),
  ('FW011','','','good','in_storage',''),
  ('FW012','','','fair','in_storage',''),
  ('EW001','','','good','in_storage',''),
  ('EW002','','','good','in_storage',''),
  ('EW003','','','good','with_member',''),
  ('EW004','','','fair','in_storage',''),
  ('EW005','','','fair','with_member',''),
  ('EW006','','','poor','awaiting_repair','Prong loose'),
  ('EW007','','','good','in_storage',''),
  ('MC001','','','good','in_storage',''),
  ('MC002','','','good','in_storage',''),
  ('MC003','','','good','with_member',''),
  ('MC004','','','good','with_member',''),
  ('MC005','','','fair','in_storage',''),
  ('MC006','','','fair','in_storage',''),
  ('MC007','','','poor','in_storage','Spring weak'),
  ('MC008','','','broken','awaiting_repair','Spring broken'),
  ('MC009','','','good','in_storage',''),
  ('MC010','','','fair','in_storage','')
) as v(code,hand,size,condition,status,notes)
join public.equipment_types t on t.code_prefix=left(v.code,2)
on conflict (code) do nothing;

-- A prefix that failed to match would drop rows silently instead of erroring.
do $$ begin
  if (select count(*) from public.equipment_items) <> 117
  then raise exception 'equipment seed incomplete'; end if;
end $$;

create trigger equipment_types_updated_at before update on public.equipment_types
  for each row execute function public.handle_updated_at();
create trigger equipment_items_updated_at before update on public.equipment_items
  for each row execute function public.handle_updated_at();

-- Mirrors current_user_is_admin() from 0003. States the staff_type rule
-- outright rather than trusting is_staff alone, so it can't silently widen if
-- a third staff_type is ever added to the profiles check constraint.
create or replace function public.current_user_is_coach_or_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select is_staff and staff_type in ('admin','coach')
                   from public.profiles where id = auth.uid()), false);
$$;

comment on function public.current_user_is_coach_or_admin() is
  'True when the logged-in user is staff (admin or coach), bypassing RLS like current_user_is_admin().';

alter table public.equipment_types enable row level security;
alter table public.equipment_items enable row level security;

revoke all on public.equipment_types from anon;
revoke all on public.equipment_items from anon;
grant select on public.equipment_types to authenticated;
grant select,insert,update,delete on public.equipment_items to authenticated;
grant all on public.equipment_types to service_role;
grant all on public.equipment_items to service_role;

-- equipment_types is reference data: staff read it, nobody writes it through
-- the API. Adding or renaming a type is a migration.
create policy "staff read equipment types"
  on public.equipment_types for select to authenticated
  using(public.current_user_is_coach_or_admin());

create policy "staff read equipment items"
  on public.equipment_items for select to authenticated
  using(public.current_user_is_coach_or_admin());

create policy "staff add equipment items"
  on public.equipment_items for insert to authenticated
  with check(public.current_user_is_coach_or_admin());

create policy "staff update equipment items"
  on public.equipment_items for update to authenticated
  using(public.current_user_is_coach_or_admin())
  with check(public.current_user_is_coach_or_admin());

-- Deleting inventory is admin-only; coaches add and edit.
create policy "admins delete equipment items"
  on public.equipment_items for delete to authenticated
  using(public.current_user_is_admin());

revoke all on function public.current_user_is_coach_or_admin() from public;
grant execute on function public.current_user_is_coach_or_admin() to authenticated;
