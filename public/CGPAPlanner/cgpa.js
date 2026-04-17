/* =========================================================================
   CGPA Planner — math + UI binding
   Reads aiubGraphData (populated by Grade Report content scripts) and
   projects future CGPA from chosen grades, target inputs, and averages.
   Lives entirely in your browser — nothing leaves.

   All DOM writes use textContent / createElement for any value that may have
   come from the scraped portal data (course names, grades, student name).
   No interpolation into innerHTML.
   ========================================================================= */
(function () {
  'use strict';

  // AIUB grade scale. Source: AIUB academic handbook.
  const GRADE_POINTS = {
    'A+': 4.00, 'A': 3.75, 'B+': 3.50, 'B': 3.25,
    'C+': 3.00, 'C': 2.75, 'D+': 2.50, 'D': 2.25, 'F': 0.00,
  };
  const GRADE_ORDER = ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F'];
  const GRADUATION_CREDITS = 148; // BSc CSE minimum

  const el = {
    heroCgpa: byId('heroCgpa'),
    heroCredits: byId('heroCredits'),
    planner: byId('planner'),
    emptyState: byId('emptyState'),

    snapProgress: byId('snapProgress'),
    snapProgressHint: byId('snapProgressHint'),
    progressBar: byId('progressBar'),
    segDone: byId('segDone'),
    segOng: byId('segOng'),
    segRem: byId('segRem'),
    creditsDone: byId('creditsDone'),
    creditsOng: byId('creditsOng'),
    creditsRem: byId('creditsRem'),
    snapStanding: byId('snapStanding'),
    snapStandingHint: byId('snapStandingHint'),

    targetCgpa: byId('targetCgpa'),
    verdictHeadline: byId('verdictHeadline'),
    requiredAvg: byId('requiredAvg'),
    stopNowCgpa: byId('stopNowCgpa'),
    feasibilityChip: byId('feasibilityChip'),

    ongoingBlock: byId('ongoingBlock'),
    ongoingBody: byId('ongoingBody'),
    pickedCgpa: byId('pickedCgpa'),
    pickedDelta: byId('pickedDelta'),

    remainingBlock: byId('remainingBlock'),
    remainingSlider: byId('remainingSlider'),
    remainingSliderOut: byId('remainingSliderOut'),
    remainingCgpa: byId('remainingCgpa'),
    remainingCredits: byId('remainingCredits'),
    remainingGap: byId('remainingGap'),

    insightsGrid: byId('insightsGrid'),
    trajectoryChart: byId('trajectoryChart'),
  };

  let data = null;
  let pickedGrades = new Map();
  let chart = null;

  // ------- Utilities -------
  function byId(id) { return document.getElementById(id); }

  function fmt(n, digits = 2) {
    if (!Number.isFinite(n)) return '—';
    return n.toFixed(digits);
  }

  function toNum(v) {
    if (typeof v === 'number') return v;
    if (!v) return 0;
    const m = String(v).match(/-?\d+(\.\d+)?/);
    return m ? parseFloat(m[0]) : 0;
  }

  function storage() {
    return (typeof browser !== 'undefined' && browser.storage) ? browser
      : (typeof chrome !== 'undefined' && chrome.storage) ? chrome
      : null;
  }

  // Clear a node's children safely without innerHTML.
  function clearNode(n) { while (n.firstChild) n.removeChild(n.firstChild); }

  // Build a DOM element with class + text content.
  function tag(name, className, text) {
    const e = document.createElement(name);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  }

  function pillNode(label, tone) {
    return tag('span', `pill pill-${tone}`, label);
  }

  // ------- Data derivation -------
  async function loadData() {
    const api = storage();
    if (!api) return null;
    return new Promise((resolve) => {
      api.storage.local.get({ aiubGraphData: null }, (res) => {
        resolve(res.aiubGraphData || null);
      });
    });
  }

  function deriveModel(graph) {
    if (!graph) return null;
    const curriculum = graph.curriculum || null;
    const semester = graph.semester || null;
    if (!curriculum && !semester) return null;

    const cgpa = (curriculum && curriculum.cgpa > 0)
      ? curriculum.cgpa
      : (semester && semester.latestCgpa > 0 ? semester.latestCgpa : 0);

    const stateCredits = (curriculum && curriculum.stateCredits) || {};
    const completedCr = toNum(stateCredits.completed);
    const ongoingCr = toNum(stateCredits.ongoing);
    const withdrawnCr = toNum(stateCredits.withdrawn);
    const notAttemptedCr = toNum(stateCredits.notAttempted);
    const totalCurriculumCr = completedCr + ongoingCr + withdrawnCr + notAttemptedCr;

    let ongoing = [];
    if (semester && Array.isArray(semester.courseStates)) {
      ongoing = semester.courseStates
        .filter((c) => c.state === 'ong' && c.name)
        .map((c) => ({
          key: `${c.classId || c.name}::${c.label || ''}`,
          name: String(c.name || ''),
          classId: String(c.classId || ''),
          label: String(c.label || ''),
          credit: toNum(c.credit || c.creditValue),
        }));
    }
    if (!ongoing.length && curriculum && Array.isArray(curriculum.courseStates)) {
      ongoing = curriculum.courseStates
        .filter((c) => c.state === 'ong' && c.name)
        .map((c) => ({
          key: `${c.code || c.name}::curriculum`,
          name: String(c.name || ''),
          classId: String(c.code || ''),
          label: '',
          credit: toNum(c.credit),
        }));
    }
    const seen = new Set();
    ongoing = ongoing.filter((c) => {
      const k = c.name.toLowerCase().trim();
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    let completed = [];
    if (semester && Array.isArray(semester.courseStates)) {
      completed = semester.courseStates
        .filter((c) => c.state === 'done' && c.name && c.grade && GRADE_POINTS[c.grade] !== undefined)
        .map((c) => ({
          name: String(c.name || ''),
          classId: String(c.classId || ''),
          credit: toNum(c.credit || c.creditValue),
          grade: c.grade,
          gp: GRADE_POINTS[c.grade],
          label: String(c.label || ''),
        }));
    }

    const cgpaTrend = (semester && Array.isArray(semester.cgpaTrend)) ? semester.cgpaTrend : [];
    const semesterGpaTrend = (semester && Array.isArray(semester.semesterGpaTrend)) ? semester.semesterGpaTrend : [];

    const studentName = (curriculum && curriculum.studentName) || (semester && semester.studentName) || '';
    const studentId = (curriculum && curriculum.studentId) || (semester && semester.studentId) || '';
    const program = (curriculum && curriculum.program) || (semester && semester.program) || '';

    return {
      cgpa, completedCr, ongoingCr, withdrawnCr, notAttemptedCr, totalCurriculumCr,
      ongoing, completed,
      cgpaTrend, semesterGpaTrend,
      studentName, studentId, program,
      currentPoints: cgpa * completedCr,
    };
  }

  // ------- Math -------
  function projectCgpa(currentPoints, currentCr, addedPoints, addedCr) {
    const totalCr = currentCr + addedCr;
    if (totalCr <= 0) return 0;
    return (currentPoints + addedPoints) / totalCr;
  }

  function requiredAvg(currentPoints, currentCr, remainingCr, targetCgpa) {
    if (remainingCr <= 0) return NaN;
    return (targetCgpa * (currentCr + remainingCr) - currentPoints) / remainingCr;
  }

  function feasibilityOf(req) {
    if (!Number.isFinite(req)) return { tone: 'muted', label: 'n/a' };
    if (req > 4.00) return { tone: 'err', label: 'Not reachable' };
    if (req > 3.85) return { tone: 'warn', label: 'Near-perfect' };
    if (req > 3.50) return { tone: 'warn', label: 'Stretch' };
    if (req > 3.00) return { tone: 'ok', label: 'Achievable' };
    return { tone: 'ok', label: 'Comfortable' };
  }

  function standingOf(cgpa) {
    if (cgpa >= 3.75) return { label: "Dean's list", tone: 'ok', hint: 'Top band of the class — 3.75+.' };
    if (cgpa >= 3.50) return { label: 'Very good', tone: 'ok', hint: 'Strong standing.' };
    if (cgpa >= 3.00) return { label: 'Good', tone: 'ok', hint: 'Solid standing.' };
    if (cgpa >= 2.25) return { label: 'Passing', tone: 'warn', hint: 'Above the 2.00 graduation floor.' };
    if (cgpa >= 2.00) return { label: 'Graduation floor', tone: 'warn', hint: 'CGPA 2.00 is the minimum to graduate.' };
    return { label: 'Probation zone', tone: 'err', hint: 'Below 2.00 — academic probation territory.' };
  }

  function pickedOngoingPoints() {
    if (!data) return { points: 0, credits: 0 };
    let points = 0, credits = 0;
    for (const c of data.ongoing) {
      const g = pickedGrades.get(c.key);
      if (!g) continue;
      const gp = GRADE_POINTS[g];
      if (gp === undefined) continue;
      points += gp * c.credit;
      credits += c.credit;
    }
    return { points, credits };
  }

  // ------- Rendering -------
  function renderAll() {
    if (!data) {
      el.emptyState.hidden = false;
      el.planner.hidden = true;
      return;
    }
    el.emptyState.hidden = true;
    el.planner.hidden = false;

    renderHero();
    renderSnapshot();
    renderTarget();
    renderOngoing();
    renderRemaining();
    renderInsights();
    renderTrajectory();
  }

  function renderHero() {
    el.heroCgpa.textContent = fmt(data.cgpa);
    el.heroCredits.textContent = `${fmt(data.completedCr, 0)} completed · ${fmt(data.ongoingCr, 0)} ongoing`;
  }

  function renderSnapshot() {
    const done = data.completedCr;
    const ong = data.ongoingCr;
    const remaining = Math.max(0, GRADUATION_CREDITS - done - ong);
    const pct = Math.min(100, (done / GRADUATION_CREDITS) * 100);

    el.snapProgress.textContent = `${fmt(done, 0)} / ${GRADUATION_CREDITS}`;
    el.snapProgressHint.textContent = `${fmt(remaining, 0)} credits left · ${fmt(pct, 0)}% of the BSc CSE minimum`;
    el.progressBar.style.width = `${pct}%`;

    const segTotal = Math.max(1, done + ong + remaining);
    el.segDone.style.flexBasis = `${(done / segTotal) * 100}%`;
    el.segOng.style.flexBasis = `${(ong / segTotal) * 100}%`;
    el.segRem.style.flexBasis = `${(remaining / segTotal) * 100}%`;
    el.creditsDone.textContent = fmt(done, 0);
    el.creditsOng.textContent = fmt(ong, 0);
    el.creditsRem.textContent = fmt(remaining, 0);

    const st = standingOf(data.cgpa);
    clearNode(el.snapStanding);
    el.snapStanding.appendChild(pillNode(st.label, st.tone));
    el.snapStandingHint.textContent = st.hint;
  }

  function renderTarget() {
    const target = toNum(el.targetCgpa.value);
    if (!Number.isFinite(target) || target <= 0) {
      el.verdictHeadline.textContent = 'Enter a target between 2.00 and 4.00 to compute the path.';
      el.requiredAvg.textContent = '—';
      el.stopNowCgpa.textContent = fmt(data.cgpa);
      clearNode(el.feasibilityChip);
      el.feasibilityChip.appendChild(pillNode('n/a', 'muted'));
      return;
    }
    const remainingCr = Math.max(0, GRADUATION_CREDITS - data.completedCr);
    const req = requiredAvg(data.currentPoints, data.completedCr, remainingCr, target);

    el.requiredAvg.textContent = remainingCr > 0 && Number.isFinite(req)
      ? `${fmt(req)} GPA`
      : '—';

    el.stopNowCgpa.textContent = fmt(data.cgpa);

    const feas = feasibilityOf(req);
    clearNode(el.feasibilityChip);
    el.feasibilityChip.appendChild(pillNode(feas.label, feas.tone));

    clearNode(el.verdictHeadline);
    if (!Number.isFinite(req)) {
      el.verdictHeadline.textContent = 'No remaining credits — your CGPA is locked in.';
    } else if (req <= 0) {
      el.verdictHeadline.textContent = `You're already above your target (${fmt(target)}). Cruise mode.`;
    } else if (req > 4.00) {
      el.verdictHeadline.append(
        'Reaching ', tag('b', null, fmt(target)),
        ' needs ', tag('b', null, fmt(req)),
        ` avg on ${fmt(remainingCr, 0)} credits — above the 4.00 ceiling. Consider a closer target.`,
      );
    } else {
      el.verdictHeadline.append(
        'To reach ', tag('b', null, `${fmt(target)} CGPA`),
        ', you need an average of ', tag('b', null, `${fmt(req)} GPA`),
        ' on your remaining ', tag('b', null, `${fmt(remainingCr, 0)}`),
        ' credits.',
      );
    }
  }

  function renderOngoing() {
    const list = data.ongoing;
    el.ongoingBlock.hidden = list.length === 0;
    if (!list.length) return;

    clearNode(el.ongoingBody);
    for (const c of list) {
      const row = document.createElement('tr');
      row.dataset.key = c.key;

      const nameTd = tag('td', 'course-cell');
      nameTd.appendChild(tag('strong', null, c.name));
      if (c.classId) {
        const small = tag('small', null, c.classId + (c.label ? ' · ' + c.label : ''));
        nameTd.appendChild(small);
      }
      row.appendChild(nameTd);

      row.appendChild(tag('td', null, fmt(c.credit, 0)));

      GRADE_ORDER.forEach((grade) => {
        const td = tag('td', 'grade-cell');
        td.dataset.grade = grade;
        const addedPts = GRADE_POINTS[grade] * c.credit;
        const proj = projectCgpa(data.currentPoints, data.completedCr, addedPts, c.credit);
        td.textContent = fmt(proj);
        td.title = `If this one course ends at ${grade} your CGPA would be ${fmt(proj)}`;
        td.addEventListener('click', () => {
          const current = pickedGrades.get(c.key);
          if (current === grade) pickedGrades.delete(c.key);
          else pickedGrades.set(c.key, grade);
          refreshOngoingSelection();
          renderPickedSummary();
        });
        row.appendChild(td);
      });

      el.ongoingBody.appendChild(row);
    }

    refreshOngoingSelection();
    renderPickedSummary();
  }

  function refreshOngoingSelection() {
    el.ongoingBody.querySelectorAll('tr').forEach((tr) => {
      const grade = pickedGrades.get(tr.dataset.key);
      tr.querySelectorAll('td.grade-cell').forEach((td) => {
        td.classList.toggle('selected', td.dataset.grade === grade);
      });
    });
  }

  function renderPickedSummary() {
    const { points, credits } = pickedOngoingPoints();
    if (credits === 0) {
      el.pickedCgpa.textContent = fmt(data.cgpa);
      el.pickedDelta.textContent = 'Pick grades above to see the projection.';
      return;
    }
    const proj = projectCgpa(data.currentPoints, data.completedCr, points, credits);
    el.pickedCgpa.textContent = fmt(proj);
    const delta = proj - data.cgpa;
    const sign = delta >= 0 ? '+' : '';
    const coverage = `${fmt(credits, 0)} of ${fmt(data.ongoingCr, 0)} ongoing credits picked`;
    el.pickedDelta.textContent = `${sign}${fmt(delta)} vs. current · ${coverage}`;
  }

  function renderRemaining() {
    const notAtt = data.notAttemptedCr;
    el.remainingBlock.hidden = notAtt <= 0;
    if (notAtt <= 0) return;

    const creditsInPlay = Math.max(
      data.ongoingCr + data.notAttemptedCr,
      Math.max(0, GRADUATION_CREDITS - data.completedCr),
    );
    el.remainingCredits.textContent = `${fmt(creditsInPlay, 0)} cr`;

    const target = toNum(el.targetCgpa.value);
    const update = () => {
      const avg = toNum(el.remainingSlider.value);
      el.remainingSliderOut.textContent = fmt(avg);
      const proj = projectCgpa(data.currentPoints, data.completedCr, avg * creditsInPlay, creditsInPlay);
      el.remainingCgpa.textContent = fmt(proj);
      if (Number.isFinite(target) && target > 0) {
        const gap = proj - target;
        const sign = gap >= 0 ? '+' : '';
        el.remainingGap.textContent = `${sign}${fmt(gap)}`;
        el.remainingGap.style.color = gap >= 0 ? 'var(--cgpa-ok)' : 'var(--cgpa-err)';
      } else {
        el.remainingGap.textContent = '—';
        el.remainingGap.style.color = '';
      }
    };
    el.remainingSlider.oninput = update;
    update();
  }

  function buildInsightCard({ icon, tone, title, value, hint }) {
    const art = tag('article', `insight-card tone-${tone}`);
    art.appendChild(tag('span', 'insight-icon', icon));
    art.appendChild(tag('span', 'insight-title', title));
    art.appendChild(tag('span', 'insight-value', value));
    art.appendChild(tag('span', 'insight-hint', hint));
    return art;
  }

  function renderInsights() {
    const target = toNum(el.targetCgpa.value);
    const creditsInPlay = Math.max(0, GRADUATION_CREDITS - data.completedCr);
    const cards = [];

    if (Number.isFinite(target) && creditsInPlay > 0) {
      const req = requiredAvg(data.currentPoints, data.completedCr, creditsInPlay, target);
      if (req <= data.cgpa + 0.01) {
        cards.push({
          icon: '✓', tone: 'ok', title: 'Trajectory',
          value: 'Ahead of target',
          hint: `Your current CGPA of ${fmt(data.cgpa)} already exceeds what you need for ${fmt(target)}.`,
        });
      } else if (req <= 4.00) {
        cards.push({
          icon: '→', tone: 'ok', title: 'Trajectory',
          value: `Need ${fmt(req)} avg`,
          hint: `Average this GPA over the remaining ${fmt(creditsInPlay, 0)} credits to hit ${fmt(target)}.`,
        });
      } else {
        cards.push({
          icon: '!', tone: 'err', title: 'Trajectory',
          value: 'Target unreachable',
          hint: `Would need ${fmt(req)} avg — above the 4.00 ceiling. Pick a lower target.`,
        });
      }
    }

    const typicalCr = 3;
    const aPlusProj = projectCgpa(data.currentPoints, data.completedCr, 4.00 * typicalCr, typicalCr);
    const aPlusDelta = aPlusProj - data.cgpa;
    cards.push({
      icon: 'A+', tone: 'ok', title: 'Single A+ impact',
      value: `${aPlusDelta >= 0 ? '+' : ''}${fmt(aPlusDelta)}`,
      hint: `A single A+ on a 3-credit course moves your CGPA from ${fmt(data.cgpa)} to ${fmt(aPlusProj)}.`,
    });

    const cProj = projectCgpa(data.currentPoints, data.completedCr, 2.75 * typicalCr, typicalCr);
    const cDelta = cProj - data.cgpa;
    cards.push({
      icon: 'C', tone: cDelta >= 0 ? 'ok' : 'warn', title: 'Single C impact',
      value: `${cDelta >= 0 ? '+' : ''}${fmt(cDelta)}`,
      hint: `A single C on a 3-credit course drops you to ${fmt(cProj)}.`,
    });

    if (Number.isFinite(target) && creditsInPlay > 0) {
      const req = requiredAvg(data.currentPoints, data.completedCr, creditsInPlay, target);
      const low = Math.max(0, req);
      const nearest = [...GRADE_ORDER].reverse().find((g) => GRADE_POINTS[g] >= low) || 'F';
      cards.push({
        icon: '⇣', tone: req > 4.00 ? 'err' : (req > 3.50 ? 'warn' : 'ok'),
        title: 'Lowest affordable average',
        value: Number.isFinite(req) ? (req > 4.00 ? '> 4.00' : fmt(req)) : '—',
        hint: req > 4.00
          ? `Even all A+ won't reach ${fmt(target)}.`
          : `Averaging ${nearest} (${fmt(GRADE_POINTS[nearest])}) or better on remaining credits hits ${fmt(target)}.`,
      });
    }

    if (Number.isFinite(target) && creditsInPlay > 0) {
      const typicalLoad = 15;
      const semestersLeft = Math.ceil(creditsInPlay / typicalLoad);
      cards.push({
        icon: '⏱', tone: 'ok', title: 'Semesters to graduation',
        value: `~${semestersLeft}`,
        hint: `At 15 credits / semester, roughly ${semestersLeft} more semester${semestersLeft === 1 ? '' : 's'} of coursework ahead.`,
      });
    }

    const retakes = data.completed.filter((c) => c.gp < 3.25);
    if (retakes.length > 0) {
      let best = null;
      for (const c of retakes) {
        const replacedPoints = data.currentPoints - (c.gp * c.credit) + (4.00 * c.credit);
        const newCgpa = replacedPoints / data.completedCr;
        const delta = newCgpa - data.cgpa;
        if (!best || delta > best.delta) best = { course: c, delta, newCgpa };
      }
      if (best) {
        cards.push({
          icon: '↻', tone: 'warn', title: 'Biggest retake lift',
          value: `${best.delta >= 0 ? '+' : ''}${fmt(best.delta)}`,
          hint: `Retaking ${best.course.name} (current ${best.course.grade}) as A+ would lift CGPA to ${fmt(best.newCgpa)}.`,
        });
      }
    } else {
      cards.push({
        icon: '★', tone: 'ok', title: 'Retake candidates',
        value: 'None',
        hint: 'All your completed grades are already B or better — no retake obviously helps.',
      });
    }

    if (data.cgpa < 3.75 && creditsInPlay > 0) {
      const req = requiredAvg(data.currentPoints, data.completedCr, creditsInPlay, 3.75);
      cards.push({
        icon: '☆', tone: req <= 4.00 ? 'ok' : 'warn', title: "Dean's list (3.75)",
        value: req <= 4.00 ? `${fmt(req)} avg` : 'Not reachable',
        hint: req <= 4.00
          ? `Average ${fmt(req)} or better on remaining credits to graduate on the Dean's list.`
          : 'Would require above a 4.00 average. Focus on target CGPA instead.',
      });
    } else if (data.cgpa >= 3.75) {
      cards.push({
        icon: '☆', tone: 'ok', title: "Dean's list",
        value: 'Qualifying',
        hint: `Your ${fmt(data.cgpa)} CGPA already clears the 3.75 Dean's list threshold.`,
      });
    }

    if (creditsInPlay > 0) {
      const ceiling = projectCgpa(data.currentPoints, data.completedCr, 4.00 * creditsInPlay, creditsInPlay);
      cards.push({
        icon: '⇧', tone: 'ok', title: 'Ceiling (all A+)',
        value: fmt(ceiling),
        hint: `The absolute best CGPA reachable from here is ${fmt(ceiling)}, if every remaining credit is an A+.`,
      });
    }

    clearNode(el.insightsGrid);
    for (const c of cards) el.insightsGrid.appendChild(buildInsightCard(c));
  }

  function renderTrajectory() {
    const Chart = window.Chart;
    if (!Chart) return;
    if (chart) { chart.destroy(); chart = null; }

    const history = data.cgpaTrend.map((p) => ({ label: String(p.label || ''), value: toNum(p.cgpa) }));
    const target = toNum(el.targetCgpa.value);

    const creditsInPlay = Math.max(0, GRADUATION_CREDITS - data.completedCr);
    const semestersLeft = Math.max(1, Math.ceil(creditsInPlay / 15));
    const req = requiredAvg(data.currentPoints, data.completedCr, creditsInPlay, target);
    const projected = [];
    if (Number.isFinite(req) && Number.isFinite(target) && creditsInPlay > 0) {
      let runPts = data.currentPoints;
      let runCr = data.completedCr;
      const perSem = creditsInPlay / semestersLeft;
      for (let i = 1; i <= semestersLeft; i++) {
        runPts += req * perSem;
        runCr += perSem;
        projected.push({ label: `+${i}`, value: runPts / runCr });
      }
    }

    const allLabels = [...history.map((h) => h.label), ...projected.map((p) => p.label)];
    const historyValues = [...history.map((h) => h.value), ...Array(projected.length).fill(null)];
    const projectedValues = [...Array(history.length).fill(null), ...projected.map((p) => p.value)];

    if (history.length && projected.length) {
      projectedValues[history.length - 1] = history[history.length - 1].value;
    }

    const targetLine = Number.isFinite(target) && target > 0
      ? allLabels.map(() => target)
      : null;

    const datasets = [
      {
        label: 'CGPA (actual)',
        data: historyValues,
        borderColor: '#1d4ed8',
        backgroundColor: 'rgba(37, 99, 235, 0.12)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: '#1d4ed8',
      },
      {
        label: 'Projected path to target',
        data: projectedValues,
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.10)',
        borderDash: [6, 4],
        fill: false,
        tension: 0.2,
        pointRadius: 3,
        pointBackgroundColor: '#f59e0b',
        spanGaps: true,
      },
    ];
    if (targetLine) {
      datasets.push({
        label: `Target ${fmt(target)}`,
        data: targetLine,
        borderColor: '#059669',
        borderDash: [2, 4],
        fill: false,
        tension: 0,
        pointRadius: 0,
        borderWidth: 1.5,
      });
    }

    chart = new Chart(el.trajectoryChart, {
      type: 'line',
      data: { labels: allLabels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 10, font: { size: 12 } } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${ctx.raw == null ? '—' : fmt(ctx.raw)}`,
            },
          },
        },
        scales: {
          y: {
            min: Math.max(0, Math.min(2.0, (data.cgpa || 2) - 0.8)),
            max: 4,
            ticks: { stepSize: 0.25 },
          },
        },
      },
    });
  }

  // ------- Wiring -------
  function wireTargetInput() {
    const updateAll = () => {
      renderTarget();
      renderRemaining();
      renderInsights();
      renderTrajectory();
      const v = fmt(toNum(el.targetCgpa.value));
      document.querySelectorAll('.preset-pill').forEach((p) => {
        p.classList.toggle('active', p.dataset.preset === v);
      });
    };
    el.targetCgpa.addEventListener('input', updateAll);
    document.querySelectorAll('.preset-pill').forEach((p) => {
      p.addEventListener('click', () => {
        el.targetCgpa.value = p.dataset.preset;
        updateAll();
      });
    });
    updateAll();
  }

  function wireBulkPicks() {
    document.querySelectorAll('[data-pick-all]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const g = btn.getAttribute('data-pick-all');
        if (g === 'clear') {
          pickedGrades.clear();
        } else {
          for (const c of data.ongoing) pickedGrades.set(c.key, g);
        }
        refreshOngoingSelection();
        renderPickedSummary();
      });
    });
  }

  async function boot() {
    const graph = await loadData();
    data = deriveModel(graph);
    renderAll();
    if (data) {
      wireTargetInput();
      wireBulkPicks();
    }

    const api = storage();
    if (api && api.storage && api.storage.onChanged) {
      api.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || !changes.aiubGraphData) return;
        data = deriveModel(changes.aiubGraphData.newValue);
        renderAll();
        if (data) wireTargetInput();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
