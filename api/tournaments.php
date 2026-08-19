<?php
require_once __DIR__ . '/../includes/auth.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $id = $_GET['id'] ?? null;
    $slug = $_GET['slug'] ?? null;
    if ($slug) {
        $tournament = DB::fetch("SELECT * FROM tournaments WHERE slug = ?", [$slug]);
        if (!$tournament) {
            http_response_code(404);
            echo json_encode(['error' => 'Not found']);
            exit;
        }
        echo json_encode($tournament);
    } else if ($id) {
        $tournament = DB::fetch("SELECT * FROM tournaments WHERE id = ?", [$id]);
        echo json_encode($tournament);
    } else {
        $tournaments = DB::fetchAll("SELECT * FROM tournaments ORDER BY created_at DESC");
        echo json_encode($tournaments);
    }
} else if ($method === 'POST') {
    require_login();
    $input = json_decode(file_get_contents('php://input'), true);
    $name = $input['name'] ?? '';
    $slug = $input['slug'] ?? '';
    $type = $input['type'] ?? 'intradept';
    $time_control = $input['time_control'] ?? '10+5';
    $rounds_count = $input['rounds_count'] ?? 7;
    $admin_id = current_admin_id();
    
    if (!$name || !$slug) {
        http_response_code(400);
        echo json_encode(['error' => 'Name and slug are required']);
        exit;
    }

    try {
        DB::query(
            "INSERT INTO tournaments (name, slug, type, time_control, rounds_count, admin_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [$name, $slug, $type, $time_control, $rounds_count, $admin_id, time()]
        );
        $id = DB::get()->lastInsertId();
        echo json_encode(DB::fetch("SELECT * FROM tournaments WHERE id = ?", [$id]));
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode(['error' => 'Slug already exists or database error']);
    }
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
}
