<?php
// includes/auth.php
require_once __DIR__ . '/db.php';

session_start();

function login($username, $password) {
    // Basic protection against brute force logic can be implemented here checking login_limits
    $admin = DB::fetch("SELECT * FROM admins WHERE username = ?", [$username]);
    if ($admin) {
        if (password_verify($password, $admin['password_hash'])) {
            $_SESSION['admin_id'] = $admin['id'];
            $_SESSION['username'] = $admin['username'];
            return true;
        }
    }
    return false;
}

function logout() {
    session_destroy();
}

function require_login() {
    if (!isset($_SESSION['admin_id'])) {
        header('Content-Type: application/json');
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
}

function current_admin_id() {
    return $_SESSION['admin_id'] ?? null;
}
