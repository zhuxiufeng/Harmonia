/**
 * Offscreen Document Bridge for Anesidora MV3
 * Handles RPC requests from Popup/Options and broadcasts player state events.
 */

window.isOffscreenHost = true;
window.background = window;

function getFullState() {
  const player = document.getElementById('mp3Player');
  const song = (typeof currentSong !== 'undefined' ? currentSong : window.currentSong) || null;
  const prev = (typeof prevSongs !== 'undefined' ? prevSongs : window.prevSongs) || [];
  const token = (typeof currentStationToken !== 'undefined' ? currentStationToken : window.currentStationToken) || null;
  const stArr = (typeof stationsArray !== 'undefined' ? stationsArray : window.stationsArray) || [];
  const stByToken = (typeof stationsByToken !== 'undefined' ? stationsByToken : window.stationsByToken) || {};
  const user = (typeof currentUserInfo !== 'undefined' ? currentUserInfo : window.currentUserInfo) || { logged_in: false, credsSeemGood: true };

  return {
    currentSong: song,
    prevSongs: prev,
    currentStationToken: token,
    stationsArray: stArr,
    stationsByToken: stByToken,
    currentUserInfo: user,
    playerState: {
      paused: player ? player.paused : true,
      currentTime: player ? (player.currentTime || 0) : 0,
      duration: player ? (player.duration || 0) : 0,
      volume: player ? player.volume : (window.config?.volume ?? 1)
    },
    config: window.config ? JSON.parse(JSON.stringify(window.config)) : {},
    defaults: window.DEFAULTS || {},
    collectedErrors: window.collectedErrors || []
  };
}

window.broadcastStateUpdate = function (eventType) {
  const player = document.getElementById('mp3Player');
  const song = (typeof currentSong !== 'undefined' ? currentSong : window.currentSong) || null;
  const prev = (typeof prevSongs !== 'undefined' ? prevSongs : window.prevSongs) || [];
  const token = (typeof currentStationToken !== 'undefined' ? currentStationToken : window.currentStationToken) || null;
  const stArr = (typeof stationsArray !== 'undefined' ? stationsArray : window.stationsArray) || [];
  const stByToken = (typeof stationsByToken !== 'undefined' ? stationsByToken : window.stationsByToken) || {};
  const user = (typeof currentUserInfo !== 'undefined' ? currentUserInfo : window.currentUserInfo) || { logged_in: false, credsSeemGood: true };

  const payload = {
    type: 'PLAYER_EVENT',
    subType: eventType,
    currentSong: song,
    prevSongs: prev,
    currentStationToken: token,
    stationsArray: stArr,
    stationsByToken: stByToken,
    currentUserInfo: user,
    playerState: {
      paused: player ? player.paused : true,
      currentTime: player ? (player.currentTime || 0) : 0,
      duration: player ? (player.duration || 0) : 0,
      volume: player ? player.volume : (window.config?.volume ?? 1)
    }
  };

  chrome.runtime.sendMessage(payload).catch(() => {});
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') return;

  if (message.type === 'GET_STATE') {
    sendResponse({ ok: true, state: getFullState() });
    return;
  }

  if (message.type === 'CALL_ACTION') {
    const { action, args } = message;
    handleAction(action, args)
      .then((result) => sendResponse({ ok: true, result, state: getFullState() }))
      .catch((err) => sendResponse({ ok: false, error: err?.message || String(err), state: getFullState() }));
    return true; // Keep channel open for async response
  }
});

