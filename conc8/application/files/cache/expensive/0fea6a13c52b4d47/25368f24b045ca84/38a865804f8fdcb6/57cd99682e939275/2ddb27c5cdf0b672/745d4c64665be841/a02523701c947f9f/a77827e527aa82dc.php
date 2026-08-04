<?php 
/* Cachekey: cache/stash_default/doctrine/[concrete\core\entity\page\pagepath][1]/ */
/* Type: array */
/* Expiration: 2024-04-25T12:25:34-04:00 */



$loaded = true;
$expiration = 1714062334;

$data = array();

/* Child Type: array */
$data['return'] = array (
  0 => 
  Doctrine\ORM\Mapping\Entity::__set_state(array(
     'repositoryClass' => NULL,
     'readOnly' => false,
  )),
  1 => 
  Doctrine\ORM\Mapping\Table::__set_state(array(
     'name' => 'PagePaths',
     'schema' => NULL,
     'indexes' => 
    array (
      0 => 
      Doctrine\ORM\Mapping\Index::__set_state(array(
         'name' => 'ppIsCanonical',
         'columns' => 
        array (
          0 => 'ppIsCanonical',
        ),
         'fields' => NULL,
         'flags' => NULL,
         'options' => NULL,
      )),
      1 => 
      Doctrine\ORM\Mapping\Index::__set_state(array(
         'name' => 'cID',
         'columns' => 
        array (
          0 => 'cID',
        ),
         'fields' => NULL,
         'flags' => NULL,
         'options' => NULL,
      )),
    ),
     'uniqueConstraints' => NULL,
     'options' => 
    array (
    ),
  )),
);

/* Child Type: integer */
$data['createdOn'] = 1713632373;
