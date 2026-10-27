// Labels and grouping for the shop's browse steps: section, then weapon
// (weapons and parts only), then products grouped by kind.

export type ShopSection = 'weapons' | 'clothing' | 'electric' | 'parts' | 'bags_tools' | 'club'
export type ShopWeapon = 'foil' | 'epee' | 'sabre'
export type ShopLevel = 'practice' | 'electric' | 'fie'

export interface SectionInfo {
  key: ShopSection
  label: string
  // Sections where the weapon changes what fits ask for it first.
  asksForWeapon: boolean
}

export const SECTIONS: SectionInfo[] = [
  { key: 'weapons', label: 'Weapons', asksForWeapon: true },
  { key: 'clothing', label: 'Masks and clothing', asksForWeapon: false },
  { key: 'electric', label: 'Electric kit', asksForWeapon: false },
  { key: 'parts', label: 'Parts and repairs', asksForWeapon: true },
  { key: 'bags_tools', label: 'Bags and tools', asksForWeapon: false },
  { key: 'club', label: 'Club and coaching', asksForWeapon: false },
]

// Allowed values for URL parameters, used by the Zod schemas.
export const SECTION_KEYS = ['weapons', 'clothing', 'electric', 'parts', 'bags_tools', 'club'] as const
export const WEAPON_KEYS = ['foil', 'epee', 'sabre'] as const
export const LEVEL_KEYS = ['practice', 'electric', 'fie'] as const

export const WEAPON_LABELS: Record<ShopWeapon, string> = { foil: 'Foil', epee: 'Épée', sabre: 'Sabre' }
// Products with no weapon fit every weapon and are listed under this key.
export const GENERAL = 'general'
export const GENERAL_LABEL = 'Fits any weapon'

export const LEVEL_LABELS: Record<ShopLevel, string> = { practice: 'Practice', electric: 'Electric', fie: 'FIE' }

// Order the kinds appear in on a product page.
export const KIND_LABELS: Record<string, string> = {
  complete_weapon: 'Weapons',
  blade: 'Blades',
  grip: 'Grips',
  guard: 'Guards',
  pommel: 'Pommels and nuts',
  point: 'Points and wires',
  socket: 'Sockets',
  lame: 'Lames',
  body_cord: 'Body and mask cords',
  plug: 'Plugs, pins and clips',
  mask: 'Masks',
  mask_part: 'Mask parts',
  jacket_pants: 'Jackets, pants and plastrons',
  glove: 'Gloves',
  protector: 'Chest and body protectors',
  shoes_socks: 'Shoes and socks',
  hema: 'HEMA',
  bag: 'Bags and covers',
  tool: 'Tools',
  coach_gear: 'Coach gear',
  scoring: 'Scoring equipment',
}
export const KIND_KEYS = Object.keys(KIND_LABELS) as [string, ...string[]]
const KIND_ORDER: string[] = KIND_KEYS
// Products with no level are listed last.
const LEVEL_ORDER: (ShopLevel | null)[] = ['practice', 'electric', 'fie', null]

/** The section for a URL key, or undefined when the key is not known. */
export function findSection(key: string | undefined): SectionInfo | undefined {
  return SECTIONS.find((section) => section.key === key)
}

/** Narrows a URL value to a weapon. */
export function isShopWeapon(value: string | undefined): value is ShopWeapon {
  return value === 'foil' || value === 'epee' || value === 'sabre'
}

// The product fields grouping needs.
export interface BrowseProduct {
  kind: string | null
  level: string | null
}

export interface ProductGroup<T> {
  key: string
  label: string
  items: T[]
}

// Groups by kind, then splits a kind by level (practice, electric, FIE)
// when it has more than one. Keeps the incoming order inside each group.
export function groupProducts<T extends BrowseProduct>(products: T[]): ProductGroup<T>[] {
  const byKind = new Map<string, T[]>()
  for (const product of products) {
    const kind = product.kind ?? 'other'
    byKind.set(kind, [...(byKind.get(kind) ?? []), product])
  }

  const kinds = [...byKind.keys()].sort((a, b) => rank(KIND_ORDER, a) - rank(KIND_ORDER, b))
  const groups: ProductGroup<T>[] = []
  for (const kind of kinds) {
    const items = byKind.get(kind) ?? []
    const kindLabel = KIND_LABELS[kind] ?? 'Other'
    const levels = new Set(items.map((item) => item.level ?? null))
    if (levels.size <= 1) {
      groups.push({ key: kind, label: kindLabel, items })
      continue
    }
    for (const level of LEVEL_ORDER) {
      const levelItems = items.filter((item) => (item.level ?? null) === level)
      if (levelItems.length === 0) continue
      const levelLabel = level ? LEVEL_LABELS[level as ShopLevel] : 'Other'
      groups.push({ key: `${kind}-${level ?? 'other'}`, label: `${kindLabel} - ${levelLabel}`, items: levelItems })
    }
  }
  return groups
}

// Position of a value in an ordering; unknown values go last.
function rank(order: (string | null)[], value: string | null) {
  const index = order.indexOf(value)
  return index === -1 ? order.length : index
}