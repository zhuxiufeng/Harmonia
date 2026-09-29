/**
 * Common utilities and theme styling logic for Anesidora MV3
 */
"use strict";

const MIN_ERRORSKIP_DELAY = 1000;
const USE_PANDORA_DEFAULT_ALBUM_IMAGE = false;

const DEFAULT_ALBUM_IMAGE = (
    USE_PANDORA_DEFAULT_ALBUM_IMAGE ? 
        'https://web-cdn.pandora.com/web-client-assets/images/album_500.7d4c7506560849c0a606b93e9f06de71.png' :
        './images/default_cover.svg'
);

const ALL_SCREENS = /** @type {const} */ (['history', 'playing', 'stations', 'account']);

// Resolve background object: In MV3, window.background is provided by bridge.js in popup/options,
// or window itself in offscreen document.
const background = window.background || (typeof get_browser !== 'undefined' && get_browser().extension?.getBackgroundPage?.()) || window;
var bg_config = window.bg_config || background.config;

// Utility functions
const toHTTPS = (url) => {
    if (!url) { return url; }
    if (bg_config?.httpsOnlyAssets) {
        return url.replace('http://', 'https://');
    }
    return url;
};

const removeQueryString = (url) => {
	if (!url) { return url; }
	if (bg_config?.stripTrackingParams) {
		return url.split('?')[0];
	}
	return url;
};

const processURL = (url) => {
	return toHTTPS(removeQueryString(url));
};

const getOptimalArtworkUrl = (track) => {
    if (!track) return DEFAULT_ALBUM_IMAGE;
    let url = track.artBlobUrl || track.albumArtUrl || track.artUrl;
    if (!url) return DEFAULT_ALBUM_IMAGE;
    // Prefer direct HTTPS CDN image url over cross-document blob for speed and caching
    if (track.albumArtUrl || track.artUrl) {
        url = toHTTPS(track.albumArtUrl || track.artUrl);
        return url.replace('1080W_1080H', '500W_500H');
    }
    return url;
};

const debounceFunction = (cb, delay = 2000) => {
	let lastTimeoutId = null;
    return () => {
		if (lastTimeoutId) {
			window.clearTimeout(lastTimeoutId);
		}
		lastTimeoutId = window.setTimeout(() => {
			cb();
		}, delay);
    };
};

const getPreset = (preset = bg_config?.selectedPreset) => {
    return bg_config?.presets?.find(e => e.id === preset);
};

const getEffectivePreset = () => {
    return bg_config?.selectedPreset === 'match' ? getMatchPreset() : getPreset();
};

const getPresetMetaVariable = (key, preset = getEffectivePreset()) => {
	if (preset && preset[key]) {
		return preset[key];
	}
    const defs = background?.DEFAULTS || (typeof DEFAULTS !== 'undefined' ? DEFAULTS : null);
    if (!defs) return null;
    const playerType = preset?.playerType ?? defs.presets[defs.selectedPreset]?.playerType ?? 'cozy';
	return defs.playerPreferences[playerType]?.[key];
};

function getSelectedMatchPresets() {
	let selectedMatchPresets = bg_config?.selectedMatchPresets || { dark: 'cozy-dark', light: 'cozy-light' };
    let presets = bg_config?.presets || [];
    const defs = background?.DEFAULTS || (typeof DEFAULTS !== 'undefined' ? DEFAULTS : null);

	for (let matchType of ['light', 'dark']) {
		if (!selectedMatchPresets[matchType]) {
			let typeCandidate = presets.find(e => e.cssVariables?.['color-scheme-type'] === matchType);

            if (typeCandidate) {
                selectedMatchPresets[matchType] = typeCandidate.id;
                continue;
            }

            if (defs) {
                let presetFromDefaults = defs.presets.find(e => e.cssVariables?.['color-scheme-type'] === matchType);
                if (presetFromDefaults) {
                    presets.push(presetFromDefaults);
                    selectedMatchPresets[matchType] = presetFromDefaults.id;
                }
            }
		}
	}

	return selectedMatchPresets;
}

