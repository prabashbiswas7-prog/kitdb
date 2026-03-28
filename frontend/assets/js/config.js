// ============================================================
// KitDB config.js v5
// Replace YOUR_SUPABASE_URL and YOUR_SUPABASE_ANON_KEY
// ============================================================

const SUPABASE_URL      = 'https://dpelurhaljmnogdxqpoj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwZWx1cmhhbGptbm9nZHhxcG9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxOTE4MzksImV4cCI6MjA4OTc2NzgzOX0.cvWry3iR8MZg7zV6ewKyw8YIOxIUCaV3gUBZlPsykNM';

const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Interstitial ad click counter ──────────────────────────
const AD_THRESHOLD = 6;
function trackClick() {
  let n = parseInt(sessionStorage.getItem('kitdb_clicks') || '0') + 1;
  sessionStorage.setItem('kitdb_clicks', String(n));
  if (n >= AD_THRESHOLD) {
    sessionStorage.setItem('kitdb_clicks', '0');
    showInterstitialAd();
  }
}
async function showInterstitialAd() {
  const slot = await getAdSlot('interstitial');
  if (!slot || !slot.is_active || !slot.ad_code) return;
  const el = document.createElement('div');
  el.id = 'kitdb-interstitial';
  el.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:2rem">
      <div style="background:#111;border:1px solid #222;border-radius:14px;padding:2rem;max-width:640px;width:100%;position:relative">
        <div style="font-size:.65rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#555;margin-bottom:1rem">Advertisement</div>
        ${slot.ad_code}
        <button onclick="document.getElementById('kitdb-interstitial').remove()"
          style="margin-top:1.5rem;background:#00C853;color:#000;border:none;border-radius:7px;padding:.6rem 1.5rem;font-weight:700;cursor:pointer;width:100%;font-family:inherit">
          Continue to KitDB →
        </button>
      </div>
    </div>`;
  document.body.appendChild(el);
}

// ── Ad slot cache & loader ─────────────────────────────────
const _adCache = {};
async function getAdSlot(key) {
  if (_adCache[key]) return _adCache[key];
  try {
    const { data } = await sb.from('ad_slots').select('*').eq('slot_key', key).single();
    if (data) _adCache[key] = data;
    return data;
  } catch { return null; }
}
async function injectAd(slotKey, containerId) {
  const slot = await getAdSlot(slotKey);
  const el = document.getElementById(containerId);
  if (!el || !slot || !slot.is_active || !slot.ad_code) return;
  el.innerHTML = `<div class="ad-label">Advertisement</div>${slot.ad_code}`;
  el.style.display = 'block';
}

// ── Auth helpers ───────────────────────────────────────────
async function getUser() {
  const { data: { user } } = await sb.auth.getUser();
  return user;
}
async function getProfile(userId) {
  try {
    const { data } = await sb.from('profiles').select('*').eq('id', userId).single();
    return data;
  } catch { return null; }
}
async function requireAuth(redirectTo = '/login.html') {
  const user = await getUser();
  if (!user) { window.location.href = redirectTo; return null; }
  return user;
}

// ── Dynamic nav from DB ────────────────────────────────────
async function initNav() {
  function normalizePath(input = '') {
    const [path] = String(input).split('?');
    const trimmed = path.endsWith('/') && path !== '/' ? path.slice(0, -1) : path;
    return trimmed || '/';
  }
  function isNavItemActive(currentPath, itemUrl) {
    const current = normalizePath(currentPath);
    const target = normalizePath(itemUrl);
    if (target === '/') return current === '/';
    return current === target || current.startsWith(target + '/');
  }

  // Load site settings for logo/branding
  let siteName = 'KitDB', logoUrl = '';
  try {
    const { data: settings } = await sb.from('site_settings').select('key,value');
    if (settings) {
      const s = Object.fromEntries(settings.map(r => [r.key, r.value]));
      siteName = s.logo_text || s.site_name || 'KitDB';
      logoUrl  = s.logo_url || '';
      // inject GA if set
      if (s.google_analytics_id) {
        const sc = document.createElement('script');
        sc.src = `https://www.googletagmanager.com/gtag/js?id=${s.google_analytics_id}`;
        sc.async = true;
        document.head.appendChild(sc);
        window.dataLayer = window.dataLayer || [];
        function gtag() { dataLayer.push(arguments); }
        gtag('js', new Date());
        gtag('config', s.google_analytics_id);
      }
      // inject custom head code
      if (s.custom_head_code) {
        const tmp = document.createElement('div');
        tmp.innerHTML = s.custom_head_code;
        [...tmp.children].forEach(c => document.head.appendChild(c));
      }
    }
  } catch {}

  // Update logo
  const logoEl = document.getElementById('nav-logo');
  if (logoEl) {
    if (logoUrl) {
      logoEl.innerHTML = `<img src="${logoUrl}" alt="${siteName}" style="height:32px;object-fit:contain"/>`;
    } else {
      // split logo text into two parts for color styling
      const half = Math.ceil(siteName.length / 2);
      logoEl.innerHTML = siteName.slice(0, half) + `<span>${siteName.slice(half)}</span>`;
    }
  }

  // Load menu items from DB
  try {
    const { data: menuItems } = await sb.from('menu_items')
      .select('*').eq('is_active', true).order('sort_order');

    const navLinks = document.getElementById('nav-links-dynamic') || document.querySelector('.nav-links');
    if (navLinks && menuItems?.length) {
      const currentPath = window.location.pathname;
      navLinks.innerHTML = menuItems.map(item => {
        const isActive = isNavItemActive(currentPath, item.url);
        return `<a href="${item.url}" class="nav-link ${isActive ? 'active' : ''}" ${item.target === '_blank' ? 'target="_blank" rel="noopener"' : ''}>${item.label}</a>`;
      }).join('');
    }
  } catch {}

  // Auth state in nav
  const user = await getUser();
  const navAuth = document.getElementById('nav-auth');
  if (!navAuth) return;

  if (user) {
    const profile = await getProfile(user.id);
    navAuth.innerHTML = `
      <a href="/profile.html" class="nav-link">${profile?.username || 'Profile'}</a>
      <a href="/submit.html" class="nav-link" style="color:var(--g)">+ Submit Kit</a>
      ${profile?.role === 'admin' ? '<a href="/admin/" class="nav-link nav-admin">Admin</a>' : ''}
      <button onclick="sb.auth.signOut().then(()=>location.href='/')" class="btn-nav-out">Sign Out</button>`;
  } else {
    navAuth.innerHTML = `
      <a href="/login.html" class="btn-nav-login">Sign In</a>
      <a href="/login.html#signup" class="btn-nav-signup">Join Free</a>`;
  }
}

