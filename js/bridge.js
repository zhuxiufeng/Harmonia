/**
 * Anesidora MV3 Client Bridge
 * Simulates the legacy MV2 background page object for Popup and Options contexts,
 * bridging calls to the Offscreen audio document via Chrome runtime messaging.
 */

(function () {
  'use strict';

  if (window.isOffscreenHost) {
    return;
  }

  const registeredCallbacks = {
    updatePlayer: [],
    drawPlayer: [],
  };

  let pendingInitResolvers = [];
  let isStateReady = false;

  async function callAction(action, args = {}) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CALL_ACTION',
        action,
        args,
      });
      if (response && response.ok) {
        if (response.state) {
          applyStateSnapshot(response.state);
          triggerUpdateCallbacks();
          triggerDrawCallbacks();
        }
        return response.result;
      }
      return null;
    } catch (e) {
      console.warn(`[Bridge] Failed to call action "${action}":`, e);
      return null;
    }
  }

  function createConfigProxy(initialConfig) {
    const rawConfig = initialConfig || (typeof DEFAULTS !== 'undefined' ? JSON.parse(JSON.stringify(DEFAULTS)) : {});

    function makeProxy(target, path = '') {
      return new Proxy(target, {
        get(t, prop) {
          const val = t[prop];
          if (val && typeof val === 'object' && !val.__isProxy) {
            return makeProxy(val, path ? `${path}.${String(prop)}` : String(prop));
          }
          return val;
        },
        set(t, prop, val) {
          t[prop] = val;
          const rootKey = path ? path.split('.')[0] : String(prop);
          callAction('updateConfig', {
            key: rootKey,
            value: rawConfig[rootKey],
          });
          try {
            localStorage.setItem(rootKey, JSON.stringify(rawConfig[rootKey]));
          } catch (e) {}
          return true;
        },
      });
    }

    return makeProxy(rawConfig);
  }

  const mp3PlayerShim = {
    paused: true,
    _currentTime: 0,
    _duration: 0,
    _volume: 1,

    get volume() {
      return this._volume;
    },
    set volume(val) {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        this._volume = num;
        callAction('setVolume', { volume: num });
      }
    },
    get currentTime() {
      return this._currentTime;
    },
    set currentTime(val) {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        this._currentTime = num;
        callAction('setCurrentTime', { currentTime: num });
      }
    },
    get duration() {
      return this._duration;
    },
    set duration(val) {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        this._duration = num;
      }
    },

    play() {
      return callAction('play');
    },
    pause() {
      return callAction('pause');
    },
    addEventListener(event, fn) {
      if (event === 'play' || event === 'pause' || event === 'canplay') {
        registeredCallbacks.updatePlayer.push(fn);
      } else if (event === 'timeupdate') {
        registeredCallbacks.drawPlayer.push(fn);
      }
    },
    removeEventListener() {},
  };

  const savedUsername = (typeof localStorage !== 'undefined' ? localStorage.getItem('username') : null);
  const initialLoggedIn = Boolean(savedUsername);

  // Instant synchronous state hydration from cached snapshot
  let cachedSnapshot = null;
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('harmonia_last_snapshot') : null;
    if (raw) {
      cachedSnapshot = JSON.parse(raw);
    }
  } catch (e) {}

  const backgroundShim = {
    currentSong: null,
    prevSongs: [],
    currentStationToken: null,
    stationsArray: [],
    stationsByToken: {},
    currentUserInfo: {
      logged_in: initialLoggedIn,
      credsSeemGood: true,
      email: savedUsername || ''
    },
    collectedErrors: [],
    DEFAULTS: typeof DEFAULTS !== 'undefined' ? DEFAULTS : {},
    config: createConfigProxy(),
    mp3Player: mp3PlayerShim,
    prefersLightMedia: window.matchMedia('(prefers-color-scheme: light)'),

    setCallbacks(updatePlayer, drawPlayer) {
      if (typeof updatePlayer === 'function') registeredCallbacks.updatePlayer.push(updatePlayer);
      if (typeof drawPlayer === 'function') registeredCallbacks.drawPlayer.push(drawPlayer);
    },

    async syncState() {
      try {
        const res = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
        if (res?.ok && res.state) {
          applyStateSnapshot(res.state);
          triggerUpdateCallbacks();
          triggerDrawCallbacks();
        }
      } catch (e) {}
    },

    play() {
      return callAction('play').then(() => this.syncState());
    },
    nextSong() {
      return callAction('nextSong').then(() => this.syncState());
    },
    seekBack() {
      return callAction('seekBack').then(() => this.syncState());
    },
    replaySong(item, pushForwards = false) {
      return callAction('replaySong', { item, pushForwards }).then(() => this.syncState());
    },
    playStation(stationToken, preferredSongName = null, stationIsStarting = true) {
      backgroundShim.currentStationToken = stationToken;
      return callAction('playStation', { stationToken, preferredSongName, stationIsStarting }).then(() => this.syncState());
    },
    addFeedback(track, ratingIsPositive) {
      return callAction('addFeedback', { track, ratingIsPositive });
    },
    deleteFeedback(track) {
      return callAction('deleteFeedback', { track });
    },
    sleepSong() {
      return callAction('sleepSong');
    },
    createStation(musicToken, preferredSongName = null) {
      return callAction('createStation', { musicToken, preferredSongName }).then(() => this.syncState());
    },
    playSearchedSong(musicToken, songName, artistName) {
      return callAction('playSearchedSong', { musicToken, songName, artistName }).then(() => this.syncState());
    },
    searchMusic(searchText) {
      return callAction('searchMusic', { searchText });
    },
    toggleRepeat() {
      return callAction('toggleRepeat');
    },
    setRepeat(repeatOne) {
      return callAction('setRepeat', { repeatOne });
    },
    deleteStation(stationToken) {
      return callAction('deleteStation', { stationToken });
    },
    explainTrack(trackToken) {
      return callAction('explainTrack', { trackToken });
    },
    userLogin(email, password) {
      return callAction('userLogin', { email, password }).then(async (res) => {
        if (res && res.ok) {
          backgroundShim.currentUserInfo = {
            logged_in: true,
            credsSeemGood: true,
            email: email
          };
          const stateRes = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
          if (stateRes?.ok && stateRes.state) {
            applyStateSnapshot(stateRes.state);
            triggerUpdateCallbacks();
            triggerDrawCallbacks();
          }
        }
        return res;
      });
    },
    refreshStationsList() {
      return callAction('refreshStationsList').then((res) => {
        if (res && res.stationsArray) {
          backgroundShim.stationsArray = res.stationsArray;
          backgroundShim.stationsByToken = res.stationsByToken || {};
        }
        return res;
      });
    },
    throttleRefreshStationsList() {
      return this.refreshStationsList();
    },
    interactionHappened() {
      return callAction('interactionHappened');
    },
    updatePopupUrl() {
      return callAction('updatePopupUrl');
    },

    onReady(fn) {
      if (isStateReady) {
        fn();
      } else {
        pendingInitResolvers.push(fn);
      }
    },
  };

  function applyStateSnapshot(state) {
    if (!state) return;
    backgroundShim.currentSong = state.currentSong;
    backgroundShim.prevSongs = state.prevSongs || [];
    backgroundShim.currentStationToken = state.currentStationToken;
    backgroundShim.stationsArray = state.stationsArray || [];
    backgroundShim.stationsByToken = state.stationsByToken || {};
    if (state.currentUserInfo) {
      const hasSavedCreds = Boolean(typeof localStorage !== 'undefined' && localStorage.getItem('username'));
      if (hasSavedCreds && state.currentUserInfo.logged_in === false && state.currentUserInfo.credsSeemGood !== false) {
        backgroundShim.currentUserInfo = {
          ...state.currentUserInfo,
          logged_in: true,
          email: localStorage.getItem('username') || ''
        };
      } else {
        backgroundShim.currentUserInfo = state.currentUserInfo;
      }
    }
    backgroundShim.collectedErrors = state.collectedErrors || [];

    if (state.defaults) {
      backgroundShim.DEFAULTS = state.defaults;
    }
    if (state.config) {
      backgroundShim.config = createConfigProxy(state.config);
      window.bg_config = backgroundShim.config;
    }

    if (state.playerState) {
      mp3PlayerShim.paused = Boolean(state.playerState.paused);
      mp3PlayerShim._currentTime = state.playerState.currentTime || 0;
      mp3PlayerShim._duration = state.playerState.duration || 0;
      mp3PlayerShim._volume = (state.playerState.volume !== undefined) ? state.playerState.volume : 1;
    }

    try {
      if (typeof localStorage !== 'undefined') {
        const snapshot = {
          currentSong: backgroundShim.currentSong,
          prevSongs: (backgroundShim.prevSongs || []).slice(-10),
          currentStationToken: backgroundShim.currentStationToken,
          stationsArray: backgroundShim.stationsArray || [],
          stationsByToken: backgroundShim.stationsByToken || {},
          currentUserInfo: backgroundShim.currentUserInfo,
          playerState: {
            paused: mp3PlayerShim.paused,
            currentTime: mp3PlayerShim.currentTime,
            duration: mp3PlayerShim.duration,
            volume: mp3PlayerShim.volume
          }
        };
        localStorage.setItem('harmonia_last_snapshot', JSON.stringify(snapshot));
      }
    } catch (e) {}
  }

  if (cachedSnapshot) {
    applyStateSnapshot(cachedSnapshot);
    isStateReady = true;
  } else if (savedUsername) {
    isStateReady = true;
  }

  let lastAppliedSongKey = null;

  function triggerUpdateCallbacks() {
    registeredCallbacks.updatePlayer.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        console.error('Error in updatePlayer callback:', e);
      }
    });
  }

  function triggerDrawCallbacks() {
    registeredCallbacks.drawPlayer.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        console.error('Error in drawPlayer callback:', e);
      }
    });
  }

  // Handle incoming broadcast events from Offscreen
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'PLAYER_EVENT') {
      applyStateSnapshot({
        currentSong: message.currentSong,
        prevSongs: message.prevSongs,
        currentStationToken: message.currentStationToken,
        stationsArray: message.stationsArray,
        stationsByToken: message.stationsByToken,
        currentUserInfo: message.currentUserInfo,
        playerState: message.playerState,
      });

      const currentSongKey = message.currentSong
        ? `${message.currentSong.songName}|${message.currentSong.artistName}|${message.currentSong.songRating}|${message.currentSong.audioUrl}`
        : null;
      const songChanged = (currentSongKey !== lastAppliedSongKey);

      if (message.subType === 'UPDATE_PLAYER' || message.subType === 'UPDATE_STATIONS' || songChanged) {
        lastAppliedSongKey = currentSongKey;
        triggerUpdateCallbacks();
        triggerDrawCallbacks();
      }

      if (message.subType === 'DRAW_PLAYER') {
        triggerDrawCallbacks();
      }
    }
  });

  // Fetch state snapshot with resilient retry loop
  async function fetchStateWithRetry(retries = 8, delay = 60) {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
        if (res && res.ok && res.state) {
          applyStateSnapshot(res.state);
          triggerUpdateCallbacks();
          triggerDrawCallbacks();
          return true;
        }
      } catch (e) {}
      await new Promise((r) => setTimeout(r, delay));
    }
    return false;
  }

  async function init() {
    try {
      chrome.runtime.sendMessage({ type: 'ENSURE_OFFSCREEN' }).catch(() => {});
      const res = await chrome.runtime.sendMessage({ type: 'GET_STATE' }).catch(() => null);
      if (res && res.ok && res.state) {
        applyStateSnapshot(res.state);
        triggerUpdateCallbacks();
        triggerDrawCallbacks();
      } else {
        await fetchStateWithRetry(6, 60);
      }
    } catch (e) {
      console.warn('[Bridge] Init warning:', e);
    } finally {
      isStateReady = true;
      if (pendingInitResolvers.length > 0) {
        const resolvers = pendingInitResolvers;
        pendingInitResolvers = [];
        resolvers.forEach((r) => {
          try {
            r();
          } catch (err) {}
        });
      }
    }
  }

  window.background = backgroundShim;
  window.bg_config = backgroundShim.config;

  init();
})();
