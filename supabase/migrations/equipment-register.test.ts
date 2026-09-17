import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(new URL('./0012_equipment_register.sql', import.meta.url), 'utf8').toLowerCase()

describe('equipment register schema', () => {
  it('creates both tables with the register\'s own vocabulary', () => {
    expect(migration).toContain('create table public.equipment_types')
    expect(migration).toContain('create table public.equipment_items')
    expect(migration).toContain("check (category in ('weapons','masks','lames','clothing','gloves','wires','accessories'))")
    expect(migration).toContain("check (condition in ('good','fair','poor','broken'))")
    expect(migration).toContain("check (status in ('in_storage','with_member','awaiting_repair'))")
    expect(migration).toContain("hand text check (hand is null or hand in ('left','right'))")
  })

  it('stores tokens rather than the standalone tool\'s display strings', () => {
    expect(migration).not.toContain("'in storage'")
    expect(migration).not.toContain("'awaiting repair'")
    expect(migration).not.toContain("'with member'")
  })

  it('keeps item codes unique and refuses to orphan a type', () => {
    expect(migration).toContain('code text not null unique')
    expect(migration).toContain('references public.equipment_types(id) on delete restrict')
  })

  it('records who holds an item without coupling it to the status', () => {
    expect(migration).toContain('assigned_to uuid references public.profiles(id) on delete set null')
    // The seeded 'with_member' rows have no recorded holder, so a constraint
    // tying the two together would make them unrepresentable.
    expect(migration).not.toContain("(status = 'with_member') = (assigned_to is not null)")
    expect(migration).not.toContain('assigned_to is not null')
  })
})

describe('equipment register seed', () => {
  it('seeds all 17 types with their code prefixes and per-type rules', () => {
    const typeRows = migration.match(/\('[^']+','[a-z]{2}','(weapons|masks|lames|clothing|gloves|wires|accessories)'/g)
    expect(typeRows).toHaveLength(17)
    expect(migration).toContain("('foil','wf','weapons',false,true,1)")
    expect(migration).toContain("('épée','we','weapons',false,true,2)")
    expect(migration).toContain("('mask clip','mc','accessories',false,false,17)")
  })

  it('seeds all 117 items and joins them to their type by code prefix', () => {
    const itemRows = migration.match(/\('[a-z]{2}\d{3}','/g)
    expect(itemRows).toHaveLength(117)
    expect(migration).toContain('join public.equipment_types t on t.code_prefix=left(v.code,2)')
    expect(migration).toContain("nullif(v.hand,'')")
    expect(migration).toContain("nullif(v.size,'')")
  })

  it('fails loudly if the prefix join silently drops rows', () => {
    expect(migration).toContain('<> 117')
    expect(migration).toContain("raise exception 'equipment seed incomplete'")
  })

  it('stays re-runnable', () => {
    expect(migration).toContain('on conflict (name) do nothing')
    expect(migration).toContain('on conflict (code) do nothing')
  })
})

describe('equipment register permissions', () => {
  it('locks both tables down and shuts anon out', () => {
    expect(migration).toContain('alter table public.equipment_types enable row level security')
    expect(migration).toContain('alter table public.equipment_items enable row level security')
    expect(migration).toContain('revoke all on public.equipment_types from anon')
    expect(migration).toContain('revoke all on public.equipment_items from anon')
  })

  it('derives staff access from a security definer helper, not a jwt claim', () => {
    expect(migration).toContain('create or replace function public.current_user_is_coach_or_admin()')
    expect(migration).toContain("staff_type in ('admin','coach')")
    expect(migration).toContain('security definer set search_path = public')
    expect(migration).toContain('revoke all on function public.current_user_is_coach_or_admin() from public')
    expect(migration).toContain('grant execute on function public.current_user_is_coach_or_admin() to authenticated')
  })

  it('gates every item policy on staff', () => {
    for (const action of ['select', 'insert', 'update']) {
      expect(migration).toContain(`on public.equipment_items for ${action} to authenticated`)
    }
    expect(migration).toContain('using(public.current_user_is_coach_or_admin())')
    expect(migration).toContain('with check(public.current_user_is_coach_or_admin())')
  })

  it('reserves deleting inventory for admins', () => {
    const start = migration.indexOf('on public.equipment_items for delete')
    const deletePolicy = migration.slice(start, migration.indexOf(';', start))
    expect(deletePolicy).toContain('using(public.current_user_is_admin())')
    expect(deletePolicy).not.toContain('coach')
  })

  it('treats equipment_types as read-only reference data', () => {
    expect(migration).toContain('grant select on public.equipment_types to authenticated')
    expect(migration).not.toMatch(/on public\.equipment_types for (insert|update|delete|all)/)
  })
})