async function handleAction(action, args = {}) {
  const player = document.getElementById('mp3Player');
  switch (action) {
    case 'play':
      if (typeof window.play === 'function') {
        await window.play();
      }
      return true;

    case 'pause':
      if (player) {
        player.pause();
      }
      return true;

    case 'nextSong':
      if (typeof window.nextSong === 'function') {
        await window.nextSong();
      }
      return true;

    case 'seekBack':
      if (typeof window.seekBack === 'function') {
        await window.seekBack();
      }
      return true;

    case 'replaySong':
      if (typeof window.replaySong === 'function') {
        await window.replaySong(args.item, args.pushForwards);
      }
      return true;

    case 'playStation':
      if (typeof window.playStation === 'function') {
        await window.playStation(args.stationToken, args.preferredSongName, args.stationIsStarting !== undefined ? args.stationIsStarting : true);
      }
      return true;

    case 'addFeedback':
      if (typeof window.addFeedback === 'function') {
        return await window.addFeedback(args.track, args.ratingIsPositive);
      }
      return false;

    case 'deleteFeedback':
      if (typeof window.deleteFeedback === 'function') {
        return await window.deleteFeedback(args.track);
      }
      return false;

    case 'sleepSong':
      if (typeof window.sleepSong === 'function') {
        return await window.sleepSong();
      }
      return false;

    case 'createStation':
      if (typeof window.createStation === 'function') {
        return await window.createStation(args.musicToken, args.preferredSongName);
      }
      return false;

    case 'playSearchedSong':
      if (typeof window.playSearchedSong === 'function') {
        return await window.playSearchedSong(args.musicToken, args.songName, args.artistName);
      }
      return false;

    case 'searchMusic':
      if (typeof window.searchMusic === 'function') {
        return await window.searchMusic(args.searchText);
      }
      return { ok: false, songs: [], artists: [], genreStations: [] };

    case 'toggleRepeat':
      if (window.config) {
        window.config.repeatOne = !window.config.repeatOne;
        if (typeof window.saveConfig === 'function') {
          window.saveConfig();
        }
      }
      if (typeof window.broadcastStateUpdate === 'function') {
        window.broadcastStateUpdate('UPDATE_PLAYER');
      }
      return Boolean(window.config?.repeatOne);

    case 'setRepeat':
      if (window.config) {
        window.config.repeatOne = Boolean(args.repeatOne);
        if (typeof window.saveConfig === 'function') {
          window.saveConfig();
        }
      }
      if (typeof window.broadcastStateUpdate === 'function') {
        window.broadcastStateUpdate('UPDATE_PLAYER');
      }
      return Boolean(window.config?.repeatOne);

    case 'deleteStation':
      if (typeof window.deleteStation === 'function') {
        return await window.deleteStation(args.stationToken);
      }
      return false;

    case 'explainTrack':
      if (typeof window.explainTrack === 'function') {
        return await window.explainTrack(args.trackToken);
      }
      return false;

    case 'userLogin':
      if (typeof window.userLogin === 'function') {
        const loginRes = await window.userLogin(args.email, args.password);
        if (loginRes && loginRes.ok) {
          if (typeof window.refreshStationsList === 'function') {
            await window.refreshStationsList();
          }
          if (!window.currentStationToken && window.stationsArray?.length) {
            window.currentStationToken = window.stationsArray[0].stationToken;
            localStorage.setItem('lastStation', window.currentStationToken);
          }
          if (window.currentStationToken && typeof window.singletonGetPlaylist === 'function') {
            window.singletonGetPlaylist(window.currentStationToken, true).then(tracks => {
              if (tracks && tracks.length && typeof currentPlaylist !== 'undefined') {
                if (currentPlaylist.length === 0) {
                  currentPlaylist.push(...tracks);
                }
              }
              if (typeof window.broadcastStateUpdate === 'function') {
                window.broadcastStateUpdate('UPDATE_PLAYER');
              }
            }).catch(() => {});
          }
          if (typeof window.broadcastStateUpdate === 'function') {
            window.broadcastStateUpdate('UPDATE_PLAYER');
          }
        }
        return loginRes;
      }
      return { ok: false, reason: "后台播放器未就绪，请稍候重试" };

    case 'setCurrentTime':
      if (player && typeof args.currentTime === 'number') {
        player.currentTime = args.currentTime;
      }
      return true;

    case 'setVolume':
      if (typeof args.volume === 'number') {
        if (player) player.volume = args.volume;
        if (window.config) window.config.volume = args.volume;
      }
      return true;

    case 'updateConfig':
      if (window.config && args.key !== undefined) {
        window.config[args.key] = args.value;
      }
      return true;

    case 'interactionHappened':
      if (typeof window.interactionHappened === 'function') {
        window.interactionHappened();
      }
      return true;

    case 'updatePopupUrl':
      if (typeof window.updatePopupUrl === 'function') {
        window.updatePopupUrl();
      }
      return true;

    case 'refreshStationsList':
      if (typeof window.refreshStationsList === 'function') {
        const res = await window.refreshStationsList();
        if (typeof window.broadcastStateUpdate === 'function') {
          window.broadcastStateUpdate('UPDATE_PLAYER');
        }
        return res;
      }
      return false;

    default:
      console.warn('Unknown action requested:', action);
      return false;
  }
}

// Keep-Alive connection between Offscreen Document and Service Worker
function connectKeepAlive() {
  try {
    const port = chrome.runtime.connect({ name: 'keep-alive-port' });
    port.onMessage.addListener(() => {});
    port.onDisconnect.addListener(() => {
      setTimeout(connectKeepAlive, 1000);
    });
    // Send periodic ping every 20 seconds to reset inactivity timer
    setInterval(() => {
      try {
        port.postMessage({ type: 'PING' });
      } catch (e) {}
    }, 20000);
  } catch (e) {
    setTimeout(connectKeepAlive, 2000);
  }
}
connectKeepAlive();

// Broadcast ready announcement so any open popup can immediately sync
setTimeout(() => {
  window.broadcastStateUpdate('UPDATE_PLAYER');
}, 100);
