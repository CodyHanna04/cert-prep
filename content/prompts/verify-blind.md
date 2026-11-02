# Prompt: blind verification of a drafted batch

Run this in a **separate** model session from the one that drafted the questions. The point is independence: this session must not have seen the answer key.

---

Below is a JSON file of multiple-choice questions for a certification exam. Answer each question using only your own knowledge.

- `single` questions have exactly one correct option. `multi` questions have more than one; the stem says how many to choose.
- Reply with one JSON object and nothing else, mapping each question id to the letters of the options you choose, for example `{ "q-001": ["b"], "q-002": ["a", "d"] }`.
- Answer every question. If you are unsure, give your best answer anyway; do not skip and do not explain.

(Then paste the contents of the `*.blind.json` file.)

---

Save the reply as `<batch>.answers.json` next to the batch, then:

```bash
npm run content:check -- content/<pack>/questions/<batch>.json content/<pack>/questions/<batch>.answers.json --write
```

Any question the verifier answered differently (or skipped) gets `needsAttention: true`, which the review queue shows. A disagreement means the key may be wrong, the stem may be ambiguous, or two options may both be defensible: read those ones slowly.
