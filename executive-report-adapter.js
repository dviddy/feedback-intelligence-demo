/* Format existing public projections for the shared local PDF renderer; no analysis or classification. */
(function (root) {
  function build(data, { currentLabel = 'All Data', comparison = null, journeys = [], journeyRecords = [], coverage = null, generatedAt = new Date() } = {}) {
    if (!data.summary.total) throw new Error('No feedback in the selected period. Choose a period with records.');
    const byId = new Map([...data.records, ...journeyRecords].map(row => [row.id, row]));
    const evidence = ids => ids.map(id => byId.get(id)).filter(Boolean).map(row => ({ record: row.id, quote: row.text,
      date: row.date, source: row.source, touchpoint: row.touchpoint }));
    const pct = (value, total, digits = 0) => total ? Number((100 * value / total).toFixed(digits)) : null;
    const summary = view => {
      const s = view.summary;
      return { total:s.total, negative:s.sentiment.Negative, negativePercent:pct(s.sentiment.Negative,s.total),
        highEffort:s.effort.High, highEffortPercent:pct(s.effort.High,s.total), highPriority:s.priority.High,
        highPriorityPercent:pct(s.priority.High,s.total), digitalAssistedPercent:pct(s.migrated,s.eligibleDigital,1) };
    };
    const classification = view => ({ establishedTrends:view.summary.established, emergingExperiences:view.summary.emerging,
      unclassifiedSignals:'unavailable (assignments absent in this synthetic fixture)' });
    const migration = view => ({ eligible:view.migration.eligible, migrated:view.migration.migrated,
      rate:pct(view.migration.migrated,view.migration.eligible,1),
      origins:view.migration.origins.map(row => ({name:row.name,count:row.eligible})).filter(row => row.count),
      destinations:view.migration.destinations.map(row => ({name:row.name,count:row.migrated})).filter(row => row.count),
      drivers:view.migration.drivers.map(row => ({name:row.name,count:row.migrated})) });
    const period = range => range ? {startDate:range[0],endDate:range[1]} : null;
    const k = summary(data);
    k.narrative = `Synthetic demo - precomputed feedback, not live analysis. ${k.total.toLocaleString('en-US')} feedback records are represented. ${k.negativePercent}% reflect negative experiences, ${k.highEffortPercent}% involve high effort, and ${k.highPriorityPercent}% are high priority. ${data.summary.established} Established Trends; ${data.summary.emerging} provisional Emerging Experiences. Needs More Evidence is unavailable in this fixture.`;
    const topTrends = data.topTrends.slice(0,5).map(row => {
      const supporting = row.recordIds.map(id=>byId.get(id));
      return { id:row.id,name:row.name,count:row.count,negativePercent:pct(supporting.filter(r=>r.sentiment==='Negative').length,row.count),
        highEffortCount:supporting.filter(r=>r.effort==='High').length,highPriorityCount:row.highPriorityCount,
        description:'Established Trend - selected-period synthetic feedback.',evidence:evidence(row.evidenceIds).slice(0,2) };
    });
    const movementItems = data.movement.slice(0,8).map(row=>({ name:row.name,
      classification:['Increasing','Stable','Decreasing'].includes(row.label)?row.label.toLowerCase():row.label,
      current:{supportingRecordCount:row.currentCount,totalRecordCount:data.periodTotals.current,prevalence:row.currentPrevalence},
      comparison:{supportingRecordCount:row.comparisonCount,totalRecordCount:data.periodTotals.comparison,prevalence:row.comparisonPrevalence},
      percentageChange:row.percentageChange,prevalencePointChange:100*(row.currentPrevalence-row.comparisonPrevalence),
      evidence:evidence(row.currentRecordIds).slice(0,1) }));
    const emerging = data.emerging.map(row=>({name:row.name,gapType:row.gap,count:row.count,
      taxonomyContext:row.coverage,evidence:evidence(row.evidenceIds).slice(0,1)}));
    const journeyItems = journeys.map(row=>({name:row.painPoint,journey:row.name || row.painPoint,
      goal:'Separate authored synthetic stage evidence; excluded from analysis totals.',
      stages:row.stages.map(stage=>({name:stage.stageLabel,count:stage.recordIds.length,highEffort:stage.effort.High,highPriority:stage.priority.High})),
      evidence:evidence(row.recordIds).slice(0,1)}));
    const language = data.recurringLanguage.slice(0,6).map(row=>({theme:row.name,experienceType:row.kind,count:row.count,
      phrases:row.phrases.slice(0,3).map(p=>({text:p.phrase,count:p.count})),evidence:evidence(row.recordIds).slice(0,1)}));
    const appendix = [...new Map([...topTrends,...movementItems,...emerging,...journeyItems,...language]
      .flatMap(row=>row.evidence).map(row=>[row.record,row])).values()];
    return {metadata:{generatedAt:new Date(generatedAt).toISOString(),total:k.total,
      period:{...period(data.scope.current || [data.meta.startDate,data.meta.endDate]),dated:k.total,undated:0},
      periodSelection:{currentLabel,currentRange:period(data.scope.current),comparisonRange:period(data.scope.comparison),
        coverage:coverage || {datedRecordCount:data.records.length,totalRecordCount:data.records.length,undatedRecordCount:0}},
      sources:[...new Set(data.records.map(row=>row.source))]},executiveSummary:k,
      comparisonSummary:comparison?{...summary(comparison),sentiment:comparison.visuals.sentiment.rows.map(row=>({name:row.label,count:row.count})),classificationTotals:classification(comparison),digitalAssisted:migration(comparison)}:null,
      charts:{sentiment:data.visuals.sentiment.rows.map(row=>({name:row.label,count:row.count})),
        experienceConcentration:data.established.slice(0,5).map(row=>({name:row.name,count:row.count})),categories:[]},
      topTrends,trendMovement:{periods:data.comparisonAvailable?{current:period(data.scope.current),comparison:period(data.scope.comparison)}:null,items:movementItems},
      classificationTotals:classification(data),emergingExperiences:{status:'ready',items:emerging},digitalAssisted:migration(data),
      journeys:journeyItems,recurringLanguage:language,evidence:appendix,
      methodology:'Synthetic demo. All content is precomputed synthetic feedback; no institution data or live analysis is included. Metrics, rankings, classifications and evidence are the existing selected-period public projections. Emerging Experiences remain provisional. Needs More Evidence is unavailable because assignments are absent, not a zero. Date comparisons are descriptive. Journey evidence comes from a separate 150-record authored synthetic fixture and never changes analysis totals. Reports are generated locally without API requests. Metrics describe feedback records, not all members or interactions.'};
  }
  const api = { build };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.FeedbackDemoReport = api;
})(globalThis);
