# CFA Lesson Booking — Demo Deck (Design Brief)

*A slide-by-slide brief for Claude Design. Tone: confident, modern, Apple-keynote minimal — one big idea per slide, not a wall of bullets. Rebuilt from scratch around the exact flow being tested: who we are and who we built this for, then Coach Misha shaping his week, then George booking against it, with a real database check after each half. Expanded from 5 slides to 7 to fit the full flow honestly — cut back if you'd rather run leaner.*

---

## Design system

**Colours — pulled directly from the live CFA codebase** (`app/globals.css`), not invented:

| Name | HSL (source of truth) | Approx. hex | Use it for |
|---|---|---|---|
| **CFA Crest Purple** | `hsl(262, 60%, 32%)` | `#452183` | Primary brand colour — backgrounds, big headlines |
| **CFA Deep Indigo** | `hsl(257, 65%, 25%)` | `#2E1669` | Darker variant — deep backgrounds, gradients, shadows |
| **CFA Gold** | `hsl(45, 95%, 52%)` | `#F9BF10` | The one accent colour — used sparingly, for the single most important word/number/highlight per slide |
| **Near-white** | — | `#FAFAF8` | Light backgrounds, body text on dark |
| **Near-black** | — | `#111014` | Body text on light, dark backgrounds |

**Palette logic (Apple-style restraint):** every slide is either a **dark purple slide** (Crest Purple/Deep Indigo background, near-white text, gold used for exactly one accent) or a **light slide** (near-white background, near-black text, purple for headlines, gold for exactly one accent). Never use more than one accent colour on a slide. Let a gradient sweep from Deep Indigo → Crest Purple behind hero moments rather than a flat fill — that's the "modern, Apple" move. The deck alternates dark → light → dark → light → dark → light → dark, so the room feels a rhythm, not a monotone.

**Type:** one confident display face for headlines, set very large (this is a keynote — headlines should be readable from the back of a room), one clean body face for support text, used sparingly. Suggest a geometric/humanist sans pairing — e.g. **Sora** or **General Sans** for headlines, **Inter** for body/captions (both on Google Fonts). Generous negative space; never more than ~15 words of body text on a slide — the speaker fills in the rest verbally.

**Motion (if the destination tool supports it):** a slow, subtle gradient drift on dark slides; headline words fade/rise in one at a time on Slides 1, 3, and 5; everything else static — restraint is the point, not a special-effects reel.

---

## The story arc, in one breath

*Here's who we are and who this is for → here's the coach who'll drive the first half → he shapes his week, and we prove it lands in a real table → here's the parent who drives the second half → he finds it and books it, and we prove that too → the loop closes, live, today.*

---

## Slide 1 — "Group 17. Built for Cape Fencing Academy."

**Narrative hook:** open with real credentials, not the product. Who's presenting, who it's for, what's about to happen — said plainly, before a single screen is shown.

**On-slide content:**
- Small eyebrow line: *INF3003W Systems Development Project · University of Cape Town*
- Headline (large): *"We're Group 17, building for Cape Fencing Academy."*
- Supporting line: *Sponsor: Jeremy Saner. Today: the lesson booking system — live, not slides.*

**Visual direction:** dark Deep Indigo → Crest Purple gradient, full-bleed. Headline centred, the eyebrow line small and quiet above it, the supporting line small and quiet below. No logo needed yet.

**Speaker notes:** Introduce yourselves by name out loud here — the slide stays clean, your voice carries the intro. State the club, the sponsor, and say plainly: *"Everything after this is running live on our laptop — nothing you're about to see is pre-recorded."* Fifteen seconds, no more.

---

## Slide 2 — "Meet Misha and George"

**Narrative hook:** before the technical flow starts, meet the two real people carrying it — not actors, real seeded accounts you're about to log into on stage.

**On-slide content:**
- Headline: *"One coach. One parent. Two real logins."*
- Two simple side-by-side cards: **Coach Misha** — *shapes his own week* · **George** — *books for his daughter, Fiona*

**Visual direction:** light slide (near-white) — the bright, airy beat right after the dark opener, for contrast. Two plain circular initials or simple icon marks (not photos), gold used once as the small divider between the two cards.

**Speaker notes:** Mention both are real seeded test accounts (`coach@cfa.test`, `guardian@cfa.test`) — not fictional personas standing in for a mockup. The login screen you show next is the actual one they'll use.

