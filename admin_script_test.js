// ── CONFIG ──────────────────────────────────────────────────
const SUPABASE_URL      = 'https://dpelurhaljmnogdxqpoj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZWx1cmhhbGptbm9nZHhxcG9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTE4MzksImV4cCI6MjA4OTc2NzgzOX0.cvWry3iR8MZg7zV6ewKyw8YIOxIUCaV3gUBZlPsykNM';
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── STATE ───────────────────────────────────────────────────
let adminProfile = null;
let allSeasons = [], allLeagues = [], allClubs = [], allMakers = [], allKitTypes = [];
let selSeason = null, selLeague = null, selClub = null, p2Mode = 'leagues';
let allUsers = [], allComments = [], blogTagsList = [];
let editKitId = null, editMenuId = null, editTypeId = null, editBlogId = null, editPageId = null;
let selectedKits = new Set();
let menuDragId = null, secDragId = null;
let siteUrlVal = 'yoursite.com';

// ── LOGIN ────────────────────────────────────────────────────
async function doLogin() {
  const email = document.getElementById('l-email').value.trim();
  const pass  = document.getElementById('l-pass').value;
  const errEl = document.getElementById('lerr');
  const btn   = document.getElementById('lbtn');
  errEl.style.display = 'none';
  if (!email || !pass) { errEl.textContent = 'Enter email and password.'; errEl.style.display = 'block'; return; }
  btn.textContent = 'Signing in…'; btn.disabled = true;
  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  btn.textContent = 'Sign In to Admin'; btn.disabled = false;
  if (error) { errEl.textContent = error.message; errEl.style.display = 'block'; return; }
  const { data: p } = await sb.from('profiles').select('*').eq('id', data.user.id).single();
  if (!p || p.role !== 'admin') {
    await sb.auth.signOut();
    errEl.textContent = 'Access denied. Admins only.';
    errEl.style.display = 'block';
    return;
  }
  adminProfile = p;
  showApp();
}

async function checkSession() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  const { data: p } = await sb.from('profiles').select('*').eq('id', user.id).single();
  if (p && p.role === 'admin') { adminProfile = p; showApp(); }
}

async function doSignOut() { await sb.auth.signOut(); location.reload(); }

async function showApp() {
  document.getElementById('ls').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('tb-user').innerHTML = '<i class="fa-solid fa-gear"></i> ' + adminProfile.username;
  await loadMaster();
  renderP1();
}

