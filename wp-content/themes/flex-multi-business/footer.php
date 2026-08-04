<?php
/**
 * The template for displaying the footer
 *
 * Contains the closing of the #content div and all content after.
 *
 * @link https://developer.wordpress.org/themes/basics/template-files/#template-partials
 *
 * @package flex-multi-business
 */

?>
</div>

  <footer class="footer footer-one">
        <div class="foot-top">
            <div class="container">
                <div class="row">  
                  <?php if ( is_active_sidebar( 'footer-widgets' ) ) { ?>
                  
                    <div class="footer-top">
                        <div class="row clearfix">
                            <?php dynamic_sidebar('footer-widgets'); ?>
                        </div>
                    </div>
                  
                  <?php } ?>

                </div>
                <div class="container">
                  <div class="row text-center">
                    <div class="col-md-12"> 
                      <p class="footer-copyright mb-0">&copy;
                        <?php
                        echo esc_html(date_i18n(
                          /* translators: Copyright date format, see https://www.php.net/manual/datetime.format.php */
                          _x( 'Y', 'copyright date format', 'flex-multi-business' )
                        ));
                        ?>
                        <a href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php bloginfo( 'name' ); ?></a>
                        <a href="<?php echo esc_url( __( 'https://wordpress.org/', 'flex-multi-business' ) ); ?>">
                          <?php esc_html__( 'Powered by WordPress', 'flex-multi-business' ); ?>
                        </a>
                      </p>
                    </div>
                  </div>
                </div>
            </div>
        </div>
    </footer>

    <!-- ====== Go to top ====== -->
    
    <a id="c-scroll" title="<?php esc_attr__('Go to top','flex-multi-business' ); ?>" href="javascript:void(0)">
      <i class="fa fa-arrow-up" aria-hidden="true"></i>
    </a>
    
</div>

<?php wp_footer(); ?>

</body>
</html>
