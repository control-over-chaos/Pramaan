const appRoot = document.getElementById('app');

const state = {
  user: null,
  branding: { brand_name: 'pramaan', organization_name: 'Institutional Verification Workspace', tagline: 'Verify Before You Scrutinize.', description: '', footer_text: '' },
  page: 'dashboard',
  applicationId: '',
  institutionId: '',
  documentId: '',
  reportId: '',
  applicationQuery: '',
  globalQuery: '',
  applicationPage: 1,
  institutionPage: 1,
  documentPage: 1,
  verificationPage: 1,
  institutionQuery: '',
  applicationFilters: {},
  savedFilters: [],
  categories: [],
  notificationsUnread: 0,
  assistantOpen: false,
  assistantConfigured: false,
  assistantProviderConfigured: false,
  assistantHealthStatus: 'NOT_TESTED',
  assistantLastSuccessAt: null,
  assistantModel: '',
  assistantBusy: false,
  assistantRequestId: 0,
  assistantMessages: [],
  assistantContextId: '',
  assistantActiveContext: null,
  datasetCandidate: null,
  datasetPreview: null,
  datasetFilename: '',
  loading: false,
  language: document.documentElement.lang === 'hi' ? 'hi' : 'en',
  theme: window.PramaanTheme?.value || 'light',
  authSlide: 0,
  authSlideTimer: null,
  authSlidesPreloaded: false,
  authPreloadedImages: [],
  authBootstrap: false,
  authSubmitting: false,
  authRememberedIdentifier: '',
  authRemember: false,
};

try {
  state.authRememberedIdentifier = localStorage.getItem('pramaan.remembered-identifier') || '';
  state.authRemember = Boolean(state.authRememberedIdentifier);
} catch { /* Browser storage may be disabled. */ }

const AUTH_HERO_SLIDES = [
  { src: '/images/pramaan-auth-01.jpeg', alt: 'altShield' },
  { src: '/images/pramaan-auth-02.jpeg', alt: 'altEducation' },
  { src: '/images/pramaan-auth-03.jpeg', alt: 'altVerification' },
];

const navGroups = [
  { label: 'Workspace', items: [
    ['dashboard', 'Command Center', 'layout-dashboard', 'application.read'],
    ['applications', 'Applications', 'files', 'application.read'],
    ['institutions', 'Institutions', 'building', 'institution.read'],
    ['documents', 'Documents', 'file-check', 'document.read'],
    ['verification', 'Source Verification', 'shield-check', 'verification.review'],
    ['compliance', 'Regulatory Compliance', 'scale', 'application.read'],
    ['infrastructure', 'Infrastructure Review', 'landmark', 'application.read'],
    ['findings', 'Findings & Evidence', 'clipboard-list', 'finding.read'],
    ['review-queue', 'Review Queue', 'list-filter', 'finding.read'],
    ['rectifications', 'Rectifications', 'file-clock', 'application.read'],
    ['inspections', 'Inspections', 'scan-search', 'application.read'],
    ['reports', 'Reports', 'file-bar-chart', 'report.generate'],
    ['analytics', 'Operational Analytics', 'chart-no-axes-combined', 'application.read'],
  ] },
  { label: 'Records', items: [
    ['audit', 'Audit Trail', 'history', 'audit.read'],
    ['notifications', 'Notifications', 'bell', 'notification.read'],
  ] },
  { label: 'Administration', items: [
    ['rules', 'Regulatory Rules', 'book-open-check', 'rule.read'],
    ['integrations', 'Integrations', 'plug', 'integration.manage'],
    ['users', 'Users & Roles', 'users', 'user.manage'],
    ['health', 'System Health', 'activity', 'integration.manage'],
    ['dataset-import', 'Dataset Import', 'upload', 'configuration.manage'],
    ['configuration', 'Configuration', 'settings-2', 'configuration.manage'],
  ] },
];

const iconMarkup = {
  'layout-dashboard': '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="4" rx="1"/><rect x="14" y="10" width="7" height="11" rx="1"/><rect x="3" y="13" width="7" height="8" rx="1"/>',
  files: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
  building: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 21v-4h6v4M8 7h2m4 0h2M8 11h2m4 0h2"/>',
  'file-check': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8M14 2v6h6M14 2v6h6M8 13h4M8 17h3"/><circle cx="18" cy="17" r="3"/><path d="m16.8 17 1 1 2-2"/>',
  'shield-check': '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
  scale: '<path d="m16 16 3-8 3 8a5 5 0 0 1-6 0ZM2 16l3-8 3 8a5 5 0 0 1-6 0ZM7 21h10M12 3v18M3 7h2c2 0 4-1 7-4 3 3 5 4 7 4h2"/>',
  landmark: '<path d="m3 10 9-7 9 7M4 10h16M5 10v9m4-9v9m6-9v9m4-9v9M3 21h18"/>',
  'clipboard-list': '<rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4.5h6V3H9zM9 11h6m-6 4h6m-6 4h3"/>',
  'list-filter': '<path d="M4 7h16M7 12h10m-7 5h4"/><circle cx="7" cy="7" r="2"/><circle cx="17" cy="12" r="2"/>',
  'file-clock': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h5M14 2v6h6M14 2v6h6M8 13h4"/><circle cx="17" cy="17" r="4"/><path d="M17 15v2l1.5 1"/>',
  'scan-search': '<path d="M7 3H5a2 2 0 0 0-2 2v2m14-4h2a2 2 0 0 1 2 2v2M3 17v2a2 2 0 0 0 2 2h2m12-4v2a2 2 0 0 1-2 2h-2M8 11h5"/><circle cx="15.5" cy="14.5" r="3.5"/><path d="m18 17 2 2"/>',
  'file-bar-chart': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6"/><path d="M8 17v-2m4 2v-5m4 5v-3"/>',
  'chart-no-axes-combined': '<path d="M3 3v18h18M18 17V9m-5 8V5M8 17v-3"/>',
  history: '<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5m4-1v5l3 2"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  'book-open-check': '<path d="M12 7v14M3 18V5a2 2 0 0 1 2-2h4a3 3 0 0 1 3 3 3 3 0 0 1 3-3h4a2 2 0 0 1 2 2v9M3 18h6a3 3 0 0 1 3 3M3 18a3 3 0 0 1 3 3h6"/><path d="m16 18 2 2 4-4"/>',
  plug: '<path d="M12 22v-5m-5-12v5m10-5v5M5 10h14v2a7 7 0 0 1-14 0zM9 3v2m6-2v2"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m16 0v-2a4 4 0 0 0-3-3.87M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-7.87a4 4 0 0 1 0 7.75"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  'settings-2': '<path d="M20 7h-9m3 10H4m12-4V4M8 20v-7"/><circle cx="7" cy="7" r="3"/><circle cx="17" cy="17" r="3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  logout: '<path d="M10 17l5-5-5-5m5 5H3m9-9h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  'chevron-left': '<path d="m15 18-6-6 6-6"/>',
  plus: '<path d="M12 5v14m-7-7h14"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m14-7-5-5-5 5m5-5v12"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m18 6-12 12M6 6l12 12"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  alert: '<path d="m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0ZM12 9v4m0 4h.01"/>',
  'file-search': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h8M14 2v6h6M14 2v6h6M8 13h4"/><circle cx="17" cy="17" r="3"/><path d="m19.2 19.2 1.8 1.8"/>',
  'circle-check': '<circle cx="12" cy="12" r="10"/><path d="m8 12 2.5 2.5L16 9"/>',
  'external-link': '<path d="M15 3h6v6m-11 5L21 3M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  'user-round': '<circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0"/>',
  'lock-keyhole': '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/><circle cx="12" cy="15" r="1"/><path d="M12 16v2"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off': '<path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a15.8 15.8 0 0 1-3.2 4.1M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7c1.3 0 2.4-.3 3.4-.7"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
  moon: '<path d="M20.9 13.1A8.5 8.5 0 0 1 10.9 3.1 8.7 8.7 0 1 0 20.9 13.1Z"/>',
  'shield-alert': '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="M12 8v4m0 4h.01"/>',
  sparkles: '<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Zm7 11 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14ZM5 2l.7 1.6L7 4l-1.3.4L5 6l-.7-1.6L3 4l1.3-.4L5 2Z"/>',
};

function icon(name, className = '') {
  return `<svg class="icon ${className}" viewBox="0 0 24 24" aria-hidden="true">${iconMarkup[name] || iconMarkup.info}</svg>`;
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function slug(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function pretty(value) { return String(value ?? '').replaceAll('_', ' ').replaceAll('-', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()) || '—'; }
function date(value, withTime = false) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return escapeHtml(value);
  return new Intl.DateTimeFormat(state.language === 'hi' ? 'hi-IN' : 'en-IN', withTime ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' }).format(parsed);
}
function number(value) { return new Intl.NumberFormat(state.language === 'hi' ? 'hi-IN' : 'en-IN').format(Number(value || 0)); }
function initials(name) { return String(name || 'User').trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join(''); }
function hasPermission(permission) { return Boolean(state.user?.permissions?.includes(permission)); }
function isInstitutionUser() { return state.user?.roles?.includes('INSTITUTION_USER'); }
function isFireDocument(value) { return /fire.*(?:noc|safety)|(?:noc|safety).*fire/i.test(String(value || '')); }
function isDocumentAiSupported(value) { return /fire.*(?:noc|safety)|(?:noc|safety).*fire|financial|finance|balance sheet|audited account|faculty|staff roster|staff list|teaching staff|infrastructure|facilities|building|premises|laborator/i.test(String(value || '')); }

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');
  const request = { method: options.method || 'GET', credentials: 'same-origin', headers };
  if (options.body instanceof FormData) request.body = options.body;
  else if (options.body !== undefined) { headers.set('Content-Type', 'application/json'); request.body = JSON.stringify(options.body); }
  const response = await fetch(path, request);
  let payload = {};
  try { payload = await response.json(); } catch { /* non-JSON error */ }
  if (!response.ok) {
    const error = new Error(payload.error?.message || `Request failed (${response.status}).`);
    error.status = response.status;
    error.code = payload.error?.code || 'REQUEST_FAILED';
    if (response.status === 401 && state.user) { state.user = null; renderAuth(false); }
    throw error;
  }
  return payload;
}

function setPage(page, options = {}) {
  state.page = page;
  if (options.applicationId) state.applicationId = options.applicationId;
  if (options.institutionId) state.institutionId = options.institutionId;
  if (options.documentId) state.documentId = options.documentId;
  if (page === 'document' && options.documentId && options.documentId !== state.currentDocument?.id) state.currentDocument = null;
  if (options.reportId) state.reportId = options.reportId;
  if (page === 'applications' && options.query !== undefined) state.applicationQuery = options.query;
  const activeLink = (id) => id === page
    || (id === 'applications' && page === 'application')
    || (id === 'institutions' && page === 'institution')
    || (id === 'documents' && page === 'document')
    || (id === 'reports' && page === 'report');
  document.querySelectorAll('.nav-link').forEach((link) => {
    const active = activeLink(link.dataset.page);
    link.classList.toggle('active', active);
    link.setAttribute('aria-current', active ? 'page' : 'false');
  });
  const contextName = document.querySelector('.context-name');
  if (contextName) contextName.innerHTML = `${escapeHtml(brandName())} <span aria-hidden="true">·</span> ${escapeHtml(pageLabel(page))}`;
  document.title = `${brandName()} · ${window.PramaanI18n.translateText(pageLabel(page))}`;
  const suffix = page === 'application' ? `/applications/${encodeURIComponent(state.applicationId)}`
    : page === 'institution' ? `/institutions/${encodeURIComponent(state.institutionId)}`
      : page === 'document' ? `/documents/${encodeURIComponent(state.documentId)}`
        : page === 'report' ? `/reports/${encodeURIComponent(state.reportId)}` : `/${page}`;
  if(location.hash!==`#${suffix}`)history.pushState(null, '', `#${suffix}`);
  syncAssistantContext();
  closeMobileNav();
  loadPage();
}

function parseHash() {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'applications' && parts[1]) { state.page = 'application'; state.applicationId = parts[1]; }
  else if (parts[0] === 'institutions' && parts[1]) { state.page = 'institution'; state.institutionId = parts[1]; }
  else if (parts[0] === 'documents' && parts[1]) { state.page = 'document'; state.documentId = parts[1]; }
  else if (parts[0] === 'reports' && parts[1]) { state.page = 'report'; state.reportId = parts[1]; }
  else state.page = parts[0] || 'dashboard';
}

function brandName() { return state.branding.brand_name || 'pramaan'; }
function brandMark() {
  const logo=String(state.branding.logo_path||'');
  return /^\/branding\/[0-9a-f-]+\.png$/i.test(logo)?`<div class="brand-mark brand-image"><img src="${escapeHtml(logo)}" alt=""></div>`:'<div class="brand-mark" aria-hidden="true">p</div>';
}
function brandLockup() {
  const brand = brandName();
  const organization = state.branding.organization_name || 'Institutional Verification Workspace';
  const hasConfiguredLogo = /^\/branding\/[0-9a-f-]+\.png$/i.test(String(state.branding.logo_path || ''));
  if (!hasConfiguredLogo && brand.trim().toLowerCase() === 'pramaan') {
    return `<div class="brand-lockup brand-lockup-full"><div class="brand-logo-plate"><img class="brand-logo-image" src="/pramaan-logo.png" alt="Pramaan — प्रमाण से विश्वास — Trust, Backed by Proof"></div></div>`;
  }
  return `<div class="brand-lockup">${brandMark()}<div><div class="brand-name">${escapeHtml(brand)}</div><div class="brand-org">${escapeHtml(organization)}</div></div></div>`;
}
function syncFavicon() {
  const path=String(state.branding.favicon_path||'/favicon.svg');
  const safe=/^\/branding\/[0-9a-f-]+\.png$/i.test(path)?path:'/favicon.svg';
  const link=document.querySelector('link[rel="icon"]');if(link){link.href=safe;link.type=safe.endsWith('.png')?'image/png':'image/svg+xml';}
}
function navItems() {
  return navGroups.map((group) => ({ ...group, items: group.items.filter((item) => hasPermission(item[3]) && !(isInstitutionUser() && ['verification', 'compliance', 'infrastructure', 'findings', 'review-queue', 'reports', 'analytics'].includes(item[0]))) })).filter((group) => group.items.length);
}

function authText(key) { return window.PramaanI18n.t(`auth.${key}`); }
function authErrorMessage(error) {
  if (error?.status === 401) return authText('invalidCredentials');
  if (error?.status === 423) return authText('lockedAccount');
  if (error?.status === 400 && /valid official email/i.test(error.message || '')) return authText('invalidEmail');
  return error?.message || authText('requestFailed');
}

async function showSuccessfulLoginTransition() {
  const duration = 1200;
  const main = document.createElement('main');
  main.className = 'login-transition';
  main.lang = state.language;
  main.dataset.noTranslate = '';
  main.setAttribute('aria-label', authText('secureDocumentVerification'));
  main.setAttribute('aria-busy', 'true');
  main.setAttribute('aria-live', 'off');
  main.innerHTML = `
    <section class="login-transition-content">
      <div class="login-transition-brand">${escapeHtml(brandName())}</div>
      <h1 class="login-transition-heading">${escapeHtml(authText('secureDocumentVerification'))}</h1>
      <div class="verification-document" aria-hidden="true">
        <div class="verification-document-lines">
          <span class="verification-skeleton-line line-short"></span>
          <span class="verification-skeleton-line line-medium"></span>
          <span class="verification-skeleton-line line-long"></span>
          <span class="verification-skeleton-line line-medium-wide"></span>
          <span class="verification-skeleton-line line-long"></span>
        </div>
        <div class="verification-seal"><span class="verification-seal-pending">·</span><span class="verification-seal-check">${icon('check')}</span></div>
        <span class="verification-scanner"></span>
      </div>
      <p class="login-transition-status" aria-live="polite" aria-atomic="true">${escapeHtml(authText('preparingWorkspace'))}</p>
      <div class="login-transition-progress-row">
        <div class="login-transition-progress" role="progressbar" aria-label="${escapeHtml(authText('transitionProgress'))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
          <span class="login-transition-progress-fill"></span>
        </div>
        <span class="login-transition-percent" aria-hidden="true">${escapeHtml(number(0))}%</span>
      </div>
      <span class="sr-only login-transition-verified" aria-live="polite">${escapeHtml(authText('verified'))}</span>
    </section>`;
  appRoot.replaceChildren(main);

  const status = main.querySelector('.login-transition-status');
  const progressbar = main.querySelector('.login-transition-progress');
  const progressFill = main.querySelector('.login-transition-progress-fill');
  const percentage = main.querySelector('.login-transition-percent');
  const verifiedLabel = main.querySelector('.login-transition-verified');
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let previousPercent = -1;
  let previousStage = '';
  let verified = false;
  const copyForProgress = (progress) => {
    if (progress < 0.35) return ['preparing', 'preparingWorkspace'];
    if (progress < 0.75) return ['loading', 'preparingWorkspace'];
    if (progress < 1) return ['almost', 'almostReady'];
    return ['ready', 'readyVerified'];
  };
  const update = (progress) => {
    const visibleProgress = reducedMotion ? Math.floor(progress * 4) / 4 : progress;
    progressFill.style.width = `${(visibleProgress * 100).toFixed(2)}%`;
    const value = Math.round(progress * 100);
    if (value !== previousPercent) {
      percentage.textContent = `${number(value)}%`;
      progressbar.setAttribute('aria-valuenow', String(value));
      previousPercent = value;
    }
    const [stage, message] = copyForProgress(progress);
    if (stage !== previousStage) {
      status.textContent = authText(message);
      previousStage = stage;
    }
    if (progress >= 0.9 && !verified) {
      main.querySelector('.verification-seal').classList.add('is-verified');
      verifiedLabel.textContent = authText('verified');
      verified = true;
    }
  };

  update(0);
  window.requestAnimationFrame(() => main.classList.add('is-visible'));
  const startedAt = performance.now();
  await new Promise((resolve) => {
    const tick = (now) => {
      const progress = Math.min(1, Math.max(0, (now - startedAt) / duration));
      update(progress);
      if (progress < 1) window.requestAnimationFrame(tick);
      else resolve();
    };
    window.requestAnimationFrame(tick);
  });

  main.setAttribute('aria-busy', 'false');
  await new Promise((resolve) => window.setTimeout(resolve, 45));
  main.classList.add('is-fading-out');
  await new Promise((resolve) => window.setTimeout(resolve, 95));
}

function preloadAuthSlides() {
  if (state.authSlidesPreloaded) return;
  state.authPreloadedImages = AUTH_HERO_SLIDES.map((slide) => {
    const image = new Image();
    image.decoding = 'async';
    image.src = slide.src;
    return image;
  });
  state.authSlidesPreloaded = true;
}

function setAuthSlide(index) {
  const length = AUTH_HERO_SLIDES.length;
  state.authSlide = ((Number(index) % length) + length) % length;
  const page = document.querySelector('.auth-page');
  if (!page) return;
  page.querySelectorAll('.auth-slide').forEach((slide, position) => {
    const active = position === state.authSlide;
    slide.classList.toggle('is-active', active);
    slide.setAttribute('aria-hidden', String(!active));
    const image = slide.querySelector('img');
    if (image) image.alt = authText(AUTH_HERO_SLIDES[position].alt);
  });
  page.querySelectorAll('.auth-slide-dot').forEach((dot, position) => {
    const active = position === state.authSlide;
    dot.classList.toggle('is-active', active);
    dot.setAttribute('aria-pressed', String(active));
  });
}

function startAuthCarousel() {
  if (state.authSlideTimer) window.clearInterval(state.authSlideTimer);
  preloadAuthSlides();
  state.authSlideTimer = window.setInterval(() => setAuthSlide(state.authSlide + 1), 2000);
}

function stopAuthCarousel() {
  if (state.authSlideTimer) window.clearInterval(state.authSlideTimer);
  state.authSlideTimer = null;
}

function applyAuthLanguage() {
  const page = document.querySelector('.auth-page');
  if (!page) return;
  const lang = state.language === 'hi' ? 'hi' : 'en';
  document.documentElement.lang = lang;
  document.title = lang === 'hi' ? 'pramaan · लॉग इन' : 'pramaan · Login';
  page.querySelector('.auth-main')?.setAttribute('lang', lang);
  page.querySelector('.auth-visual-panel')?.setAttribute('aria-label', authText('visualPanel'));
  page.querySelector('.auth-carousel')?.setAttribute('aria-label', authText('visualPanel'));
  page.querySelector('.auth-slide-indicators')?.setAttribute('aria-label', authText('showSlide'));
  page.querySelector('.auth-main')?.setAttribute('aria-label', authText('loginPanel'));
  page.querySelector('.auth-language-switch')?.setAttribute('aria-label', authText('language'));
  page.querySelectorAll('[data-auth-i18n]').forEach((element) => { element.textContent = authText(element.dataset.authI18n); });
  page.querySelectorAll('[data-auth-placeholder]').forEach((element) => { element.placeholder = authText(element.dataset.authPlaceholder); });
  page.querySelectorAll('[data-auth-aria]').forEach((element) => {
    const label = authText(element.dataset.authAria);
    element.setAttribute('aria-label', label);
    element.setAttribute('title', label);
  });
  page.querySelector('.language-control')?.setAttribute('aria-label', authText('language'));
  const submitLabel = page.querySelector('.auth-submit-label');
  if (submitLabel && state.authSubmitting) submitLabel.textContent = authText(state.authBootstrap ? 'creatingAdmin' : 'loggingIn');
  page.querySelectorAll('.auth-slide-dot').forEach((dot, position) => {
    const label = `${authText('showSlide')} ${position + 1}`;
    dot.setAttribute('aria-label', label);
    dot.setAttribute('title', label);
  });
  page.querySelectorAll('.auth-slide img').forEach((image, position) => { image.alt = authText(AUTH_HERO_SLIDES[position].alt); });
}

function setAuthLanguage(language) {
  if (!['en', 'hi'].includes(language)) return;
  state.language = language;
  window.PramaanI18n.setLanguage(language);
  applyAuthLanguage();
  if (state.user) {
    document.title = `${brandName()} · ${window.PramaanI18n.translateText(pageLabel(state.page))}`;
    loadPage();
  }
  syncAppearanceControls();
}

function setTheme(theme) {
  state.theme = window.PramaanTheme.set(theme);
  syncAppearanceControls();
}

window.addEventListener('pramaan-theme-change', (event) => {
  state.theme = event.detail?.theme === 'dark' ? 'dark' : 'light';
  syncAppearanceControls();
});

function appearanceControls(locationName = 'shell') {
  const label = state.theme === 'dark' ? window.PramaanI18n.t('common.switchToLight') : window.PramaanI18n.t('common.switchToDark');
  return `<div class="appearance-controls appearance-controls-${locationName}">
    <button type="button" class="top-icon-button appearance-theme-toggle" data-action="toggle-theme" aria-pressed="${state.theme === 'dark'}" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${icon(state.theme === 'dark' ? 'sun' : 'moon')}<span class="sr-only">${escapeHtml(label)}</span></button>
    <div class="language-control auth-language-switch" role="group" aria-label="${escapeHtml(window.PramaanI18n.t('common.language'))}">${icon('globe')}<button type="button" class="auth-language-button" data-action="set-auth-language" data-language="en" aria-pressed="${state.language === 'en'}">English</button><span aria-hidden="true">|</span><button type="button" class="auth-language-button" data-action="set-auth-language" data-language="hi" aria-pressed="${state.language === 'hi'}">हिन्दी</button></div>
  </div>`;
}

