<?php 
/* Cachekey: cache/stash_default/doctrine/[concrete\core\entity\calendar\calendarpermissionassignment][1]/ */
/* Type: array */
/* Expiration: 2024-04-25T02:48:08-04:00 */



$loaded = true;
$expiration = 1714027688;

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
     'name' => 'CalendarPermissionAssignments',
     'schema' => NULL,
     'indexes' => 
    array (
      0 => 
      Doctrine\ORM\Mapping\Index::__set_state(array(
         'name' => 'paID',
         'columns' => 
        array (
          0 => 'paID',
        ),
         'fields' => NULL,
         'flags' => NULL,
         'options' => NULL,
      )),
      1 => 
      Doctrine\ORM\Mapping\Index::__set_state(array(
         'name' => 'pkID',
         'columns' => 
        array (
          0 => 'pkID',
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
