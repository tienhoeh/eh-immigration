// js/login.js

import { createAuth0Client } from '@auth0/auth0-spa-js'; // Make sure this path matches your import map
import { auth0Config } from './auth0_config.js';         // Make sure this path is correct

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
                // This is where Auth0 will redirect the user AFTER successful login or signup
                // It should point to your post-login landing page.
                redirect_uri: `${window.location.origin}/landing.html`
                // You can add 'audience' or 'scope' here if needed for API access later
                // audience: 'YOUR_API_IDENTIFIER',
                // scope: 'openid profile email',
            }
        });
        console.log("Login.js: Auth0 client initialized.");

        // Check if the user is returning from Auth0 with an error
        if (window.location.search.includes("error=") || window.location.search.includes("error_description=")) {
            const urlParams = new URLSearchParams(window.location.search);
            const error = urlParams.get('error');
            const errorDescription = urlParams.get('error_description');
            console.error(`Login.js: Auth0 returned an error: ${error} - ${errorDescription}`);
            showError(`Login failed: ${errorDescription || error}`);
            // Clean the URL
            window.history.replaceState({}, document.title, window.location.pathname);
            return; // Stop further execution
        }

        // Check if the user is already authenticated (e.g., via an existing session)
        // This can happen if they were logged in, closed the tab, and reopened it.
        try {
            if (await auth0.isAuthenticated()) {
                console.log("Login.js: User already authenticated. Redirecting to /landing.html");
                window.location.href = '/landing.html'; // Redirect to the main app page
                return; // Stop further processing on this page
            } else {
                 console.log("Login.js: User not authenticated. Login button enabled.");
                 if (loginButton) loginButton.disabled = false; // Ensure button is enabled
            }
        } catch(authCheckError) {
            console.warn("Login.js: Error checking initial authentication state. User will be treated as not authenticated.", authCheckError);
            // This error might happen due to cookie/storage issues, but allow login attempt.
            if (loginButton) loginButton.disabled = false;
        }

    } catch (e) {
        // This catches errors during createAuth0Client initialization
        showError(`Failed to initialize authentication system (${e.message || 'Unknown error'})`, e);
        return; // Stop if init fails
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
            if (errorMessageElement) errorMessageElement.style.display = 'none'; // Hide previous errors

            try {
                // This will redirect the user to the Auth0 Universal Login page
                await auth0.loginWithRedirect();
                // The browser will navigate away from this page.
                // Code after this line will likely not execute immediately.
            } catch (e) {
                 showError(`Login redirect failed (${e.message || 'Unknown error'})`, e);
                 loginButton.textContent = 'Log In / Sign Up'; // Reset button text
                 // Consider if button should be re-enabled or prompt a refresh.
                 // For now, keeping it disabled if redirect call itself fails, as something is wrong.
            }
        });
    } else {
        showError("Critical: Login button element (#btn-login) not found in the HTML.");
    }
});
