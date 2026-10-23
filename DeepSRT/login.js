/******/ (() => { // webpackBootstrap
/*!******************!*\
  !*** ./login.js ***!
  \******************/
// Store window ID when page loads
let currentWindowId = null;
chrome.windows.getCurrent(window => {
  currentWindowId = window.id;
  console.log('Current window ID:', currentWindowId);
});
const CLIENT_ID = '97560438297-fmm1llujqijpeveridcb8ovhf96j1j4p.apps.googleusercontent.com';
const REDIRECT_URI = chrome.identity.getRedirectURL();
const SCOPES = ['openid', 'email', 'profile'];

// Log the redirect URI
console.log('Redirect URI:', REDIRECT_URI);
console.log('Login page initialized');

// Listen for messages
chrome.runtime.onMessage.addListener(request => {
  if (request.action === 'login') {
    // Handle login
    chrome.identity.getAuthToken({
      interactive: true
    }, token => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        return;
      }
      if (token) {
        chrome.storage.local.set({
          token
        }, () => {
          console.log('Token saved');
        });
      }
    });
  }
  if (request.action === 'logout') {
    // Handle logout
    chrome.storage.local.remove('token', () => {
      console.log('Token removed');
    });
  }
});
document.getElementById('googleLogin').addEventListener('click', async () => {
  const button = document.getElementById('googleLogin');
  const container = document.querySelector('.login-container');
  button.disabled = true;
  try {
    console.log('Starting authentication process...');
    const result = await authenticate();
    console.log('Authentication result:', result);
    if (result && result.token) {
      console.log('Got token, storing in chrome.storage.local...');

      // Store both token and user info
      await chrome.storage.local.set({
        authToken: result.token,
        userInfo: result.user
      });

      // Verify storage
      const stored = await chrome.storage.local.get(['authToken', 'userInfo']);
      console.log('Stored data:', stored);

      // Update UI to show success
      container.innerHTML = `
        <img src="icons/icon128.png" alt="DeepSRT Logo" class="logo">
        <h2>Login Successful!</h2>
        <p>Welcome ${result.user.email}</p>
        <div class="success-checkmark">✓</div>
      `;

      // Add success styles
      const style = document.createElement('style');
      style.textContent = `
        .success-checkmark {
          font-size: 48px;
          color: #34D399;
          margin-top: 20px;
          animation: popIn 0.5s ease-out;
        }
        @keyframes popIn {
          0% { transform: scale(0); }
          70% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
      `;
      document.head.appendChild(style);

      // Send success message
      chrome.runtime.sendMessage({
        type: 'LOGIN_SUCCESS',
        token: result.token,
        user: result.user
      });

      // Wait for animation and close
      setTimeout(() => {
        console.log('Attempting to close window...');
        window.close();

        // Fallback: try getting the current tab
        chrome.tabs.getCurrent(tab => {
          if (tab) {
            console.log('Found current tab, attempting to close via tabs API...');
            chrome.tabs.remove(tab.id);
          }
        });
      }, 1000);
    } else {
      throw new Error('No token received from authentication');
    }
  } catch (error) {
    console.error('Login failed:', error);
    button.disabled = false;
    container.innerHTML += `
      <p style="color: #EF4444; margin-top: 10px;">
        Authentication failed. Please try again.
      </p>
    `;
  }
});
async function authenticate() {
  console.log('Building auth URL...');
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.append('client_id', CLIENT_ID);
  authUrl.searchParams.append('response_type', 'token');
  authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.append('scope', SCOPES.join(' '));
  console.log('Starting web auth flow...');
  try {
    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true
    });
    console.log('Got response URL:', responseUrl);
    if (responseUrl) {
      const url = new URL(responseUrl);
      const params = new URLSearchParams(url.hash.substring(1));
      const token = params.get('access_token');
      if (token) {
        console.log('Token extracted, verifying...');
        const userInfo = await verifyToken(token);
        console.log('User info received:', userInfo);
        return {
          token,
          user: userInfo
        };
      }
    }
    throw new Error('No token received');
  } catch (error) {
    console.error('Auth flow failed:', error);
    throw error;
  }
}
async function verifyToken(token) {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (!response.ok) {
      throw new Error('Failed to verify token');
    }
    return await response.json();
  } catch (error) {
    console.error('Token verification failed:', error);
    throw error;
  }
}
/******/ })()
;
//# sourceMappingURL=login.js.map