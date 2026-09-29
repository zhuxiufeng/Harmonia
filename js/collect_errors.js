(() => {
    let host = null;

    if ('chrome' in window) {
        host = window.chrome;
    } else if ('browser' in window) {
        host = window.browser;
    } else {
        console.error('Could not find browser reference');
        return;
    }

    let background = window.background || host.extension?.getBackgroundPage?.() || window;
    let rootPath = (host.runtime?.getURL || host.extension?.getURL)?.('') || '';
    if (background) {
        background.collectedErrors ??= [];
    }
    window.addEventListener('error', (e) => {
        let message = `${e.filename ? e.filename.replace(rootPath, '') : 'unknown'}:${e.lineno}:${e.colno} | ${e.message}`;
        if (background && background.collectedErrors) {
            let existing = background.collectedErrors.find(item => item === message);
            if (!existing) {
                background.collectedErrors.push(message);
            }
        }
    });
    window.addEventListener('unhandledrejection', (e) => {
        let message = `Unhandled rejection in ${window.location.href.replace(rootPath, '')} | ${e.reason}`;
        if (background && background.collectedErrors) {
            let existing = background.collectedErrors.find(item => item === message);
            if (!existing) {
                background.collectedErrors.push(message);
            }
        }
    });
})();