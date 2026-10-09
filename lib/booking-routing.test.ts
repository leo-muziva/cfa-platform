import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (relativePath: string) => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
const compatibilityPage = read('app/book/page.tsx')
const protectedPage = read('app/protected/book/page.tsx')
const protectedCoachPage = read('app/protected/book/[coachId]/page.tsx')
const siteNavigation = read('components/site-navigation.tsx')
const signup = read('components/ui/sign-up.tsx')

describe('protected booking routing', () => {
  it('keeps the public compatibility route data-free and redirects to the canonical page', () => {
    expect(compatibilityPage).toContain('redirect(`/protected/book')
    expect(compatibilityPage).toContain('safeBookingSlot')
    expect(compatibilityPage).not.toContain('listOpenSlots')
    expect(compatibilityPage).not.toContain('BookingCalendar')
  })

  it('loads the active coach directory only on the canonical protected page', () => {
    expect(protectedPage).toContain('getLessonCoachDirectory()')
    expect(protectedPage).toContain('/auth/login?next=')
    expect(protectedPage).toContain('<CoachDirectory')
    expect(protectedPage).not.toContain('listOpenSlots')
    expect(protectedCoachPage).toContain('getLessonBookingPageData(coachId')
  })

  it('removes public booking navigation and carries booking through signup confirmation', () => {
    expect(siteNavigation).not.toContain('href: "/book"')
    expect(siteNavigation).toContain('href: "/protected/book"')
    // The URL itself is covered by emailConfirmRedirect's tests in auth-next.test.ts.
    expect(signup).toContain('emailConfirmRedirect(window.location.origin, next)')
  })
})
