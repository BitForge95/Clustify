// ==================== DOM ELEMENTS ====================
const authBtn = document.getElementById("authBtn");
const status = document.getElementById("status");
const keywordInput = document.getElementById("keywordInput");
const logoutBtn = document.getElementById("logoutBtn")
const countKeywordBtn = document.getElementById("countKeywordBtn");
const deleteKeywordBtn = document.getElementById("deleteKeywordBtn");

const previewModal = document.getElementById("previewModal");
const previewList = document.getElementById("previewList");
const previewDeleteBtn = document.getElementById("previewDeleteBtn");
const previewCancelBtn = document.getElementById("previewCancelBtn");

// ===== AI Auto-Label DOM (NEW) =====
const labelNameInput = document.getElementById("labelNameInput");
const generateKeywordsBtn = document.getElementById("generateKeywordsBtn");
const applyAutoLabelBtn = document.getElementById("applyAutoLabelBtn");
const generatedKeywords = document.getElementById("generatedKeywords");

let authToken = null;

// ==================== UI STATE ====================
function updateUIState(isAuthenticated) {
  const isEnabled = isAuthenticated;
  status.textContent = isEnabled ? "Connected to Gmail" : "Click Connect Gmail to start";
  keywordInput.disabled = !isEnabled;
  countKeywordBtn.disabled = !isEnabled;
  deleteKeywordBtn.disabled = !isEnabled;

  // NEW: enable/disable labeler controls
  if (labelNameInput) labelNameInput.disabled = !isEnabled;
  if (generateKeywordsBtn) generateKeywordsBtn.disabled = !isEnabled;
  if (applyAutoLabelBtn) applyAutoLabelBtn.disabled = !isEnabled;

  if(isAuthenticated){
    document.getElementById("logoutBtn").style.display = 'block'
  }
  // ✨ Update auth/logout button states
  authBtn.textContent = isEnabled ? "Connected " : "Connect Gmail";
  authBtn.disabled = isEnabled;
  authBtn.style.backgroundColor = isEnabled ? "#34a853" : "#4285F4";
  logoutBtn.disabled = !isEnabled;
}

// ==================== LOGOUT HANDLER ====================
logoutBtn.addEventListener("click", async () => {
  status.textContent = "Logging out...";
  try {
    await sendMessageToBackground("clearToken");
    authToken = null;
    document.getElementById("logoutBtn").style.display = 'none'
    updateUIState(false);
    status.textContent = "Logged out successfully ✅";
  } catch (err) {
    console.error(err);
    status.textContent = `Logout failed ❌`;
  }
});

// ==================== BACKGROUND MESSAGING ====================
function sendMessageToBackground(action, data = {}) {
  return new Promise((resolve, reject) => {
    browser.runtime.sendMessage({ action, ...data }, (response) => {
      if (browser.runtime.lastError) return reject(browser.runtime.lastError);
      if (!response) return reject(new Error(`No response for ${action}`));
      if (response.success) return resolve(response);
      reject(new Error(response.error || `${action} failed`));
    });
  });
}

// ==================== TOKEN VALIDATION ====================
async function validateAndRefreshToken() {
  if (!authToken) throw new Error("No token available. Connect to Gmail first.");
  const testRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  if (testRes.status === 401) {
    authToken = null;
    await sendMessageToBackground("clearToken");
    updateUIState(false);
    throw new Error("Token expired. Please reconnect Gmail.");
  }
  if (!testRes.ok) throw new Error(`Token validation failed: ${testRes.status}`);
  return true;
}

