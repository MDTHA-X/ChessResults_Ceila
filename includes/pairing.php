<?php
// includes/pairing.php
require_once __DIR__ . '/scoring.php';

const PAIR_INF = 100000;
const REPEAT_PENALTY = 10;

function searchBudget($n) {
    return $n <= 16 ? 300000 : 10000;
}

function colorState($playerId, $games) {
    $diff = 0;
    $lastColors = [];
    foreach ($games as $g) {
        if ($g['is_bye'] || $g['white_id'] === null || $g['black_id'] === null) continue;
        if ($g['white_id'] === $playerId) {
            $diff += 1;
            $lastColors[] = 'w';
        } else if ($g['black_id'] === $playerId) {
            $diff -= 1;
            $lastColors[] = 'b';
        }
    }
    return ['diff' => $diff, 'lastColors' => $lastColors];
}

function colorPenalty($state, $color, $strict) {
    $newDiff = $state['diff'] + ($color === 'w' ? 1 : -1);
    if ($strict && abs($newDiff) > 2) return ['penalty' => PAIR_INF, 'ok' => false];
    
    $last = count($state['lastColors']) > 0 ? $state['lastColors'][count($state['lastColors']) - 1] : null;
    $streak = 1;
    if ($last === $color) {
        for ($i = count($state['lastColors']) - 1; $i >= 0 && $state['lastColors'][$i] === $color; $i--) {
            $streak++;
        }
        $streak--; // Fix: loop counted one extra
    } else {
        $streak = 1;
    }
    
    if ($strict && $streak >= 3) return ['penalty' => PAIR_INF, 'ok' => false];
    
    $due = 'w';
    if ($state['diff'] > 0) $due = 'b';
    else if ($state['diff'] < 0) $due = 'w';
    else if ($last === 'w') $due = 'b';
    else $due = 'w';
    
    $penalty = ($color === $due ? 0 : 1) + (abs($newDiff) === 2 ? 2 : 0);
    if (!$strict) {
        $penalty += max(0, abs($newDiff) - 2) * 1000;
        if ($streak >= 3) $penalty += 1000;
    }
    return ['penalty' => $penalty, 'ok' => true];
}

function playedBefore($a, $b, $games) {
    foreach ($games as $g) {
        if (!$g['is_bye'] && (($g['white_id'] === $a && $g['black_id'] === $b) || ($g['white_id'] === $b && $g['black_id'] === $a))) {
            return true;
        }
    }
    return false;
}

function bestOrientation($a, $b, $colorStates, $strictColors) {
    $ca = $colorStates[$a];
    $cb = $colorStates[$b];
    $aw = colorPenalty($ca, 'w', $strictColors);
    $ab = colorPenalty($ca, 'b', $strictColors);
    $bw = colorPenalty($cb, 'w', $strictColors);
    $bb = colorPenalty($cb, 'b', $strictColors);

    $opt1 = $aw['penalty'] + $bb['penalty'];
    $opt2 = $ab['penalty'] + $bw['penalty'];
    $ok1 = $aw['ok'] && $bb['ok'];
    $ok2 = $ab['ok'] && $bw['ok'];

    if (!$ok1 && !$ok2) return ['whiteId' => $a, 'blackId' => $b, 'penalty' => PAIR_INF, 'ok' => false];
    if ($ok1 && !$ok2) return ['whiteId' => $a, 'blackId' => $b, 'penalty' => $opt1, 'ok' => true];
    if (!$ok1 && $ok2) return ['whiteId' => $b, 'blackId' => $a, 'penalty' => $opt2, 'ok' => true];
    if ($opt1 <= $opt2) return ['whiteId' => $a, 'blackId' => $b, 'penalty' => $opt1, 'ok' => true];
    return ['whiteId' => $b, 'blackId' => $a, 'penalty' => $opt2, 'ok' => true];
}

function orientPair($a, $b, $colorStates, $strictColors) {
    $orient = bestOrientation($a, $b, $colorStates, $strictColors);
    if (!$orient['ok']) return ['whiteId' => $a, 'blackId' => $b, 'penalty' => PAIR_INF];
    return ['whiteId' => $orient['whiteId'], 'blackId' => $orient['blackId'], 'penalty' => $orient['penalty']];
}