function getMatchPreset(colorScheme) {
	if (colorScheme !== 'light' && colorScheme !== 'dark') {
		let prefersLight = matchMedia(`(prefers-color-scheme: light)`);
		colorScheme = (background?.prefersLightMedia?.matches ?? prefersLight.matches) ? 'light' : 'dark';
	}

	return getPreset(getSelectedMatchPresets()[colorScheme]);
}

// Migrate from old version if present
if (typeof localStorage !== 'undefined' && (localStorage.getItem('bodyWidth') || localStorage.getItem('bodyHeight') || localStorage.getItem('themeInfo'))) {
    if (localStorage.getItem('themeInfo')) {
        try {
            const oldPresetInfo = JSON.parse(localStorage.getItem('themeInfo'));
            const presets = bg_config?.presets;
            const newPreset = JSON.parse(JSON.stringify(getEffectivePreset() || {}));
            newPreset.name = "Migrated";
            newPreset.id = "migrated";
            newPreset.cssVariables = newPreset.cssVariables || {};
            
            if (localStorage.getItem('bodyWidth')) {
                newPreset.cssVariables['viewport-width'] = localStorage.getItem('bodyWidth') + 'px';
                localStorage.removeItem('bodyWidth');
            }
            if (localStorage.getItem('bodyHeight')) {
                newPreset.cssVariables['viewport-height'] = localStorage.getItem('bodyHeight') + 'px';
                localStorage.removeItem('bodyHeight');
            }
            newPreset.cssVariables['background-color'] = oldPresetInfo.background;
            newPreset.cssVariables['font-family'] = oldPresetInfo['font-family'];
            newPreset.cssVariables['font-size'] = oldPresetInfo['font-size'];
            newPreset.cssVariables['text-color'] = oldPresetInfo['text-color'];
            newPreset.cssVariables['tab-navigation-icon-size'] = oldPresetInfo.tabSize;
            newPreset.cssVariables['icon-default-stroke'] = oldPresetInfo['button-color'];
            newPreset.cssVariables['icon-active-stroke'] = oldPresetInfo['active-button-color'];

            if (presets) presets.push(newPreset);
            localStorage.removeItem('themeInfo');
        } catch(e) {}
    }
}

function updateCSSVariables(forceKey) {
    let preset = getEffectivePreset();
    if (!preset || !preset.cssVariables) return;

    if (forceKey) {
        document.documentElement.style.setProperty("--" + forceKey, preset.cssVariables[forceKey]);
    } else {
        for (let key in preset.cssVariables) {
            document.documentElement.style.setProperty("--" + key, preset.cssVariables[key]);
        }
    }
}

let customStyleElement = null;
function updateCustomCSS() {
    let allowCustomCSS = !window.location.pathname.includes('options');

    let newStyles = '';
    if (allowCustomCSS) {
        newStyles = getEffectivePreset()?.customCSS || '';
    }

    let styleElement;
    if (customStyleElement) {
        styleElement = customStyleElement;
    } else {
        styleElement = customStyleElement = document.createElement('style');
        styleElement.setAttribute('type', 'text/css');
        document.head.appendChild(styleElement);
    }
    styleElement.replaceChildren(document.createTextNode(newStyles));
}

function subscribeToUpdateCustomCSS() {
    let prefersLight = background?.prefersLightMedia || matchMedia(`(prefers-color-scheme: light)`);

    prefersLight?.addEventListener?.('change', () => {    
        updateCSSVariables();
        updateCustomCSS();
    });
}

subscribeToUpdateCustomCSS();
updateCSSVariables();
updateCustomCSS();

const getAnesidoraVersion = () => {
	if (window.chrome && chrome.runtime && chrome.runtime.id) {
		return 'v' + window.chrome.runtime.getManifest().version;
	}
    return 'v3.1.0';
};
