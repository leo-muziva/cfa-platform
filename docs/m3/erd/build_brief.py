"""Generate class_diagram_brief.md from erd_spec.py so the class diagram matches the ERD."""
from pathlib import Path

from erd_spec import ENTITIES, SUBTYPES, SUBTYPE_NOTE, RELATIONSHIPS

# Operations copied from source (file names relative to the repo root).
OPERATIONS = {
    "profile": [
        ("getProfileById(id)", "lib/repositories/MemberRepository.ts"),
        ("updateProfile(id, updates)", "lib/repositories/MemberRepository.ts"),
        ("completeProfile(id, updates)", "lib/repositories/MemberRepository.ts"),
        ("adminUpdateProfile(id, updates)", "lib/repositories/MemberRepository.ts"),
        ("deriveCapabilities(profile, household, effectivePayerId)", "lib/services/MemberService.ts"),
    ],
    "guest": [],
    "member": [],
    "coach": [
        ("createCoachAvailabilityRule(raw)", "lib/services/LessonBookingService.ts"),
        ("createCoachAvailabilityException(raw)", "lib/services/LessonBookingService.ts"),
        ("getCoachLessonsPageData()", "lib/services/LessonBookingService.ts"),
    ],
    "membership": [
        ("getMembership(profileId)", "lib/repositories/PlatformRepository.ts"),
        ("changeMembershipStatus(profileId, status)", "lib/repositories/PlatformRepository.ts"),
        ("cancelCurrentMembership(confirmed)", "lib/services/PlatformService.ts"),
    ],
    "family_link": [
        ("listFamilyLinks()", "lib/repositories/PlatformRepository.ts"),
        ("requestFamilyLink(email)", "lib/repositories/PlatformRepository.ts"),
        ("respondFamilyLink(linkId, response)", "lib/repositories/PlatformRepository.ts"),
        ("endFamilyLink(linkId)", "lib/repositories/PlatformRepository.ts"),
        ("requestFamilyChange(input)", "lib/repositories/FamilyRepository.ts"),
    ],
    "household": [
        ("getHouseholdMembership(profileId)", "lib/repositories/MemberRepository.ts"),
        ("getHouseholdMembers(householdId)", "lib/repositories/MemberRepository.ts"),
        ("getActiveBillingPayer(profileId)", "lib/repositories/MemberRepository.ts"),
        ("attachDependent(profileId, payerId)", "lib/repositories/MemberRepository.ts"),
    ],
    "lesson_booking": [
        ("insertLessonBooking(input)", "lib/repositories/LessonBookingRepository.ts"),
        ("cancelLessonBookingRecord(bookingId, reason, actorType)", "lib/repositories/LessonBookingRepository.ts"),
        ("rescheduleLessonBookingRecord(bookingId, startsAt)", "lib/repositories/LessonBookingRepository.ts"),
        ("getLessonQuote(participantIds)", "lib/repositories/LessonBookingRepository.ts"),
        ("listMemberLessonBookings()", "lib/repositories/LessonBookingRepository.ts"),
    ],
    "booking_participant": [
        ("recordLessonOutcomeRecord(bookingId, outcome, participantId)", "lib/repositories/LessonBookingRepository.ts"),
        ("listEligibleLessonParticipants(actorId, isAdmin)", "lib/repositories/LessonBookingRepository.ts"),
    ],
    "payment": [
        ("preparePayment(target, provider)", "lib/repositories/payment-repository.ts"),
        ("findCheckout(attemptId)", "lib/repositories/payment-repository.ts"),
        ("findPaymentStatus(attemptId)", "lib/repositories/payment-repository.ts"),
        ("recordPaymentEvent(event)", "lib/repositories/payment-repository.ts"),
    ],
    "receipt": [
        ("getBillingForPayer(payerId)", "lib/repositories/PlatformRepository.ts (reads receipts)"),
    ],
}

CLASS = {k: e["name"].replace(" ", "") for k, e in ENTITIES.items()}
CLASS.update({k: s["name"] for k, s in SUBTYPES.items()})


