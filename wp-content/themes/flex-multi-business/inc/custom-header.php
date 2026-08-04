<?php
/**
 * Sample implementation of the Custom Header feature
 *
 * You can add an optional custom header image to header.php like so ...
 *
	<?php the_header_image_tag(); ?>
 *
 * @link https://developer.wordpress.org/themes/functionality/custom-headers/
 *
 * @package flex-multi-business
 */

/**
 * Set up the WordPress core custom header feature.
 *
 * @uses flex_multi_business_header_style()
 */
function flex_multi_business_custom_header_setup() {
	add_theme_support(
		'custom-header',
		apply_filters(
			'flex_multi_business_custom_header_args',
			array(
				'default-image'      => '',
				'default-text-color' => '000000',
				'width'              => 1000,
				'height'             => 250,
				'flex-height'        => true,
				'wp-head-callback'   => 'flex_multi_business_header_style',
			)
		)
	);
}
add_action( 'after_setup_theme', 'flex_multi_business_custom_header_setup' );

if ( ! function_exists( 'flex_multi_business_header_style' ) ) :
	/**
	 * Styles the header image and text displayed on the blog
	 *
	 * @see flex_multi_business_custom_header_setup().
	 */
	add_action( 'wp_enqueue_scripts', 'flex_multi_business_header_style' );
	
	function flex_multi_business_header_style() {
		$flex_multi_business_header_image = get_header_image() ? get_header_image() : get_template_directory_uri() . '/assets/img/header-img.png';
		$flex_multi_business_custom_css = "
			.box-image .single-page-img{
				background-image: url('" . esc_url($flex_multi_business_header_image) . "');
				background-repeat: no-repeat;
				background-position: center center;
				background-size: cover !important;
				height: 300px;
			}";
			   wp_add_inline_style( 'flex-multi-business-style', $flex_multi_business_custom_css );
	}
	endif;