<?php 
/**
 * Common Function for Flex Multi Business Theme.
 *
 * @package     Flex Multi Business
 * @author      flextheme
 * @copyright   Copyright (c) 2019, cleaning elementor
 * @since       biz ecommcerce 1.0.0
 */
 if ( ! function_exists( 'flex_multi_business_custom_logo' ) ) :
/**
 * Displays the optional custom logo.
 * Does nothing if the custom logo is not available.
 */
function flex_multi_business_custom_logo(){
    if ( function_exists( 'the_custom_logo' ) ){?>
    	<div class="texture-logo">
        <?php the_custom_logo();?>
        </div>
   <?php  }
}
endif;
/*********************/
// Menu 
/*********************/
function flex_multi_business_header_menu_style(){
 $flex_multi_business_main_header_layout = get_theme_mod('flex_multi_business_main_header_layout');
        	$menustyle='horizontal';	
        	return $menustyle;
		}
function flex_multi_business_add_classes_to_page_menu( $ulclass ){
  return preg_replace( '/<ul>/', '<ul class="flex-multi-business-menu" data-menu-style='.esc_attr(flex_multi_business_header_menu_style()).'>', $ulclass, 1 );
}
add_filter( 'wp_page_menu', 'flex_multi_business_add_classes_to_page_menu' );		
     
	  // MAIN MENU
           function flex_multi_business_main_nav_menu(){
              wp_nav_menu( array(
              'theme_location' => 'flex-multi-business-main-menu', 
              'container'      => false, 
              'link_before'    =>'<span class="flex-multi-business-menu-link">',
              'link_after'     => '</span>',
              'items_wrap'     => '<ul id="flex-multi-business-menu" class="flex-multi-business-menu" data-menu-style='.esc_attr(flex_multi_business_header_menu_style()).'>%3$s</ul>',
             ));
         }
          
function flex_multi_business_add_classes_to_page_menu_default( $ulclass ){
return preg_replace( '/<ul>/', '<ul class="flex-multi-business-menu" data-menu-style="horizontal">', $ulclass, 1 );
}
add_filter( 'wp_page_menu', 'flex_multi_business_add_classes_to_page_menu_default' );
/************************/
// description Menu
/************************/
function flex_multi_business_nav_description( $item_output, $item, $depth, $args ){
    if ( !empty( $item->description ) ) {
        $item_output = str_replace( $args->link_after . '</a>', '<p class="menu-item-description">' . esc_html($item->description) . '</p>' . $args->link_after . '</a>', $item_output );
    }
 
    return $item_output;
}
add_filter( 'walker_nav_menu_start_el', 'flex_multi_business_nav_description', 10, 4 );

/*********************/
/**
 * Function to check if it is Internet Explorer
 */
if ( ! function_exists( 'flex_multi_business_check_is_ie' ) ) :
	/**
	 * Function to check if it is Internet Explorer.
	 *
	 * @return true | false boolean
	 */
	function flex_multi_business_check_is_ie() {

		$is_ie = false;

		$ua = htmlentities( $_SERVER['HTTP_USER_AGENT'], ENT_QUOTES, 'UTF-8' );
		if ( strpos( $ua, 'Trident/7.0' ) !== false ) {
			$is_ie = true;
		}

		return apply_filters( 'flex_multi_business_check_is_ie', $is_ie );
	}

endif;
/**
 * ratia image
 */
if ( ! function_exists( 'flex_multi_business_replace_header_attr' ) ) :
	/**
	 * Replace header logo.
	 *
	 * @param array  $attr Image.
	 * @param object $attachment Image obj.
	 * @param sting  $size Size name.
	 *
	 * @return array Image attr.
	 */
	function flex_multi_business_replace_header_attr( $attr, $attachment, $size ){
		$custom_logo_id = get_theme_mod( 'custom_logo' );
		if ( $custom_logo_id == $attachment->ID ){
			$attach_data = array();
			if ( ! is_customize_preview() ){
				$attach_data = wp_get_attachment_image_src( $attachment->ID, 'open-logo-size' );


				if ( isset( $attach_data[0] ) ) {
					$attr['src'] = $attach_data[0];
				}
			}

			$file_type      = wp_check_filetype( $attr['src'] );
			$file_extension = $file_type['ext'];
			if ( 'svg' == $file_extension ) {
				$attr['class'] = 'open-logo-svg';
			}
			$retina_logo = get_theme_mod( 'flex_multi_business_header_retina_logo' );
			$attr['srcset'] = '';
			if ( apply_filters( 'open_main_header_retina', true ) && '' !== $retina_logo ) {
				$cutom_logo     = wp_get_attachment_image_src( $custom_logo_id, 'full' );
				$cutom_logo_url = $cutom_logo[0];

				if (flex_multi_business_check_is_ie() ){
					// Replace header logo url to retina logo url.
					$attr['src'] = $retina_logo;
				}

				$attr['srcset'] = $cutom_logo_url . ' 1x, ' . $retina_logo . ' 2x';

			}
		}

		return apply_filters( 'flex_multi_business_replace_header_attr', $attr );
	}

endif;

add_filter( 'wp_get_attachment_image_attributes', 'flex_multi_business_replace_header_attr', 10, 3 );

/**
 * Display Sidebars
 */
if ( ! function_exists( 'flex_multi_business_get_sidebar' ) ){
	/**
	 * Get Sidebar
	 *
	 * @since 1.0.1.1
	 * @param  string $sidebar_id   Sidebar Id.
	 * @return void
	 */
	function flex_multi_business_get_sidebar( $sidebar_id ){
		 return $sidebar_id;
	}
}

// Mobile Menu Wrapper Add.
function flex_multi_business_mobile_menu_wrap(){
echo '<div class="flex-multi-business-mobile-menu-wrapper"></div>';
}
add_action( 'wp_footer', 'flex_multi_business_mobile_menu_wrap' );

// section is_customize_preview
/**
 * This function display a shortcut to a customizer control.
 *
 * @param string $class_name        The name of control we want to link this shortcut with.
 */
function flex_multi_business_display_customizer_shortcut( $class_name ){
	if ( ! is_customize_preview() ) {
		return;
	}
	$icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
            <path d="M13.89 3.39l2.71 2.72c.46.46.42 1.24.03 1.64l-8.01 8.02-5.56 1.16 1.16-5.58s7.6-7.63 7.99-8.03c.39-.39 1.22-.39 1.68.07zm-2.73 2.79l-5.59 5.61 1.11 1.11 5.54-5.65zm-2.97 8.23l5.58-5.6-1.07-1.08-5.59 5.6z"></path>
        </svg>';
	echo'<span class="open-focus-section customize-partial-edit-shortcut customize-partial-edit-shortcut-' . esc_attr( $class_name ) . '">
            <button class="customize-partial-edit-shortcut-button">
                ' . $icon . '
            </button>
        </span>';
}

/*****************************/

// default size in upload image
function flex_multi_business_attachment_display_settings() {
    update_option( 'image_default_size', 'large' );
}
add_action( 'after_setup_theme', 'flex_multi_business_attachment_display_settings' );