---

## Slide 3 — "Misha shapes his week"

**Narrative hook:** the first half of the tested flow — coach logs in, blocks a slot, opens a slot. This slide is the title card for that live sequence, not a description of it.

**On-slide content:**
- Headline (built to reveal in beats if the tool supports it): *"He logs in. He blocks Friday. He opens Wednesday."*
- Small caption underneath: *Availability isn't a spreadsheet anymore — it's a form, and it's instant.*

**Visual direction:** dark gradient again (bookending the light slide 2 for rhythm). A simple calendar-week motif rendered minimally — a row of seven small marks, one greyed out (blocked), one gold (added) — the only graphical element on this slide.

**Speaker notes:** This is your cue to actually perform it live: log in as `coach@cfa.test`, go to "Manage my availability," block Friday afternoon, add Wednesday evening. Narrate as you click — the slide has already told the room what's about to happen, so you don't need to explain, just do it.

---

## Slide 4 — "Not app state. A real row, right now."

**Narrative hook:** the first proof beat — stop and show the database, don't just assert it changed.

**On-slide content:**
- Headline: *"We didn't refresh a mockup. We just watched a row land."*
- Small monospace-style caption: `coach_availability_exceptions`

**Visual direction:** light slide, near-white. A simple, clean mock of a database row/table strip — two or three cells wide, gold highlighting the newest row — the one deliberately "technical-looking" moment in the deck, kept minimal, not a cluttered screenshot.

**Speaker notes:** Flip to Supabase Studio's Table Editor live, open `coach_availability_exceptions`, point at the two new rows (the block and the extra hours) stamped with Misha's coach ID. Ten seconds, then flip back.

---

## Slide 5 — "George finds it. George books it."

**Narrative hook:** the second half of the tested flow — mirrors Slide 3's composition on purpose, so the room feels the two halves as one shape.

**On-slide content:**
- Headline (same reveal treatment as Slide 3): *"Seconds later, George sees it — and books it for Fiona."*
- Small caption underneath: *Not a fixed list. Worked out live, the instant the page loads.*

**Visual direction:** dark gradient, mirrored layout of Slide 3 for rhythm. Same calendar-week motif, now with the gold mark shown as booked (filled solid) instead of open.

**Speaker notes:** Perform it live: log in as `guardian@cfa.test`, open the coach directory, click into Misha, show the Wednesday slot sitting there, tick Fiona as the participant, confirm. If you get "that slot was just taken," that's the safety system working — pick another time and keep going, it's a good moment, not a failure.

---

## Slide 6 — "Same proof. His side too."

**Narrative hook:** the second proof beat, deliberately mirroring Slide 4 — and it closes the loop back to where Slide 3 started.

**On-slide content:**
- Headline: *"Same database. Same two seconds of proof."*
- Small monospace-style caption: `bookings` · `booking_participants`
- One extra line, gold: *And it's already sitting in his upcoming lessons.*

**Visual direction:** light slide, mirrored composition of Slide 4.

**Speaker notes:** Flip to Studio again — `bookings`, newest row at the top, Misha's coach ID and the exact Wednesday time he opened. Show `booking_participants` linking it to Fiona. Then flip to `/protected/lessons` as George to show it there too — and if there's time, log back in as Misha to show it landing in his own agenda, closing the loop out loud.

---

## Slide 7 — "Live. Today. Ask us anything."

**Narrative hook:** land the plane — confident close, proof of realness, invitation to try it.

**On-slide content:**
- Headline: *"This isn't a prototype. It's running."*
- Small supporting row of three words in the body typeface: *Next.js · Supabase · Vercel*
- Final line, gold: *"Ask me anything."*

**Visual direction:** darkest slide of the seven — Deep Indigo, near-black at the edges, gradient glow concentrated behind the headline like a stage light. This is the "mic drop" slide — leave it on screen through Q&A.

**Speaker notes:** Close with the honest caveat that makes you *more* credible, not less — the availability system, the booking engine, the security, are all real; only the coach photos and the seeded test accounts are demo dressing, and you know exactly which. Then open the floor.

---

## One rule for the whole deck

If any slide starts feeling crowded, cut text before you shrink the font. Every slide should be readable and land its point in under 5 seconds, before you say a word — the story lives in your narration and the live product; the slides are punctuation, not paragraphs.
