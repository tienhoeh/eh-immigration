// js/questionnaire_simple_test.js

import { initializeAuth } from './auth_check.js'; // Use the common auth checker

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Questionnaire_Simple_Test.js - DOMContentLoaded event fired.");

    // --- Elements for this simplified page ---
    const pageContent = document.getElementById('page-content'); // The main wrapper to show/hide
    const authStatusElement = document.getElementById('auth-status');
    const userEmailElement = document.getElementById('user-email'); // In header
    const logoutButton = document.getElementById('btn-logout'); // In header
    const containerDiv = document.querySelector('.container'); // Main content container

    // --- State Variables ---
    let auth0 = null;
    let currentUser = null;
    let currentUserId = 'anonymous';

    // ==================================
    //  Initialization Flow & Auth Check
    // ==================================
    try {
        console.log("Questionnaire_Simple_Test.js - Initializing Auth0 and checking auth...");
        if(authStatusElement) authStatusElement.style.display = 'block'; // Show status
        if(containerDiv) containerDiv.classList.add('is-loading'); // Ensure content hidden

        // Call the common authentication check function
        const initResult = await initializeAuth();
        auth0 = initResult.auth0;
        currentUser = initResult.user;
        currentUserId = initResult.userId;

        // --- Authentication Success: Show the basic page structure ---
        console.log("Questionnaire_Simple_Test.js - User authenticated:", currentUserId);
        if(authStatusElement) authStatusElement.textContent = 'Authentication successful!';
        if(authStatusElement) authStatusElement.className = 'success'; // Style as success

        // Show main page content wrapper
        if(pageContent) pageContent.classList.remove('hidden');
        // Show container (which includes nav and main area)
        if(containerDiv) {
            containerDiv.classList.remove('is-loading');
            containerDiv.classList.add('is-visible');
        }

        // Display user info in header
        if(userEmailElement && currentUser) userEmailElement.textContent = currentUser.email || 'User';
        if (logoutButton) {
             logoutButton.addEventListener('click', () => {
                 auth0.logout({ logoutParams: { returnTo: `${window.location.origin}/` } });
             });
         } else {
            console.error("Logout button not found in simplified test page.");
         }

        console.log("Questionnaire_Simple_Test.js - Simplified page setup complete.");

    } catch (e) {
        // Errors during initializeAuth() usually cause redirect via auth_check.js
        // This catch handles other unexpected errors.
        console.error("Questionnaire_Simple_Test.js - Fatal Error during setup:", e);
        if (authStatusElement) {
            authStatusElement.textContent = `Error: ${e.message}. Please try logging in again.`;
            authStatusElement.className = 'error'; // Style as error
        }
         if(containerDiv) containerDiv.classList.remove('is-visible'); // Ensure hidden on error
         if(containerDiv) containerDiv.classList.add('is-loading');
    } finally {
         // Hide specific loading text even on error (error shown in authStatusElement)
         // if(authLoadingElement) authLoadingElement.style.display = 'none';
         // We don't have a separate loading element here, authStatusElement serves that purpose
         console.log("Questionnaire_Simple_Test.js - Auth check process finished.");
    }

}); // End DOMContentLoaded
