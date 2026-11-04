const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const read = name => fs.readFileSync(path.join(__dirname,'..',name),'utf8');
function app(mutate) {
  const dom = new JSDOM(read('index.html'),{url:'https://example.test/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,d=w.document;
  w.fetch=()=>{throw Error('Unexpected network');};
  for(const file of ['data/demo-data.js','data/recurring-language.js','presentation.js','data/journey-provenance.js','journey-model.js','executive-report-pdf.js','executive-report-adapter.js','demo.js']) {
    if(file==='demo.js' && mutate) mutate(w.FEEDBACK_DEMO_DATA);
    w.eval(read(file));
  }
  d.getElementById('loadDemoButton').click();
  const change=(id,value)=>{const node=d.getElementById(id);if(typeof value==='boolean')node.checked=value;else node.value=value;node.dispatchEvent(new w.Event('change'));};
  const apply=()=>d.getElementById('periodForm').dispatchEvent(new w.Event('submit',{cancelable:true}));
  return {dom,w,d,change,apply};
}
function allEvidenceIds(d) {
  const more = d.getElementById('moreEvidence');
  while (!more.hidden) more.click();
  return [...d.querySelectorAll('#evidenceList .feedback-card h3')].map(node => node.textContent).sort();
}
test('Legacy summary measures remain directly visible in original order alongside the restored explanation',()=>{
  const {dom,d}=app();
  const metrics=d.getElementById('summaryMetrics');
  assert.equal(metrics.closest('[data-workspace-view]').hidden,false);
  assert.equal(metrics.closest('details, [hidden]'),null);
  assert.deepEqual([...metrics.querySelectorAll('.metric-label')].map(node=>node.textContent),[
    'Feedback Analyzed','Negative Share','High Effort','High Priority','Established Trends',
    'Emerging Experiences','Needs More Evidence','Digital → Assisted'
  ]);
  assert.equal(d.querySelector('.executive-support > p').textContent,
    'Selected-period record measures and experience identities. These describe feedback, not all members.');
  assert.equal(d.querySelector('.legacy-summary'),null);
  assert.equal(metrics.parentElement.previousElementSibling.className,'executive-qualifier');
  assert.equal(metrics.parentElement.nextElementSibling.id,'positiveSignals');
  assert.equal(d.querySelectorAll('.executive-kpi').length,4);
  dom.window.close();
});
test('Fresh load and New Analysis default to dataset-relative adjacent inclusive 90-day windows',()=>{
  const {dom,d,w}=app();
  assert.equal(d.getElementById('compareEnabled').checked,true);
  assert.equal(d.getElementById('currentStart').value,'2026-07-03');
  assert.equal(d.getElementById('currentEnd').value,'2026-09-30');
  assert.equal(d.getElementById('comparisonStart').value,'2026-04-04');
  assert.equal(d.getElementById('comparisonEnd').value,'2026-07-02');
  const rows=w.FEEDBACK_DEMO_DATA.records;
  for(const [a,b] of [['currentStart','currentEnd'],['comparisonStart','comparisonEnd']])assert.equal((Date.parse(d.getElementById(b).value)-Date.parse(d.getElementById(a).value))/86400000+1,90);
  const n=(a,b)=>rows.filter(r=>r.date>=a&&r.date<=b).length;
  assert.match(d.getElementById('executivePeriods').textContent,new RegExp(`${n('2026-07-03','2026-09-30')} analyzed.*${n('2026-04-04','2026-07-02')} analyzed`));
  d.getElementById('newAnalysisButton').click();assert.equal(d.getElementById('compareEnabled').checked,true);assert.equal(d.getElementById('periodPreset').value,'90');dom.window.close();
});
test('Four shares, unrounded pp deltas, semantics and each current/previous evidence population reconcile',()=>{
  const {dom,d,w}=app();const rows=w.FEEDBACK_DEMO_DATA.records;
  const current=rows.filter(r=>r.date>='2026-07-03'),previous=rows.filter(r=>r.date>='2026-04-04'&&r.date<='2026-07-02');
  const cards=[...d.querySelectorAll('.executive-kpi')];
  assert.deepEqual(cards.map(card=>card.dataset.kpi),['Negative sentiment','High effort','High priority','Positive sentiment']);
  assert.ok(cards.every(card=>!card.querySelector('i, svg, img')));
  for(const [i,field,value,positive] of [[0,'sentiment','Negative',false],[1,'effort','High',false],[2,'priority','High',false],[3,'sentiment','Positive',true]]){
    const c=current.filter(r=>r[field]===value),p=previous.filter(r=>r[field]===value),a=c.length/current.length*100,b=p.length/previous.length*100,delta=a-b,card=cards[i];
    assert.equal(card.querySelector('.executive-value').textContent,`${a.toFixed(0)}%`);
    assert.match(card.textContent,new RegExp(`From ${b.toFixed(0)}%`));
    const stable=Math.abs(delta)<.5||a.toFixed(0)===b.toFixed(0);
    assert.equal(card.querySelector('.executive-delta').textContent,stable?'Stable at displayed precision':`${delta>0?'Up':'Down'} ${Math.abs(delta).toFixed(0)} pp · ${(positive?delta>0:delta<0)?'Favorable':'Unfavorable'}`);
    card.querySelector('button').click();assert.match(d.getElementById('evidenceContext').textContent,new RegExp(`${c.length} supporting.*Current period`));
    assert.deepEqual(allEvidenceIds(d),Array.from(c,row=>row.id).sort());
    d.querySelectorAll('#evidenceChoices button')[1].click();assert.match(d.getElementById('evidenceContext').textContent,new RegExp(`${p.length} supporting.*Previous period`));
    assert.deepEqual(allEvidenceIds(d),Array.from(p,row=>row.id).sort());
  }
  assert.match(d.getElementById('executiveHeadline').textContent,/^High effort is higher in the current period\. Negative sentiment share rose, while high priority share stayed stable/);
  dom.window.close();
});
test('Explicit comparison OFF survives navigation, manual dates and All Data have truthful fallback',()=>{
 const {dom,d,change,apply}=app();change('compareEnabled',false);apply();
 for(const link of d.querySelectorAll('.section-nav [data-workspace]')){link.click();assert.equal(d.getElementById('compareEnabled').checked,false);}
 assert.ok([...d.querySelectorAll('.executive-delta')].every(n=>n.textContent==='Comparison unavailable'));
 change('periodPreset','custom');change('currentStart','2026-05-01');change('currentEnd','2026-05-31');apply();assert.match(d.getElementById('executivePeriods').textContent,/2026-05-01 – 2026-05-31/);
 change('periodPreset','all');apply();assert.equal(d.getElementById('compareEnabled').disabled,true);assert.match(d.getElementById('executivePeriods').textContent,/1,200 analyzed/);assert.match(d.getElementById('executiveHeadline').textContent,/A period comparison is unavailable/);assert.doesNotMatch(d.getElementById('executiveHeadline').textContent,/rose|fell|stable/i);dom.window.close();
});
test('Absent previous observations and empty current periods never invent movement',()=>{
 const {dom,d,change,apply}=app();change('periodPreset','custom');change('currentStart','2026-04-01');change('currentEnd','2026-04-10');apply();
 assert.ok([...d.querySelectorAll('.executive-delta')].every(n=>n.textContent==='Comparison unavailable'));
 change('currentStart','2025-01-01');change('currentEnd','2025-01-10');apply();assert.match(d.getElementById('executiveHeadline').textContent,/^No analyzed feedback in the selected period\./);assert.equal(d.querySelector('#executivePerspectiveEvidence button'),null);assert.ok([...d.querySelectorAll('.executive-value')].every(n=>n.textContent==='—'));dom.window.close();
});
test('Default anchor ignores missing and invalid dates and follows latest valid record',()=>{
 const {dom,d}=app(f=>{f.records[0].date='2099-02-30';f.records[1].date=null;f.records[2].date='2026-10-10';});assert.equal(d.getElementById('currentEnd').value,'2026-10-10');assert.equal(d.getElementById('currentStart').value,'2026-07-13');dom.window.close();
});
test('Default report retains current-period totals without previous-period contamination',()=>{
 const {dom,d,w}=app();let report, pdf;const render=w.ExecutiveReportPdf.renderExecutiveReportPdf;w.ExecutiveReportPdf.renderExecutiveReportPdf=model=>{report=model;pdf=render(model);return pdf;};w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=()=>{};
 d.getElementById('downloadReportButton').click();assert.ok(report);assert.equal(report.executiveSummary.total,626);assert.ok(pdf.bytes.length>1000);assert.ok(pdf.pageCount>0);dom.window.close();
});
test('Date windows exclude invalid and undated feedback without assigning invented dates',()=>{
 const {dom,d,w}=app(f=>{f.records[0].date='2026-08-32';f.records[1].date='';f.records[2].date=null;});
 const projected=w.FEEDBACK_DEMO_PRESENTATION.project(w.FEEDBACK_DEMO_DATA,w.FEEDBACK_RECURRING_LANGUAGE,{current:['2026-07-03','2026-09-30'],comparison:['2026-04-04','2026-07-02']});
 assert.ok(projected.records.every(r=>r.date&&!['2026-08-32'].includes(r.date)));assert.match(d.getElementById('dateStatus').textContent,/invalid-date records are excluded/);dom.window.close();
});
test('Rounding suppresses contradictory arrows and stable headline claims no unsupported direction',()=>{
 const {dom,d}=app(f=>{for(const r of f.records){r.sentiment='Positive';r.effort='Low';r.priority='Low';}});
 assert.ok([...d.querySelectorAll('.executive-delta')].every(n=>n.textContent==='Stable at displayed precision'));
 assert.match(d.getElementById('executiveHeadline').textContent,/^All four feedback shares remained stable at displayed precision\./);dom.window.close();
});
test('Mixed executive headline selects supported unfavorable and favorable movement without causality',()=>{
 const {dom,d}=app(f=>{for(const r of f.records){const current=r.date>='2026-07-03';r.sentiment=current?'Positive':'Negative';r.effort=current?'High':'Low';r.priority='Low';}});
 const narrative=d.getElementById('executiveHeadline').textContent;
 assert.match(narrative,/^High effort is higher in the current period\. Negative sentiment share fell, while high priority share stayed stable/);
 assert.doesNotMatch(narrative,/caused|drove|due to|significant|dramatic|crisis|deterioration|churn|attrition|financial impact|worsening/i);dom.window.close();
});

test('Executive Perspective names the leading established trend and opens its exact selected-period evidence',()=>{
  const {dom,d,w,change,apply}=app();
  assert.equal(d.querySelector('.executive-header + section > h2').textContent,'Executive Perspective');
  const checkEvidence = () => {
    const lead=w.FEEDBACK_DEMO_PRESENTATION.project(w.FEEDBACK_DEMO_DATA,w.FEEDBACK_RECURRING_LANGUAGE,{
      current:[d.getElementById('currentStart').value,d.getElementById('currentEnd').value],comparison:null
    }).topTrends[0];
    const action=d.querySelector('#executivePerspectiveEvidence button');
    assert.match(d.getElementById('executiveHeadline').textContent,new RegExp(lead.name));
    action.click();
    assert.equal(d.getElementById('evidenceHeading').textContent,`Supporting feedback for: ${lead.name}`);
    assert.deepEqual(allEvidenceIds(d),[...lead.recordIds].sort());
    assert.equal(d.activeElement.id,'closeEvidence');
    d.getElementById('closeEvidence').click();
    assert.equal(d.activeElement,action);
  };
  checkEvidence();
  change('periodPreset','30');apply();
  checkEvidence();
  dom.window.close();
});
