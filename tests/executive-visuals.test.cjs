const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const read = file => fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const scripts=['data/demo-data.js','data/recurring-language.js','presentation.js','data/journey-provenance.js','journey-model.js','executive-report-pdf.js','executive-report-adapter.js','demo.js'];
function app({load=true,transform}={}) {
  const dom=new JSDOM(read('index.html'),{url:'https://dviddy.github.io/feedback-intelligence-demo/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,d=w.document,requests=[];
  for(const name of ['fetch','XMLHttpRequest','WebSocket'])w[name]=()=>{requests.push(name);throw Error('Unexpected network');};
  for(const file of scripts){if(file==='demo.js'&&transform){const project=w.FEEDBACK_DEMO_PRESENTATION.project;w.FEEDBACK_DEMO_PRESENTATION.project=(...args)=>transform(project(...args));}w.eval(read(file));}
  if(load)d.getElementById('loadDemoButton').click();
  const change=(id,value)=>{d.getElementById(id).value=value;d.getElementById(id).dispatchEvent(new w.Event('change'));};
  const apply=()=>d.getElementById('periodForm').dispatchEvent(new w.Event('submit',{cancelable:true}));
  const project=scope=>w.FEEDBACK_DEMO_PRESENTATION.project(w.FEEDBACK_DEMO_DATA,w.FEEDBACK_RECURRING_LANGUAGE,scope||{current:null,comparison:null});
  const preset=value=>{change('periodPreset',value);apply();};
  const compare=()=>{change('periodPreset','q3');d.getElementById('compareEnabled').checked=true;change('comparisonPreset','q2');apply();};
  const nav=key=>d.querySelector(`.section-nav [data-workspace="${key}"]:not(.sidebar-home)`).click();
  return {dom,w,d,requests,change,apply,project,preset,compare,nav};
}
const share=(n,total)=>total?(100*n/total).toFixed(1)+'%':'—';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
for(const [field,labels,tones] of [
  ['sentiment',['Positive','Neutral','Negative'],['positive','neutral','negative']],
  ['effort',['Low','Medium','High'],['positive','warning','negative']],
  ['priority',['Low','Medium','High'],['neutral','warning','negative']]
])test(`${field} stacked shares preserve exact selected-period categories, counts, semantics and evidence`,()=>{
  const b=app(),{d,w}=b;
  for(const [preset,current] of [['all',null],['q3',['2026-07-01','2026-09-30']],['30',['2026-09-01','2026-09-30']]]){
    b.preset(preset);const p=b.project({current,comparison:null});
    const row=d.querySelector(`#visualCanvas [data-dimension="${field}"]`), segments=[...row.querySelectorAll('.share-segment')],buttons=[...row.querySelectorAll('.breakdown-choice')];
    assert.equal(segments.length,3);assert.equal(row.querySelectorAll('.stacked-track').length,1);
    near(segments.reduce((sum,s)=>sum+parseFloat(s.style.width),0),100);
    for(const [i,label] of labels.entries()){
      const count=p.summary[field][label];assert.equal(segments[i].dataset.category,label);assert.ok(segments[i].classList.contains('tone-'+tones[i]));
      near(parseFloat(segments[i].style.width),100*count/p.summary.total);
      assert.equal(Number(buttons[i].dataset.count),count);assert.ok(buttons[i].textContent.includes(share(count,p.summary.total)));
      assert.match(buttons[i].getAttribute('aria-description'),/of selected-period analyzed feedback/);
      buttons[i].click();const ids=[...d.querySelectorAll('#evidenceList .feedback-card h3')].map(n=>n.textContent);
      assert.equal(ids.length,Math.min(count,20));assert.ok(ids.every(id=>p.records.some(r=>r.id===id&&r[field]===label)));
    }
    assert.match(row.querySelector('.stacked-track').getAttribute('aria-label'),/records, .* of selected-period analyzed feedback/);
  }
  assert.deepEqual(b.requests,[]);w.close();
});
test('All three dimensions have text legends, and empty periods show unavailable shares rather than NaN or invented evidence',()=>{
  const b=app(),{d}=b;assert.equal(d.querySelectorAll('#visualCanvas .stacked-track').length,3);assert.equal(d.querySelectorAll('#visualCanvas .breakdown-choice').length,9);
  b.change('periodPreset','custom');b.change('currentStart','2027-01-01');b.change('currentEnd','2027-01-31');b.apply();
  assert.ok([...d.querySelectorAll('#visualCanvas .share-segment')].every(s=>parseFloat(s.style.width)===0));assert.match(d.getElementById('visualCanvas').textContent,/shares are unavailable/);assert.ok(!/NaN|Infinity/.test(d.getElementById('visualCanvas').textContent));
  assert.match(d.getElementById('positiveSignals').textContent,/positive signals are unavailable/);b.dom.window.close();
});
test('Concentration widths use analyzed feedback, retain rankings/counts and never normalize the largest experience to 100%',()=>{
  const b=app(),{d}=b;
  for(const [preset,current] of [['all',null],['q3',['2026-07-01','2026-09-30']],['30',['2026-09-01','2026-09-30']]]){
    b.preset(preset);d.querySelector('[data-visual="domains"]').click();const p=b.project({current,comparison:null});
    const groups=[...d.querySelectorAll('#visualCanvas .concentration-group')];
    const expected=[p.established,p.emerging.filter(r=>r.count>=2).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name))];
    for(const [i,group] of groups.entries())for(const [j,row]of [...group.querySelectorAll('.chart-row')].entries()){
      const e=expected[i][j];assert.ok(row.textContent.includes(e.name));assert.ok(row.textContent.includes(e.count+' records · '+share(e.count,p.summary.total)));
      near(parseFloat(row.querySelector('.chart-fill').style.width),100*e.count/p.summary.total);assert.match(row.textContent,/of selected-period analyzed feedback/);assert.ok(row.getAttribute('aria-description').includes(share(e.count,p.summary.total)));
    }
    assert.ok(parseFloat(groups[0].querySelector('.chart-fill').style.width)<100);assert.match(d.getElementById('visualCanvas').textContent,/100% of each track represents all/);
  }b.dom.window.close();
});
test('Digital-to-assisted primary rate and origin/destination shares use their exact separate denominators',()=>{
  const b=app(),{d}=b;
  for(const [preset,current]of [['all',null],['q3',['2026-07-01','2026-09-30']],['30',['2026-09-01','2026-09-30']]]){
    b.preset(preset);d.querySelector('[data-visual="migration"]').click();const p=b.project({current,comparison:null}),m=p.migration;
    const headline=d.querySelector('.migration-headline');assert.match(headline.textContent,new RegExp(`${m.migrated} of ${m.eligible} eligible digital-friction records`));assert.ok(headline.textContent.includes(share(m.migrated,m.eligible)+' moved to assisted support'));
    near(parseFloat(headline.querySelector('.chart-fill').style.width),100*m.migrated/m.eligible);assert.match(headline.textContent,/Not a percentage of all customers, members or interactions/);
    const rows=[...d.querySelectorAll('#visualCanvas .chart-row')];
    for(const [i,e]of m.origins.entries()){assert.ok(rows[i].textContent.includes(e.eligible+' records · '+share(e.eligible,m.eligible)));assert.match(rows[i].textContent,/of eligible digital-friction records/);near(parseFloat(rows[i].querySelector('.chart-fill').style.width),100*e.eligible/m.eligible);}
    for(const [i,e]of m.destinations.entries()){const row=rows[i+m.origins.length];assert.ok(row.textContent.includes(e.migrated+' transitions · '+share(e.migrated,m.migrated)));assert.match(row.textContent,/of assisted transitions/);near(parseFloat(row.querySelector('.chart-fill').style.width),100*e.migrated/m.migrated);row.click();assert.ok([...d.querySelectorAll('#evidenceList h3')].every(n=>e.recordIds.includes(n.textContent)));}
  }b.dom.window.close();
});
test('Zero assisted transitions and no eligible evidence have truthful zero/unavailable states',()=>{
  const b=app(),{d}=b;b.change('periodPreset','custom');b.change('currentStart','2026-04-02');b.change('currentEnd','2026-04-02');b.apply();d.querySelector('[data-visual="migration"]').click();assert.match(d.getElementById('visualCanvas').textContent,/0.0% moved to assisted support/);assert.ok(!/NaN|Infinity/.test(d.getElementById('visualCanvas').textContent));
  b.change('currentStart','2027-01-01');b.change('currentEnd','2027-01-01');b.apply();assert.match(d.getElementById('visualCanvas').textContent,/Rate unavailable without eligible/);assert.equal(d.querySelector('.migration-progress .chart-fill').style.width,'0%');b.dom.window.close();
});
test('Movement tile selects one strongest existing Increasing and Decreasing signal without opening analyst detail',()=>{
  const b=app(),{d}=b;assert.match(d.getElementById('movementSummary').textContent,/Comparison unavailable/);assert.equal(d.querySelectorAll('.movement-signal').length,0);b.compare();
  const p=b.project({current:['2026-07-01','2026-09-30'],comparison:['2026-04-01','2026-06-30']});const before=JSON.stringify(p.movement);
  const expected=['Increasing','Decreasing'].map(label=>p.movement.filter(r=>r.label===label&&Number.isFinite(r.percentageChange)).sort((a,b)=>Math.abs(b.percentageChange)-Math.abs(a.percentageChange)||b.currentCount-a.currentCount||a.name.localeCompare(b.name))[0]).filter(Boolean);
  const signals=[...d.querySelectorAll('.movement-signal')];assert.equal(signals.length,expected.length);
  for(const [i,e]of expected.entries()){assert.equal(signals[i].dataset.experience,e.name);assert.equal(signals[i].dataset.state,e.label);assert.ok(signals[i].textContent.includes(e.percentageChange.toFixed(1)+'%'));assert.match(signals[i].textContent,/relative to this experience’s comparison-period count/);signals[i].querySelector('.evidence-action').click();assert.ok([...d.querySelectorAll('#evidenceList h3')].every(n=>e.currentRecordIds.includes(n.textContent)));}
  assert.equal(d.getElementById('movementPanel').hidden,true);assert.equal(JSON.stringify(p.movement),before);assert.ok(!/Improving|resolution confirmed/.test(d.getElementById('movementSignals').textContent));b.dom.window.close();
});
test('Movement preview handles one-sided, stable-only and absent comparisons without inventing signals',()=>{
  for(const label of ['Increasing','Decreasing','Stable','New in selected comparison window']){
    const b=app({transform:p=>({...p,movement:p.movement.filter(r=>r.label===label)})});b.compare();const signals=[...b.d.querySelectorAll('.movement-signal')];assert.equal(signals.length,['Increasing','Decreasing'].includes(label)?1:0);if(signals.length)assert.equal(signals[0].dataset.state,label);b.dom.window.close();
  }
});
test('Movement visual shares retain each period’s denominator and existing count-based movement values',()=>{
  const b=app(),{d}=b;b.compare();d.querySelector('[data-visual="movement"]').click();const p=b.project({current:['2026-07-01','2026-09-30'],comparison:['2026-04-01','2026-06-30']});
  for(const [i,row]of [...d.querySelectorAll('.movement-chart-row')].entries()){const e=p.movement[i];assert.ok(row.textContent.includes(share(e.currentCount,p.periodTotals.current)+' of current-period analyzed feedback'));assert.ok(row.textContent.includes(share(e.comparisonCount,p.periodTotals.comparison)+' of comparison-period analyzed feedback'));}b.dom.window.close();
});
test('Positive signals use current Positive and Low counts only, omit zero Low effort, and never invent satisfaction or scoring',()=>{
  const b=app(),{d}=b;
  for(const [preset,current]of [['all',null],['q3',['2026-07-01','2026-09-30']],['30',['2026-09-01','2026-09-30']]]){
    b.preset(preset);const p=b.project({current,comparison:null});
    for(const [field,value]of [['sentiment','Positive'],['effort','Low']]){const count=p.summary[field][value],node=d.querySelector(`[data-signal="${field}"]`);assert.equal(Boolean(node),count>0);if(node){assert.ok(node.textContent.includes(count+' records · '+share(count,p.summary.total)));assert.match(node.textContent,/of selected-period feedback/);node.querySelector('.evidence-action').click();assert.ok([...d.querySelectorAll('#evidenceList h3')].every(n=>p.records.some(r=>r.id===n.textContent&&r[field]===value)));}}
    assert.ok(!/satisfaction|CSAT|score|Improving|Decreasing Friction/i.test(d.getElementById('positiveSignals').textContent));
  }b.dom.window.close();
});
test('Home links are native anchors, preserve analysis state, and do not duplicate the active navigation state',()=>{
  const b=app(),{d,w}=b;b.compare();b.nav('visual-intelligence');d.querySelector('[data-visual="domains"]').click();b.nav('journey-mapping');d.querySelectorAll('.journey-modes button')[1].click();d.querySelector('.pain-point-generate').click();const maps=[...d.querySelectorAll('.member-journey')],period=d.getElementById('activePeriod').textContent;
  for(const home of d.querySelectorAll('.brand-home,.sidebar-home')){assert.equal(home.tagName,'A');assert.equal(home.getAttribute('href'),'#executive-summary');home.click();assert.equal(w.location.hash,'#executive-summary');assert.equal(d.querySelector('[data-workspace-view="executive-summary"]').hidden,false);assert.equal(d.getElementById('activePeriod').textContent,period);assert.equal(d.getElementById('compareEnabled').checked,true);assert.deepEqual([...d.querySelectorAll('.member-journey')],maps);assert.equal(d.querySelector('[data-visual="domains"]').getAttribute('aria-pressed'),'true');assert.equal(d.querySelectorAll('.section-nav [aria-current]').length,1);assert.equal(d.getElementById('resultsExperience').hidden,false);}
  assert.deepEqual(b.requests,[]);w.close();
  const unloaded=app({load:false});unloaded.d.querySelector('.brand-home').click();assert.equal(unloaded.d.getElementById('resultsExperience').hidden,false);assert.equal(unloaded.w.location.hash,'#executive-summary');unloaded.dom.window.close();
});
test('UI and unchanged PDF use identical numerators and denominators with documented display precision',()=>{
  const b=app(),{d,w}=b;
  for(const [preset,current]of [['all',null],['q3',['2026-07-01','2026-09-30']],['30',['2026-09-01','2026-09-30']]]){
    b.preset(preset);const p=b.project({current,comparison:null}),model=w.FeedbackDemoReport.build(p);d.querySelector('[data-visual="migration"]').click();assert.ok(d.querySelector('.migration-rate').textContent.includes(model.digitalAssisted.rate.toFixed(1)+'%'));
    assert.equal(d.querySelector('[data-metric="Negative Share"] .metric-value').textContent,model.executiveSummary.negativePercent+'%');
    d.querySelector('[data-visual="domains"]').click();for(const [i,row]of [...d.querySelectorAll('.concentration-group:first-of-type .chart-row')].slice(0,5).entries()){const pdf=model.charts.experienceConcentration[i];assert.ok(row.textContent.includes(pdf.count+' records · '+share(pdf.count,model.executiveSummary.total)));}
    const pdf=w.ExecutiveReportPdf.renderExecutiveReportPdf(model);assert.ok(Buffer.from(pdf.bytes).toString().startsWith('%PDF-1.4'));assert.ok(Buffer.from(pdf.bytes).toString().includes('Synthetic demo'));
  }b.dom.window.close();
});
