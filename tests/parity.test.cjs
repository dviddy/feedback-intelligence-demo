const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const scripts = ['data/demo-data.js', 'data/recurring-language.js', 'presentation.js', 'data/journey-provenance.js', 'journey-model.js', 'executive-report-pdf.js', 'executive-report-adapter.js', 'demo.js'];
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
    assert.equal(action.textContent, 'Generate Friction Map →');
    assert.equal(action.getAttribute('aria-expanded'), 'false');
    assert.equal(action.getAttribute('aria-controls'), output.id);
    assert.equal(output.hidden, true); assert.equal(output.children.length, 0);
    assert.ok(d.querySelector('#journeyDisplay .evidence-action'));
    action.focus(); assert.equal(d.activeElement, action);
    action.click();
    const journey = project().journeys[i];
    assert.equal(output.hidden, false);
    assert.equal(action.getAttribute('aria-expanded'), 'true');
    assert.equal(action.textContent, 'Friction Map Generated'); assert.equal(action.disabled, true);
    assert.ok(output.textContent.includes(journey.name));
    assert.deepEqual([...output.querySelectorAll('.journey-map-stage > h4')].map(row => row.textContent), Array.from(journey.stages, stage => stage.label));
    assert.equal(output.querySelectorAll('.feedback-card').length, 0);
    assert.ok([...output.querySelectorAll('details')].every(detail => !detail.open));
    assert.equal(d.querySelector('#journeyDisplay [role="status"]').textContent, `${journey.name} current-state journey friction map is ready.`);
  }
  assert.deepEqual(requests, []); dom.window.close();
});
test('Generated journey evidence preserves exact selected-period membership and clears on switching', () => {
  const { dom, d, custom } = browser(); custom('2026-09-01', '2026-09-30');
  const journey = project(range(['2026-09-01', '2026-09-30'])).journeys[0];
  d.querySelector('.journey-choice').click(); d.querySelector('.journey-generate').click();
  const card = d.querySelector('.journey-map-matrix tbody tr:last-child td'); const details = card.querySelector('details'); details.open = true;
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
  assert.ok(!/Attempt Access|Enter Account|Complete Intended Task|Proposed Future-State Solution|Owner/.test(map.textContent));
  const stages = project().journeys[0].stages;
  for (const [i, stage] of stages.entries()) {
    assert.ok(map.querySelectorAll('.journey-map-stage')[i].textContent.includes(`${stage.recordIds.length} supporting records`));
    assert.ok(map.querySelectorAll('tbody tr')[2].querySelectorAll('td')[i].textContent.includes(`High · ${stage.highEffort} records`));
    assert.ok(map.querySelectorAll('tbody tr')[3].querySelectorAll('td')[i].textContent.includes(`High · ${stage.highPriority} records`));
  }
  assert.match(read('style.css'), /button:focus-visible/);
  dom.window.close();
});

test('Visual journey matrix has semantic rows, supported values and accessible overflow', () => {
  const { dom, d, requests } = browser();
  d.querySelector('.journey-choice').click();
  assert.equal(d.querySelector('.journey-map-matrix'), null);
  d.querySelector('.journey-generate').click();
  const region = d.querySelector('.journey-map-scroll');
  assert.equal(region.tabIndex, 0); assert.equal(region.getAttribute('role'), 'region');
  region.focus(); assert.equal(d.activeElement, region);
  const table = region.querySelector('table');
  assert.ok(table.querySelector('caption'));
  assert.deepEqual([...table.querySelectorAll('tbody th')].map(cell => cell.textContent), ['Pain Point', 'Touchpoint / Channel', 'Member Effort', 'Priority', 'Current-State Insight', 'Supporting Evidence']);
  assert.ok([...table.querySelectorAll('thead th')].every(cell => cell.scope === 'col'));
  assert.ok([...table.querySelectorAll('tbody th')].every(cell => cell.scope === 'row'));
  assert.equal(table.querySelector('tbody tr:nth-child(2) td').textContent, 'Online Banking');
  assert.ok(!/Member Action|Member Emotion|Owner \/ Assignment|Proposed Future-State Solution/.test(table.textContent));
  assert.match(read('style.css'), /overflow-x:auto/);
  assert.match(read('style.css'), /journey-map-scroll:focus-visible/);
  assert.deepEqual(requests, []); dom.window.close();
});

