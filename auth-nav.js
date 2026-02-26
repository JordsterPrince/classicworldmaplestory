(function () {
  const cognitoDomain = "https://us-east-1vwch0vbxs.auth.us-east-1.amazoncognito.com";
  const clientId = "34bpj3juf9ifi55chvco7he5pt";
  const profileApiBase = 'https://otvk1as2n9.execute-api.us-east-1.amazonaws.com';
  const FAVORITE_OST_SETUP_TYPE = 'favorite-maple-ost';
  const FAVORITE_MONSTER_SETUP_TYPE = 'favorite-maple-monster';
  const AVATAR_SYNC_TTL_MS = 5 * 60 * 1000;
  const PROFILE_SYNC_TTL_MS = 5 * 60 * 1000;
  const NAV_DEBUG_FLAG_KEY = 'mscw_nav_debug';
  const redirectUri = window.location.origin;
  const scriptEl = document.currentScript;
  const projectRootUrl = scriptEl ? new URL('.', scriptEl.src) : new URL('./', window.location.href);

  const AVATAR_OPTIONS = [
    'MapleLeaf.png',
    'heroAlert.png',
    'darkKnightalert.png',
    'paladinAlert.png',
    'clericAlert.png',
    'fpalert.png',
    'ilAlert.png',
    'bowmanAlert.png',
    'crossbowmanAlert.png',
    'assassinAlert.png',
    'banditAlert.png'
  ];

  const nav = document.querySelector('.navbar nav');
  if (!nav) return;
  let refreshPromise = null;

  function isNavDebugEnabled() {
    return localStorage.getItem(NAV_DEBUG_FLAG_KEY) === '1';
  }

  function logNavDebug(message, details) {
    if (!isNavDebugEnabled()) return;
    if (typeof details === 'undefined') {
      console.log(`[MSCWAuth] ${message}`);
      return;
    }
    console.log(`[MSCWAuth] ${message}`, details);
  }

  function ensureAccountMarkup() {
    let loginBtn = document.getElementById('loginBtn');
    let accountMenu = document.getElementById('accountMenu');

    if (!loginBtn) {
      loginBtn = document.createElement('a');
      loginBtn.href = '#';
      loginBtn.id = 'loginBtn';
      loginBtn.className = 'nav-login-btn';
      loginBtn.textContent = 'Login';
      nav.appendChild(loginBtn);
    }

    if (!accountMenu) {
      accountMenu = document.createElement('div');
      accountMenu.id = 'accountMenu';
      accountMenu.className = 'account-menu';
      accountMenu.style.display = 'none';
      nav.appendChild(accountMenu);
    }

    if (!accountMenu.querySelector('#accountCircleBtn') || !accountMenu.querySelector('#accountDropdown')) {
      accountMenu.innerHTML = `
        <button id="accountCircleBtn" class="account-circle-btn" type="button" aria-haspopup="true" aria-expanded="false" title="Account">
          <img id="accountCircleAvatar" class="account-circle-avatar" src="" alt="Profile avatar" hidden>
          <span id="accountCircleInitial" class="account-circle-initial">?</span>
        </button>
        <div id="accountDropdown" class="account-dropdown" hidden>
          <p id="accountEmail" class="account-email">Signed in</p>
          <div id="accountFavoriteOst" class="account-favorite-ost" hidden>
            <p id="accountFavoriteOstName" class="account-favorite-ost-name"></p>
            <audio id="accountFavoriteOstPlayer" class="account-favorite-ost-player" controls preload="none"></audio>
            <a id="accountFavoriteOstLink" class="account-favorite-ost-link" href="#" target="_blank" rel="noopener noreferrer"></a>
          </div>
          <div id="accountFavoriteMonster" class="account-favorite-monster" hidden>
            <img id="accountFavoriteMonsterImage" class="account-favorite-monster-image" src="" alt="Favorite monster">
            <p id="accountFavoriteMonsterName" class="account-favorite-monster-name"></p>
          </div>
          <button id="profileBtn" class="account-profile-btn" type="button">Profile</button>
          <button id="logoutBtn" class="account-logout-btn" type="button">Logout</button>
        </div>
      `;
    }

    return {
      loginBtn,
      accountMenu,
      accountCircleBtn: document.getElementById('accountCircleBtn'),
      accountCircleAvatar: document.getElementById('accountCircleAvatar'),
      accountDropdown: document.getElementById('accountDropdown'),
      accountEmail: document.getElementById('accountEmail'),
      accountCircleInitial: document.getElementById('accountCircleInitial'),
      accountFavoriteOst: document.getElementById('accountFavoriteOst'),
      accountFavoriteOstName: document.getElementById('accountFavoriteOstName'),
      accountFavoriteOstPlayer: document.getElementById('accountFavoriteOstPlayer'),
      accountFavoriteOstLink: document.getElementById('accountFavoriteOstLink'),
      accountFavoriteMonster: document.getElementById('accountFavoriteMonster'),
      accountFavoriteMonsterImage: document.getElementById('accountFavoriteMonsterImage'),
      accountFavoriteMonsterName: document.getElementById('accountFavoriteMonsterName'),
      profileBtn: document.getElementById('profileBtn'),
      logoutBtn: document.getElementById('logoutBtn')
    };
  }

  function getTokenPayload(token) {
    if (!token) return null;
    try {
      const base64Url = token.split('.')[1];
      if (!base64Url) return null;
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      return JSON.parse(atob(padded));
    } catch {
      return null;
    }
  }

  function getUserEmail() {
    const payload = getTokenPayload(localStorage.getItem('id_token'));
    return payload?.email || payload?.['cognito:username'] || 'Signed in';
  }

  function getUserCacheId() {
    const payload = getIdTokenPayload();
    return payload?.sub || getUserEmail();
  }

  function getIdTokenPayload() {
    return getTokenPayload(localStorage.getItem('id_token'));
  }

  function getAccessToken() {
    return localStorage.getItem('access_token') || '';
  }

  function isTokenExpired(token, skewSeconds) {
    const payload = getTokenPayload(token);
    if (!payload || !payload.exp) return true;
    const skewMs = (skewSeconds || 30) * 1000;
    return Date.now() >= (payload.exp * 1000 - skewMs);
  }

  async function refreshAccessToken() {
    if (refreshPromise) return refreshPromise;

    const refreshToken = localStorage.getItem('refresh_token') || '';
    if (!refreshToken) return '';

    refreshPromise = (async function () {
      try {
        logNavDebug('Refreshing access token', { url: `${cognitoDomain}/oauth2/token` });
        const response = await fetch(`${cognitoDomain}/oauth2/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: clientId,
            refresh_token: refreshToken
          })
        });

        if (!response.ok) throw new Error('Token refresh failed');
        const tokens = await response.json();

        if (tokens.id_token) {
          localStorage.setItem('id_token', tokens.id_token);
        }
        if (tokens.access_token) {
          localStorage.setItem('access_token', tokens.access_token);
        }
        if (tokens.refresh_token) {
          localStorage.setItem('refresh_token', tokens.refresh_token);
        }

        return localStorage.getItem('access_token') || '';
      } catch {
        localStorage.removeItem('access_token');
        localStorage.removeItem('id_token');
        localStorage.removeItem('refresh_token');
        return '';
      } finally {
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  }

  async function getValidAccessToken() {
    const token = getAccessToken();
    if (token && !isTokenExpired(token, 30)) {
      return token;
    }
    return await refreshAccessToken();
  }

  function getUserInitial(email) {
    if (!email || typeof email !== 'string') return '?';
    return email.trim().charAt(0).toUpperCase() || '?';
  }

  function getAvatarStorageKey(email) {
    if (!email) return '';
    return `profile_avatar:${email.toLowerCase()}`;
  }

  function getProfileSummaryKey(email) {
    const userCacheId = getUserCacheId();
    const cacheId = String(userCacheId || email || '').trim().toLowerCase();
    if (!cacheId) return '';
    return `profile_summary:${cacheId}`;
  }

  function getLegacyProfileSummaryKey(email) {
    if (!email) return '';
    return `profile_summary:${email.toLowerCase()}`;
  }

  function parseCachedProfileSummary(raw) {
    try {
      const parsed = JSON.parse(raw || 'null');
      if (!parsed || typeof parsed !== 'object') return null;
      return {
        avatar: normalizeAvatarFile(parsed.avatar || ''),
        favoriteOst: normalizeFavoriteOst(parsed.favoriteOst),
        favoriteMonster: normalizeFavoriteMonster(parsed.favoriteMonster),
        syncedAt: Number(parsed.syncedAt) || 0
      };
    } catch {
      return null;
    }
  }

  function getCachedProfileSummary(email) {
    const key = getProfileSummaryKey(email);
    if (key) {
      const parsed = parseCachedProfileSummary(localStorage.getItem(key));
      if (parsed) return parsed;
    }

    const legacyKey = getLegacyProfileSummaryKey(email);
    if (!legacyKey || legacyKey === key) return null;
    const legacyParsed = parseCachedProfileSummary(localStorage.getItem(legacyKey));
    if (!legacyParsed) return null;

    if (key) {
      localStorage.setItem(key, JSON.stringify({
        avatar: legacyParsed.avatar,
        favoriteOst: legacyParsed.favoriteOst,
        favoriteMonster: legacyParsed.favoriteMonster,
        syncedAt: legacyParsed.syncedAt || Date.now()
      }));
    }
    return legacyParsed;
  }

  function setCachedProfileSummary(email, summary) {
    const key = getProfileSummaryKey(email);
    if (!key) return;
    const payload = {
      avatar: normalizeAvatarFile(summary?.avatar || ''),
      favoriteOst: normalizeFavoriteOst(summary?.favoriteOst),
      favoriteMonster: normalizeFavoriteMonster(summary?.favoriteMonster),
      syncedAt: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(payload));
  }

  function getProfileBootstrapKey() {
    const userCacheId = getUserCacheId();
    if (!userCacheId) return '';
    return `profile_bootstrap_done:${String(userCacheId).toLowerCase()}`;
  }

  function getAvatarLastSyncKey() {
    const userCacheId = getUserCacheId();
    if (!userCacheId) return '';
    return `profile_avatar_last_sync:${String(userCacheId).toLowerCase()}`;
  }

  function getAvatarLastSyncMs() {
    const key = getAvatarLastSyncKey();
    if (!key) return 0;
    const raw = localStorage.getItem(key);
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function setAvatarLastSyncNow() {
    const key = getAvatarLastSyncKey();
    if (!key) return;
    localStorage.setItem(key, String(Date.now()));
  }

  function shouldRefreshAvatarFromServer(email) {
    if (!email) return false;
    if (!getSavedAvatarFile(email)) return true;
    const lastSync = getAvatarLastSyncMs();
    if (!lastSync) return true;
    return Date.now() - lastSync >= AVATAR_SYNC_TTL_MS;
  }

  function shouldRefreshProfileFromServer(email) {
    if (!email) return false;
    const summary = getCachedProfileSummary(email);
    if (!summary || !summary.syncedAt) {
      logNavDebug('Profile cache miss; server refresh required.');
      return true;
    }
    const cacheAgeMs = Date.now() - summary.syncedAt;
    const shouldRefresh = cacheAgeMs >= PROFILE_SYNC_TTL_MS;
    logNavDebug('Profile cache check', {
      cacheAgeMs,
      profileSyncTtlMs: PROFILE_SYNC_TTL_MS,
      shouldRefresh
    });
    return shouldRefresh;
  }

  function normalizeAvatarFile(fileName) {
    if (!fileName || typeof fileName !== 'string') return '';
    const match = AVATAR_OPTIONS.find((option) => option.toLowerCase() === fileName.toLowerCase());
    return match || '';
  }

  function getAvatarUrl(fileName) {
    const normalized = normalizeAvatarFile(fileName);
    if (!normalized) return '';
    return new URL(`images/decoration/${normalized}`, projectRootUrl).href;
  }

  function getSavedAvatarFile(email) {
    const key = getAvatarStorageKey(email);
    if (!key) return '';
    return normalizeAvatarFile(localStorage.getItem(key) || '');
  }

  function setSavedAvatarFile(email, fileName) {
    const key = getAvatarStorageKey(email);
    if (!key) return;
    const normalized = normalizeAvatarFile(fileName);
    localStorage.removeItem(key);
    if (!normalized) {
      return;
    }
    localStorage.setItem(key, normalized);
  }

  function applyAvatar(email) {
    const avatarFile = getSavedAvatarFile(email);
    if (!avatarFile) {
      ui.accountCircleAvatar.hidden = true;
      ui.accountCircleAvatar.src = '';
      ui.accountCircleInitial.hidden = false;
      return;
    }

    ui.accountCircleAvatar.src = getAvatarUrl(avatarFile);
    ui.accountCircleAvatar.hidden = false;
    ui.accountCircleInitial.hidden = true;
  }

  function getSetupValuesByType(setups, setupType) {
    if (!Array.isArray(setups)) return null;
    const match = setups.find((setup) => setup?.type === setupType && setup?.values);
    return match?.values || null;
  }

  function normalizeFavoriteOst(values) {
    if (!values || typeof values !== 'object') return null;
    const songName = String(values.songName || '').trim();
    const songUrl = String(values.songUrl || '').trim();
    if (!songName || !songUrl) return null;
    return { songName, songUrl };
  }

  function normalizeFavoriteMonster(values) {
    if (!values || typeof values !== 'object') return null;
    const monsterName = String(values.monsterName || '').trim();
    const monsterId = String(values.monsterId || '').trim();
    const imageUrl = String(values.imageUrl || '').trim();
    if (!monsterName || !monsterId) return null;
    return { monsterName, monsterId, imageUrl };
  }

  function clearFavoriteOstUi() {
    ui.accountFavoriteOst.hidden = true;
    ui.accountFavoriteOstName.textContent = '';
    ui.accountFavoriteOstPlayer.pause();
    ui.accountFavoriteOstPlayer.removeAttribute('src');
    ui.accountFavoriteOstPlayer.load();
    ui.accountFavoriteOstLink.href = '#';
  }

  function clearFavoriteMonsterUi() {
    ui.accountFavoriteMonster.hidden = true;
    ui.accountFavoriteMonsterName.textContent = '';
    ui.accountFavoriteMonsterImage.removeAttribute('src');
  }

  function applyFavoriteOstUi(favoriteOst) {
    if (!favoriteOst) {
      clearFavoriteOstUi();
      return;
    }

    ui.accountFavoriteOstName.textContent = favoriteOst.songName;
    if (ui.accountFavoriteOstPlayer.src !== favoriteOst.songUrl) {
      ui.accountFavoriteOstPlayer.src = favoriteOst.songUrl;
      ui.accountFavoriteOstPlayer.load();
    }
    ui.accountFavoriteOstLink.href = favoriteOst.songUrl;
    ui.accountFavoriteOst.hidden = false;
  }

  function applyFavoriteMonsterUi(favoriteMonster) {
    if (!favoriteMonster) {
      clearFavoriteMonsterUi();
      return;
    }

    ui.accountFavoriteMonsterName.textContent = favoriteMonster.monsterName;
    if (favoriteMonster.imageUrl) {
      if (ui.accountFavoriteMonsterImage.src !== favoriteMonster.imageUrl) {
        ui.accountFavoriteMonsterImage.src = favoriteMonster.imageUrl;
      }
      ui.accountFavoriteMonsterImage.hidden = false;
    } else {
      ui.accountFavoriteMonsterImage.hidden = true;
      ui.accountFavoriteMonsterImage.removeAttribute('src');
    }
    ui.accountFavoriteMonster.hidden = false;
  }

  async function fetchProfileFromApi() {
    const accessToken = await getValidAccessToken();
    if (!accessToken) return null;

    try {
      logNavDebug('Fetching profile from API', { url: `${profileApiBase}/profile` });
      const response = await fetch(`${profileApiBase}/profile`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!response.ok) return null;
      const profile = await response.json();
      return {
        avatar: normalizeAvatarFile(profile?.avatar || ''),
        favoriteOst: normalizeFavoriteOst(getSetupValuesByType(profile?.equipmentSetups, FAVORITE_OST_SETUP_TYPE)),
        favoriteMonster: normalizeFavoriteMonster(getSetupValuesByType(profile?.equipmentSetups, FAVORITE_MONSTER_SETUP_TYPE))
      };
    } catch {
      return null;
    }
  }

  async function syncProfileFromServer(email, forceRefresh) {
    if (!email) return;
    if (!forceRefresh && !shouldRefreshProfileFromServer(email)) {
      logNavDebug('Skipped profile API call; using cached profile summary.', { email });
      return;
    }

    const shouldRefreshAvatar = shouldRefreshAvatarFromServer(email);
    const serverProfile = await fetchProfileFromApi();
    if (!serverProfile) return;

    setCachedProfileSummary(email, serverProfile);
    applyFavoriteOstUi(serverProfile.favoriteOst);
    applyFavoriteMonsterUi(serverProfile.favoriteMonster);

    if (!shouldRefreshAvatar) return;
    setAvatarLastSyncNow();

    if (!serverProfile.avatar) return;
    setSavedAvatarFile(email, serverProfile.avatar);
    applyAvatar(email);
  }

  const ui = ensureAccountMarkup();

  function setAccountDropdownOpen(isOpen) {
    ui.accountDropdown.hidden = !isOpen;
    ui.accountCircleBtn.setAttribute('aria-expanded', String(isOpen));
  }

  function updateUI(forceServerSync) {
    if (localStorage.getItem('id_token')) {
      const email = getUserEmail();
      const cachedProfile = getCachedProfileSummary(email);

      ui.loginBtn.style.display = 'none';
      ui.accountMenu.style.display = 'inline-flex';
      ui.accountEmail.textContent = email;
      ui.accountCircleInitial.textContent = getUserInitial(email);

      if (cachedProfile?.avatar) {
        setSavedAvatarFile(email, cachedProfile.avatar);
      }
      applyAvatar(email);

      if (cachedProfile?.favoriteOst) {
        applyFavoriteOstUi(cachedProfile.favoriteOst);
      } else {
        clearFavoriteOstUi();
      }

      if (cachedProfile?.favoriteMonster) {
        applyFavoriteMonsterUi(cachedProfile.favoriteMonster);
      } else {
        clearFavoriteMonsterUi();
      }

      syncProfileFromServer(email, !!forceServerSync);
    } else {
      ui.loginBtn.style.display = 'inline-block';
      ui.accountMenu.style.display = 'none';
      ui.accountCircleAvatar.hidden = true;
      ui.accountCircleAvatar.src = '';
      ui.accountCircleInitial.hidden = false;
      clearFavoriteOstUi();
      clearFavoriteMonsterUi();
    }

    setAccountDropdownOpen(false);
  }

  async function handleRedirect() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (!code) {
      updateUI();
      return;
    }

    try {
      const response = await fetch(`${cognitoDomain}/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          code,
          redirect_uri: redirectUri
        })
      });

      const tokens = await response.json();
      if (tokens.id_token) {
        localStorage.setItem('id_token', tokens.id_token);
        localStorage.setItem('access_token', tokens.access_token || '');
        if (tokens.refresh_token) {
          localStorage.setItem('refresh_token', tokens.refresh_token);
        }
      }
    } catch {
    }

    window.history.replaceState({}, document.title, window.location.pathname);
    updateUI();
  }

  ui.loginBtn.addEventListener('click', function (event) {
    event.preventDefault();
    const loginUrl =
      `${cognitoDomain}/login?client_id=${clientId}` +
      `&response_type=code` +
      `&scope=email+openid+phone` +
      `&redirect_uri=${redirectUri}`;
    window.location.href = loginUrl;
  });

  ui.logoutBtn.addEventListener('click', function () {
    localStorage.clear();
    const logoutUrl = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${redirectUri}`;
    window.location.href = logoutUrl;
  });

  ui.profileBtn.addEventListener('click', function () {
    const profileUrl = new URL('profile.html', projectRootUrl);
    window.location.href = profileUrl.href;
  });

  ui.accountCircleBtn.addEventListener('click', function (event) {
    event.stopPropagation();
    setAccountDropdownOpen(ui.accountDropdown.hidden);
  });

  document.addEventListener('click', function (event) {
    if (!ui.accountMenu.contains(event.target)) {
      setAccountDropdownOpen(false);
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      setAccountDropdownOpen(false);
    }
  });

  window.MSCWAuth = {
    avatarOptions: AVATAR_OPTIONS.slice(),
    getUserEmail,
    getIdTokenPayload,
    getAccessToken,
    getValidAccessToken,
    getSavedAvatarFile,
    setSavedAvatarFile,
    getAvatarUrl,
    setNavDebug: function (enabled) {
      localStorage.setItem(NAV_DEBUG_FLAG_KEY, enabled ? '1' : '0');
    },
    refreshNavProfile: function () {
      updateUI(true);
    },
    redirectToLogin: function () {
      const loginUrl =
        `${cognitoDomain}/login?client_id=${clientId}` +
        `&response_type=code` +
        `&scope=email+openid+phone` +
        `&redirect_uri=${redirectUri}`;
      window.location.href = loginUrl;
    }
  };

  handleRedirect();
})();
