// js/upload.js
import { initializeAuth } from './auth_check.js';

document.addEventListener('DOMContentLoaded', async () => {
    const pageContent = document.getElementById('page-content');
    const userEmailElement = document.getElementById('user-email');
    const logoutButton = document.getElementById('btn-logout');
    const authStatusElement = document.getElementById('auth-status');

    try {
        const { auth0, user } = await initializeAuth(); // Auth check

        if(authStatusElement) authStatusElement.style.display = 'none';
        if(pageContent) pageContent.classList.remove('hidden');

        if (userEmailElement && user) userEmailElement.textContent = user.email || 'User';
        if (logoutButton) {
             logoutButton.addEventListener('click', () => {
                 auth0.logout({ logoutParams: { returnTo: `${window.location.origin}/` } });
             });
         }
         // Add upload logic here later

    } catch (e) { console.error("Upload page could not initialize:", e); }
});
