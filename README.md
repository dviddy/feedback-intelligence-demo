# Feedback Intelligence — Product Demo

A static executive product preview using 1,200 entirely synthetic feedback records dated April 1–September 30, 2026. Visitors first see the product's single-comment, CSV dataset and demo-dataset entry choices. The comment and CSV controls are visibly unavailable in this static demo; **Load Demo Dataset** opens the precomputed results without reading a customer file or making a network request. **New Analysis** returns to the start screen. The five executive measures, trend movement, taxonomy coverage candidates, migration figures, journey evidence, chart values, and 12 exact key phrases are precomputed from the included fixture. It has no live analysis, provider calls, backend, authentication, or persistence.

The results flow from Executive Summary to Visual Intelligence, Experience Intelligence, then Detailed Feedback. Visual Intelligence is expanded when the demo dataset loads and can be hidden manually; it includes sentiment, primary Experience Taxonomy domain, movement, digital-to-assisted, and Recurring Language views. Recurring Language ranks the 21 existing experience groups by distinct supporting comments and shows the top six first. Each group links to its full semantic record population; its smaller exact-language chips link only to comments containing that wording. The 12 exact Key Phrases remain in the fixture, and `data/recurring-language.js` adds curated fragments found in the synthetic comments. Phrase counts and record references are recalculated from those comments. Selecting a chart row or an evidence action opens the same supporting-feedback panel. Period and migration selections distinguish their record sets; comments load 20 at a time. The theme, phrase, and evidence structure can later support an executive report without adding report export here.

The browser loads only `index.html`, `style.css`, `data/demo-data.js`, `data/recurring-language.js`, and `demo.js`. Open the site from a static web server; GitHub Pages serves the same files from the repository root. Asset paths are relative so the site works at `/feedback-intelligence-demo/`. The synthetic fixture is authored in `scripts/voice-library.mjs` and `scripts/voice-endings.mjs`, then built by `scripts/generate-data.mjs`. Openings and endings vary by experience and sentiment, and migration comments describe their assisted destination. Deterministic tests check duplicates and repeated first and last wording. Analytical record fields stay fixed while comments are regenerated.

For a local preview:

```sh
python3 -m http.server 8000
```

Then open `http://127.0.0.1:8000/`.

To regenerate the deterministic synthetic fixture and run the public demo checks:

```sh
npm install
npm run generate
npm test
```

`npm run generate` changes only `data/demo-data.js`. The public demo deliberately displays at most 20 additional Detailed Feedback or drill-down cards per click. No PDF export or Emerging Momentum feature is included.
