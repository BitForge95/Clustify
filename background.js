const CLIENT_ID = "260872097014-08ehjp48m95p6g4p56d1air497uvcb6g.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/gmail.modify";
const REDIRECT_URI = browser.identity.getRedirectURL();

async function getAuthToken() {
  return new Promise((resolve, reject) => {
    const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}`;

    console.log("OAuth redirect URI →", REDIRECT_URI);
    console.log("Opening auth URL:", authUrl);

    browser.identity.launchWebAuthFlow(
      {
        interactive: true,
        url: authUrl
      },
      (redirectUrl) => {
        if (browser.runtime.lastError || !redirectUrl) {
          reject(browser.runtime.lastError);
          return;
        }

        const params = new URLSearchParams(redirectUrl.split("#")[1]);
        const accessToken = params.get("access_token");

        if (accessToken) {
          console.log("Access Token:", accessToken);
          resolve(accessToken);
        } else {
          reject("No access token received.");
        }
      }
    );
  });
}
