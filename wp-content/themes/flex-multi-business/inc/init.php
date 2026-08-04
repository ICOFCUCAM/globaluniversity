<?php 

get_template_part( 'inc/admin-function');

// theme-option
get_template_part( 'lib/texture-option/texture-option');

// customizer
get_template_part('customizer/models/class-flex-multi-business-singleton');
get_template_part('customizer/models/class-flex-multi-business-defaults-models');
get_template_part('customizer/repeater/class-flex-multi-business-repeater');

/*customizer*/

get_template_part('customizer/extend-customizer/class-flex-multi-business-wp-customize-panel');
get_template_part('customizer/extend-customizer/class-flex-multi-business-wp-customize-section');
get_template_part('customizer/customizer-radio-image/class/class-flex-multi-business-customize-control-radio-image');
get_template_part('customizer/customizer-range-value/class/class-flex-multi-business-customizer-range-value-control');

get_template_part('customizer/color/class-control-color');
get_template_part('customizer/customize-buttonset/class-control-buttonset');

get_template_part('customizer/background/class-flex-multi-business-background-image-control');

get_template_part('customizer/customizer-toggle/class-flex-multi-business-toggle-control');

get_template_part('customizer/custom-customizer');
get_template_part('customizer/customizer');

/******************************/
// woocommerce
/******************************/
get_template_part( 'inc/woocommerce/woo-core');
get_template_part( 'inc/woocommerce/woo-function');
get_template_part('inc/woocommerce/woocommerce-ajax');