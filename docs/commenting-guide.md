# Commenting guide

How comments are written in this codebase, so new code reads like the rest.

## The rules

1. **Explain why, not what.** The code already says what it does. A comment
   earns its place by giving the reason, the rule behind it, or the trap it
   avoids: "Pay-now lessons are never invoiced", not "filter the charges".
2. **Every file starts with what it is for.** One short paragraph at the top
   of services, repositories, providers, actions and routes says what the file
   is responsible for and where it sits (page -> service -> repository ->
   Supabase).
3. **Document every export with `/** */`.** One or two sentences on what the
   function or component does from the caller's point of view, including who
   is allowed to call it and anything surprising it returns. Editors show
   these on hover. Do not restate parameter types; TypeScript already does.
4. **Use `//` for everything inside a function.** Keep these for non-obvious
   decisions: security checks, money rules, time zones, workarounds for a
   library or provider.
5. **Pages say their URL and who sees them.** The default export of each
   `page.tsx` starts with `/** /protected/billing: ... */`.
6. **Say when something is legacy or unused.** For example "Legacy slot
   booking. No page uses it now." This tells the next developer what is safe
   to remove.
7. **Keep comments true.** Change the comment in the same commit as the
   code. A wrong comment is worse than no comment.
8. **Plain words.** Short sentences, plain dashes (never em dashes), no
   jargon a new team member would not know, and no AI or author attribution.

## What not to comment

- Obvious lines (`i++ // add one`) and self-explanatory constants.
- Zod schemas whose name already says what they check
  (`cancelLessonBookingSchema`). Comment a schema only for a rule that is not
  obvious, such as why a field is required.
- Generated shadcn/ui primitives in `components/ui/`: one line saying where
  they came from is enough.
- Applied migrations in `supabase/migrations/`. They are history: put
  explanations in the new migration instead of editing an old one.

## Sources

- Google TypeScript Style Guide, Comments and documentation:
  https://google.github.io/styleguide/tsguide.html
- TSDoc, the standard for TypeScript doc comments: https://tsdoc.org/
- Real Python, Comments best practices ("explain intent, not mechanics"):
  https://realpython.com/ref/best-practices/comments/
- Andreas Klinger, "Comments explain why, not what":
  https://dev.to/andreasklinger/comments-explain-why-not-what-and-2-more-rules-on-writing-good-comments