def attr_line(k, col, typ, req, cons, _desc):
    tags = []
    if "PK" in k:
        tags.append("PK")
    if "FK" in k:
        target = cons.split("FK -> ")[1].split(",")[0].split(";")[0].strip() if "FK -> " in cons else ""
        tags.append(f"FK -> {target}" if target else "FK")
    if "UK" in k and "PK" not in k:
        tags.append("UK")
    opt = "" if req == "Required" else " [0..1]"
    tag = f" {{{', '.join(tags)}}}" if tags else ""
    return f"{col}: {typ}{opt}{tag}"


lines = []
w = lines.append
w("# CFA Platform - Class Diagram Brief (Milestone 3)")
w("")
w("This file describes the UML class diagram for the "
  "Expanded Class Diagram section of the INF3003W Milestone 3 report. It is generated from "
  "`docs/m3/erd/erd_spec.py`, the same source as the ERD and the data dictionary, so the three documents stay consistent.")
w("")
w("## Your task")
w("")
w("Draw one UML class diagram (draw.io preferred, PlantUML acceptable) that follows these rules:")
w("")
w("1. Use **exactly** the classes, attributes, operations, generalisation and associations listed below. "
  "Do not add, rename or drop any class, attribute or association.")
w("2. Use the attribute names **exactly as written** (snake_case, matching the database and ERD). "
  "Format them as `name: type`, with `[0..1]` for optional values and `{PK}`, `{FK -> table.column}` or `{UK}` as constraints.")
w("3. Put a compartment of operations in each class, using the method names given. Operations take the parameter names shown; "
  "leave out return types unless you are sure of them.")
w("4. Show Guest, Member and Coach as subclasses of Profile, using a UML generalisation (hollow triangle arrow pointing to Profile) "
  "with the constraint `{overlapping, complete}`.")
w("5. Draw every association in the table below with its multiplicity at **both** ends and its name in the middle. "
  "Associations are plain lines (no diamonds) except where aggregation or composition is stated.")
w("6. Do **not** draw foreign-key columns as separate associations. Each association below already represents one foreign key.")
w("7. Layout: Profile at the top centre with its three subclasses directly beneath it. Put Family Link and Household on the left, "
  "Membership under Member, Lesson Booking under Coach with Booking Participant beneath it, and Payment and Receipt on the right. "
  "Keep lines orthogonal and don't let any line cross a class box.")
w("8. Colour groups (optional, but they match the ERD): people in blue #2F4B8C, family/household in green #2E7D5B, "
  "lessons in orange #B35A1F, payments in purple #6A2C91.")
w("9. Make it readable when printed on a landscape A4/Letter page. Use at least 11 pt text, and don't let the diagram become tiny.")
w("")
w("## Classes")
w("")
for key, e in ENTITIES.items():
    w(f"### {CLASS[key]}  (table `{e['table']}`)")
    w("")
    w(f"_{e['purpose']}_")
    w("")
    w("Attributes:")
    w("")
    for a in e["attrs"]:
        w(f"- `{attr_line(*a)}`")
    w("")
    w("Operations (source):")
    w("")
    for op, src in OPERATIONS[key]:
        w(f"- `{op}` - {src}")
    w("")
    if key == "profile":
        for skey, s in SUBTYPES.items():
            w(f"### {s['name']}  (subclass of Profile, no own table)")
            w("")
            w(f"_{s['description']}_ Identified by `{s['rule']}` in `profiles`.")
            w("")
            w("Attributes: none of its own (inherits all Profile attributes).")
            w("")
            if OPERATIONS[skey]:
                w("Operations (source):")
                w("")
                for op, src in OPERATIONS[skey]:
                    w(f"- `{op}` - {src}")
            else:
                w("Operations: none of its own (inherits Profile operations). Leave the operations compartment empty.")
            w("")
        w(f"Generalisation note: {SUBTYPE_NOTE} Show this with `{{overlapping, complete}}` on the generalisation.")
        w("")

w("## Associations")
w("")
w("Read each row as: *one* `Class A` relates to `multiplicity at B` of `Class B`, and the reverse.")
w("")
w("| # | Class A | Mult. at A | Association name | Mult. at B | Class B | Implemented by |")
w("|---|---|---|---|---|---|---|")
for i, (rid, parent, pm, child, cm, verb, via, dashed) in enumerate(RELATIONSHIPS, 1):
    impl = via + (" (link table, draw as a dashed association with a note)" if dashed else "")
    w(f"| {i} | {CLASS[parent]} | {pm} | {verb} | {cm} | {CLASS[child]} | `{impl}` |")
