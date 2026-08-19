<?php
require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/pairing.php';
require_once __DIR__ . '/../includes/scoring.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $tournament_id = $_GET['tournament_id'] ?? null;
    if (!$tournament_id) {
        http_response_code(400);
        echo json_encode(['error' => 'tournament_id is required']);
        exit;
    }
    $rounds = DB::fetchAll("SELECT * FROM rounds WHERE tournament_id = ? ORDER BY number ASC", [$tournament_id]);
    foreach ($rounds as &$r) {
        $r['pairings'] = DB::fetchAll("SELECT * FROM pairings WHERE round_id = ? ORDER BY board ASC", [$r['id']]);
    }
    
    // Also send standings if requested
    if (isset($_GET['standings'])) {
        $players = DB::fetchAll("SELECT * FROM players WHERE tournament_id = ?", [$tournament_id]);
        
        $gamesQuery = "SELECT p.round_id, r.number as round, p.white_id, p.black_id, p.result, p.is_bye, p.bye_for_id 
                       FROM pairings p 
                       JOIN rounds r ON p.round_id = r.id 
                       WHERE r.tournament_id = ? AND r.status = 'completed'";
        $games = DB::fetchAll($gamesQuery, [$tournament_id]);
        
        $standings = computeStandings($players, $games);
        echo json_encode(['rounds' => $rounds, 'standings' => $standings]);
        exit;
    }
    
    echo json_encode($rounds);
} else if ($method === 'POST') {
    require_login();
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $input['action'] ?? null;
    $tournament_id = $input['tournament_id'] ?? null;
    
    if (!$tournament_id) {
        http_response_code(400);
        echo json_encode(['error' => 'tournament_id is required']);
        exit;
    }
    
    if ($action === 'generate') {
        $tournament = DB::fetch("SELECT * FROM tournaments WHERE id = ?", [$tournament_id]);
        $players = DB::fetchAll("SELECT * FROM players WHERE tournament_id = ? AND active = 1", [$tournament_id]);
        
        $gamesQuery = "SELECT p.round_id, r.number as round, p.white_id, p.black_id, p.result, p.is_bye, p.bye_for_id 
                       FROM pairings p 
                       JOIN rounds r ON p.round_id = r.id 
                       WHERE r.tournament_id = ?";
        $games = DB::fetchAll($gamesQuery, [$tournament_id]);
        
        // Find next round number
        $lastRound = DB::fetch("SELECT MAX(number) as max_num FROM rounds WHERE tournament_id = ?", [$tournament_id]);
        $nextNumber = ($lastRound['max_num'] ?? 0) + 1;
        
        if ($nextNumber > $tournament['rounds_count']) {
            http_response_code(400);
            echo json_encode(['error' => 'Tournament has reached maximum rounds']);
            exit;
        }
        
        try {
            $plans = pairRound($players, $games);
            
            DB::get()->beginTransaction();
            DB::query("INSERT INTO rounds (tournament_id, number, status) VALUES (?, ?, 'draft')", [$tournament_id, $nextNumber]);
            $roundId = DB::get()->lastInsertId();
            
            foreach ($plans as $plan) {
                DB::query(
                    "INSERT INTO pairings (round_id, board, white_id, black_id, is_bye, bye_for_id) VALUES (?, ?, ?, ?, ?, ?)",
                    [$roundId, $plan['board'], $plan['whiteId'], $plan['blackId'], $plan['isBye'] ? 1 : 0, $plan['byeForId']]
                );
            }
            DB::get()->commit();
            
            echo json_encode(['success' => true, 'round_id' => $roundId]);
        } catch (Exception $e) {
            if (DB::get()->inTransaction()) {
                DB::get()->rollBack();
            }
            http_response_code(400);
            echo json_encode(['error' => $e->getMessage()]);
        }
    } else if ($action === 'complete') {
        $round_id = $input['round_id'] ?? null;
        if (!$round_id) {
            http_response_code(400);
            echo json_encode(['error' => 'round_id is required']);
            exit;
        }
        DB::query("UPDATE rounds SET status = 'completed' WHERE id = ?", [$round_id]);
        echo json_encode(['success' => true]);
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action']);
    }
} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
}