// ==================== NEW: PAGINATION HELPER ====================
async function getAllMessageIds(query) {
  await validateAndRefreshToken();
  let allIds = [];
  let nextPageToken = null;
  const searchUrlBase = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=500`;

  status.textContent = "Finding all matching emails (this may take a moment)...";

  do {
    const searchUrl = nextPageToken ? `${searchUrlBase}&pageToken=${nextPageToken}` : searchUrlBase;
    const response = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (!response.ok) throw new Error(`API Error: ${response.status}`);
    const data = await response.json();
    if (data.messages) {
      allIds.push(...data.messages.map(msg => msg.id));
    }
    nextPageToken = data.nextPageToken;
    status.textContent = `Found ${allIds.length} emails so far...`;
  } while (nextPageToken);

  return allIds;
}

// ==================== UPDATED: EMAIL DELETION ====================
async function deleteEmailsByQuery(query, description) {
  const ids = await getAllMessageIds(query);
  if (ids.length === 0) {
    status.textContent = `No ${description} found to delete 🎉`;
    return;
  }

  status.textContent = `Deleting ${ids.length} ${description}... 🧹`;
  const batchSize = 1000;
  let deletedCount = 0;

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const deleteRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/batchDelete", {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ids: batch })
    });
    if (!deleteRes.ok) throw new Error(`Failed to delete batch: ${deleteRes.status}`);
    deletedCount += batch.length;
    status.textContent = `Deleted ${deletedCount} of ${ids.length} ${description}... 🧹`;
  }

  status.textContent = `Deleted ${deletedCount} ${description} ✅`;
}

// ==================== UPDATED: COUNT EMAILS ====================
async function countEmailsByQuery(query, description) {
  const ids = await getAllMessageIds(query);
  const count = ids.length;
  status.textContent = count ? `Found ${count} ${description} 📊` : `No ${description} found 🎉`;
  return count;
}

// ==================== SUBJECT PREVIEW (UNCHANGED) ====================
async function showSubjectPreview(query, description) {
  await validateAndRefreshToken();
  
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=50`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  const data = await res.json();
  if (!data.messages || data.messages.length === 0) {
    status.textContent = `No ${description} found 🎉`;
    return false;
  }
  previewList.innerHTML = "<li><em>Loading subjects...</em></li>";
  previewModal.style.display = "flex";
  
  const subjectPromises = data.messages.map(msg =>
    fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject`, {
      headers: { Authorization: `Bearer ${authToken}` }
    }).then(res => res.json())
  );
  
  const messages = await Promise.all(subjectPromises);
  previewList.innerHTML = "";
  messages.forEach(msgData => {
    const header = msgData.payload.headers.find(h => h.name === "Subject");
    const li = document.createElement("li");
    li.textContent = header ? header.value : "(no subject)";
    previewList.appendChild(li);
  });

  return new Promise(resolve => {
    previewDeleteBtn.onclick = () => { previewModal.style.display = "none"; resolve(true); };
    previewCancelBtn.onclick = () => { previewModal.style.display = "none"; resolve(false); };
  });
}

// ==================== EXISTING EVENTS ====================
countKeywordBtn.addEventListener("click", async () => {
  const keyword = keywordInput.value.trim();
  if (!keyword) { status.textContent="Enter a keyword."; return; }
  try {
    await countEmailsByQuery(`"${keyword}"`, `emails with keyword "${keyword}"`);
  } catch (err) {
    status.textContent = `Error: ${err.message}`;
  }
});

deleteKeywordBtn.addEventListener("click", async () => {
  const keyword = keywordInput.value.trim();
  // fixed: use comparison instead of assignment
  if (previewDeleteBtn && previewDeleteBtn.textContent === "Apply") {
    previewDeleteBtn.textContent = "Delete";
  }
  if (!keyword) { status.textContent="Enter a keyword."; return; }
  try {
    const ok = await showSubjectPreview(`"${keyword}"`, `emails with keyword "${keyword}"`);
    if (ok) await deleteEmailsByQuery(`"${keyword}"`, `emails with keyword "${keyword}"`);
  } catch (err) {
    status.textContent = `Error: ${err.message}`;
  }
});

// ==================== NEW: AI KEYWORDS + LABELING ====================
async function aiSuggestKeywords(labelName) {
  status.textContent = "Asking Groq LLaMA for keywords...";
  if (previewDeleteBtn) previewDeleteBtn.textContent = "Apply";

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer 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`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "You are an assistant that generates concise Gmail keyword filters." },
          { role: "user", content: `Suggest up to 10 short keywords to filter emails for label: "${labelName}". Return them as a comma-separated list only.` }
        ],
        temperature: 0.4,
        max_tokens: 100
      })
    });

    if (!res.ok) throw new Error(`Groq API error: ${res.status}`);
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim() || "";

    const kws = text
      .split(/[,;\n]+/)
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    if (kws.length) return kws;
  } catch (e) {
    console.warn("Groq AI unavailable, using fallback.", e);
  }

  // --- Fallback heuristic (unchanged) ---
  const base = (labelName || "").toLowerCase().trim();
  const words = Array.from(new Set(base.split(/[\s\-_/]+/).filter(Boolean)));

  const synonyms = {
    travel: ["flight", "airline", "itinerary", "boarding pass", "pnr", "hotel", "booking", "reservation", "uber", "ola", "cab", "train", "irctc", "bus", "indigo", "vistara", "spicejet"],
    receipt: ["invoice", "bill", "payment receipt", "paid", "transaction", "gst", "tax invoice", "amount"],
    newsletter: ["unsubscribe", "newsletter", "digest", "update"],
    promo: ["offer", "deal", "sale", "discount", "coupon", "promo"],
    meeting: ["calendar", "invite", "zoom", "google meet", "teams", "webex", "ics"],
    job: ["application", "interview", "hr", "recruiter", "offer letter"]
  };

  let out = [...words];
  words.forEach(w => { if (synonyms[w]) out.push(...synonyms[w]); });

  if (base && !out.includes(base)) out.push(base);
  out = Array.from(new Set(out)).slice(0, 20);
  return out;
}

