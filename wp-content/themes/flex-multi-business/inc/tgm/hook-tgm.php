<?php
/**
 * Recommended plugins
 *
 * @package flex-multi-business
 */

if ( ! function_exists( 'flex_multi_business_recommended_plugins' ) ) :

    /**
     * Recommend plugins.
     *
     * @since 1.0.0
     */
    function flex_multi_business_recommended_plugins() {

        $plugins = array(  

            array(
                'name'     => esc_html__( 'Flex Import', 'flex-multi-business' ),
                'slug'     => 'flex-import',
                'required' => false,
            ),
            array(
                'name'     => esc_html__( 'Elementor Website Builder – More Than Just a Page Builder', 'flex-multi-business' ),
                'slug'     => 'elementor',
                'required' => false,
            ),
            array(
                'name'     => esc_html__( 'ElementsKit Elementor Addons and Templates', 'flex-multi-business' ),
                'slug'     => 'elementskit-lite',
                'required' => false,
            ),
            array(
                'name'     => esc_html__( 'Gtranslate', 'flex-multi-business' ),
                'slug'     => 'gtranslate',
                'required' => false,
            ),            
        );

        tgmpa( $plugins );

    }

endif;

add_action( 'tgmpa_register', 'flex_multi_business_recommended_plugins' );


add_action('wp_ajax_install_and_activate_flex_import_plugin', 'install_and_activate_flex_import_plugin');

function install_and_activate_flex_import_plugin() {
    // Verify nonce for security
    if (!isset($_POST['nonce']) || !wp_verify_nonce($_POST['nonce'], 'install_activate_nonce')) {
        wp_send_json_error(['message' => 'Nonce verification failed.']);
    }

    // Define plugin slugs and file paths
    $flex_multi_business_elementor_slug = 'elementor';
    $flex_multi_business_elementor_file = 'elementor/elementor.php';
    $flex_multi_business_elementor_url  = 'https://downloads.wordpress.org/plugin/elementor.latest-stable.zip';

    $flex_multi_business_flex_importer_slug = 'flex-import';
    $flex_multi_business_flex_importer_file = 'flex-import/flex-import.php';
    $flex_multi_business_flex_importer_url  = 'https://downloads.wordpress.org/plugin/flex-import.latest-stable.zip';

    // Include necessary WordPress files
    include_once ABSPATH . 'wp-admin/includes/plugin.php';
    include_once ABSPATH . 'wp-admin/includes/file.php';
    include_once ABSPATH . 'wp-admin/includes/misc.php';
    include_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
    include_once ABSPATH . 'wp-admin/includes/plugin-install.php';

    $flex_multi_business_upgrader = new Plugin_Upgrader(new Automatic_Upgrader_Skin());

    // Step 1: Install and activate WooCommerce if not active
    if (!is_plugin_active($flex_multi_business_elementor_file)) {
        $flex_multi_business_installed_plugins = get_plugins();

        if (!isset($flex_multi_business_installed_plugins[$flex_multi_business_elementor_file])) {
            // Install WooCommerce
            $flex_multi_business_install_wc = $flex_multi_business_upgrader->install($flex_multi_business_elementor_url);
            if (is_wp_error($flex_multi_business_install_wc)) {
                wp_send_json_error(['message' => 'WooCommerce installation failed.']);
            }
        }

        // Activate WooCommerce
        $flex_multi_business_activate_wc = activate_plugin($flex_multi_business_elementor_file);
        if (is_wp_error($flex_multi_business_activate_wc)) {
            wp_send_json_error(['message' => 'WooCommerce activation failed.', 'error' => $flex_multi_business_activate_wc->get_error_message()]);
        }
    }

    // Step 2: Install and activate Flex Importer plugin
    if (!is_plugin_active($flex_multi_business_flex_importer_file)) {
        $flex_multi_business_installed_plugins = get_plugins();

        if (!isset($flex_multi_business_installed_plugins[$flex_multi_business_flex_importer_file])) {
            // Install Flex Importer plugin
            $flex_multi_business_install_wc_plugin = $flex_multi_business_upgrader->install($flex_multi_business_flex_importer_url);
            if (is_wp_error($flex_multi_business_install_wc_plugin)) {
                wp_send_json_error(['message' => 'Flex Importer plugin installation failed.']);
            }
        }

        // Activate Flex Importer plugin
        $flex_multi_business_activate_wc_plugin = activate_plugin($flex_multi_business_flex_importer_file);
        if (is_wp_error($flex_multi_business_activate_wc_plugin)) {
            wp_send_json_error(['message' => 'Flex Importer plugin activation failed.', 'error' => $flex_multi_business_activate_wc_plugin->get_error_message()]);
        }
    }

    // Success response
    wp_send_json_success(['message' => 'WooCommerce and Flex Importer plugins are activated successfully.']);
}