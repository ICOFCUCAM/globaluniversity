<?php
/**
 * Flex Multi Business Theme Customizer
 *
 * @subpackage flex-multi-business
 * @since 1.0 
 */
/**
 * Add postMessage support for site title and description for the Theme Customizer.
 *
 * @param WP_Customize_Manager $wp_customize Theme Customizer object.
 */
function flex_multi_business_customize_register( $wp_customize ) {
	$wp_customize->get_setting( 'blogname' )->transport         = 'postMessage';
	$wp_customize->get_setting( 'blogdescription' )->transport  = 'postMessage';

	if ( isset( $wp_customize->selective_refresh ) ) {
		$wp_customize->selective_refresh->add_partial( 'blogname', array(
			'selector'        => '.site-title a',
			'render_callback' => 'flex_multi_business_customize_partial_blogname',
		) );
		$wp_customize->selective_refresh->add_partial( 'blogdescription', array(
			'selector'        => '.site-description',
			'render_callback' => 'flex_multi_business_customize_partial_blogdescription',
		) );
	}

	$wp_customize->add_section('flex_multi_business_header_section', array(
        'title'       => __('Header Section', 'flex-multi-business'),
        'priority'    => 30,
    ));

    // Add a Setting
    $wp_customize->add_setting('flex_multi_business_display_phone_number', array(
        'default'           => '',
        'sanitize_callback' => 'sanitize_text_field',
    ));

    // Add a Control (Text Field)
    $wp_customize->add_control('flex_multi_business_display_phone_number', array(
        'label'    => __('Enter Phone Number', 'flex-multi-business'),
        'section'  => 'flex_multi_business_header_section',
        'settings' => 'flex_multi_business_display_phone_number',
        'type'     => 'text',
    ));

}
add_action( 'customize_register', 'flex_multi_business_customize_register' );

/**
 * Render the site title for the selective refresh partial.
 *
 * @return void
 */

function flex_multi_business_customize_partial_blogname() {
	bloginfo( 'name' );
}

/**
 * Render the site tagline for the selective refresh partial.
 *
 * @return void
 */
function flex_multi_business_customize_partial_blogdescription() {
	bloginfo( 'description' );
}