// js/login.js

import { createAuth0Client } from '@auth0/auth0-spa-js';
import { auth0Config } from '/js/auth0_config.js'; // Use root-relative mapped path

document.addEventListener('DOMContentLoaded', async () => {
    const loginButton = document.getElementById('btn-login');
    const errorMessageElement = document.getElementById('error-message');
    let auth0 = null;

    // Helper function to display errors on the login page
    const showError = (message, errorObject = null) => {
        console.error("Login Page Error:", message, errorObject || '');
        if (errorMessageElement) {
            errorMessageElement.textContent = `Error: ${message}. Please try again or contact support.`;
            errorMessageElement.style.display = 'block';
        }
        if (loginButton) {
            loginButton.disabled = true; // Disable button on fatal error
            loginButton.textContent = 'Log In / Sign Up (Error)';
        }
    };

    try {
        console.log("Login.js: Initializing Auth0 client...");
        auth0 = await createAuth0Client({
            domain: auth0Config.domain,
            clientId: auth0Config.clientId,
            authorizationParams: {
                redirect_uri: `${window.location.origin}/landing.html`, // Redirect TO landing page
                scope: 'openid profile email' // <-- ADDED standard scopes for consistency
            },
            cacheLocation: 'localstorage' // <-- ADDED cache location for consistency
        });
        console.log("Login.js: Auth0 client initialized.");

        // Check if the user is returning from Auth0 with an error
        if (window.location.search.includes("error=") || window.location.search.includes("error_description=")) {
            const urlParams = new URLSearchParams(window.location.search);
            const error = urlParams.get('error');
            const errorDescription = urlParams.get('error_description');
            console.error(`Login.js: Auth0 returned an error: ${error} - ${errorDescription}`);
            showError(`Login failed: ${errorDescription || error}`);
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
        }

        // Check if the user is already authenticated
        try {
            if (await auth0.isAuthenticated()) {
                console.log("Login.js: User already authenticated. Redirecting to /landing.html");
                window.location.href = '/landing.html';
                return;
            } else {
                 console.log("Login.js: User not authenticated. Login button enabled.");
                 if (loginButton) loginButton.disabled = false;
            }
        } catch(authCheckError) {
            console.warn("Login.js: Error checking initial authentication state.", authCheckError);
            if (loginButton) loginButton.disabled = false;
        }

    } catch (e) {
        showError(`Failed to initialize authentication system (${e.message || 'Unknown error'})`, e);
        return;
    }

    // Add event listener to the login button
    if (loginButton) {
        loginButton.addEventListener('click', async () => {
            console.log("Login.js: Login button clicked, initiating loginWithRedirect...");
            if (!auth0) {
                showError("Authentication system is not ready. Please refresh.");
                return;
            }

            loginButton.textContent = 'Redirecting to Login...';
            loginButton.disabled = true;
            if (errorMessageElement) errorMessageElement.style.display = 'none';

            try {
                // The scopes requested here should ideally match those needed later
                // They were already included in the client initialization config above
                await auth0.loginWithRedirect();
            } catch (e) {
                 showError(`Login redirect failed (${e.message || 'Unknown error'})`, e);
                 loginButton.textContent = 'Log In / Sign Up';
            }
        });
    } else {
        showError("Critical: Login button element (#btn-login) not found in the HTML.");
    }
});
