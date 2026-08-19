<?php
require_once __DIR__ . '/../includes/auth.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $tournament_id = $_GET['tournament_id'] ?? null;
    if (!$tournament_id) {
        http_response_code(400);
        echo json_encode(['error' => 'tournament_id is required']);
        exit;
    }
    $players = DB::fetchAll("SELECT * FROM players WHERE tournament_id = ? ORDER BY name ASC", [$tournament_id]);
    echo json_encode($players);
} else if ($method === 'POST') {
    require_login();
    $input = json_decode(file_get_contents('php://input'), true);
    $tournament_id = $input['tournament_id'] ?? null;
    $name = $input['name'] ?? '';
    $rating = $input['rating'] ?? 1200;
    
    if (!$tournament_id || !$name) {
        http_response_code(400);
        echo json_encode(['error' => 'tournament_id and name are required']);
        exit;
    }

    try {
        DB::query(
            "INSERT INTO players (tournament_id, name, rating) VALUES (?, ?, ?)",
            [$tournament_id, $name, $rating]
        );
        $id = DB::get()->lastInsertId();
        echo json_encode(DB::fetch("SELECT * FROM players WHERE id = ?", [$id]));
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode(['error' => 'Player name already exists in this tournament']);
    }
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
}
