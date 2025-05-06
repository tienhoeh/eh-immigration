// login.js
import { createAuth0Client } from '@auth0/auth0-spa-js';
import { auth0Config } from './auth0_config.js'; // Import shared config

document.addEventListener('DOMContentLoaded', async () => {
    const loginButton = document.getElementById('btn-login');
    const errorMessageElement = document.getElementById('error-message');
    let auth0 = null;

    const showError = (message) => {
        console.error("Login Page Error:", message);
        errorMessageElement.textContent = `Error: ${message}. Please try again or contact support.`;
        errorMessageElement.style.display = 'block';
        loginButton.disabled = true; // Disable button on fatal error
    };

    try {
        console.log("Initializing Auth0 client on login page...");
        auth0 = await createAuth0Client({
            domain: auth0Config.domain,
            clientId: auth0Config.clientId,
             authorizationParams: {
                 // Specify the page Auth0 should redirect TO after successful login
                 redirect_uri: `${window.location.origin}/landing.html` // Points to your landing page
             }
             // You can add audience/scope here if needed later
        });
        console.log("Auth0 client initialized for login.");

        // Check if user is already authenticated (e.g., session exists)
        // If so, redirect them directly to the landing page without needing a click
        try {
            if (await auth0.isAuthenticated()) {
                console.log("User already authenticated, redirecting to landing page...");
                window.location.href = '/landing.html'; // Adjust path if needed
                return; // Stop further execution on this page
            } else {
                 console.log("User not authenticated, login button enabled.");
                 loginButton.disabled = false; // Ensure button is enabled
            }
        } catch(authCheckError) {
            // Errors during isAuthenticated are possible, treat as not authenticated
             console.warn("Error checking initial authentication state:", authCheckError);
             loginButton.disabled = false; // Allow login attempt
        }


    } catch (e) {
        showError(`Failed to initialize authentication system (${e.message})`);
        return; // Stop if init fails
    }

    // Add event listener to the login button
    if (loginButton) {
        loginButton.addEventListener('click', async () => {
            console.log("Login button clicked, initiating loginWithRedirect...");
            loginButton.textContent = 'Redirecting...';
            loginButton.disabled = true;
            errorMessageElement.style.display = 'none'; // Hide previous errors
            try {
                await auth0.loginWithRedirect();
                // Browser redirects from here...
            } catch (e) {
                 showError(`Login redirect failed (${e.message})`);
                 loginButton.textContent = 'Log In / Sign Up'; // Reset button text
                 // Re-enable button maybe? Or prompt refresh? For now, keep disabled on error.
            }
        });
    } else {
        showError("Login button element not found.");
    }
});