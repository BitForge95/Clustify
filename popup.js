const authBtn = document.getElementById("authBtn");
const deletePromotionsBtn = document.getElementById("deletePromotionsBtn");
const countLostFoundBtn = document.getElementById("countLostFoundBtn");
const deleteLostFoundBtn = document.getElementById("deleteLostFoundBtn");
const deleteAllBtn = document.getElementById("deleteAllBtn");
const status = document.getElementById("status");
let authToken = null;

console.log("🚀 MailPilot popup.js loaded");

// Function to update UI state based on authentication status
function updateUIState(isAuthenticated) {
  if (isAuthenticated) {
    console.log("✅ Updating UI to authenticated state");
    status.textContent = "Connected to Gmail ✅";
    deletePromotionsBtn.disabled = false;
    countLostFoundBtn.disabled = false;
    deleteLostFoundBtn.disabled = false;
    deleteAllBtn.disabled = false;
    authBtn.textContent = "Connected ✅";
    authBtn.disabled = true;
    authBtn.style.backgroundColor = "#34a853";
  } else {
    console.log("❌ Updating UI to unauthenticated state");
    status.textContent = "Click Connect Gmail to start";
    deletePromotionsBtn.disabled = true;
    countLostFoundBtn.disabled = true;
    deleteLostFoundBtn.disabled = true;
    deleteAllBtn.disabled = true;
    authBtn.textContent = "Connect Gmail";
    authBtn.disabled = false;
    authBtn.style.backgroundColor = "#4285F4";
  }
}

// Send message with proper error handling
function sendMessageToBackground(action) {
  return new Promise((resolve, reject) => {
    console.log(`📤 Sending ${action} request to background`);
    
    browser.runtime.sendMessage({ action: action }, (response) => {
      if (browser.runtime.lastError) {
        console.error(`❌ Runtime error for ${action}:`, browser.runtime.lastError);
        reject(browser.runtime.lastError);
        return;
      }
      
      console.log(`📥 Response for ${action}:`, response);
      
      if (!response) {
        reject(new Error(`No response received for ${action}`));
        return;
      }
      
      if (response.success) {
        resolve(response);
      } else {
        reject(new Error(response.error || `${action} failed`));
      }
    });
  });
}

// Check if we already have a stored token on popup load
document.addEventListener('DOMContentLoaded', async () => {
  console.log("📋 Popup loaded, checking for existing auth");
  
  try {
    const response = await sendMessageToBackground('checkToken');
    
    if (response.hasValidToken && response.token) {
      console.log("🔑 Found valid stored token");
      authToken = response.token;
      updateUIState(true);
    } else {
      console.log("❌ No valid stored token found");
      updateUIState(false);
    }
  } catch (err) {
    console.log("❌ Error checking stored token:", err);
    updateUIState(false);
  }
});

authBtn.addEventListener("click", async () => {
  console.log("🔐 Authentication button clicked");
  status.textContent = "Authenticating... 🔐";
  authBtn.disabled = true;
  authBtn.textContent = "Connecting...";
  
  try {
    const response = await sendMessageToBackground('getToken');
    
    if (!response.token || typeof response.token !== "string" || response.token.length < 50) {
      throw new Error(`Invalid access token received: ${response.token}`);
    }
    
    authToken = response.token;
    
    console.log("✅ Authentication successful");
    updateUIState(true);
    
  } catch (err) {
    console.error("❌ Authentication failed:", err);
    authToken = null;
    
    // Clear any stored token on auth failure
    try {
      await sendMessageToBackground('clearToken');
    } catch (clearError) {
      console.error("❌ Error clearing token:", clearError);
    }
    
    status.textContent = `Authentication failed: ${err.message} ❌`;
    authBtn.disabled = false;
    authBtn.textContent = "Connect Gmail";
    authBtn.style.backgroundColor = "#4285F4";
    updateUIState(false);
  }
});

// Function to get the Lost & Found search query
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

