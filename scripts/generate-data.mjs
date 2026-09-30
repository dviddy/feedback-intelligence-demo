import fs from 'node:fs';
import path from 'node:path';
import { createComment } from './voice-library.mjs';

// Deterministic, wholly synthetic demonstration data. This is presentation fixture generation.
const root = path.resolve(import.meta.dirname, '..');
const months = [
  ['2026-04', 180, 30], ['2026-05', 190, 31], ['2026-06', 190, 30],
  ['2026-07', 200, 31], ['2026-08', 210, 31], ['2026-09', 230, 30]
];
const trends = [
  ['Login Failure', 'Account Access & Identity', 24, 45, 'Online Banking', 'The sign-in screen rejected a valid login and I could not reach my account.'],
  ['Password Reset Failure', 'Account Access & Identity', 18, 20, 'Mobile App', 'The reset link did not arrive, so I could not regain access.'],
  ['Identity Verification Failure', 'Account Opening', 17, 24, 'Public Website', 'The identity check rejected my documents during account opening.'],
  ['Card Decline', 'Cards', 22, 26, 'Card / Point of Sale', 'My card was declined even though funds appeared available.'],
  ['Transfer Failure', 'Transfers & Payments', 17, 23, 'Online Banking', 'The transfer could not be completed and the reason was unclear.'],
  ['Service Wait Time', 'Support & Resolution', 37, 18, 'Contact Center / Phone', 'I waited longer than expected to speak with someone.'],
  ['Unexpected Fee', 'Fees & Pricing', 32, 35, 'Online Banking', 'A fee appeared on my account without a clear explanation.'],
  ['Resolution Failure', 'Support & Resolution', 22, 20, 'Contact Center / Phone', 'My issue remained open after a support conversation.'],
  ['Missing Notification', 'Communications & Notifications', 17, 18, 'Mobile App', 'I did not receive a notification after the transaction.'],
  ['Performance Issue', 'Digital Experience', 15, 18, 'Mobile App', 'The app was slow while I was trying to finish a task.'],
  ['Biometric Authentication Failure', 'Account Access & Identity', 0, 16, 'Mobile App', 'Biometric sign-in failed and I had to use another access method.'],
  ['Digital Wallet Provisioning Failure', 'Cards', 3, 12, 'Mobile App', 'My card could not be added to the digital wallet.'],
  ['Joint Account Digital Access Failure', 'Account Access & Identity', 4, 10, 'Online Banking', 'The joint account was not visible after I signed in.'],
  ['Transfer Recipient Setup Failure', 'Transfers & Payments', 6, 12, 'Online Banking', 'I could not save a new transfer recipient.'],
  ['Branch Queue', 'Support & Resolution', 12, 0, 'Branch', 'I waited at the branch before anyone could help.'],
  ['Fee Explanation', 'Fees & Pricing', 8, 5, 'Email', 'The fee explanation did not answer my question.'],
  ['Application Friction', 'Account Opening', 17, 20, 'Public Website', 'The account application was difficult to complete.'],
  ['Deposit Issue', 'Deposits & Account Servicing', 10, 8, 'ATM', 'A deposit did not appear when I expected it.'],
  ['Decision Delay', 'Lending', 11, 10, 'Email', 'I could not tell when I would hear about the loan decision.'],
  ['Fraud Alert', 'Fraud, Security & Disputes', 6, 9, 'SMS / Text', 'The fraud alert arrived without enough context to act.'],
  ['Financial Wellness Coaching Handoff', null, 7, 9, 'Branch', 'I was referred for financial coaching but could not find the next step.']
].map(([name, domain, comparison, current, touchpoint, text]) => ({ name, domain, comparison, current, touchpoint, text }));

const sourceFor = touchpoint => ({
  'Contact Center / Phone': 'Contact Center Transcript', Branch: 'Branch-Collected Feedback',
  Email: 'Email Message', Chat: 'Chat Transcript', 'Mobile App': 'App Store Review',
  'SMS / Text': 'Survey Response', 'Card / Point of Sale': 'Survey Response', ATM: 'Complaint Case',
  'Public Website': 'Survey Response', 'Online Banking': 'Survey Response'
})[touchpoint];
const sources = ['Survey Response', 'Contact Center Transcript', 'Complaint Case', 'Public Review',
  'App Store Review', 'Email Message', 'Chat Transcript', 'Branch-Collected Feedback'];
