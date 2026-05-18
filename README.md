# GPX Elevation Profile – WordPress Plugin

Displays GPX files as an **interactive elevation profile with a Leaflet map** in WordPress.

## Installation

1. Copy the `gpx-elevation-profile/` folder to `/wp-content/plugins/`.
2. Activate the plugin in the WordPress admin under **Plugins**.
3. Upload GPX files via **Media → Add New**.

## Usage (Shortcode)

```
[gpx_elevation file="my-tour.gpx"]
```

### All Parameters

| Parameter | Default     | Description                                              |
|-----------|-------------|----------------------------------------------------------|
| `file`    | *(required)*| Filename from the media library or an absolute URL       |
| `height`  | `450`       | Height of the elevation chart in pixels                  |
| `color`   | `#2ecc71`   | Accent color for the track line, markers, and gradient   |
| `units`   | `metric`    | `metric` (km/m) or `imperial` (mi/ft)                   |
| `map`     | `true`      | Set to `false` to hide the map                          |
| `stats`   | `true`      | Set to `false` to hide the statistics bar               |
| `theme`   | `dark`      | `dark` (default) or `light`                             |

### Examples

```
[gpx_elevation file="alpine-tour.gpx"]

[gpx_elevation file="alpine-tour.gpx" theme="light" color="#0ea5e9" height="500"]

[gpx_elevation file="alpine-tour.gpx" stats="false"]

[gpx_elevation file="https://example.com/route.gpx" map="false" units="imperial" theme="light"]
```

## Settings

Go to **Settings → GPX Elevation** to configure default values and the map tile provider.

## Dependencies (loaded automatically)

- **Leaflet 1.9** – interactive map
- **Chart.js 4** – elevation chart
- **OpenStreetMap** – map tiles (free)

## Features

- ✅ GPX track parsing (trkpt, elevation data, timestamps)
- ✅ Waypoints displayed as markers on the map
- ✅ Statistics: distance, ascent, descent, min/max elevation
- ✅ Interactive hover: tooltip + marker moves along the map in sync
- ✅ Metric & imperial units
- ✅ Configurable accent color per widget
- ✅ Responsive layout
- ✅ Dark theme (default) and light theme, selectable per shortcode
- ✅ Statistics bar can be hidden per shortcode

## Changelog

### 1.3.0
- Added `stats` parameter to show/hide the statistics bar

### 1.2.0
- Added `theme` parameter (`dark` / `light`) per shortcode
- Fixed elevation calculation: distance-based decimation + hysteresis filter to prevent inflated ascent/descent values
- Fixed minimum elevation showing 0 when GPX points have missing elevation data

### 1.1.0
- Initial public release