test('All five journey outputs are evidence-backed friction maps with no directional lifecycle implication', () => {
  const { dom, d, requests } = browser();
  const journeys = project().journeys;
  for (const [i, choice] of [...d.querySelectorAll('.journey-choice')].entries()) {
    choice.click();
    assert.equal(d.querySelector('.journey-generate').textContent, 'Generate Friction Map →');
    d.querySelector('.journey-generate').click();
    const map = d.getElementById('generatedJourneyMap');
    assert.equal(map.querySelector('h4').textContent, `${journeys[i].name} — Current-State Journey Friction Map`);
    assert.ok(!/→|←|complete journey|end-to-end|full member journey/i.test(map.textContent));
    assert.equal(map.querySelectorAll('[aria-flowto]').length, 0);
    const cells = [...map.querySelectorAll('tbody tr:last-child td')];
    for (const [n, stage] of journeys[i].stages.entries()) {
      assert.ok(stage.recordIds.length > 0);
      assert.ok(stage.evidenceIds.length > 0);
      assert.ok(stage.recordIds.every(id => fixture.records.some(row => row.id === id)));
      assert.ok(stage.evidenceIds.every(id => stage.recordIds.includes(id)));
      assert.ok(cells[n].querySelector('.evidence-action'));
      assert.ok(!('sequence' in stage || 'order' in stage || 'memberAction' in stage || 'memberEmotion' in stage || 'owner' in stage || 'futureStateSolution' in stage));
    }
  }
  assert.deepEqual(requests, []); dom.window.close();
});

test('Top 3 and Top 5 select highest distinct current-period experiences before eligibility checks', () => {
  const { dom, d, change, apply } = browser();
  const expected = scope => [...project(scope).established, ...project(scope).emerging.filter(row => row.count >= 2)]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const shown = () => [...d.querySelectorAll('.pain-point-candidate')].map(row => row.dataset.experience);
  const controls = [...d.querySelectorAll('.journey-modes button')];
  assert.deepEqual(controls.map(row => row.textContent), ['Top 3 Pain Points', 'Top 5 Pain Points', 'Select Your Own']);
  assert.equal(controls[0].getAttribute('aria-pressed'), 'true');
  assert.deepEqual(shown(), Array.from(expected().slice(0, 3), row => row.name));
  assert.equal(d.querySelector('.pain-point-generate').textContent, 'Generate 2 Journey Maps →');
  controls[1].click(); assert.deepEqual(shown(), Array.from(expected().slice(0, 5), row => row.name));
  assert.equal(d.querySelector('.pain-point-generate').textContent, 'Generate 3 Journey Maps →');
  for (const row of expected()) assert.equal(row.count, new Set(row.recordIds).size);
  change('periodPreset', '30'); apply();
  assert.equal(d.querySelector('.journey-modes button').getAttribute('aria-pressed'), 'true');
  assert.deepEqual(shown(), Array.from(expected(range(['2026-09-01', '2026-09-30'])).slice(0, 3), row => row.name));
  dom.window.close();
});
test('Custom picker includes both statuses, filters locally and enforces five selections', () => {
  const { dom, d, requests } = browser();
  d.querySelectorAll('.journey-modes button')[2].click();
  assert.ok(d.querySelector('.pain-point-list').textContent.includes('Established Trends'));
  assert.ok(d.querySelector('.pain-point-list').textContent.includes('Emerging Experiences'));
  assert.ok(!d.querySelector('.pain-point-list').textContent.includes('Needs More Evidence'));
  const checkboxes = [...d.querySelectorAll('.pain-point-list input[type=checkbox]')];
  checkboxes[0].click(); assert.equal(d.querySelector('.pain-point-generate').textContent, 'Generate 1 Journey Map →');
  for (const checkbox of checkboxes.slice(1, 5)) checkbox.click();
  assert.equal(d.getElementById('journeySelectionCount').textContent, 'Selected: 5 of 5');
  assert.equal(d.querySelector('.pain-point-generate').textContent, 'Generate 3 Journey Maps →');
  assert.ok(checkboxes.slice(5).every(input => input.disabled));
  checkboxes[5].click(); assert.equal(d.querySelectorAll('.pain-point-list input:checked').length, 5);
  checkboxes[0].click(); assert.equal(checkboxes[5].disabled, false);
  const filter = d.querySelector('input[type=search]'); filter.value = 'Biometric'; filter.dispatchEvent(new dom.window.Event('input'));
  assert.equal(d.querySelectorAll('.pain-point-candidate').length, 1);
  assert.equal(d.querySelector('.pain-point-candidate').dataset.experience, 'Biometric Authentication Failure');
  assert.equal(d.getElementById('journeySelectionCount').textContent, 'Selected: 4 of 5');
  assert.deepEqual(requests, []); dom.window.close();
});
test('Mode switching clears previous friction output, evidence and custom selections', () => {
  const { dom, d } = browser();
  d.querySelector('.journey-choice').click(); d.querySelector('.journey-generate').click();
  d.querySelector('#generatedJourneyMap .evidence-action').click();
  d.querySelectorAll('.journey-modes button')[2].click();
  assert.equal(d.getElementById('generatedJourneyMap'), null);
  assert.equal(d.getElementById('evidencePanel').hidden, true);
  d.querySelector('.pain-point-list input').click();
  d.querySelectorAll('.journey-modes button')[0].click();
  d.querySelectorAll('.journey-modes button')[2].click();
  assert.equal(d.querySelectorAll('.pain-point-list input:checked').length, 0);
  dom.window.close();
});
test('Unsupported pain-point journeys remain unavailable and evidence never crosses experiences or dates', () => {
  const { dom, d, custom, requests } = browser(); custom('2026-09-01', '2026-09-30');
  assert.equal(d.querySelector('.pain-point-generate').disabled, false);
  for (const candidate of d.querySelectorAll('.pain-point-candidate')) {
    if (candidate.dataset.experience === 'Unexpected Fee') {
      assert.match(candidate.textContent, /Insufficient Journey Evidence/);
      assert.match(candidate.textContent, /Not enough interaction evidence to construct a reliable journey/);
    } else assert.match(candidate.textContent, /Journey Supported/);
    candidate.querySelector('.evidence-action').click();
    const cards = [...d.querySelectorAll('#evidenceList .feedback-card')]; assert.ok(cards.length > 0);
    assert.ok(cards.every(card => {
      const record = fixture.records.find(row => row.id === card.querySelector('h3').textContent);
      return record.trend === candidate.dataset.experience && inPeriod(record, ['2026-09-01', '2026-09-30']);
    }));
  }
  d.querySelectorAll('.journey-modes button')[2].click();
  const fee = [...d.querySelectorAll('.pain-point-candidate')].find(row => row.dataset.experience === 'Unexpected Fee');
  fee.querySelector('input').click(); assert.equal(d.querySelector('.pain-point-generate').disabled, true);
  d.querySelector('.pain-point-generate').click();
  assert.equal(d.querySelector('.member-journey'), null);
  assert.deepEqual(requests, []); dom.window.close();
});

