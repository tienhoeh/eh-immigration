// js/questionnaire.js

import { initializeAuth } from './auth_check.js'; // Use the common auth checker

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Questionnaire.js - DOMContentLoaded event fired.");

    // --- Global Elements for questionnaire.html ---
    const pageContent = document.getElementById('page-content'); // The main wrapper to show/hide
    const authStatusElement = document.getElementById('auth-status');
    const sideNavLinks = document.querySelectorAll('#side-nav a');
    const iframe = document.getElementById('section-iframe');
    const saveButton = document.getElementById('save-progress');
    const saveStatusElement = document.getElementById('save-status');
    const userEmailElement = document.getElementById('user-email'); // In header of questionnaire.html
    const logoutButton = document.getElementById('btn-logout'); // In header of questionnaire.html
    const containerDiv = document.querySelector('.container'); // Main content container

    // --- State Variables ---
    let auth0 = null;
    let currentUser = null;
    let currentUserId = 'anonymous';
    let fullDraftData = {}; // Object to hold draft data from all sections
    let currentSectionSrc = ''; // To keep track of the iframe's current section

    // ==================================
    //  Initialization Flow & Auth Check
    // ==================================
    try {
        console.log("Questionnaire.js - Initializing Auth0 and checking auth...");
        if(authStatusElement) authStatusElement.style.display = 'block';
        if(containerDiv) containerDiv.classList.add('is-loading'); // Keep content hidden initially

        const initResult = await initializeAuth(); // Auth check from auth_check.js
        auth0 = initResult.auth0;
        currentUser = initResult.user;
        currentUserId = initResult.userId;

        // --- Authentication Success: Setup the Form UI ---
        console.log("Questionnaire.js - User authenticated:", currentUserId);
        if(authStatusElement) authStatusElement.style.display = 'none';
        if(pageContent) pageContent.classList.remove('hidden');
        if(containerDiv) {
            containerDiv.classList.remove('is-loading');
            containerDiv.classList.add('is-visible');
        }
        if(saveButton) saveButton.disabled = false;

        // Display user info in header
        if(userEmailElement && currentUser) userEmailElement.textContent = currentUser.email || 'User';
        if (logoutButton) {
             logoutButton.addEventListener('click', () => {
                 auth0.logout({ logoutParams: { returnTo: `${window.location.origin}/` } });
             });
         }

        setupSideNavigation();
        loadOverallDraft(); // Load overall draft state for the user
        setupSaveDraftButton();
        setupMessageListenerFromIframe(); // For iframe to send data to parent

        console.log("Questionnaire.js - Application setup complete.");

    } catch (e) {
        // Errors during initializeAuth() are typically handled by redirecting in auth_check.js
        // This catch is for other potential errors during setup.
        console.error("Questionnaire.js - Fatal Error during setup:", e);
        if (authStatusElement) authStatusElement.textContent = `Error: ${e.message}. Please try logging in again.`;
        if(containerDiv) {
            containerDiv.classList.remove('is-visible');
            containerDiv.classList.add('is-loading'); // Keep hidden
        }
    }

    // ==================================
    //  Helper Function Definitions
    // ==================================

    function getDraftKey() {
        return `ehImmigrationDraft_${currentUserId}`;
    }

    function setupSideNavigation() {
        if (!sideNavLinks || !iframe) {
            console.error("Side navigation or iframe element not found.");
            return;
        }
        console.log("Questionnaire.js - Setting up side navigation.");

        sideNavLinks.forEach(link => {
            link.addEventListener('click', function(e) { // Use function for 'this'
                // e.preventDefault(); // Not strictly needed due to target="section-iframe"
                const sectionUrl = this.getAttribute('href');
                console.log(`Questionnaire.js - Nav link clicked. Loading section: ${sectionUrl}`);

                // Update iframe src - this will trigger iframe.onload if attached
                iframe.src = sectionUrl;
                currentSectionSrc = sectionUrl; // Store current section

                // Highlight active link
                sideNavLinks.forEach(l => l.classList.remove('active'));
                this.classList.add('active');
            });
        });

        // Set initial active link and load initial section data (if any)
        const initialLink = document.querySelector('#side-nav a[href="/sections/section-applicant-details.html"]');
        if (initialLink) {
            initialLink.classList.add('active');
            currentSectionSrc = initialLink.getAttribute('href');
            // iframe.src is set in HTML, onload will handle first load
        }

        // Handle iframe loading to send it relevant draft data
        iframe.onload = () => {
            console.log(`Questionnaire.js - Iframe loaded: ${iframe.contentWindow.location.pathname}`);
            // Derive section name from the iframe's current path
            const sectionName = deriveSectionName(iframe.contentWindow.location.pathname);
            if (sectionName && fullDraftData[sectionName]) {
                console.log(`Questionnaire.js - Sending draft data for section "${sectionName}" to iframe.`);
                iframe.contentWindow.postMessage({
                    type: 'LOAD_SECTION_DATA',
                    payload: fullDraftData[sectionName]
                }, window.location.origin); // Target specific origin
            } else {
                console.log(`Questionnaire.js - No draft data found for section "${sectionName}" or sectionName could not be derived.`);
            }
        };
    }

    function deriveSectionName(pathname) {
        // Example: /sections/section-applicant-details.html -> section-applicant-details
        if (!pathname) return null;
        const parts = pathname.split('/');
        const fileName = parts.pop(); // Get the last part (e.g., section-applicant-details.html)
        if (fileName && fileName.startsWith('section-') && fileName.endsWith('.html')) {
            return fileName.substring(0, fileName.length - 5); // Remove .html
        }
        return null;
    }


    function loadOverallDraft() {
        if (currentUserId === 'anonymous') return;
        const draftKey = getDraftKey();
        const savedData = localStorage.getItem(draftKey);
        if (savedData) {
            try {
                fullDraftData = JSON.parse(savedData);
                console.log("Questionnaire.js - Overall draft loaded:", fullDraftData);
                if (saveStatusElement) {
                    saveStatusElement.textContent = 'Previous draft loaded.';
                    setTimeout(() => { if(saveStatusElement) saveStatusElement.textContent = ''; }, 3000);
                }
            } catch (e) {
                console.error("Questionnaire.js - Error parsing overall draft:", e);
                fullDraftData = {};
            }
        } else {
            console.log("Questionnaire.js - No overall draft found.");
            fullDraftData = {};
        }
    }

    function setupSaveDraftButton() {
        if (!saveButton || !iframe) return;
        console.log("Questionnaire.js - Setting up save draft button.");

        saveButton.addEventListener('click', () => {
            if (currentUserId === 'anonymous') {
                if (saveStatusElement) saveStatusElement.textContent = 'Please log in.';
                return;
            }
            console.log("Questionnaire.js - Save Draft button clicked. Requesting data from iframe...");
            if (saveStatusElement) {
                saveStatusElement.textContent = 'Requesting section data...';
                saveStatusElement.style.color = 'orange';
            }

            // Request data from the current iframe section
            if (iframe.contentWindow) {
                const sectionName = deriveSectionName(iframe.contentWindow.location.pathname);
                iframe.contentWindow.postMessage({ type: 'GET_SECTION_DATA', sectionName: sectionName }, window.location.origin);
            } else {
                console.error("Questionnaire.js - Cannot access iframe contentWindow to request data.");
                if (saveStatusElement) { saveStatusElement.textContent = 'Error accessing section.'; saveStatusElement.style.color = 'red';}
            }
        });
    }

    function setupMessageListenerFromIframe() {
        console.log("Questionnaire.js - Setting up message listener for iframe communication.");
        window.addEventListener('message', (event) => {
            // IMPORTANT: Always verify the origin of the message for security
            if (event.origin !== window.location.origin) {
                // Allow messages from 'null' if iframe has no src initially or about:blank
                if (event.origin !== 'null') {
                    console.warn("Questionnaire.js - Message received from unexpected origin:", event.origin, "Expected:", window.location.origin);
                    return;
                }
            }

            const { type, payload, sectionName } = event.data;
            console.log("Questionnaire.js - Message received from iframe:", event.data);

            if (type === 'SECTION_DATA_RESPONSE' && sectionName) {
                console.log(`Questionnaire.js - Received data response from section: ${sectionName}`, payload);
                fullDraftData[sectionName] = payload; // Update the specific section's data

                // Now save the entire draft
                const draftKey = getDraftKey();
                try {
                    localStorage.setItem(draftKey, JSON.stringify(fullDraftData));
                    console.log("Questionnaire.js - Full draft saved successfully to localStorage.", fullDraftData);
                    if (saveStatusElement) {
                        saveStatusElement.textContent = 'Draft saved successfully!';
                        saveStatusElement.style.color = 'green';
                        setTimeout(() => { if(saveStatusElement) saveStatusElement.textContent = ''; }, 3000);
                    }
                } catch (e) {
                    console.error("Questionnaire.js - Error saving full draft:", e);
                    if (saveStatusElement) {
                        saveStatusElement.textContent = 'Error saving draft!';
                        saveStatusElement.style.color = 'red';
                    }
                }
            } else if (type === 'SECTION_READY') {
                // Iframe section is ready, send it its draft data if available
                console.log(`Questionnaire.js - Section "${sectionName}" is ready. Checking for draft data.`);
                const sectionNameFromReady = deriveSectionName(sectionName); // sectionName here is pathname
                if (sectionNameFromReady && fullDraftData[sectionNameFromReady]) {
                    console.log(`Questionnaire.js - Sending draft data for section "${sectionNameFromReady}" to iframe.`);
                    iframe.contentWindow.postMessage({
                        type: 'LOAD_SECTION_DATA',
                        payload: fullDraftData[sectionNameFromReady]
                    }, window.location.origin);
                }
            } else if (type === 'SECTION_DATA_CHANGED_AUTOSAVE') {
                // Received data from iframe due to input change (for autosave)
                console.log(`Questionnaire.js - Auto-save data received from section: ${sectionName}`, payload);
                fullDraftData[sectionName] = payload;
                // Save the entire draft immediately (can be optimized later with debouncing)
                const draftKey = getDraftKey();
                try {
                    localStorage.setItem(draftKey, JSON.stringify(fullDraftData));
                    console.log("Questionnaire.js - Auto-saved full draft.", fullDraftData);
                    if (saveStatusElement && !saveButton.disabled) { // Don't overwrite manual save message
                         saveStatusElement.textContent = 'Changes auto-saved.';
                         saveStatusElement.style.color = 'grey';
                         setTimeout(() => { if(saveStatusElement && saveStatusElement.textContent === 'Changes auto-saved.') saveStatusElement.textContent = ''; }, 2000);
                     }
                } catch (e) {
                    console.error("Questionnaire.js - Error auto-saving draft:", e);
                }
            }
        });
    }

}); // End DOMContentLoaded
