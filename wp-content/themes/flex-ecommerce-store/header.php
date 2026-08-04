<?php
/**
 * The header for our theme
 *
 * This is the template that displays all of the <head> section and everything up until <div id="content">
 *
 * @link https://developer.wordpress.org/themes/basics/template-files/#template-partials
 *
 * @package flex-ecommerce-store
 */

?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<link rel="profile" href="https://gmpg.org/xfn/11">
	<?php wp_head(); ?>
</head>

<body <?php body_class(); ?>>
<?php wp_body_open(); ?>

<?php $display_phone_number = get_theme_mod('flex_multi_business_display_phone_number',true); ?>

<div class="preloader">
  <div class="preloader-inner">
    <img src="<?php echo esc_url(get_template_directory_uri() . '/assets/img/cart-preloader.gif') ?>" alt="">
  </div>
</div>

<div id="page" class="site-wrapper">
	<a class="skip-link screen-reader-text" href="#primary"><?php esc_html_e( 'Skip to content', 'flex-ecommerce-store' ); ?></a>	
	<header>    
    <div class="header-two affix">
      <div class="container">
        <div class="row">
          <div class="col-lg-3 col-md-3 align-self-center">
            <div class="logo">
              <?php
                // Site Custom Logo
                if ( function_exists( 'the_custom_logo' ) ) {
                  the_custom_logo();
                }
              ?>

              <h1 class="site-title mt-0"><a href="<?php echo esc_url( home_url( '/' ) ); ?>" title="<?php echo esc_attr( get_bloginfo( 'name', 'display' ) ); ?>" rel="home"><?php bloginfo( 'name' ); ?></a></h1>

              <?php
                $description = get_bloginfo( 'description', 'display' );
                if ( $description || is_customize_preview() ) :
              ?>
              <p class="site-description">
                <?php echo esc_html( $description ); ?>
              </p>
              <?php endif; ?>
            </div>
          </div>
          <div class="col-lg-7 col-md-7 align-self-center">
            <nav id="site-navigation" class="main-navigation" role="navigation" aria-label="<?php esc_attr_e( 'Primary Menu', 'flex-ecommerce-store' ); ?>">
              
              <!-- Mobile Menu -->
              <div class="main-mobile-nav">
                <div class="main-mobile-menu">
                  <div class="menu-collapse-wrap">
                    <div class="hamburger-menu">
                      <button type="button" class="menu-collapsed" aria-label="<?php esc_attr_e('Menu Collapsed','flex-ecommerce-store'); ?>">
                          <div class="top-bun"></div>
                          <div class="meat"></div>
                          <div class="bottom-bun"></div>
                      </button>
                    </div>
                  </div>
                  <div class="main-mobile-wrapper">
                    <div id="mobile-menu-build" class="main-mobile-build">
                      <button type="button" class="header-close-menu close-style" aria-label="<?php esc_attr_e('Header Close Menu','flex-ecommerce-store'); ?>"></button>
                    </div>
                  </div>
                </div>
              </div>
              <!-- End of Mobile Menu -->
              <div class="main-navbar">
              <?php
                wp_nav_menu(
                  array(
                    'theme_location' => 'primary-menu',
                    'menu_id'        => 'primary-menu',
                    'fallback_cb' => 'WP_Bootstrap_Navwalker::fallback',
                    'walker' => new WP_Bootstrap_Navwalker()
                  )
                );
              ?>
              </div> 
            </nav>
          </div>
        </div>
      </div>
    </div>
  </header>
  <!-- header end -->

  <div id="primary" class="site-main">