function searchEven($pool, $games, $colorStates, $options, $maxIterations) {
    $n = count($pool);
    $half = $n / 2;
    $holder = ['best' => null];
    $iterations = 0;
    
    $used = [];
    $pairs = [];

    $partnerPenalty = function($first, $second) use (&$options, &$games, &$colorStates) {
        $repeated = playedBefore($first, $second, $games);
        if (!$options['allowRepeats'] && $repeated) return ['penalty' => PAIR_INF, 'ok' => false];
        $orient = bestOrientation($first, $second, $colorStates, $options['strictColors']);
        if (!$orient['ok']) return ['penalty' => PAIR_INF, 'ok' => false];
        return ['penalty' => $orient['penalty'] + ($options['allowRepeats'] && $repeated ? REPEAT_PENALTY : 0), 'ok' => true];
    };

    $rec = null;
    $rec = function() use (&$iterations, &$maxIterations, &$pairs, &$half, &$holder, &$pool, &$used, &$partnerPenalty, &$n, &$colorStates, &$options, &$games, &$rec) {
        $iterations++;
        if ($iterations > $maxIterations) return false;
        if (count($pairs) == $half) {
            $cost = array_reduce($pairs, function($s, $p) { return $s + $p['penalty']; }, 0);
            if (!$holder['best'] || $cost < $holder['best']['cost']) {
                $holder['best'] = ['pairs' => $pairs, 'cost' => $cost];
                if ($cost === 0) return true;
            }
            return false;
        }
        
        $unused = array_values(array_filter($pool, function($p) use (&$used) { return !isset($used[$p]); }));
        if (count($unused) == 0) return false;
        
        $first = $unused[0];
        $firstIdx = array_search($first, $pool);
        $fewest = INF;
        foreach ($unused as $p) {
            $viable = 0;
            foreach ($unused as $q) {
                if ($q === $p) continue;
                if ($partnerPenalty($p, $q)['ok']) $viable++;
            }
            if ($viable < $fewest) {
                $fewest = $viable;
                $first = $p;
                $firstIdx = array_search($p, $pool);
            }
        }
        
        $used[$first] = true;
        $mirror = ($firstIdx + $half) % $n;
        $candidates = [];
        foreach ($pool as $i => $p) {
            if (!isset($used[$p])) {
                $candidates[] = ['p' => $p, 'i' => $i];
            }
        }
        usort($candidates, function($x, $y) use ($mirror, $n) {
            $distX = min(($x['i'] - $mirror + $n) % $n, ($mirror - $x['i'] + $n) % $n);
            $distY = min(($y['i'] - $mirror + $n) % $n, ($mirror - $y['i'] + $n) % $n);
            return $distX <=> $distY;
        });
        
        foreach ($candidates as $cand) {
            $second = $cand['p'];
            $check = $partnerPenalty($first, $second);
            if (!$check['ok']) continue;
            
            $oriented = orientPair($first, $second, $colorStates, $options['strictColors']);
            if ($options['allowRepeats'] && playedBefore($first, $second, $games)) {
                $oriented['penalty'] += REPEAT_PENALTY;
            }
            $used[$second] = true;
            $pairs[] = $oriented;
            
            if ($rec()) return true;
            
            array_pop($pairs);
            unset($used[$second]);
        }
        
        unset($used[$first]);
        return false;
    };
    
    $rec();
    if (!$holder['best']) return null;
    return ['pairs' => $holder['best']['pairs']];
}

function pairGroup($players, $games, $colorStates, $options, $maxIterations) {
    $pool = $players;
    if (count($pool) % 2 === 1) {
        $floaterCandidates = array_merge([$pool[count($pool) - 1]], array_slice($pool, 0, -1));
        foreach ($floaterCandidates as $floater) {
            $rest = array_values(array_filter($pool, function($p) use ($floater) { return $p !== $floater; }));
            $res = searchEven($rest, $games, $colorStates, $options, $maxIterations);
            if ($res) return ['pairs' => $res['pairs'], 'floater' => $floater, 'allowRepeats' => $options['allowRepeats'], 'colorRelaxed' => !$options['strictColors']];
        }
        return null;
    }
    $res = searchEven($pool, $games, $colorStates, $options, $maxIterations);
    if (!$res) return null;
    return ['pairs' => $res['pairs'], 'floater' => null, 'allowRepeats' => $options['allowRepeats'], 'colorRelaxed' => !$options['strictColors']];
}

