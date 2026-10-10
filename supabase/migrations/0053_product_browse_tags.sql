-- Browse tags for the shop. Members pick a section first, then (for weapons
-- and parts) a weapon, then see products grouped by kind. The old category
-- column stays so orders, admin and the supplier sheet keep working.
-- Item codes are never changed here.

alter table public.products
  add column section text check (section in ('weapons','clothing','electric','parts','bags_tools','club')),
  add column weapon text check (weapon in ('foil','epee','sabre')),
  add column kind text check (kind in (
    'complete_weapon','blade','grip','guard','pommel','point','socket',
    'lame','body_cord','plug',
    'mask','mask_part','jacket_pants','glove','protector','shoes_socks','hema',
    'bag','tool','coach_gear','scoring'
  )),
  add column level text check (level in ('practice','electric','fie'));

-- Sections and kinds, from the supplier category.
update public.products set section = 'weapons',   kind = 'complete_weapon' where category = 'Weapons';
update public.products set section = 'parts',     kind = 'blade'   where category = 'Blades';
update public.products set section = 'parts',     kind = 'grip'    where category = 'Grips';
update public.products set section = 'parts',     kind = 'guard'   where category = 'Guards';
update public.products set section = 'parts',     kind = 'pommel'  where category = 'Pommels';
update public.products set section = 'parts',     kind = 'point'   where category = 'Points & Wires';
update public.products set section = 'parts',     kind = 'socket'  where category = 'Sockets';
update public.products set section = 'electric',  kind = 'lame'    where category = 'Lames';
update public.products set section = 'electric',  kind = case
    when name ilike '%cord%' then 'body_cord' else 'plug' end
  where category = 'Body Cords';
update public.products set section = 'clothing',  kind = case
    when name ilike '%lining%' and name not ilike '%mask with%' and name not ilike '%mask (%' and name not ilike '%inox mask%' then 'mask_part'
    when name ilike '%strap%' or name ilike '%electric bib%' then 'mask_part'
    else 'mask' end
  where category = 'Masks';
update public.products set section = 'clothing',  kind = case
    when name ilike '%glove%' or name ilike '%cuff%' then 'glove'
    when name ilike '%protector%' or name ilike '%breast%' then 'protector'
    when name ilike '%shoes%' or name ilike '%socks%' then 'shoes_socks'
    else 'jacket_pants' end
  where category = 'Clothing';
update public.products set section = 'clothing',  kind = 'hema'    where category = 'New Products';
update public.products set section = 'bags_tools', kind = 'bag'    where category = 'Bags';
update public.products set section = 'bags_tools', kind = 'tool'   where category = 'Tools';
update public.products set section = 'club',      kind = 'coach_gear' where category = 'Coach Gear';
-- The supplier files a couple of mask parts and a blade cover under scoring;
-- members look for those with masks and bags.
update public.products set section = case
    when name ilike '%strap%' or name ilike '%electric bib%' then 'clothing'
    when name ilike '%cover%' then 'bags_tools'
    else 'club' end,
  kind = case
    when name ilike '%strap%' or name ilike '%electric bib%' then 'mask_part'
    when name ilike '%cover%' then 'bag'
    else 'scoring' end
  where category = 'Scoring Equipment';

-- FIE items go back into their normal section, marked as FIE.
update public.products set level = 'fie', section = case
    when name ilike '%weapon%' then 'weapons'
    when name ilike '%blade%' then 'parts'
    else 'clothing' end,
  kind = case
    when name ilike '%weapon%' then 'complete_weapon'
    when name ilike '%blade%' then 'blade'
    when name ilike '%mask%' then 'mask'
    when name ilike '%underarm%' then 'protector'
    else 'jacket_pants' end
  where category = 'FIE Range';

-- Anything new or unexpected still shows somewhere.
update public.products set section = 'bags_tools', kind = 'tool' where section is null;

-- Weapon, only where it matters.
update public.products set weapon = case
    when name ilike 'foil%' or name ilike '% foil %' then 'foil'
    when name ilike 'sabre%' or name ilike '% sabre %' then 'sabre'
    end
  where section in ('weapons','parts') or kind in ('lame','mask','mask_part','glove');

-- The supplier writes "Foil ..." and "Sabre ..." and leaves épée unmarked, so
-- an unmarked sword, blade, grip, guard, point or socket is the épée one
-- (most have a "Foil ..." twin in the list). Pommels and nuts have no twins
-- and stay general.
update public.products set weapon = 'epee'
  where weapon is null
    and kind in ('complete_weapon','blade','grip','guard','point','socket');

-- Practice or electric, for weapons and blades.
update public.products set level = case
    when name ilike '%practice%' then 'practice'
    when name ilike '%electric%' or name ilike '%wired%' then 'electric'
    end
  where level is null and kind in ('complete_weapon','blade');

-- Tidy names from the supplier list (codes untouched).
update public.products set name = regexp_replace(name, '\s{2,}', ' ', 'g') where name ~ '\s{2,}';
update public.products set name = 'CE350N HEMA Fencing Pants (long)' where item_code = 'EF203';

create index products_browse_idx on public.products (section, weapon, kind);
