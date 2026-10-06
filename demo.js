/* Lightweight presentation only. All feedback and intelligence figures are precomputed synthetic fixtures. */
const fixture = window.FEEDBACK_DEMO_DATA;
const languageConfig = window.FEEDBACK_RECURRING_LANGUAGE;
const presentation = window.FEEDBACK_DEMO_PRESENTATION;
let scope = { current: null, comparison: null };
let data = presentation.project(fixture, languageConfig, scope);
let records = data.records;
const byId = new Map(fixture.records.map(record => [record.id, record]));
const dateLabel = range => range ? `${range[0]} – ${range[1]}` : `${fixture.meta.startDate} – ${fixture.meta.endDate} · All Data`;
const currentContext = () => `${dateLabel(scope.current)} · selected synthetic feedback`;
const comparisonContext = () => `${dateLabel(scope.comparison)} · comparison synthetic feedback`;
const movementGroups = item => [
  { label: 'Current', recordIds: item.currentRecordIds, context: currentContext() },
  { label: 'Comparison', recordIds: item.comparisonRecordIds, context: comparisonContext(), comparison: true }
];
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
  const allowed = new Set((group.comparison ? fixture.records.filter(row => scope.comparison && row.date >= scope.comparison[0] && row.date <= scope.comparison[1]) : records).map(row => row.id));
  selectedEvidence = [...new Set(group.recordIds)].filter(id => allowed.has(id));
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
  details.addEventListener('toggle', () => {
    if (!details.open || details.dataset.loaded) return;
    const list = el('div', undefined, 'evidence');
    for (const id of ids) add(list, feedbackCard(byId.get(id)));
    add(details, list); details.dataset.loaded = 'true';
  });
  return details;
}
function setSummary() {
  const summary = data.summary;
  const metrics = [
    ['Feedback Analyzed', format(summary.total), 'Precomputed synthetic records', records.map(r => r.id)],
    ['Negative Share', percent(summary.sentiment.Negative, summary.total), `${format(summary.sentiment.Negative)} records`, records.filter(r => r.sentiment === 'Negative').map(r => r.id)],
    ['High Effort', format(summary.effort.High), `${percent(summary.effort.High, summary.total)} of selected feedback`, records.filter(r => r.effort === 'High').map(r => r.id)],
    ['High Priority', format(summary.priority.High), `${percent(summary.priority.High, summary.total)} of selected feedback`, records.filter(r => r.priority === 'High').map(r => r.id)],
    ['Established Trends', summary.established, 'Experience identities with selected-period evidence', data.establishedPresence.flatMap(r => r.recordIds)],
    ['Emerging Experiences', summary.emerging, 'Provisional identities with selected-period evidence', data.emerging.flatMap(r => r.recordIds)],
    ['Needs More Evidence', 'Not available', 'Withheld-signal assignments are not included in this fixture', null],
    ['Digital → Assisted', percent(summary.migrated, summary.eligibleDigital, 1), `${summary.migrated} of ${summary.eligibleDigital} eligible records`,
      null, [
        { label: 'Eligible', recordIds: data.migration.origins.flatMap(r => r.eligibleRecordIds), context: currentContext() + ' · eligible digital friction' },
        { label: 'Assisted contact', recordIds: data.migration.destinations.flatMap(r => r.recordIds), context: currentContext() + ' · validated assisted contact' }
      ]]
  ];
  for (const [label, value, context, ids, groups] of metrics) {
    const card = el('div', undefined, 'metric'); card.dataset.metric = label;
    add(card, el('div', label, 'metric-label'), el('div', value, 'metric-value'), el('div', context, 'metric-context'));
    if (ids || groups) add(card, evidenceAction(groups ? 'View eligible and assisted evidence' : `View ${format(ids.length)} comments`,
      label, groups || oneGroup(ids, currentContext())));
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
    evidenceAction(`View ${trend.count} comments`, trend.name, oneGroup(trend.recordIds, currentContext() + ' · Established Trend')));
  return row;
}
function setTrends() {
  const sorted = data.topTrends;
  document.getElementById('trendsSummary').textContent = `${data.establishedPresence.length} established identities · ${sorted.length} with recurring selected-period evidence`;
  const panel = document.getElementById('trendsPanel');
  add(panel, el('p', 'Governed, stable demo themes. Rankings require two selected-period comments; identity presence includes single observations.', 'panel-intro'));
  const list = el('ol', undefined, 'data-list');
  for (const trend of sorted.slice(0, 3)) add(list, makeTrendRow(trend));
  add(panel, list);
  if (!sorted.length) add(panel, el('p', 'No Established Trends have recurring evidence in this period.', 'empty-state'));
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
  for (const [label, count, prevalence] of [['Current', item.currentCount, item.currentPrevalence], ['Comparison', item.comparisonCount, item.comparisonPrevalence]]) {
    const box = el('div'); add(box, el('strong', `${count} records`), el('span', `${label} · ${(prevalence * 100).toFixed(1)}% prevalence`)); add(boxes, box);
  }
  const change = item.percentageChange === null ? 'Percentage change unavailable without comparison observations' :
    `${item.percentageChange > 0 ? '+' : ''}${item.percentageChange.toFixed(1)}% record-count change`;
  add(row, heading, boxes, el('p', change, 'row-meta'), evidenceAction('Compare period evidence', item.name, movementGroups(item)));
  return row;
}
function setMovement() {
  const counts = data.movement.reduce((map, item) => { map[item.label] = (map[item.label] || 0) + 1; return map; }, {});
  const note = data.comparisonAvailable ? `${counts.Increasing || 0} increasing · ${counts.Stable || 0} stable · ${counts.Decreasing || 0} decreasing · ${counts['New in selected comparison window'] || 0} new · ${counts['No longer observed in selected current period'] || 0} no longer observed` :
    scope.comparison ? 'No comparison available for these periods' : 'Choose dates and enable comparison to see movement';
  document.getElementById('movementSummary').textContent = note;
  document.getElementById('movementPeriod').textContent = scope.comparison ? `Current: ${dateLabel(scope.current)} · Comparison: ${dateLabel(scope.comparison)}` : 'Comparison is off';
  const panel = document.getElementById('movementPanel');
  add(panel, el('p', `Current period: ${data.periodTotals.current} records · Comparison period: ${data.periodTotals.comparison} records. Prevalence uses each period’s analyzed feedback total.`, 'panel-intro'));
  if (!data.comparisonAvailable) add(panel, el('p', note + '. Select two nonoverlapping periods with feedback.', 'empty-state'));
  const list = el('ol', undefined, 'data-list');
  for (const item of data.movement) add(list, movementRow(item));
  add(panel, list, el('p', 'Movement is descriptive: increasing, decreasing, stable, new or no longer observed. Stable means a count difference of one or less, or a change of 10% or less. It does not imply statistical significance. Emerging identities are not compared.', 'chart-note'));
}
function setEmerging() {
  const panel = document.getElementById('emergingPanel');
  document.getElementById('emergingSummary').textContent = `${data.emerging.length} provisional experiences with selected-period evidence`;
  add(panel, el('p', 'Provisional recurring experiences from the static fixture. A single selected-period observation indicates presence only, not fresh confirmation. Nothing is promoted automatically.', 'panel-intro'));
  const list = el('ul', undefined, 'data-list');
  if (!data.emerging.length) add(panel, el('p', 'No Emerging Experiences are observed in this period. Feedback remains available in Detailed Feedback.', 'empty-state'));
  for (const candidate of data.emerging) {
    const row = el('li', undefined, 'data-row');
    add(row, el('span', candidate.gap, 'badge'), el('h4', candidate.name),
      el('p', `${candidate.supportingRecordCount} supporting records · ${candidate.coverage}${candidate.count < 2 ? ' · Presence only in this period' : ''}`, 'row-meta'),
      evidenceList(candidate.evidenceIds), evidenceAction(`View ${candidate.supportingRecordCount} comments`,
        candidate.name, oneGroup(candidate.recordIds, currentContext() + ' · provisional experience')));
    add(list, row);
  }
  add(panel, list);
}
function setNeedsEvidence() {
  document.getElementById('needsSummary').textContent = 'Withheld-signal data is not included in this synthetic fixture';
  const panel = document.getElementById('needsPanel');
  add(panel, el('p', 'Needs More Evidence preserves signals that need stronger support before confirmed trend reporting. These signals are available for analyst review; they are not discarded feedback or confirmed trends.', 'panel-intro'),
    el('p', 'This fixture contains no withheld-signal assignments. Its count and evidence are unavailable. General feedback without a grouped experience has not been reclassified into this category.', 'empty-state'));
}
function setMigration() {
  const migration = data.migration;
  document.getElementById('migrationSummary').textContent = `${migration.migrated} of ${migration.eligible} eligible digital-friction records include validated assisted contact · ${percent(migration.migrated, migration.eligible, 1)}`;
  const panel = document.getElementById('migrationPanel');
  if (!migration.eligible) add(panel, el('p', 'No eligible digital-friction evidence in this period; a rate is unavailable.', 'empty-state'));
  else if (!migration.migrated) add(panel, el('p', 'No validated assisted contact observed among selected eligible records.', 'empty-state'));
  const boxes = el('div', undefined, 'mini-grid');
  for (const [value, label] of [[migration.eligible, 'Eligible digital-friction records'], [migration.migrated, 'Migrated records']]) {
    const box = el('div'); add(box, el('strong', value), el('span', label)); add(boxes, box);
  }
  add(panel, boxes, el('p', 'Eligible digital friction → validated assisted-service contact within the same synthetic comment. Digital origins include Mobile App, Online Banking, Public Website and ATM; Card / Point of Sale is excluded. This is not a causal or population-wide migration measure.', 'panel-intro'));
  const breakdown = el('div', undefined, 'breakdown');
  for (const [heading, rows, render] of [
    ['Origin touchpoint', migration.origins, row => `${row.name}: ${row.eligible} eligible · ${row.migrated} migrated`],
    ['Assisted destination', migration.destinations, row => `${row.name}: ${row.migrated} migrated`]
  ]) {
    const section = el('section'); add(section, el('h4', heading));
    for (const row of rows) {
      add(section, el('p', render(row)));
      if (row.eligibleRecordIds) add(section, evidenceAction(`View ${row.eligible} eligible records`, `${row.name} digital origin`, [
        { label: 'Eligible', recordIds: row.eligibleRecordIds, context: currentContext() + ' · eligible digital friction' },
        { label: 'Migrated', recordIds: row.migratedRecordIds, context: currentContext() + ' · validated assisted contact' }
      ]));
      else add(section, evidenceAction(`View ${row.migrated} migrated comments`, `${row.name} assisted destination`,
        oneGroup(row.recordIds, currentContext() + ' · validated assisted contact')));
    }
    add(breakdown, section);
  }
  add(panel, breakdown);
  add(panel, el('h4', 'Leading migration drivers'), el('p', migration.drivers.map(item => `${item.name} (${item.migrated})`).join(' · '), 'row-meta'));
}
function showJourney(journey, target) {
  target.replaceChildren();
  add(target, el('h4', journey.name), el('p', `${journey.supportingRecordCount} selected-period synthetic records. These are evidenced friction themes within a journey, not a reconstructed individual sequence. No owner or outcome is inferred.`, 'panel-intro'));
  const list = el('ol', undefined, 'data-list');
  for (const stage of journey.stages) {
    const row = el('li', undefined, 'data-row');
    add(row, el('h4', stage.label), el('p', `${stage.recordIds.length} records · ${stage.negative} negative · ${stage.highEffort} high effort · ${stage.highPriority} high priority`, 'row-meta'));
    if (!stage.evidenceIds.length) add(row, el('p', 'No feedback evidence observed', 'row-meta'));
    else {
      const first = byId.get(stage.evidenceIds[0]);
      add(row, el('p', `Current-state observation · ${first.text}`, 'row-meta'),
        el('p', `Evidence source · ${first.source} · ${first.touchpoint} · ${first.date} · ${first.id}`, 'row-meta'),
        evidenceList(stage.evidenceIds), evidenceAction(`View ${stage.recordIds.length} comments`,
          `${journey.name} / ${stage.label}`, oneGroup(stage.recordIds, currentContext() + ' · current-state journey evidence')));
    }
    add(list, row);
  }
  add(target, list);
}
function showJourneyMap(journey, target) {
  target.replaceChildren();
  add(target, el('h4', `${journey.name} · Current-State Journey Map`),
    el('p', 'Evidence-backed friction themes, not a reconstructed individual sequence.', 'panel-intro'));
  const map = el('ul', undefined, 'journey-map-grid');
  for (const stage of journey.stages) {
    const card = el('li', undefined, 'journey-map-card');
    add(card, el('h4', stage.label),
      el('p', `${stage.recordIds.length} supporting records`, 'row-meta'),
      el('p', `${stage.negative} negative · ${stage.highEffort} high effort · ${stage.highPriority} high priority`, 'row-meta'));
    const details = el('details');
    add(details, el('summary', 'View current-state detail and evidence'));
    const rows = stage.recordIds.map(id => byId.get(id));
    const touchpoints = [...new Set(rows.map(row => row.touchpoint))];
    if (touchpoints.length) add(details, el('p', `Touchpoints · ${touchpoints.join(' · ')}`, 'row-meta'));
    if (stage.evidenceIds.length) {
      add(details, el('p', `Supporting observation · ${byId.get(stage.evidenceIds[0]).text}`, 'row-meta'),
        evidenceList(stage.evidenceIds), evidenceAction(`View ${stage.recordIds.length} comments`,
          `${journey.name} / ${stage.label}`, oneGroup(stage.recordIds, currentContext() + ' · current-state journey evidence')));
    } else add(details, el('p', 'No feedback evidence observed in this period.', 'row-meta'));
    add(card, details); add(map, card);
  }
  add(target, map);
}
function setJourneys() {
  document.getElementById('journeySummary').textContent = `${data.journeys.length} experiences ready for current-state journey review`;
  const panel = document.getElementById('journeyPanel');
  add(panel, el('p', 'Select an experience to review current-state friction, then generate an evidence-backed journey map from the included synthetic feedback.', 'panel-intro'));
  if (!data.journeys.length) add(panel, el('p', 'No journey evidence is available in this period.', 'empty-state'));
  const choices = el('div', undefined, 'journey-list');
  const target = el('div', undefined, 'journey-display'); target.id = 'journeyDisplay';
  for (const journey of data.journeys) {
    const button = el('button', undefined, 'journey-choice'); button.type = 'button';
    button.setAttribute('aria-pressed', 'false'); button.setAttribute('aria-controls', target.id);
    add(button, el('strong', journey.name), el('span', `${journey.supportingRecordCount} supporting records · View current-state evidence`));
    button.addEventListener('click', () => {
      for (const choice of choices.children) choice.setAttribute('aria-pressed', String(choice === button));
      closeEvidence(false);
      showJourney(journey, target);
      const action = el('button', 'Generate Journey Map →', 'journey-generate'); action.type = 'button';
      action.setAttribute('aria-controls', 'generatedJourneyMap'); action.setAttribute('aria-expanded', 'false');
      const status = el('p', undefined, 'row-meta'); status.setAttribute('role', 'status');
      const output = el('section', undefined, 'generated-journey-map'); output.id = 'generatedJourneyMap'; output.hidden = true;
      output.setAttribute('aria-label', `${journey.name} current-state journey map`);
      action.addEventListener('click', () => {
        showJourneyMap(journey, output); output.hidden = false;
        action.textContent = 'Journey Map Generated'; action.setAttribute('aria-expanded', 'true'); action.disabled = true;
        status.textContent = `${journey.name} current-state journey map is ready.`;
      });
      add(target, action, status, output);
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
  button.addEventListener('click', () => openEvidence(item.name, movementGroups(item), button));
  return button;
}
function renderSentiment(canvas) {
  const visual = data.visuals.sentiment;
  const list = el('div', undefined, 'chart-list');
  for (const row of visual.rows) add(list, chartRow(row.label, row.count, data.summary.total,
    source => openEvidence(`${row.label} sentiment`, oneGroup(row.recordIds, currentContext() + ' · sentiment classification'), source),
    { color: row.label.toLowerCase(), subline: `${percent(row.count, data.summary.total, 1)} of analyzed feedback`,
      accessibleLabel: `View ${row.count} ${row.label} comments` }));
  add(canvas, list);
}
function renderDomains(canvas) {
  for (const [title, rows] of [['Established Trends', data.established], ['Emerging Experiences', data.emerging.filter(row => row.count >= 2).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))]]) {
    const section = el('section', undefined, 'concentration-group'); add(section, el('h4', title));
    if (!rows.length) add(section, el('p', `No ${title} meet the recurring threshold in this period.`, 'empty-state'));
    const make = row => chartRow(row.name, row.count, Math.max(...rows.map(item => item.count), 1),
      source => openEvidence(row.name, oneGroup(row.recordIds, currentContext() + ' · ' + title), source),
      { subline: `${percent(row.count, records.length, 1)} of selected feedback`, accessibleLabel: `View ${row.count} comments for ${row.name} · ${title}` });
    const list = el('div', undefined, 'chart-list');
    for (const row of rows.slice(0, 6)) add(list, make(row));
    add(section, list);
    if (rows.length > 6) {
      const more = el('button', `View all ${rows.length} ${title.toLowerCase()}`, 'chart-more'); more.type = 'button';
      const remaining = el('div', undefined, 'chart-list'); remaining.id = 'remainingDomains'; remaining.hidden = true;
      more.setAttribute('aria-expanded', 'false'); more.setAttribute('aria-controls', remaining.id);
      more.addEventListener('click', () => {
        remaining.hidden = !remaining.hidden;
        more.setAttribute('aria-expanded', String(!remaining.hidden));
        if (!remaining.hidden && !remaining.dataset.loaded) {
          for (const row of rows.slice(6)) add(remaining, make(row)); remaining.dataset.loaded = 'true';
        }
      });
      add(section, more, remaining);
    }
    add(canvas, section);
  }
  add(canvas, el('p', 'Needs More Evidence stays outside ranked experience charts. General ungrouped feedback remains in Detailed Feedback.', 'chart-note'));
}
function renderMovementVisual(canvas) {
  if (!data.comparisonAvailable) {
    add(canvas, el('p', scope.comparison ? 'No comparison data available. Select two periods containing feedback.' : 'Comparison is off. Choose a dated period and enable comparison above.', 'empty-state'));
    return;
  }
  const max = Math.max(...data.movement.flatMap(item => [item.currentCount, item.comparisonCount]), 1);
  const list = el('div', undefined, 'chart-list');
  for (const row of data.movement.slice(0, 5)) add(list, pairedRow(row, max));
  add(canvas, list);
  const remainder = el('div', undefined, 'chart-list'); remainder.id = 'remainingMovement'; remainder.hidden = true;
  const more = el('button', `View all ${data.movement.length} established comparisons`, 'chart-more');
  more.type = 'button'; more.setAttribute('aria-expanded', 'false'); more.setAttribute('aria-controls', remainder.id);
  more.addEventListener('click', () => { remainder.hidden = !remainder.hidden;
    more.setAttribute('aria-expanded', String(!remainder.hidden));
    if (!remainder.hidden && !remainder.dataset.loaded) { for (const row of data.movement.slice(5)) add(remainder, pairedRow(row, max)); remainder.dataset.loaded = 'true'; }
  });
  add(canvas, more, remainder, el('p', `Current: ${dateLabel(scope.current)} · Comparison: ${dateLabel(scope.comparison)}. Bars show counts; prevalence is available in Experience Intelligence.`, 'chart-note'),
    el('p', 'Possible movement states: increasing · decreasing · stable · new · no longer observed. Zero observations do not imply resolution.', 'chart-note'));
}
function renderMigrationVisual(canvas) {
  const migration = data.migration;
  if (!migration.eligible || !migration.migrated) add(canvas, el('p', !migration.eligible ? 'No eligible digital-friction evidence; rate unavailable.' : 'No validated assisted contact in this period.', 'empty-state'));
  add(canvas, el('h4', 'Eligible digital-friction origins'));
  const origins = el('div', undefined, 'chart-list');
  for (const row of migration.origins) add(origins, chartRow(row.name, row.eligible, migration.eligible,
    source => openEvidence(`${row.name} digital origin`, [
      { label: 'Eligible', recordIds: row.eligibleRecordIds, context: currentContext() + ' · eligible digital friction' },
      { label: 'Migrated', recordIds: row.migratedRecordIds, context: currentContext() + ' · validated assisted contact' }
    ], source), { subline: `${row.migrated} of these records sought assisted help`,
      accessibleLabel: `View ${row.eligible} eligible ${row.name} origin records; ${row.migrated} migrated` }));
  add(canvas, origins, el('p', 'Origins count eligible feedback, including records that did not migrate.', 'chart-note'),
    el('h4', 'Assisted destinations among migrated records'));
  const destinations = el('div', undefined, 'chart-list');
  for (const row of migration.destinations) add(destinations, chartRow(row.name, row.migrated, migration.migrated,
    source => openEvidence(`${row.name} assisted destination`, oneGroup(row.recordIds,
      currentContext() + ' · validated assisted contact'), source),
    { accessibleLabel: `View ${row.migrated} migrated comments with ${row.name} destination` }));
  add(canvas, destinations, el('p', 'The rate and distributions refer to eligible analyzed feedback records, not all members.', 'chart-note'));
}
function languageRow(theme) {
  const row = el('article', undefined, 'language-row');
  const heading = el('div', undefined, 'language-heading');
  add(heading, el('h4', theme.name), el('strong', `${theme.count} supporting comments`, 'language-count'));
  add(row, heading, el('p', `${theme.domain || 'Outside controlled taxonomy'} · ${theme.kind}`, 'language-meta'));
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
        `${currentContext()} · exact wording within ${theme.name}`), button));
      add(chips, button);
    }
    add(common, chips);
  }
  add(row, common, evidenceAction(`View ${theme.count} comments`, theme.name,
    oneGroup(theme.recordIds, `${currentContext()} · ${theme.kind} recurring experience`)));
  return row;
}
function renderRecurringLanguage(canvas) {
  const themes = data.recurringLanguage;
  add(canvas, el('p', 'Exact repeated wording within Established and Emerging experiences. Each phrase needs three distinct selected-period comments; counts may overlap.', 'chart-note'));
  if (!themes.length) { add(canvas, el('p', 'No recurring language meets the three-comment threshold in this period.', 'empty-state')); return; }
  const list = el('div', undefined, 'language-list');
  for (const theme of themes.slice(0, 6)) add(list, languageRow(theme));
  add(canvas, list);
  const remainder = el('div', undefined, 'language-list'); remainder.id = 'remainingLanguage'; remainder.hidden = true;
  if (themes.length > 6) {
    const more = el('button', 'View all recurring language', 'chart-more');
    more.type = 'button'; more.setAttribute('aria-expanded', 'false'); more.setAttribute('aria-controls', remainder.id);
    more.addEventListener('click', () => {
      remainder.hidden = !remainder.hidden; more.setAttribute('aria-expanded', String(!remainder.hidden));
      if (!remainder.hidden && !remainder.dataset.loaded) { for (const theme of themes.slice(6)) add(remainder, languageRow(theme)); remainder.dataset.loaded = 'true'; }
      more.textContent = remainder.hidden ? 'View all recurring language' : 'Show top 6 only';
    });
    add(canvas, more, remainder);
  }
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
function refreshPeriod() {
  const activeVisual = document.querySelector('[data-visual][aria-pressed="true"]')?.dataset.visual || 'sentiment';
  data = presentation.project(fixture, languageConfig, scope); records = data.records;
  closeEvidence(false);
  for (const id of ['summaryMetrics', 'distribution', 'trendsPanel', 'movementPanel', 'emergingPanel', 'migrationPanel', 'needsPanel', 'journeyPanel', 'feedbackList'])
    document.getElementById(id).replaceChildren();
  feedbackShown = 0; document.getElementById('feedbackCount').textContent = '';
  delete document.getElementById('feedbackPanel').dataset.loaded;
  setSummary(); setTrends(); setMovement(); setEmerging(); setMigration(); setNeedsEvidence(); setJourneys(); renderVisual(activeVisual);
  if (!document.getElementById('feedbackPanel').hidden) { showFeedback(); document.getElementById('feedbackPanel').dataset.loaded = 'true'; }
  document.getElementById('activePeriod').textContent = dateLabel(scope.current);
  document.getElementById('activeTotal').textContent = `${format(records.length)} analyzed feedback records`;
  document.getElementById('dateStatus').textContent = `${format(records.length)} selected records · All 1,200 fixture dates are usable. ${scope.comparison ? `${data.periodTotals.comparison} comparison records (${dateLabel(scope.comparison)}).` : 'Comparison is off.'}`;
}
function configureDates() {
  const preset = document.getElementById('periodPreset').value;
  const start = document.getElementById('currentStart'), end = document.getElementById('currentEnd');
  start.disabled = end.disabled = preset !== 'custom';
  const ranges = { '30': ['2026-09-01', '2026-09-30'], '90': ['2026-07-03', '2026-09-30'], q3: ['2026-07-01', '2026-09-30'] };
  if (preset === 'all') [start.value, end.value] = [fixture.meta.startDate, fixture.meta.endDate];
  else if (ranges[preset]) [start.value, end.value] = ranges[preset];
  const enabled = document.getElementById('compareEnabled'); enabled.disabled = preset === 'all';
  if (enabled.disabled) enabled.checked = false;
  const comparisonPreset = document.getElementById('comparisonPreset'); comparisonPreset.disabled = !enabled.checked;
  const cs = document.getElementById('comparisonStart'), ce = document.getElementById('comparisonEnd');
  cs.disabled = ce.disabled = !enabled.checked || comparisonPreset.value !== 'custom';
  if (enabled.checked && comparisonPreset.value !== 'custom') {
    try { [cs.value, ce.value] = comparisonPreset.value === 'q2' ? ['2026-04-01', '2026-06-30'] : presentation.previous([start.value, end.value]); } catch { /* Validation on Apply keeps existing results intact. */ }
  }
}
for (const id of ['periodPreset', 'compareEnabled', 'comparisonPreset', 'currentStart', 'currentEnd']) document.getElementById(id).addEventListener('change', configureDates);
document.getElementById('periodForm').addEventListener('submit', event => {
  event.preventDefault();
  const next = { current: document.getElementById('periodPreset').value === 'all' ? null : [document.getElementById('currentStart').value, document.getElementById('currentEnd').value],
    comparison: document.getElementById('compareEnabled').checked ? [document.getElementById('comparisonStart').value, document.getElementById('comparisonEnd').value] : null };
  const error = document.getElementById('dateError');
  try { presentation.validateScope(next); scope = next; error.hidden = true; refreshPeriod(); }
  catch (failure) { error.textContent = failure.message; error.hidden = false; }
});
configureDates(); refreshPeriod(); setVisuals(); installToggles();
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
  scope = { current: null, comparison: null };
  document.getElementById('periodPreset').value = 'all';
  document.getElementById('compareEnabled').checked = false;
  document.getElementById('comparisonPreset').value = 'previous';
  document.getElementById('dateError').hidden = true;
  configureDates(); refreshPeriod();
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