test('Five newly authored synthetic journeys have exact stage provenance, linked episodes and precomputed summaries', () => {
  const c = { window: {} }; vm.runInNewContext(read('data/journey-provenance.js'), c);
  const f = c.window.FEEDBACK_JOURNEY_PROVENANCE;
  assert.equal(f.records.length, 150); assert.equal(f.journeys.length, 5);
  assert.equal(new Set(f.records.map(row => row.id)).size, 150);
  assert.equal(new Set(f.records.map(row => row.text)).size, 150);
  for (const journey of f.journeys) {
    assert.equal(journey.stages.length, 5);
    assert.ok(fixture.records.some(row => row.trend === journey.painPoint));
    const rows = f.records.filter(row => row.painPointId === journey.painPointId);
    assert.equal(rows.length, 30);
    for (const [i, stage] of journey.stages.entries()) {
      assert.equal(stage.sequence, i + 1); assert.equal(stage.recordIds.length, 6);
      const stageRows = rows.filter(row => stage.recordIds.includes(row.id));
      assert.equal(stageRows.length, 6);
      for (const row of stageRows) {
        assert.equal(row.stageId, stage.stageId); assert.equal(row.stageSequence, i + 1);
        assert.equal(row.memberAction, stage.memberAction); assert.equal(row.painPoint, journey.painPoint);
        assert.equal(row.status, journey.status); assert.equal(row.provenance, 'authored-synthetic-journey-v1');
        assert.ok(inPeriod(row, ['2026-04-01', '2026-09-30']));
        assert.ok(!fixture.records.some(record => record.id === row.id || record.text === row.text));
      }
      for (const field of ['sentiment', 'effort', 'priority']) for (const [label, count] of Object.entries(stage[field])) {
        assert.equal(count, stageRows.filter(row => row[field] === label).length);
      }
      assert.ok(stage.memberAction && stage.currentStateObservation);
      assert.ok(!('owner' in stage || 'futureStateSolution' in stage || 'emotion' in stage));
    }
    for (const episode of new Set(rows.map(row => row.episodeId))) {
      const ordered = rows.filter(row => row.episodeId === episode).sort((a, b) => a.stageSequence - b.stageSequence);
      assert.equal(ordered.length, 5);
      assert.ok(ordered.every((row, i) => i === 0 || ordered[i - 1].date === row.date));
    }
  }
});
test('Journey date projection preserves minimum stage support and counts without changing main analysis', () => {
  const { dom, d, change, apply } = browser();
  const f = dom.window.FEEDBACK_JOURNEY_PROVENANCE; const model = dom.window.FEEDBACK_JOURNEY_MODEL;
  const all = model.project(f); assert.equal(all.journeys.filter(row => row.supported).length, 5);
  const sep = model.project(f, ['2026-09-01', '2026-09-30']);
  assert.ok(sep.journeys.every(row => row.supported && row.count === 15 && row.stages.every(stage => stage.recordIds.length === 3)));
  const q2 = model.project(f, ['2026-04-01', '2026-06-30']); assert.ok(q2.journeys.every(row => !row.supported));
  assert.equal(fixture.records.length, 1200); assert.equal(project().summary.total, 1200);
  change('periodPreset', '30'); apply(); assert.match(d.getElementById('activeTotal').textContent, /230/);
  assert.equal(project().summary.sentiment.Negative, 468);
  dom.window.close();
});
test('Top modes preserve ranking and generate independent supported maps without replacing unavailable candidates', () => {
  const { dom, d, requests } = browser();
  assert.equal(d.querySelector('.pain-point-generate').disabled, false);
  d.querySelector('.pain-point-generate').click();
  assert.deepEqual([...d.querySelectorAll('.member-journey')].map(row => row.dataset.painPoint), ['Login Failure', 'Service Wait Time']);
  assert.match(d.getElementById('painPointJourneyOutput').textContent, /Unexpected Fee: Journey unavailable/);
  assert.match(d.getElementById('painPointJourneyOutput').textContent, /60 supporting synthetic journey records/);
  assert.equal(d.querySelector('.member-journey').open, true); assert.equal(d.querySelectorAll('.member-journey')[1].open, false);
  d.querySelectorAll('.journey-modes button')[1].click(); assert.equal(d.querySelectorAll('.member-journey').length, 0);
  d.querySelector('.pain-point-generate').click();
  assert.deepEqual([...d.querySelectorAll('.member-journey')].map(row => row.dataset.painPoint), ['Login Failure', 'Service Wait Time', 'Card Decline']);
  assert.deepEqual(requests, []); dom.window.close();
});
test('Custom supported Established and Emerging selection produces accurate independent journey rows', () => {
  const { dom, d } = browser(); d.querySelectorAll('.journey-modes button')[2].click();
  for (const name of ['Password Reset Failure', 'Transfer Recipient Setup Failure']) {
    const card = [...d.querySelectorAll('.pain-point-candidate')].find(row => row.dataset.experience === name);
    assert.match(card.textContent, /Journey Supported/); card.querySelector('input').click();
  }
  d.querySelector('.pain-point-generate').click();
  const maps = [...d.querySelectorAll('.member-journey')]; assert.equal(maps.length, 2);
  assert.match(d.getElementById('painPointJourneyOutput').textContent, /1 Established · 1 Emerging/);
  for (const map of maps) {
    assert.equal(map.querySelectorAll('thead [data-stage]').length, 5);
    assert.deepEqual([...map.querySelectorAll('tbody th')].map(row => row.textContent), ['Member Action', 'Touchpoint / Channel', 'Member Sentiment', 'Member Effort', 'Priority', 'Supporting Evidence']);
    assert.ok(!/Owner|Future-State|Member Emotion/.test(map.textContent));
    assert.ok(map.textContent.includes('Stage 1 →'));
  }
  dom.window.close();
});
test('Journey stage drilldown contains only authored records for its selected pain point, stage and period', () => {
  const { dom, d, custom } = browser(); custom('2026-09-01', '2026-09-30');
  d.querySelector('.pain-point-generate').click();
  d.querySelector('.member-journey .evidence-action').click();
  const cards = [...d.querySelectorAll('#evidenceList .feedback-card')]; assert.equal(cards.length, 3);
  assert.ok(cards.every(card => {
    const row = dom.window.FEEDBACK_JOURNEY_PROVENANCE.records.find(row => row.id === card.querySelector('h3').textContent);
    return row.painPoint === 'Login Failure' && row.stageSequence === 1 && inPeriod(row, ['2026-09-01', '2026-09-30']);
  }));
  assert.match(d.getElementById('evidenceContext').textContent, /separate from analysis totals/);
  custom('2026-07-01', '2026-09-30'); assert.equal(d.getElementById('painPointJourneyOutput').children.length, 0);
  assert.equal(d.getElementById('evidencePanel').hidden, true);
  dom.window.close();
});

