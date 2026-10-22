const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const scripts = ['data/demo-data.js','data/recurring-language.js','presentation.js','data/journey-provenance.js','journey-model.js','executive-report-pdf.js','executive-report-adapter.js','demo.js'];
const keys = ['executive-summary','visual-intelligence','experience-intelligence','journey-mapping','recurring-language','detailed-feedback','about'];
function app(hash = '') {
  const dom = new JSDOM(read('index.html'), {url:'https://dviddy.github.io/feedback-intelligence-demo/' + hash, runScripts:'outside-only', pretendToBeVisual:true});
  const d = dom.window.document;
  for (const name of ['fetch','XMLHttpRequest','WebSocket']) dom.window[name] = () => { throw Error('Unexpected network'); };
  for (const file of scripts) dom.window.eval(read(file));
  if (!d.getElementById('startExperience').hidden) d.getElementById('loadDemoButton').click();
  const nav = key => d.querySelector(`.section-nav [data-workspace="${key}"]`).click();
  const visible = () => [...d.querySelectorAll('[data-workspace-view]')].filter(v=>!v.hidden).map(v=>v.dataset.workspaceView);
  const change = (id,value) => { d.getElementById(id).value=value;d.getElementById(id).dispatchEvent(new dom.window.Event('change')); };
  return {dom,d,nav,visible,change};
}
test('Seven independent workspaces expose exactly one primary view and one active navigation item', () => {
  const {dom,d,nav,visible} = app();
  for (const key of keys) {
    nav(key);assert.deepEqual(visible(),[key]); assert.equal(dom.window.location.hash,'#'+key);
    const current=d.querySelectorAll('.section-nav [aria-current]');assert.equal(current.length,1);assert.equal(current[0].dataset.workspace,key);
    assert.equal(d.getElementById('downloadReportButton').closest('[data-workspace-view]'),null);
    assert.equal(d.querySelectorAll('#periodForm').length,1);assert.equal(d.activeElement.id,d.querySelector(`[data-workspace-view="${key}"] h2`).id);
    assert.equal(dom.window.document.documentElement.scrollTop,0);
  }
  dom.window.close();
});
test('Direct canonical and legacy hashes restore the requested workspace, with safe unknown-hash fallback', () => {
  for (const [hash,key] of [...keys.map(k=>['#'+k,k]),['#summaryHeading','executive-summary'],['#visualHeading','visual-intelligence'],['#intelligenceHeading','experience-intelligence'],['#journeySectionHeading','journey-mapping'],['#feedbackHeading','detailed-feedback'],['#aboutHeading','about'],['#unknown','executive-summary'],['#constructor','executive-summary']]) {
    const {dom,d,visible} = app(hash);assert.deepEqual(visible(),[key]);assert.equal(d.getElementById('resultsExperience').hidden,false);assert.equal(dom.window.location.hash,'#'+key);dom.window.close();
  }
});
test('Browser Back and Forward restore the single active workspace without creating history entries', async () => {
  const {dom,nav,visible}=app();nav('visual-intelligence');nav('about');
  const travel = direction => new Promise(resolve=>{dom.window.addEventListener('popstate',()=>setTimeout(resolve,0),{once:true});dom.window.history[direction]();});
  const length=dom.window.history.length;
  await travel('back');assert.deepEqual(visible(),['visual-intelligence']);
  await travel('back');assert.deepEqual(visible(),['executive-summary']);
  await travel('forward');assert.deepEqual(visible(),['visual-intelligence']);assert.equal(dom.window.history.length,length);
  dom.window.close();
});
test('Applied period, comparison and unsubmitted date edits persist across every workspace',()=>{
  const {dom,d,nav,change}=app();change('periodPreset','q3');d.getElementById('compareEnabled').checked=true;change('comparisonPreset','q2');
  d.getElementById('periodForm').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));
  const total=d.getElementById('summaryMetrics').textContent, period=d.getElementById('activePeriod').textContent,form=d.getElementById('periodForm');
  change('comparisonPreset','custom');d.getElementById('comparisonStart').value='2026-04-02';
  for(const key of keys){nav(key);assert.equal(d.getElementById('periodForm'),form);assert.equal(d.getElementById('compareEnabled').checked,true);assert.equal(d.getElementById('comparisonStart').value,'2026-04-02');assert.equal(d.getElementById('activePeriod').textContent,period);assert.equal(d.getElementById('workspacePeriod').textContent,period);assert.equal(d.getElementById('summaryMetrics').textContent,total);}
  dom.window.close();
});
test('Visual tabs, custom journey selections, generated maps and feedback pagination survive navigation',()=>{
  const {dom,d,nav}=app();nav('visual-intelligence');d.querySelector('[data-visual="movement"]').click();const visual=d.getElementById('visualCanvas').firstChild;
  nav('journey-mapping');d.querySelectorAll('.journey-modes button')[2].click();d.querySelector('[data-experience="Password Reset Failure"] input').click();d.querySelector('.pain-point-generate').click();const map=d.querySelector('.member-journey');
  nav('detailed-feedback');d.getElementById('moreFeedback').click();const count=d.getElementById('feedbackCount').textContent;
  nav('recurring-language');nav('about');nav('journey-mapping');assert.equal(d.querySelector('.member-journey'),map);assert.equal(d.querySelector('[data-experience="Password Reset Failure"] input').checked,true);assert.equal(d.querySelectorAll('.journey-modes button')[2].getAttribute('aria-pressed'),'true');
  nav('visual-intelligence');assert.equal(d.getElementById('visualCanvas').firstChild,visual);assert.equal(d.querySelector('[data-visual="movement"]').getAttribute('aria-pressed'),'true');nav('detailed-feedback');assert.equal(d.getElementById('feedbackCount').textContent,count);assert.match(count,/40 of 1200/);dom.window.close();
});
test('Standalone recurring wording has exact evidence, unique IDs, retained expansion and current date scope',()=>{
  const {dom,d,nav,change}=app();nav('visual-intelligence');d.querySelector('[data-visual="phrases"]').click();nav('recurring-language');
  const phrase=d.querySelector('#languageCanvas .language-phrase');phrase.click();const ids=[...d.querySelectorAll('#evidenceList h3')].map(n=>n.textContent);assert.equal(ids.length,6);assert.equal(new Set(ids).size,6);assert.match(d.getElementById('evidenceContext').textContent,/exact wording within Login Failure/);
  d.getElementById('closeEvidence').click();assert.equal(d.activeElement,phrase);
  d.querySelector('#languageCanvas .chart-more').click();const expanded=d.querySelector('#remainingWorkspaceLanguage');assert.equal(expanded.hidden,false);nav('about');assert.equal(d.getElementById('evidencePanel').hidden,true);nav('recurring-language');assert.equal(d.querySelector('#remainingWorkspaceLanguage'),expanded);assert.equal(expanded.hidden,false);
  const idsInDom=[...d.querySelectorAll('[id]')].map(n=>n.id);assert.equal(new Set(idsInDom).size,idsInDom.length);
  change('periodPreset','30');d.getElementById('periodForm').dispatchEvent(new dom.window.Event('submit',{cancelable:true}));const currentPhrase=d.querySelector('#languageCanvas .language-phrase');if(currentPhrase){currentPhrase.click();assert.ok([...d.querySelectorAll('#evidenceList h3')].every(n=>dom.window.FEEDBACK_DEMO_DATA.records.find(r=>r.id===n.textContent).date>='2026-09-01'));}dom.window.close();
});
test('Report remains global and includes generated journeys while another workspace is active',()=>{
  const {dom,d,nav}=app();nav('journey-mapping');d.querySelector('.pain-point-generate').click();nav('about');let captured;
  dom.window.ExecutiveReportPdf.renderExecutiveReportPdf=model=>{captured=model;return {bytes:new Uint8Array([37,80,68,70]),filename:'report.pdf'};};
  dom.window.URL.createObjectURL=()=> 'blob:report';dom.window.URL.revokeObjectURL=()=>{};dom.window.HTMLAnchorElement.prototype.click=function(){};
  d.getElementById('downloadReportButton').click();assert.equal(captured.executiveSummary.total,1200);assert.equal(captured.journeys.length,2);assert.match(d.getElementById('reportStatus').textContent,/prepared locally/);dom.window.close();
});
test('Summary previews reuse existing ranked populations and the skip link preserves workspace navigation',()=>{
  const {dom,d,nav}=app();
  const preview=[...d.querySelectorAll('#summaryExperiences section')];
  assert.deepEqual([...preview[0].querySelectorAll('.summary-experience strong')].map(n=>n.textContent),['Login Failure','Unexpected Fee','Service Wait Time']);
  assert.deepEqual([...preview[1].querySelectorAll('.summary-experience strong')].map(n=>n.textContent),['Transfer Recipient Setup Failure','Biometric Authentication Failure','Financial Wellness Coaching Handoff']);
  nav('about');const hash=dom.window.location.hash;d.querySelector('.skip-link').click();assert.equal(dom.window.location.hash,hash);assert.equal(d.activeElement.id,'main');assert.equal(d.querySelector('[data-workspace-view="about"]').hidden,false);dom.window.close();
});