function pickBye($ordered, $games) {
    $byeCount = [];
    foreach ($games as $g) {
        if ($g['is_bye'] && $g['bye_for_id'] !== null) {
            if (!isset($byeCount[$g['bye_for_id']])) $byeCount[$g['bye_for_id']] = 0;
            $byeCount[$g['bye_for_id']]++;
        }
    }
    foreach ($ordered as $p) {
        if (!isset($byeCount[$p['id']]) || $byeCount[$p['id']] === 0) return $p['id'];
    }
    return $ordered[count($ordered) - 1]['id'];
}

function pairRound($players, $games) {
    $active = array_values(array_filter($players, function($p) { return $p['active'] == 1; }));
    if (count($active) < 2) {
        $plans = [];
        foreach ($active as $i => $p) {
            $plans[] = ['board' => $i + 1, 'whiteId' => null, 'blackId' => null, 'isBye' => true, 'byeForId' => $p['id']];
        }
        return $plans;
    }
    
    $standings = computeStandings($active, $games);
    $rankById = [];
    foreach ($standings as $i => $s) {
        $rankById[$s['playerId']] = $i;
    }
    
    $ordered = $active;
    usort($ordered, function($a, $b) use ($rankById) {
        return $rankById[$a['id']] <=> $rankById[$b['id']];
    });
    
    $byeFor = count($ordered) % 2 === 1 ? pickBye($ordered, $games) : null;
    $toPair = array_values(array_filter($ordered, function($p) use ($byeFor) { return $p['id'] !== $byeFor; }));
    
    $groups = [];
    $currentScore = null;
    $currentGroup = [];
    $scoreById = [];
    foreach ($standings as $s) {
        $scoreById[$s['playerId']] = $s['score'];
    }
    
    foreach ($toPair as $p) {
        $score = $scoreById[$p['id']];
        if ($currentScore !== $score) {
            if (count($currentGroup) > 0) $groups[] = $currentGroup;
            $currentGroup = [];
            $currentScore = $score;
        }
        $currentGroup[] = $p['id'];
    }
    if (count($currentGroup) > 0) $groups[] = $currentGroup;
    
    $colorStates = [];
    foreach ($active as $p) {
        $colorStates[$p['id']] = colorState($p['id'], $games);
    }
    
    $plans = [];
    $floater = null;
    
    $tryStrict = function($p) use (&$games, &$colorStates) {
        return pairGroup($p, $games, $colorStates, ['allowRepeats' => false, 'strictColors' => true], searchBudget(count($p)));
    };
    
    for ($i = count($groups) - 1; $i > 0; $i--) {
        $g = $groups[$i];
        if (count($g) === 0) continue;
        $sorted = $g;
        usort($sorted, function($a, $b) use ($rankById) { return $rankById[$a] <=> $rankById[$b]; });
        $standalone = $tryStrict($sorted);
        $oddLast = $i === count($groups) - 1 && count($g) % 2 === 1;
        if (!$standalone || $oddLast) {
            $groups[$i - 1] = array_merge($groups[$i - 1], $g);
            $groups[$i] = [];
        }
    }
    
    for ($gi = 0; $gi < count($groups); $gi++) {
        $group = $groups[$gi];
        if (count($group) === 0) continue;
        $pool = $floater !== null ? array_merge([$floater], $group) : $group;
        $sortedPool = $pool;
        usort($sortedPool, function($a, $b) use ($rankById) { return $rankById[$a] <=> $rankById[$b]; });
        
        $withRepeatsStrict = function($p) use (&$games, &$colorStates) {
            return pairGroup($p, $games, $colorStates, ['allowRepeats' => true, 'strictColors' => true], searchBudget(count($p)));
        };
        $withRepeatsRelaxed = function($p) use (&$games, &$colorStates) {
            return pairGroup($p, $games, $colorStates, ['allowRepeats' => true, 'strictColors' => false], searchBudget(count($p)));
        };
        
        $result = $tryStrict($sortedPool);
        if (!$result) {
            $merged = $sortedPool;
            $ng = $gi + 1;
            $lastOk = -1;
            while ($ng < count($groups)) {
                $merged = array_merge($merged, $groups[$ng]);
                $mergedSorted = $merged;
                usort($mergedSorted, function($a, $b) use ($rankById) { return $rankById[$a] <=> $rankById[$b]; });
                $candidate = $tryStrict($mergedSorted) ?? $withRepeatsStrict($mergedSorted) ?? $withRepeatsRelaxed($mergedSorted);
                if ($candidate) {
                    $result = $candidate;
                    $lastOk = $ng;
                    $allNoRepeat = true;
                    foreach ($result['pairs'] as $p) {
                        if (playedBefore($p['whiteId'], $p['blackId'], $games)) $allNoRepeat = false;
                    }
                    if ($allNoRepeat) break;
                }
                $ng++;
            }
            if ($result) {
                for ($k = $gi + 1; $k <= $lastOk; $k++) $groups[$k] = [];
            }
        }
        
        if (!$result) $result = $withRepeatsStrict($sortedPool);
        if (!$result) $result = $withRepeatsRelaxed($sortedPool);
        
        if (!$result) throw new Exception("Unable to pair round");
        
        foreach ($result['pairs'] as $p) {
            $warning = null;
            if ($result['allowRepeats'] && playedBefore($p['whiteId'], $p['blackId'], $games)) {
                $warning = "Repeat pairing (no alternative)";
            } else if ($result['colorRelaxed']) {
                $warning = "Color rule relaxed (no alternative)";
            }
            $plans[] = [
                'board' => count($plans) + 1,
                'whiteId' => $p['whiteId'],
                'blackId' => $p['blackId'],
                'isBye' => false,
                'byeForId' => null,
                'warning' => $warning
            ];
            $colorStates[$p['whiteId']]['diff'] += 1;
            $colorStates[$p['blackId']]['diff'] -= 1;
            $colorStates[$p['whiteId']]['lastColors'][] = 'w';
            $colorStates[$p['blackId']]['lastColors'][] = 'b';
        }
        $floater = $result['floater'];
    }
    
    if ($floater !== null) {
        $plans[] = ['board' => count($plans) + 1, 'whiteId' => null, 'blackId' => null, 'isBye' => true, 'byeForId' => $floater, 'warning' => "Unpaired after float chain"];
    }
    if ($byeFor !== null) {
        $plans[] = ['board' => count($plans) + 1, 'whiteId' => null, 'blackId' => null, 'isBye' => true, 'byeForId' => $byeFor];
    }
    
    return $plans;
}

