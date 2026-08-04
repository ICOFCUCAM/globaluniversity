<?php
/**
 * Template part for displaying single posts content.
 * @subpackage flex-multi-business
 * @since 1.0 
 */

?>

<div class="blog-detail">
    <?php if(has_post_thumbnail()) { 
            the_post_thumbnail(); 
        } ?>

    <?php //if(class_exists( 'WooCommerce')) { ?> 
        <?php if(class_exists( 'WooCommerce') && !is_product()) { ?> 
        <ul class="post-meta text-left">

            
            <li>
                <i class="fa fa-user"></i>
                <?php flex_multi_business_posted_by(); ?>
            </li>
           

            
            <li>
                <i class="fa fa-comments"></i>
                <?php echo esc_html(get_comments_number());  ?>
            </li>           

            <li>
                <i class="fa fa-calendar"></i>
                <?php flex_multi_business_posted_on(); ?>
            </li>

        </ul>
    <?php } ?>  

    <h4 class="text-capitalize"><?php the_title(); ?></h4>
   
   <?php the_content(); ?>
   
   <?php wp_link_pages(); ?>

    <?php if(has_tag()) { ?>
    <div class="post-tags mt-4">
        <span class="text-capitalize mr-2 c-black">
            <i class="fa fa-tags"></i> <?php esc_html__("tags:",'flex-multi-business'); ?></span>
            <?php the_tags('', ', ', '<br />'); ?>
    </div>
    <?php } ?>

   
</div>