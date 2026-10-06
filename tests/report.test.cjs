const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {JSDOM} = require('jsdom');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const scripts=['data/demo-data.js','data/recurring-language.js','presentation.js','data/journey-provenance.js','journey-model.js','executive-report-pdf.js','executive-report-adapter.js','demo.js'];
function browser(load=true) {
  const dom=new JSDOM(read('index.html'),{url:'https://dviddy.github.io/feedback-intelligence-demo/',runScripts:'outside-only',pretendToBeVisual:true});
  const requests=[],downloads=[],blobs=[];
  const w=dom.window,d=w.document;
  w.fetch=()=>{requests.push('fetch');throw Error('Unexpected network');};
  w.XMLHttpRequest=class{constructor(){requests.push('xhr');throw Error('Unexpected network');}};
  w.WebSocket=class{constructor(){requests.push('websocket');throw Error('Unexpected network');}};
  w.URL.createObjectURL=blob=>{blobs.push(blob);return 'blob:synthetic-report';};w.URL.revokeObjectURL=()=>{};
  w.HTMLAnchorElement.prototype.click=function(){downloads.push({filename:this.download,url:this.href});};
  for(const script of scripts)w.eval(read(script));
  if(load)d.getElementById('loadDemoButton').click();
  const change=(id,value)=>{d.getElementById(id).value=value;d.getElementById(id).dispatchEvent(new w.Event('change'));};
  const apply=()=>d.getElementById('periodForm').dispatchEvent(new w.Event('submit',{cancelable:true}));
  const project=scope=>w.FEEDBACK_DEMO_PRESENTATION.project(w.FEEDBACK_DEMO_DATA,w.FEEDBACK_RECURRING_LANGUAGE,scope);
  return {dom,w,d,downloads,blobs,requests,change,apply,project};
}
test('Executive report is discoverable after loading and prepares a local PDF download', async()=>{
  const b=browser(false),{dom,w,d}=b;
  const button=d.getElementById('downloadReportButton');
  assert.equal(button.textContent,'Download Executive Report');
  assert.equal(d.getElementById('resultsExperience').hidden,true);
  d.getElementById('loadDemoButton').click();assert.equal(d.getElementById('resultsExperience').hidden,false);
  assert.equal(button.disabled,false);button.click();
  assert.deepEqual(b.downloads,[{filename:'feedback-intelligence-report-2026-04-01-to-2026-09-30.pdf',url:'blob:synthetic-report'}]);
  assert.equal(b.blobs[0].type,'application/pdf');
  const bytes=await new Promise(resolve=>{const reader=new w.FileReader();reader.onload=()=>resolve(new Uint8Array(reader.result));reader.readAsArrayBuffer(b.blobs[0]);});
  assert.ok(Buffer.from(bytes).toString().startsWith('%PDF-1.4'));
  assert.match(Buffer.from(bytes).toString(),/Synthetic demo/);
  assert.equal(button.disabled,false);assert.deepEqual(b.requests,[]);dom.window.close();
});
test('Report metrics and current evidence reconcile across selected periods without mutating projections',()=>{
  const b=browser();
  for(const current of [null,['2026-07-01','2026-09-30'],['2026-09-01','2026-09-30']]){
    const data=b.project({current,comparison:null}),before=JSON.stringify(data);
    const m=b.w.FeedbackDemoReport.build(data,{generatedAt:'2026-10-06T00:00:00Z'}),k=m.executiveSummary;
    assert.equal(k.total,data.summary.total);assert.equal(k.negative,data.summary.sentiment.Negative);
    assert.equal(k.negativePercent,Math.round(100*data.summary.sentiment.Negative/data.summary.total));
    assert.equal(k.highEffort,data.summary.effort.High);assert.equal(k.highPriority,data.summary.priority.High);
    assert.equal(m.digitalAssisted.eligible,data.summary.eligibleDigital);assert.equal(m.digitalAssisted.migrated,data.summary.migrated);
    assert.equal(k.digitalAssistedPercent,Number((100*data.summary.migrated/data.summary.eligibleDigital).toFixed(1)));
    assert.equal(m.classificationTotals.establishedTrends,data.summary.established);assert.equal(m.classificationTotals.emergingExperiences,data.summary.emerging);
    assert.match(m.classificationTotals.unclassifiedSignals,/unavailable/);
    const ids=new Set(data.records.map(r=>r.id));assert.ok(m.evidence.every(r=>ids.has(r.record)));
    assert.equal(JSON.stringify(data),before);
  }
  b.dom.window.close();
});
test('Report download respects applied dates, not unsubmitted date edits',()=>{
  const b=browser();b.change('periodPreset','30');b.apply();
  b.d.getElementById('downloadReportButton').click();assert.match(b.downloads[0].filename,/2026-09-01-to-2026-09-30/);
  b.change('periodPreset','custom');b.change('currentStart','2026-08-01');b.change('currentEnd','2026-08-31');
  b.d.getElementById('downloadReportButton').click();assert.match(b.downloads[1].filename,/2026-09-01-to-2026-09-30/);
  b.apply();b.d.getElementById('downloadReportButton').click();assert.match(b.downloads[2].filename,/2026-08-01-to-2026-08-31/);
  assert.deepEqual(b.requests,[]);b.dom.window.close();
});
test('Comparison data stays separate from current report totals and evidence',()=>{
  const b=browser(),scope={current:['2026-07-01','2026-09-30'],comparison:['2026-04-01','2026-06-30']};
  const data=b.project(scope),prior=b.project({current:scope.comparison,comparison:null});
  const m=b.w.FeedbackDemoReport.build(data,{comparison:prior});
  assert.equal(m.executiveSummary.total,data.summary.total);assert.equal(m.comparisonSummary.total,prior.summary.total);
  assert.ok(m.trendMovement.items.length);assert.ok(m.evidence.every(r=>r.date>=scope.current[0]&&r.date<=scope.current[1]));
  assert.equal(m.metadata.periodSelection.comparisonRange.startDate,scope.comparison[0]);b.dom.window.close();
});
test('Only generated supported journeys enter report and date changes clear stale journeys',()=>{
  const b=browser();let captured;
  const original=b.w.ExecutiveReportPdf.renderExecutiveReportPdf;
  b.w.ExecutiveReportPdf.renderExecutiveReportPdf=model=>{captured=model;return original(model);};
  b.d.getElementById('downloadReportButton').click();assert.equal(captured.journeys.length,0);
  b.d.querySelector('.pain-point-generate').click();b.d.getElementById('downloadReportButton').click();
  assert.equal(captured.journeys.length,2);assert.equal(captured.journeys[0].stages[0].name,'Attempt Login');
  assert.equal(captured.journeys[0].stages[0].count,6);assert.equal(captured.executiveSummary.total,1200);
  b.change('periodPreset','30');b.apply();b.d.getElementById('downloadReportButton').click();assert.equal(captured.journeys.length,0);
  b.dom.window.close();
});
test('Empty periods disable report export and renderer failure restores the control safely',()=>{
  const b=browser();b.w.ExecutiveReportPdf.renderExecutiveReportPdf=()=>{throw Error('Internal detail');};
  b.d.getElementById('downloadReportButton').click();assert.equal(b.d.getElementById('downloadReportButton').disabled,false);
  assert.equal(b.d.getElementById('reportStatus').textContent,'Report could not be prepared. Please try again.');assert.equal(b.downloads.length,0);
  b.change('periodPreset','custom');b.change('currentStart','2027-01-01');b.change('currentEnd','2027-01-31');b.apply();
  assert.equal(b.d.getElementById('downloadReportButton').disabled,true);assert.equal(b.d.getElementById('reportStatus').textContent,'');
  assert.throws(()=>b.w.FeedbackDemoReport.build(b.project({current:['2027-01-01','2027-01-31'],comparison:null})),/No feedback/);
  b.dom.window.close();
});
test('Reused renderer is byte-identical and report modules introduce no network, persistence or private paths',()=>{
  assert.equal(crypto.createHash('sha256').update(read('executive-report-pdf.js')).digest('hex'),'7cd94c7fe33df2e1be2c713b525245362357d89db627e4cedaf484c00066d86f');
  for(const file of ['executive-report-pdf.js','executive-report-adapter.js']){
    assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|sessionStorage|indexedDB|\/Users\/|localhost|https?:\/\//.test(read(file)),file);
  }
});
