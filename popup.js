const authBtn = document.getElementById("authBtn");
const deletePromotionsBtn = document.getElementById("deletePromotionsBtn");
const countLostFoundBtn = document.getElementById("countLostFoundBtn");
const deleteLostFoundBtn = document.getElementById("deleteLostFoundBtn");
const deleteAllBtn = document.getElementById("deleteAllBtn");
const status = document.getElementById("status");
let authToken = null;

console.log("🚀 MailPilot popup.js loaded");

authBtn.addEventListener("click", async () => {
  console.log("🔐 Authentication button clicked");
  status.textContent = "Authenticating... 🔐";
  
  try {
    console.log("📤 Sending auth request to background script");
    authToken = await browser.runtime.sendMessage({ action: "getToken" });
    
    console.log("📥 Auth response received:", {
      tokenExists: !!authToken,
      tokenType: typeof authToken,
      tokenLength: authToken ? authToken.length : 0,
      tokenPreview: authToken ? authToken.substring(0, 20) + "..." : "null"
    });
    
    if (!authToken || typeof authToken !== "string") {
      throw new Error("No valid access token received");
    }
    
    console.log("✅ Authentication successful");
    status.textContent = "Connected to Gmail ✅";
    deletePromotionsBtn.disabled = false;
    countLostFoundBtn.disabled = false;
    deleteLostFoundBtn.disabled = false;
    deleteAllBtn.disabled = false;
  } catch (err) {
    console.error("❌ Authentication failed:", err);
    status.textContent = "Authentication failed ❌";
    deletePromotionsBtn.disabled = true;
    countLostFoundBtn.disabled = true;
    deleteLostFoundBtn.disabled = true;
    deleteAllBtn.disabled = true;
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

// Function to count emails by query
async function countEmailsByQuery(query, description) {
  console.log(`🔢 Starting ${description} count`);
  console.log("Query:", query);
  
  if (!authToken) {
    console.error("❌ No auth token available");
    return;
  }
  
  try {
    status.textContent = `Counting ${description}... 🔍`;
    console.log(`📡 Making API request to count ${description}`);
    
    const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}`;
    console.log("Search URL:", searchUrl);
    
    // Find emails matching the query
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
    
    // Display results
    if (count === 0) {
      console.log(`🎉 No ${description} found`);
      status.textContent = `No ${description} found 🎉`;
    } else {
      console.log(`📊 Found ${count} ${description}`);
      status.textContent = `Found ${count} ${description} 📊`;
      
      // If there might be more results (when nextPageToken exists), show estimate
      if (data.nextPageToken && estimate > count) {
        status.textContent += ` (${estimate} estimated total)`;
      }
    }
    
    return count;
    
  } catch (err) {
    console.error("💥 Error during counting:", {
      error: err.message,
      stack: err.stack,
      query: query,
      description: description
    });
    status.textContent = "Error occurred while counting ❌";
    return 0;
  }
}

// Function to delete emails by query with extensive logging
async function deleteEmailsByQuery(query, description) {
  console.log(`🔍 Starting ${description} cleanup`);
  console.log("Query:", query);
  
  if (!authToken) {
    console.error("❌ No auth token available");
    return;
  }
  
  try {
    status.textContent = `Finding ${description}... 📬`;
    console.log(`📡 Making API request to find ${description}`);
    
    const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}`;
    console.log("Search URL:", searchUrl);
    
    // Step 1: Find emails matching the query
    const listRes = await fetch(searchUrl, {
      headers: { 
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log("📊 Search response status:", listRes.status);
    console.log("📊 Search response headers:", Object.fromEntries(listRes.headers.entries()));
    
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
      nextPageToken: data.nextPageToken || "none",
      fullResponse: data
    });
    
    if (!data.messages || data.messages.length === 0) {
      console.log(`🎉 No ${description} found`);
      status.textContent = `No ${description} found 🎉`;
      return;
    }
    
    const ids = data.messages.map(msg => msg.id);
    console.log("📝 Email IDs to delete:", ids);
    console.log(`🗑️ Preparing to delete ${ids.length} emails`);
    
    status.textContent = `Deleting ${ids.length} ${description}... 🧹`;
    
    // Step 2: Delete them in batches (Gmail API has a limit of 1000 per batch)
    const batchSize = 1000;
    let totalDeleted = 0;
    
    console.log(`📦 Processing in batches of ${batchSize}`);
    
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      console.log(`🔄 Processing batch ${Math.floor(i/batchSize) + 1}, emails ${i + 1}-${Math.min(i + batchSize, ids.length)}`);
      console.log("Batch IDs:", batch);
      
      const deletePayload = { ids: batch };
      console.log("Delete payload:", deletePayload);
      
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
          errorBody: errorText,
          batchSize: batch.length,
          batchIds: batch
        });
        throw new Error(`Failed to delete messages: ${deleteRes.status} ${deleteRes.statusText}`);
      }
      
      totalDeleted += batch.length;
      console.log(`✅ Successfully deleted batch of ${batch.length} emails. Total deleted: ${totalDeleted}`);
      
      // Update status for large deletions
      if (ids.length > batchSize) {
        status.textContent = `Deleted ${totalDeleted}/${ids.length} ${description}... 🧹`;
      }
    }
    
    console.log(`🎉 Cleanup complete! Deleted ${totalDeleted} ${description}`);
    status.textContent = `Deleted ${totalDeleted} ${description} ✅`;
    
  } catch (err) {
    console.error("💥 Error during deletion:", {
      error: err.message,
      stack: err.stack,
      query: query,
      description: description
    });
    status.textContent = "Error occurred ❌";
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
  
  // Delete promotions first
  console.log("🛒 Starting promotional emails deletion");
  await deleteEmailsByQuery("category:promotions is:unread", "unread promotional emails");
  
  // Then delete lost and found
  console.log("🔍 Starting lost and found emails deletion");
  const lostFoundQuery = getLostFoundQuery();
  await deleteEmailsByQuery(lostFoundQuery, "lost and found emails");
  
  console.log("🎉 Complete cleanup finished!");
  status.textContent = "Cleanup complete! 🎉";
});

console.log("✅ All event listeners attached");