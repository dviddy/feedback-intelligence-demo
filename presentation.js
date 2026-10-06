/* Static presentation projections. Never analyzes or classifies a comment. */
(function (root) {
  const ids = rows => rows.map(row => row.id);
  const within = (rows, range) => range ? rows.filter(row => row.date >= range[0] && row.date <= range[1]) : rows;
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') &&
    !Number.isNaN(Date.parse(value)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  function validateScope(scope) {
    for (const range of [scope.current, scope.comparison]) {
      if (range && (!range.every(validDate) || range.length !== 2 || range[0] > range[1]))
        throw new Error('Choose valid dates with the start on or before the end.');
    }
    if (scope.comparison && !scope.current) throw new Error('Choose a dated current period before comparing.');
    if (scope.comparison && scope.current[0] <= scope.comparison[1] && scope.comparison[0] <= scope.current[1])
      throw new Error('Current and comparison periods must not overlap.');
  }
  function previous(range) {
    const start = Date.parse(`${range[0]}T00:00:00Z`);
    const days = (Date.parse(`${range[1]}T00:00:00Z`) - start) / 86400000 + 1;
    return [new Date(start - days * 86400000).toISOString().slice(0, 10),
      new Date(start - 86400000).toISOString().slice(0, 10)];
  }
  function project(fixture, language, scope = { current: null, comparison: null }) {
    validateScope(scope);
    const records = within(fixture.records, scope.current);
    const comparison = scope.comparison ? within(fixture.records, scope.comparison) : [];
    const emergingNames = new Set(fixture.emerging.map(row => row.name));
    // These identities are inherited from the public fixture, never generated from period membership.
    const identities = fixture.movement.map(group => ({ id: `demo-${group.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: group.name, kind: emergingNames.has(group.name) ? 'Emerging' : 'Established' }));
    const countBy = field => Object.fromEntries((field === 'sentiment' ? ['Positive', 'Neutral', 'Negative'] : ['Low', 'Medium', 'High'])
      .map(value => [value, records.filter(row => row[field] === value).length]));
    const eligible = records.filter(row => row.eligibleDigital);
    const migrated = eligible.filter(row => row.migratedTo);
    const experience = identity => {
      const rows = records.filter(row => row.trend === identity.name);
      return { ...identity, domain: rows[0]?.domain, count: rows.length, supportingRecordCount: rows.length,
        highPriorityCount: rows.filter(row => row.priority === 'High').length,
        recordIds: ids(rows), evidenceIds: ids(rows.slice(0, 3)) };
    };
    const establishedPresence = identities.filter(row => row.kind === 'Established').map(experience).filter(row => row.count);
    const established = establishedPresence.filter(row => row.count >= 2).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    const emerging = fixture.emerging.map(row => ({ ...row, ...experience(identities.find(item => item.name === row.name)) })).filter(row => row.count);
    const comparisonAvailable = Boolean(scope.comparison && comparison.length && records.length);
    const movement = comparisonAvailable ? identities.filter(row => row.kind === 'Established').map(identity => {
      const now = records.filter(row => row.trend === identity.name);
      const prior = comparison.filter(row => row.trend === identity.name);
      const currentCount = now.length, comparisonCount = prior.length;
      const change = comparisonCount ? (currentCount - comparisonCount) / comparisonCount * 100 : null;
      const label = !comparisonCount ? 'New in selected comparison window' : !currentCount ?
        'No longer observed in selected current period' :
        (Math.abs(currentCount - comparisonCount) <= 1 || Math.abs(change) <= 10) ? 'Stable' : currentCount > comparisonCount ? 'Increasing' : 'Decreasing';
      return { ...identity, currentCount, comparisonCount, percentageChange: change, label,
        currentPrevalence: currentCount / records.length, comparisonPrevalence: comparisonCount / comparison.length,
        currentRecordIds: ids(now), comparisonRecordIds: ids(prior) };
    }).filter(row => row.currentCount || row.comparisonCount) : [];
    const recurringLanguage = identities.map(identity => {
      const rows = records.filter(row => row.trend === identity.name);
      const phrases = (language.phrasesByTrend[identity.name] || []).map((phrase, index) => {
        const exactIds = ids(rows.filter(row => row.text.toLowerCase().includes(phrase.toLowerCase())));
        const original = fixture.phrases.find(item => item.trend === identity.name && item.phrase === phrase);
        return { id: original?.id || `language-${identity.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index + 1}`,
          phrase, count: exactIds.length, recordIds: exactIds };
      }).filter(phrase => phrase.count >= 3);
      return { ...identity, id: identity.name, domain: rows[0]?.domain, count: rows.length, recordIds: ids(rows),
        phrases, phraseIds: phrases.map(row => row.id), topTrend: fixture.topTrends.some(row => row.name === identity.name) };
    }).filter(row => row.phrases.length).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    const journeys = fixture.journeys.map(journey => {
      const stages = journey.stages.map(stage => {
        const rows = records.filter(row => stage.recordIds.includes(row.id));
        return { ...stage, recordIds: ids(rows), evidenceIds: ids(rows.slice(0, 2)),
          negative: rows.filter(row => row.sentiment === 'Negative').length,
          highEffort: rows.filter(row => row.effort === 'High').length,
          highPriority: rows.filter(row => row.priority === 'High').length };
      });
      return { ...journey, stages, supportingRecordCount: new Set(stages.flatMap(stage => stage.recordIds)).size };
    }).filter(row => row.supportingRecordCount);
    return { ...fixture, records, identities, establishedPresence, established, topTrends: established, emerging, movement, journeys, recurringLanguage,
      scope, comparisonAvailable, periodTotals: { current: records.length, comparison: comparison.length },
      needsMoreEvidence: { available: false, count: null },
      summary: { total: records.length, sentiment: countBy('sentiment'), effort: countBy('effort'), priority: countBy('priority'),
        eligibleDigital: eligible.length, migrated: migrated.length, established: establishedPresence.length, emerging: emerging.length },
      migration: { eligible: eligible.length, migrated: migrated.length,
        origins: fixture.migration.origins.map(row => ({ ...row,
          eligible: eligible.filter(r => r.touchpoint === row.name).length, migrated: migrated.filter(r => r.touchpoint === row.name).length,
          eligibleRecordIds: ids(eligible.filter(r => r.touchpoint === row.name)), migratedRecordIds: ids(migrated.filter(r => r.touchpoint === row.name)) })),
        destinations: fixture.migration.destinations.map(row => ({ ...row, migrated: migrated.filter(r => r.migratedTo === row.name).length,
          recordIds: ids(migrated.filter(r => r.migratedTo === row.name)) })),
        drivers: identities.map(row => ({ name: row.name, migrated: migrated.filter(r => r.trend === row.name).length })).filter(row => row.migrated)
          .sort((a, b) => b.migrated - a.migrated).slice(0, 3) },
      visuals: { ...fixture.visuals,
        sentiment: { ...fixture.visuals.sentiment, caption: records.length ? `${Math.round(100 * countBy('sentiment').Negative / records.length)}% of selected feedback reflects a negative experience.` : 'No feedback in the selected period.',
          rows: ['Positive', 'Neutral', 'Negative'].map(label => ({ label, count: countBy('sentiment')[label], recordIds: ids(records.filter(r => r.sentiment === label)) })) },
        domains: { title: 'Experience Concentration', question: 'Which recurring experiences account for the most feedback?', caption: 'Established and Emerging are ranked separately. Share uses selected feedback; rankings require two comments. Needs More Evidence is excluded.' },
        movement: { ...fixture.visuals.movement, caption: 'Established identities only. Count-based movement is descriptive and does not imply statistical significance.' },
        migration: { ...fixture.visuals.migration, caption: `${migrated.length} of ${eligible.length} selected eligible digital-friction records include validated assisted contact.` } }
    };
  }
  root.FEEDBACK_DEMO_PRESENTATION = { project, previous, validateScope };
})(window);