w("")
w("Aggregation/composition: draw **LessonBooking to BookingParticipant** as a composition (filled diamond at LessonBooking), "
  "because participants are deleted with their booking (ON DELETE CASCADE). All other associations are plain.")
w("")

w("## Text for the report section")
w("")
w("Paste this into the Expanded Class Diagram section in place of the current paragraphs once the new diagram is inserted:")
w("")
names = [CLASS[k] for k in ENTITIES]
w(f"> The expanded class diagram extends the principal ERD to an implementation level. It uses the same {len(names)} domain "
  f"classes as the ERD and data dictionary ({', '.join(names[:-1])} and {names[-1]}), with the same attributes and "
  "multiplicities. Each operation is a real repository or service method from the codebase, so the diagram shows where "
  "each class's behaviour is implemented.")
w(">")
w("> Guest, Member and Coach are subclasses of Profile, because the platform stores every account as a single profiles "
  "record and identifies the role from membership_status and the staff fields. The generalisation is overlapping and "
  "complete: every profile is either a guest or a member, and a coach can also be a member. Relationships that apply to "
  "any account, such as booking lessons, paying and family links, attach to Profile. Membership also attaches to Profile, "
  "because the memberships record is kept when an administrator ends a membership and the profile returns to guest. "
  "Coaching a lesson attaches only to Coach.")
w(">")
w("> Associations carry UML multiplicities at both ends. A foreign key that may be empty is shown as 0..1, and a foreign key "
  "with a uniqueness constraint limits the other end to 0..1. Lesson Booking is composed of one or two Booking Participants, "
  "who are removed together with their booking. The Household to Profile association is implemented through the "
  "household_members link table, so it is drawn dashed.")
w("")

w("## PlantUML starting point")
w("")
w("```plantuml")
w("@startuml")
w("skinparam classAttributeIconSize 0")
w("skinparam linetype ortho")
w("hide circle")
for key, e in ENTITIES.items():
    w(f"class {CLASS[key]} {{")
    for a in e["attrs"]:
        w(f"  {attr_line(*a)}")
    w("  --")
    for op, _src in OPERATIONS[key]:
        w(f"  {op}")
    w("}")
    if key == "profile":
        for skey, s in SUBTYPES.items():
            w(f"class {s['name']} {{")
            for op, _src in OPERATIONS[skey]:
                w(f"  {op}")
            w("}")
            w(f"Profile <|-- {s['name']}")
        w('note "{overlapping, complete}" as GenNote')
        w("GenNote .. Profile")
for rid, parent, pm, child, cm, verb, via, dashed in RELATIONSHIPS:
    arrow = "*--" if rid == "r_includes" else (".." if dashed else "--")
    w(f'{CLASS[parent]} "{pm}" {arrow} "{cm}" {CLASS[child]} : {verb}')
w("@enduml")
w("```")
w("")

w("## Checklist before you hand it back")
w("")
w(f"- [ ] {len(ENTITIES)} table classes plus 3 subclasses ({len(ENTITIES) + 3} boxes in total), and no others (no Charge, Invoice, Shop or repository classes).")
w(f"- [ ] Every attribute listed above is present with the same name and type; {sum(len(e['attrs']) for e in ENTITIES.values())} attributes in total.")
w(f"- [ ] All {len(RELATIONSHIPS)} associations are drawn, each with a multiplicity at both ends and a name.")
w("- [ ] The generalisation triangle points to Profile and is labelled {overlapping, complete}.")
w("- [ ] The LessonBooking to BookingParticipant composition shows 1 and 1..2.")
w("- [ ] The Household to Profile association is dashed and noted as via household_members.")
w("- [ ] No line crosses a class box, and all text is legible on a landscape page.")
w("")

Path(__file__).with_name("class_diagram_brief.md").write_text("\n".join(lines), encoding="utf-8")
print("wrote class_diagram_brief.md")