// Function to validate token before making API calls
async function validateAndRefreshToken() {
  if (!authToken) {
    throw new Error("No authentication token available. Please connect to Gmail first.");
  }
  
  // Test the token with a simple API call
  try {
    const testResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { 
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (testResponse.status === 401) {
      console.log("🔄 Token expired, clearing stored token");
      authToken = null;
      await sendMessageToBackground('clearToken');
      updateUIState(false);
      throw new Error("Token expired. Please reconnect to Gmail.");
    }
    
    if (!testResponse.ok) {
      throw new Error(`Token validation failed: ${testResponse.status}`);
    }
    
    return true;
  } catch (err) {
    console.error("❌ Token validation failed:", err);
    throw err;
  }
}

// Function to count emails by query
async function countEmailsByQuery(query, description) {
  console.log(`🔢 Starting ${description} count`);
  console.log("Query:", query);
  
  try {
    await validateAndRefreshToken();
    
    status.textContent = `Counting ${description}... 🔍`;
    console.log(`📡 Making API request to count ${description}`);
    
    const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}`;
    console.log("Search URL:", searchUrl);
    
    const listRes = await fetch(searchUrl, {
      headers: { 
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log("📊 Search response status:", listRes.status);
    
    if (!listRes.ok) {
      const errorText = await listRes.text();
      console.error("❌ Search request failed:", {
        status: listRes.status,
        statusText: listRes.statusText,
        errorBody: errorText
      });
      throw new Error(`Failed to list messages: ${listRes.status} ${listRes.statusText}`);
    }
    
    const data = await listRes.json();
    const count = data.messages ? data.messages.length : 0;
    const estimate = data.resultSizeEstimate || 0;
    
    console.log("📋 Count results:", {
      actualCount: count,
      estimatedCount: estimate,
      hasNextPage: !!data.nextPageToken
    });
    
    if (count === 0) {
      console.log(`🎉 No ${description} found`);
      status.textContent = `No ${description} found 🎉`;
    } else {
      console.log(`📊 Found ${count} ${description}`);
      status.textContent = `Found ${count} ${description} 📊`;
      
      if (data.nextPageToken && estimate > count) {
        status.textContent += ` (${estimate} estimated total)`;
      }
    }
    
    return count;
    
  } catch (err) {
    console.error("💥 Error during counting:", err);
    status.textContent = `Error: ${err.message} ❌`;
    return 0;
  }
}

// Function to delete emails by query with extensive logging
async function deleteEmailsByQuery(query, description) {
  console.log(`🔍 Starting ${description} cleanup`);
  console.log("Query:", query);
  
  try {
    await validateAndRefreshToken();
    
    status.textContent = `Finding ${description}... 📬`;
    console.log(`📡 Making API request to find ${description}`);
    
    const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}`;
    console.log("Search URL:", searchUrl);
    
    const listRes = await fetch(searchUrl, {
      headers: { 
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log("📊 Search response status:", listRes.status);
    
    if (!listRes.ok) {
      const errorText = await listRes.text();
      console.error("❌ Search request failed:", {
        status: listRes.status,
        statusText: listRes.statusText,
        errorBody: errorText
      });
      throw new Error(`Failed to list messages: ${listRes.status} ${listRes.statusText}`);
    }
    
    const data = await listRes.json();
    console.log("📋 Search results:", {
      messagesFound: data.messages ? data.messages.length : 0,
      resultSizeEstimate: data.resultSizeEstimate,
      nextPageToken: data.nextPageToken || "none"
    });
    
    if (!data.messages || data.messages.length === 0) {
      console.log(`🎉 No ${description} found`);
      status.textContent = `No ${description} found 🎉`;
      return;
    }
    
    const ids = data.messages.map(msg => msg.id);
    console.log(`🗑️ Preparing to delete ${ids.length} emails`);
    
    status.textContent = `Deleting ${ids.length} ${description}... 🧹`;
    
    const batchSize = 1000;
    let totalDeleted = 0;
    
    console.log(`📦 Processing in batches of ${batchSize}`);
    
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      console.log(`🔄 Processing batch ${Math.floor(i/batchSize) + 1}, emails ${i + 1}-${Math.min(i + batchSize, ids.length)}`);
      
      const deletePayload = { ids: batch };
      
      const deleteRes = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/batchDelete",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(deletePayload)
        }
      );
      
      console.log(`📊 Delete batch response status: ${deleteRes.status}`);
      
      if (!deleteRes.ok) {
        const errorText = await deleteRes.text();
        console.error("❌ Delete request failed:", {
          status: deleteRes.status,
          statusText: deleteRes.statusText,
          errorBody: errorText
        });
        throw new Error(`Failed to delete messages: ${deleteRes.status} ${deleteRes.statusText}`);
      }
      
      totalDeleted += batch.length;
      console.log(`✅ Successfully deleted batch of ${batch.length} emails. Total deleted: ${totalDeleted}`);
      
      if (ids.length > batchSize) {
        status.textContent = `Deleted ${totalDeleted}/${ids.length} ${description}... 🧹`;
      }
    }
    
    console.log(`🎉 Cleanup complete! Deleted ${totalDeleted} ${description}`);
    status.textContent = `Deleted ${totalDeleted} ${description} ✅`;
    
  } catch (err) {
    console.error("💥 Error during deletion:", err);
    status.textContent = `Error: ${err.message} ❌`;
  }
}

// Delete unread promotional emails
deletePromotionsBtn.addEventListener("click", async () => {
  console.log("🛒 Delete promotions button clicked");
  await deleteEmailsByQuery("category:promotions is:unread", "unread promotional emails");
});

// Count lost and found emails
countLostFoundBtn.addEventListener("click", async () => {
  console.log("🔢 Count Lost & Found button clicked");
  const query = getLostFoundQuery();
  console.log("🔍 Lost & Found count query:", query);
  await countEmailsByQuery(query, "lost and found emails");
});

// Delete lost and found emails with comprehensive search
deleteLostFoundBtn.addEventListener("click", async () => {
  console.log("🔍 Delete Lost & Found button clicked");
  const query = getLostFoundQuery();
  console.log("🔍 Lost & Found search query:", query);
  await deleteEmailsByQuery(query, "lost and found emails");
});

// Delete both promotional and lost & found emails
deleteAllBtn.addEventListener("click", async () => {
  console.log("🚨 Delete All button clicked");
  
  if (!confirm("Are you sure you want to delete both unread promotions AND lost & found emails?")) {
    console.log("❌ User cancelled delete all operation");
    return;
  }
  
  console.log("✅ User confirmed delete all operation");
  
  console.log("🛒 Starting promotional emails deletion");
  await deleteEmailsByQuery("category:promotions is:unread", "unread promotional emails");
  
  console.log("🔍 Starting lost and found emails deletion");
  const lostFoundQuery = getLostFoundQuery();
  await deleteEmailsByQuery(lostFoundQuery, "lost and found emails");
  
  console.log("🎉 Complete cleanup finished!");
  status.textContent = "Cleanup complete! 🎉";
});

console.log("✅ All event listeners attached");