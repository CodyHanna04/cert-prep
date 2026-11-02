# Prompt: draft practice questions for one objective

Used two ways: by hand (paste into Claude or any model), and filled in automatically by the app's **Library → Coverage → Prompt** page. Placeholders look like `{{THIS}}`. Pass the model the vendor's in-scope services file for the exam as well (`content/<code>/in-scope-services.md`).

---

You are writing original practice questions for **{{EXAM_NAME}}** ({{EXAM_CODE}}).

**Objective {{OBJECTIVE_CODE}}: {{OBJECTIVE_TITLE}}**
Domain `{{DOMAIN_KEY}}`: {{DOMAIN_NAME}} ({{DOMAIN_WEIGHT}}% of the exam).
What the vendor says this objective covers:
{{SCOPE}}

**Write {{COUNT}} questions.** {{FORMAT_RULES}}

## Grounding (the most important rule)

- Base every question on the vendor's own published documentation. Open the page you are relying on and put its URL in `refs`. Only list a URL you actually opened in this session.
- If you are not sure of a fact, do not write that question. A shorter batch is better than a wrong one.
- Do not recall, imitate or reconstruct any real exam question, and do not use exam-dump or brain-dump material.
- Avoid facts that change often (prices, quotas, version numbers) unless the objective needs them. Where it does, cite the page.

## Style

{{STYLE}}

- Cover *distinct* sub-topics inside the objective. Do not write near-duplicates of each other or of the questions listed below.
- One problem per question, stated positively. Avoid NOT / EXCEPT.
- Distractors are real, in-scope things a half-informed candidate might pick. No joke options, no "all of the above" / "none of the above".
- Keep options similar in length and form. Do not let the correct answer be the longest. Avoid absolute words ("always", "never", "only") in options.
- Vary which option is correct across the batch.
- Every option gets a one-sentence rationale: why it is right, or what it actually is if it is wrong. Add a short `explanation`.

## Questions already in the bank for this objective

Do not repeat these.

{{EXISTING}}

## Output

A single JSON file, nothing else, in this shape (content format v1, see `docs/04-content-format.md`). Save it as `content/{{PACK_DIR}}/questions/{{OBJECTIVE_CODE}}-{{TODAY}}.json`.

- `id`: `{{ID_PREFIX}}-NN`, numbered from {{START_NUMBER}}.
- `domain`: `{{DOMAIN_KEY}}`, `objective`: `{{OBJECTIVE_CODE}}`.
- `source`: `ai-draft`, `reviewStatus`: `draft`, `generator`: your model id, `generatedAt` and `lastVerified`: `{{TODAY}}`.
- `difficulty` 1 to 5, `tags` lowercase-kebab, `refs` https URLs.

```json
{
  "formatVersion": 1,
  "questions": [
    {
      "id": "{{ID_PREFIX}}-01",
      "domain": "{{DOMAIN_KEY}}",
      "objective": "{{OBJECTIVE_CODE}}",
      "type": "single",
      "stem": "Under the AWS shared responsibility model, which task is the customer's responsibility for Amazon EC2 instances?",
      "options": [
        { "text": "Applying guest operating system patches", "correct": true, "rationale": "The customer manages the guest OS and everything above it." },
        { "text": "Physical security of data centers", "correct": false, "rationale": "AWS secures the facilities." },
        { "text": "Replacing failed host hardware", "correct": false, "rationale": "AWS maintains the underlying hardware." },
        { "text": "Operating the hypervisor", "correct": false, "rationale": "AWS manages virtualization." }
      ],
      "explanation": "Security OF the cloud is AWS's; security IN the cloud is the customer's.",
      "difficulty": 2,
      "tags": ["shared-responsibility"],
      "refs": ["https://aws.amazon.com/compliance/shared-responsibility-model/"],
      "source": "ai-draft",
      "reviewStatus": "draft",
      "generator": "{{MODEL}}",
      "generatedAt": "{{TODAY}}",
      "lastVerified": "{{TODAY}}"
    }
  ]
}
```

The example only shows the shape. Replace it entirely with questions for the objective above.

When you finish, run `npm run content:lint` and fix every error. Then run the blind check described in `content/prompts/README.md`.