// ── MASTER DATA ──────────────────────────────────────────────
async function loadMaster() {
  const [s, l, c, kt, ss] = await Promise.all([
    sb.from('seasons').select('*').order('year_start', { ascending: false }),
    sb.from('leagues').select('*').order('name'),
    sb.from('clubs').select('*').order('name'),
    sb.from('kit_types').select('*').order('sort_order'),
    sb.from('site_settings').select('key,value'),
  ]);
  allSeasons  = s.data  || [];
  allLeagues  = l.data  || [];
  allClubs    = c.data  || [];
  allKitTypes = kt.data || [];

  if (ss.data) {
    const cfg = Object.fromEntries(ss.data.map(r => [r.key, r.value]));
    if (cfg.site_url) siteUrlVal = cfg.site_url.replace(/https?:\/\//, '');
  }

  // Fetch all unique teams, leagues, seasons, and makers from the kits table to sync with admin lists
  const { data: kitsData } = await sb.from('kits').select('team, league, season, maker');
  const kits = kitsData || [];

  // 1. Sync Seasons
  const kitSeasons = [...new Set(kits.map(k => k.season).filter(Boolean))];
  const missingSeasons = kitSeasons.filter(ks => !allSeasons.some(s => s.name === ks));
  if (missingSeasons.length > 0) {
    const newSeasons = missingSeasons.map(name => {
      const parts = name.split('/');
      const ys = parseInt(parts[0]) || new Date().getFullYear();
      const ye = parts[1] ? (parts[1].length === 2 ? parseInt(parts[0].substring(0, 2) + parts[1]) : parseInt(parts[1])) : ys + 1;
      return { name: name.trim(), year_start: ys, year_end: ye };
    });
    const { data: insertedSeasons } = await sb.from('seasons').insert(newSeasons).select('*');
    if (insertedSeasons) {
      allSeasons.push(...insertedSeasons);
      allSeasons.sort((a, b) => b.year_start - a.year_start);
    }
  }

  // 2. Sync Leagues
  const kitLeagues = [...new Set(kits.map(k => k.league).filter(Boolean))];
  const missingLeagues = kitLeagues.filter(kl => !allLeagues.some(l => l.name === kl));
  if (missingLeagues.length > 0) {
    const newLeagues = missingLeagues.map(name => ({ name: name.trim(), country: null }));
    const { data: insertedLeagues } = await sb.from('leagues').insert(newLeagues).select('*');
    if (insertedLeagues) {
      allLeagues.push(...insertedLeagues);
      allLeagues.sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  // 3. Sync Clubs (Teams)
  // Re-build a map of league names to IDs to link clubs properly
  const leagueNameToId = Object.fromEntries(allLeagues.map(l => [l.name, l.id]));
  const missingClubs = [];

  // Unique team/league combinations
  const teamMap = new Map();
  kits.forEach(k => {
    if (!k.team) return;
    if (!teamMap.has(k.team)) teamMap.set(k.team, k.league);
  });

  for (const [teamName, leagueName] of teamMap.entries()) {
    if (!allClubs.some(c => c.name === teamName)) {
      missingClubs.push({
        name: teamName.trim(),
        league_id: leagueNameToId[leagueName] || null
      });
    }
  }

  if (missingClubs.length > 0) {
    const { data: insertedClubs } = await sb.from('clubs').insert(missingClubs).select('*');
    if (insertedClubs) {
      allClubs.push(...insertedClubs);
      allClubs.sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  // 4. Sync Makers
  const dbMakers = [...new Set(kits.map(k => k.maker).filter(Boolean))];
  const defMakers = ['Adidas','Nike','Puma','Umbro','Kappa','Hummel','New Balance','Under Armour','Joma','Macron','Castore','Errea'];
  allMakers = [...new Set([...dbMakers, ...defMakers])].sort();

  // populate type dropdown
  const sel = document.getElementById('kf-type');
  sel.innerHTML = allKitTypes.map(t => `<option>${t.name}</option>`).join('');
}

// ── VIEW SWITCHER ────────────────────────────────────────────
function sv(v, btn) {
  document.getElementById('view-kits').style.display = 'none';
  document.querySelectorAll('.fp').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.ln').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (v === 'kits') {
    document.getElementById('view-kits').style.display = 'flex';
  } else {
    const el = document.getElementById('view-' + v);
    if (el) el.classList.add('active');
  }
  const loaders = {
    submissions: loadSubmissions,
    blog: loadBlog, pages: loadPages,
    types: loadTypes, kotw: loadKotw,
    comments: loadComments, badges: loadBadges,
    seo: loadSEO, ads: loadAds,
    users: loadUsers, admins: loadAdmins,
    settings: loadSettings, dash: loadDash,
  };
  if (loaders[v]) loaders[v]();
}

// ── PANE 1 — SEASONS ────────────────────────────────────────
function renderP1() {
  const q = document.getElementById('p1q').value.toLowerCase();
  const f = allSeasons.filter(s => s.name.toLowerCase().includes(q));
  document.getElementById('p1list').innerHTML = f.length
    ? f.map(s => `<div class="ti ${selSeason?.id === s.id ? 'active' : ''}" onclick="selectSeason('${s.id}')"><span class="ti-ic"><i class="fa-regular fa-calendar"></i></span>${s.name}</div>`).join('')
    : '<div class="empty"><p style="font-size:.8rem">No seasons</p></div>';
}

async function selectSeason(id) {
  selSeason = allSeasons.find(s => s.id === id);
  selLeague = null; selClub = null; p2Mode = 'leagues';
  renderP1(); renderP2Leagues();
  document.getElementById('p3').innerHTML = '<div class="empty" style="margin-top:5rem"><div class="empty-i"><i class="fa-solid fa-trophy"></i></div><p style="font-size:.85rem">Select a league</p></div>';
}

async function promptAddSeason() {
  const name = prompt('Season (e.g. 2025/26):');
  if (!name) return;
  const parts = name.split('/');
  const ys = parseInt(parts[0]);
  const ye = parts[1] ? (parts[1].length === 2 ? parseInt(parts[0].substring(0, 2) + parts[1]) : parseInt(parts[1])) : ys + 1;
  const { error } = await sb.from('seasons').insert({ name: name.trim(), year_start: ys, year_end: ye });
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  toast('Season added!'); await loadMaster(); renderP1();
}

// ── PANE 2 — LEAGUES / CLUBS ─────────────────────────────────
function renderP2() { p2Mode === 'leagues' ? renderP2Leagues() : renderP2Clubs(); }

function renderP2Leagues() {
  p2Mode = 'leagues';
  document.getElementById('p2head').innerHTML = `LEAGUE <button class="ph-add" onclick="promptAddLeague()">+</button>`;
  document.getElementById('p2q').placeholder = 'Search league…';
  const q = document.getElementById('p2q').value.toLowerCase();
  const f = allLeagues.filter(l => l.name.toLowerCase().includes(q));
  document.getElementById('p2list').innerHTML = f.map(l => {
    const cc = allClubs.filter(c => c.league_id === l.id).length;
    return `<div class="ti ${selLeague?.id === l.id ? 'active' : ''}" onclick="selectLeague('${l.id}')">
      <span class="ti-ic"><i class="fa-solid fa-trophy"></i></span>
      <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l.name}</span>
      <span class="ti-ct">${cc}</span>
    </div>`;
  }).join('') || '<div class="empty"><p>No leagues</p></div>';
}

async function selectLeague(id) {
  selLeague = allLeagues.find(l => l.id === id);
  selClub = null;
  renderP2Clubs();
  document.getElementById('p3').innerHTML = '<div class="empty" style="margin-top:5rem"><div class="empty-i"><i class="fa-solid fa-futbol"></i></div><p style="font-size:.85rem">Select a club</p></div>';
}

function renderP2Clubs() {
  p2Mode = 'clubs';
  document.getElementById('p2head').innerHTML =
    `<span style="cursor:pointer;color:var(--w3);font-size:.75rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px" onclick="selLeague=null;selClub=null;renderP2Leagues()">← ${selLeague?.name || ''}</span>
     <button class="ph-add" onclick="promptAddClub()">+</button>`;
  document.getElementById('p2q').placeholder = 'Search club…';
  const q = document.getElementById('p2q').value.toLowerCase();
  const clubs = allClubs.filter(c => c.league_id === selLeague?.id && c.name.toLowerCase().includes(q));
  document.getElementById('p2list').innerHTML = clubs.length
    ? clubs.map(c => `<div class="ti ${selClub?.id === c.id ? 'active' : ''}" onclick="selectClub('${c.id}')">
        <span class="ti-ic"><i class="fa-solid fa-futbol"></i></span>
        <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.name}</span>
      </div>`).join('')
    : '<div class="empty"><p style="font-size:.8rem">No clubs — click + to add</p></div>';
}

async function selectClub(id) { selClub = allClubs.find(c => c.id === id); renderP2Clubs(); loadP3(); }
async function promptAddLeague() {
  const name = prompt('League name:'); if (!name) return;
  const country = prompt('Country:');
  const { error } = await sb.from('leagues').insert({ name: name.trim(), country: country || null });
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  toast('League added!'); await loadMaster(); renderP2Leagues();
}
async function promptAddClub() {
  const name = prompt('Club name:'); if (!name) return;
  const { error } = await sb.from('clubs').insert({ name: name.trim(), league_id: selLeague?.id || null });
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  toast('Club added!'); await loadMaster(); if (selLeague) renderP2Clubs();
}

// ── PANE 3 — KIT VIEW ───────────────────────────────────────
async function loadP3() {
  if (!selSeason || !selClub) return;
  const p3 = document.getElementById('p3');
  p3.innerHTML = '<div class="spinner"></div>';
  const { data: kits } = await sb.from('kits_with_stats').select('*')
    .eq('team', selClub.name).eq('season', selSeason.name).order('type');
  selectedKits.clear();

  const typeMap = Object.fromEntries(allKitTypes.map(t => [t.name, t]));

  p3.innerHTML = `
    <div class="p3h">
      <div>
        <div class="p3t">${selClub.name} <span>${selSeason.name}</span></div>
        <div class="p3s">${selLeague?.name || ''} · ${(kits || []).length} kit${(kits || []).length !== 1 ? 's' : ''}</div>
      </div>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap">
        <button class="btn btn-g btn-sm" onclick="copyToSeason()">⊕ Copy to Season</button>
        <button class="btn btn-p btn-sm" onclick="openKitForm(null,'${selClub.name.replace(/'/g,"\\'")}','${selSeason.name}','${(selLeague?.name || '').replace(/'/g,"\\'")}')">+ Add Kit</button>
      </div>
    </div>
    <div class="p3-body">
      <div class="bulk-bar" id="bulk-bar">
        <span style="font-size:.82rem;font-weight:600;color:var(--g)" id="bulk-count">0 selected</span>
        <button class="btn btn-p btn-sm" onclick="bulkPublish(true)"><i class="fa-solid fa-check"></i> Publish</button>
        <button class="btn btn-g btn-sm" onclick="bulkPublish(false)"><i class="fa-solid fa-xmark"></i> Unpublish</button>
        <button class="btn btn-r btn-sm" onclick="bulkDelete()">🗑 Delete</button>
      </div>
      ${(kits || []).length ? `
      <table>
        <thead><tr>
          <th><input type="checkbox" class="cb" onchange="selectAllKits(this)" title="All"/></th>
          <th>Img</th><th>Type</th><th>Maker</th><th>Status</th><th>Featured</th><th>Contributor</th><th>Actions</th>
        </tr></thead>
        <tbody>${(kits || []).map(k => {
          const typ = typeMap[k.type];
          const bs = typ ? `background:${typ.bg_color};color:${typ.color};border-color:${typ.color}40` : '';
          return `<tr id="kr-${k.id}">
            <td><input type="checkbox" class="cb kit-cb" data-id="${k.id}" onchange="toggleKitSel('${k.id}',this.checked)"/></td>
            <td><div class="tdi">${k.image_url ? `<img src="${k.image_url}" onerror="this.style.display='none'"/>` : '<i class="fa-solid fa-shirt"></i>'}</div></td>
            <td><span class="badge" style="${bs}">${k.type}</span></td>
            <td style="color:var(--w3);font-size:.78rem">${k.maker || '—'}</td>
            <td><span class="badge ${k.is_published ? 'pub-y' : 'pub-n'}">${k.is_published ? 'Live' : 'Draft'}</span></td>
            <td style="text-align:center">${k.is_featured ? '<i class="fa-solid fa-star" style="color:var(--gold)"></i>' : '—'}</td>
            <td style="font-size:.72rem;color:var(--w3)">${k.submitted_by ? `<i class="fa-solid fa-user"></i> ${k.is_verified ? '<i class="fa-solid fa-check-circle" style="color:#00C853"></i>' : '<i class="fa-solid fa-hourglass-half"></i>'}` : '<span style="color:var(--g)">Admin <i class="fa-solid fa-check"></i></span>'}</td>
            <td><div style="display:flex;gap:.3rem;flex-wrap:wrap">
              <button class="btn-ed" onclick='openKitForm(${JSON.stringify(k).replace(/'/g, "&#39;")})'>Edit</button>
              <button class="btn-ed" style="color:${k.is_published ? 'var(--red)' : 'var(--g)'}" onclick="quickPub('${k.id}',${!k.is_published})">${k.is_published ? 'Unpub' : 'Pub'}</button>
              <button class="btn-del" onclick="delKit('${k.id}','${k.team.replace(/'/g, "\\'")}')">Del</button>
            </div></td>
          </tr>`;
        }).join('')}</tbody>
      </table>` : '<div class="empty"><div class="empty-i"><i class="fa-solid fa-shirt"></i></div><p>No kits yet — click + Add Kit</p></div>'}
    </div>`;
}

function toggleKitSel(id, checked) { if (checked) selectedKits.add(id); else selectedKits.delete(id); updateBulkBar(); }
function selectAllKits(cb) { document.querySelectorAll('.kit-cb').forEach(c => { c.checked = cb.checked; toggleKitSel(c.dataset.id, cb.checked); }); }
function updateBulkBar() {
  const bar = document.getElementById('bulk-bar');
  const cnt = document.getElementById('bulk-count');
  if (bar) bar.classList.toggle('show', selectedKits.size > 0);
  if (cnt) cnt.textContent = `${selectedKits.size} selected`;
}
async function bulkPublish(pub) {
  if (!selectedKits.size) return;
  for (const id of selectedKits) await sb.from('kits').update({ is_published: pub }).eq('id', id);
  toast(`${selectedKits.size} kits ${pub ? 'published' : 'unpublished'}!`); loadP3();
}
async function bulkDelete() {
  if (!selectedKits.size) return;
  if (!confirm(`Delete ${selectedKits.size} kits?`)) return;
  for (const id of selectedKits) await sb.from('kits').delete().eq('id', id);
  toast(`${selectedKits.size} kits deleted`); loadP3();
}
async function quickPub(id, pub) {
  await sb.from('kits').update({ is_published: pub }).eq('id', id);
  toast(pub ? 'Published!' : 'Unpublished!'); loadP3();
}
async function copyToSeason() {
  const target = prompt(`Copy all kits from ${selSeason.name} to season (e.g. 2025/26):`);
  if (!target) return;
  const { data: kits } = await sb.from('kits').select('*').eq('team', selClub.name).eq('season', selSeason.name);
  if (!kits?.length) { toast('No kits to copy', 'err'); return; }
  let count = 0;
  for (const k of kits) {
    const newSlug = (k.slug || k.team.toLowerCase().replace(/\s+/g, '-')) + '-' + target.replace('/', '-') + '-' + Date.now();
    const { error } = await sb.from('kits').insert({
      ...k, id: undefined, season: target, slug: newSlug,
      is_published: false, views: 0, created_at: undefined, updated_at: undefined
    });
    if (!error) count++;
  }
  toast(`${count} kits copied to ${target}!`);
}

// ── KIT FORM ────────────────────────────────────────────────
function openKitForm(kit, preTeam = '', preSeason = '', preLeague = '', preType = 'Home') {
  editKitId = kit?.id || null;
  document.getElementById('kft').innerHTML = kit ? 'EDIT <span>KIT</span>' : 'ADD <span>KIT</span>';
  const f = kit || {};
  const sel = document.getElementById('kf-type');
  sel.innerHTML = allKitTypes.map(t => `<option value="${t.name}" ${(f.type || preType) === t.name ? 'selected' : ''}>${t.name}</option>`).join('');
  document.getElementById('kf-team').value     = f.team || preTeam || selClub?.name || '';
  document.getElementById('kf-season').value   = f.season || preSeason || selSeason?.name || '';
  document.getElementById('kf-league').value   = f.league || preLeague || selLeague?.name || '';
  document.getElementById('kf-maker').value    = f.maker || '';
  document.getElementById('kf-color').value    = f.color || '';
  document.getElementById('kf-price').value    = f.price_label || '';
  document.getElementById('kf-buy').value      = f.buy_url || '';
  document.getElementById('kf-buylabel').value = f.buy_label || 'Buy Now';
  document.getElementById('kf-slug').value     = f.slug || '';
  document.getElementById('kf-img').value      = f.image_url || '';
  document.getElementById('kf-img2').value     = f.image_url_2 || '';
  document.getElementById('kf-img3').value     = f.image_url_3 || '';
  document.getElementById('kf-desc').value     = f.description || '';
  document.getElementById('kf-seot').value     = f.seo_title || '';
  document.getElementById('kf-seod').value     = f.seo_description || '';
  document.getElementById('kf-pub').checked    = f.is_published !== false;
  document.getElementById('kf-feat').checked   = !!f.is_featured;
  document.getElementById('kf-id').value       = f.id || '';
  prevImg(); if (!kit) setTimeout(autoSlug, 50);
  document.getElementById('kit-ov').classList.add('open');
}
function closeKitForm() { document.getElementById('kit-ov').classList.remove('open'); }
function prevImg() {
  const u = document.getElementById('kf-img').value.trim();
  const b = document.getElementById('ip');
  b.innerHTML = u ? `<img src="${u}" onerror="this.parentElement.innerHTML='<i class=\\'fa-solid fa-camera\\'></i>'"/>` : '<i class="fa-solid fa-camera"></i>';
}
function autoSlug() {
  if (editKitId) return;
  const t  = document.getElementById('kf-team').value.trim();
  const s  = document.getElementById('kf-season').value.trim();
  const tp = document.getElementById('kf-type').value.toLowerCase().replace(/\s+/g, '-');
  if (t && s) document.getElementById('kf-slug').value = (t + '-' + tp + '-' + s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
document.getElementById('kf-team').addEventListener('input', () => { autoSlug(); autoFill(); });
document.getElementById('kf-season').addEventListener('input', autoSlug);

async function saveKit() {
  const team   = document.getElementById('kf-team').value.trim();
  const season = document.getElementById('kf-season').value.trim();
  let slug     = document.getElementById('kf-slug').value.trim().toLowerCase().replace(/\s+/g, '-');
  if (!team || !season) { toast('Team and Season required', 'err'); return; }
  if (!slug) { autoSlug(); slug = document.getElementById('kf-slug').value.trim(); }

  const type = document.getElementById('kf-type').value;
  let dupQuery = sb.from('kits').select('id').eq('team', team).eq('season', season).eq('type', type);
  if (editKitId) dupQuery = dupQuery.neq('id', editKitId);
  const { data: dups, error: dupErr } = await dupQuery;
  if (dupErr) { toast('Error checking duplicates: ' + dupErr.message, 'err'); return; }
  if (dups && dups.length > 0) {
    toast(`A ${type} kit for ${team} in ${season} already exists.`, 'err');
    return;
  }

  const payload = {
    team, season, slug,
    league:          document.getElementById('kf-league').value.trim() || null,
    type:            document.getElementById('kf-type').value,
    maker:           document.getElementById('kf-maker').value.trim() || null,
    color:           document.getElementById('kf-color').value.trim() || null,
    price_label:     document.getElementById('kf-price').value.trim() || null,
    buy_url:         document.getElementById('kf-buy').value.trim() || null,
    buy_label:       document.getElementById('kf-buylabel').value.trim() || 'Buy Now',
    image_url:       document.getElementById('kf-img').value.trim() || null,
    image_url_2:     document.getElementById('kf-img2').value.trim() || null,
    image_url_3:     document.getElementById('kf-img3').value.trim() || null,
    description:     document.getElementById('kf-desc').value.trim() || null,
    seo_title:       document.getElementById('kf-seot').value.trim() || null,
    seo_description: document.getElementById('kf-seod').value.trim() || null,
    is_published:    document.getElementById('kf-pub').checked,
    is_featured:     document.getElementById('kf-feat').checked,
    is_verified:     true,
    updated_at:      new Date().toISOString(),
  };
  let error;
  if (editKitId) { ({ error } = await sb.from('kits').update(payload).eq('id', editKitId)); }
  else           { ({ error } = await sb.from('kits').insert(payload)); }
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  const maker = payload.maker;
  if (maker && !allMakers.includes(maker)) { allMakers.push(maker); allMakers.sort(); }
  toast(editKitId ? 'Kit updated!' : 'Kit added!');
  closeKitForm(); if (selClub && selSeason) loadP3();
}
async function delKit(id, name) {
  if (!confirm(`Delete "${name}"?`)) return;
  const { error } = await sb.from('kits').delete().eq('id', id);
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  toast('Deleted'); if (selClub && selSeason) loadP3();
}

// ── AUTOCOMPLETE ────────────────────────────────────────────
const acSources = {
  team:   () => allClubs.map(c => c.name),
  season: () => allSeasons.map(s => s.name),
  league: () => allLeagues.map(l => l.name),
  maker:  () => allMakers,
};
function acIn(key) {
  const inp   = document.getElementById('kf-' + key);
  const list  = document.getElementById('acl-' + key);
  const q     = inp.value.toLowerCase();
  const src   = acSources[key] ? acSources[key]() : [];
  const matches = src.filter(v => v.toLowerCase().includes(q)).slice(0, 10);
  const exact   = src.find(v => v.toLowerCase() === q);
  if (!matches.length && !q) { list.classList.remove('open'); return; }
  list.innerHTML = matches.map(v =>
    `<div class="aci" onmousedown="acSet('${key}','${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')">  ${v}</div>`
  ).join('') + (q && !exact ? `<div class="aci aci-new" onmousedown="acSet('${key}','${inp.value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')">+ Use "${inp.value}"</div>` : '');
  list.classList.add('open');
}
function acSet(key, val) { document.getElementById('kf-' + key).value = val; acClose(key); if (key === 'team') autoFill(); setTimeout(autoSlug, 30); }
function acClose(key) { const el = document.getElementById('acl-' + key); if (el) el.classList.remove('open'); }
function autoFill() {
  const name = document.getElementById('kf-team').value.trim();
  const club = allClubs.find(c => c.name.toLowerCase() === name.toLowerCase());
  if (club?.league_id) {
    const lg = allLeagues.find(l => l.id === club.league_id);
    if (lg && !document.getElementById('kf-league').value) document.getElementById('kf-league').value = lg.name;
  }
}
async function acKotw() {
  const q = document.getElementById('kotw-kit').value.toLowerCase();
  const { data } = await sb.from('kits').select('slug,team,season,type').ilike('team', '%' + q + '%').limit(8);
  const list = document.getElementById('acl-kotw');
  list.innerHTML = (data || []).map(k =>
    `<div class="aci" onmousedown="document.getElementById('kotw-kit').value='${k.slug}';document.getElementById('acl-kotw').classList.remove('open')">${k.team} ${k.season} ${k.type}</div>`
  ).join('');
  list.classList.add('open');
}

// ── USER SUBMISSIONS ─────────────────────────────────────────
async function loadSubmissions() {
  const statusFilter = document.getElementById('sub-filter').value;
  let query = sb.from('kit_submissions').select('*,profiles(username)').order('created_at', { ascending: false });
  if (statusFilter) query = query.eq('status', statusFilter);
  const { data } = await query;
  const statusClass = { pending: 'pend', approved: 'pub-y', rejected: 'pub-n' };
  document.getElementById('sub-tbody').innerHTML = (data || []).map(s => `<tr>
    <td style="font-weight:600">${s.team}</td>
    <td style="font-family:var(--fm);font-size:.75rem;color:var(--g)">${s.season}</td>
    <td><span class="badge ${s.type === 'Home' ? 'bh' : s.type === 'Away' ? 'ba' : 'bt'}">${s.type}</span></td>
    <td style="font-size:.78rem;color:var(--w3)">${s.profiles?.username || '—'}</td>
    <td style="font-size:.72rem;color:var(--w4)">${new Date(s.created_at).toLocaleDateString('en-GB')}</td>
    <td><span class="badge ${statusClass[s.status] || 'pub-n'}">${s.status}</span></td>
    <td><div style="display:flex;gap:.35rem">
      <button class="btn-ed" onclick="reviewSubmission('${s.id}')">Review</button>
      ${s.status === 'pending' ? `<button class="btn-app" onclick="approveSubmission('${s.id}')"><i class="fa-solid fa-check"></i> Approve</button><button class="btn-rej" onclick="rejectSubmission('${s.id}')"><i class="fa-solid fa-xmark"></i> Reject</button>` : ''}
    </div></td>
  </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--w4)">No submissions.</td></tr>';
}

async function reviewSubmission(id) {
  const { data: s } = await sb.from('kit_submissions').select('*,profiles(username)').eq('id', id).single();
  if (!s) return;
  document.getElementById('sub-detail').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:1rem">
      ${s.image_url ? `<div style="grid-column:1/-1"><img src="${s.image_url}" style="max-height:200px;object-fit:contain;border-radius:10px;background:var(--s2);padding:.5rem"/></div>` : ''}
      ${[['Team',s.team],['Season',s.season],['League',s.league||'—'],['Type',s.type],['Maker',s.maker||'—'],['Color',s.color||'—'],['Price',s.price_label||'—'],['Submitted by',s.profiles?.username||'—']].map(([k,v])=>
        `<div style="background:var(--s2);border-radius:8px;padding:.75rem"><div style="font-size:.6rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--w4);margin-bottom:.2rem">${k}</div><div style="font-size:.875rem">${v}</div></div>`
      ).join('')}
      ${s.description ? `<div style="grid-column:1/-1;background:var(--s2);border-radius:8px;padding:.75rem"><div style="font-size:.6rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--w4);margin-bottom:.3rem">Description</div><div style="font-size:.875rem;color:var(--w3)">${s.description}</div></div>` : ''}
    </div>`;
  const actEl = document.getElementById('sub-actions');
  actEl.innerHTML = s.status === 'pending'
    ? `<button class="btn btn-g" onclick="document.getElementById('sub-ov').classList.remove('open')">Close</button>
       <button class="btn btn-r" onclick="rejectSubmission('${id}');document.getElementById('sub-ov').classList.remove('open')"><i class="fa-solid fa-xmark"></i> Reject</button>
       <button class="btn btn-p" onclick="approveSubmission('${id}');document.getElementById('sub-ov').classList.remove('open')"><i class="fa-solid fa-check"></i> Approve & Publish</button>`
    : `<button class="btn btn-g" onclick="document.getElementById('sub-ov').classList.remove('open')">Close</button>`;
  document.getElementById('sub-ov').classList.add('open');
}

async function approveSubmission(id) {
  const { data: s } = await sb.from('kit_submissions').select('*').eq('id', id).single();
  if (!s) return;
  // generate slug
  const slug = (s.team + '-' + s.type + '-' + s.season).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now();
  // create kit
  const { data: kit, error } = await sb.from('kits').insert({
    team: s.team, season: s.season, slug, league: s.league, type: s.type,
    maker: s.maker, color: s.color, description: s.description,
    image_url: s.image_url, image_url_2: s.image_url_2, image_url_3: s.image_url_3,
    price_label: s.price_label, buy_url: s.buy_url,
    submitted_by: s.user_id, is_verified: true, is_published: true,
    submission_id: s.id,
  }).select().single();
  if (error) { toast('Error creating kit: ' + error.message, 'err'); return; }
  // update submission
  await sb.from('kit_submissions').update({
    status: 'approved', reviewed_by: adminProfile.id,
    reviewed_at: new Date().toISOString(), kit_id: kit.id,
  }).eq('id', id);
  // award points + check badges
  try {
    await sb.rpc('award_points', { p_user_id: s.user_id, p_points: 50, p_reason: 'Kit approved: ' + s.team + ' ' + s.season });
    await sb.rpc('check_badges', { p_user_id: s.user_id });
  } catch {}
  toast('Kit approved and published! +50 pts awarded to user.');
  loadSubmissions();
}

async function rejectSubmission(id) {
  const reason = prompt('Rejection reason (optional):') || '';
  await sb.from('kit_submissions').update({
    status: 'rejected', reviewed_by: adminProfile.id,
    reviewed_at: new Date().toISOString(), rejection_reason: reason,
  }).eq('id', id);
  toast('Submission rejected.'); loadSubmissions();
}

// ── KIT TYPES ────────────────────────────────────────────────
async function loadTypes() {
  const { data } = await sb.from('kit_types').select('*').order('sort_order');
  document.getElementById('types-tb').innerHTML = (data || []).map(t => `<tr>
    <td style="font-weight:600">${t.name}</td>
    <td><span class="badge" style="background:${t.bg_color};color:${t.color};border-color:${t.color}40">${t.name}</span></td>
    <td><span class="badge ${t.is_active ? 'pub-y' : 'pub-n'}">${t.is_active ? 'Active' : 'Hidden'}</span></td>
    <td><div style="display:flex;gap:.35rem">
      <button class="btn-ed" onclick="openTypeForm(${JSON.stringify(t).replace(/"/g, '&quot;')})">Edit</button>
      <button class="btn-del" onclick="delType('${t.id}','${t.name.replace(/'/g, "\\'")}')">Del</button>
    </div></td>
  </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--w4)">No types.</td></tr>';
}

function openTypeForm(type) {
  editTypeId = type?.id || null;
  document.getElementById('tft').innerHTML = type ? 'EDIT KIT <span>TYPE</span>' : 'ADD KIT <span>TYPE</span>';
  document.getElementById('tf-name').value   = type?.name || '';
  document.getElementById('tf-color').value  = type?.color || '#00C853';
  document.getElementById('tf-bg').value     = type?.bg_color || '#0a1f0a';
  document.getElementById('tf-active').checked = type?.is_active !== false;
  document.getElementById('tf-id').value     = type?.id || '';
  updateTypePrev();
  document.getElementById('type-ov').classList.add('open');
}
function closeTypeForm() { document.getElementById('type-ov').classList.remove('open'); }
function updateTypePrev() {
  const n  = document.getElementById('tf-name').value  || 'New Type';
  const c  = document.getElementById('tf-color').value;
  const bg = document.getElementById('tf-bg').value;
  const el = document.getElementById('tf-prev');
  el.textContent = n;
  el.style.cssText = `background:${bg};color:${c};border-color:${c}40`;
}

async function saveKitType() {
  const name = document.getElementById('tf-name').value.trim();
  if (!name) { toast('Name required', 'err'); return; }
  const payload = {
    name,
    color:     document.getElementById('tf-color').value,
    bg_color:  document.getElementById('tf-bg').value,
    is_active: document.getElementById('tf-active').checked,
  };
  const id = document.getElementById('tf-id').value;
  let error;
  if (id) {
    ({ error } = await sb.from('kit_types').update(payload).eq('id', id));
  } else {
    const { data: ex } = await sb.from('kit_types').select('sort_order').order('sort_order', { ascending: false }).limit(1);
    ({ error } = await sb.from('kit_types').insert({ ...payload, sort_order: (ex?.[0]?.sort_order || 0) + 1 }));
  }
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  toast('Kit type saved!'); closeTypeForm(); await loadMaster(); loadTypes();
}
async function delType(id, name) {
  if (!confirm(`Delete type "${name}"?`)) return;
  await sb.from('kit_types').delete().eq('id', id);
  toast('Deleted'); await loadMaster(); loadTypes();
}

// ── KIT OF THE WEEK ──────────────────────────────────────────
async function loadKotw() {
  const { data } = await sb.from('kit_of_week').select('*,kits(team,season,type)').order('created_at', { ascending: false });
  document.getElementById('kotw-tb').innerHTML = (data || []).map(k => `<tr>
    <td style="font-weight:600">${k.kits?.team || '—'} <span style="color:var(--w4)">${k.kits?.season || ''} ${k.kits?.type || ''}</span></td>
    <td style="font-size:.78rem;color:var(--w3)">${k.week_start} → ${k.week_end}</td>
    <td style="font-family:var(--fm);font-size:.8rem;color:var(--gold)"><i class="fa-solid fa-star"></i> ${k.votes}</td>
    <td><span class="badge ${k.is_active ? 'pub-y' : 'pub-n'}">${k.is_active ? 'Active' : 'Ended'}</span></td>
    <td><button class="btn-del" onclick="delKotw('${k.id}')">Del</button></td>
  </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--w4)">No Kit of the Week set.</td></tr>';
}

function openKotwForm() {
  const today = new Date().toISOString().split('T')[0];
  const end   = new Date(Date.now() + 6 * 86400000).toISOString().split('T')[0];
  document.getElementById('kotw-start').value  = today;
  document.getElementById('kotw-end').value    = end;
  document.getElementById('kotw-kit').value    = '';
  document.getElementById('kotw-active').checked = true;
  document.getElementById('kotw-ov').classList.add('open');
}

async function saveKotw() {
  const slug = document.getElementById('kotw-kit').value.trim();
  if (!slug) { toast('Enter a kit slug', 'err'); return; }
  const { data: kit } = await sb.from('kits').select('id').eq('slug', slug).single();
  if (!kit) { toast('Kit not found', 'err'); return; }
  await sb.from('kit_of_week').update({ is_active: false }).eq('is_active', true);
  const { error } = await sb.from('kit_of_week').insert({
    kit_id: kit.id,
    week_start:  document.getElementById('kotw-start').value,
    week_end:    document.getElementById('kotw-end').value,
    is_active:   document.getElementById('kotw-active').checked,
  });
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  toast('Kit of the Week set!');
  document.getElementById('kotw-ov').classList.remove('open');
  loadKotw();
}
async function delKotw(id) {
  if (!confirm('Delete this?')) return;
  await sb.from('kit_of_week').delete().eq('id', id);
  toast('Deleted'); loadKotw();
}

// ── COMMENTS ─────────────────────────────────────────────────
async function loadComments() {
  const { data } = await sb.from('comments').select('*,profiles(username),kits(team,season,slug)').order('created_at', { ascending: false }).limit(100);
  allComments = data || [];
  renderComments(allComments);
}
function filterComments() {
  const q = document.getElementById('comment-q').value.toLowerCase();
  renderComments(q ? allComments.filter(c => [c.content, c.profiles?.username, c.kits?.team].join(' ').toLowerCase().includes(q)) : allComments);
}
function renderComments(comments) {
  document.getElementById('comments-tb').innerHTML = comments.map(c => `<tr>
    <td style="font-weight:500;font-size:.8rem">${c.profiles?.username || '—'}</td>
    <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.8rem;color:var(--w3)">${c.content}</td>
    <td style="font-size:.78rem;color:var(--w3)">${c.kits?.team || '—'} ${c.kits?.season || ''}</td>
    <td style="font-size:.72rem;color:var(--w4)">${new Date(c.created_at).toLocaleDateString('en-GB')}</td>
    <td><span class="badge ${c.is_approved ? 'pub-y' : 'pub-n'}">${c.is_approved ? 'Approved' : 'Hidden'}</span></td>
    <td><div style="display:flex;gap:.35rem">
      <button class="btn-ed" onclick="toggleComment('${c.id}',${!c.is_approved})">${c.is_approved ? 'Hide' : 'Show'}</button>
      <button class="btn-del" onclick="delComment('${c.id}')">Del</button>
    </div></td>
  </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--w4)">No comments.</td></tr>';
}
async function toggleComment(id, approved) { await sb.from('comments').update({ is_approved: approved }).eq('id', id); toast(approved ? 'Approved' : 'Hidden'); loadComments(); }
async function delComment(id) { if (!confirm('Delete this comment?')) return; await sb.from('comments').delete().eq('id', id); toast('Deleted'); loadComments(); }

// ── BADGES ───────────────────────────────────────────────────
async function loadBadges() {
  const { data: badges } = await sb.from('badges').select('*').order('condition_value');
  const { data: ub }     = await sb.from('user_badges').select('badge_id');
  const earnCounts = {};
  (ub || []).forEach(u => earnCounts[u.badge_id] = (earnCounts[u.badge_id] || 0) + 1);
  document.getElementById('badges-tb').innerHTML = (badges || []).map(b => `<tr>
    <td><span style="font-size:1.2rem">${b.icon}</span> <span style="font-weight:600;font-size:.85rem">${b.name}</span><div style="font-size:.72rem;color:var(--w4)">${b.description || ''}</div></td>
    <td style="font-size:.78rem;color:var(--w3)">${b.condition_type.replace(/_/g, ' ')} ≥ ${b.condition_value}</td>
    <td style="font-family:var(--fm);font-size:.8rem;color:var(--gold)">+${b.reward_points} pts</td>
    <td style="font-family:var(--fm);font-size:.78rem;color:var(--g)">${earnCounts[b.id] || 0}</td>
    <td><div style="display:flex;gap:.35rem">
      <button class="btn-ed" onclick="openBadgeForm(${JSON.stringify(b).replace(/"/g, '&quot;')})">Edit</button>
      <button class="btn-del" onclick="delBadge('${b.id}','${b.name.replace(/'/g, "\\'")}')">Del</button>
    </div></td>
  </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--w4)">No badges.</td></tr>';
}

function openBadgeForm(badge) {
  const b = badge || {};
  let ov = document.getElementById('badge-ov');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'badge-ov';
    ov.className = 'ov';
    ov.onclick = e => { if (e.target === ov) ov.classList.remove('open'); };
    document.body.appendChild(ov);
  }
  ov.innerHTML = `
    <div class="mbox" style="max-width:500px">
      <div class="mh"><div class="mt">${b.id ? 'EDIT' : 'ADD'} <span>BADGE</span></div><button class="mc" onclick="document.getElementById('badge-ov').classList.remove('open')"><i class="fa-solid fa-xmark"></i></button></div>
      <div class="mb">
        <div style="display:flex;flex-direction:column;gap:.875rem">
          <div class="field"><label>Icon (emoji)</label><input id="bad-icon" value="${(b.icon || '<i class=\'fa-solid fa-star\'></i>').replace(/"/g, '&quot;')}"/></div>
          <div class="field"><label>Name *</label><input id="bad-name" value="${b.name || ''}"/></div>
          <div class="field"><label>Description</label><input id="bad-desc" value="${b.description || ''}"/></div>
          <div class="field"><label>Condition Type</label>
            <select id="bad-ctype">
              <option value="ratings_count"     ${b.condition_type === 'ratings_count'     ? 'selected' : ''}>Ratings Count</option>
              <option value="collection_count"  ${b.condition_type === 'collection_count'  ? 'selected' : ''}>Collection Count</option>
              <option value="comments_count"    ${b.condition_type === 'comments_count'    ? 'selected' : ''}>Comments Count</option>
              <option value="follows_count"     ${b.condition_type === 'follows_count'     ? 'selected' : ''}>Club Follows</option>
              <option value="submissions_count" ${b.condition_type === 'submissions_count' ? 'selected' : ''}>Submissions Count</option>
              <option value="approved_count"    ${b.condition_type === 'approved_count'    ? 'selected' : ''}>Approved Submissions</option>
              <option value="manual"            ${b.condition_type === 'manual'            ? 'selected' : ''}>Manual (admin grants)</option>
            </select>
          </div>
          <div class="field"><label>Condition Value</label><input id="bad-cval" type="number" value="${b.condition_value || 1}"/></div>
          <div class="field"><label>Reward Points</label><input id="bad-pts" type="number" value="${b.reward_points || 0}"/></div>
          <input type="hidden" id="bad-id" value="${b.id || ''}"/>
        </div>
      </div>
      <div class="mf"><button class="btn btn-g" onclick="document.getElementById('badge-ov').classList.remove('open')">Cancel</button><button class="btn btn-p" onclick="saveBadge()">Save Badge</button></div>
    </div>`;
  ov.classList.add('open');
}

async function saveBadge() {
  const payload = {
    icon:            document.getElementById('bad-icon').value,
    name:            document.getElementById('bad-name').value.trim(),
    description:     document.getElementById('bad-desc').value.trim() || null,
    condition_type:  document.getElementById('bad-ctype').value,
    condition_value: parseInt(document.getElementById('bad-cval').value) || 1,
    reward_points:   parseInt(document.getElementById('bad-pts').value) || 0,
  };
  if (!payload.name) { toast('Name required', 'err'); return; }
  const id = document.getElementById('bad-id').value;
  let error;
  if (id) {
    ({ error } = await sb.from('badges').update(payload).eq('id', id));
  } else {
    const key = payload.name.toLowerCase().replace(/\s+/g, '_');
    ({ error } = await sb.from('badges').insert({ ...payload, key }));
  }
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  toast('Badge saved!');
  document.getElementById('badge-ov').classList.remove('open');
  loadBadges();
}
async function delBadge(id, name) { if (!confirm(`Delete badge "${name}"?`)) return; await sb.from('badges').delete().eq('id', id); toast('Deleted'); loadBadges(); }

// ── BLOG ─────────────────────────────────────────────────────
async function loadBlog() {
  const { data } = await sb.from('blog_posts').select('*').order('created_at', { ascending: false });
  document.getElementById('blog-tb').innerHTML = (data || []).map(p => `<tr>
    <td style="font-weight:600;max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.title}</td>
    <td><span class="badge ${p.is_published ? 'pub-y' : 'pub-n'}">${p.is_published ? 'Live' : 'Draft'}</span></td>
    <td style="font-size:.75rem;color:var(--w4)">${p.published_at ? new Date(p.published_at).toLocaleDateString('en-GB') : '—'}</td>
    <td style="font-size:.72rem;color:var(--w3)">${(p.tags || []).slice(0, 3).join(', ') || '—'}</td>
    <td><div style="display:flex;gap:.35rem">
      <button class="btn-ed" onclick="openBlogForm(${JSON.stringify(p).replace(/"/g, '&quot;')})">Edit</button>
      <button class="btn-del" onclick="delBlog('${p.id}','${p.title.replace(/'/g, "\\'")}')">Del</button>
    </div></td>
  </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--w4)">No posts.</td></tr>';
}

function openBlogForm(post) {
  const p = post || {};
  editBlogId = p.id || null;
  document.getElementById('bft').innerHTML = p.id ? 'EDIT <span>POST</span>' : 'NEW <span>POST</span>';
  document.getElementById('bf-title').value    = p.title || '';
  document.getElementById('bf-slug').value     = p.slug || '';
  document.getElementById('bf-cover').value    = p.cover_image || '';
  document.getElementById('bf-excerpt').value  = p.excerpt || '';
  document.getElementById('bf-seot').value     = p.seo_title || '';
  document.getElementById('bf-seod').value     = p.seo_description || '';
  document.getElementById('bf-og').value       = p.og_image || '';
  document.getElementById('bf-pub').checked    = !!p.is_published;
  document.getElementById('bf-id').value       = p.id || '';
  document.getElementById('blog-editor').innerHTML = p.content || '';
  blogTagsList = p.tags || [];
  renderBlogTags();
  document.getElementById('blog-ov').classList.add('open');
}
function closeBlogForm() { document.getElementById('blog-ov').classList.remove('open'); }

function autoBlogSlug() {
  if (editBlogId) return;
  const t = document.getElementById('bf-title').value.trim();
  if (t) document.getElementById('bf-slug').value = t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function handleTag(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const v = e.target.value.trim().replace(',', '');
    if (v && !blogTagsList.includes(v)) { blogTagsList.push(v); renderBlogTags(); }
    e.target.value = '';
  }
}
function removeTag(tag) { blogTagsList = blogTagsList.filter(t => t !== tag); renderBlogTags(); }
function renderBlogTags() {
  const wrap = document.getElementById('tags-wrap');
  const inp  = document.getElementById('tags-in');
  wrap.innerHTML = '';
  blogTagsList.forEach(t => {
    const span = document.createElement('span');
    span.className = 'tag';
    span.innerHTML = `${t}<button onclick="removeTag('${t}')"><i class="fa-solid fa-xmark"></i></button>`;
    wrap.appendChild(span);
  });
  wrap.appendChild(inp);
}

async function saveBlog() {
  const title = document.getElementById('bf-title').value.trim();
  const slug  = document.getElementById('bf-slug').value.trim();
  if (!title || !slug) { toast('Title and Slug required', 'err'); return; }
  const pub = document.getElementById('bf-pub').checked;
  const payload = {
    title, slug,
    cover_image:     document.getElementById('bf-cover').value.trim() || null,
    excerpt:         document.getElementById('bf-excerpt').value.trim() || null,
    content:         document.getElementById('blog-editor').innerHTML,
    seo_title:       document.getElementById('bf-seot').value.trim() || null,
    seo_description: document.getElementById('bf-seod').value.trim() || null,
    og_image:        document.getElementById('bf-og').value.trim() || null,
    is_published:    pub,
    published_at:    pub ? new Date().toISOString() : null,
    tags:            blogTagsList,
    updated_at:      new Date().toISOString(),
    author_id:       adminProfile.id,
  };
  let error;
  if (editBlogId) { ({ error } = await sb.from('blog_posts').update(payload).eq('id', editBlogId)); }
  else            { ({ error } = await sb.from('blog_posts').insert(payload)); }
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  toast(editBlogId ? 'Post updated!' : 'Post published!');
  closeBlogForm(); loadBlog();
}
async function delBlog(id, title) { if (!confirm(`Delete "${title}"?`)) return; await sb.from('blog_posts').delete().eq('id', id); toast('Deleted'); loadBlog(); }

// ── EDITOR COMMANDS ──────────────────────────────────────────
function ec(cmd) {
  document.getElementById('blog-editor').focus();
  const cmds = {
    bold:  () => document.execCommand('bold'),
    italic: () => document.execCommand('italic'),
    strike: () => document.execCommand('strikeThrough'),
    h1: () => document.execCommand('formatBlock', false, 'h1'),
    h2: () => document.execCommand('formatBlock', false, 'h2'),
    h3: () => document.execCommand('formatBlock', false, 'h3'),
    ul: () => document.execCommand('insertUnorderedList'),
    ol: () => document.execCommand('insertOrderedList'),
    quote: () => document.execCommand('formatBlock', false, 'blockquote'),
    link: () => { const u = prompt('URL:'); if (u) document.execCommand('createLink', false, u); },
    undo: () => document.execCommand('undo'),
    redo: () => document.execCommand('redo'),
  };
  if (cmds[cmd]) cmds[cmd]();
}
function pec(cmd) { document.getElementById('page-editor').focus(); ec(cmd); }
function edImg(editorId) {
  const u = prompt('Image URL:');
  if (u) { document.getElementById(editorId).focus(); document.execCommand('insertHTML', false, `<img src="${u}" style="max-width:100%;border-radius:8px;margin:1rem 0"/>`); }
}
function edVideo(editorId) {
  const u = prompt('YouTube URL:');
  if (!u) return;
  const eu = u.includes('watch?v=') ? u.replace('watch?v=', 'embed/')
    : u.includes('youtu.be/') ? 'https://www.youtube.com/embed/' + u.split('youtu.be/')[1] : u;
  document.getElementById(editorId).focus();
  document.execCommand('insertHTML', false, `<iframe src="${eu}" width="100%" height="400" frameborder="0" allowfullscreen style="border-radius:8px;margin:1rem 0"></iframe>`);
}

// ── PAGES ────────────────────────────────────────────────────
async function loadPages() {
  const { data } = await sb.from('pages').select('*').order('sort_order');
  document.getElementById('pages-tb').innerHTML = (data || []).map(p => `<tr>
    <td style="font-weight:600">${p.title}</td>
    <td style="font-family:var(--fm);font-size:.72rem;color:var(--g)">${p.slug}</td>
    <td style="text-align:center">${p.show_in_footer ? '<i class="fa-solid fa-check"></i>' : '—'}</td>
    <td style="text-align:center">${p.show_in_nav ? '<i class="fa-solid fa-check"></i>' : '—'}</td>
    <td><span class="badge ${p.is_published ? 'pub-y' : 'pub-n'}">${p.is_published ? 'Live' : 'Draft'}</span></td>
    <td><div style="display:flex;gap:.35rem">
      <button class="btn-ed" onclick="openPageForm(${JSON.stringify(p).replace(/"/g, '&quot;')})">Edit</button>
      <button class="btn-del" onclick="delPage('${p.id}','${p.title.replace(/'/g, "\\'")}')">Del</button>
      <a href="/page.html?slug=${p.slug}" target="_blank" class="btn-ed">↗</a>
    </div></td>
  </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--w4)">No pages.</td></tr>';
}

