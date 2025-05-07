// js/questionnaire.js

import { initializeAuth } from './auth_check.js'; // Use the common auth checker

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Questionnaire.js - DOMContentLoaded event fired.");

    // --- Elements ---
    const pageContent = document.getElementById('page-content');
    const authStatusElement = document.getElementById('auth-status');
    const sideNavLinks = document.querySelectorAll('#side-nav a');
    const iframe = document.getElementById('section-iframe'); // Reference to iframe
    const saveButton = document.getElementById('save-progress');
    const saveStatusElement = document.getElementById('save-status');
    const userEmailElement = document.getElementById('user-email');
    const logoutButton = document.getElementById('btn-logout');
    const containerDiv = document.querySelector('.container');

    // --- State ---
    let auth0 = null;
    let currentUser = null;
    let currentUserId = 'anonymous';
    let fullDraftData = {};
    let isIframeReady = false; // Flag to track if iframe has sent SECTION_READY

    // ==================================
    //  Initialization Flow & Auth Check
    // ==================================
    try {
        console.log("Questionnaire.js - Initializing Auth0 and checking auth...");
        if(authStatusElement) authStatusElement.style.display = 'block';
        if(containerDiv) containerDiv.classList.add('is-loading');

        // --- STEP 1: Perform Auth Check FIRST ---
        const initResult = await initializeAuth();
        auth0 = initResult.auth0;
        currentUser = initResult.user;
        currentUserId = initResult.userId;

        // --- STEP 2: Auth Success - Setup Parent Page UI ---
        console.log("Questionnaire.js - User authenticated:", currentUserId);
        if(authStatusElement) authStatusElement.style.display = 'none';
        if(pageContent) pageContent.classList.remove('hidden');
        if(containerDiv) {
            containerDiv.classList.remove('is-loading');
            containerDiv.classList.add('is-visible');
        }
        if(saveButton) saveButton.disabled = false;

        // Display user info
        if(userEmailElement && currentUser) userEmailElement.textContent = currentUser.email || 'User';
        if (logoutButton) {
             logoutButton.addEventListener('click', () => {
                 auth0.logout({ logoutParams: { returnTo: `${window.location.origin}/` } });
             });
         }

        // --- STEP 3: Load Parent Data & Setup Parent Listeners (including iframe messages) ---
        loadOverallDraft(); // Load parent's draft state
        setupMessageListenerFromIframe(); // Setup listener for iframe communication BEFORE setting up things that depend on it
        setupSaveDraftButton(); // Setup save button interaction (will use postMessage)
        setupSideNavigation(); // Setup nav links (will change iframe src)

        console.log("Questionnaire.js - Parent page setup complete.");
        // Note: The iframe's initial src is set in HTML. Its 'onload' or 'SECTION_READY' message will trigger data sending TO it.

    } catch (err) {
        console.error("Questionnaire.js - Fatal Error during setup:", err);
         if (authStatusElement) authStatusElement.textContent = `Error: ${err.message}. Redirecting...`;
        // Redirect is likely handled by initializeAuth failure, but can force here if needed
        // setTimeout(() => { window.location.href = '/login.html'; }, 1500);
    }

    // ==================================
    //  Helper Function Definitions (Keep all from previous full version)
    // ==================================

    function getDraftKey() { /* ... */ }
    function loadOverallDraft() { /* ... */ }
    function setupSideNavigation() {
        // Ensure iframe onload logic is robust or primarily rely on postMessage
         if (!sideNavLinks || !iframe) return;
         console.log("Questionnaire.js - Setting up side navigation.");

         sideNavLinks.forEach(link => {
             link.addEventListener('click', function(e) {
                 const sectionUrl = this.getAttribute('href');
                 console.log(`Questionnaire.js - Nav link clicked. Loading section: ${sectionUrl}`);
                 isIframeReady = false; // Reset flag when changing section
                 iframe.src = sectionUrl; // Change iframe source
                 sideNavLinks.forEach(l => l.classList.remove('active'));
                 this.classList.add('active');
             });
         });

         // Set initial active link
         const initialLink = document.querySelector('#side-nav a[href="/sections/section-applicant-details.html"]');
         if (initialLink) initialLink.classList.add('active');

         // Remove the simple iframe.onload = ... logic here.
         // Rely on the SECTION_READY message from the iframe instead.
         // If SECTION_READY doesn't arrive, we might need a timeout fallback.
    }
    function deriveSectionName(pathname) { /* ... */ }
    function setupSaveDraftButton() { /* ... */ }
    function setupMessageListenerFromIframe() {
        console.log("Questionnaire.js - Setting up message listener.");
        window.addEventListener('message', (event) => {
            if (event.origin !== window.location.origin && event.origin !== 'null') { // Allow 'null' for initial load? Risky. Better to wait for specific origin.
                console.warn("Questionnaire.js - Message received from unexpected origin:", event.origin);
                return; // Ignore messages from untrusted origins
            }

            const { type, payload, sectionName } = event.data; // sectionName might be path in some messages

            if (type === 'SECTION_READY') {
                // Iframe says its DOM is ready
                const readySectionPath = sectionName; // The message payload IS the pathname
                const derivedName = deriveSectionName(readySectionPath);
                console.log(`Questionnaire.js - Received SECTION_READY for path: ${readySectionPath} (Derived Name: ${derivedName})`);
                isIframeReady = true;
                // Now it's safe to send draft data for this specific section
                if (derivedName && fullDraftData[derivedName]) {
                    console.log(`Questionnaire.js - Sending LOAD_SECTION_DATA for "${derivedName}" to iframe.`);
                    iframe.contentWindow.postMessage({
                        type: 'LOAD_SECTION_DATA',
                        payload: fullDraftData[derivedName]
                    }, window.location.origin); // Use specific origin
                } else {
                    console.log(`Questionnaire.js - No draft data to send for section "${derivedName}".`);
                }
            } else if (type === 'SECTION_DATA_RESPONSE') {
                 // Iframe sent data back after parent requested it (Save button)
                 console.log(`Questionnaire.js - Received data response from section: ${sectionName}`, payload);
                 if (sectionName) { // Ensure we know which section it's for
                     fullDraftData[sectionName] = payload;
                     // Now save the entire draft
                     const draftKey = getDraftKey();
                     try {
                         localStorage.setItem(draftKey, JSON.stringify(fullDraftData));
                         console.log("Questionnaire.js - Full draft saved via button.", fullDraftData);
                          if (saveStatusElement) { saveStatusElement.textContent = 'Draft saved successfully!'; saveStatusElement.style.color = 'green'; setTimeout(() => { if(saveStatusElement) saveStatusElement.textContent = ''; }, 3000); }
                     } catch (e) {
                          console.error("Questionnaire.js - Error saving full draft:", e);
                          if (saveStatusElement) { saveStatusElement.textContent = 'Error saving draft!'; saveStatusElement.style.color = 'red'; }
                     }
                 } else {
                     console.warn("Questionnaire.js - Received SECTION_DATA_RESPONSE without a sectionName.");
                     if (saveStatusElement) { saveStatusElement.textContent = 'Error: Unknown section data received.'; saveStatusElement.style.color = 'red'; }
                 }
            } else if (type === 'SECTION_DATA_CHANGED_AUTOSAVE') {
                // Data received from iframe for auto-save
                console.log(`Questionnaire.js - Auto-save data received from section: ${sectionName}`, payload);
                if(sectionName){
                    fullDraftData[sectionName] = payload;
                    const draftKey = getDraftKey();
                    try {
                        localStorage.setItem(draftKey, JSON.stringify(fullDraftData));
                        console.log("Questionnaire.js - Auto-saved draft.", fullDraftData);
                        if (saveStatusElement && !saveButton.disabled) { saveStatusElement.textContent = 'Changes auto-saved.'; saveStatusElement.style.color = 'grey'; setTimeout(() => { if(saveStatusElement && saveStatusElement.textContent === 'Changes auto-saved.') saveStatusElement.textContent = ''; }, 2000); }
                    } catch (e) { console.error("Questionnaire.js - Error auto-saving draft:", e); }
                } else {
                     console.warn("Questionnaire.js - Received auto-save data without sectionName.");
                }
            }
        });
    }

}); // End DOMContentLoaded