const touchpoints = ['Mobile App', 'Online Banking', 'Public Website', 'Branch',
  'Contact Center / Phone', 'Chat', 'Email', 'SMS / Text', 'ATM', 'Card / Point of Sale'];
const records = [];
const monthly = months.map(() => []);
const allocate = (total, weights) => {
  const counts = weights.map(weight => Math.floor(total * weight / weights.reduce((a, b) => a + b, 0)));
  for (let i = 0; counts.reduce((a, b) => a + b, 0) < total; i++) counts[i % counts.length]++;
  return counts;
};
for (const trend of trends) {
  const early = allocate(trend.comparison, months.slice(0, 3).map(m => m[1]));
  const late = trend.name === 'Unexpected Fee' ? [9, 13, 13] : allocate(trend.current, months.slice(3).map(m => m[1]));
  [...early, ...late].forEach((count, monthIndex) => {
    for (let i = 0; i < count; i++) monthly[monthIndex].push({ trend: trend.name, domain: trend.domain,
      touchpoint: trend.touchpoint, text: trend.text });
  });
}
for (let monthIndex = 0; monthIndex < months.length; monthIndex++) {
  const target = months[monthIndex][1];
  const gap = target - monthly[monthIndex].length;
  if (gap < 0) throw new Error(`Too many issue records in ${months[monthIndex][0]}`);
  for (let i = 0; i < gap; i++) monthly[monthIndex].push({ trend: null,
    domain: ['Deposits & Account Servicing', 'Lending', 'Cards', 'Digital Experience', 'Support & Resolution'][i % 5],
    touchpoint: touchpoints[(i * 7 + monthIndex) % touchpoints.length], text: null });
  monthly[monthIndex].forEach((draft, i) => {
    const index = records.length;
    const issue = Boolean(draft.trend);
    const sentiment = issue ? (i % 20 < 13 ? 'Negative' : 'Neutral') :
      (i % 20 < 14 ? 'Positive' : i % 20 < 19 ? 'Neutral' : 'Negative');
    const effort = ['Low', 'Medium', 'High'][(i * 7 + monthIndex + (issue ? 1 : 0)) % 7 < 2 ? 0 :
      (i * 7 + monthIndex + (issue ? 1 : 0)) % 7 < 5 ? 1 : 2];
    const priority = ['Low', 'Medium', 'High'][(i * 11 + monthIndex + (issue ? 2 : 0)) % 9 < 3 ? 0 :
      (i * 11 + monthIndex + (issue ? 2 : 0)) % 9 < 7 ? 1 : 2];
    const touchpoint = draft.touchpoint;
    const eligibleDigital = issue && ['Mobile App', 'Online Banking', 'Public Website', 'ATM'].includes(touchpoint);
    const migratedTo = eligibleDigital && (i * 3 + monthIndex * 7) % 5 === 0 ?
      ['Contact Center / Phone', 'Chat', 'Branch'][(index + i) % 3] : null;
    const source = issue ? (i % 5 === 0 ? sources[(i + monthIndex) % sources.length] : sourceFor(touchpoint)) :
      sources[(i * 3 + monthIndex) % sources.length];
    const text = createComment({ trend: draft.trend, sentiment, migratedTo, index });
    records.push({ id: `DEMO-${String(index + 1).padStart(4, '0')}`,
      date: `${months[monthIndex][0]}-${String(i % months[monthIndex][2] + 1).padStart(2, '0')}`,
      source, touchpoint, sentiment, effort, priority, domain: draft.domain, trend: draft.trend,
      eligibleDigital, migratedTo, text });
  });
}
const countBy = (rows, field) => Object.fromEntries([...new Set(rows.map(row => row[field]).filter(Boolean))]
  .sort().map(value => [value, rows.filter(row => row[field] === value).length]));
const summary = { total: records.length, sentiment: countBy(records, 'sentiment'),
  effort: countBy(records, 'effort'), priority: countBy(records, 'priority'),
  eligibleDigital: records.filter(r => r.eligibleDigital).length,
  migrated: records.filter(r => r.migratedTo).length };
