<?php 
/* Cachekey: cache/stash_default/doctrine/[concrete\core\entity\user\usersignup$notifications][1]/ */
/* Type: array */
/* Expiration: 2024-04-25T04:27:56-04:00 */



$loaded = true;
$expiration = 1714033676;

$data = array();

/* Child Type: array */
$data['return'] = array (
  0 => 
  Doctrine\ORM\Mapping\OneToMany::__set_state(array(
     'mappedBy' => 'signup',
     'targetEntity' => '\\Concrete\\Core\\Entity\\Notification\\UserSignupNotification',
     'cascade' => 
    array (
      0 => 'remove',
    ),
     'fetch' => 'LAZY',
     'orphanRemoval' => false,
     'indexBy' => NULL,
  )),
);

/* Child Type: integer */
$data['createdOn'] = 1713632373;
