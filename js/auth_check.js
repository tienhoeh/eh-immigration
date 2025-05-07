// js/auth_check.js
import { createAuth0Client } from '@auth0/auth0-spa-js';
import { auth0Config } from './auth0_config.js';

let auth0Client = null;
let userProfile = null;
let userId = 'anonymous';
let initializing = false;
let initPromise = null;

async function initializeAuth() {
    if (auth0Client) return auth0Client; // Already initialized
    if (initializing) return initPromise; // Initialization in progress

    initializing = true;
    const loadingEl = document.getElementById('auth-status'); // Common element ID

    initPromise = new Promise(async (resolve, reject) => {
        try {
            if(loadingEl) loadingEl.textContent = 'Initializing authentication...';
            auth0Client = await createAuth0Client({
                domain: auth0Config.domain,
                clientId: auth0Config.clientId,
                authorizationParams: {
                    redirect_uri: window.location.origin + window.location.pathname // Use current page for callback checking
                }
            });
            console.log("Auth0 client initialized via auth_check.");

             // Handle callback AFTER init
             if (window.location.search.includes("code=") && window.location.search.includes("state=")) {
                 console.log("auth_check: Handling redirect callback...");
                 if(loadingEl) loadingEl.textContent = 'Processing login...';
                 try {
                     await auth0Client.handleRedirectCallback();
                     window.history.replaceState({}, document.title, window.location.pathname); // Clean URL
                     console.log("auth_check: Callback handled.");
                 } catch (e) {
                      console.error("auth_check: Error handling redirect callback:", e);
                      // Don't reject here, let isAuthenticated check handle it
                 }
             }

            const isAuthenticated = await auth0Client.isAuthenticated();
            console.log("auth_check: Is Authenticated:", isAuthenticated);

            if (isAuthenticated) {
                userProfile = await auth0Client.getUser();
                userId = userProfile?.sub || 'anonymous_authenticated';
                console.log("auth_check: User authenticated.", userId);
                if(loadingEl) loadingEl.style.display = 'none';
                resolve({ auth0: auth0Client, user: userProfile, userId: userId });
            } else {
                console.log("auth_check: User not authenticated. Redirecting to login.");
                if(loadingEl) loadingEl.textContent = 'Redirecting to login...';
                // Don't reject, just redirect
                window.location.href = '/'; // Redirect to root (index.html/login page)
            }

        } catch (e) {
            console.error("auth_check: Fatal Error during Auth0 setup:", e);
            if (loadingEl) loadingEl.textContent = `Error: ${e.message}. Please try again.`;
             reject(e); // Reject the promise on fatal error
        } finally {
            initializing = false;
        }
    });
    return initPromise;
}

// Expose the initialization function and potentially the client/user later
export { initializeAuth };
// Usage in other files: import { initializeAuth } from '/js/auth_check.js';
// try { const { auth0, user, userId } = await initializeAuth(); /* proceed */ } catch(e) { /* handle error */}
