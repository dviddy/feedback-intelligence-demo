const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const scripts = ['data/demo-data.js', 'data/recurring-language.js', 'presentation.js', 'demo.js'];
const context = { window: {} };
for (const file of scripts.slice(0, 3)) vm.runInNewContext(read(file), context);
const fixture = context.window.FEEDBACK_DEMO_DATA;
const language = context.window.FEEDBACK_RECURRING_LANGUAGE;
const model = context.window.FEEDBACK_DEMO_PRESENTATION;
const project = scope => model.project(fixture, language, scope);
const range = (current, comparison = null) => ({ current, comparison });
const quarter = range(['2026-07-01', '2026-09-30'], ['2026-04-01', '2026-06-30']);
const ids = rows => rows.map(row => row.id);
const inPeriod = (row, dates) => !dates || row.date >= dates[0] && row.date <= dates[1];
function browser(mutate) {
  const dom = new JSDOM(read('index.html'), { url: 'https://dviddy.github.io/feedback-intelligence-demo/', runScripts: 'outside-only', pretendToBeVisual: true });
  const requests = [];
  dom.window.fetch = () => { requests.push('fetch'); throw new Error('Unexpected fetch'); };
  dom.window.XMLHttpRequest = class { constructor() { requests.push('xhr'); throw new Error('Unexpected xhr'); } };
  dom.window.WebSocket = class { constructor() { requests.push('websocket'); throw new Error('Unexpected websocket'); } };
  for (const file of scripts) {
    if (file === 'demo.js' && mutate) mutate(dom.window.FEEDBACK_DEMO_DATA);
    dom.window.eval(read(file));
  }
  const d = dom.window.document;
  d.getElementById('loadDemoButton').click();
  const change = (id, value) => { d.getElementById(id).value = value; d.getElementById(id).dispatchEvent(new dom.window.Event('change')); };
  const apply = () => d.getElementById('periodForm').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  const custom = (start, end) => { change('periodPreset', 'custom'); change('currentStart', start); change('currentEnd', end); apply(); };
  return { dom, d, requests, change, apply, custom };
}
test('Established identities and provisional Emerging memberships stay separate', () => {
  const p = project();
  assert.equal(p.establishedPresence.length, 16);
  assert.equal(p.emerging.length, 5);
  const emerging = new Set(fixture.emerging.map(row => row.name));
  assert.ok(p.established.every(row => !emerging.has(row.name)));
  assert.ok(p.emerging.every(row => emerging.has(row.name)));
  assert.equal(new Set([...p.established, ...p.emerging].flatMap(row => row.recordIds)).size, 663);
  assert.equal(fixture.records.length - 663, 537); // General feedback is not silently labeled withheld.
});
test('Needs More Evidence is unavailable without authored assignments, never a fabricated zero', () => {
  const p = project(); assert.equal(p.needsMoreEvidence.available, false); assert.equal(p.needsMoreEvidence.count, null);
  const { dom, d } = browser();
  const metric = d.querySelector('[data-metric="Needs More Evidence"]');
  assert.equal(metric.querySelector('.metric-value').textContent, 'Not available');
  assert.equal(metric.querySelectorAll('.evidence-action').length, 0);
  assert.match(d.getElementById('needsPanel').textContent, /not discarded feedback or confirmed trends/);
  assert.match(d.getElementById('needsPanel').textContent, /has not been reclassified/);
  dom.window.close();
});
test('Executive Summary reconciles every supported metric and distinct identity count', () => {
  for (const scope of [range(null), quarter, range(['2026-09-01', '2026-09-30']), range(['2026-04-01', '2026-04-01'])]) {
    const p = project(scope);
    const rows = fixture.records.filter(row => inPeriod(row, scope.current));
    assert.equal(p.summary.total, rows.length);
    for (const field of ['sentiment', 'effort', 'priority']) for (const [value, count] of Object.entries(p.summary[field]))
      assert.equal(count, rows.filter(row => row[field] === value).length);
    assert.equal(p.summary.established, new Set(rows.filter(row => row.trend && !fixture.emerging.some(e => e.name === row.trend)).map(row => row.trend)).size);
    assert.equal(p.summary.emerging, new Set(rows.filter(row => fixture.emerging.some(e => e.name === row.trend)).map(row => row.trend)).size);
  }
});
test('Concentration ranks two populations and excludes withheld/unassigned feedback', () => {
  const { dom, d } = browser(); d.querySelector('[data-visual="domains"]').click();
  const groups = d.querySelectorAll('.concentration-group'); assert.equal(groups.length, 2);
  assert.equal(groups[0].querySelector('h4').textContent, 'Established Trends');
  assert.equal(groups[1].querySelector('h4').textContent, 'Emerging Experiences');
  for (const group of groups) assert.ok(!group.querySelector('.chart-list').textContent.includes('Needs More Evidence'));
  assert.ok(!groups[0].textContent.includes('Digital Wallet Provisioning Failure'));
  dom.window.close();
});
test('Movement inherits stable identities and never compares Emerging groups', () => {
  const p = project(quarter);
  assert.equal(p.movement.length, 16);
  for (const row of p.movement) {
    assert.ok(row.kind === 'Established');
    assert.equal(row.currentCount, fixture.records.filter(r => inPeriod(r, quarter.current) && r.trend === row.name).length);
    assert.equal(row.comparisonCount, fixture.records.filter(r => inPeriod(r, quarter.comparison) && r.trend === row.name).length);
    assert.equal(row.id, project(range(['2026-09-01', '2026-09-30'])).identities.find(r => r.name === row.name).id);
    assert.equal(row.currentPrevalence, row.currentCount / 640);
    assert.equal(row.comparisonPrevalence, row.comparisonCount / 560);
  }
  assert.equal(p.movement.find(row => row.name === 'Branch Queue').label, 'No longer observed in selected current period');
});
test('All five descriptive movement states are supported without inventing missing observations', () => {
  const observed = new Set(project(quarter).movement.map(row => row.label));
  for (let day = 2; day <= 30; day++) {
    const date = `2026-09-${String(day).padStart(2, '0')}`;
    const prior = `2026-09-${String(day - 1).padStart(2, '0')}`;
    for (const row of project(range([date, date], [prior, prior])).movement) observed.add(row.label);
  }
  for (const label of ['Increasing', 'Decreasing', 'Stable', 'New in selected comparison window', 'No longer observed in selected current period']) assert.ok(observed.has(label), label);
});
test('All Data disables comparison; missing comparison feedback never claims stable or new', () => {
  assert.equal(project().movement.length, 0);
  const p = project(range(['2026-09-01', '2026-09-30'], ['2025-09-01', '2025-09-30']));
  assert.equal(p.comparisonAvailable, false); assert.equal(p.movement.length, 0);
  const { dom, d, custom } = browser();
  assert.equal(d.getElementById('compareEnabled').disabled, true);
  custom('2025-01-01', '2025-01-31'); d.querySelector('[data-visual="movement"]').click();
  assert.match(d.getElementById('visualCanvas').textContent, /Comparison is off/);
  dom.window.close();
});
test('Digital → Assisted preserves fixture eligibility and exact relationship evidence per period', () => {
  for (const scope of [range(null), quarter, range(['2026-09-01', '2026-09-30'])]) {
    const p = project(scope), rows = p.records;
    assert.equal(p.migration.eligible, rows.filter(r => r.eligibleDigital).length);
    assert.equal(p.migration.migrated, rows.filter(r => r.eligibleDigital && r.migratedTo).length);
    assert.equal(p.migration.origins.reduce((n, row) => n + row.eligible, 0), p.migration.eligible);
    assert.equal(p.migration.destinations.reduce((n, row) => n + row.migrated, 0), p.migration.migrated);
    assert.ok(p.migration.origins.every(row => row.migratedRecordIds.every(id => row.eligibleRecordIds.includes(id))));
  }
});
test('Recurring Language uses exact comments, three distinct records and current-only memberships', () => {
  for (const scope of [range(null), quarter, range(['2026-09-01', '2026-09-30']), range(['2026-09-01', '2026-09-01'])]) {
    const p = project(scope);
    for (const theme of p.recurringLanguage) {
      assert.ok(['Established', 'Emerging'].includes(theme.kind));
      for (const phrase of theme.phrases) {
        const expected = p.records.filter(row => row.trend === theme.name && row.text.toLowerCase().includes(phrase.phrase.toLowerCase()));
        assert.equal(phrase.count, new Set(phrase.recordIds).size); assert.ok(phrase.count >= 3);
        assert.deepEqual([...phrase.recordIds], [...ids(expected)]);
      }
    }
  }
});
test('Range boundaries are inclusive, deterministic and preserve immutable full fixture', () => {
  const saved = JSON.stringify(fixture);
  const dates = ['2026-09-01', '2026-09-30'];
  const a = project(range(dates)), b = project(range(dates));
  assert.equal(a.records.length, 230);
  assert.ok(a.records.some(row => row.date === dates[0])); assert.ok(a.records.some(row => row.date === dates[1]));
  assert.equal(JSON.stringify(a), JSON.stringify(b)); assert.equal(JSON.stringify(fixture), saved);
  assert.deepEqual([...model.previous(['2026-07-01', '2026-09-30'])], ['2026-03-31', '2026-06-30']);
});
test('30-day and 90-day presets anchor to fixture latest date, with correct record totals', () => {
  const { dom, d, change, apply } = browser();
  for (const [preset, start] of [['30', '2026-09-01'], ['90', '2026-07-03']]) {
    change('periodPreset', preset); apply();
    assert.equal(d.getElementById('currentStart').value, start);
    const expected = fixture.records.filter(row => row.date >= start).length;
    assert.equal(d.querySelector('[data-metric="Feedback Analyzed"] .metric-value').textContent, String(expected));
    assert.match(d.getElementById('activePeriod').textContent, new RegExp(start));
  }
  dom.window.close();
});
test('Custom dates reject overlaps and impossible dates while preserving reviewed results', () => {
  assert.throws(() => project(range(['2026-02-30', '2026-03-31'])), /valid dates/);
  assert.throws(() => project(range(['2026-09-30', '2026-09-01'])), /valid dates/);
  assert.throws(() => project(range(null, ['2026-04-01', '2026-06-30'])), /dated current/);
  const { dom, d, custom, change, apply } = browser(); custom('2026-09-01', '2026-09-30');
  d.getElementById('compareEnabled').checked = true;
  change('comparisonPreset', 'custom'); change('comparisonStart', '2026-09-01'); change('comparisonEnd', '2026-09-20'); apply();
  assert.equal(d.getElementById('dateError').hidden, false); assert.match(d.getElementById('dateError').textContent, /must not overlap/);
  assert.equal(d.querySelector('[data-metric="Feedback Analyzed"] .metric-value').textContent, '230');
  dom.window.close();
});
test('Every projected evidence population remains in current period except labeled comparison evidence', () => {
  for (const scope of [quarter, range(['2026-09-01', '2026-09-30']), range(['2026-04-01', '2026-04-01'])]) {
    const p = project(scope), allowed = new Set(ids(p.records));
    const populations = [...p.establishedPresence, ...p.emerging, ...p.recurringLanguage, ...p.recurringLanguage.flatMap(t => t.phrases),
      ...p.journeys.flatMap(j => j.stages), ...p.migration.destinations];
    for (const row of populations) assert.ok(row.recordIds.every(id => allowed.has(id)));
    for (const row of p.movement) {
      assert.ok(row.currentRecordIds.every(id => allowed.has(id)));
      assert.ok(row.comparisonRecordIds.every(id => fixture.records.some(r => r.id === id && inPeriod(r, scope.comparison))));
    }
  }
});
test('Date changes clear prior drilldowns, replace detailed pagination and reset journey selection', () => {
  const { dom, d, custom } = browser();
  d.querySelector('#trendsPanel .evidence-action').click();
  d.getElementById('feedbackToggle').click(); d.getElementById('moreFeedback').click();
  custom('2026-09-01', '2026-09-30');
  assert.equal(d.getElementById('evidencePanel').hidden, true); assert.equal(d.getElementById('evidenceList').children.length, 0);
  assert.equal(d.querySelectorAll('#feedbackList .feedback-card').length, 20);
  assert.ok([...d.querySelectorAll('#feedbackList .feedback-card')].every(card => card.textContent.includes('2026-09-')));
  assert.equal(d.getElementById('journeyDisplay').children.length, 0);
  d.querySelector('[data-visual="phrases"]').click();
  d.querySelector('.language-phrase').click();
  assert.ok([...d.querySelectorAll('#evidenceList .feedback-card')].every(card => card.textContent.includes('2026-09-')));
  dom.window.close();
});
test('Comparison drilldown explicitly switches evidence population and date context', () => {
  const { dom, d, change, apply } = browser(); change('periodPreset', 'q3');
  d.getElementById('compareEnabled').checked = true; change('comparisonPreset', 'q2'); apply();
  d.querySelector('[data-visual="movement"]').click(); d.querySelector('.movement-chart-row').click();
  assert.match(d.getElementById('evidenceContext').textContent, /2026-07-01/);
  assert.ok([...d.querySelectorAll('#evidenceList .feedback-card')].every(card => /2026-(07|08|09)-/.test(card.textContent)));
  d.querySelector('#evidenceChoices button:nth-child(2)').click();
  assert.match(d.getElementById('evidenceContext').textContent, /2026-04-01.*comparison/);
  assert.ok([...d.querySelectorAll('#evidenceList .feedback-card')].every(card => /2026-(04|05|06)-/.test(card.textContent)));
  dom.window.close();
});
test('Journey Mapping projects exact stage evidence and selected-period record measures', () => {
  const p = project(range(['2026-09-01', '2026-09-30']));
  for (const journey of p.journeys) {
    assert.equal(journey.supportingRecordCount, new Set(journey.stages.flatMap(stage => stage.recordIds)).size);
    for (const stage of journey.stages) {
      const rows = p.records.filter(row => stage.recordIds.includes(row.id));
      assert.equal(stage.negative, rows.filter(row => row.sentiment === 'Negative').length);
      assert.equal(stage.highEffort, rows.filter(row => row.effort === 'High').length);
      assert.equal(stage.highPriority, rows.filter(row => row.priority === 'High').length);
      assert.ok(stage.evidenceIds.every(id => stage.recordIds.includes(id)));
    }
  }
  const { dom, d, custom } = browser(); custom('2026-09-01', '2026-09-30');
  d.querySelector('.journey-choice').click(); d.querySelector('#journeyDisplay .evidence-action').click();
  assert.ok([...d.querySelectorAll('#evidenceList .feedback-card')].every(card => card.textContent.includes('2026-09-')));
  assert.match(d.getElementById('journeyDisplay').textContent, /not a reconstructed individual sequence/);
  dom.window.close();
});
test('Empty periods show polished absence states with no invented rate or evidence', () => {
  const { dom, d, custom } = browser(); custom('2025-01-01', '2025-01-31');
  assert.equal(d.querySelector('[data-metric="Feedback Analyzed"] .metric-value').textContent, '0');
  assert.equal(d.querySelector('[data-metric="Digital → Assisted"] .metric-value').textContent, '—');
  assert.match(d.getElementById('emergingPanel').textContent, /No Emerging Experiences/);
  assert.match(d.getElementById('migrationPanel').textContent, /rate is unavailable/);
  assert.match(d.getElementById('journeyPanel').textContent, /No journey evidence/);
  d.querySelector('[data-visual="phrases"]').click(); assert.match(d.getElementById('visualCanvas').textContent, /No recurring language meets/);
  d.querySelector('[data-metric="Feedback Analyzed"] .evidence-action').click();
  assert.equal(d.querySelectorAll('#evidenceList .feedback-card').length, 0);
  assert.ok(!/NaN|Infinity/.test(d.body.textContent)); dom.window.close();
});
test('New Analysis resets date scope and reloads a clean All Data view', () => {
  const { dom, d, custom } = browser(); custom('2026-09-01', '2026-09-30');
  d.getElementById('newAnalysisButton').click(); d.getElementById('loadDemoButton').click();
  assert.equal(d.getElementById('periodPreset').value, 'all');
  assert.equal(d.querySelector('[data-metric="Feedback Analyzed"] .metric-value').textContent, '1,200');
  assert.equal(d.getElementById('compareEnabled').checked, false); dom.window.close();
});
test('Safe text rendering treats malicious synthetic comment text as text', () => {
  const payload = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
  const { dom, d } = browser(data => { data.records[0].text = payload; });
  d.getElementById('feedbackToggle').click();
  assert.ok(d.querySelector('#feedbackList .feedback-card').textContent.includes(payload));
  assert.equal(d.querySelectorAll('#feedbackList img, #feedbackList script').length, 0);
  dom.window.close();
});
test('Static CSP blocks connections; no API, upload handler, persistence or private artifact enters runtime', () => {
  const html = read('index.html'); const runtime = scripts.map(read).join('\n');
  for (const directive of ["connect-src 'none'", "script-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'none'"]) assert.ok(html.includes(directive));
  assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|sessionStorage|indexedDB|\.files\b|FileReader|innerHTML/.test(runtime));
  for (const file of ['index.html', 'style.css', ...scripts]) assert.ok(!/\/Users\/|\/private\/|localhost|127\.0\.0\.1|OPENAI|sk-[\w-]{20,}|https?:\/\/|\.js\.map\b|sourceMappingURL/.test(read(file)), file);
  const { dom, d, requests, change, apply } = browser();
  for (const view of d.querySelectorAll('[data-visual]')) view.click();
  change('periodPreset', '30'); apply(); d.getElementById('newAnalysisButton').click();
  assert.deepEqual(requests, []); assert.equal(d.getElementById('datasetInput').disabled, true); dom.window.close();
});
test('Progressive disclosure bounds initial DOM and loads evidence and hidden charts only on demand', () => {
  const { dom, d } = browser();
  assert.equal(d.querySelectorAll('.feedback-card').length, 0);
  assert.ok(d.querySelectorAll('*').length < 1500);
  d.querySelector('[data-visual="phrases"]').click(); assert.equal(d.querySelectorAll('.language-row').length, 6);
  d.querySelector('.chart-more').click(); assert.ok(d.querySelectorAll('.language-row').length > 6);
  d.querySelector('.language-row .evidence-action').click(); assert.equal(d.querySelectorAll('#evidenceList .feedback-card').length, 20);
  dom.window.close();
});
test('Executive hierarchy places separate Journey Mapping before Detailed Feedback', () => {
  const { dom, d } = browser();
  const classes = [...d.querySelectorAll('#resultsExperience > section')].filter(el => /^(summary-section|visual-section|intelligence-section|journey-section|feedback-section)$/.test(el.className)).map(el => el.className);
  assert.deepEqual(classes, ['summary-section', 'visual-section', 'intelligence-section', 'journey-section', 'feedback-section']);
  dom.window.close();
});
test('Single-observation identities remain present but are excluded from recurring rankings', () => {
  const p = project(range(['2026-09-01', '2026-09-01']));
  const singles = p.establishedPresence.filter(row => row.count === 1);
  assert.ok(singles.length);
  assert.ok(singles.every(row => !p.established.some(r => r.id === row.id)));
  assert.equal(p.summary.established, p.establishedPresence.length);
  assert.ok(p.recurringLanguage.every(theme => theme.phrases.every(phrase => phrase.count >= 3)));
});
test('Eligible digital friction without assisted evidence shows an explicit zero-observation state', () => {
  const day = fixture.records.map(row => row.date).find(date => {
    const rows = fixture.records.filter(row => row.date === date);
    return rows.some(row => row.eligibleDigital) && !rows.some(row => row.migratedTo);
  });
  assert.ok(day);
  const { dom, d, custom } = browser(); custom(day, day);
  assert.match(d.getElementById('migrationPanel').textContent, /No validated assisted contact observed/);
  assert.equal(d.querySelector('[data-metric="Digital → Assisted"] .metric-value').textContent, '0.0%');
  dom.window.close();
});
test('No comparison feedback and no Emerging observations have distinct truthful empty states', () => {
  const { dom, d, custom, change, apply } = browser();
  custom('2026-09-01', '2026-09-30'); d.getElementById('compareEnabled').checked = true;
  change('comparisonPreset', 'custom'); change('comparisonStart', '2025-01-01'); change('comparisonEnd', '2025-01-31'); apply();
  d.querySelector('[data-visual="movement"]').click();
  assert.match(d.getElementById('visualCanvas').textContent, /No comparison data available/);
  assert.equal(d.querySelectorAll('.movement-chart-row').length, 0);
  const noEmergingDay = fixture.records.map(row => row.date).find(date => project(range([date, date])).emerging.length === 0);
  assert.ok(noEmergingDay);
  d.getElementById('compareEnabled').checked = false; custom(noEmergingDay, noEmergingDay);
  assert.match(d.getElementById('emergingPanel').textContent, /No Emerging Experiences/);
  dom.window.close();
});

