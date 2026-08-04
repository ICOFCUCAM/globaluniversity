<?php 
/* Cachekey: cache/stash_default/doctrine/[concrete\core\entity\file\file][1]/ */
/* Type: array */
/* Expiration: 2024-04-24T20:10:17-04:00 */



$loaded = true;
$expiration = 1714003817;

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
     'name' => 'Files',
     'schema' => NULL,
     'indexes' => 
    array (
      0 => 
      Doctrine\ORM\Mapping\Index::__set_state(array(
         'name' => 'uID',
         'columns' => 
        array (
          0 => 'uID',
        ),
         'fields' => NULL,
         'flags' => NULL,
         'options' => NULL,
      )),
      1 => 
      Doctrine\ORM\Mapping\Index::__set_state(array(
         'name' => 'fslID',
         'columns' => 
        array (
          0 => 'fslID',
        ),
         'fields' => NULL,
         'flags' => NULL,
         'options' => NULL,
      )),
      2 => 
      Doctrine\ORM\Mapping\Index::__set_state(array(
         'name' => 'ocID',
         'columns' => 
        array (
          0 => 'ocID',
        ),
         'fields' => NULL,
         'flags' => NULL,
         'options' => NULL,
      )),
      3 => 
      Doctrine\ORM\Mapping\Index::__set_state(array(
         'name' => 'fOverrideSetPermissions',
         'columns' => 
        array (
          0 => 'fOverrideSetPermissions',
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
$data['createdOn'] = 1713632374;
