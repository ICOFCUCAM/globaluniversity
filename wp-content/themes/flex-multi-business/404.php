<?php
/**
 * The template for displaying 404 pages (not found)
 *
 * @link https://codex.wordpress.org/Creating_an_Error_404_Page
 *
 * @package flex-multi-business
 */

get_header();
?>
	<section class="page-404">
        <div class="container">
            <div class="page-404-inner my-5">
                <h1><?php echo esc_html__('404','flex-multi-business'); ?></h1>
                <h3><i class="fa fa-exclamation-triangle"></i><?php echo esc_html__( 'Oops! Page Not Found', 'flex-multi-business' ); ?></h3>
                <p><?php echo esc_html__( 'Sorry but the page you are looking for is not found. Please make sure you have typed the correct URL.', 'flex-multi-business' ); ?></p>
                <div class="read-more">
                    <a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="btn"><?php echo esc_html__( 'Back To Home','flex-multi-business'); ?> 
                    </a>
                </div>
            </div>
        </div>
    </section>

<?php
get_footer();