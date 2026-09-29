"use strict"
/*global partnerLogin, getPlaylist, currentPlaylist, platform_specific, get_browser, is_android, get_action, singletonGetPlaylist, currentStationToken, sendRequest, currentUserInfo, getSyncTime, getPresetMetaVariable, toHTTPS, debounceFunction, MIN_ERRORSKIP_DELAY, getEffectivePreset, collectedErrors*/
/*exported setCallbacks, play, playStation, mp3Player, seekBack, restartSong, replaySong, nextSong, interactionHappened, updatePopupUrl*/

// Update declarative net rules for tuner.pandora.com User-Agent
async function setupDeclarativeRules() {
    try {
        const rules = [
            {
                id: 1,
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    requestHeaders: [{
                        header: "User-Agent",
                        operation: "set",
                        value: "libcurl"
                    }],
                },
                condition: {
                    requestDomains: ["tuner.pandora.com"],
                    resourceTypes: ['xmlhttprequest'],
                },
            }
        ];
        if (chrome.declarativeNetRequest?.updateDynamicRules) {
            await chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: rules.map(r => r.id),
                addRules: rules,
            });
        }
    } catch(e) {
        console.warn('DeclarativeNetRequest setup warning:', e);
    }
}
setupDeclarativeRules();

/** @type {HTMLAudioElement} */
let mp3Player = document.getElementById('mp3Player');

var callbacks = {
    updatePlayer: [],
    drawPlayer: [],
};
var currentSong = null;
var prevSongs = [];

function setCallbacks(updatePlayer, drawPlayer) {
    if (updatePlayer) callbacks.updatePlayer.push(updatePlayer);
    if (drawPlayer) callbacks.drawPlayer.push(drawPlayer);
}

async function play() {
    if (mp3Player && mp3Player.src && mp3Player.currentTime > 0) {
        mp3Player.play().catch(console.log);
    } else if (!currentSong) {
        const targetStation = window.currentStationToken || currentStationToken || localStorage.getItem('lastStation');
        if (targetStation) {
            await playStation(targetStation, null, true);
        } else {
            await nextSong();
        }
    } else {
        await nextSong();
    }
}

async function seekBack() {
    if (config.doRewinds && (mp3Player?.currentTime > config.rewindDuration)) {
        await restartSong();
    } else {
        await replaySong(prevSongs[0], true);
    }
}

async function restartSong() {
    if (!mp3Player || mp3Player.currentTime === 0) {
        return;
    }

    if (mp3Player.duration > 0 && mp3Player.currentTime / mp3Player.duration > 0.5) {
        config.statistics.songsListened++;
    }

    mp3Player.currentTime = 0;
}

async function replaySong(track, pushForwards = false) {
    if (!track) {
        return;
    }
    if (currentSong) {
        if (pushForwards) {
            if (currentSong != currentPlaylist[0]) {
                currentPlaylist.unshift(currentSong);
            }
        } else {
            if (currentSong != prevSongs[0]) {
                prevSongs.unshift(currentSong);
            }
        }
    }

    currentSong = track;
    window.currentSong = currentSong;
    window.prevSongs = prevSongs;
    window.currentStationToken = window.currentStationToken || currentStationToken;

    let prevIndex = prevSongs.indexOf(track);
    if (prevIndex !== -1) {
        prevSongs.splice(prevIndex, 1);
    }

    config.statistics.songsReplayed++;
    if (mp3Player && mp3Player.currentTime != 0) {
        config.statistics.secondsListened += mp3Player.currentTime;
        if (mp3Player.duration / mp3Player.currentTime > 0.5) {
            config.statistics.songsListened++;
        }
    }
    
    if (mp3Player) {
        mp3Player.src = currentSong.audioUrl;
        mp3Player.play().catch(console.log);
    }

    updatePlayers();
}

