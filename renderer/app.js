(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const IS_DESKTOP = !!window.nexus;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage indisponible */ } }
  };

  const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  const HOUR_START = 6;
  const HOUR_END = 23;
  const ROW_H = 44;
  const COLORS = ['#ff7a00', '#ff9e2c', '#8b5cf6', '#10b981', '#3b82f6', '#ef4444'];
  const CATS = [
    { id: 'all', label: '✦ Tous' },
    { id: 'jeu', label: '🎮 Jeux' },
    { id: 'app', label: '💻 Apps' },
    { id: 'lien', label: '🔗 Liens' }
  ];
  const CAT_LABEL = { jeu: 'Jeu', app: 'Application', lien: 'Lien' };
  const THEMES = [
    { id: 'clair', label: 'Clair · Orange', c: 'linear-gradient(135deg,#ffb340,#ff5f00)' },
    { id: 'graphite', label: 'Graphite', c: 'linear-gradient(135deg,#3a3d45,#101114)' },
    { id: 'neon', label: 'Néon', c: 'linear-gradient(135deg,#22d3ee,#818cf8,#f472b6)' },
    { id: 'glacier', label: 'Glacier', c: 'linear-gradient(135deg,#60a5fa,#1d4ed8)' }
  ];
  const VIBE_URL = 'https://vibe.mistral.ai';

  const BROWSER_DEFAULTS = [
    { name: 'Vibe · Mistral', kind: 'url', cat: 'lien', target: VIBE_URL, icon: '🟠' },
    { name: 'Gmail', kind: 'url', cat: 'lien', target: 'https://mail.google.com', icon: '📧' },
    { name: 'YouTube', kind: 'url', cat: 'lien', target: 'https://www.youtube.com', icon: '▶️' },
    { name: 'GitHub', kind: 'url', cat: 'lien', target: 'https://github.com', icon: '🐙' },
    { name: 'Google Drive', kind: 'url', cat: 'lien', target: 'https://drive.google.com', icon: '☁️' },
    { name: 'Google', kind: 'url', cat: 'lien', target: 'https://www.google.com', icon: '🔍' }
  ];

  let events = store.get('nexus.events', []);
  let reminders = store.get('nexus.reminders', []);
  let apps = store.get('nexus.apps', []);
  let iconCache = store.get('nexus.icons', {});
  let weekStart = mondayOf(new Date());
  let hubFilter = 'all';
  let currentView = 'dashboard';

  /* ---------- Dates ---------- */
  function mondayOf(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x;
  }
  const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const isToday = (d) => dateStr(d) === dateStr(new Date());
  const fmtMin = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  const minToHHMM = (m) => fmtMin(m);
  const hhmmToMin = (s) => { const [h, m] = String(s).split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  const fmtShort = (d) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const fmtDateTime = (ts) => new Date(ts).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  function countdown(ts) {
    const diff = ts - Date.now();
    const abs = Math.abs(diff);
    const j = Math.floor(abs / 86400000), h = Math.floor((abs % 86400000) / 3600000), m = Math.max(1, Math.floor((abs % 3600000) / 60000));
    const txt = j > 0 ? `${j} j ${h} h` : h > 0 ? `${h} h ${m} min` : `${m} min`;
    return diff >= 0 ? `dans ${txt}` : `en retard de ${txt}`;
  }
  const fmtSize = (b) => b < 1024 ? `${b} o` : b < 1048576 ? `${(b / 1024).toFixed(1)} Ko` : `${(b / 1048576).toFixed(1)} Mo`;
  const domainOf = (u) => { try { return new URL(String(u)).hostname.replace(/^www\./, ''); } catch { return null; } };

  /* ---------- Toasts ---------- */
  const toastRoot = $('#toast-root');
  function showToast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    toastRoot.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 4200);
  }

  /* ---------- Sonnerie ---------- */
  let audioCtx = null;
  function beep() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const t0 = audioCtx.currentTime;
      [880, 659.25, 880].forEach((f, i) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        const t = t0 + i * 0.22;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        o.connect(g).connect(audioCtx.destination);
        o.start(t);
        o.stop(t + 0.22);
      });
    } catch { /* audio indisponible */ }
  }

  /* ---------- Modale ---------- */
  const modalRoot = $('#modal-root');
  function openModal(html) {
    modalRoot.innerHTML = `<div class="modal-backdrop"><div class="modal">${html}</div></div>`;
    const bd = $('.modal-backdrop', modalRoot);
    bd.addEventListener('click', (e) => { if (e.target === bd) closeModal(); });
    const first = $('input', bd);
    if (first) first.focus();
  }
  function closeModal() { modalRoot.innerHTML = ''; }

  /* ---------- Listes déroulantes custom ---------- */
  function makeDropdown(options, value, onChange) {
    const root = document.createElement('div');
    root.className = 'dd';
    root.innerHTML = `<button type="button" class="dd-btn"><span class="dd-val"></span><span class="chev">▾</span></button>
      <div class="dd-list">${options.map((o) => `<div class="dd-opt" data-v="${esc(String(o.v))}">${esc(o.l)}</div>`).join('')}</div>`;
    let val = value;
    const paint = () => {
      const cur = options.find((o) => String(o.v) === String(val));
      root.querySelector('.dd-val').textContent = cur ? cur.l : String(val);
      $$('.dd-opt', root).forEach((el) => el.classList.toggle('sel', el.dataset.v === String(val)));
    };
    paint();
    root.querySelector('.dd-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      $$('.dd.open').forEach((d) => { if (d !== root) d.classList.remove('open'); });
      root.classList.toggle('open');
    });
    root.querySelector('.dd-list').addEventListener('click', (e) => {
      const o = e.target.closest('.dd-opt');
      if (!o) return;
      val = o.dataset.v;
      paint();
      root.classList.remove('open');
      if (onChange) onChange(val);
    });
    root.get = () => val;
    return root;
  }
  document.addEventListener('click', () => $$('.dd.open').forEach((d) => d.classList.remove('open')));

  /* ---------- Barre de titre + menu ---------- */
  function setupTitlebar() {
    $('#btn-min').addEventListener('click', () => IS_DESKTOP && window.nexus.winMin());
    $('#btn-max').addEventListener('click', () => IS_DESKTOP && window.nexus.winMax());
    $('#btn-close').addEventListener('click', () => IS_DESKTOP && window.nexus.winClose());
    $('.titlebar-drag').addEventListener('dblclick', () => IS_DESKTOP && window.nexus.winMax());
    if (IS_DESKTOP) {
      window.nexus.onMaximized((v) => { $('#btn-max').textContent = v ? '❐' : '▢'; });
      window.nexus.onAutohide((v) => document.body.classList.toggle('autohide', v));
    } else {
      document.body.classList.add('browser');
    }
  }

  function setMenu(open) {
    const ov = $('#menu-overlay');
    ov.hidden = !open;
    if (open) syncMenuActive();
  }

  function syncMenuActive() {
    $$('#menu-list .menu-item').forEach((b) => b.classList.toggle('active', b.dataset.view === currentView));
  }

  function showView(name) {
    currentView = name;
    $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
    syncMenuActive();
    if (name === 'planning') renderWeek();
    if (name === 'reminders') renderReminders();
    if (name === 'dashboard') renderDashboard();
    if (name === 'hub') { renderHubFilters(); renderHub(); }
    if (name === 'files') renderFiles();
    if (name === 'portfolio') renderPortfolio();
  }

  function setupMenu() {
    $('#btn-menu').addEventListener('click', () => setMenu(true));
    $('#menu-close').addEventListener('click', () => setMenu(false));
    $('#menu-overlay').addEventListener('click', (e) => { if (e.target.id === 'menu-overlay') setMenu(false); });
    $$('#menu-list .menu-item').forEach((b) => b.addEventListener('click', () => { setMenu(false); showView(b.dataset.view); }));
    $('#menu-vibe').addEventListener('click', async () => {
      setMenu(false);
      if (IS_DESKTOP) { const r = await window.nexus.openUrl(VIBE_URL); if (r && r.ok === false) showToast(r.error, 'error'); }
      else window.open(VIBE_URL, '_blank', 'noopener');
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { if (!$('#menu-overlay').hidden) setMenu(false); closeModal(); }
    });
  }

  /* ---------- Thèmes ---------- */
  function renderThemeRow() {
    const cur = document.documentElement.dataset.theme || 'clair';
    $('#theme-row').innerHTML = THEMES.map((t) =>
      `<button class="theme-sw ${t.id === cur ? 'active' : ''}" data-theme="${t.id}" title="${esc(t.label)}" style="background:${t.c}"></button>`).join('');
    $$('#theme-row .theme-sw').forEach((b) => b.addEventListener('click', () => {
      document.documentElement.dataset.theme = b.dataset.theme;
      store.set('nexus.theme', b.dataset.theme);
      renderThemeRow();
    }));
  }

  function setupAutohide() {
    const t = $('#autohide-toggle');
    const on = !!store.get('nexus.autohide', false);
    t.checked = on;
    document.body.classList.toggle('autohide', on);
    t.addEventListener('change', async () => {
      store.set('nexus.autohide', t.checked);
      document.body.classList.toggle('autohide', t.checked);
      if (IS_DESKTOP) await window.nexus.setAutohide(t.checked);
    });
  }

  /* ---------- Reflet verre suivant la souris ---------- */
  function setupGlassGlint() {
    document.addEventListener('mousemove', (e) => {
      const el = e.target.closest && e.target.closest('.glass, .tile, .proj-card, .menu-panel, .modal');
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
      el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
    });
  }

  /* ---------- Horloge ---------- */
  function startClock() {
    const tick = () => {
      const now = new Date();
      $('#clock-time').textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      $('#clock-sub').textContent = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      $('#dash-date').textContent = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const h = now.getHours();
      $('#dash-greeting').textContent = h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- Particules ---------- */
  function initParticles() {
    const canvas = $('#bg');
    const ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;
    let w, h, pts, pcolor = 'rgba(255,138,0,0.3)';
    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      try { pcolor = getComputedStyle(document.documentElement).getPropertyValue('--particle').trim() || pcolor; } catch { /* garde la couleur */ }
      pts = Array.from({ length: Math.min(60, Math.floor(w / 26)) }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.22,
        r: Math.random() * 1.5 + 0.5
      }));
    };
    resize();
    window.addEventListener('resize', resize);
    (function frame() {
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = pcolor;
        ctx.fill();
      }
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const d = Math.hypot(dx, dy);
          if (d < 110) {
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = pcolor.replace(/[\d.]+\)$/, '0.09)');
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(frame);
    })();
  }

  /* ---------- Icônes réelles (favicon / icône .exe) ---------- */
  function faviconSrcs(a) {
    const d = domainOf(a.target);
    if (!d) return [];
    return [
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=128`,
      `https://icons.duckduckgo.com/ip3/${encodeURIComponent(d)}.ico`
    ];
  }
  function paintIcon(holder, a, srcs, cls) {
    holder.textContent = '';
    const img = document.createElement('img');
    img.className = cls;
    img.alt = a.name || '';
    let stage = 0;
    img.addEventListener('error', () => {
      stage++;
      if (stage < srcs.length) img.src = srcs[stage];
      else holder.textContent = a.icon || '🚀';
    });
    img.src = srcs[0];
    holder.appendChild(img);
  }
  async function ensureIcon(a, holder, cls) {
    if (!holder) return;
    if (iconCache[a.id]) { paintIcon(holder, a, iconCache[a.id], cls); return; }
    let srcs = [];
    if (a.kind === 'url' || a.kind === 'link') srcs = faviconSrcs(a);
    else if (IS_DESKTOP) {
      try { const r = await window.nexus.appIcon(a); if (r) srcs = [r]; } catch { /* pas d'icône */ }
    }
    if (srcs.length) {
      iconCache[a.id] = srcs;
      store.set('nexus.icons', iconCache);
      paintIcon(holder, a, srcs, cls);
    } else {
      holder.textContent = a.icon || '🚀';
    }
  }

  /* ---------- Tableau de bord ---------- */
  function renderDashboard() {
    const today = dateStr(new Date());
    const todays = events.filter((e) => e.date === today).sort((a, b) => a.start - b.start);
    $('#dash-events').innerHTML = todays.length
      ? todays.map((e) => `<div class="ev-row" style="--c:${e.color}"><span class="t">${fmtMin(e.start)}–${fmtMin(e.end)}</span><span class="n">${esc(e.title)}</span></div>`).join('')
      : '<div class="empty">Rien aujourd’hui.</div>';
    const upcoming = reminders.filter((r) => !r.done).sort((a, b) => a.at - b.at).slice(0, 5);
    $('#dash-reminders').innerHTML = upcoming.length
      ? upcoming.map((r) => `<div class="rem-row" style="--c:${r.at - Date.now() < 3600000 ? 'var(--o1)' : 'var(--o3)'}"><span class="n">⏰ ${esc(r.title)}</span><span class="t">${fmtDateTime(r.at)}</span></div>`).join('')
      : '<div class="empty">Aucun rappel actif.</div>';
    $('#dash-apps').innerHTML = apps.slice(0, 6).map((a) =>
      `<div class="mini-tile" data-app="${a.id}"><span class="ic" data-ic="${a.id}">${a.icon || '🚀'}</span><span>${esc(a.name)}</span></div>`).join('');
    $$('#dash-apps .mini-tile').forEach((el) => {
      el.addEventListener('click', () => launchApp(apps.find((a) => a.id === el.dataset.app)));
      const a = apps.find((x) => x.id === el.dataset.app);
      const holder = el.querySelector('.ic');
      if (iconCache[a.id]) paintIcon(holder, a, iconCache[a.id], 'mini-img');
      else ensureIcon(a, holder, 'mini-img');
    });
    const active = reminders.filter((r) => !r.done).length;
    $('#dash-stats').innerHTML = `
      <div class="stat"><div class="v">${todays.length}</div><div class="l">Aujourd’hui</div></div>
      <div class="stat"><div class="v">${active}</div><div class="l">Rappels actifs</div></div>
      <div class="stat"><div class="v">${apps.length}</div><div class="l">Apps en hub</div></div>`;
  }

  /* ---------- Emploi du temps ---------- */
  const wgDays = $('#wg-days'), wgTimes = $('#wg-times'), wgBody = $('#wg-body');
  const clampMin = (m) => Math.max(HOUR_START * 60, Math.min(HOUR_END * 60, m));

  function renderWeek() {
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
    wgDays.innerHTML = days.map((d, i) =>
      `<div class="day-head ${isToday(d) ? 'today' : ''}"><span class="dh-name">${DAYS[i]}</span><span class="dh-num">${d.getDate()}</span></div>`).join('');
    wgTimes.innerHTML = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) =>
      `<div class="time-label">${pad(HOUR_START + i)}:00</div>`).join('');
    wgBody.innerHTML = days.map((d, i) =>
      `<div class="day-col ${isToday(d) ? 'today' : ''}" data-idx="${i}">${eventsForDay(d)}${isToday(d) ? nowLine() : ''}</div>`).join('');
    const end = new Date(weekStart); end.setDate(end.getDate() + 6);
    $('#week-label').textContent = `Semaine du ${fmtShort(weekStart)} au ${fmtShort(end)}`;
  }

  function eventsForDay(d) {
    return events.filter((e) => e.date === dateStr(d)).map((e) => {
      const top = (clampMin(e.start) - HOUR_START * 60) / 60 * ROW_H;
      const height = Math.max((clampMin(e.end) - clampMin(e.start)) / 60 * ROW_H, 20);
      return `<div class="event ${e.src === 'ics' ? 'ics' : ''}" data-id="${e.id}" style="top:${top}px;height:${height}px;border-color:${e.color};background:${e.color}1a" title="${esc(e.title)} — ${fmtMin(e.start)} à ${fmtMin(e.end)}">
        <span class="ev-time">${fmtMin(e.start)}–${fmtMin(e.end)}</span><span class="ev-title">${esc(e.title)}</span></div>`;
    }).join('');
  }

  function nowLine() {
    const now = new Date();
    const top = (now.getHours() * 60 + now.getMinutes() - HOUR_START * 60) / 60 * ROW_H;
    if (top < 0 || top > (HOUR_END - HOUR_START) * ROW_H) return '';
    return `<div class="now-line" style="top:${top}px"></div>`;
  }

  function setupPlanning() {
    $('#week-prev').addEventListener('click', () => { weekStart.setDate(weekStart.getDate() - 7); renderWeek(); });
    $('#week-next').addEventListener('click', () => { weekStart.setDate(weekStart.getDate() + 7); renderWeek(); });
    $('#week-today').addEventListener('click', () => { weekStart = mondayOf(new Date()); renderWeek(); });
    $('#event-add').addEventListener('click', () => openEventModal(null));
    $('#ics-import').addEventListener('click', () => $('#ics-input').click());
    $('#ics-input').addEventListener('change', (e) => {
      const files = [...e.target.files];
      e.target.value = '';
      if (files.length) importICSFiles(files);
    });
    wgBody.addEventListener('click', (e) => {
      const evEl = e.target.closest('.event');
      if (evEl) { openEventModal(events.find((ev) => ev.id === evEl.dataset.id)); return; }
      const col = e.target.closest('.day-col');
      if (!col) return;
      const rect = col.getBoundingClientRect();
      let hour = HOUR_START + (e.clientY - rect.top) / ROW_H;
      hour = Math.min(HOUR_END - 1, Math.max(HOUR_START, Math.round(hour * 4) / 4));
      openEventModal(null, Number(col.dataset.idx), Math.floor(hour * 60));
    });
  }

  async function importICSFiles(fileList) {
    let added = 0, skipped = 0;
    for (const f of fileList) {
      let parsed = [];
      try { parsed = window.parseICS(await f.text()); } catch { showToast(`Erreur : ${f.name}`, 'error'); continue; }
      for (const e of parsed) {
        const d = e.start;
        if (!(d instanceof Date) || Number.isNaN(d.getTime())) continue;
        const startM = d.getHours() * 60 + d.getMinutes();
        const endM = e.end instanceof Date && e.end > d ? e.end.getHours() * 60 + e.end.getMinutes() : startM + 60;
        const key = `${e.uid}|${dateStr(d)}|${startM}`;
        if (events.some((x) => x.icsKey === key)) { skipped++; continue; }
        events.push({ id: uid(), icsKey: key, src: 'ics', title: e.title || 'Événement', date: dateStr(d), start: startM, end: Math.max(endM, startM + 15), color: COLORS[1] });
        added++;
      }
    }
    if (added || skipped) { store.set('nexus.events', events); renderWeek(); renderDashboard(); }
    showToast(`📥 ${added} importé(s)${skipped ? ` · ${skipped} doublon(s)` : ''}`, added ? 'ok' : 'warn');
  }

  function openEventModal(existing, dayIdx = null, startMin = null) {
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
    const defDay = dayIdx !== null ? dayIdx : days.findIndex((d) => isToday(d));
    const idx = defDay < 0 ? 0 : defDay;
    const ev = existing || {
      title: '',
      date: dateStr(days[idx]),
      start: startMin !== null ? startMin : 9 * 60,
      end: startMin !== null ? startMin + 60 : 10 * 60,
      color: COLORS[0]
    };
    const dayOpts = days.map((d, i) => ({ v: dateStr(d), l: `${DAY_NAMES[i]} ${fmtShort(d)}` }));
    const swatches = COLORS.map((c) => `<div class="swatch ${c === ev.color ? 'sel' : ''}" data-color="${c}" style="background:${c}"></div>`).join('');
    openModal(`
      <h3>${existing ? 'Modifier l’événement' : 'Nouvel événement'}</h3>
      <div class="form-grid">
        <div class="field full"><label>Titre</label><input id="f-title" type="text" maxlength="60" value="${esc(ev.title)}"></div>
        <div class="field"><label>Jour</label><div id="f-date-dd"></div></div>
        <div class="field"><label>Couleur</label><div class="swatches" id="f-colors">${swatches}</div></div>
        <div class="field"><label>Début</label><input id="f-start" type="time" value="${minToHHMM(ev.start)}"></div>
        <div class="field"><label>Fin</label><input id="f-end" type="time" value="${minToHHMM(ev.end)}"></div>
      </div>
      <div class="modal-actions">
        ${existing && existing.src !== 'ics' ? '<button class="btn danger" id="f-del">Supprimer</button>' : ''}
        <button class="btn ghost" id="f-cancel">Annuler</button>
        <button class="btn primary" id="f-save">Enregistrer</button>
      </div>
    `);
    const ddDate = makeDropdown(dayOpts, ev.date);
    $('#f-date-dd').appendChild(ddDate);
    let color = ev.color;
    $('#f-colors').addEventListener('click', (e) => {
      const s = e.target.closest('.swatch');
      if (!s) return;
      color = s.dataset.color;
      $$('.swatch', $('#f-colors')).forEach((x) => x.classList.toggle('sel', x === s));
    });
    $('#f-cancel').addEventListener('click', closeModal);
    $('#f-save').addEventListener('click', () => {
      const title = $('#f-title').value.trim();
      const start = hhmmToMin($('#f-start').value);
      const end = hhmmToMin($('#f-end').value);
      if (!title) { showToast('Titre requis.', 'warn'); return; }
      if (end <= start) { showToast('Fin après le début.', 'warn'); return; }
      const data = { title, date: ddDate.get(), start, end, color };
      if (existing) Object.assign(existing, data);
      else events.push({ id: uid(), ...data });
      store.set('nexus.events', events);
      closeModal();
      renderWeek();
      renderDashboard();
      showToast(existing ? 'Mis à jour.' : 'Ajouté.', 'ok');
    });
    const del = $('#f-del');
    if (del) del.addEventListener('click', () => {
      events = events.filter((e) => e.id !== existing.id);
      store.set('nexus.events', events);
      closeModal();
      renderWeek();
      renderDashboard();
      showToast('Supprimé.', 'ok');
    });
  }

  /* ---------- Rappels ---------- */
  function saveReminders() { store.set('nexus.reminders', reminders); updateBadge(); }
  function updateBadge() {
    const n = reminders.filter((r) => !r.done).length;
    const b = $('#rem-badge');
    if (b) { b.hidden = n === 0; b.textContent = n; }
  }

  function renderReminders() {
    const now = Date.now();
    const upcoming = reminders.filter((r) => !r.done).sort((a, b) => a.at - b.at);
    const done = reminders.filter((r) => r.done).sort((a, b) => b.at - a.at);
    $('#rem-count').textContent = `${upcoming.length} actif(s) · ${done.length} terminé(s)`;
    const item = (r) => {
      const diff = r.at - now;
      const cls = diff < 0 ? 'overdue' : diff < 3600000 ? 'soon' : '';
      return `<div class="rem-item ${r.done ? 'done' : ''}" data-id="${r.id}">
        <label class="chk"><input type="checkbox" data-act="toggle" ${r.done ? 'checked' : ''}><span class="box"></span></label>
        <div class="rem-main">
          <div class="rem-title">${esc(r.title)}</div>
          <div class="rem-when">${fmtDateTime(r.at)} · <span class="${cls}">${countdown(r.at)}</span></div>
        </div>
        <div class="rem-actions">
          ${r.done ? '' : '<button class="icon-btn" data-act="snooze">↻ 10 min</button>'}
          <button class="icon-btn danger" data-act="del">🗑</button>
        </div>
      </div>`;
    };
    $('#reminder-list').innerHTML = upcoming.length + done.length
      ? upcoming.map(item).join('') + done.map(item).join('')
      : '<div class="empty" style="padding:14px 4px">Aucun rappel.</div>';
  }

  function setupReminders() {
    $('#rem-date').value = dateStr(new Date());
    const now = new Date();
    $('#rem-time').value = `${pad(Math.min(23, now.getHours() + 1))}:00`;
    $('#reminder-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const title = $('#rem-title').value.trim();
      if (!title) { showToast('Titre requis.', 'warn'); return; }
      const at = new Date(`${$('#rem-date').value}T${$('#rem-time').value}:00`).getTime();
      if (!at || Number.isNaN(at)) { showToast('Date invalide.', 'warn'); return; }
      reminders.push({ id: uid(), title, at, sound: $('#rem-sound').checked, done: false, notified: false });
      saveReminders();
      renderReminders();
      renderDashboard();
      $('#rem-title').value = '';
      showToast('Rappel ajouté.', 'ok');
    });
    $('#reminder-list').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      const row = e.target.closest('.rem-item');
      if (!row) return;
      const r = reminders.find((x) => x.id === row.dataset.id);
      if (!r) return;
      if (btn) {
        const act = btn.dataset.act;
        if (act === 'del') { reminders = reminders.filter((x) => x.id !== r.id); saveReminders(); renderReminders(); renderDashboard(); }
        if (act === 'snooze') { r.at = Date.now() + 10 * 60000; r.notified = false; saveReminders(); renderReminders(); showToast('Reporté de 10 min.', 'ok'); }
      }
    });
    $('#reminder-list').addEventListener('change', (e) => {
      if (e.target.dataset.act !== 'toggle') return;
      const row = e.target.closest('.rem-item');
      const r = reminders.find((x) => x.id === row.dataset.id);
      if (!r) return;
      r.done = e.target.checked;
      saveReminders();
      renderReminders();
      renderDashboard();
    });
    setInterval(() => { renderReminders(); renderDashboard(); }, 60000);
    setInterval(checkReminders, 15000);
  }

  function checkReminders() {
    const now = Date.now();
    let changed = false;
    reminders.forEach((r) => {
      if (!r.done && !r.notified && r.at <= now) {
        r.notified = true;
        changed = true;
        fireReminder(r);
      }
    });
    if (changed) saveReminders();
  }

  function fireReminder(r) {
    const when = new Date(r.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    if (IS_DESKTOP) window.nexus.notify(`⏰ ${r.title}`, `Prévu à ${when}`);
    else if ('Notification' in window && Notification.permission === 'granted') new Notification(`⏰ ${r.title}`, { body: `Prévu à ${when}` });
    if (r.sound !== false) beep();
    showToast(`⏰ ${r.title} — ${when}`, 'warn');
  }

  /* ---------- Hub ---------- */
  const catOf = (a) => a.cat || (a.kind === 'app' ? 'app' : 'lien');

  async function launchApp(a) {
    if (!a) return;
    if (a.kind === 'app' && !IS_DESKTOP) { showToast('App installée requise.', 'warn'); return; }
    try {
      let res;
      if (a.kind === 'app') res = await window.nexus.launch(a);
      else if (IS_DESKTOP) res = await window.nexus.openUrl(a.target);
      else { window.open(a.target, '_blank', 'noopener'); return; }
      if (res && res.ok === false) showToast(`${a.name} : ${res.error}`, 'error');
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  }

  function renderHubFilters() {
    $('#hub-filters').innerHTML = CATS.map((c) => `<button class="chip ${hubFilter === c.id ? 'active' : ''}" data-cat="${c.id}">${c.label}</button>`).join('');
  }

  function renderHub() {
    const grid = $('#hub-grid');
    const list = apps.filter((a) => hubFilter === 'all' || catOf(a) === hubFilter);
    grid.innerHTML = list.map((a) => `
      <div class="tile" data-id="${a.id}" tabindex="0" role="button" title="${esc(a.name)}">
        <div class="tile-icon" data-ic="${a.id}">${a.icon || '🚀'}</div>
        <div class="tile-name">${esc(a.name)}</div>
        <div class="tile-kind">${CAT_LABEL[catOf(a)] || 'Lien'}</div>
        <div class="tile-actions">
          <button class="icon-btn" data-act="edit">✏️</button>
          <button class="icon-btn danger" data-act="del">🗑</button>
        </div>
      </div>`).join('') + `
      <div class="tile tile-add" id="tile-add" tabindex="0" role="button">
        <div class="plus">＋</div><div class="tile-name">Ajouter</div>
      </div>`;
    if (!list.length) grid.insertAdjacentHTML('afterbegin', '<div class="empty" style="grid-column:1/-1;padding:10px 4px">Vide.</div>');
    $$('.tile', grid).forEach((tile) => {
      const a = apps.find((x) => x.id === tile.dataset.id);
      if (!a) return;
      const holder = tile.querySelector('.tile-icon');
      if (iconCache[a.id]) paintIcon(holder, a, iconCache[a.id], 'tile-img');
      else ensureIcon(a, holder, 'tile-img');
    });
  }

  function setupHub() {
    $('#hub-filters').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      hubFilter = chip.dataset.cat;
      renderHubFilters();
      renderHub();
    });
    const grid = $('#hub-grid');
    grid.addEventListener('click', (e) => {
      if (e.target.closest('#tile-add')) { openAppModal(null); return; }
      const btn = e.target.closest('.icon-btn');
      const tile = e.target.closest('.tile');
      if (!tile) return;
      const a = apps.find((x) => x.id === tile.dataset.id);
      if (!a) return;
      if (btn) {
        if (btn.dataset.act === 'del') {
          apps = apps.filter((x) => x.id !== a.id);
          delete iconCache[a.id];
          store.set('nexus.apps', apps);
          store.set('nexus.icons', iconCache);
          renderHub(); renderDashboard();
        }
        if (btn.dataset.act === 'edit') openAppModal(a);
        return;
      }
      launchApp(a);
    });
    grid.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const tile = e.target.closest('.tile');
      if (!tile) return;
      e.preventDefault();
      if (tile.id === 'tile-add') openAppModal(null);
      else launchApp(apps.find((x) => x.id === tile.dataset.id));
    });
  }

  function openAppModal(existing) {
    const a = existing || { name: '', kind: 'app', cat: 'app', target: '', icon: '🚀' };
    openModal(`
      <h3>${existing ? 'Modifier' : 'Ajouter au hub'}</h3>
      <div class="form-grid">
        <div class="field"><label>Nom</label><input id="a-name" type="text" maxlength="30" value="${esc(a.name)}"></div>
        <div class="field"><label>Icône de secours (emoji)</label><input id="a-icon" type="text" maxlength="4" value="${esc(a.icon)}"></div>
        <div class="field"><label>Catégorie</label><div id="a-cat-dd"></div></div>
        <div class="field"><label>Lancement</label><div id="a-kind-dd"></div></div>
        <div class="field full"><label id="a-target-label">${a.kind === 'url' || a.kind === 'link' ? 'Adresse' : 'Commande ou chemin (.exe)'}</label>
          <div class="pick-row">
            <input id="a-target" type="text" maxlength="300" placeholder="${a.kind === 'url' ? 'https://…' : a.kind === 'link' ? 'ms-settings:' : 'ex: steam · C:\\…\\jeu.exe'}" value="${esc(a.target)}">
            ${a.kind === 'app' && IS_DESKTOP ? '<button class="btn" id="a-pick" type="button">Parcourir…</button>' : ''}
          </div>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn ghost" id="a-cancel">Annuler</button>
        <button class="btn primary" id="a-save">Enregistrer</button>
      </div>
    `);
    const ddCat = makeDropdown(CATS.filter((c) => c.id !== 'all').map((c) => ({ v: c.id, l: c.label })), catOf(a));
    $('#a-cat-dd').appendChild(ddCat);
    const kindOpts = [
      { v: 'app', l: 'Application du PC' },
      { v: 'url', l: 'Lien web (https)' },
      { v: 'link', l: 'Lien système (ms-settings:…)' }
    ];
    let kind = a.kind;
    const ddKind = makeDropdown(kindOpts, kind, (v) => {
      kind = v;
      $('#a-target-label').textContent = v === 'url' || v === 'link' ? 'Adresse' : 'Commande ou chemin (.exe)';
      $('#a-target').placeholder = v === 'url' ? 'https://…' : v === 'link' ? 'ms-settings:' : 'ex: steam · C:\\…\\jeu.exe';
    });
    $('#a-kind-dd').appendChild(ddKind);
    const pick = $('#a-pick');
    if (pick) pick.addEventListener('click', async () => {
      const p = await window.nexus.pickApp();
      if (p) $('#a-target').value = p;
    });
    $('#a-cancel').addEventListener('click', closeModal);
    $('#a-save').addEventListener('click', () => {
      const name = $('#a-name').value.trim();
      const cat = ddCat.get();
      const target = $('#a-target').value.trim();
      const icon = $('#a-icon').value.trim() || '🚀';
      if (!name) { showToast('Nom requis.', 'warn'); return; }
      if (!target) { showToast('Cible requise.', 'warn'); return; }
      if (kind === 'url' && !/^https:\/\/.+/i.test(target)) { showToast('https:// requis.', 'warn'); return; }
      if (existing) { Object.assign(existing, { name, kind, cat, target, icon }); delete iconCache[existing.id]; }
      else apps.push({ id: uid(), name, kind, cat, target, icon, color: COLORS[apps.length % COLORS.length] });
      store.set('nexus.apps', apps);
      store.set('nexus.icons', iconCache);
      closeModal();
      renderHub();
      renderDashboard();
      showToast('Enregistré.', 'ok');
    });
  }

  /* ---------- Fichiers ---------- */
  const FILE_ICONS = [
    [/\.(png|jpe?g|gif|webp|svg|bmp)$/i, '🖼️'],
    [/\.(mp4|mkv|avi|mov|webm)$/i, '🎬'],
    [/\.(mp3|wav|flac|ogg|m4a)$/i, '🎵'],
    [/\.(zip|rar|7z|tar|gz)$/i, '📦'],
    [/\.(pdf)$/i, '📕'],
    [/\.(docx?|odt|rtf)$/i, '📝'],
    [/\.(xlsx?|csv|ods)$/i, '📊'],
    [/\.(pptx?|odp)$/i, '📽️'],
    [/\.(ics)$/i, '📅'],
    [/\.(exe|msi|bat|cmd|lnk)$/i, '💿'],
    [/\.(js|ts|py|json|html?|css|md|txt|log|xml|yaml|yml|sh|java|c|cpp)$/i, '💻'],
    [/\.(psd|ai|fig|sketch)$/i, '🎨']
  ];
  const fileIcon = (name) => {
    for (const [re, ic] of FILE_ICONS) if (re.test(name)) return ic;
    return '📄';
  };

  async function renderFiles() {
    const list = $('#files-list');
    if (!IS_DESKTOP) {
      $('#files-dir').textContent = '';
      list.innerHTML = '<div class="empty" style="padding:16px 4px">Version installée requise.</div>';
      return;
    }
    $('#files-dir').textContent = await window.nexus.filesDir();
    let files = [];
    try { files = await window.nexus.filesList(); } catch { files = []; }
    list.innerHTML = files.length
      ? files.map((f) => `<div class="file-row" data-name="${esc(f.name)}">
          <div class="file-ic">${f.isDir ? '📁' : fileIcon(f.name)}</div>
          <div class="file-main">
            <div class="file-name">${esc(f.name)}</div>
            <div class="file-meta">${f.isDir ? 'dossier' : fmtSize(f.size)} · ${new Date(f.mtime).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
          </div>
          <div class="rem-actions">
            <button class="icon-btn" data-act="open">▶</button>
            <button class="icon-btn" data-act="reveal">📂</button>
            <button class="icon-btn danger" data-act="del">🗑</button>
          </div>
        </div>`).join('')
      : '<div class="empty" style="padding:16px 4px">Vide.</div>';
  }

  function setupFiles() {
    $('#files-pick').addEventListener('click', async () => {
      if (!IS_DESKTOP) return;
      const copied = await window.nexus.filesPick();
      if (copied && copied.length) { showToast(`📁 ${copied.length} fichier(s)`, 'ok'); renderFiles(); }
    });
    $('#files-open-dir').addEventListener('click', async () => {
      if (!IS_DESKTOP) return;
      const r = await window.nexus.openFilesDir();
      if (r && r.ok === false) showToast(r.error, 'error');
    });
    $('#files-list').addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-act]');
      const row = e.target.closest('.file-row');
      if (!btn || !row || !IS_DESKTOP) return;
      const name = row.dataset.name;
      const act = btn.dataset.act;
      if (act === 'open') { const r = await window.nexus.filesOpen(name); if (r && r.ok === false) showToast(r.error, 'error'); }
      if (act === 'reveal') await window.nexus.filesReveal(name);
      if (act === 'del') { await window.nexus.filesDelete(name); renderFiles(); }
    });
  }

  /* ---------- Glisser-déposer ---------- */
  function setupDrop() {
    let depth = 0;
    document.addEventListener('dragenter', (e) => { e.preventDefault(); depth++; document.body.classList.add('dropping'); });
    document.addEventListener('dragleave', (e) => { e.preventDefault(); if (--depth <= 0) { depth = 0; document.body.classList.remove('dropping'); } });
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', async (e) => {
      e.preventDefault();
      depth = 0;
      document.body.classList.remove('dropping');
      const files = [...(e.dataTransfer && e.dataTransfer.files || [])];
      if (!files.length) return;
      const ics = files.filter((f) => f.name.toLowerCase().endsWith('.ics'));
      const others = files.filter((f) => !f.name.toLowerCase().endsWith('.ics'));
      if (ics.length) await importICSFiles(ics);
      if (others.length) {
        if (IS_DESKTOP) {
          const copied = await window.nexus.dropFiles(others);
          renderFiles();
          showToast(`📁 ${copied.length} fichier(s) dans NEXUS`, 'ok');
        }
      }
    });
  }

  /* ---------- Portfolio ---------- */
  async function renderPortfolio() {
    const grid = $('#perso-grid');
    $('#pro-url').value = store.get('nexus.proUrl', '');
    let data = null;
    try {
      if (IS_DESKTOP) data = JSON.parse(await window.nexus.readAppFile('portfolio.json'));
      else if (typeof fetch === 'function') { const r = await fetch('portfolio.json'); if (r.ok) data = await r.json(); }
    } catch { data = null; }
    const projets = data && data.perso && Array.isArray(data.perso.projets) ? data.perso.projets : [];
    grid.innerHTML = projets.length
      ? projets.map((p) => `<div class="proj-card">
          <div class="proj-head">
            <span class="proj-emoji">${p.emoji || '🚀'}</span>
            <div>
              <div class="proj-title">${esc(p.titre || 'Projet')}</div>
              <div class="proj-date">${esc(p.date || '')}</div>
            </div>
          </div>
          <div class="proj-desc">${esc(p.desc || '')}</div>
          <div class="tech-chips">${(p.tech || []).map((t) => `<span class="tech-chip">${esc(t)}</span>`).join('')}</div>
          ${p.lien ? `<a class="proj-link" href="#" data-lien="${esc(p.lien)}">Voir ↗</a>` : ''}
        </div>`).join('')
      : '<div class="card glass" style="grid-column:1/-1"><div class="empty">Vide pour le moment.</div></div>';
    $$('#perso-grid .proj-link').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      if (IS_DESKTOP) window.nexus.openUrl(a.dataset.lien);
      else window.open(a.dataset.lien, '_blank', 'noopener');
    }));
  }

  function setupPortfolio() {
    $('#pro-save').addEventListener('click', () => {
      const url = $('#pro-url').value.trim();
      if (url && !/^https:\/\/.+/i.test(url)) { showToast('https:// requis.', 'warn'); return; }
      store.set('nexus.proUrl', url);
      showToast('Enregistré.', 'ok');
    });
    $('#pro-open').addEventListener('click', async () => {
      const url = store.get('nexus.proUrl', '') || $('#pro-url').value.trim();
      if (!url) { showToast('URL requise.', 'warn'); return; }
      if (IS_DESKTOP) { const r = await window.nexus.openUrl(url); if (r && r.ok === false) showToast(r.error, 'error'); }
      else window.open(url, '_blank', 'noopener');
    });
  }

  /* ---------- Init ---------- */
  async function init() {
    setupTitlebar();
    setupMenu();
    setupAutohide();
    renderThemeRow();
    startClock();
    initParticles();
    setupGlassGlint();
    setupPlanning();
    setupReminders();
    setupHub();
    setupFiles();
    setupDrop();
    setupPortfolio();
    $('#platform-label').textContent = IS_DESKTOP ? await window.nexus.platform() : 'navigateur';
    if (IS_DESKTOP) await window.nexus.setAutohide(!!store.get('nexus.autohide', false));
    if (!store.get('nexus.seeded', false)) {
      const defs = IS_DESKTOP ? await window.nexus.defaults() : BROWSER_DEFAULTS;
      apps = defs.map((d, i) => ({ ...d, id: uid(), color: COLORS[i % COLORS.length] }));
      store.set('nexus.apps', apps);
      store.set('nexus.seeded', true);
    } else {
      apps = store.get('nexus.apps', []).map((a) => ({ cat: catOf(a), ...a }));
      store.set('nexus.apps', apps);
    }
    events = store.get('nexus.events', []);
    reminders = store.get('nexus.reminders', []);
    showView('dashboard');
    updateBadge();
    checkReminders();
  }

  init();
})();
