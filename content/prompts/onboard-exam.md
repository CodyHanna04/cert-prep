# Prompt: onboard a new certification (exam pack)

Use this as the instruction when asking Claude (or another agent) to add an exam. The human supplies only the **vendor and exam name**; everything else is researched from the vendor's own published material.

---

**Task:** Build an exam pack for **{VENDOR} {EXAM NAME}** under `content/{exam-code-lowercase}/`, following `docs/08-exam-pack-onboarding.md` and starting from `content/_template/`.

**Rules**
1. **Only the vendor's published material is authoritative** (exam guide/objectives PDF or page, certification landing page). Third-party blogs may be used to *find* the official pages, never as the source of any fact in the pack.
2. **Find the current version first.** Open the vendor's certification page and look for links to the newest exam guide and for any notice that the exam is being updated or replaced (a registration-opens date, a last-day-to-take date). If a newer version exists or is scheduled, build the pack for the version the user will actually sit, and record the other in `version`. Ask the user which version if it is unclear.
3. **Read the guide itself.** If a fetch returns only compressed bytes or a JavaScript shell, look for a PDF; if the harness saves the raw PDF locally, read it by page range with the PDF reader. Prefer the versioned guide over summaries. Try the vendor's documentation site as well as its marketing page; they often differ in what renders as text.
4. **Transcribe, don't paraphrase numbers.** Domains and exact weights (note whether they are "% of scored content"), every objective/task with its number and title, question count (scored vs unscored if stated), time limit, question types, passing score and scale, scoring model (compensatory or not).
5. **Condense scope without adding facts.** For each objective, list the service/concept/skill names the vendor itself lists. Save the vendor's in-scope and out-of-scope lists in `scope.md`.
6. **Cross-check** weights and format against a second vendor page. Where a fact appears on only one page (for example time limit or price), say so in `sources[].note`.
7. **Flag unsupported question types** (anything beyond single, multi, tf: drag-and-drop, ordering, matching, hot area, case studies, simulations, labs). Do not invent a representation; report them and propose a triage choice from doc 08 §5.
8. **Pass mark:** if the vendor publishes only a scaled score, set `passMarkPct` as a clearly labelled proxy and explain it in `passMarkNote`. Keep `readinessTargetPct` at 80 unless the user says otherwise.
9. **Do not write any questions.** Question drafting is a separate step ([doc 07](../../docs/07-ai-content-pipeline.md)).
10. **Run `node scripts/validate-pack.mjs content/{exam-code}/blueprint.json`** and fix every error before reporting.

**Report back with**
- The pack path and the validator result.
- A table of domains, weights and objective counts.
- Facts that came from only one source, and anything you could not verify (say "not stated" rather than guessing).
- Unsupported question types found, with your recommendation.
- Whether a newer or older version exists and which one the pack covers.
- Anything in the guide that looks unusual or ambiguous (for example a weight table that doesn't sum to 100).

**Do not:** copy or paraphrase real exam questions, use brain-dump sites, or add objectives the vendor did not publish.
