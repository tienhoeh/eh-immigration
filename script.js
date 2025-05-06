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
        // Make sure createAuth0Client is available globally (it should be if SDK script loaded)
        if (typeof createAuth0Client !== 'function') {
            throw new Error("createAuth0Client is not defined. Auth0 SDK script might not be loaded.");
        }
        auth0 = await createAuth0Client({
            domain: auth0Config.domain,
            clientId: auth0Config.clientId,
            authorizationParams: auth0Config.authorizationParams
        });
        console.log("Auth0 client initialized successfully."); // Success message
    } catch (e) {
        console.error("Error initializing Auth0 client:", e); // Log the specific error
        authLoadingElement.textContent = "Error initializing authentication. Please check console and refresh."; // More specific error message
        bodyElement.classList.remove('loading'); // Show error message
        return; // Stop further execution
    }

    // --- Auth0 Helper Functions ---
    const login = async () => {
        console.log("Login function called."); // <<< ADDED DEBUG
        if (!auth0) { // <<< ADDED CHECK
            console.error("Auth0 client not initialized, cannot login.");
            alert("Authentication system is not ready. Please try again later.");
            return;
        }
        try {
            console.log("Attempting auth0.loginWithRedirect()..."); // <<< ADDED DEBUG
            await auth0.loginWithRedirect();
            // Note: Execution typically stops here as the browser redirects.
            console.log("loginWithRedirect called (browser should redirect soon)."); // <<< ADDED DEBUG (Might not show if redirect is immediate)
        } catch (e) {
            console.error("Login failed inside try/catch:", e); // <<< ADDED DEBUG
            alert("Login failed: " + e.message); // Show error to user
        }
    };

    const logout = () => {
        console.log("Logout function called."); // Added log for logout
        if (!auth0) {
            console.error("Auth0 client not initialized, cannot logout.");
            return;
        }
        console.log("Attempting auth0.logout()...");
        auth0.logout({
            logoutParams: {
                returnTo: window.location.origin // Redirect back to the app after logout
            }
        });
    };

    // --- UI Update Function ---
    const updateUI = async () => {
        console.log("updateUI called."); // Log start of UI update
        if (!auth0) {
            console.error("Cannot update UI, Auth0 client not initialized.");
            bodyElement.classList.remove('loading'); // Remove loading anyway
            authLoadingElement.style.display = 'none'; // Hide loading text
            return;
        }
        try {
            const isAuthenticated = await auth0.isAuthenticated();
            console.log("Is Authenticated:", isAuthenticated);

            if (isAuthenticated) {
                currentUser = await auth0.getUser();
                currentUserId = currentUser?.sub || 'anonymous_authenticated'; // Get user's unique subject ID
                console.log("User Profile:", currentUser, " User ID (sub):", currentUserId);

                if(btnLogin) btnLogin.style.display = 'none';
                if(userProfileElement) userProfileElement.style.display = 'inline-block'; // Or 'block'
                if(userEmailElement) userEmailElement.textContent = currentUser?.email || 'Logged In'; // Display email or generic message
                if(btnLogout) btnLogout.style.display = 'inline-block';

                if(formContainer) formContainer.style.visibility = 'visible'; // Make form visible
                if(saveButton) saveButton.disabled = false; // Enable save button

                setActiveLink(); // Ensure nav link is highlighted
                loadDraft(); // Load draft associated with this user

            } else {
                currentUser = null;
                currentUserId = 'anonymous';
                if(btnLogin) btnLogin.style.display = 'inline-block';
                if(userProfileElement) userProfileElement.style.display = 'none';
                if(btnLogout) btnLogout.style.display = 'none';

                if(formContainer) formContainer.style.visibility = 'hidden'; // Hide form
                if(saveButton) saveButton.disabled = true; // Disable save button
                if (saveStatus) saveStatus.textContent = ''; // Clear save status on logout
            }
        } catch (e) {
            console.error("Error during UI update (isAuthenticated/getUser):", e);
             // Handle UI update errors, show generic logged-out state
            currentUser = null;
            currentUserId = 'anonymous';
            if(btnLogin) btnLogin.style.display = 'inline-block';
            if(userProfileElement) userProfileElement.style.display = 'none';
            if(btnLogout) btnLogout.style.display = 'none';
            if(formContainer) formContainer.style.visibility = 'hidden';
            if(saveButton) saveButton.disabled = true;
        } finally {
             // Remove loading state once UI is updated or an error occurred
            console.log("Removing loading state.");
            bodyElement.classList.remove('loading');
            if(authLoadingElement) authLoadingElement.style.display = 'none';
        }
    };

    // --- Handle Auth0 Redirect Callback ---
    // Check if the user is returning from Auth0 with code and state params
    if (window.location.search.includes("code=") && window.location.search.includes("state=")) {
        console.log("Detected Auth0 callback parameters in URL.");
        if (!auth0) {
             console.error("Auth0 client not ready to handle redirect callback.");
             // Maybe show an error message or wait? For now, we proceed hoping init finishes.
         } else {
            try {
                console.log("Attempting handleRedirectCallback...");
                await auth0.handleRedirectCallback();
                console.log("Handled redirect callback successfully.");
                 // Clean the URL (remove code and state parameters)
                console.log("Cleaning URL parameters.");
                window.history.replaceState({}, document.title, window.location.pathname);
            } catch (e) {
                console.error("Error handling redirect callback:", e);
                // Display error? Or just proceed to updateUI which might show logged-out state
            }
         }
    } else {
         console.log("No Auth0 callback parameters detected in URL.");
     }

    // --- Event Listeners ---
    if (btnLogin) {
        console.log("Attempting to add login listener to:", btnLogin); // <<< ADDED DEBUG
        btnLogin.addEventListener('click', login); // Attach listener
    } else {
        console.error("Login button (#btn-login) not found in the DOM!"); // <<< ADDED DEBUG
    }

    if (btnLogout) {
        console.log("Attempting to add logout listener to:", btnLogout); // Added log for logout listener
        btnLogout.addEventListener('click', logout);
    } else {
         console.error("Logout button (#btn-logout) not found in the DOM!");
     }


    // --- Helper: Get User-Specific Draft Key ---
    const getDraftKey = () => {
        // currentUserId is updated in updateUI
        if (currentUserId === 'anonymous' || !currentUserId) {
            console.warn("Attempting to get draft key for anonymous user.");
        }
        return `ehImmigrationDraft_${currentUserId}`;
    };

    // --- Save/Load Progress (localStorage) ---
    if (saveButton) {
        saveButton.addEventListener('click', () => {
            const draftKey = getDraftKey();
            if (!form || currentUserId === 'anonymous') {
                if (saveStatus) {
                    saveStatus.textContent = 'Please log in to save draft.';
                    saveStatus.style.color = 'orange';
                    setTimeout(() => { saveStatus.textContent = ''; }, 3000);
                }
                return;
            }

            console.log(`Saving draft with key: ${draftKey}`);
            const dataObject = {};
            form.querySelectorAll('input, select, textarea').forEach(input => {
                const name = input.name;
                if (!name || name === 'bot-field' || name === 'form-name' || input.closest('.hidden')) {
                    return;
                }
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
                if (saveStatus) {
                    saveStatus.textContent = 'Draft saved successfully!';
                    saveStatus.style.color = 'green';
                    setTimeout(() => { saveStatus.textContent = ''; }, 3000);
                }
            } catch (e) {
                console.error("Error saving draft:", e);
                if (saveStatus) {
                    saveStatus.textContent = 'Error saving draft (Storage might be full).';
                    saveStatus.style.color = 'red';
                }
            }
        });
    } else {
        console.error("Save button (#save-progress) not found!");
    }


    function loadDraft() {
        const draftKey = getDraftKey();
        if (currentUserId === 'anonymous') {
            console.log("Not loading draft for anonymous user.");
            return; // Don't load if not logged in
        }
        const savedData = localStorage.getItem(draftKey);
        if (!savedData || !form) {
            console.log(`No draft found for key ${draftKey} or form not ready.`);
            return;
        }

         try {
            const dataObject = JSON.parse(savedData);
            console.log(`Loading draft from key: ${draftKey}`);

            // --- Load Repeatable Sections First ---
            const repeatableGroups = ['sibling', 'education', 'employment', 'absence', 'passport', 'prev_marriage', 'prev_child'];
            repeatableGroups.forEach(groupName => {
                const groupKeys = Object.keys(dataObject).filter(k => k.startsWith(`${groupName}[`));
                let maxIndex = 0;
                groupKeys.forEach(key => {
                    const match = key.match(new RegExp(`^${groupName}\\[(\\d+)\\]`));
                    if (match && parseInt(match[1]) > maxIndex) { maxIndex = parseInt(match[1]); }
                });

                 const containerId = `${groupName.replace('_', '-')}-container`;
                 const addButtonId = `add-${groupName.replace('_', '-')}`;
                 const container = document.getElementById(containerId);
                 const addButton = document.getElementById(addButtonId);

                 if (container && addButton && maxIndex > 0) {
                     const existingItems = container.querySelectorAll(`.repeatable-item[data-group="${groupName}"]`).length;
                     const itemsToAdd = maxIndex - existingItems;
                     console.log(`Repeatable ${groupName}: max index ${maxIndex}, existing ${existingItems}, adding ${itemsToAdd}`);
                     for (let i = 0; i < itemsToAdd; i++) {
                         addButton.click();
                     }
                 } else if (maxIndex > 0) {
                     console.warn(`Could not find container or button for repeatable group: ${groupName}`);
                 }
            });


            // --- Populate All Fields ---
            form.querySelectorAll('input, select, textarea').forEach(input => {
                const name = input.name;
                if (!name || name === 'bot-field' || name === 'form-name') return;

                const value = dataObject[name];

                if (value === undefined && !(input.type === 'checkbox' && name.endsWith('[]'))) {
                    if (input.type === 'radio') {
                        const groupRadios = form.querySelectorAll(`input[type="radio"][name="${name}"]`);
                        let groupHasSavedValue = false;
                        groupRadios.forEach(r => { if (dataObject[name] === r.value) { groupHasSavedValue = true; } });
                        if (!groupHasSavedValue) input.checked = false;
                    }
                    return;
                }

                if (input.type === 'checkbox') {
                    if (name.endsWith('[]')) {
                        const baseName = name.slice(0, -2);
                        input.checked = Array.isArray(dataObject[baseName]) && dataObject[baseName].includes(input.value);
                    } else {
                        input.checked = value === true || value === 'yes' || value === 'on';
                    }
                } else if (input.type === 'radio') {
                    input.checked = (input.value === value);
                } else {
                    input.value = value;
                }
                 input.dispatchEvent(new Event('change', { bubbles: true }));
            });

             // Trigger conditional checks AFTER potentially loading data
             triggerInitialConditionalChecks(); // You might need to create this function or call the specific setup functions again

            if (saveStatus) {
                saveStatus.textContent = 'Draft loaded.';
                saveStatus.style.color = 'blue';
                setTimeout(() => { saveStatus.textContent = ''; }, 3000);
            }

        } catch (e) {
            console.error("Error loading draft JSON:", e);
            if (saveStatus) {
                saveStatus.textContent = 'Error loading draft.';
                saveStatus.style.color = 'red';
            }
        }
    }

    // Function to re-trigger initial checks for conditional sections after loading draft
    function triggerInitialConditionalChecks() {
        console.log("Triggering initial conditional visibility checks...");
        // Re-run the logic inside setupConditionalVisibility or manually trigger change events
        document.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(input => {
             // Trigger only for those controlling visibility if possible, otherwise trigger all
             if(input.id === 'ns-applicable' || input.id === 'prev-marriage-applicable' || input.name === 'applicant_other_citizenship') {
                input.dispatchEvent(new Event('change', { bubbles: true }));
             }
         });
         triggerInitialEmploymentCheck(); // Ensure employment details visibility is correct after load
    }

     // Keep this function for employment details check
    const triggerInitialEmploymentCheck = () => {
         document.querySelectorAll('#prev-children-container input[type="radio"][name^="prev_child"][name$="[employed]"]:checked').forEach(radio => {
             const fieldset = radio.closest('fieldset.repeatable-item');
             if (!fieldset) return;
             const detailsDiv = fieldset.querySelector('div[data-condition*="[employed]"]');
             if (detailsDiv) {
                 const shouldShow = radio.value === 'Yes';
                 detailsDiv.classList.toggle('hidden', !shouldShow);
                 detailsDiv.querySelectorAll('textarea').forEach(ta => { ta.required = shouldShow; });
             }
         });
    };


    // --- Navigation Logic ---
    // (Keep the setActiveLink function and sideNavLinks event listener exactly as before)
    function setActiveLink() {
        let currentSectionId = '';
        const scrollPosition = formContainer.scrollTop || window.pageYOffset;
        const offset = 100;

        if(formSections.length === 0) return; // Don't run if no sections found

        formSections.forEach(section => {
             // Check visibility before considering offsetTop, as hidden sections have 0 offsetTop
            if (section.offsetParent !== null && section.offsetTop <= scrollPosition + offset) {
                currentSectionId = section.id;
            }
        });
         if (!currentSectionId) {
             currentSectionId = formSections[0].id; // Default to first section if none match
         }

        sideNavLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${currentSectionId}`) {
                link.classList.add('active');
            }
        });
    }
    if(formContainer) formContainer.addEventListener('scroll', setActiveLink); // Check if formContainer exists
    sideNavLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            if (targetSection && formContainer) {
                formContainer.scrollTo({ top: targetSection.offsetTop - 5, behavior: 'smooth' });
                sideNavLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            } else {
                 console.warn(`Navigation target ${targetId} or form container not found.`);
             }
        });
    });


    // --- Conditional Logic ---
    // (Keep the setupConditionalVisibility function and all its specific calls exactly as before)
    function setupConditionalVisibility(triggerElementOrNodeList, targetElement, showConditionCallback, dependentElements = []) {
         if(!targetElement) { console.warn("Target element not found for conditional visibility"); return;}
         const elements = triggerElementOrNodeList instanceof NodeList ? Array.from(triggerElementOrNodeList) : [triggerElementOrNodeList];
         if(elements.length === 0 || elements[0] === null) { console.warn("Trigger element(s) not found for conditional visibility"); return; }

        const checkVisibility = () => {
            const shouldShow = showConditionCallback(elements);
            targetElement.classList.toggle('hidden', !shouldShow);
            targetElement.querySelectorAll('input, select, textarea').forEach(input => {
                 if (input.type !== 'hidden' && !input.closest('.hidden')) { input.required = shouldShow && input.dataset.initiallyRequired !== 'false'; } // Respect initiallyRequired
                 else { input.required = false; }
            });
            dependentElements.forEach(dep => {
                 if(dep.element){
                     dep.element.classList.toggle(dep.classToToggle || 'hidden', !shouldShow);
                     if (dep.toggleRequired) {
                         dep.element.querySelectorAll('input, select, textarea').forEach(input => {
                             if (input.type !== 'hidden' && !input.closest('.hidden')) { input.required = shouldShow && input.dataset.initiallyRequired !== 'false'; }
                             else { input.required = false; }
                         });
                     }
                 } else { console.warn("Dependent element not found in conditional setup"); }
            });
        };
        elements.forEach(element => { element.addEventListener('change', checkVisibility); });
        checkVisibility(); // Initial check
    }
    // Setup specific conditions (ensure elements exist first)
    const nsApplicableCheckbox = document.getElementById('ns-applicable');
    const nsDetailsContainer = document.getElementById('ns-details-container');
    if(nsApplicableCheckbox && nsDetailsContainer) setupConditionalVisibility(nsApplicableCheckbox, nsDetailsContainer, (elements) => elements[0].checked);

    const prevMarriageCheckbox = document.getElementById('prev-marriage-applicable');
    const prevMarriageContainer = document.getElementById('prev-marriage-container');
    const addPrevMarriageButton = document.getElementById('add-prev-marriage');
    const prevChildrenSection = document.getElementById('section-prev-children');
    if(prevMarriageCheckbox && prevMarriageContainer && addPrevMarriageButton && prevChildrenSection) setupConditionalVisibility(prevMarriageCheckbox, prevMarriageContainer, (elements) => elements[0].checked, [{ element: addPrevMarriageButton, classToToggle: 'hidden' }, { element: prevChildrenSection, classToToggle: 'hidden', toggleRequired: true }]);

    const otherCitizenshipRadio = form ? form.querySelectorAll('input[name="applicant_other_citizenship"]') : null;
    const otherCitizenshipDetails = document.getElementById('other-citizenship-details');
    if(otherCitizenshipRadio && otherCitizenshipDetails) setupConditionalVisibility(otherCitizenshipRadio, otherCitizenshipDetails, (elements) => elements.some(radio => radio.checked && radio.value === 'Yes'));

    // Event delegation for previous child employment remains the same
    const prevChildrenContainer = document.getElementById('prev-children-container');
    if(prevChildrenContainer) {
         prevChildrenContainer.addEventListener('change', (event) => {
             if (event.target.matches('input[type="radio"][name^="prev_child"][name$="[employed]"]')) {
                 const fieldset = event.target.closest('fieldset.repeatable-item');
                 if (!fieldset) return;
                 const detailsDiv = fieldset.querySelector('div[data-condition*="[employed]"]');
                 if (detailsDiv) {
                     const shouldShow = event.target.checked && event.target.value === 'Yes';
                     detailsDiv.classList.toggle('hidden', !shouldShow);
                     detailsDiv.querySelectorAll('textarea').forEach(ta => { ta.required = shouldShow; });
                 }
             }
         });
     }

    // --- Repeatable Sections Logic ---
    // (Keep the setupRepeatable function exactly as before)
    function setupRepeatable(containerId, addButtonId, templateId, groupName) {
        const container = document.getElementById(containerId);
        const addButton = document.getElementById(addButtonId);
        const template = document.getElementById(templateId);
        if (!container || !addButton || !template) { console.warn(`Setup failed for repeatable section: Missing elements for ${groupName} (Container: ${containerId}, Button: ${addButtonId}, Template: ${templateId})`); return; }

        const updateItemsUI = () => {
             const items = container.querySelectorAll(`.repeatable-item[data-group="${groupName}"]`);
             items.forEach((item, index) => {
                 const removeButton = item.querySelector('.remove-item-button');
                 if (removeButton) { removeButton.classList.toggle('hidden', items.length <= 1 && !item.dataset.canBeEmpty); }
                 const legend = item.querySelector('legend');
                 if (legend) { legend.textContent = legend.textContent.replace(/#|\d+/, `${index + 1}`); }
                 item.querySelectorAll('[id*="-#-"], label[for*="-#-"]').forEach(el => {
                     if (el.id) el.id = el.id.replace('-#-', `-${index + 1}-`);
                     if (el.htmlFor) el.htmlFor = el.htmlFor.replace('-#-', `-${index + 1}-`);
                 });
                 item.querySelectorAll('[name*="[#]"]').forEach(input => {
                     input.name = input.name.replace('[#]', `[${index + 1}]`);
                     if (input.dataset.initiallyRequired === 'true' && !input.closest('.hidden')) { input.required = true; }
                 });
             });
        };

        addButton.addEventListener('click', () => {
            const clone = template.content.cloneNode(true);
            const newItem = clone.querySelector('.repeatable-item');
            if (!newItem) { console.error(`Template ${templateId} missing .repeatable-item.`); return; }
            newItem.dataset.group = groupName;
            const removeButton = newItem.querySelector('.remove-item-button');
            if (removeButton) {
                 removeButton.addEventListener('click', (e) => { e.target.closest('.repeatable-item').remove(); updateItemsUI(); });
            } else { console.warn(`Template ${templateId} missing .remove-item-button`); }
            container.appendChild(newItem);
            updateItemsUI();
            newItem.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(input => { input.dispatchEvent(new Event('change', { bubbles: true })); });
        });
        container.querySelectorAll(`.repeatable-item[data-group="${groupName}"] .remove-item-button`).forEach(button => {
             if (!button.dataset.listenerAttached) {
                 button.addEventListener('click', (e) => { e.target.closest('.repeatable-item').remove(); updateItemsUI(); });
                 button.dataset.listenerAttached = 'true';
             }
         });
        updateItemsUI();
    }
    // Setup All Repeatable Sections
    setupRepeatable('siblings-container', 'add-sibling', 'sibling-template', 'sibling');
    setupRepeatable('education-container', 'add-education', 'education-template', 'education');
    setupRepeatable('employment-container', 'add-employment', 'employment-template', 'employment');
    setupRepeatable('absence-container', 'add-absence', 'absence-template', 'absence');
    setupRepeatable('passport-container', 'add-passport', 'passport-template', 'passport');
    setupRepeatable('prev-marriage-container', 'add-prev-marriage', 'prev-marriage-template', 'prev_marriage');
    setupRepeatable('prev-children-container', 'add-prev-child', 'prev-child-template', 'prev_child');


    // --- Form Submission Validation ---
    if (form) {
        form.addEventListener('submit', (e) => {
            console.log("Form submit event triggered."); // Log submit start
            let firstInvalid = null;
            form.querySelectorAll('input[required], select[required], textarea[required]').forEach(input => {
                let isHidden = false; let currentElement = input;
                while (currentElement && currentElement !== formContainer && currentElement !== document.body) {
                    if (currentElement.classList.contains('hidden') || window.getComputedStyle(currentElement).display === 'none' || window.getComputedStyle(currentElement).visibility === 'hidden') {
                        isHidden = true; break;
                    } currentElement = currentElement.parentElement;
                }
                if (!isHidden && !input.validity.valid) {
                    if (!firstInvalid) firstInvalid = input;
                    console.warn("Invalid field:", input.name, input.validationMessage, input);
                    input.style.border = '2px solid red';
                    input.style.backgroundColor = '#ffeeee';
                } else {
                    input.style.border = '';
                    input.style.backgroundColor = '';
                }
            });

            if (firstInvalid) {
                e.preventDefault(); // Prevent submission
                const fieldName = firstInvalid.labels.length > 0 ? firstInvalid.labels[0].innerText.replace('*','').trim() : `Field named '${firstInvalid.name}'`;
                alert(`Please fill out the required field: ${fieldName}`);
                const section = firstInvalid.closest('.form-section');
                if (section && formContainer) {
                    formContainer.scrollTo({ top: section.offsetTop - 10, behavior: 'smooth' });
                }
                try { firstInvalid.focus({ preventScroll: true }); } catch(err){} // Focus without default scroll if possible
                console.log("Form submission prevented due to validation errors.");
            } else {
                console.log("Form seems valid client-side, attempting to submit to Netlify...");
                const draftKey = getDraftKey();
                localStorage.removeItem(draftKey);
                console.log("Draft cleared:", draftKey);
                const submitButton = form.querySelector('button[type="submit"]');
                if (submitButton) {
                    submitButton.disabled = true;
                    submitButton.textContent = 'Submitting...';
                }
            }
        });
    } else {
         console.error("Form element not found! Cannot add submit listener.");
    }


    // --- Initial UI Update ---
    // This is called last, after potential callback handling and setting up all functions/listeners
    console.log("Performing initial UI update...");
    await updateUI();
    console.log("Initial UI update complete.");

}); // End DOMContentLoaded
