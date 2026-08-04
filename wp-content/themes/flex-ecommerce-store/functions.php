<?php
/**
 * flex-ecommerce-store functions and definitions
 *
 * @link https://developer.wordpress.org/themes/basics/theme-functions/
 *
 * @package flex-ecommerce-store
 */

if ( ! function_exists( 'flex_ecommerce_store_setup' ) ) :
	/**
	 * Sets up theme defaults and registers support for various WordPress features.
	 *
	 * Note that this function is hooked into the after_setup_theme hook, which
	 * runs before the init hook. The init hook is too late for some features, such
	 * as indicating support for post thumbnails.
	 */
	function flex_ecommerce_store_setup() {

		// Add default posts and comments RSS feed links to head.
		add_theme_support( 'automatic-feed-links' );

		/*
		 * Let WordPress manage the document title.
		 * By adding theme support, we declare that this theme does not use a
		 * hard-coded <title> tag in the document head, and expect WordPress to
		 * provide it for us.
		 */
		add_theme_support( 'title-tag' );

		/*
		 * Enable support for Post Thumbnails on posts and pages.
		 *
		 * @link https://developer.wordpress.org/themes/functionality/featured-images-post-thumbnails/
		 */
		add_theme_support( 'post-thumbnails' );

		// This theme uses wp_nav_menu() in one location.
		register_nav_menus(
			array(
				'primary-menu' => esc_html__( 'Primary Menu', 'flex-ecommerce-store' ),
				'footer-menu' => esc_html__( 'Footer Menu', 'flex-ecommerce-store' ),
			)
		);

		/*
		 * Switch default core markup for search form, comment form, and comments
		 * to output valid HTML5.
		 */
		add_theme_support(
			'html5',
			array(
				'search-form',
				'comment-form',
				'comment-list',
				'gallery',
				'caption',
				'style',
				'script',
			)
		);

		// Set up the WordPress core custom background feature.
		add_theme_support(
			'custom-background',
			apply_filters(
				'flex_ecommerce_store_custom_background_args',
				array(
					'default-color' => 'ffffff',
					'default-image' => '',
				)
			)
		);

		// Add theme support for selective refresh for widgets.
		add_theme_support( 'customize-selective-refresh-widgets' );

		/**
		 * Add support for core custom logo.
		 *
		 * @link https://codex.wordpress.org/Theme_Logo
		 */
		add_theme_support(
			'custom-logo',
			array(
				'height'      => 250,
				'width'       => 250,
				'flex-width'  => true,
				'flex-height' => true,
			)
		);
	}
endif;
add_action( 'after_setup_theme', 'flex_ecommerce_store_setup' );

/**
 * Set the content width in pixels, based on the theme's design and stylesheet.
 *
 * Priority 0 to make it available to lower priority callbacks.
 *
 * @global int $content_width
 */
function flex_ecommerce_store_content_width() {
	$GLOBALS['content_width'] = apply_filters( 'flex_ecommerce_store_content_width', 640 );

}
add_action( 'after_setup_theme', 'flex_ecommerce_store_content_width', 0 );

/**
 * Register widget area.
 *
 * @link https://developer.wordpress.org/themes/functionality/sidebars/#registering-a-sidebar
 */
function flex_ecommerce_store_widgets_init() {
	register_sidebar(
		array(
			'name'          => esc_html__( 'Sidebar', 'flex-ecommerce-store' ),
			'id'            => 'main-sidebar',
			'description'   => esc_html__( 'Add widgets here.', 'flex-ecommerce-store' ),
			'before_widget' => '<section id="%1$s" class="widget %2$s">',
			'after_widget'  => '</section>',
			'before_title'  => '<h2 class="widget-title">',
			'after_title'   => '</h2>',
		)
	);

	register_sidebar(
		array(
			'name'          => esc_html__( 'Footer Widgets', 'flex-ecommerce-store' ),
			'id'            => 'footer-widgets',
			'description'   => esc_html__( 'Add widgets here.', 'flex-ecommerce-store' ),
			'before_widget' => '<div class="%2$s footer-widget col-md-3 col-sm-6 col-xs-12">',
			'after_widget'  => '</div>',
			'before_title'  => '<h2 class="widget-title">',
			'after_title'   => '</h2>',
		)
	);

	if ( class_exists( 'WooCommerce' ) ) {
		register_sidebar(
		array(
			'name'          => esc_html__( 'WooCommerce Sidebar', 'flex-ecommerce-store' ),
			'id'            => 'woocommerce-widgets',
			'description'   => esc_html__( 'Add widgets here.', 'flex-ecommerce-store' ),
			'before_widget' => '<section id="%1$s" class="widget %2$s">',
			'after_widget'  => '</section>',
			'before_title'  => '<h2 class="widget-title">',
			'after_title'   => '</h2>',
		)
	);
	}
}
add_action( 'widgets_init', 'flex_ecommerce_store_widgets_init' );

/**
 * Enqueue scripts and styles.
 */
function flex_ecommerce_store_scripts() {

    $parent_style = 'flex-multi-business-style'; // Style handle of parent theme.

   	wp_enqueue_style('bootstrap', get_template_directory_uri() . '/assets/css/bootstrap.css');
   	
	wp_enqueue_style( $parent_style, get_template_directory_uri() . '/style.css' );
	wp_enqueue_style( 'flex-ecommerce-store-style', get_stylesheet_uri(), array( $parent_style ) );
	wp_enqueue_script( 'flex-ecommerce-store-custom-scripts-jquery', get_theme_file_uri() . '/assets/js/custom.js', array('jquery'),'' ,true );
	wp_enqueue_style( 'slick-style',get_template_directory_uri().'/assets/css/slick.css' );
	wp_enqueue_script( 'slick-js',get_template_directory_uri(). '/assets/js/slick.js', array('jquery') ,'',true);

}
add_action( 'wp_enqueue_scripts', 'flex_ecommerce_store_scripts' );


function flex_ecommerce_store_customize_register() {
	global $wp_customize;
	$wp_customize->remove_setting( 'flex_multi_business_display_phone_number' );
	$wp_customize->remove_control( 'flex_multi_business_display_phone_number' );
  }
  add_action( 'customize_register', 'flex_ecommerce_store_customize_register',11 );