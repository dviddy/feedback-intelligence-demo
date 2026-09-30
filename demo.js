/* Lightweight presentation only. All feedback and intelligence figures are precomputed synthetic fixtures. */
const data = window.FEEDBACK_DEMO_DATA;
const records = data.records;
const byId = new Map(records.map(record => [record.id, record]));
const languageConfig = window.FEEDBACK_RECURRING_LANGUAGE;
const topTrendNames = new Set(data.topTrends.map(trend => trend.name));
// Materialize the presentation layer from existing semantic groups and exact comments.
// Keeping this structure on the fixture makes it reusable by a future report renderer.
data.recurringLanguage = data.movement.map(group => {
  const recordIds = [...new Set([...group.comparisonRecordIds, ...group.currentRecordIds])];
  const supporting = recordIds.map(id => byId.get(id));
  const phrases = (languageConfig.phrasesByTrend[group.name] || []).map((phrase, index) => {
    const exactIds = supporting.filter(record => record.text.toLowerCase().includes(phrase.toLowerCase())).map(record => record.id);
    const original = data.phrases.find(item => item.trend === group.name && item.phrase === phrase);
    return { id: original?.id || `language-${group.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index + 1}`,
      phrase, count: exactIds.length, recordIds: exactIds };
  }).filter(phrase => phrase.count >= 2);
  return { id: group.name, name: group.name, domain: supporting[0]?.domain || null,
    count: recordIds.length, recordIds, phraseIds: phrases.map(phrase => phrase.id), phrases,
    topTrend: topTrendNames.has(group.name) };
}).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
const format = value => new Intl.NumberFormat('en-US').format(value);
const percent = (numerator, denominator, digits = 0) => denominator ? `${(100 * numerator / denominator).toFixed(digits)}%` : '—';
function el(tag, content, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined && content !== null) node.textContent = String(content);
  return node;
}
function add(parent, ...children) { parent.append(...children); return parent; }
function feedbackCard(record) {
  const card = el('article', undefined, 'feedback-card');
  add(card, el('h3', record.id), el('p', `${record.date} · Feedback Source: ${record.source} · Experience Touchpoint: ${record.touchpoint}`, 'row-meta'),
    el('p', record.text), el('p', `${record.sentiment} sentiment · ${record.effort} effort · ${record.priority} priority${record.trend ? ` · ${record.trend}` : ''}`, 'row-meta'));
  return card;
}
let selectedEvidence = [];
let evidenceShown = 0;
let evidenceSource = null;
function showEvidenceBatch() {
  const list = document.getElementById('evidenceList');
  for (const id of selectedEvidence.slice(evidenceShown, evidenceShown + 20)) add(list, feedbackCard(byId.get(id)));
  evidenceShown = Math.min(evidenceShown + 20, selectedEvidence.length);
  document.getElementById('evidenceCount').textContent = `Showing ${evidenceShown} of ${selectedEvidence.length} synthetic comments`;
  document.getElementById('moreEvidence').hidden = evidenceShown >= selectedEvidence.length;
}
function selectEvidenceGroup(group, buttons) {
  selectedEvidence = [...new Set(group.recordIds)];
  evidenceShown = 0;
  document.getElementById('evidenceList').replaceChildren();
  document.getElementById('evidenceContext').textContent = `${format(selectedEvidence.length)} supporting ${selectedEvidence.length === 1 ? 'record' : 'records'} · ${group.context}`;
  if (!selectedEvidence.length) add(document.getElementById('evidenceList'), el('p', 'No feedback evidence observed in this selected period.', 'panel-intro'));
  showEvidenceBatch();
  if (buttons) for (const [button, item] of buttons) button.setAttribute('aria-pressed', String(item === group));
}
function openEvidence(title, groups, source) {
  evidenceSource = source;
  const panel = document.getElementById('evidencePanel');
  document.getElementById('evidenceHeading').textContent = `Supporting feedback for: ${title}`;
  const choices = document.getElementById('evidenceChoices');
  choices.replaceChildren();
  choices.hidden = groups.length < 2;
  const buttons = [];
  if (groups.length > 1) for (const group of groups) {
    const button = el('button', `${group.label} · ${format(new Set(group.recordIds).size)}`);
    button.type = 'button';
    button.addEventListener('click', () => selectEvidenceGroup(group, buttons));
    buttons.push([button, group]); add(choices, button);
  }
  panel.hidden = false;
  selectEvidenceGroup(groups[0], buttons);
  if (typeof panel.scrollIntoView === 'function') panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById('closeEvidence').focus();
}
function closeEvidence(restoreFocus = true) {
  document.getElementById('evidencePanel').hidden = true;
  document.getElementById('evidenceList').replaceChildren();
  selectedEvidence = []; evidenceShown = 0;
  if (restoreFocus) (evidenceSource?.isConnected ? evidenceSource :
    document.querySelector('[data-visual][aria-pressed="true"]') || document.getElementById('visualToggle')).focus();
}
function evidenceAction(label, title, groups) {
  const button = el('button', label, 'evidence-action');
  button.type = 'button';
  button.addEventListener('click', () => openEvidence(title, groups, button));
  return button;
}
const oneGroup = (ids, context) => [{ label: 'Supporting feedback', recordIds: ids, context }];
function evidenceList(ids) {
  const details = el('details');
  add(details, el('summary', `Supporting evidence · ${ids.length} sample ${ids.length === 1 ? 'record' : 'records'}`));
  const list = el('ul', undefined, 'evidence');
  for (const id of ids) add(list, el('li', `${id} · “${byId.get(id).text}”`));
  add(details, list);
  return details;
}
function setSummary() {
  const summary = data.summary;
  const metrics = [
    ['Total Feedback', format(summary.total), 'Analyzed synthetic records', records.map(r => r.id)],
    ['Negative Experience', percent(summary.sentiment.Negative, summary.total), `${format(summary.sentiment.Negative)} records`, data.visuals.sentiment.rows.find(r => r.label === 'Negative').recordIds],
    ['High Effort', percent(summary.effort.High, summary.total), `${format(summary.effort.High)} records`, records.filter(r => r.effort === 'High').map(r => r.id)],
    ['High Priority', percent(summary.priority.High, summary.total), `${format(summary.priority.High)} records`, records.filter(r => r.priority === 'High').map(r => r.id)],
    ['Digital → Assisted', percent(summary.migrated, summary.eligibleDigital), `${summary.migrated} of ${summary.eligibleDigital} eligible records`,
      data.migration.destinations.flatMap(r => r.recordIds), [
        { label: 'Eligible', recordIds: data.migration.origins.flatMap(r => r.eligibleRecordIds), context: 'Apr–Sep 2026 · eligible digital-friction feedback' },
        { label: 'Migrated', recordIds: data.migration.destinations.flatMap(r => r.recordIds), context: 'Apr–Sep 2026 · sought assisted help' }
      ]]
  ];
  for (const [label, value, context, ids, groups] of metrics) {
    const card = el('div', undefined, 'metric');
    add(card, el('div', label, 'metric-label'), el('div', value, 'metric-value'), el('div', context, 'metric-context'),
      evidenceAction(groups ? 'Compare eligible and migrated feedback' : `View ${format(ids.length)} comments`,
        label, groups || oneGroup(ids, 'Apr–Sep 2026 · synthetic analyzed feedback')));
    add(document.getElementById('summaryMetrics'), card);
  }
  for (const [title, counts] of [['Sentiment', summary.sentiment], ['Effort', summary.effort], ['Priority', summary.priority]]) {
    const group = el('div'); add(group, el('h3', title));
    for (const [label, count] of Object.entries(counts)) add(group, el('p', `${label}: ${format(count)} · ${percent(count, summary.total, 1)}`));
    add(document.getElementById('distribution'), group);
  }
}
function installToggles() {
  for (const button of document.querySelectorAll('.module-toggle, #feedbackToggle')) button.addEventListener('click', () => {
    const panel = document.getElementById(button.getAttribute('aria-controls'));
    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!expanded));
    panel.hidden = expanded;
    button.textContent = expanded ? button.dataset.closed : button.dataset.open;
    if (!expanded && panel.id === 'feedbackPanel' && !panel.dataset.loaded) { showFeedback(); panel.dataset.loaded = 'true'; }
  });
  for (const button of document.querySelectorAll('.module-toggle, #feedbackToggle')) {
    button.dataset.closed = button.textContent;
    button.dataset.open = button.textContent.replace(/^Explore/, 'Hide').replace(/^View/, 'Hide');
  }
}
function makeTrendRow(trend) {
  const row = el('li', undefined, 'data-row');
  const heading = el('div', undefined, 'row-heading');
  add(heading, el('h4', trend.name), el('span', `${trend.count} records`));
  add(row, heading, el('p', `${trend.domain || 'Outside controlled taxonomy'} · ${trend.highPriorityCount} High Priority`, 'row-meta'),
    evidenceList(trend.evidenceIds),
    evidenceAction(`View ${trend.count} comments`, trend.name, oneGroup(trend.recordIds, 'Apr–Sep 2026 · Top Trend')));
  return row;
}
function setTrends() {
  const sorted = data.topTrends;
  const high = sorted.filter(trend => trend.highPriorityCount >= 10).length;
  document.getElementById('trendsSummary').textContent = `${sorted.length} leading recurring experiences · ${high} with 10+ High Priority records`;
  const panel = document.getElementById('trendsPanel');
  add(panel, el('p', 'Most prevalent recurring experiences across the six-month dataset.', 'panel-intro'));
  const list = el('ol', undefined, 'data-list');
  for (const trend of sorted.slice(0, 3)) add(list, makeTrendRow(trend));
  add(panel, list);
  const more = el('div'); more.hidden = true;
  const moreList = el('ol', undefined, 'data-list');
  for (const trend of sorted.slice(3)) add(moreList, makeTrendRow(trend));
  add(more, moreList);
  const button = el('button', 'View all recurring experiences', 'small-action');
  button.type = 'button'; button.setAttribute('aria-expanded', 'false');
  more.id = 'allTrends'; button.setAttribute('aria-controls', more.id);
  button.addEventListener('click', () => { more.hidden = !more.hidden; button.setAttribute('aria-expanded', String(!more.hidden));
    button.textContent = more.hidden ? 'View all recurring experiences' : 'Show top 3 only'; });
  add(panel, button, more);
}
function movementRow(item) {
  const row = el('li', undefined, 'data-row movement-row');
  const heading = el('div', undefined, 'row-heading');
  add(heading, el('h4', item.name), el('span', item.label));
  const boxes = el('div', undefined, 'mini-grid');
  for (const [label, count, prevalence] of [
    ['Current · Jul–Sep', item.currentCount, item.currentPrevalence],
    ['Comparison · Apr–Jun', item.comparisonCount, item.comparisonPrevalence]
  ]) {
    const box = el('div'); add(box, el('strong', `${count} records`), el('span', `${label} · ${(prevalence * 100).toFixed(1)}% prevalence`)); add(boxes, box);
  }
  const change = item.percentageChange === null ? 'Percentage change unavailable without comparison observations' :
    `${item.percentageChange > 0 ? '+' : ''}${item.percentageChange.toFixed(1)}% record-count change`;
  add(row, heading, boxes, el('p', change, 'row-meta'), evidenceAction('Compare period evidence', item.name, [
    { label: 'Current · Jul–Sep', recordIds: item.currentRecordIds, context: 'Jul 1–Sep 30, 2026 · current period' },
    { label: 'Comparison · Apr–Jun', recordIds: item.comparisonRecordIds, context: 'Apr 1–Jun 30, 2026 · comparison period' }
  ]));
  return row;
}
function setMovement() {
  const counts = Object.groupBy ? Object.groupBy(data.movement, item => item.label) :
    data.movement.reduce((map, item) => { (map[item.label] ||= []).push(item); return map; }, {});
  document.getElementById('movementSummary').textContent = `${counts.Increasing?.length || 0} increasing · ${counts.Stable?.length || 0} stable · ${counts.Decreasing?.length || 0} decreasing · ${counts['New in selected comparison window']?.length || 0} new · ${counts['No longer observed in selected current period']?.length || 0} no longer observed`;
  const panel = document.getElementById('movementPanel');
  add(panel, el('p', `Current period: ${data.periodTotals.current} records · Comparison period: ${data.periodTotals.comparison} records. Prevalence uses each period’s analyzed feedback total.`, 'panel-intro'));
  const list = el('ol', undefined, 'data-list');
  for (const item of data.movement) add(list, movementRow(item));
  add(panel, list);
  const fee = data.movement.find(item => item.name === data.alternateLens.name);
  const feeAugSep = data.alternateLens.currentCount;
  const note = el('div', undefined, 'lens-note');
  add(note, el('p', 'Why counts and prevalence differ'),
    el('p', `Main comparison · ${fee.name}: ${fee.comparisonCount} → ${fee.currentCount} records, while prevalence moves ${(fee.comparisonPrevalence * 100).toFixed(2)}% → ${(fee.currentPrevalence * 100).toFixed(2)}%.`),
    el('p', `Alternate window · Aug–Sep (${data.alternateLens.currentTotal} records) versus Apr–Jun (${data.periodTotals.comparison} records): ${fee.comparisonCount} → ${feeAugSep} records, while prevalence moves ${(fee.comparisonPrevalence * 100).toFixed(2)}% → ${percent(feeAugSep, data.alternateLens.currentTotal, 2)}.`));
  add(panel, note);
}
function setEmerging() {
  const panel = document.getElementById('emergingPanel');
  document.getElementById('emergingSummary').textContent = `${data.emerging.length} candidate experiences need taxonomy review`;
  add(panel, el('p', 'Candidates are gaps in controlled taxonomy coverage. Labels describe placement, not recent growth.', 'panel-intro'));
  const list = el('ul', undefined, 'data-list');
  for (const candidate of data.emerging) {
    const row = el('li', undefined, 'data-row');
    add(row, el('span', candidate.gap, 'badge'), el('h4', candidate.name),
      el('p', `${candidate.supportingRecordCount} supporting records · ${candidate.coverage}`, 'row-meta'),
      evidenceList(candidate.evidenceIds), evidenceAction(`View ${candidate.supportingRecordCount} comments`,
        candidate.name, oneGroup(candidate.recordIds, 'Apr–Sep 2026 · taxonomy coverage candidate')));
    add(list, row);
  }
  add(panel, list);
}
function setMigration() {
  const migration = data.migration;
  document.getElementById('migrationSummary').textContent = `${migration.migrated} of ${migration.eligible} eligible digital-friction records sought assisted help · ${percent(migration.migrated, migration.eligible, 1)}`;
  const panel = document.getElementById('migrationPanel');
  const boxes = el('div', undefined, 'mini-grid');
  for (const [value, label] of [[migration.eligible, 'Eligible digital-friction records'], [migration.migrated, 'Migrated records']]) {
    const box = el('div'); add(box, el('strong', value), el('span', label)); add(boxes, box);
  }
  add(panel, boxes, el('p', 'Digital origins include Mobile App, Online Banking, Public Website and ATM. Card / Point of Sale is excluded.', 'panel-intro'));
  const breakdown = el('div', undefined, 'breakdown');
  for (const [heading, rows, render] of [
    ['Origin touchpoint', migration.origins, row => `${row.name}: ${row.eligible} eligible · ${row.migrated} migrated`],
    ['Assisted destination', migration.destinations, row => `${row.name}: ${row.migrated} migrated`]
  ]) {
    const section = el('section'); add(section, el('h4', heading));
    for (const row of rows) {
      add(section, el('p', render(row)));
      if (row.eligibleRecordIds) add(section, evidenceAction(`View ${row.eligible} eligible records`, `${row.name} digital origin`, [
        { label: 'Eligible', recordIds: row.eligibleRecordIds, context: 'Apr–Sep 2026 · eligible digital-friction feedback' },
        { label: 'Migrated', recordIds: row.migratedRecordIds, context: 'Apr–Sep 2026 · sought assisted help' }
      ]));
      else add(section, evidenceAction(`View ${row.migrated} migrated comments`, `${row.name} assisted destination`,
        oneGroup(row.recordIds, 'Apr–Sep 2026 · validated migration relationship')));
    }
    add(breakdown, section);
  }
  add(panel, breakdown);
  add(panel, el('h4', 'Leading migration drivers'), el('p', migration.drivers.map(item => `${item.name} (${item.migrated})`).join(' · '), 'row-meta'));
}
function showJourney(journey, target) {
  target.replaceChildren();
  add(target, el('h4', journey.name), el('p', `${journey.supportingRecordCount} supporting synthetic records across this journey opportunity. These are current-state observations; no owner or outcome is inferred.`, 'panel-intro'));
  const list = el('ol', undefined, 'data-list');
  for (const stage of journey.stages) {
    const row = el('li', undefined, 'data-row');
    add(row, el('h4', stage.label));
    if (!stage.evidenceIds.length) add(row, el('p', 'No feedback evidence observed', 'row-meta'));
    else {
      const first = byId.get(stage.evidenceIds[0]);
      add(row, el('p', `Current-state observation · ${first.text}`, 'row-meta'),
        el('p', `Evidence source · ${first.source} · ${first.touchpoint} · ${first.date} · ${first.id}`, 'row-meta'),
        evidenceList(stage.evidenceIds), evidenceAction(`View ${stage.recordIds.length} comments`,
          `${journey.name} / ${stage.label}`, oneGroup(stage.recordIds, 'Apr–Sep 2026 · current-state journey evidence')));
    }
    add(list, row);
  }
  add(target, list);
}
function setJourneys() {
  document.getElementById('journeySummary').textContent = `${data.journeys.length} experiences ready for current-state journey review`;
  const panel = document.getElementById('journeyPanel');
  add(panel, el('p', 'Select a journey to inspect its evidence-backed friction stages.', 'panel-intro'));
  const choices = el('div', undefined, 'journey-list');
  const target = el('div', undefined, 'journey-display'); target.id = 'journeyDisplay';
  for (const journey of data.journeys) {
    const button = el('button', undefined, 'journey-choice'); button.type = 'button';
    button.setAttribute('aria-pressed', 'false'); button.setAttribute('aria-controls', target.id);
    add(button, el('strong', journey.name), el('span', `${journey.supportingRecordCount} supporting records · View current-state evidence`));
    button.addEventListener('click', () => {
      for (const choice of choices.children) choice.setAttribute('aria-pressed', String(choice === button));
      showJourney(journey, target);
    });
    add(choices, button);
  }
  add(panel, choices, target);
}
let feedbackShown = 0;
function showFeedback() {
  const list = document.getElementById('feedbackList');
  for (const record of records.slice(feedbackShown, feedbackShown + 20)) add(list, feedbackCard(record));
  feedbackShown = Math.min(feedbackShown + 20, records.length);
  document.getElementById('feedbackCount').textContent = `Showing ${feedbackShown} of ${records.length} synthetic feedback records`;
  document.getElementById('moreFeedback').hidden = feedbackShown >= records.length;
}
function chartRow(label, value, max, onSelect, options = {}) {
  const button = el('button', undefined, 'chart-row');
  button.type = 'button';
  button.setAttribute('aria-label', options.accessibleLabel || `View ${format(value)} comments for ${label}`);
  const header = el('span', undefined, 'chart-label');
  add(header, el('span', label), el('span', format(value)));
  const track = el('span', undefined, 'chart-track'); track.setAttribute('aria-hidden', 'true');
  const fill = el('span', undefined, `chart-fill ${options.color || ''}`);
  fill.style.width = `${max ? 100 * value / max : 0}%`;
  add(track, fill); add(button, header, track);
  if (options.subline) add(button, el('span', options.subline, 'chart-subline'));
  button.addEventListener('click', () => onSelect(button));
  return button;
}
function pairedRow(item, max) {
  const button = el('button', undefined, 'chart-row movement-chart-row');
  button.type = 'button';
  button.setAttribute('aria-label', `Compare period evidence for ${item.name}; current ${item.currentCount}, comparison ${item.comparisonCount}`);
  const header = el('span', undefined, 'chart-label');
  add(header, el('span', item.name), el('span', item.label)); add(button, header);
  const bars = el('span', undefined, 'paired-bars'); bars.setAttribute('aria-hidden', 'true');
  for (const [kind, count, label] of [['current', item.currentCount, 'Current'], ['comparison', item.comparisonCount, 'Prior']]) {
    const line = el('span', undefined, kind);
    const track = el('span', undefined, 'chart-track'); const fill = el('span', undefined, 'chart-fill');
    fill.style.width = `${max ? 100 * count / max : 0}%`;
    add(track, fill); add(line, el('span', label), track, el('span', format(count))); add(bars, line);
  }
  add(button, bars, el('span', 'View current and comparison comments', 'chart-subline'));
  button.addEventListener('click', () => openEvidence(item.name, [
    { label: 'Current · Jul–Sep', recordIds: item.currentRecordIds, context: 'Jul 1–Sep 30, 2026 · current period' },
    { label: 'Comparison · Apr–Jun', recordIds: item.comparisonRecordIds, context: 'Apr 1–Jun 30, 2026 · comparison period' }
  ], button));
  return button;
}
function renderSentiment(canvas) {
  const visual = data.visuals.sentiment;
  const list = el('div', undefined, 'chart-list');
  for (const row of visual.rows) add(list, chartRow(row.label, row.count, data.summary.total,
    source => openEvidence(`${row.label} sentiment`, oneGroup(row.recordIds, 'Apr–Sep 2026 · sentiment classification'), source),
    { color: row.label.toLowerCase(), subline: `${percent(row.count, data.summary.total, 1)} of analyzed feedback`,
      accessibleLabel: `View ${row.count} ${row.label} comments` }));
  add(canvas, list);
}
function renderDomains(canvas) {
  const rows = data.visuals.domains.rows;
  const max = rows[0].count;
  const list = el('div', undefined, 'chart-list');
  const remainder = el('div', undefined, 'chart-list'); remainder.id = 'remainingDomains'; remainder.hidden = true;
  const make = row => chartRow(row.label, row.count, max,
    source => openEvidence(row.label, oneGroup(row.recordIds, 'Apr–Sep 2026 · primary Experience Taxonomy domain'), source),
    { accessibleLabel: `View ${row.count} comments in ${row.label}` });
  for (const row of rows.slice(0, 6)) add(list, make(row));
  for (const row of rows.slice(6)) add(remainder, make(row));
  add(canvas, list);
  if (rows.length > 6) {
    const more = el('button', `View all ${rows.length} domains`, 'chart-more');
    more.type = 'button'; more.setAttribute('aria-expanded', 'false'); more.setAttribute('aria-controls', remainder.id);
    more.addEventListener('click', () => { remainder.hidden = !remainder.hidden;
      more.setAttribute('aria-expanded', String(!remainder.hidden));
      more.textContent = remainder.hidden ? `View all ${rows.length} domains` : 'Show leading 6 only'; });
    add(canvas, more, remainder);
  }
  add(canvas, el('p', 'Primary domain, not feedback collection source. Records outside the controlled taxonomy remain available below.', 'chart-note'));
}
function renderMovementVisual(canvas) {
  const featured = ['Login Failure', 'Unexpected Fee', 'Service Wait Time',
    'Biometric Authentication Failure', 'Branch Queue'];
  const rows = featured.map(name => data.movement.find(item => item.name === name));
  const rest = data.movement.filter(item => !featured.includes(item.name));
  const max = Math.max(...data.movement.flatMap(item => [item.currentCount, item.comparisonCount]));
  const list = el('div', undefined, 'chart-list');
  for (const row of rows) add(list, pairedRow(row, max));
  add(canvas, list);
  const remainder = el('div', undefined, 'chart-list'); remainder.id = 'remainingMovement'; remainder.hidden = true;
  for (const row of rest) add(remainder, pairedRow(row, max));
  const more = el('button', `View all ${data.movement.length} trend comparisons`, 'chart-more');
  more.type = 'button'; more.setAttribute('aria-expanded', 'false'); more.setAttribute('aria-controls', remainder.id);
  more.addEventListener('click', () => { remainder.hidden = !remainder.hidden;
    more.setAttribute('aria-expanded', String(!remainder.hidden));
    more.textContent = remainder.hidden ? `View all ${data.movement.length} trend comparisons` : 'Show five examples only'; });
  add(canvas, more, remainder, el('p', 'Bars show supporting record counts. Current: Jul–Sep 2026 · Comparison: Apr–Jun 2026.', 'chart-note'));
}
function renderMigrationVisual(canvas) {
  const migration = data.migration;
  add(canvas, el('h4', 'Eligible digital-friction origins'));
  const origins = el('div', undefined, 'chart-list');
  for (const row of migration.origins) add(origins, chartRow(row.name, row.eligible, migration.eligible,
    source => openEvidence(`${row.name} digital origin`, [
      { label: 'Eligible', recordIds: row.eligibleRecordIds, context: 'Apr–Sep 2026 · eligible digital-friction feedback' },
      { label: 'Migrated', recordIds: row.migratedRecordIds, context: 'Apr–Sep 2026 · sought assisted help' }
    ], source), { subline: `${row.migrated} of these records sought assisted help`,
      accessibleLabel: `View ${row.eligible} eligible ${row.name} origin records; ${row.migrated} migrated` }));
  add(canvas, origins, el('p', 'Origins count eligible feedback, including records that did not migrate.', 'chart-note'),
    el('h4', 'Assisted destinations among migrated records'));
  const destinations = el('div', undefined, 'chart-list');
  for (const row of migration.destinations) add(destinations, chartRow(row.name, row.migrated, migration.migrated,
    source => openEvidence(`${row.name} assisted destination`, oneGroup(row.recordIds,
      'Apr–Sep 2026 · validated migration relationship'), source),
    { accessibleLabel: `View ${row.migrated} migrated comments with ${row.name} destination` }));
  add(canvas, destinations, el('p', 'The rate and distributions refer to eligible analyzed feedback records, not all members.', 'chart-note'));
}
function languageRow(theme) {
  const row = el('article', undefined, 'language-row');
  const heading = el('div', undefined, 'language-heading');
  add(heading, el('h4', theme.name), el('strong', `${theme.count} supporting comments`, 'language-count'));
  add(row, heading, el('p', `${theme.domain || 'Outside controlled taxonomy'}${theme.topTrend ? ' · Also in Top Trends' : ''}`, 'language-meta'));
  const common = el('div', undefined, 'language-common');
  add(common, el('span', 'Common language', 'language-label'));
  if (!theme.phrases.length) add(common, el('span', 'No dominant repeated phrase', 'language-empty'));
  else {
    const chips = el('div', undefined, 'language-chips');
    for (const phrase of theme.phrases) {
      const button = el('button', `“${phrase.phrase}” · ${phrase.count}`, 'language-phrase');
      button.type = 'button';
      button.setAttribute('aria-label', `View ${phrase.count} comments containing ${phrase.phrase} within ${theme.name}`);
      button.addEventListener('click', () => openEvidence(`“${phrase.phrase}”`, oneGroup(phrase.recordIds,
        `Apr–Sep 2026 · exact wording within ${theme.name}`), button));
      add(chips, button);
    }
    add(common, chips);
  }
  add(row, common, evidenceAction(`View ${theme.count} comments`, theme.name,
    oneGroup(theme.recordIds, `Apr–Sep 2026 · recurring language theme · ${theme.domain || 'Outside controlled taxonomy'}`)));
  return row;
}
function renderRecurringLanguage(canvas) {
  const list = el('div', undefined, 'language-list');
  for (const theme of data.recurringLanguage.slice(0, 6)) add(list, languageRow(theme));
  add(canvas, list);
  const remainder = el('div', undefined, 'language-list');
  remainder.id = 'remainingLanguage'; remainder.hidden = true;
  for (const theme of data.recurringLanguage.slice(6)) add(remainder, languageRow(theme));
  const more = el('button', 'View all recurring language', 'chart-more');
  more.type = 'button'; more.setAttribute('aria-expanded', 'false'); more.setAttribute('aria-controls', remainder.id);
  more.addEventListener('click', () => {
    remainder.hidden = !remainder.hidden;
    more.setAttribute('aria-expanded', String(!remainder.hidden));
    more.textContent = remainder.hidden ? 'View all recurring language' : 'Show top 6 only';
  });
  add(canvas, more, remainder);
}
function renderVisual(name) {
  if (!document.getElementById('evidencePanel').hidden) closeEvidence(false);
  const canvas = document.getElementById('visualCanvas');
  canvas.replaceChildren();
  const spec = name === 'phrases' ? languageConfig : data.visuals[name];
  add(canvas, el('h3', spec.title), el('p', spec.question, 'visual-question'),
    el('p', spec.caption, 'visual-caption'));
  ({ sentiment: renderSentiment, domains: renderDomains, movement: renderMovementVisual,
    migration: renderMigrationVisual, phrases: renderRecurringLanguage })[name](canvas);
  for (const button of document.querySelectorAll('[data-visual]'))
    button.setAttribute('aria-pressed', String(button.dataset.visual === name));
}
function setVisuals() {
  const toggle = document.getElementById('visualToggle');
  const panel = document.getElementById('visualPanel');
  toggle.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    toggle.setAttribute('aria-expanded', String(!panel.hidden));
    toggle.textContent = panel.hidden ? 'Explore visuals' : 'Hide visuals';
  });
  for (const button of document.querySelectorAll('[data-visual]'))
    button.addEventListener('click', () => renderVisual(button.dataset.visual));
  renderVisual('sentiment');
}
setSummary(); setTrends(); setMovement(); setEmerging(); setMigration(); setJourneys(); setVisuals(); installToggles();
document.getElementById('moreFeedback').addEventListener('click', showFeedback);
document.getElementById('moreEvidence').addEventListener('click', showEvidenceBatch);
document.getElementById('closeEvidence').addEventListener('click', () => closeEvidence());
const startExperience = document.getElementById('startExperience');
const resultsExperience = document.getElementById('resultsExperience');
document.getElementById('loadDemoButton').addEventListener('click', () => {
  startExperience.hidden = true;
  resultsExperience.hidden = false;
  document.getElementById('visualPanel').hidden = false;
  document.getElementById('visualToggle').setAttribute('aria-expanded', 'true');
  document.getElementById('visualToggle').textContent = 'Hide visuals';
  document.documentElement.scrollTop = 0;
  document.getElementById('summaryHeading').focus();
});
document.getElementById('newAnalysisButton').addEventListener('click', () => {
  closeEvidence(false);
  for (const button of document.querySelectorAll('.module-toggle, #feedbackToggle')) {
    button.setAttribute('aria-expanded', 'false');
    button.textContent = button.dataset.closed;
    document.getElementById(button.getAttribute('aria-controls')).hidden = true;
  }
  for (const details of resultsExperience.querySelectorAll('details')) details.open = false;
  const allTrends = document.getElementById('allTrends');
  allTrends.hidden = true;
  const allTrendsButton = document.querySelector('#trendsPanel .small-action');
  allTrendsButton.setAttribute('aria-expanded', 'false');
  allTrendsButton.textContent = 'View all recurring experiences';
  document.getElementById('journeyDisplay').replaceChildren();
  for (const button of document.querySelectorAll('.journey-choice')) button.setAttribute('aria-pressed', 'false');
  const feedbackPanel = document.getElementById('feedbackPanel');
  delete feedbackPanel.dataset.loaded;
  document.getElementById('feedbackList').replaceChildren();
  feedbackShown = 0;
  document.getElementById('feedbackCount').textContent = '';
  const visualToggle = document.getElementById('visualToggle');
  visualToggle.setAttribute('aria-expanded', 'false');
  visualToggle.textContent = 'Explore visuals';
  document.getElementById('visualPanel').hidden = true;
  renderVisual('sentiment');
  resultsExperience.hidden = true;
  startExperience.hidden = false;
  document.documentElement.scrollTop = 0;
  document.getElementById('startHeading').focus();
});
