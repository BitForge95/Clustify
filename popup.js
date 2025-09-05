const authBtn = document.getElementById("authBtn");
const deletePromotionsBtn = document.getElementById("deletePromotionsBtn");
const countLostFoundBtn = document.getElementById("countLostFoundBtn");
const deleteLostFoundBtn = document.getElementById("deleteLostFoundBtn");
const deleteAllBtn = document.getElementById("deleteAllBtn");
const status = document.getElementById("status");
const keywordInput = document.getElementById("keywordInput");
const countKeywordBtn = document.getElementById("countKeywordBtn");
const deleteKeywordBtn = document.getElementById("deleteKeywordBtn");
let authToken = null;

const previewModal = document.getElementById("previewModal");
const previewList = document.getElementById("previewList");
const previewDeleteBtn = document.getElementById("previewDeleteBtn");
const previewCancelBtn = document.getElementById("previewCancelBtn");

// ==================== UI STATE ====================
function updateUIState(isAuthenticated) {
  if (isAuthenticated) {
    status.textContent = "Connected to Gmail ✅";
    deletePromotionsBtn.disabled = false;
    countLostFoundBtn.disabled = false;
    deleteLostFoundBtn.disabled = false;
    deleteAllBtn.disabled = false;
    keywordInput.disabled = false;
    countKeywordBtn.disabled = false;
    deleteKeywordBtn.disabled = false;
    authBtn.textContent = "Connected ✅";
    authBtn.disabled = true;
    authBtn.style.backgroundColor = "#34a853";
  } else {
    status.textContent = "Click Connect Gmail to start";
    deletePromotionsBtn.disabled = true;
    countLostFoundBtn.disabled = true;
    deleteLostFoundBtn.disabled = true;
    deleteAllBtn.disabled = true;
    keywordInput.disabled = true;
    countKeywordBtn.disabled = true;
    deleteKeywordBtn.disabled = true;
    authBtn.textContent = "Connect Gmail";
    authBtn.disabled = false;
    authBtn.style.backgroundColor = "#4285F4";
  }
}

// ==================== BACKGROUND MESSAGING ====================
function sendMessageToBackground(action) {
  return new Promise((resolve, reject) => {
    browser.runtime.sendMessage({ action }, (response) => {
      if (browser.runtime.lastError) reject(browser.runtime.lastError);
      else if (!response) reject(new Error(`No response for ${action}`));
      else if (response.success) resolve(response);
      else reject(new Error(response.error || `${action} failed`));
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

// ==================== EMAIL DELETION ====================
async function deleteEmailsByQuery(query, description) {
  await validateAndRefreshToken();
  const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  const data = await listRes.json();
  if (!data.messages || data.messages.length === 0) {
    status.textContent = `No ${description} found 🎉`;
    return;
  }
  const ids = data.messages.map(m => m.id);
  const batchSize = 1000;
  let deleted = 0;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/batchDelete", {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ids: batch })
    });
    deleted += batch.length;
  }
  status.textContent = `Deleted ${deleted} ${description} ✅`;
}

// ==================== COUNT EMAILS ====================
async function countEmailsByQuery(query, description) {
  await validateAndRefreshToken();
  const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${authToken}` }
  });
  const data = await listRes.json();
  const count = data.messages ? data.messages.length : 0;
  status.textContent = count ? `Found ${count} ${description} 📊` : `No ${description} found 🎉`;
  return count;
}

// ==================== LOST & FOUND QUERY ====================
function getLostFoundQuery() {
  return `
    subject:("lost and found" OR "lost & found" OR "lost+found" OR "lostandfound" OR 
             "lost item" OR "found item" OR "missing item" OR "recovered item" OR
             "lost property" OR "found property" OR "campus lost" OR "office lost" OR
             "security lost" OR "lost department") OR
    body:("lost and found" OR "lost & found" OR "missing item" OR "found item" OR
          "lost property" OR "found property" OR "please claim" OR "unclaimed item" OR
          "security office" OR "lost items")
  `.replace(/\s+/g, ' ').trim();
}

// ==================== SUBJECT PREVIEW ====================
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
  previewList.innerHTML = "";
  for (const msg of data.messages) {
    const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    const msgData = await msgRes.json();
    const header = msgData.payload.headers.find(h => h.name === "Subject");
    const li = document.createElement("li");
    li.textContent = header ? header.value : "(no subject)";
    previewList.appendChild(li);
  }
  previewModal.style.display = "flex";
  return new Promise(resolve => {
    previewDeleteBtn.onclick = () => { previewModal.style.display = "none"; resolve(true); };
    previewCancelBtn.onclick = () => { previewModal.style.display = "none"; resolve(false); };
  });
}

// ==================== EVENT LISTENERS ====================
deletePromotionsBtn.addEventListener("click", async () => {
  const ok = await showSubjectPreview("category:promotions is:unread", "unread promotional emails");
  if (ok) await deleteEmailsByQuery("category:promotions is:unread", "unread promotional emails");
});

countLostFoundBtn.addEventListener("click", async () => {
  const query = getLostFoundQuery();
  await countEmailsByQuery(query, "lost and found emails");
});

deleteLostFoundBtn.addEventListener("click", async () => {
  const query = getLostFoundQuery();
  const ok = await showSubjectPreview(query, "lost and found emails");
  if (ok) await deleteEmailsByQuery(query, "lost and found emails");
});

deleteAllBtn.addEventListener("click", async () => {
  if (!confirm("Delete promotions AND lost & found emails?")) return;
  await deleteEmailsByQuery("category:promotions is:unread", "unread promotional emails");
  await deleteEmailsByQuery(getLostFoundQuery(), "lost and found emails");
});

countKeywordBtn.addEventListener("click", async () => {
  const keyword = keywordInput.value.trim();
  if (!keyword) { status.textContent="Enter a keyword."; return; }
  await countEmailsByQuery(`"${keyword}"`, `emails with keyword "${keyword}"`);
});

deleteKeywordBtn.addEventListener("click", async () => {
  const keyword = keywordInput.value.trim();
  if (!keyword) { status.textContent="Enter a keyword."; return; }
  const ok = await showSubjectPreview(`"${keyword}"`, `emails with keyword "${keyword}"`);
  if (ok) await deleteEmailsByQuery(`"${keyword}"`, `emails with keyword "${keyword}"`);
});

// ==================== AUTH ====================
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
    authBtn.disabled = false;
    authBtn.textContent = "Connect Gmail";
    authBtn.style.backgroundColor = "#4285F4";
    updateUIState(false);
  }
});

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const resp = await sendMessageToBackground('checkToken');
    if (resp.hasValidToken) { authToken = resp.token; updateUIState(true); }
    else updateUIState(false);
  } catch { updateUIState(false); }
});
