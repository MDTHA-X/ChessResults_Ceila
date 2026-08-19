<?php
// includes/scoring.php

$REAL_RESULTS = ["1-0", "0-1", "1/2"];

function pointsForPlayer($result, $isWhite) {
    switch ($result) {
        case "1-0":
            return $isWhite ? 1 : 0;
        case "0-1":
            return $isWhite ? 0 : 1;
        case "1/2":
            return 0.5;
        case "+":
            return $isWhite ? 1 : 0;
        case "-":
            return $isWhite ? 0 : 1;
        default:
            return 0;
    }
}

function computeStandings($players, $games) {
    global $REAL_RESULTS;
    $agg = [];
    $playersById = [];

    foreach ($players as $p) {
        $playersById[$p['id']] = $p;
        $agg[$p['id']] = [
            'score' => 0, 'wins' => 0, 'draws' => 0, 'losses' => 0, 'byes' => 0, 'played' => 0,
            'opponents' => [], 'realOpponentIds' => [], 'oppRatings' => [],
            'whiteCount' => 0, 'blackCount' => 0, 'games' => []
        ];
    }

    // Pass 1: scores
    foreach ($games as $g) {
        if ($g['is_bye'] && $g['bye_for_id'] !== null) {
            if (isset($agg[$g['bye_for_id']])) {
                $agg[$g['bye_for_id']]['score'] += 0.5;
                $agg[$g['bye_for_id']]['draws'] += 1;
                $agg[$g['bye_for_id']]['byes'] += 1;
                $agg[$g['bye_for_id']]['games'][] = ['round' => $g['round'], 'opponentId' => null, 'opponentName' => null, 'color' => null, 'result' => null, 'isBye' => true];
            }
            continue;
        }
        if ($g['white_id'] === null || $g['black_id'] === null || $g['result'] === null) continue;
        if (!isset($agg[$g['white_id']]) || !isset($agg[$g['black_id']])) continue;

        $isReal = in_array($g['result'], $REAL_RESULTS);
        $wPoints = pointsForPlayer($g['result'], true);
        $bPoints = pointsForPlayer($g['result'], false);

        $agg[$g['white_id']]['score'] += $wPoints;
        $agg[$g['black_id']]['score'] += $bPoints;

        if ($wPoints == 1) $agg[$g['white_id']]['wins'] += 1;
        else if ($wPoints == 0.5) $agg[$g['white_id']]['draws'] += 1;
        else $agg[$g['white_id']]['losses'] += 1;

        if ($bPoints == 1) $agg[$g['black_id']]['wins'] += 1;
        else if ($bPoints == 0.5) $agg[$g['black_id']]['draws'] += 1;
        else $agg[$g['black_id']]['losses'] += 1;

        if ($isReal) {
            $agg[$g['white_id']]['played'] += 1;
            $agg[$g['black_id']]['played'] += 1;
            $agg[$g['white_id']]['whiteCount'] += 1;
            $agg[$g['black_id']]['blackCount'] += 1;
        }

        $agg[$g['white_id']]['opponents'][] = ['id' => $g['black_id'], 'score' => 0, 'real' => $isReal];
        $agg[$g['black_id']]['opponents'][] = ['id' => $g['white_id'], 'score' => 0, 'real' => $isReal];

        if ($isReal) {
            $agg[$g['white_id']]['realOpponentIds'][] = $g['black_id'];
            $agg[$g['black_id']]['realOpponentIds'][] = $g['white_id'];
            if (isset($playersById[$g['black_id']])) $agg[$g['white_id']]['oppRatings'][] = $playersById[$g['black_id']]['rating'];
            if (isset($playersById[$g['white_id']])) $agg[$g['black_id']]['oppRatings'][] = $playersById[$g['white_id']]['rating'];
        }

        $agg[$g['white_id']]['games'][] = ['round' => $g['round'], 'opponentId' => $g['black_id'], 'opponentName' => $playersById[$g['black_id']]['name'] ?? null, 'color' => 'w', 'result' => $g['result'], 'isBye' => false];
        $agg[$g['black_id']]['games'][] = ['round' => $g['round'], 'opponentId' => $g['white_id'], 'opponentName' => $playersById[$g['white_id']]['name'] ?? null, 'color' => 'b', 'result' => $g['result'], 'isBye' => false];
    }

    // Opponent scores for Buchholz
    foreach ($games as $g) {
        if ($g['white_id'] === null || $g['black_id'] === null || $g['result'] === null) continue;
        if (!isset($agg[$g['white_id']]) || !isset($agg[$g['black_id']])) continue;

        foreach ($agg[$g['white_id']]['opponents'] as &$opp) {
            if ($opp['id'] === $g['black_id']) $opp['score'] = $agg[$g['black_id']]['score'];
        }
        foreach ($agg[$g['black_id']]['opponents'] as &$opp) {
            if ($opp['id'] === $g['white_id']) $opp['score'] = $agg[$g['white_id']]['score'];
        }
    }

    $standings = [];
    foreach ($players as $p) {
        $a = $agg[$p['id']];
        $realOppScores = array_map(function($o) { return $o['score']; }, array_filter($a['opponents'], function($o) { return $o['real']; }));
        $allOppScores = array_map(function($o) { return $o['score']; }, $a['opponents']);
        $buchholz = array_sum($allOppScores) + $a['byes'] * 0.5;

        $medianBuchholz = $buchholz;
        if (count($a['opponents']) >= 3) {
            $sorted = $allOppScores;
            sort($sorted);
            $medianBuchholz = $buchholz - ($sorted[0] ?? 0) - ($sorted[count($sorted) - 1] ?? 0);
        }

        $gameFor = function($oppId) use ($a) {
            foreach ($a['games'] as $g) {
                if (!$g['isBye'] && $g['opponentId'] === $oppId && $g['result'] !== null) return $g;
            }
            return null;
        };

        $sb = 0;
        foreach (array_values($realOppScores) as $i => $score) {
            $game = $gameFor($a['realOpponentIds'][$i]);
            $result = $game ? $game['result'] : null;
            if (!$result) continue;
            if ($result === "1/2") { $sb += $score / 2; continue; }
            $won = ($result === "1-0" && $game['color'] === "w") || ($result === "0-1" && $game['color'] === "b");
            $sb += ($won ? $score : 0);
        }

        $koya = 0;
        foreach ($a['realOpponentIds'] as $oppId) {
            $opp = $agg[$oppId] ?? null;
            $oppGames = $opp ? count($opp['opponents']) + $opp['byes'] : 0;
            if (!$opp || $oppGames === 0 || $opp['score'] < $oppGames / 2) continue;
            $game = $gameFor($oppId);
            $result = $game ? $game['result'] : null;
            if ($result === "1/2") { $koya += 0.5; continue; }
            $won = ($result === "1-0" && $game['color'] === "w") || ($result === "0-1" && $game['color'] === "b");
            $koya += ($won ? 1 : 0);
        }

        $tpr = null;
        if ($a['played'] > 0 && count($a['oppRatings']) > 0) {
            $avg = array_sum($a['oppRatings']) / count($a['oppRatings']);
            $realWins = 0;
            $realLosses = 0;
            foreach ($a['realOpponentIds'] as $oppId) {
                $game = $gameFor($oppId);
                $result = $game ? $game['result'] : null;
                if (!$result) continue;
                $color = $game['color'];
                if (($result === "1-0" && $color === "w") || ($result === "0-1" && $color === "b")) $realWins++;
                if (($result === "0-1" && $color === "w") || ($result === "1-0" && $color === "b")) $realLosses++;
            }
            $tpr = round($avg + (400 * ($realWins - $realLosses)) / $a['played']);
        }

        $standings[] = [
            'playerId' => $p['id'],
            'name' => $p['name'],
            'rating' => $p['rating'],
            'ratingType' => $p['rating_type'],
            'score' => $a['score'],
            'wins' => $a['wins'],
            'draws' => $a['draws'],
            'losses' => $a['losses'],
            'byes' => $a['byes'],
            'played' => $a['played'],
            'buchholz' => round1($buchholz),
            'medianBuchholz' => round1($medianBuchholz),
            'sonnebornBerger' => round1($sb),
            'koya' => round1($koya),
            'tpr' => $tpr,
            'whiteCount' => $a['whiteCount'],
            'blackCount' => $a['blackCount'],
            'games' => $a['games']
        ];
    }

    usort($standings, function($a, $b) use ($games) {
        if ($a['score'] !== $b['score']) return $b['score'] <=> $a['score'];
        if ($a['buchholz'] !== $b['buchholz']) return $b['buchholz'] <=> $a['buchholz'];
        if ($a['medianBuchholz'] !== $b['medianBuchholz']) return $b['medianBuchholz'] <=> $a['medianBuchholz'];
        if ($a['sonnebornBerger'] !== $b['sonnebornBerger']) return $b['sonnebornBerger'] <=> $a['sonnebornBerger'];
        if ($a['koya'] !== $b['koya']) return $b['koya'] <=> $a['koya'];
        if ($a['wins'] !== $b['wins']) return $b['wins'] <=> $a['wins'];
        if ($a['rating'] !== $b['rating']) return $b['rating'] <=> $a['rating'];
        return headToHead($a, $b, $games);
    });

    foreach ($standings as $i => &$s) {
        $s['rank'] = $i + 1;
    }

    return $standings;
}

function headToHead($a, $b, $games) {
    $game = null;
    foreach ($games as $g) {
        if (!$g['is_bye'] && (($g['white_id'] === $a['playerId'] && $g['black_id'] === $b['playerId']) || ($g['white_id'] === $b['playerId'] && $g['black_id'] === $a['playerId'])) && $g['result'] !== null) {
            $game = $g;
            break;
        }
    }
    if (!$game) return 0;
    $aIsWhite = $game['white_id'] === $a['playerId'];
    $aPoints = pointsForPlayer($game['result'], $aIsWhite);
    if ($aPoints === 1) return -1;
    if ($aPoints === 0) return 1;
    return 0;
}

function round1($n) {
    return round($n * 10) / 10;
}
