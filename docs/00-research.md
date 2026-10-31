# 00 — Research

*Researched 2026-10-30. Most web sources on this topic are vendor/affiliate blogs, so claims are marked with confidence. Items marked **verify** should be checked against primary sources before we depend on them. **Only §11 (the CLF-C02 exam facts) was verified against a primary source** (the official AWS exam guide); everything else comes from search results and should be treated as background, not fact. Stack findings are argued in [09-stack-options.md](09-stack-options.md).*

## 1. Competitive landscape

| Product | Strength | Weakness / gap we can exploit |
|---|---|---|
| **Tutorials Dojo** (AWS, Azure, etc.) | Praised for realistic difficulty and detailed explanations of correct *and* wrong answers. | Web-only, no offline/mobile app; limited to a few vendors; little personal analytics. |
| **Whizlabs** | Practice tests plus hands-on labs; broad catalog; cheap. | Enterprise feel, little community; progress analytics are basic. |
| **MeasureUp** | Official Microsoft-authorized practice tests (vendor-reviewed). | Expensive; one-vendor focus. |
| **Udemy practice sets** | Cheap, huge variety. | Quality varies wildly by instructor; no cross-course progress view. |
| **Anki** (flashcards) | Best-in-class spaced repetition; tags; stats; add-on ecosystem (heatmaps, leech coaching). | Not exam-shaped: no timed exams, no domain blueprint, no readiness view. Heatmap/leech/stat features are mostly add-ons. |

**Key observation:** every product is either a *question bank* (no real personal analytics, no memory scheduling) or a *flashcard tool* (no exam simulation, no blueprint). **Nobody ties blueprint-weighted progress, mock exams, mistake analysis, and spaced repetition into one personal system.** That is the product.

What effective platforms have in common (consistent across sources): questions that match real exam style/difficulty; explanations for *every* option; coverage of the current exam version; multiple attempts to expose weak domains. Practice tests work best *after* initial learning, not as the first exposure.

