const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const read = file => fs.readFileSync(path.join(__dirname,'..',file),'utf8');
const scripts=['data/demo-data.js','data/recurring-language.js','presentation.js','data/journey-provenance.js','journey-model.js','executive-report-pdf.js','executive-report-adapter.js','demo.js'];
function app({load=true,transform,useDefaultPeriod=false}={}) {
  const dom=new JSDOM(read('index.html'),{url:'https://dviddy.github.io/feedback-intelligence-demo/',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window,d=w.document,requests=[];
  for(const name of ['fetch','XMLHttpRequest','WebSocket'])w[name]=()=>{requests.push(name);throw Error('Unexpected network');};
  for(const file of scripts){if(file==='demo.js'&&transform){const project=w.FEEDBACK_DEMO_PRESENTATION.project;w.FEEDBACK_DEMO_PRESENTATION.project=(...args)=>transform(project(...args));}w.eval(read(file));}
  // Preserve explicit All Data coverage for the existing regression scenarios.
  if (!useDefaultPeriod) {
    d.getElementById('periodPreset').value = 'all';
    d.getElementById('periodPreset').dispatchEvent(new dom.window.Event('change'));
    d.getElementById('periodForm').dispatchEvent(new dom.window.Event('submit', {cancelable:true}));
  }
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
    for(const [i,e]of m.origins.entries()){assert.ok(rows[i].textContent.includes(e.eligible+' records · '+share(e.eligible,m.eligible)));assert.match(rows[i].getAttribute('aria-description'),/of eligible digital-friction records/);near(parseFloat(rows[i].querySelector('.chart-fill').style.width),100*e.eligible/m.eligible);}
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
  for(const [i,e]of expected.entries()){assert.equal(signals[i].dataset.experience,e.name);assert.equal(signals[i].dataset.state,e.label);assert.ok(signals[i].textContent.includes(e.percentageChange.toFixed(1)+'%'));assert.doesNotMatch(signals[i].textContent,/relative to .*comparison-period/);signals[i].querySelector('.evidence-action').click();assert.ok([...d.querySelectorAll('#evidenceList h3')].every(n=>e.currentRecordIds.includes(n.textContent)));}
  const methodology=d.getElementById('movementMethodology');assert.equal(methodology.hidden,false);assert.match(methodology.textContent,/relative to comparison-period record counts/);
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

test('Visual Intelligence title and five native view controls precede the selected interpretation',()=>{
  const b=app(),{d}=b;
  b.nav('visual-intelligence');
  const heading=d.getElementById('visualHeading');
  assert.equal(heading.tagName,'H1');
  assert.equal(heading.textContent,'Visual Intelligence');
  assert.equal(heading.nextElementSibling.textContent,'See how member experience signals are distributed, concentrated, and changing.');
  assert.equal(d.activeElement,heading);
  const workspace=heading.closest('[data-workspace-view]');
  assert.equal(workspace.querySelector('.visual-header > button'),null);
  assert.equal(d.querySelector('[aria-controls="visualPanel"]'),null);
  assert.equal(d.querySelector('#visualDateSlot summary').textContent.includes('Change dates'),true);
  assert.match(d.getElementById('visualPeriods').textContent,/All Data.*Comparison off/);
  b.compare();
  assert.match(d.getElementById('visualPeriods').textContent,/Current: 2026-07-01.*Previous: 2026-04-01/);
  const tabs=[...d.querySelectorAll('.visual-nav button')];
  assert.deepEqual(tabs.map(tab=>tab.textContent),['Sentiment Mix','Experience Concentration','Trend Movement','Digital → Assisted','Recurring Themes']);
  for(const tab of tabs){
    tab.focus();
    tab.click();
    assert.equal(d.activeElement,tab);
    assert.deepEqual(tabs.filter(button=>button.getAttribute('aria-pressed')==='true'),[tab]);
    const interpretation=d.getElementById('visualCanvas').firstElementChild;
    assert.equal(interpretation.querySelector('h2').textContent,tab.textContent);
    assert.ok(interpretation.querySelector('.visual-insight').textContent);
    assert.ok(interpretation.nextElementSibling);
    assert.equal(interpretation.closest('[hidden]'),null);
  }
  b.nav('executive-summary');
  assert.equal(workspace.hidden,true);
  b.nav('visual-intelligence');
  assert.equal(d.getElementById('visualCanvas').closest('[hidden]'),null);
  assert.equal(d.querySelector('.visual-nav [aria-pressed="true"]'),tabs.at(-1));
  assert.deepEqual(b.requests,[]);
  b.w.close();
});

test('Interpretations reconcile to existing figures and exact, separate evidence populations',()=>{
  const b=app(),{d}=b;
  b.nav('visual-intelligence');
  const activate=name=>{
    d.querySelector(`[data-visual="${name}"]`).click();
    return d.querySelector('.visual-interpretation');
  };
  const assertEvidence=ids=>{
    const more=d.getElementById('moreEvidence');
    while(!more.hidden) more.click();
    assert.deepEqual([...d.querySelectorAll('#evidenceList h3')].map(heading=>heading.textContent).sort(),[...ids].sort());
  };
  for(const [preset,current] of [['all',null],['30',['2026-09-01','2026-09-30']]]){
    b.preset(preset);
    const p=b.project({current,comparison:null});
    const sentiment=activate('sentiment');
    for(const [i,[field,value]] of [['sentiment','Negative'],['effort','High'],['priority','High']].entries()){
      assert.ok(sentiment.textContent.includes(share(p.summary[field][value],p.summary.total)));
      sentiment.querySelectorAll('button')[i].click();
      assertEvidence(p.records.filter(row=>row[field]===value).map(row=>row.id));
    }

    const concentration=activate('domains');
    const leadingEmerging=[...p.emerging].filter(row=>row.count>=2).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name))[0];
    for(const [i,row] of [p.established[0],leadingEmerging].entries()){
      assert.ok(concentration.textContent.includes(row.name));
      assert.ok(concentration.textContent.includes(share(row.count,p.summary.total)));
      concentration.querySelectorAll('button')[i].click();
      assertEvidence(row.recordIds);
    }

    assert.match(activate('movement').textContent,/Comparison is off/);
    const migration=activate('migration');
    assert.ok(d.querySelector(".migration-rate strong").textContent.includes(share(p.migration.migrated,p.migration.eligible)));
    migration.querySelector('button').click();
    const eligible=p.records.filter(row=>row.eligibleDigital);
    assertEvidence(eligible.map(row=>row.id));
    d.querySelector('#evidenceChoices button:nth-child(2)').click();
    assertEvidence(eligible.filter(row=>row.migratedTo).map(row=>row.id));

    const phrase=p.recurringLanguage[0].phrases[0],language=activate('phrases');
    assert.ok(language.textContent.includes(`“${phrase.phrase}” appears in ${phrase.count} comments`));
    language.querySelector('button').click();
    assertEvidence(phrase.recordIds);
  }
  b.compare();
  const movement=activate('movement');
  const p=b.project({current:['2026-07-01','2026-09-30'],comparison:['2026-04-01','2026-06-30']});
  const leaders=['Increasing','Decreasing'].map(label=>p.movement.filter(row=>row.label===label)
    .sort((a,b)=>Math.abs(b.percentageChange)-Math.abs(a.percentageChange)||b.currentCount-a.currentCount||a.name.localeCompare(b.name))[0]);
  for(const [i,row] of leaders.entries()){
    assert.ok(movement.textContent.includes(row.name));
    assert.ok(movement.textContent.includes(row.percentageChange.toFixed(1)+'%'));
    movement.querySelectorAll('button')[i].click();
    assertEvidence(row.currentRecordIds);
    d.querySelector('#evidenceChoices button:nth-child(2)').click();
    assertEvidence(row.comparisonRecordIds);
  }
  b.w.close();
});

test('Two-view hierarchy uses existing measure shares and independently ranked classification leaders',()=>{
  const b=app(),{d}=b;
  for(const preset of ['all','30']){
    b.preset(preset);
    const p=b.project({current:preset==='all'?null:['2026-09-01','2026-09-30'],comparison:null});
    d.querySelector('[data-visual="sentiment"]').click();
    for(const [field,value,label] of [['sentiment','Negative','negative sentiment'],['effort','High','high effort'],['priority','High','high priority']]){
      const module=d.querySelector(`#visualCanvas [data-dimension="${field}"]`);
      assert.equal(module.querySelector('.dimension-headline strong').textContent,share(p.summary[field][value],p.summary.total));
      assert.ok(module.querySelector('.dimension-headline').textContent.includes(label));
      assert.equal(module.querySelectorAll('.breakdown-choice').length,3);
    }
    d.querySelector('[data-visual="domains"]').click();
    const emerging=p.emerging.filter(row=>row.count>=2).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
    for(const [kind,rows] of [['established',p.established],['emerging',emerging]]){
      const panel=d.querySelector(`#visualCanvas .concentration-group[data-kind="${kind}"]`);
      const leader=panel.querySelector('.concentration-leader');
      assert.ok(leader.textContent.includes(rows[0].name));
      assert.equal(panel.querySelectorAll('.concentration-leader').length,1);
      near(parseFloat(leader.querySelector('.chart-fill').style.width),100*rows[0].count/p.summary.total);
      assert.ok(leader.textContent.includes('View supporting feedback'));
    }
    assert.ok(!/critical|high risk|severity score/i.test(d.getElementById('visualCanvas').textContent));
  }
  b.w.close();
});

test('Trend Movement cards and full comparisons retain exact counts, widths, states and separate evidence',()=>{
  const b=app(),{d}=b;
  b.compare();
  d.querySelector('[data-visual="movement"]').click();
  const p=b.project({current:['2026-07-01','2026-09-30'],comparison:['2026-04-01','2026-06-30']});
  const expected=['Increasing','Decreasing'].map(label=>p.movement.filter(row=>row.label===label&&Number.isFinite(row.percentageChange))
    .sort((a,b)=>Math.abs(b.percentageChange)-Math.abs(a.percentageChange)||b.currentCount-a.currentCount||a.name.localeCompare(b.name))[0]).filter(Boolean);
  const cards=[...d.querySelectorAll('#visualCanvas .visual-movement-highlight')];
  assert.equal(cards.length,expected.length);
  for(const [i,row] of expected.entries()){
    assert.equal(cards[i].dataset.state,row.label);
    assert.equal(cards[i].querySelector('h3').textContent,row.name);
    assert.equal(cards[i].querySelector('.movement-card-counts').textContent,`${row.currentCount} current · ${row.comparisonCount} prior`);
    cards[i].querySelector('button').click();
    for(const [index,ids] of [row.currentRecordIds,row.comparisonRecordIds].entries()){
      d.querySelectorAll('#evidenceChoices button')[index].click();
      while(!d.getElementById('moreEvidence').hidden)d.getElementById('moreEvidence').click();
      assert.deepEqual([...d.querySelectorAll('#evidenceList h3')].map(n=>n.textContent).sort(),[...ids].sort());
    }
    d.getElementById('closeEvidence').click();
    assert.equal(d.activeElement,cards[i].querySelector('button'));
  }
  d.querySelector('#visualCanvas > .chart-more').click();
  assert.equal(d.getElementById('remainingMovement').hidden,false);
  const rows=[...d.querySelectorAll('#visualCanvas .movement-chart-row')];
  assert.equal(rows.length,p.movement.length);
  const max=Math.max(...p.movement.flatMap(row=>[row.currentCount,row.comparisonCount]),1);
  for(const [i,row] of rows.entries()){
    const expectedRow=p.movement[i];
    assert.equal(row.dataset.state,expectedRow.label);
    const periodValues=row.querySelectorAll('.movement-period-values > span');
    assert.equal(periodValues[0].textContent,`Current${expectedRow.currentCount} · ${share(expectedRow.currentCount,p.periodTotals.current)}`);
    assert.equal(periodValues[1].textContent,`Prior${expectedRow.comparisonCount} · ${share(expectedRow.comparisonCount,p.periodTotals.comparison)}`);
    near(parseFloat(row.querySelector('.current .chart-fill').style.width),100*expectedRow.currentCount/max);
    near(parseFloat(row.querySelector('.comparison .chart-fill').style.width),100*expectedRow.comparisonCount/max);
    assert.equal(row.querySelector('.movement-evidence').textContent,'Compare supporting feedback');
  }
  assert.ok(!/Improved|Resolved|Better experience/.test(d.getElementById('visualCanvas').textContent));
  assert.match(d.getElementById('visualCanvas').textContent,/each share uses its own period/);
  assert.match(d.getElementById('visualCanvas').textContent,/Zero observations do not imply resolution/);
  b.w.close();
});

test('Digital-assisted panels feature dynamic leaders and retain complete origin evidence groups',()=>{
  const b=app(),{d}=b;
  for(const [preset,current] of [['all',null],['30',['2026-09-01','2026-09-30']]]){
    b.preset(preset);
    d.querySelector('[data-visual="migration"]').click();
    const m=b.project({current,comparison:null}).migration;
    const origin=m.origins.reduce((best,row)=>row.eligible>best.eligible?row:best);
    const destination=m.destinations.reduce((best,row)=>row.migrated>best.migrated?row:best);
    assert.ok(d.querySelector('.migration-origins .migration-leader').textContent.includes(origin.name));
    assert.ok(d.querySelector('.migration-destinations .migration-leader').textContent.includes(destination.name));
    assert.match(d.querySelector('.migration-origins .migration-denominator').textContent,/Share of eligible digital-friction records/);
    assert.match(d.querySelector('.migration-destinations .migration-denominator').textContent,/Share of assisted transitions/);
    for(const [i,row] of m.origins.entries()){
      const button=d.querySelectorAll('.migration-origins .chart-row')[i];
      button.click();
      for(const [j,ids] of [row.eligibleRecordIds,row.migratedRecordIds].entries()){
        d.querySelectorAll('#evidenceChoices button')[j].click();
        while(!d.getElementById('moreEvidence').hidden)d.getElementById('moreEvidence').click();
        assert.deepEqual([...d.querySelectorAll('#evidenceList h3')].map(n=>n.textContent).sort(),[...ids].sort());
      }
      d.getElementById('closeEvidence').click();
      assert.equal(d.activeElement,button);
    }
  }
  b.w.close();
});

test('Recurring Themes keeps exact ordered phrases and isolated standalone workspace markup',()=>{
  const b=app(),{d}=b;
  b.nav('recurring-language');
  const standalone=d.getElementById('languageCanvas').innerHTML;
  b.nav('visual-intelligence');
  d.querySelector('[data-visual="phrases"]').click();
  assert.equal(d.querySelectorAll('.visual-nav button').length,5);
  assert.equal(d.getElementById('visualViewHeading').textContent,'Recurring Themes');
  assert.equal(d.getElementById('languageCanvas').innerHTML,standalone);
  const p=b.project();
  const rows=[...d.querySelectorAll('#visualCanvas .language-row')];
  assert.equal(rows.length,6);
  assert.equal(d.querySelectorAll('#visualCanvas .language-leader').length,1);
  for(const [i,row] of rows.entries()){
    const theme=p.recurringLanguage[i];
    assert.equal(row.querySelector('h3').textContent,theme.name);
    assert.equal(row.dataset.kind,theme.kind);
    assert.equal(row.querySelector('.language-count').textContent,`${theme.count} supporting comments`);
    assert.deepEqual([...row.querySelectorAll('.language-phrase')].map(n=>n.textContent),Array.from(theme.phrases,phrase=>`“${phrase.phrase}” · ${phrase.count}`));
    assert.ok(theme.phrases.every(phrase=>new Set(phrase.recordIds).size>=3));
  }
  b.w.close();
});

const overviewScope = {current:['2026-07-03','2026-09-30'], comparison:['2026-04-04','2026-07-02']};

test('Experience Intelligence shows dynamic coverage, compact movement and migration in investigation order', () => {
  const b = app({useDefaultPeriod:true}), {d} = b;
  b.nav('experience-intelligence');
  const workspace = d.querySelector('.intelligence-section');
  const selected = b.project(overviewScope);
  const text = id => d.getElementById(id).textContent;

  assert.equal(workspace.querySelector('h1').textContent, 'Experience Intelligence');
  assert.equal(workspace.querySelector('.executive-banner p').textContent,
    'Understand recurring experiences, identify changing patterns, and explore the evidence behind each signal.');
  assert.deepEqual([...workspace.querySelectorAll('article[aria-labelledby]')].map(node => node.getAttribute('aria-labelledby')),
    ['trendsHeading', 'emergingHeading', 'movementHeading', 'migrationHeading', 'needsHeading']);
  assert.match(text('trendsSummary'), /Established experience identities/);
  assert.match(text('emergingSummary'), /Provisional experiences with selected-period evidence/);
  assert.match(workspace.querySelector('.intelligence-emerging').textContent, /Emerging describes coverage, not recent growth/);

  const coverage = projection => [
    projection.establishedPresence.length, projection.topTrends.length, projection.emerging.length
  ];
  const displayedCoverage = () => ['establishedIdentityCount', 'establishedRecurringCount', 'emergingExperienceCount']
    .map(id => Number(text(id)));
  assert.deepEqual(coverage(selected), [15, 15, 5]);
  assert.deepEqual(displayedCoverage(), coverage(selected));
  assert.equal(text('intelligenceCurrentPeriod'), 'Current: 2026-07-03 – 2026-09-30 · 626 analyzed');
  assert.equal(text('intelligencePreviousPeriod'), 'Previous: 2026-04-04 – 2026-07-02 · 556 analyzed');

  const movement = [...d.querySelectorAll('#movementSummary li')].map(row =>
    [row.querySelector('span').textContent, Number(row.querySelector('strong').textContent)]);
  assert.deepEqual(movement, [['Increasing', 7], ['Stable', 4], ['Decreasing', 4], ['New', 0], ['No longer observed', 1]]);
  assert.match(text('movementPeriod'), /Current: 2026-07-03 – 2026-09-30 · Comparison: 2026-04-04 – 2026-07-02/);
  assert.deepEqual([...workspace.querySelectorAll('.movement-signal')].map(row => [
    row.querySelector('h3').textContent, row.querySelector('strong').textContent,
    row.querySelector('.signal-change').textContent, row.querySelector('.signal-counts').textContent
  ]), [
    ['Strongest increase', 'Login Failure', '+87.0%', '43 current · 23 prior'],
    ['Strongest decrease', 'Service Wait Time', '-51.4%', '18 current · 37 prior']
  ]);
  const methodology = d.getElementById('movementMethodology');
  assert.equal(methodology.hidden, false);
  assert.equal(d.querySelector('#movementSignals + #movementMethodology + [aria-controls="movementPanel"]')?.textContent, 'Explore movement');
  assert.equal(text('movementMethodology'), 'Percentage changes are relative to comparison-period record counts. Decreasing feedback counts do not establish experience improvement or resolution.');
  assert.doesNotMatch(text('movementSignals'), /comparison-period record counts|improvement or resolution/);
  assert.doesNotMatch(text('movementSignals'), /Needs Attention/);
  assert.equal(text('intelligenceMigrationRate'), share(selected.migration.migrated, selected.migration.eligible));
  assert.match(text('intelligenceMigrationCount'), /^53 of 257 eligible digital-friction records include validated assisted contact/);
  const indicator = d.getElementById('intelligenceMigrationIndicator');
  assert.equal(indicator.hidden, false);
  assert.equal(indicator.getAttribute('aria-hidden'), 'true');
  assert.equal(indicator.min, 0);
  assert.equal(indicator.value, selected.migration.migrated);
  assert.equal(indicator.max, selected.migration.eligible);
  near(indicator.value / indicator.max, 53 / 257);
  assert.match(workspace.querySelector('.intelligence-migration .intelligence-note').textContent, /only to eligible analyzed digital-friction feedback records/);
  assert.equal(text('needsSummary'), 'Withheld-signal data is not included in this synthetic fixture.');
  assert.match(text('needsPanel'), /Counts and supporting evidence are unavailable/);
  assert.equal(workspace.querySelector('#needsPanel .evidence-action'), null);
  assert.equal(workspace.querySelector('.movement-chart-row, .chart-fill'), null);

  const classificationRows = () => [...d.querySelectorAll('#movementSummary li')];
  b.compare();
  const changed = b.project({current:['2026-07-01','2026-09-30'], comparison:['2026-04-01','2026-06-30']});
  assert.deepEqual(classificationRows().map(row => [
    row.querySelector('span').textContent, Number(row.querySelector('strong').textContent)
  ]), [
    ['Increasing', 'Increasing'], ['Stable', 'Stable'], ['Decreasing', 'Decreasing'],
    ['New', 'New in selected comparison window'], ['No longer observed', 'No longer observed in selected current period']
  ].map(([label, classification]) => [label, changed.movement.filter(row => row.label === classification).length]));
  assert.notDeepEqual(classificationRows().map(row => Number(row.querySelector('strong').textContent)), movement.map(([, count]) => count));

  b.change('periodPreset', 'custom');
  b.change('currentStart', '2026-04-02');
  b.change('currentEnd', '2026-04-02');
  d.getElementById('compareEnabled').checked = false;
  d.getElementById('compareEnabled').dispatchEvent(new b.w.Event('change'));
  b.apply();
  const narrow = b.project({current:['2026-04-02','2026-04-02'], comparison:null});
  assert.ok(narrow.establishedPresence.length > narrow.topTrends.length);
  assert.notEqual(narrow.emerging.length, selected.emerging.length);
  assert.deepEqual(displayedCoverage(), coverage(narrow));
  assert.equal(text('intelligencePreviousPeriod'), 'Comparison is off');
  assert.equal(text('movementSummary'), 'Comparison unavailable');
  assert.equal(workspace.querySelectorAll('.movement-signal').length, 0);
  assert.equal(text('intelligenceMigrationRate'), '0.0%');
  assert.equal(methodology.hidden, true);
  assert.match(text('movementSignals'), /Select two nonoverlapping periods with feedback/);
  assert.equal(indicator.hidden, false);
  assert.equal(indicator.value, 0);
  assert.equal(indicator.max, narrow.migration.eligible);
  assert.ok(indicator.max > 0);

  b.change('currentStart', '2027-01-01');
  b.change('currentEnd', '2027-01-01');
  b.apply();
  assert.equal(d.getElementById('intelligenceMigrationRate').hidden, true);
  assert.equal(indicator.hidden, true);
  assert.equal(indicator.value, 0);
  assert.match(text('intelligenceMigrationCount'), /Rate unavailable/);
  assert.deepEqual(displayedCoverage(), [0, 0, 0]);
  b.dom.window.close();
});

test('Overview investigation actions preserve exact record IDs, comparison subsets and evidence focus', () => {
  const b = app({useDefaultPeriod:true}), {d} = b;
  b.nav('experience-intelligence');
  const selected = b.project(overviewScope);
  const evidenceIds = () => {
    const more = d.getElementById('moreEvidence');
    while (!more.hidden) more.click();
    return [...d.querySelectorAll('#evidenceList h3')].map(node => node.textContent);
  };
  const checkEvidence = (action, groups) => {
    action.click();
    assert.equal(d.activeElement, d.getElementById('closeEvidence'));
    const choices = [...d.querySelectorAll('#evidenceChoices button')];
    assert.equal(choices.length, groups.length > 1 ? groups.length : 0);
    for (const [index, ids] of groups.entries()) {
      if (index) choices[index].click();
      assert.deepEqual(evidenceIds(), Array.from(ids));
    }
    d.getElementById('closeEvidence').click();
    assert.equal(d.activeElement, action);
  };

  for (const id of ['trendsPanel', 'emergingPanel', 'movementPanel', 'migrationPanel', 'needsPanel']) {
    const action = d.querySelector(`.intelligence-section [aria-controls="${id}"]`);
    assert.equal(action.getAttribute('aria-expanded'), 'false');
    action.click();
    assert.equal(action.getAttribute('aria-expanded'), 'true');
    assert.equal(d.getElementById(id).hidden, false);
  }
  assert.equal(b.w.location.hash, '#experience-intelligence');

  d.querySelector('#trendsPanel .small-action').click();
  for (const [panel, rows] of [['trendsPanel', selected.topTrends], ['emergingPanel', selected.emerging]]) {
    const actions = [...d.querySelectorAll(`#${panel} .evidence-action`)];
    assert.equal(actions.length, rows.length);
    for (const [index, row] of rows.entries()) checkEvidence(actions[index], [row.recordIds]);
  }
  for (const signal of d.querySelectorAll('#movementSignals .movement-signal')) {
    const row = selected.movement.find(row => row.name === signal.dataset.experience);
    const action = signal.querySelector('.evidence-action');
    assert.equal(action.getAttribute('aria-label'), `Compare supporting evidence for ${row.name}`);
    checkEvidence(action, [row.currentRecordIds, row.comparisonRecordIds]);
  }
  const movementActions = d.querySelectorAll('#movementPanel .evidence-action');
  assert.equal(movementActions.length, selected.movement.length);
  for (const [index, row] of selected.movement.entries()) {
    checkEvidence(movementActions[index], [row.currentRecordIds, row.comparisonRecordIds]);
  }
  const [origins, destinations] = d.querySelectorAll('#migrationPanel .migration-investigation-origins, #migrationPanel .migration-investigation-destinations');
  for (const [container, rows, groups] of [
    [origins, selected.migration.origins, row => [row.eligibleRecordIds, row.migratedRecordIds]],
    [destinations, selected.migration.destinations, row => [row.recordIds]]
  ]) {
    const actions = container.querySelectorAll('.evidence-action');
    assert.equal(actions.length, rows.length);
    for (const [index, row] of rows.entries()) checkEvidence(actions[index], groups(row));
  }

  assert.deepEqual(b.requests, []);
  b.dom.window.close();
});

test('Experience Intelligence movement renders dynamic identities and accessible names as text', () => {
  const marker = '<img src=x onerror=alert(1)>';
  const b = app({useDefaultPeriod:true, transform:projection => ({
    ...projection, movement:projection.movement.map(row => row.name === 'Login Failure' ? {...row, name:marker} : row)
  })});
  b.nav('experience-intelligence');
  const signal = b.d.querySelector('#movementSignals .increasing');
  assert.equal(signal.querySelector('strong').textContent, marker);
  assert.equal(signal.querySelector('img'), null);
  const action = signal.querySelector('.evidence-action');
  assert.equal(action.getAttribute('aria-label'), `Compare supporting evidence for ${marker}`);
  action.click();
  assert.equal(b.d.getElementById('evidenceHeading').textContent, `Supporting feedback for: ${marker}`);
  assert.equal(b.d.querySelector('#evidencePanel img'), null);
  b.dom.window.close();
});

test('Established Trends preserves ranked rows, actual counts and the full-list disclosure', () => {
  const b = app({useDefaultPeriod:true}), {d} = b;
  b.nav('experience-intelligence');
  d.querySelector('[aria-controls="trendsPanel"]').click();
  const panel = d.getElementById('trendsPanel');
  const full = d.getElementById('allTrends');
  const all = panel.querySelector('[aria-controls="allTrends"]');
  const expected = b.project(overviewScope).topTrends;
  const rows = container => [...container.querySelectorAll('.established-experience')];
  const readRow = row => [
    row.querySelector('h3').textContent, row.querySelector('.established-domain').textContent,
    Number(row.querySelector('.established-count strong').textContent), row.querySelector('.established-priority').textContent
  ];
  const expectedRows = expected.map(row => [row.name, row.domain || 'Outside controlled taxonomy', row.count, row.highPriorityCount + ' high priority']);
  assert.equal(panel.querySelector('h2').textContent, 'Established Trends');
  assert.match(panel.textContent, /Rankings require two selected-period comments; identity presence includes single observations/);
  assert.deepEqual(rows(panel.querySelector(':scope > ol')).map(readRow), Array.from(expectedRows.slice(0, 3)));
  assert.deepEqual([...panel.querySelectorAll('.established-leading h3')].map(node => node.textContent), [expected[0].name]);
  assert.equal(full.hidden, true);
  assert.equal(all.getAttribute('aria-expanded'), 'false');
  all.click();
  assert.equal(full.hidden, false);
  assert.equal(all.getAttribute('aria-expanded'), 'true');
  assert.deepEqual(rows(panel).map(readRow), Array.from(expectedRows));
  all.click();
  assert.equal(full.hidden, true);
  assert.equal(all.textContent, 'View all recurring experiences');
  b.dom.window.close();
});

test('Established Trends preview retains exact sample text and uses independently labelled analytical attributes', async () => {
  const b = app({useDefaultPeriod:true}), {d,w} = b;
  b.nav('experience-intelligence');
  d.querySelector('[aria-controls="trendsPanel"]').click();
  const row = d.querySelector('#trendsPanel .established-experience');
  const detail = row.querySelector('details');
  const summary = detail.querySelector('summary');
  const nextToggle = () => new Promise(resolve => detail.addEventListener('toggle', resolve, {once:true}));
  assert.equal(summary.querySelector('.established-preview-open').textContent, 'Preview 3 supporting records');
  assert.equal(detail.querySelector('.evidence'), null);

  const ids = ['DEMO-0563','DEMO-0564','DEMO-0565'];
  const records = ids.map(id => w.FEEDBACK_DEMO_DATA.records.find(record => record.id === id));
  const opened = nextToggle();
  summary.focus();
  summary.click();
  await opened;
  assert.equal(detail.open, true);
  assert.equal(d.activeElement, summary);
  assert.equal(summary.querySelector('.established-preview-close').textContent, 'Hide supporting record preview');
  const cards = [...detail.querySelectorAll('.established-record')];
  assert.deepEqual(cards.map(card => card.querySelector('h4').textContent), ids);
  for (const [index, card] of cards.entries()) {
    const record = records[index];
    assert.equal(card.querySelector('time').dateTime, record.date);
    assert.match(card.textContent, new RegExp('Feedback Source: ' + record.source));
    assert.match(card.textContent, new RegExp('Experience Touchpoint: ' + record.touchpoint));
    assert.equal(card.querySelector('.established-record-text').textContent, record.text);
    assert.deepEqual([...card.querySelectorAll('[data-dimension]')].map(node => [node.dataset.dimension, node.textContent]),
      ['sentiment','effort','priority'].map(dimension => [dimension, record[dimension] + ' ' + dimension]));
    assert.match(card.textContent, /Pain point: Login Failure/);
    assert.equal(card.querySelector('.feedback-status'), null);
  }
  const closed = nextToggle();
  summary.click();
  await closed;
  assert.equal(detail.open, false);
  assert.equal(d.activeElement, summary);

  const full = row.querySelector('.evidence-action');
  assert.equal(full.getAttribute('aria-label'), 'View all 43 supporting comments for Login Failure');
  full.click();
  assert.equal(d.getElementById('evidencePanel').hidden, false);
  assert.equal(d.querySelectorAll('#evidenceList .established-record').length, 0);
  assert.ok(d.querySelector('#evidenceList .feedback-card .feedback-status'));
  d.getElementById('closeEvidence').click();
  assert.equal(d.activeElement, full);

  d.querySelector('[aria-controls="emergingPanel"]').click();
  const emerging = d.querySelector('#emergingPanel details');
  emerging.open = true;
  emerging.dispatchEvent(new w.Event('toggle'));
  assert.ok(emerging.querySelector('.established-record .established-record-attributes'));
  assert.equal(emerging.querySelector('.feedback-status'), null);
  b.dom.window.close();
});

test('Established Trends handles narrow and empty date scopes without inventing recurrence or evidence', () => {
  const b = app({useDefaultPeriod:true}), {d,w} = b;
  b.nav('experience-intelligence');
  d.querySelector('[aria-controls="trendsPanel"]').click();
  b.change('periodPreset', 'custom');
  d.getElementById('compareEnabled').checked = false;
  const selectDates = (start, end) => {
    b.change('currentStart', start);
    b.change('currentEnd', end);
    b.apply();
    return b.project({current:[start,end], comparison:null});
  };
  const narrow = selectDates('2026-04-03', '2026-04-06');
  const panel = d.getElementById('trendsPanel');
  assert.ok(narrow.establishedPresence.length > narrow.topTrends.length);
  assert.ok(narrow.topTrends.some(row => row.count === 2 && row.highPriorityCount === 0));
  assert.equal(d.getElementById('establishedIdentityCount').textContent, String(narrow.establishedPresence.length));
  assert.equal(d.getElementById('establishedRecurringCount').textContent, String(narrow.topTrends.length));
  panel.querySelector('[aria-controls="allTrends"]').click();
  const two = narrow.topTrends.find(trend => trend.count === 2 && trend.highPriorityCount === 0);
  const row = [...panel.querySelectorAll('.established-experience')].find(node => node.querySelector('h3').textContent === two.name);
  assert.equal(row.querySelector('.established-preview-open').textContent, 'Preview 2 supporting records');
  assert.equal(row.querySelector('.established-priority').textContent, '0 high priority');

  const marker = '<img src=x>';
  const record = w.FEEDBACK_DEMO_DATA.records.find(record => record.id === two.evidenceIds[0]);
  record.text = marker;
  const details = row.querySelector('details');
  details.open = true;
  details.dispatchEvent(new w.Event('toggle'));
  assert.deepEqual([...details.querySelectorAll('h4')].map(node => node.textContent), Array.from(two.evidenceIds));
  assert.equal(details.querySelector('.established-record-text').textContent, marker);
  assert.equal(details.querySelector('img'), null);

  selectDates('2027-01-01', '2027-01-01');
  assert.equal(panel.hidden, false);
  assert.match(panel.textContent, /No Established Trends have recurring evidence in this period/);
  assert.equal(panel.querySelectorAll('.established-experience, .evidence-action').length, 0);
  assert.equal(d.getElementById('evidencePanel').hidden, true);
  b.dom.window.close();
});

test('Established Trends distinguishes an unavailable sample from its existing full evidence', () => {
  const b = app({useDefaultPeriod:true, transform: projection => ({
    ...projection, topTrends:projection.topTrends.map((trend,index) => index === 0 ? {...trend,evidenceIds:[]} : trend)
  })}), {d} = b;
  b.nav('experience-intelligence');
  d.querySelector('[aria-controls="trendsPanel"]').click();
  const row = d.querySelector('#trendsPanel .established-leading');
  assert.match(row.textContent, /Supporting-record preview unavailable/);
  assert.equal(row.querySelector('details'), null);
  row.querySelector('.evidence-action').click();
  assert.match(d.getElementById('evidenceCount').textContent, /Showing 20 of 43 synthetic comments/);
  b.dom.window.close();
});

test('Emerging investigation preserves fixture ordering, gap coverage, and the approved scoped preview', () => {
  const b = app({useDefaultPeriod:true}), {d,w} = b;
  b.nav('experience-intelligence');
  d.querySelector('[aria-controls="emergingPanel"]').click();
  const panel = d.getElementById('emergingPanel');
  assert.equal(panel.hidden, false);
  assert.equal(d.getElementById('trendsPanel').hidden, true);
  assert.equal(panel.previousElementSibling.id, 'trendsPanel');
  assert.equal(panel.parentElement.nextElementSibling.getAttribute('aria-labelledby'), 'movementHeading');
  const rows = [...panel.querySelectorAll('.established-experience')];
  const expected = b.project(overviewScope).emerging;
  assert.deepEqual(rows.map(row => [
    row.querySelector('h3').textContent, row.querySelector('.emerging-gap').textContent,
    row.querySelector('.established-domain').textContent,
    row.querySelector('.emerging-association')?.textContent || null,
    Number(row.querySelector('.established-count strong').textContent)
  ]), [
    ['Biometric Authentication Failure', 'Specificity Gap', 'Account Access & Identity', 'Associated established experience: Login Failure', 16],
    ['Digital Wallet Provisioning Failure', 'Domain Gap', 'Cards', null, 12],
    ['Joint Account Digital Access Failure', 'Specificity Gap', 'Account Access & Identity', 'Associated established experience: Login Failure', 8],
    ['Transfer Recipient Setup Failure', 'Specificity Gap', 'Transfers & Payments', 'Associated established experience: Transfer Failure', 12],
    ['Financial Wellness Coaching Handoff', 'Unrepresented Experience', 'No controlled domain selected', null, 9]
  ]);
  assert.equal(rows.length, expected.length);
  assert.equal(panel.querySelector('.established-leading'), rows[0]);
  assert.equal(panel.querySelector('.small-action, .established-priority'), null);
  assert.match(panel.textContent, /Nothing is promoted automatically/);
  for (const [index, row] of rows.entries()) {
    const details = row.querySelector('details');
    details.open = true;
    details.dispatchEvent(new w.Event('toggle'));
    const sample = [...details.querySelectorAll('.established-record')];
    assert.deepEqual(sample.map(card => card.querySelector('h4').textContent), Array.from(expected[index].evidenceIds));
    if (index === 0) assert.deepEqual(sample.map(card => card.querySelector('h4').textContent), ['DEMO-0642', 'DEMO-0643', 'DEMO-0644']);
    for (const card of sample) {
      const record = w.FEEDBACK_DEMO_DATA.records.find(record => record.id === card.querySelector('h4').textContent);
      assert.equal(card.querySelector('time').dateTime, record.date);
      assert.equal(card.querySelector('.established-record-text').textContent, record.text);
      assert.match(card.textContent, /Pain point:/);
      assert.deepEqual([...card.querySelectorAll('[data-dimension]')].map(node => node.textContent),
        ['sentiment', 'effort', 'priority'].map(key => record[key] + ' ' + key));
    }
  }
  b.dom.window.close();
});

test('Emerging investigation preserves single observations and empty dates', () => {
  const b = app({useDefaultPeriod:true}), {d} = b;
  b.nav('experience-intelligence');
  d.querySelector('[aria-controls="emergingPanel"]').click();
  b.change('periodPreset', 'custom');
  d.getElementById('compareEnabled').checked = false;
  const selectDay = day => {
    b.change('currentStart', day);
    b.change('currentEnd', day);
    b.apply();
  };
  selectDay('2026-07-20');
  const panel = d.getElementById('emergingPanel');
  const row = [...panel.querySelectorAll('.established-experience')].find(item => item.querySelector('h3').textContent === 'Biometric Authentication Failure');
  assert.match(row.textContent, /Presence only in this period/);
  assert.match(row.textContent, /Preview 1 supporting record/);
  assert.equal(row.querySelector('.established-count strong').textContent, '1');
  selectDay('2027-01-01');
  assert.equal(panel.hidden, false);
  assert.match(panel.textContent, /No Emerging Experiences are observed in this period/);
  assert.equal(panel.querySelector('.evidence-action'), null);
  b.dom.window.close();
});

test('Movement investigation displays the complete ordered projection with independent count change and feedback shares', () => {
  const b = app({useDefaultPeriod:true}), {d} = b;
  b.nav('experience-intelligence');
  d.querySelector('[aria-controls="movementPanel"]').click();
  const panel = d.getElementById('movementPanel');
  assert.equal(panel.getAttribute('aria-labelledby'), 'movementInvestigationHeading');
  assert.match(panel.textContent, /Current period: 626 analyzed records/);
  assert.match(panel.textContent, /Comparison period: 556 analyzed records/);
  assert.match(panel.textContent, /Feedback shares use each period’s analyzed feedback total/);
  assert.match(panel.textContent, /zero observations do not establish experience improvement or resolution/);
  assert.equal(panel.querySelector('.paired-bars, .chart-track'), null);

  const projected = b.project(overviewScope);
  const rows = [...panel.querySelectorAll('.movement-row')];
  assert.equal(rows.length, 16);
  for (const [i, item] of projected.movement.entries()) {
    const row = rows[i];
    assert.equal(row.querySelector('h3').textContent, item.name);
    assert.equal(row.querySelector('.movement-classification').textContent, item.label);
    assert.equal(row.querySelector('.movement-record-change strong').textContent,
      (item.percentageChange > 0 ? '+' : '') + item.percentageChange.toFixed(1) + '%');
    assert.deepEqual([...row.querySelectorAll('.movement-period-count')].map(node => Number.parseInt(node.textContent, 10)),
      [item.currentCount, item.comparisonCount]);
    assert.deepEqual([...row.querySelectorAll('.movement-period-share')].map(node => node.textContent), [
      share(item.currentCount, projected.periodTotals.current) + ' of analyzed feedback',
      share(item.comparisonCount, projected.periodTotals.comparison) + ' of analyzed feedback'
    ]);
  }
  const card = rows.find(row => row.querySelector('h3').textContent === 'Card Decline');
  assert.equal(card.querySelector('.movement-classification').textContent, 'Stable');
  assert.equal(card.querySelector('.movement-record-change strong').textContent, '0.0%');
  assert.deepEqual([...card.querySelectorAll('.movement-period-share')].map(node => node.textContent),
    ['3.8% of analyzed feedback', '4.3% of analyzed feedback']);
  const branch = rows.find(row => row.querySelector('h3').textContent === 'Branch Queue');
  assert.match(branch.querySelector('.movement-classification').textContent, /^No longer observed/);
  assert.equal(branch.querySelector('.movement-record-change strong').textContent, '-100.0%');
  assert.equal(branch.querySelector('.movement-period-share').textContent, '0.0% of analyzed feedback');
  assert.deepEqual(Array.from(projected.movement[0].currentRecordIds.slice(0, 3)), ['DEMO-0563','DEMO-0564','DEMO-0565']);
  b.w.close();
});

test('Movement investigation separates New, empty dated periods and disabled comparison', () => {
  const marker = '<b>Login Failure</b>';
  const b = app({useDefaultPeriod:true, transform:projection => ({
    ...projection, movement:projection.movement.map(row => row.name === 'Login Failure' ? {...row, name:marker} : row)
  })}), {d} = b;
  b.nav('experience-intelligence');
  d.querySelector('[aria-controls="movementPanel"]').click();
  const panel = d.getElementById('movementPanel');
  assert.equal(panel.querySelector('li h3').textContent, marker);
  assert.equal(panel.querySelector('li h3 b'), null);
  b.change('comparisonPreset', 'custom');
  b.change('comparisonStart', '2026-04-02');
  b.change('comparisonEnd', '2026-04-02');
  b.apply();
  const newRow = panel.querySelector('[data-movement^="New"]');
  assert.ok(newRow);
  assert.equal(newRow.querySelector('.movement-record-change strong'), null);
  assert.match(newRow.querySelector('.movement-record-change').textContent, /unavailable without comparison observations/);
  assert.equal(newRow.querySelectorAll('.movement-period-count')[1].textContent, '0 records');
  const evidence = newRow.querySelector('.evidence-action');
  evidence.click();
  const comparison = d.querySelectorAll('#evidenceChoices button')[1];
  assert.match(comparison.textContent, /Comparison · 0/);
  comparison.click();
  assert.match(d.getElementById('evidenceList').textContent, /No feedback evidence/);
  d.getElementById('closeEvidence').click();
  assert.equal(d.activeElement, evidence);

  b.change('comparisonStart', '2025-01-01');
  b.change('comparisonEnd', '2025-01-01');
  b.apply();
  assert.match(panel.textContent, /Comparison period: 0 analyzed records/);
  assert.match(panel.textContent, /No comparison available for these periods/);
  assert.equal(panel.querySelector('.movement-row'), null);
  b.change('periodPreset', 'custom');
  b.change('currentStart', '2027-01-01');
  b.change('currentEnd', '2027-01-01');
  b.change('comparisonStart', '2026-04-02');
  b.change('comparisonEnd', '2026-04-02');
  b.apply();
  assert.match(panel.textContent, /Current period: 0 analyzed records/);
  assert.match(panel.textContent, /No comparison available for these periods/);
  assert.equal(panel.querySelector('.movement-row'), null);

  b.preset('all');
  assert.match(panel.textContent, /Comparison is off/);
  assert.equal(panel.querySelector('.movement-row'), null);
  assert.doesNotMatch(panel.textContent, /NaN|Infinity/);
  b.w.close();
});

test('Digital to Assisted investigation presents existing totals, channels and associated experiences in order', () => {
  const b = app({useDefaultPeriod:true}), {d} = b;
  b.nav('experience-intelligence');
  d.querySelector('[aria-controls="migrationPanel"]').click();
  const panel = d.getElementById('migrationPanel');
  assert.equal(panel.hidden, false);
  assert.equal(d.getElementById(panel.getAttribute('aria-labelledby')).textContent, 'Digital → Assisted Investigation');
  assert.match(panel.textContent, /subset of eligible digital-friction records/);
  assert.match(panel.textContent, /Card \/ Point of Sale is excluded/);
  assert.match(panel.textContent, /not a causal or population-wide migration measure/);
  assert.equal(panel.querySelector('meter, .chart-track'), null);
  const values = selector => [...panel.querySelectorAll(selector)].map(item => Number(item.textContent));
  const readRows = selector => [...panel.querySelectorAll(selector + ' li')].map(row =>
    [row.querySelector('h4').textContent, ...[...row.querySelectorAll('dd')].map(node => Number(node.textContent))]);
  const projected = b.project(overviewScope).migration;
  assert.deepEqual(values('.migration-investigation-totals dd'), [257, 53]);
  const origins = readRows('.migration-investigation-origins');
  assert.deepEqual(origins, [['Mobile App',84,16],['Online Banking',121,26],['Public Website',44,8],['ATM',8,3]]);
  const destinations = readRows('.migration-investigation-destinations');
  assert.deepEqual(destinations, [['Contact Center / Phone',16],['Chat',22],['Branch',15]]);
  assert.equal(origins.reduce((sum, row) => sum + row[1], 0), projected.eligible);
  assert.equal(origins.reduce((sum, row) => sum + row[2], 0), projected.migrated);
  assert.equal(destinations.reduce((sum, row) => sum + row[1], 0), projected.migrated);
  assert.deepEqual(readRows('.migration-investigation-experiences'), [['Login Failure',9],['Unexpected Fee',8],['Identity Verification Failure',5]]);
  const associations = panel.querySelector('.migration-investigation-experiences');
  assert.match(associations.textContent, /Experiences associated with assisted contact/);
  assert.equal(associations.querySelector('button'), null);
  const atm = projected.origins.find(row => row.name === 'ATM');
  assert.deepEqual(Array.from(atm.eligibleRecordIds), ['DEMO-0669','DEMO-0670','DEMO-0671','DEMO-0865','DEMO-0866','DEMO-0867','DEMO-1081','DEMO-1082']);
  assert.deepEqual(Array.from(atm.migratedRecordIds), ['DEMO-0669','DEMO-0865','DEMO-1081']);
  assert.ok(atm.migratedRecordIds.every(id => atm.eligibleRecordIds.includes(id)));
  b.w.close();
});

test('Digital to Assisted investigation keeps zero and unavailable periods distinct and renders experience names safely', () => {
  const marker = '<b>Login Failure</b>';
  const b = app({useDefaultPeriod:true, transform:projection => ({...projection, migration:{
    ...projection.migration, drivers:projection.migration.drivers.map(row => row.name === 'Login Failure' ? {...row, name:marker} : row)
  }})}), {d} = b;
  b.nav('experience-intelligence');
  d.querySelector('[aria-controls="migrationPanel"]').click();
  const panel = d.getElementById('migrationPanel');
  assert.equal(panel.querySelector('.migration-investigation-experiences h4').textContent, marker);
  assert.equal(panel.querySelector('.migration-investigation-experiences h4 b'), null);
  b.change('periodPreset', 'custom');
  d.getElementById('compareEnabled').checked = false;
  const selectDay = day => {
    b.change('currentStart', day);
    b.change('currentEnd', day);
    b.apply();
  };
  selectDay('2026-04-02');
  const expected = b.project({current:['2026-04-02','2026-04-02'], comparison:null}).migration;
  assert.ok(expected.eligible > 0);
  assert.deepEqual([...panel.querySelectorAll('.migration-investigation-totals dd')].map(node => Number(node.textContent)), [expected.eligible, 0]);
  assert.match(panel.textContent, /No validated assisted contact observed/);
  assert.equal(d.getElementById('intelligenceMigrationRate').textContent, '0.0%');
  const button = [...panel.querySelectorAll('.migration-investigation-origins button')].find(node => !node.textContent.startsWith('View 0'));
  button.click();
  const [eligible, migrated] = d.querySelectorAll('#evidenceChoices button');
  assert.equal(eligible.getAttribute('aria-pressed'), 'true');
  assert.match(migrated.textContent, /Migrated · 0/);
  migrated.click();
  assert.match(d.getElementById('evidenceList').textContent, /No feedback evidence/);
  d.getElementById('closeEvidence').click();
  assert.equal(d.activeElement, button);
  selectDay('2027-01-01');
  assert.equal(panel.hidden, false);
  assert.match(panel.textContent, /rate is unavailable/);
  assert.match(panel.textContent, /No associated experience identities/);
  assert.equal(d.getElementById('intelligenceMigrationRate').hidden, true);
  assert.doesNotMatch(panel.textContent, /NaN|Infinity/);
  b.w.close();
});

test('Needs More Evidence explains unavailable assignments without counts or review controls', () => {
  const b = app({useDefaultPeriod:true}), {d,w} = b;
  b.nav('experience-intelligence');
  const panel = d.getElementById('needsPanel');
  const toggle = d.querySelector('[aria-controls="needsPanel"]');
  const location = w.location.hash;
  const overview = d.querySelector('.intelligence-needs .intelligence-preview').outerHTML;
  assert.equal(panel.hidden, true);
  assert.equal(toggle.textContent, 'Understand this category');
  toggle.focus();
  toggle.click();
  assert.equal(panel.hidden, false);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(d.activeElement, toggle);
  assert.equal(d.getElementById(panel.getAttribute('aria-labelledby')).textContent, 'Needs More Evidence');
  assert.deepEqual([...panel.querySelectorAll('h3')].map(node => node.textContent), ['Analytical purpose', 'Data availability in this demo']);
  const availability = panel.querySelector('.needs-demo-availability');
  assert.match(availability.textContent, /Counts and supporting evidence are unavailable/);
  assert.match(availability.textContent, /General feedback without a grouped experience has not been reclassified/);
  assert.doesNotMatch(panel.textContent, /\d|No issues detected|All experiences confirmed/);
  assert.equal(panel.querySelector('a, button, .feedback-card, meter'), null);
  b.preset('30');
  assert.equal(panel.hidden, false);
  assert.match(panel.querySelector('.needs-demo-availability').textContent, /Counts and supporting evidence are unavailable/);
  toggle.click();
  assert.equal(panel.hidden, true);
  assert.equal(w.location.hash, location);
  assert.equal(d.querySelector('.intelligence-needs .intelligence-preview').outerHTML, overview);
  b.w.close();
});
