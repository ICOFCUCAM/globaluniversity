<?php
/**
 * Template part for displaying posts
 *
 * @link https://developer.wordpress.org/themes/basics/template-hierarchy/
 *
 * @package flex-multi-business
 */

?>

<article class="blog-item blog-2" id="post-<?php the_ID(); ?>">
    <div class="post-img">
        <?php
        if(has_post_thumbnail()){ 
         	the_post_thumbnail(); 
        } ?>
    </div>
    
    <ul class="post-meta">
        <li>
            <i class="fa fa-user"></i>
            <?php flex_multi_business_posted_by(); ?>
        </li>
        <li>
            <i class="fa fa-comments"></i>
            <?php echo esc_html(get_comments_number());  ?>
        </li>
    </ul>
    <div class="post-content p-4 text-center">
        <h5>
            <a href="<?php the_permalink(); ?>"><?php the_title(); ?></a>
        </h5>
                   
        <?php the_excerpt(); ?>
   		<div class="read-more">
           <a href="<?php the_permalink(); ?>"><?php echo esc_html(get_theme_mod('flex_multi_business_readmore_general_section', 'Read More')); ?><i class="fa fa-arrow-right" aria-hidden="true"></i></a>
        </div>
    </div>
</article>