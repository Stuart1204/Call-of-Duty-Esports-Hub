/* ==========================================================================
   ROSTERMANIA — app logic
   Data-first, localStorage-backed roster lab for four Call of Duty scenes.
   ========================================================================== */
(() => {
  'use strict';

  const DATA = window.ROSTERMANIA_DATA;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const STORE_KEY = 'rostermania-v4';
  const LEAGUE_ORDER = ['cdl', 'ch', 'wz', 'mob'];
  const TIERS = ['S', 'A', 'B', 'C', 'D'];

  const REGIONS = {
    NA: 'North America', EU: 'Europe', AP: 'Asia-Pacific', LA: 'Latin America',
    ME: 'MENA', China: 'China', SEA: 'Southeast Asia', India: 'India', Japan: 'Japan',
    Brazil: 'Brazil', Europe: 'Europe', Africa: 'Africa', 'MENA / SEA': 'MENA / SEA',
    'North America': 'North America', 'Latin America': 'Latin America', Global: 'Global',
  };

  const FLAGS = {
    'United States': '🇺🇸', 'Canada': '🇨🇦', 'Mexico': '🇲🇽', 'Puerto Rico': '🇵🇷',
    England: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', Scotland: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', Wales: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', Ireland: '🇮🇪',
    France: '🇫🇷', Germany: '🇩🇪', Spain: '🇪🇸', Italy: '🇮🇹', Netherlands: '🇳🇱',
    Belgium: '🇧🇪', Denmark: '🇩🇰', Sweden: '🇸🇪', Norway: '🇳🇴', Finland: '🇫🇮',
    Poland: '🇵🇱', Austria: '🇦🇹', Switzerland: '🇨🇭', Turkey: '🇹🇷', Ukraine: '🇺🇦',
    Australia: '🇦🇺', 'New Zealand': '🇳🇿', Japan: '🇯🇵', China: '🇨🇳',
    'South Korea': '🇰🇷', Philippines: '🇵🇭', Indonesia: '🇮🇩', Cambodia: '🇰🇭',
    India: '🇮🇳', Pakistan: '🇵🇰', Bangladesh: '🇧🇩', 'Saudi Arabia': '🇸🇦',
    'United Arab Emirates': '🇦🇪', Qatar: '🇶🇦', Kuwait: '🇰🇼', Lebanon: '🇱🇧',
    Egypt: '🇪🇬', 'South Africa': '🇿🇦', Brazil: '🇧🇷', Argentina: '🇦🇷',
    Colombia: '🇨🇴', Chile: '🇨🇱', Peru: '🇵🇪', Venezuela: '🇻🇪', Ecuador: '🇪🇨',
    Panama: '🇵🇦', 'Costa Rica': '🇨🇷', 'Dominican Republic': '🇩🇴',
    'Trinidad and Tobago': '🇹🇹', Jamaica: '🇯🇲', Haiti: '🇭🇹', Tonga: '🇹🇴',
    Lithuania: '🇱🇹', Slovenia: '🇸🇮', Tunisia: '🇹🇳', Paraguay: '🇵🇾',
  };

  /* ------------------------------------------------------------------ *
   * Small helpers
   * ------------------------------------------------------------------ */
  const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slug = (s = '') => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const initials = (name = '') => name.replace(/[^A-Za-z0-9 ]/g, '').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const flag = (country = '') => FLAGS[country] || '🏳️';
  const regionName = r => REGIONS[r] || r || 'International';

  const clone = obj => JSON.parse(JSON.stringify(obj));
  const nowStr = () => new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  function toast(msg, kind = '') {
    const stack = $('#toast-stack');
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = msg;
    stack.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateY(6px)'; el.style.transition = '.2s'; }, 2800);
    setTimeout(() => el.remove(), 3200);
  }

  window.rmImgError = function (img) {
    const p = img.closest('.slot-photo, .cc-photo, .dr-photo, .fa-avatar-wrap');
    if (p) {
      const fb = document.createElement('div');
      fb.className = 'avatar-fallback';
      fb.textContent = img.dataset.initials || '?';
      img.replaceWith(fb);
    } else {
      img.style.visibility = 'hidden';
    }
  };

  /* ------------------------------------------------------------------ *
   * Runtime state
   * ------------------------------------------------------------------ */
  const runtime = {
    leagues: clone(DATA.leagues),
    teams: clone(DATA.teams),
    players: clone(DATA.players),
    customTeams: [],
    customPlayers: [],
    rosterOverrides: {},
  };

  const saved = (() => {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) { return {}; }
  })();

  const state = {
    league: saved.league && DATA.leagues[saved.league] ? saved.league : 'cdl',
    view: 'board',
    tierType: 'players',
    compareType: 'players',
    compareA: null,
    compareB: null,
    selectedPlayer: null,
    faSearch: '',
    faCountry: '',
    faSort: 'az',
    includeCh: true,
    teamSearch: '',
    teamRegion: '',
    teamSort: 'default',
    tierSearch: '',
    theme: saved.theme === 'light' ? 'light' : 'dark',
    tiers: saved.tiers || {},
    photoOverrides: saved.photoOverrides || {},
    intelFilter: 'All',
  };

  function leagueCfg(id = state.league) { return runtime.leagues[id]; }
  function currentTeams() {
    const cfg = leagueCfg();
    return cfg.teams.map(id => runtime.teams[id]).filter(Boolean);
  }
  function teamSize(team) { return team.size || leagueCfg(team.league).teamSize; }
  function teamPlayers(team) { return [...(team.roster || []), ...(team.bench || [])].filter(Boolean); }
  function teamFilled(team) { return (team.roster || []).filter(Boolean).length; }
  function player(id) { return runtime.players[id] || null; }

  function assignmentOf(pid) {
    for (const team of Object.values(runtime.teams)) {
      if ((team.roster || []).includes(pid)) return { team, kind: 'roster', index: team.roster.indexOf(pid) };
      if ((team.bench || []).includes(pid)) return { team, kind: 'bench', index: team.bench.indexOf(pid) };
    }
    return null;
  }

  function getFreeAgents(league = state.league) {
    const assigned = new Set();
    for (const team of Object.values(runtime.teams)) teamPlayers(team).forEach(p => assigned.add(p));
    return Object.values(runtime.players).filter(p => {
      if (p.league === league) return p.mw4 !== false && !assigned.has(p.id);
      if (league === 'cdl' && state.includeCh && p.league === 'ch') return p.mw4 !== false;
      return false;
    });
  }

  function normalizeTeams() {
    for (const team of Object.values(runtime.teams)) {
      const cfg = runtime.leagues[team.league];
      if (!cfg) continue;
      if (!team.size) team.size = cfg.teamSize;
      const roster = Array.isArray(team.roster) ? team.roster.slice(0, team.size) : [];
      while (roster.length < team.size) roster.push(null);
      team.roster = roster.map(id => (id && runtime.players[id] ? id : null));
      const bench = Array.isArray(team.bench) ? team.bench.slice(0, cfg.benchSize) : [];
      while (bench.length < cfg.benchSize) bench.push(null);
      team.bench = bench.map(id => (id && runtime.players[id] ? id : null));
    }
  }

  function hydrate() {
    // Custom players from storage
    (saved.customPlayers || []).forEach(p => {
      if (p && p.id && p.league) runtime.players[p.id] = p;
    });
    // Custom teams from storage
    (saved.customTeams || []).forEach(t => {
      if (!t || !t.id || !t.league || !runtime.leagues[t.league]) return;
      runtime.teams[t.id] = t;
      runtime.customTeams.push(t.id);
      if (!runtime.leagues[t.league].teams.includes(t.id)) runtime.leagues[t.league].teams.push(t.id);
    });
    // Custom photos for existing players
    for (const [pid, photo] of Object.entries(state.photoOverrides || {})) {
      if (runtime.players[pid] && photo) runtime.players[pid].photo = photo;
    }
    // Official roster overrides
    const overrides = saved.rosterOverrides || {};
    for (const [teamId, ov] of Object.entries(overrides)) {
      const team = runtime.teams[teamId];
      if (!team) continue;
      if (Array.isArray(ov.roster)) team.roster = ov.roster;
      if (Array.isArray(ov.bench)) team.bench = ov.bench;
    }
    normalizeTeams();
    // clean tier ids that no longer exist
    for (const lg of Object.keys(state.tiers)) {
      const bucket = state.tiers[lg];
      for (const type of ['players', 'teams']) {
        if (!bucket[type]) continue;
        for (const tier of TIERS) {
          bucket[type][tier] = (bucket[type][tier] || []).filter(id => type === 'players' ? runtime.players[id] : runtime.teams[id]);
        }
      }
    }
  }

  function saveState() {
    const rosterOverrides = {};
    for (const team of Object.values(runtime.teams)) {
      if (team.custom) continue;
      rosterOverrides[team.id] = { roster: (team.roster || []).map(x => x || null), bench: (team.bench || []).map(x => x || null) };
    }
    const payload = {
      league: state.league,
      theme: state.theme,
      tiers: state.tiers,
      customPlayers: Object.values(runtime.players).filter(p => p.custom),
      customTeams: Object.values(runtime.teams).filter(t => t.custom),
      rosterOverrides,
      photoOverrides: state.photoOverrides,
    };
    try { localStorage.setItem(STORE_KEY, JSON.stringify(payload)); } catch (e) { /* quota */ }
  }

  /* ------------------------------------------------------------------ *
   * Counts / header
   * ------------------------------------------------------------------ */
  function counts() {
    const teams = currentTeams();
    const total = teams.reduce((n, t) => n + teamSize(t), 0);
    const signed = teams.reduce((n, t) => n + teamFilled(t), 0);
    const complete = teams.filter(t => teamFilled(t) >= teamSize(t)).length;
    return { teams: teams.length, total, signed, complete };
  }

  function renderHeader() {
    const cfg = leagueCfg();
    document.documentElement.dataset.theme = state.theme;
    $('#app').style.setProperty('--accent', cfg.accent || '#ff5a1f');
    document.documentElement.style.setProperty('--accent', cfg.accent || '#ff5a1f');
    $('#league-glyph').textContent = cfg.shortName === 'Challengers' ? 'CDC' : cfg.shortName === 'CODM' ? 'CODM' : cfg.shortName === 'Warzone' ? 'WZ' : 'CDL';
    $('#league-title').textContent = cfg.name;
    $('#league-tagline').textContent = cfg.tagline;
    $$('.league-tab').forEach(t => t.classList.toggle('is-active', t.dataset.league === state.league));
    $$('.view-tab').forEach(t => t.classList.toggle('is-active', t.dataset.view === state.view));
    const c = counts();
    $('#signed-count').textContent = `${c.signed} / ${c.total}`;
    $('#squad-count').textContent = `${c.complete} complete`;
    $('#board-sub').textContent = `${cfg.game} · ${c.teams} teams · updated Nov 24, 2026`;
    $('#board-status').textContent = c.signed === c.total ? 'All rosters verified' : `${c.total - c.signed} open starter slots`;
    $('#fa-count').textContent = getFreeAgents().length;
    $('.workspace')?.classList.toggle('no-fa', !cfg.hasFreeAgents);
    $('#fa-rail').style.display = cfg.hasFreeAgents ? '' : 'none';
  }

  /* ------------------------------------------------------------------ *
   * Roster board
   * ------------------------------------------------------------------ */
  function teamColor(team) { return team.color || 'var(--accent)'; }

  function logoSrc(team) { return team.logo || ''; }

  function teamCrest(team) {
    const ini = team.short || initials(team.name);
    return `<div class="tc-crest" style="--team:${esc(teamColor(team))}" data-initials="${esc(ini)}">
      ${team.logo ? `<img src="${esc(team.logo)}" alt="${esc(team.name)} logo" loading="lazy" onerror="this.style.display='none';this.parentElement.classList.add('no-logo')">` : `<span class="crest-fallback">${esc(ini)}</span>`}
    </div>`;
  }

  function photoHTML(p, size = '') {
    if (!p) return '';
    if (p.photo) {
      return `<img src="${esc(p.photo)}" alt="${esc(p.name)}" loading="lazy" data-initials="${esc(initials(p.name))}" onerror="rmImgError(this)">`;
    }
    return `<div class="avatar-fallback">${esc(initials(p.name))}</div>`;
  }

  function realNameLine(p, cls = '') {
    if (!p) return '';
    const parts = [p.nativeName, p.realName].filter(Boolean).map(esc);
    if (!parts.length) return '';
    return `<div class="real-name${cls ? ` ${cls}` : ''}">${parts.join(' · ')}</div>`;
  }

  function slotHTML(team, pid, kind, idx) {
    const p = pid ? player(pid) : null;
    const attrs = `data-team-id="${esc(team.id)}" data-slot-kind="${kind}" data-slot-index="${idx}"`;
    if (!p) {
      return `<div class="slot empty" ${attrs} title="Add a player">
        <span class="plus">+</span><small>${kind === 'bench' ? 'Add sub' : 'Add player'}</small>
      </div>`;
    }
    return `<div class="slot" draggable="true" ${attrs} data-player-id="${esc(p.id)}" data-hover-player="${esc(p.id)}">
      <button class="slot-remove" data-action="remove-slot" ${attrs} title="Move to free agents" aria-label="Remove ${esc(p.name)}">×</button>
      ${p.stats ? `<span class="slot-rating">${p.stats.rating.toFixed(2)}</span>` : ''}
      <div class="slot-photo">${photoHTML(p)}</div>
      <div class="slot-info">
        <div class="slot-name">${esc(p.name)}</div>
        <div class="slot-country">${flag(p.country)} ${esc(p.country || '—')}</div>
      </div>
    </div>`;
  }

  function benchHTML(team, pid, idx) {
    const p = pid ? player(pid) : null;
    const attrs = `data-team-id="${esc(team.id)}" data-slot-kind="bench" data-slot-index="${idx}"`;
    if (!p) return `<div class="bench-slot" ${attrs} title="Add a substitute"><span>+ sub</span></div>`;
    return `<div class="bench-slot filled" ${attrs} data-player-id="${esc(p.id)}" data-hover-player="${esc(p.id)}" title="${esc(p.name)} · ${esc(p.country || '')}">
      ${p.photo ? `<img src="${esc(p.photo)}" alt="" loading="lazy" data-initials="${esc(initials(p.name))}" onerror="rmImgError(this)">` : `<span class="avatar-fallback" style="width:17px;height:17px;font-size:8px;border-radius:4px">${esc(initials(p.name))}</span>`}
      <span>${esc(p.name)}</span>
    </div>`;
  }

  function teamCard(team) {
    const size = teamSize(team);
    const filled = teamFilled(team);
    const cfg = leagueCfg(team.league);
    const staff = team.staff || [];
    const isCustom = !!team.custom;
    const slots = Array.from({ length: size }, (_, i) => slotHTML(team, team.roster[i], 'roster', i)).join('');
    const bench = Array.from({ length: cfg.benchSize }, (_, i) => benchHTML(team, team.bench[i], i)).join('');
    return `<article class="team-card ${isCustom ? 'is-custom' : ''}" data-team-id="${esc(team.id)}" data-size="${size}" style="--team:${esc(teamColor(team))}">
      <div class="tc-head">
        ${teamCrest(team)}
        <div class="tc-id">
          <div class="tc-name">${esc(team.name)}</div>
          <div class="tc-meta">
            <span class="chip region">${esc(team.region || 'INT')}</span>
            <span class="chip ${isCustom ? 'custom' : 'official'}">${isCustom ? 'Custom' : 'Official'}</span>
            <span class="tc-note">${esc(team.note || '')}</span>
          </div>
        </div>
        <button class="tc-menu-btn" data-action="team-menu" data-team-id="${esc(team.id)}" aria-label="Team menu" title="Team menu">
          <svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>
        </button>
        <div class="tc-menu" data-menu-for="${esc(team.id)}">
          <button data-action="clear-team" data-team-id="${esc(team.id)}"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>Clear roster</button>
          <button data-action="official-team" data-team-id="${esc(team.id)}"><svg viewBox="0 0 24 24"><path d="M4 4v16M4 5h11l-2 4 2 4H4"/></svg>Revert to official</button>
          <button data-action="copy-team" data-team-id="${esc(team.id)}"><svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>Copy roster</button>
          ${isCustom ? `<hr><button class="danger" data-action="delete-team" data-team-id="${esc(team.id)}"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>Delete custom team</button>` : ''}
        </div>
      </div>
      <div class="tc-roster">${slots}</div>
      <div class="tc-lower">
        <div class="tc-bench">
          <span class="bench-label">BENCH</span>
          ${bench}
        </div>
        <div class="tc-cap" title="${filled} of ${size} starters">
          <div class="cap-bar"><i style="width:${size ? Math.round(filled / size * 100) : 0}%"></i></div>
          <span class="cap-txt">${filled}/${size}</span>
        </div>
      </div>
      ${staff.length ? `<div class="staff-row">${staff.map(s => `<span class="staff-chip"><b>${esc(s.name)}</b> · ${esc(s.role)}</span>`).join('')}</div>` : ''}
    </article>`;
  }

  function filteredTeams() {
    let teams = currentTeams();
    const q = state.teamSearch.trim().toLowerCase();
    if (q) teams = teams.filter(t => t.name.toLowerCase().includes(q) || (t.short || '').toLowerCase().includes(q));
    if (state.teamRegion) teams = teams.filter(t => t.region === state.teamRegion);
    if (state.teamSort === 'az') teams = [...teams].sort((a, b) => a.name.localeCompare(b.name));
    if (state.teamSort === 'za') teams = [...teams].sort((a, b) => b.name.localeCompare(a.name));
    if (state.teamSort === 'region') teams = [...teams].sort((a, b) => (a.region || '').localeCompare(b.region || '') || a.name.localeCompare(b.name));
    if (state.teamSort === 'rating') teams = [...teams].sort((a, b) => (teamRating(b) || 0) - (teamRating(a) || 0));
    return teams;
  }

  function renderChampionsPanel() {
    const el = $('#champions-panel');
    if (!el) return;
    const champs = DATA.meta.codmChampions;
    if (state.league !== 'mob' || !champs) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    const nameMap = DATA.meta.codmChampionNames || {};
    const byName = {};
    Object.values(runtime.players).forEach(p => { if (p.league === 'mob') byName[p.name.toLowerCase()] = p; });
    const rosterName = n => {
      const m = nameMap[n] || byName[n.toLowerCase()] || null;
      const parts = m ? [m.nativeName, m.realName].filter(Boolean).map(esc) : [];
      return parts.length ? `${esc(n)} <small class="champ-real">${parts.join(' · ')}</small>` : esc(n);
    };
    el.innerHTML = `<div class="champions-head"><h3>CODM World Champions</h3><span class="eyebrow">S-TIER RINGS</span></div>
      <div class="champions-grid">${champs.map(c => `<div class="champions-card">
        <div class="champions-year">${c.year} WORLD CHAMPIONS</div>
        <div class="champions-team">${esc(c.team)}</div>
        <div class="champions-roster">${c.roster.map(rosterName).join(' · ')}</div>
        ${c.sub ? `<div class="champions-sub">Sub: ${esc(c.sub)}</div>` : ''}
      </div>`).join('')}</div>`;
  }

  function renderBoard() {
    renderChampionsPanel();
    const teams = filteredTeams();
    const grid = $('#team-grid');
    grid.innerHTML = teams.map(teamCard).join('');
    $('#board-empty').hidden = teams.length > 0;
    grid.hidden = teams.length === 0;
    $('#legend')?.remove();
  }

  function renderRegionFilter() {
    const sel = $('#team-region');
    const regions = [...new Set(currentTeams().map(t => t.region).filter(Boolean))].sort((a, b) => regionName(a).localeCompare(regionName(b)));
    sel.innerHTML = `<option value="">All regions</option>` + regions.map(r => `<option value="${esc(r)}" ${state.teamRegion === r ? 'selected' : ''}>${esc(regionName(r))}</option>`).join('');
    sel.value = state.teamRegion;
  }

  /* ------------------------------------------------------------------ *
   * Free agents
   * ------------------------------------------------------------------ */
  function renderFreeAgents() {
    const cfg = leagueCfg();
    if (!cfg.hasFreeAgents) {
      $('#fa-rail').style.display = 'none';
      $('#fa-list').innerHTML = '';
      $('#fa-count').textContent = '0';
      return;
    }
    $('#fa-rail').style.display = '';
    const fas = getFreeAgents();
    const isMarket = state.league === 'cdl' && state.includeCh;
    const eyebrow = $('.fa-title-row .eyebrow');
    if (eyebrow) eyebrow.textContent = isMarket ? 'PLAYER MARKET' : 'FREE AGENTS';
    const scope = $('#fa-scope-wrap');
    if (scope) scope.classList.toggle('is-hidden', state.league !== 'cdl');
    const includeBox = $('#fa-include-ch');
    if (includeBox) includeBox.checked = state.includeCh;
    const countries = [...new Set(fas.map(p => p.country).filter(Boolean))].sort();
    const countrySel = $('#fa-country');
    countrySel.innerHTML = `<option value="">All countries</option>` + countries.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    countrySel.value = state.faCountry;
    const q = state.faSearch.trim().toLowerCase();
    let list = fas.filter(p => (!q || p.name.toLowerCase().includes(q)) && (!state.faCountry || p.country === state.faCountry));
    if (state.faSort === 'az') list.sort((a, b) => a.name.localeCompare(b.name));
    else if (state.faSort === 'za') list.sort((a, b) => b.name.localeCompare(a.name));
    else if (state.faSort === 'country') list.sort((a, b) => (a.country || '').localeCompare(b.country || '') || a.name.localeCompare(b.name));
    else if (state.faSort === 'rating') list.sort((a, b) => (b.stats?.rating || 0) - (a.stats?.rating || 0) || a.name.localeCompare(b.name));
    $('#fa-count').textContent = fas.length;
    $('#fa-hint').innerHTML = state.selectedPlayer
      ? `<b style="color:var(--accent)">${esc(player(state.selectedPlayer)?.name || '')}</b> selected — tap a roster slot to place. <span style="color:var(--muted-2)">Esc to cancel.</span>`
      : isMarket ? 'Includes Challengers players. Drag a CDC name onto a CDL slot to poach them.' : 'Drag a player onto a slot — or tap to select, then tap a slot.';
    const listEl = $('#fa-list');
    if (!list.length) {
      listEl.innerHTML = `<div class="fa-empty"><b>No free agents found</b>${
        fas.length ? 'Try clearing the filters.'
        : state.league === 'cdl' && !state.includeCh ? 'No CDL free agents have a 2027 MW4 sample. Turn on “Include Challengers players” to browse the CDC market.'
        : 'No 2027 MW4 players are available in this market.'
      }</div>`;
      return;
    }
    listEl.innerHTML = list.map(p => {
      const selected = state.selectedPlayer === p.id;
      return `<div class="fa-row ${selected ? 'is-selected' : ''}" draggable="true" data-player-id="${esc(p.id)}" data-hover-player="${esc(p.id)}" tabindex="0" role="button" aria-pressed="${selected}" aria-label="${esc(p.name)}, ${esc(p.country || 'free agent')}">
        <div class="fa-avatar-wrap">${p.photo ? `<img class="fa-avatar" src="${esc(p.photo)}" alt="" loading="lazy" data-initials="${esc(initials(p.name))}" onerror="rmImgError(this)">` : `<span class="avatar-fallback" style="width:31px;height:31px;font-size:11px;border-radius:7px">${esc(initials(p.name))}</span>`}</div>
        <div class="fa-info">
          <div class="fa-name">${esc(p.name)}</div>
          <div class="fa-sub">${flag(p.country)} ${esc(p.country || 'Unknown')}${p.league !== state.league ? ' · CDC' : (p.role ? ` · ${esc(p.role)}` : '')}${p.league !== state.league && assignmentOf(p.id) ? ` · ${esc(assignmentOf(p.id).team.short || assignmentOf(p.id).team.name)}` : ''}</div>
        </div>
        ${p.stats ? `<span class="fa-rating">${p.stats.rating.toFixed(2)}</span>` : ''}
      </div>`;
    }).join('');
  }

  /* ------------------------------------------------------------------ *
   * Stats popover
   * ------------------------------------------------------------------ */
  let popTimer = null;
  function showStats(pid, anchor) {
    const p = player(pid);
    if (!p) return;
    const pop = $('#stat-pop');
    const team = Object.values(runtime.teams).find(t => teamPlayers(t).includes(pid));
    const st = p.stats;
    let body = '';
    if (st) {
      const bar = (label, val, max) => `<div class="sp-bar-row"><span>${label}</span><div class="sp-bar"><i style="width:${Math.max(4, Math.min(100, (val / max) * 100))}%"></i></div><b>${val.toFixed(2)}</b></div>`;
      body = `<div class="sp-bars">
        ${bar('K/D', st.kd, 1.6)}
        ${bar('S&D', st.skd, 1.6)}
        ${bar('Slayer', st.slayer, 120)}
      </div>
      <div class="sp-grid">
        <div class="sp-cell"><span>Maps</span><b>${st.maps}</b></div>
        <div class="sp-cell"><span>Season</span><b>${st.season}</b></div>
        <div class="sp-cell"><span>Kills</span><b>${st.k.toLocaleString()}</b></div>
        <div class="sp-cell"><span>Deaths</span><b>${st.d.toLocaleString()}</b></div>
      </div>
      <div class="sp-note">Live Breaking Point stats · ${st.season} season${st.season !== 2027 ? ' (latest available sample)' : ''} · ${st.maps} maps.${st.bpTag ? ` BP tag: <b style="color:var(--text-dim)">${esc(st.bpTag)}</b>.` : ''} Source: breakingpoint.gg/stats.</div>`;
    } else {
      body = `<div class="sp-note" style="border-top:0;padding-top:0">No published stat set for this circuit. ${p.league === 'ch' ? 'Challengers does not publish a public stat feed.' : p.league === 'mob' ? 'CODM does not publish a public stat feed.' : 'Warzone does not publish a public stat feed.'} Use the eye test — or the tier list.</div>`;
    }
    pop.innerHTML = `<div class="sp-top">
      <div class="sp-img">${photoHTML(p)}</div>
      <div><div class="sp-name">${esc(p.name)}</div>${realNameLine(p, 'sp-real')}<div class="sp-sub">${flag(p.country)} ${esc(p.country || 'Unknown')}${team ? ` · ${esc(team.short || team.name)}` : ' · Free agent'}</div></div>
      ${st ? `<div class="sp-rating">${st.rating.toFixed(2)}<small>BP RATING</small></div>` : ''}
    </div>${body}`;
    pop.hidden = false;
    const r = anchor.getBoundingClientRect();
    const pr = pop.getBoundingClientRect();
    let left = r.left + r.width / 2 - pr.width / 2;
    let top = r.top - pr.height - 9;
    if (top < 8) top = r.bottom + 9;
    left = Math.max(8, Math.min(window.innerWidth - pr.width - 8, left));
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }
  function hideStats() { $('#stat-pop').hidden = true; }

  /* ------------------------------------------------------------------ *
   * Drawer
   * ------------------------------------------------------------------ */
  function openDrawer(html, color = 'var(--accent)') {
    $('#drawer-body').innerHTML = html;
    $('#drawer').style.setProperty('--dc', color);
    $('#drawer').classList.add('open');
    $('#drawer').setAttribute('aria-hidden', 'false');
    $('#drawer-scrim').hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeDrawer() {
    $('#drawer').classList.remove('open');
    $('#drawer').setAttribute('aria-hidden', 'true');
    $('#drawer-scrim').hidden = true;
    document.body.style.overflow = '';
  }

  function accoladeHTML(p) {
    const a = p.accolades || {};
    const majors = [...(a.majors || []), ...(a.ewc || [])].sort((x, y) => (y.date || '').localeCompare(x.date || ''));
    const rings = a.rings || [];
    const mvps = a.seasonMvps || [];
    const list = (title, items, cls, limit, award = false) => {
      if (!items.length) return '';
      const rows = items.slice(0, limit).map(i => `<div class="acc-item ${cls}"><span class="acc-year">${esc(i.year)}</span><div class="acc-ev">${esc(i.event)}${award && i.award ? `<span class="acc-award">${esc(i.award)}</span>` : ''}</div></div>`).join('');
      const more = items.length > limit ? `<div class="acc-more">+ ${items.length - limit} more</div>` : '';
      return `<div class="acc-group"><h4>${title} <span>${items.length}</span></h4><div class="acc-list">${rows}</div>${more}</div>`;
    };
    const groups = [
      list('World championship rings', rings, 'ring', 12),
      list('Major championships', majors, 'major', 8),
      list('Season MVPs', mvps, 'mvp', 8, true),
    ].filter(Boolean).join('');
    const summary = [
      majors.length ? `<span class="acc-chip major">${majors.length}× Major Champion</span>` : '',
      rings.length ? `<span class="acc-chip">${rings.length}× World Champion</span>` : '',
      mvps.length ? `<span class="acc-chip season">${mvps.length}× Season MVP</span>` : '',
    ].filter(Boolean).join('');
    if (!summary && !groups) return '<div class="acc-empty">No S-tier accolades on record yet.</div>';
    return `<div class="acc-summary">${summary}</div>${groups}`;
  }

  function openPlayer(pid) {
    const p = player(pid);
    if (!p) return;
    const team = Object.values(runtime.teams).find(t => teamPlayers(t).includes(pid));
    const color = team ? teamColor(team) : 'var(--accent)';
    const st = p.stats;
    const statGrid = st ? `<div class="dr-stat-grid">
      <div class="dr-stat"><span>BP rating</span><b style="color:${esc(color)}">${st.rating.toFixed(2)}</b></div>
      <div class="dr-stat"><span>Overall K/D</span><b>${st.kd.toFixed(2)}</b></div>
      <div class="dr-stat"><span>Slayer rating</span><b>${st.slayer.toFixed(1)}</b></div>
      <div class="dr-stat"><span>S&amp;D K/D</span><b>${st.snd_maps > 0 ? st.skd.toFixed(2) : '—'}</b></div>
      <div class="dr-stat"><span>Hardpoint K/D</span><b>${st.hp_kd > 0 ? st.hp_kd.toFixed(2) : '—'}</b></div>
      <div class="dr-stat"><span>Hijack K/D</span><b>${st.hjk_kd > 0 ? st.hjk_kd.toFixed(2) : '—'}</b></div>
      <div class="dr-stat"><span>Maps</span><b>${st.maps}</b></div>
      <div class="dr-stat"><span>Season</span><b>${st.season}</b></div>
      <div class="dr-stat"><span>Kills</span><b>${st.k.toLocaleString()}</b></div>
      <div class="dr-stat"><span>Deaths</span><b>${st.d.toLocaleString()}</b></div>
      <div class="dr-stat"><span>DMG / 10M</span><b>${st.dmg10.toLocaleString(undefined,{maximumFractionDigits:0})}</b></div>
      <div class="dr-stat"><span>S&amp;D open %</span><b>${(st.odw * 100).toFixed(0)}%</b></div>
    </div>` : `<div class="dr-more">No public stat set is published for this circuit. ${p.league === 'ch' ? 'Challengers rosters are judged on results and eye test.' : ''}</div>`;
    openDrawer(`
      <div class="dr-hero">
        <div class="dr-hero-top">
          <div class="dr-photo">${photoHTML(p)}</div>
          <div>
            <div class="dr-name">${esc(p.name)}</div>
            ${realNameLine(p, 'dr-real')}
            <div class="dr-sub">${flag(p.country)} ${esc(p.country || 'Unknown')} ${p.role ? `· ${esc(p.role)}` : ''}</div>
            <div class="dr-status">
              <span class="chip region">${esc(leagueCfg(p.league).shortName)}</span>
              <span class="chip ${team ? 'official' : 'custom'}">${team ? 'Signed' : 'Free agent'}</span>
              ${p.custom ? '<span class="chip custom">Custom</span>' : ''}
              ${st?.bpTag ? `<span class="chip region">BP tag: ${esc(st.bpTag)}</span>` : ''}
              ${p.accolades?.rings?.length ? `<span class="chip official">${p.accolades.rings.length}× World Champ</span>` : ''}
              ${p.accolades?.majors?.length || p.accolades?.ewc?.length ? `<span class="chip region">S-tier major winner</span>` : ''}
            </div>
          </div>
        </div>
        ${st ? `<div class="dr-hero-stats"><div class="dr-rating">${st.rating.toFixed(2)}<small>BP RATING</small></div><div class="dr-hero-note">Live from Breaking Point · ${st.season} season · ${st.maps} maps.</div></div>` : ''}
      </div>
      <div class="dr-section">
        <h3>${team ? 'Current team' : 'Market status'}</h3>
        ${team ? `<div class="dr-team-row"><img src="${esc(team.logo)}" alt="" onerror="this.style.visibility='hidden'"><div><b>${esc(team.name)}</b><div class="muted">${esc(regionName(team.region))} · ${teamFilled(team)}/${teamSize(team)} starters</div></div></div>` : `<div class="dr-more">Available. Use the free agent rail to drag ${esc(p.name)} into any open slot.</div>`}
      </div>
      <div class="dr-section"><h3>${st ? 'Stat line' : 'Stats'}</h3>${statGrid}</div>
      ${(p.league === 'cdl' || (p.accolades && ((p.accolades.rings || []).length || (p.accolades.majors || []).length || (p.accolades.ewc || []).length || (p.accolades.seasonMvps || []).length))) ? `<div class="dr-section"><h3>Trophy cabinet</h3>${accoladeHTML(p)}</div>` : ''}
      <div class="dr-section">
        <h3>Actions</h3>
        <div class="dr-actions">
          ${team ? `<button class="btn btn-ghost" data-action="drawer-to-fa" data-player-id="${esc(p.id)}">Move to free agents</button>` : `<button class="btn btn-ghost" data-action="drawer-find-team" data-player-id="${esc(p.id)}">Find a team</button>`}
          <button class="btn btn-ghost" data-action="player-photo" data-player-id="${esc(p.id)}">Update photo</button>
          ${state.photoOverrides[p.id] ? `<button class="btn btn-ghost" data-action="player-photo-reset" data-player-id="${esc(p.id)}">Reset photo</button>` : ''}
          <button class="btn btn-ghost" data-action="drawer-compare" data-player-id="${esc(p.id)}">Compare player</button>
          <button class="btn btn-ghost" data-action="drawer-tier" data-player-id="${esc(p.id)}">Open tier list</button>
          <button class="btn btn-ghost" data-action="close-drawer">Close</button>
        </div>
        <div class="dr-more" style="margin-top:7px">Player photo uploads are resized to 500px and saved in this browser. Use <b>Reset photo</b> to return to the default headshot.</div>
      </div>
      <div class="dr-section"><div class="dr-more">${p.league === 'cdl' ? 'Aggregated from Breaking Point player stats (breakingpoint.gg/stats). 2027 MW4 season only (minimum 5 maps). Older-season samples are not used.' : 'No stats are shown for this circuit because no public stat set exists.'}</div></div>
    `, color);
  }

  function openTeam(teamId) {
    const t = runtime.teams[teamId];
    if (!t) return;
    const roster = (t.roster || []).map((pid, i) => pid ? `<div class="rc-row">${player(pid)?.photo ? `<img src="${esc(player(pid).photo)}" alt="">` : `<span class="avatar-fallback" style="width:22px;height:22px;font-size:8px">${esc(initials(player(pid)?.name))}</span>`}<span>${esc(player(pid)?.name)}</span><span class="muted">${player(pid)?.stats ? player(pid).stats.rating.toFixed(2) : ''}</span></div>` : '').filter(Boolean).join('');
    openDrawer(`
      <div class="dr-hero">
        <div class="dr-hero-top">
          <div class="dr-photo" style="background:var(--panel-2)"><img src="${esc(t.logo)}" alt="" style="object-fit:contain;padding:8px" onerror="this.style.display='none'"></div>
          <div><div class="dr-name">${esc(t.name)}</div><div class="dr-sub">${flag('')} ${esc(regionName(t.region))} · ${esc(t.note || '')}</div>
          <div class="dr-status"><span class="chip ${t.custom ? 'custom' : 'official'}">${t.custom ? 'Custom team' : 'Official roster'}</span><span class="chip region">${teamFilled(t)}/${teamSize(t)}</span></div></div>
        </div>
      </div>
      <div class="dr-section"><h3>Starters</h3><div class="roster-compare">${roster || '<div class="dr-empty">No starters yet.</div>'}</div></div>
      <div class="dr-section"><h3>Actions</h3><div class="dr-actions">
        <button class="btn btn-ghost" data-action="clear-team" data-team-id="${esc(t.id)}">Clear roster</button>
        <button class="btn btn-ghost" data-action="official-team" data-team-id="${esc(t.id)}">Revert official</button>
        <button class="btn btn-ghost" data-action="copy-team" data-team-id="${esc(t.id)}">Copy roster</button>
        <button class="btn btn-ghost" data-action="drawer-compare-team" data-team-id="${esc(t.id)}">Compare team</button>
      </div></div>
    `, teamColor(t));
  }

  /* ------------------------------------------------------------------ *
   * Tier list
   * ------------------------------------------------------------------ */
  function tierBucket() {
    if (!state.tiers[state.league]) state.tiers[state.league] = {};
    if (!state.tiers[state.league][state.tierType]) state.tiers[state.league][state.tierType] = { S: [], A: [], B: [], C: [], D: [] };
    for (const t of TIERS) if (!Array.isArray(state.tiers[state.league][state.tierType][t])) state.tiers[state.league][state.tierType][t] = [];
    return state.tiers[state.league][state.tierType];
  }

  function tierItems() {
    if (state.tierType === 'players') return getLeaguePlayers();
    return currentTeams();
  }

  function tierItemHTML(type, id) {
    if (type === 'teams') {
      const t = runtime.teams[id];
      if (!t) return '';
      return `<div class="tier-chip" draggable="true" data-tier-id="${esc(id)}" data-tier-type="teams" title="${esc(t.name)}">
        <img class="tc-logo" src="${esc(t.logo)}" alt="" onerror="this.style.visibility='hidden'"><b>${esc(t.name)}</b>
      </div>`;
    }
    const p = runtime.players[id];
    if (!p) return '';
    return `<div class="tier-chip" draggable="true" data-tier-id="${esc(id)}" data-tier-type="players" title="${esc(p.name)}">
      ${p.photo ? `<img src="${esc(p.photo)}" alt="" loading="lazy" onerror="rmImgError(this)">` : `<span class="avatar-fallback" style="width:23px;height:23px;font-size:8px;border-radius:5px">${esc(initials(p.name))}</span>`}
      <b>${esc(p.name)}</b><span class="flag">${flag(p.country)}</span>
    </div>`;
  }

  function renderTiers() {
    $$('.seg[data-tier-type]').forEach(b => b.classList.toggle('is-active', b.dataset.tierType === state.tierType));
    const bucket = tierBucket();
    const board = $('#tier-board');
    board.innerHTML = TIERS.map(t => {
      const ids = bucket[t];
      return `<div class="tier-row tier-${t}">
        <div class="tier-label">${t}<small>${ids.length} ITEMS</small></div>
        <div class="tier-drop" data-tier-drop="${t}">${ids.map(id => tierItemHTML(state.tierType, id)).join('')}</div>
      </div>`;
    }).join('');
    const ranked = new Set(TIERS.flatMap(t => bucket[t]));
    const pool = tierItems().filter(x => !ranked.has(x.id)).filter(x => {
      const q = state.tierSearch.trim().toLowerCase();
      return !q || (x.name || '').toLowerCase().includes(q);
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    $('#tier-palette-count').textContent = `${pool.length} unranked`;
    $('#tier-palette').innerHTML = pool.map(x => tierItemHTML(state.tierType, x.id)).join('') || `<div class="fa-empty" style="padding:16px">Everything is ranked.</div>`;
  }

  function rankItem(type, id, tier) {
    const bucket = tierBucket();
    for (const t of TIERS) bucket[t] = bucket[t].filter(x => !(x === id && type === state.tierType));
    if (tier !== 'unranked') bucket[tier].push(id);
    saveState(); renderTiers();
  }

  function autoTier() {
    const bucket = tierBucket();
    for (const t of TIERS) bucket[t] = [];
    let items = tierItems();
    if (state.tierType === 'players') {
      items.sort((a, b) => (b.stats?.rating || 0) - (a.stats?.rating || 0) || a.name.localeCompare(b.name));
    } else {
      items.sort((a, b) => (teamRating(b) || 0) - (teamRating(a) || 0) || a.name.localeCompare(b.name));
    }
    const cuts = [4, 8, 10, 12];
    items.forEach((x, i) => {
      let tier = 'D';
      if (i < cuts[0]) tier = 'S'; else if (i < cuts[1]) tier = 'A'; else if (i < cuts[2]) tier = 'B'; else if (i < cuts[3]) tier = 'C';
      bucket[tier].push(x.id);
    });
    saveState(); renderTiers(); toast('Tier list auto-seeded from form ratings.', 'good');
  }

  /* ------------------------------------------------------------------ *
   * Compare
   * ------------------------------------------------------------------ */
  function playerRating(p) { return p?.stats?.rating || null; }
  function teamRating(t) {
    if (!t) return null;
    const vals = (t.roster || []).map(player).filter(Boolean).map(p => p.stats?.rating).filter(Boolean);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }

  function compareOptions(type) {
    if (type === 'teams') return currentTeams().sort((a, b) => a.name.localeCompare(b.name)).map(t => ({ id: t.id, name: t.name }));
    return getLeaguePlayers().sort((a, b) => a.name.localeCompare(b.name)).map(p => ({ id: p.id, name: p.name }));
  }
  function getLeaguePlayers() {
    const ids = new Set();
    currentTeams().forEach(t => teamPlayers(t).forEach(id => ids.add(id)));
    return Object.values(runtime.players).filter(p => (p.league === state.league && p.mw4 !== false) || ids.has(p.id));
  }

  function ensureCompare() {
    const opts = compareOptions(state.compareType);
    if (!opts.length) return;
    if (!opts.some(o => o.id === state.compareA)) state.compareA = opts[0].id;
    if (!opts.some(o => o.id === state.compareB) || state.compareB === state.compareA) state.compareB = opts[1]?.id || opts[0].id;
  }

  function renderCompare() {
    $$('.seg[data-compare-type]').forEach(b => b.classList.toggle('is-active', b.dataset.compareType === state.compareType));
    ensureCompare();
    const opts = compareOptions(state.compareType);
    const optionsHTML = (sel) => opts.map(o => `<option value="${esc(o.id)}" ${sel === o.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('');
    $('#compare-selects').innerHTML = `
      <div class="compare-select-card"><label>LEFT SIDE</label><select id="compare-a">${optionsHTML(state.compareA)}</select></div>
      <div class="vs-badge">VS</div>
      <div class="compare-select-card"><label>RIGHT SIDE</label><select id="compare-b">${optionsHTML(state.compareB)}</select></div>`;
    $('#compare-a').addEventListener('change', e => { state.compareA = e.target.value; renderCompare(); });
    $('#compare-b').addEventListener('change', e => { state.compareB = e.target.value; renderCompare(); });
    if (state.compareType === 'teams') renderTeamCompare();
    else renderPlayerCompare();
  }

  const bar = (label, val, max, color) => `<div class="stat-bar-row"><span>${label}</span><div class="stat-bar"><i style="width:${Math.max(3, Math.min(100, (val / max) * 100))}%;background:${color}"></i></div><b>${val.toFixed(2)}</b></div>`;

  function playerCompareCard(p, side) {
    if (!p) return '<div class="compare-card"><div class="dr-empty">Pick a player.</div></div>';
    const team = Object.values(runtime.teams).find(t => teamPlayers(t).includes(p.id));
    const color = team ? teamColor(team) : 'var(--accent)';
    const st = p.stats;
    return `<div class="compare-card" style="--cc:${esc(color)}">
      <div class="cc-head">
        <div class="cc-photo">${photoHTML(p)}</div>
        <div><div class="cc-name">${esc(p.name)}</div><div class="cc-sub">${flag(p.country)} ${esc(p.country || '')} ${team ? `· ${esc(team.short || team.name)}` : '· Free agent'}</div></div>
      </div>
      <div class="cc-body">
        ${st ? `<div class="cc-rating"><b>${st.rating.toFixed(2)}</b><span>BP<br>RATING</span><span style="margin-left:auto;text-align:right">${st.maps} maps<br>${st.season} season</span></div>
        <div class="stat-bars">
          ${bar('K/D', st.kd, 1.6, color)}
          ${bar('S&D K/D', st.skd, 1.6, color)}
          ${bar('Slayer', st.slayer, 120, color)}
        </div>` : `<div class="cc-rating"><b style="font-size:22px">${p.league === 'ch' ? 'No public stats' : p.league === 'mob' ? 'CODM' : 'Warzone'}</b></div><div class="dr-more">This circuit does not publish a public stat feed. Compare on titles, roles and eye test.</div>`}
      </div>
      <div class="verdict">${side === 'left' ? 'Left side' : 'Right side'}</div>
    </div>`;
  }

  function radarSVG(a, b) {
    const cx = 125, cy = 125, R = 88;
    const labels = ['Rating', 'K/D', 'S&D', 'Slayer', 'Maps'];
    const norm = (p) => {
      const s = p.stats;
      return [
        Math.max(4, Math.min(100, s.rating * 100)),
        Math.max(4, Math.min(100, (s.kd / 1.6) * 100)),
        Math.max(4, Math.min(100, (s.skd / 1.6) * 100)),
        Math.max(4, Math.min(100, (s.slayer / 120) * 100)),
        Math.max(4, Math.min(100, (s.maps / 60) * 100)),
      ];
    };
    const pts = (vals) => vals.map((v, i) => {
      const ang = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const r = (v / 100) * R;
      return `${cx + Math.cos(ang) * r},${cy + Math.sin(ang) * r}`;
    }).join(' ');
    const va = norm(a), vb = norm(b);
    const rings = [25, 50, 75, 100].map(pct => {
      const rr = (pct / 100) * R;
      const points = [0, 1, 2, 3, 4].map(i => {
        const ang = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        return `${cx + Math.cos(ang) * rr},${cy + Math.sin(ang) * rr}`;
      }).join(' ');
      return `<polygon points="${points}" fill="none" stroke="var(--line)" stroke-width="1"/>`;
    }).join('');
    const axes = [0, 1, 2, 3, 4].map(i => {
      const ang = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      return `<line x1="${cx}" y1="${cy}" x2="${cx + Math.cos(ang) * R}" y2="${cy + Math.sin(ang) * R}" stroke="var(--line)" stroke-width="1"/>`;
    }).join('');
    const labelEls = labels.map((l, i) => {
      const ang = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const x = cx + Math.cos(ang) * (R + 18), y = cy + Math.sin(ang) * (R + 16);
      return `<text x="${x}" y="${y}" text-anchor="middle" fill="var(--muted)" font-size="8" font-family="JetBrains Mono, monospace">${l}</text>`;
    }).join('');
    return `<div class="radar-wrap"><svg viewBox="0 0 250 260" role="img" aria-label="Stat radar comparison">
      ${rings}${axes}${labelEls}
      <polygon points="${pts(va)}" fill="rgba(255,90,31,.18)" stroke="var(--accent)" stroke-width="2"/>
      <polygon points="${pts(vb)}" fill="rgba(101,169,255,.15)" stroke="var(--blue)" stroke-width="2"/>
      <circle cx="${cx}" cy="${cy}" r="2.5" fill="var(--text)"/>
    </svg></div>`;
  }

  function renderPlayerCompare() {
    const a = runtime.players[state.compareA], b = runtime.players[state.compareB];
    const hasStats = a?.stats && b?.stats;
    const verdict = hasStats ? (a.stats.rating === b.stats.rating ? 'Dead even' : a.stats.rating > b.stats.rating ? `${esc(a.name)} by ${(a.stats.rating - b.stats.rating).toFixed(2)}` : `${esc(b.name)} by ${(b.stats.rating - a.stats.rating).toFixed(2)}`) : 'Eye test required';
    $('#compare-stage').innerHTML = `${playerCompareCard(a, 'left')}
      ${hasStats ? radarSVG(a, b) : `<div class="radar-wrap"><div class="dr-empty" style="padding:18px"><b style="display:block;font-family:var(--font-head);font-size:20px;color:var(--text);margin-bottom:4px">No radar</b>One or both sides have no published stat set.</div></div>`}
      ${playerCompareCard(b, 'right')}
      <div style="grid-column:1/-1" class="verdict">${verdict}</div>`;
  }

  function teamCompareCard(t, side) {
    if (!t) return '<div class="compare-card"><div class="dr-empty">Pick a team.</div></div>';
    const color = teamColor(t);
    const tr = teamRating(t);
    return `<div class="compare-card" style="--cc:${esc(color)}">
      <div class="cc-head"><div class="cc-photo"><img src="${esc(t.logo)}" alt="" style="object-fit:contain;padding:8px" onerror="this.style.display='none'"></div>
        <div><div class="cc-name">${esc(t.name)}</div><div class="cc-sub">${esc(regionName(t.region))} · ${teamFilled(t)}/${teamSize(t)} starters</div></div>
      </div>
      <div class="cc-body">
        <div class="cc-rating"><b>${tr === null ? '—' : tr.toFixed(2)}</b><span>${tr === null ? 'NO STAT<br>MODEL' : 'AVG<br>RATING'}</span><span style="margin-left:auto;text-align:right">${teamFilled(t)}/${teamSize(t)}<br>starters</span></div>
        <div class="roster-compare">${(t.roster || []).map(pid => {
          const p = player(pid);
          return p ? `<div class="rc-row">${p.photo ? `<img src="${esc(p.photo)}" alt="">` : `<span class="avatar-fallback" style="width:22px;height:22px;font-size:8px;border-radius:4px">${esc(initials(p.name))}</span>`}<span>${esc(p.name)}</span><span class="muted">${p.stats ? p.stats.rating.toFixed(2) : ''}</span></div>` : '';
        }).join('') || '<div class="dr-empty">Empty roster.</div>'}</div>
      </div>
      <div class="verdict">${side === 'left' ? 'Left side' : 'Right side'}</div>
    </div>`;
  }

  function renderTeamCompare() {
    const a = runtime.teams[state.compareA], b = runtime.teams[state.compareB];
    const ra = teamRating(a), rb = teamRating(b);
    const hasRatings = ra !== null && rb !== null;
    const verdict = !hasRatings ? 'No public stat model — compare the eye test' : ra === rb ? 'Dead even' : ra > rb ? `${esc(a.name)} by ${(ra - rb).toFixed(2)} avg rating` : `${esc(b.name)} by ${(rb - ra).toFixed(2)} avg rating`;
    const middle = `<div class="radar-wrap"><div style="width:100%;padding:12px"><div class="eyebrow" style="margin-bottom:10px;text-align:center">ROSTER STRENGTH</div>
      ${hasRatings ? `<div class="stat-bars" style="gap:12px">
        <div class="stat-bar-row"><span>${esc((a?.short || 'LEFT').slice(0, 7))}</span><div class="stat-bar"><i style="width:${Math.min(100, ra * 100)}%;background:var(--accent)"></i></div><b>${ra.toFixed(2)}</b></div>
        <div class="stat-bar-row"><span>${esc((b?.short || 'RIGHT').slice(0, 7))}</span><div class="stat-bar"><i style="width:${Math.min(100, rb * 100)}%;background:var(--blue)"></i></div><b>${rb.toFixed(2)}</b></div>
      </div>` : `<div class="dr-more" style="text-align:center">No published stat set for this circuit. Use the roster lists and circuit results.</div>`}</div></div>`;
    $('#compare-stage').innerHTML = `${teamCompareCard(a, 'left')}${middle}${teamCompareCard(b, 'right')}<div style="grid-column:1/-1" class="verdict">${verdict}</div>`;
  }


  /* ------------------------------------------------------------------ *
   * Data sync (pull buttons — intentionally paused)
   * ------------------------------------------------------------------ */
  const SYNC_META = {
    cdl: { name: 'CDL', kicker: 'CDL', source: 'Breaking Point + COD Esports Wiki', desc: '2027 rosters, staff, stats and headshots', last: 'Nov 18, 2026', color: '#ff5a1f' },
    ch: { name: 'Challengers', kicker: 'CDC', source: 'Liquipedia + COD Esports Wiki', desc: 'Cup 1 rosters, results, logos and region data', last: 'Nov 18, 2026', color: '#38bdf8' },
    wz: { name: 'Warzone', kicker: 'WZ', source: 'Warzone Rostermania', desc: '29 orgs and the 152-player market', last: 'Nov 18, 2026', color: '#f97316' },
    mob: { name: 'Call of Duty Mobile', kicker: 'CODM', source: 'Liquipedia', desc: 'World Championship qualifiers and rosters', last: 'Nov 18, 2026', color: '#a78bfa' },
  };

  function syncCardHTML(league, compact = false) {
    const m = SYNC_META[league];
    if (!m) return '';
    return `<div class="sync-card" data-sync-league="${league}">
      <div class="sync-kicker"><span class="sync-status-dot"></span>${esc(m.kicker)}</div>
      <div class="sync-src">${esc(m.source)}</div>
      <p>${esc(m.desc)}</p>
      ${compact ? '' : `<button class="btn btn-ghost" data-action="pull-league" data-league="${league}">Pull ${esc(m.kicker)} <svg viewBox="0 0 24 24"><path d="M12 3v11M7 9l5 5 5-5M4 19h16"/></svg></button>`}
    </div>`;
  }

  function renderSyncPanel() {
    const el = $('#sync-panel');
    if (!el) return;
    el.innerHTML = `<div class="sync-head">
      <div><span class="eyebrow">DATA SYNC</span><h3>Pull the latest</h3>
      <p>Four independent feeds. Pulls are paused right now — no network request is made until the source cooldown clears.</p></div>
      <span class="sync-pill">PAUSED · RATE LIMIT</span>
    </div>
    <div class="sync-grid">${['cdl', 'ch', 'wz', 'mob'].map(l => syncCardHTML(l, false)).join('')}</div>
    <div class="sync-note">Each esport keeps its own pull. CDL uses Breaking Point + the COD Esports Wiki; Challengers and CODM use Liquipedia; Warzone uses the Warzone Rostermania data set. The buttons are wired but disabled at the network layer.</div>`;
  }

  function openSyncModal() {
    openModal('Data sync', `
      <p class="form-note" style="margin:0 0 10px">Pick an esport to see its source plan. Pull execution is paused until the source cooldown clears — pressing a button here will not make a network request yet.</p>
      <div class="sync-grid" style="grid-template-columns:1fr 1fr">${['cdl', 'ch', 'wz', 'mob'].map(l => syncCardHTML(l)).join('')}</div>
      <div class="data-note"><b>Why paused?</b> Liquipedia blocked this IP after repeated page pulls. The sync jobs are intentionally left in dry-run mode so the UI can be finished without burning more requests.</div>`,
      `<button class="btn btn-ghost" data-action="close-modal">Close</button>`);
  }

  function openPullModal(league) {
    const m = SYNC_META[league];
    if (!m) return;
    openModal(`Pull ${m.name}`, `
      <div class="sync-pull-row">
        <div class="sync-source-icon" style="color:${m.color}">${esc(m.kicker)}</div>
        <div><b>${esc(m.name)}</b><span>${esc(m.source)}</span></div>
        <div class="muted">LAST SYNC<br>${esc(m.last)}</div>
      </div>
      <div class="form-note">This job would refresh: ${esc(m.desc)}. It would write a fresh snapshot into <span class="mono">data.js</span> and never touch your custom teams, custom players, tier lists or uploaded photos.</div>
      <div class="data-note"><b>Status: paused.</b> The source cooldown is still active. The pull button is displayed but disabled at the network layer so a click cannot burn another request. When the cooldown clears, this is the button that will run the import.</div>`,
      `<button class="btn btn-ghost" data-action="close-modal">Cancel</button>
       <button class="btn btn-primary" disabled title="Paused until the source cooldown clears">Pull now</button>`);
  }

  /* ------------------------------------------------------------------ *
   * Intel
   * ------------------------------------------------------------------ */
  function renderIntel() {
    renderSyncPanel();
    const tags = ['All', ...new Set(DATA.intel.map(i => i.tag))];
    $('#intel-grid').innerHTML = `
      <div class="view-actions" style="grid-column:1/-1;justify-content:flex-start;margin-bottom:2px">
        ${tags.map(t => `<button class="seg ${state.intelFilter === t ? 'is-active' : ''}" data-intel-tag="${esc(t)}" style="border:1px solid var(--line)">${esc(t)}</button>`).join('')}
      </div>` + DATA.intel.filter(i => state.intelFilter === 'All' || i.tag === state.intelFilter).map(i => `
        <article class="intel-card">
          <div class="intel-top"><span>${esc(i.date)}</span><span class="tag">${esc(i.tag)}</span><span style="margin-left:auto">${esc(i.source)}</span></div>
          <h3>${esc(i.title)}</h3>
          <p>${esc(i.body)}</p>
          <div class="intel-foot"><span>${esc(i.source)}</span><a href="${i.source === 'Breaking Point' ? 'https://breakingpoint.gg/' : i.source === 'Liquipedia' ? 'https://liquipedia.net/callofduty' : 'https://cod-esports.fandom.com/'}" target="_blank" rel="noopener">Open source ↗</a></div>
        </article>`).join('');
    const counts = {
      cdl: DATA.leagues.cdl.teams.length,
      ch: DATA.leagues.ch.teams.length,
      wz: DATA.leagues.wz.teams.length,
      mob: DATA.leagues.mob.teams.length,
      players: Object.keys(runtime.players).length,
    };
    $('#source-grid').innerHTML = `
      <div class="source-card"><b>Liquipedia</b><span>Challengers Cup 1 rosters, results, logos and CODM Worlds qualifiers.</span><a href="https://liquipedia.net/callofduty" target="_blank" rel="noopener">liquipedia.net/callofduty ↗</a></div>
      <div class="source-card"><b>COD Esports Wiki</b><span>CDL 2027 rosters, staff, team history and accolades. CC BY-SA.</span><a href="https://cod-esports.fandom.com/" target="_blank" rel="noopener">cod-esports.fandom.com ↗</a></div>
      <div class="source-card"><b>Breaking Point</b><span>Roster intel, free agency reporting and the player stat feed used in this build.</span><a href="https://breakingpoint.gg/" target="_blank" rel="noopener">breakingpoint.gg ↗</a></div>
      <div class="source-card"><b>Warzone Rostermania</b><span>29-org Warzone universe and 152-player free agent market.</span><a href="https://www.warzonerostermania.com/" target="_blank" rel="noopener">warzonerostermania.com ↗</a></div>`;
    const note = document.getElementById('data-note');
    if (note) note.innerHTML = `<b>Coverage:</b> ${counts.cdl} CDL teams · ${counts.ch} Challengers teams · ${counts.wz} Warzone orgs · ${counts.mob} CODM Worlds teams · ${counts.players} player records. CDL stats are pulled from Breaking Point /stats for the 2027 MW4 season only. Challengers, Warzone and CODM show no stats because no public stat set exists.`;
  }

  /* ------------------------------------------------------------------ *
   * Ticker
   * ------------------------------------------------------------------ */
  function renderTicker() {
    const items = DATA.intel.slice(0, 8).map(i => `<span class="ticker-item"><span class="tag">${esc(i.tag)}</span><b>${esc(i.title)}</b><span>${esc(i.date)}</span></span>`).join('');
    $('#ticker-track').innerHTML = items + items;
  }

  /* ------------------------------------------------------------------ *
   * Mutations
   * ------------------------------------------------------------------ */
  function setSlot(teamId, kind, index, pid) {
    const team = runtime.teams[teamId];
    if (!team) return;
    const arr = kind === 'bench' ? team.bench : team.roster;
    if (!arr || index < 0 || index >= arr.length) return;
    if (pid) {
      const loc = assignmentOf(pid);
      if (loc && !(loc.team.id === teamId && loc.kind === kind && loc.index === index)) {
        const other = loc.kind === 'bench' ? loc.team.bench : loc.team.roster;
        other[loc.index] = null;
      }
    }
    arr[index] = pid || null;
    state.selectedPlayer = null;
    saveState();
    renderAll();
    if (pid) toast(`${player(pid)?.name || 'Player'} added to ${team.short || team.name}.`, 'good');
  }

  function clearSlot(teamId, kind, index) {
    const team = runtime.teams[teamId];
    if (!team) return;
    const arr = kind === 'bench' ? team.bench : team.roster;
    const pid = arr[index];
    arr[index] = null;
    if (state.selectedPlayer === pid) state.selectedPlayer = null;
    saveState(); renderAll();
    if (pid) toast(`${player(pid)?.name || 'Player'} returned to free agents.`);
  }

  function clearTeam(teamId) {
    const t = runtime.teams[teamId];
    if (!t) return;
    t.roster = Array(teamSize(t)).fill(null);
    t.bench = Array(leagueCfg(t.league).benchSize).fill(null);
    saveState(); renderAll(); closeDrawer();
    toast(`${t.name} cleared.`, 'good');
  }

  function officialTeam(teamId) {
    const t = runtime.teams[teamId];
    if (!t) return;
    if (t.custom) { clearTeam(teamId); return; }
    const original = DATA.teams[teamId];
    if (!original) return;
    runtime.teams[teamId] = clone(original);
    normalizeTeams();
    saveState(); renderAll(); closeDrawer();
    toast(`${t.name} reverted to the official roster.`, 'good');
  }

  function copyText(text) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => toast('Copied to clipboard.', 'good')).catch(() => fallbackCopy(text));
    } else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('Copied to clipboard.', 'good'); } catch (e) { toast('Copy failed — select the text manually.', 'bad'); }
    ta.remove();
  }
  function rosterText(team) {
    const starters = (team.roster || []).filter(Boolean).map(id => player(id)?.name).filter(Boolean);
    const bench = (team.bench || []).filter(Boolean).map(id => player(id)?.name).filter(Boolean);
    return `${team.name}${team.region ? ` (${regionName(team.region)})` : ''}\n${starters.join(' · ') || 'No starters'}${bench.length ? `\nBench: ${bench.join(', ')}` : ''}`;
  }

  /* ------------------------------------------------------------------ *
   * Rendering orchestration
   * ------------------------------------------------------------------ */
  function renderAll() {
    renderHeader();
    renderRegionFilter();
    renderFreeAgents();
    renderBoard();
    if (state.view === 'tiers') renderTiers();
    if (state.view === 'compare') renderCompare();
    if (state.view === 'intel') renderIntel();
    saveState();
  }

  function switchLeague(id) {
    if (!runtime.leagues[id] || id === state.league) return;
    state.league = id;
    state.selectedPlayer = null;
    state.compareA = null; state.compareB = null;
    state.teamSearch = ''; state.teamRegion = ''; state.faSearch = ''; state.faCountry = '';
    $('#fa-search').value = ''; $('#team-search').value = '';
    renderAll();
    closeDrawer();
    hideStats();
  }

  function switchView(view) {
    state.view = view;
    $$('.view').forEach(v => v.classList.toggle('is-active', v.id === `view-${view}`));
    $$('.view-tab').forEach(t => t.classList.toggle('is-active', t.dataset.view === view));
    if (view === 'tiers') renderTiers();
    if (view === 'compare') renderCompare();
    if (view === 'intel') renderIntel();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ------------------------------------------------------------------ *
   * Modals
   * ------------------------------------------------------------------ */
  let modalCloseTimer = null;
  function openModal(title, body, foot, after) {
    if (modalCloseTimer) { clearTimeout(modalCloseTimer); modalCloseTimer = null; }
    $('#modal-title').textContent = title;
    $('#modal-body').innerHTML = body;
    $('#modal-foot').innerHTML = foot;
    $('#modal-scrim').hidden = false;
    $('#modal').hidden = false;
    $('#modal').setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => $('#modal').classList.add('open'));
    document.body.style.overflow = 'hidden';
    after?.();
  }
  function closeModal() {
    $('#modal').classList.remove('open');
    $('#modal').setAttribute('aria-hidden', 'true');
    $('#modal-scrim').hidden = true;
    if (modalCloseTimer) clearTimeout(modalCloseTimer);
    modalCloseTimer = setTimeout(() => { $('#modal').hidden = true; $('#modal-body').innerHTML = ''; modalCloseTimer = null; }, 180);
    if (!$('#drawer').classList.contains('open')) document.body.style.overflow = '';
  }

  const COLOR_SWATCHES = ['#ff5a1f', '#f43f5e', '#e11d48', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#64748b'];

  function pickPlayerPhoto(pid) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) { input.remove(); return; }
      const data = await readImageFile(f, 500);
      input.remove();
      if (!data) { toast('Could not read that image.', 'bad'); return; }
      state.photoOverrides[pid] = data;
      if (runtime.players[pid]) runtime.players[pid].photo = data;
      saveState(); renderAll();
      if ($('#drawer').classList.contains('open')) openPlayer(pid);
      toast('Player photo updated.', 'good');
    };
    document.body.appendChild(input);
    input.click();
  }

  function resetPlayerPhoto(pid) {
    delete state.photoOverrides[pid];
    const base = DATA.players[pid]?.photo || null;
    if (runtime.players[pid]) runtime.players[pid].photo = runtime.players[pid].custom ? null : base;
    saveState(); renderAll();
    if ($('#drawer').classList.contains('open')) openPlayer(pid);
    toast('Photo reset to the default.', 'good');
  }

  function readImageFile(file, max = 420) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          try {
            const scale = Math.min(1, max / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(img.width * scale));
            canvas.height = Math.max(1, Math.round(img.height * scale));
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/png'));
          } catch (e) { resolve(reader.result); }
        };
        img.onerror = () => resolve(reader.result);
        img.src = reader.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  function openAddTeam() {
    const cfg = leagueCfg();
    openModal('Create a custom team', `
      <div class="form-grid">
        <div class="form-field full"><label for="nt-league">League</label>
          <select id="nt-league">${LEAGUE_ORDER.map(l => `<option value="${l}" ${l === state.league ? 'selected' : ''}>${esc(runtime.leagues[l].name)}</option>`).join('')}</select>
        </div>
        <div class="form-field"><label for="nt-name">Team name</label><input id="nt-name" maxlength="40" placeholder="e.g. Midnight Unit"></div>
        <div class="form-field"><label for="nt-short">Abbreviation</label><input id="nt-short" maxlength="6" placeholder="MDN"></div>
        <div class="form-field"><label for="nt-region">Region</label>
          <select id="nt-region"><option value="NA">North America</option><option value="EU">Europe</option><option value="AP">Asia-Pacific</option><option value="LA">Latin America</option><option value="ME">MENA</option><option value="Global">Global</option><option value="China">China</option><option value="SEA">Southeast Asia</option><option value="India">India</option><option value="Japan">Japan</option><option value="Brazil">Brazil</option><option value="Africa">Africa</option></select>
        </div>
        <div class="form-field"><label for="nt-size">Starters</label><select id="nt-size">${[3,4,5,6].map(n => `<option value="${n}" ${n === cfg.teamSize ? 'selected' : ''}>${n} starters${n === cfg.teamSize ? ' (default)' : ''}</option>`).join('')}</select></div>
        <div class="form-field full"><label>Team colour</label><div class="color-row" id="nt-colors">${COLOR_SWATCHES.map((c, i) => `<button type="button" class="color-swatch ${i === 0 ? 'is-active' : ''}" data-color="${c}" style="background:${c}" aria-label="Colour ${c}"></button>`).join('')}</div></div>
        <div class="form-field full"><label>Logo (optional)</label><div class="logo-drop" id="nt-logo-drop">
          <div class="logo-preview" id="nt-logo-preview"><span class="mono" style="color:var(--muted-2)">LOGO</span></div>
          <div class="logo-drop-txt"><b>Upload a crest</b><span>PNG, SVG, WebP or JPG · stored locally in your browser</span></div>
          <input type="file" id="nt-logo" accept="image/*" hidden>
        </div></div>
      </div>
      <div class="form-note">Custom teams live only in this browser. You can add custom players straight into their slots, drag free agents in, and delete the team at any time.</div>
      <div class="form-error" id="nt-error"></div>`, `
      <button class="btn btn-ghost" data-action="close-modal">Cancel</button>
      <button class="btn btn-primary" data-action="create-team">Create team</button>`, () => {
      let color = COLOR_SWATCHES[0];
      let logo = '';
      $('#nt-colors').addEventListener('click', e => {
        const b = e.target.closest('.color-swatch');
        if (!b) return;
        $$('.color-swatch', $('#nt-colors')).forEach(x => x.classList.remove('is-active'));
        b.classList.add('is-active'); color = b.dataset.color;
      });
      $('#nt-logo-drop').addEventListener('click', () => $('#nt-logo').click());
      $('#nt-logo').addEventListener('change', async e => {
        const f = e.target.files?.[0];
        if (!f) return;
        const data = await readImageFile(f, 320);
        if (!data) return;
        logo = data;
        $('#nt-logo-preview').innerHTML = `<img src="${logo}" alt="Logo preview">`;
      });
      $('#nt-logo-drop')._get = () => ({ color, logo });
      window.__ntState = { get color() { return color; }, get logo() { return logo; } };
      $('#nt-name').focus();
    });
  }

  function createTeamFromModal() {
    const league = $('#nt-league').value;
    const name = $('#nt-name').value.trim();
    const short = ($('#nt-short').value.trim() || name.slice(0, 4)).toUpperCase();
    const region = $('#nt-region').value;
    const size = parseInt($('#nt-size').value, 10);
    const color = window.__ntState?.color || COLOR_SWATCHES[0];
    const logo = window.__ntState?.logo || '';
    if (!name) { $('#nt-error').textContent = 'Give the team a name.'; $('#nt-error').classList.add('show'); return; }
    const cfg = runtime.leagues[league];
    const id = `custom-team-${Date.now()}`;
    const team = {
      id, league, name, short, region, color, logo,
      size, roster: Array(size).fill(null), bench: Array(cfg.benchSize).fill(null),
      staff: [], official: false, custom: true, note: 'Your custom team',
    };
    runtime.teams[id] = team;
    cfg.teams.unshift(id);
    if (league !== state.league) { state.league = league; }
    saveState(); closeModal(); renderAll();
    toast(`${name} created. Add players to the open slots.`, 'good');
  }

  function openAddPlayer() {
    const cfg = leagueCfg();
    const teams = currentTeams();
    openModal('Add a player', `
      <div class="form-grid">
        <div class="form-field full"><label for="np-league">League</label>
          <select id="np-league">${LEAGUE_ORDER.map(l => `<option value="${l}" ${l === state.league ? 'selected' : ''}>${esc(runtime.leagues[l].name)}</option>`).join('')}</select>
        </div>
        <div class="form-field"><label for="np-name">Handle</label><input id="np-name" maxlength="30" placeholder="e.g. Nightfall"></div>
        <div class="form-field"><label for="np-country">Country</label><input id="np-country" maxlength="30" placeholder="e.g. United States"></div>
        <div class="form-field"><label for="np-role">Role</label><select id="np-role"><option>Player</option><option>AR</option><option>SMG</option><option>Flex</option><option>Substitute</option><option>Coach</option></select></div>
        <div class="form-field"><label for="np-team">Assign to</label>
          <select id="np-team"><option value="">Free agent pool</option>${teams.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('')}</select>
        </div>
        <div class="form-field full"><label>Photo (optional)</label><div class="logo-drop" id="np-photo-drop">
          <div class="logo-preview" id="np-photo-preview"><span class="mono" style="color:var(--muted-2)">IMG</span></div>
          <div class="logo-drop-txt"><b>Upload a player photo</b><span>Square headshot works best · stored locally</span></div>
          <input type="file" id="np-photo" accept="image/*" hidden>
        </div></div>
      </div>
      <div class="form-note">Custom players appear in the free agent pool and can be dragged into any team in their league. ${cfg.hasFreeAgents ? '' : 'CODM has no free agent pool, so choose a team.'}</div>
      <div class="form-error" id="np-error"></div>`, `
      <button class="btn btn-ghost" data-action="close-modal">Cancel</button>
      <button class="btn btn-primary" data-action="create-player">Add player</button>`, () => {
      let photo = '';
      $('#np-photo-drop').addEventListener('click', () => $('#np-photo').click());
      $('#np-photo').addEventListener('change', async e => {
        const f = e.target.files?.[0];
        if (!f) return;
        const data = await readImageFile(f, 420);
        if (!data) return;
        photo = data;
        $('#np-photo-preview').innerHTML = `<img src="${photo}" alt="Photo preview">`;
      });
      window.__npState = { get photo() { return photo; } };
      $('#np-league').addEventListener('change', e => {
        const lg = e.target.value;
        const cfg = runtime.leagues[lg];
        const opts = [{ id: '', name: cfg.hasFreeAgents ? 'Free agent pool' : 'Select a team (required)' },
          ...cfg.teams.map(id => runtime.teams[id]).filter(Boolean).map(t => ({ id: t.id, name: t.name }))];
        $('#np-team').innerHTML = opts.map(o => `<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('');
      });
      $('#np-name').focus();
    });
  }

  function createPlayerFromModal() {
    const league = $('#np-league').value;
    const name = $('#np-name').value.trim();
    const country = $('#np-country').value.trim();
    const role = $('#np-role').value;
    const teamId = $('#np-team').value;
    const photo = window.__npState?.photo || '';
    if (!name) { $('#np-error').textContent = 'Give the player a handle.'; $('#np-error').classList.add('show'); return; }
    if (league === 'mob' && !teamId) { $('#np-error').textContent = 'CODM has no free agent pool — assign the player to a team.'; $('#np-error').classList.add('show'); return; }
    const id = `custom-player-${Date.now()}`;
    const p = { id, name, country, role, league, photo, custom: true, status: teamId ? 'signed' : 'fa', teamId: teamId || null, stats: null };
    runtime.players[id] = p;
    if (teamId) {
      const team = runtime.teams[teamId];
      if (team) {
        let placed = false;
        for (let i = 0; i < team.roster.length; i++) if (!team.roster[i]) { team.roster[i] = id; placed = true; break; }
        if (!placed) for (let i = 0; i < team.bench.length; i++) if (!team.bench[i]) { team.bench[i] = id; break; }
      }
    }
    if (league !== state.league) state.league = league;
    saveState(); closeModal(); renderAll();
    toast(`${name} added ${teamId ? 'to ' + (runtime.teams[teamId]?.name || 'team') : 'to free agents'}.`, 'good');
  }

  function openPicker(teamId, kind, index) {
    const t = runtime.teams[teamId];
    if (!t) return;
    const fas = getFreeAgents().sort((a, b) => a.name.localeCompare(b.name));
    openModal(`Add to ${t.name}`, `
      <div class="form-field"><input id="picker-search" type="search" placeholder="Search free agents…" aria-label="Search free agents"></div>
      <div class="manage-list" id="picker-list" style="max-height:360px;overflow:auto;margin-top:8px">
        ${fas.length ? fas.map(p => `<button class="manage-row" data-action="picker-add" data-player-id="${esc(p.id)}" data-team-id="${esc(teamId)}" data-slot-kind="${esc(kind)}" data-slot-index="${index}" style="text-align:left;width:100%">
          ${p.photo ? `<img src="${esc(p.photo)}" alt="" onerror="this.style.visibility='hidden'">` : `<span class="avatar-fallback" style="width:24px;height:24px;font-size:9px;border-radius:5px">${esc(initials(p.name))}</span>`}
          <b>${esc(p.name)}</b><span class="muted">${flag(p.country)} ${esc(p.country || '')}${p.stats ? ` · ${p.stats.rating.toFixed(2)}` : ''}</span>
        </button>`).join('') : `<div class="fa-empty">No free agents available.</div>`}
      </div>`, `<button class="btn btn-ghost" data-action="close-modal">Close</button>
      <button class="btn btn-ghost" data-action="add-player">Create player instead</button>`, () => {
      $('#picker-search').addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        $$('#picker-list [data-action="picker-add"]').forEach(b => b.style.display = b.textContent.toLowerCase().includes(q) ? '' : 'none');
      });
    });
  }

  function openTeamPicker() {
    const teams = currentTeams();
    if (!teams.length) return;
    openModal('Find a team', `<p class="form-note" style="margin:0 0 8px">Pick a team to open its roster. Players move with drag &amp; drop.</p>
      <div class="manage-list">${teams.map(t => `<button class="manage-row" data-action="open-team" data-team-id="${esc(t.id)}" style="text-align:left"><img src="${esc(t.logo)}" alt="" onerror="this.style.visibility='hidden'"><b>${esc(t.name)}</b><span class="muted">${teamFilled(t)}/${teamSize(t)}</span></button>`).join('')}</div>`,
      `<button class="btn btn-ghost" data-action="close-modal">Close</button>`);
  }

  function openShare() {
    const c = counts();
    const summary = currentTeams().map(t => `${rosterText(t)}`).join('\n\n');
    openModal('Share this roster', `
      <div class="share-box" id="share-text">${esc(summary)}</div>
      <div class="share-actions">
        <button class="btn btn-primary" data-action="copy-share">Copy text</button>
        <button class="btn btn-ghost" data-action="download-share">Download PNG</button>
        <button class="btn btn-ghost" data-action="download-data">Export JSON</button>
      </div>
      <div class="form-note">${c.teams} teams · ${c.signed}/${c.total} starters locked. The PNG capture uses the current board, so filters and scroll position affect the image.</div>`,
      `<button class="btn btn-ghost" data-action="close-modal">Close</button>`);
  }

  function openManage() {
    const customTeams = Object.values(runtime.teams).filter(t => t.custom);
    const customPlayers = Object.values(runtime.players).filter(p => p.custom);
    openModal('Manage data', `
      <p class="form-note" style="margin:0 0 10px">Everything is stored in this browser. Export before clearing your cache.</p>
      <div class="share-actions" style="margin-top:0">
        <button class="btn btn-ghost" data-action="download-data">Export JSON</button>
        <button class="btn btn-ghost" data-action="import-data">Import JSON</button>
      </div>
      <input type="file" id="import-file" accept="application/json" hidden>
      <div class="dr-section" style="padding:14px 0 0;border:0">
        <h3>Custom teams · ${customTeams.length}</h3>
        <div class="manage-list">${customTeams.length ? customTeams.map(t => `<div class="manage-row"><img src="${esc(t.logo)}" alt="" onerror="this.style.visibility='hidden'"><b>${esc(t.name)}</b><span class="muted">${esc(runtime.leagues[t.league]?.shortName || t.league)} · ${teamFilled(t)}/${teamSize(t)}</span><button data-action="delete-team" data-team-id="${esc(t.id)}">Delete</button></div>`).join('') : '<div class="fa-empty" style="padding:10px">No custom teams yet.</div>'}</div>
      </div>
      <div class="dr-section" style="padding:14px 0 0;border:0">
        <h3>Custom players · ${customPlayers.length}</h3>
        <div class="manage-list">${customPlayers.length ? customPlayers.map(p => `<div class="manage-row"><b>${esc(p.name)}</b><span class="muted">${esc(runtime.leagues[p.league]?.shortName || p.league)}</span></div>`).join('') : '<div class="fa-empty" style="padding:10px">No custom players yet.</div>'}</div>
      </div>
      <div class="dr-section" style="padding:14px 0 0;border:0">
        <h3>Danger zone</h3>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-ghost" data-action="reset-league">Empty ${esc(leagueCfg().shortName)} rosters</button>
          <button class="btn btn-ghost" data-action="reset-all" style="color:var(--red);border-color:var(--red)">Reset all local data</button>
        </div>
      </div>`,
      `<button class="btn btn-ghost" data-action="close-modal">Close</button>`, () => {
      $('#import-file').addEventListener('change', e => {
        const f = e.target.files?.[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const parsed = JSON.parse(reader.result);
            if (parsed.customTeams) (parsed.customTeams || []).forEach(t => { if (t.id && !runtime.teams[t.id]) { runtime.teams[t.id] = t; if (runtime.leagues[t.league]) runtime.leagues[t.league].teams.push(t.id); } });
            if (parsed.customPlayers) (parsed.customPlayers || []).forEach(p => { if (p.id) runtime.players[p.id] = p; });
            if (parsed.rosterOverrides) for (const [id, ov] of Object.entries(parsed.rosterOverrides)) { const t = runtime.teams[id]; if (t) { if (ov.roster) t.roster = ov.roster; if (ov.bench) t.bench = ov.bench; } }
            if (parsed.tiers) state.tiers = parsed.tiers;
            if (parsed.photoOverrides) {
              Object.assign(state.photoOverrides, parsed.photoOverrides);
              for (const [pid, photo] of Object.entries(parsed.photoOverrides)) if (runtime.players[pid] && photo) runtime.players[pid].photo = photo;
            }
            normalizeTeams(); saveState(); closeModal(); renderAll(); toast('Import complete.', 'good');
          } catch (err) { toast('That file is not valid Rostermania JSON.', 'bad'); }
        };
        reader.readAsText(f);
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * Export / share actions
   * ------------------------------------------------------------------ */
  function downloadJSON() {
    const payload = {
      version: 3, exported: new Date().toISOString(), league: state.league,
      customPlayers: Object.values(runtime.players).filter(p => p.custom),
      customTeams: Object.values(runtime.teams).filter(t => t.custom),
      rosterOverrides: Object.fromEntries(Object.values(runtime.teams).filter(t => !t.custom).map(t => [t.id, { roster: t.roster, bench: t.bench }])),
      tiers: state.tiers,
      photoOverrides: state.photoOverrides,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rostermania-${state.league}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function downloadShare() {
    if (typeof html2canvas !== 'function') { toast('Image capture is still loading. Try again in a moment.', 'bad'); return; }
    toast('Rendering share card…');
    const cfg = leagueCfg();
    const teams = currentTeams();
    const card = document.createElement('div');
    card.style.cssText = 'position:fixed;left:-12000px;top:0;width:1320px;background:#090b0e;color:#f3f0e9;padding:42px 44px 32px;font-family:Inter,Arial,sans-serif;box-sizing:border-box;';
    const rows = teams.slice(0, 18).map(t => {
      const names = (t.roster || []).filter(Boolean).map(id => player(id)?.name).filter(Boolean);
      return `<div style="border:1px solid #252c36;border-radius:12px;background:#10141a;padding:12px 14px;display:flex;gap:12px;align-items:flex-start;min-height:88px">
        <div style="width:42px;height:42px;border-radius:9px;background:#171c24;border:1px solid ${t.color || '#ff5a1f'}55;display:flex;align-items:center;justify-content:center;flex:none;overflow:hidden">
          ${t.logo ? `<img src="${t.logo}" style="max-width:34px;max-height:34px;object-fit:contain">` : `<span style="font-family:Arial Black,Arial;font-size:12px;color:#f3f0e9">${esc(t.short || initials(t.name))}</span>`}
        </div>
        <div style="min-width:0">
          <div style="font-family:Arial Black,Arial,sans-serif;font-size:16px;letter-spacing:.4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#f3f0e9">${esc(t.name)}</div>
          <div style="font-family:'Courier New',monospace;font-size:9px;letter-spacing:1px;color:#8c96a5;margin:2px 0 7px">${esc(regionName(t.region)).toUpperCase()} · ${teamFilled(t)}/${teamSize(t)}</div>
          <div style="font-size:11px;line-height:1.55;color:#c8cdd5">${names.length ? names.map(n => esc(n)).join(' · ') : 'No starters yet'}</div>
        </div>
      </div>`;
    }).join('');
    card.innerHTML = `<div style="display:flex;align-items:center;gap:14px;border-bottom:1px solid #252c36;padding-bottom:18px;margin-bottom:20px">
      <div style="width:46px;height:46px;border-radius:11px;background:${cfg.accent};display:flex;align-items:center;justify-content:center;font-family:Arial Black,Arial;color:#0b0b0b;font-size:12px;letter-spacing:.5px">RM</div>
      <div><div style="font-family:Arial Black,Arial,sans-serif;font-size:26px;letter-spacing:1px;line-height:1">ROSTERMANIA<span style="color:${cfg.accent}">.com</span></div>
      <div style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:2px;color:#8c96a5;margin-top:3px">${esc(cfg.name.toUpperCase())} · ${esc(cfg.game.toUpperCase())}</div></div>
      <div style="margin-left:auto;text-align:right;font-family:'Courier New',monospace;font-size:10px;color:#8c96a5;line-height:1.7">${counts().signed}/${counts().total} STARTERS<br>${counts().complete} COMPLETE SQUADS<br>${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}</div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">${rows}</div>
    ${teams.length > 18 ? `<div style="font-family:'Courier New',monospace;font-size:10px;color:#8c96a5;margin-top:12px">+ ${teams.length - 18} more teams on the live board</div>` : ''}
    <div style="display:flex;justify-content:space-between;border-top:1px solid #252c36;margin-top:22px;padding-top:14px;font-family:'Courier New',monospace;font-size:9px;color:#66707e">
      <span>BUILT FOR THE COD COMMUNITY · NOT AFFILIATED WITH ACTIVISION</span><span>@ROSTERMANIAcom</span>
    </div>`;
    document.body.appendChild(card);
    try {
      const canvas = await html2canvas(card, { backgroundColor: '#090b0e', scale: 1.25, useCORS: true, logging: false });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `rostermania-${state.league}.png`;
      a.click();
      toast('Share card downloaded.', 'good');
    } catch (e) {
      toast('Image capture failed in this browser. Copy the roster text instead.', 'bad');
    } finally {
      card.remove();
    }
  }

  /* ------------------------------------------------------------------ *
   * Player picker / team actions
   * ------------------------------------------------------------------ */
  function findTeamForPlayer(pid) {
    const p = player(pid);
    if (!p) return;
    const teams = currentTeams();
    if (!teams.length) return;
    openModal(`Find a team for ${p.name}`, `<div class="manage-list">${teams.map(t => {
      const open = teamFilled(t) < teamSize(t);
      return `<button class="manage-row" data-action="place-player" data-player-id="${esc(pid)}" data-team-id="${esc(t.id)}" style="text-align:left;${open ? '' : 'opacity:.55'}"><img src="${esc(t.logo)}" alt="" onerror="this.style.visibility='hidden'"><b>${esc(t.name)}</b><span class="muted">${teamFilled(t)}/${teamSize(t)}${open ? ' · open slot' : ' · full'}</span></button>`;
    }).join('')}</div>`, `<button class="btn btn-ghost" data-action="close-modal">Cancel</button>`);
  }

  function placePlayerInTeam(pid, teamId) {
    const t = runtime.teams[teamId];
    if (!t) return;
    const open = t.roster.findIndex(x => !x);
    if (open >= 0) { setSlot(teamId, 'roster', open, pid); closeModal(); return; }
    const bench = t.bench.findIndex(x => !x);
    if (bench >= 0) { setSlot(teamId, 'bench', bench, pid); closeModal(); return; }
    toast(`${t.name} is full.`, 'bad');
  }

  /* ------------------------------------------------------------------ *
   * Event wiring
   * ------------------------------------------------------------------ */
  function wire() {
    document.addEventListener('click', e => {
      const actionEl = e.target.closest('[data-action]');
      const leagueEl = e.target.closest('.league-tab');
      const viewEl = e.target.closest('.view-tab');
      const segTier = e.target.closest('.seg[data-tier-type]');
      const segCompare = e.target.closest('.seg[data-compare-type]');
      const intelTag = e.target.closest('[data-intel-tag]');
      const faRow = e.target.closest('.fa-row');
      const slot = e.target.closest('[data-slot-kind]');

      if (leagueEl) { switchLeague(leagueEl.dataset.league); return; }
      if (viewEl) { switchView(viewEl.dataset.view); return; }
      if (segTier) { state.tierType = segTier.dataset.tierType; renderTiers(); return; }
      if (segCompare) { state.compareType = segCompare.dataset.compareType; state.compareA = null; state.compareB = null; renderCompare(); return; }
      if (intelTag) { state.intelFilter = intelTag.dataset.intelTag; renderIntel(); return; }

      if (actionEl) {
        const action = actionEl.dataset.action;
        e.preventDefault();
        switch (action) {
          case 'toggle-theme':
            state.theme = state.theme === 'dark' ? 'light' : 'dark';
            saveState(); renderHeader(); break;
          case 'home': window.scrollTo({ top: 0, behavior: 'smooth' }); break;
          case 'share': openShare(); break;
          case 'open-sync': openSyncModal(); break;
          case 'pull-league': openPullModal(actionEl.dataset.league); break;
          case 'add-team': openAddTeam(); break;
          case 'add-player': closeModal(); openAddPlayer(); break;
          case 'manage': openManage(); break;
          case 'close-modal': closeModal(); break;
          case 'create-team': createTeamFromModal(); break;
          case 'create-player': createPlayerFromModal(); break;
          case 'close-drawer': closeDrawer(); break;
          case 'team-menu': {
            e.stopPropagation();
            const menu = $(`.tc-menu[data-menu-for="${CSS.escape(actionEl.dataset.teamId)}"]`);
            $$('.tc-menu').forEach(m => { if (m !== menu) m.classList.remove('open'); });
            menu?.classList.toggle('open');
            break;
          }
          case 'clear-team':
            if (confirm('Clear this roster? Every player returns to free agents.')) { clearTeam(actionEl.dataset.teamId); closeModal(); }
            break;
          case 'official-team': officialTeam(actionEl.dataset.teamId); break;
          case 'copy-team': { const t = runtime.teams[actionEl.dataset.teamId]; if (t) copyText(rosterText(t)); break; }
          case 'delete-team': {
            const t = runtime.teams[actionEl.dataset.teamId];
            if (!t || !t.custom) break;
            if (!confirm(`Delete ${t.name}? This cannot be undone.`)) break;
            delete runtime.teams[t.id];
            runtime.leagues[t.league].teams = runtime.leagues[t.league].teams.filter(id => id !== t.id);
            saveState(); closeModal(); closeDrawer(); renderAll(); toast(`${t.name} deleted.`);
            break;
          }
          case 'remove-slot': {
            const { teamId, slotKind, slotIndex } = actionEl.dataset;
            e.stopPropagation();
            clearSlot(teamId, slotKind || actionEl.closest('[data-slot-kind]')?.dataset.slotKind, parseInt(slotIndex || actionEl.closest('[data-slot-kind]')?.dataset.slotIndex, 10));
            break;
          }
          case 'player-photo': pickPlayerPhoto(actionEl.dataset.playerId); break;
          case 'player-photo-reset': resetPlayerPhoto(actionEl.dataset.playerId); break;
          case 'drawer-to-fa': {
            const pid = actionEl.dataset.playerId;
            const loc = assignmentOf(pid);
            if (loc) { (loc.kind === 'bench' ? loc.team.bench : loc.team.roster)[loc.index] = null; saveState(); renderAll(); closeDrawer(); toast('Player moved to free agents.'); }
            break;
          }
          case 'drawer-find-team': findTeamForPlayer(actionEl.dataset.playerId); break;
          case 'drawer-compare': state.compareA = actionEl.dataset.playerId; state.compareType = 'players'; state.compareB = null; closeDrawer(); switchView('compare'); break;
          case 'drawer-tier': closeDrawer(); switchView('tiers'); break;
          case 'drawer-compare-team': state.compareA = actionEl.dataset.teamId; state.compareType = 'teams'; state.compareB = null; closeDrawer(); switchView('compare'); break;
          case 'auto-tier': autoTier(); break;
          case 'reset-tiers':
            if (confirm('Reset the tier list for this league?')) { state.tiers[state.league] = {}; saveState(); renderTiers(); }
            break;
          case 'swap-compare': [state.compareA, state.compareB] = [state.compareB, state.compareA]; renderCompare(); break;
          case 'clear-team-filters': state.teamSearch = ''; state.teamRegion = ''; $('#team-search').value = ''; renderRegionFilter(); renderBoard(); break;
          case 'sort-teams': state.teamSort = state.teamSort === 'default' ? 'az' : state.teamSort === 'az' ? 'za' : state.teamSort === 'za' ? 'region' : 'default'; toast(`Team sort: ${state.teamSort}`); renderBoard(); break;
          case 'place-player': placePlayerInTeam(actionEl.dataset.playerId, actionEl.dataset.teamId); break;
          case 'picker-add': {
            const playerId = actionEl.dataset.playerId;
            setSlot(actionEl.dataset.teamId, actionEl.dataset.slotKind, parseInt(actionEl.dataset.slotIndex, 10), playerId);
            closeModal();
            break;
          }
          case 'copy-share': copyText($('#share-text')?.textContent || ''); break;
          case 'download-share': downloadShare(); break;
          case 'download-data': downloadJSON(); break;
          case 'import-data': $('#import-file')?.click(); break;
          case 'reset-league':
            if (confirm(`Empty every ${leagueCfg().shortName} roster? Players return to free agents. Custom teams and players are kept.`)) {
              currentTeams().forEach(t => {
                t.roster = Array(teamSize(t)).fill(null);
                t.bench = Array(leagueCfg(t.league).benchSize).fill(null);
              });
              saveState(); closeModal(); closeDrawer(); renderAll(); toast(`${leagueCfg().shortName} rosters emptied.`, 'good');
            }
            break;
          case 'reset-all':
            if (confirm('Reset every roster, custom team, tier list and player stored in this browser?')) {
              localStorage.removeItem(STORE_KEY); location.reload();
            }
            break;
          case 'open-team': closeModal(); openTeam(actionEl.dataset.teamId); break;
          case 'add-player-to-team': closeModal(); openAddPlayer(); break;
          default: break;
        }
        return;
      }

      if (faRow) {
        const pid = faRow.dataset.playerId;
        if (state.selectedPlayer === pid) state.selectedPlayer = null;
        else state.selectedPlayer = pid;
        renderFreeAgents();
        return;
      }

      if (slot) {
        const { teamId, slotKind, slotIndex } = slot.dataset;
        if (state.selectedPlayer) {
          setSlot(teamId, slotKind, parseInt(slotIndex, 10), state.selectedPlayer);
          return;
        }
        if (slot.dataset.playerId) {
          openPlayer(slot.dataset.playerId);
        } else {
          openPicker(teamId, slotKind, parseInt(slotIndex, 10));
        }
        return;
      }

      // team title/logo click opens team drawer
      const crest = e.target.closest('.tc-crest');
      if (crest) { openTeam(crest.closest('.team-card').dataset.teamId); return; }

      // close menus when clicking elsewhere
      if (!e.target.closest('.tc-menu-btn') && !e.target.closest('.tc-menu')) $$('.tc-menu').forEach(m => m.classList.remove('open'));
    });

    // Search / filters
    $('#fa-search').addEventListener('input', e => { state.faSearch = e.target.value; renderFreeAgents(); });
    $('#fa-country').addEventListener('change', e => { state.faCountry = e.target.value; renderFreeAgents(); });
    $('#fa-sort').addEventListener('change', e => { state.faSort = e.target.value; renderFreeAgents(); });
    $('#fa-include-ch').addEventListener('change', e => { state.includeCh = e.target.checked; renderFreeAgents(); });
    $('#team-search').addEventListener('input', e => { state.teamSearch = e.target.value; renderBoard(); });
    $('#team-region').addEventListener('change', e => { state.teamRegion = e.target.value; renderBoard(); });
    $('#tier-search')?.addEventListener('input', e => { state.tierSearch = e.target.value; renderTiers(); });

    // hover stats
    document.addEventListener('mouseover', e => {
      const el = e.target.closest('[data-hover-player]');
      if (!el || el.contains(e.relatedTarget)) return;
      clearTimeout(popTimer);
      popTimer = setTimeout(() => showStats(el.dataset.hoverPlayer, el), 130);
    });
    document.addEventListener('mouseout', e => {
      const el = e.target.closest('[data-hover-player]');
      if (!el || el.contains(e.relatedTarget)) return;
      clearTimeout(popTimer);
      hideStats();
    });

    // drag & drop: free agent rows and slots
    document.addEventListener('dragstart', e => {
      const row = e.target.closest('.fa-row');
      const slot = e.target.closest('.slot[draggable="true"]');
      const chip = e.target.closest('.tier-chip');
      if (row) {
        e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'fa', pid: row.dataset.playerId }));
        e.dataTransfer.effectAllowed = 'move';
        row.classList.add('is-dragging');
        hideStats();
      } else if (slot) {
        e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'slot', teamId: slot.dataset.teamId, slotKind: slot.dataset.slotKind, slotIndex: +slot.dataset.slotIndex, pid: slot.dataset.playerId }));
        e.dataTransfer.effectAllowed = 'move';
        slot.classList.add('is-dragging');
        hideStats();
      } else if (chip) {
        e.dataTransfer.setData('text/plain', JSON.stringify({ kind: 'tier', id: chip.dataset.tierId, type: chip.dataset.tierType }));
        e.dataTransfer.effectAllowed = 'move';
        chip.classList.add('is-dragging');
      }
    });
    document.addEventListener('dragend', e => {
      $$('.is-dragging').forEach(x => x.classList.remove('is-dragging'));
      $$('.is-drop').forEach(x => x.classList.remove('is-drop'));
      $$('.drop-active').forEach(x => x.classList.remove('drop-active'));
    });
    document.addEventListener('dragover', e => {
      const slot = e.target.closest('[data-slot-kind]');
      const card = e.target.closest('.team-card');
      const tierDrop = e.target.closest('[data-tier-drop]');
      const palette = e.target.closest('#tier-palette');
      const rail = e.target.closest('#fa-rail');
      if (slot || card || tierDrop || palette || rail) e.preventDefault();
      if (slot) slot.classList.add('is-drop');
      if (card) card.classList.add('is-drop');
      if (tierDrop || palette) (tierDrop || palette).classList.add('drop-active');
      if (rail) rail.classList.add('drop-active');
    });
    document.addEventListener('dragleave', e => {
      const slot = e.target.closest('[data-slot-kind]');
      const card = e.target.closest('.team-card');
      const tierDrop = e.target.closest('[data-tier-drop]');
      const palette = e.target.closest('#tier-palette');
      const rail = e.target.closest('#fa-rail');
      if (slot) slot.classList.remove('is-drop');
      if (card) card.classList.remove('is-drop');
      if (tierDrop || palette) (tierDrop || palette).classList.remove('drop-active');
      if (rail) rail.classList.remove('drop-active');
    });
    document.addEventListener('drop', e => {
      const slot = e.target.closest('[data-slot-kind]');
      const tierDrop = e.target.closest('[data-tier-drop]');
      const palette = e.target.closest('#tier-palette');
      const rail = e.target.closest('#fa-rail');
      let data = null;
      try { data = JSON.parse(e.dataTransfer.getData('text/plain')); } catch (err) {}
      e.preventDefault();
      if (!data) return;
      if (slot) {
        const { teamId, slotKind, slotIndex } = slot.dataset;
        if (data.kind === 'fa') setSlot(teamId, slotKind, +slotIndex, data.pid);
        else if (data.kind === 'slot') {
          if (data.teamId === teamId && data.slotKind === slotKind && +data.slotIndex === +slotIndex) return;
          const srcTeam = runtime.teams[data.teamId];
          const dstTeam = runtime.teams[teamId];
          const srcArr = data.slotKind === 'bench' ? srcTeam.bench : srcTeam.roster;
          const dstArr = slotKind === 'bench' ? dstTeam.bench : dstTeam.roster;
          const srcPid = srcArr[+data.slotIndex];
          const dstPid = dstArr[+slotIndex];
          srcArr[+data.slotIndex] = dstPid || null;
          dstArr[+slotIndex] = srcPid || null;
          saveState(); renderAll();
        }
        return;
      }
      if (tierDrop && data.kind !== 'slot') {
        const type = data.kind === 'tier' ? data.type : state.tierType;
        rankItem(type, data.kind === 'fa' ? data.pid : data.id, tierDrop.dataset.tierDrop);
        return;
      }
      if (palette && data.kind === 'tier') { rankItem(data.type, data.id, 'unranked'); return; }
      if (rail && data.kind === 'slot') {
        const t = runtime.teams[data.teamId];
        const arr = data.slotKind === 'bench' ? t.bench : t.roster;
        const pid = arr[+data.slotIndex];
        arr[+data.slotIndex] = null;
        saveState(); renderAll();
        if (pid) toast(`${player(pid)?.name || 'Player'} moved to free agents.`);
      }
    });

    // keyboard
    document.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('button, input, select, textarea')) {
        const faRow = e.target.closest('.fa-row');
        const slot = e.target.closest('.slot, .bench-slot');
        if (faRow) { e.preventDefault(); faRow.click(); return; }
        if (slot) { e.preventDefault(); slot.click(); return; }
      }
      if (e.key === 'Escape') {
        if (!$('#modal').hidden) closeModal();
        else if ($('#drawer').classList.contains('open')) closeDrawer();
        else if (state.selectedPlayer) { state.selectedPlayer = null; renderFreeAgents(); }
        else $$('.tc-menu').forEach(m => m.classList.remove('open'));
        hideStats();
      }
      if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement?.tagName)) {
        if (leagueCfg().hasFreeAgents) { e.preventDefault(); $('#fa-search').focus(); }
      }
    });

    $('#drawer-scrim').addEventListener('click', closeDrawer);
    $('#modal-scrim').addEventListener('click', closeModal);

    // Tier drop zone click-to-unrank
    document.addEventListener('click', e => {
      const chip = e.target.closest('.tier-chip');
      if (chip && e.altKey) { rankItem(chip.dataset.tierType, chip.dataset.tierId, 'unranked'); }
    }, true);
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */
  hydrate();
  wire();
  renderTicker();
  renderSyncPanel();
  renderAll();
  renderIntel();
  ensureCompare();
  // Deep link: #league=ch&view=tiers
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (params.get('league') && runtime.leagues[params.get('league')]) state.league = params.get('league');
  if (params.get('theme') === 'light' || params.get('theme') === 'dark') state.theme = params.get('theme');
  if (params.get('view')) switchView(params.get('view'));
  renderAll();
  if (params.get('player') && runtime.players[params.get('player')]) openPlayer(params.get('player'));
  if (params.get('team') && runtime.teams[params.get('team')]) openTeam(params.get('team'));
})();