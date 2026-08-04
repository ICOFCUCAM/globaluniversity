<?php
/**
 * flex-multi-business functions and definitions
 *
 * @link https://developer.wordpress.org/themes/basics/theme-functions/
 *
 * @package flex-multi-business
 */

/* Breadcrumb Begin */
function flex_multi_business_the_breadcrumb() {
	if (!is_home()) {
		echo '<a href="';
			echo esc_url( home_url() );
		echo '">';
			bloginfo('name');
		echo "</a> >> ";
		if (is_category() || is_single()) {
			the_category('>>');
			if (is_single()) {
				echo ">> <span> ";
					the_title();
				echo "</span> ";
			}
		} elseif (is_page()) {
			echo "<span> ";
				the_title();
		}
	}
}

if ( ! defined( 'FLEX_MULTI_BUSINESS_VERSION' ) ) {
	// Replace the version number of the theme on each release.
	define( 'FLEX_MULTI_BUSINESS_VERSION', '1.3' );
	define( 'FLEX_MULTI_BUSINESS_THEME_DIR', get_template_directory() . '/' );
	define( 'FLEX_MULTI_BUSINESS_THEME_URI', get_template_directory_uri() . '/' );
}

if ( ! function_exists( 'flex_multi_business_setup' ) ) :
	/**
	 * Sets up theme defaults and registers support for various WordPress features.
	 *
	 * Note that this function is hooked into the after_setup_theme hook, which
	 * runs before the init hook. The init hook is too late for some features, such
	 * as indicating support for post thumbnails.
	 */
	function flex_multi_business_setup() {

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
				'primary-menu' => esc_html__( 'Primary Menu', 'flex-multi-business' ),
				'footer-menu' => esc_html__( 'Footer Menu', 'flex-multi-business' ),
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
				'flex_multi_business_custom_background_args',
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
add_action( 'after_setup_theme', 'flex_multi_business_setup' );

/**
 * Set the content width in pixels, based on the theme's design and stylesheet.
 *
 * Priority 0 to make it available to lower priority callbacks.
 *
 * @global int $content_width
 */
function flex_multi_business_content_width() {
	$GLOBALS['content_width'] = apply_filters( 'flex_multi_business_content_width', 640 );

	add_filter( 'elementor_enable_onboarding', '__return_false' );

	if ( ! defined( 'FLEX_MULTI_BUSINESS_DOCUMENTATION' ) ) {
        define( 'FLEX_MULTI_BUSINESS_DOCUMENTATION', __( 'https://demo.flextheme.net/doc/flex-free-multi-business-doc', 'flex-multi-business' ));
    }
    if ( ! defined( 'FLEX_MULTI_BUSINESS_SUPPORT' ) ) {
    define('FLEX_MULTI_BUSINESS_SUPPORT',__('https://wordpress.org/support/theme/flex-multi-business/','flex-multi-business'));
    }
    if ( ! defined( 'FLEX_MULTI_BUSINESS_REVIEW' ) ) {
    define('FLEX_MULTI_BUSINESS_REVIEW',__('https://wordpress.org/support/theme/flex-multi-business/reviews/','flex-multi-business'));
    }
    if ( ! defined( 'FLEX_MULTI_BUSINESS_BUY_NOW' ) ) {
    define('FLEX_MULTI_BUSINESS_BUY_NOW',__('https://www.flextheme.net/products/flex-pro-wordpress-theme','flex-multi-business'));
    }
    if ( ! defined( 'FLEX_MULTI_BUSINESS_LIVE_DEMO' ) ) {
    define('FLEX_MULTI_BUSINESS_LIVE_DEMO',__('https://demo.flextheme.net/flex-multi-business-pro','flex-multi-business'));
    }
}
add_action( 'after_setup_theme', 'flex_multi_business_content_width', 0 );

/**
 * Register widget area.
 *
 * @link https://developer.wordpress.org/themes/functionality/sidebars/#registering-a-sidebar
 */
function flex_multi_business_widgets_init() {
	register_sidebar(
		array(
			'name'          => esc_html__( 'Sidebar', 'flex-multi-business' ),
			'id'            => 'main-sidebar',
			'description'   => esc_html__( 'Add widgets here.', 'flex-multi-business' ),
			'before_widget' => '<section id="%1$s" class="widget %2$s">',
			'after_widget'  => '</section>',
			'before_title'  => '<h2 class="widget-title">',
			'after_title'   => '</h2>',
		)
	);

	register_sidebar(
		array(
			'name'          => esc_html__( 'Footer Widgets', 'flex-multi-business' ),
			'id'            => 'footer-widgets',
			'description'   => esc_html__( 'Add widgets here.', 'flex-multi-business' ),
			'before_widget' => '<div class="%2$s footer-widget col-md-3 col-sm-6 col-xs-12">',
			'after_widget'  => '</div>',
			'before_title'  => '<h2 class="widget-title">',
			'after_title'   => '</h2>',
		)
	);

	if ( class_exists( 'WooCommerce' ) ) {
		register_sidebar(
		array(
			'name'          => esc_html__( 'WooCommerce Sidebar', 'flex-multi-business' ),
			'id'            => 'woocommerce-widgets',
			'description'   => esc_html__( 'Add widgets here.', 'flex-multi-business' ),
			'before_widget' => '<section id="%1$s" class="widget %2$s">',
			'after_widget'  => '</section>',
			'before_title'  => '<h2 class="widget-title">',
			'after_title'   => '</h2>',
		)
	);
	}
}
add_action( 'widgets_init', 'flex_multi_business_widgets_init' );

/**
 * Enqueue scripts and styles.
 */
function flex_multi_business_scripts() {
	
	wp_enqueue_style('dashicons');
	wp_enqueue_style('bootstrap', get_template_directory_uri() . '/assets/css/bootstrap.css');
	wp_enqueue_style('flex-multi-business-header-css', get_template_directory_uri() . '/assets/css/header.css');
	wp_enqueue_style('font-awesome', get_template_directory_uri() . '/assets/css/font-awesome.css');
	wp_enqueue_style('flex-multi-business-responsive-css', get_template_directory_uri() . '/assets/css/responsive.css');
	wp_enqueue_style('flex-multi-business-custom-css', get_template_directory_uri() . '/assets/css/flex-multi-business-custom.css');
	wp_enqueue_style('flex-multi-business-woocommerce-css', get_template_directory_uri() . '/assets/css/flex-multi-business-woocommerce.css');
	
	wp_enqueue_style( 'google-fonts', 'https://fonts.googleapis.com/css2?family=Jost:ital,wght@0,100..900;1,100..900&display=swap', [], null );

	wp_enqueue_style( 'flex-multi-business-style', get_stylesheet_uri(), array(), FLEX_MULTI_BUSINESS_VERSION );
	wp_style_add_data( 'flex-multi-business-style', 'rtl', 'replace' );

	wp_enqueue_script( 'flex-multi-business-navigation', get_template_directory_uri() . '/js/navigation.js', array(), FLEX_MULTI_BUSINESS_VERSION, true );

	wp_enqueue_script( 'flex-multi-business-theme-js', get_template_directory_uri() . '/assets/js/theme.js',array('jquery'), FLEX_MULTI_BUSINESS_VERSION, true );

    wp_enqueue_script( 'bootstrap-js', get_template_directory_uri() . '/assets/js/bootstrap.js',array(), FLEX_MULTI_BUSINESS_VERSION, true );

    wp_enqueue_script( 'flex-multi-business-custom-js', get_template_directory_uri() . '/assets/js/custom.js',array(), FLEX_MULTI_BUSINESS_VERSION, true );  

	if ( is_singular() && comments_open() && get_option( 'thread_comments' ) ) {
		wp_enqueue_script( 'comment-reply' );
	}

}
add_action( 'wp_enqueue_scripts', 'flex_multi_business_scripts' );

/**
 * Nav Walker fo Bootstrap Dropdown Menu.
 */
require_once get_template_directory() . '/inc/class-wp-bootstrap-navwalker.php';

/**
 * Implement the Custom Header feature.
 */
require get_template_directory() . '/inc/custom-header.php';

/**
 * Custom template tags for this theme.
 */
require get_template_directory() . '/inc/template-tags.php';

/**
 * Functions which enhance the theme by hooking into WordPress.
 */
require get_template_directory() . '/inc/template-functions.php';

/**
 * Customizer additions.
 */
require get_template_directory() . '/inc/controls.php';

/**
 * Add feature in Customizer  
 */
require get_template_directory() . '/inc/customizer/customizer.php';

/*Plugin Recommendation*/
require get_template_directory()  . '/inc/tgm/class-tgm-plugin-activation.php';
require get_template_directory(). '/inc/tgm/hook-tgm.php';	

// Get Notice
require get_template_directory() . '/dashboard/notice.php';

/**
 * Load init.
 */
require_once trailingslashit(FLEX_MULTI_BUSINESS_THEME_DIR).'inc/init.php';


/* Enqueue admin-notice-script js */
add_action('admin_enqueue_scripts', function ($hook) {
    if ($hook !== 'appearance_page_flex-multi-business') return;

    wp_enqueue_script('admin-notice-script', get_template_directory_uri() . '/dashboard/js/admin-notice-script.js', ['jquery'], null, true);
    wp_localize_script('admin-notice-script', 'pluginInstallerData', [
        'ajaxurl'     => admin_url('admin-ajax.php'),
        'nonce'       => wp_create_nonce('install_flex_import_nonce'), // Match this with PHP nonce check
        'redirectUrl' => admin_url('admin.php?page=fleximp-template-importer'),
    ]);
});


add_action('wp_ajax_check_flex_import_activation', function () {
    include_once ABSPATH . 'wp-admin/includes/plugin.php';

    $flex_multi_business_plugin_file = 'flex-import/flex-import.php';

    if (is_plugin_active($flex_multi_business_plugin_file) ) {
        wp_send_json_success(['active' => true]);
    } else {
        wp_send_json_success(['active' => false]);
    }
});

add_action( 'activated_plugin', function( $plugin ) {
	if ( $plugin === 'elementor/elementor.php' ) {
		delete_transient( 'elementor_activation_redirect' );
		add_filter( 'elementor_enable_onboarding', '__return_false' );
	}
});

//custom function conditional check for blog page
function flex_multi_business_is_blog (){
    return ( is_archive() || is_author() || is_category() || is_home() || is_single() || is_tag()) && 'post' == get_post_type();
}