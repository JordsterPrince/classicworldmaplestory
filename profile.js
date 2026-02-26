(function () {
  const auth = window.MSCWAuth;
  if (!auth) return;
  const API_BASE = 'https://otvk1as2n9.execute-api.us-east-1.amazonaws.com';
  const FAVORITE_OST_SETUP_TYPE = 'favorite-maple-ost';
  const FAVORITE_MONSTER_SETUP_TYPE = 'favorite-maple-monster';

  const avatarGrid = document.getElementById('profileAvatarGrid');
  const saveBtn = document.getElementById('profileSaveBtn');
  const statusEl = document.getElementById('profileStatus');
  const loginBox = document.getElementById('profileLoginBox');
  const loginBtn = document.getElementById('profileLoginBtn');
  const usernameEl = document.getElementById('profileUsername');
  const emailEl = document.getElementById('profileEmail');
  const favoriteOstEl = document.getElementById('profileFavoriteOst');
  const favoriteMonsterEl = document.getElementById('profileFavoriteMonster');
  const statEqInfoEl = document.getElementById('profileStatEqInfo');
  const statEqLinkEl = document.getElementById('profileStatEqLink');
  const ostSelectEl = document.getElementById('profileOstSelect');
  const ostPlayerEl = document.getElementById('profileOstPlayer');
  const ostSaveBtnEl = document.getElementById('profileOstSaveBtn');
  const ostStatusEl = document.getElementById('profileOstStatus');
  const monsterSelectEl = document.getElementById('profileMonsterSelect');
  const monsterSaveBtnEl = document.getElementById('profileMonsterSaveBtn');
  const monsterStatusEl = document.getElementById('profileMonsterStatus');
  const monsterPreviewEl = document.getElementById('profileMonsterPreview');
  const monsterPreviewImageEl = document.getElementById('profileMonsterPreviewImage');

  if (!avatarGrid || !saveBtn || !statusEl || !loginBox || !loginBtn || !usernameEl || !emailEl || !favoriteOstEl || !favoriteMonsterEl || !statEqInfoEl || !statEqLinkEl || !ostSelectEl || !ostPlayerEl || !ostSaveBtnEl || !ostStatusEl || !monsterSelectEl || !monsterSaveBtnEl || !monsterStatusEl || !monsterPreviewEl || !monsterPreviewImageEl) return;

  const userEmail = auth.getUserEmail();
  const idTokenPayload = auth.getIdTokenPayload ? auth.getIdTokenPayload() : null;
  const usernameForProfile =
    idTokenPayload?.preferred_username ||
    idTokenPayload?.['cognito:username'] ||
    idTokenPayload?.email?.split('@')[0] ||
    '—';
  const emailForProfile = idTokenPayload?.email || userEmail;
  const isLoggedIn = !!localStorage.getItem('id_token');

  let selectedAvatar = '';
  let currentProfile = null;
  let ostOptions = [];
  let monsterOptions = [];
  let pendingSavedOst = null;
  let pendingSavedMonster = null;

  function formatAvatarLabel(fileName) {
    return fileName
      .replace('.png', '')
      .replace(/Alert/ig, ' Alert')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function setStatus(message) {
    statusEl.textContent = message || '';
  }

  function renderAccountInfo(favoriteSongName, favoriteMonsterName) {
    usernameEl.textContent = usernameForProfile || '—';
    emailEl.textContent = emailForProfile || '—';
    favoriteOstEl.textContent = favoriteSongName || '—';
    favoriteMonsterEl.textContent = favoriteMonsterName || '—';
  }

  function getStatEqFromEquipmentSetups(setups) {
    if (!Array.isArray(setups)) return null;
    const statEqSetup = setups.find((setup) => setup?.type === 'stat-equivalence' && setup?.values);
    return statEqSetup?.values || null;
  }

  function getSetupValuesByType(setups, type) {
    if (!Array.isArray(setups)) return null;
    const match = setups.find((setup) => setup?.type === type && setup?.values);
    return match?.values || null;
  }

  function mergeSetupByType(existingSetups, type, values) {
    const setups = Array.isArray(existingSetups) ? existingSetups.filter(Boolean) : [];
    const filtered = setups.filter((setup) => setup?.type !== type);
    filtered.push({ type, values });
    return filtered;
  }

  function setOstStatus(message) {
    ostStatusEl.textContent = message || '';
  }

  function setMonsterStatus(message) {
    monsterStatusEl.textContent = message || '';
  }

  function normalizeSong(song) {
    if (!song || typeof song !== 'object') return null;
    const songName = String(song.songName || '').trim();
    const songUrl = String(song.songUrl || '').trim();
    if (!songName || !songUrl) return null;
    return { songName, songUrl };
  }

  function extractUniqueSongs(mapsData) {
    if (!Array.isArray(mapsData)) return [];
    const byKey = new Map();

    mapsData.forEach((entry) => {
      const songName = String(entry?.['Map Song Name'] || '').trim();
      const songUrl = String(entry?.['Map Song'] || '').trim();
      if (!songName || !songUrl) return;
      const dedupeKey = `${songName.toLowerCase()}|${songUrl}`;
      if (!byKey.has(dedupeKey)) {
        byKey.set(dedupeKey, { songName, songUrl });
      }
    });

    return Array.from(byKey.values()).sort((a, b) => a.songName.localeCompare(b.songName));
  }

  function normalizeMonster(monster) {
    if (!monster || typeof monster !== 'object') return null;
    const monsterName = String(monster.monsterName || '').trim();
    const monsterId = String(monster.monsterId || '').trim();
    const imageUrl = String(monster.imageUrl || '').trim();
    if (!monsterName || !monsterId) return null;
    return { monsterName, monsterId, imageUrl };
  }

  function extractUniqueMonsters(mobsData) {
    if (!Array.isArray(mobsData)) return [];
    const byId = new Map();

    mobsData.forEach((entry) => {
      const monsterName = String(entry?.Name || '').trim();
      const rawId = entry?.MOBID;
      const monsterId = String(rawId ?? '').trim();
      const imageUrl = String(entry?.Picture || '').trim();
      if (!monsterName || !monsterId) return;
      if (!byId.has(monsterId)) {
        byId.set(monsterId, { monsterName, monsterId, imageUrl });
      }
    });

    return Array.from(byId.values()).sort((a, b) => a.monsterName.localeCompare(b.monsterName));
  }

  function renderOstDropdown(selectedSongUrl) {
    if (!ostOptions.length) {
      ostSelectEl.innerHTML = '<option value="">No songs available</option>';
      ostSelectEl.disabled = true;
      ostPlayerEl.hidden = true;
      ostPlayerEl.removeAttribute('src');
      return;
    }

    const optionsHtml = ostOptions
      .map((song) => `<option value="${song.songUrl}">${song.songName}</option>`)
      .join('');

    ostSelectEl.innerHTML = `<option value="">Select a song</option>${optionsHtml}`;
    ostSelectEl.disabled = false;

    if (selectedSongUrl && ostOptions.some((song) => song.songUrl === selectedSongUrl)) {
      ostSelectEl.value = selectedSongUrl;
    } else {
      ostSelectEl.value = '';
    }

    updateOstPlayer();
  }

  function updateOstPlayer() {
    const selectedSongUrl = ostSelectEl.value;
    if (!selectedSongUrl) {
      ostPlayerEl.hidden = true;
      ostPlayerEl.pause();
      ostPlayerEl.removeAttribute('src');
      ostPlayerEl.load();
      return;
    }

    if (ostPlayerEl.src !== selectedSongUrl) {
      ostPlayerEl.src = selectedSongUrl;
      ostPlayerEl.load();
    }
    ostPlayerEl.hidden = false;
  }

  function renderMonsterDropdown(selectedMonsterId) {
    if (!monsterOptions.length) {
      monsterSelectEl.innerHTML = '<option value="">No monsters available</option>';
      monsterSelectEl.disabled = true;
      updateMonsterPreview('');
      return;
    }

    const optionsHtml = monsterOptions
      .map((monster) => `<option value="${monster.monsterId}">${monster.monsterName}</option>`)
      .join('');

    monsterSelectEl.innerHTML = `<option value="">Select a monster</option>${optionsHtml}`;
    monsterSelectEl.disabled = false;

    if (selectedMonsterId && monsterOptions.some((monster) => monster.monsterId === selectedMonsterId)) {
      monsterSelectEl.value = selectedMonsterId;
    } else {
      monsterSelectEl.value = '';
    }

    updateMonsterPreview(monsterSelectEl.value);
  }

  function updateMonsterPreview(selectedMonsterId) {
    if (!selectedMonsterId) {
      monsterPreviewEl.hidden = true;
      monsterPreviewImageEl.removeAttribute('src');
      return;
    }

    const selectedMonster = monsterOptions.find((monster) => monster.monsterId === selectedMonsterId);
    const imageUrl = selectedMonster?.imageUrl || '';
    if (!imageUrl) {
      monsterPreviewEl.hidden = true;
      monsterPreviewImageEl.removeAttribute('src');
      return;
    }

    if (monsterPreviewImageEl.src !== imageUrl) {
      monsterPreviewImageEl.src = imageUrl;
    }
    monsterPreviewImageEl.alt = `${selectedMonster?.monsterName || 'Monster'} image`;
    monsterPreviewEl.hidden = false;
  }

  async function loadOstOptions() {
    try {
      const response = await fetch('JSONS/maps.json');
      if (!response.ok) throw new Error('Failed to load songs');
      const mapsData = await response.json();
      ostOptions = extractUniqueSongs(mapsData);
      renderOstDropdown(pendingSavedOst?.songUrl);
      setOstStatus('');
    } catch {
      ostOptions = [];
      renderOstDropdown('');
      setOstStatus('Could not load songs.');
    }
  }

  async function loadMonsterOptions() {
    try {
      const response = await fetch('JSONS/mobs.json');
      if (!response.ok) throw new Error('Failed to load monsters');
      const mobsData = await response.json();
      monsterOptions = extractUniqueMonsters(mobsData);
      renderMonsterDropdown(pendingSavedMonster?.monsterId);
      setMonsterStatus('');
    } catch {
      monsterOptions = [];
      renderMonsterDropdown('');
      setMonsterStatus('Could not load monsters.');
    }
  }

  function applySavedOst(profile) {
    pendingSavedOst = normalizeSong(getSetupValuesByType(profile?.equipmentSetups, FAVORITE_OST_SETUP_TYPE));
    renderAccountInfo(pendingSavedOst?.songName || null, pendingSavedMonster?.monsterName || null);
    renderOstDropdown(pendingSavedOst?.songUrl);
  }

  function applySavedMonster(profile) {
    pendingSavedMonster = normalizeMonster(getSetupValuesByType(profile?.equipmentSetups, FAVORITE_MONSTER_SETUP_TYPE));
    renderAccountInfo(pendingSavedOst?.songName || null, pendingSavedMonster?.monsterName || null);
    renderMonsterDropdown(pendingSavedMonster?.monsterId);
  }

  function renderStatEquivalence(profile) {
    const statEqValues =
      getStatEqFromEquipmentSetups(profile?.equipmentSetups) ||
      (function () {
        try {
          return JSON.parse(localStorage.getItem('statEqValues') || 'null');
        } catch {
          return null;
        }
      })();

    const hasValues =
      statEqValues &&
      Number.isFinite(Number(statEqValues.secToPrimary)) &&
      Number.isFinite(Number(statEqValues.atkPowerToPrimary)) &&
      Number.isFinite(Number(statEqValues.wAttToPrimary));

    if (!hasValues) {
      statEqInfoEl.textContent = 'No stat equivalence has been saved yet.';
      statEqLinkEl.hidden = false;
      return;
    }

    statEqInfoEl.innerHTML =
      `1 Secondary Stat = ${Number(statEqValues.secToPrimary).toFixed(3)} Primary Stat<br>` +
      `1 Attack Power = ${Number(statEqValues.atkPowerToPrimary).toFixed(3)} Primary Stat<br>` +
      `1 W.Att = ${Number(statEqValues.wAttToPrimary).toFixed(3)} Primary Stat`;
    statEqLinkEl.hidden = true;
  }

  async function fetchProfile() {
    const accessToken = auth.getValidAccessToken
      ? await auth.getValidAccessToken()
      : (auth.getAccessToken ? auth.getAccessToken() : '');
    if (!accessToken) return null;

    try {
      const response = await fetch(`${API_BASE}/profile`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  async function saveProfile(avatar) {
    const accessToken = auth.getValidAccessToken
      ? await auth.getValidAccessToken()
      : (auth.getAccessToken ? auth.getAccessToken() : '');
    if (!accessToken) {
      throw new Error('Missing access token');
    }

    const existingProfile = currentProfile || await fetchProfile();

    const response = await fetch(`${API_BASE}/profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        email: existingProfile?.email || emailForProfile,
        avatar,
        equipmentSetups: existingProfile?.equipmentSetups
      })
    });

    if (!response.ok) {
      throw new Error('Failed to save profile');
    }

    currentProfile = {
      ...(existingProfile || {}),
      email: existingProfile?.email || emailForProfile,
      avatar,
      equipmentSetups: existingProfile?.equipmentSetups
    };
  }

  async function saveFavoriteOst() {
    const selectedSongUrl = ostSelectEl.value;
    if (!selectedSongUrl) {
      setOstStatus('Select a song before saving.');
      return;
    }

    const selectedSong = ostOptions.find((song) => song.songUrl === selectedSongUrl);
    if (!selectedSong) {
      setOstStatus('Selected song is unavailable.');
      return;
    }

    const accessToken = auth.getValidAccessToken
      ? await auth.getValidAccessToken()
      : (auth.getAccessToken ? auth.getAccessToken() : '');
    if (!accessToken) {
      throw new Error('Missing access token');
    }

    const existingProfile = currentProfile || await fetchProfile();
    const mergedSetups = mergeSetupByType(
      existingProfile?.equipmentSetups,
      FAVORITE_OST_SETUP_TYPE,
      selectedSong
    );

    const response = await fetch(`${API_BASE}/profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        email: existingProfile?.email || emailForProfile,
        avatar: existingProfile?.avatar,
        equipmentSetups: mergedSetups
      })
    });

    if (!response.ok) {
      throw new Error('Failed to save profile');
    }

    currentProfile = {
      ...(existingProfile || {}),
      email: existingProfile?.email || emailForProfile,
      avatar: existingProfile?.avatar,
      equipmentSetups: mergedSetups
    };
    pendingSavedOst = selectedSong;
  }

  async function saveFavoriteMonster() {
    const selectedMonsterId = monsterSelectEl.value;
    if (!selectedMonsterId) {
      setMonsterStatus('Select a monster before saving.');
      return;
    }

    const selectedMonster = monsterOptions.find((monster) => monster.monsterId === selectedMonsterId);
    if (!selectedMonster) {
      setMonsterStatus('Selected monster is unavailable.');
      return;
    }

    const accessToken = auth.getValidAccessToken
      ? await auth.getValidAccessToken()
      : (auth.getAccessToken ? auth.getAccessToken() : '');
    if (!accessToken) {
      throw new Error('Missing access token');
    }

    const existingProfile = currentProfile || await fetchProfile();
    const mergedSetups = mergeSetupByType(
      existingProfile?.equipmentSetups,
      FAVORITE_MONSTER_SETUP_TYPE,
      selectedMonster
    );

    const response = await fetch(`${API_BASE}/profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        email: existingProfile?.email || emailForProfile,
        avatar: existingProfile?.avatar,
        equipmentSetups: mergedSetups
      })
    });

    if (!response.ok) {
      throw new Error('Failed to save profile');
    }

    currentProfile = {
      ...(existingProfile || {}),
      email: existingProfile?.email || emailForProfile,
      avatar: existingProfile?.avatar,
      equipmentSetups: mergedSetups
    };
    pendingSavedMonster = selectedMonster;
  }

  function renderAvatars() {
    avatarGrid.innerHTML = auth.avatarOptions
      .map((fileName) => {
        const isSelected = fileName === selectedAvatar;
        return `
          <button type="button" class="profile-avatar-option${isSelected ? ' is-selected' : ''}" data-avatar="${fileName}">
            <img src="${auth.getAvatarUrl(fileName)}" alt="${formatAvatarLabel(fileName)}">
          </button>
        `;
      })
      .join('');

    avatarGrid.querySelectorAll('.profile-avatar-option').forEach((button) => {
      button.addEventListener('click', function () {
        selectedAvatar = button.dataset.avatar || '';
        renderAvatars();
      });
    });
  }

  ostSelectEl.addEventListener('change', function () {
    setOstStatus('');
    updateOstPlayer();
  });

  monsterSelectEl.addEventListener('change', function () {
    setMonsterStatus('');
    updateMonsterPreview(monsterSelectEl.value);
  });

  if (!isLoggedIn) {
    renderAccountInfo(null, null);
    renderStatEquivalence(null);
    loadOstOptions();
    loadMonsterOptions();
    ostSaveBtnEl.disabled = true;
    setOstStatus('Log in to save your favorite OST.');
    monsterSaveBtnEl.disabled = true;
    setMonsterStatus('Log in to save your favorite monster.');
    avatarGrid.style.display = 'none';
    saveBtn.style.display = 'none';
    loginBox.style.display = 'block';
    setStatus('');
    loginBtn.addEventListener('click', function () {
      auth.redirectToLogin();
    });
    return;
  }

  selectedAvatar = auth.getSavedAvatarFile(userEmail) || auth.avatarOptions[0] || '';
  renderAvatars();
  renderAccountInfo(null, null);
  loadOstOptions();
  loadMonsterOptions();

  ostSaveBtnEl.addEventListener('click', async function () {
    ostSaveBtnEl.disabled = true;
    setOstStatus('Saving...');

    try {
      await saveFavoriteOst();
      renderAccountInfo(pendingSavedOst?.songName || null, pendingSavedMonster?.monsterName || null);
      auth.refreshNavProfile();
      setOstStatus('Favorite Maple OST saved.');
    } catch {
      setOstStatus('Could not save to server.');
    } finally {
      ostSaveBtnEl.disabled = false;
    }
  });

  monsterSaveBtnEl.addEventListener('click', async function () {
    monsterSaveBtnEl.disabled = true;
    setMonsterStatus('Saving...');

    try {
      await saveFavoriteMonster();
      renderAccountInfo(pendingSavedOst?.songName || null, pendingSavedMonster?.monsterName || null);
      auth.refreshNavProfile();
      setMonsterStatus('Favorite monster saved.');
    } catch {
      setMonsterStatus('Could not save to server.');
    } finally {
      monsterSaveBtnEl.disabled = false;
    }
  });

  (async function hydrateProfileFromApi() {
    const serverProfile = await fetchProfile();
    currentProfile = serverProfile;
    renderStatEquivalence(serverProfile);
    applySavedOst(serverProfile);
    applySavedMonster(serverProfile);
    const serverAvatar = serverProfile?.avatar;
    if (!serverAvatar || !auth.avatarOptions.includes(serverAvatar)) return;
    selectedAvatar = serverAvatar;
    auth.setSavedAvatarFile(userEmail, serverAvatar);
    renderAvatars();
  })();

  saveBtn.addEventListener('click', async function () {
    if (!selectedAvatar) {
      setStatus('Select an avatar before saving.');
      return;
    }

    saveBtn.disabled = true;
    setStatus('Saving...');

    try {
      await saveProfile(selectedAvatar);
      auth.setSavedAvatarFile(userEmail, selectedAvatar);
      auth.refreshNavProfile();
      setStatus('Avatar saved.');
    } catch {
      setStatus('Could not save to server.');
    } finally {
      saveBtn.disabled = false;
    }
  });
})();
