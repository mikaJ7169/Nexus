/* Parseur .ics minimaliste (VEVENT, DTSTART/DTEND/DURATION, RRULE FREQ=DAILY/WEEKLY/MONTHLY/YEARLY, COUNT, UNTIL, BYDAY).
   Exposé sur window.parseICS (et globalThis sous Node pour les tests). */
(function (root) {
  'use strict';

  function unfold(text) {
    return String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  }

  function parseProp(line) {
    const i = line.indexOf(':');
    if (i < 0) return null;
    const left = line.slice(0, i);
    const value = line.slice(i + 1);
    const parts = left.split(';');
    const params = {};
    for (let k = 1; k < parts.length; k++) {
      const eq = parts[k].indexOf('=');
      if (eq > 0) params[parts[k].slice(0, eq).toUpperCase()] = parts[k].slice(eq + 1);
    }
    return { name: parts[0].toUpperCase(), params, value };
  }

  function parseDate(value) {
    const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(String(value).trim());
    if (!m) return null;
    const y = +m[1], mo = +m[2] - 1, d = +m[3];
    const H = m[4] ? +m[4] : 0, M = m[5] ? +m[5] : 0, S = m[6] ? +m[6] : 0;
    if (m[7] === 'Z') return new Date(Date.UTC(y, mo, d, H, M, S));
    return new Date(y, mo, d, H, M, S);
  }

  function parseDuration(value) {
    const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(String(value).trim().toUpperCase());
    if (!m) return 3600000;
    const sign = m[1] === '-' ? -1 : 1;
    const weeks = +(m[2] || 0), days = +(m[3] || 0), h = +(m[4] || 0), mi = +(m[5] || 0), s = +(m[6] || 0);
    return sign * (((weeks * 7 + days) * 24 + h) * 3600 + mi * 60 + s) * 1000;
  }

  function parseRRULE(value) {
    const rr = {};
    for (const part of String(value).split(';')) {
      const eq = part.indexOf('=');
      if (eq > 0) rr[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
    }
    return rr;
  }

  const BYDAY_MAP = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function addMonths(d, n) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
  function addYears(d, n) { const x = new Date(d); x.setFullYear(x.getFullYear() + n); return x; }

  function startOfWeekMonday(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x;
  }

  function expand(start, durMs, rr, horizonMs) {
    const out = [];
    const freq = (rr.FREQ || '').toUpperCase();
    const interval = Math.max(1, parseInt(rr.INTERVAL || '1', 10) || 1);
    const count = rr.COUNT ? parseInt(rr.COUNT, 10) : Infinity;
    const until = rr.UNTIL ? parseDate(rr.UNTIL) : null;
    const limit = Math.min(horizonMs, until ? until.getTime() : Infinity);
    const cap = 500;

    function push(d) {
      if (d.getTime() > limit || out.length >= cap || out.length >= count) return false;
      out.push({ start: new Date(d), end: new Date(d.getTime() + durMs) });
      return true;
    }

    if (freq === 'WEEKLY' && rr.BYDAY) {
      const days = String(rr.BYDAY).split(',').map((s) => BYDAY_MAP[s.trim().toUpperCase()]).filter((n) => n !== undefined).sort((a, b) => a - b);
      let week = startOfWeekMonday(start);
      while (week.getTime() <= limit && out.length < cap && out.length < count) {
        for (const dow of days) {
          const occ = new Date(week);
          occ.setDate(occ.getDate() + ((dow + 6) % 7));
          occ.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), 0);
          if (occ.getTime() < start.getTime()) continue;
          if (!push(occ)) break;
        }
        week = addDays(week, 7 * interval);
      }
      return out;
    }

    let cur = new Date(start);
    while (cur.getTime() <= limit && out.length < cap && out.length < count) {
      out.push({ start: new Date(cur), end: new Date(cur.getTime() + durMs) });
      if (freq === 'DAILY') cur = addDays(cur, interval);
      else if (freq === 'WEEKLY') cur = addDays(cur, 7 * interval);
      else if (freq === 'MONTHLY') cur = addMonths(cur, interval);
      else if (freq === 'YEARLY') cur = addYears(cur, interval);
      else break;
    }
    return out;
  }

  function parseICS(text) {
    const lines = unfold(text);
    const rawEvents = [];
    let cur = null;
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const up = line.toUpperCase();
      if (up === 'BEGIN:VEVENT') { cur = {}; continue; }
      if (up === 'END:VEVENT') { if (cur) rawEvents.push(cur); cur = null; continue; }
      if (!cur) continue;
      const p = parseProp(line);
      if (p) cur[p.name] = p;
    }

    const horizonMs = Date.now() + 366 * 86400000;
    const out = [];
    for (const ev of rawEvents) {
      if (!ev.DTSTART) continue;
      const start = parseDate(ev.DTSTART.value);
      if (!start) continue;
      const end = ev.DTEND ? parseDate(ev.DTEND.value) : null;
      const durMs = end && end > start ? end - start : parseDuration(ev.DURATION ? ev.DURATION.value : 'PT1H');
      const title = ev.SUMMARY ? ev.SUMMARY.value : 'Événement';
      const uid = ev.UID ? ev.UID.value : title + '@' + start.getTime();
      const rrule = ev.RRULE ? parseRRULE(ev.RRULE.value) : null;
      const occs = rrule ? expand(start, durMs, rrule, horizonMs) : [{ start, end: new Date(start.getTime() + durMs) }];
      for (const o of occs) out.push({ title, uid, start: o.start, end: o.end });
    }
    return out;
  }

  root.parseICS = parseICS;
  root.ICS = { parseDate, parseDuration, parseRRULE, expand };
})(typeof window !== 'undefined' ? window : globalThis);