test('Section navigation opens recurring language and exposes the synthetic methodology', () => {
  const { dom, d, requests } = browser();
  const recurring = d.querySelector('[data-section-visual="phrases"]');
  recurring.click();
  assert.equal(d.getElementById('visualPanel').hidden, false);
  assert.equal(d.querySelector('[data-visual="phrases"]').getAttribute('aria-pressed'), 'true');
  assert.ok(d.querySelectorAll('.language-row').length > 0);
  assert.equal(recurring.getAttribute('aria-current'), 'location');
  const about = d.querySelector('.section-nav a[href="#aboutHeading"]');
  about.click();
  assert.equal(about.getAttribute('aria-current'), 'location');
  assert.equal(recurring.hasAttribute('aria-current'), false);
  const methodology = d.querySelector('[aria-labelledby="aboutHeading"]');
  assert.match(methodology.textContent, /1,200 precomputed synthetic feedback records/);
  assert.match(methodology.textContent, /150 authored synthetic stage records/);
  assert.match(methodology.textContent, /do not change analysis totals or rankings/);
  assert.match(methodology.textContent, /no live analysis requests/);
  assert.deepEqual(requests, []);
  dom.window.close();
});

test('Journey workspace reuses the date form and restores other sections without rewriting their content', () => {
  const { dom, d, requests, change, apply } = browser();
  const dates = d.querySelector('.date-controls'), form = d.getElementById('periodForm');
  const otherSections = ['.summary-section', '.visual-section', '.intelligence-section', '.feedback-section', '.about-section'];
  const before = otherSections.map(selector => d.querySelector(selector).innerHTML);
  const journeyLink = d.querySelector('.section-nav a[href="#journeySectionHeading"]'); journeyLink.click();
  assert.ok(d.getElementById('resultsExperience').classList.contains('journey-workspace'));
  assert.equal(d.getElementById('journeyDateSlot').firstElementChild, dates);
  assert.equal(d.querySelectorAll('#periodForm').length, 1); assert.equal(d.getElementById('periodForm'), form);
  assert.equal(d.getElementById('journeyPanel').hidden, false);
  assert.equal(journeyLink.getAttribute('aria-current'), 'location');
  assert.deepEqual(otherSections.map(selector => d.querySelector(selector).innerHTML), before);
  assert.deepEqual([...d.querySelectorAll('.journey-kpi-value')].map(node => node.textContent), ['1,200', '16', '5', '346']);
  change('periodPreset', '30'); apply();
  assert.deepEqual([...d.querySelectorAll('.journey-kpi-value')].map(node => node.textContent), ['230', '15', '5', '230']);
  assert.equal(d.getElementById('journeyPeriod').textContent, d.getElementById('activePeriod').textContent);
  assert.equal(d.getElementById('journeyDateSlot').firstElementChild, dates);
  d.querySelector('.section-nav a[href="#summaryHeading"]').click();
  assert.equal(d.getElementById('resultsExperience').classList.contains('journey-workspace'), false);
  assert.equal(dates.nextElementSibling, d.querySelector('.summary-section'));
  assert.equal(d.getElementById('journeyDateSlot').children.length, 0);
  d.getElementById('journeySectionHeading').focus(); assert.ok(d.getElementById('resultsExperience').classList.contains('journey-workspace'));
  d.getElementById('newAnalysisButton').click();
  assert.equal(d.getElementById('resultsExperience').classList.contains('journey-workspace'), false);
  assert.equal(dates.nextElementSibling, d.querySelector('.summary-section'));
  assert.deepEqual(requests, []); dom.window.close();
});