Sources: [DEV: practice tests for AWS/Azure 2026](https://dev.to/bren67/best-practice-tests-for-aws-azure-in-2026-3h88) · [StudyKits AWS comparison](https://studykits-homepage.pages.dev/blog/compare/best-aws-certification-practice-apps-2026) · [MSCertQuiz vs MeasureUp vs Whizlabs](https://mscertquiz.com/blog/mscertquiz-vs-measureup-vs-whizlabs) · [Tutorials Dojo alternatives](https://studytech.ai/blog/best-tutorials-dojo-alternatives) · [Anki add-ons overview](https://toptut.com/top-10-anki-add-ons-boosting-productivity) *(vendor blogs — low-medium confidence)*

## 2. Learning science (what the app should actually do)

Primary reference: Dunlosky et al. (2013), *Improving Students' Learning With Effective Learning Techniques*, Psychological Science in the Public Interest 14(1), 4–58. Summary: [AFT PDF summary](https://es.aft.org/sites/default/files/dunlosky_0.pdf). **High-utility:** practice testing and distributed (spaced) practice. **Low-utility:** rereading, highlighting. Interleaving was rated moderate in the paper (secondary sources disagree — **verify**), but mixing domains in mock exams is how the real exam works anyway.

Design implications:
- **Make retrieval the default interaction** — questions and flashcards, not reading. Don't build a "notes reader" as a core feature.
- **Spaced + tested = "successive relearning"**: re-test items at expanding intervals until they stick. This is the FSRS flashcard/missed-question loop (F10, F11).
- **Mixed-domain practice** as a mode, not just per-domain drills.
- **Confidence ratings** on answers expose "lucky guesses" and "confidently wrong" (illusion of knowing) — cheap to add, high value (F03/F11).
- **Show effort, not just score** — heatmap/streak/time tracking support the habit that spacing requires (F14).

Sources: [Dunlosky summary](https://es.aft.org/sites/default/files/dunlosky_0.pdf) · [Notre Dame Kaneb Center](https://sites.nd.edu/kaneb/?p=1307) · [Firth on Dunlosky list](https://firth.substack.com/p/jonathan-firth-s-memory-metacognition-updates-15-dunlosky-et-al-s-list-of-strategies-1347143)

## 3. Spaced repetition algorithm

- **SM-2** (classic Anki): one number per card (ease factor). Simple, but dated.
- **FSRS**: models *difficulty, stability, retrievability* per card; open source; shipped as opt-in scheduler in Anki 23.10+. Blog claims of 20–30% fewer reviews at equal retention are vendor-sourced — **verify** against the [open-spaced-repetition benchmark](https://github.com/open-spaced-repetition) before quoting.
- **Recommendation:** use FSRS via the `ts-fsrs` TypeScript library (**verify** current version/API at implementation time). It lets us offer a "desired retention" slider and an **exam-date-aware** mode (compress intervals so material is fresh by exam day — Anki users do this with add-ons; we can build it in).

Sources: [SM-2 vs FSRS explainer](https://l-m-sherlock.notion.site/What-are-the-main-differences-between-SM-2-and-FSRS-135c250163a180ca9029ea460136254c) · [RemNote FSRS help](https://help.remnote.com/en/articles/9124137-the-fsrs-spaced-repetition-algorithm) · [FSRS in a driving-theory exam platform](https://dev.to/ketisdev/building-an-ai-powered-driving-theory-exam-platform-with-the-fsrs-algorithm-2nei) (closest real analog)

## 4. Anki features worth building in natively

Tags/hierarchical filtering by topic; cloze deletions; review heatmap; retention stats; **leech detection** (items repeatedly failed → needs a different approach, not more repetitions). Leech coaching and heatmaps are *add-ons* in Anki, so shipping them built-in is a differentiator.

## 5. Readiness score / adaptive testing

- Real exams use **Item Response Theory (IRT)** and computerized adaptive testing (CAT). These need *calibrated item parameters from large populations of test-takers* — not feasible for a single-user app or hand-written question bank.
- I found **no validated research on study-app "readiness scores" predicting real pass rates.** So: do not claim "92% chance to pass." Show a **blueprint-weighted accuracy estimate with a confidence band and a "not enough data" state**, labeled as an estimate (F12). This is honest and still very useful.
- Phase 3 option: simple per-user IRT-lite (Elo-style ability per domain) for adaptive question selection.

Sources: [CAT implementation issues (arXiv)](https://arxiv.org/pdf/1012.0042) · [ETS: pass probabilities on mastery tests](https://www.ets.org/research/policy_research_reports/publications/article/2021/kclv.html)

## 6. Question types

Real exams go beyond single-choice: **multiple-response** ("choose 2"), **ordering**, **matching**, **drag-and-drop**, **fill-in-the-blank**, and **performance-based questions (PBQs)** — simulations (e.g. CompTIA A+/Network+/Security+). PBQs may or may not give partial credit and often weigh more. I did not verify AWS's exact formats — **verify** per target exam from the official exam guide.

MVP: single-choice, multiple-response, true/false. Phase 2: ordering, matching, fill-in. Phase 3: simplified PBQ-style (drag-drop/matching "scenario" items); full simulations are out of scope.

Sources: [CompTIA: PBQs explained](https://www.comptia.org/en/blog/what-is-a-performance-based-question/) · [InfoSec Institute: Security+ PBQs](https://www.infosecinstitute.com/resources/securityplus/security-exam-information-performance-based-questions/)

## 7. Content sourcing — the biggest non-technical risk

- **Exam dumps/braindumps** (recalled real questions) are copyrighted/confidential under candidate NDAs; vendors (e.g. Microsoft) can revoke certifications of people who *use* them. Dumps are also frequently wrong. **This product must not ship, encourage, or import dumps.**
- Legitimate sources: (a) questions you write yourself from the **official exam blueprint/objectives**; (b) purchased/licensed banks you import for personal use (check license); (c) openly licensed material; (d) AI-drafted questions that you review.
- Good item-writing practice: derive from objectives; test application over recall; write a **rationale for every option**; one problem per stem; have a second person (or a later "cold" you) take it timed before trusting it.

Sources: [CBT Nuggets: dangers of exam dumps](https://www.cbtnuggets.com/blog/career/career-progression/the-dangers-of-exam-dumps) · [uCertify: problem with braindumps](https://www.ucertify.com/blog/the-problem-with-braindumps/) · [Neelim: how they write questions](https://www.neelim.com/exam-prep/how-we-write-questions) *(general information, not legal advice)*

## 8. AI-generated questions: useful but needs a review gate

A 2025 study of ChatGPT-generated USMLE-style practice quizzes found **49% of items had writing flaws and 22% had factual/conceptual errors**, though ~91% were a reasonable starting point *with expert supervision*. A cybersecurity benchmark needed 672 person-hours to manually vet 11,468 LLM questions. Multi-agent verification pipelines reduce hallucination but don't eliminate it.

→ **Design rule:** AI output goes into a **draft/review queue**, never straight into practice. Every AI question carries `source: ai-draft` until a human approves it; explanations should cite the objective/official doc where possible (F17).

Sources: [Drexel: LLM-generated practice quizzes](https://researchdiscovery.drexel.edu/esploro/outputs/journalArticle/LLM-Generated-Multiple-Choice-Practice-Quizzes-for/991022059818004721) · [Cybersecurity expert benchmark (arXiv 2504.11783)](https://arxiv.org/pdf/2504.11783) · [MCQG-SRefine (NAACL 2025)](https://preview.aclanthology.org/setup/2025.naacl-long.538) · [Multi-agent verification preprint](https://arxiv.org/pdf/2601.14280)

## 9. Tech findings

- **Framework:** Next.js has the bigger ecosystem; SvelteKit has smaller bundles and good DX. A **Vite + React SPA/PWA** keeps the client as the primary data store and needs no server in production — best fit for a study app that should work offline. ([PkgPulse comparison](https://www.pkgpulse.com/guides/nextjs-vs-sveltekit-2026) · [Meta-framework reference](https://knowledgebase-862.pages.dev/r/meta-frameworks) · [Vite PWA overview](https://alphabold.com/top-frameworks-and-tools-to-build-progressive-web-apps))
- **Sync (later):** PowerSync (SQLite on client, Postgres/Supabase backend) and ElectricSQL (Postgres-native) both exist; neither is drop-in with IndexedDB/Dexie. ([Electric alternatives](https://electric-sql.com/docs/reference/alternatives) · [PowerSync + Supabase](https://supabase.com/partners/powersync)) Search did not confirm Dexie-specific sync or Postgres-vs-SQLite tradeoffs — **verify** when we get to F16.
- **Our own insight:** if progress is stored as an **append-only event log** (every answer, every card review), syncing across devices is just merging logs — no conflict resolution needed. Design for this from day one (see architecture).

## 10. Ideas you didn't list that I recommend

Ranked roughly by value ÷ effort:

1. **Blueprint-weighted readiness estimate** with honest uncertainty (F12).
2. **Mistake notebook with error tagging** — "knowledge gap / misread / careless / guessed" — turns wrong answers into a study queue (F11).
3. **Confidence rating per answer** → calibration chart ("when you say 90% sure you're right 60% of the time").
4. **Exam-date-driven study plan** — enter date + hours/week → daily targets per domain (F13).
5. **Leech detection** and "try a different angle" prompts (F10).
6. **Timed mock exam that mimics the real one** — question count, time limit, flag-for-review, review screen, scaled-score display (F04).
7. **Study-time tracker + heatmap + streaks** (lightweight, not gimmicky) (F14).
8. **Resource tracker** — checklist for videos/courses/books/labs mapped to objectives (F15).
9. **Question-quality loop** — "report this question", track questions that most people (you) dispute, edit in place (F20).
10. **Certification lifecycle** — expiry dates, renewal/CEU tracking, so the app is useful *after* passing (F18).
11. **Anki import/export** (.apkg/CSV) so users aren't locked in and can bring existing decks (Phase 2).
12. **Exam-day checklist & score-report PDF** (small polish features, F21).
13. **Offline PWA** so you can drill on a plane/commute (F19).

## 11. Target exam: AWS Certified Cloud Practitioner (CLF-C02) — verified facts

Verified 2026-10-30 against the **official exam guide PDF** (footer: "Version 1.0 CLF-C02"), [AWS exam guide PDF](https://d1.awsstatic.com/training-and-certification/docs-cloud-practitioner/AWS-Certified-Cloud-Practitioner_Exam-Guide.pdf), and the [AWS certification page](https://aws.amazon.com/certification/certified-cloud-practitioner/).

- **Format:** 65 questions = **50 scored + 15 unscored** (unscored are not identified); multiple choice (1 correct, 3 distractors) and multiple response (2+ correct of 5+ options); **90 minutes**; 100 USD; Pearson VUE test center or online proctored. Unanswered = incorrect; **no guessing penalty**.
- **Scoring:** pass/fail; scaled **100–1,000, minimum passing 700**; *compensatory* (no per-domain minimum; section feedback is advisory). The raw-percentage equivalent is not published → the app's pass mark is a proxy.
- **Domains (scored content):** 1 Cloud Concepts 24% · 2 Security and Compliance 30% · 3 Cloud Technology and Services 34% · 4 Billing, Pricing, and Support 12%. 19 task statements total (4 + 4 + 8 + 3).
- **Out-of-scope job tasks:** coding, cloud architecture design, troubleshooting, implementation, load/performance testing → questions are recognition-level.
- **Version check:** CLF-C02 in use since 2023-09-19 (replaced C01). Search results mentioning a ~9% "generative AI domain" or a CLF-C03 came from dump/affiliate sites and are **not** supported by the official guide I read; re-check the AWS page before booking, since the guide could be revised. The AWS page says the exam in Italian and German retires after 2026-12-31.
- **Official free practice:** AWS Skill Builder offers a free 20-question official practice question set for CLF-C02; the full official practice exam needs a subscription (per AWS training pages; verify current terms). Source: [AWS Skill Builder CLF-C02 practice set](https://training.resources.awscloud.com/associate-certification-articles/updated-cloud-practitioner-exam-prep-course).
- **Seed data:** [`content/clf-c02/blueprint.json`](../content/clf-c02/blueprint.json) and [`in-scope-services.md`](../content/clf-c02/in-scope-services.md).
