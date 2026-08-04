<?php
// Upsell
if ( class_exists( 'WP_Customize_Section' ) ) {
	class Flex_Multi_Business_Upsell_Section extends WP_Customize_Section {
		public $type = 'flex-multi-business-upsell';
		public $button_text = '';
		public $url = '';
		public $background_color = '';
		public $text_color = '';
		protected function render() {
			$background_color = ! empty( $this->background_color ) ? esc_attr( $this->background_color ) : '#3e5aef';
			$text_color       = ! empty( $this->text_color ) ? esc_attr( $this->text_color ) : '#fff';
			?>
			<li id="accordion-section-<?php echo esc_attr( $this->id ); ?>" class="Flex_Multi_Business_Upsell_Section accordion-section control-section control-section-<?php echo esc_attr( $this->id ); ?> cannot-expand">
				<h3 class="accordion-section-title" style="color:#fff; background:<?php echo esc_attr( $background_color ); ?>;border-left-color:<?php echo esc_attr( $background_color ); ?>;">
					<?php echo esc_html( $this->title ); ?>
					<a href="<?php echo esc_url( $this->url ); ?>" class="button button-secondary alignright" target="_blank" style="margin-top: -4px;"><?php echo esc_html( $this->button_text ); ?></a>
				</h3>
			</li>
			<?php
		}
	}
}
function flex_multi_business_admin_notice_style() {
	wp_enqueue_style('flex-multi-business-custom-admin-notice-style', esc_url(get_template_directory_uri()) . '/dashboard/getstart.css');
}
add_action('admin_enqueue_scripts', 'flex_multi_business_admin_notice_style');

/**
 * Display the admin notice if not dismissed.
 */
function flex_multi_business_admin_notice() {
    // Check if the notice is dismissed
    $dismissed = get_user_meta(get_current_user_id(), 'flex_multi_business_dismissed_notice', true);

    // Display the notice only if not dismissed
    if (!$dismissed) {
        ?>
        <div class="notice is-dismissible notice-getstarted-flex" data-notice="get-start" >
			<div class="inner-notice">
				<img src="<?php echo esc_url(get_template_directory_uri() . '/dashboard/images/responsive-img.png'); ?>" />
				<div class="inner-content">
					<h2><?php esc_html_e('🎉 Thank you for activating the Flex Free WordPress Theme!', 'flex-multi-business'); ?></h2>
					<p><?php esc_html_e('Get started quickly by importing the demo content or explore more powerful options below.', 'flex-multi-business'); ?></p>
					<div class="notice-button">
						<a href="javascript:void(0);" id="install-activate-button" class="button admin-button info-button">
							<?php echo __('Import Demo', 'flex-multi-business'); ?>
						</a>
						<script type="text/javascript">
						document.getElementById('install-activate-button').addEventListener('click', function () {
							const flex_multi_business_button = this;
							const flex_multi_business_redirectUrl = '<?php echo esc_url(admin_url("admin.php?page=fleximp-template-importer")); ?>';
							// First, check if plugin is already active
							jQuery.post(ajaxurl, { action: 'check_flex_import_activation' }, function (response) {
								if (response.success && response.data.active) {
									// Plugin already active — just redirect
									window.location.href = flex_multi_business_redirectUrl;
								} else {
									// Show Installing & Activating only if not already active
									flex_multi_business_button.textContent = 'Installing & Activating...';

									jQuery.post(ajaxurl, {
										action: 'install_and_activate_flex_import_plugin',
										nonce: '<?php echo wp_create_nonce("install_activate_nonce"); ?>'
									}, function (response) {
										if (response.success) {
											window.location.href = flex_multi_business_redirectUrl;
										} else {
											alert('Failed to activate the plugin.');
											flex_multi_business_button.textContent = 'Try Again';
										}
									});
								}
							});
						});
						</script>

						<a href="<?php echo esc_url( FLEX_MULTI_BUSINESS_BUY_NOW ); ?>" target="_blank" id="go-pro-button" class="button admin-button buy-now-button"><?php echo __('Upgrade Pro', 'flex-multi-business'); ?></a>

						<a href="<?php echo esc_url( FLEX_MULTI_BUSINESS_LIVE_DEMO ); ?>" target="_blank" id="bundle-button" class="button admin-button bundle-button"><?php echo __('Live Demo', 'flex-multi-business'); ?></a>

						<a href="<?php echo esc_url( FLEX_MULTI_BUSINESS_DOCUMENTATION ); ?>" target="_blank" id="doc-button" class="button admin-button bundle-button"><?php echo __('Documentation', 'flex-multi-business'); ?></a>

					</div>
					<p><?php esc_html_e('Build faster. Look better. Go Pro with Flex!', 'flex-multi-business'); ?></p>
				</div>
			</div>
        </div>
        <?php
    }
}

// Hook to display the notice
add_action('admin_notices', 'flex_multi_business_admin_notice');

/**
 * AJAX handler to dismiss the notice.
 */
function flex_multi_business_dismissed_notice() {
    // Set user meta to indicate the notice is dismissed
    update_user_meta(get_current_user_id(), 'flex_multi_business_dismissed_notice', true);
    die();
}

// Hook for the AJAX action
add_action('wp_ajax_flex_multi_business_dismissed_notice', 'flex_multi_business_dismissed_notice');

/**
 * Clear dismissed notice state when switching themes.
 */
function flex_multi_business_switch_theme() {
    // Clear the dismissed notice state when switching themes
    delete_user_meta(get_current_user_id(), 'flex_multi_business_dismissed_notice');
}

// Hook for switching themes
add_action('after_switch_theme', 'flex_multi_business_switch_theme');  