test('Journey generation is explicit, static and resets for each selected opportunity', () => {
  const { dom, d, requests } = browser();
  assert.equal(d.querySelector('.journey-generate'), null);
  const choices = [...d.querySelectorAll('.journey-choice')];
  assert.equal(choices.length, 5);
  for (let i = 0; i < choices.length; i++) {
    choices[i].click();
    const action = d.querySelector('.journey-generate');
    const output = d.getElementById('generatedJourneyMap');
    assert.equal(action.tagName, 'BUTTON'); assert.equal(action.type, 'button');
    assert.equal(action.textContent, 'Generate Journey Map →');
    assert.equal(action.getAttribute('aria-expanded'), 'false');
    assert.equal(action.getAttribute('aria-controls'), output.id);
    assert.equal(output.hidden, true); assert.equal(output.children.length, 0);
    assert.ok(d.querySelector('#journeyDisplay .evidence-action'));
    action.focus(); assert.equal(d.activeElement, action);
    action.click();
    const journey = project().journeys[i];
    assert.equal(output.hidden, false);
    assert.equal(action.getAttribute('aria-expanded'), 'true');
    assert.equal(action.textContent, 'Journey Map Generated'); assert.equal(action.disabled, true);
    assert.ok(output.textContent.includes(journey.name));
    assert.deepEqual([...output.querySelectorAll('.journey-map-card > h4')].map(row => row.textContent), Array.from(journey.stages, stage => stage.label));
    assert.equal(output.querySelectorAll('.feedback-card').length, 0);
    assert.ok([...output.querySelectorAll('details')].every(detail => !detail.open));
    assert.equal(d.querySelector('#journeyDisplay [role="status"]').textContent, `${journey.name} current-state journey map is ready.`);
  }
  assert.deepEqual(requests, []); dom.window.close();
});
test('Generated journey evidence preserves exact selected-period membership and clears on switching', () => {
  const { dom, d, custom } = browser(); custom('2026-09-01', '2026-09-30');
  const journey = project(range(['2026-09-01', '2026-09-30'])).journeys[0];
  d.querySelector('.journey-choice').click(); d.querySelector('.journey-generate').click();
  const card = d.querySelector('.journey-map-card'); const details = card.querySelector('details'); details.open = true;
  card.querySelector('.evidence-action').click();
  const stage = journey.stages[0];
  assert.ok(d.getElementById('evidenceHeading').textContent.includes(stage.label));
  assert.ok([...d.querySelectorAll('#evidenceList .feedback-card')].every(row => {
    const id = row.querySelector('h3').textContent;
    return stage.recordIds.includes(id) && /2026-09-/.test(row.textContent);
  }));
  d.querySelectorAll('.journey-choice')[1].click();
  assert.equal(d.getElementById('evidencePanel').hidden, true);
  assert.equal(d.getElementById('generatedJourneyMap').hidden, true);
  custom('2026-07-01', '2026-09-30');
  assert.equal(d.querySelector('.journey-generate'), null);
  assert.equal(d.getElementById('generatedJourneyMap'), null);
  dom.window.close();
});
test('Generated map exposes only supported themes and record measures without inferred lifecycle or solutions', () => {
  const { dom, d } = browser();
  d.querySelector('.journey-choice').click(); d.querySelector('.journey-generate').click();
  const map = d.getElementById('generatedJourneyMap');
  assert.match(map.textContent, /not a reconstructed individual sequence/);
  assert.ok(!/Attempt Access|Enter Account|Complete Intended Task|Proposed Future-State Solution|Member Emotion|Owner/.test(map.textContent));
  for (const [i, card] of [...map.querySelectorAll('.journey-map-card')].entries()) {
    const stage = project().journeys[0].stages[i];
    assert.ok(card.textContent.includes(`${stage.recordIds.length} supporting records`));
    assert.ok(card.textContent.includes(`${stage.highEffort} high effort`));
    assert.ok(card.textContent.includes(`${stage.highPriority} high priority`));
  }
  assert.match(read('style.css'), /button:focus-visible/);
  dom.window.close();
});
