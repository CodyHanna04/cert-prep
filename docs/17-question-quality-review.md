# 17 — Question quality review (2026-11-08)

You took 74 CLF-C02 questions on the live site and reported that many were too complicated for the exam, wrong, or more up to date than the exam material. This note explains what went wrong in drafting and review, and the rules that now prevent it. The rules are written into `content/prompts/draft-questions.md` and each pack's `style.md`.

## What went wrong

**1. The source checks pulled questions toward today's AWS, not the exam's AWS.** The CLF-C02 exam guide dates from 2023. The source-check agents compared each question with the current docs, and every difference got "fixed" toward the current docs. Twelve questions ended up teaching facts the exam will never ask:
- New support plans: Business Support+ and Unified Operations replace the guide's Developer, Business and Enterprise On-Ramp plans.
- Renames: SageMaker AI, AWS Transform MGN, WorkSpaces Applications.
- Closures with dates: Application Discovery Service, AMS Advanced.

The real exam uses the guide's names and plans. Mixing in the new ones made distractors look right and correct answers look wrong. The support-plan question you missed is an example: Business Support+ was listed as an option.

**2. Some questions went deeper than a recognition exam.** The CLF style guide says "identify, recognize, describe", but some questions asked for detail the exam doesn't test:
- The exact wording of Well-Architected design principles (1.2-15, which took you 5½ minutes).
- Shared controls from the compliance whitepaper (2.1-05).
- Network ACL rule evaluation order (2.4-14).
- IAM last-accessed information (2.3-17).
- Data-transfer pricing cases (4.1-09).

Most of these were tagged difficulty 3, a level a foundational exam rarely reaches.

**3. Explanations carried trivia.** Rename dates, end-of-support dates and "closed to new customers" notes added reading without helping anyone pass.

**4. Distractors outside the exam's service list,** for example AWS DataSync on CLF-C02.

None of your 16 misses had a wrong key. The checks caught wrong keys; what they missed was **fit to the exam**.

## Rules from now on

1. **The exam guide is the source of truth for names, plans and scope.** Use the guide's service names, even when AWS has since renamed them. A fact changed after the guide's date is left out of the question rather than updated. Current docs confirm that a fact is correct; they don't change what the exam asks.
2. **Match the guide's verbs and the official sample questions' depth.**
   - Foundational (CLF): name the service or concept.
   - Associate (DVA): a short developer scenario solved by a well-known pattern.
   - Neither tests quotas, prices, rule-evaluation trivia or principle wording.
3. **Explanations teach the decision, not the history.** No rename dates, retirement dates or "closed to new customers" notes.
4. **Every service in a question is on the guide's in-scope list,** distractors included. The pack's `outOfScopeTerms` lint enforces the guide's out-of-scope list.
5. **Source checks report two separate things:** "wrong for the exam" (a key or fact error) and "differs from current docs" (ignore it if the guide's version still holds).

## CLF-C02 follow-up

- The 12 questions with post-guide wording should go back to the guide's names and plans: 1.3-11, 1.3-12, 3.1-13, 3.7-01, 3.7-02, 3.7-10, 3.8-06, 3.8-12, 4.3-01, 4.3-02, 4.3-03, 4.3-04.
- The difficulty-3 questions should be simplified or replaced.
- Add the post-guide names to CLF's `outOfScopeTerms` so the lint catches them.
