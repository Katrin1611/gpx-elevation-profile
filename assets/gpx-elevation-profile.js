/**
 * GPX Elevation Profile – Frontend Script  v1.1
 * Depends on: Leaflet, Chart.js
 */
(function () {
    'use strict';

    /* ── GPX Parser ─────────────────────────────────────────── */
    function parseGPX(xmlText) {
        const parser = new DOMParser();
        const xml = parser.parseFromString(xmlText, 'application/xml');

        if (xml.querySelector('parsererror')) {
            throw new Error('GPX-Datei konnte nicht geparst werden.');
        }

        const trkpts = xml.querySelectorAll('trkpt');
        const wpts   = xml.querySelectorAll('wpt');

        if (!trkpts.length) {
            throw new Error('Keine Track-Punkte (trkpt) in der GPX-Datei gefunden.');
        }

        const points = Array.from(trkpts).map(pt => ({
            lat:  parseFloat(pt.getAttribute('lat')),
            lon:  parseFloat(pt.getAttribute('lon')),
            ele:  parseFloat(pt.querySelector('ele')?.textContent || '0'),
            time: pt.querySelector('time')?.textContent || null,
        }));

        const waypoints = Array.from(wpts).map(w => ({
            lat:  parseFloat(w.getAttribute('lat')),
            lon:  parseFloat(w.getAttribute('lon')),
            name: w.querySelector('name')?.textContent || '',
        }));

        const name = xml.querySelector('trk > name')?.textContent
            || xml.querySelector('metadata > name')?.textContent
            || 'GPX-Route';

        // Extract date from the first point that has a timestamp
        const firstTime = points.find(p => p.time)?.time || null;
        const trackDate = firstTime
            ? new Date(firstTime).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })
            : null;

        return { points, waypoints, name, trackDate };
    }

    /* ── Haversine ───────────────────────────────────────────── */
    function haversine(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2
            + Math.cos(lat1 * Math.PI / 180)
            * Math.cos(lat2 * Math.PI / 180)
            * Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    /* ── Distanzbasierte Ausdünnung (Decimation) ────────────── */
    // Bei 1-Sekunden-Tracks entstehen tausende Punkte. GPS-Höhenwerte
    // rauschen typisch ±2–5 m; bei so vielen Punkten summiert sich das
    // trotz Hysterese noch zu stark. Wir behalten nur einen Punkt pro
    // MIN_DIST_M Meter – das entspricht ca. einem Punkt alle 10–15 s
    // bei Wandergeschwindigkeit und gibt der Hysterese danach saubere Werte.
    function decimateByDistance(points, minDistM) {
        if (points.length < 2) return points;
        const minDistKm = minDistM / 1000;
        const result = [points[0]];
        let last = points[0];
        for (let i = 1; i < points.length; i++) {
            const d = haversine(last.lat, last.lon, points[i].lat, points[i].lon);
            if (d >= minDistKm) {
                result.push(points[i]);
                last = points[i];
            }
        }
        if (result[result.length - 1] !== points[points.length - 1]) {
            result.push(points[points.length - 1]);
        }
        return result;
    }

    /* ── Statistiken berechnen ───────────────────────────────── */
    function computeStats(points, units) {
        let totalDist = 0;
        let ascent  = 0;
        let descent = 0;
        const distances = [0];

        // Punkte ohne gültige Höhe (ele = 0 oder NaN) herausfiltern.
        // Viele GPX-Recorder schreiben ele="0" wenn kein Signal vorlag –
        // das würde Min-Höhe und Auf-/Abstieg massiv verfälschen.
        const validPoints = points.filter(p => p.ele !== 0 && !isNaN(p.ele));
        const eleSource   = validPoints.length >= 2 ? validPoints : points;

        // Schritt 1: Ausdünnen auf 50 m Abstand für die Höhenstatistik.
        // Bei 1-Sekunden-Tracks (≈1–2 m/Punkt) bleiben so ~1 Punkt / 30–60 s
        // übrig – genug Auflösung für echte Steigungen, aber kein Rauschen mehr.
        const thinned = decimateByDistance(eleSource, 50);

        // Schritt 2: Hysterese – nur Änderungen > 15 m zählen.
        // Nach der Ausdünnung sind Rauschspitzen weitgehend weg; 15 m fangen
        // verbliebene GPS-Sprünge (Tunnels, Brücken, schlechter Empfang) ab.
        const THRESHOLD = 15;
        let refEle = thinned[0].ele;

        for (let i = 1; i < thinned.length; i++) {
            const diff = thinned[i].ele - refEle;
            if (diff > THRESHOLD) {
                ascent  += diff;
                refEle   = thinned[i].ele;
            } else if (diff < -THRESHOLD) {
                descent -= diff;
                refEle   = thinned[i].ele;
            }
        }

        // Schritt 3: Distanz + Chart-Daten aus Original-Punkten (volle Auflösung).
        for (let i = 1; i < points.length; i++) {
            totalDist += haversine(
                points[i-1].lat, points[i-1].lon,
                points[i].lat,   points[i].lon
            );
            distances.push(totalDist);
        }

        // Min/Max nur aus Punkten mit gültiger Höhe berechnen.
        const elevations = points.map(p => p.ele);
        const validEles  = eleSource.map(p => p.ele);
        const maxEle     = Math.max(...validEles);
        const minEle     = Math.min(...validEles);

        if (units === 'imperial') {
            const mi = d => +(d * 0.621371).toFixed(3);
            const ft = m => Math.round(m * 3.28084);
            return {
                distance: (totalDist * 0.621371).toFixed(2), distUnit: 'mi',
                ascent: ft(ascent), descent: ft(descent), eleUnit: 'ft',
                maxEle: ft(maxEle), minEle: ft(minEle),
                distances: distances.map(mi),
                elevations: elevations.map(e => +(e * 3.28084).toFixed(1)),
            };
        }

        return {
            distance: totalDist.toFixed(2), distUnit: 'km',
            ascent: Math.round(ascent), descent: Math.round(descent), eleUnit: 'm',
            maxEle: Math.round(maxEle), minEle: Math.round(minEle),
            distances,
            elevations,
        };
    }

    /* ── Glättung (Moving Average) ───────────────────────────── */
    function smooth(arr, w = 7) {
        const half = Math.floor(w / 2);
        return arr.map((_, i) => {
            const slice = arr.slice(Math.max(0, i - half), Math.min(arr.length, i + half + 1));
            return slice.reduce((s, v) => s + v, 0) / slice.length;
        });
    }

    /* ── Theme-Farben ermitteln ──────────────────────────────── */
    function getThemeColors(theme) {
        if (theme === 'light') {
            return {
                tickColor:    '#6b7280',
                gridColor:    'rgba(0,0,0,0.06)',
                tooltipBg:    '#ffffff',
                tooltipBorder:'rgba(0,0,0,0.09)',
                tooltipColor: '#1a1d27',
            };
        }
        return {
            tickColor:    '#6b7280',
            gridColor:    'rgba(255,255,255,0.05)',
            tooltipBg:    '#1a1d27',
            tooltipBorder:'rgba(255,255,255,0.08)',
            tooltipColor: '#e8eaf0',
        };
    }

    /* ── HTML-Skeleton rendern ───────────────────────────────── */
    function buildSkeleton(wrapper, stats, name, showMap, showStats, trackDate) {
        // Akzentfarbe als CSS-Variable setzen (wrapper selbst wird nicht verändert)
        wrapper.style.setProperty('--ep-accent', wrapper.dataset.color || '#2ecc71');

        const height = parseInt(wrapper.dataset.height, 10) || 200;

        const mapHTML = showMap
            ? `<div class="gpx-ep-map" id="${wrapper.id}-map"></div>`
            : '';

        const statsHTML = showStats ? `<div class="gpx-ep-stats">
                <div class="gpx-ep-stat">
                    <div class="gpx-ep-stat-label">Strecke</div>
                    <div class="gpx-ep-stat-value gpx-ep-stat-accent">${stats.distance}<span>${stats.distUnit}</span></div>
                </div>
                <div class="gpx-ep-stat">
                    <div class="gpx-ep-stat-label">↑ Aufstieg</div>
                    <div class="gpx-ep-stat-value">${stats.ascent}<span>${stats.eleUnit}</span></div>
                </div>
                <div class="gpx-ep-stat">
                    <div class="gpx-ep-stat-label">↓ Abstieg</div>
                    <div class="gpx-ep-stat-value">${stats.descent}<span>${stats.eleUnit}</span></div>
                </div>
                <div class="gpx-ep-stat">
                    <div class="gpx-ep-stat-label">Max. Höhe</div>
                    <div class="gpx-ep-stat-value">${stats.maxEle}<span>${stats.eleUnit}</span></div>
                </div>
                <div class="gpx-ep-stat">
                    <div class="gpx-ep-stat-label">Min. Höhe</div>
                    <div class="gpx-ep-stat-value">${stats.minEle}<span>${stats.eleUnit}</span></div>
                </div>
            </div>` : '';

        // WICHTIG: Nur innerHTML des Wrappers füllen – Klassen und data-Attribute
        // am wrapper-Element selbst bleiben unangetastet.
        wrapper.innerHTML = `
            ${statsHTML}
            ${mapHTML}
            <div class="gpx-ep-chart-area">
                <div class="gpx-ep-chart-title">Höhenprofil</div>
                <div class="gpx-ep-chart-wrap">
                    <canvas class="gpx-ep-canvas" height="${height}"></canvas>
                    <div class="gpx-ep-tooltip" id="${wrapper.id}-tooltip"></div>
                </div>
            </div>
            <div class="gpx-ep-footer">
                <span>${escHtml(name)}${trackDate ? ' &nbsp;·&nbsp; ' + escHtml(trackDate) : ''}</span>
                <span>GPX Elevation Profile</span>
            </div>`;
    }

    /* ── Leaflet-Karte ───────────────────────────────────────── */
    function initMap(wrapper, points, waypoints, accent) {
        const mapEl = wrapper.querySelector('.gpx-ep-map');
        if (!mapEl || typeof L === 'undefined') return null;

        const tileUrl = window.gpxEpOptions?.mapTile
            || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

        const map = L.map(mapEl, { zoomControl: true, scrollWheelZoom: false });
        L.tileLayer(tileUrl, {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 19,
        }).addTo(map);

        const latlngs = points.map(p => [p.lat, p.lon]);
        const poly = L.polyline(latlngs, { color: accent, weight: 3.5, opacity: 0.9 }).addTo(map);
        map.fitBounds(poly.getBounds(), { padding: [20, 20] });

        const dot = s => `<div style="width:10px;height:10px;border-radius:50%;background:${s};border:2px solid #fff;box-shadow:0 0 6px rgba(0,0,0,.5)"></div>`;
        const mkIcon = s => L.divIcon({ className: '', html: dot(s), iconSize: [10,10], iconAnchor: [5,5] });

        if (latlngs.length) {
            L.marker(latlngs[0],                  { icon: mkIcon(accent),    title: 'Start' }).addTo(map);
            L.marker(latlngs[latlngs.length - 1], { icon: mkIcon('#e74c3c'), title: 'Ende'  }).addTo(map);
        }

        waypoints.forEach(w => {
            L.circleMarker([w.lat, w.lon], { radius: 5, color: '#fff', fillColor: accent, fillOpacity: 1, weight: 1.5 })
                .bindPopup(escHtml(w.name)).addTo(map);
        });

        const hoverIcon   = L.divIcon({ className: 'gpx-ep-marker-dot', iconSize: [12,12], iconAnchor: [6,6] });
        const hoverMarker = L.marker(latlngs[0], { icon: hoverIcon, interactive: false }).addTo(map);
        hoverMarker.setOpacity(0);

        return { map, hoverMarker, latlngs };
    }

    /* ── Chart.js-Diagramm ───────────────────────────────────── */
    function initChart(wrapper, stats, mapObj) {
        const theme   = wrapper.dataset.theme || 'dark';   // aus data-theme lesen
        const accent  = wrapper.dataset.color || '#2ecc71';
        const colors  = getThemeColors(theme);

        const canvas    = wrapper.querySelector('canvas.gpx-ep-canvas');
        const tooltipEl = wrapper.querySelector('.gpx-ep-tooltip');

        const smoothed = smooth(stats.elevations, 7);
        const ctx      = canvas.getContext('2d');

        const grad = ctx.createLinearGradient(0, 0, 0, canvas.offsetHeight || 200);
        grad.addColorStop(0,   hexToRgba(accent, 0.45));
        grad.addColorStop(0.7, hexToRgba(accent, 0.05));
        grad.addColorStop(1,   hexToRgba(accent, 0));

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: stats.distances,
                datasets: [{
                    data: smoothed,
                    borderColor: accent,
                    borderWidth: 2,
                    backgroundColor: grad,
                    pointRadius: 0,
                    tension: 0.4,
                    fill: true,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 800, easing: 'easeOutQuart' },
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend:  { display: false },
                    tooltip: { enabled: false },
                },
                scales: {
                    x: {
                        type: 'linear',
                        ticks: {
                            color: colors.tickColor,
                            font: { family: "'DM Mono', monospace", size: 10 },
                            maxTicksLimit: 8,
                            callback: v => `${v.toFixed(1)} ${stats.distUnit}`,
                        },
                        grid: { color: colors.gridColor },
                    },
                    y: {
                        ticks: {
                            color: colors.tickColor,
                            font: { family: "'DM Mono', monospace", size: 10 },
                            callback: v => `${Math.round(v)} ${stats.eleUnit}`,
                        },
                        grid: { color: colors.gridColor },
                    },
                },
                onHover: (evt, elements) => {
                    if (!elements.length) {
                        tooltipEl.style.display = 'none';
                        if (mapObj) mapObj.hoverMarker.setOpacity(0);
                        return;
                    }
                    const idx   = elements[0].index;
                    const dist  = stats.distances[idx];
                    const ele   = stats.elevations[idx];
                    const slope = idx > 0
                        ? ((stats.elevations[idx] - stats.elevations[idx-1])
                           / ((stats.distances[idx] - stats.distances[idx-1]) * 1000) * 100).toFixed(1)
                        : '0.0';

                    // Tooltip-Styles aus Theme-Farben setzen
                    Object.assign(tooltipEl.style, {
                        background:   colors.tooltipBg,
                        borderColor:  colors.tooltipBorder,
                        color:        colors.tooltipColor,
                        display:      'block',
                    });
                    tooltipEl.innerHTML = `<b>${Math.round(ele)} ${stats.eleUnit}</b> &nbsp;·&nbsp; ${dist.toFixed(2)} ${stats.distUnit} &nbsp;·&nbsp; ${slope}%`;

                    const rect = canvas.getBoundingClientRect();
                    tooltipEl.style.left = (evt.native.clientX - rect.left) + 'px';
                    tooltipEl.style.top  = (evt.native.clientY - rect.top)  + 'px';

                    if (mapObj && mapObj.latlngs[idx]) {
                        mapObj.hoverMarker.setLatLng(mapObj.latlngs[idx]);
                        mapObj.hoverMarker.setOpacity(1);
                    }
                },
            },
        });

        canvas.addEventListener('mouseleave', () => {
            tooltipEl.style.display = 'none';
            if (mapObj) mapObj.hoverMarker.setOpacity(0);
        });
    }

    /* ── Hilfsfunktionen ─────────────────────────────────────── */
    function hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1,3), 16);
        const g = parseInt(hex.slice(3,5), 16);
        const b = parseInt(hex.slice(5,7), 16);
        return `rgba(${r},${g},${b},${alpha})`;
    }

    function escHtml(str) {
        return String(str).replace(/[&<>"']/g, m =>
            ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m])
        );
    }

    /* ── Widget initialisieren ───────────────────────────────── */
    async function initWidget(wrapper) {
        const fileUrl = wrapper.dataset.file;
        const units   = wrapper.dataset.units || 'metric';
        const showMap   = wrapper.dataset.map   !== 'false';
        const showStats = wrapper.dataset.stats !== 'false';
        const accent  = wrapper.dataset.color || '#2ecc71';

        try {
            const res = await fetch(fileUrl);
            if (!res.ok) throw new Error(`HTTP ${res.status} – Datei konnte nicht geladen werden.`);
            const xmlText = await res.text();

            const { points, waypoints, name, trackDate } = parseGPX(xmlText);
            const stats = computeStats(points, units);

            // Skeleton rendern (wrapper.innerHTML wird ersetzt,
            // aber wrapper.className und wrapper.dataset bleiben erhalten)
            buildSkeleton(wrapper, stats, name, showMap, showStats, trackDate);

            let mapObj = null;
            if (showMap && typeof L !== 'undefined') {
                mapObj = initMap(wrapper, points, waypoints, accent);
            }

            // requestAnimationFrame: Canvas hat dann seine endgültige Größe
            requestAnimationFrame(() => initChart(wrapper, stats, mapObj));

        } catch (err) {
            wrapper.innerHTML = `<div class="gpx-ep-error">⚠ ${escHtml(err.message)}</div>`;
            console.error('[GPX Elevation Profile]', err);
        }
    }

    /* ── Bootstrap ───────────────────────────────────────────── */
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.gpx-ep-wrapper').forEach(initWidget);
    });

})();
