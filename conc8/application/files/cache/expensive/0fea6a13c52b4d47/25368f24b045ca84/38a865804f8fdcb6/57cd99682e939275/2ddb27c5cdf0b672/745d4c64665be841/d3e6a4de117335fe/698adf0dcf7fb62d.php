<?php 
/* Cachekey: cache/stash_default/doctrine/[concrete\core\entity\express\entity$attributes][1]/ */
/* Type: array */
/* Expiration: 2024-04-25T10:27:38-04:00 */



$loaded = true;
$expiration = 1714055258;

$data = array();

/* Child Type: array */
$data['return'] = array (
  0 => 
  Doctrine\ORM\Mapping\OneToMany::__set_state(array(
     'mappedBy' => 'entity',
     'targetEntity' => '\\Concrete\\Core\\Entity\\Attribute\\Key\\ExpressKey',
     'cascade' => 
    array (
      0 => 'persist',
      1 => 'remove',
    ),
     'fetch' => 'LAZY',
     'orphanRemoval' => false,
     'indexBy' => NULL,
  )),
);

/* Child Type: integer */
$data['createdOn'] = 1713632577;
