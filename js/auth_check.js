// js/auth_check.js
import { createAuth0Client } from '@auth0/auth0-spa-js';
import { auth0Config } from '/js/auth0_config.js'; // Use root-relative mapped path

let auth0Client = null;
let userProfile = null;
let userId = 'anonymous';
let initializing = false;
let initPromise = null;

async function initializeAuth() {
    // Prevent re-initialization if already done or in progress
    if (auth0Client) {
        console.log("auth_check: Returning existing client.");
        // Ensure we resolve with the already known client and user state
        const isAuthenticated = await auth0Client.isAuthenticated(); // Re-check might be needed? Or rely on cached state? Let's return cached for now.
        return Promise.resolve({ auth0: auth0Client, user: userProfile, userId: userId });
    }
    if (initializing) {
        console.log("auth_check: Initialization already in progress, returning promise.");
        return initPromise;
    }

    initializing = true;
    const loadingEl = document.getElementById('auth-status'); // Common element ID

    console.log("auth_check: Starting new initialization process.");
    initPromise = new Promise(async (resolve, reject) => {
        try {
            if (loadingEl) loadingEl.textContent = 'Initializing authentication...';

            // Initialize the Auth0 client
            auth0Client = await createAuth0Client({
                domain: auth0Config.domain,
                clientId: auth0Config.clientId,
                // Explicitly add standard OpenID Connect scopes
                authorizationParams: {
                    redirect_uri: window.location.origin + window.location.pathname, // Correct for handling callback on CURRENT page
                    scope: 'openid profile email' // <-- ADDED STANDARD SCOPES
                },
                cacheLocation: 'localstorage' // Use local storage for cache persistence across tabs/sessions (optional but common)
            });
            console.log("Auth0 client initialized via auth_check.");

            // Handle potential redirect callback first (if user just logged in/signed up)
            if (window.location.search.includes("code=") && window.location.search.includes("state=")) {
                 console.log("auth_check: Handling redirect callback...");
                 if(loadingEl) loadingEl.textContent = 'Processing login...';
                 try {
                     // This exchanges the code for tokens and stores them
                     await auth0Client.handleRedirectCallback();
                     // Clean the URL AFTER successful handling
                     window.history.replaceState({}, document.title, window.location.pathname);
                     console.log("auth_check: Callback handled and URL cleaned.");
                 } catch (e) {
                      console.error("auth_check: Error handling redirect callback:", e);
                      // If callback handling fails, user is likely not authenticated.
                      // We reject the promise here as the expected state wasn't achieved.
                      if(loadingEl) loadingEl.textContent = `Login processing error: ${e.message}. Redirecting...`;
                      window.location.href = '/'; // Force redirect to login on callback error
                      reject(e); // Reject the main initialization promise
                      return; // Stop execution within this try block
                 }
            }

            // Now check if the user is authenticated (session might exist, or was just established by callback)
            const isAuthenticated = await auth0Client.isAuthenticated();
            console.log("auth_check: Is Authenticated:", isAuthenticated);

            if (isAuthenticated) {
                userProfile = await auth0Client.getUser(); // Fetch user profile
                userId = userProfile?.sub || 'anonymous_authenticated'; // Get the unique user ID
                console.log("auth_check: User authenticated.", userId, userProfile);
                if(loadingEl) loadingEl.style.display = 'none'; // Hide loading indicator
                resolve({ auth0: auth0Client, user: userProfile, userId: userId }); // Resolve with client, user, id
            } else {
                // If not authenticated (and callback didn't establish it), redirect to login
                console.log("auth_check: User not authenticated. Redirecting to login.");
                if(loadingEl) loadingEl.textContent = 'Authentication required. Redirecting to login...';
                window.location.href = '/'; // Redirect to root (index.html/login page)
                // We don't resolve or reject here, as the redirect handles the flow.
                // Optionally, you could reject to indicate failure to the calling script before redirect.
                 // reject(new Error("User not authenticated"));
            }

        } catch (e) {
            // Catch errors during createAuth0Client or subsequent checks if not caught earlier
            console.error("auth_check: Fatal Error during Auth0 setup:", e);
            if (loadingEl) loadingEl.textContent = `Error: ${e.message}. Please try again.`;
             reject(e); // Reject the promise on fatal error
        } finally {
            initializing = false; // Reset initialization flag
        }
    });
    return initPromise;
}

// Expose the initialization function
export { initializeAuth };
