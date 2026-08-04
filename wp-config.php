<?php
define('AUTOMATIC_UPDATER_DISABLED', true);
/**
 * The base configuration for WordPress
 *
 * The wp-config.php creation script uses this file during the
 * installation. You don't have to use the web site, you can
 * copy this file to "wp-config.php" and fill in the values.
 *
 * This file contains the following configurations:
 *
 * * MySQL settings
 * * Secret keys
 * * Database table prefix
 * * ABSPATH
 *
 * @link https://wordpress.org/support/article/editing-wp-config-php/
 *
 * @package WordPress
 */

// ** MySQL settings - You can get this info from your web host ** //
/** The name of the database for WordPress */
define( 'DB_NAME', 'igucmor1_wp905' );

/** MySQL database username */
define( 'DB_USER', 'igucmor1_wp905' );

/** MySQL database password */
define( 'DB_PASSWORD', 'El!o6!L1-jS]@22p' );

/** MySQL hostname */
define( 'DB_HOST', 'localhost' );

/** Database Charset to use in creating database tables. */
define( 'DB_CHARSET', 'utf8mb4' );

/** The Database Collate type. Don't change this if in doubt. */
define( 'DB_COLLATE', '' );

/**#@+
 * Authentication Unique Keys and Salts.
 *
 * Change these to different unique phrases!
 * You can generate these using the {@link https://api.wordpress.org/secret-key/1.1/salt/ WordPress.org secret-key service}
 * You can change these at any point in time to invalidate all existing cookies. This will force all users to have to log in again.
 *
 * @since 2.6.0
 */
define( 'AUTH_KEY',         'yovqteb0brmtxo4dtyxwamdscwv6ew7oztwufyuoc4bwixsyjbelthooqakeabba' );
define( 'SECURE_AUTH_KEY',  'wj6uqrklc58tratpw3gx5a2bbsa3rt9xqsmhzbkyriprn4avnneizrqva6dwo3l3' );
define( 'LOGGED_IN_KEY',    'pw4uz9enlypp0iyrmmksbdqzmnhku0orl0dqnwgtvrv62qknjfdo09fh4slthmno' );
define( 'NONCE_KEY',        '40o2ia35km61sohidahxdijly89izbxvvommihwmed6krspkzpipartobpqwz9hk' );
define( 'AUTH_SALT',        'oioarbxt7mekgxjnxrisstzp3kjnnzdvccbeewudaakvecn8gly8fbvtb9shbqk0' );
define( 'SECURE_AUTH_SALT', 'b7tru5ts0fs7nd9rofuurestwpsdqk0jwcykjktoy5v9vhb527y5curgolzearxc' );
define( 'LOGGED_IN_SALT',   'cxfouhjwhpl22pfzqnpkm03vlcfc1q0zoa9vklzu9phn7wpazxwibnnewfvxllhi' );
define( 'NONCE_SALT',       'efjpvbtot9equezuy73le5xknf0nph2apmy6nk88yd0qzuonvnt9nzefgqew2ym7' );

/**#@-*/

/**
 * WordPress Database Table prefix.
 *
 * You can have multiple installations in one database if you give each
 * a unique prefix. Only numbers, letters, and underscores please!
 */
$table_prefix = 'wpst_';

/**
 * For developers: WordPress debugging mode.
 *
 * Change this to true to enable the display of notices during development.
 * It is strongly recommended that plugin and theme developers use WP_DEBUG
 * in their development environments.
 *
 * For information on other constants that can be used for debugging,
 * visit the documentation.
 *
 * @link https://wordpress.org/support/article/debugging-in-wordpress/
 */
define( 'WP_DEBUG', false );

define( 'WP_AUTO_UPDATE_CORE', 'minor' );
/* That's all, stop editing! Happy publishing. */

/** Absolute path to the WordPress directory. */
if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

/** Sets up WordPress vars and included files. */
require_once ABSPATH . 'wp-settings.php';