/* Deterministic projection of separately authored synthetic journeys; no analysis reclassification. */
(() => {
  const count = (rows, field, labels) => Object.fromEntries(labels.map(label => [label, rows.filter(row => row[field] === label).length]));
  const predominant = counts => Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || 'Unavailable';
  function project(fixture, current = null) {
    const records = fixture.records.filter(row => !current || row.date >= current[0] && row.date <= current[1]);
    const journeys = fixture.journeys.map(journey => {
      const rows = records.filter(row => row.painPointId === journey.painPointId);
      const stages = journey.stages.map(stage => {
        const supporting = rows.filter(row => stage.recordIds.includes(row.id));
        return { ...stage, recordIds: supporting.map(row => row.id),
          touchpoints: [...new Set(supporting.map(row => row.touchpoint))],
          sentiment: count(supporting, 'sentiment', ['Positive', 'Neutral', 'Negative']),
          effort: count(supporting, 'effort', ['Low', 'Medium', 'High']),
          priority: count(supporting, 'priority', ['Low', 'Medium', 'High']) };
      });
      const sentiment = count(rows, 'sentiment', ['Positive', 'Neutral', 'Negative']);
      return { ...journey, stages, recordIds: rows.map(row => row.id), count: rows.length,
        supported: stages.length > 1 && stages.every(stage => stage.recordIds.length >= fixture.minimumStageRecords),
        sentiment, predominantSentiment: rows.length ? predominant(sentiment) : 'Unavailable',
        highEffort: rows.filter(row => row.effort === 'High').length,
        highPriority: rows.filter(row => row.priority === 'High').length,
        touchpoints: [...new Set(rows.map(row => row.touchpoint))] };
    });
    return { records, journeys, byExperience: new Map(journeys.map(row => [row.painPoint, row])) };
  }
  window.FEEDBACK_JOURNEY_MODEL = { project };
})();
