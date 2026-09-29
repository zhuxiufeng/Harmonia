// Lyrics provider using LRCLIB (open-source synced lyrics API)
(function (global) {
    const lyricsCache = new Map();

    function cleanTrackString(str) {
        if (!str || typeof str !== 'string') return '';
        return str
            .replace(/\s*[\(\[][^()\[\]]*(?:remaster|feat|ft|live|version|edit|deluxe|explicit|edition|bonus|mono|stereo)[^()\[\]]*[\)\]]/gi, '')
            .replace(/\s*-\s*(?:remaster|live|deluxe|single|edit|bonus).*$/gi, '')
            .trim();
    }

    function parseLRC(lrcText) {
        if (!lrcText || typeof lrcText !== 'string') return [];
        const lines = lrcText.split(/\r?\n/);
        const result = [];
        const timeReg = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

        for (const line of lines) {
            let match;
            timeReg.lastIndex = 0;
            const matches = [];
            while ((match = timeReg.exec(line)) !== null) {
                const min = parseInt(match[1], 10);
                const sec = parseInt(match[2], 10);
                const ms = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0;
                matches.push(min * 60 + sec + ms / 1000);
            }
            const text = line.replace(timeReg, '').trim();
            if (matches.length > 0 && text) {
                for (const time of matches) {
                    result.push({ time, text });
                }
            }
        }

        return result.sort((a, b) => a.time - b.time);
    }

    async function fetchLyrics(songName, artistName, duration = null) {
        if (!songName || songName === 'Nothing is currently playing.' || songName.startsWith('Playing ') || songName.startsWith('Starting ')) {
            return null;
        }

        const cacheKey = `${songName.toLowerCase()}:::${(artistName || '').toLowerCase()}`;
        if (lyricsCache.has(cacheKey)) {
            return lyricsCache.get(cacheKey);
        }

        const cleanSong = cleanTrackString(songName);
        const cleanArtist = cleanTrackString(artistName);

        try {
            // 1. Try exact match with get endpoint
            let getUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanSong)}&artist_name=${encodeURIComponent(cleanArtist)}`;
            if (duration && duration > 0) {
                getUrl += `&duration=${Math.round(duration)}`;
            }

            let res = await fetch(getUrl);
            if (res.ok) {
                const data = await res.json();
                if (data.syncedLyrics || data.plainLyrics) {
                    const parsed = processLyricsResponse(data);
                    lyricsCache.set(cacheKey, parsed);
                    return parsed;
                }
            }

            // 2. Try search endpoint as fallback
            let searchUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(cleanSong)}&artist_name=${encodeURIComponent(cleanArtist)}`;
            let searchRes = await fetch(searchUrl);
            if (searchRes.ok) {
                const list = await searchRes.json();
                if (Array.isArray(list) && list.length > 0) {
                    // Prefer one with syncedLyrics
                    const best = list.find(item => item.syncedLyrics) || list[0];
                    if (best && (best.syncedLyrics || best.plainLyrics)) {
                        const parsed = processLyricsResponse(best);
                        lyricsCache.set(cacheKey, parsed);
                        return parsed;
                    }
                }
            }
        } catch (err) {
            console.warn('[lyrics.js] Failed to fetch lyrics:', err);
        }

        lyricsCache.set(cacheKey, null);
        return null;
    }

    function processLyricsResponse(data) {
        if (!data) return null;

        if (data.syncedLyrics) {
            const lines = parseLRC(data.syncedLyrics);
            if (lines.length > 0) {
                return {
                    synced: true,
                    lines: lines,
                    raw: data.syncedLyrics,
                    instrumental: Boolean(data.instrumental)
                };
            }
        }

        if (data.plainLyrics) {
            const rawLines = data.plainLyrics.split(/\r?\n/).map(l => l.trim()).filter(l => Boolean(l));
            const lines = rawLines.map((text, i) => ({ time: null, text }));
            return {
                synced: false,
                lines: lines,
                raw: data.plainLyrics,
                instrumental: Boolean(data.instrumental)
            };
        }

        return null;
    }

    function findActiveLyricIndex(lines, currentTime) {
        if (!lines || !lines.length || currentTime === null || currentTime === undefined) {
            return -1;
        }

        // Only works for synced lyrics
        if (lines[0].time === null) {
            return -1;
        }

        let low = 0;
        let high = lines.length - 1;
        let ans = -1;

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (lines[mid].time <= currentTime + 0.25) { // small 250ms lead-in threshold for natural singing flow
                ans = mid;
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        return ans;
    }

    global.LyricsService = {
        fetchLyrics,
        parseLRC,
        findActiveLyricIndex
    };
})(typeof window !== 'undefined' ? window : globalThis);
