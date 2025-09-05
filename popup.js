const authBtn = document.getElementById("authBtn");
const deleteBtn = document.getElementById("deleteBtn");
const status = document.getElementById("status");

let authToken = null;

authBtn.addEventListener("click", async () => {
  try {
    authToken = await browser.runtime.sendMessage({ action: "getToken" });

    if (!authToken || typeof authToken !== "string") {
      throw new Error("No valid access token received");
    }

    status.textContent = "Connected to Gmail ✅";
    deleteBtn.disabled = false;
  } catch (err) {
    console.error("Authentication failed:", err);
    status.textContent = "Authentication failed ❌";
  }
});


deleteBtn.addEventListener("click", async () => {
  if (!authToken) return;

  status.textContent = "Finding promotional emails...";

  // Step 1: Find unread promotional emails
  const listRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=category:promotions is:unread",
    {
      headers: { Authorization: `Bearer ${authToken}` }
    }
  );

  const data = await listRes.json();
  if (!data.messages || data.messages.length === 0) {
    status.textContent = "No unread promotions 🎉";
    return;
  }

  const ids = data.messages.map(msg => msg.id);

  // Step 2: Delete them
  await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/messages/batchDelete",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ids })
    }
  );

  status.textContent = `Deleted ${ids.length} unread promotional emails 🧹`;
});
