/**
 * OmniAgent Commerce — Main App Controller
 * Tab navigation, session management, credential checks, and toast notifications.
 */

const API_BASE = '';
const SESSION_ID = 'session_' + Math.random().toString(36).slice(2, 10);

// ── State ────────────────────────────────────────────
const AppState = {
  currentScreen: 'commerce',
  sessionId: SESSION_ID,
  razorpayConfigured: false,
  geminiConfigured: false,
  cart: { items: [], subtotal: 0, crossSells: [], bundles: [] }
};

// ── API Helper ───────────────────────────────────────
async function api(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options
  };
  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }
  const res = await fetch(url, config);
  const data = await res.json();
  if (!res.ok && !data.success) {
    throw new Error(data.message || `API error: ${res.status}`);
  }
  return data;
}

// ── Toast Notifications ──────────────────────────────
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ── Tab Navigation ───────────────────────────────────
function initNavigation() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const screen = tab.dataset.screen;
      switchScreen(screen);
    });
  });
}

function switchScreen(screenName) {
  // Update tabs
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const activeTab = document.querySelector(`.nav-tab[data-screen="${screenName}"]`);
  if (activeTab) activeTab.classList.add('active');

  // Update screens
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const activeScreen = document.getElementById(`screen-${screenName}`);
  if (activeScreen) activeScreen.classList.add('active');

  AppState.currentScreen = screenName;

  // Trigger screen-specific refresh
  switch (screenName) {
    case 'cart':
      if (window.Cart) window.Cart.refresh();
      break;
    case 'dashboard':
      if (window.MerchantDashboard) window.MerchantDashboard.refresh();
      break;
    case 'safety':
      if (window.AuditView) window.AuditView.refresh();
      if (window.AuditView) window.AuditView.refreshApprovals();
      if (window.PolicyView) window.PolicyView.load();
      break;
    case 'failure':
      if (window.FailureLab) window.FailureLab.init();
      break;
  }
}

// ── Credential Check ─────────────────────────────────
async function checkHealth() {
  try {
    const data = await api('/api/health');
    const banner = document.getElementById('setupBanner');
    const msg = document.getElementById('setupMessage');
    const missing = [];

    if (!data.status.razorpay.configured) {
      missing.push(...data.status.razorpay.missing);
      AppState.razorpayConfigured = false;
    } else {
      AppState.razorpayConfigured = true;
    }

    if (!data.status.gemini.configured) {
      missing.push(...data.status.gemini.missing);
      AppState.geminiConfigured = false;
    } else {
      AppState.geminiConfigured = true;
    }

    if (missing.length > 0) {
      msg.innerHTML = `Missing credentials: <strong>${missing.join(', ')}</strong>. Add them to your <code>.env</code> file and restart the server.`;
      banner.classList.add('visible');
    } else {
      banner.classList.remove('visible');
    }
  } catch (e) {
    console.error('Health check failed:', e);
  }
}

// ── Cart Badge Update ────────────────────────────────
function updateCartBadge(count) {
  const badge = document.getElementById('cartBadge');
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

// ── Format Currency ──────────────────────────────────
function formatCurrency(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN');
}

// ── Format Timestamp ─────────────────────────────────
function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ── Initialize App ───────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  checkHealth();
});
