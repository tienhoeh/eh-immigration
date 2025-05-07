// js/landing.js
import { initializeAuth } from './auth_check.js'; // Use the common checker

document.addEventListener('DOMContentLoaded', async () => {
    const pageContent = document.getElementById('page-content');
    const userEmailElement = document.getElementById('user-email');
    const logoutButton = document.getElementById('btn-logout');
    const authStatusElement = document.getElementById('auth-status');

    try {
        const { auth0, user } = await initializeAuth(); // Wait for auth check/redirect

        // If initializeAuth succeeded, user is authenticated
        if(authStatusElement) authStatusElement.style.display = 'none';
        if(pageContent) pageContent.classList.remove('hidden');

        if (userEmailElement && user) {
            userEmailElement.textContent = user.email || 'Authenticated User';
        }

        if (logoutButton) {
            logoutButton.addEventListener('click', () => {
                console.log("Landing: Logout clicked.");
                auth0.logout({
                    logoutParams: { returnTo: `${window.location.origin}/` } // Return to login page (index.html)
                });
            });
        }

    } catch (e) {
        // Error handled by auth_check (redirect or message)
        console.error("Landing page could not initialize due to auth error:", e);
        if(authStatusElement) authStatusElement.textContent = "Authentication failed. Please try logging in again.";
    }
});
