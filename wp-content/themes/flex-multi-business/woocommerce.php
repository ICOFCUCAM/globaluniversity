<?php
/**
 * The template for displaying all single posts
 *
 * @link https://developer.wordpress.org/themes/basics/template-hierarchy/#single-post
 *
 * @package flex-multi-business
 */

get_header();
?>

<div class="box-image position-relative">
	<div class="single-page-img"></div>
	<div class="page-header">
        <h1 class="shop-title-banner"><?php woocommerce_page_title(); ?></h1>  
        <h2 class="product-title-banner"><?php the_title();?></h1>
	</div>
</div>

<?php
    $sidebar_layout = get_theme_mod('flex_multi_business_sidebar_layout_section', 'right');
    if ($sidebar_layout == 'left') {
        $sidebar_layout = 'has-left-sidebar';
    } elseif ($sidebar_layout == 'right') {
        $sidebar_layout = 'has-right-sidebar';
    } elseif ($sidebar_layout == 'no') {
        $sidebar_layout = 'no-sidebar';
    }
?>

    <?php
    if ( have_posts() ) : ?>

	<!-- blog detail start-->
    <div class="sp-100 bg-w">
        <div class="container">
            <div class="row <?php echo esc_attr($sidebar_layout); ?>">
                
                <?php if( class_exists( 'WooCommerce' ) && is_product() || is_account_page() || is_cart() || is_checkout() || is_shop() || is_page( 'wishlist' )){ ?>
                        <div class="col-lg-12">
                <?php } else if(is_active_sidebar( 'woocommerce-widgets' )){ ?>
                        <div class="col-lg-8">
                <?php } else { ?>
                    <div class="col-lg-12">
                <?php } ?>



                <?php woocommerce_content();?>  

                </div>
                
                    <?php
                    //if (($sidebar_layout == 'has-left-sidebar') || ($sidebar_layout == 'has-right-sidebar') && class_exists( 'WooCommerce') && !is_product() && is_active_sidebar( 'woocommerce-widgets' )) { ?>
                    <?php
                    if (!is_shop() &&  !is_product() ) { ?>
                        <div class="col-lg-4">
    	                    <aside class="sidebar mt-5 mt-lg-0">
    	                        <?php dynamic_sidebar('woocommerce-widgets'); ?>
    	                    </aside>
                    	</div>
                    <?php } ?>
                
            </div>
        </div>
    </div>
    <!-- blog detail ends-->

<?php 	
endif;
?>		

<?php
get_footer();
