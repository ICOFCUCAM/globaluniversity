<?php

/**
 * excerpt lenth.
 */
if (!function_exists('flex_multi_business_custom_excerpt_length')) :
    function flex_multi_business_custom_excerpt_length($length)
    {
        if (is_admin()) {
            return $length;
        }

        $excpt_length = get_theme_mod('flex_multi_business_excerpt_general_section','55');
        if (!empty($excpt_length)) {
            return $excpt_length;
        }
        return 55;
    }
endif;
add_filter('excerpt_length', 'flex_multi_business_custom_excerpt_length');

function flex_multi_business_excerpt_more( $more ) {
	if ( is_admin() ) {
        return $more;
    }

    return '...';
}
add_filter('excerpt_more', 'flex_multi_business_excerpt_more');

function flex_multi_business_set_post_view() {
    $key = 'post_views_count';
    $post_id = get_the_ID();
    $count = (int) get_post_meta( $post_id, $key, true );
    $count++;
    update_post_meta( $post_id, $key, $count );
}
?>