let playlistSessionId = 0;
let awaitingNewStation = false;
async function playStation(stationToken, preferredSongName = null, stationIsStarting = true) {
    if (awaitingNewStation) {
        return;
    }
    awaitingNewStation = true;
    const session = ++playlistSessionId;

    if (mp3Player) {
        mp3Player.pause();
    }

    localStorage.setItem('lastStation', stationToken);
    window.currentStationToken = stationToken;
    currentStationToken = stationToken;
    currentPlaylist.length = 0;

    const newTracks = await getPlaylist(stationToken, stationIsStarting);

    if (session !== playlistSessionId) {
        awaitingNewStation = false;
        return;
    }

    if (newTracks && newTracks.length) {
        if (preferredSongName) {
            const cleanPref = (typeof normalizeSongName === 'function')
                ? normalizeSongName(preferredSongName)
                : preferredSongName.toLowerCase().replace(/[^a-z0-9]/g, '');
            const matchIndex = newTracks.findIndex(t => {
                if (!t || !t.songName) return false;
                const cleanT = (typeof normalizeSongName === 'function')
                    ? normalizeSongName(t.songName)
                    : t.songName.toLowerCase().replace(/[^a-z0-9]/g, '');
                return cleanT === cleanPref ||
                    (cleanPref.length >= 3 && cleanT.includes(cleanPref)) ||
                    (cleanT.length >= 3 && cleanPref.includes(cleanT));
            });
            if (matchIndex > 0) {
                console.log(`[playStation] Reordering matching track "${newTracks[matchIndex].songName}" (index ${matchIndex}) to first position.`);
                const [targetTrack] = newTracks.splice(matchIndex, 1);
                newTracks.unshift(targetTrack);
            } else if (matchIndex === 0) {
                console.log(`[playStation] Track 0 "${newTracks[0].songName}" already matches searched song.`);
            } else {
                console.warn(`[playStation] Searched song "${preferredSongName}" not directly in returned tracks:`, newTracks.map(t => t.songName));
            }
        }
        currentPlaylist.push(...newTracks);
    }
    awaitingNewStation = false;
    await nextSong();
}

const registeredAds = {};

async function registerAds(track) {
	if (!config.registerAds) {
		return;
	}
	if (!track || !track.adTrackingTokens) {
		return;
	}
	if (registeredAds[track.adToken]) {
		return;
	}

	registeredAds[track.adToken] = true;

	return await sendRequest('ad.registerAd',
		{
			userAuthToken: currentUserInfo.authToken,
			syncTime: getSyncTime(),
			adTrackingTokens: track.adTrackingTokens,
			stationId: track.stationId
		}
	);
}

