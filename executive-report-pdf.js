/* Local, vector PDF renderer. No DOM capture, network request, or persistent storage. */
(function (root) {
    const W = 612, H = 792, M = 48, CONTENT = W - 2 * M;
    // All report inks and fills live here so semantic meaning stays consistent.
    const REPORT_COLORS = Object.freeze({
        navy: [0.055, 0.13, 0.22], blue: [0.12, 0.37, 0.60], lightBlue: [0.93, 0.96, 0.98],
        negative: [0.59, 0.25, 0.29], positive: [0.16, 0.42, 0.32], neutral: [0.34, 0.42, 0.50],
        effort: [0.52, 0.34, 0.12], priority: [0.50, 0.22, 0.25], migration: [0.08, 0.41, 0.43],
        emerging: [0.36, 0.31, 0.53], stable: [0.34, 0.42, 0.50], new: [0.12, 0.37, 0.60],
        noLongerObserved: [0.30, 0.46, 0.45], comparison: [0.57, 0.64, 0.69],
        chartTrack: [0.92, 0.94, 0.96], quoteFill: [0.965, 0.976, 0.986], rule: [0.80, 0.85, 0.89]
    });
    const { navy, blue, lightBlue, neutral, rule } = REPORT_COLORS;
    const movementColor = classification => ({
        increasing: REPORT_COLORS.negative, stable: REPORT_COLORS.stable, decreasing: REPORT_COLORS.positive,
        'New in selected comparison window': REPORT_COLORS.new,
        'No longer observed in selected current period': REPORT_COLORS.noLongerObserved
    })[classification] || REPORT_COLORS.blue;
    const fmt = n => Number(n.toFixed(2));
    const color = a => a.join(' ');
    const clean = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')
        .replace(/[\u2013\u2014\u2192]/g, '-').replace(/[^\x20-\x7e]/g, ' ');
    const esc = value => clean(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    const date = value => value ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
        .format(new Date(`${value.slice(0, 10)}T00:00:00Z`)) : 'Undated';
    const period = value => value ? `${date(value.startDate)} - ${date(value.endDate)}` : 'No dated period available';
    function filename(model) {
        const p = model.metadata.period;
        return p ? `feedback-intelligence-report-${p.startDate}-to-${p.endDate}.pdf` : 'feedback-intelligence-report.pdf';
    }
    function renderExecutiveReportPdf(model) {
        const pages = [];
        let page, y, currentSection = 'Executive Experience Report';
        function start(title, cover = false, accent = blue) {
            currentSection = title || currentSection;
            page = []; pages.push(page); y = cover ? 0 : 67;
            if (!cover) { text('FEEDBACK INTELLIGENCE', M, 35, 8, true, neutral);
                line(M, 48, W - M, 48, rule);
                text(title, M, y, 22, true); rect(M, y + 13, 42, 2, accent); y += 39; }
        }
        function text(value, x, top, size = 10, bold = false, ink = navy) {
            page.push(`${color(ink)} rg BT /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${fmt(x)} ${fmt(H - top)} Tm (${esc(value)}) Tj ET`);
        }
        function rect(x, top, width, height, fill = lightBlue) {
            page.push(`${color(fill)} rg ${fmt(x)} ${fmt(H - top - height)} ${fmt(width)} ${fmt(height)} re f`);
        }
        function line(x1, top1, x2, top2, ink = rule) {
            page.push(`${color(ink)} RG 0.6 w ${fmt(x1)} ${fmt(H - top1)} m ${fmt(x2)} ${fmt(H - top2)} l S`);
        }
        function ensure(height, title) { if (y + height > 722) start(title || currentSection); }
        function wrap(value, width = CONTENT, size = 10) {
            const words = clean(value).split(/\s+/).filter(Boolean), lines = []; let row = '';
            const max = width / (size * 0.51);
            for (const word of words) {
                if ((row + ' ' + word).length > max && row) { lines.push(row); row = ''; }
                if (word.length > max) {
                    for (let i = 0; i < word.length; i += Math.floor(max)) {
                        if (row) { lines.push(row); row = ''; }
                        lines.push(word.slice(i, i + Math.floor(max)));
                    }
                } else row += (row ? ' ' : '') + word;
            }
            if (row) lines.push(row); return lines.length ? lines : [''];
        }
        function paragraph(value, opts = {}) {
            const size = opts.size || 10, lh = opts.lineHeight || 15, width = opts.width || CONTENT;
            const lines = wrap(value, width, size);
            ensure(lines.length * lh + 5, opts.title);
            for (const row of lines) { text(row, opts.x || M, y, size, opts.bold || false, opts.ink || navy); y += lh; }
            y += opts.after ?? 7;
        }
        function heading(value) { currentSection = value; ensure(60, value); text(value, M, y, 15, true); line(M, y + 8, W - M, y + 8, rule); y += 24; }
        function sub(value, ink = navy) { ensure(32); text(value, M, y, 11, true, ink); y += 18; }
        function quote(item, compact = false) {
            if (!item?.quote) return;
            const q = wrap(`"${item.quote}"`, CONTENT - 28, 9).slice(0, 4);
            ensure(q.length * 13 + 30);
            rect(M, y - 10, CONTENT, q.length * 13 + (compact ? 19 : 28), REPORT_COLORS.quoteFill);
            for (const row of q) { text(row, M + 13, y, 9); y += 13; }
            const meta = [item.date && date(item.date), item.source, item.touchpoint].filter(Boolean).join('  |  ');
            if (meta) { text(meta, M + 13, y + 1, 8, false, neutral); y += 13; }
            y += compact ? 9 : 18;
        }
        function bars(title, entries, denominator, limit = 6, inkFor = () => blue) {
            ensure(75, title);
            heading(title);
            if (!entries.length) { paragraph('No data available for this view.'); return; }
            for (const item of entries.slice(0, limit)) {
                ensure(39, title);
                text(item.name, M, y, 9, true); text(`${item.count}  (${denominator ? Math.round(item.count * 100 / denominator) : 0}%)`, W - M - 80, y, 9, false, neutral);
                y += 9; rect(M, y, CONTENT, 7, REPORT_COLORS.chartTrack);
                rect(M, y, Math.max(1, CONTENT * item.count / Math.max(denominator, 1)), 7, inkFor(item)); y += 27;
            }
            y += 5;
        }
        // Cover
        start('', true);
        rect(0, 0, W, 8, navy); rect(0, 8, W, 3, blue);
        text('FEEDBACK INTELLIGENCE', M, 93, 11, true, blue);
        text('Executive', M, 165, 38, true);
        text('Experience Report', M, 211, 38, true);
        rect(M, 260, 76, 4, blue);
        rect(M, 301, CONTENT, 66, lightBlue);
        text('ANALYSIS PERIOD', M + 12, 325, 9, true, blue);
        text(period(model.metadata.period), M + 12, 350, 17, true);
        text('FEEDBACK ANALYZED', M, 414, 9, true, neutral);
        text(`${model.metadata.total.toLocaleString('en-US')} records`, M, 439, 17, true);
        text('GENERATED', M, 503, 9, true, neutral);
        text(new Date(model.metadata.generatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC', M, 528, 13);
        text('Executive first. Evidence available.', M, 675, 11, true, blue);
        // Summary
        start('Executive Summary');
        const k = model.executiveSummary;
        const metrics = [
            ['Total Feedback', k.total.toLocaleString('en-US'), blue], ['Negative Experience', `${k.negativePercent}%`, REPORT_COLORS.negative],
            ['High Effort', `${k.highEffort}`, REPORT_COLORS.effort], ['High Priority', `${k.highPriority}`, REPORT_COLORS.priority],
            ['Digital to Assisted', k.digitalAssistedPercent === null ? 'N/A' : `${k.digitalAssistedPercent}%`, REPORT_COLORS.migration]
        ];
        for (const [i, [label, value, ink]] of metrics.entries()) {
            const col = i % 3, row = Math.floor(i / 3), x = M + col * 172, top = 119 + row * 90;
            rect(x, top, 160, 78); rect(x, top, 160, 2, ink);
            text(value, x + 12, top + 34, 24, true, ink); text(label, x + 12, top + 56, 9, true);
        }
        y = 331; paragraph(k.narrative, { size: 12, lineHeight: 19, after: 12 });
        if (k.digitalAssistedPercent !== null) paragraph(`Among ${model.digitalAssisted.eligible} eligible digital-friction records, ${model.digitalAssisted.migrated} showed movement to assisted support (${k.digitalAssistedPercent}%).`);
        paragraph('All proportions describe analyzed feedback; they should not be read as rates across every customer or interaction.', { size: 9, ink: neutral });
        bars('Sentiment Mix', model.charts.sentiment, k.total, 3, item => ({
            Negative: REPORT_COLORS.negative, Positive: REPORT_COLORS.positive, Neutral: REPORT_COLORS.neutral
        })[item.name] || blue);
        // Visuals
        start('Experience Concentration'); bars(model.classificationTotals ? 'Established Experiences - Distinct Records' : 'Leading Experience Categories', model.classificationTotals ? (model.charts.experienceConcentration || []) : model.charts.categories, k.total);
        heading('What this report covers');
        paragraph('Recurring themes, selected-period movement, taxonomy gaps, digital-to-assisted relationships, current-state journeys, and the language found in supporting feedback.');
        if(model.metadata.periodSelection) {
            const selection=model.metadata.periodSelection,c=selection.coverage;
            paragraph(`Current period: ${selection.currentLabel}. Comparison: ${selection.comparisonRange ? period(selection.comparisonRange) : 'Off'}.`, {size:9});
            paragraph(`Date coverage: ${c.datedRecordCount} of ${c.totalRecordCount} records include usable dates; ${c.undatedRecordCount} missing or invalid. ${selection.currentRange ? 'Undated records excluded from dated analysis.' : 'All available data includes undated records.'}`, {size:9});
            if(model.comparisonSummary) {
                const c=model.comparisonSummary,t=c.classificationTotals;
                paragraph(`Comparison: ${c.total} feedback records; ${c.negativePercent}% Negative; ${c.highEffort} High Effort; ${c.highPriority} High Priority. Digital to Assisted: ${c.digitalAssisted.rate === null ? 'Unavailable' : c.digitalAssisted.rate+'%'}.`, {size:9});
                paragraph(`Comparison sentiment: ${c.sentiment.map(s=>s.name+': '+s.count).join('; ')}.`, {size:9});
                if(t) paragraph(`Comparison presence: ${t.establishedTrends} Established; ${t.emergingExperiences === null ? 'Emerging analysis unavailable' : t.emergingExperiences + ' Emerging (provisional, movement unavailable)'}; ${t.unclassifiedSignals} Needs More Evidence signals.`, {size:9});
            }
        }

        // Trends
        ensure(180,'Top Trends'); heading('Top Trends');
        if (!model.topTrends.length) paragraph('No recurring experience groups were available for this analysis.');
        for (const [i, trend] of model.topTrends.entries()) {
            ensure(143, 'Top Trends'); sub(`${i + 1}. ${trend.name}`);
            text(`${trend.count} supporting records`, M, y, 9, false, neutral);
            text(`${trend.negativePercent}% negative`, M + 141, y, 9, false, REPORT_COLORS.negative);
            text(`${trend.highEffortCount} high effort`, M + 252, y, 9, false, REPORT_COLORS.effort);
            text(`${trend.highPriorityCount} high priority`, M + 359, y, 9, false, REPORT_COLORS.priority);
            y += 20;
            paragraph(trend.description || trend.insight || '', { after: 3 });
            if (trend.evidence[0]) quote(trend.evidence[0]);
        }
        // Movement
        ensure(220,'Trend Movement'); heading('Trend Movement');
        if (!model.trendMovement.periods) paragraph('Trend Movement was not available because valid comparison periods were not configured.');
        else {
            paragraph(`Current: ${period(model.trendMovement.periods.current)}. Comparison: ${period(model.trendMovement.periods.comparison)}.`, { size: 9, ink: neutral });
            if (!model.trendMovement.items.length) paragraph('No recurring experiences were available for this comparison.');
            for (const item of model.trendMovement.items) {
                ensure(160, 'Trend Movement'); sub(`${item.name} - ${item.classification}`, movementColor(item.classification));
                paragraph(`Current ${item.current.supportingRecordCount}/${item.current.totalRecordCount} (${item.current.prevalence === null ? 'N/A' : (100 * item.current.prevalence).toFixed(1) + '%'})  |  Comparison ${item.comparison.supportingRecordCount}/${item.comparison.totalRecordCount} (${item.comparison.prevalence === null ? 'N/A' : (100 * item.comparison.prevalence).toFixed(1) + '%'})`, { size: 9, after: 2 });
                if (item.percentageChange !== null) paragraph(`${item.percentageChange.toFixed(1)}% count change; ${item.prevalencePointChange?.toFixed(1) ?? 'N/A'} percentage-point prevalence change.`, { size: 9, ink: neutral, after: 8 });
                const max = Math.max(1, item.current.supportingRecordCount, item.comparison.supportingRecordCount);
                text('Current', M, y, 8, false, neutral); rect(M + 75, y - 7, 210 * item.current.supportingRecordCount / max, 7, movementColor(item.classification)); y += 15;
                text('Comparison', M, y, 8, false, neutral); rect(M + 75, y - 7, 210 * item.comparison.supportingRecordCount / max, 7, REPORT_COLORS.comparison); y += 20;
                if (item.evidence[0]) quote(item.evidence[0]);
            }
        }
        // Gaps
        start('Emerging Experiences', false, REPORT_COLORS.emerging);
        paragraph('These are gaps in taxonomy coverage. Their inclusion does not indicate temporal growth.', { size: 9, ink: neutral });
        if (model.emergingExperiences.status === 'failed') paragraph('Emerging Experience analysis could not be completed. Established Trends and other validated results remain available.');
        else if (model.emergingExperiences.status !== 'ready') paragraph('Taxonomy coverage was unavailable for this analysis.');
        else if (!model.emergingExperiences.items.length) paragraph('No recurring taxonomy gaps were detected.');
        if (model.classificationTotals) paragraph(`${model.classificationTotals.establishedTrends} Established Trends; ${model.emergingExperiences.status === 'failed' ? 'Emerging analysis unavailable' : model.classificationTotals.emergingExperiences + ' provisional Emerging Experiences'}; ${model.classificationTotals.unclassifiedSignals} signals Unclassified / Needs More Evidence. Unclassified signals are not confirmed trends.`);
        for (const item of model.emergingExperiences.items.slice(0, 6)) {
            ensure(94, 'Emerging Experiences'); sub(item.name); paragraph(`${item.gapType}  |  ${item.count} supporting records`, { size: 9, ink: REPORT_COLORS.emerging, after: 2 });
            paragraph(item.taxonomyContext || item.explanation, { size: 9, after: 2 });
            if (item.evidence[0]) quote(item.evidence[0], true);
        }
        // Migration
        start('Digital to Assisted', false, REPORT_COLORS.migration);
        const d = model.digitalAssisted;
        paragraph(d.rate === null ? 'No eligible digital-friction feedback was available for a migration rate.' :
            `${d.migrated} of ${d.eligible} eligible digital-friction records showed validated movement to assisted support (${d.rate}%).`, { size: 12, lineHeight: 18, ink: REPORT_COLORS.migration });
        paragraph('Denominator: analyzed feedback records with evidenced digital friction. This is not a rate of support contact among all customers.', { size: 9, ink: neutral });
        if (d.origins.length) bars('Digital Origins', d.origins, d.eligible, 4);
        if (d.destinations.length) bars('Assisted Destinations', d.destinations, d.migrated, 4, () => REPORT_COLORS.migration);
        if (d.drivers.length) { heading('Migration-Driving Experiences'); paragraph(d.drivers.map(x => `${x.name} (${x.count})`).join('  |  ')); }
        // Journeys
        start('Journey Opportunities');
        if (!model.journeys.length) paragraph('No journey maps were generated for this analysis. Generate journeys in the app before exporting to include them here.');
        for (const journey of model.journeys) {
            ensure(115, 'Journey Opportunities'); sub(journey.name);
            paragraph(`Current-state journey: ${journey.journey}. ${journey.goal || ''}`, { size: 9, after: 2 });
            paragraph(`Stages with feedback: ${journey.stages.map(s => `${s.name} (${s.count}; ${s.highEffort || 0} high effort, ${s.highPriority || 0} high priority)`).join(', ') || 'None identified'}`, { size: 9, after: 2 });
            if (journey.proposedAction) paragraph(`Proposed focus: ${journey.proposedAction}`, { size: 9, ink: blue });
            if (journey.evidence[0]) quote(journey.evidence[0], true);
        }
        // Language
        start('How Customers Describe Experiences');
        paragraph('Recurring concepts require at least 3 distinct records. Counts describe this feedback sample.', { size: 9, ink: neutral });
        for (const item of model.recurringLanguage) {
            ensure(92, 'How Customers Describe Experiences'); sub(`${item.experienceType} · ${item.theme} - ${item.count} supporting records`);
            const phrases = `Recurring language: ${item.phrases.map(p => `"${p.text}" (${p.count})`).join('  |  ')}`;
            const phraseLines = wrap(phrases, CONTENT - 24, 9);
            ensure(phraseLines.length * 15 + 12);
            rect(M, y - 10, CONTENT, phraseLines.length * 15 + 13, lightBlue);
            paragraph(phrases, { size: 9, x: M + 12, width: CONTENT - 24, ink: navy, after: 8 });
            if (item.evidence[0]) { paragraph('Supporting evidence', { size: 8, bold: true, ink: neutral, after: 0 }); quote(item.evidence[0]); }
        }
        // Appendix / method
        start('Supporting Evidence');
        if (!model.evidence.length) paragraph('No supporting excerpts were available.');
        for (const item of model.evidence) quote(item);
        ensure(24 + wrap(model.methodology, CONTENT, 9).length * 14 + 5, 'Methodology and Scope');
        heading('Methodology and Scope'); paragraph(model.methodology, { size: 9, lineHeight: 14 });
        paragraph(`Scope: ${model.metadata.total} successfully analyzed records; ${model.metadata.period ? `${model.metadata.period.dated} dated and ${model.metadata.period.undated} undated.` : 'No valid feedback dates available.'}`, { size: 9 });
        if (model.metadata.sources.length) paragraph(`Sources represented: ${model.metadata.sources.join(', ')}.`, { size: 9 });
        // Footers, then serialize a compact PDF 1.4 using base fonts and vector paths.
        const periodLabel = period(model.metadata.period);
        pages.forEach((commands, index) => {
            commands.push(`${color(rule)} RG 0.6 w ${M} 45 m ${W - M} 45 l S`);
            commands.push(`${color(neutral)} rg BT /F1 8 Tf 1 0 0 1 ${M} 30 Tm (${esc(periodLabel)}) Tj ET`);
            commands.push(`${color(neutral)} rg BT /F1 8 Tf 1 0 0 1 ${W - M - 67} 30 Tm (Page ${index + 1} of ${pages.length}) Tj ET`);
        });
        const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '',
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'];
        const refs = [];
        for (const commands of pages) {
            const content = commands.join('\n') + '\n', pageId = objects.length + 1, streamId = pageId + 1;
            refs.push(`${pageId} 0 R`);
            objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamId} 0 R >>`);
            objects.push(`<< /Length ${content.length} >>\nstream\n${content}endstream`);
        }
        objects[1] = `<< /Type /Pages /Kids [${refs.join(' ')}] /Count ${pages.length} >>`;
        let output = '%PDF-1.4\n', offsets = [0];
        for (const [index, object] of objects.entries()) { offsets.push(output.length); output += `${index + 1} 0 obj\n${object}\nendobj\n`; }
        const xref = output.length;
        output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
        for (const offset of offsets.slice(1)) output += `${String(offset).padStart(10, '0')} 00000 n \n`;
        output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
        return { bytes: Uint8Array.from(output, char => char.charCodeAt(0)), pageCount: pages.length, filename: filename(model) };
    }
    const api = { renderExecutiveReportPdf, filename, REPORT_COLORS };
    if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ExecutiveReportPdf = api;
})(globalThis);
