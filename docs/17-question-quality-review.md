# 17 — Question quality review (2026-11-08)

You took 74 CLF-C02 questions on the live site and reported that many were too complicated, wrong, or written for a different version of the exam than the current one. This note explains what went wrong and the rules that now prevent it. The rules are written into `content/prompts/draft-questions.md`, the review step in `content/prompts/README.md`, and each pack's `style.md`.

## What went wrong

**1. The pack was built from an out-of-date copy of the exam guide.**
- **The update history.** AWS revises CLF-C02 in place: version 1.0 in June 2026, then 1.1, 1.2 and 1.3 on October 29, 2026. Each update takes effect about a month after it is published. The pack's `in-scope-services.md` and objective scopes came from an older CLF-C02 PDF.
- **What the current guide uses.** Business Support+, Enterprise Support and Unified Operations for support plans; Amazon SageMaker AI; Amazon Quick. It moves Billing Conductor, AWS Activate, AWS IQ, AMS, Wavelength, MemoryDB, CodeDeploy, AppConfig, CloudShell, CodeArtifact, Greengrass, Network Firewall and Transfer Family out of scope. It drops Kendra, Local Zones, the Snow Family, Audit Manager, Cloud9 and CodeCommit, and adds Amazon Q, Amazon Quick, DocumentDB, Service Quotas, PrivateLink, Transit Gateway and WorkSpaces Secure Browser.
- **The result:** a bank that mixed old and new names and plans, with questions on services the current exam no longer covers.

The first version of this note (earlier the same day) got the cause backwards. It said questions were "newer than the exam guide" and should use the old names. Checking the live guide showed the opposite: the guide is current, and the pack's copy of it was stale.

**2. Some questions went deeper than the guide asks.** Examples:
- The exact wording of Well-Architected design principles (the guide names the pillars and how they differ).
- Network ACL rule evaluation order.

Others that looked deep are named in the task statements and stay: Dedicated Hosts vs Dedicated Instances, Reserved Instance flexibility and sharing, Region-to-Region data transfer, and access reports.

**3. Explanations carried trivia:** rename dates, retirement dates and "the exam guide still says" notes.

None of your 16 misses had a wrong key. The checks caught wrong keys; what they missed was **fit to the current exam**.

## Rules from now on

1. **Check the guide's version before every content pass.**
   - Open the live guide (HTML) and its revisions page.
   - Transcribe the task statements and service lists from the current version.
   - Record the version and date in `blueprint.json`.
2. **The current guide decides names, scope and depth.** Use its service names and support plans exactly. Every service in a question, distractors included, is on its in-scope list. The pack's `outOfScopeTerms` lint enforces its out-of-scope list.
3. **Match the guide's verbs and target candidate.**
   - Foundational (CLF): up to 6 months of exposure; identify and recognize.
   - Associate (DVA): a short developer scenario solved by a well-known pattern.
   - Test what the task statements name. Leave out quotas, prices and mechanics they don't name.
4. **Explanations teach the decision:** the clue in the stem and how the answer differs from its nearest neighbor. No rename or retirement history.
5. **Questions are original and judged on their own merits** (correctness, clarity, teaching value), not on resemblance to real exam questions.

## Follow-up (2026-11-08)

The CLF-C02 pack now uses guide v1.3. That covers the blueprint sources and scopes, `in-scope-services.md`, `style.md` and the lint profile. The whole bank is going through a review against it.
