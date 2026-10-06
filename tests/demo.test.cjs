const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const prohibitedPersonalPath = /(?:[\\/]Users[\\/]|[\\/]home[\\/]|[A-Z]:[\\/](?:Users|Documents and Settings)[\\/]|~[\\/])/i;
const html = read('index.html');
const code = read('demo.js');
const fixtureCode = read('data/demo-data.js');
const languageCode = read('data/recurring-language.js');
const presentationCode = read('presentation.js');
const context = { window: {} };
vm.runInNewContext(fixtureCode, context, { filename: 'demo-data.js' });
const data = context.window.FEEDBACK_DEMO_DATA;
const records = data.records;
const count = (rows, key, value) => rows.filter(row => row[key] === value).length;
const period = (start, end) => records.filter(row => row.date >= start && row.date <= end);
const comparison = period(...data.meta.comparison);
const current = period(...data.meta.current);
function browser({ load = true } = {}) {
  const dom = new JSDOM(html, { url: 'https://dviddy.github.io/feedback-intelligence-demo/',
    runScripts: 'outside-only', pretendToBeVisual: true });
  const requests = [];
  dom.window.fetch = (...args) => { requests.push(['fetch', args]); throw new Error('Unexpected request'); };
  dom.window.XMLHttpRequest = class { constructor() { requests.push(['xhr']); throw new Error('Unexpected request'); } };
  dom.window.WebSocket = class { constructor() { requests.push(['websocket']); throw new Error('Unexpected request'); } };
  dom.window.eval(fixtureCode);
  dom.window.eval(languageCode);
  dom.window.eval(presentationCode);
  dom.window.eval(read('data/journey-provenance.js'));
  dom.window.eval(read('journey-model.js'));
  dom.window.eval(read('executive-report-pdf.js'));
  dom.window.eval(read('executive-report-adapter.js'));
  dom.window.eval(code);
  if (load) dom.window.document.getElementById('loadDemoButton').click();
  return { dom, document: dom.window.document, requests };
}
function selectQuarterComparison(dom, document) {
  document.getElementById('periodPreset').value = 'q3';
  document.getElementById('periodPreset').dispatchEvent(new dom.window.Event('change'));
  document.getElementById('compareEnabled').checked = true;
  document.getElementById('comparisonPreset').value = 'q2';
  document.getElementById('comparisonPreset').dispatchEvent(new dom.window.Event('change'));
  document.getElementById('periodForm').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
}
test('static entry, safe relative asset paths, and synthetic disclosure', () => {
  assert.match(html, /Demo environment[^<]*<span[^>]*>·<\/span> Synthetic feedback data/);
  assert.match(html, /connect-src 'none'/);
  for (const asset of ['style.css', 'data/demo-data.js', 'data/recurring-language.js', 'presentation.js', 'demo.js']) assert.ok(html.includes(`"${asset}"`));
  assert.ok(!/src="\//.test(html));
  assert.ok(!/href="\/(?!\/)/.test(html));
  assert.ok(!/PDF Executive Report|Emerging Momentum|localStorage|sessionStorage|indexedDB/i.test(html + code));
});
test('1,200 synthetic records cover exactly six consecutive months', () => {
  assert.equal(data.meta.synthetic, true);
  assert.equal(records.length, 1200);
  assert.equal(new Set(records.map(row => row.id)).size, 1200);
  assert.deepEqual([records.map(r => r.date).sort()[0], records.map(r => r.date).sort().at(-1)],
    ['2026-04-01', '2026-09-30']);
  assert.deepEqual(Object.fromEntries(['04','05','06','07','08','09'].map(month =>
    [month, records.filter(r => r.date.startsWith(`2026-${month}`)).length])),
    { '04': 180, '05': 190, '06': 190, '07': 200, '08': 210, '09': 230 });
  assert.ok(records.every(r => /^DEMO-\d{4}$/.test(r.id) && !Number.isNaN(Date.parse(r.date))));
  assert.ok(records.every(r => !/\b\d{7,}\b|@/.test(r.text)));
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(records.map(({ text, ...rest }) => rest))).digest('hex'),
    '0a9625fd5c279674c82bda850fa706e6e9a0f567e88c97b7782206092cb164e4');
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(records)).digest('hex'),
    'fc60096e243ee6dd678590a250b549ba8d170f3fc51a42c1c754c42a13c3cbea');
});
test('results present visual intelligence before experience intelligence', () => {
  const { dom, document } = browser();
  const order = [...document.querySelectorAll('#resultsExperience > section')]
    .filter(section => section.matches('.summary-section, .visual-section, .intelligence-section, .feedback-section'))
    .map(section => section.className);
  assert.deepEqual(order, ['summary-section', 'visual-section', 'intelligence-section', 'feedback-section']);
  assert.match(document.querySelector('.visual-section .eyebrow').textContent, /02/);
  assert.match(document.querySelector('.intelligence-section .eyebrow').textContent, /03/);
  assert.equal(document.getElementById('visualPanel').hidden, false);
  assert.equal(document.getElementById('visualToggle').getAttribute('aria-expanded'), 'true');
  document.querySelector('#trendsHeading + p + button').click();
  assert.equal(document.getElementById('trendsPanel').hidden, false);
  dom.window.close();
});
test('start experience is the initial view, demo load reveals results, and New Analysis resets it', () => {
  const { dom, document, requests } = browser({ load: false });
  const start = document.getElementById('startExperience');
  const results = document.getElementById('resultsExperience');
  assert.equal(start.hidden, false);
  assert.equal(results.hidden, true);
  assert.match(start.textContent, /Analyze One Comment/);
  assert.match(start.textContent, /Analyze Feedback Dataset/);
  assert.match(start.textContent, /Load Demo Dataset/);
  assert.match(start.textContent, /Synthetic feedback only/);
  assert.equal(document.getElementById('commentInput').disabled, true);
  assert.equal(document.getElementById('datasetInput').disabled, true);
  assert.match(start.textContent, /No customer file is selected, read, uploaded or stored/);
  document.getElementById('loadDemoButton').click();
  assert.equal(start.hidden, true);
  assert.equal(results.hidden, false);
  for (const section of ['Executive Summary', 'Experience Intelligence', 'Visual Intelligence', 'Detailed Feedback'])
    assert.ok(results.textContent.includes(section));
  assert.match(document.getElementById('summaryMetrics').textContent, /1,200/);
  assert.equal(document.getElementById('visualPanel').hidden, false);
  assert.equal(document.getElementById('visualToggle').textContent, 'Hide visuals');
  assert.equal(document.getElementById('visualCanvas').textContent.includes('Sentiment Mix'), true);
  assert.equal(document.getElementById('trendsPanel').hidden, true);
  assert.equal(document.getElementById('feedbackPanel').hidden, true);
  document.getElementById('visualToggle').click();
  assert.equal(document.getElementById('visualPanel').hidden, true);
  assert.equal(document.getElementById('visualToggle').getAttribute('aria-expanded'), 'false');
  document.getElementById('visualToggle').click();
  assert.equal(document.getElementById('visualPanel').hidden, false);
  document.getElementById('feedbackToggle').click();
  document.getElementById('newAnalysisButton').click();
  assert.equal(start.hidden, false);
  assert.equal(results.hidden, true);
  assert.equal(document.getElementById('visualPanel').hidden, true);
  assert.equal(document.getElementById('feedbackPanel').hidden, true);
  assert.equal(document.querySelectorAll('#feedbackList .feedback-card').length, 0);
  document.getElementById('loadDemoButton').click();
  assert.equal(results.hidden, false);
  assert.equal(document.getElementById('visualPanel').hidden, false);
  assert.equal(document.getElementById('visualToggle').getAttribute('aria-expanded'), 'true');
  assert.deepEqual(requests, []);
  dom.window.close();
});
test('synthetic comments vary by trend, sentiment, length and assisted destination without duplicates', () => {
  const firstSentence = text => text.match(/^[^.!?]+[.!?]/)?.[0] || text;
  const firstWords = text => text.split(/\s+/).slice(0, 10).join(' ');
  const lastSentence = text => text.match(/[^.!?]+[.!?]\s*$/)?.[0]?.trim() || text;
  const lastWords = text => text.split(/\s+/).slice(-10).join(' ');
  const beforeLast = text => text.replace(/\s+[^.!?]+[.!?]$/, '');
  const maxReuse = values => Math.max(...Object.values(values.reduce((map, value) => {
    map[value] = (map[value] || 0) + 1; return map;
  }, {})));
  assert.equal(new Set(records.map(row => row.text)).size, records.length);
  assert.ok(maxReuse(records.map(row => firstSentence(row.text))) <= 10);
  assert.ok(maxReuse(records.map(row => firstWords(row.text))) <= 10);
  assert.ok(maxReuse(records.map(row => lastSentence(row.text))) <= 10);
  assert.ok(maxReuse(records.map(row => lastWords(row.text))) <= 10);
  assert.ok(records.every(row => !row.text.includes('A clearer next step would help.')));
  const groups = new Map();
  for (const row of records) {
    const key = row.trend || `General ${row.sentiment}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  for (const [name, group] of groups) {
    const cap = Math.max(6, Math.ceil(group.length * 0.12));
    assert.ok(maxReuse(group.map(row => firstSentence(row.text))) <= cap, `${name}: repeated opening`);
    assert.ok(maxReuse(group.map(row => firstWords(row.text))) <= cap, `${name}: repeated first ten words`);
    assert.ok(maxReuse(group.map(row => beforeLast(row.text))) <= cap, `${name}: repeated comment prefix`);
    if (group.length >= 30) assert.ok(new Set(group.map(row => firstSentence(row.text))).size >= 8, name);
  }
  const sentenceCounts = records.map(row => (row.text.match(/[.!?](?:\s|$)/g) || []).length);
  assert.ok(sentenceCounts.some(n => n === 1));
  assert.ok(sentenceCounts.some(n => n === 2));
  assert.ok(sentenceCounts.some(n => n >= 3));
  for (const sentiment of ['Positive', 'Neutral', 'Negative'])
    assert.ok(new Set(records.filter(r => r.sentiment === sentiment).map(r => firstSentence(r.text))).size >= 20);
  const migrated = records.filter(r => r.migratedTo);
  assert.equal(migrated.length, 92);
  assert.ok(new Set(migrated.map(r => r.text.split(' ').slice(-8).join(' '))).size >= 15);
  for (const destination of ['Contact Center / Phone', 'Chat', 'Branch'])
    assert.ok(new Set(migrated.filter(r => r.migratedTo === destination).map(r => r.text)).size >= 10);
});
test('executive metrics, sentiment, effort and priority reconcile', () => {
  assert.equal(data.summary.total, records.length);
  for (const key of ['sentiment','effort','priority']) {
    assert.equal(Object.values(data.summary[key]).reduce((a,b) => a+b, 0), records.length);
    for (const [label, value] of Object.entries(data.summary[key])) assert.equal(value, count(records, key, label));
  }
  assert.equal(data.summary.eligibleDigital, records.filter(r => r.eligibleDigital).length);
  assert.equal(data.summary.migrated, records.filter(r => r.migratedTo).length);
  assert.equal(data.migration.eligible, data.summary.eligibleDigital);
  assert.equal(data.migration.migrated, data.summary.migrated);
  for (const origin of data.migration.origins) {
    assert.equal(origin.eligible, records.filter(r => r.eligibleDigital && r.touchpoint === origin.name).length);
    assert.equal(origin.migrated, records.filter(r => r.migratedTo && r.touchpoint === origin.name).length);
  }
  for (const destination of data.migration.destinations)
    assert.equal(destination.migrated, count(records, 'migratedTo', destination.name));
  assert.equal(data.migration.origins.reduce((n, row) => n + row.eligible, 0), data.migration.eligible);
  assert.equal(data.migration.destinations.reduce((n, row) => n + row.migrated, 0), data.migration.migrated);
  assert.ok(data.summary.migrated > 0 && data.summary.migrated < data.summary.eligibleDigital);
  assert.ok(records.every(r => !r.migratedTo || (r.eligibleDigital &&
    ['Contact Center / Phone','Chat','Branch'].includes(r.migratedTo))));
  assert.ok(records.every(r => !r.eligibleDigital || ['Mobile App','Online Banking','Public Website','ATM'].includes(r.touchpoint)));
});
test('feedback sources and experience touchpoints remain distinct and varied', () => {
  assert.deepEqual(new Set(records.map(r => r.source)), new Set(['Survey Response',
    'Contact Center Transcript', 'Complaint Case', 'Public Review', 'App Store Review',
    'Email Message', 'Chat Transcript', 'Branch-Collected Feedback']));
  assert.deepEqual(new Set(records.map(r => r.touchpoint)), new Set(['Mobile App', 'Online Banking',
    'Public Website', 'Branch', 'Contact Center / Phone', 'Chat', 'Email', 'SMS / Text',
    'ATM', 'Card / Point of Sale']));
  assert.ok(records.some(r => r.source === 'Survey Response' && r.touchpoint === 'Contact Center / Phone'));
  assert.ok(records.some(r => r.touchpoint === 'Branch') && records.some(r => r.touchpoint === 'Mobile App'));
});
test('trend counts, periods, labels, prevalence and divergence reconcile', () => {
  assert.equal(comparison.length, 560); assert.equal(current.length, 640);
  assert.equal(data.periodTotals.comparison, comparison.length);
  assert.equal(data.periodTotals.current, current.length);
  assert.equal(data.topTrends.length, 10);
  for (const trend of data.topTrends) {
    assert.equal(trend.count, count(records, 'trend', trend.name));
    assert.equal(trend.highPriorityCount, records.filter(r => r.trend === trend.name && r.priority === 'High').length);
    for (const id of trend.evidenceIds) assert.equal(records.find(r => r.id === id)?.trend, trend.name);
  }
  const labels = new Set(data.movement.map(m => m.label));
  for (const label of ['Increasing','Stable','Decreasing','New in selected comparison window',
    'No longer observed in selected current period']) assert.ok(labels.has(label));
  for (const row of data.movement) {
    assert.equal(row.comparisonCount, count(comparison, 'trend', row.name));
    assert.equal(row.currentCount, count(current, 'trend', row.name));
    assert.equal(row.comparisonPrevalence, row.comparisonCount / comparison.length);
    assert.equal(row.currentPrevalence, row.currentCount / current.length);
    const expectedChange = row.comparisonCount ? (row.currentCount - row.comparisonCount) / row.comparisonCount * 100 : null;
    assert.equal(row.percentageChange, expectedChange);
    const expectedLabel = !row.comparisonCount ? 'New in selected comparison window' : !row.currentCount ?
      'No longer observed in selected current period' :
      (Math.abs(row.currentCount - row.comparisonCount) <= 1 || Math.abs(expectedChange) <= 10) ?
      'Stable' : row.currentCount > row.comparisonCount ? 'Increasing' : 'Decreasing';
    assert.equal(row.label, expectedLabel);
  }
  const fee = data.movement.find(m => m.name === 'Unexpected Fee');
  assert.ok(fee.currentCount > fee.comparisonCount && fee.currentPrevalence < fee.comparisonPrevalence);
  const augSep = period(...data.alternateLens.current);
  const feeAugSep = count(augSep, 'trend', fee.name);
  assert.equal(data.alternateLens.currentTotal, augSep.length);
  assert.equal(data.alternateLens.currentCount, feeAugSep);
  assert.ok(feeAugSep < fee.comparisonCount && feeAugSep / augSep.length > fee.comparisonPrevalence);
});
test('emerging and journey evidence references valid synthetic records', () => {
  assert.deepEqual(new Set(data.emerging.map(e => e.gap)),
    new Set(['Specificity Gap','Domain Gap','Unrepresented Experience']));
  for (const item of data.emerging) {
    assert.ok(item.evidenceIds.length > 0);
    assert.equal(item.supportingRecordCount, count(records, 'trend', item.name));
    for (const id of item.evidenceIds) assert.equal(records.find(r => r.id === id)?.trend, item.name);
  }
  assert.equal(data.journeys.length, 5);
  for (const journey of data.journeys) {
    assert.ok(journey.stages.length > 0);
    const names = journey.stages.map(s => s.label);
    assert.equal(journey.supportingRecordCount, records.filter(r => names.includes(r.trend)).length);
    for (const stage of journey.stages) for (const id of stage.evidenceIds)
      assert.equal(records.find(r => r.id === id)?.trend, stage.label);
  }
});
test('demo renders compact executive modules and interactions without API calls', () => {
  const { dom, document, requests } = browser();
  for (const name of ['Executive Summary','Experience Intelligence','Established Trends','Trend Movement',
    'Emerging Experiences','Digital → Assisted','Journey Mapping','Detailed Feedback'])
    assert.ok(document.body.textContent.includes(name), name);
  assert.match(document.getElementById('summaryMetrics').textContent, /1,200/);
  assert.equal(document.querySelectorAll('.feedback-card').length, 0);
  for (const button of document.querySelectorAll('.module-toggle')) {
    const target = document.getElementById(button.getAttribute('aria-controls'));
    assert.equal(button.getAttribute('aria-expanded'), 'false');
    button.click(); assert.equal(button.getAttribute('aria-expanded'), 'true'); assert.equal(target.hidden, false);
    button.click(); assert.equal(button.getAttribute('aria-expanded'), 'false'); assert.equal(target.hidden, true);
  }
  document.querySelector('#trendsHeading + p + button').click();
  const all = document.querySelector('#trendsPanel .small-action');
  all.click(); assert.equal(document.getElementById('allTrends').hidden, false);
  const evidence = document.querySelector('#trendsPanel details');
  evidence.open = true; evidence.dispatchEvent(new dom.window.Event('toggle')); assert.ok(evidence.textContent.includes('DEMO-'));
  document.querySelector('#journeyHeading + p + button').click();
  document.querySelector('.journey-choice').click();
  assert.ok(document.getElementById('journeyDisplay').textContent.includes('Supporting evidence'));
  document.getElementById('feedbackToggle').click();
  assert.equal(document.querySelectorAll('#feedbackList .feedback-card').length, 20);
  document.getElementById('moreFeedback').click();
  assert.equal(document.querySelectorAll('#feedbackList .feedback-card').length, 40);
  assert.deepEqual(requests, []);
  assert.ok(!/Infinity|NaN/.test(document.body.textContent));
  dom.window.close();
});
test('public file scope excludes private backend, credentials and provider calls', () => {
  const files = ['index.html','style.css','demo.js','data/demo-data.js','data/recurring-language.js',
    'presentation.js','data/journey-provenance.js','journey-model.js','executive-report-pdf.js','executive-report-adapter.js','scripts/generate-data.mjs','scripts/voice-library.mjs','scripts/voice-endings.mjs','README.md'];
  for (const file of files) {
    const text = read(file);
    assert.ok(!/sk-[A-Za-z0-9_-]{20,}|OPENAI_API_KEY|BEGIN PRIVATE KEY|api\.openai\.com|localhost:\d+/i.test(text), file);
    assert.ok(!prohibitedPersonalPath.test(text), file);
  }
  assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/.test(code));
  assert.ok(!fs.existsSync(path.join(root, 'server')));
  assert.ok(!fs.existsSync(path.join(root, '.env')));
});
test('visual fixtures reconcile to the unchanged synthetic records', () => {
  const sentiment = data.visuals.sentiment.rows;
  assert.equal(JSON.stringify(sentiment.map(r => [r.label, r.count])),
    JSON.stringify([['Positive', 378], ['Neutral', 354], ['Negative', 468]]));
  assert.equal(sentiment.reduce((sum, row) => sum + row.count, 0), 1200);
  for (const row of sentiment) {
    assert.equal(row.recordIds.length, row.count);
    assert.equal(new Set(row.recordIds).size, row.count);
    for (const id of row.recordIds) assert.equal(records.find(r => r.id === id)?.sentiment, row.label);
  }
  const domains = data.visuals.domains.rows;
  assert.equal(domains.reduce((sum, row) => sum + row.count, 0), 1200);
  assert.equal(new Set(domains.flatMap(row => row.recordIds)).size, 1200);
  for (const row of domains) {
    assert.equal(row.recordIds.length, row.count);
    for (const id of row.recordIds) assert.equal(records.find(r => r.id === id)?.domain || 'Outside controlled taxonomy', row.label);
  }
  for (const row of data.movement) {
    assert.equal(row.currentRecordIds.length, row.currentCount);
    assert.equal(row.comparisonRecordIds.length, row.comparisonCount);
    assert.ok(row.currentRecordIds.every(id => records.find(r => r.id === id)?.date >= '2026-07-01'));
    assert.ok(row.comparisonRecordIds.every(id => records.find(r => r.id === id)?.date <= '2026-06-30'));
  }
  for (const origin of data.migration.origins) {
    assert.equal(origin.eligibleRecordIds.length, origin.eligible);
    assert.equal(origin.migratedRecordIds.length, origin.migrated);
    assert.ok(origin.migratedRecordIds.every(id => origin.eligibleRecordIds.includes(id)));
  }
  for (const destination of data.migration.destinations) {
    assert.equal(destination.recordIds.length, destination.migrated);
    assert.ok(destination.recordIds.every(id => records.find(r => r.id === id)?.migratedTo === destination.name));
  }
});
test('key phrases are exact, deterministic, distinct evidence-linked language', () => {
  assert.equal(data.phrases.length, 12);
  assert.equal(new Set(data.phrases.map(row => row.id)).size, 12);
  assert.ok(data.phrases.every(row => row.phrase.split(' ').length >= 2 && row.count >= 3));
  assert.ok(data.phrases.every(row => !['account', 'bank', 'member', 'issue', 'problem', 'service'].includes(row.phrase)));
  const sorted = [...data.phrases].sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
  assert.equal(JSON.stringify(data.phrases.map(row => row.id)), JSON.stringify(sorted.map(row => row.id)));
  for (const row of data.phrases) {
    assert.equal(row.count, row.recordIds.length);
    assert.equal(row.count, new Set(row.recordIds).size);
    assert.equal(JSON.stringify(row.recordIds), JSON.stringify(records.filter(record => record.text.toLowerCase().includes(row.phrase)).map(record => record.id)));
    for (const id of row.recordIds) assert.ok(records.find(record => record.id === id)?.text.toLowerCase().includes(row.phrase));
    assert.ok(row.evidenceIds.every(id => row.recordIds.includes(id)));
  }
  const shared = records.find(r => r.trend === 'Login Failure' && r.migratedTo && r.text.toLowerCase().includes("couldn't log in")) ||
    records.find(r => r.trend === 'Login Failure' && r.text.toLowerCase().includes("couldn't log in"));
  assert.ok(data.visuals.sentiment.rows.find(row => row.label === shared.sentiment).recordIds.includes(shared.id));
  assert.ok(data.visuals.domains.rows.find(row => row.label === shared.domain).recordIds.includes(shared.id));
  assert.ok(data.topTrends.find(row => row.name === shared.trend).recordIds.includes(shared.id));
  assert.ok(data.phrases.find(row => row.trend === shared.trend).recordIds.includes(shared.id));
  assert.equal(records.filter(r => r.id === shared.id).length, 1);
});
test('Recurring Language themes reuse semantic trend populations and exact phrase evidence', () => {
  const { dom, document, requests } = browser();
  const themes = dom.window.FEEDBACK_DEMO_PRESENTATION.project(dom.window.FEEDBACK_DEMO_DATA, dom.window.FEEDBACK_RECURRING_LANGUAGE).recurringLanguage;
  assert.ok(themes.length > 10);
  assert.equal(new Set(themes.map(theme => theme.id)).size, themes.length);
  assert.equal(document.querySelector('[data-visual="phrases"]').textContent, 'Recurring Language');
  assert.ok(!html.includes('Key Phrases'));
  for (const theme of themes) {
    const group = data.movement.find(row => row.name === theme.id);
    assert.ok(group);
    const ids = [...new Set([...group.comparisonRecordIds, ...group.currentRecordIds])];
    assert.equal(theme.count, ids.length);
    assert.equal(JSON.stringify(theme.recordIds), JSON.stringify(ids));
    assert.equal(theme.topTrend, data.topTrends.some(row => row.name === theme.id));
    assert.ok(theme.phrases.length >= 1 && theme.phrases.length <= 5, theme.name);
    assert.equal(JSON.stringify(theme.phraseIds), JSON.stringify(theme.phrases.map(phrase => phrase.id)));
    for (const phrase of theme.phrases) {
      const exact = records.filter(row => row.trend === theme.id && row.text.toLowerCase().includes(phrase.phrase.toLowerCase()));
      assert.equal(phrase.count, exact.length);
      assert.equal(phrase.count, new Set(phrase.recordIds).size);
      assert.equal(JSON.stringify(phrase.recordIds), JSON.stringify(exact.map(row => row.id)));
      assert.ok(phrase.recordIds.every(id => theme.recordIds.includes(id)));
    }
  }
  for (const original of data.phrases) {
    const theme = themes.find(item => item.id === original.trend);
    const phrase = theme.phrases.find(item => item.id === original.id);
    assert.ok(phrase, original.phrase);
    assert.equal(phrase.count, original.count);
  }
  const login = themes.find(theme => theme.name === 'Login Failure');
  assert.equal(login.count, 69);
  assert.notEqual(login.count, login.phrases.reduce((sum, phrase) => sum + phrase.count, 0));
  assert.equal(themes.find(theme => theme.name === 'Unexpected Fee').count, 67);
  assert.equal(themes.find(theme => theme.name === 'Service Wait Time').count, 55);
  assert.equal(document.querySelector('[data-visual="domains"]').textContent, 'Experience Concentration');
  assert.deepEqual(requests, []);
  dom.window.close();
});
test('theme and phrase drill-downs use their separate evidence populations', () => {
  const { dom, document, requests } = browser();
  document.querySelector('[data-visual="phrases"]').click();
  assert.match(document.getElementById('visualCanvas').textContent, /How are customers describing recurring experiences/);
  assert.equal(document.querySelectorAll('#visualCanvas .language-row').length, 6);
  assert.equal(document.getElementById('remainingLanguage').hidden, true);
  assert.equal(document.querySelector('#visualCanvas .language-list').querySelectorAll('.language-row').length, 6);
  const loginRow = document.querySelector('#visualCanvas .language-list .language-row');
  assert.match(loginRow.textContent, /Login Failure/);
  assert.match(loginRow.textContent, /69 supporting comments/);
  loginRow.querySelector('.evidence-action').click();
  assert.match(document.getElementById('evidenceHeading').textContent, /Login Failure/);
  assert.match(document.getElementById('evidenceCount').textContent, /20 of 69/);
  assert.ok([...document.querySelectorAll('#evidenceList .feedback-card')].every(card =>
    dom.window.FEEDBACK_DEMO_PRESENTATION.project(dom.window.FEEDBACK_DEMO_DATA, dom.window.FEEDBACK_RECURRING_LANGUAGE).recurringLanguage[0].recordIds.includes(card.querySelector('h3').textContent)));
  loginRow.querySelector('.language-phrase').click();
  assert.match(document.getElementById('evidenceHeading').textContent, /couldn't log in/);
  assert.match(document.getElementById('evidenceContext').textContent, /exact wording within Login Failure/);
  assert.match(document.getElementById('evidenceCount').textContent, /6 of 6/);
  assert.ok([...document.querySelectorAll('#evidenceList .feedback-card')].every(card =>
    card.textContent.toLowerCase().includes("couldn't log in")));
  document.getElementById('closeEvidence').click();
  document.querySelector('#visualCanvas .chart-more').click();
  assert.equal(document.getElementById('remainingLanguage').hidden, false);
  assert.deepEqual(requests, []);
  dom.window.close();
});
test('visual drill-down uses one shared, paginated evidence panel', () => {
  const { dom, document, requests } = browser();
  const visual = document.getElementById('visualPanel');
  assert.equal(visual.hidden, false);
  assert.equal(document.getElementById('visualToggle').getAttribute('aria-expanded'), 'true');
  document.getElementById('visualToggle').click();
  assert.equal(visual.hidden, true);
  assert.equal(document.getElementById('visualToggle').getAttribute('aria-expanded'), 'false');
  document.getElementById('visualToggle').click();
  assert.equal(visual.hidden, false);
  assert.equal(document.getElementById('visualToggle').getAttribute('aria-expanded'), 'true');
  assert.ok(document.getElementById('visualCanvas').textContent.includes('Sentiment Mix'));
  document.querySelector('.chart-row[aria-label="View 468 Negative comments"]').click();
  assert.equal(document.getElementById('evidencePanel').hidden, false);
  assert.match(document.getElementById('evidenceHeading').textContent, /Negative sentiment/);
  assert.match(document.getElementById('evidenceCount').textContent, /20 of 468/);
  assert.equal(document.querySelectorAll('#evidenceList .feedback-card').length, 20);
  assert.ok([...document.querySelectorAll('#evidenceList .feedback-card')].every(card => card.textContent.includes('Negative sentiment')));
  document.getElementById('moreEvidence').click();
  assert.equal(document.querySelectorAll('#evidenceList .feedback-card').length, 40);
  document.getElementById('closeEvidence').click();
  assert.equal(document.getElementById('evidencePanel').hidden, true);
  assert.equal(document.querySelectorAll('#evidenceList .feedback-card').length, 0);
  document.querySelector('[data-visual="domains"]').click();
  assert.equal(document.querySelector('[data-visual="domains"]').getAttribute('aria-pressed'), 'true');
  assert.equal(document.querySelectorAll('#visualCanvas .chart-row').length, 11);
  assert.equal(document.querySelectorAll('#visualCanvas .concentration-group').length, 2);
  document.querySelector('#visualCanvas .chart-more').click();
  assert.equal(document.getElementById('remainingDomains').hidden, false);
  const domain = { label: data.topTrends[0].name, count: data.topTrends[0].count };
  document.querySelector('#visualCanvas .chart-row').click();
  assert.match(document.getElementById('evidenceHeading').textContent, new RegExp(domain.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(document.getElementById('evidenceCount').textContent, new RegExp(`20 of ${domain.count}`));
  assert.ok(document.querySelector('#evidenceList .feedback-card').textContent.includes('Feedback Source:'));
  assert.ok(document.querySelector('#evidenceList .feedback-card').textContent.includes('Experience Touchpoint:'));
  document.querySelector('#summaryMetrics .metric:last-child .evidence-action').click();
  assert.match(document.getElementById('evidenceCount').textContent, /20 of 441/);
  document.querySelector('#evidenceChoices button:nth-child(2)').click();
  assert.match(document.getElementById('evidenceCount').textContent, /20 of 92/);
  assert.deepEqual(requests, []);
  dom.window.close();
});
test('movement, migration and phrase selections preserve their evidence basis', () => {
  const { dom, document } = browser();
  selectQuarterComparison(dom, document);
  document.querySelector('[data-visual="movement"]').click();
  assert.ok(document.getElementById('visualCanvas').textContent.includes('Trend Movement'));
  document.querySelector('#visualCanvas .chart-more').click();
  assert.equal(document.getElementById('remainingMovement').hidden, false);
  assert.equal(document.querySelectorAll('#visualCanvas .movement-chart-row').length, 16);
  document.querySelector('.movement-chart-row').click();
  assert.match(document.getElementById('evidenceCount').textContent, /20 of 45/);
  assert.ok([...document.querySelectorAll('#evidenceList .feedback-card')].every(card => /2026-(07|08|09)-/.test(card.textContent)));
  document.querySelector('#evidenceChoices button:nth-child(2)').click();
  assert.match(document.getElementById('evidenceCount').textContent, /20 of 24/);
  assert.ok([...document.querySelectorAll('#evidenceList .feedback-card')].every(card => /2026-(04|05|06)-/.test(card.textContent)));
  document.getElementById('periodPreset').value = 'all';
  document.getElementById('periodPreset').dispatchEvent(new dom.window.Event('change'));
  document.getElementById('periodForm').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  document.querySelector('[data-visual="migration"]').click();
  assert.equal(document.getElementById('evidencePanel').hidden, true);
  const online = [...document.querySelectorAll('#visualCanvas .chart-row')].find(button => button.textContent.includes('Online Banking'));
  online.click();
  assert.match(document.getElementById('evidenceCount').textContent, /20 of 208/);
  document.querySelector('#evidenceChoices button:nth-child(2)').click();
  assert.match(document.getElementById('evidenceCount').textContent, /20 of 46/);
  assert.ok([...document.querySelectorAll('#evidenceList .feedback-card')].every(card => card.textContent.includes('Online Banking')));
  const chat = [...document.querySelectorAll('#visualCanvas .chart-row')].find(button => button.textContent.includes('Chat'));
  chat.click(); assert.match(document.getElementById('evidenceCount').textContent, /20 of 35/);
  document.querySelector('[data-visual="phrases"]').click();
  assert.ok(document.getElementById('visualCanvas').textContent.includes('Recurring Language'));
  document.querySelector('#visualCanvas .language-phrase').click();
  assert.match(document.getElementById('evidenceHeading').textContent, /couldn't log in/);
  assert.match(document.getElementById('evidenceCount').textContent, /6 of 6/);
  document.getElementById('closeEvidence').click();
  document.querySelector('[data-visual="sentiment"]').click();
  assert.equal(document.querySelector('[data-visual="sentiment"]').getAttribute('aria-pressed'), 'true');
  dom.window.close();
});
test('existing trend, emerging, journey and detailed feedback share exact record cards', () => {
  const { dom, document } = browser();
  document.querySelector('#trendsHeading + p + button').click();
  document.querySelector('#trendsPanel .evidence-action').click();
  assert.match(document.getElementById('evidenceCount').textContent, /20 of 69/);
  document.getElementById('closeEvidence').click();
  document.querySelector('#emergingHeading + p + p + button').click();
  document.querySelector('#emergingPanel .evidence-action').click();
  assert.ok(!document.getElementById('evidencePanel').hidden);
  document.getElementById('closeEvidence').click();
  document.querySelector('#journeyHeading + p + button').click();
  document.querySelector('.journey-choice').click();
  document.querySelector('#journeyDisplay .evidence-action').click();
  const evidenceCard = document.querySelector('#evidenceList .feedback-card');
  const id = evidenceCard.querySelector('h3').textContent;
  document.getElementById('feedbackToggle').click();
  const detailedCard = [...document.querySelectorAll('#feedbackList .feedback-card')].find(card => card.querySelector('h3').textContent === id);
  assert.ok(detailedCard);
  assert.equal(detailedCard.textContent, evidenceCard.textContent);
  assert.equal(document.querySelectorAll('#feedbackList .feedback-card').length, 20);
  dom.window.close();
});
test('interactive charts use native buttons, explicit labels and visible focus styling', () => {
  const { dom, document } = browser();
  for (const view of document.querySelectorAll('[data-visual]')) {
    assert.equal(view.tagName, 'BUTTON');
    assert.ok(view.hasAttribute('aria-pressed'));
    view.click();
    for (const row of document.querySelectorAll('#visualCanvas .chart-row')) {
      assert.equal(row.tagName, 'BUTTON');
      assert.ok(row.getAttribute('aria-label'));
      assert.ok(row.textContent.trim().length > 3);
    }
  }
  assert.match(read('style.css'), /button:focus-visible/);
  assert.match(html, /aria-controls="visualPanel"/);
  assert.match(html, /connect-src 'none'/);
  assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|indexedDB/.test(code));
  dom.window.close();
});

test('generic personal-path guard detects home locations without depending on a developer name', () => {
  const slash = String.fromCharCode(47);
  const backslash = String.fromCharCode(92);
  for (const sample of [
    ['', 'Users', 'sample-user', 'project'].join(slash),
    ['', 'home', 'sample-user', 'project'].join(slash),
    ['C:', 'Users', 'sample-user', 'project'].join(backslash),
    ['D:', 'Documents and Settings', 'sample-user'].join(backslash),
    ['~', 'project'].join(slash)
  ]) assert.ok(prohibitedPersonalPath.test(sample));
  for (const sample of ['data/demo-data.js', 'https://example.org/demo', 'Synthetic feedback']) {
    assert.ok(!prohibitedPersonalPath.test(sample));
  }
});
