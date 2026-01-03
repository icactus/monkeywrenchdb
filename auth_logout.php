<?php
// auth_logout.php
if (file_exists('session_config.php')) {
    require_once 'session_config.php';
} else {
    // If config missing, session_start needed to destroy it
    session_start();
}
session_destroy();
header('Location: index.php');
exit;
?>