async function nextSong(depth = 1) {
    if (depth > 4) {
        return;
    }
    if (currentSong && currentSong.audioUrl && currentSong != prevSongs[0]) {
        prevSongs.unshift(currentSong);
        window.prevSongs = prevSongs;

        let maxHistoryEntries = getPresetMetaVariable('maxHistoryEntries');
        if (prevSongs.length > maxHistoryEntries) {
            let removedTracks = prevSongs.splice(maxHistoryEntries, prevSongs.length - maxHistoryEntries);
            for (let removedTrack of removedTracks) {
                if (removedTrack.adToken) {
                    delete registeredAds[removedTrack.adToken];
                }
                if ('artBlobUrl' in removedTrack && removedTrack.artBlobUrl) {
                    URL.revokeObjectURL(removedTrack.artBlobUrl);
                }
            }
        }
    }
    if (!window.currentStationToken) {
        window.currentStationToken = currentStationToken || localStorage.getItem('lastStation');
    }
    if (!window.currentStationToken && typeof stationsArray !== 'undefined' && stationsArray.length > 0) {
        window.currentStationToken = stationsArray[0].stationToken;
        currentStationToken = window.currentStationToken;
        localStorage.setItem('lastStation', window.currentStationToken);
    }

    if (!window.currentStationToken) {
        console.warn('nextSong: No station available yet');
        return false;
    }

    const currentSession = playlistSessionId;
    const targetStation = window.currentStationToken;

    if (currentPlaylist.length <= 3 && currentPlaylist.length >= 1) {
        singletonGetPlaylist(targetStation).then(e => {
            if (currentSession === playlistSessionId && window.currentStationToken === targetStation && e && e.length && !currentPlaylist.includes(e[0])) {
                currentPlaylist.push(...e);
            }
        }).catch(() => {});
    } else if (currentPlaylist.length === 0) {
        let songs = await singletonGetPlaylist(targetStation, true);
        if (currentSession !== playlistSessionId || window.currentStationToken !== targetStation) {
            return false;
        }
        if (!songs || !songs.length) {
            if (typeof collectedErrors !== 'undefined') {
                collectedErrors.push("background.js | Songs is nothing for some reason");
            }
            return false;
        }
        if (!currentPlaylist.includes(songs[0])) {
            currentPlaylist.push(...songs);
        }
    }

    if (currentSong && mp3Player) {
        if ('adToken' in currentSong) {
            config.statistics.secondsListened += mp3Player.currentTime;
            if (mp3Player.currentTime > 0 && mp3Player.duration > 0 && mp3Player.currentTime / mp3Player.duration > 0.5) {
                config.statistics.adsListened++;
            } else {
                config.statistics.adsSkipped++;
            }
        } else {
            config.statistics.secondsListened += mp3Player.currentTime;
            if (mp3Player.currentTime > 0 && mp3Player.duration > 0 && mp3Player.currentTime / mp3Player.duration > 0.5) {
                config.statistics.songsListened++;
            } else {
                config.statistics.songsSkipped++;
            }
        }
    }

    currentSong = currentPlaylist.shift();
    window.currentSong = currentSong;
    window.prevSongs = prevSongs;
    window.currentStationToken = window.currentStationToken || currentStationToken;

    if (mp3Player && currentSong) {
        mp3Player.src = currentSong.audioUrl;
        mp3Player.play().catch(console.log);
        registerAds(currentSong);
    }

    updatePlayers();
    prebufferNextTrack();

    if (currentPlaylist.length <= 2 && window.currentStationToken) {
        const postSession = playlistSessionId;
        const postStation = window.currentStationToken;
        singletonGetPlaylist(postStation).then(e => {
            if (postSession === playlistSessionId && window.currentStationToken === postStation && e && e.length && !currentPlaylist.includes(e[0])) {
                currentPlaylist.push(...e);
                prebufferNextTrack();
            }
        }).catch(() => {});
    }
}

function prebufferNextTrack() {
    try {
        if (currentPlaylist && currentPlaylist.length > 0 && currentPlaylist[0]?.audioUrl) {
            const prebuffer = document.getElementById('prebufferPlayer');
            if (prebuffer && prebuffer.src !== currentPlaylist[0].audioUrl) {
                prebuffer.src = currentPlaylist[0].audioUrl;
                prebuffer.load();
            }
        }
    } catch (e) {}
}

function setup_commands() {
    if (!is_android()) {
        chrome.commands?.onCommand?.addListener((command) => {
            handleCommand(command);
        });
    }
}

function handleCommand(command) {
    switch (command) {
        case "pause_play":
            if (mp3Player && !mp3Player.paused) {
                mp3Player.pause();
            } else {
                play();
            }
            break;
        case "skip_song":
            nextSong();
            break;
        case "skip_back":
            seekBack();
            break;
    }
}

// Receive forwarded commands from Service Worker
chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === 'COMMAND') {
        handleCommand(message.command);
    }
});

function setup_mediasession() {
    if (!('mediaSession' in navigator)) {
        return;
    }

    navigator.mediaSession.setActionHandler("play", play);
    navigator.mediaSession.setActionHandler("pause", () => mp3Player?.pause());
    navigator.mediaSession.setActionHandler("previoustrack", seekBack);
    navigator.mediaSession.setActionHandler("nexttrack", () => nextSong());
    navigator.mediaSession.setActionHandler("seekto", function(details) {
        if (mp3Player && details.seekTime !== undefined) {
            mp3Player.currentTime = details.seekTime;
        }
    });
}

