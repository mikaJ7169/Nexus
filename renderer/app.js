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
  const COLORS = ['#22d3ee', '#a78bfa', '#f472b6', '#34d399', '#fbbf24', '#fb7185'];

  const BROWSER_DEFAULTS = [
    { name: 'Gmail', kind: 'url', target: 'https://mail.google.com', icon: '📧' },
    { name: 'YouTube', kind: 'url', target: 'https://www.youtube.com', icon: '▶️' },
    { name: 'GitHub', kind: 'url', target: 'https://github.com', icon: '🐙' },
    { name: 'Google Drive', kind: 'url', target: 'https://drive.google.com', icon: '☁️' },
    { name: 'Google', kind: 'url', target: 'https://www.google.com', icon: '🔍' },
    { name: 'Météo', kind: 'url', target: 'https://www.meteofrance.com', icon: '🌦️' }
  ];

  let events = store.get('nexus.events', []);
  let reminders = store.get('nexus.reminders', []);
  let apps = store.get('nexus.apps', []);
  let weekStart = mondayOf(new Date());

  /* ---------- Utilitaires de date ---------- */
  function mondayOf(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x;
  }
  const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const isToday = (d) => dateStr(d) === dateStr(new Date());
  const fmtMin = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  const minToHHMM = (m) => fmtMin(m);
  const hhmmToMin = (s) => {
    const [h, m] = String(s).split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const fmtShort = (d) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const fmtDateTime = (ts) => new Date(ts).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  function countdown(ts) {
    const diff = ts - Date.now();
    const abs = Math.abs(diff);
    const j = Math.floor(abs / 86400000), h = Math.floor((abs % 86400000) / 3600000), m = Math.max(1, Math.floor((abs % 3600000) / 60000));
    const txt = j > 0 ? `${j} j ${h} h` : h > 0 ? `${h} h ${m} min` : `${m} min`;
    return diff >= 0 ? `dans ${txt}` : `en retard de ${txt}`;
  }

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
    modalRoot.innerHTML = `<div class="modal-backdrop"><div class="modal card">${html}</div></div>`;
    const bd = $('.modal-backdrop', modalRoot);
    bd.addEventListener('click', (e) => { if (e.target === bd) closeModal(); });
    const first = $('input, select', bd);
    if (first) first.focus();
  }
  function closeModal() { modalRoot.innerHTML = ''; }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  /* ---------- Barre de titre ---------- */
  function setupTitlebar() {
    $('#btn-min').addEventListener('click', () => IS_DESKTOP && window.nexus.winMin());
    $('#btn-max').addEventListener('click', () => IS_DESKTOP && window.nexus.winMax());
    $('#btn-close').addEventListener('click', () => IS_DESKTOP && window.nexus.winClose());
    if (IS_DESKTOP) {
      window.nexus.onMaximized((v) => { $('#btn-max').textContent = v ? '❐' : '▢'; });
    } else {
      document.body.classList.add('browser');
    }
  }

  /* ---------- Navigation ---------- */
  function setupNav() {
    $$('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('.nav-item').forEach((b) => b.classList.toggle('active', b === btn));
        $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${btn.dataset.view}`));
        if (btn.dataset.view === 'planning') renderWeek();
        if (btn.dataset.view === 'reminders') renderReminders();
        if (btn.dataset.view === 'dashboard') renderDashboard();
        if (btn.dataset.view === 'hub') renderHub();
      });
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

  /* ---------- Fond animé ---------- */
  function initParticles() {
    const canvas = $('#bg');
    const ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;
    let w, h, pts;
    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      pts = Array.from({ length: Math.min(70, Math.floor(w / 22)) }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.6 + 0.4
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
        ctx.fillStyle = 'rgba(148, 180, 255, 0.35)';
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
            ctx.strokeStyle = `rgba(103, 140, 255, ${0.10 * (1 - d / 110)})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(frame);
    })();
  }

  /* ---------- Tableau de bord ---------- */
  function renderDashboard() {
    const today = dateStr(new Date());
    const todays = events.filter((e) => e.date === today).sort((a, b) => a.start - b.start);
    $('#dash-events').innerHTML = todays.length
      ? todays.map((e) => `<div class="ev-row" style="--c:${e.color}"><span class="t">${fmtMin(e.start)}–${fmtMin(e.end)}</span><span class="n">${esc(e.title)}</span></div>`).join('')
      : '<div class="empty">Rien de prévu aujourd’hui. ✨</div>';
    const upcoming = reminders.filter((r) => !r.done).sort((a, b) => a.at - b.at).slice(0, 5);
    $('#dash-reminders').innerHTML = upcoming.length
      ? upcoming.map((r) => `<div class="rem-row" style="--c:${r.at - Date.now() < 3600000 ? 'var(--amber)' : 'var(--violet)'}"><span class="n">⏰ ${esc(r.title)}</span><span class="t">${fmtDateTime(r.at)}</span></div>`).join('')
      : '<div class="empty">Aucun rappel actif.</div>';
    $('#dash-apps').innerHTML = apps.slice(0, 6).map((a) =>
      `<div class="mini-tile" data-app="${a.id}" style="--c:${a.color || COLORS[0]}"><span class="ic">${a.icon || '🚀'}</span><span>${esc(a.name)}</span></div>`).join('');
    $$('#dash-apps .mini-tile').forEach((el) => el.addEventListener('click', () => launchApp(apps.find((a) => a.id === el.dataset.app))));
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
      return `<div class="event" data-id="${e.id}" style="top:${top}px;height:${height}px;border-color:${e.color};background:${e.color}1f" title="${esc(e.title)} — ${fmtMin(e.start)} à ${fmtMin(e.end)}">
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
    const dayOptions = days.map((d, i) => `<option value="${dateStr(d)}" ${i === idx ? 'selected' : ''}>${DAY_NAMES[i]} ${fmtShort(d)}</option>`).join('');
    const swatches = COLORS.map((c) => `<div class="swatch ${c === ev.color ? 'sel' : ''}" data-color="${c}" style="background:${c};color:${c}"></div>`).join('');
    openModal(`
      <h3>${existing ? 'Modifier l’événement' : 'Nouvel événement'}</h3>
      <div class="form-grid">
        <div class="field full"><label>Titre</label><input id="f-title" type="text" maxlength="60" placeholder="Réunion, cours, sport…" value="${esc(ev.title)}"></div>
        <div class="field"><label>Jour</label><select id="f-date">${dayOptions}</select></div>
        <div class="field"><label>Couleur</label><div class="swatches" id="f-colors">${swatches}</div></div>
        <div class="field"><label>Début</label><input id="f-start" type="time" value="${minToHHMM(ev.start)}"></div>
        <div class="field"><label>Fin</label><input id="f-end" type="time" value="${minToHHMM(ev.end)}"></div>
      </div>
      <div class="modal-actions">
        ${existing ? '<button class="btn danger" id="f-del">Supprimer</button>' : ''}
        <button class="btn ghost" id="f-cancel">Annuler</button>
        <button class="btn primary" id="f-save">Enregistrer</button>
      </div>
    `);
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
      if (!title) { showToast('Donne un titre à l’événement.', 'warn'); return; }
      if (end <= start) { showToast('L’heure de fin doit être après le début.', 'warn'); return; }
      const data = { title, date: $('#f-date').value, start, end, color };
      if (existing) Object.assign(existing, data);
      else events.push({ id: uid(), ...data });
      store.set('nexus.events', events);
      closeModal();
      renderWeek();
      renderDashboard();
      showToast(existing ? 'Événement mis à jour.' : 'Événement ajouté.', 'ok');
    });
    const del = $('#f-del');
    if (del) del.addEventListener('click', () => {
      events = events.filter((e) => e.id !== existing.id);
      store.set('nexus.events', events);
      closeModal();
      renderWeek();
      renderDashboard();
      showToast('Événement supprimé.', 'ok');
    });
  }

  /* ---------- Rappels ---------- */
  function saveReminders() { store.set('nexus.reminders', reminders); updateBadge(); }

  function updateBadge() {
    const n = reminders.filter((r) => !r.done).length;
    const b = $('#rem-badge');
    b.hidden = n === 0;
    b.textContent = n;
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
          ${r.done ? '' : '<button class="icon-btn" data-act="snooze" title="Reporter de 10 minutes">↻ 10 min</button>'}
          <button class="icon-btn danger" data-act="del" title="Supprimer">🗑</button>
        </div>
      </div>`;
    };
    $('#reminder-list').innerHTML = upcoming.length + done.length
      ? upcoming.map(item).join('') + done.map(item).join('')
      : '<div class="empty" style="padding:14px 4px">Aucun rappel pour le moment. Ajoute-en un ci-dessus. ⏰</div>';
  }

  function setupReminders() {
    const dateInput = $('#rem-date');
    dateInput.value = dateStr(new Date());
    const now = new Date();
    $('#rem-time').value = `${pad(Math.min(23, now.getHours() + 1))}:00`;
    $('#reminder-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const title = $('#rem-title').value.trim();
      if (!title) { showToast('Donne un titre au rappel.', 'warn'); return; }
      const at = new Date(`${$('#rem-date').value}T${$('#rem-time').value}:00`).getTime();
      if (!at || Number.isNaN(at)) { showToast('Date ou heure invalide.', 'warn'); return; }
      reminders.push({ id: uid(), title, at, sound: $('#rem-sound').checked, done: false, notified: false });
      saveReminders();
      renderReminders();
      renderDashboard();
      $('#rem-title').value = '';
      showToast('Rappel ajouté. ⏰', 'ok');
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
        if (act === 'snooze') { r.at = Date.now() + 10 * 60000; r.notified = false; saveReminders(); renderReminders(); showToast('Rappel reporté de 10 min. ↻', 'ok'); }
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
    else if ('Notification' in window) {
      if (Notification.permission === 'granted') new Notification(`⏰ ${r.title}`, { body: `Prévu à ${when}` });
      else Notification.requestPermission().then((p) => { if (p === 'granted') new Notification(`⏰ ${r.title}`, { body: `Prévu à ${when}` }); });
    }
    if (r.sound !== false) beep();
    showToast(`⏰ ${r.title} — prévu à ${when}`, 'warn');
  }

  /* ---------- Hub ---------- */
  async function launchApp(a) {
    if (!a) return;
    if (a.kind === 'app' && !IS_DESKTOP) {
      showToast('💻 Les applications locales se lancent depuis NEXUS installé sur ton PC (pas dans le navigateur).', 'warn');
      return;
    }
    try {
      let res;
      if (a.kind === 'app') res = await window.nexus.launch(a);
      else if (IS_DESKTOP) res = await window.nexus.openUrl(a.target);
      else { window.open(a.target, '_blank', 'noopener'); return; }
      if (res && res.ok === false) showToast(`Impossible de lancer « ${a.name} » : ${res.error}`, 'error');
      else showToast(`Lancement de « ${a.name} »… 🚀`, 'ok');
    } catch (err) {
      showToast(`Erreur : ${err.message}`, 'error');
    }
  }

  function renderHub() {
    const grid = $('#hub-grid');
    grid.innerHTML = apps.map((a, i) => `
      <div class="tile" data-id="${a.id}" style="--c:${a.color || COLORS[i % COLORS.length]}" tabindex="0" role="button" title="Lancer ${esc(a.name)}">
        <div class="tile-icon">${a.icon || '🚀'}</div>
        <div class="tile-name">${esc(a.name)}</div>
        <div class="tile-kind">${a.kind === 'app' ? 'Application' : a.kind === 'url' ? 'Lien web' : 'Lien'}</div>
        <div class="tile-actions">
          <button class="icon-btn" data-act="edit" title="Modifier">✏️</button>
          <button class="icon-btn danger" data-act="del" title="Supprimer">🗑</button>
        </div>
      </div>`).join('') + `
      <div class="tile tile-add" id="tile-add" tabindex="0" role="button" title="Ajouter une application ou un lien">
        <div class="plus">＋</div><div class="tile-name">Ajouter</div>
      </div>`;
    grid.addEventListener('click', (e) => {
      const add = e.target.closest('#tile-add');
      if (add) { openAppModal(null); return; }
      const btn = e.target.closest('.icon-btn');
      const tile = e.target.closest('.tile');
      if (!tile) return;
      const a = apps.find((x) => x.id === tile.dataset.id);
      if (!a) return;
      if (btn) {
        if (btn.dataset.act === 'del') {
          apps = apps.filter((x) => x.id !== a.id);
          store.set('nexus.apps', apps);
          renderHub(); renderDashboard();
          showToast(`« ${a.name} » retiré du hub.`, 'ok');
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
    const a = existing || { name: '', kind: 'app', target: '', icon: '🚀' };
    openModal(`
      <h3>${existing ? 'Modifier' : 'Ajouter au hub'}</h3>
      <div class="form-grid">
        <div class="field"><label>Nom</label><input id="a-name" type="text" maxlength="30" placeholder="Mon app" value="${esc(a.name)}"></div>
        <div class="field"><label>Type</label>
          <select id="a-kind">
            <option value="app" ${a.kind === 'app' ? 'selected' : ''}>Application du PC</option>
            <option value="url" ${a.kind === 'url' ? 'selected' : ''}>Lien web (https)</option>
            <option value="link" ${a.kind === 'link' ? 'selected' : ''}>Lien système (ms-settings:…)</option>
          </select>
        </div>
        <div class="field full" id="a-target-wrap"><label id="a-target-label">${a.kind === 'url' || a.kind === 'link' ? 'Adresse' : 'Commande ou chemin (.exe)'}</label>
          <div class="pick-row">
            <input id="a-target" type="text" maxlength="300" placeholder="${a.kind === 'url' ? 'https://…' : a.kind === 'link' ? 'ms-settings:' : 'ex: code  ·  C:\\Program Files\\…\\app.exe'}" value="${esc(a.target)}">
            ${a.kind === 'app' && IS_DESKTOP ? '<button class="btn" id="a-pick" type="button">Parcourir…</button>' : ''}
          </div>
        </div>
        <div class="field"><label>Icône (emoji)</label><input id="a-icon" type="text" maxlength="4" value="${esc(a.icon)}"></div>
      </div>
      <div class="modal-actions">
        <button class="btn ghost" id="a-cancel">Annuler</button>
        <button class="btn primary" id="a-save">Enregistrer</button>
      </div>
    `);
    $('#a-kind').addEventListener('change', (e) => {
      const k = e.target.value;
      $('#a-target-label').textContent = k === 'url' || k === 'link' ? 'Adresse' : 'Commande ou chemin (.exe)';
      $('#a-target').placeholder = k === 'url' ? 'https://…' : k === 'link' ? 'ms-settings:' : 'ex: code  ·  C:\\…\\app.exe';
    });
    const pick = $('#a-pick');
    if (pick) pick.addEventListener('click', async () => {
      const p = await window.nexus.pickApp();
      if (p) $('#a-target').value = p;
    });
    $('#a-cancel').addEventListener('click', closeModal);
    $('#a-save').addEventListener('click', () => {
      const name = $('#a-name').value.trim();
      const kind = $('#a-kind').value;
      const target = $('#a-target').value.trim();
      const icon = $('#a-icon').value.trim() || '🚀';
      if (!name) { showToast('Donne un nom.', 'warn'); return; }
      if (!target) { showToast('Indique une commande, un chemin ou une adresse.', 'warn'); return; }
      if ((kind === 'url') && !/^https:\/\/.+/i.test(target)) { showToast('Un lien web doit commencer par https://', 'warn'); return; }
      if (existing) Object.assign(existing, { name, kind, target, icon });
      else apps.push({ id: uid(), name, kind, target, icon, color: COLORS[apps.length % COLORS.length] });
      store.set('nexus.apps', apps);
      closeModal();
      renderHub();
      renderDashboard();
      showToast(existing ? 'Entrée mise à jour.' : `« ${name} » ajouté au hub. 🚀`, 'ok');
    });
  }

  /* ---------- Initialisation ---------- */
  async function init() {
    setupTitlebar();
    setupNav();
    startClock();
    initParticles();
    setupPlanning();
    setupReminders();
    $('#platform-label').textContent = IS_DESKTOP ? await window.nexus.platform() : 'mode navigateur';
    if (!store.get('nexus.seeded', false)) {
      const defs = IS_DESKTOP ? await window.nexus.defaults() : BROWSER_DEFAULTS;
      apps = defs.map((d, i) => ({ ...d, id: uid(), color: COLORS[i % COLORS.length] }));
      store.set('nexus.apps', apps);
      store.set('nexus.seeded', true);
    } else {
      apps = store.get('nexus.apps', []);
    }
    events = store.get('nexus.events', []);
    reminders = store.get('nexus.reminders', []);
    renderWeek();
    renderReminders();
    renderHub();
    renderDashboard();
    updateBadge();
    checkReminders();
    if (!IS_DESKTOP) showToast('🌐 Mode navigateur : ouvre NEXUS installé sur ton PC pour lancer des applications et recevoir les notifications Windows.', 'warn');
  }

  init();
})();