const comparison = records.filter(r => r.date < '2026-07-01');
const current = records.filter(r => r.date >= '2026-07-01');
const movement = trends.map(trend => {
  const comparisonRecordIds = comparison.filter(r => r.trend === trend.name).map(r => r.id);
  const currentRecordIds = current.filter(r => r.trend === trend.name).map(r => r.id);
  const comparisonCount = comparisonRecordIds.length;
  const currentCount = currentRecordIds.length;
  const change = comparisonCount ? (currentCount - comparisonCount) / comparisonCount * 100 : null;
  const label = !comparisonCount ? 'New in selected comparison window' : !currentCount ?
    'No longer observed in selected current period' :
    (Math.abs(currentCount - comparisonCount) <= 1 || Math.abs(change) <= 10) ? 'Stable' :
      currentCount > comparisonCount ? 'Increasing' : 'Decreasing';
  return { name: trend.name, comparisonCount, currentCount, comparisonRecordIds, currentRecordIds,
    comparisonPrevalence: comparisonCount / comparison.length,
    currentPrevalence: currentCount / current.length, percentageChange: change, label };
});
const topTrends = trends.map(trend => {
  const supporting = records.filter(r => r.trend === trend.name);
  return { name: trend.name, domain: trend.domain, count: supporting.length,
    highPriorityCount: supporting.filter(r => r.priority === 'High').length,
    recordIds: supporting.map(r => r.id), evidenceIds: supporting.slice(0, 3).map(r => r.id) };
}).sort((a, b) => b.count - a.count).slice(0, 10);
const emerging = [
  ['Biometric Authentication Failure', 'Specificity Gap', 'Account Access & Identity / Login Failure'],
  ['Digital Wallet Provisioning Failure', 'Domain Gap', 'Cards'],
  ['Joint Account Digital Access Failure', 'Specificity Gap', 'Account Access & Identity / Login Failure'],
  ['Transfer Recipient Setup Failure', 'Specificity Gap', 'Transfers & Payments / Transfer Failure'],
  ['Financial Wellness Coaching Handoff', 'Unrepresented Experience', 'No controlled domain selected']
].map(([name, gap, coverage]) => ({ name, gap, coverage,
  supportingRecordCount: records.filter(r => r.trend === name).length,
  recordIds: records.filter(r => r.trend === name).map(r => r.id),
  evidenceIds: records.filter(r => r.trend === name).slice(0, 3).map(r => r.id) }));
const journeyDefinitions = [
  ['Digital Account Access', ['Login Failure', 'Password Reset Failure', 'Biometric Authentication Failure', 'Joint Account Digital Access Failure']],
  ['Account Opening', ['Identity Verification Failure', 'Application Friction']],
  ['Transfers & Payments', ['Transfer Failure', 'Transfer Recipient Setup Failure']],
  ['Cards', ['Card Decline', 'Digital Wallet Provisioning Failure']],
  ['Contact Center', ['Service Wait Time', 'Resolution Failure']]
];
const journeys = journeyDefinitions.map(([name, names]) => ({ name,
  supportingRecordCount: records.filter(r => names.includes(r.trend)).length,
  stages: names.map(trend => ({ label: trend, recordIds: records.filter(r => r.trend === trend).map(r => r.id),
    evidenceIds: records.filter(r => r.trend === trend).slice(0, 2).map(r => r.id) })) }));