test('Journey hash navigation isolates and restores the workspace without changing selection', () => {
  const { dom, d } = browser();
  d.querySelectorAll('.journey-modes button')[1].click(); d.querySelector('.pain-point-generate').click();
  const maps = [...d.querySelectorAll('.member-journey')];
  dom.window.history.replaceState(null, '', '#journeySectionHeading'); dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));
  assert.ok(d.getElementById('resultsExperience').classList.contains('journey-workspace'));
  dom.window.history.replaceState(null, '', '#aboutHeading'); dom.window.dispatchEvent(new dom.window.HashChangeEvent('hashchange'));
  assert.equal(d.getElementById('resultsExperience').classList.contains('journey-workspace'), false);
  assert.deepEqual([...d.querySelectorAll('.member-journey')], maps);
  dom.window.close();
});

test('Ranked pain-point table retains exact counts, statuses, domain, availability and evidence', () => {
  const { dom, d } = browser();
  const table = d.querySelector('.pain-point-table');
  assert.deepEqual([...table.querySelectorAll('thead th')].map(node => node.textContent), ['Rank', 'Pain Point', 'Supporting Records', 'Status', 'Domain', 'Journey Map / Availability']);
  const expected = [...project().established, ...project().emerging.filter(row => row.count >= 2)].sort((a,b) => b.count-a.count || a.name.localeCompare(b.name)).slice(0,3);
  for (const [i, row] of [...table.querySelectorAll('tbody tr')].entries()) {
    const cells = row.children, experience = expected[i];
    assert.equal(cells[0].textContent, String(i+1)); assert.equal(cells[1].querySelector('strong').textContent, experience.name);
    assert.equal(cells[1].scope, 'row'); assert.equal(cells[2].querySelector('strong').textContent, String(experience.count));
    assert.match(cells[3].textContent, /Established Trend/); assert.equal(cells[4].textContent, experience.domain);
    const supported = dom.window.FEEDBACK_JOURNEY_MODEL.project(dom.window.FEEDBACK_JOURNEY_PROVENANCE).byExperience.get(experience.name)?.supported;
    assert.match(cells[5].textContent, supported ? /Journey Supported/ : /Insufficient Journey Evidence/);
    cells[2].querySelector('.evidence-action').click();
    const ids = [...d.querySelectorAll('#evidenceList .feedback-card h3')].map(node => node.textContent);
    assert.ok(ids.length); assert.ok(ids.every(id => experience.recordIds.includes(id)));
  }
  assert.equal(d.querySelector('.pain-point-table-scroll').tabIndex, 0); dom.window.close();
});

