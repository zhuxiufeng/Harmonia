"use strict";
/** @type {keyof typeof ALL_SCREENS} */

// Do this before page renders so transition animation does not play
document.documentElement.style.setProperty("--current-screen-index", ALL_SCREENS.indexOf(bg_config?.currentScreen || 'playing'));

if (window.location.search) {
    let searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get('settingsPreview')) {
        document.documentElement.style.overflow = 'hidden';
        setTimeout(() => {
            if (document.querySelector('main')) {
                document.querySelector('main').style.transition = 'none';
            }
        }, 2)
    }
}

// Please keep in sync with cozy.htm:15 and compact.htm
const ICONS = /** @type {const} */ ([
    'link', 'play', 'pause', 'refresh', 'login'
]);

const fuzzyStringSearch = (haystack, needle) => {
    let lowerHaystack = haystack.toLowerCase();
    let lowerNeedle = needle.toLowerCase();
    let matches = 0;
    if (lowerNeedle.length === 0) {
        return 0;
    }
    if (lowerHaystack.length === 0) {
        return 0;
    }
    if (lowerHaystack.indexOf(lowerNeedle) > -1) return 1; // covers basic partial matches
    for (let i = 0; i < lowerNeedle.length; i++) {
        lowerHaystack.indexOf(lowerNeedle[i]) > -1 ? matches += 1 : matches -=1;
    }
    return Math.max(0, matches/lowerHaystack.length);
};

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const isPopout = urlParams.get('popout') === 'true' || window.location.search.includes('popout');

    if (isPopout) {
        document.documentElement.classList.add('popout-mode');
        document.body.classList.add('popout-window');
        document.documentElement.style.setProperty('--viewport-width', `${window.innerWidth}px`);
        document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`);

        const updateMiniState = () => {
            if (window.innerHeight <= 380) {
                document.documentElement.classList.add('mini-player-active');
            } else {
                document.documentElement.classList.remove('mini-player-active');
            }
        };
        updateMiniState();

        const btnMini = document.querySelector('.popout-ctrl-btn.btn-mini');
        const btnMaximize = document.querySelector('.popout-ctrl-btn.btn-maximize');

        if (btnMini) {
            btnMini.addEventListener('click', () => {
                const isMini = window.innerHeight <= 280;
                if (isMini) {
                    chrome.runtime.sendMessage({
                        type: 'RESIZE_POPOUT',
                        width: 380,
                        height: 640
                    });
                } else {
                    chrome.runtime.sendMessage({
                        type: 'RESIZE_POPOUT',
                        width: 360,
                        height: 170
                    });
                }
            });
        }

        if (btnMaximize) {
            btnMaximize.addEventListener('click', () => {
                chrome.runtime.sendMessage({ type: 'TOGGLE_MAXIMIZE_POPOUT' });
            });
        }

        let popoutResizeDebounce = null;
        window.addEventListener('resize', () => {
            document.documentElement.style.setProperty('--viewport-width', `${window.innerWidth}px`);
            document.documentElement.style.setProperty('--viewport-height', `${window.innerHeight}px`);
            updateMiniState();
            if (typeof recalculateInfoLine === 'function') {
                recalculateInfoLine();
            }
            clearTimeout(popoutResizeDebounce);
            popoutResizeDebounce = setTimeout(() => {
                try {
                    const isNearScreenSize = (
                        window.outerWidth >= (window.screen.availWidth - 50) &&
                        window.outerHeight >= (window.screen.availHeight - 50)
                    );
                    if (!isNearScreenSize && window.outerWidth >= 280 && window.outerHeight >= 140) {
                        localStorage.setItem('popout_custom_width', String(Math.min(1000, window.outerWidth)));
                        localStorage.setItem('popout_custom_height', String(Math.min(800, window.outerHeight)));
                    }
                } catch (e) {}
            }, 500);
        });
    } else if (Math.abs(document.documentElement.clientWidth - document.body.clientWidth) > 10) {
        // We're in a mobile context, or otherwise on a separate page
        document.documentElement.style.setProperty('--viewport-width', '100vw');
        document.documentElement.style.setProperty('--viewport-height', '100vh');
    }

    const initializeNavigation = () => {
        const navigationScrollItems = document.querySelector('.navigation-scroll-items');
        const mainElement = document.getElementsByTagName('main')[0];
        const navigatePreviousButton = document.querySelector('.navigate-previous');
        const navigateNextButton = document.querySelector('.navigate-next');

        if (!mainElement) {
            return;
        }

        /** @type {(which: typeof ALL_SCREENS[number]) => void} */
        const goToScreen = (which) => {
            bg_config.currentScreen = which;
            if (bg_config.currentScreen === ALL_SCREENS[0]) {
                navigatePreviousButton?.classList.remove('visible');
                navigatePreviousButton?.setAttribute('inert', 'inert');

                // Older browsers don't support inert:
                navigatePreviousButton?.setAttribute('aria-hidden', 'true');
                navigatePreviousButton?.setAttribute('tabindex', '-1');
            } else {
                navigatePreviousButton?.classList.add('visible');
                navigatePreviousButton?.removeAttribute('inert');

                // Older browsers don't support inert:
                navigatePreviousButton?.removeAttribute('aria-hidden');
                navigatePreviousButton?.removeAttribute('tabindex');
            }
            if (bg_config.currentScreen === ALL_SCREENS[ALL_SCREENS.length - 1]) {
                navigateNextButton?.classList.remove('visible');
                navigateNextButton?.setAttribute('inert', 'inert');

                // Older browsers don't support inert:
                navigateNextButton?.setAttribute('aria-hidden', 'true');
                navigateNextButton?.setAttribute('tabindex', '-1');
            } else {
                navigateNextButton?.classList.add('visible');
                navigateNextButton?.removeAttribute('inert');

                // Older browsers don't support inert:
                navigateNextButton?.removeAttribute('aria-hidden');
                navigateNextButton?.removeAttribute('tabindex');
            }

            let currentScreenIndex = ALL_SCREENS.indexOf(bg_config.currentScreen);
            document.documentElement.style.setProperty("--current-screen-index", currentScreenIndex);

            
            // Remove non-visible items from accessibility tree:

            for (let index = 0; index < mainElement.children.length; index++) {
                let elem = mainElement.children[index];

                // Purposeful loose comparison, index is a string
                if (index == currentScreenIndex) {
                    elem.id = "main"; // for skiplink
                    elem.removeAttribute('inert');

                    // Older browsers don't support inert:
                    elem.removeAttribute('aria-hidden');
                    elem.removeAttribute('tabindex');
                } else {
                    elem.removeAttribute('id');
                    elem.setAttribute('inert', 'inert');

                    // Older browsers don't support inert:
                    elem.setAttribute('aria-hidden', 'true');
                    elem.setAttribute('tabindex', '-1');
                }
            }
            if (navigationScrollItems) {
                for (let index = 0; index < navigationScrollItems.children.length; index++) {
                    let elem = navigationScrollItems.children[index];
    
                    // Purposeful loose comparison, index is a string
                    if (index == currentScreenIndex) {
                        elem.removeAttribute('inert');
    
                        // Older browsers don't support inert:
                        elem.removeAttribute('aria-hidden');
                        elem.removeAttribute('tabindex');
                    } else {
                        elem.setAttribute('inert', 'inert');
    
                        // Older browsers don't support inert:
                        elem.setAttribute('aria-hidden', 'true');
                        elem.setAttribute('tabindex', '-1');
                    }
                }
            }
        }

        const hasSavedAccount = Boolean(typeof localStorage !== 'undefined' && localStorage.getItem('username'));
        const isUserAuthed = Boolean(background.currentUserInfo?.logged_in || hasSavedAccount);

        if (!isUserAuthed) {
            bg_config.currentScreen = 'account';
        }
        goToScreen(bg_config.currentScreen);
        if (!isUserAuthed) {
            // do not allow user to leave account until logged in
            navigatePreviousButton.classList.remove('visible');
            navigatePreviousButton.setAttribute('inert', 'inert');

            // Older browsers don't support inert:
            navigatePreviousButton.setAttribute('aria-hidden', 'true');
            navigatePreviousButton.setAttribute('tabindex', '-1');
        } else {
            const nowPlayingTitle = document.querySelector('.now-playing-title');    
            if (nowPlayingTitle && background?.stationsByToken?.[background?.currentStationToken]?.stationName) {
                nowPlayingTitle.innerText = background.stationsByToken[background.currentStationToken].stationName;
            }
        }

        /** @type {(direction: 'previous' | 'next') => (() => void)} */
        const handleClickThunk = (direction) => {
            let effectiveDirection = 0;
            if (direction === 'previous') {
                effectiveDirection = -1;
            } else if (direction === 'next') {
                effectiveDirection = 1;
            }
            return () => {
                // Clamp to possible targets
                let targetScreenIndex = Math.max(
                    0,
                    Math.min(
                        ALL_SCREENS.length - 1,
                        ALL_SCREENS.indexOf(bg_config.currentScreen) + effectiveDirection
                    )
                )

                goToScreen(ALL_SCREENS[targetScreenIndex]);
            }
        }

        navigatePreviousButton.addEventListener('click', handleClickThunk('previous'));
        navigateNextButton.addEventListener('click', handleClickThunk('next'));

        return goToScreen;
    }
    
    /** @type {(track: unknown, thisButton: HTMLButtonElement, otherButton: HTMLButtonElement, positive: boolean) => void} */
    const processThumb = (track, thisButton, otherButton, positive) => {
        if (thisButton?.classList?.contains('working') || !track) {
            return;
        }

        thisButton.classList?.add('working');

        // otherButton also disabled to prevent race conditions
        otherButton?.classList?.add?.('working');

        if (
            (track.songRating === 1 && positive) ||
            (track.songRating === -1 && !positive)
        ) {
            // Want to remove feedback.
            thisButton.classList.remove('active');

            background?.deleteFeedback?.(track).then(ok => {
                thisButton.classList.remove('working');
                otherButton?.classList?.remove?.('working');

                if (!ok) {
                    // restore back ui from bad assumption of working network
                    thisButton.classList.add('active');
                } else {
                    track.songRating = 0;
                    if (background.currentSong && background.currentSong.trackToken === track.trackToken) {
                        background.currentSong.songRating = 0;
                    }
                    updatePlayer();
                }
            }).catch(() => {
                thisButton.classList.remove('working');
                otherButton?.classList?.remove?.('working');
            });
        } else {
            // Want to add feedback.
            let otherWasActive = otherButton?.classList?.contains?.('active');
            if (otherWasActive) {
                otherButton.classList.remove('active');
            }
            background?.addFeedback?.(track, positive).then(ok => {
                thisButton.classList.remove('working');
                otherButton?.classList?.remove?.('working');

                if (ok) {
                    thisButton.classList.add('active');
                    track.songRating = positive ? 1 : -1;
                    if (background.currentSong && background.currentSong.trackToken === track.trackToken) {
                        background.currentSong.songRating = track.songRating;
                    }
                    updatePlayer();
                } else {
                    // restore ui from bad assumption of working network
                    if (otherWasActive) {
                        otherButton.classList.add('active');
                    }
                }
            }).catch(() => {
                thisButton.classList.remove('working');
                otherButton?.classList?.remove?.('working');
            });
        }
    }

    const goToScreen = initializeNavigation();

    /** @type (acctName: string) => string} */
    const getAccountImage = (acctName) => {
		return `https://www.pandora.com/static/user/default_images/user_default_${(acctName.toLowerCase().replace(/[^a-zA-Z]/g, '').substring(0, 1) || 'f')}_500x500.png`
    }


    const historyScreen = document.getElementsByClassName('history')[0];    
    const playerScreen = document.getElementsByClassName('player')[0];
    const stationsScreen = document.getElementsByClassName('stations')[0];
    const accountScreen = document.getElementsByClassName('account')[0];


    let lastHistorySig = null;
    const updateHistory = (forceList = null) => {
        /** @type {HTMLTemplateElement | null} */
        const historyItemTemplate = document.querySelector('.history-item-template');
        if (!historyScreen || !historyItemTemplate) return;
        const historyItemsList = historyScreen.querySelector('ul');
        if (!historyItemsList) return;

        let usedList = forceList || background.prevSongs || [];
        const currentSig = usedList.map(s => (s.songName || '') + (s.artistName || '')).join(';');
        if (!forceList && currentSig === lastHistorySig && historyItemsList.children.length === usedList.length) {
            return;
        }
        lastHistorySig = currentSig;

        let newHistoryElements = [];
        for (let item of usedList) {
            const newHistoryItem = historyItemTemplate.content.children[0].cloneNode(true);
            let titleElement = newHistoryItem.querySelector('.title');
            let artistElement = newHistoryItem.querySelector('.artist');
            let coverElement = newHistoryItem.querySelector('.cover');
            let thumbsUpButton = newHistoryItem.querySelector('.thumbs-up');
            let thumbsDownButton = newHistoryItem.querySelector('.thumbs-down');

            if (titleElement) {
                titleElement.innerText = item.songName;
                if (titleElement instanceof HTMLAnchorElement && item?.songDetailUrl) {
                    titleElement.href = processURL(item.songDetailUrl);
                }
            }
            if (artistElement) {
                artistElement.innerText = item.artistName;
            }

            if (coverElement) {
                setSafeAsyncImage(coverElement, getOptimalArtworkUrl(item));
            }

            if (item.songRating === 1) {
                thumbsUpButton?.classList.add('active');
            } else if (item.songRating === -1) {
                thumbsDownButton?.classList.add('active');
            }

            const canFeedback = Boolean(
                item &&
                item.trackToken &&
                !item.adToken &&
                !item.clickThroughUrl &&
                item.allowFeedback !== false
            );
			if (thumbsUpButton) {
				thumbsUpButton.disabled = !canFeedback;
			}
			if (thumbsDownButton) {
				thumbsDownButton.disabled = !canFeedback;
			}

            thumbsUpButton?.addEventListener('click', () => processThumb(item, thumbsUpButton, thumbsDownButton, true));
            newHistoryItem.querySelector('.play')?.addEventListener('click', () => background.replaySong?.(item, false));
            thumbsDownButton?.addEventListener('click', () => processThumb(item, thumbsDownButton, thumbsUpButton, false));

            newHistoryElements.push(newHistoryItem);
        }
        historyItemsList.replaceChildren(...newHistoryElements);
    };

    /** @type {HTMLInputElement} */
    const historySearchElement = historyScreen.querySelector('#history-search');
    historySearchElement?.addEventListener('input', (e) => {
        let value = e.currentTarget.value;

        if (value === "") {
            updateHistory(background?.prevSongs || []);
            return;
        }

        let filteredHistory = (/** @type {Array<unknown>} */(background?.prevSongs || []))
            .map(item => [item, fuzzyStringSearch(`${item.songName} ${item.artistName}`, value)])
            .sort((itemA, itemB) => (itemA[1] - itemB[1]))
            .filter(item => item[1] > 0.2)
            .map(item => item[0]);
        updateHistory(filteredHistory);
    });

	const recalculateInfoLine = () => {
        let infoLine = playerScreen.querySelector('.infoline');
        if (infoLine) {
            let contentWidthPX = getComputedStyle(infoLine.children[0]).width;
            let contentWidthNum = parseFloat(contentWidthPX.substring(0, contentWidthPX.length - 2));
            let parentWidthPX = getComputedStyle(infoLine).width;
            let parentWidthNum = parseFloat(parentWidthPX.substring(0, parentWidthPX.length - 2));

            let infolineScrollAmount = "0px";
            let infolineScrollDuration = 0;
            if (contentWidthNum > parentWidthNum) {
                infolineScrollAmount = `${parentWidthNum - contentWidthNum}px`;
                infolineScrollDuration = `${(contentWidthNum - parentWidthNum) / 50}s`;
            }

            infoLine.style.setProperty('--infoline-scroll-amount', infolineScrollAmount);
            infoLine.style.setProperty('--infoline-scroll-duration', infolineScrollDuration);
        }
	}

    let showLyrics = false;
    let lyricsData = null;
    let currentLyricsSongKey = '';
    let currentActiveLyricIndex = -1;

    const renderLyrics = (statusMessage = null) => {
        const lyricsContainer = playerScreen?.querySelector('.lyricsContainer');
        if (!lyricsContainer) return;

        const lyricsStatus = lyricsContainer.querySelector('.lyricsStatus');
        const lyricsLines = lyricsContainer.querySelector('.lyricsLines');

        if (statusMessage) {
            if (lyricsStatus) {
                lyricsStatus.style.display = '';
                lyricsStatus.innerText = statusMessage;
            }
            if (lyricsLines) lyricsLines.style.display = 'none';
            return;
        }

        if (!lyricsData || !lyricsData.lines || lyricsData.lines.length === 0) {
            if (lyricsStatus) {
                lyricsStatus.style.display = '';
                lyricsStatus.innerText = lyricsData?.instrumental ? 'Instrumental Track' : 'No lyrics found for this track';
            }
            if (lyricsLines) lyricsLines.style.display = 'none';
            return;
        }

        if (lyricsStatus) lyricsStatus.style.display = 'none';
        if (lyricsLines) {
            lyricsLines.style.display = '';
            lyricsLines.replaceChildren();

            lyricsData.lines.forEach((line, idx) => {
                const lineElem = document.createElement('div');
                lineElem.className = 'lyricLine';
                lineElem.dataset.index = String(idx);
                if (line.time !== null) {
                    lineElem.dataset.time = String(line.time);
                }
                lineElem.innerText = line.text;

                lineElem.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (line.time !== null && background?.mp3Player) {
                        background.mp3Player.currentTime = line.time;
                    }
                });

                lyricsLines.appendChild(lineElem);
            });
        }
    };

    const loadLyricsForCurrentSong = async (force = false) => {
        const track = background?.currentSong;
        if (!track || !track.songName || track.songName === 'Nothing is currently playing.' || track.songName.startsWith('Playing ') || track.songName.startsWith('Starting ')) {
            lyricsData = null;
            currentLyricsSongKey = '';
            currentActiveLyricIndex = -1;
            renderLyrics();
            return;
        }

        const key = `${track.songName}:::${track.artistName || ''}`;
        if (!force && key === currentLyricsSongKey) {
            return;
        }

        currentLyricsSongKey = key;
        currentActiveLyricIndex = -1;
        lyricsData = null;
        renderLyrics('Loading lyrics...');

        if (typeof LyricsService !== 'undefined' && LyricsService.fetchLyrics) {
            const dur = Number(background?.mp3Player?.duration) || Number(track.trackLength) || 0;
            const result = await LyricsService.fetchLyrics(track.songName, track.artistName, dur);
            if (currentLyricsSongKey === key) {
                lyricsData = result;
                renderLyrics();
            }
        } else {
            renderLyrics('Lyrics service unavailable');
        }
    };

    const toggleLyricsView = (explicitState = null) => {
        showLyrics = (explicitState !== null) ? explicitState : !showLyrics;
        const lyricsContainer = playerScreen?.querySelector('.lyricsContainer');
        const coverElement = playerScreen?.querySelector('.cover');
        const lyricsBtn = playerScreen?.querySelector('.action.lyrics');

        if (lyricsContainer) {
            lyricsContainer.style.display = showLyrics ? 'flex' : 'none';
        }
        if (coverElement) {
            coverElement.style.opacity = showLyrics ? '0.1' : '1';
        }
        if (lyricsBtn) {
            lyricsBtn.classList.toggle('active', showLyrics);
            lyricsBtn.setAttribute('title', showLyrics ? 'Lyrics: ON' : 'Lyrics: OFF');
        }
        playerScreen?.classList.toggle('lyrics-open', showLyrics);

        if (showLyrics) {
            loadLyricsForCurrentSong();
        }
    };
    
    const initPlayer = () => {
        if (!playerScreen) { return; }
        // Mostly listeners.

        let backgroundImageElement = document.querySelector('.background-blur');
        let playPauseButton = playerScreen.querySelector('.big');
        let skipNextButton = playerScreen.querySelector('.skip-next');

        let thumbsDownButton = playerScreen.querySelector('.thumbs-down');
        let thumbsUpButton = playerScreen.querySelector('.thumbs-up');

        playerScreen.querySelector('.skip-previous')?.addEventListener('click', () => {
            background?.seekBack?.().then?.(() => {
                updatePlayer();
                updateHistory();
            });
        });
        let repeatButton = playerScreen.querySelector('.repeat');
        repeatButton?.addEventListener('click', () => {
            background?.toggleRepeat?.()?.then?.((repeatState) => {
                if (repeatState) {
                    repeatButton.classList.add('active');
                    repeatButton.setAttribute('title', 'Single-track repeat: ON');
                } else {
                    repeatButton.classList.remove('active');
                    repeatButton.setAttribute('title', 'Single-track repeat: OFF');
                }
            });
        });

        let lyricsButton = playerScreen.querySelector('.action.lyrics');
        lyricsButton?.addEventListener('click', () => toggleLyricsView());

        let popoutButton = playerScreen.querySelector('.action.popout');
        if (isPopout) {
            if (popoutButton) {
                popoutButton.style.display = 'none';
            }
        } else if (popoutButton) {
            popoutButton.addEventListener('click', () => {
                const isCompact = document.documentElement.classList.contains('compact') || document.body.classList.contains('compact');
                const page = isCompact ? 'compact.htm' : 'cozy.htm';

                const defaultW = isCompact ? 480 : 380;
                const defaultH = isCompact ? 180 : 640;
                const rawW = parseInt(localStorage.getItem('popout_custom_width')) || defaultW;
                const rawH = parseInt(localStorage.getItem('popout_custom_height')) || defaultH;
                const savedW = Math.min(1000, Math.max(320, rawW));
                const savedH = Math.min(800, Math.max(160, rawH));

                chrome.runtime.sendMessage({
                    type: 'OPEN_POPOUT',
                    page,
                    width: savedW,
                    height: savedH
                }, () => {
                    window.close();
                });
            });
        }

        let coverHolder = playerScreen.querySelector('.coverHolder');
        coverHolder?.addEventListener('click', (e) => {
            if (!e.target.closest('.volume') && !e.target.closest('.volumewrap') && !e.target.closest('.lyricLine')) {
                toggleLyricsView();
            }
        });


        backgroundImageElement?.addEventListener('load', () => {
            backgroundImageElement.classList.add('loaded');
        })
        
        playPauseButton?.addEventListener('click', async () => {
            if (!background.currentUserInfo?.logged_in) {
                goToScreen('account');
                return;
            }
            let stationToken = background.currentStationToken || localStorage.getItem('lastStation');
            if (!stationToken && background.stationsArray?.length) {
                stationToken = background.stationsArray[0].stationToken;
                background.currentStationToken = stationToken;
                localStorage.setItem('lastStation', stationToken);
            }
            if (!stationToken) {
                if (typeof background.refreshStationsList === 'function') {
                    playPauseButton.replaceChildren(getNewIconElem('pause'));
                    background.refreshStationsList().then(() => {
                        const st = background.currentStationToken || background.stationsArray?.[0]?.stationToken;
                        if (st) {
                            background.playStation(st).then(() => {
                                updatePlayer();
                                updateHistory();
                            });
                        } else {
                            goToScreen('stations');
                        }
                    });
                    return;
                }
                goToScreen('stations');
                return;
            }
            if (background.mp3Player?.paused) {
                playPauseButton.replaceChildren(getNewIconElem('pause'));
                updatePlayer();
                if (!background.currentSong) {
                    await background.playStation(stationToken);
                } else {
                    await background.play();
                }
                updatePlayer();
                updateHistory();
            } else {
                background.mp3Player?.pause?.();
                playPauseButton.replaceChildren(getNewIconElem('play'));
            }
        });

        thumbsDownButton.addEventListener('click', () => processThumb(background.currentSong, thumbsDownButton, thumbsUpButton, false));
        thumbsUpButton.addEventListener('click', () => processThumb(background.currentSong, thumbsUpButton, thumbsDownButton, true));
        skipNextButton.addEventListener('click', () => {
            background.nextSong().then(() => {
                updatePlayer();
                updateHistory();
            });
        });

        /** @type {HTMLInputElement | null } */
        let seekBar = playerScreen.querySelector('.seekBar');
        seekBar?.addEventListener('input', (e) => {
            if (background?.mp3Player) {
                background.mp3Player.currentTime = parseFloat(e.target.value) || 0;
            }
        });

        let volumeBar = playerScreen.querySelector('.volume');
        if (volumeBar && background.mp3Player && volumeBar instanceof HTMLInputElement) {
            volumeBar.value = background.mp3Player.volume * 100;
            let volPos = document.documentElement.style.getPropertyValue('--volume-bar-position');
            if (volPos === 'none') {
                volumeBar.parentElement.style.display = 'none';
            }
            if (volPos === 'left' || volPos === 'right') {
                volumeBar.parentElement.parentElement.style.padding = '0';
                volumeBar.parentElement.dataset.isVertical = true;
            }
            volumeBar.addEventListener('input', (e) => {
                if (background?.mp3Player) {
                    bg_config.volume = background.mp3Player.volume = (parseFloat(e.target.value) / 100);
                }
            })
        }
    }

    let trackAsOfPreviousUpdate = null;
    const updatePlayer = () => {
        if (!playerScreen) { return; }

        const nowPlayingStation = background?.stationsByToken?.[background?.currentStationToken] ||
            background?.stationsArray?.find?.(s => s.stationToken === background?.currentStationToken);

        let currentTrack = background?.currentSong || {
            songName: nowPlayingStation ? `Playing ${nowPlayingStation.stationName}` : "Nothing is currently playing.",
            artistName: nowPlayingStation ? "Loading track..." : "Choose a station to begin.",
            albumArtUrl: nowPlayingStation ? getOptimalArtworkUrl(nowPlayingStation) : DEFAULT_ALBUM_IMAGE,
			allowFeedback: false,
            songRating: 0
        };

        let thumbsDownButton = playerScreen.querySelector('.thumbs-down');
        let thumbsUpButton = playerScreen.querySelector('.thumbs-up');

        if (currentTrack.songRating === 1) {
            thumbsDownButton.classList.remove('active');
            thumbsUpButton.classList.add('active');
        } else if (currentTrack.songRating === -1) {
            // This should never happen.
            // ... still, good to cover it anyways.
            thumbsDownButton.classList.add('active');
            thumbsUpButton.classList.remove('active');
        } else {
            thumbsDownButton.classList.remove('active');
            thumbsUpButton.classList.remove('active');
        }

        const canFeedback = Boolean(
            currentTrack &&
            currentTrack.trackToken &&
            !currentTrack.adToken &&
            !currentTrack.clickThroughUrl &&
            currentTrack.allowFeedback !== false &&
            currentTrack.songName !== "Nothing is currently playing." &&
            !currentTrack.songName?.startsWith("Playing ")
        );
		thumbsUpButton.disabled = !canFeedback;
		thumbsDownButton.disabled = !canFeedback;

        let playPauseButton = playerScreen.querySelector('.big');
        const isPaused = Boolean(background.mp3Player?.paused);
        const desiredIcon = isPaused ? 'play' : 'pause';
        if (playPauseButton && playPauseButton.dataset.icon !== desiredIcon) {
            playPauseButton.dataset.icon = desiredIcon;
            playPauseButton.replaceChildren(getNewIconElem(desiredIcon));
        }

        let seekBar = playerScreen.querySelector('.seekBar');
        if (seekBar && (seekBar instanceof HTMLInputElement)) {
            const dur = Number(background?.mp3Player?.duration) || Number(background?.currentSong?.trackLength) || 0;
            seekBar.max = dur > 0 ? dur : 100;
        }

		const trackIsAdvertisement = !!currentTrack.clickThroughUrl;

        let repeatButton = playerScreen.querySelector('.repeat');
        if (repeatButton) {
            const isRepeat = Boolean(background.config?.repeatOne);
            if (isRepeat) {
                repeatButton.classList.add('active');
                repeatButton.setAttribute('title', 'Single-track repeat: ON');
            } else {
                repeatButton.classList.remove('active');
                repeatButton.setAttribute('title', 'Single-track repeat: OFF');
            }
        }

        const nowPlayingTitle = document.querySelector('.now-playing-title');    
        if (nowPlayingTitle) {
            const currentStation = background?.stationsByToken?.[background?.currentStationToken];
            if (currentStation?.stationName) {
                nowPlayingTitle.innerText = currentStation.stationName;
            }
        }

        let coverElement = playerScreen.querySelector('.cover');
        let backgroundImageElement = document.querySelector('.background-blur');
        const optimalArt = getOptimalArtworkUrl(currentTrack);

        if (coverElement) {
            setSafeAsyncImage(coverElement, optimalArt);
        }
        if (backgroundImageElement) {
            setSafeAsyncImage(backgroundImageElement, optimalArt);
        }

        let titleElement = playerScreen.querySelector('.title');
        let artistElement = playerScreen.querySelector('.artist');
        if (titleElement) {
            titleElement.innerText = currentTrack.songName || "Nothing is currently playing.";
            titleElement.setAttribute('title', currentTrack.songName || '');
        }
        if (artistElement) {
            artistElement.innerText = currentTrack.artistName || "Choose a station to begin.";
            artistElement.setAttribute('title', currentTrack.artistName || '');
        }

        if (currentTrack.songName && currentTrack.songName !== "Nothing is currently playing.") {
            document.title = `${currentTrack.songName} - ${currentTrack.artistName || 'Harmonia'} · Harmonia`;
        } else {
            document.title = "Harmonia";
        }
		
		if (titleElement) {
			if (titleElement instanceof HTMLAnchorElement) {
				if (currentTrack.songDetailUrl ?? currentTrack.clickThroughUrl) {
					titleElement.href = processURL(currentTrack.songDetailUrl ?? currentTrack.clickThroughUrl);
				} else {
					titleElement.removeAttribute('href');
				}
			} else {
				if (trackIsAdvertisement) {
					let adLink = titleElement.querySelector('.ad-link');
					if (!adLink) {
						adLink = document.createElement('a');
						adLink.appendChild(getNewIconElem('link'))
					}
					adLink.href = currentTrack.clickThroughUrl;
					titleElement.appendChild(adLink);
				} else {
					if (titleElement.querySelector('.ad-link')) {
						titleElement.removeChild(titleElement.querySelector('.ad-link'))
					}
				}
			}
		}

        if (artistElement instanceof HTMLAnchorElement) {
			if (currentTrack.artistDetailUrl) {
				artistElement.href = processURL(currentTrack.artistDetailUrl);
			} else {
				artistElement.removeAttribute('href');
			}
        }

        let lyricsButton = playerScreen.querySelector('.action.lyrics');
        if (lyricsButton) {
            lyricsButton.classList.toggle('active', showLyrics);
            lyricsButton.setAttribute('title', showLyrics ? 'Lyrics: ON' : 'Lyrics: OFF');
        }

        if (showLyrics) {
            loadLyricsForCurrentSong();
        }

		let separatorElement = playerScreen.querySelector('.infoline-content .sep');
		if (separatorElement) {	
			if (currentTrack.songName && currentTrack.artistName) {
				separatorElement.style.display = '';
			} else {
				separatorElement.style.display = 'none';
			}
		}
		setTimeout(recalculateInfoLine, 10);

        trackAsOfPreviousUpdate = background?.currentSong || null;
    }

    const formatTime = (seconds) => {
        if (isNaN(seconds) || seconds < 0) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const drawPlayer = () => {
        const curTime = background?.mp3Player?.currentTime || 0;
        const dur = Number(background?.mp3Player?.duration) || Number(background?.currentSong?.trackLength) || 0;

        let seekBar = playerScreen.querySelector('.seekBar');
        if (seekBar && (seekBar instanceof HTMLInputElement)) {
            if (dur > 0 && (Number(seekBar.max) !== dur || seekBar.max === "0")) {
                seekBar.max = dur;
            }
            seekBar.value = curTime;
        }

        let timeCurrent = playerScreen.querySelector('.time-current');
        if (timeCurrent) {
            timeCurrent.innerText = formatTime(curTime);
        }
        let timeTotal = playerScreen.querySelector('.time-total');
        if (timeTotal) {
            timeTotal.innerText = formatTime(dur);
        }
        
        let volumeBar = playerScreen.querySelector('.volume');
        if (volumeBar && background?.mp3Player && (volumeBar instanceof HTMLInputElement)) {
            volumeBar.value = background.mp3Player.volume * 100;
        }

        if (showLyrics && lyricsData && lyricsData.synced && background?.mp3Player && typeof LyricsService !== 'undefined') {
            const curTime = background.mp3Player.currentTime || 0;
            const idx = LyricsService.findActiveLyricIndex(lyricsData.lines, curTime);
            if (idx !== currentActiveLyricIndex) {
                currentActiveLyricIndex = idx;
                const lyricsLines = playerScreen?.querySelector('.lyricsLines');
                if (lyricsLines) {
                    const prevActive = lyricsLines.querySelector('.lyricLine.active');
                    if (prevActive) prevActive.classList.remove('active');

                    if (idx >= 0 && idx < lyricsLines.children.length) {
                        const activeElem = lyricsLines.children[idx];
                        activeElem.classList.add('active');
                        activeElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            }
        }
    }

    const initStations = () => {
        if (!stationsScreen) { return; }

        let refreshButton = stationsScreen.querySelector('.refresh');
        let stationsList = stationsScreen.querySelector('.stationsList');

        if (!stationsList) {
            // What's the point?
            return;
        }

        refreshButton?.addEventListener('click', () => {
            if (refreshButton.classList.contains('active')) { return; }

            refreshButton.classList.add('active');

            stationsList.replaceChildren(); // with nothing. clear the children.

            background?.refreshStationsList().then(({ ok }) => {
                refreshButton.classList.remove('active');

                if (ok) {
                    updateStations();
                }
            })
        })
    }

    const updateStations = (forceList = null) => {
        /** @type {HTMLTemplateElement | null} */
        const stationTemplate = document.querySelector('.station-template');

        if (!stationsScreen || !stationTemplate) { return; }

        const stationsListElement = stationsScreen.querySelector('.stationsList');
        let lastActiveStation = null;
        let newChildren = [];
        let usedList = forceList || background.stationsArray || [];
        for (let station of usedList) {
            const newStation = stationTemplate.content.children[0].cloneNode(true);
            newStation.querySelector('.title').innerText = station.stationName;
            let coverElement = newStation.querySelector('.cover');

            if (coverElement) {
                setSafeAsyncImage(coverElement, getOptimalArtworkUrl(station));
            }

            if (station.stationToken === background?.currentStationToken) {
                lastActiveStation = newStation;
                newStation.classList.add('active');
                if (document.querySelector('.now-playing-title')) {
                    document.querySelector('.now-playing-title').innerText = station.stationName;
                }
            }

            const canDelete = station.allowDelete !== false && !station.isQuickMix;
            const deleteBtn = newStation.querySelector('.delete-station-btn');
            if (!canDelete && deleteBtn) {
                deleteBtn.remove();
            } else if (deleteBtn) {
                deleteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const stationName = station.stationName || 'this station';
                    if (!window.confirm(`Delete station "${stationName}"?`)) {
                        return;
                    }
                    deleteBtn.disabled = true;
                    deleteBtn.style.opacity = '0.3';
                    try {
                        await background.deleteStation(station.stationToken);
                        await background.refreshStationsList();
                        updateStations();
                        updatePlayer();
                    } catch (err) {
                        console.error('Failed to delete station:', err);
                        alert('Failed to delete station: ' + (err?.message || err));
                        deleteBtn.disabled = false;
                        deleteBtn.style.opacity = '';
                    }
                });
            }

            const playThisStation = () => {
                lastActiveStation?.classList.remove('active');
                lastActiveStation = newStation;
                newStation.classList.add('active');
                if (document.querySelector('.now-playing-title')) {
                    document.querySelector('.now-playing-title').innerText = station.stationName;
                }

                background.currentStationToken = station.stationToken;
                updatePlayer();
                goToScreen('playing');
                document.querySelector('.player .big')?.focus();

                background?.playStation?.(station.stationToken)?.then?.(() => {
                    updatePlayer();
                    updateHistory();
                });
            };

            newStation.addEventListener('click', (e) => {
                if (e.target.closest('.delete-station-btn')) return;
                e.preventDefault();
                playThisStation();
            });

            newStation.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    if (e.target.closest('.delete-station-btn')) return;
                    e.preventDefault();
                    playThisStation();
                }
            });

            newChildren.push(newStation);
        }

        stationsListElement.replaceChildren(...newChildren);
    }

    let searchDebounceTimer = null;
    const searchResultsList = document.querySelector('.searchResultsList');

    const hideSearchResults = () => {
        if (searchResultsList) {
            searchResultsList.style.display = 'none';
            searchResultsList.replaceChildren();
        }
    };

    const performOnlineSongSearch = async (query) => {
        if (!searchResultsList || !query || !query.trim()) {
            hideSearchResults();
            return;
        }

        searchResultsList.style.display = '';
        searchResultsList.replaceChildren();

        const loadingHeader = document.createElement('li');
        loadingHeader.className = 'search-header';
        loadingHeader.innerText = `Searching songs for "${query}"...`;
        searchResultsList.appendChild(loadingHeader);

        try {
            const res = await background?.searchMusic?.(query);
            if (!res || !res.ok || ((!res.songs || res.songs.length === 0) && (!res.artists || res.artists.length === 0))) {
                loadingHeader.innerText = `No online songs found for "${query}".`;
                return;
            }

            searchResultsList.replaceChildren();

            if (res.songs && res.songs.length) {
                const songsHeader = document.createElement('li');
                songsHeader.className = 'search-header';
                songsHeader.innerText = `Songs (${res.songs.length}) - Click to play station`;
                searchResultsList.appendChild(songsHeader);

                res.songs.slice(0, 15).forEach((song) => {
                    const item = document.createElement('li');
                    item.className = 'search-item';
                    item.setAttribute('role', 'button');
                    item.setAttribute('tabindex', '0');
                    item.setAttribute('title', `Play radio based on "${song.songName}"`);

                    const iconHolder = document.createElement('div');
                    iconHolder.className = 'icon-holder';
                    iconHolder.innerHTML = `<svg class="icon feather-music" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>`;

                    const info = document.createElement('div');
                    info.className = 'info';

                    const title = document.createElement('span');
                    title.className = 'title';
                    title.innerText = song.songName;

                    const artist = document.createElement('span');
                    artist.className = 'artist';
                    artist.innerText = song.artistName || 'Unknown Artist';

                    info.appendChild(title);
                    info.appendChild(artist);
                    item.appendChild(iconHolder);
                    item.appendChild(info);

                    const playActionBtn = document.createElement('span');
                    playActionBtn.className = 'search-play-btn';
                    playActionBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="6 4 18 12 6 20 6 4"></polygon></svg>`;
                    item.appendChild(playActionBtn);

                    item.addEventListener('click', async () => {
                        background.currentSong = {
                            songName: `Playing ${song.songName} Radio`,
                            artistName: song.artistName ? `${song.artistName} (Seed)` : 'Starting station...',
                            albumArtUrl: DEFAULT_ALBUM_IMAGE,
                            allowFeedback: false,
                            songRating: 0
                        };
                        updatePlayer();
                        goToScreen('playing');

                        await background?.playSearchedSong?.(song.musicToken, song.songName, song.artistName);
                        updatePlayer();
                        updateHistory();
                    });

                    searchResultsList.appendChild(item);
                });
            }

            if (res.artists && res.artists.length) {
                const artistsHeader = document.createElement('li');
                artistsHeader.className = 'search-header';
                artistsHeader.innerText = `Artists (${res.artists.length}) - Click to start radio`;
                searchResultsList.appendChild(artistsHeader);

                res.artists.slice(0, 5).forEach((art) => {
                    const item = document.createElement('li');
                    item.className = 'search-item';
                    item.setAttribute('role', 'button');
                    item.setAttribute('tabindex', '0');

                    const iconHolder = document.createElement('div');
                    iconHolder.className = 'icon-holder';
                    iconHolder.innerHTML = `<svg class="icon feather-user" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;

                    const info = document.createElement('div');
                    info.className = 'info';

                    const title = document.createElement('span');
                    title.className = 'title';
                    title.innerText = `${art.artistName} Radio`;

                    info.appendChild(title);
                    item.appendChild(iconHolder);
                    item.appendChild(info);

                    const playActionBtn = document.createElement('span');
                    playActionBtn.className = 'search-play-btn';
                    playActionBtn.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="6 4 18 12 6 20 6 4"></polygon></svg>`;
                    item.appendChild(playActionBtn);

                    item.addEventListener('click', async () => {
                        background.currentSong = {
                            songName: `Playing ${art.artistName} Radio`,
                            artistName: 'Loading track...',
                            albumArtUrl: DEFAULT_ALBUM_IMAGE,
                            allowFeedback: false,
                            songRating: 0
                        };
                        updatePlayer();
                        goToScreen('playing');

                        await background?.createStation?.(art.musicToken);
                        updatePlayer();
                        updateHistory();
                    });

                    searchResultsList.appendChild(item);
                });
            }
        } catch (err) {
            loadingHeader.innerText = 'Search error: ' + (err?.message || String(err));
        }
    };

    /** @type {HTMLInputElement} */
    const stationsSearchElement = document.querySelector('#stations-search');
    stationsSearchElement?.addEventListener('input', (e) => {
        let value = e.currentTarget.value;

        if (value === "") {
            clearTimeout(searchDebounceTimer);
            hideSearchResults();
            updateStations(background?.stationsArray || []);
            return;
        }

        let filteredStations = (/** @type {Array<unknown>} */(background?.stationsArray || []))
            .map(station => [station, fuzzyStringSearch(station.stationName, value)])
            .sort((stationA, stationB) => (stationA[1] < stationB[1]))
            .filter(station => station[1] > 0.2)
            .map(station => station[0]);
        updateStations(filteredStations);

        clearTimeout(searchDebounceTimer);
        const query = value.trim();
        if (query.length >= 2) {
            searchDebounceTimer = setTimeout(() => {
                performOnlineSongSearch(query);
            }, 350);
        } else {
            hideSearchResults();
        }
    });

    stationsSearchElement?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            clearTimeout(searchDebounceTimer);
            const query = stationsSearchElement.value.trim();
            if (query) {
                performOnlineSongSearch(query);
            }
        }
    });

    const getNewIconElem = (/** @type {typeof ICONS[number]} */icon) => {
        let newIconTemplate = document.querySelector(`.${icon}-icon-template`);
        let newIcon = newIconTemplate.content.children[0].cloneNode(true);
        return newIcon;
    }

    let showAccountFn = null;
    let showLoginFn = null;

    const initAccount = () => {
        if (!accountScreen) { return; } 

        const versionText = accountScreen.querySelector('.version');

        if (versionText) {
            versionText.innerText = getAnesidoraVersion();
        }

        function showAccount() {
            if (!background.currentUserInfo?.logged_in) {
                showLogin();
                return;
            }

            accountScreen.querySelectorAll('form.login, .real-account').forEach(el => el.remove());
            accountScreen.classList.remove('logged-out');
            accountScreen.classList.add('logged-in');
            let acctTemplate = document.querySelector('.account-template');
            let newAcct = acctTemplate.content.children[0].cloneNode(true);

            let avatar = newAcct.querySelector('.avatar');
            
            // Show current email and account image in account page.
            if (avatar) {
                avatar.src = getAccountImage(background.currentUserInfo.email);
            }
            newAcct.querySelector('.username').innerText = background.currentUserInfo.email;

            (newAcct.querySelector('button') || newAcct).addEventListener('click', () => {
                background?.userLogout?.();
                showLogin();
            });

            accountScreen.querySelector('.account-info-after-me').insertAdjacentElement('afterend', newAcct);
        }

        function showLogin() {
            accountScreen.querySelectorAll('form.login, .real-account').forEach(el => el.remove());
            accountScreen.classList.remove('logged-in');
            accountScreen.classList.add('logged-out');

            /** @type {HTMLTemplateElement} */
            let loginTemplate = document.querySelector('.login-template');
            let loginForm = loginTemplate.content.children[0].cloneNode(true);

            /** @type {HTMLButtonElement} */
            let loginButton = loginForm.querySelector('.login-submit')
            let loginErrorContainer = loginForm.querySelector('.login-error-container');

            let adjacentElem = accountScreen.querySelector('.login-after-me') ?? accountScreen.querySelector('.login-template');
            adjacentElem?.insertAdjacentElement('afterend', loginForm);

            // When "login" is pressed,
            loginForm?.addEventListener('submit', (event) => {
                // Prevent the default behavior of reloading the page
                event.preventDefault();

                // If we're already in the process of logging in,
                // do nothing.
                if (loginButton.classList.contains('active')) {
                    return;
                }
                // Change the login button to reflect that we're doing something:
                loginButton.classList.add('active');
                loginButton.classList.remove('warning');
                if (loginButton.querySelector('.icon')) {
                    loginButton.replaceChild(
                        getNewIconElem('refresh'),
                        loginButton.querySelector('.icon')
                    );
                }

                // Get the contents of our username and password text boxes
                let formData = new FormData(loginForm);
                // Actually log in using the email and password from the text boxes
                background.userLogin(formData.get('email'), formData.get('password')).then(result => {
                    // OK, we've tried to log in. What's the result?

                    if (result.ok) {
                        // Good result! Switch to stations view and refresh stations
                        showAccount();
                        goToScreen('stations');
                        updateStations();
                        background?.refreshStationsList?.()?.then(() => {
                            if (!background.currentStationToken && background.stationsArray?.length) {
                                background.currentStationToken = background.stationsArray[0].stationToken;
                                localStorage.setItem('lastStation', background.currentStationToken);
                            }
                            updateStations();
                            updatePlayer();
                        });
                    } else {
                        // Bad result! Show the error message.
                        if (loginErrorContainer) {
                            loginErrorContainer.innerText = result.reason ?? '\n';
                        }

                        loginButton.classList.remove('active');
                        loginButton.classList.add('warning');
                        if (loginButton.querySelector('.icon')) {
                            loginButton.replaceChild(getNewIconElem('login'), loginButton.querySelector('.icon'));
                        }
                    }
                })
            });
        }

        showAccountFn = showAccount;
        showLoginFn = showLogin;

        if (background.currentUserInfo?.logged_in) {
            showAccount();
        } else {
            showLogin();
        }
    }

    initStations();

    if (background.currentUserInfo?.logged_in) {
        updateStations();
        setTimeout(() => {
            background?.throttleRefreshStationsList?.()?.then?.(() => {
                if (stationsScreen && !stationsScreen.contains(document.activeElement)) {
                    updateStations();
                }
            });
        }, 120);
    }

    initAccount();
    updateHistory();

    initPlayer();
    updatePlayer();

    
    background.setCallbacks(
        () => {
            updatePlayer();
            updateHistory();
            updateStations();
        },
        drawPlayer
    );

    if (typeof background.onReady === 'function') {
        background.onReady(() => {
            const hasSavedAccount = Boolean(typeof localStorage !== 'undefined' && localStorage.getItem('username'));
            const isUserAuthed = Boolean(background.currentUserInfo?.logged_in || hasSavedAccount);

            if (isUserAuthed) {
                if (showAccountFn) {
                    showAccountFn();
                }
                updateStations();
                if (!background.currentStationToken && (!background.currentSong || !background.currentSong.songName) && bg_config.currentScreen === 'account') {
                    goToScreen('stations');
                }
            } else {
                if (showLoginFn) {
                    showLoginFn();
                }
                goToScreen('account');
            }
            updatePlayer();
            updateHistory();
        });
    }

    // Desktop/Popup Keyboard Controls (Space, ArrowRight, ArrowLeft, ArrowUp, ArrowDown, L)
    window.addEventListener('keydown', (e) => {
        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        if (activeTag === 'input' || activeTag === 'textarea' || document.activeElement?.isContentEditable) {
            return;
        }

        if (e.code === 'Space') {
            e.preventDefault();
            playerScreen?.querySelector('.action.play')?.click();
        } else if (e.code === 'ArrowRight' && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            playerScreen?.querySelector('.action.skip-next')?.click();
        } else if (e.code === 'ArrowLeft' && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            playerScreen?.querySelector('.action.skip-previous')?.click();
        } else if (e.code === 'ArrowUp' && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            if (background?.mp3Player) {
                const currentVol = (typeof background.mp3Player.volume === 'number') ? background.mp3Player.volume : (bg_config.volume ?? 1);
                const newVol = Math.min(1, Math.round((currentVol + 0.05) * 100) / 100);
                bg_config.volume = background.mp3Player.volume = newVol;
                const volumeBar = playerScreen?.querySelector('.volume');
                if (volumeBar) volumeBar.value = newVol * 100;
            }
        } else if (e.code === 'ArrowDown' && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            if (background?.mp3Player) {
                const currentVol = (typeof background.mp3Player.volume === 'number') ? background.mp3Player.volume : (bg_config.volume ?? 1);
                const newVol = Math.max(0, Math.round((currentVol - 0.05) * 100) / 100);
                bg_config.volume = background.mp3Player.volume = newVol;
                const volumeBar = playerScreen?.querySelector('.volume');
                if (volumeBar) volumeBar.value = newVol * 100;
            }
        } else if (e.key === 'l' || e.key === 'L') {
            e.preventDefault();
            toggleLyricsView();
        }
    });
});
