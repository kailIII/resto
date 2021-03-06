<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">
<?php

/*
 * RESTo
 * 
 * RESTo - REstful Semantic search Tool for geOspatial 
 * 
 * Copyright 2013 Jérôme Gasperi <https://github.com/jjrom>
 * 
 * jerome[dot]gasperi[at]gmail[dot]com
 * 
 * 
 * This software is governed by the CeCILL-B license under French law and
 * abiding by the rules of distribution of free software.  You can  use,
 * modify and/ or redistribute the software under the terms of the CeCILL-B
 * license as circulated by CEA, CNRS and INRIA at the following URL
 * "http://www.cecill.info".
 *
 * As a counterpart to the access to the source code and  rights to copy,
 * modify and redistribute granted by the license, users are provided only
 * with a limited warranty  and the software's author,  the holder of the
 * economic rights,  and the successive licensors  have only  limited
 * liability.
 *
 * In this respect, the user's attention is drawn to the risks associated
 * with loading,  using,  modifying and/or developing or reproducing the
 * software by the user in light of its specific status of free software,
 * that may mean  that it is complicated to manipulate,  and  that  also
 * therefore means  that it is reserved for developers  and  experienced
 * professionals having in-depth computer knowledge. Users are therefore
 * encouraged to load and test the software's suitability as regards their
 * requirements in conditions enabling the security of their systems and/or
 * data to be ensured and,  more generally, to use and operate it in the
 * same conditions as regards security.
 *
 * The fact that you are presently reading this means that you have had
 * knowledge of the CeCILL-B license and that you accept its terms.
 * 
 */

/*
 * Callback service called by SSO Oauth2 server (see redirect_uri)
 * 
 * This service :
 *  1. retrieve oauth TOKEN from input CODE 
 *  2. retrieve user profile from RESTo users database based on user email adress
 *  3. if user does not exist in RESTo database, create the user in RESTo database
 *  4. store user profile in session
 */

/*
 *  Remove PHP Warning
 */
error_reporting(E_ERROR | E_PARSE);

/*
 * Load functions
 */
require realpath(dirname(__FILE__)) . '/../resto/core/lib/functions.php';

/*
 * Autoload controllers and modules
 */
function autoload($className) {
    foreach (array('../resto/core/') as $current_dir) {
        $path = $current_dir . sprintf('%s.php', $className);
        if (file_exists($path)) {
            include $path;
            return;
        }
    }
}

spl_autoload_register('autoload');

/*
 * Start session (or retrieve existing session)
 */
session_start();

/*
 * Only GET method is allowed
 */
$method = strtolower($_SERVER['REQUEST_METHOD']);
if ($method !== 'get') {
    header('HTTP/1.1 405 Method Not Allowed');
    exit;
}

/*
 * No code - no authorization
 */
$code = isset($_GET['code']) ? $_GET['code'] : null;
$issuer_id = isset($_GET['issuer_id']) ? $_GET['issuer_id'] : null;
if (!$code || !$issuer_id) {
    header('HTTP/1.1 400 Bad Request');
    exit;
}

/*
 * Read configuration file
 */
$configFile = realpath(dirname(__FILE__)) . '/../resto/resto.ini';
if (!file_exists($configFile)) {
    header('HTTP/1.1 500 Internal Server Error');
    exit;
}
$sso = array();
try {
    $config = IniParser::read($configFile);
    if (!isset($config) || !isset($config['sso']) || !isset($config['sso'][$issuer_id])) {
        throw new Exception();
    }
    $sso = $config['sso'][$issuer_id];
} catch (Exception $e) {
    header('HTTP/1.1 500 Internal Server Error');
    exit;
}

/*
 * Get current script url
 */
$protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
$port = isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] !== '80' ? ':' . $_SERVER['SERVER_PORT'] : '';
$redirect_uri = $protocol . '://' . $_SERVER['SERVER_NAME'] . $port . $_SERVER['PHP_SELF'] . '?issuer_id=' . $issuer_id ;

/*
 * First retrieve the oauth token using input code
 */
try {
    $ch = curl_init($sso['accessTokenUrl']);
    curl_setopt($ch, CURLOPT_POST, true);
    //curl_setopt($ch, CURLOPT_CAPATH, CACERT_PATH);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    if ($sso['useBearer']) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query(array(
            'grant_type' => "authorization_code",
            'code' => $code,
            'redirect_uri' => $redirect_uri
        )));
        curl_setopt($ch, CURLOPT_HTTPHEADER, array(
            "Authorization: Basic " . base64_encode($sso['clientId'] . ':' . $sso['clientSecret']),
            "Content-Type: application/x-www-form-urlencoded",
            "Host: " . $sso['host']));
        }
    else {
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query(array(
            'grant_type' => "authorization_code",
            'code' => $code,
            'redirect_uri' => $redirect_uri,
            'client_id' => $sso['clientId'],
            'client_secret' => $sso['clientSecret']
        )));
    }
    $jsonData = json_decode(curl_exec($ch), true);
    curl_close($ch);
} catch (Exception $e) {
    $jsonData = null;
}

/*
 * Update user session from oauth token
 */
$error = 0;
if (isset($jsonData) && $jsonData['access_token']) {
    try {
        $user = new RestoUser(new DatabaseConnector($config['general']['db']), array(
            'access_token' => $jsonData['access_token'],
            'forceAuth' => true,
            'sso' => $sso
        ));
    } catch (Exception $e) {
        $error = 1;
    }
}
?>
    <?php if ($error === 1) { ?> 
    <body>
        Error
    </body>
    <?php } else { ?>
    <script type="text/javascript">
        window.close();
    </script>
    <?php } ?>
</html>