test('Compact map headers and on-demand stage insights retain exact separate pain-point evidence', () => {
  const { dom, d, requests } = browser();
  d.querySelectorAll('.journey-modes button')[2].click();
  for (const name of ['Login Failure','Password Reset Failure']) d.querySelector(`.pain-point-candidate[data-experience="${name}"] input`).click();
  d.querySelector('.pain-point-generate').click();
  assert.equal(d.getElementById('painPointJourneyOutput').querySelector('h3').textContent, 'Generated Journey Maps');
  const projection = dom.window.FEEDBACK_JOURNEY_MODEL.project(dom.window.FEEDBACK_JOURNEY_PROVENANCE);
  for (const [i, map] of [...d.querySelectorAll('.member-journey')].entries()) {
    const journey = projection.byExperience.get(map.dataset.painPoint);
    assert.equal(map.open, i === 0); map.open = true; assert.equal(map.open, true); map.open = false;
    assert.equal(map.querySelector('summary h4').textContent, journey.painPoint);
    assert.match(map.querySelector('summary').textContent, /30 synthetic journey records · 5 stages · 2 touchpoints/);
    const details = [...map.querySelectorAll('tbody td details')]; assert.equal(details.length, journey.stages.length);
    for (const [n, detail] of details.entries()) {
      const stage = journey.stages[n]; assert.equal(detail.open, false);
      assert.equal(detail.querySelector('.journey-observation').textContent, stage.currentStateObservation);
      detail.querySelector('.evidence-action').click();
      const ids = [...d.querySelectorAll('#evidenceList .feedback-card h3')].map(node => node.textContent);
      assert.equal(ids.length, stage.recordIds.length);
      assert.ok(ids.every(id => stage.recordIds.includes(id)));
      assert.ok(ids.every(id => dom.window.FEEDBACK_JOURNEY_PROVENANCE.records.find(row => row.id === id).painPoint === journey.painPoint));
    }
  }
  assert.deepEqual(requests, []); dom.window.close();
});
