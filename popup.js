const authBtn = document.getElementById("authBtn");
const deleteBtn = document.getElementById("deleteBtn");
const status = document.getElementById("status");

let authToken = null;

authBtn.addEventListener("click", async () => {
  status.textContent = "Authenticating... 🔐";
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
    deleteBtn.disabled = true;
  }
});

deleteBtn.addEventListener("click", async () => {
  if (!authToken) return;

  try {
    status.textContent = "Finding promotional emails... 📬";

    // Step 1: Find unread promotional emails
    const listRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=category:promotions is:unread",
      {
        headers: { Authorization: `Bearer ${authToken}` }
      }
    );

    if (!listRes.ok) throw new Error("Failed to list messages");

    const data = await listRes.json();

    if (!data.messages || data.messages.length === 0) {
      status.textContent = "No unread promotions 🎉";
      return;
    }

    const ids = data.messages.map(msg => msg.id);

    status.textContent = `Deleting ${ids.length} emails... 🧹`;

    // Step 2: Delete them
    const deleteRes = await fetch(
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

    if (!deleteRes.ok) throw new Error("Failed to delete messages");

    status.textContent = `Deleted ${ids.length} unread promotional emails ✅`;
  } catch (err) {
    console.error("Error during deletion:", err);
    status.textContent = "Error occurred ❌";
  }
});
