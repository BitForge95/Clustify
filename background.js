const CLIENT_ID = "494456271943-4hhnth42rf95i6ooatvfuao3tq89m1fl.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/gmail.modify";
const REDIRECT_URI = browser.identity.getRedirectURL();

// Function to start OAuth2 and return an access token
async function getAuthToken() {
  return new Promise((resolve, reject) => {
    const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}`;

    browser.identity.launchWebAuthFlow(
      {
        interactive: true,
        url: authUrl
      },
      (redirectUrl) => {
        if (browser.runtime.lastError || !redirectUrl) {
          console.error("OAuth error:", browser.runtime.lastError);
          reject(browser.runtime.lastError || "No redirect URL");
          return;
        }

        // Parse out the token from the redirect URL fragment
        const fragment = redirectUrl.split("#")[1];
        const params = new URLSearchParams(fragment);
        const accessToken = params.get("access_token");

        if (accessToken) {
          console.log("✅ Got access token:", accessToken);
          resolve(accessToken);
        } else {
          reject("No access token found in redirect URL");
        }
      }
    );
  });
}

// Listen for messages from popup.js
browser.runtime.onMessage.addListener((message) => {
  if (message.action === "getToken") {
    return getAuthToken();
  }
});
