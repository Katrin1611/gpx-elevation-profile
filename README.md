# GPX Elevation Profile – WordPress Plugin

Zeigt GPX-Dateien als **interaktives Höhenprofil mit Leaflet-Karte** in WordPress an.

## Installation

1. Diesen Ordner (`gpx-elevation-profile/`) in `/wp-content/plugins/` kopieren.
2. Im WordPress-Admin unter **Plugins** das Plugin aktivieren.
3. GPX-Dateien über **Medien → Datei hinzufügen** hochladen.

## Verwendung (Shortcode)

```
[gpx_elevation file="meine-tour.gpx"]
```

### Alle Parameter

| Parameter | Standard      | Beschreibung                           |
|-----------|---------------|----------------------------------------|
| `file`    | *(Pflicht)*   | Dateiname aus dem Media-Upload oder absolute URL |
| `height`  | `450`         | Höhe des Höhenprofil-Charts in Pixel   |
| `color`   | `#2ecc71`     | Akzentfarbe (Linie, Marker, Gradient)  |
| `units`   | `metric`      | `metric` (km/m) oder `imperial` (mi/ft)|
| `map`     | `true`        | `false` = Karte ausblenden             |
| `theme`   | `dark`        | `light` = wechselt zum Light Theme     |

### Beispiele

```
[gpx_elevation file="alpenüberquerung.gpx" height="500" color="#e74c3c" theme="light"]

[gpx_elevation file="https://example.com/tour.gpx" map="false" units="imperial"]
```

## Einstellungen

Unter **Einstellungen → GPX Elevation** können Standard-Werte und der Karten-Tile-Provider konfiguriert werden.

## Abhängigkeiten (werden automatisch geladen)

- **Leaflet 1.9** – interaktive Karte
- **Chart.js 4** – Höhenprofil
- **OpenStreetMap** – Kartenmaterial (kostenfrei)

## Features

- ✅ GPX-Track-Parsing (trkpt, Höhendaten, Zeitstempel)
- ✅ Waypoints als Marker auf der Karte
- ✅ Statistiken: Distanz, Aufstieg, Abstieg, Min/Max-Höhe
- ✅ Interaktiver Hover: Tooltip + Marker bewegt sich auf der Karte mit
- ✅ Metrisch & imperial
- ✅ Konfigurierbare Farbe pro Widget
- ✅ Responsive
- ✅ Dark-Mode-Design, das optional auch zu "Light" geändert werden kann