const eligible = records.filter(r => r.eligibleDigital);
const migrated = records.filter(r => r.migratedTo);
const migration = {
  eligible: eligible.length, migrated: migrated.length,
  origins: ['Mobile App', 'Online Banking', 'Public Website', 'ATM'].map(name => ({ name,
    eligible: eligible.filter(r => r.touchpoint === name).length,
    migrated: migrated.filter(r => r.touchpoint === name).length,
    eligibleRecordIds: eligible.filter(r => r.touchpoint === name).map(r => r.id),
    migratedRecordIds: migrated.filter(r => r.touchpoint === name).map(r => r.id) })),
  destinations: ['Contact Center / Phone', 'Chat', 'Branch'].map(name => ({ name,
    migrated: migrated.filter(r => r.migratedTo === name).length,
    recordIds: migrated.filter(r => r.migratedTo === name).map(r => r.id) })),
  drivers: [...new Set(migrated.map(r => r.trend))].map(name => ({ name,
    migrated: migrated.filter(r => r.trend === name).length }))
    .sort((a, b) => b.migrated - a.migrated).slice(0, 3)
};
const alternateCurrent = records.filter(r => r.date >= '2026-08-01' && r.date <= '2026-09-30');
const phraseDefinitions = [
  ["couldn't log in", 'Login Failure'], ['reset link', 'Password Reset Failure'],
  ['identity check', 'Identity Verification Failure'], ['card was declined', 'Card Decline'],
  ["transfer didn't go through", 'Transfer Failure'], ['waited on hold', 'Service Wait Time'],
  ['monthly fee', 'Unexpected Fee'], ['still open', 'Resolution Failure'],
  ['transaction notification', 'Missing Notification'], ['app was slow', 'Performance Issue'],
  ['biometric sign-in failed', 'Biometric Authentication Failure'],
  ['transfer recipient', 'Transfer Recipient Setup Failure']
];
const phrases = phraseDefinitions.map(([phrase, trend], index) => {
  const supporting = records.filter(r => r.text.toLowerCase().includes(phrase));
  return { id: `phrase-${String(index + 1).padStart(2, '0')}`, phrase, trend,
    domain: supporting[0]?.domain || null, count: supporting.length,
    recordIds: supporting.map(r => r.id), evidenceIds: supporting.slice(0, 3).map(r => r.id) };
}).sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
const sentimentVisual = {
  title: 'Sentiment Mix', question: 'What is the overall experience mix?',
  caption: `${Math.round(100 * summary.sentiment.Negative / summary.total)}% of analyzed feedback reflects a negative experience.`,
  rows: ['Positive', 'Neutral', 'Negative'].map(label => ({ label,
    count: summary.sentiment[label], recordIds: records.filter(r => r.sentiment === label).map(r => r.id) }))
};
const domainNames = [...new Set(records.map(r => r.domain || 'Outside controlled taxonomy'))];
const domainVisual = {
  title: 'Experience Concentration', question: 'Where is feedback concentrated?',
  caption: 'Primary Experience Taxonomy domain assigned to each synthetic record; each record appears once.',
  rows: domainNames.map(label => ({ label, count: records.filter(r => (r.domain || 'Outside controlled taxonomy') === label).length,
    recordIds: records.filter(r => (r.domain || 'Outside controlled taxonomy') === label).map(r => r.id) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
};
const visuals = { sentiment: sentimentVisual, domains: domainVisual,
  movement: { title: 'Trend Movement', question: 'What changed between the selected periods?',
    caption: 'Supporting record counts compare Jul–Sep 2026 with Apr–Jun 2026.' },
  migration: { title: 'Digital → Assisted', question: 'Where does digital friction lead to assisted support?',
    caption: `${migrated.length} of ${eligible.length} eligible analyzed digital-friction records sought assisted help.` },
  phrases: { title: 'Key Phrases', question: 'What language recurs in feedback?',
    caption: 'Exact multi-word wording in synthetic comments; each record counts once per phrase.' } };
const data = { meta: { synthetic: true, startDate: '2026-04-01', endDate: '2026-09-30',
    current: ['2026-07-01', '2026-09-30'], comparison: ['2026-04-01', '2026-06-30'] },
  records, summary, topTrends, movement, periodTotals: { current: current.length, comparison: comparison.length },
  emerging, migration, journeys, phrases, visuals,
  alternateLens: { name: 'Unexpected Fee', comparison: ['2026-04-01', '2026-06-30'],
    current: ['2026-08-01', '2026-09-30'], currentTotal: alternateCurrent.length,
    currentCount: alternateCurrent.filter(r => r.trend === 'Unexpected Fee').length } };
fs.mkdirSync(path.join(root, 'data'), { recursive: true });
fs.writeFileSync(path.join(root, 'data', 'demo-data.js'), `window.FEEDBACK_DEMO_DATA = ${JSON.stringify(data)};\n`);
console.log(JSON.stringify({ monthly: Object.fromEntries(months.map(([month]) =>
  [month, records.filter(r => r.date.startsWith(month)).length])), summary, movement: countBy(movement, 'label'),
  bytes: fs.statSync(path.join(root, 'data', 'demo-data.js')).size }));