function buildGmailQueryFromKeywords(keywords) {
  if (!keywords || keywords.length === 0) return "";
  const esc = s => `"${s.replace(/"/g, '\\"')}"`;
  const any = keywords.map(k => esc(k)).join(" OR ");
  const subj = keywords.map(k => `subject:${esc(k)}`).join(" OR ");
  return `( ${any} OR ${subj} ) -in:trash`;
}

async function ensureLabelExists(name) {
  await validateAndRefreshToken();

  const listRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  if (!listRes.ok) throw new Error(`Failed to list labels: ${listRes.status}`);
  const { labels = [] } = await listRes.json();

  const existing = labels.find(l => l.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;

  const createRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
    method: "POST",
    headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      labelListVisibility: "labelShow",
      messageListVisibility: "show"
    })
  });
  if (!createRes.ok) throw new Error(`Failed to create label: ${createRes.status}`);
  const created = await createRes.json();
  return created.id;
}

async function labelEmailsByQuery(query, labelId, description) {
  const ids = await getAllMessageIds(query);
  if (ids.length === 0) {
    status.textContent = `No ${description} found to label 🎉`;
    return;
  }

  status.textContent = `Labeling ${ids.length} ${description}... 🏷️`;
  const batchSize = 1000;
  let labeled = 0;

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const modRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify", {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ids: batch, addLabelIds: [labelId] })
    });
    if (!modRes.ok) throw new Error(`Failed to label batch: ${modRes.status}`);
    labeled += batch.length;
    status.textContent = `Labeled ${labeled} of ${ids.length} ${description}... 🏷️`;
  }

  status.textContent = `Applied label to ${labeled} ${description} ✅`;
}

// Hook up buttons for AI labeling
if (generateKeywordsBtn) {
  generateKeywordsBtn.addEventListener("click", async () => {
    const label = labelNameInput ? labelNameInput.value.trim() : "";
    if (!label) { status.textContent = "Enter a label name first."; return; }
    try {
      const kws = await aiSuggestKeywords(label);
      if (generatedKeywords) generatedKeywords.value = kws.join(", ");
      status.textContent = `Got ${kws.length} keyword(s) for "${label}". You can edit before applying.`;
      if (generatedKeywords) generatedKeywords.readOnly = false;
    } catch (err) {
      status.textContent = `AI keyword error: ${err.message}`;
    }
  });
}

if (applyAutoLabelBtn) {
  applyAutoLabelBtn.addEventListener("click", async () => {
    const label = labelNameInput ? labelNameInput.value.trim() : "";
    if (!label) { status.textContent = "Enter a label name first."; return; }

    // Use existing keywords if present; otherwise fetch from AI
    let keywords = generatedKeywords && generatedKeywords.value
      ? generatedKeywords.value.split(",").map(s => s.trim()).filter(Boolean)
      : [];

    if (keywords.length === 0) {
      try {
        keywords = await aiSuggestKeywords(label);
        if (generatedKeywords) generatedKeywords.value = keywords.join(", ");
        if (generatedKeywords) generatedKeywords.readOnly = false;
      } catch (e) {
        status.textContent = `AI keyword error: ${e.message}`;
        return;
      }
    }

    const query = buildGmailQueryFromKeywords(keywords);
    if (!query) { status.textContent = "No usable keywords."; return; }

    try {
      const ok = await showSubjectPreview(query, `emails for label "${label}"`);
      if (!ok) { status.textContent = "Canceled."; return; }

      const labelId = await ensureLabelExists(label);
      await labelEmailsByQuery(query, labelId, `emails for label "${label}"`);
    } catch (err) {
      status.textContent = `Error: ${err.message}`;
    }
  });
}

// ==================== AUTH & INIT ====================
authBtn.addEventListener("click", async () => {
  status.textContent = "Authenticating...";
  authBtn.disabled = true;
  authBtn.textContent = "Connecting...";
  try {
    const response = await sendMessageToBackground("getToken");
    authToken = response.token;
    updateUIState(true);
  } catch (err) {
    console.error(err);
    status.textContent = `Auth failed ❌`;
    updateUIState(false);
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const resp = await sendMessageToBackground('checkToken');
    if (resp.hasValidToken) { authToken = resp.token; updateUIState(true); }
    else updateUIState(false);
  } catch { updateUIState(false); }
});