function syncAppearanceControls() {
  document.querySelectorAll('.appearance-theme-toggle').forEach((button) => {
    const label = state.theme === 'dark' ? window.PramaanI18n.t('common.switchToLight') : window.PramaanI18n.t('common.switchToDark');
    button.innerHTML = `${icon(state.theme === 'dark' ? 'sun' : 'moon')}<span class="sr-only">${escapeHtml(label)}</span>`;
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    button.setAttribute('aria-pressed', String(state.theme === 'dark'));
  });
  document.querySelectorAll('.auth-language-button').forEach((button) => {
    const active = button.dataset.language === state.language;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll('.language-control').forEach((control) => control.setAttribute('aria-label', window.PramaanI18n.t('common.language')));
}

function toggleAuthPassword(button) {
  const password = document.getElementById('password');
  if (!password) return;
  const reveal = password.type === 'password';
  password.type = reveal ? 'text' : 'password';
  button.dataset.authAria = reveal ? 'hidePassword' : 'showPassword';
  button.innerHTML = icon(reveal ? 'eye-off' : 'eye');
  applyAuthLanguage();
}

function renderAuth(bootstrap) {
  syncFavicon();
  const setup = Boolean(bootstrap);
  state.authBootstrap = setup;
  document.documentElement.lang = state.language;
  const loginTitleKey = setup ? 'setupTitle' : 'loginTitle';
  const loginSubtitleKey = setup ? 'setupSubtitle' : 'loginSubtitle';
  const emailValue = escapeHtml(state.authRememberedIdentifier || '');
  const slides = AUTH_HERO_SLIDES.map((slide, index) => `<div class="auth-slide ${index === state.authSlide ? 'is-active' : ''}" aria-hidden="${index === state.authSlide ? 'false' : 'true'}" style="--slide-image:url('${slide.src}')"><div class="auth-slide-backdrop" aria-hidden="true"></div><img src="${slide.src}" alt="${escapeHtml(authText(slide.alt))}" decoding="async" ${index === 0 ? 'fetchpriority="high"' : ''}></div>`).join('');
  const indicators = AUTH_HERO_SLIDES.map((slide, index) => `<button class="auth-slide-dot ${index === state.authSlide ? 'is-active' : ''}" type="button" data-action="auth-slide" data-slide-index="${index}" aria-label="${escapeHtml(authText('showSlide'))} ${index + 1}" aria-pressed="${index === state.authSlide}" title="${escapeHtml(authText('showSlide'))} ${index + 1}"></button>`).join('');
  appRoot.innerHTML = `<main class="auth-page">
    <section class="auth-visual-panel" aria-label="${escapeHtml(authText('visualPanel'))}">
      <div class="auth-carousel" role="region" aria-roledescription="carousel" aria-label="${escapeHtml(authText('visualPanel'))}">
        <div class="auth-carousel-slides">${slides}</div>
        <div class="auth-slide-indicators" role="group" aria-label="${escapeHtml(authText('showSlide'))}">${indicators}</div>
      </div>
    </section>
    <section class="auth-main" aria-label="${escapeHtml(authText('loginPanel'))}">
      <div class="auth-content">
        <div class="auth-header-controls">${appearanceControls('auth')}</div>
        <div class="auth-branding">${brandLockup()}</div>
        <div class="auth-heading">
          <span class="eyebrow" data-auth-i18n="${setup ? 'initialSetup' : 'secureWorkspace'}">${authText(setup ? 'initialSetup' : 'secureWorkspace')}</span>
          <h1 data-auth-i18n="${loginTitleKey}">${authText(loginTitleKey)}</h1>
          <p data-auth-i18n="${loginSubtitleKey}">${authText(loginSubtitleKey)}</p>
        </div>
        <form class="auth-form" data-form="${setup ? 'bootstrap' : 'login'}" novalidate>
          ${setup ? `<div class="field auth-field"><label for="displayName" data-auth-i18n="fullNameLabel">${authText('fullNameLabel')}</label><div class="auth-input-wrap">${icon('user-round')}<input id="displayName" name="displayName" autocomplete="name" required maxlength="100" placeholder="${authText('fullNamePlaceholder')}" data-auth-placeholder="fullNamePlaceholder"></div></div>` : ''}
          <div class="field auth-field">
            <label for="email" data-auth-i18n="emailLabel">${authText('emailLabel')}</label>
            <div class="auth-input-wrap">${icon('mail')}<input id="email" name="email" type="email" autocomplete="username" inputmode="email" required maxlength="254" placeholder="${authText('emailPlaceholder')}" value="${emailValue}" data-auth-placeholder="emailPlaceholder" aria-describedby="login-identifier-hint"></div>
            ${!setup ? `<small class="auth-field-hint" id="login-identifier-hint" data-auth-i18n="loginIdentifierHint">${authText('loginIdentifierHint')}</small>` : ''}
          </div>
          <div class="field auth-field">
            <label for="password" data-auth-i18n="passwordLabel">${authText('passwordLabel')}</label>
            <div class="auth-input-wrap">${icon('lock-keyhole')}<input id="password" name="password" type="password" autocomplete="${setup ? 'new-password' : 'current-password'}" required maxlength="256" placeholder="${authText(setup ? 'passwordRequirements' : 'passwordPlaceholder')}" data-auth-placeholder="${setup ? 'passwordRequirements' : 'passwordPlaceholder'}"><button class="auth-password-toggle" type="button" data-action="toggle-auth-password" data-auth-aria="showPassword" aria-label="${escapeHtml(authText('showPassword'))}" title="${escapeHtml(authText('showPassword'))}">${icon('eye')}</button></div>
          </div>
          ${setup ? `<small class="auth-password-note" data-auth-i18n="passwordRequirements">${authText('passwordRequirements')}</small><div class="field auth-field"><label for="confirmPassword" data-auth-i18n="confirmPasswordLabel">${authText('confirmPasswordLabel')}</label><div class="auth-input-wrap">${icon('lock-keyhole')}<input id="confirmPassword" name="confirmPassword" type="password" autocomplete="new-password" required maxlength="256" placeholder="${authText('confirmPasswordPlaceholder')}" data-auth-placeholder="confirmPasswordPlaceholder"></div></div>` : `<div class="auth-form-options"><label class="auth-remember"><input type="checkbox" name="rememberMe" ${state.authRemember ? 'checked' : ''}><span class="auth-checkmark" aria-hidden="true"></span><span data-auth-i18n="remember">${authText('remember')}</span></label><button type="button" class="auth-text-button" data-action="forgot"><span data-auth-i18n="forgot">${authText('forgot')}</span></button></div>`}
          <button class="btn btn-primary auth-submit" type="submit"><span class="auth-submit-label" data-auth-i18n="${setup ? 'createAdmin' : 'login'}">${authText(setup ? 'createAdmin' : 'login')}</span><span class="auth-submit-arrow" aria-hidden="true">→</span></button>
        </form>
        ${setup ? `<div class="auth-account-note" data-auth-i18n="setupInfo">${authText('setupInfo')}</div>` : `<div class="auth-signup"><span data-auth-i18n="noAccount">${authText('noAccount')}</span><button type="button" class="auth-text-button" data-action="signup-info"><span data-auth-i18n="signup">${authText('signup')}</span></button></div>`}
        ${state.branding.support_email ? `<div class="auth-support-email">Support: <a href="mailto:${encodeURIComponent(state.branding.support_email)}">${escapeHtml(state.branding.support_email)}</a></div>` : ''}
      </div>
    </section>
  </main>`;
  startAuthCarousel();
  applyAuthLanguage();
  setAuthSlide(state.authSlide);
  syncAppearanceControls();
}

function renderShell() {
  if (!state.user) return renderAuth(false);
  syncFavicon();
  document.documentElement.lang = state.language;
  const groups = navItems();
  const fullName = escapeHtml(state.user.display_name || state.user.email);
  const role = escapeHtml((state.user.roles || []).map(pretty).join(' · ') || 'Workspace User');
  const nav = groups.map((group) => `<div class="nav-group"><div class="nav-heading">${escapeHtml(group.label)}</div>${group.items.map(([id, label, iconName]) => `<button class="nav-link ${state.page === id || (id === 'applications' && state.page === 'application') || (id === 'institutions' && state.page === 'institution') || (id === 'documents' && state.page === 'document') || (id === 'reports' && state.page === 'report') ? 'active' : ''}" data-page="${id}" aria-current="${state.page === id || (id === 'applications' && state.page === 'application') || (id === 'institutions' && state.page === 'institution') || (id === 'documents' && state.page === 'document') || (id === 'reports' && state.page === 'report') ? 'page' : 'false'}">${icon(iconName)}<span>${escapeHtml(label)}</span>${id === 'notifications' && state.notificationsUnread ? `<span class="nav-count">${number(state.notificationsUnread)}</span>` : ''}</button>`).join('')}</div>`).join('');
  document.title = `${brandName()} · ${window.PramaanI18n.translateText(pageLabel(state.page))}`;
  appRoot.innerHTML = `<div class="shell">
    <div class="overlay" data-action="close-nav"></div>
    <aside class="sidebar" aria-label="Primary navigation">
      <div class="sidebar-top">${brandLockup()}</div>
      <nav class="nav-scroll">${nav}</nav>
      <div class="sidebar-national-art" aria-hidden="true"><img class="sidebar-gate-image" src="/india-gate-sidebar.png" alt=""></div>
      <div class="sidebar-appearance-controls">${appearanceControls('mobile')}</div>
      <div class="sidebar-bottom"><div class="governance-chip">${escapeHtml(state.branding.footer_text || 'Automated findings are decision support. Final regulatory decisions remain with competent authorities.')}</div>
        <div class="user-mini"><div class="avatar">${escapeHtml(initials(state.user.display_name))}</div><div class="user-mini-copy"><div class="user-mini-name">${fullName}</div><div class="user-mini-role">${role}</div></div><button class="sidebar-logout" type="button" aria-label="Sign out" title="Sign out" data-action="logout">${icon('logout')}</button></div>
      </div>
    </aside>
    <div class="workspace">
      <header class="topbar">
        <div class="topbar-left"><button class="mobile-menu" type="button" aria-label="Open navigation" data-action="open-nav">${icon('menu')}</button><div class="context-name">${escapeHtml(brandName())} <span aria-hidden="true">·</span> ${escapeHtml(pageLabel(state.page))}</div></div>
        <form class="topbar-search" data-form="global-search" role="search">${icon('search')}<label class="sr-only" for="global-search">Search applications, institutions and documents</label><input id="global-search" class="search-input" name="q" autocomplete="off" placeholder="Search applications, institutions, certificates…" value="${escapeHtml(state.globalQuery)}"></form>
        <div class="topbar-actions"><div class="topbar-appearance-controls">${appearanceControls('shell')}</div><button type="button" class="top-icon-button" aria-label="Notifications" title="Notifications" data-page="notifications">${icon('bell')}${state.notificationsUnread ? '<span class="notification-dot" aria-hidden="true"></span>' : ''}</button><div class="top-user" role="button" tabindex="0" data-action="change-password" aria-label="Change my password"><div class="avatar">${escapeHtml(initials(state.user.display_name))}</div><div class="top-user-copy"><div class="top-user-name">${fullName}</div><div class="top-user-role">${role}</div></div></div></div>
      </header>
      <main class="main-content" id="main-content"><div class="loading-line" aria-label="Loading"></div></main>
    </div>
    <div id="modal-root"></div><div class="toast-region" id="toast-region" aria-live="polite"></div><div id="assistant-root"></div>
  </div>`;
  renderAssistantWidget();
  syncAppearanceControls();
}

function assistantApplicationId() {
  if (state.page === 'application') return state.applicationId;
  if (state.page === 'document') return state.currentDocument?.application_id || '';
  return '';
}

function assistantContextKey() {
  if (state.page === 'application' && state.applicationId) return `application:${state.applicationId}`;
  if (state.page === 'institution' && state.institutionId) return `institution:${state.institutionId}`;
  if (state.page === 'document' && state.documentId) return `document:${state.documentId}`;
  return '';
}

function syncAssistantContext() {
  const nextContextId = assistantContextKey();
  if (state.assistantContextId !== nextContextId) {
    state.assistantContextId = nextContextId;
    state.assistantMessages = [];
    state.assistantActiveContext = null;
    state.assistantRequestId += 1;
    state.assistantBusy = false;
    if (state.assistantOpen) renderAssistantWidget();
  }
}

function assistantPageContext() {
  return {
    page: state.page,
    applicationId: state.page === 'application' ? state.applicationId : (state.page === 'document' ? state.currentDocument?.application_id || '' : ''),
    institutionId: state.page === 'institution' ? state.institutionId : (state.page === 'document' ? state.currentDocument?.institution_id || '' : ''),
    documentId: state.page === 'document' ? state.documentId : '',
  };
}

function assistantContextLabel() {
  const current = assistantPageContext();
  if (current.documentId) return `Document workspace · ${current.documentId}`;
  if (current.applicationId) return `Application workspace · ${current.applicationId}`;
  if (current.institutionId) return `Institution profile · ${current.institutionId}`;
  const active = state.assistantActiveContext;
  if (active?.kind && active?.id) return `Current record · ${pretty(active.kind)} · ${active.id}`;
  return `${pageLabel(state.page)} · General Pramaan help`;
}

function renderAssistantWidget() {
  const root = document.getElementById('assistant-root');
  if (!root) return;
  const renderActions = (items = []) => items.filter((item) => item && typeof item.label === 'string' && typeof item.page === 'string')
    .map((item) => `<button class="assistant-chip assistant-action" type="button" data-action="assistant-open-action" data-pagekey="${escapeHtml(item.page)}" data-id="${escapeHtml(item.id || '')}">${escapeHtml(item.label)}</button>`).join('');
  const renderSuggestions = (items = []) => items.filter((item) => typeof item === 'string' && item.trim())
    .map((item) => `<button class="assistant-chip" type="button" data-action="assistant-suggestion" data-prompt="${escapeHtml(item)}">${escapeHtml(item)}</button>`).join('');
  const renderSource = (source) => {
    const value = String(source || '');
    let page = '', id = '';
    let match = value.match(/^Application\s+([^\s(]+)/i);
    if (match) { page = 'application'; id = match[1]; }
    match = value.match(/^Document\s+([^\s(]+)/i);
    if (match) { page = 'document'; id = match[1]; }
    match = value.match(/^Institution\s+.*\(([^)]+)\)$/i);
    if (match) { page = 'institution'; id = match[1]; }
    if (page && id) return `<button class="assistant-source assistant-source-link" type="button" data-action="assistant-open-action" data-pagekey="${page}" data-id="${escapeHtml(id)}">${escapeHtml(value)} ↗</button>`;
    if (/^Rule evaluation\s/i.test(value)) return `<button class="assistant-source assistant-source-link" type="button" data-action="assistant-open-action" data-pagekey="compliance">${escapeHtml(value)} ↗</button>`;
    return `<span class="assistant-source">${escapeHtml(value)}</span>`;
  };
    const messages = state.assistantMessages.map((message) => `<article class="assistant-message ${message.role === 'user' ? 'from-user' : 'from-assistant'} ${message.error ? 'is-error' : ''}"><div class="assistant-message-label">${message.role === 'user' ? 'You' : `Pramaan Sahayak · ${message.mode === 'ai' ? 'Gemini AI guidance' : 'record summary'}`}</div><div class="assistant-message-copy">${escapeHtml(message.content)}</div>${message.claims?.length ? `<details class="assistant-evidence-claims"><summary>Stored evidence behind this answer</summary><ul>${message.claims.slice(0,20).map(c=>`<li>${escapeHtml(pretty(c.path.split('.').at(-1)))}: ${escapeHtml(String(c.value))}${c.recordId?' · '+escapeHtml(c.recordId):''}</li>`).join('')}</ul><p>Showing ${Math.min(20,message.claims.length)} evidence values checked against stored Pramaan records.</p></details>`:''}${message.sources?.length ? `<div class="assistant-sources"><span>Pramaan records:</span>${message.sources.map(renderSource).join('')}</div>` : ''}${message.suggestedActions?.length ? `<div class="assistant-actions">${renderActions(message.suggestedActions)}</div>` : ''}${message.suggestions?.length ? `<div class="assistant-suggestions">${renderSuggestions(message.suggestions)}</div>` : ''}</article>`).join('');
  const welcome = `<article class="assistant-welcome"><div class="assistant-welcome-title">How can I help?</div><p>Ask about Pramaan records you’re allowed to view, or choose a starting point.</p><div class="assistant-suggestions">${renderSuggestions(['Where can I search institutions in Pramaan?', 'How do I check applications in Pramaan?', 'How do I view document verification results?', 'How do I review compliance results?'])}</div></article>`;
  const statusText = state.assistantHealthStatus === 'RESPONDING' ? 'Gemini responding · evidence checked' : state.assistantHealthStatus === 'UNAVAILABLE' ? 'Gemini unavailable · local help active' : state.assistantHealthStatus === 'STALE' ? 'Gemini last responded earlier · recheck connection' : state.assistantProviderConfigured ? 'Gemini configured · connection not yet confirmed' : 'Local record help · Gemini not configured';
  const assistantNotice = state.assistantProviderConfigured
    ? '<div class="assistant-setup-note">Your question, recent chat turns, and relevant Pramaan records your account can access are sent to Google Gemini to generate an answer. Raw uploaded files are not sent. Case-specific claims are checked against stored records; final regulatory decisions remain with authorized officers.</div>'
    : '<div class="assistant-setup-note">Sahayak looks up only Pramaan records your account can access. Local record answers work without an external AI connection.</div>';
  root.innerHTML = `<button class="assistant-launcher" type="button" data-action="toggle-assistant" aria-expanded="${state.assistantOpen}" aria-controls="assistant-panel">${icon('sparkles')}<span>Ask Sahayak</span></button>${state.assistantOpen ? `<section class="assistant-panel" id="assistant-panel" role="dialog" aria-label="Pramaan Sahayak assistant"><header class="assistant-header"><div class="assistant-header-mark">${icon('sparkles')}</div><div class="assistant-header-copy"><strong>Pramaan Sahayak</strong><span>${statusText}</span></div>${state.assistantMessages.length ? `<button class="assistant-clear" type="button" data-action="clear-assistant" title="Clear this chat">Clear</button>` : ''}<button class="assistant-close" type="button" data-action="toggle-assistant" aria-label="Close assistant">×</button></header><div class="assistant-context">${escapeHtml(assistantContextLabel())}${state.assistantModel ? ` · ${escapeHtml(state.assistantModel)}` : ''}</div><div class="assistant-messages" aria-live="polite" aria-relevant="additions text">${messages || welcome}${state.assistantBusy ? '<div class="assistant-typing" role="status">Sahayak is preparing an answer…</div>' : ''}</div>${assistantNotice}<form class="assistant-compose" data-form="assistant-chat"><label class="sr-only" for="assistant-message">Ask Pramaan Sahayak</label><textarea id="assistant-message" data-assistant-input name="message" rows="2" maxlength="2000" placeholder="Ask about a Pramaan record or workflow…" ${state.assistantBusy ? 'disabled' : ''} required></textarea><button class="assistant-send" type="submit" aria-label="Send message" ${state.assistantBusy ? 'disabled' : ''}>${icon('arrow')}</button></form></section>` : ''}`;
  const transcript = root.querySelector('.assistant-messages');
  if (transcript) transcript.scrollTop = transcript.scrollHeight;
}

async function refreshAssistantStatus() {
  try {
    const result = await api('/api/v1/assistant/status');
    state.assistantConfigured = Boolean(result.data.configured);
    state.assistantProviderConfigured = Boolean(result.data.externalProviderConfigured);
    state.assistantHealthStatus = result.data.healthStatus || (result.data.configured ? 'NOT_TESTED' : 'LOCAL_ONLY');
    state.assistantLastSuccessAt = result.data.lastSuccessAt || null;
    state.assistantModel = result.data.model || '';
  } catch {
    state.assistantConfigured = false;
    state.assistantProviderConfigured = false;
    state.assistantHealthStatus = 'UNAVAILABLE';
    state.assistantModel = '';
  }
  renderAssistantWidget();
}

async function askAssistant(message) {
  const cleanMessage = String(message || '').trim();
  if (!cleanMessage) return;
  syncAssistantContext();
  const requestId = ++state.assistantRequestId;
  const contextId = state.assistantContextId;
  const requestPageContext = JSON.stringify(assistantPageContext());
  const history = state.assistantMessages.filter((item) => !item.error).slice(-8).map(({ role, content }) => ({ role, content }));
  state.assistantMessages.push({ role: 'user', content: cleanMessage });
  state.assistantBusy = true;
  renderAssistantWidget();
  try {
    const result = await api('/api/v1/assistant/chat', { method: 'POST', body: { message: cleanMessage, history, pageContext: JSON.parse(requestPageContext), activeContext: state.assistantActiveContext } });
    if (requestId !== state.assistantRequestId || contextId !== state.assistantContextId || requestPageContext !== JSON.stringify(assistantPageContext())) return;
    if (Object.hasOwn(result.data, 'activeContext')) state.assistantActiveContext = result.data.activeContext;
    if (state.assistantActiveContext && result.data.intent) state.assistantActiveContext.lastIntent = result.data.intent;
    state.assistantMessages.push({ role: 'assistant', content: result.data.answer, claims:result.data.claims||[], mode: result.data.mode || 'ai', sources: result.data.sources || [], suggestedActions: result.data.suggestedActions || [], suggestions: result.data.suggestions || [] });
    if (result.data.mode === 'ai') { state.assistantHealthStatus='RESPONDING'; state.assistantProviderConfigured=true; }
    else if (['AI_PROVIDER_UNAVAILABLE','AI_RESPONSE_NOT_EVIDENCE_VALID'].includes(result.data.providerStatus)) state.assistantHealthStatus='UNAVAILABLE';
  } catch (error) {
    if (requestId !== state.assistantRequestId || contextId !== state.assistantContextId || requestPageContext !== JSON.stringify(assistantPageContext())) return;
    state.assistantMessages.push({ role: 'assistant', content: error.message || 'The assistant could not answer. Please try again.', error: true });
  } finally {
    if (requestId === state.assistantRequestId && contextId === state.assistantContextId && requestPageContext === JSON.stringify(assistantPageContext())) {
      state.assistantBusy = false;
      renderAssistantWidget();
      rootFocusAssistant();
    }
  }
}

function rootFocusAssistant() { document.querySelector('[data-assistant-input]:not(:disabled)')?.focus(); }

function pageLabel(page) {
  if (page === 'search') return 'Search Results';
  if (page === 'application') return 'Application Workspace';
  if (page === 'institution') return 'Institution 360';
  if (page === 'document') return 'Document Workspace';
  if (page === 'report') return 'Verification Report';
  const labels = Object.fromEntries(navGroups.flatMap((group) => group.items.map(([id, label]) => [id, label])));
  return labels[page] || 'Command Center';
}

function header(title, subtitle, actions = '') {
  return `<div class="page-header"><div class="page-title-group"><div class="breadcrumb"><span>${escapeHtml(brandName())}</span>${icon('chevron')}<span>${escapeHtml(pageLabel(state.page))}</span></div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></div><div class="page-actions">${actions}</div></div>`;
}
function button(label, action, iconName = '', style = 'secondary', attributes = '') {
  return `<button type="button" class="btn btn-${style}" data-action="${escapeHtml(action)}" ${attributes}>${iconName ? icon(iconName) : ''}${escapeHtml(label)}</button>`;
}
function badge(value) { const text = value || 'NOT_CONFIGURED'; return `<span class="badge ${slug(text)}">${escapeHtml(pretty(text))}</span>`; }
function eligibilityPanel(evaluation, details = false) {
  if (!evaluation) return panel('Internal PRAMAAN Eligibility', emptyState('No assessment is available.', 'A saved assessment appears when published rules are linked to current application evidence.'));
  const percent = (value) => value === null || value === undefined ? '—' : `${Number(value).toFixed(Number(value) % 1 ? 1 : 0)}%`;
  const progress = (label, value) => `<div class="eligibility-meter"><div><span>${escapeHtml(label)}</span><strong>${percent(value)}</strong></div><div class="eligibility-track" role="progressbar" aria-label="${escapeHtml(label)}" aria-valuemin="0" aria-valuemax="100"${value === null || value === undefined ? ' aria-valuetext="Not evaluated"' : ` aria-valuenow="${Number(value)}"`}><span style="width:${value === null || value === undefined ? 0 : Math.max(0,Math.min(100,Number(value)))}%"></span></div></div>`;
  const criteria = (evaluation.criteria || []).map((item) => [
    escapeHtml(item.label), `${number(item.weight)} / 100`, badge(item.status), badge(item.applicability),
    details ? (item.ruleResults || []).map((rule) => `<div class="eligibility-rule"><strong>${escapeHtml(rule.ruleKey)} · ${escapeHtml(rule.title)}</strong><div>${badge(rule.status)}${rule.mandatory ? ' · Mandatory' : ''}</div><div class="finding-text">${escapeHtml(rule.reason || '—')}</div>${rule.recommendedAction ? `<div class="finding-text"><strong>Next step:</strong> ${escapeHtml(rule.recommendedAction)}</div>` : ''}</div>`).join('') || 'No published rules linked to this category.' : (item.mandatoryFailure ? 'Mandatory failure recorded' : 'Ask an authorized officer for review details'),
  ]);
  const summary = `<div class="eligibility-summary"><div class="eligibility-score">${progress('Criteria satisfied',evaluation.criteriaSatisfiedPercent)}${progress('Verification coverage',evaluation.verificationCoveragePercent)}</div><div class="eligibility-status">${badge(evaluation.status)}<span>${number(evaluation.passedWeight)} / ${number(evaluation.applicableWeight)} applicable weight passed</span><span>${number(evaluation.mandatoryFailures)} mandatory failures</span></div></div>`;
  const risk = evaluation.risk;
  const riskBandText = risk?.bandThresholds ? `Bands: ${Object.entries(risk.bandThresholds).map(([label,range])=>`${pretty(label)} ${range}`).join(' · ')}.` : '';
  const riskWeightText = risk?.severityPoints ? `Severity points: ${Object.entries(risk.severityPoints).map(([label,points])=>`${pretty(label)} ${points}`).join(' · ')}.` : '';
  const riskPanel = risk ? `<section class="eligibility-risk"><div class="eligibility-risk-heading"><strong>Evidence review indicator</strong>${badge(risk.category || risk.status)}</div><div class="eligibility-risk-stats"><span>Score <strong>${risk.score === null || risk.score === undefined ? 'Not assessed' : `${number(risk.score)} / 100`}</strong></span><span>${number(risk.failedCheckCount)} contributing checks</span><span>${number(risk.unverifiedCheckCount)} unverified checks</span><span>OCR uncertainty: ${number(risk.uncertainty?.lowConfidenceFieldCount)} low-confidence · ${number(risk.uncertainty?.unknownConfidenceFieldCount)} unknown</span></div>${details && risk.factors?.length ? `<div class="eligibility-risk-factors">${risk.factors.slice(0,8).map((factor)=>`<div><strong>${escapeHtml(factor.title || factor.ruleKey || factor.factor)}</strong><span>${escapeHtml(pretty(factor.severity || 'MEDIUM'))} · ${number(factor.points)} points</span><p>${escapeHtml(factor.reason || factor.evidenceReference || 'Stored rule evidence')}</p>${factor.recommendedAction?`<p><strong>Next step:</strong> ${escapeHtml(factor.recommendedAction)}</p>`:''}</div>`).join('')}</div>`:''}<div class="eligibility-note">${escapeHtml([riskBandText,riskWeightText,risk.notice || 'Internal evidence-review indicator only; not a finding of fraud or an official decision.'].filter(Boolean).join(' '))}</div></section>` : '';
  return panel('Internal PRAMAAN Eligibility', `${summary}${riskPanel}${table(['Internal category','Weight','Result','Applicability','Rule evidence'],criteria)}<div class="eligibility-note">${escapeHtml(evaluation.notice || 'Internal decision support only. This is not an official approval or regulatory determination.')}</div>`, `${escapeHtml(evaluation.frameworkVersion || 'Internal framework')} · ${date(evaluation.calculatedAt,true)}`);
}
function eligibilityListCell(row) {
  const score = row.eligibility_percent === null || row.eligibility_percent === undefined ? '—' : `${Number(row.eligibility_percent).toFixed(Number(row.eligibility_percent)%1?1:0)}%`;
  return `${badge(row.eligibility_status || 'NOT_EVALUATED')}<div class="cell-secondary">${score}${row.eligibility_calculated_at?` · ${date(row.eligibility_calculated_at)}`:''}</div>`;
}
function datasetNotice(copy) { return copy ? `<div class="notice-strip">${icon('info')}<span>${escapeHtml(copy)}</span></div>` : ''; }
function fileAvailability(version) { return version?.file_available === 0 || version?.file_available === false ? 'File not supplied' : 'File available'; }
function emptyState(title, copy, action = '') {
  return `<div class="empty-state"><div class="empty-icon">${icon('file-search')}</div><div class="empty-title">${escapeHtml(title)}</div><div class="empty-copy">${escapeHtml(copy)}</div>${action}</div>`;
}
function panel(title, body, subtitle = '', tools = '') {
  return `<section class="panel"><div class="panel-head"><div><h2 class="panel-title">${escapeHtml(title)}</h2>${subtitle ? `<div class="panel-subtitle">${escapeHtml(subtitle)}</div>` : ''}</div>${tools ? `<div class="panel-tools">${tools}</div>` : ''}</div>${body}</section>`;
}

let jobPollTimer=null;
async function loadPage() {
  clearTimeout(jobPollTimer);
  if (!state.user) return;
  const main = document.getElementById('main-content');
  if (!main) return;
  if(state.user.must_change_password){main.innerHTML=header('Change temporary password','Set your own password before accessing records.')+passwordForm();return;}
  main.innerHTML = '<div class="loading-line" aria-label="Loading"></div>';
  try {
    switch (state.page) {
      case 'dashboard': await renderDashboard(main); break;
      case 'applications': await renderApplications(main); break;
      case 'search': await renderGlobalSearch(main); break;
      case 'institutions': await renderInstitutions(main); break;
      case 'application': await renderApplication(main); break;
      case 'institution': await renderInstitution(main); break;
      case 'documents': await renderDocuments(main); break;
      case 'document': await renderDocument(main); break;
      case 'verification': await renderVerifications(main); break;
      case 'compliance': await renderCompliance(main); break;
      case 'infrastructure': await renderInfrastructure(main); break;
      case 'findings': await renderFindings(main, false); break;
      case 'review-queue': await renderFindings(main, true); break;
      case 'rectifications': await renderRectifications(main); break;
      case 'inspections': await renderInspections(main); break;
      case 'reports': await renderReports(main); break;
      case 'report': await renderReport(main); break;
      case 'audit': await renderAudit(main); break;
      case 'notifications': await renderNotifications(main); break;
      case 'analytics': await renderAnalytics(main); break;
      case 'rules': await renderRules(main); break;
      case 'integrations': await renderIntegrations(main); break;
      case 'users': await renderUsers(main); break;
      case 'health': await renderHealth(main); break;
      case 'configuration': await renderConfiguration(main); break;
      case 'dataset-import': await renderDatasetImport(main); break;
      default: state.page = 'dashboard'; setPage('dashboard');
    }
  } catch (error) {
    if (!state.user) return;
    main.innerHTML = header(pageLabel(state.page), 'The request could not be loaded.') + `<section class="panel">${emptyState('Unable to load this workspace', error.message || 'Try again in a moment.', button('Retry', 'retry-page', 'clock'))}</section>`;
  }
}

async function renderDashboard(main) {
  const [dashboardResult, analyticsResult, notificationResult] = await Promise.all([
    api('/api/v1/dashboard'), api('/api/v1/analytics'), hasPermission('notification.read') ? api('/api/v1/notifications?limit=1') : Promise.resolve({ data: [], meta: { unread: 0 } }),
  ]);
  const { metrics, queue, system } = dashboardResult.data;
  const analytics = analyticsResult.data;
  state.notificationsUnread = notificationResult.meta?.unread || 0;
  renderShellHeaderOnly();
  const institution = isInstitutionUser();
  const cards = [
    [institution ? 'My Institution Applications' : 'Applications Assigned to Me', metrics.assigned, 'files', institution ? 'Accessible institutional applications' : 'Current officer assignment'],
    ['Applications Under Validation', metrics.validating, 'file-check', 'Processing and compliance stages'],
    ['Documents Awaiting Processing', metrics.documents, 'clock', 'Persistent background job queue'],
    ['Source Verifications Pending', metrics.sourcePending, 'shield-check', pretty(system.sourceVerification)],
    ['Findings Requiring Review', metrics.findings, 'clipboard-list', 'Items awaiting officer review'],
    ['Eligibility action required', metrics.eligibilityActionRequired, 'alert', 'Latest saved internal assessment'],
    ['Eligibility checks pending', metrics.eligibilityPending, 'clock', 'Latest saved internal assessment'],
    ['Ready for approval review', metrics.eligibilityReady, 'shield-check', 'Internal support only; not an approval'],
    [institution ? 'Open Rectification Requests' : 'Rectifications Received', metrics.rectifications, 'file-clock', institution ? 'Awaiting your response' : 'Institution responses received'],
    [institution ? 'Scheduled Inspections' : 'Inspection Recommendations', metrics.inspections, 'scan-search', institution ? 'Scheduled or underway' : 'Awaiting authority review'],
    ['Overdue Actions', metrics.overdue, 'alert', 'Based on stored due dates'],
  ];
  const metricGrid = `<div class="metrics-grid">${cards.map(([label, value, iconName, foot]) => `<article class="metric-card"><div class="metric-head"><div class="metric-label">${escapeHtml(label)}</div><div class="metric-icon">${icon(iconName)}</div></div><div><div class="metric-value">${number(value)}</div><div class="metric-foot">${escapeHtml(foot)}</div></div></article>`).join('')}</div>`;
  const outcomeCards = [
    ['APPROVED','Accepted by authority',metrics.approved,'shield-check'],
    ['REJECTED','Rejected by authority',metrics.rejected,'alert'],
    ['EXPIRED','Expired evidence',metrics.expired,'clock'],
    ['VERIFIED','Source verified',metrics.verified,'circle-check'],
    ['REVIEW_REQUIRED','Needs review',metrics.needsReview,'clipboard-list'],
    ['NOT_VERIFIED','Not verified',metrics.notVerified,'info'],
  ];
  const outcomePanel = panel('Application review outcomes', `<div class="outcome-cards">${outcomeCards.map(([value,label,count,iconName])=>`<button type="button" class="outcome-card" data-action="filter-applications-outcome" data-outcome="${value}"><span class="outcome-card-icon">${icon(iconName)}</span><span class="outcome-card-copy"><strong>${number(count)}</strong><small>${escapeHtml(label)}</small></span>${icon('chevron')}</button>`).join('')}</div><p class="outcome-note">Expired and review statuses come from stored evidence and configured checks. Accepted or rejected is recorded only by an authorized approving officer.</p>`, 'Click an outcome to open the matching application list');
  const columns = institution
    ? [['Application ID', (row) => `<button class="table-link" data-action="open-application" data-id="${escapeHtml(row.id)}">${escapeHtml(row.id)}</button>`], ['Application Category', (row) => escapeHtml(row.category_label)], ['Academic Year', (row) => escapeHtml(row.academic_year)], ['Processing Stage', (row) => badge(row.processing_stage)], ['Eligibility (last assessment)', eligibilityListCell], ['Verification Status', (row) => badge(row.verification_status)], ['Last Activity', (row) => date(row.updated_at)], ['Action', (row) => `<button class="table-action" data-action="open-application" data-id="${escapeHtml(row.id)}">View application</button>`]]
    : [['Priority', (row) => `<span class="priority ${slug(row.attention_priority)}" title="${escapeHtml(row.priority_factors.join('; ') || 'No active priority factors')}">${escapeHtml(row.attention_priority)}</span>`], ['Application ID', (row) => `<button class="table-link" data-action="open-application" data-id="${escapeHtml(row.id)}">${escapeHtml(row.id)}</button>`], ['Institution', (row) => `<div class="cell-primary">${escapeHtml(row.institution_name)}</div><div class="cell-secondary">${escapeHtml(row.aicte_id)}</div>`], ['Application Category', (row) => escapeHtml(row.category_label)], ['Processing Stage', (row) => badge(row.processing_stage)], ['Eligibility (last assessment)', eligibilityListCell], ['Open Findings', (row) => number(row.open_findings)], ['Verification Status', (row) => badge(row.verification_status)], ['Assigned Officer', (row) => escapeHtml(row.assigned_officer || 'Unassigned')], ['Last Activity', (row) => date(row.updated_at)], ['Due Date', (row) => date(row.due_date)], ['Action', (row) => `<button class="table-action" data-action="open-application" data-id="${escapeHtml(row.id)}">Open application</button>`]];
  const queueBody = queue.length ? `<div class="table-wrap"><table><thead><tr>${columns.map(([label]) => `<th>${escapeHtml(label)}</th>`).join('')}</tr></thead><tbody>${queue.map((row) => `<tr>${columns.map(([, cell]) => `<td>${cell(row)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="queue-footer"><span>Showing ${number(queue.length)} ${institution ? 'institution applications' : 'assigned applications'}</span><button class="table-action" data-page="applications">View all applications ${icon('arrow')}</button></div>`
    : `<div class="queue-empty"><div class="empty-icon">${icon('files')}</div><div class="empty-title">${institution ? 'No applications have been submitted for your institution.' : 'No applications currently assigned.'}</div><div class="empty-copy">${institution ? 'Application activity and rectification requests will appear here when available.' : 'New assignments and items requiring your attention will appear in this queue.'}</div>${hasPermission('application.create') ? button('Create application', 'create-application', 'plus', 'primary', 'style="margin-top:14px"') : ''}</div>`;
  const stages = analytics.byStatus || [];
  const stageBody = stages.length ? `<div class="stage-list">${stages.map((item) => `<div class="stage-row"><div class="stage-name">${escapeHtml(pretty(item.label))}</div><div class="stage-value">${number(item.value)}</div><div class="stage-track"><div class="stage-fill" style="width:${Math.max(3, Math.min(100, Number(item.value) / Math.max(analytics.totalApplications, 1) * 100))}%"></div></div></div>`).join('')}</div>` : `<div class="chart-empty">No application data has been received.</div>`;
  const readiness = [
    ['Document storage', 'Operational · private local storage', true],
    ['OCR provider', pretty(system.ocr), system.ocr === 'CONFIGURED'],
    ['Source verification', pretty(system.sourceVerification), system.sourceVerification === 'CONFIGURED'],
    ['Pramaan Sahayak', system.aiAssistant === 'RESPONDING' ? 'Gemini responding' : system.aiAssistant === 'UNAVAILABLE' ? 'Gemini unavailable · local help active' : system.aiAssistant === 'NOT_TESTED' ? 'Gemini configured · not tested' : pretty(system.aiAssistant), system.aiAssistant === 'RESPONDING'],
    ['Document AI reviewer', system.aiAssistant === 'RESPONDING' ? 'Ready · Gemini responding' : system.aiAssistant === 'UNAVAILABLE' ? 'Gemini unavailable · rule checks remain visible' : system.aiAssistant === 'NOT_TESTED' ? 'Gemini configured · not yet tested' : pretty(system.aiAssistant), system.aiAssistant === 'RESPONDING'],
    ['Decision authority', 'Human review required for every outcome', true],
  ];
  const actions = hasPermission('application.create') ? button('New application', 'create-application', 'plus', 'primary') : '';
  const hour = new Date().getHours();
  const greetingKey = hour < 12 ? 'dashboard.greetingMorning' : hour < 18 ? 'dashboard.greetingAfternoon' : 'dashboard.greetingEvening';
  const greeting = window.PramaanI18n.t(greetingKey);
  const firstName = String(state.user?.display_name || '').trim().split(/\s+/)[0] || 'there';
  const brand = escapeHtml(brandName());
  const heroDescription = window.PramaanI18n.t(institution ? 'dashboard.institutionWelcome' : 'dashboard.trustedPlatform');
  const quickActions = [
    hasPermission('application.create') ? `<button class="quick-action" type="button" data-action="create-application"><span class="quick-action-icon quick-blue">${icon('plus')}</span><span><strong>New application</strong><small>Start a verification workflow</small></span>${icon('chevron')}</button>` : '',
    hasPermission('document.read') ? `<button class="quick-action" type="button" data-page="documents"><span class="quick-action-icon quick-violet">${icon('file-check')}</span><span><strong>Open documents</strong><small>Review submitted evidence</small></span>${icon('chevron')}</button>` : '',
    hasPermission('finding.read') ? `<button class="quick-action" type="button" data-page="review-queue"><span class="quick-action-icon quick-green">${icon('list-filter')}</span><span><strong>Review queue</strong><small>Open items needing attention</small></span>${icon('chevron')}</button>` : '',
    hasPermission('report.generate') ? `<button class="quick-action" type="button" data-page="reports"><span class="quick-action-icon quick-orange">${icon('file-bar-chart')}</span><span><strong>Reports</strong><small>View available verification reports</small></span>${icon('chevron')}</button>` : '',
  ].filter(Boolean).join('');
  const hero = `<section class="dashboard-hero"><div class="hero-copy"><div class="hero-greeting">${escapeHtml(greeting)}, ${escapeHtml(firstName)} <span aria-hidden="true">👋</span></div><h1>${state.language === 'hi' ? `<span>${brand}</span> में आपका स्वागत है` : `Welcome to <span>${brand}</span>`}</h1><div class="hero-mantra" lang="hi">प्रमाण से विश्वास!</div><p>${escapeHtml(heroDescription)}</p><div class="hero-benefits"><span>${icon('shield-check')}Transparent process</span><i></i><span>${icon('scan-search')}Evidence-led review</span><i></i><span>${icon('landmark')}Stronger governance</span><i></i><span>${icon('users')}Empowered institutions</span></div></div><div class="hero-visual" aria-hidden="true"><img src="/india-gate-hero.png" alt=""><div class="hero-national-message">${window.PramaanI18n.t('dashboard.digitalIndia')}<br><strong>${window.PramaanI18n.t('dashboard.strongerIndia')}</strong><span class="tricolor-mark"></span></div></div>${actions ? `<div class="hero-action">${actions}</div>` : ''}</section>`;
  const stagePanel = `<section class="panel side-panel stage-panel"><div class="side-panel-heading">${icon('chart-no-axes-combined')}<div><h2 class="panel-title">Applications by stage</h2><div class="panel-subtitle">Current recorded workload</div></div></div>${stageBody}</section>`;
  const quickPanel = `<section class="panel side-panel quick-panel"><div class="side-panel-heading">${icon('sparkles')}<div><h2 class="panel-title">Quick actions</h2><div class="panel-subtitle">Common tasks for your role</div></div></div><div class="quick-action-list">${quickActions || '<div class="quick-empty">Your available tools appear here.</div>'}</div></section>`;
  const quotePanel = `<section class="governance-quote"><div class="quote-mark">“</div><p>Good governance begins with clear, traceable evidence.</p><span class="quote-tricolor" aria-hidden="true"></span></section>`;
  const aiTestAction = hasPermission('integration.manage') && system.aiConfigured ? `<div class="readiness-test-action">${button('Test Gemini connection','test-ai-connection','activity','secondary')}</div>` : '';
  main.innerHTML = hero
    + `<div class="notice-strip dashboard-notice">${icon('info')}<span><strong>Decision support only.</strong> Automated findings are evidence-linked review aids. Statutory scrutiny and final regulatory decisions remain with competent authorities. Eligibility is on each application’s Eligibility tab; Fire NOC test files are in Integration Center.</span><button class="table-action" type="button" data-page="integrations">Open Fire NOC test kit</button></div>`
    + metricGrid
    + outcomePanel
    + `<div class="dashboard-grid"><div class="dashboard-main-column">${panel(institution ? 'My Applications' : 'My Work Queue', `<div class="queue-panel-body">${queueBody}</div>`, institution ? 'Current application status and recent activity' : 'Priority-ranked applications assigned to your review', button('Filter', 'applications', 'list-filter'))}<div class="dashboard-lower-grid">${stagePanel}${quotePanel}</div></div><aside class="dashboard-aside">${quickPanel}<section class="panel side-panel readiness-panel"><div class="side-panel-heading">${icon('settings-2')}<div><h2 class="panel-title">Workspace readiness</h2><div class="panel-subtitle">Current service configuration</div></div></div>${readiness.map(([label, value, active]) => `<div class="readiness-row"><span class="readiness-dot ${active ? 'on' : ''}"></span><div class="readiness-copy"><div class="readiness-name">${escapeHtml(label)}</div><div class="readiness-state">${escapeHtml(value)}</div></div></div>`).join('')}${aiTestAction}</section><section class="help-card"><div class="help-icon">${icon('users')}</div><div><strong>Need help?</strong><p>Ask Sahayak for guidance on records and workflows.</p><button type="button" data-action="toggle-assistant">Ask Sahayak ${icon('arrow')}</button></div><span class="help-leaf" aria-hidden="true">✦</span></section></aside></div>`;
}

function renderShellHeaderOnly() {
  const topUserRole = document.querySelector('.top-user-role');
  if (topUserRole && state.user) topUserRole.textContent = (state.user.roles || []).map(pretty).join(' · ');
}

async function renderApplications(main) {
  const params = new URLSearchParams({ page: String(state.applicationPage), limit: '20', q: state.applicationQuery, ...state.applicationFilters });
  const [result, categories, savedFilters, officers] = await Promise.all([
    api(`/api/v1/applications?${params}`), api('/api/v1/application-categories'), api('/api/v1/saved-filters?resource=applications'),
    hasPermission('application.assign') ? api('/api/v1/officers') : Promise.resolve({data:[]}),
  ]);
  state.categories = categories.data;
  state.savedFilters = savedFilters.data;
  const records = result.data;
  const title = isInstitutionUser() ? 'Applications' : 'Applications';
  const outcomeOptions = [['','All outcomes'],['APPROVED','Accepted by authority'],['REJECTED','Rejected by authority'],['EXPIRED','Expired evidence'],['VERIFIED','Source verified'],['CHECKS_PASSED','Rules passed · pending authority'],['REVIEW_REQUIRED','Needs review'],['PROCESSING','Processing'],['NOT_VERIFIED','Not verified / decision pending']];
  const outcomeFilter = `<div class="outcome-filter-row"><label for="applications-outcome">Review outcome</label><select id="applications-outcome" class="filter-select" data-filter="outcome">${outcomeOptions.map(([value,label])=>`<option value="${value}" ${String(state.applicationFilters.outcome||'')===value?'selected':''}>${escapeHtml(label)}</option>`).join('')}</select><span class="cell-secondary">Accepted and rejected outcomes require a recorded authority decision.</span></div>`;
  const toolbar = `<div class="toolbar"><div class="toolbar-left"><form class="topbar-search" data-form="application-search" style="width:215px">${icon('search')}<label class="sr-only" for="applications-search">Search applications</label><input id="applications-search" class="search-input" name="q" placeholder="Search ID, institution…" value="${escapeHtml(state.applicationQuery)}"></form><select class="filter-select" aria-label="Filter by category" data-filter="category"><option value="">All categories</option>${categories.data.map((category) => `<option value="${escapeHtml(category.id)}" ${state.applicationFilters.category===category.id?'selected':''}>${escapeHtml(category.label)}</option>`).join('')}</select><input class="filter-select" aria-label="Filter by academic year" data-filter="year" placeholder="Academic year" value="${escapeHtml(state.applicationFilters.year||'')}"><input class="filter-select" aria-label="Filter by state or UT" data-filter="state" placeholder="State / UT" value="${escapeHtml(state.applicationFilters.state||'')}"><select class="filter-select" aria-label="Filter by processing stage" data-filter="stage"><option value="">All stages</option>${['RECEIVED','PRE_VALIDATION','DOCUMENT_PROCESSING','SOURCE_VERIFICATION','COMPLIANCE_REVIEW','OFFICER_REVIEW','RECTIFICATION_REQUIRED','RECTIFICATION_RECEIVED','INSPECTION_RECOMMENDED','INSPECTION_IN_PROGRESS','FINAL_REVIEW','COMPLETED'].map((value) => `<option value="${value}" ${state.applicationFilters.stage===value?'selected':''}>${escapeHtml(pretty(value))}</option>`).join('')}</select>${!isInstitutionUser() ? `<select class="filter-select" aria-label="Filter by priority" data-filter="priority"><option value="">All priorities</option>${['LOW','MEDIUM','HIGH','CRITICAL REVIEW'].map((value) => `<option value="${value}" ${state.applicationFilters.priority===value?'selected':''}>${escapeHtml(value)}</option>`).join('')}</select><select class="filter-select" aria-label="Filter by verification status" data-filter="verification"><option value="">All verification</option>${['PENDING','VERIFIED','MISMATCH_DETECTED','SOURCE_UNAVAILABLE','INCONCLUSIVE'].map((value)=>`<option value="${value}" ${state.applicationFilters.verification===value?'selected':''}>${escapeHtml(pretty(value))}</option>`).join('')}</select><select class="filter-select" aria-label="Filter by assigned officer" data-filter="assigned"><option value="">All officers</option>${officers.data.map((item)=>`<option value="${escapeHtml(item.id)}" ${state.applicationFilters.assigned===item.id?'selected':''}>${escapeHtml(item.display_name)}</option>`).join('')}</select><select class="filter-select" aria-label="Filter by due date" data-filter="due"><option value="">Any due date</option><option value="overdue" ${state.applicationFilters.due==='overdue'?'selected':''}>Overdue</option><option value="upcoming" ${state.applicationFilters.due==='upcoming'?'selected':''}>Due in 7 days</option></select>` : ''}<select class="filter-select" aria-label="Choose saved filter" data-saved-filter><option value="">Saved filters</option>${savedFilters.data.map((item)=>`<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('')}</select><button class="btn btn-secondary" type="button" data-action="save-filter">Save filter</button></div><div class="toolbar-right"><span class="cell-secondary">${number(result.meta.total)} records</span></div></div>`;
  const actions = hasPermission('application.create') ? button('Create application', 'create-application', 'plus', 'primary') : '';
  let body;
  if (!records.length) body = emptyState(state.applicationQuery ? 'No matching applications.' : 'No applications available.', 'Applications arrive through the authorized workflow or are submitted from your institution account.', hasPermission('application.create') ? button('Create application', 'create-application', 'plus', 'primary') : '');
  else {
    const officer = !isInstitutionUser();
    const rows = records.map((row) => `<tr>${[
      ['Application ID', `<button class="table-link" data-action="open-application" data-id="${escapeHtml(row.id)}">${escapeHtml(row.id)}</button>`],
      ['Institution', `<div class="cell-primary">${escapeHtml(row.institution_name)}</div><div class="cell-secondary">${escapeHtml(row.aicte_id)}</div>`],
      ['Category', escapeHtml(row.category_label)], ['Academic Year', escapeHtml(row.academic_year)], ['State / UT', escapeHtml(row.state_ut || '—')],
      ['Submitted', date(row.submission_date)], ['Processing Stage', badge(row.processing_stage)], ['Review Outcome', badge(row.review_outcome)], ['Validation', badge(row.validation_status)],
      ['Verification', badge(row.verification_status)], ['Eligibility (last assessment)', eligibilityListCell(row)], ...(officer ? [['Priority', `<span class="priority ${slug(row.attention_priority)}" title="${escapeHtml(row.priority_factors.join('; '))}">${escapeHtml(row.attention_priority)}</span>`], ['Assigned Officer', escapeHtml(row.assigned_officer || 'Unassigned')]] : []),
      ['Updated', date(row.updated_at)], ['Action', `<button class="table-action" data-action="open-application" data-id="${escapeHtml(row.id)}">Open ${icon('arrow')}</button>`],
    ].map(([label, value]) => `<td data-label="${escapeHtml(label)}">${value}</td>`).join('')}</tr>`).join('');
    body = `<div class="table-wrap"><table><thead><tr>${['Application ID','Institution','Category','Academic Year','State / UT','Submitted','Processing Stage','Review Outcome','Validation','Verification','Eligibility (last assessment)',...(officer?['Priority','Assigned Officer']:[]),'Updated','Action'].map((x) => `<th>${escapeHtml(x)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>${pagination(result.meta, state.applicationPage, 'applications-page')}`;
  }
  main.innerHTML = header(title, 'Search, filter and review institutional application records', actions) + panel('Application Outcomes', outcomeFilter, 'Authority decisions are recorded separately from automated evidence checks.') + panel('Application Register', `${toolbar}${body}`, 'Database-backed results with server-side pagination');
}

async function renderGlobalSearch(main) {
  if(String(state.globalQuery||'').trim().length<2)return main.innerHTML=header('Search','Search application, institution, document-reference and extracted certificate fields.')+emptyState('Enter at least two characters.','Search results are database-backed and respect your institution access scope.');
  const result=await api(`/api/v1/search?q=${encodeURIComponent(state.globalQuery)}&limit=20`);
  const {applications,institutions,documents}=result.data;
  const applicationContent=applications.length?`<div class="record-list">${applications.map((item)=>`<div class="record-row" role="button" tabindex="0" data-action="open-application" data-id="${escapeHtml(item.id)}"><div class="record-icon">${icon('files')}</div><div class="record-main"><div class="record-title">${escapeHtml(item.id)} · ${escapeHtml(item.institution_name)}</div><div class="record-meta"><span>${escapeHtml(item.aicte_id)}</span><span>${escapeHtml(item.category_label)}</span><span>${escapeHtml(item.academic_year)}</span><span>${escapeHtml(pretty(item.processing_stage))}</span></div></div>${icon('chevron','record-arrow')}</div>`).join('')}</div>`:emptyState('No matching applications.','');
  const institutionContent=institutions.length?`<div class="record-list">${institutions.map((item)=>`<div class="record-row" role="button" tabindex="0" data-action="open-institution" data-id="${escapeHtml(item.id)}"><div class="record-icon">${icon('building')}</div><div class="record-main"><div class="record-title">${escapeHtml(item.name)}</div><div class="record-meta"><span>Institution reference ${escapeHtml(item.aicte_id)}</span><span>${escapeHtml(item.state_ut||'State/UT not recorded')}</span></div></div>${icon('chevron','record-arrow')}</div>`).join('')}</div>`:emptyState('No matching institutions.','');
  const documentContent=documents.length?`<div class="record-list">${documents.map((item)=>`<div class="record-row" role="button" tabindex="0" data-action="open-document" data-id="${escapeHtml(item.id)}"><div class="record-icon">${icon('file-search')}</div><div class="record-main"><div class="record-title">${escapeHtml(item.original_name)} · ${escapeHtml(item.document_type)}</div><div class="record-meta"><span>${escapeHtml(item.institution_name)}</span><span>${escapeHtml(item.application_id)}</span><span>Version ${number(item.version_number)}</span><span>Reference ${escapeHtml(item.sha256.slice(0,12))}…</span></div></div>${icon('chevron','record-arrow')}</div>`).join('')}</div>`:emptyState('No matching documents or certificate fields.','');
  const total=applications.length+institutions.length+documents.length;
  main.innerHTML=header('Search Results',`${number(total)} matching records for “${state.globalQuery}”`)
    +`<div class="detail-stack">${panel('Applications',applicationContent)}${panel('Institutions',institutionContent)}${panel('Documents & Certificate Data',documentContent)}</div>`;
}

function pagination(meta, page, action) {
  const start = meta.total ? (page - 1) * meta.limit + 1 : 0;
  const end = Math.min(page * meta.limit, meta.total);
  return `<div class="pagination"><span>Showing ${number(start)}–${number(end)} of ${number(meta.total)}</span><div class="pagination-actions"><button class="btn btn-secondary" type="button" data-action="${action}" data-page-number="${Math.max(page - 1, 1)}" ${page <= 1 ? 'disabled' : ''}>Previous</button><button class="btn btn-secondary" type="button" data-action="${action}" data-page-number="${page + 1}" ${page >= meta.pages ? 'disabled' : ''}>Next</button></div></div>`;
}

async function renderInstitutions(main) {
  const result = await api(`/api/v1/institutions?page=${state.institutionPage}&limit=20&q=${encodeURIComponent(state.institutionQuery)}`);
  const data = result.data;
  const actions = hasPermission('institution.manage') ? button('Add institution', 'create-institution', 'plus', 'primary') : '';
  const records = data.length ? `<div class="record-list">${data.map((row) => `<div class="record-row" role="button" tabindex="0" data-action="open-institution" data-id="${escapeHtml(row.id)}"><div class="record-icon">${icon('building')}</div><div class="record-main"><div class="record-title">${escapeHtml(row.name)}</div><div class="record-meta"><span>Institution reference ${escapeHtml(row.aicte_id)}</span><span>${escapeHtml(row.district ? `${row.district}, ` : '')}${escapeHtml(row.state_ut || 'State/UT not recorded')}</span><span>${number(row.application_count)} applications</span></div></div><div class="record-end">${badge(row.current_approval_status)}${icon('chevron', 'record-arrow')}</div></div>`).join('')}</div>${pagination(result.meta, state.institutionPage, 'institutions-page')}` : emptyState('No institution records found.', 'Institution master records are created through authorized integration or by a regulatory administrator.', hasPermission('institution.manage') ? button('Add institution', 'create-institution', 'plus', 'primary') : '');
  const toolbar = `<div class="toolbar"><form class="topbar-search" data-form="institution-search" style="width:300px">${icon('search')}<label class="sr-only" for="institution-search">Search institutions</label><input id="institution-search" class="search-input" name="q" placeholder="Search name, institution reference, state…" value="${escapeHtml(state.institutionQuery)}"></form><span class="cell-secondary">${number(result.meta.total)} records</span></div>`;
  main.innerHTML = header('Institutions', 'Persistent master records and regulatory history', actions) + panel('Institution Register', `${toolbar}${records}`, `${number(result.meta.total)} registered institutions`);
}

async function renderApplication(main) {
  const result = await api(`/api/v1/applications/${encodeURIComponent(state.applicationId)}`);
  const { application, counts, documents, findings, verifications, compliance, rectifications, inspections, audit, sourceAuditEvents = [], sourceRecord, eligibility } = result.data;
  const app = application;
  const title = app.institution_name || app.id;
  const assignment = hasPermission('application.assign') ? button('Assign officer', 'assign-officer', 'users', 'secondary', `data-id="${escapeHtml(app.id)}"`) : '';
  const report = hasPermission('report.generate') ? button('Generate report', 'generate-report', 'file-bar-chart', 'primary', `data-id="${escapeHtml(app.id)}"`) : '';
  const stageButton = hasPermission('application.review') ? `<button type="button" class="btn btn-secondary" data-action="advance-stage" data-stage="${escapeHtml(nextStage(app.processing_stage))}" data-id="${escapeHtml(app.id)}" ${nextStage(app.processing_stage) ? '' : 'disabled'}>Advance stage</button>` : '';
  const stateBadge = pretty(app.processing_stage);
  const overview = `<div class="info-grid">${[
    ['Application ID', app.id], ['Institution reference', app.aicte_id], ['Application Category', app.category_label], ['Academic Year', app.academic_year], ['Submission Date', date(app.submission_date)], ['Processing Stage', pretty(app.processing_stage)], ['Validation Status', pretty(app.validation_status)], ['Verification Status', pretty(app.verification_status)], ['Assigned Officer', isInstitutionUser() ? 'Restricted' : app.assigned_officer || 'Unassigned'], ['Due Date', date(app.due_date)],
    ...(sourceRecord ? [['Dataset scenario', sourceRecord.scenario],['Dataset assigned officer',sourceRecord.assigned_officer],['Record origin',sourceRecord.record_origin]] : []),
  ].map(([label, value]) => `<div class="info-item"><div class="info-label">${escapeHtml(label)}</div><div class="info-value">${escapeHtml(value || '—')}</div></div>`).join('')}</div>`;
  const findingContent = isInstitutionUser() ? `<div class="notice-strip">${icon('info')}<span>Internal review findings are available to authorized officers. Rectification requests intended for your institution are shown in the Rectification tab.</span></div>` : findings.length ? findings.map((item) => findingCard(item)).join('') : emptyState('No findings recorded.', 'Evidence-linked findings will appear here when they are created.');
  const documentContent = documents.length ? table(['Document','Type','Version','Processing','Document AI','Source verification','File','Uploaded'], documents.map((item) => [
    `<button class="table-link" style="overflow-wrap:anywhere;max-width:320px;text-align:left" data-action="open-document" data-id="${escapeHtml(item.id)}">${escapeHtml(item.original_name || item.id)}</button>`, escapeHtml(item.document_type), `v${number(item.version_number)}`, badge(item.processing_status), badge(item.ai_review?.status || (['QUEUED','RUNNING'].includes(item.ai_job_status) ? 'AI_PROCESSING' : !item.file_available ? 'FILE_REQUIRED' : isDocumentAiSupported(item.document_type) ? 'NOT_RUN' : 'NOT_APPLICABLE')), badge(item.verification_result), escapeHtml(fileAvailability(item)), date(item.uploaded_at),
  ])) : emptyState('No documents have been received.', 'Documents remain private and are versioned whenever replacement evidence is submitted.', hasPermission('document.upload') ? button('Upload document', 'upload-document', 'upload', 'primary', `data-application-id="${escapeHtml(app.id)}"`) : '');
  const verifyContent = isInstitutionUser() ? emptyState('Source verification details are restricted.', 'Authorized verification officers review source responses.') : verifications.length ? table(['Provider','Result','Requested','Response','Submitted / source values','Evidence'], verifications.map((item) => [escapeHtml(item.provider), badge(item.result), date(item.requested_at, true), date(item.responded_at, true), `<details><summary>Compare values</summary><strong>Submitted</strong><pre>${escapeHtml(item.submitted_values)}</pre><strong>Source</strong><pre>${escapeHtml(item.source_values)}</pre></details>`, escapeHtml(item.evidence_reference || item.error_message || '—')])) : emptyState('No source verification requests.', 'A verification officer can request validation through an authorized provider.');
  const complianceContent = isInstitutionUser() ? emptyState('Compliance review details are restricted.', 'Any action for your institution will appear as a rectification request.') : compliance.length ? table(['Requirement','Rule set','Status','Reason','Recommended action'], compliance.map((item) => [escapeHtml(item.requirement), `${escapeHtml(item.rule_set)} v${number(item.version_number)}`, badge(item.status), `<span class="copy-cell">${escapeHtml(item.reason || '—')}</span>`, `<span class="copy-cell">${escapeHtml(item.recommended_action || item.rule_action || '—')}</span>`])) : emptyState('No compliance results stored.', 'Results will appear after an applicable versioned rule set has been executed.');
  const rectificationContent = rectifications.length ? table(['Issue','Required action','Deadline','Status','Response'], rectifications.map((item) => [escapeHtml(item.issue), `<span class="copy-cell">${escapeHtml(item.required_action)}</span>`, date(item.deadline), badge(item.status), escapeHtml(item.response || '—')])) : emptyState('No rectification requests.', 'If additional information is required, authorized officers will record it here.');
  const inspectionContent = isInstitutionUser() && !inspections.length ? emptyState('No scheduled inspection.', 'Scheduled inspection information will appear here when applicable.') : inspections.length ? table(['Inspection','Status','Reason','Scheduled','Observations'], inspections.map((item) => [escapeHtml(item.id), badge(item.status), escapeHtml(item.recommendation_reason), date(item.scheduled_at, true), escapeHtml(item.observations || '—')])) : emptyState('No inspection cases.', 'Inspection is considered when evidence or review needs warrant it.');
  const extractionContent = documents.length ? table(['Document','Field','Value','Confidence','Page','Evidence location'], documents.flatMap((doc) => (doc.extracted_fields || []).map((field) => [escapeHtml(doc.original_name), escapeHtml(field.field_name), escapeHtml(field.field_value), field.confidence === null ? '—' : `${Math.round(field.confidence * 100)}%`, escapeHtml(field.page_number || '—'), escapeHtml(field.evidence_location || '—')]))) : emptyState('No extracted fields.', 'Structured extracted fields retain page and evidence-location references.');
  const decisionContent = result.data.decisions?.length ? table(['Outcome','Reason','Recorded by','Recorded at'], result.data.decisions.map((item)=>[badge(item.decision),escapeHtml(item.reason||'Reason visible to authorized officers only'),escapeHtml(item.decided_by||'Authorized officer'),date(item.decided_at,true)])) : emptyState('No authority decision recorded.', 'Automated checks do not accept or reject applications. An authorized approving authority records the final outcome here.');
  const crossContent = comparisonTable(result.data.crossComparisons || []);
  const sourceAuditContent = sourceAuditEvents.length ? datasetNotice('These are historical synthetic events supplied by the dataset. They are separate from the workspace audit trail.') + timeline(sourceAuditEvents.map((item) => ({title: pretty(item.action),created_at: item.event_time,detail: `Dataset actor: ${item.actor_id}`}))) : '';
  const auditContent = audit.length ? timeline(audit.map((item) => ({ title: pretty(item.action), created_at: item.created_at, detail: item.reference }))) : emptyState('No audit events available.', 'Application workflow events are retained in the append-only audit trail.');
  const eligibilityContent = eligibilityPanel(eligibility, hasPermission('rule.read') && !isInstitutionUser());
  const ruleAvailability = app.rule_availability || { published: 0, drafts: 0 };
  const tabs = [
    ['eligibility', 'Eligibility', eligibilityContent],
    ['overview', 'Overview', panel('Current review outcome', `<div class="info-grid">${[['Outcome',pretty(app.review_outcome)],['Authority decision',pretty(app.final_decision||'PENDING')],['Validation checks',pretty(app.validation_status)],['Source verification',pretty(app.verification_status)]].map(([label,value])=>`<div class="info-item"><div class="info-label">${escapeHtml(label)}</div><div class="info-value">${escapeHtml(value)}</div></div>`).join('')}</div><div class="eligibility-note">A passed rule check is evidence for review; only an authorized officer can record an accepted or rejected outcome.</div>`) + panel('Next actions', (result.data.blockers||[]).length ? '<ul>'+result.data.blockers.map(b=>'<li>'+escapeHtml(b)+'</li>').join('')+'</ul>' : 'No recorded blockers. Authorized human review remains required.') + panel('Verification scope', (result.data.capabilities||[]).map(c=>'<p><strong>'+escapeHtml(c.documentType)+'</strong> · '+escapeHtml(c.support)+' · '+escapeHtml(c.source)+'</p>').join(''))], ['application-data', 'Application Data', overview], ['documents', 'Documents', documentContent], ['extracted', 'Extracted Data', extractionContent], ['cross', 'Cross Verification', crossContent], ['source', 'Source Verification', verifyContent], ['compliance', 'Regulatory Compliance', complianceContent], ['infrastructure', 'Infrastructure', await infrastructureFor(app.id)], ['findings', 'Findings & Evidence', findingContent], ['rectification', 'Rectification', rectificationContent], ['inspection', 'Inspections', inspectionContent], ['decisions', 'Decision History', decisionContent], ['audit', 'Audit Trail', auditContent], ...(sourceAuditContent ? [['source-history','Dataset History',sourceAuditContent]] : []),
  ];
  const decisionButton = hasPermission('application.decide') && ['OFFICER_REVIEW','FINAL_REVIEW','COMPLETED','RECTIFICATION_REQUIRED'].includes(app.processing_stage) ? button('Record authority decision','record-application-decision','shield-check','secondary',`data-id="${escapeHtml(app.id)}"`) : '';
  const ruleReviewButton = hasPermission('application.review') && ruleAvailability.published > 0 ? button('Run applicable rules','execute-application-rules','sparkles','secondary',`data-id="${escapeHtml(app.id)}"`) : '';
  const rulesSetupButton = !ruleAvailability.published && hasPermission('rule.read') ? button(ruleAvailability.drafts ? 'Test draft rules' : 'Open rules setup','rules','book-open-check','secondary') : '';
  const actions = `${ruleReviewButton}${rulesSetupButton}${decisionButton}${assignment}${stageButton}${report}`;
  main.innerHTML = header(title, `${app.id} · ${app.aicte_id} · ${app.category_label} · ${app.academic_year}`, actions)
    + datasetNotice(result.data.datasetNotice)
    + (!ruleAvailability.published && hasPermission('rule.read') ? `<div class="notice-strip">${icon('info')}<span><strong>No published rules currently apply to this application.</strong> ${ruleAvailability.drafts ? `${number(ruleAvailability.drafts)} draft rule version(s) can be tested without changing the application outcome.` : 'An authorized officer must publish an applicable rule version before an automatic review can run.'} <button class="table-action" type="button" data-page="rules">Open regulatory rules</button></span></div>` : '')
    + `<div class="notice-strip">${icon('shield-check')}<span><strong>Human review remains mandatory.</strong> pramaan provides evidence-linked decision support and does not independently approve or reject an institution.</span></div>`
    + panel('Application Workspace', `<div class="tabs" role="tablist">${tabs.map(([id, label], index) => `<button class="tab-button ${index === 0 ? 'active' : ''}" role="tab" aria-selected="${index === 0}" data-tab="${escapeHtml(id)}">${escapeHtml(label)}</button>`).join('')}</div><div class="detail-body" id="application-tab-content">${tabs[0][2]}</div>`, `${stateBadge} · Updated ${date(app.updated_at, true)}`)
    + `<div class="metrics-grid compact-metrics">${[
      ['Documents received', counts.documents, 'file-check'], ['Documents verified', counts.documentsVerified, 'shield-check'],
      ...(isInstitutionUser() ? [] : [
        ['Required documents missing', counts.missingDocuments, 'file-search'], ['Expired records', counts.expiredDocuments, 'clock'],
        ['Open findings', counts.findings, 'alert'], ['Pending verification', counts.pendingVerification, 'clock'],
        ['Compliance review', counts.complianceReview, 'clipboard-list'], ['Infrastructure review', counts.infrastructurePending, 'building'],
      ]),
      ['Open rectifications', counts.rectifications, 'file-clock'],
    ].map(([label, value, iconName]) => `<article class="metric-card"><div class="metric-head"><div class="metric-label">${escapeHtml(label)}</div><div class="metric-icon">${icon(iconName)}</div></div><div class="metric-value">${value === null ? '—' : number(value)}</div>${value === null ? '<div class="metric-foot">Not evaluated</div>' : ''}</article>`).join('')}</div>`;
  document.querySelectorAll('[data-tab]').forEach((tab) => tab.addEventListener('click', () => {
    document.querySelectorAll('[data-tab]').forEach((node) => { node.classList.remove('active'); node.setAttribute('aria-selected', 'false'); });
    tab.classList.add('active'); tab.setAttribute('aria-selected', 'true'); const target = tabs.find((item) => item[0] === tab.dataset.tab);
    document.getElementById('application-tab-content').innerHTML = target?.[2] || '';
  }));
}

function nextStage(stage) {
  const next = { RECEIVED: 'PRE_VALIDATION', PRE_VALIDATION: 'DOCUMENT_PROCESSING', DOCUMENT_PROCESSING: 'SOURCE_VERIFICATION', SOURCE_VERIFICATION: 'COMPLIANCE_REVIEW', COMPLIANCE_REVIEW: 'OFFICER_REVIEW', OFFICER_REVIEW: 'FINAL_REVIEW', RECTIFICATION_REQUIRED: 'RECTIFICATION_RECEIVED', RECTIFICATION_RECEIVED: 'OFFICER_REVIEW', INSPECTION_RECOMMENDED: 'INSPECTION_IN_PROGRESS', INSPECTION_IN_PROGRESS: 'FINAL_REVIEW', FINAL_REVIEW: 'COMPLETED' };
  return next[stage] || '';
}

function table(headers, rows) {
  if (!rows.length) return emptyState('No records available.', 'Stored records will appear here as authorized workflows create them.');
  return `<div class="table-wrap"><table><thead><tr>${headers.map((head) => `<th scope="col">${escapeHtml(head)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function findingCard(item, historical=false) {
  const actions = !historical && hasPermission('finding.review') ? `<div class="finding-actions"><button class="btn btn-secondary" data-action="review-finding" data-id="${escapeHtml(item.id)}" data-review="ACCEPT">Accept finding</button><button class="btn btn-secondary" data-action="review-finding" data-id="${escapeHtml(item.id)}" data-review="DISMISS">Dismiss</button><button class="btn btn-secondary" data-action="review-finding" data-id="${escapeHtml(item.id)}" data-review="REQUEST_CLARIFICATION">Request clarification</button><button class="btn btn-secondary" data-action="review-finding" data-id="${escapeHtml(item.id)}" data-review="REQUEST_RECTIFICATION">Request rectification</button><button class="btn btn-secondary" data-action="review-finding" data-id="${escapeHtml(item.id)}" data-review="REQUEST_EVIDENCE">Request additional evidence</button>${hasPermission('verification.request') ? `<button class="btn btn-secondary" data-action="verify-from-finding" data-application-id="${escapeHtml(item.application_id)}" data-id="${escapeHtml(item.id)}">Send for verification</button>` : ''}${hasPermission('inspection.recommend') ? `<button class="btn btn-secondary" data-action="review-finding" data-id="${escapeHtml(item.id)}" data-review="RECOMMEND_INSPECTION">Recommend inspection</button>` : ''}<button class="btn btn-secondary" data-action="review-finding" data-id="${escapeHtml(item.id)}" data-review="ESCALATE">Escalate</button><button class="btn btn-secondary" data-action="review-finding" data-id="${escapeHtml(item.id)}" data-review="RESOLVE">Resolve</button></div>` : '';
  return `<article class="finding-card"><div class="finding-top"><div class="finding-main"><div class="finding-title">${escapeHtml(item.title)} <span style="margin-left:7px">${badge(item.severity)}</span> <span style="margin-left:3px">${badge(item.status)}</span></div><div class="finding-text">${escapeHtml(item.description)}</div>${item.reason ? `<div class="finding-text"><strong>Reason:</strong> ${escapeHtml(item.reason)}</div>` : ''}<div class="finding-text"><strong>Recommended action:</strong> ${escapeHtml(item.recommended_action || 'Officer review required.')}</div><div class="finding-text">${item.source === 'SYNTHETIC_DATASET_IMPORT' ? 'Imported synthetic test finding' : item.source === 'AI' ? 'Automated preliminary finding' : 'Officer recorded finding'}${item.confidence === null ? '' : ` · Confidence ${Math.round(Number(item.confidence) * 100)}%`} · ${date(item.created_at, true)}</div>${actions}</div></div></article>`;
}

function timeline(items) {
  if (!items.length) return emptyState('No timeline events.', 'Recorded events will appear here.');
  return `<div class="timeline">${items.map((item) => `<div class="timeline-item"><div class="timeline-title">${escapeHtml(item.title || pretty(item.action))}</div>${item.detail ? `<div class="finding-text">${escapeHtml(item.detail)}</div>` : ''}<div class="timeline-date">${date(item.created_at, true)}</div></div>`).join('')}</div>`;
}

async function infrastructureFor(applicationId) {
  const result = await api(`/api/v1/infrastructure?applicationId=${encodeURIComponent(applicationId)}`);
  return result.data.length ? table(['Category','Institution claim','Review status','Created'], result.data.map((item) => [escapeHtml(item.category), `<span class="copy-cell">${escapeHtml(item.institution_claim)}</span>`, badge(item.review_status), date(item.created_at)])) : emptyState('No infrastructure evidence registered.', 'Infrastructure claims and evidence can be reviewed without replacing required physical inspection.');
}

async function renderInstitution(main) {
  const result = await api(`/api/v1/institutions/${encodeURIComponent(state.institutionId)}`);
  const { institution: item, history, approvals, programmes, timeline: events, faculty = [] } = result.data;
  const fields = [
    ['Institution reference', item.aicte_id], ['Institution Type', item.institution_type], ['Address', item.address], ['District', item.district], ['State / UT', item.state_ut], ['Establishment Year', item.establishment_year], ['Affiliating University', item.affiliating_university], ['Current Approval Status', item.current_approval_status],
    ...(result.data.sourceRecord ? [['Country',result.data.sourceRecord.country],['Website',result.data.sourceRecord.website],['Regulatory scope',result.data.sourceRecord.regulatory_scope],['Identity origin',result.data.sourceRecord.record_origin]] : []),
  ];
  main.innerHTML = header(item.name, `${item.aicte_id} · Institution 360`, button('Back to institutions', 'back-institutions', 'chevron-left'))
    + datasetNotice(result.data.datasetNotice)
    + panel('Institution Profile', `<div class="info-grid">${fields.map(([label, value]) => `<div class="info-item"><div class="info-label">${escapeHtml(label)}</div><div class="info-value">${escapeHtml(value || '—')}</div></div>`).join('')}</div>`)
    + `<div class="detail-grid" style="margin-top:14px"><div class="detail-stack">${panel('Application History', history.length ? table(['Application','Category','Academic Year','Stage','Validation','Verification','Last Activity'], history.map((row) => [`<button class="table-link" data-action="open-application" data-id="${escapeHtml(row.id)}">${escapeHtml(row.id)}</button>`, escapeHtml(row.category_label), escapeHtml(row.academic_year), badge(row.processing_stage), badge(row.validation_status), badge(row.verification_status), date(row.updated_at)])) : emptyState('No application history.', 'Applications associated with this institutional record will appear here.'))}${panel(result.data.datasetNotice ? 'Imported Programmes' : 'Approved Programmes', programmes.length ? table(['Programme','Level',result.data.datasetNotice ? 'Declared Intake' : 'Approved Intake','Record / note'], programmes.map((row) => [escapeHtml(row.name), escapeHtml(row.sourceRecord?.level || '—'), escapeHtml(row.sourceRecord?.intake_capacity ?? row.approved_intake ?? '—'), `<span class="copy-cell">${escapeHtml(row.sourceRecord?.note || row.approval_record_id || '—')}</span>`])) : emptyState('No programme records stored.', 'Approved programme records are populated from authorized information sources.'))}${faculty.length ? panel('Faculty Records', table(['Name','Department','Qualification','Employment status'], faculty.map((row) => [escapeHtml(row.display_name),escapeHtml(row.department),escapeHtml(row.qualification),badge(row.employment_status)])), `${number(faculty.length)} imported faculty records`) : ''}${panel('Approval History', approvals.length ? table(['Academic Year','Status','Effective From','Effective Until','Reference'], approvals.map((row) => [escapeHtml(row.academic_year), badge(row.status), date(row.effective_from), date(row.effective_until), escapeHtml(row.reference || '—')])) : emptyState('No approval history stored.', 'Authorized historical approval records will appear here.'))}</div><aside>${panel('Institution Timeline', timeline(events.map((item) => ({ title: pretty(item.action), created_at: item.created_at, detail: item.reference }))))}</aside></div>`;
  main.insertAdjacentHTML('beforeend', panel('Internal eligibility by application', history.length ? table(['Application','Criteria satisfied','Verification coverage','Internal status'], history.map((row)=>[
    `<button class="table-link" data-action="open-application" data-id="${escapeHtml(row.id)}">${escapeHtml(row.id)}</button>`,
    row.eligibility_percent===null||row.eligibility_percent===undefined?'—':`${Number(row.eligibility_percent)}%`,
    row.eligibility_coverage===null||row.eligibility_coverage===undefined?'—':`${Number(row.eligibility_coverage)}%`,
    badge(row.eligibility_status||'NOT_EVALUATED'),
  ])) : emptyState('No application assessments yet.','An eligibility assessment is calculated after published internal rules are linked to current evidence.')));
}

async function renderDocuments(main) {
  const result = await api(`/api/v1/documents?page=${state.documentPage}&limit=50`);
  const data = result.data;
  const docs = data.length ? table(['Document','Institution','Application','Category','Version','Processing','Document AI','Verification','File','Uploaded'], data.map((item) => [`<button class="table-link" style="overflow-wrap:anywhere;max-width:320px;text-align:left" data-action="open-document" data-id="${escapeHtml(item.id)}">${escapeHtml(item.original_name)}</button>`, escapeHtml(item.institution_name), `<button class="table-link" data-action="open-application" data-id="${escapeHtml(item.application_reference)}">${escapeHtml(item.application_reference)}</button>`, escapeHtml(item.document_type), `v${number(item.version_number)}`, badge(item.processing_status), badge(item.ai_review_status || (['QUEUED','RUNNING'].includes(item.ai_job_status) ? 'AI_PROCESSING' : isDocumentAiSupported(item.document_type) ? 'NOT_RUN' : 'NOT_APPLICABLE')), badge(item.verification_result), escapeHtml(fileAvailability(item)), date(item.uploaded_at)])) : emptyState('No regulatory documents stored.', 'Private document storage stays empty until evidence is uploaded by an authorized institution user or officer.', hasPermission('document.upload') ? button('Upload document', 'upload-document', 'upload', 'primary') : '');
  main.innerHTML = header('Documents', 'Private evidence storage, immutable versions and processing status', hasPermission('document.upload') ? button('Upload document', 'upload-document', 'upload', 'primary') : '') + panel('Document Register', docs + pagination(result.meta, state.documentPage, 'documents-page'), `${number(result.meta.total)} stored document versions`);
}

async function renderDocument(main) {
  const result = await api(`/api/v1/documents/${encodeURIComponent(state.documentId)}`);
  const { document: doc, versions, extractedFields, jobs, sourceRecord, aiReview } = result.data;
  state.currentDocument = doc;
  syncAssistantContext();
  const latest = versions[0];
  const parseStored=(value)=>{try{return JSON.parse(value||'{}');}catch{return {};}};
  const validation=parseStored(latest?.validation_json),extraction=parseStored(latest?.extraction_json);
  const currentFields=extractedFields.filter(f=>f.version_number===doc.current_version),previousFields=extractedFields.filter(f=>f.version_number===doc.current_version-1);
  const changes=previousFields.length?currentFields.filter(f=>previousFields.find(p=>p.field_name===f.field_name)?.field_value!==f.field_value).map(f=>[escapeHtml(f.field_name),escapeHtml(previousFields.find(p=>p.field_name===f.field_name)?.field_value||'Not present'),escapeHtml(f.field_value)]):[];
  const checks=table(['Check','Outcome','Why / next action'],[
    ['File structure',badge(validation.status||'NOT_PERFORMED'),escapeHtml(validation.reason||'Structure validation does not prove authenticity.')],
    ['Field extraction',badge(doc.processing_status),`${currentFields.length} fields extracted. Confirm uncertain values against their pages.`],
    ['Quality review',badge(extraction.qualityWarnings?.length?'REVIEW_REQUIRED':'LIMITED_CHECKS'),escapeHtml(extraction.qualityWarnings?.join('; ')||'Only supported resolution, contrast and parser checks were performed; visual review may still be needed.')],
    ['Issuing source',badge(latest?.verification_result||'NOT_PERFORMED'),'Open Source Verification in the application for response values and freshness.'],
    ['Malware scan',badge(validation.malwareScan||'NOT_CONFIGURED'),'Requires a configured scanner; structural validation is not an antivirus scan.'],
    ['QR validation',badge('NOT_CONFIGURED'),'No approved QR validation connector is configured.'],
    ['Digital signature',badge('NOT_CONFIGURED'),'Cryptographic signature validation has not been performed.']
  ]);

  const actions = `${latest?.file_available !== 0 && latest?.file_available !== false && hasPermission('verification.request') ? button('Request source verification', 'request-verification', 'shield-check', 'secondary', `data-id="${escapeHtml(doc.id)}"`) : ''}${hasPermission('document.upload') ? button('Upload replacement', 'upload-replacement', 'upload', 'primary', `data-id="${escapeHtml(doc.id)}"`) : ''}`;
  const detailRows = [
    ['Version', `v${latest?.version_number || 1}`], ['Processing status', pretty(doc.processing_status)], ['Verification status', pretty(latest?.verification_result)],
    ['File', fileAvailability(latest)], ['SHA-256 checksum', latest?.sha256], ['File type', latest?.mime_type], ['File size', latest?.file_available === 0 || latest?.file_available === false ? 'File not supplied' : latest ? `${number(Math.ceil(latest.byte_size / 1024))} KB` : '—'],
    ['Recorded', date(latest?.uploaded_at, true)], ['Processing attempts', number(jobs.reduce((sum, job) => sum + Number(job.attempts || 0), 0))],
    ...(sourceRecord ? [['Dataset issued on',date(sourceRecord.issued_on)],['Dataset expires on',date(sourceRecord.expires_on)],['Dataset OCR status',sourceRecord.ocr_status],['Dataset source status',sourceRecord.source_status],['Dataset anomaly flag',sourceRecord.anomaly_flag],['Dataset note',sourceRecord.note]] : []),
  ];
  const currentContent = `<dl class="detail-definition">${detailRows.map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || '—')}</dd>`).join('')}</dl><div class="finding-actions">${latest?.file_available === 0 || latest?.file_available === false ? '<span class="cell-secondary">File not supplied. Upload replacement evidence to attach a real file.</span>' : `<a class="btn btn-secondary" href="/api/v1/documents/${encodeURIComponent(doc.id)}/file" rel="noreferrer">${icon('external-link')}Download private file</a>`}${['RETRY_REQUIRED','MANUAL_REVIEW','FAILED'].includes(doc.processing_status) && hasPermission('document.upload') ? button('Retry processing', 'retry-processing', 'clock', 'secondary', `data-id="${escapeHtml(doc.id)}"`) : ''}</div>`;
  const fieldContent = extractedFields.length ? table(['Version','Field','Raw value','Reviewed value','Confidence','Evidence','Review'],extractedFields.map(f=>[
    `v${f.version_number}${f.version_number===doc.current_version?' · Current':' · Historical'}`,escapeHtml(f.field_name),escapeHtml(f.raw_value),escapeHtml(f.field_value),f.correction_id?'Officer confirmed':f.extraction_method==='PDF_TEXT'?'Embedded PDF text':f.confidence==null?'Unknown — review required':`${Math.round(f.confidence*100)}%`,
    `<button class="table-link" data-action="preview-evidence" data-id="${escapeHtml(doc.id)}" data-version="${f.version_number}" data-page="${f.page_number||1}">Page ${f.page_number||1}</button>`,
    hasPermission('document.verify')&&f.version_number===doc.current_version?`<button class="table-link" data-action="correct-field" data-id="${escapeHtml(f.id)}" data-value="${escapeHtml(f.field_value)}">Confirm / correct</button>`:'Historical evidence'
  ])) : emptyState('No extracted fields.','Processing may require a clearer scan, a supported document layout, or manual review.');
  const jobsContent = jobs.length
    ? table(['Job','Status','Attempts','Error','Created','Finished'], jobs.map((job) => [escapeHtml(job.job_type), badge(job.status), number(job.attempts), `<span class="copy-cell">${escapeHtml(job.error_message || job.error_code || '—')}</span>`, date(job.created_at, true), date(job.finished_at, true)]))
    : emptyState('No processing jobs.', 'Processing jobs are recorded persistently.');
  const aiRules = aiReview?.result?.rules || [];
  const aiResultsTable = aiRules.length ? table(['Rule','AI result','Reason','Observed value','Evidence quote'], aiRules.map((rule) => [escapeHtml(rule.title || rule.ruleKey), badge(rule.status), `<span class="copy-cell">${escapeHtml(rule.reason || 'No explanation returned.')}</span>`, escapeHtml(rule.observedValue || '—'), `<span class="copy-cell">${escapeHtml(rule.aiEvidenceQuote || '—')}</span>`])) : '';
  const aiReviewContent = aiReview
    ? `<div class="info-grid"><div class="info-item"><div class="info-label">Overall result</div><div class="info-value">${badge(aiReview.status)}</div></div><div class="info-item"><div class="info-label">AI engine</div><div class="info-value">${badge(aiReview.engine_status)}</div></div><div class="info-item"><div class="info-label">Model</div><div class="info-value">${escapeHtml(aiReview.model || 'Local rules fallback')}</div></div><div class="info-item"><div class="info-label">Reviewed</div><div class="info-value">${date(aiReview.created_at, true)}</div></div></div><p class="finding-text">${escapeHtml(aiReview.summary)}</p>${aiResultsTable}<div class="notice-strip" style="margin-top:12px">${icon('info')}<span>This advisory review applies extracted text to the listed evidence checks. It cannot authenticate the issuing authority or credentials, inspect physical facilities, or make a statutory approval decision.</span></div>${['GEMINI_UNAVAILABLE','GEMINI_INVALID_RESPONSE'].includes(aiReview.engine_status) && hasPermission('document.upload') ? button('Run AI review again','retry-ai-review','sparkles','secondary',`data-id="${escapeHtml(doc.id)}"`) : ''}`
    : !latest?.file_available ? emptyState('Upload the actual evidence file to start AI review.','This record has no original file attached yet. Metadata-only dataset rows cannot be evaluated.') : emptyState(jobs.some((job)=>job.job_type==='AI_DOCUMENT_REVIEW'&&['QUEUED','RUNNING'].includes(job.status)) ? 'Pramaan AI is reviewing this document.' : 'Pramaan AI review starts automatically after text extraction for this supported document type.', jobs.some((job)=>job.job_type==='DOCUMENT_PIPELINE'&&['QUEUED','RUNNING'].includes(job.status)) ? 'The AI review begins as soon as document processing finishes.' : 'The review checks applicable evidence-completeness criteria and quotes supporting document text. Missing or unclear information requires officer review.');
  const aiReviewPanel = isDocumentAiSupported(doc.document_type) ? panel('Pramaan Document AI Review', aiReviewContent, 'Automatic evidence review of this uploaded version') : '';
  const versionContent = versions.map((version) => `<div class="record-row"><div class="record-icon">${icon('files')}</div><div class="record-main"><div class="record-title">Version ${number(version.version_number)} · ${escapeHtml(version.original_name)}</div><div class="record-meta"><span>${date(version.uploaded_at, true)}</span><span>${pretty(version.processing_result)}</span><span>${pretty(version.verification_result)}</span></div>${version.replacement_reason ? `<div class="finding-text">Replacement reason: ${escapeHtml(version.replacement_reason)}</div>` : ''}</div>${version.file_available === 0 || version.file_available === false ? '<span class="cell-secondary">File not supplied</span>' : `<a class="table-action" href="/api/v1/documents/${encodeURIComponent(doc.id)}/file?version=${version.version_number}">Download</a>`}</div>`).join('');
  main.innerHTML = header(latest?.original_name || 'Document Workspace', `${doc.id} · ${doc.document_type} · Application ${doc.application_id}`, actions)
    + datasetNotice(result.data.datasetNotice)
    + `<div class="detail-grid"><div class="detail-stack">${aiReviewPanel}${panel('Current Version', currentContent, 'Document evidence is kept outside the public web directory')}${panel('Why this result?',checks)}${versions.length>1?panel('What changed?',changes.length?table(['Field','Previous version','Current version'],changes):'No extracted field difference is available. Compare the original files; previous reports remain historical.'):''}${panel('Extracted Fields', fieldContent)}${hasPermission('document.verify')?panel('Review completion',button('Confirm processing review','confirm-document-review','check','secondary',`data-id="${escapeHtml(doc.id)}"`)):''}${panel('Processing Jobs', '<div id="document-jobs-progress" aria-live="polite">'+jobsContent+'</div>')}</div><aside class="detail-stack">${panel('Version History', versionContent)}</aside></div>`;
  if(jobs.some(j=>['QUEUED','RUNNING'].includes(j.status))){
    const expectedId=doc.id;
    const poll=async()=>{if(state.page!=='document'||state.documentId!==expectedId)return;try{const response=await api(`/api/v1/documents/${encodeURIComponent(expectedId)}`),updated=response.data.jobs;
      const region=document.getElementById('document-jobs-progress');if(region)region.innerHTML=table(['Job','Status','Stage','Attempts','Last activity'],updated.map(j=>[escapeHtml(j.job_type),badge(j.status),escapeHtml(pretty(j.stage||j.status)),number(j.attempts),date(j.stage_updated_at||j.finished_at||j.started_at||j.created_at,true)]));
      if(updated.some(j=>['QUEUED','RUNNING'].includes(j.status)))jobPollTimer=setTimeout(poll,3000);else if(!document.querySelector('[role="dialog"]'))await loadPage();
    }catch(error){notify(error.message,true);}};jobPollTimer=setTimeout(poll,3000);
  }

}

async function renderVerifications(main) {
  const result = await api(`/api/v1/verifications?page=${state.verificationPage}&limit=50`);
  const records = result.data.length ? table(['Verification ID','Institution','Application','Provider','Result','Requested','Response','Officer review'], result.data.map((item) => [`<span class="cell-primary">${escapeHtml(item.id.slice(0, 14))}</span>`, escapeHtml(item.institution_name), escapeHtml(item.application_id), escapeHtml(item.provider), badge(item.result), date(item.requested_at, true), date(item.responded_at, true), badge(item.officer_review_status)])) : emptyState('No source verifications pending or recorded.', 'A verification provider remains unavailable until configured and authorized. External-source failures are stored as unavailable or inconclusive, never as mismatches.');
  main.innerHTML = header('Source Verification', 'Requests and responses from authorized document sources') + panel('Verification Register', records + pagination(result.meta, state.verificationPage, 'verifications-page'), `${number(result.meta.total)} source verification records`);
}

async function renderCompliance(main) {
  const result = await api('/api/v1/compliance?limit=100');
  const actions = `${hasPermission('application.review') ? button('Run applicable rules', 'execute-compliance', 'check', 'primary') : ''}${hasPermission('rule.read') ? button('Manage rule sets', 'rules', 'book-open-check') : ''}`;
  main.innerHTML = header('Regulatory Compliance', 'Versioned requirement results with evidence and rule references', actions)
    + panel('Compliance Results', result.data.length ? table(['Application','Institution','Requirement','Rule set','Version','Execution','Status','Reason','Recommended action'], result.data.map((item) => [`<button class="table-link" data-action="open-application" data-id="${escapeHtml(item.application_id)}">${escapeHtml(item.application_id)}</button>`, escapeHtml(item.institution_name), escapeHtml(item.requirement), escapeHtml(item.rule_set), `v${number(item.version_number)}`, badge(item.execution_status), badge(item.status), `<span class="copy-cell">${escapeHtml(item.reason || '—')}</span>`, `<span class="copy-cell">${escapeHtml(item.recommended_action || item.rule_action || '—')}</span>`])) : emptyState('No compliance results stored.', 'Results are created from an applicable published rule version. No universal checklist is applied when rules have not been configured.'));
}

async function renderInfrastructure(main) {
  const result = await api('/api/v1/infrastructure?limit=100');
  main.innerHTML = header('Infrastructure Review', 'Evidence claims and review status; physical inspection remains authoritative where required', hasPermission('document.upload') ? button('Register claim', 'create-infrastructure', 'plus', 'primary') : '')
    + panel('Infrastructure Evidence', result.data.length ? table(['Institution','Application','Category','Institution claim','Evidence','Review status','Added'], result.data.map((item) => [escapeHtml(item.institution_name), escapeHtml(item.application_id), escapeHtml(item.category), `<span class="copy-cell">${escapeHtml(item.institution_claim)}</span>`, escapeHtml(item.original_name || 'Not attached'), badge(item.review_status), date(item.created_at)])) : emptyState('No infrastructure evidence recorded.', 'Institution claims, photographs, floor plans and certificates can be associated with application evidence. Computer vision is advisory and is not a substitute for physical inspection.', hasPermission('document.upload') ? button('Register an infrastructure claim', 'create-infrastructure', 'plus', 'primary') : ''));
}

async function renderFindings(main, queue) {
  const result = await api(`/api/v1/findings?limit=100${queue ? '&status=OPEN' : ''}`);
  const data = result.data;
  const content = data.length ? data.map((item) => `<div class="record-row" style="cursor:default"><div class="metric-icon">${icon(item.severity === 'CRITICAL' || item.severity === 'HIGH' ? 'alert' : 'clipboard-list')}</div><div class="record-main"><div class="record-title">${escapeHtml(item.title)} <span style="margin-left:5px">${badge(item.severity)}</span> <span style="margin-left:5px">${badge(item.status)}</span></div><div class="record-meta"><span>${escapeHtml(item.institution_name)}</span><span>${escapeHtml(item.application_id)}</span><span>${escapeHtml(item.category)}</span><span>${date(item.created_at, true)}</span></div><div class="finding-text">${escapeHtml(item.description)}</div></div><div class="record-end"><button class="table-action" data-action="open-application" data-id="${escapeHtml(item.application_id)}">Review application ${icon('arrow')}</button></div></div>${hasPermission('finding.review') ? `<div style="padding:0 17px 13px">${findingCard(item)}</div>` : ''}`).join('') : emptyState(queue ? 'No findings require review.' : 'No findings recorded.', 'Findings remain preliminary, evidence-linked and subject to human review.');
  main.innerHTML = header(queue ? 'Review Queue' : 'Findings & Evidence', queue ? 'Prioritized items requiring authorized officer attention' : 'Evidence-linked findings, review outcomes and recommended actions') + panel(queue ? 'Open Review Items' : 'Finding Register', `<div class="record-list">${content}</div>`, `${number(data.length)} records`);
}

async function renderRectifications(main) {
  const result = await api('/api/v1/rectifications?limit=100');
  const data = result.data;
  const content = data.length ? table(['Application','Institution','Issue','Required action','Deadline','Status','Response / action'], data.map((item) => [
    `<button class="table-link" data-action="open-application" data-id="${escapeHtml(item.application_reference)}">${escapeHtml(item.application_reference)}</button>`, escapeHtml(item.institution_name), escapeHtml(item.issue), `<span class="copy-cell">${escapeHtml(item.required_action)}</span>`, date(item.deadline), badge(item.status),
    item.status === 'REQUESTED' && isInstitutionUser() ? `<button class="table-action" data-action="respond-rectification" data-id="${escapeHtml(item.id)}">Respond ${icon('arrow')}</button>` : escapeHtml(item.response || 'Awaiting institution response'),
  ])) : emptyState('No rectification requests.', 'Requests and responses are created and retained as part of the application history.');
  main.innerHTML = header('Rectifications', isInstitutionUser() ? 'Respond to authorized requests for clarification or additional evidence' : 'Institution responses awaiting review and action') + panel('Rectification Register', content, `${number(data.length)} records`);
}

async function renderInspections(main) {
  const result = await api('/api/v1/inspections?limit=100');
  const data = result.data;
  const content = data.length ? table(['Inspection','Institution','Application','Status','Recommendation reason','Scheduled','Action'], data.map((item) => [escapeHtml(item.id.slice(0, 12)), escapeHtml(item.institution_name), `<button class="table-link" data-action="open-application" data-id="${escapeHtml(item.application_id)}">${escapeHtml(item.application_id)}</button>`, badge(item.status), `<span class="copy-cell">${escapeHtml(item.recommendation_reason)}</span>`, date(item.scheduled_at, true), hasPermission('inspection.manage') ? `<button class="table-action" data-action="advance-inspection" data-id="${escapeHtml(item.id)}" data-status="${escapeHtml(nextInspection(item.status))}">${nextInspection(item.status) ? `Move to ${escapeHtml(pretty(nextInspection(item.status)))}` : 'View'}</button>` : '—'])) : emptyState('No inspection cases found.', 'Recommendations, authorizations, schedules, observations and reports are recorded as distinct workflow steps.');
  main.innerHTML = header('Inspections', 'Expert visit and physical inspection workflow', hasPermission('inspection.recommend') ? button('Recommend inspection', 'recommend-inspection', 'plus', 'primary') : '') + panel('Inspection Register', content);
}

function nextInspection(status) { return ({ RECOMMENDED: 'AUTHORIZED', AUTHORIZED: 'SCHEDULED', SCHEDULED: 'IN_PROGRESS', IN_PROGRESS: 'REPORT_SUBMITTED', REPORT_SUBMITTED: 'CLOSED' })[status] || ''; }

async function renderReports(main) {
  const result = await api('/api/v1/reports?limit=100');
  const data = result.data;
  main.innerHTML = header('Verification & Compliance Reports', 'Versioned report snapshots based only on stored application evidence', hasPermission('report.generate') ? button('Generate report', 'generate-report-select', 'plus', 'primary') : '')
    + panel('Generated Reports', data.length ? table(['Report ID','Application','Institution','Version','Generated at','Generated by','Action'], data.map((item) => [`<button class="table-link" data-action="open-report" data-id="${escapeHtml(item.id)}">${escapeHtml(item.id.slice(0, 14))}</button>`, escapeHtml(item.application_id), escapeHtml(item.institution_name), `v${number(item.report_version)}`, date(item.generated_at, true), escapeHtml(item.generated_by), `<button class="table-action" data-action="open-report" data-id="${escapeHtml(item.id)}">Preview ${icon('arrow')}</button>`])) : emptyState('No reports generated.', 'Reports are created from saved application data. No report content is fabricated to fill this register.'));
}

async function renderReport(main) {
  const result = await api(`/api/v1/reports/${encodeURIComponent(state.reportId)}`);
  const report = result?.data;
  const content = report?.content || {};
  if (!report || !content.application) return main.innerHTML = header('Verification Report', 'Report could not be loaded.') + emptyState('Report not found.', 'Return to the report register and choose a stored report.', button('Back to reports', 'reports', 'chevron-left'));
  const app = content.application;
  const evidenceSections=panel('Document Evidence',table(['Document','Version','Hash','Processing','Fields'],(content.documents||[]).map(d=>[escapeHtml(d.original_name),`v${d.version_number}`,`<code>${escapeHtml(d.sha256)}</code>`,badge(d.processing_result||d.processing_status),(d.fields||[]).map(f=>`${escapeHtml(f.field_name)}: ${escapeHtml(f.field_value)} (page ${f.page_number||'unknown'}${f.correction_id?', officer corrected':''})`).join('<br>')])))
   +panel('Source Evidence',table(['Provider','Result','Reference','Submitted values','Source values','Response time'],(content.sourceVerifications||[]).map(v=>[escapeHtml(v.provider),badge(v.result),escapeHtml(v.evidence_reference||v.error_message),`<pre>${escapeHtml(v.submitted_values||'{}')}</pre>`,`<pre>${escapeHtml(v.source_values||'{}')}</pre>`,date(v.responded_at,true)])))
   +panel('Rule Evidence',table(['Requirement','Version','Outcome','Assessment date','Reason','Next action'],(content.complianceResults||[]).map(r=>[escapeHtml(r.requirement),`${escapeHtml(r.rule_set)} v${r.version_number}`,badge(r.status),escapeHtml(r.assessment_date||'Not recorded'),escapeHtml(r.reason),escapeHtml(r.recommended_action)])))
   +panel('Snapshot limitations',`<p>This report is a historical snapshot. Later uploads, corrections, and rule runs do not change it.</p><ul>${(content.blockers||[]).map(b=>`<li>${escapeHtml(b)}</li>`).join('')}</ul>`);

  main.innerHTML = header(`Report ${report.id.slice(0, 12)}`, `${app.id} · Version ${report.report_version} · Generated ${date(report.generated_at, true)}`, `<button class="btn btn-secondary" type="button" data-action="print-report">${icon('file-bar-chart')}Print / Save PDF</button>${button('Back to reports', 'reports', 'chevron-left')}`)
    + `<div class="report-sheet">${datasetNotice(content.datasetNotice)}${evidenceSections}${panel('Institution Details', `<div class="info-grid">${[['Institution', app.institution_name],['Institution reference', app.aicte_id],['Category', app.category_label],['Academic Year', app.academic_year],['Processing stage', pretty(app.processing_stage)],['Report version', `v${report.report_version}`]].map(([a,b])=>`<div class="info-item"><div class="info-label">${escapeHtml(a)}</div><div class="info-value">${escapeHtml(b||'—')}</div></div>`).join('')}</div>`)}<div class="detail-grid" style="margin-top:14px">${panel('Processing Summary', table(['Item','Count'], [['Documents', number(content.documents?.length)],['Findings', number(content.findings?.length)],['Source verifications', number(content.sourceVerifications?.length)],['Compliance results', number(content.complianceResults?.length)]]))}${panel('Attention Priority', `<div class="info-value" style="font-size:14px">${escapeHtml(content.attention?.value || 'LOW')}</div><div class="finding-text">${escapeHtml(content.attention?.factors?.join('; ') || 'No contributing priority factors recorded.')}</div>`)}</div><div style="margin-top:14px">${panel('Pending Actions', content.findings?.length ? content.findings.map((item)=>findingCard(item,true)).join('') : emptyState('No findings in the report snapshot.','All report content reflects stored evidence at generation time.'))}</div><div class="notice-strip" style="margin-top:14px">${icon('info')}<span>${escapeHtml(content.governance || 'Automated findings within this report constitute decision-support information. Statutory scrutiny, inspection where applicable, and final regulatory decisions remain with competent AICTE authorities.')}</span></div></div>`;
  if (content.eligibility) main.querySelector('.report-sheet')?.insertAdjacentHTML('afterbegin', eligibilityPanel(content.eligibility, hasPermission('rule.read')));
}

async function renderAudit(main) {
  const result = await api('/api/v1/audit?limit=50');
  main.innerHTML = header('Audit Trail', 'Append-only record of access, workflow actions and configuration changes') + panel('Audit Events', result.data.length ? table(['Timestamp','Actor','Role','Action','Entity','Previous state','New state','Reference'], result.data.map((item) => [date(item.created_at, true), escapeHtml(item.actor_id || 'System'), escapeHtml(item.actor_role || 'System'), escapeHtml(item.action), `${escapeHtml(item.entity_type)} · ${escapeHtml(item.entity_id)}`, escapeHtml(item.previous_state || '—'), escapeHtml(item.new_state || '—'), `<span class="copy-cell">${escapeHtml(item.reference || '—')}</span>`])) : emptyState('No audit events available.', 'Audit events are append-only and cannot be edited by workspace users.'));
}

async function renderNotifications(main) {
  const result = await api('/api/v1/notifications?limit=100');
  state.notificationsUnread = result.meta?.unread || 0;
  const rows = result.data;
  const records = rows.length ? `<div class="record-list">${rows.map((item) => `<div class="record-row" style="cursor:default"><div class="record-icon">${icon('bell')}</div><div class="record-main"><div class="record-title">${escapeHtml(item.title)} ${item.read_at ? '' : '<span class="badge pending">Unread</span>'}</div><div class="record-meta"><span>${escapeHtml(item.body)}</span><span>${date(item.created_at, true)}</span></div></div><div class="record-end">${item.entity_id ? `<button class="table-action" data-action="open-related" data-type="${escapeHtml(item.entity_type)}" data-id="${escapeHtml(item.entity_id)}">Open record</button>` : ''}${item.read_at ? '' : `<button class="table-action" data-action="mark-notification-read" data-id="${escapeHtml(item.id)}">Mark read</button>`}</div></div>`).join('')}</div>` : emptyState('No notifications.', 'Workflow notifications appear when an event requires your attention.');
  main.innerHTML = header('Notification Center', `${number(result.meta?.unread || 0)} unread notifications`) + panel('Notifications', records);
}

async function renderAnalytics(main) {
  const result = await api('/api/v1/analytics');
  const analytics = result.data;
  const chart = (title, rows) => panel(title, rows.length ? `<div class="chart-bars">${rows.map((item) => `<div class="chart-bar-row"><div class="chart-bar-label" title="${escapeHtml(item.label)}">${escapeHtml(pretty(item.label))}</div><div class="chart-bar-track"><div class="chart-bar-fill" style="width:${Math.max(3, Number(item.value) / Math.max(...rows.map((row) => Number(row.value)), 1) * 100)}%"></div></div><div class="chart-bar-value">${number(item.value)}</div></div>`).join('')}</div>` : '<div class="chart-empty">No stored data to summarize.</div>');
  main.innerHTML = header('Operational Analytics', 'Counts and distributions calculated from authorized stored records') + `<div class="metrics-grid"><article class="metric-card"><div class="metric-label">Recorded applications</div><div class="metric-value">${number(analytics.totalApplications)}</div><div class="metric-foot">Current database records</div></article><article class="metric-card"><div class="metric-label">Average completion time</div><div class="metric-value">${analytics.averageCompletedDays === null ? '—' : `${Number(analytics.averageCompletedDays).toFixed(1)}d`}</div><div class="metric-foot">Completed records only</div></article><article class="metric-card"><div class="metric-label">Pending manual review</div><div class="metric-value">${number(analytics.pendingManualReviews)}</div><div class="metric-foot">Stored documents routed to staff</div></article></div><div class="detail-grid">${chart('Processing volume by month', analytics.byMonth)}${chart('Applications by stage', analytics.byStatus)}${chart('Applications by category', analytics.byCategory)}${chart('Source verification outcomes', analytics.verificationOutcomes)}${chart('Common deficiencies', analytics.commonDeficiencies)}${chart('Findings by status', analytics.findings)}${chart('Rectification status', analytics.rectifications)}${chart('Inspection workflow status', analytics.inspections)}</div>`;
}

async function renderRules(main) {
  const result = await api('/api/v1/rules');
  const records = result.data;
  const data = records.length ? table(['Rule set','Application category','Version','Effective period','Status','Rules','Actions'], records.map((item) => [escapeHtml(item.name), escapeHtml(item.category_label || 'All categories'), `v${number(item.version_number || 1)}`, `${date(item.effective_from)} – ${date(item.effective_until)}`, badge(item.version_status || item.status), number(item.rule_count), `${item.version_status === 'DRAFT' && hasPermission('rule.create') ? `<button class="table-action" data-action="test-rule" data-id="${escapeHtml(item.current_version_id)}">Test draft</button>` : ''}${item.version_status === 'DRAFT' && hasPermission('rule.publish') ? `<button class="table-action" data-action="publish-rule" data-id="${escapeHtml(item.current_version_id)}">Publish version</button>` : '—'}`])) : emptyState('No regulatory rule sets configured.', 'Rule sets are versioned. Published versions are immutable, and historical applications can retain their applied version.', hasPermission('rule.create') ? button('Create draft rule set', 'create-rule-set', 'plus', 'primary') : '');
  main.innerHTML = header('Regulatory Rules', 'Version-controlled requirements and execution history', hasPermission('rule.create') ? button('Create draft rule set', 'create-rule-set', 'plus', 'primary') : '') + panel('Rule Sets', data, `${number(records.length)} rule versions`);
}

async function renderIntegrations(main) {
  const [result, trustResult] = await Promise.all([api('/api/v1/integrations'),api('/api/v1/trust-hub')]);
  const records = result.data;
  const sources = trustResult.data.sources || [];
  const demoCases = trustResult.data.demoCases || [];
  main.innerHTML = header('Integration Center', 'Provider status reflects server-side configuration; credentials are never shown')
    + panel('PRAMAAN Trust Hub', table(['Source','Status','Scope / connection details'],sources.map((source)=>[escapeHtml(source.label || source.provider),badge(source.status),escapeHtml(source.note)])))
    + panel('Synthetic Reference Registry', `<div class="notice-strip">${icon('info')}<span>These fictional examples use the same document parser and verification queue. They are DEMO records only and are not official registry results or eligibility decisions. Upload samples only in a clearly marked test application.</span></div>${table(['Scenario','Record type','Source availability','Required sample documents','Sample file'],demoCases.map((item)=>[escapeHtml(item.scenario),badge(item.recordKind),badge(item.sourceAvailable?'DEMO_CONNECTED':'SOURCE_UNAVAILABLE'),escapeHtml((item.requiredDocumentTypes||[]).join(', ')||'—'),`<a class="table-action" href="/demo-registry/${encodeURIComponent(item.reference)}.pdf" target="_blank" rel="noreferrer">Download DEMO PDF</a>`]))}`)
    + panel('Fire NOC upload test', `<div class="fire-noc-fixture"><img src="/demo-registry/DEMO-FIRE-NOC-011.png" alt="Synthetic Fire NOC workflow test sample, not an official certificate"><div><strong>DEMO fire-safety record — not an issued NOC</strong><p>This fictional sample contains the Fire NOC fields Pramaan extracts: certificate number, institution name, address, issue date and expiry date. It is watermarked and has no legal effect. Use it only in a test application; source verification is deliberately unavailable. This computer’s Windows OCR is unavailable, so use the searchable PDF for deterministic field extraction; the PNG will exercise image upload and manual review.</p><div class="fire-noc-fixture-actions"><a class="btn btn-secondary" href="/demo-registry/DEMO-FIRE-NOC-011.png" download="DEMO-FIRE-NOC-011.png">Download PNG · image test</a><a class="btn btn-secondary" href="/demo-registry/DEMO-FIRE-NOC-011.pdf" download="DEMO-FIRE-NOC-011.pdf">Download PDF · field extraction</a></div></div></div>`)
    + panel('Configured Providers', records.length ? `<div class="record-list">${records.map((item) => `<div class="record-row" style="cursor:default"><div class="record-icon">${icon('plug')}</div><div class="record-main"><div class="record-title">${escapeHtml(item.display_name)}</div><div class="record-meta"><span>Environment: ${escapeHtml(item.environment)}</span><span>Last successful response: ${date(item.provider_key === 'ai' ? state.assistantLastSuccessAt : item.last_success_at, true)}</span><span>${item.provider_key === 'ai' ? 'Sahayak sends only permission-filtered record context and recent chat turns; raw files are not sent.' : item.last_failure ? `Last failure: ${escapeHtml(item.last_failure)}` : 'No recorded failures'}</span></div></div><div class="record-end">${badge(item.configuration_status)} ${badge(item.provider_key === 'ai' ? state.assistantHealthStatus : item.health_status)} ${item.configuration_status === 'CONFIGURED' && item.provider_key !== 'ai' ? `<button class="btn btn-secondary" data-action="test-integration" data-id="${escapeHtml(item.provider_key)}">Test connection</button>` : ''}</div></div>`).join('')}</div>` : emptyState('No integration providers configured.', 'Configuration values are managed server-side and are never returned to the browser.'));
}

async function renderUsers(main) {
  const [result, roleResult] = await Promise.all([api('/api/v1/users'),api('/api/v1/roles')]);
  main.innerHTML = button('Change my password','change-password','shield-check','secondary') + header('Users & Roles', 'Role-based access with server-enforced granular permissions', button('Add user', 'create-user', 'plus', 'primary'))
    + panel('Workspace Accounts', result.data.length ? table(['Name','Official email','Role','Institution scope','Active','Last sign in','Actions'], result.data.map((item) => [escapeHtml(item.display_name), escapeHtml(item.email), escapeHtml(String(item.roles || '').split(',').map(pretty).join(', ')), escapeHtml(item.institution_id || 'All permitted records'), badge(item.active ? 'ACTIVE' : 'DISABLED'), date(item.last_login_at, true), `<button class="table-action" data-action="manage-user" data-id="${escapeHtml(item.id)}">Manage access</button>`])) : emptyState('No workspace accounts.', 'No accounts are created automatically.'))
    + `<div style="margin-top:14px">${panel('Role Permission Map', table(['Role','Granular permissions'], roleResult.data.map((role) => [escapeHtml(role.name), `<span class="copy-cell">${escapeHtml(String(role.permissions||'').split(',').map(permissionDescription).join(' · '))}</span>`])))}</div>`;
}

function permissionDescription(permission) { return ({ 'application.read':'Read applications','application.create':'Create an institution application','application.assign':'Assign applications','application.review':'Review application workflow','application.decide':'Record an authorized final decision','institution.read':'Read authorized institution records','institution.manage':'Manage institution records','document.read':'Read authorized documents','document.upload':'Upload and replace evidence','document.verify':'Review document verification','finding.read':'Read findings','finding.review':'Review findings','verification.request':'Request source verification','verification.review':'Review source verification','rectification.create':'Respond to rectifications','rectification.review':'Create and review rectifications','inspection.recommend':'Recommend inspection','inspection.manage':'Manage inspection workflow','report.generate':'Generate reports','rule.read':'Read regulatory rules','rule.create':'Create draft rules','rule.publish':'Publish rule versions','audit.read':'Read append-only audit events','integration.manage':'Manage integration setup','user.manage':'Manage users and roles','notification.read':'Read personal notifications','configuration.manage':'Manage non-secret product configuration' })[permission] || permission; }

async function renderHealth(main) {
  const result = await api('/api/v1/system/health');
  const healthActions = `${hasPermission('integration.manage') && state.assistantProviderConfigured ? button('Test Gemini connection','test-ai-connection','activity','primary') : ''}${hasPermission('configuration.manage') ? button('Open controlled evaluation','load-controlled-evaluation','file-check','secondary') : ''}`;
  main.innerHTML = header('System Health', 'Live service state, queue activity, and AI connection checks',healthActions) + panel('Services', table(['Service','Status','Details','Last checked'], result.data.services.map((item) => [escapeHtml(item.name), badge(item.status), escapeHtml(item.detail||'—'), date(new Date().toISOString(), true)])));
  main.innerHTML+=panel('Supported verification scope',table(['Document','Support','Checks','Source / limitation'],(result.data.capabilities||[]).map(c=>[escapeHtml(c.documentType),badge(c.support),escapeHtml(c.checks.join(', ')),escapeHtml(c.source)])));
  const evaluation=result.data.evaluation;
  if(evaluation)main.innerHTML+=panel('Controlled evaluation',`<p>${escapeHtml(evaluation.dataset)} · ${date(evaluation.generatedAt,true)}</p><p>Exact field matches: ${evaluation.fieldAccuracy.exact} / ${evaluation.fieldAccuracy.total}. ${escapeHtml(evaluation.generalization)}</p>`+table(['Sample','Validation','Exact fields','Processing time','Review'],evaluation.cases.map(c=>[escapeHtml(c.file),badge(c.validation),`${c.fieldsExact}/${c.fieldsExpected}`,`${c.elapsedMs} ms`,c.requiresReview?'Required':'No extraction review flagged'])));
  main.innerHTML+=panel('Queue observations',table(['Status','Count','Oldest created'],(result.data.queue||[]).map(q=>[badge(q.status),number(q.count),date(q.oldest,true)])));

}

function importCounts(counts) {
  return Object.entries(counts || {}).map(([name, count]) => [escapeHtml(pretty(name)), number(count)]);
}
function readDatasetFile(file) {
  return new Promise((resolveText, rejectText) => {
    const reader = new FileReader();
    let finished = false;
    let timer;
    const finish = (error, text) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      reader.onload = null; reader.onerror = null; reader.onabort = null;
      if (error) rejectText(error); else resolveText(text);
    };
    timer = setTimeout(() => {
      finish(new Error('Reading the selected file timed out. Try again or paste the dataset JSON below.'));
      try { reader.abort(); } catch { /* already complete */ }
    }, 10000);
    reader.onload = () => finish(null, String(reader.result || ''));
    reader.onerror = () => finish(new Error('The selected file could not be read. Try again or paste the dataset JSON below.'));
    reader.onabort = () => finish(new Error('File reading was cancelled. Choose the file again or paste the dataset JSON below.'));
    try { reader.readAsText(file, 'UTF-8'); } catch { finish(new Error('The selected file could not be opened. Try pasting the dataset JSON below.')); }
  });
}
async function renderDatasetImport(main) {
  if (!hasPermission('configuration.manage')) throw new Error('Dataset import is available to workspace administrators.');
  const result = await api('/api/v1/dataset-import');
  const preview = state.datasetPreview;
  const batches = result.data.batches || [];
  const previewContent = preview ? panel('Import Preview', `${table(['Record type','Records'], importCounts(preview.counts))}${(preview.warnings || []).map((warning) => datasetNotice(warning)).join('')}<div class="panel-body"><p>${escapeHtml(state.datasetFilename)} · ${preview.alreadyImported ? 'This dataset has already been imported.' : 'Validation passed. Review the counts and source limitations before importing.'}</p>${preview.alreadyImported ? '' : '<form data-form="dataset-commit"><button class="btn btn-primary" type="submit">Import validated dataset</button></form>'}</div>`) : '';
  const history = batches.length ? table(['Imported','Batch','Records'], batches.map((batch) => {
    let counts = batch.counts || {};
    if (batch.counts_json) { try { counts = JSON.parse(batch.counts_json); } catch { counts = {}; } }
    return [date(batch.created_at, true),escapeHtml(batch.id),number(Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0))];
  })) : emptyState('No datasets imported.', 'An imported dataset is recorded with its checksum and original source records.');
  main.innerHTML = header('Dataset Import', 'Preview and validate linked Pramaan records before adding them to the workspace')
    + panel('Choose Dataset', `<form class="form-grid" data-form="dataset-preview"><div class="field span-2"><label for="dataset-json">Pramaan dataset JSON · up to 1 MB</label><input id="dataset-json" name="dataset" type="file" accept=".json,application/json"><p class="cell-secondary">For an import package ZIP, extract it and select pramaan_dataset.json. The JSON contains the linked records; do not import each CSV or the Excel workbook separately.</p></div><div class="field span-2"><label for="dataset-json-text">Or paste dataset JSON</label><textarea id="dataset-json-text" name="datasetText" rows="4" maxlength="1048576" spellcheck="false" placeholder="Paste the contents of pramaan_dataset.json if file selection is unavailable."></textarea><p class="cell-secondary">Use either a file or pasted JSON, up to 1 MB.</p></div><div class="span-2"><button class="btn btn-secondary" type="submit">Validate and preview</button></div></form>`)
    + `<div class="detail-stack" style="margin-top:14px">${previewContent}${panel('Import History', history)}</div>`;
}

async function renderConfiguration(main) {
  const result = await api('/api/v1/configuration');
  const config = result.data;
  main.innerHTML = header('Configuration', 'Update product branding and contact details without changing application logic') + panel('Workspace Branding', `<form class="form-grid" data-form="configuration">
    ${[['brand_name','Product name'],['organization_name','Organization name'],['tagline','Tagline'],['support_email','Support email'],['description','Description'],['footer_text','Governance footer']].map(([name,label]) => `<div class="field ${['description','footer_text'].includes(name)?'span-2':''}"><label for="config-${name}">${escapeHtml(label)}</label>${['description','footer_text'].includes(name) ? `<textarea id="config-${name}" name="${name}" maxlength="500">${escapeHtml(config[name] || '')}</textarea>` : `<input id="config-${name}" name="${name}" value="${escapeHtml(config[name] || '')}" maxlength="200">`}</div>`).join('')}
    <div class="span-2"><button class="btn btn-primary" type="submit">Save branding</button></div></form><div class="modal-note">No third-party or government marks are included. Configure organization branding only where deployment authorization permits.</div>`);
  const assetPanel=`<div class="form-grid"><form class="field span-2" data-form="branding-asset"><label for="brand-logo-file">Product logo · PNG ≤ 1 MB</label><input id="brand-logo-file" type="file" name="file" accept="image/png" required><input type="hidden" name="target" value="logo_path"><button class="btn btn-secondary" type="submit">Upload logo</button></form><form class="field span-2" data-form="branding-asset"><label for="brand-favicon-file">Favicon · PNG ≤ 1 MB</label><input id="brand-favicon-file" type="file" name="file" accept="image/png" required><input type="hidden" name="target" value="favicon_path"><button class="btn btn-secondary" type="submit">Upload favicon</button></form><div class="span-2 modal-note">Current logo: ${config.logo_path?`<img class="branding-preview" src="${escapeHtml(config.logo_path)}" alt="Current configured logo">`:'Built-in Pramaan logo'} · Favicon: ${config.favicon_path?`<img class="branding-favicon-preview" src="${escapeHtml(config.favicon_path)}" alt="Current configured favicon">`:'Default favicon'}</div></div>`;
  main.innerHTML+=`<div style="margin-top:14px">${panel('Brand Assets',assetPanel,'Uploaded PNG assets are served as public product branding.')}</div>`;
}

let modalPreviousFocus=null;
function openModal(title, description, body, wide = false) {
  const modalRoot = document.getElementById('modal-root');
  if (!modalRoot) return;
  modalPreviousFocus=document.activeElement;
  modalRoot.innerHTML = `<div class="modal-backdrop" data-action="modal-backdrop"><section class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-header"><div><h2 id="modal-title">${escapeHtml(title)}</h2>${description ? `<p>${escapeHtml(description)}</p>` : ''}</div><button class="modal-close" type="button" aria-label="Close" data-action="close-modal">${icon('close')}</button></div><div class="modal-body">${body}</div></section></div>`;
  modalRoot.querySelector('input,select,textarea,button')?.focus();
}
function closeModal() { const modalRoot = document.getElementById('modal-root'); if (modalRoot?.childElementCount) {modalRoot.innerHTML = '';modalPreviousFocus?.focus();} }
function notify(message, error = false) {
  let region = document.getElementById('toast-region');
  if (!region) { region = document.createElement('div'); region.id = 'toast-region'; region.className = 'toast-region'; region.setAttribute('aria-live', 'polite'); document.body.append(region); }
  const toast = document.createElement('div'); toast.className = `toast ${error ? 'error' : ''}`;
  toast.innerHTML = `<div class="toast-title">${error ? 'Action could not be completed' : 'Updated'}</div><div>${escapeHtml(message)}</div>`;
  region.append(toast); setTimeout(() => toast.remove(), 4800);
}
function fieldMarkup(label, name, type = 'text', options = {}) {
  const id = `field-${name}`;
  if (type === 'select') return `<div class="field ${options.span ? 'span-2' : ''}"><label for="${id}">${escapeHtml(label)}</label><select id="${id}" name="${escapeHtml(name)}" ${options.required ? 'required' : ''}>${options.options || ''}</select></div>`;
  if (type === 'textarea') return `<div class="field ${options.span ? 'span-2' : ''}"><label for="${id}">${escapeHtml(label)}</label><textarea id="${id}" name="${escapeHtml(name)}" ${options.required ? 'required' : ''} maxlength="${options.maxlength || 2000}" placeholder="${escapeHtml(options.placeholder || '')}"></textarea></div>`;
  return `<div class="field ${options.span ? 'span-2' : ''}"><label for="${id}">${escapeHtml(label)}</label><input id="${id}" name="${escapeHtml(name)}" type="${escapeHtml(type)}" ${options.required ? 'required' : ''} ${options.maxlength ? `maxlength="${options.maxlength}"` : ''} placeholder="${escapeHtml(options.placeholder || '')}" value="${escapeHtml(options.value || '')}"></div>`;
}
function optionList(items, valueKey, labelKey, selected = '') {
  return items.map((item) => `<option value="${escapeHtml(item[valueKey])}" ${item[valueKey] === selected ? 'selected' : ''}>${escapeHtml(item[labelKey])}</option>`).join('');
}
async function openCreateApplication() {
  const [institutions, categories] = await Promise.all([api('/api/v1/institutions?limit=100'), api('/api/v1/application-categories')]);
  const institutionField = isInstitutionUser() ? `<input type="hidden" name="institutionId" value="${escapeHtml(state.user.institution_id || institutions.data[0]?.id || '')}"><div class="field"><label>Institution</label><input value="${escapeHtml(institutions.data[0]?.name || 'Institution not assigned')}" disabled></div>`
    : `<div class="field"><label for="field-institutionId">Institution</label><select id="field-institutionId" name="institutionId" required><option value="">Select an institution</option>${optionList(institutions.data,'id','name')}</select></div>`;
  openModal('Create application', 'The application record will be saved to the workspace database.', `<form class="form-grid" data-form="create-application">${institutionField}<div class="field"><label for="field-categoryId">Application category</label><select id="field-categoryId" name="categoryId" required><option value="">Select category</option>${optionList(categories.data,'id','label')}</select></div>${fieldMarkup('Academic year','academicYear','text',{required:true,placeholder:'2026-27',maxlength:7})}<div class="span-2 modal-note">Creation records the application and audit event. Validation begins only when authorized evidence is received.</div><div class="span-2 modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">Create application</button></div></form>`);
}
function openCreateInstitution() {
  openModal('Add institution', 'Create an institution master record for authorized regulatory use.', `<form class="form-grid" data-form="create-institution">${fieldMarkup('Institution name','name','text',{required:true,maxlength:200})}${fieldMarkup('AICTE Institution ID','aicteId','text',{required:true,maxlength:100})}${fieldMarkup('Institution type','type','text',{maxlength:100})}${fieldMarkup('State / UT','stateUt','text',{maxlength:100})}${fieldMarkup('District','district','text',{maxlength:100})}${fieldMarkup('Establishment year','establishmentYear','number')}${fieldMarkup('Affiliating university','affiliatingUniversity','text',{maxlength:200})}${fieldMarkup('Address','address','textarea',{span:true,maxlength:500})}<div class="span-2 modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">Save institution</button></div></form>`);
}
async function openUploadDocument(replacement = false) {
  const applications = await api('/api/v1/applications?limit=100'); const current = state.currentDocument;
  const appField = replacement ? `<input type="hidden" name="applicationId" value="${escapeHtml(current?.application_id || '')}"><input type="hidden" name="documentId" value="${escapeHtml(current?.id || '')}">`
    : `<div class="field span-2"><label for="field-applicationId">Application</label><select id="field-applicationId" name="applicationId" required><option value="">Select application</option>${applications.data.map((item)=>`<option value="${escapeHtml(item.id)}" ${item.id===state.applicationId?'selected':''}>${escapeHtml(item.id)} · ${escapeHtml(item.institution_name)}</option>`).join('')}</select></div>`;
  const types = ['Fire NOC','Fire Safety Certificate','Building Safety Certificate','Land Document','NOC','Affidavit / Undertaking','Accreditation Certificate','Affiliation Document','Occupancy Certificate','Faculty Document','Financial Document','Previous EoA','Infrastructure Certificate','Other'];
  openModal(replacement ? 'Upload replacement evidence' : 'Upload document', 'PDF, JPG, JPEG or PNG · 15 MB maximum · private storage with preserved versions.', `<form class="form-grid" data-form="upload-document" enctype="multipart/form-data">${appField}<div class="field"><label for="field-documentType">Document category</label><select id="field-documentType" name="documentType" required>${types.map((value)=>`<option ${replacement && value===current?.document_type?'selected':''}>${escapeHtml(value)}</option>`).join('')}</select></div>${replacement ? fieldMarkup('Reason for replacement','replacementReason','textarea',{span:true,required:true,maxlength:500,placeholder:'Explain the correction or updated evidence.'}) : ''}<div class="field span-2"><label for="field-file">Select file</label><div class="dropzone">${icon('upload')}<strong>Choose a regulatory evidence file</strong><small>File type and content signature are checked by the server.</small><input id="field-file" name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required></div></div><div class="span-2 modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">${replacement?'Upload new version':'Upload document'}</button></div></form>`);
}
async function openAssignOfficer(id) {
  const [officers, application] = await Promise.all([api('/api/v1/officers'), api(`/api/v1/applications/${encodeURIComponent(id)}`)]);
  const options = officers.data.map((item)=>`<option value="${escapeHtml(item.id)}">${escapeHtml(item.display_name)} · ${escapeHtml(pretty(item.role))}</option>`).join('');
  openModal('Assign application', `${id} · Current assignment: ${application.data.application.assigned_officer || 'Unassigned'}`, `<form class="form-grid" data-form="assign-officer" data-application-id="${escapeHtml(id)}"><div class="field span-2"><label for="field-userId">Review officer</label><select id="field-userId" name="userId" required><option value="">Select officer</option>${options}</select></div><div class="span-2 modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">Assign officer</button></div></form>`);
}
function openFindingReview(id, action) {
  const label = ({ ACCEPT:'Accept finding', DISMISS:'Dismiss finding', REQUEST_RECTIFICATION:'Request rectification', REQUEST_CLARIFICATION:'Request clarification', REQUEST_EVIDENCE:'Request additional evidence', SEND_FOR_VERIFICATION:'Send for verification', ESCALATE:'Escalate for review', RECOMMEND_INSPECTION:'Recommend inspection', RESOLVE:'Resolve finding' })[action] || 'Review finding';
  const deadline = action.startsWith('REQUEST_') ? fieldMarkup('Deadline','deadline','date') : '';
  openModal(label, 'Your reason will be retained in the application review history.', `<form class="form-grid" data-form="review-finding" data-finding-id="${escapeHtml(id)}" data-review-action="${escapeHtml(action)}">${fieldMarkup('Reason / officer note','reason','textarea',{span:true,required:true,maxlength:2000,placeholder:'Record the basis for this action.'})}${deadline}<div class="span-2 modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">${escapeHtml(label)}</button></div></form>`);
}
async function openReportSelect() {
  const result = await api('/api/v1/applications?limit=100');
  const options = result.data.map((item)=>`<option value="${escapeHtml(item.id)}">${escapeHtml(item.id)} · ${escapeHtml(item.institution_name)}</option>`).join('');
  openModal('Generate verification report', 'The report is an immutable snapshot of stored evidence at generation time.', `<form class="form-grid" data-form="generate-report"><div class="field span-2"><label for="field-applicationId">Application</label><select id="field-applicationId" name="applicationId" required><option value="">Select application</option>${options}</select></div><div class="span-2 modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">Generate report</button></div></form>`);
}
function openRectificationResponse(id) {
  openModal('Respond to rectification', 'Upload replacement documents separately to preserve document version history.', `<form class="form-grid" data-form="rectification-response" data-rectification-id="${escapeHtml(id)}">${fieldMarkup('Institution response','response','textarea',{required:true,span:true,maxlength:2000,placeholder:'Describe the action taken or clarification provided.'})}<div class="span-2 modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">Submit response</button></div></form>`);
}
async function openCreateRule() {
  const [categories, eligibilityCategories] = await Promise.all([api('/api/v1/application-categories'), api('/api/v1/eligibility/categories')]);
  openModal('Create draft rule set', 'Rules are versioned; published versions become immutable.', `<form class="form-grid" data-form="create-rule">${fieldMarkup('Rule set name','name','text',{required:true,maxlength:200})}<div class="field"><label for="field-categoryId">Application category</label><select id="field-categoryId" name="categoryId"><option value="">All categories</option>${categories.data.map((item)=>`<option value="${escapeHtml(item.id)}">${escapeHtml(item.label)}</option>`).join('')}</select></div>${fieldMarkup('Effective from','effectiveFrom','date')}${fieldMarkup('Effective until','effectiveUntil','date')}${fieldMarkup('First rule title','ruleTitle','text',{required:true,maxlength:300,span:true})}${fieldMarkup('Rule key','ruleKey','text',{maxlength:100,placeholder:'REQUIRED_DOCUMENT_CHECK'})}<div class="field"><label for="field-severity">Severity</label><select id="field-severity" name="severity">${['LOW','MEDIUM','HIGH','CRITICAL'].map((x)=>`<option>${x}</option>`).join('')}</select></div><div class="field"><label for="field-eligibilityCategory">Internal eligibility category</label><select id="field-eligibilityCategory" name="eligibilityCategory"><option value="">Do not include in eligibility percentage</option>${eligibilityCategories.data.map((item)=>`<option value="${escapeHtml(item.category_key)}">${escapeHtml(item.label)} · ${number(item.weight)} points</option>`).join('')}</select></div><div class="field"><label for="field-mandatory">Mandatory for review readiness?</label><select id="field-mandatory" name="mandatory"><option value="false">No</option><option value="true">Yes — a confirmed failure blocks review readiness</option></select></div>${fieldMarkup('Recommended action','recommendedAction','textarea',{span:true,maxlength:1000})}${fieldMarkup('Condition (JSON)','condition','textarea',{span:true,maxlength:2000,placeholder:'{"type":"field_present","field":"certificate_number"}'})}<div class="span-2 modal-note">Eligibility weights are internal PRAMAAN decision support, not regulatory thresholds. Only tested, published rules linked to current evidence are scored. Adding a category alone does not create or activate a requirement.</div><div class="span-2 modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">Save draft rule set</button></div></form>`);
}
async function openRuleTest(versionId) {
  const applications=await api('/api/v1/applications?limit=100');
  const options=applications.data.map((item)=>`<option value="${escapeHtml(item.id)}">${escapeHtml(item.id)} · ${escapeHtml(item.institution_name)}</option>`).join('');
  openModal('Test draft rule version','A test stores execution results but does not create findings or change application validation status.',`<form class="form-grid" data-form="test-rule" data-version-id="${escapeHtml(versionId)}"><div class="field span-2"><label for="field-applicationId">Application</label><select id="field-applicationId" name="applicationId" required><option value="">Select application</option>${options}</select></div><div class="span-2 modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">Run test</button></div></form>`);
}
async function openComplianceExecute() {
  const applications=await api('/api/v1/applications?limit=100');
  const options=applications.data.map((item)=>`<option value="${escapeHtml(item.id)}">${escapeHtml(item.id)} · ${escapeHtml(item.institution_name)} · ${escapeHtml(item.academic_year)}</option>`).join('');
  openModal('Execute applicable rule versions','Only published rule sets effective for the application category and date are executed.',`<form class="form-grid" data-form="execute-compliance">${fieldMarkup('Assessment date (blank uses submission date)','assessmentDate','date',{span:true})}<div class="field span-2"><label for="field-applicationId">Application</label><select id="field-applicationId" name="applicationId" required><option value="">Select application</option>${options}</select></div><div class="span-2 modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">Run applicable rules</button></div></form>`);
}
function openApplicationDecision(applicationId) {
  openModal('Record authority decision', `${applicationId} · only an authorized authority can accept or reject this application.`, `<form class="form-grid" data-form="application-decision" data-application-id="${escapeHtml(applicationId)}"><div class="field span-2"><label for="field-decision">Outcome</label><select id="field-decision" name="decision" required><option value="">Choose outcome</option><option value="APPROVED">Accepted / Approved</option><option value="REJECTED">Rejected</option></select></div>${fieldMarkup('Decision reason','reason','textarea',{required:true,span:true,minlength:20,maxlength:2000,placeholder:'Record the evidence and authority basis for this decision.'})}<div class="span-2 modal-note">This decision is stored in the append-only history with the signed-in authority and timestamp. Automated checks never record it.</div><div class="span-2 modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">Record decision</button></div></form>`);
}
async function runApplicationRules(applicationId) {
  const result=await api('/api/v1/compliance/execute',{method:'POST',body:{applicationId}});
  let jobStatus='QUEUED',jobMessage='';
  for(let attempt=0;attempt<24;attempt+=1){
    await new Promise((resolve)=>setTimeout(resolve,750));
    const job=await api(`/api/v1/jobs/${encodeURIComponent(result.data.jobId)}`);
    jobStatus=job.data.status;jobMessage=job.data.errorMessage||'';
    if(['COMPLETED','FAILED'].includes(jobStatus))break;
  }
  if(jobStatus==='COMPLETED')notify(`Rules review completed: ${number(result.data.ruleVersionsQueued)} published rule version(s) evaluated.`);
  else if(jobStatus==='FAILED')notify(`Rules review failed and needs officer attention${jobMessage?`: ${jobMessage}`:'.'}`,true);
  else notify('Rules review is still processing. Refresh this application shortly to see the results.');
  setPage('application',{applicationId});
}
async function openCreateUser() {
  const institutions = await api('/api/v1/institutions?limit=100');
  const roles = ['INSTITUTION_USER','SCRUTINY_OFFICER','VERIFICATION_OFFICER','INSPECTION_OFFICER','APPROVING_AUTHORITY','REGULATORY_ADMINISTRATOR','AUDITOR'];
  if (state.user.roles.includes('SYSTEM_ADMINISTRATOR')) roles.push('SYSTEM_ADMINISTRATOR');
  openModal('Add workspace user', 'Accounts use role-based permissions and are audited when created.', `<form class="form-grid" data-form="create-user">${fieldMarkup('Full name','displayName','text',{required:true,maxlength:100})}${fieldMarkup('Official email','email','email',{required:true,maxlength:254})}<div class="field"><label for="field-role">Role</label><select id="field-role" name="role" required>${roles.map((role)=>`<option value="${role}">${escapeHtml(pretty(role))}</option>`).join('')}</select></div>${fieldMarkup('Initial password','password','password',{required:true,maxlength:256,placeholder:'12+ characters, mixed case and a number'})}<div class="field span-2"><label for="field-institutionId">Institution scope (institution users only)</label><select id="field-institutionId" name="institutionId"><option value="">Not institution-scoped</option>${institutions.data.map((item)=>`<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join('')}</select></div><div class="span-2 modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">Create account</button></div></form>`);
}
async function openManageUser(id) {
  const [users,institutions]=await Promise.all([api('/api/v1/users'),api('/api/v1/institutions?limit=100')]);
  const user=users.data.find((item)=>item.id===id);if(!user)return;
  const roles=['INSTITUTION_USER','SCRUTINY_OFFICER','VERIFICATION_OFFICER','INSPECTION_OFFICER','APPROVING_AUTHORITY','REGULATORY_ADMINISTRATOR','AUDITOR'];
  if(state.user.roles.includes('SYSTEM_ADMINISTRATOR'))roles.push('SYSTEM_ADMINISTRATOR');
  const currentRole=String(user.roles||'').split(',')[0];
  const roleOptions=roles.map((role)=>`<option value="${role}" ${role===currentRole?'selected':''}>${escapeHtml(pretty(role))}</option>`).join('');
  const institutionOptions=institutions.data.map((item)=>`<option value="${escapeHtml(item.id)}" ${item.id===user.institution_id?'selected':''}>${escapeHtml(item.name)}</option>`).join('');
  openModal('Manage user access',`${user.display_name} · ${user.email}`,`<form class="form-grid" data-form="manage-user" data-user-id="${escapeHtml(id)}"><div class="field"><label for="field-role">Role</label><select id="field-role" name="role">${roleOptions}</select></div><div class="field"><label for="field-active">Account status</label><select id="field-active" name="active"><option value="true" ${user.active?'selected':''}>Active</option><option value="false" ${user.active?'':'selected'}>Disabled</option></select></div><div class="field span-2"><label for="field-institutionId">Institution scope (institution users only)</label><select id="field-institutionId" name="institutionId"><option value="">Not institution-scoped</option>${institutionOptions}</select></div><div class="span-2 modal-note">Disabling an account revokes its active sessions. At least one active system administrator must remain.</div><div class="span-2 modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">Save access</button></div></form>`);
}
async function openInfrastructureClaim() {
  const result = await api('/api/v1/applications?limit=100');
  const options = result.data.map((item)=>`<option value="${escapeHtml(item.id)}">${escapeHtml(item.id)} · ${escapeHtml(item.institution_name)}</option>`).join('');
  openModal('Register infrastructure evidence claim', 'Record the claim here and upload its supporting file through Documents.', `<form class="form-grid" data-form="create-infrastructure"><div class="field"><label for="field-applicationId">Application</label><select id="field-applicationId" name="applicationId" required><option value="">Select application</option>${options}</select></div><div class="field"><label for="field-category">Category</label><select id="field-category" name="category" required>${['Photograph','Video','Floor Plan','Laboratory','Classroom','Library','Certificate','Other'].map((value)=>`<option>${escapeHtml(value)}</option>`).join('')}</select></div>${fieldMarkup('Institution claim','institutionClaim','textarea',{span:true,required:true,maxlength:2000,placeholder:'Describe the declared facility or evidence item.'})}<div class="span-2 modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">Register claim</button></div></form>`);
}
async function openRecommendInspection() {
  const result = await api('/api/v1/applications?limit=100');
  const options = result.data.map((item)=>`<option value="${escapeHtml(item.id)}">${escapeHtml(item.id)} · ${escapeHtml(item.institution_name)}</option>`).join('');
  openModal('Recommend expert visit / inspection', 'A recommendation does not authorize or schedule a visit.', `<form class="form-grid" data-form="recommend-inspection"><div class="field span-2"><label for="field-applicationId">Application</label><select id="field-applicationId" name="applicationId" required><option value="">Select application</option>${options}</select></div>${fieldMarkup('Reason','reason','textarea',{span:true,required:true,maxlength:2000,placeholder:'Explain what evidence or review need supports a visit.'})}<div class="span-2 modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">Record recommendation</button></div></form>`);
}
function openInspectionStep(id, next) {
  const extra = next === 'SCHEDULED' ? fieldMarkup('Scheduled date and time','scheduledAt','datetime-local',{required:true}) : '';
  const observations = ['REPORT_SUBMITTED','CLOSED'].includes(next) ? fieldMarkup('Observation / report reference',next === 'CLOSED' ? 'observations':'reportReference','textarea',{span:true,required:true,maxlength:2000}) : '';
  openModal(`Move inspection to ${pretty(next)}`, 'This workflow change will be recorded in the audit trail.', `<form class="form-grid" data-form="inspection-step" data-id="${escapeHtml(id)}" data-status="${escapeHtml(next)}">${extra}${observations}<div class="span-2 modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">Save inspection step</button></div></form>`);
}
async function openVerificationPicker(applicationId, findingId = '') {
  const result = await api(`/api/v1/documents?applicationId=${encodeURIComponent(applicationId)}`);
  const options = result.data.map((doc)=>`<option value="${escapeHtml(doc.id)}">${escapeHtml(doc.document_type)} · ${escapeHtml(doc.original_name)}</option>`).join('');
  if (!options) { notify('This application has no document available for source verification.', true); return; }
  openModal('Request source verification', 'The request is queued. Provider failures are recorded as unavailable or inconclusive.', `<form class="form-grid" data-form="request-verification" data-finding-id="${escapeHtml(findingId)}"><div class="field span-2"><label for="field-documentId">Document</label><select id="field-documentId" name="documentId" required><option value="">Select document</option>${options}</select></div><div class="field span-2"><label for="field-provider">Verification source</label><select id="field-provider" name="provider"><option value="AUTHORIZED_SOURCE">Authorized issuing source</option><option value="DEMO_REGISTRY">Synthetic local registry — DEMO only</option><option value="CONTROLLED_TEST_SOURCE">Legacy controlled fixture — fictional, not official</option><option value="DIGILOCKER">DigiLocker (not connected unless authorized)</option></select><small>DEMO results cannot satisfy an official source-verification rule.</small></div><div class="span-2 modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">Queue verification</button></div></form>`);
}
function openSaveFilter() {
  openModal('Save application filter', 'Saved filters are private to your user account.', `<form class="form-grid" data-form="save-filter">${fieldMarkup('Filter name','name','text',{required:true,maxlength:80,placeholder:'My open EoA reviews'})}<div class="span-2 modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Cancel</button><button class="btn btn-primary" type="submit">Save filter</button></div></form>`);
}

function onClick(event) {
  const target = event.target.closest('[data-action], [data-page]');
  if (!target) return;
  if (target.dataset.page) { event.preventDefault(); setPage(target.dataset.page); return; }
  const action = target.dataset.action;
  Promise.resolve().then(async () => {
    if (action === 'auth-slide') setAuthSlide(Number(target.dataset.slideIndex));
    else if (action === 'set-auth-language') setAuthLanguage(target.dataset.language);
    else if (action === 'toggle-theme') setTheme(state.theme === 'dark' ? 'light' : 'dark');
    else if (action === 'toggle-auth-password') toggleAuthPassword(target);
    else if (action === 'signup-info') notify(authText('signupInfo'));
    else if (action === 'open-nav') { document.querySelector('.sidebar')?.classList.add('open'); document.querySelector('.overlay')?.classList.add('open'); }
    else if (action === 'close-nav') closeMobileNav();
    else if (action === 'toggle-assistant') { state.assistantOpen = !state.assistantOpen; renderAssistantWidget(); if (state.assistantOpen) rootFocusAssistant(); }
    else if (action === 'clear-assistant') { state.assistantRequestId += 1; state.assistantBusy = false; state.assistantMessages = []; state.assistantActiveContext = null; renderAssistantWidget(); rootFocusAssistant(); }
    else if (action === 'assistant-suggestion') await askAssistant(target.dataset.prompt || '');
    else if (action === 'assistant-open-action') {
      const page = target.dataset.pagekey || '';
      const id = target.dataset.id || '';
      const allowed = new Set(['dashboard','applications','institutions','documents','verification','compliance','infrastructure','findings','review-queue','rectifications','inspections','reports','analytics','audit','notifications','rules','integrations','users','health','dataset-import','configuration']);
      if (page === 'application' && id) setPage('application', { applicationId: id });
      else if (page === 'institution' && id) setPage('institution', { institutionId: id });
      else if (page === 'document' && id) setPage('document', { documentId: id });
      else if (allowed.has(page)) setPage(page);
    }
    else if (action === 'close-modal' || (action === 'modal-backdrop' && event.target === target)) closeModal();
    else if (action === 'logout') { await api('/api/v1/auth/logout',{method:'POST',body:{}}); state.user=null; state.assistantMessages=[]; state.assistantActiveContext=null; state.assistantConfigured=false; state.assistantProviderConfigured=false; state.assistantOpen=false; state.assistantContextId=''; state.currentDocument=null; state.applicationId=''; state.documentId=''; state.datasetCandidate=null; state.datasetPreview=null; state.datasetFilename=''; renderAuth(false); }
    else if(action==='load-controlled-evaluation'){const result=await api('/api/v1/evaluation/setup',{method:'POST',body:{}});notify('Fictional evaluation opened. Source checks are test-only; rules start as drafts.');setPage('application',{applicationId:result.data.applicationId});}
    else if(action==='change-password')openModal('Change password','Other active sessions will be revoked.',passwordForm());
    else if(action==='preview-evidence') openModal('Document evidence',`Version ${target.dataset.version} · Page ${target.dataset.page}`,`<img class="evidence-preview" alt="Document evidence page" src="/api/v1/documents/${encodeURIComponent(target.dataset.id)}/preview?version=${Number(target.dataset.version)}&page=${Number(target.dataset.page)}">`,true);
    else if(action==='correct-field') openModal('Confirm or correct field','Original extraction is retained. This invalidates previous compliance and source checks.',`<form class="form-grid" data-form="correct-field" data-id="${escapeHtml(target.dataset.id)}">${fieldMarkup('Reviewed value','value','text',{value:target.dataset.value,required:true,span:true})}${fieldMarkup('Review reason','reason','textarea',{required:true,span:true})}<button class="btn btn-primary" type="submit">Save reviewed value</button></form>`);
    else if(action==='confirm-document-review') openModal('Confirm processing review','Confirm that all relevant fields have been checked against the file.',`<form class="form-grid" data-form="confirm-document-review" data-id="${escapeHtml(target.dataset.id)}">${fieldMarkup('Review reason','reason','textarea',{required:true,span:true})}<button class="btn btn-primary" type="submit">Confirm review</button></form>`);
    else if (action === 'forgot') notify(authText('forgotInfo'));
    else if (action === 'create-application') await openCreateApplication();
    else if (action === 'create-institution') openCreateInstitution();
    else if (action === 'upload-document') await openUploadDocument(false);
    else if (action === 'upload-replacement') await openUploadDocument(true);
    else if (action === 'open-application') setPage('application',{applicationId:target.dataset.id});
    else if (action === 'open-institution') setPage('institution',{institutionId:target.dataset.id});
    else if (action === 'open-document') setPage('document',{documentId:target.dataset.id});
    else if (action === 'open-report') { state.reportId=target.dataset.id; setPage('report',{reportId:target.dataset.id}); }
    else if (action === 'create-infrastructure') await openInfrastructureClaim();
    else if (action === 'recommend-inspection') await openRecommendInspection();
    else if (action === 'generate-report') target.dataset.id ? await createReport(target.dataset.id) : await openReportSelect();
    else if (action === 'generate-report-select') await openReportSelect();
    else if (action === 'assign-officer') await openAssignOfficer(target.dataset.id || state.applicationId);
    else if (action === 'filter-applications-outcome') { state.applicationFilters.outcome=target.dataset.outcome||''; state.applicationPage=1; setPage('applications'); }
    else if (action === 'review-finding') openFindingReview(target.dataset.id,target.dataset.review);
    else if (action === 'verify-from-finding') await openVerificationPicker(target.dataset.applicationId || state.applicationId,target.dataset.id);
    else if (action === 'request-verification') await openVerificationPicker(state.currentDocument?.application_id || state.applicationId);
    else if (action === 'retry-processing') { const result=await api(`/api/v1/documents/${encodeURIComponent(target.dataset.id)}/retry`,{method:'POST',body:{}}); notify(`Job ${result.data.jobId} queued.`); await loadPage(); }
    else if (action === 'retry-ai-review') { const result=await api(`/api/v1/documents/${encodeURIComponent(target.dataset.id)}/ai-review`,{method:'POST',body:{}}); notify(`Document AI review ${pretty(result.data.status)}.`); await loadPage(); }
    else if (action === 'applications-page') { state.applicationPage=Number(target.dataset.pageNumber)||1; await loadPage(); }
    else if (action === 'institutions-page') { state.institutionPage=Number(target.dataset.pageNumber)||1; await loadPage(); }
    else if (action === 'documents-page') { state.documentPage=Number(target.getAttribute('data-page-number'))||1; await loadPage(); }
    else if (action === 'verifications-page') { state.verificationPage=Number(target.getAttribute('data-page-number'))||1; await loadPage(); }
    else if (action === 'respond-rectification') openRectificationResponse(target.dataset.id);
    else if (action === 'publish-rule') { await api(`/api/v1/rules/${encodeURIComponent(target.dataset.id)}/publish`,{method:'POST',body:{}}); notify('Rule version published.'); await loadPage(); }
    else if (action === 'test-rule') await openRuleTest(target.dataset.id);
    else if (action === 'execute-compliance') await openComplianceExecute();
    else if (action === 'execute-application-rules') await runApplicationRules(target.dataset.id || state.applicationId);
    else if (action === 'record-application-decision') openApplicationDecision(target.dataset.id || state.applicationId);
    else if (action === 'create-rule-set') await openCreateRule();
    else if (action === 'save-filter') openSaveFilter();
    else if (action === 'create-user') await openCreateUser();
    else if (action === 'manage-user') await openManageUser(target.dataset.id);
    else if (action === 'test-integration') { const result=await api(`/api/v1/integrations/${encodeURIComponent(target.dataset.id)}/test`,{method:'POST',body:{}}); notify(`Provider state: ${pretty(result.data.health_status)}.`); await loadPage(); }
    else if (action === 'test-ai-connection') { const result=await api('/api/v1/assistant/health-check',{method:'POST',body:{}}); state.assistantHealthStatus=result.data.healthStatus; state.assistantProviderConfigured=Boolean(result.data.configured); notify(result.data.message,result.data.healthStatus!=='RESPONDING'); await loadPage(); }
    else if (action === 'advance-stage') { if(target.dataset.stage){ await api(`/api/v1/applications/${encodeURIComponent(target.dataset.id)}/stage`,{method:'PATCH',body:{stage:target.dataset.stage}}); notify(`Application stage moved to ${pretty(target.dataset.stage)}.`); await loadPage(); } }
    else if (action === 'advance-inspection') { if(target.dataset.status) openInspectionStep(target.dataset.id,target.dataset.status); }
    else if (action === 'mark-notification-read') { await api(`/api/v1/notifications/${encodeURIComponent(target.dataset.id)}/read`,{method:'PATCH',body:{}}); await loadPage(); }
    else if (action === 'open-related') { if(target.dataset.type==='APPLICATION') setPage('application',{applicationId:target.dataset.id}); else if(target.dataset.type==='DOCUMENT') setPage('document',{documentId:target.dataset.id}); }
    else if (action === 'retry-page' || action === 'reload') await loadPage();
    else if (action === 'back-institutions') setPage('institutions');
    else if (action === 'applications') setPage('applications');
    else if (action === 'rules') setPage('rules');
    else if (action === 'reports') setPage('reports');
    else if (action === 'print-report') window.print();
  }).catch((error)=>notify(error.message || 'The action failed.',true));
}

function closeMobileNav() { document.querySelector('.sidebar')?.classList.remove('open'); document.querySelector('.overlay')?.classList.remove('open'); }
async function createReport(applicationId) {
  const result=await api('/api/v1/reports',{method:'POST',body:{applicationId}}); closeModal(); notify(`Report ${result.data.id} generated.`); setPage('report',{reportId:result.data.id,applicationId});
}

async function onSubmit(event) {
  const form = event.target.closest('form[data-form]');
  if (!form) return;
  event.preventDefault();
  const type = form.getAttribute('data-form');
  const submit = form.querySelector('[type="submit"]');
  const authForm = type === 'login' || type === 'bootstrap';
  if (authForm) state.authSubmitting = true;
  if (submit) {
    submit.disabled = true;
    submit.setAttribute('data-original-text', submit.textContent);
    const authLabel = submit.querySelector('.auth-submit-label');
    if (authLabel) authLabel.textContent = authText(type === 'bootstrap' ? 'creatingAdmin' : 'loggingIn');
    else submit.textContent = type === 'dataset-preview' ? 'Validating…' : type === 'dataset-commit' ? 'Importing…' : 'Saving…';
  }
  try {
    if(type==='change-password'){const values=Object.fromEntries(new FormData(form).entries());if(values.newPassword!==values.confirmPassword)throw new Error('Passwords do not match.');await api('/api/v1/auth/password',{method:'POST',body:values});state.user.must_change_password=0;closeModal();notify('Password changed. Other sessions were revoked.');await loadPage();return;}
    if(type==='correct-field'||type==='confirm-document-review'){
      const values=Object.fromEntries(new FormData(form).entries());
      await api(type==='correct-field'?`/api/v1/fields/${encodeURIComponent(form.dataset.id)}/corrections`:`/api/v1/documents/${encodeURIComponent(form.dataset.id)}/confirm-review`,{method:'POST',body:values});closeModal();notify('Evidence review saved. Rerun affected checks.');await loadPage();return;
    }
    if (type === 'login' || type === 'bootstrap') {
      if (!form.reportValidity()) return;
      const values = Object.fromEntries(new FormData(form).entries());
      if (type === 'bootstrap' && values.password !== values.confirmPassword) throw new Error(authText('passwordMismatch'));
      if (type === 'login') {
        state.authRemember = form.elements.rememberMe?.checked === true;
        state.authRememberedIdentifier = state.authRemember ? String(values.email || '').trim() : '';
        try {
          if (state.authRememberedIdentifier) localStorage.setItem('pramaan.remembered-identifier', state.authRememberedIdentifier);
          else localStorage.removeItem('pramaan.remembered-identifier');
        } catch { /* Sign in continues when browser storage is disabled. */ }
      }
      const route = type === 'bootstrap' ? '/api/v1/auth/bootstrap' : '/api/v1/auth/login';
      const result = await api(route,{method:'POST',body:{email:String(values.email || '').trim(),password:values.password,displayName:values.displayName}});
      stopAuthCarousel();
      state.user=result.data.user; parseHash();
      if (type === 'login') {
        try { await showSuccessfulLoginTransition(); }
        catch { appRoot.replaceChildren(); }
      }
      renderShell();
      if (type === 'login') {
        const shell = document.querySelector('.shell');
        shell?.classList.add('login-dashboard-arrival');
        if (shell) window.setTimeout(() => shell.classList.remove('login-dashboard-arrival'), 220);
      }
      await Promise.all([refreshAssistantStatus(), loadPage()]); return;
    }
    if (type === 'dataset-preview') {
      state.datasetCandidate = null; state.datasetPreview = null; state.datasetFilename = '';
      const values = new FormData(form);
      const file = values.get('dataset');
      const pasted = String(values.get('datasetText') || '').trim();
      const hasFile = file instanceof File && file.size > 0;
      if (hasFile && pasted) throw new Error('Choose either a dataset file or pasted JSON. Clear one before validating.');
      if (!hasFile && !pasted) throw new Error('Choose a non-empty Pramaan JSON dataset or paste its contents.');
      if (hasFile && !file.name.toLowerCase().endsWith('.json')) throw new Error('Choose a JSON dataset file.');
      if ((hasFile && file.size > 1024 * 1024) || (pasted && new TextEncoder().encode(pasted).length > 1024 * 1024)) throw new Error('Dataset exceeds the 1 MB limit.');
      const text = (pasted || await readDatasetFile(file)).replace(/^\uFEFF/, '');
      let dataset;
      try { dataset = JSON.parse(text); } catch { throw new Error('The dataset is not valid JSON.'); }
      const preview = await api('/api/v1/dataset-import/preview', {method:'POST',body:{dataset}});
      state.datasetCandidate = dataset; state.datasetPreview = preview.data; state.datasetFilename = hasFile ? file.name : 'Pasted dataset JSON';
      await loadPage(); notify('Dataset validation completed.'); return;
    }
    if (type === 'dataset-commit') {
      if (!state.datasetCandidate || !state.datasetPreview?.digest) throw new Error('Validate the dataset before importing it.');
      const result = await api('/api/v1/dataset-import', {method:'POST',body:{dataset:state.datasetCandidate,previewDigest:state.datasetPreview.digest}});
      state.datasetCandidate = null; state.datasetPreview = null; state.datasetFilename = '';
      notify(result.data.alreadyImported ? 'This dataset was already imported. No duplicate records were added.' : 'Dataset imported successfully.');
      setPage('institutions'); return;
    }
    if (type === 'assistant-chat') { await askAssistant(new FormData(form).get('message')); return; }
    if(type==='global-search'){const values=Object.fromEntries(new FormData(form).entries());state.globalQuery=String(values.q||'').trim();setPage('search');return;}
    if(type==='application-search'){const values=Object.fromEntries(new FormData(form).entries());state.applicationPage=1;setPage('applications',{query:String(values.q||'').trim()});return;}
    if (type === 'institution-search') { const values=Object.fromEntries(new FormData(form).entries()); state.institutionPage=1; state.institutionQuery=String(values.q||'').trim(); await loadPage(); return; }
    if (type === 'create-application') {
      const values=Object.fromEntries(new FormData(form).entries()); const result=await api('/api/v1/applications',{method:'POST',body:{institutionId:values.institutionId,categoryId:values.categoryId,academicYear:values.academicYear}});
      closeModal(); notify('Application record created.'); setPage('application',{applicationId:result.data.id}); return;
    }
    if (type === 'create-institution') {
      const values=Object.fromEntries(new FormData(form).entries()); const result=await api('/api/v1/institutions',{method:'POST',body:values});
      closeModal(); notify('Institution master record saved.'); setPage('institution',{institutionId:result.data.id}); return;
    }
    if (type === 'upload-document') {
      const result=await api('/api/v1/documents',{method:'POST',body:new FormData(form)});
      closeModal(); notify(`Document version ${result.data.version_number} uploaded and queued.`); setPage('document',{documentId:result.data.id}); return;
    }
    if (type === 'assign-officer') {
      await api(`/api/v1/applications/${encodeURIComponent(form.dataset.applicationId)}/assignment`,{method:'PATCH',body:{userId:new FormData(form).get('userId')}});
      closeModal(); notify('Officer assignment saved.'); await loadPage(); return;
    }
    if (type === 'review-finding') {
      const values=Object.fromEntries(new FormData(form).entries());
      await api(`/api/v1/findings/${encodeURIComponent(form.dataset.findingId)}/review`,{method:'POST',body:{action:form.dataset.reviewAction,reason:values.reason,deadline:values.deadline||undefined}});
      closeModal(); notify('Finding review action recorded.'); await loadPage(); return;
    }
    if (type === 'rectification-response') {
      const values=Object.fromEntries(new FormData(form).entries()); await api(`/api/v1/rectifications/${encodeURIComponent(form.dataset.rectificationId)}`,{method:'PATCH',body:{response:values.response}});
      closeModal(); notify('Rectification response submitted.'); await loadPage(); return;
    }
    if (type === 'generate-report') { await createReport(new FormData(form).get('applicationId')); return; }
    if (type === 'request-verification') {
      const values=Object.fromEntries(new FormData(form).entries()); const result=await api('/api/v1/verifications',{method:'POST',body:values});
      if(form.dataset.findingId) await api(`/api/v1/findings/${encodeURIComponent(form.dataset.findingId)}/review`,{method:'POST',body:{action:'SEND_FOR_VERIFICATION',reason:`Verification ${result.data.id} requested.`}});
      closeModal(); notify(`Verification ${result.data.id} queued.`); await loadPage(); return;
    }
    if (type === 'save-filter') {
      const values=Object.fromEntries(new FormData(form).entries()); const filters={...state.applicationFilters,q:state.applicationQuery};
      await api('/api/v1/saved-filters',{method:'POST',body:{name:values.name,resource:'applications',filters}});
      closeModal(); notify('Application filter saved to your account.'); await loadPage(); return;
    }
    if (type === 'create-rule') {
      const values=Object.fromEntries(new FormData(form).entries()); let condition={};
      if(values.condition){try{condition=JSON.parse(values.condition);}catch{throw new Error('Rule condition must be valid JSON.');}}
      if(values.eligibilityCategory)condition.eligibilityCategory=values.eligibilityCategory;
      condition.mandatory=values.mandatory==='true';
      await api('/api/v1/rules',{method:'POST',body:{name:values.name,categoryId:values.categoryId||null,effectiveFrom:values.effectiveFrom||null,effectiveUntil:values.effectiveUntil||null,rules:[{key:values.ruleKey,title:values.ruleTitle,severity:values.severity,recommendedAction:values.recommendedAction,condition}]}});
      closeModal(); notify('Draft rule set saved.'); await loadPage(); return;
    }
    if(type==='test-rule'){
      const values=Object.fromEntries(new FormData(form).entries());const result=await api(`/api/v1/rules/${encodeURIComponent(form.dataset.versionId)}/test`,{method:'POST',body:{applicationId:values.applicationId}});
      closeModal();
      const resultRows=(result.data.results||[]).map((item)=>[escapeHtml(item.rule_key||item.requirement||'Rule'),badge(item.status),escapeHtml(item.actual_value||'—'),escapeHtml(item.reason||'No explanation recorded.'),escapeHtml(item.recommended_action||'—')]);
      const summary=`${result.data.results.length} rule checks · ${result.data.results.filter((item)=>item.status==='PASS').length} passed · ${result.data.results.filter((item)=>item.status==='FAIL').length} failed · ${result.data.results.filter((item)=>item.status!=='PASS'&&item.status!=='FAIL').length} require review or verification`;
      openModal('Draft rule test results',`${result.data.applicationId} · ${summary}`,`<div class="notice-strip">${icon('info')}<span><strong>TEST ONLY.</strong> This run does not create findings, alter application validation status, or constitute an authority decision.</span></div>${table(['Rule','Outcome','Observed value','Reason','Next action'],resultRows)}<div class="modal-footer"><button class="btn btn-secondary" type="button" data-action="close-modal">Close</button><button class="btn btn-primary" type="button" data-action="open-application" data-id="${escapeHtml(result.data.applicationId)}">Open application</button></div>`,true);return;
    }
    if(type==='execute-compliance'){
      const values=Object.fromEntries(new FormData(form).entries());const result=await api('/api/v1/compliance/execute',{method:'POST',body:{applicationId:values.applicationId,assessmentDate:values.assessmentDate||undefined}});
      closeModal();notify(`Compliance job ${result.data.jobId} queued for ${number(result.data.ruleVersionsQueued)} published rule version(s).`);setPage('application',{applicationId:values.applicationId});return;
    }
    if(type==='application-decision'){
      const values=Object.fromEntries(new FormData(form).entries());const applicationId=form.dataset.applicationId;
      const result=await api(`/api/v1/applications/${encodeURIComponent(applicationId)}/decision`,{method:'POST',body:{decision:values.decision,reason:values.reason}});
      closeModal();notify(`Authority decision recorded: ${pretty(result.data.decision)}.`);setPage('application',{applicationId});return;
    }
    if (type === 'create-user') {
      const values=Object.fromEntries(new FormData(form).entries()); const result=await api('/api/v1/users',{method:'POST',body:values});
      closeModal(); notify(`Account created for ${result.data.email}.`); await loadPage(); return;
    }
    if(type==='manage-user'){
      const values=Object.fromEntries(new FormData(form).entries());await api(`/api/v1/users/${encodeURIComponent(form.dataset.userId)}`,{method:'PATCH',body:{role:values.role,active:values.active==='true',institutionId:values.institutionId}});
      closeModal();notify('User access and active sessions were updated.');await loadPage();return;
    }
    if (type === 'create-infrastructure') {
      const values=Object.fromEntries(new FormData(form).entries()); await api('/api/v1/infrastructure',{method:'POST',body:values});
      closeModal(); notify('Infrastructure claim registered.'); await loadPage(); return;
    }
    if (type === 'recommend-inspection') {
      const values=Object.fromEntries(new FormData(form).entries()); await api('/api/v1/inspections',{method:'POST',body:values});
      closeModal(); notify('Inspection recommendation recorded for authority review.'); await loadPage(); return;
    }
    if (type === 'inspection-step') {
      const values=Object.fromEntries(new FormData(form).entries()); await api(`/api/v1/inspections/${encodeURIComponent(form.dataset.id)}`,{method:'PATCH',body:{status:form.dataset.status,scheduledAt:values.scheduledAt?new Date(values.scheduledAt).toISOString():undefined,observations:values.observations,reportReference:values.reportReference}});
      closeModal(); notify('Inspection workflow updated.'); await loadPage(); return;
    }
    if (type === 'configuration') {
      const values=Object.fromEntries(new FormData(form).entries()); const result=await api('/api/v1/configuration',{method:'PATCH',body:values});
      state.branding=result.data; renderShell(); await loadPage(); notify('Branding configuration saved.'); return;
    }
    if(type==='branding-asset'){
      const result=await api('/api/v1/configuration/branding-asset',{method:'POST',body:new FormData(form)});
      state.branding=result.data;renderShell();await loadPage();notify('Brand asset updated.');return;
    }
  } catch (error) {
    if (authForm) state.authSubmitting = false;
    if (submit) {
      submit.disabled=false;
      const authLabel = submit.querySelector('.auth-submit-label');
      if (authLabel) authLabel.textContent = authText(type === 'bootstrap' ? 'createAdmin' : 'login');
      else submit.textContent=submit.getAttribute('data-original-text')||'Try again';
    }
    notify(authForm ? authErrorMessage(error) : error.message||'The request failed.',true);
  } finally {
    if (authForm) state.authSubmitting = false;
    if (submit?.isConnected) {
      submit.disabled=false;
      const authLabel = submit.querySelector('.auth-submit-label');
      if (authLabel) authLabel.textContent = authText(type === 'bootstrap' ? 'createAdmin' : 'login');
      else submit.textContent=submit.getAttribute('data-original-text')||'Submit';
    }
  }
}

async function onChange(event) {
  const target=event.target;
  if(target.matches('[data-filter]')){
    const key=target.dataset.filter, value=String(target.value||'').trim();
    if(value) state.applicationFilters[key]=value; else delete state.applicationFilters[key];
    state.applicationPage=1; await loadPage();
  }
  if(target.matches('[data-saved-filter]')){
    const selected=state.savedFilters.find((item)=>item.id===target.value);
    if(selected){state.applicationFilters={...selected.filters};state.applicationQuery=state.applicationFilters.q||'';delete state.applicationFilters.q;state.applicationPage=1;await loadPage();}
  }
}

function onKeydown(event) {
  if (event.key === 'Escape') { closeModal(); closeMobileNav(); }
  if (event.key === 'Escape' && state.assistantOpen) { state.assistantOpen = false; renderAssistantWidget(); }
  if (event.key === 'Enter' && !event.shiftKey && event.target.matches('[data-assistant-input]')) { event.preventDefault(); event.target.form?.requestSubmit(); }
  if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('.record-row[role="button"]')) { event.preventDefault(); event.target.click(); }
}

async function start() {
  try {
    const auth=await api('/api/v1/auth/state'); state.branding=auth.data.branding||state.branding;
    if(auth.data.bootstrapRequired){renderAuth(true);return;}
    try{const session=await api('/api/v1/auth/me');state.user=session.data.user;}catch{renderAuth(false);return;}
    parseHash(); renderShell(); syncAssistantContext(); await Promise.all([refreshAssistantStatus(), loadPage()]);
  } catch(error) {
    appRoot.innerHTML=`<main class="auth-page"><section class="auth-rail">${brandLockup()}<div class="auth-message"><span class="auth-kicker">${escapeHtml(window.PramaanI18n.t('messages.serviceUnavailable'))}</span><h1>${escapeHtml(window.PramaanI18n.t('messages.cannotReachService'))}</h1><p>${escapeHtml(error.message||window.PramaanI18n.t('messages.checkService'))}</p></div></section><section class="auth-main"><div class="auth-header-controls">${appearanceControls('auth')}</div><div class="auth-card"><h2>${escapeHtml(window.PramaanI18n.t('messages.serviceConnectionRequired'))}</h2><p>${escapeHtml(window.PramaanI18n.t('messages.interfaceNeedsApi'))}</p><button class="btn btn-primary" data-action="reload">${escapeHtml(window.PramaanI18n.t('common.retry'))}</button></div></section></main>`;
    syncAppearanceControls();
  }
}

appRoot.addEventListener('click',onClick);
appRoot.addEventListener('submit',onSubmit);
appRoot.addEventListener('change',onChange);
appRoot.addEventListener('keydown',onKeydown);
document.addEventListener('keydown',(event)=>{if(event.key==='Escape'){closeModal();closeMobileNav();}});
window.addEventListener('hashchange',()=>{if(state.user){parseHash();syncAssistantContext();loadPage();}});
start();

function comparisonTable(rows) {
 return rows.length?table(['Field','Result','Evidence values','Reason'],rows.map(r=>[escapeHtml(r.field),badge(r.status),r.values.map(v=>`<button class="table-link" data-action="preview-evidence" data-id="${escapeHtml(v.documentId)}" data-version="${v.version}" data-page="${v.page_number||1}">v${v.version} · ${escapeHtml(v.field_value)}</button>`).join('<br>'),escapeHtml(r.reason)])):emptyState('No comparisons available.','Comparisons require permission and current document evidence.');
}
window.addEventListener('popstate',()=>{if(state.user){parseHash();syncAssistantContext();loadPage();}});
document.addEventListener('keydown',event=>{
 const dialog=document.querySelector('[role="dialog"]');if(!dialog||event.key!=='Tab')return;
 const items=[...dialog.querySelectorAll('button,a[href],input,select,textarea,[tabindex="0"]')].filter(e=>!e.disabled&&e.getClientRects().length);
 if(!items.length)return;const first=items[0],last=items.at(-1);
 if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){event.preventDefault();last.focus();}
 else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
});

function passwordForm(){return `<form class="form-grid" data-form="change-password">${fieldMarkup('Current password','currentPassword','password',{required:true,span:true})}${fieldMarkup('New password','newPassword','password',{required:true,span:true})}${fieldMarkup('Confirm new password','confirmPassword','password',{required:true,span:true})}<button type="submit" class="btn btn-primary">Change password</button></form>`;}
