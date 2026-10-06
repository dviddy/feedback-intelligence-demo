# Feedback Intelligence — public demonstration

[Open the public demo](https://dviddy.github.io/feedback-intelligence-demo/) · [Public repository](https://github.com/dviddy/feedback-intelligence-demo)

A static executive product preview using **1,200 entirely synthetic, precomputed feedback records** dated April 1–September 30, 2026. There is no live analysis, API, backend, authentication, file upload or browser persistence. Single-comment and CSV entry controls are disabled.

**Load Demo Dataset** opens Executive Summary → Visual Intelligence → Experience Intelligence → Journey Mapping → Detailed Feedback. **New Analysis** clears the view and returns to All Data.

- Executive Summary reports feedback, sentiment, effort, priority, Established Trends, Emerging Experiences and Digital → Assisted. Experience counts describe distinct demo themes, not a partition of all feedback.
- Visual Intelligence includes Sentiment Mix, Experience Concentration, Trend Movement, Digital → Assisted and Recurring Language, with supporting synthetic comments.
- **Needs More Evidence is unavailable:** the dataset contains no validated assignments for this category. No count is invented.
- Date presets end at the latest synthetic date. Inclusive custom ranges and optional, non-overlapping comparisons update the dashboard and its evidence. Movement is descriptive, not a statistical significance or resolution claim.
- Digital → Assisted describes explicit assisted-contact relationships in eligible digital-friction comments, not all members or causal migration. Recurring Language uses curated exact wording supported by at least three selected-period comments.
- Journey Mapping presents five authored friction opportunities with evidence. The dataset does not establish individual journey sequences, owners, validated solutions or outcomes.

Evidence loads 20 comments at a time and is rendered as text. The site uses only bundled static assets; its Content Security Policy blocks connections, external scripts, forms and embedded objects. No runtime library is required.

## Development checks

Dependencies are test-only:

```sh
npm ci --ignore-scripts
npm test
```

The deterministic synthetic fixture generator is available through `npm run generate`; it changes `data/demo-data.js`. The current 1,200-record dataset has been retained unchanged.
