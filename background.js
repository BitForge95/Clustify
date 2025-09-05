const CLIENT_ID = "494456271943-4hhnth42rf95i6ooatvfuao3tq89m1fl.apps.googleusercontent.com";
// FIXED: Changed from gmail.modify to gmail.readonly and gmail.modify combined
const SCOPES = "https://www.googleapis.com/auth/gmail.modify";
const REDIRECT_URI = browser.identity.getRedirectURL();

console.log("🚀 MailPilot background.js loaded");
console.log("🔧 Configuration:", {
  CLIENT_ID: CLIENT_ID,
  SCOPES: SCOPES,
  REDIRECT_URI: REDIRECT_URI
});

async function getAuthToken() {
  console.log("🔐 Starting OAuth2 authentication flow");
  
  return new Promise((resolve, reject) => {
    const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}`;
    
    console.log("🌐 Auth URL:", authUrl);
    console.log("📋 Auth URL breakdown:", {
      baseUrl: "https://accounts.google.com/o/oauth2/auth",
      clientId: CLIENT_ID,
      responseType: "token",
      redirectUri: REDIRECT_URI,
      scope: SCOPES
    });
    
    console.log("🚀 Launching web auth flow");


    
    browser.identity.launchWebAuthFlow(
      {
        interactive: true,
        url: authUrl
      },
      (redirectUrl) => {
        console.log("📥 Auth flow completed");
        console.log("🔗 Redirect URL:", redirectUrl);
        console.log("❌ Runtime error:", browser.runtime.lastError);
        
        if (browser.runtime.lastError || !redirectUrl) {
          console.error("💥 OAuth error:", browser.runtime.lastError);
          reject(browser.runtime.lastError || "No redirect URL");
          return;
        }
        
        console.log("🔍 Parsing redirect URL for token");
        
        // Parse out the token from the redirect URL fragment
        const fragment = redirectUrl.split("#")[1];
        console.log("🧩 URL fragment:", fragment);
        
        if (!fragment) {
          console.error("❌ No fragment found in redirect URL");
          reject("No fragment found in redirect URL");
          return;
        }
        
        const params = new URLSearchParams(fragment);
        console.log("📝 URL parameters:", Object.fromEntries(params.entries()));
        
        const accessToken = params.get("access_token");
        const tokenType = params.get("token_type");
        const expiresIn = params.get("expires_in");
        const scope = params.get("scope");
        
        console.log("🎫 Token details:", {
          hasAccessToken: !!accessToken,
          tokenLength: accessToken ? accessToken.length : 0,
          tokenType: tokenType,
          expiresIn: expiresIn,
          scope: scope,
          tokenPreview: accessToken ? accessToken.substring(0, 20) + "..." : "none"
        });
        
        // ADDED: Check if we got the correct scopes
        if (scope) {
          const grantedScopes = decodeURIComponent(scope).split(' ');
          console.log("🔐 Granted scopes:", grantedScopes);
          
          const requiredScopes = SCOPES.split(' ');
          const hasAllScopes = requiredScopes.every(required => 
            grantedScopes.some(granted => granted.includes(required.split('/').pop()))
          );
          
          console.log("✅ Has all required scopes:", hasAllScopes);
          if (!hasAllScopes) {
            console.warn("⚠️ Missing some required scopes. Granted:", grantedScopes, "Required:", requiredScopes);
          }
        }

        console.log(browser.identity.getRedirectURL());

        
        if (accessToken) {
          console.log("✅ Got access token successfully");
          resolve(accessToken);
        } else {
          console.error("❌ No access token found in redirect URL");
          console.error("Available parameters:", Object.fromEntries(params.entries()));
          reject("No access token found in redirect URL");
        }
      }
    );
  });
}

// Listen for messages from popup.js
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("📨 Message received in background:", {
    message: message,
    sender: sender,
    action: message?.action
  });
  
  if (message.action === "getToken") {
    console.log("🎯 Processing getToken request");
    
    // Return a promise for async handling
    getAuthToken()
      .then(token => {
        console.log("✅ Token obtained successfully in background");
        console.log("📤 Sending token back to popup");
        sendResponse(token);
      })
      .catch(error => {
        console.error("❌ Token acquisition failed in background:", error);
        sendResponse(null);
      });
    
    // Return true to indicate we'll send a response asynchronously
    return true;
  }
  
  console.log("❓ Unknown message action:", message.action);
});

console.log("✅ Background script message listener attached");