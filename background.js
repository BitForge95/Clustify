const CLIENT_ID = "494456271943-4hhnth42rf95i6ooatvfuao3tq89m1fl.apps.googleusercontent.com";
const SCOPES = "https://mail.google.com/";
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
    console.log("🚀 Launching web auth flow");
    
    browser.identity.launchWebAuthFlow(
      {
        interactive: true,
        url: authUrl
      },
      async (redirectUrl) => {
        console.log("📥 Auth flow completed");
        console.log("🔗 Redirect URL:", redirectUrl);
        
        if (browser.runtime.lastError || !redirectUrl) {
          console.error("💥 OAuth error:", browser.runtime.lastError);
          reject(browser.runtime.lastError || "No redirect URL");
          return;
        }
        
        console.log("🔍 Parsing redirect URL for token");
        
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
        
        // Check if we got the correct scopes
        if (scope) {
          const grantedScopes = decodeURIComponent(scope).split(' ');
          console.log("🔐 Granted scopes:", grantedScopes);
          
          const requiredScopes = SCOPES.split(' ');
          console.log("🔐 Required scopes:", requiredScopes);
          
          const hasAllScopes = requiredScopes.every(required => 
            grantedScopes.some(granted => granted.includes(required))
          );
          
          console.log("✅ Has all required scopes:", hasAllScopes);
          if (!hasAllScopes) {
            console.warn("⚠️ Missing some required scopes!");
            console.warn("   Granted:", grantedScopes);
            console.warn("   Required:", requiredScopes);
            console.warn("   Missing:", requiredScopes.filter(req => 
              !grantedScopes.some(granted => granted.includes(req))
            ));
          }
        }
        
        if (accessToken) {
          console.log("✅ Got access token successfully");
          
          // Store the token immediately
          try {
            await browser.storage.local.set({ 
              authToken: accessToken,
              tokenExpiry: Date.now() + (parseInt(expiresIn) * 1000)
            });
            console.log("💾 Token stored in background successfully");
          } catch (storageError) {
            console.error("❌ Failed to store token:", storageError);
          }
          
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
    console.log("🔄 Getting fresh token (user clicked connect)");
    
    getAuthToken()
      .then(token => {
        console.log("✅ Token obtained successfully in background");
        console.log("📤 Sending token back to popup");
        sendResponse({ success: true, token: token });
      })
      .catch(error => {
        console.error("❌ Token acquisition failed in background:", error);
        sendResponse({ success: false, error: error.message || error });
      });
    
    return true;
  }
  
  if (message.action === "checkToken") {
    console.log("🔍 Checking token status");
    
    browser.storage.local.get(['authToken', 'tokenExpiry'])
      .then(stored => {
        const hasValidToken = stored.authToken && stored.tokenExpiry && Date.now() < stored.tokenExpiry;
        console.log("📊 Token status:", {
          hasToken: !!stored.authToken,
          hasExpiry: !!stored.tokenExpiry,
          isValid: hasValidToken
        });
        
        sendResponse({ 
          success: true, 
          hasValidToken: hasValidToken,
          token: hasValidToken ? stored.authToken : null
        });
      })
      .catch(error => {
        console.error("❌ Error checking token:", error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true;
  }
  
  if (message.action === "clearToken") {
    console.log("🗑️ Clearing stored token");
    
    browser.storage.local.remove(['authToken', 'tokenExpiry'])
      .then(() => {
        console.log("✅ Token cleared successfully");
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error("❌ Error clearing token:", error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true;
  }
  
  console.log("❓ Unknown message action:", message.action);
});

console.log("✅ Background script message listener attached");