function validatePlan($plan, $games, $players) {
    $warnings = [];
    $seen = [];
    $nameById = [];
    $activeIds = [];
    foreach ($players as $p) {
        $nameById[$p['id']] = $p['name'];
        if ($p['active'] == 1) $activeIds[$p['id']] = true;
    }
    
    $colorStates = [];
    foreach ($players as $p) {
        if ($p['active'] == 1) $colorStates[$p['id']] = colorState($p['id'], $games);
    }
    
    foreach ($plan as $p) {
        if ($p['isBye']) {
            if ($p['byeForId'] === null) $warnings[] = "Bye without a player";
            else if (isset($seen[$p['byeForId']])) $warnings[] = "Player paired twice";
            else $seen[$p['byeForId']] = true;
            continue;
        }
        if ($p['whiteId'] === null || $p['blackId'] === null) {
            $warnings[] = "Pairing with a missing player";
            continue;
        }
        if (!isset($activeIds[$p['whiteId']]) || !isset($activeIds[$p['blackId']])) {
            $warnings[] = "Pairing references an inactive player";
        }
        if ($p['whiteId'] === $p['blackId']) {
            $warnings[] = "A player paired with themselves";
        }
        if (isset($seen[$p['whiteId']]) || isset($seen[$p['blackId']])) {
            $warnings[] = "Player paired twice";
        }
        $seen[$p['whiteId']] = true;
        $seen[$p['blackId']] = true;
        
        if (playedBefore($p['whiteId'], $p['blackId'], $games)) {
            $wName = $nameById[$p['whiteId']] ?? $p['whiteId'];
            $bName = $nameById[$p['blackId']] ?? $p['blackId'];
            $warnings[] = "$wName vs $bName already played";
        }
        
        foreach ([['id' => $p['whiteId'], 'color' => 'w'], ['id' => $p['blackId'], 'color' => 'b']] as $item) {
            $id = $item['id'];
            $color = $item['color'];
            $st = &$colorStates[$id];
            $res = colorPenalty($st, $color, true);
            if (!$res['ok']) {
                $name = $nameById[$id] ?? $id;
                $warnings[] = "$name gets a third consecutive same color or color imbalance (no alternative)";
            }
            $st['diff'] += $color === 'w' ? 1 : -1;
            $st['lastColors'][] = $color;
        }
    }
    return $warnings;
}
