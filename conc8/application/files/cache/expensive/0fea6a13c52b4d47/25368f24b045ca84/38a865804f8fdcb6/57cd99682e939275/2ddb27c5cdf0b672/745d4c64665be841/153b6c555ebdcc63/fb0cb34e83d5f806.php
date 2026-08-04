<?php 
/* Cachekey: cache/stash_default/doctrine/[concrete\core\entity\file\downloadstatistics][1]/ */
/* Type: array */
/* Expiration: 2024-04-24T22:05:06-04:00 */



$loaded = true;
$expiration = 1714010706;

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
     'name' => 'DownloadStatistics',
     'schema' => NULL,
     'indexes' => 
    array (
      0 => 
      Doctrine\ORM\Mapping\Index::__set_state(array(
         'name' => 'fID',
         'columns' => 
        array (
          0 => 'fID',
          1 => 'timestamp',
        ),
         'fields' => NULL,
         'flags' => NULL,
         'options' => NULL,
      )),
      1 => 
      Doctrine\ORM\Mapping\Index::__set_state(array(
         'name' => 'fvID',
         'columns' => 
        array (
          0 => 'fID',
          1 => 'fvID',
        ),
         'fields' => NULL,
         'flags' => NULL,
         'options' => NULL,
      )),
      2 => 
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
      3 => 
      Doctrine\ORM\Mapping\Index::__set_state(array(
         'name' => 'rcID',
         'columns' => 
        array (
          0 => 'rcID',
        ),
         'fields' => NULL,
         'flags' => NULL,
         'options' => NULL,
      )),
      4 => 
      Doctrine\ORM\Mapping\Index::__set_state(array(
         'name' => 'timestamp',
         'columns' => 
        array (
          0 => 'timestamp',
        ),
         'fields' => NULL,
         'flags' => NULL,
         'options' => NULL,
      )),
    ),
     'uniqueConstraints' => NULL,
     'options' => 
    array (
      'comment' => 'List of downloaded files',
    ),
  )),
);

/* Child Type: integer */
$data['createdOn'] = 1713632374;