// ── Star ratings renderer ──────────────────────────────────
function renderStars(avg, count, interactive, onRate) {
  avg = parseFloat(avg) || 0;
  const full = Math.floor(avg);
  const half = avg - full >= 0.5;
  let html = '<div class="stars">';
  for (let i = 1; i <= 5; i++) {
    const cls = i <= full ? 'star-full' : (i === full + 1 && half ? 'star-half' : 'star-empty');
    html += interactive
      ? `<span class="star ${cls}" data-v="${i}" onclick="if(window._onRate)window._onRate(${i})" style="cursor:pointer">★</span>`
      : `<span class="star ${cls}">★</span>`;
  }
  html += `</div><span class="rating-count">${avg > 0 ? avg.toFixed(1) : 'No ratings'} ${count > 0 ? `(${count})` : ''}</span>`;
  if (interactive && onRate) window._onRate = onRate;
  return html;
}

// ── Toast ──────────────────────────────────────────────────
function toast(msg, type = 'ok') {
  let t = document.getElementById('_toast');
  if (!t) {
    t = document.createElement('div');
    t.id = '_toast';
    t.style.cssText = 'position:fixed;bottom:1.5rem;right:1.5rem;z-index:8888;padding:.8rem 1.3rem;border-radius:9px;font-size:.85rem;font-weight:500;transform:translateY(60px);opacity:0;transition:all .28s;pointer-events:none;font-family:DM Sans,sans-serif;border:1px solid';
    document.body.appendChild(t);
  }
  t.textContent = (type === 'ok' ? '✓ ' : '✗ ') + msg;
  t.style.background = type === 'ok' ? '#00C853' : '#ff4444';
  t.style.color       = type === 'ok' ? '#000' : '#fff';
  t.style.borderColor = type === 'ok' ? '#009c41' : '#cc0000';
  t.style.transform = 'translateY(0)';
  t.style.opacity = '1';
  setTimeout(() => { t.style.transform = 'translateY(60px)'; t.style.opacity = '0'; }, 3000);
}

// ── Date formatter ─────────────────────────────────────────
function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
