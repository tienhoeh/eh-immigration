document.addEventListener('DOMContentLoaded', async () => { // Make top-level async

    // --- Auth0 Configuration ---
    const auth0Config = {
        domain: 'eh-immigration.jp.auth0.com', // Replace with your Auth0 Tenant Domain if different
        clientId: 'GyTGD7qnwsNkXiXmxVTdVLfJMUlwdAND', // Replace with your Auth0 Application Client ID if different
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

    // <<< NEW DEBUGGING LINES START >>>
    console.log("DOMContentLoaded event fired.");
    console.log("Checking if createAuth0Client is defined RIGHT BEFORE using it...");
    // This log will show the type. It should be 'function' if the SDK loaded.
    console.log(`Type of createAuth0Client: ${typeof createAuth0Client}`);
    // <<< NEW DEBUGGING LINES END >>>

    // --- Initialize Auth0 Client ---
    try {
        // Make sure createAuth0Client is available globally (it should be if SDK script loaded)
        if (typeof createAuth0Client !== 'function') {
            // This error should now be preceded by the console logs above
            throw new Error("createAuth0Client is not defined. Auth0 SDK script might not be loaded or executed yet.");
        }
        auth0 = await createAuth0Client({
            domain: auth0Config.domain,
            clientId: auth0Config.clientId,
            authorizationParams: auth0Config.authorizationParams
        });
        console.log("Auth0 client initialized successfully."); // Success message
    } catch (e) {
        console.error("Error initializing Auth0 client:", e); // Log the specific error
        if (authLoadingElement) authLoadingElement.textContent = "Error initializing authentication. Please check console and refresh."; // More specific error message
        if (bodyElement) bodyElement.classList.remove('loading'); // Show error message
        return; // Stop further execution
    }

    // --- Auth0 Helper Functions ---
    const login = async () => {
        console.log("Login function called."); // Log when function starts
        if (!auth0) { // Add a check if auth0 client exists
            console.error("Auth0 client not initialized, cannot login.");
            alert("Authentication system is not ready. Please try again later.");
            return;
        }
        try {
            console.log("Attempting auth0.loginWithRedirect()..."); // Log before redirect
            await auth0.loginWithRedirect();
            // Note: Execution typically stops here as the browser redirects.
            console.log("loginWithRedirect called (browser should redirect soon)."); // Might not show if redirect is immediate
        } catch (e) {
            console.error("Login failed inside try/catch:", e); // Log if redirect itself fails
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
            if(bodyElement) bodyElement.classList.remove('loading'); // Remove loading anyway
            if(authLoadingElement) authLoadingElement.style.display = 'none'; // Hide loading text
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
                if(userProfileElement) userProfileElement.style.display = 'inline-block';
                if(userEmailElement) userEmailElement.textContent = currentUser?.email || 'Logged In';
                if(btnLogout) btnLogout.style.display = 'inline-block';

                if(formContainer) formContainer.style.visibility = 'visible';
                if(saveButton) saveButton.disabled = false;

                setActiveLink();
                loadDraft();

            } else {
                currentUser = null;
                currentUserId = 'anonymous';
                if(btnLogin) btnLogin.style.display = 'inline-block';
                if(userProfileElement) userProfileElement.style.display = 'none';
                if(btnLogout) btnLogout.style.display = 'none';

                if(formContainer) formContainer.style.visibility = 'hidden';
                if(saveButton) saveButton.disabled = true;
                if (saveStatus) saveStatus.textContent = '';
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
            if(bodyElement) bodyElement.classList.remove('loading');
            if(authLoadingElement) authLoadingElement.style.display = 'none';
        }
    };

    // --- Handle Auth0 Redirect Callback ---
    // Check if the user is returning from Auth0 with code and state params
    if (window.location.search.includes("code=") && window.location.search.includes("state=")) {
        console.log("Detected Auth0 callback parameters in URL.");
        if (!auth0) {
             console.error("Auth0 client not ready to handle redirect callback. Waiting might resolve if init is slow.");
             // Ideally, wait for init promise, but simple approach proceeds. updateUI will handle auth state.
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
                // Error here might mean the state is invalid or code is expired.
                // updateUI will likely run later and show a logged-out state.
            }
         }
    } else {
         console.log("No Auth0 callback parameters detected in URL (normal page load or post-callback load).");
     }

    // --- Event Listeners ---
    if (btnLogin) {
        console.log("Attempting to add login listener to:", btnLogin); // Debug log
        btnLogin.addEventListener('click', login); // Attach listener
    } else {
        console.error("Login button (#btn-login) not found in the DOM!"); // Error if missing
    }

    if (btnLogout) {
        console.log("Attempting to add logout listener to:", btnLogout); // Debug log
        btnLogout.addEventListener('click', logout);
    } else {
         console.error("Logout button (#btn-logout) not found in the DOM!"); // Error if missing
     }


    // --- Helper: Get User-Specific Draft Key ---
    const getDraftKey = () => {
        // currentUserId is updated in updateUI after successful authentication
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
                    setTimeout(() => { if(saveStatus) saveStatus.textContent = ''; }, 3000);
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
                    setTimeout(() => { if(saveStatus) saveStatus.textContent = ''; }, 3000);
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
                     // Add items synchronously before populating
                     for (let i = 0; i < itemsToAdd; i++) {
                        const template = document.getElementById(`${groupName.replace('_', '-')}-template`);
                        if (template) {
                            const clone = template.content.cloneNode(true);
                            const newItem = clone.querySelector('.repeatable-item');
                            if (newItem) {
                                newItem.dataset.group = groupName;
                                const removeButton = newItem.querySelector('.remove-item-button');
                                if (removeButton) {
                                    // Add listener immediately
                                    removeButton.addEventListener('click', (e) => { e.target.closest('.repeatable-item').remove(); updateItemsUI(); });
                                }
                                container.appendChild(newItem);
                            }
                        }
                     }
                     // Update UI (numbering, remove buttons) after adding all needed items
                     const updateItemsUI = () => { // Define helper within scope if needed or make global
                         container.querySelectorAll(`.repeatable-item[data-group="${groupName}"]`).forEach((item, index) => {
                             const removeButton = item.querySelector('.remove-item-button');
                             if (removeButton) { removeButton.classList.toggle('hidden', container.querySelectorAll(`.repeatable-item[data-group="${groupName}"]`).length <= 1 && !item.dataset.canBeEmpty); }
                             const legend = item.querySelector('legend');
                             if (legend) { legend.textContent = legend.textContent.replace(/#|\d+/, `${index + 1}`); }
                         });
                     };
                     updateItemsUI(); // Update numbering/buttons now

                 } else if (maxIndex > 0) {
                     console.warn(`Could not find container or button for repeatable group: ${groupName}`);
                 }
            });


            // --- Populate All Fields (including newly added repeatable ones) ---
            // Use timeout to allow DOM updates from adding repeatable sections to settle
            setTimeout(() => {
                console.log("Populating form fields from loaded draft...");
                form.querySelectorAll('input, select, textarea').forEach(input => {
                    const name = input.name;
                    // Need to get the index if it's a repeatable field
                    const repeatableMatch = name.match(/^(\w+)\[(\d+)\]/);
                    const baseName = repeatableMatch ? repeatableMatch[1] : name;
                    const index = repeatableMatch ? parseInt(repeatableMatch[2]) : null;

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
                            const actualBaseName = name.slice(0, -2);
                            input.checked = Array.isArray(dataObject[actualBaseName]) && dataObject[actualBaseName].includes(input.value);
                        } else {
                            input.checked = value === true || value === 'yes' || value === 'on';
                        }
                    } else if (input.type === 'radio') {
                        input.checked = (input.value === value);
                    } else {
                        input.value = value;
                    }
                    input.dispatchEvent(new Event('change', { bubbles: true })); // Trigger change event AFTER setting value
                });

                // Trigger conditional checks AFTER potentially loading data and fields are populated
                triggerInitialConditionalChecks();

                if (saveStatus) {
                    saveStatus.textContent = 'Draft loaded.';
                    saveStatus.style.color = 'blue';
                    setTimeout(() => { if(saveStatus) saveStatus.textContent = ''; }, 3000);
                }
                 console.log("Form population complete.");
            }, 100); // Small delay (e.g., 100ms)

        } catch (e) {
            console.error("Error loading draft JSON:", e);
            if (saveStatus) {
                saveStatus.textContent = 'Error loading draft.';
                saveStatus.style.color = 'red';
            }
        }
    }


    // --- Navigation Logic ---
    function setActiveLink() {
        let currentSectionId = '';
        // Ensure formContainer exists and is visible before calculating scroll/offsets
        if (!formContainer || formContainer.style.visibility === 'hidden') return;

        const scrollPosition = formContainer.scrollTop;
        const offset = 100; // Viewport offset

        if(formSections.length === 0) return; // Don't run if no sections found

        formSections.forEach(section => {
             // Check visibility before considering offsetTop
            if (section.offsetParent !== null && section.offsetTop <= scrollPosition + offset) {
                currentSectionId = section.id;
            }
        });
         // Default to first section if none match (e.g., scrolled to top)
         if (!currentSectionId) {
             currentSectionId = formSections[0].id;
         }

        sideNavLinks.forEach(link => {
            link.classList.remove('active');
            // Check if href matches, handling potential null/empty currentSectionId
            if (currentSectionId && link.getAttribute('href') === `#${currentSectionId}`) {
                link.classList.add('active');
            }
        });
    }
    if(formContainer) formContainer.addEventListener('scroll', setActiveLink);
    sideNavLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            if (targetSection && formContainer) {
                 // Ensure section is actually visible before scrolling
                 if(targetSection.offsetParent !== null) {
                    formContainer.scrollTo({ top: targetSection.offsetTop - 10, behavior: 'smooth' }); // Adjust offset slightly
                    // Update active link immediately for feedback
                    sideNavLinks.forEach(l => l.classList.remove('active'));
                    link.classList.add('active');
                 } else {
                     console.warn(`Navigation target section ${targetId} is not visible.`);
                 }
            } else {
                 console.warn(`Navigation target ${targetId} or form container not found.`);
             }
        });
    });


    // --- Conditional Logic ---
    function setupConditionalVisibility(triggerElementOrNodeList, targetElement, showConditionCallback, dependentElements = []) {
         if(!targetElement) { console.warn("Target element not found for conditional visibility setup for:", triggerElementOrNodeList); return;}
         const elements = triggerElementOrNodeList instanceof NodeList ? Array.from(triggerElementOrNodeList) : [triggerElementOrNodeList];
         if(elements.length === 0 || elements[0] === null) { console.warn("Trigger element(s) not found for conditional visibility setup for target:", targetElement.id); return; }

        const checkVisibility = () => {
            // Defer check slightly if called very early, elements might not be fully ready
            requestAnimationFrame(() => {
                const shouldShow = showConditionCallback(elements);
                targetElement.classList.toggle('hidden', !shouldShow);

                // Toggle required attribute ONLY if the element is intended to be required when visible
                targetElement.querySelectorAll('input[data-initially-required="true"], select[data-initially-required="true"], textarea[data-initially-required="true"]').forEach(input => {
                    if (!input.closest('.hidden')) { input.required = shouldShow; } // Only require if parent is shown
                    else { input.required = false; } // Always false if hidden
                });

                dependentElements.forEach(dep => {
                    if(dep.element){
                        dep.element.classList.toggle(dep.classToToggle || 'hidden', !shouldShow);
                        if (dep.toggleRequired) {
                            dep.element.querySelectorAll('input[data-initially-required="true"], select[data-initially-required="true"], textarea[data-initially-required="true"]').forEach(input => {
                                if (!input.closest('.hidden')) { input.required = shouldShow; }
                                else { input.required = false; }
                            });
                        }
                    } else { console.warn("Dependent element not found in conditional setup"); }
                });
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
    if(otherCitizenshipRadio && otherCitizenshipRadio.length > 0 && otherCitizenshipDetails) setupConditionalVisibility(otherCitizenshipRadio, otherCitizenshipDetails, (elements) => elements.some(radio => radio.checked && radio.value === 'Yes'));

    // Event delegation for previous child employment
    const prevChildrenContainer = document.getElementById('prev-children-container');
    if(prevChildrenContainer) {
         prevChildrenContainer.addEventListener('change', (event) => {
             if (event.target.matches('input[type="radio"][name^="prev_child"][name$="[employed]"]')) {
                 const fieldset = event.target.closest('fieldset.repeatable-item');
                 if (!fieldset) return;
                 const detailsDiv = fieldset.querySelector('div[data-condition*="[employed]"]'); // Use data-condition selector
                 if (detailsDiv) {
                     const shouldShow = event.target.checked && event.target.value === 'Yes';
                     detailsDiv.classList.toggle('hidden', !shouldShow);
                     // Find the textarea within this conditional div and toggle required
                     const textarea = detailsDiv.querySelector('textarea');
                     if (textarea) {
                         textarea.required = shouldShow;
                     }
                 }
             }
         });
     }

    // --- Repeatable Sections Logic ---
    // (Ensure data-initially-required="true" is added to required fields in templates)
    function setupRepeatable(containerId, addButtonId, templateId, groupName) {
        const container = document.getElementById(containerId);
        const addButton = document.getElementById(addButtonId);
        const template = document.getElementById(templateId);
        if (!container || !addButton || !template) { console.warn(`Setup failed for repeatable section: Missing elements for ${groupName} (Container: ${containerId}, Button: ${addButtonId}, Template: ${templateId})`); return; }

        const updateItemsUI = () => { // Updates numbering and remove button visibility
             const items = container.querySelectorAll(`.repeatable-item[data-group="${groupName}"]`);
             items.forEach((item, index) => {
                 const removeButton = item.querySelector('.remove-item-button');
                 if (removeButton) { removeButton.classList.toggle('hidden', items.length <= 1 && !item.dataset.canBeEmpty); } // Hide if only one left
                 const legend = item.querySelector('legend');
                 if (legend) { legend.textContent = legend.textContent.replace(/#|\d+/, `${index + 1}`); } // Update legend number
                 // Update IDs/Fors containing placeholder
                 item.querySelectorAll(`[id*="-${groupName}-#-"], label[for*="-${groupName}-#-"]`).forEach(el => {
                     if (el.id) el.id = el.id.replace(`-${groupName}-#-`, `-${groupName}-${index + 1}-`);
                     if (el.htmlFor) el.htmlFor = el.htmlFor.replace(`-${groupName}-#-`, `-${groupName}-${index + 1}-`);
                 });
                 // Update names containing placeholder
                 item.querySelectorAll(`[name*="[#]"]`).forEach(input => {
                     input.name = input.name.replace('[#]', `[${index + 1}]`);
                 });
             });
        };


        addButton.addEventListener('click', () => {
            const clone = template.content.cloneNode(true);
            const newItem = clone.querySelector('.repeatable-item');
            if (!newItem) { console.error(`Template ${templateId} missing .repeatable-item.`); return; }
            newItem.dataset.group = groupName; // Ensure group name is set

            // Add remove listener to the new button *before* appending
            const removeButton = newItem.querySelector('.remove-item-button');
            if (removeButton) {
                removeButton.addEventListener('click', (e) => {
                    e.target.closest('.repeatable-item').remove();
                    updateItemsUI(); // Update visibility and numbering after removing
                });
            } else { console.warn(`Template ${templateId} missing .remove-item-button`); }

            container.appendChild(newItem); // Add to DOM
            updateItemsUI(); // Update numbering/buttons for all items

            // Trigger initial conditional checks within the newly added item
             newItem.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(input => {
                 input.dispatchEvent(new Event('change', { bubbles: true }));
             });
             // Re-apply any specific logic needed for new items if necessary
        });

        // Add remove listeners to initially present buttons
        container.querySelectorAll(`.repeatable-item[data-group="${groupName}"] .remove-item-button`).forEach(button => {
             if (!button.dataset.listenerAttached) { // Prevent adding multiple listeners on load/reload
                 button.addEventListener('click', (e) => {
                     e.target.closest('.repeatable-item').remove();
                     updateItemsUI();
                 });
                 button.dataset.listenerAttached = 'true';
             }
         });
        updateItemsUI(); // Initial setup for numbering and remove buttons
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
            // Check only inputs within the form container that are required
            formContainer.querySelectorAll('input[required], select[required], textarea[required]').forEach(input => {
                 // Check if the element or its parent section is hidden
                const parentSection = input.closest('.form-section, .fieldset-group'); // Check fieldset group too for nested conditionals
                let isHidden = input.closest('.hidden') || (parentSection && parentSection.classList.contains('hidden'));

                // Additional check for computed style display none (more robust)
                 if(!isHidden && window.getComputedStyle(input).display === 'none'){
                     isHidden = true;
                 }
                 // Check parent visibility too
                 let currentElement = input.parentElement;
                 while(currentElement && currentElement !== formContainer){
                     if(window.getComputedStyle(currentElement).display === 'none'){
                         isHidden = true;
                         break;
                     }
                     currentElement = currentElement.parentElement;
                 }


                if (!isHidden && !input.validity.valid) {
                    if (!firstInvalid) firstInvalid = input;
                    console.warn("Invalid field:", input.name, input.validationMessage, input);
                    input.style.border = '2px solid red';
                    input.style.backgroundColor = '#ffeeee'; // Highlight background
                } else {
                    // Reset style if valid or hidden
                    input.style.border = '';
                    input.style.backgroundColor = '';
                }
            });

            if (firstInvalid) {
                e.preventDefault(); // Prevent submission
                const fieldLabel = firstInvalid.labels.length > 0 ? firstInvalid.labels[0].innerText.replace('*','').trim() : '';
                const fieldName = fieldLabel || `Field named '${firstInvalid.name}'`;
                alert(`Please fill out the required field: ${fieldName}`);

                const section = firstInvalid.closest('.form-section');
                if (section && formContainer) {
                     // Scroll section into view first
                     section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                     // Then try focusing - slight delay might help after scroll
                     setTimeout(() => {
                         try { firstInvalid.focus(); } catch(err){}
                     }, 300); // Delay focus slightly
                 } else {
                      try { firstInvalid.focus(); } catch(err){} // Fallback focus
                 }
                console.log("Form submission prevented due to validation errors.");
            } else {
                console.log("Form seems valid client-side, attempting to submit to Netlify...");
                const draftKey = getDraftKey();
                if(currentUserId !== 'anonymous') { // Only clear draft if logged in
                    localStorage.removeItem(draftKey);
                    console.log("Draft cleared:", draftKey);
                }
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
    await updateUI(); // Checks auth state, updates buttons/form visibility, loads draft if logged in.
    console.log("Initial UI update complete.");
    setActiveLink(); // Set initial active link after UI is potentially visible

}); // End DOMContentLoaded