function update_mediasession() {
    if (!('mediaSession' in navigator) || !currentSong) {
        return;
    }

    var metadata = navigator.mediaSession.metadata;
    if (!metadata || (
        metadata.title != currentSong.songName ||
        metadata.artist != currentSong.artistName ||
        metadata.artwork[0]?.src != (currentSong.artBlobUrl ?? toHTTPS(currentSong.albumArtUrl)))
        ) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: currentSong.songName,
            artist: currentSong.artistName,
            artwork: [{ src: (currentSong.artBlobUrl ?? toHTTPS(currentSong.albumArtUrl)), sizes: '500x500', type: 'image/jpeg' }]
        });
    }

    if (mp3Player.paused) {
        navigator.mediaSession.playbackState = "paused";
    } else {
        navigator.mediaSession.playbackState = "playing";

        if (mp3Player.duration) {
            try {
                navigator.mediaSession.setPositionState({
                    duration: mp3Player.duration,
                    position: mp3Player.currentTime,
                    playbackRate: 1
                });
            } catch (e) {
                // duration is probably NaN
            }
        }
    }
}

const updatePlayers = () => {
    window.currentSong = currentSong;
    window.prevSongs = prevSongs;
    window.currentStationToken = window.currentStationToken || currentStationToken;
    update_mediasession();
    callbacks.updatePlayer.forEach((e) => {
        try {
            e();
        } catch(b) {
            callbacks.updatePlayer.splice(callbacks.updatePlayer.indexOf(e), 1);
        }
    });

    if (typeof window.broadcastStateUpdate === 'function') {
        window.broadcastStateUpdate('UPDATE_PLAYER');
    }
}

document.addEventListener('DOMContentLoaded', function () {
    mp3Player = document.getElementById('mp3Player');
    if (mp3Player) {
        mp3Player.volume = config.volume ?? 1;

        mp3Player.addEventListener("play", updatePlayers);
        mp3Player.addEventListener("pause", updatePlayers);
        mp3Player.addEventListener("canplay", updatePlayers);
        mp3Player.addEventListener("ended", function () {
            if (config.repeatOne && currentSong) {
                mp3Player.currentTime = 0;
                mp3Player.play().catch(console.log);
                updatePlayers();
                update_mediasession();
            } else {
                nextSong().then(update_mediasession);
            }
        });
        mp3Player.addEventListener("timeupdate", function () {
            update_mediasession();
            callbacks.drawPlayer.forEach((e) => {
                try {
                    e();
                } catch(b) {
                    callbacks.drawPlayer.splice(callbacks.drawPlayer.indexOf(e), 1);
                }
            });
            if (typeof window.broadcastStateUpdate === 'function') {
                window.broadcastStateUpdate('DRAW_PLAYER');
            }
        });
        let errorResponseFunc = debounceFunction(() => nextSong().then(update_mediasession), MIN_ERRORSKIP_DELAY);
        mp3Player.addEventListener("error", errorResponseFunc);
    }

    platform_specific();
    setup_commands();
    setup_mediasession();
});

function updatePopupUrl() {
    browserThemeIsLight = prefersLightMedia.matches;
    let usedPopup = getEffectivePreset().playerType + '.htm';
    const action = get_action();
    if (action?.setPopup) {
        action.setPopup({
            popup: usedPopup
        }).catch(() => {});
    }
    chrome.runtime.sendMessage({
        type: 'SET_POPUP',
        popup: usedPopup
    }).catch(() => {});
}

var prefersLightMedia = matchMedia(`(prefers-color-scheme: light)`);
prefersLightMedia.addEventListener('change', updatePopupUrl);
updatePopupUrl();
setTimeout(updatePopupUrl, 150);
var browserThemeIsLight = prefersLightMedia.matches;

let timeoutIdentifier = null;
function interactionHappened() {
	if (timeoutIdentifier) {
		window.clearTimeout(timeoutIdentifier);
	}

	if (!config.pauseAfterInactivity) {
		return;
	}

	timeoutIdentifier = window.setTimeout(() => {
		if (mp3Player && !mp3Player.paused) {
			mp3Player.pause();
		}
	}, config.inactivityDuration * 60 * 1000);
}

// Explicit window bindings for reliable RPC dispatch from offscreen bridge
window.play = play;
window.nextSong = nextSong;
window.seekBack = seekBack;
window.replaySong = replaySong;
window.restartSong = restartSong;
window.playStation = playStation;
window.setCallbacks = setCallbacks;
window.updatePlayers = updatePlayers;
window.interactionHappened = interactionHappened;
window.updatePopupUrl = updatePopupUrl;
window.currentSong = currentSong;
window.prevSongs = prevSongs;
window.currentStationToken = currentStationToken;
