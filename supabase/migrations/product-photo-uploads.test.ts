import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Whitespace collapsed so the checks survive line-ending changes.
const sql = readFileSync(new URL('./0056_product_photo_uploads.sql', import.meta.url), 'utf8')
  .toLowerCase()
  .replace(/\s+/g, ' ')

describe('product photo uploads migration', () => {
  it('creates a public bucket limited to 4 MB images', () => {
    expect(sql).toContain("'product-photos', 'product-photos', true, 4194304")
    expect(sql).toContain("array['image/jpeg', 'image/png', 'image/webp']")
  })

  it('lets only admins write, replace or delete photos', () => {
    for (const action of ['select', 'insert', 'update', 'delete']) {
      expect(sql).toContain(`on storage.objects for ${action}`)
    }
    expect(sql.match(/bucket_id = 'product-photos' and public\.current_user_is_admin\(\)/g)).toHaveLength(5)
    expect(sql).not.toContain('role =')
  })
})
