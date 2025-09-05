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

let authToken = null;

// ==================== UI STATE ====================
function updateUIState(isAuthenticated) {
  const isEnabled = isAuthenticated;
  status.textContent = isEnabled ? "Connected to Gmail" : "Click Connect Gmail to start";
  keywordInput.disabled = !isEnabled;
  countKeywordBtn.disabled = !isEnabled;
  deleteKeywordBtn.disabled = !isEnabled;

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
/**
 * Fetches ALL message IDs for a query, handling multiple pages.
 * @param {string} query - The Gmail search query.
 * @returns {Promise<string[]>} - A promise that resolves to an array of all message IDs.
 */
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
// This function correctly fetches only the first page for a quick preview.
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

// ==================== EVENT LISTENERS ====================
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
  if (!keyword) { status.textContent="Enter a keyword."; return; }
  try {
    const ok = await showSubjectPreview(`"${keyword}"`, `emails with keyword "${keyword}"`);
    if (ok) await deleteEmailsByQuery(`"${keyword}"`, `emails with keyword "${keyword}"`);
  } catch (err) {
    status.textContent = `Error: ${err.message}`;
  }
});

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