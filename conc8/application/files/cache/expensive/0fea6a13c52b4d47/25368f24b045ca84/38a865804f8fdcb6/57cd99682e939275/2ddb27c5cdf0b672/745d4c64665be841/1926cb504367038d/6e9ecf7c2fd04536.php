<?php 
/* Cachekey: cache/stash_default/doctrine/[concrete\core\entity\site\locale$tree][1]/ */
/* Type: array */
/* Expiration: 2024-04-25T04:52:47-04:00 */



$loaded = true;
$expiration = 1714035167;

$data = array();

/* Child Type: array */
$data['return'] = array (
  0 => 
  Doctrine\ORM\Mapping\OneToOne::__set_state(array(
     'targetEntity' => 'SiteTree',
     'mappedBy' => 'locale',
     'inversedBy' => NULL,
     'cascade' => 
    array (
      0 => 'all',
    ),
     'fetch' => 'LAZY',
     'orphanRemoval' => false,
  )),
  1 => 
  Doctrine\ORM\Mapping\JoinColumn::__set_state(array(
     'name' => 'siteTreeID',
     'referencedColumnName' => 'siteTreeID',
     'unique' => false,
     'nullable' => true,
     'onDelete' => NULL,
     'columnDefinition' => NULL,
     'fieldName' => NULL,
     'options' => 
    array (
    ),
  )),
);

/* Child Type: integer */
$data['createdOn'] = 1713632356;
