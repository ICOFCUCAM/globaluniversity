<?php 
/* Cachekey: cache/stash_default/doctrine/[concrete\core\entity\attribute\type][1]/ */
/* Type: array */
/* Expiration: 2024-04-25T04:50:26-04:00 */



$loaded = true;
$expiration = 1714035026;

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
     'name' => 'AttributeTypes',
     'schema' => NULL,
     'indexes' => 
    array (
      0 => 
      Doctrine\ORM\Mapping\Index::__set_state(array(
         'name' => 'pkgID',
         'columns' => 
        array (
          0 => 'pkgID',
          1 => 'atID',
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
