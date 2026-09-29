/*globals chrome*/
/*exported platform_specific, get_browser, is_android*/

var isAndroid = false;

function is_android() {
    return false;
}

async function get_is_android() {
    isAndroid = false;
}

function is_chrome() {
    return true;
}

function get_browser() {
    return chrome;
}

function get_action() {
    const b = get_browser();
    return b.action || b.browserAction;
}

function platform_specific() {
    function getPopupUrl() {
        let useablePopupURL = '/cozy.htm';
        try {
            let currentPresetID = config.selectedPreset;
            let allPresets = config.presets;

            if (currentPresetID && allPresets) {
                let currentPreset = allPresets.find(e => e.id === currentPresetID);
                if (currentPreset && currentPreset.playerType) {
                    if (currentPreset.playerType === 'match') {
                        let selectedMatchPresets = config.selectedMatchPresets;

                        for (let matchType of ['light', 'dark']) {
                            if (!selectedMatchPresets[matchType]) {
                                selectedMatchPresets[matchType] = allPresets.find(e => e.cssVariables['color-scheme-type'] === matchType)?.id;

                                if (!selectedMatchPresets[matchType]) {
                                    let presetFromDefaults = DEFAULTS.presets.find(e => e.cssVariables['color-scheme-type'] === matchType);
                                    allPresets.push(presetFromDefaults);
                                    selectedMatchPresets[matchType] = presetFromDefaults.name;
                                }
                            }
                        }

                        let prefersLight = matchMedia(`(prefers-color-scheme: light)`).matches;
                        let colorScheme = prefersLight ? 'light' : 'dark';

                        currentPreset = allPresets.find(e => e.id === selectedMatchPresets[colorScheme]);
                    }

                    useablePopupURL = `/${currentPreset.playerType}.htm`;
                }
            }
        } catch(e) {
            console.error('Error resolving popup URL:', e);
        }
        return useablePopupURL;
    }

    const action = get_action();
    if (!is_android() && action?.setPopup) {
        action.setPopup({ popup: getPopupUrl() }).catch(() => {});
    }

    if (action?.onClicked) {
        action.onClicked.addListener(() => {
            get_browser().tabs.create({
                url: getPopupUrl()
            });
        });
    }
}
