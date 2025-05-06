document.addEventListener('DOMContentLoaded', async () => { // Make top-level async

    // --- Auth0 Configuration ---
    const auth0Config = {
        domain: 'eh-immigration.jp.auth0.com', // Replace with your Auth0 Tenant Domain
        clientId: 'GyTGD7qnwsNkXiXmxVTdVLfJMUlwdAND', // Replace with your Auth0 Application Client ID
        authorizationParams: {
            redirect_uri: window.location.origin // Use current origin as the redirect URI
            // Add audience or scopes here if needed later, e.g., for calling an API
            // audience: 'YOUR_API_IDENTIFIER',
            // scope: 'openid profile email read:data'
        }
    };

    // --- Global Elements ---
    const form = document.querySelector('form[name="immigration-questionnaire"]');
    const sideNavLinks = document.querySelectorAll('.side-nav a');
    const formSections = document.querySelectorAll('.form-section');
    const saveButton = document.getElementById('save-progress');
    const saveStatus = document.getElementById('save-status');
    const formContainer = document.getElementById('form-container');
    const btnLogin = document.getElementById('btn-login');
    const btnLogout = document.getElementById('btn-logout');
    const userProfileElement = document.getElementById('user-profile');
    const userEmailElement = document.getElementById('user-email');
    const authLoadingElement = document.getElementById('auth-loading');
    const bodyElement = document.body;

    let auth0 = null; // To hold the Auth0 client instance
    let currentUser = null; // To hold user profile info
    let currentUserId = 'anonymous'; // To hold Auth0 user 'sub'

    // --- Initialize Auth0 Client ---
    try {
        auth0 = await createAuth0Client({
            domain: auth0Config.domain,
            clientId: auth0Config.clientId,
            authorizationParams: auth0Config.authorizationParams
        });
        console.log("Auth0 client initialized");
    } catch (e) {
        console.error("Error initializing Auth0 client:", e);
        authLoadingElement.textContent = "Error initializing authentication. Please refresh.";
        bodyElement.classList.remove('loading'); // Show error message
        return; // Stop further execution
    }

    // --- Auth0 Helper Functions ---
    const login = async () => {
        try {
            console.log("Attempting login with redirect...");
            await auth0.loginWithRedirect();
        } catch (e) {
            console.error("Login failed:", e);
        }
    };

    const logout = () => {
        console.log("Logging out...");
        auth0.logout({
            logoutParams: {
                returnTo: window.location.origin // Redirect back to the app after logout
            }
        });
    };

    // --- UI Update Function ---
    const updateUI = async () => {
        try {
            const isAuthenticated = await auth0.isAuthenticated();
            console.log("Is Authenticated:", isAuthenticated);

            if (isAuthenticated) {
                currentUser = await auth0.getUser();
                currentUserId = currentUser?.sub || 'anonymous_authenticated'; // Get user's unique subject ID
                console.log("User Profile:", currentUser);

                btnLogin.style.display = 'none';
                userProfileElement.style.display = 'inline-block'; // Or 'block'
                userEmailElement.textContent = currentUser?.email || 'Logged In'; // Display email or generic message
                btnLogout.style.display = 'inline-block';

                formContainer.style.visibility = 'visible'; // Make form visible
                saveButton.disabled = false; // Enable save button

                setActiveLink(); // Ensure nav link is highlighted
                loadDraft(); // Load draft associated with this user

            } else {
                currentUser = null;
                currentUserId = 'anonymous';
                btnLogin.style.display = 'inline-block';
                userProfileElement.style.display = 'none';
                btnLogout.style.display = 'none';

                formContainer.style.visibility = 'hidden'; // Hide form
                saveButton.disabled = true; // Disable save button
                 if (saveStatus) saveStatus.textContent = ''; // Clear save status on logout
            }
        } catch (e) {
            console.error("Error updating UI:", e);
             // Handle UI update errors, maybe show a generic logged-out state
            currentUser = null;
            currentUserId = 'anonymous';
            btnLogin.style.display = 'inline-block';
            userProfileElement.style.display = 'none';
            btnLogout.style.display = 'none';
            formContainer.style.visibility = 'hidden';
            saveButton.disabled = true;
        } finally {
             // Remove loading state once UI is updated
            bodyElement.classList.remove('loading');
            authLoadingElement.style.display = 'none';
        }
    };

    // --- Handle Auth0 Redirect Callback ---
    if (window.location.search.includes("code=") && window.location.search.includes("state=")) {
        console.log("Detected Auth0 callback parameters in URL.");
        try {
            await auth0.handleRedirectCallback();
            console.log("Handled redirect callback successfully.");
             // Clean the URL (remove code and state parameters)
            window.history.replaceState({}, document.title, window.location.pathname);
        } catch (e) {
            console.error("Error handling redirect callback:", e);
        }
    }

    // --- Event Listeners ---
    if (btnLogin) btnLogin.addEventListener('click', login);
    if (btnLogout) btnLogout.addEventListener('click', logout);


    // --- Helper: Get User-Specific Draft Key ---
    const getDraftKey = () => {
        // Uses currentUserId which is set after successful authentication (contains Auth0 'sub')
        return `ehImmigrationDraft_${currentUserId}`;
    };

    // --- Save/Load Progress (localStorage) ---
    // (Save/Load logic remains largely the same as before, but uses the updated getDraftKey)
    saveButton.addEventListener('click', () => {
        const draftKey = getDraftKey();
        if (!form || currentUserId === 'anonymous') {
            saveStatus.textContent = 'Please log in to save draft.';
            saveStatus.style.color = 'orange';
            setTimeout(() => { saveStatus.textContent = ''; }, 3000);
            return;
        }

        const dataObject = {};
        form.querySelectorAll('input, select, textarea').forEach(input => {
            const name = input.name;
            if (!name || name === 'bot-field' || name === 'form-name' || input.closest('.hidden')) {
                return;
            }
            // ... (rest of the dataObject population logic for checkboxes, radios, etc. - KEEP THIS PART FROM YOUR PREVIOUS SCRIPT)
             if (input.type === 'checkbox') {
                 if (name.endsWith('[]')) {
                     const baseName = name.slice(0, -2);
                     if (!dataObject[baseName]) dataObject[baseName] = [];
                     if (input.checked) { dataObject[baseName].push(input.value); }
                 } else { dataObject[name] = input.checked; }
             } else if (input.type === 'radio') {
                 if (input.checked) { dataObject[name] = input.value; }
                 else if (dataObject[name] === undefined) { /* dataObject[name] = null; */ }
             } else { dataObject[name] = input.value; }
        });

        try {
            localStorage.setItem(draftKey, JSON.stringify(dataObject));
            saveStatus.textContent = 'Draft saved successfully!';
            saveStatus.style.color = 'green';
            setTimeout(() => { saveStatus.textContent = ''; }, 3000);
        } catch (e) {
            console.error("Error saving draft:", e);
            saveStatus.textContent = 'Error saving draft (Storage might be full).';
            saveStatus.style.color = 'red';
        }
    });

    function loadDraft() {
        const draftKey = getDraftKey();
        const savedData = localStorage.getItem(draftKey);
        if (!savedData || !form || currentUserId === 'anonymous') {
            console.log("No draft found for user or form not ready.");
            return;
        }
        // ... (Rest of the loadDraft logic, including repeatable sections and populating fields - KEEP THIS PART FROM YOUR PREVIOUS SCRIPT)
         try {
            const dataObject = JSON.parse(savedData);
            console.log("Loading draft for key:", draftKey);
            // ... Load Repeatable Sections First ... (Keep this logic)
             const repeatableGroups = ['sibling', 'education', 'employment', 'absence', 'passport', 'prev_marriage', 'prev_child'];
             repeatableGroups.forEach(groupName => { /* ... logic to add items based on maxIndex ... */ });
            // ... Populate All Fields ... (Keep this logic)
             form.querySelectorAll('input, select, textarea').forEach(input => { /* ... logic to set values ... */ });
            // ... Trigger conditional checks ...
             triggerInitialEmploymentCheck(); // Ensure employment details visibility is correct

            saveStatus.textContent = 'Draft loaded.';
            saveStatus.style.color = 'blue';
            setTimeout(() => { saveStatus.textContent = ''; }, 3000);
        } catch (e) {
            console.error("Error loading draft:", e);
            // localStorage.removeItem(draftKey);
            saveStatus.textContent = 'Error loading draft.';
            saveStatus.style.color = 'red';
        }
    }


    // --- Navigation Logic ---
    // (Keep the setActiveLink function and sideNavLinks event listener exactly as before)
    function setActiveLink() { /* ... */ }
    sideNavLinks.forEach(link => { /* ... */ });
    formContainer.addEventListener('scroll', setActiveLink);


    // --- Conditional Logic ---
    // (Keep the setupConditionalVisibility function and all its specific calls exactly as before)
    function setupConditionalVisibility(triggerElementOrNodeList, targetElement, showConditionCallback, dependentElements = []) { /* ... */ }
    // ... all calls to setupConditionalVisibility ...
    // ... keep employment check logic and triggerInitialEmploymentCheck function ...


    // --- Repeatable Sections Logic ---
    // (Keep the setupRepeatable function exactly as before)
    function setupRepeatable(containerId, addButtonId, templateId, groupName) { /* ... */ }
    // ... all calls to setupRepeatable ...


    // --- Form Submission Validation ---
    // (Keep the form submission event listener exactly as before, including draft clearing)
    if (form) {
        form.addEventListener('submit', (e) => {
            // ... validation logic ...
            if (firstInvalid) {
                // ... handle invalid ...
            } else {
                 console.log("Form valid, submitting to Netlify...");
                 const draftKey = getDraftKey(); // Get the key again
                 localStorage.removeItem(draftKey); // Clear draft on submit
                 console.log("Draft cleared:", draftKey);
                 // ... disable submit button ...
            }
        });
    }


    // --- Initial UI Update ---
    await updateUI(); // Initial check and UI setup after handling potential callback

}); // End DOMContentLoaded