function openPageForm(page) {
  const p = page || {};
  editPageId = p.id || null;
  document.getElementById('pft').innerHTML = p.id ? 'EDIT <span>PAGE</span>' : 'NEW <span>PAGE</span>';
  document.getElementById('pf-title').value   = p.title || '';
  document.getElementById('pf-slug').value    = p.slug || '';
  document.getElementById('pf-seot').value    = p.seo_title || '';
  document.getElementById('pf-seod').value    = p.seo_description || '';
  document.getElementById('pf-pub').checked   = p.is_published !== false;
  document.getElementById('pf-footer').checked = p.show_in_footer !== false;
  document.getElementById('pf-nav').checked   = !!p.show_in_nav;
  document.getElementById('pf-id').value      = p.id || '';
  document.getElementById('page-editor').innerHTML = p.content || '';
  document.getElementById('page-ov').classList.add('open');
}
function closePageForm() { document.getElementById('page-ov').classList.remove('open'); }
function autoPageSlug() {
  if (editPageId) return;
  const t = document.getElementById('pf-title').value.trim();
  if (t) document.getElementById('pf-slug').value = t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function savePage() {
  const title = document.getElementById('pf-title').value.trim();
  const slug  = document.getElementById('pf-slug').value.trim();
  if (!title || !slug) { toast('Title and Slug required', 'err'); return; }
  const payload = {
    title, slug,
    content:         document.getElementById('page-editor').innerHTML,
    seo_title:       document.getElementById('pf-seot').value.trim() || null,
    seo_description: document.getElementById('pf-seod').value.trim() || null,
    is_published:    document.getElementById('pf-pub').checked,
    show_in_footer:  document.getElementById('pf-footer').checked,
    show_in_nav:     document.getElementById('pf-nav').checked,
    updated_at:      new Date().toISOString(),
  };
  let error;
  if (editPageId) { ({ error } = await sb.from('pages').update(payload).eq('id', editPageId)); }
  else            { ({ error } = await sb.from('pages').insert(payload)); }
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  toast(editPageId ? 'Page updated!' : 'Page created!');
  closePageForm(); loadPages();
}
async function delPage(id, title) { if (!confirm(`Delete "${title}"?`)) return; await sb.from('pages').delete().eq('id', id); toast('Deleted'); loadPages(); }

// ── SEO ──────────────────────────────────────────────────────
async function loadSEO() {
  const { data } = await sb.from('site_settings').select('*');
  if (!data) return;
  const s = Object.fromEntries(data.map(r => [r.key, r.value]));
  document.getElementById('seo-title').value  = s.global_seo_title || '';
  document.getElementById('seo-desc').value   = s.global_seo_desc  || '';
  document.getElementById('seo-og').value     = s.global_og_image  || '';
  document.getElementById('seo-ga').value     = s.google_analytics_id || '';
  document.getElementById('seo-head').value   = s.custom_head_code || '';
  document.getElementById('seo-body').value   = s.custom_body_code || '';
  document.getElementById('seo-robots').value = s.robots_txt || 'User-agent: *\nAllow: /';
  if (s.site_url) siteUrlVal = s.site_url.replace(/https?:\/\//, '');
  updateSeoPreview();
}
function updateSeoPreview() {
  document.getElementById('sp-url').textContent = siteUrlVal;
  document.getElementById('sp-t').textContent   = document.getElementById('seo-title').value || 'KitDB';
  document.getElementById('sp-d').textContent   = document.getElementById('seo-desc').value  || 'Description preview';
}
async function saveSEO() {
  for (const [key, id] of [['global_seo_title','seo-title'],['global_seo_desc','seo-desc'],['global_og_image','seo-og']])
    await sb.from('site_settings').upsert({ key, value: document.getElementById(id).value }, { onConflict: 'key' });
  toast('SEO saved!');
}
async function saveAnalytics() {
  for (const [key, id] of [['google_analytics_id','seo-ga'],['custom_head_code','seo-head'],['custom_body_code','seo-body']])
    await sb.from('site_settings').upsert({ key, value: document.getElementById(id).value }, { onConflict: 'key' });
  toast('Analytics saved!');
}
async function saveRobots() {
  await sb.from('site_settings').upsert({ key: 'robots_txt', value: document.getElementById('seo-robots').value }, { onConflict: 'key' });
  toast('Robots.txt saved!');
}

// ── ADS ──────────────────────────────────────────────────────
async function loadAds() {
  const { data } = await sb.from('ad_slots').select('*').order('slot_key');
  document.getElementById('ads-list').innerHTML = (data || []).map(s => `
    <div class="adc">
      <div class="adc-h">
        <div><div style="font-weight:600;font-size:.88rem">${s.label}</div><div style="font-family:var(--fm);font-size:.67rem;color:var(--w4)">${s.slot_key}</div></div>
        <div style="display:flex;align-items:center;gap:.75rem">
          <label class="tgl"><input type="checkbox" ${s.is_active ? 'checked' : ''} onchange="toggleAd('${s.id}',this.checked)"/><span class="tgl-s"></span></label>
          <button class="btn btn-p btn-sm" onclick="saveAd('${s.id}')">Save</button>
        </div>
      </div>
      <textarea class="adca" id="acode-${s.id}">${s.ad_code || ''}</textarea>
    </div>`).join('');
}
async function saveAd(id) {
  const { error } = await sb.from('ad_slots').update({ ad_code: document.getElementById('acode-' + id).value, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) { toast('Error', 'err'); return; }
  toast('Ad slot saved!');
}
async function toggleAd(id, v) { await sb.from('ad_slots').update({ is_active: v }).eq('id', id); toast(v ? 'Enabled' : 'Disabled'); }

// ── USERS ────────────────────────────────────────────────────
async function loadUsers() {
  const { data } = await sb.from('profiles').select('*').eq('role', 'subscriber').order('created_at', { ascending: false });
  allUsers = data || [];
  renderUsers(allUsers);
}
function filterUsers() {
  const q = document.getElementById('user-q').value.toLowerCase();
  renderUsers(q ? allUsers.filter(u => [u.username, u.full_name, u.country, u.fav_club].join(' ').toLowerCase().includes(q)) : allUsers);
}
async function renderUsers(users) {
  const userIds = users.map(u => u.id);
  let subCounts = {};
  if (userIds.length) {
    const { data: subs } = await sb.from('kit_submissions').select('user_id,status').in('user_id', userIds);
    (subs || []).forEach(s => {
      if (!subCounts[s.user_id]) subCounts[s.user_id] = { total: 0, approved: 0 };
      subCounts[s.user_id].total++;
      if (s.status === 'approved') subCounts[s.user_id].approved++;
    });
  }
  document.getElementById('users-tb').innerHTML = users.map(u => {
    const sc = subCounts[u.id] || { total: 0, approved: 0 };
    return `<tr>
      <td style="font-weight:600">${u.username || '—'}</td>
      <td style="color:var(--w3);font-size:.78rem">${u.country || '—'}</td>
      <td style="color:var(--w3);font-size:.78rem">${u.fav_club || '—'}</td>
      <td style="font-family:var(--fm);font-size:.75rem;color:var(--gold)">${u.total_points || 0}</td>
      <td style="font-family:var(--fm);font-size:.75rem;color:var(--g)">${u.badge_count || 0}</td>
      <td style="font-family:var(--fm);font-size:.72rem;color:var(--w3)">${sc.approved}/${sc.total}</td>
      <td style="color:var(--w4);font-size:.72rem">${new Date(u.created_at).toLocaleDateString('en-GB')}</td>
      <td><button class="btn-del" onclick="banUser('${u.id}','${(u.username || '').replace(/'/g, "\\'")}')">Remove</button></td>
    </tr>`;
  }).join('') || '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--w4)">No users yet.</td></tr>';
}
async function banUser(id, name) {
  if (!confirm(`Remove "${name}"?`)) return;
  await sb.from('profiles').delete().eq('id', id);
  toast('User removed'); loadUsers();
}

// ── ADMINS ───────────────────────────────────────────────────
async function loadAdmins() {
  const { data } = await sb.from('profiles').select('username,id,created_at').eq('role', 'admin');
  document.getElementById('admins-list').innerHTML = (data || []).map(a => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid var(--bd)">
      <div>
        <div style="font-weight:600;font-size:.875rem"><i class="fa-solid fa-gear"></i> ${a.username || 'Admin'}</div>
        <div style="font-size:.7rem;color:var(--w4)">${new Date(a.created_at).toLocaleDateString('en-GB')}</div>
      </div>
      ${a.id !== adminProfile?.id
        ? `<button class="btn-del btn-sm" onclick="demoteAdmin('${a.id}','${(a.username || '').replace(/'/g, "\\'")}')">Demote</button>`
        : '<span style="font-size:.7rem;color:var(--g)">You</span>'}
    </div>`).join('') || '<div style="font-size:.8rem;color:var(--w4)">No other admins.</div>';
}
async function createAdmin() {
  const email = document.getElementById('na-email').value.trim();
  const pass  = document.getElementById('na-pass').value;
  const uname = document.getElementById('na-user').value.trim();
  if (!email || !pass || !uname) { toast('All fields required', 'err'); return; }
  const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: { username: uname } } });
  if (error) { toast('Error: ' + error.message, 'err'); return; }
  if (data.user) {
    setTimeout(async () => {
      await sb.from('profiles').update({ role: 'admin' }).eq('id', data.user.id);
      toast('Admin created!'); loadAdmins();
    }, 1500);
  }
  ['na-email','na-pass','na-user'].forEach(id => document.getElementById(id).value = '');
}
async function demoteAdmin(id, name) {
  if (!confirm(`Demote "${name}"?`)) return;
  await sb.from('profiles').update({ role: 'subscriber' }).eq('id', id);
  toast('Demoted'); loadAdmins();
}

// ── SITE SETTINGS ────────────────────────────────────────────
async function loadSettings() {
  const { data } = await sb.from('site_settings').select('*');
  if (!data) return;
  const s = Object.fromEntries(data.map(r => [r.key, r.value]));
  document.getElementById('ss-name').value     = s.site_name     || '';
  document.getElementById('ss-logotext').value = s.logo_text     || '';
  document.getElementById('ss-logo').value     = s.logo_url      || '';
  document.getElementById('ss-favicon').value  = s.favicon_url   || '';
  document.getElementById('ss-tagline').value  = s.site_tagline  || '';
  document.getElementById('ss-url').value      = s.site_url      || '';
  document.getElementById('ss-email').value    = s.contact_email || '';
  document.getElementById('ss-footer').value   = s.footer_text   || '';
  document.getElementById('ss-twitter').value  = s.social_twitter   || '';
  document.getElementById('ss-instagram').value = s.social_instagram || '';
  document.getElementById('ss-facebook').value = s.social_facebook  || '';
  document.getElementById('ss-keywords').value = s.meta_keywords    || '';
}
async function saveSettings() {
  const pairs = [
    ['site_name','ss-name'], ['logo_text','ss-logotext'], ['logo_url','ss-logo'],
    ['favicon_url','ss-favicon'], ['site_tagline','ss-tagline'],
    ['site_url','ss-url'], ['contact_email','ss-email'],
  ];
  for (const [key, id] of pairs)
    await sb.from('site_settings').upsert({ key, value: document.getElementById(id).value }, { onConflict: 'key' });
  toast('Settings saved!');
}
async function saveFooter() {
  const pairs = [
    ['footer_text','ss-footer'], ['social_twitter','ss-twitter'],
    ['social_instagram','ss-instagram'], ['social_facebook','ss-facebook'],
    ['meta_keywords','ss-keywords'],
  ];
  for (const [key, id] of pairs)
    await sb.from('site_settings').upsert({ key, value: document.getElementById(id).value }, { onConflict: 'key' });
  toast('Footer saved!');
}

// ── DASHBOARD ────────────────────────────────────────────────
async function loadDash() {
  const [{ count: kc }, { count: uc }, { count: pc }, { count: rc }] = await Promise.all([
    sb.from('kits').select('*', { count: 'exact', head: true }),
    sb.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'subscriber'),
    sb.from('kit_submissions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    sb.from('ratings').select('*', { count: 'exact', head: true }),
  ]);
  document.getElementById('d-kits').textContent    = kc || 0;
  document.getElementById('d-users').textContent   = uc || 0;
  document.getElementById('d-pending').textContent = pc || 0;
  document.getElementById('d-ratings').textContent = rc || 0;

  const { data: rk } = await sb.from('kits').select('team,season,type,created_at').order('created_at', { ascending: false }).limit(6);
  document.getElementById('d-rk').innerHTML = (rk || []).map(k =>
    `<div style="display:flex;justify-content:space-between;padding:.45rem 0;border-bottom:1px solid var(--bd);font-size:.8rem">
      <span>${k.team} <span style="color:var(--w4)">${k.season} ${k.type}</span></span>
      <span style="font-size:.68rem;color:var(--w4)">${new Date(k.created_at).toLocaleDateString('en-GB')}</span>
    </div>`).join('');

  const { data: ru } = await sb.from('profiles').select('username,country,created_at').eq('role', 'subscriber').order('created_at', { ascending: false }).limit(6);
  document.getElementById('d-ru').innerHTML = (ru || []).map(u =>
    `<div style="display:flex;justify-content:space-between;padding:.45rem 0;border-bottom:1px solid var(--bd);font-size:.8rem">
      <span>${u.username || '—'} <span style="color:var(--w4)">${u.country || ''}</span></span>
      <span style="font-size:.68rem;color:var(--w4)">${new Date(u.created_at).toLocaleDateString('en-GB')}</span>
    </div>`).join('');
}

// ── TOAST ────────────────────────────────────────────────────
function toast(msg, type = 'ok') {
  const t = document.getElementById('toast');
  t.innerHTML = (type === 'ok' ? '<i class="fa-solid fa-check"></i> ' : '<i class="fa-solid fa-xmark"></i> ') + msg;
  t.className = 'toast show ' + (type === 'ok' ? 'ok' : 'err');
  setTimeout(() => t.className = 'toast', 3000);
}

// ── INIT ─────────────────────────────────────────────────────
checkSession();
