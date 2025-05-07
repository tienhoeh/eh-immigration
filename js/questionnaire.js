// js/questionnaire.js
import { initializeAuth } from './auth_check.js';

document.addEventListener('DOMContentLoaded', async () => {
    const pageContent = document.getElementById('page-content');
    const authStatusElement = document.getElementById('auth-status');
    const sideNavLinks = document.querySelectorAll('#side-nav a');
    const iframe = document.getElementById('section-iframe');
    const saveButton = document.getElementById('save-progress');
    const saveStatus = document.getElementById('save-status');
    const userEmailElement = document.getElementById('user-email'); // In header
    const logoutButton = document.getElementById('btn-logout'); // In header

    let auth0 = null;
    let currentUserId = 'anonymous';
    let fullDraftData = {}; // Object to hold draft data from all sections

    try {
        const initResult = await initializeAuth(); // Auth check first
        auth0 = initResult.auth0;
        currentUserId = initResult.userId;

        // Show content if authenticated
        if(authStatusElement) authStatusElement.style.display = 'none';
        if(pageContent) pageContent.classList.remove('hidden');
        if(saveButton) saveButton.disabled = false; // Enable save button

        // Display user info in header
        if(userEmailElement && initResult.user) userEmailElement.textContent = initResult.user.email || 'User';
        if (logoutButton) {
             logoutButton.addEventListener('click', () => {
                 auth0.logout({ logoutParams: { returnTo: `${window.location.origin}/` } });
             });
         }

        // --- Load Full Draft ---
        loadOverallDraft();

        // --- Setup Side Navigation ---
        setupSideNav();

        // --- Setup Save Button ---
        setupSaveDraft();

        // --- Setup Message Listener (for data from iframe) ---
        // setupIframeListener(); // Defer this complexity for now

    } catch (e) {
        console.error("Questionnaire page could not initialize:", e);
         if(authStatusElement) authStatusElement.textContent = "Authentication required. Redirecting...";
         // Redirect handled by initializeAuth
    }

    function setupSideNav() {
        if (!sideNavLinks || !iframe) return;
        sideNavLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                // No preventDefault needed because target="section-iframe" handles it
                console.log(`Navigating iframe to: ${link.getAttribute('href')}`);
                // Highlight active link
                sideNavLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                // Optionally send data TO iframe after it loads
                // iframe.onload = () => sendDataToIframe(link.getAttribute('href'));
            });
        });
        // Set initial active link
         const initialLink = document.querySelector('#side-nav a[href="/sections/section-applicant-details.html"]');
         if(initialLink) initialLink.classList.add('active');
    }

    function getDraftKey() {
        return `ehImmigrationDraft_${currentUserId}`;
    }

    function loadOverallDraft() {
        if (currentUserId === 'anonymous') return;
        const draftKey = getDraftKey();
        const savedData = localStorage.getItem(draftKey);
        if (savedData) {
            try {
                fullDraftData = JSON.parse(savedData);
                console.log("Overall draft loaded:", fullDraftData);
                 if (saveStatus) { saveStatus.textContent = 'Draft loaded.'; setTimeout(() => { saveStatus.textContent = ''; }, 2000); }
            } catch (e) {
                console.error("Error parsing overall draft:", e);
                fullDraftData = {};
            }
        } else {
             console.log("No overall draft found.");
             fullDraftData = {};
        }
        // TODO: Need logic to send relevant part of fullDraftData to iframe when it loads a section
    }

    function setupSaveDraft() {
         if (!saveButton) return;
         saveButton.addEventListener('click', () => {
             if (currentUserId === 'anonymous') return;
             console.log("Save draft clicked (Parent). Need iframe communication.");
             if (saveStatus) saveStatus.textContent = 'Saving... (Partial - Requires Iframe Data)';

             // --- COMPLEX PART - Needs Iframe Communication ---
             // 1. Ask the current iframe for its data:
             //    iframe.contentWindow.postMessage({ type: 'GET_SECTION_DATA' }, window.location.origin);
             // 2. Listen for the response (see setupIframeListener below)
             // 3. When response received, merge it into fullDraftData
             // 4. Save fullDraftData to localStorage
             // For now, just save whatever we might have (likely empty or outdated):
             const draftKey = getDraftKey();
             try {
                 localStorage.setItem(draftKey, JSON.stringify(fullDraftData));
                 if (saveStatus) { saveStatus.textContent = 'Draft container saved (iframe data missing).'; setTimeout(() => { saveStatus.textContent = ''; }, 3000); }
             } catch (e) {
                  console.error("Error saving draft container:", e);
                  if (saveStatus) { saveStatus.textContent = 'Error saving!'; saveStatus.style.color = 'red'; }
             }
         });
    }

    /* // Example: listen for messages FROM iframe (Needs corresponding code in section_common.js)
    function setupIframeListener() {
        window.addEventListener('message', (event) => {
            // IMPORTANT: Check origin for security
            if (event.origin !== window.location.origin) {
                console.warn("Message received from unexpected origin:", event.origin);
                return;
            }

            const { type, payload, sectionName } = event.data;

            if (type === 'SECTION_DATA_UPDATE' && sectionName) {
                console.log(`Received data update from section: ${sectionName}`, payload);
                // Merge payload into the correct part of fullDraftData
                fullDraftData[sectionName] = payload;
                // Maybe trigger an auto-save or indicate changes are ready to be saved
                 if (saveStatus) saveStatus.textContent = 'Changes received, ready to save.';

            } else if (type === 'SECTION_DATA_RESPONSE' && sectionName) {
                 console.log(`Received data response from section: ${sectionName}`, payload);
                 fullDraftData[sectionName] = payload;
                 // Now save the full draft after getting response from save click
                 const draftKey = getDraftKey();
                 try {
                     localStorage.setItem(draftKey, JSON.stringify(fullDraftData));
                     if (saveStatus) { saveStatus.textContent = 'Draft saved successfully!'; setTimeout(() => { saveStatus.textContent = ''; }, 3000); }
                 } catch (e) {
                      console.error("Error saving full draft:", e);
                      if (saveStatus) { saveStatus.textContent = 'Error saving!'; saveStatus.style.color = 'red'; }
                 }
            }
        });
    }
    */

});
