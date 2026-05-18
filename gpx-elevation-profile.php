<?php
/**
 * Plugin Name:       GPX Elevation Profile
 * Plugin URI:        https://github.com/your-username/gpx-elevation-profile
 * Description:       Zeigt GPX-Dateien als interaktives Höhenprofil mit Karte an. Shortcode: [gpx_elevation file="datei.gpx"]
 * Version:           1.3.0
 * Author:            Your Name
 * License:           GPL-2.0+
 * Text Domain:       gpx-elevation-profile
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'GPX_EP_VERSION', '1.3.0' );
define( 'GPX_EP_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'GPX_EP_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

class GPX_Elevation_Profile {

    public function __construct() {
        add_action( 'init', [ $this, 'register_shortcode' ] );
        add_action( 'wp_enqueue_scripts', [ $this, 'enqueue_assets' ] );
        add_action( 'admin_menu', [ $this, 'add_admin_menu' ] );
        add_action( 'admin_init', [ $this, 'register_settings' ] );
        add_filter( 'upload_mimes', [ $this, 'allow_gpx_upload' ] );
        add_action( 'rest_api_init', [ $this, 'register_rest_route' ] );
    }

    public function allow_gpx_upload( $mimes ) {
        $mimes['gpx'] = 'application/gpx+xml';
        return $mimes;
    }

    public function register_shortcode() {
        add_shortcode( 'gpx_elevation', [ $this, 'render_shortcode' ] );
    }

    /**
     * Shortcode rendern
     *
     * [gpx_elevation file="tour.gpx"]
     * [gpx_elevation file="tour.gpx" theme="light" color="#0ea5e9" height="500" units="metric" map="true"]
     */
    public function render_shortcode( $atts ) {
        $atts = shortcode_atts( [
            'file'   => '',
            'height' => '450',
            'color'  => get_option( 'gpx_ep_default_color', '#2ecc71' ),
            'units'  => get_option( 'gpx_ep_default_units', 'metric' ),
            'map'    => 'true',
            'stats'  => 'true',
            'theme'  => 'dark',   // dark | light  –  nur per Shortcode steuerbar
        ], $atts, 'gpx_elevation' );

        // Sicherheitscheck: nur erlaubte Theme-Werte
        $theme = ( $atts['theme'] === 'light' ) ? 'light' : 'dark';

        if ( empty( $atts['file'] ) ) {
            return '<p style="color:red;">[GPX Elevation Profile] Bitte eine GPX-Datei angeben.</p>';
        }

        $file_url = $this->resolve_file_url( $atts['file'] );
        if ( ! $file_url ) {
            return '<p style="color:red;">[GPX Elevation Profile] Datei nicht gefunden: ' . esc_html( $atts['file'] ) . '</p>';
        }

        $instance_id = 'gpx-ep-' . uniqid();

        // Theme-Klasse direkt in die CSS-Klassen-Liste aufnehmen –
        // so bleibt sie auch nach dem innerHTML-Update des JS erhalten,
        // weil das JS die Klassen am wrapper-Element selbst nie anfasst.
        $css_classes = 'gpx-ep-wrapper gpx-ep-theme-' . $theme;

        ob_start();
        ?>
        <div class="<?php echo esc_attr( $css_classes ); ?>"
             id="<?php echo esc_attr( $instance_id ); ?>"
             data-file="<?php echo esc_url( $file_url ); ?>"
             data-height="<?php echo esc_attr( $atts['height'] ); ?>"
             data-color="<?php echo esc_attr( $atts['color'] ); ?>"
             data-units="<?php echo esc_attr( $atts['units'] ); ?>"
             data-map="<?php echo esc_attr( $atts['map'] ); ?>"
             data-stats="<?php echo esc_attr( $atts['stats'] ); ?>"
             data-theme="<?php echo esc_attr( $theme ); ?>">
            <div class="gpx-ep-loading">
                <div class="gpx-ep-spinner"></div>
                <span>GPX-Route wird geladen …</span>
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    private function resolve_file_url( $file ) {
        if ( filter_var( $file, FILTER_VALIDATE_URL ) ) {
            return $file;
        }
        $upload_dir = wp_upload_dir();
        $found = $this->find_file_in_uploads( $file, $upload_dir['basedir'] );
        if ( $found ) {
            return str_replace( $upload_dir['basedir'], $upload_dir['baseurl'], $found );
        }
        $plugin_gpx = GPX_EP_PLUGIN_DIR . 'gpx/' . $file;
        if ( file_exists( $plugin_gpx ) ) {
            return GPX_EP_PLUGIN_URL . 'gpx/' . $file;
        }
        return false;
    }

    private function find_file_in_uploads( $filename, $dir ) {
        $target = trailingslashit( $dir ) . $filename;
        if ( file_exists( $target ) ) {
            return $target;
        }
        foreach ( glob( $dir . '/*/*/' . $filename ) as $match ) {
            return $match;
        }
        return false;
    }

    public function enqueue_assets() {
        global $post;
        if ( is_a( $post, 'WP_Post' ) && has_shortcode( $post->post_content, 'gpx_elevation' ) ) {
            wp_enqueue_style(  'leaflet',       'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', [], '1.9.4' );
            wp_enqueue_script( 'leaflet',       'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',  [], '1.9.4', true );
            wp_enqueue_script( 'chartjs',       'https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js', [], '4.4.2', true );
            wp_enqueue_style(  'gpx-ep-style',  GPX_EP_PLUGIN_URL . 'assets/gpx-elevation-profile.css', [], GPX_EP_VERSION );
            wp_enqueue_script( 'gpx-ep-script', GPX_EP_PLUGIN_URL . 'assets/gpx-elevation-profile.js',  [ 'leaflet', 'chartjs' ], GPX_EP_VERSION, true );
        }
    }

    public function add_admin_menu() {
        add_options_page(
            'GPX Elevation Profile',
            'GPX Elevation',
            'manage_options',
            'gpx-elevation-profile',
            [ $this, 'render_admin_page' ]
        );
    }

    public function register_settings() {
        register_setting( 'gpx_ep_settings', 'gpx_ep_map_tile' );
        register_setting( 'gpx_ep_settings', 'gpx_ep_default_color' );
        register_setting( 'gpx_ep_settings', 'gpx_ep_default_units' );
    }

    public function render_admin_page() {
        ?>
        <div class="wrap">
            <h1>GPX Elevation Profile – Einstellungen</h1>
            <form method="post" action="options.php">
                <?php settings_fields( 'gpx_ep_settings' ); ?>
                <table class="form-table">
                    <tr>
                        <th>Standard-Farbe</th>
                        <td><input type="color" name="gpx_ep_default_color"
                                   value="<?php echo esc_attr( get_option( 'gpx_ep_default_color', '#2ecc71' ) ); ?>"></td>
                    </tr>
                    <tr>
                        <th>Einheiten</th>
                        <td>
                            <select name="gpx_ep_default_units">
                                <option value="metric"   <?php selected( get_option( 'gpx_ep_default_units', 'metric' ), 'metric' ); ?>>Metrisch (km/m)</option>
                                <option value="imperial" <?php selected( get_option( 'gpx_ep_default_units', 'metric' ), 'imperial' ); ?>>Imperial (mi/ft)</option>
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <th>Map-Tile-URL</th>
                        <td>
                            <input type="text" name="gpx_ep_map_tile" style="width:100%"
                                   value="<?php echo esc_attr( get_option( 'gpx_ep_map_tile', 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' ) ); ?>">
                            <p class="description">Standard: OpenStreetMap. Outdoor-Beispiel: <code>https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png</code></p>
                        </td>
                    </tr>
                </table>
                <?php submit_button(); ?>
            </form>

            <hr>
            <h2>Verwendung</h2>
            <pre style="background:#f0f0f0;padding:16px;border-radius:6px;overflow-x:auto;">[gpx_elevation file="meine-tour.gpx"]
[gpx_elevation file="meine-tour.gpx" theme="light"]
[gpx_elevation file="meine-tour.gpx" theme="light" color="#0ea5e9" height="500"]
[gpx_elevation file="meine-tour.gpx" units="imperial" map="false"]
[gpx_elevation file="https://example.com/route.gpx"]</pre>

            <h3>Alle Parameter</h3>
            <table class="widefat striped" style="max-width:700px">
                <thead><tr><th>Parameter</th><th>Standard</th><th>Beschreibung</th></tr></thead>
                <tbody>
                    <tr><td><code>file</code></td><td>–</td><td>Dateiname aus der Mediathek oder absolute URL (Pflicht)</td></tr>
                    <tr><td><code>theme</code></td><td>dark</td><td><code>dark</code> oder <code>light</code></td></tr>
                    <tr><td><code>color</code></td><td>#2ecc71</td><td>Akzentfarbe als Hex-Wert</td></tr>
                    <tr><td><code>height</code></td><td>450</td><td>Höhe des Diagramms in Pixeln</td></tr>
                    <tr><td><code>units</code></td><td>metric</td><td><code>metric</code> (km/m) oder <code>imperial</code> (mi/ft)</td></tr>
                    <tr><td><code>map</code></td><td>true</td><td><code>false</code> blendet die Karte aus</td></tr>
                    <tr><td><code>stats</code></td><td>true</td><td><code>false</code> blendet die Statistik-Leiste aus</td></tr>
                </tbody>
            </table>
            <p style="margin-top:16px">GPX-Dateien über <strong>Medien → Datei hinzufügen</strong> hochladen, dann den Dateinamen im Shortcode verwenden.</p>
        </div>
        <?php
    }

    public function register_rest_route() {
        register_rest_route( 'gpx-ep/v1', '/fetch', [
            'methods'             => 'GET',
            'callback'            => [ $this, 'rest_fetch_gpx' ],
            'permission_callback' => '__return_true',
            'args'                => [
                'url' => [ 'required' => true, 'sanitize_callback' => 'esc_url_raw' ],
            ],
        ] );
    }

    public function rest_fetch_gpx( WP_REST_Request $request ) {
        $url      = $request->get_param( 'url' );
        $response = wp_remote_get( $url, [ 'timeout' => 15 ] );
        if ( is_wp_error( $response ) ) {
            return new WP_REST_Response( [ 'error' => $response->get_error_message() ], 500 );
        }
        $body = wp_remote_retrieve_body( $response );
        return new WP_REST_Response( $body, 200, [ 'Content-Type' => 'application/gpx+xml' ] );
    }
}

new GPX_Elevation_Profile();
