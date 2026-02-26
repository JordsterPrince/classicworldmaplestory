(function () {
  const TOURNAMENT_API_BASE_URL = 'https://gpru95fhkh.execute-api.us-east-1.amazonaws.com';
  const CREATE_TOURNAMENT_API_URL = `${TOURNAMENT_API_BASE_URL}/tournament/create`;
  const UPDATE_TOURNAMENT_API_URL = `${TOURNAMENT_API_BASE_URL}/tournament/update`;
  const LEADERBOARD_API_URL = `${TOURNAMENT_API_BASE_URL}/tournament/leaderboard`;
  const PROFILE_API_BASE_URL = 'https://otvk1as2n9.execute-api.us-east-1.amazonaws.com';
  const FAVORITE_OST_SETUP_TYPE = 'favorite-maple-ost';
  const FAVORITE_MONSTER_SETUP_TYPE = 'favorite-maple-monster';
  const MIN_BRACKET_SIZE = 2;

  const typeCardsContainerEl = document.getElementById('tournamentTypeCards');
  const tournamentControlsEl = document.getElementById('tournamentControls');
  const typeCardEls = Array.from(document.querySelectorAll('.tournament-type-card[data-type]'));
  const actionPanelEl = document.getElementById('tournamentActionPanel');
  const selectedTypeEl = document.getElementById('tournamentSelectedType');
  const leaderboardBodyEl = document.getElementById('tournamentLeaderboardBody');
  const startBtnEl = document.getElementById('startTournamentBtn');
  const lockRoundBtnEl = document.getElementById('lockRoundBtn');
  const lockRoundBtnBottomEl = document.getElementById('lockRoundBtnBottom');
  const loginBoxEl = document.getElementById('tournamentLoginBox');
  const loginBtnEl = document.getElementById('tournamentLoginBtn');
  const statusEl = document.getElementById('tournamentStatus');
  const championEl = document.getElementById('tournamentChampion');
  const bracketContainerEl = document.getElementById('bracketContainer');
  const championModalOverlayEl = document.getElementById('tournamentChampionModalOverlay');
  const championModalCloseEl = document.getElementById('tournamentChampionModalClose');
  const championModalTitleEl = document.getElementById('tournamentChampionModalTitle');
  const championModalWinnerEl = document.getElementById('tournamentChampionModalWinner');
  const championModalRunnerUpEl = document.getElementById('tournamentChampionModalRunnerUp');
  const championModalQuestionEl = document.getElementById('tournamentChampionModalQuestion');
  const championModalActionsEl = document.getElementById('tournamentChampionModalActions');
  const championModalYesEl = document.getElementById('tournamentChampionModalYes');
  const championModalNoEl = document.getElementById('tournamentChampionModalNo');

  if (
    !typeCardsContainerEl ||
    !tournamentControlsEl ||
    !actionPanelEl ||
    !selectedTypeEl ||
    !leaderboardBodyEl ||
    !startBtnEl ||
    !lockRoundBtnEl ||
    !lockRoundBtnBottomEl ||
    !loginBoxEl ||
    !loginBtnEl ||
    !statusEl ||
    !championEl ||
    !bracketContainerEl ||
    !championModalOverlayEl ||
    !championModalCloseEl ||
    !championModalTitleEl ||
    !championModalWinnerEl ||
    !championModalRunnerUpEl ||
    !championModalQuestionEl ||
    !championModalActionsEl ||
    !championModalYesEl ||
    !championModalNoEl
  ) return;

  const state = {
    isSubmittingVote: false,
    isUserLoggedIn: false,
    tournament: null,
    championCelebrated: false,
    pendingFavoriteSong: null,
    pendingFavoriteMonster: null,
    selectedTournamentType: '',
    localRoundChoices: {},
    songs: [],
    maps: [],
    monsters: []
  };

  function setStatus(message, tone) {
    statusEl.textContent = message || '';
    statusEl.classList.toggle('is-error', tone === 'error');
  }

  function setChampion(participant) {
    if (!participant) {
      championEl.hidden = true;
      championEl.textContent = '';
      return;
    }
    championEl.hidden = false;
    championEl.textContent = `Champion: ${getParticipantLabel(participant)}`;
  }

  function fireBigConfetti() {
    if (typeof window.confetti !== 'function') return;
    const defaults = {
      spread: 95,
      ticks: 240,
      gravity: 0.9,
      decay: 0.92,
      startVelocity: 52,
      scalar: 1.15,
      zIndex: 5000
    };
    window.confetti({ ...defaults, particleCount: 180, origin: { x: 0.12, y: 0.58 } });
    window.confetti({ ...defaults, particleCount: 180, origin: { x: 0.88, y: 0.58 } });
    setTimeout(() => {
      window.confetti({ ...defaults, particleCount: 260, origin: { x: 0.5, y: 0.48 } });
    }, 180);
  }

  function getAuth() {
    return window.MSCWAuth || null;
  }

  function getLoggedInUserID() {
    const auth = getAuth();
    if (!auth || !auth.getIdTokenPayload) return '';
    const payload = auth.getIdTokenPayload();
    return payload?.sub || payload?.['cognito:username'] || payload?.email || '';
  }

  function isLoggedIn() {
    return state.isUserLoggedIn;
  }

  function hasLocalIdToken() {
    return !!localStorage.getItem('id_token');
  }

  async function hasValidSession() {
    const authorization = await getAuthHeader();
    return !!authorization;
  }

  function setElementVisibility(element, isVisible) {
    if (!element) return;
    element.hidden = !isVisible;
    element.style.display = isVisible ? '' : 'none';
  }

  async function updateLoginPrompt() {
    const loggedIn = hasLocalIdToken() || await hasValidSession();
    state.isUserLoggedIn = loggedIn;

    setElementVisibility(loginBoxEl, !loggedIn);
    setElementVisibility(tournamentControlsEl, loggedIn);

    if (!loggedIn) {
      state.selectedTournamentType = '';
      actionPanelEl.hidden = true;
      typeCardEls.forEach((cardEl) => {
        cardEl.classList.remove('is-selected');
      });
      startBtnEl.disabled = true;
      lockRoundBtnEl.hidden = true;
      lockRoundBtnEl.disabled = true;
      lockRoundBtnBottomEl.hidden = true;
      lockRoundBtnBottomEl.disabled = true;
      championEl.hidden = true;
      championEl.textContent = '';
      bracketContainerEl.innerHTML = '';
      closeChampionModal();
      setStatus('Log in to start and save tournaments.');
      return;
    }

    startBtnEl.disabled = false;
    if (!state.selectedTournamentType) {
      actionPanelEl.hidden = true;
    }
    setStatus('Data loaded. Pick a type and start your tournament.');
  }

  async function getAuthHeader() {
    const auth = getAuth();
    if (!auth) return '';
    const token = auth.getValidAccessToken
      ? await auth.getValidAccessToken()
      : (auth.getAccessToken ? auth.getAccessToken() : '');
    return token ? `Bearer ${token}` : '';
  }

  function getParticipantLabel(participant) {
    if (!participant || typeof participant !== 'object') return 'Unknown';
    return participant.name || participant['Map Name'] || participant['Monster Name'] || participant.songName || 'Unknown';
  }

  function getTournamentTypeIcon(tournamentType) {
    if (tournamentType === 'OST') return '♪';
    if (tournamentType === 'MAP') return '🗺️';
    if (tournamentType === 'MONSTER') return '👾';
    return '🏆';
  }

  function getTournamentTypeLabel(tournamentType) {
    if (tournamentType === 'OST') return 'Songs (OST)';
    if (tournamentType === 'MAP') return 'Maps';
    if (tournamentType === 'MONSTER') return 'Monsters';
    return 'Tournament';
  }

  function getFallbackEmail() {
    const auth = getAuth();
    if (!auth) return '';
    const payload = auth.getIdTokenPayload ? auth.getIdTokenPayload() : null;
    return payload?.email || payload?.['cognito:username'] || '';
  }

  function getSetupValuesByType(setups, setupType) {
    if (!Array.isArray(setups)) return null;
    const match = setups.find((setup) => setup?.type === setupType && setup?.values);
    return match?.values || null;
  }

  function mergeSetupByType(existingSetups, setupType, values) {
    const setups = Array.isArray(existingSetups) ? existingSetups.filter(Boolean) : [];
    const filtered = setups.filter((setup) => setup?.type !== setupType);
    filtered.push({ type: setupType, values });
    return filtered;
  }

  async function fetchProfileFromApi(authorization) {
    const response = await fetch(`${PROFILE_API_BASE_URL}/profile`, {
      method: 'GET',
      headers: {
        Authorization: authorization
      }
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    return parseApiResponse(payload);
  }

  async function saveFavoriteSongToProfile(song) {
    if (!song || !song.songName || !song.songUrl) {
      throw new Error('No song available to save.');
    }

    const authorization = await getAuthHeader();
    if (!authorization) {
      throw new Error('Session expired. Please log in again.');
    }

    const existingProfile = await fetchProfileFromApi(authorization);
    const mergedSetups = mergeSetupByType(
      existingProfile?.equipmentSetups,
      FAVORITE_OST_SETUP_TYPE,
      {
        songName: song.songName,
        songUrl: song.songUrl
      }
    );

    const response = await fetch(`${PROFILE_API_BASE_URL}/profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization
      },
      body: JSON.stringify({
        email: existingProfile?.email || getFallbackEmail(),
        avatar: existingProfile?.avatar,
        equipmentSetups: mergedSetups
      })
    });

    if (!response.ok) {
      throw new Error(await getErrorDetails(response));
    }

    return getSetupValuesByType(mergedSetups, FAVORITE_OST_SETUP_TYPE);
  }

  async function saveFavoriteMonsterToProfile(monster) {
    if (!monster || !monster.monsterName || !monster.monsterId) {
      throw new Error('No monster available to save.');
    }

    const authorization = await getAuthHeader();
    if (!authorization) {
      throw new Error('Session expired. Please log in again.');
    }

    const existingProfile = await fetchProfileFromApi(authorization);
    const mergedSetups = mergeSetupByType(
      existingProfile?.equipmentSetups,
      FAVORITE_MONSTER_SETUP_TYPE,
      {
        monsterName: monster.monsterName,
        monsterId: String(monster.monsterId),
        imageUrl: String(monster.imageUrl || '').trim()
      }
    );

    const response = await fetch(`${PROFILE_API_BASE_URL}/profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization
      },
      body: JSON.stringify({
        email: existingProfile?.email || getFallbackEmail(),
        avatar: existingProfile?.avatar,
        equipmentSetups: mergedSetups
      })
    });

    if (!response.ok) {
      throw new Error(await getErrorDetails(response));
    }

    return getSetupValuesByType(mergedSetups, FAVORITE_MONSTER_SETUP_TYPE);
  }

  function shuffleCopy(items) {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return copy;
  }

  function getLargestPowerOfTwoAtMost(value) {
    let size = 1;
    while (size * 2 <= value) {
      size *= 2;
    }
    return size;
  }

  function getSmallestPowerOfTwoAtLeast(value) {
    let size = 1;
    while (size < value) {
      size *= 2;
    }
    return size;
  }

  function createByeParticipants(count, tournamentType) {
    return Array.from({ length: count }, function (_, index) {
      return {
        id: `bye-${tournamentType || 'tournament'}-${index + 1}`,
        name: 'BYE',
        isBye: true,
        tournamentType: tournamentType || ''
      };
    });
  }

  function isApiConfigured() {
    return (
      CREATE_TOURNAMENT_API_URL &&
      UPDATE_TOURNAMENT_API_URL &&
      !CREATE_TOURNAMENT_API_URL.includes('YOUR_API_GATEWAY') &&
      !UPDATE_TOURNAMENT_API_URL.includes('YOUR_API_GATEWAY')
    );
  }

  function parseApiResponse(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    if (typeof payload.body === 'string') {
      try {
        return JSON.parse(payload.body);
      } catch {
        return payload;
      }
    }
    if (payload.body && typeof payload.body === 'object') {
      return payload.body;
    }
    return payload;
  }

  async function getErrorDetails(response) {
    try {
      const text = await response.text();
      if (!text) return `HTTP ${response.status}`;
      try {
        const parsed = JSON.parse(text);
        if (typeof parsed?.message === 'string' && parsed.message.trim()) {
          return `HTTP ${response.status}: ${parsed.message}`;
        }
        if (typeof parsed?.errorMessage === 'string' && parsed.errorMessage.trim()) {
          return `HTTP ${response.status}: ${parsed.errorMessage}`;
        }
      } catch {
      }
      return `HTTP ${response.status}: ${text.slice(0, 200)}`;
    } catch {
      return `HTTP ${response.status}`;
    }
  }

  async function parseResponseBody(response) {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  }

  async function requestCreateTournament(params) {
    const response = await fetch(CREATE_TOURNAMENT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: params.authorization
      },
      body: JSON.stringify({
        userID: params.userID,
        tournamentType: params.tournamentType,
        participants: params.participants,
        replaceExisting: !!params.replaceExisting,
        replaceTournamentID: params.replaceTournamentID || null
      })
    });

    const body = await parseResponseBody(response);
    return { ok: response.ok, status: response.status, body };
  }

  async function requestLeaderboard(tournamentType) {
    const query = new URLSearchParams({ tournamentType });
    const authorization = await getAuthHeader();
    const headers = {};
    if (authorization) {
      headers.Authorization = authorization;
    }

    const response = await fetch(`${LEADERBOARD_API_URL}?${query.toString()}`, {
      method: 'GET',
      headers
    });

    const body = await parseResponseBody(response);
    return { ok: response.ok, status: response.status, body };
  }

  function normalizeLeaderboardItems(payload) {
    const source = Array.isArray(payload)
      ? payload
      : (Array.isArray(payload?.items) ? payload.items : (Array.isArray(payload?.leaderboard) ? payload.leaderboard : []));

    return source
      .map((item) => {
        const name = String(item?.songName || item?.winnerName || item?.name || '').trim();
        const wins = Number(item?.winCount ?? item?.wins ?? item?.count ?? 0);
        return {
          name,
          wins: Number.isFinite(wins) ? wins : 0
        };
      })
      .filter((item) => !!item.name)
      .sort((a, b) => b.wins - a.wins);
  }

  function renderLeaderboardLoading() {
    leaderboardBodyEl.className = 'tournament-leaderboard-empty';
    leaderboardBodyEl.textContent = 'Loading leaderboard...';
  }

  function renderLeaderboardError(message) {
    leaderboardBodyEl.className = 'tournament-leaderboard-empty';
    leaderboardBodyEl.textContent = message || 'Could not load leaderboard yet.';
  }

  function renderLeaderboardItems(items) {
    if (!items.length) {
      leaderboardBodyEl.className = 'tournament-leaderboard-empty';
      leaderboardBodyEl.textContent = 'No winners recorded yet.';
      return;
    }

    function getOrdinal(rank) {
      const mod100 = rank % 100;
      if (mod100 >= 11 && mod100 <= 13) {
        return `${rank}th`;
      }
      const mod10 = rank % 10;
      if (mod10 === 1) return `${rank}st`;
      if (mod10 === 2) return `${rank}nd`;
      if (mod10 === 3) return `${rank}rd`;
      return `${rank}th`;
    }

    leaderboardBodyEl.className = '';
    leaderboardBodyEl.innerHTML = `
      <div class="tournament-leaderboard-head">
        <span>Rank</span>
        <span class="name-col">Song</span>
        <span class="wins-col">Wins</span>
      </div>
      <ol class="tournament-leaderboard-list">${items
        .slice(0, 10)
        .map((entry, index) => `
          <li class="tournament-leaderboard-row">
            <span class="rank">${getOrdinal(index + 1)}</span>
            <span class="name">${entry.name}</span>
            <span class="wins">${entry.wins}</span>
          </li>
        `)
        .join('')}</ol>
    `;
  }

  async function loadLeaderboardForType(tournamentType) {
    renderLeaderboardLoading();
    try {
      const result = await requestLeaderboard(tournamentType);
      if (!result.ok) {
        renderLeaderboardError(
          `Leaderboard unavailable (${result.status}).`
        );
        return;
      }

      const parsed = parseApiResponse(result.body);
      const items = normalizeLeaderboardItems(parsed);
      renderLeaderboardItems(items);
    } catch {
      renderLeaderboardError('Could not load leaderboard yet.');
    }
  }

  async function setSelectedTournamentType(tournamentType) {
    state.selectedTournamentType = tournamentType;
    typeCardEls.forEach((cardEl) => {
      cardEl.classList.toggle('is-selected', cardEl.dataset.type === tournamentType);
    });

    actionPanelEl.hidden = false;
    selectedTypeEl.textContent = `${getTournamentTypeIcon(tournamentType)} ${getTournamentTypeLabel(tournamentType)}`;
    startBtnEl.textContent = `Start ${getTournamentTypeLabel(tournamentType)} Tournament`;
    await loadLeaderboardForType(tournamentType);
  }

  function getRoundEntries(rounds) {
    return Object.entries(rounds || {}).sort((a, b) => {
      const aMatches = Array.isArray(a[1]) ? a[1].length : 0;
      const bMatches = Array.isArray(b[1]) ? b[1].length : 0;
      if (bMatches !== aMatches) return bMatches - aMatches;
      return a[0].localeCompare(b[0]);
    });
  }

  function formatRoundLabel(roundName) {
    const match = String(roundName || '').match(/^round(\d+)$/i);
    if (!match) return roundName || 'Round';
    return `Round ${match[1]}`;
  }

  function getActiveRoundName(tournament) {
    const entries = getRoundEntries(tournament?.rounds);
    for (const [roundName, matches] of entries) {
      if (Array.isArray(matches) && matches.some((match) => !match?.winner)) {
        return roundName;
      }
    }
    return '';
  }

  function getLocalChoice(roundName, matchIndex) {
    return state.localRoundChoices?.[roundName]?.[String(matchIndex)] || null;
  }

  function isByeParticipant(participant) {
    return !!participant?.isBye || getParticipantLabel(participant).toUpperCase() === 'BYE';
  }

  function getAutoWinnerForMatch(match) {
    const participantA = match?.A || null;
    const participantB = match?.B || null;
    const hasA = !!participantA;
    const hasB = !!participantB;

    if (!hasA && !hasB) return null;
    if (hasA && !hasB) return participantA;
    if (!hasA && hasB) return participantB;

    const aIsBye = isByeParticipant(participantA);
    const bIsBye = isByeParticipant(participantB);

    if (aIsBye && !bIsBye) return participantB;
    if (!aIsBye && bIsBye) return participantA;
    if (aIsBye && bIsBye) return participantA;
    return null;
  }

  function setLocalChoice(roundName, matchIndex, participant) {
    if (!state.localRoundChoices[roundName]) {
      state.localRoundChoices[roundName] = {};
    }
    state.localRoundChoices[roundName][String(matchIndex)] = participant;
  }

  function clearLocalChoicesForRound(roundName) {
    if (!roundName) return;
    delete state.localRoundChoices[roundName];
  }

  function getEffectiveWinner(roundName, matchIndex, match) {
    return getLocalChoice(roundName, matchIndex) || match?.winner || getAutoWinnerForMatch(match) || null;
  }

  function getPendingRoundChoices(roundName, matches) {
    if (!roundName || !Array.isArray(matches)) return [];
    return matches
      .map((match, matchIndex) => ({
        matchIndex,
        winner: getEffectiveWinner(roundName, matchIndex, match),
        alreadyLocked: !!match?.winner
      }))
      .filter((entry) => !!entry.winner);
  }

  function updateLockRoundButton(tournament, activeRound) {
    const allLockButtons = [lockRoundBtnEl, lockRoundBtnBottomEl];

    if (!tournament || tournament.status !== 'IN_PROGRESS' || !activeRound) {
      allLockButtons.forEach((button) => {
        button.hidden = true;
        button.disabled = true;
      });
      return;
    }

    const matches = tournament?.rounds?.[activeRound] || [];
    const allChosen = Array.isArray(matches) && matches.length > 0 && matches.every((match, index) => {
      return !!getEffectiveWinner(activeRound, index, match);
    });

    allLockButtons.forEach((button) => {
      button.hidden = false;
      button.disabled = !allChosen || state.isSubmittingVote;
      button.textContent = `Lock In ${formatRoundLabel(activeRound)} Winners`;
    });
  }

  function getFinalMatch(tournament) {
    const entries = getRoundEntries(tournament?.rounds);
    const finals = entries.filter(([, matches]) => Array.isArray(matches) && matches.length === 1);
    if (finals.length) {
      return finals[finals.length - 1][1][0] || null;
    }
    return null;
  }

  function getRunnerUpParticipant(tournament) {
    const finalMatch = getFinalMatch(tournament);
    const winner = tournament?.winner;
    if (!finalMatch || !winner) return null;

    const winnerLabel = getParticipantLabel(winner);
    const aLabel = getParticipantLabel(finalMatch.A);
    const bLabel = getParticipantLabel(finalMatch.B);

    if (winnerLabel === aLabel) return finalMatch.B || null;
    if (winnerLabel === bLabel) return finalMatch.A || null;
    return finalMatch.B || finalMatch.A || null;
  }

  function showChampionModal(tournament) {
    const winnerLabel = getParticipantLabel(tournament?.winner);
    const runnerUp = getRunnerUpParticipant(tournament);
    const runnerUpLabel = getParticipantLabel(runnerUp);
    const typeIcon = getTournamentTypeIcon(tournament?.tournamentType);
    const winnerPrefix = tournament?.tournamentType === 'OST' ? `${typeIcon} ` : `${typeIcon} `;
    const winnerSongUrl = typeof tournament?.winner?.songUrl === 'string' ? tournament.winner.songUrl.trim() : '';
    const winnerMonsterId = tournament?.winner?.id;
    const canSaveFavoriteSong = tournament?.tournamentType === 'OST' && !!winnerSongUrl;
    const canSaveFavoriteMonster = tournament?.tournamentType === 'MONSTER' && !!winnerMonsterId;
    const canSaveFavorite = canSaveFavoriteSong || canSaveFavoriteMonster;

    state.pendingFavoriteSong = canSaveFavoriteSong
      ? {
          songName: winnerLabel,
          songUrl: winnerSongUrl
        }
      : null;
    state.pendingFavoriteMonster = canSaveFavoriteMonster
      ? {
          monsterName: winnerLabel,
          monsterId: winnerMonsterId,
          imageUrl: String(tournament?.winner?.imageUrl || '').trim()
        }
      : null;

    championModalTitleEl.textContent = `${typeIcon} Tournament Winner ${typeIcon}`;
    championModalWinnerEl.textContent = `${winnerPrefix}${winnerLabel}`;
    championModalRunnerUpEl.textContent = runnerUp
      ? `Second Place: ${runnerUpLabel}`
      : '';
    championModalQuestionEl.textContent = canSaveFavoriteSong
      ? 'Save this song as your favorite Maple OST?'
      : (canSaveFavoriteMonster ? 'Save this monster as your favorite monster?' : '');
    championModalQuestionEl.hidden = !canSaveFavorite;
    championModalActionsEl.hidden = !canSaveFavorite;
    championModalYesEl.disabled = false;
    championModalOverlayEl.hidden = false;
  }

  function closeChampionModal() {
    state.pendingFavoriteSong = null;
    state.pendingFavoriteMonster = null;
    championModalOverlayEl.hidden = true;
  }

  function isWinner(participant, winner) {
    if (!participant || !winner) return false;
    return getParticipantLabel(participant) === getParticipantLabel(winner);
  }

  function getParticipantImageUrl(participant) {
    if (!participant || typeof participant !== 'object') return '';
    return String(participant.imageUrl || participant.Picture || participant['Monster Picture'] || '').trim();
  }

  function isMonsterParticipant(participant) {
    if (!participant || typeof participant !== 'object') return false;
    return participant.tournamentType === 'MONSTER' || !!participant.monsterId || !!participant.MOBID;
  }

  function buildVoteButton(roundName, matchIndex, participant, winner, canVote) {
    if (!participant) return '<div class="vote-btn" style="opacity:.6; cursor:not-allowed;">TBD</div>';

    const selectedClass = isWinner(participant, winner) ? ' style="background:#e8f2ff; border-color:#b7d5fb; font-weight:600;"' : '';
    const label = getParticipantLabel(participant);
    const participantImageUrl = getParticipantImageUrl(participant);
    const showImage = isMonsterParticipant(participant) && !!participantImageUrl;
    const imageHtml = showImage
      ? `<img class="match-participant-image" src="${participantImageUrl}" alt="${label}">`
      : '';
    const songUrl = typeof participant.songUrl === 'string' ? participant.songUrl.trim() : '';
    const playerHtml = songUrl
      ? `<audio class="match-song-player" controls preload="metadata"><source src="${songUrl}" type="audio/mpeg"></audio>`
      : '';
    const matchEntryClass = showImage ? 'match-entry match-entry-with-image' : 'match-entry';
    const isBye = isByeParticipant(participant);

    if (!canVote || isBye) {
      return `<div class="${matchEntryClass}"><div class="vote-btn"${selectedClass}>${imageHtml}<span>${label}</span></div>${playerHtml}</div>`;
    }

    const payload = encodeURIComponent(JSON.stringify(participant));
    return `<div class="${matchEntryClass}"><button class="vote-btn" data-round="${roundName}" data-index="${matchIndex}" data-participant="${payload}"${selectedClass}>${imageHtml}<span>${label}</span></button>${playerHtml}</div>`;
  }

  function renderBracket(tournament) {
    const rounds = tournament?.rounds || {};
    const entries = getRoundEntries(rounds);
    const activeRound = getActiveRoundName(tournament);

    updateLockRoundButton(tournament, activeRound);

    if (!entries.length) {
      bracketContainerEl.innerHTML = '';
      return;
    }

    bracketContainerEl.innerHTML = entries
      .map(([roundName, matches]) => {
        const matchCards = (matches || [])
          .map((match, index) => {
            const effectiveWinner = getEffectiveWinner(roundName, index, match);
            const canVote =
              tournament.status === 'IN_PROGRESS' &&
              roundName === activeRound &&
              !state.isSubmittingVote &&
              !match?.winner;
            const aButton = buildVoteButton(roundName, index, match?.A, effectiveWinner, canVote);
            const bButton = buildVoteButton(roundName, index, match?.B, effectiveWinner, canVote);
            const winnerLine = effectiveWinner
              ? `<div class="winner-line">Winner: ${getParticipantLabel(effectiveWinner)}</div>`
              : '';

            return `
              <div class="match-card">
                <div class="match-id">${match?.matchId || `${roundName}-${index + 1}`}</div>
                ${aButton}
                ${bButton}
                ${winnerLine}
              </div>
            `;
          })
          .join('');

        return `
          <div class="bracket-round">
            <h3>${formatRoundLabel(roundName)}</h3>
            ${matchCards}
          </div>
        `;
      })
      .join('');

    bracketContainerEl.querySelectorAll('button.vote-btn[data-round]').forEach((button) => {
      button.addEventListener('click', async function () {
        if (state.isSubmittingVote) return;
        const roundName = button.dataset.round;
        const matchIndex = Number(button.dataset.index);
        const participantRaw = button.dataset.participant || '';
        if (!roundName || !Number.isFinite(matchIndex) || !participantRaw) return;

        let winner = null;
        try {
          winner = JSON.parse(decodeURIComponent(participantRaw));
        } catch {
          return;
        }

        await submitWinner(roundName, matchIndex, winner);
      });
    });
  }

  async function submitWinner(roundName, matchIndex, winner) {
    setLocalChoice(roundName, matchIndex, winner);
    renderBracket(state.tournament);
    setStatus('Winner selected. You can change picks until you lock this round.');
  }

  async function lockCurrentRound() {
    if (!state.tournament || state.isSubmittingVote) return;
    const userID = getLoggedInUserID();
    if (!userID) {
      setStatus('Log in before locking winners.', 'error');
      return;
    }

    const authorization = await getAuthHeader();
    if (!authorization) {
      setStatus('Session expired. Please log in again.', 'error');
      return;
    }

    const activeRound = getActiveRoundName(state.tournament);
    if (!activeRound) {
      setStatus('No active round to lock.', 'error');
      return;
    }

    const roundMatches = state.tournament?.rounds?.[activeRound] || [];
    const pending = getPendingRoundChoices(activeRound, roundMatches);
    const allChosen = roundMatches.length > 0 && roundMatches.every((match, idx) => !!getEffectiveWinner(activeRound, idx, match));

    if (!allChosen) {
      setStatus(`Pick winners for every match in ${formatRoundLabel(activeRound)} before locking.`, 'error');
      return;
    }

    state.isSubmittingVote = true;
    renderBracket(state.tournament);
    setStatus(`Locking ${formatRoundLabel(activeRound)} winners...`);

    try {
      let latestTournament = state.tournament;

      for (const entry of pending) {
        if (entry.alreadyLocked) {
          continue;
        }

        const response = await fetch(UPDATE_TOURNAMENT_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: authorization
          },
          body: JSON.stringify({
            userID,
            tournamentID: latestTournament.tournamentID,
            roundName: activeRound,
            matchIndex: entry.matchIndex,
            winner: entry.winner
          })
        });

        if (!response.ok) {
          throw new Error(await getErrorDetails(response));
        }

        const payload = await response.json();
        latestTournament = parseApiResponse(payload);
      }

      clearLocalChoicesForRound(activeRound);
      state.tournament = latestTournament;
      renderBracket(latestTournament);
      setChampion(latestTournament?.status === 'COMPLETE' ? latestTournament?.winner : null);
      if (latestTournament?.status === 'COMPLETE' && !state.championCelebrated) {
        fireBigConfetti();
        showChampionModal(latestTournament);
        state.championCelebrated = true;
      }
      setStatus(latestTournament?.status === 'COMPLETE'
        ? 'Tournament complete.'
        : `${formatRoundLabel(activeRound)} locked. Next round is ready.`);
      if (latestTournament?.status === 'COMPLETE' && latestTournament?.tournamentType) {
        loadLeaderboardForType(latestTournament.tournamentType);
      }
    } catch (error) {
      const message = error && error.message ? error.message : 'Could not lock round right now.';
      setStatus(message, 'error');
    } finally {
      state.isSubmittingVote = false;
      renderBracket(state.tournament);
    }
  }

  async function loadSongsFromMapsJson() {
    const response = await fetch('JSONS/maps.json');
    if (!response.ok) throw new Error('Failed to load songs');
    const maps = await response.json();
    const deduped = new Map();

    maps.forEach((entry) => {
      const songName = String(entry?.['Map Song Name'] || '').trim();
      const songUrl = String(entry?.['Map Song'] || '').trim();
      if (!songName || !songUrl) return;
      const key = `${songName.toLowerCase()}|${songUrl}`;
      if (deduped.has(key)) return;
      deduped.set(key, {
        id: `song-${deduped.size + 1}`,
        name: songName,
        songUrl,
        tournamentType: 'OST'
      });
    });

    return Array.from(deduped.values());
  }

  async function loadMapsFromMapsJson() {
    const response = await fetch('JSONS/maps.json');
    if (!response.ok) throw new Error('Failed to load maps');
    const maps = await response.json();

    return maps
      .filter((entry) => entry?.MAPID && entry?.['Map Name'])
      .map((entry) => ({
        id: entry.MAPID,
        name: entry['Map Name'],
        imageUrl: entry['Map Picture'] || '',
        songUrl: entry['Map Song'] || '',
        tournamentType: 'MAP'
      }));
  }

  async function loadMonstersFromJson() {
    const response = await fetch('JSONS/mobs.json');
    if (!response.ok) throw new Error('Failed to load monsters');

    const monsters = await response.json();

    return monsters
        .filter((entry) => entry?.MOBID && entry?.Name)
        .map((entry, index) => ({
        id: entry.MOBID || `monster-${index}`,
        name: entry.Name,
        imageUrl: entry.Picture || '',
        level: entry.Level || '',
        hp: entry.HP || 0,
        xp: entry.XP || 0,
        tournamentType: 'MONSTER'
        }));
    }

  function getParticipantsByType(type) {
    if (type === 'MAP') return state.maps;
    if (type === 'MONSTER') return state.monsters;
    return state.songs;
  }

  async function preloadData() {
    try {
        const [songs, maps, monsters] = await Promise.all([
        loadSongsFromMapsJson(),
        loadMapsFromMapsJson(),
        loadMonstersFromJson()
        ]);

        state.songs = songs;
        state.maps = maps;
        state.monsters = monsters;

        console.log("Songs loaded:", songs.length);
        console.log("Maps loaded:", maps.length);
        console.log("Monsters loaded:", monsters.length);

        if (state.isUserLoggedIn) {
          setStatus('Data loaded. Pick a type and start your tournament.');
        }
    } catch (error) {
        console.error("Preload failed:", error);
        setStatus('Could not load participant data files.');
    }
    }

  startBtnEl.addEventListener('click', async function () {
    if (!isApiConfigured()) {
      setStatus('Set your create/update API URLs in tournament.js first.');
      return;
    }

    const userID = getLoggedInUserID();
    if (!userID) {
      setStatus('Log in first to start a tournament.', 'error');
      return;
    }

    const authorization = await getAuthHeader();
    if (!authorization) {
      setStatus('Session expired. Please log in again.', 'error');
      return;
    }

    const tournamentType = state.selectedTournamentType;
    if (!tournamentType) {
      setStatus('Choose a tournament card first.', 'error');
      return;
    }
    const sourceParticipants = getParticipantsByType(tournamentType);
    const availableCount = Array.isArray(sourceParticipants) ? sourceParticipants.length : 0;
    const bracketSize = getSmallestPowerOfTwoAtLeast(availableCount);

    if (!Array.isArray(sourceParticipants) || availableCount < MIN_BRACKET_SIZE) {
      setStatus(`Not enough participants for ${tournamentType}. Need at least ${MIN_BRACKET_SIZE}.`, 'error');
      return;
    }

    const shuffledParticipants = shuffleCopy(sourceParticipants);
    const byeCount = Math.max(0, bracketSize - shuffledParticipants.length);
    const participants = shuffledParticipants.concat(createByeParticipants(byeCount, tournamentType));

    startBtnEl.disabled = true;
    setChampion(null);
    setStatus(`Starting tournament with ${availableCount} entrants${byeCount ? ` and ${byeCount} byes` : ''}...`);

    try {
      let createResult = await requestCreateTournament({
        authorization,
        userID,
        tournamentType,
        participants,
        replaceExisting: false
      });

      if (!createResult.ok && createResult.status === 409) {
        const replaceMessage =
          (typeof createResult.body?.message === 'string' && createResult.body.message.trim())
            ? createResult.body.message
            : `You already have done the ${tournamentType} tournament. Do you want to replace your old one?`;
        const shouldReplace = window.confirm(replaceMessage);

        if (!shouldReplace) {
          setStatus('Kept your existing tournament.');
          return;
        }

        createResult = await requestCreateTournament({
          authorization,
          userID,
          tournamentType,
          participants,
          replaceExisting: true,
          replaceTournamentID: createResult.body?.existingTournamentID || null
        });
      }

      if (!createResult.ok) {
        const msg =
          (typeof createResult.body?.message === 'string' && createResult.body.message.trim())
            ? createResult.body.message
            : `HTTP ${createResult.status}: Could not start tournament.`;
        throw new Error(msg);
      }

      const tournament = parseApiResponse(createResult.body);
      state.championCelebrated = false;
      closeChampionModal();
      state.localRoundChoices = {};
      state.tournament = tournament;
      renderBracket(tournament);
      setStatus('Tournament started. Select winners to advance rounds.');
    } catch (error) {
      const message = error && error.message ? error.message : 'Could not start tournament right now.';
      setStatus(message, 'error');
    } finally {
      startBtnEl.disabled = false;
    }
  });

  lockRoundBtnEl.addEventListener('click', async function () {
    await lockCurrentRound();
  });

  lockRoundBtnBottomEl.addEventListener('click', async function () {
    await lockCurrentRound();
  });

  championModalCloseEl.addEventListener('click', function () {
    closeChampionModal();
  });

  loginBtnEl.addEventListener('click', function () {
    const auth = getAuth();
    if (auth && typeof auth.redirectToLogin === 'function') {
      auth.redirectToLogin();
      return;
    }
    setStatus('Login is unavailable right now. Refresh and try again.', 'error');
  });

  typeCardEls.forEach((cardEl) => {
    cardEl.addEventListener('click', async function () {
      const tournamentType = cardEl.dataset.type || '';
      if (!tournamentType) return;
      await setSelectedTournamentType(tournamentType);
    });
  });

  championModalNoEl.addEventListener('click', function () {
    closeChampionModal();
  });

  championModalYesEl.addEventListener('click', async function () {
    if (!state.pendingFavoriteSong && !state.pendingFavoriteMonster) {
      closeChampionModal();
      return;
    }

    championModalYesEl.disabled = true;
    try {
      if (state.pendingFavoriteSong) {
        await saveFavoriteSongToProfile(state.pendingFavoriteSong);
        setStatus('Saved winning song as your profile favorite.');
      } else if (state.pendingFavoriteMonster) {
        await saveFavoriteMonsterToProfile(state.pendingFavoriteMonster);
        setStatus('Saved winning monster as your profile favorite.');
      }
      if (window.MSCWAuth && typeof window.MSCWAuth.refreshNavProfile === 'function') {
        window.MSCWAuth.refreshNavProfile();
      }
      closeChampionModal();
    } catch (error) {
      const message = error && error.message ? error.message : 'Could not save favorite right now.';
      setStatus(message, 'error');
      championModalYesEl.disabled = false;
    }
  });

  closeChampionModal();
  (async function initializeTournamentPage() {
    await updateLoginPrompt();
    preloadData();
    setTimeout(() => {
      updateLoginPrompt();
    }, 250);
    setTimeout(() => {
      updateLoginPrompt();
    }, 1200);
  })();

  window.addEventListener('focus', function () {
    updateLoginPrompt();
  });

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
      updateLoginPrompt();
    }
  });
})();