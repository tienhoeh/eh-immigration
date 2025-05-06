// landing.js
import { createAuth0Client } from '@auth0/auth0-spa-js';
import { auth0Config } from './auth0_config.js'; // Import shared config

document.addEventListener('DOMContentLoaded', async () => {
    const contentElement = document.getElementById('content');
    const userEmailElement = document.getElementById('user-email');
    const logoutButton = document.getElementById('btn-logout');
    const authStatusElement = document.getElementById('auth-status');

    let auth0 = null;

    const showLoginRedirect = (message) => {
        console.log(message);
        authStatusElement.textContent = `${message}. Redirecting to login...`;
        // Redirect to login page after a short delay
        setTimeout(() => {
            window.location.href = '/login.html'; // Adjust path if login page is elsewhere
        }, 1500);
    };

    try {
        console.log("Initializing Auth0 client on landing page...");
        auth0 = await createAuth0Client({
            domain: auth0Config.domain,
            clientId: auth0Config.clientId,
             authorizationParams: {
                 // The redirect URI here should match the one used during login initiation
                 // Usually this page itself if login redirects here.
                 redirect_uri: window.location.origin + window.location.pathname // Current page URL
             }
        });
        console.log("Auth0 client initialized on landing page.");

        // --- Handle Redirect Callback ---
        if (window.location.search.includes("code=") && window.location.search.includes("state=")) {
            console.log("Detected Auth0 callback parameters.");
            authStatusElement.textContent = 'Processing login...';
            try {
                await auth0.handleRedirectCallback();
                console.log("Handled redirect callback successfully.");
                // Clean the URL (remove code and state parameters)
                window.history.replaceState({}, document.title, window.location.pathname);
                console.log("URL cleaned.");
                // Proceed to check authentication status below
            } catch (e) {
                console.error("Error handling redirect callback:", e);
                showLoginRedirect(`Login processing failed: ${e.message}`);
                return; // Stop execution
            }
        }

        // --- Check Authentication Status ---
        console.log("Checking authentication status...");
        authStatusElement.textContent = 'Verifying login status...';
        const isAuthenticated = await auth0.isAuthenticated();
        console.log("Is Authenticated:", isAuthenticated);

        if (isAuthenticated) {
            // --- User is Logged In ---
            authStatusElement.style.display = 'none'; // Hide status message
            console.log("User is authenticated. Fetching profile...");
            const user = await auth0.getUser();
            console.log("User profile:", user);

            if (userEmailElement) {
                userEmailElement.textContent = user?.email || 'User'; // Display email or 'User'
            }

            if (logoutButton) {
                logoutButton.addEventListener('click', () => {
                    console.log("Logout button clicked.");
                    auth0.logout({
                        logoutParams: {
                            // Specify where to return after logout at Auth0
                            returnTo: `${window.location.origin}/login.html` // Redirect back to login page
                        }
                    });
                });
            } else {
                 console.error("Logout button not found");
            }

            // Show the main content
            if (contentElement) {
                contentElement.classList.remove('hidden');
            } else {
                 console.error("Main content container not found");
            }

        } else {
            // --- User is Not Logged In ---
            showLoginRedirect("User not authenticated");
        }

    } catch (e) {
        // Catch errors during initialization or initial auth check
        showLoginRedirect(`Error initializing authentication: ${e.message}`);
    }
});