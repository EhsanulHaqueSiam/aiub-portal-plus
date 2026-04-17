(function () {
  'use strict';

  const api = (typeof browser !== 'undefined' ? browser : chrome);
  const promisify = (fn, thisArg) => (...args) =>
    new Promise((resolve, reject) => {
      try {
        fn.apply(thisArg, [
          ...args,
          (res) => {
            const err = api.runtime && api.runtime.lastError;
            if (err) reject(new Error(err.message || 'runtime error'));
            else resolve(res);
          },
        ]);
      } catch (e) { reject(e); }
    });
  const storageGet = promisify(api.storage.local.get, api.storage.local);
  const sendMessage = promisify(api.runtime.sendMessage, api.runtime);

  const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
  const ALL_DAYS  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MAX_RESULTS = 30;
  const MAX_SEARCH = 40000;
  const SYNC_TIMEOUT_MS = 30000;

  let courseData = { courses: [], capturedAt: null, partial: true };
  let curriculumData = { courses: [], capturedAt: null };  // from Curriculum page modal scrape
  let gradeData = null;  // from Grade/ByCurriculum: { courseStates, ... }
  const courseBuckets = new Map();
  const selections = new Map();
  let lastResult = null;
  const NIL = new Set(['', 'NIL', 'NILL', 'N/A', 'NA', '-']);

  // ------- Utilities -------
  function norm(s) {
    return String(s || '').replace(/\s+/g, ' ').trim().toUpperCase();
  }
  function parseClockTime(str) {
    if (!str) return null;
    const m = String(str).trim().match(/^(\d{1,2})(?::(\d{1,2}))?\s*(AM|PM)?$/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const mins = m[2] ? parseInt(m[2], 10) : 0;
    const period = (m[3] || '').toUpperCase();
    if (period === 'PM' && h !== 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    if (h < 0 || h > 23 || mins < 0 || mins > 59) return null;
    return h * 60 + mins;
  }
  function fmtClockTime(mins) {
    const h24 = Math.floor(mins / 60);
    const m = mins % 60;
    const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
    const period = h24 >= 12 ? 'PM' : 'AM';
    const mm = String(m).padStart(2, '0');
    return h12 + ':' + mm + ' ' + period;
  }
  function fmtAgo(iso) {
    if (!iso) return 'never';
    const diff = Date.now() - new Date(iso).getTime();
    if (isNaN(diff) || diff < 0) return 'just now';
    const s = Math.floor(diff / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return m + ' min ago';
    const h = Math.floor(m / 60);
    if (h < 24) return h + ' hr ago';
    const d = Math.floor(h / 24);
    return d + ' day' + (d !== 1 ? 's' : '') + ' ago';
  }

  function buildTimeOptions(selectEl, defaultMins, endOfDay) {
    const frag = document.createDocumentFragment();
    const start = endOfDay ? 8 * 60 + 30 : 8 * 60;
    const end = endOfDay ? 23 * 60 : 22 * 60 + 30;
    for (let t = start; t <= end; t += 30) {
      const opt = document.createElement('option');
      opt.value = String(t);
      opt.textContent = fmtClockTime(t);
      if (t === defaultMins) opt.selected = true;
      frag.appendChild(opt);
    }
    selectEl.appendChild(frag);
  }

  // ------- Data -------
  let _registrationStatus = null; // { active, detectedAt, buttonText } from homeIntro.content.ts

  async function loadAllData() {
    try {
      const res = await storageGet({
        aiubOfferedCourses: null,
        aiubCurriculum: null,
        aiubGraphData: null,
        aiubStudent: null,
        aiubRegistrationStatus: null,
      });
      if (res && res.aiubOfferedCourses && Array.isArray(res.aiubOfferedCourses.courses)) {
        courseData = res.aiubOfferedCourses;
      }
      if (res && res.aiubCurriculum && Array.isArray(res.aiubCurriculum.courses)) {
        curriculumData = res.aiubCurriculum;
      }
      if (res && res.aiubGraphData && res.aiubGraphData.curriculum) {
        gradeData = res.aiubGraphData.curriculum;
      }
      if (res && res.aiubGraphData && res.aiubGraphData.semester) {
        _semesterData = res.aiubGraphData.semester;
      }
      if (res && res.aiubStudent) renderStudentIdentity(res.aiubStudent);
      if (res && res.aiubRegistrationStatus) _registrationStatus = res.aiubRegistrationStatus;
    } catch (_) { /* ignore */ }
  }

  function renderRegistrationBanner() {
    const banner = document.getElementById('rg-reg-banner');
    if (!banner) return;
    // Stale detection after 7d — if the user hasn't visited /Student since the
    // last registration window closed, don't keep nagging them.
    const STALE_MS = 7 * 24 * 60 * 60 * 1000;
    const st = _registrationStatus;
    const age = st && st.detectedAt ? Date.now() - new Date(st.detectedAt).getTime() : Infinity;
    const show = !!(st && st.active && age < STALE_MS);
    banner.hidden = !show;
  }

  function renderStudentIdentity(student) {
    if (!student) return;
    const nameEl = document.getElementById('portal-profile-name');
    const idEl = document.getElementById('portal-profile-id');
    const welcomeEl = document.getElementById('portal-welcome-name');
    if (student.name) {
      if (nameEl) nameEl.textContent = student.name;
      if (welcomeEl) welcomeEl.textContent = student.name;
    }
    if (idEl) idEl.textContent = student.studentId || '';
  }

  // ------- Eligibility -------
  // Prereqs in the curriculum are course CODES (e.g. "MAT1102"). Completion
  // data comes from Grade Report → By Semester, which only exposes course
  // NAMES (class IDs are per-section and change each semester). So we resolve
  // prereq code → curriculum name → completed-name check.
  function normCode(v) { return norm(v).replace(/\s+/g, ''); }

  // Course names drift between the Curriculum page and the Grade Report:
  //  "OBJECT ORIENTED PROGRAMMING 1" vs "OBJECT ORIENTED PROGRAMMING 1 (JAVA)"
  //  "BUSINESS COMMUNICATION"        vs "BUSINESS COMMUNICATION [CS/ENGG]"
  //  "MICROPROCESSOR AND EMBEDDED SYSTEM" vs "...SYSTEMS"
  //  "ENGLISH WRITING SKILLS & COMMUNICATION" vs "...COMMUNICATIONS [CS/ENGG]"
  // Strip bracketed/parenthesized suffixes, drop non-alnum, collapse obvious
  // singular/plural so both sides compare on the same key.
  function normName(v) {
    let s = norm(v)
      .replace(/\[[^\]]*\]/g, ' ')   // drop [CS/ENGG] etc
      .replace(/\([^)]*\)/g, ' ')     // drop (JAVA) etc
      .replace(/[^A-Z0-9 ]+/g, ' ')   // drop punctuation (&, ., commas, slashes)
      .replace(/\s+/g, ' ')
      .trim();
    // Fold trailing S on each word so SYSTEM ↔ SYSTEMS, COMMUNICATION ↔ COMMUNICATIONS.
    s = s.split(' ').map((w) => (w.length > 3 && w.endsWith('S') ? w.slice(0, -1) : w)).join(' ');
    return s;
  }

  function namesMatch(a, b) {
    const na = normName(a);
    const nb = normName(b);
    if (!na || !nb) return false;
    if (na === nb) return true;
    // Substring match for cases where one side adds a suffix/prefix annotation.
    // Require a meaningful overlap (≥8 chars) to avoid false positives like
    // "PHYSICS 1" matching "PHYSICS 1 LAB".
    if (na.length >= 8 && nb.includes(na)) return true;
    if (nb.length >= 8 && na.includes(nb)) return true;
    return false;
  }

  let _semesterData = null; // from aiubGraphData.semester

  function completedCodeSet() {
    // ByCurriculum grade report is the gold standard: it uses the same course
    // codes as the Curriculum page, so matching is exact and unambiguous.
    const s = new Set();
    if (gradeData && Array.isArray(gradeData.courseStates)) {
      for (const r of gradeData.courseStates) {
        if ((r.state === 'done' || r.state === 'ong') && r.code) s.add(normCode(r.code));
      }
    }
    return s;
  }

  function completedNameList() {
    // Fallback name-list for when ByCurriculum hasn't been captured yet and we
    // only have BySemester (which has names but no codes).
    const list = [];
    if (_semesterData && Array.isArray(_semesterData.completedNames)) {
      for (const n of _semesterData.completedNames) if (n) list.push(n);
    }
    if (_semesterData && Array.isArray(_semesterData.courseStates)) {
      for (const r of _semesterData.courseStates) {
        if ((r.state === 'done' || r.state === 'ong') && r.name) list.push(r.name);
      }
    }
    if (gradeData && Array.isArray(gradeData.courseStates)) {
      for (const r of gradeData.courseStates) {
        if ((r.state === 'done' || r.state === 'ong') && r.name) list.push(r.name);
      }
    }
    return list;
  }

  function buildCompletedLookup() {
    // Unified lookup: code-exact first (ByCurriculum), fuzzy-name fallback
    // (BySemester names are slightly different from curriculum names).
    const codes = completedCodeSet();
    const names = completedNameList();
    const nameKeys = new Set(names.map(normName));
    return {
      size: codes.size + nameKeys.size,
      hasCode(code) {
        const k = normCode(code);
        return !!k && codes.has(k);
      },
      hasName(rawName) {
        const k = normName(rawName);
        if (!k) return false;
        if (nameKeys.has(k)) return true;
        for (const n of names) if (namesMatch(n, rawName)) return true;
        return false;
      },
      hasCourse(course) {
        if (course && course.code && this.hasCode(course.code)) return true;
        if (course && course.name && this.hasName(course.name)) return true;
        return false;
      },
    };
  }

  function curriculumCodeToName() {
    const m = new Map();
    for (const c of curriculumData.courses || []) {
      if (c.code) m.set(normCode(c.code), c.name || '');
    }
    return m;
  }

  function isReqSatisfied(reqToken, completed, codeToName) {
    const t = String(reqToken || '').trim();
    if (!t || NIL.has(t.toUpperCase())) return true;
    if (/\bCREDITS?\b/i.test(t)) return false;
    const code = normCode(t);
    // Prereqs in curriculum use CODES. If we have code-level completion data
    // (ByCurriculum), that's an exact match. Otherwise map code → curriculum
    // name and fuzzy-match against completed names (BySemester).
    if (completed.hasCode(code)) return true;
    const name = codeToName.get(code);
    if (!name) return true; // unresolved code → treat permissively
    return completed.hasName(name);
  }

  function computeEligibleCourses() {
    if (!curriculumData.courses.length) return { list: [], reason: 'no-curriculum' };
    const completed = buildCompletedLookup();
    if (completed.size === 0) return { list: [], reason: 'no-grades' };

    const codeToName = curriculumCodeToName();
    const out = [];
    for (const c of curriculumData.courses) {
      if (completed.hasCourse(c)) continue;  // already done/ongoing
      const reqs = Array.isArray(c.prerequisites) ? c.prerequisites : [];
      const missing = reqs.filter((r) => !isReqSatisfied(r, completed, codeToName));
      if (missing.length === 0) out.push(c);
    }
    return { list: out, reason: 'ok' };
  }

  function findOfferedForCurriculumCourse(c) {
    // Offered-course titles carry suffixes ((JAVA), [CS/ENGG]) same as the
    // grade report — use the shared fuzzy matcher so curriculum ↔ offered
    // names line up.
    for (const bucket of courseBuckets.values()) {
      if (namesMatch(bucket.title, c.name)) return bucket;
    }
    return null;
  }

  function renderEligible() {
    const host = document.getElementById('rg-eligible');
    const countEl = document.getElementById('rg-eligible-count');
    const chipsEl = document.getElementById('rg-eligible-chips');
    if (!host) return;
    host.hidden = false;
    chipsEl.textContent = '';

    const { list, reason } = computeEligibleCourses();
    if (reason === 'no-curriculum') {
      countEl.textContent = 'needs sync';
      const p = document.createElement('p');
      p.className = 'eligible-empty';
      p.innerHTML = 'Open <strong>My Curriculum</strong> and click both "Show Curriculum Courses" buttons — we read the course list + prerequisites from what you see there.';
      chipsEl.appendChild(p);
      return;
    }
    if (reason === 'no-grades') {
      countEl.textContent = 'needs sync';
      const p = document.createElement('p');
      p.className = 'eligible-empty';
      p.innerHTML = 'Open <strong>Grade Report → By Curriculum</strong> once so we can see which courses you\'ve already finished.';
      chipsEl.appendChild(p);
      return;
    }

    // Only show eligible courses that are actually offered this semester
    const offered = list
      .map((c) => ({ c, bucket: findOfferedForCurriculumCourse(c) }))
      .filter((x) => x.bucket && !selections.has(x.bucket.key));

    countEl.textContent = offered.length + ' available';

    if (offered.length === 0) {
      const p = document.createElement('p');
      p.className = 'eligible-empty';
      p.textContent = list.length
        ? 'You are eligible for ' + list.length + ' course(s), but none are offered this semester (or you\'ve already picked them).'
        : 'No eligible courses — prerequisites not satisfied for remaining curriculum courses.';
      chipsEl.appendChild(p);
      return;
    }

    offered.forEach(({ c, bucket }) => {
      const chip = document.createElement('button');
      chip.className = 'eligible-chip';
      chip.type = 'button';
      chip.title = 'Add ' + c.name + (c.code ? ' (' + c.code + ')' : '');
      const name = document.createElement('span');
      name.textContent = c.name;
      chip.appendChild(name);
      if (c.code) {
        const code = document.createElement('code');
        code.textContent = c.code;
        chip.appendChild(code);
      }
      chip.addEventListener('click', () => {
        addSelection(bucket.key);
        renderEligible();
      });
      chipsEl.appendChild(chip);
    });
  }

  function groupCourses() {
    courseBuckets.clear();
    for (const c of courseData.courses) {
      if (!c || !c.title) continue;
      const key = norm(c.title);
      if (!courseBuckets.has(key)) {
        courseBuckets.set(key, { key, title: c.title, sections: [] });
      }
      courseBuckets.get(key).sections.push(c);
    }
    for (const b of courseBuckets.values()) {
      b.sections.sort((a, b) => (a.section || '').localeCompare(b.section || ''));
    }
  }

  // ------- Data status UI -------
  function renderDataStatus() {
    const count = courseData.courses.length;
    document.getElementById('stat-count').textContent = count ? count.toLocaleString() : '—';
    document.getElementById('stat-when').textContent = fmtAgo(courseData.capturedAt);

    const stateEl = document.getElementById('stat-state');
    stateEl.textContent = '';
    const pill = document.createElement('span');
    pill.className = 'pill';
    if (count === 0) {
      pill.classList.add('pill-muted');
      pill.textContent = 'No data yet';
    } else if (courseData.partial) {
      pill.classList.add('pill-warn');
      pill.textContent = 'Partial — sync for all';
    } else {
      pill.classList.add('pill-ok');
      pill.textContent = 'Ready';
    }
    stateEl.appendChild(pill);
  }

  // ------- Selection picker -------
  function renderSearchResults(query) {
    const sugg = document.getElementById('rg-suggestions');
    const q = norm(query);
    if (!q) { sugg.hidden = true; sugg.textContent = ''; return; }

    const matches = [];
    for (const bucket of courseBuckets.values()) {
      if (selections.has(bucket.key)) continue;
      if (bucket.title.toUpperCase().includes(q)) matches.push(bucket);
      else if (bucket.sections.some((s) => s.classId && s.classId.includes(q))) matches.push(bucket);
      if (matches.length >= 25) break;
    }

    sugg.hidden = false; sugg.textContent = '';
    if (matches.length === 0) {
      const div = document.createElement('div');
      div.className = 'suggestion';
      div.style.color = 'var(--muted)';
      div.style.cursor = 'default';
      div.textContent = 'No matching courses. Try a different name or class id.';
      sugg.appendChild(div);
      return;
    }
    matches.forEach((m, idx) => {
      const div = document.createElement('div');
      div.className = 'suggestion' + (idx === 0 ? ' active' : '');
      div.dataset.key = m.key;

      const title = document.createElement('span');
      title.className = 'suggestion-title';
      title.textContent = m.title;
      const count = document.createElement('span');
      count.className = 'suggestion-count';
      count.textContent = m.sections.length + ' section' + (m.sections.length !== 1 ? 's' : '');
      div.appendChild(title); div.appendChild(count);

      div.addEventListener('click', () => {
        addSelection(m.key);
        document.getElementById('rg-search').value = '';
        sugg.hidden = true;
      });
      sugg.appendChild(div);
    });
  }

  function addSelection(key) {
    const bucket = courseBuckets.get(key);
    if (!bucket || selections.has(key)) return;
    selections.set(key, { key, title: bucket.title, sections: bucket.sections, forcedSection: '' });
    renderSelections();
  }
  function removeSelection(key) { selections.delete(key); renderSelections(); }
  function setForcedSection(key, section) {
    const sel = selections.get(key); if (sel) sel.forcedSection = section;
  }

  function renderSelections() {
    const host = document.getElementById('rg-selected');
    const empty = document.getElementById('rg-selected-empty');
    Array.from(host.querySelectorAll('.chip')).forEach((el) => el.remove());
    empty.hidden = selections.size > 0;

    for (const sel of selections.values()) {
      const chip = document.createElement('div');
      chip.className = 'chip';

      const t = document.createElement('span');
      t.className = 'chip-title';
      t.textContent = sel.title;
      chip.appendChild(t);

      if (sel.sections.length > 1) {
        const selectEl = document.createElement('select');
        selectEl.className = 'chip-select';
        const any = document.createElement('option');
        any.value = ''; any.textContent = 'ANY ▾';
        selectEl.appendChild(any);
        sel.sections.forEach((s) => {
          const o = document.createElement('option');
          o.value = s.section || s.classId;
          o.textContent = (s.section ? '[' + s.section + '] ' : '') + s.classId;
          if (sel.forcedSection === o.value) o.selected = true;
          selectEl.appendChild(o);
        });
        selectEl.addEventListener('change', () => setForcedSection(sel.key, selectEl.value));
        chip.appendChild(selectEl);
      } else if (sel.sections[0] && sel.sections[0].section) {
        const tag = document.createElement('span');
        tag.className = 'chip-section';
        tag.textContent = sel.sections[0].section;
        chip.appendChild(tag);
      }

      const x = document.createElement('button');
      x.className = 'chip-x';
      x.type = 'button';
      x.setAttribute('aria-label', 'Remove ' + sel.title);
      x.textContent = '×';
      x.addEventListener('click', () => removeSelection(sel.key));
      chip.appendChild(x);

      host.appendChild(chip);
    }
  }

  // ------- Generation -------
  function gatherFilters() {
    const earliest = parseInt(document.getElementById('rg-earliest').value, 10);
    const latest = parseInt(document.getElementById('rg-latest').value, 10);
    const maxSeats = parseInt(document.getElementById('rg-seat').value, 10);

    const statuses = new Set();
    document.querySelectorAll('#rg-statuses input:checked')
      .forEach((el) => statuses.add(norm(el.value)));

    const allowedDays = new Set();
    document.querySelectorAll('#rg-days input:checked')
      .forEach((el) => allowedDays.add(el.value));

    const sortBy = (document.querySelector('input[name="rg-sort"]:checked') || { value: 'none' }).value;
    return { earliest, latest, maxSeats, statuses, allowedDays, sortBy };
  }

  function sectionPassesStatic(section, filters) {
    if (filters.statuses.size > 0) {
      const s = norm(section.status || '');
      const match = Array.from(filters.statuses).some((allowed) => s.includes(allowed));
      if (!match) return false;
    }
    if (filters.maxSeats >= 0 && filters.maxSeats < 100) {
      if (section.capacity && section.capacity > filters.maxSeats) return false;
    }
    for (const slot of section.timeSlots || []) {
      if (!slot.day) continue;
      if (!filters.allowedDays.has(slot.day)) return false;
      const sm = parseClockTime(slot.startTime);
      const em = parseClockTime(slot.endTime);
      if (sm == null || em == null) continue;
      if (sm < filters.earliest) return false;
      if (em > filters.latest) return false;
    }
    return true;
  }

  function precomputeSlots(section) {
    section._parsedSlots = (section.timeSlots || []).map((slot) => {
      const s = parseClockTime(slot.startTime);
      const e = parseClockTime(slot.endTime);
      if (s == null || e == null || !slot.day) return null;
      return {
        day: slot.day,
        classType: slot.classType,
        room: slot.room,
        start: slot.startTime,
        end: slot.endTime,
        _start: s, _end: e,
      };
    }).filter(Boolean);
  }

  function buildCandidateSections(selection, filters) {
    let c = selection.sections;
    if (selection.forcedSection) c = c.filter((s) => (s.section || s.classId) === selection.forcedSection);
    return c.filter((s) => sectionPassesStatic(s, filters));
  }

  function sectionsClash(a, b) {
    for (const x of a._parsedSlots) for (const y of b._parsedSlots) {
      if (x.day === y.day && x._start < y._end && y._start < x._end) return true;
    }
    return false;
  }

  function generateRoutines(filters) {
    const courseCandidates = [];
    const missing = [];
    for (const sel of selections.values()) {
      const cands = buildCandidateSections(sel, filters);
      cands.forEach(precomputeSlots);
      if (cands.length === 0) missing.push(sel.title);
      courseCandidates.push({ title: sel.title, candidates: cands });
    }
    if (missing.length) return { routines: [], missing };

    const routines = [];
    let explored = 0;
    (function backtrack(idx, picked) {
      if (routines.length >= MAX_RESULTS || explored > MAX_SEARCH) return;
      if (idx === courseCandidates.length) { routines.push(picked.slice()); return; }
      for (const sec of courseCandidates[idx].candidates) {
        explored++;
        if (explored > MAX_SEARCH) return;
        let clash = false;
        for (const prev of picked) if (sectionsClash(prev, sec)) { clash = true; break; }
        if (clash) continue;
        picked.push(sec);
        backtrack(idx + 1, picked);
        picked.pop();
        if (routines.length >= MAX_RESULTS) return;
      }
    })(0, []);

    const ranked = routines.map((r) => ({
      sections: r,
      offDays: countOffDays(r),
      totalGap: totalGapMinutes(r),
      earliestStart: earliestStart(r),
    }));

    if (filters.sortBy === 'minimize') {
      ranked.sort((a, b) => a.totalGap - b.totalGap || b.offDays - a.offDays);
    } else {
      ranked.sort((a, b) => b.offDays - a.offDays || a.totalGap - b.totalGap);
    }
    return { routines: ranked, missing: [], exploredCap: explored > MAX_SEARCH };
  }

  function countOffDays(sections) {
    const used = new Set();
    for (const sec of sections) for (const slot of sec._parsedSlots) used.add(slot.day);
    let off = 0; for (const d of WEEK_DAYS) if (!used.has(d)) off++; return off;
  }
  function totalGapMinutes(sections) {
    const byDay = {};
    for (const sec of sections) for (const slot of sec._parsedSlots)
      (byDay[slot.day] = byDay[slot.day] || []).push(slot);
    let total = 0;
    for (const d of Object.keys(byDay)) {
      const slots = byDay[d].slice().sort((a, b) => a._start - b._start);
      for (let i = 1; i < slots.length; i++) {
        const gap = slots[i]._start - slots[i - 1]._end;
        if (gap > 0) total += gap;
      }
    }
    return total;
  }
  function earliestStart(sections) {
    let e = Infinity;
    for (const sec of sections) for (const slot of sec._parsedSlots) if (slot._start < e) e = slot._start;
    return e === Infinity ? 0 : e;
  }

  // ------- Rendering -------
  function renderResults(result) {
    lastResult = result;
    const section = document.getElementById('rg-results-section');
    const hint = document.getElementById('rg-results-hint');
    const host = document.getElementById('rg-results');
    const countEl = document.getElementById('rg-result-count');
    host.textContent = '';

    if (result.missing && result.missing.length) {
      section.hidden = false;
      countEl.textContent = '0 routines';
      hint.textContent = 'Couldn\'t include: ' + result.missing.join(', ');
      const div = document.createElement('div');
      div.className = 'empty is-error';
      div.textContent =
        'No section of ' + result.missing.join(', ') +
        ' matches your filters. Loosen status, days, or time and try again.';
      host.appendChild(div);
      return;
    }
    if (!result.routines.length) {
      section.hidden = false;
      countEl.textContent = '0 routines';
      hint.textContent = '';
      const div = document.createElement('div');
      div.className = 'empty';
      div.textContent = 'No clash-free routine found with the current filters.';
      host.appendChild(div);
      return;
    }

    section.hidden = false;
    const shown = Math.min(result.routines.length, MAX_RESULTS);
    countEl.textContent = shown + ' routine' + (shown !== 1 ? 's' : '');
    hint.textContent = result.exploredCap
      ? 'Search capped — narrow filters for a full scan.'
      : 'Ranked by your sort preference.';

    result.routines.slice(0, MAX_RESULTS).forEach((routine, idx) => {
      host.appendChild(buildRoutineCard(routine, idx));
    });
  }

  function buildCoursePill(sec) {
    const pill = document.createElement('span');
    pill.className = 'routine-course';

    const strong = document.createElement('strong');
    strong.textContent = sec.title;
    pill.appendChild(strong);

    const parts = [];
    if (sec.section) parts.push('[' + sec.section + ']');
    parts.push('#' + sec.classId);
    if (sec.status) parts.push(sec.status.toLowerCase());
    if (parts.length) pill.appendChild(document.createTextNode(' · ' + parts.join(' · ')));
    return pill;
  }

  function buildRoutineCard(routine, idx) {
    const card = document.createElement('div');
    card.className = 'routine';

    const head = document.createElement('div');
    head.className = 'routine-head';

    const idxEl = document.createElement('span');
    idxEl.className = 'routine-idx';
    idxEl.textContent = String(idx + 1).padStart(2, '0');
    head.appendChild(idxEl);

    const name = document.createElement('span');
    name.className = 'routine-name';
    const em = document.createElement('em');
    em.textContent = 'Routine ';
    name.appendChild(em);
    name.appendChild(document.createTextNode(String(idx + 1).padStart(2, '0')));
    head.appendChild(name);

    const tags = document.createElement('div');
    tags.className = 'routine-tags';

    const daysTag = document.createElement('span');
    daysTag.className = 'routine-tag days';
    daysTag.textContent = routine.offDays + ' off-day' + (routine.offDays !== 1 ? 's' : '');
    tags.appendChild(daysTag);

    const hrs = Math.floor(routine.totalGap / 60);
    const mins = routine.totalGap % 60;
    const gapTag = document.createElement('span');
    gapTag.className = 'routine-tag gap';
    gapTag.textContent = (hrs ? hrs + 'h ' : '') + mins + 'm gaps';
    tags.appendChild(gapTag);
    head.appendChild(tags);

    card.appendChild(head);

    const gridWrap = document.createElement('div');
    gridWrap.className = 'grid-wrap';
    gridWrap.appendChild(buildWeeklyGrid(routine.sections));
    card.appendChild(gridWrap);

    const courses = document.createElement('div');
    courses.className = 'routine-courses';
    routine.sections.forEach((sec) => courses.appendChild(buildCoursePill(sec)));
    card.appendChild(courses);

    return card;
  }

  function buildWeeklyGrid(sections) {
    let minStart = 8 * 60, maxEnd = 18 * 60;
    for (const sec of sections) for (const slot of sec._parsedSlots) {
      if (slot._start < minStart) minStart = Math.floor(slot._start / 60) * 60;
      if (slot._end > maxEnd) maxEnd = Math.ceil(slot._end / 60) * 60;
    }
    const startHour = Math.floor(minStart / 60);
    const endHour = Math.ceil(maxEnd / 60);

    const grid = document.createElement('div');
    grid.className = 'grid';

    const headCell = document.createElement('div');
    headCell.className = 'grid-cell grid-head';
    headCell.textContent = 'Time';
    grid.appendChild(headCell);
    WEEK_DAYS.forEach((d) => {
      const h = document.createElement('div');
      h.className = 'grid-cell grid-head';
      h.textContent = d.slice(0, 3);
      grid.appendChild(h);
    });

    const slotsByDay = {};
    WEEK_DAYS.forEach((d) => (slotsByDay[d] = []));
    sections.forEach((sec) => {
      sec._parsedSlots.forEach((slot) => {
        if (!slotsByDay[slot.day]) return;
        slotsByDay[slot.day].push(Object.assign({}, slot, { _title: sec.title, _section: sec.section, _classId: sec.classId }));
      });
    });
    Object.keys(slotsByDay).forEach((d) => slotsByDay[d].sort((a, b) => a._start - b._start));

    for (let hour = startHour; hour < endHour; hour++) {
      const timeCell = document.createElement('div');
      timeCell.className = 'grid-cell grid-time';
      timeCell.textContent = fmtClockTime(hour * 60);
      grid.appendChild(timeCell);

      WEEK_DAYS.forEach((day) => {
        const cell = document.createElement('div');
        cell.className = 'grid-cell grid-slot';
        const hourStart = hour * 60, hourEnd = hourStart + 60;
        slotsByDay[day]
          .filter((s) => s._start >= hourStart && s._start < hourEnd)
          .forEach((s) => {
            const slotCard = document.createElement('div');
            slotCard.className = 'slot-card';

            const title = document.createElement('div');
            title.className = 'slot-title';
            const titleText = document.createElement('em');
            titleText.textContent = s._title;
            title.appendChild(titleText);
            if (s._section) title.appendChild(document.createTextNode(' [' + s._section + ']'));
            slotCard.appendChild(title);

            const meta = document.createElement('div');
            meta.className = 'slot-meta';
            const parts = [s.start + '–' + s.end];
            if (s.classType) parts.push(s.classType.toLowerCase());
            if (s.room) parts.push(s.room);
            parts.push('#' + s._classId);
            meta.textContent = parts.join(' · ');
            slotCard.appendChild(meta);

            cell.appendChild(slotCard);
          });
        grid.appendChild(cell);
      });
    }
    return grid;
  }

  // ------- Sync -------
  // Sync runs three steps, each inside your own authenticated portal
  // session. Each tab is opened inactive, waited on via storage.onChanged,
  // then closed. No credentials are transmitted to or stored by this
  // extension — the pages just load as they would if you visited them.
  async function runOneSyncStep(target, watchKey, predicate, timeoutMs) {
    const openRes = await sendMessage({ type: 'OPEN_SYNC_TAB', target });
    if (!openRes || !openRes.ok) throw new Error(openRes?.reason || 'could not open sync tab.');
    const tabId = openRes.tabId;

    let done = null;
    try {
      done = await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          api.storage.onChanged.removeListener(onChange);
          resolve({ ok: false, reason: 'timed out — make sure you are logged in to the portal.' });
        }, timeoutMs);

        const onChange = (changes, area) => {
          if (area !== 'local') return;
          for (const k of watchKey) {
            if (!changes[k]) continue;
            const next = changes[k].newValue;
            if (predicate(next, k)) {
              clearTimeout(timeout);
              api.storage.onChanged.removeListener(onChange);
              resolve({ ok: true });
              return;
            }
          }
        };
        api.storage.onChanged.addListener(onChange);
      });
    } finally {
      if (tabId != null) {
        try { await sendMessage({ type: 'CLOSE_TAB', tabId }); } catch (_) { /* ignore */ }
      }
    }
    if (!done.ok) throw new Error(done.reason || 'sync step failed.');
  }

  async function triggerSync(opts) {
    const forceCurriculum = !!(opts && opts.forceCurriculum);
    const offeredOnly = !!(opts && opts.offeredOnly);
    const btn = document.getElementById('rg-sync');
    const hint = document.getElementById('rg-sync-hint');
    const label = btn.querySelector('.btn-label');
    const prev = label.textContent;
    btn.dataset.busy = '1';
    btn.disabled = true;

    const totalSteps = offeredOnly ? 1 : 4;
    const setStep = (n, total, msg) => {
      label.textContent = 'Syncing ' + n + '/' + total + '…';
      hint.textContent = msg;
    };
    const resetBtn = () => {
      btn.dataset.busy = '';
      btn.disabled = false;
      label.textContent = prev;
    };

    try {
      // STEP 1: Offered courses (the catalog).
      // The portal's Offered page renders only ~10 rows in the DOM (footable
      // pagination). Our MAIN-world filter script expands pagination and posts
      // the full list with partial:false. We must wait for partial:false —
      // accepting the first partial:true write captures just page one, which
      // is why "none are offered this semester" shows up for real courses.
      setStep(1, totalSteps, 'Reading this semester\'s offered courses…');
      await runOneSyncStep(
        'offered',
        ['aiubOfferedCourses'],
        (next) => {
          if (!next || !Array.isArray(next.courses) || next.courses.length === 0) return false;
          return next.partial === false;
        },
        60000,
      );

      if (offeredOnly) {
        label.textContent = 'Offered re-synced';
        hint.textContent = 'Seat counts + statuses refreshed. Generate when ready.';
        return;
      }

      // STEP 2: My Curriculum (course list + prerequisites). Curriculum rarely
      // changes, so skip the re-scrape when we already have a reasonably
      // recent snapshot. The #refresh-curriculum button bypasses this cache.
      const CURRICULUM_TTL_MS = 365 * 24 * 60 * 60 * 1000; // ~1 year
      const curCached = curriculumData && Array.isArray(curriculumData.courses)
        && curriculumData.courses.length > 0;
      const curAge = curCached && curriculumData.capturedAt
        ? Date.now() - new Date(curriculumData.capturedAt).getTime()
        : Infinity;
      const curFresh = curCached && curAge < CURRICULUM_TTL_MS && !forceCurriculum;

      if (curFresh) {
        setStep(2, totalSteps, 'Curriculum cached — skipping (use "Refresh curriculum" to force).');
      } else {
        setStep(2, totalSteps, 'Capturing your curriculum + prerequisites…');
        await runOneSyncStep(
          'curriculum',
          ['aiubCurriculumSyncDone', 'aiubCurriculum'],
          (next, k) => {
            if (k === 'aiubCurriculumSyncDone') return !!next;
            return next && Array.isArray(next.courses) && next.courses.length >= 5;
          },
          30000,
        );
      }

      // STEP 3: Grade Report → By Curriculum (completed courses, code-exact).
      // This is the authoritative source for eligibility since it uses the
      // same course codes as the Curriculum page.
      setStep(3, totalSteps, 'Reading your completed courses (by curriculum)…');
      await runOneSyncStep(
        'gradeByCurriculum',
        ['aiubGraphData'],
        (next) => {
          return !!(next && next.curriculum && Array.isArray(next.curriculum.courseStates)
            && next.curriculum.courseStates.length > 0);
        },
        20000,
      );

      // STEP 4: Grade Report → By Semester (supplementary — fills in names and
      // SGPA trend for graphs even when codes alone would be enough).
      setStep(4, totalSteps, 'Reading your completed courses (by semester)…');
      await runOneSyncStep(
        'gradeBySemester',
        ['aiubGraphData'],
        (next) => {
          return !!(next && next.semester && Array.isArray(next.semester.completedNames));
        },
        20000,
      );

      label.textContent = 'Sync complete';
      hint.textContent = 'All datasets captured. Eligible courses are ready below.';
    } catch (err) {
      hint.textContent = 'Sync failed: ' + (err && err.message ? err.message : String(err));
    } finally {
      setTimeout(() => {
        resetBtn();
        hint.textContent =
          'Sync opens Offered Courses, My Curriculum, and Grade Report in background tabs — ' +
          'all inside your own authenticated session. No credentials handled.';
      }, 3500);
    }
  }

  // ------- Wiring -------
  function initWiring() {
    buildTimeOptions(document.getElementById('rg-earliest'), 8 * 60, false);
    buildTimeOptions(document.getElementById('rg-latest'), 23 * 60, true);

    const seatEl = document.getElementById('rg-seat');
    const seatOut = document.getElementById('rg-seat-val');
    seatEl.addEventListener('input', () => { seatOut.textContent = seatEl.value; });

    const searchEl = document.getElementById('rg-search');
    const suggEl = document.getElementById('rg-suggestions');
    let tmo = null;
    searchEl.addEventListener('input', () => {
      clearTimeout(tmo);
      tmo = setTimeout(() => renderSearchResults(searchEl.value), 100);
    });
    searchEl.addEventListener('focus', () => {
      if (searchEl.value.trim()) renderSearchResults(searchEl.value);
    });
    document.addEventListener('click', (e) => {
      if (e.target !== searchEl && !suggEl.contains(e.target)) suggEl.hidden = true;
    });
    searchEl.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const active = suggEl.querySelector('.suggestion.active');
      if (active && active.dataset.key) {
        addSelection(active.dataset.key);
        searchEl.value = ''; suggEl.hidden = true;
      }
    });

    document.getElementById('rg-generate').addEventListener('click', () => {
      if (selections.size === 0) {
        flashHint('Pick at least one course first.');
        return;
      }
      if (courseData.courses.length === 0) {
        flashHint('No offered-course data yet. Click "Sync now" first.');
        return;
      }
      const filters = gatherFilters();
      const result = generateRoutines(filters);
      renderResults(result);
      document.getElementById('rg-results-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    document.getElementById('rg-clear').addEventListener('click', () => {
      selections.clear(); renderSelections();
      document.getElementById('rg-results-section').hidden = true;
      document.getElementById('rg-result-count').textContent = '';
    });

    document.getElementById('rg-disclosure-dismiss').addEventListener('click', () => {
      document.getElementById('rg-disclosure').classList.add('is-hidden');
    });

    document.getElementById('rg-sync').addEventListener('click', () => triggerSync());
    const refreshCurriculumBtn = document.getElementById('rg-refresh-curriculum');
    if (refreshCurriculumBtn) {
      refreshCurriculumBtn.addEventListener('click', () => triggerSync({ forceCurriculum: true }));
    }
    // Inline "re-sync offered" on the registration-active banner — skips
    // curriculum and grade steps, so refreshes are cheap during registration.
    const regSyncBtn = document.getElementById('rg-reg-banner-sync');
    if (regSyncBtn) {
      regSyncBtn.addEventListener('click', () => triggerSync({ offeredOnly: true }));
    }

    // Live updates when any of our three cached datasets changes.
    if (api.storage && api.storage.onChanged) {
      api.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        let dirty = false;
        if (changes.aiubOfferedCourses) {
          const next = changes.aiubOfferedCourses.newValue;
          if (next && Array.isArray(next.courses)) {
            courseData = next;
            groupCourses();
            renderDataStatus();
            if (!suggEl.hidden) renderSearchResults(searchEl.value);
            dirty = true;
          }
        }
        if (changes.aiubCurriculum) {
          const next = changes.aiubCurriculum.newValue;
          if (next && Array.isArray(next.courses)) {
            curriculumData = next;
            dirty = true;
          }
        }
        if (changes.aiubGraphData) {
          const next = changes.aiubGraphData.newValue;
          if (next) {
            if (next.curriculum) { gradeData = next.curriculum; dirty = true; }
            if (next.semester) { _semesterData = next.semester; dirty = true; }
          }
        }
        if (changes.aiubStudent) {
          renderStudentIdentity(changes.aiubStudent.newValue);
        }
        if (changes.aiubRegistrationStatus) {
          _registrationStatus = changes.aiubRegistrationStatus.newValue;
          renderRegistrationBanner();
        }
        if (dirty) renderEligible();
      });
    }
  }

  function flashHint(msg) {
    const el = document.getElementById('rg-result-count');
    el.textContent = msg;
    setTimeout(() => { el.textContent = ''; }, 2500);
  }

  async function boot() {
    initWiring();
    await loadAllData();
    groupCourses();
    renderDataStatus();
    renderEligible();
    renderRegistrationBanner();
    // Reveal the page only after everything is wired, eliminating any
    // flash of unstyled or half-wired content.
    document.body.classList.add('rg-ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
