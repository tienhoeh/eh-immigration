document.addEventListener('DOMContentLoaded', () => { // Main listener for DOM readiness
    console.log("DOMContentLoaded event fired.");

    // --- Auth0 Configuration ---
    const auth0Config = {
        domain: 'eh-immigration.jp.auth0.com', // Confirm this is correct
        clientId: 'GyTGD7qnwsNkXiXmxVTdVLfJMUlwdAND', // Confirm this is correct
        authorizationParams: {
            redirect_uri: window.location.origin // Uses deployed URL automatically
            // audience: 'YOUR_API_IDENTIFIER', // Add if needed later
            // scope: 'openid profile email' // Default scopes often sufficient
        }
    };

    // --- Global Elements (Declared early, assigned after DOM ready) ---
    let form, sideNavLinks, formSections, saveButton, saveStatus, formContainer,
        btnLogin, btnLogout, userProfileElement, userEmailElement,
        authLoadingElement, bodyElement;

    // Assign elements now that DOM is loaded
    form = document.querySelector('form[name="immigration-questionnaire"]');
    sideNavLinks = document.querySelectorAll('.side-nav a');
    formSections = document.querySelectorAll('.form-section');
    saveButton = document.getElementById('save-progress');
    saveStatus = document.getElementById('save-status');
    formContainer = document.getElementById('form-container');
    btnLogin = document.getElementById('btn-login');
    btnLogout = document.getElementById('btn-logout');
    userProfileElement = document.getElementById('user-profile');
    userEmailElement = document.getElementById('user-email');
    authLoadingElement = document.getElementById('auth-loading');
    bodyElement = document.body;

    // --- State Variables ---
    let auth0 = null; // Holds the Auth0 client instance
    let currentUser = null; // Holds user profile info
    let currentUserId = 'anonymous'; // Holds Auth0 user 'sub'

    // ==================================
    //  Helper Functions Definitions
    // ==================================

    // --- Auth0 Helper Functions ---
    const login = async () => {
        console.log("Login function called.");
        if (!auth0) {
            console.error("Auth0 client not initialized, cannot login.");
            alert("Authentication system is not ready. Please try again later.");
            return;
        }
        try {
            console.log("Attempting auth0.loginWithRedirect()...");
            await auth0.loginWithRedirect();
            console.log("loginWithRedirect called (browser should redirect soon).");
        } catch (e) {
            console.error("Login failed inside try/catch:", e);
            alert("Login failed: " + e.message);
        }
    };

    const logout = () => {
        console.log("Logout function called.");
        if (!auth0) {
            console.error("Auth0 client not initialized, cannot logout.");
            return;
        }
        console.log("Attempting auth0.logout()...");
        auth0.logout({
            logoutParams: {
                returnTo: window.location.origin
            }
        });
    };

    // --- UI Update Function ---
    const updateUI = async () => {
        console.log("updateUI called.");
        if (!auth0) {
            console.error("Cannot update UI, Auth0 client not initialized.");
            if (bodyElement) bodyElement.classList.remove('loading');
            if (authLoadingElement) authLoadingElement.style.display = 'none';
            // Ensure login button is visible if auth fails fundamentally
            if(btnLogin) btnLogin.style.display = 'inline-block';
            if(userProfileElement) userProfileElement.style.display = 'none';
            if(btnLogout) btnLogout.style.display = 'none';
            return;
        }
        try {
            const isAuthenticated = await auth0.isAuthenticated();
            console.log("Is Authenticated:", isAuthenticated);

            if (isAuthenticated) {
                currentUser = await auth0.getUser();
                currentUserId = currentUser?.sub || 'anonymous_authenticated';
                console.log("User Profile:", currentUser, " User ID (sub):", currentUserId);

                if(btnLogin) btnLogin.style.display = 'none';
                if(userProfileElement) userProfileElement.style.display = 'inline-block';
                if(userEmailElement) userEmailElement.textContent = currentUser?.email || 'Logged In';
                if(btnLogout) btnLogout.style.display = 'inline-block';

                if(formContainer) formContainer.style.visibility = 'visible';
                 if(saveButton) saveButton.disabled = false;

                // Load draft only AFTER confirming authentication and making form visible
                loadDraft();
                // Update nav highlighting AFTER potential form visibility change
                setActiveLink();

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
            currentUser = null;
            currentUserId = 'anonymous';
            if(btnLogin) btnLogin.style.display = 'inline-block';
            if(userProfileElement) userProfileElement.style.display = 'none';
            if(btnLogout) btnLogout.style.display = 'none';
            if(formContainer) formContainer.style.visibility = 'hidden';
            if(saveButton) saveButton.disabled = true;
        } finally {
            console.log("Removing loading state.");
            if(bodyElement) bodyElement.classList.remove('loading');
            if(authLoadingElement) authLoadingElement.style.display = 'none';
        }
    };

    // --- Draft Logic ---
    const getDraftKey = () => {
        if (currentUserId === 'anonymous' || !currentUserId) {
            console.warn("Attempting to get draft key for anonymous user.");
        }
        return `ehImmigrationDraft_${currentUserId}`;
    };

    function loadDraft() {
        const draftKey = getDraftKey();
        if (currentUserId === 'anonymous') {
            console.log("Not loading draft for anonymous user.");
            return;
        }
        const savedData = localStorage.getItem(draftKey);
        if (!savedData || !form) {
            console.log(`No draft found for key ${draftKey} or form not ready.`);
            // Ensure conditional checks run even if no draft, as default values might matter
            triggerInitialConditionalChecks();
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
                 const templateId = `${groupName.replace('_', '-')}-template`;
                 const container = document.getElementById(containerId);
                 const addButton = document.getElementById(addButtonId);
                 const template = document.getElementById(templateId);

                 if (container && addButton && template && maxIndex > 0) {
                     const existingItems = container.querySelectorAll(`.repeatable-item[data-group="${groupName}"]`).length;
                     const itemsToAdd = maxIndex - existingItems;
                     console.log(`Repeatable ${groupName}: max index ${maxIndex}, existing ${existingItems}, adding ${itemsToAdd}`);
                     // Add items synchronously
                     for (let i = 0; i < itemsToAdd; i++) {
                         const clone = template.content.cloneNode(true);
                         const newItem = clone.querySelector('.repeatable-item');
                         if (newItem) {
                             newItem.dataset.group = groupName;
                             const removeButton = newItem.querySelector('.remove-item-button');
                             if (removeButton) {
                                 removeButton.addEventListener('click', (e) => { e.target.closest('.repeatable-item').remove(); updateRepeatableItemsUI(container, groupName); });
                             }
                             container.appendChild(newItem);
                         }
                     }
                     // Update UI for all items in this group AFTER adding/removing
                     updateRepeatableItemsUI(container, groupName);

                 } else if (maxIndex > 0) {
                     console.warn(`Could not find container, button, or template for repeatable group: ${groupName}`);
                 }
            });

            // --- Populate All Fields ---
            // Use timeout to allow DOM updates from adding repeatable sections to settle
            setTimeout(() => {
                console.log("Populating form fields from loaded draft...");
                if (!form) { console.error("Form element not found during population."); return; }
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
                        return; // Skip setting value if undefined
                    }

                    // Set values based on type
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
                        input.value = value; // Handles text, date, month, select, textarea etc.
                    }
                    // Trigger change event AFTER setting value
                     input.dispatchEvent(new Event('change', { bubbles: true }));
                });

                // Trigger conditional checks AFTER potentially loading data and fields are populated
                triggerInitialConditionalChecks();

                if (saveStatus) {
                    saveStatus.textContent = 'Draft loaded.';
                    saveStatus.style.color = 'blue';
                    setTimeout(() => { if(saveStatus) saveStatus.textContent = ''; }, 3000);
                }
                 console.log("Form population attempt complete.");
            }, 150); // Increased delay slightly

        } catch (e) {
            console.error("Error loading draft JSON:", e);
            if (saveStatus) {
                saveStatus.textContent = 'Error loading draft.';
                saveStatus.style.color = 'red';
            }
            // Still run conditional checks even if draft fails to load
             triggerInitialConditionalChecks();
        }
    }

    // --- Navigation Logic ---
    function setActiveLink() {
        let currentSectionId = '';
        if (!formContainer || formContainer.style.visibility === 'hidden' || !formSections || formSections.length === 0) return;

        const scrollPosition = formContainer.scrollTop;
        const offset = 100; // Adjust as needed

        // Find the topmost section within the offset
        for (let section of formSections) {
            if (section.offsetParent !== null && section.offsetTop <= scrollPosition + offset) {
                 currentSectionId = section.id;
                 // Don't break, let the last matching section win (the one lowest on the page but still meeting criteria)
            }
        }

         // Default to first visible section if nothing else matches
         if (!currentSectionId) {
            for(let section of formSections){
                if(section.offsetParent !== null){ // is visible?
                    currentSectionId = section.id;
                    break;
                }
            }
         }

        sideNavLinks.forEach(link => {
            link.classList.remove('active');
            if (currentSectionId && link.getAttribute('href') === `#${currentSectionId}`) {
                link.classList.add('active');
            }
        });
    }

    // --- Conditional Logic ---
    // Generic function to toggle visibility and required status
    function setupConditionalVisibility(triggerElementOrNodeList, targetElement, showConditionCallback, dependentElements = []) {
         if(!targetElement) { console.warn("Target element not found for conditional visibility setup."); return;}
         const elements = triggerElementOrNodeList instanceof NodeList ? Array.from(triggerElementOrNodeList) : [triggerElementOrNodeList];
         if(elements.length === 0 || elements[0] === null) { console.warn("Trigger element(s) not found for conditional visibility setup for target:", targetElement.id); return; }

        const checkVisibility = () => {
            requestAnimationFrame(() => { // Defer slightly
                const shouldShow = showConditionCallback(elements);
                targetElement.classList.toggle('hidden', !shouldShow);

                // Toggle required based on visibility AND data attribute
                targetElement.querySelectorAll('input, select, textarea').forEach(input => {
                    const isInitiallyRequired = input.dataset.initiallyRequired === 'true';
                    if (!input.closest('.hidden')) { // Check if parent is visible
                         // Require if it's meant to be required AND shown
                        input.required = shouldShow && isInitiallyRequired;
                    } else {
                        input.required = false; // Never require if hidden
                    }
                });

                dependentElements.forEach(dep => {
                    if(dep.element){
                        dep.element.classList.toggle(dep.classToToggle || 'hidden', !shouldShow);
                        if (dep.toggleRequired) {
                            dep.element.querySelectorAll('input, select, textarea').forEach(input => {
                                 const isInitiallyRequired = input.dataset.initiallyRequired === 'true';
                                if (!input.closest('.hidden')) { input.required = shouldShow && isInitiallyRequired; }
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

    // Specific function to re-run checks after loading draft
    function triggerInitialConditionalChecks() {
        console.log("Triggering initial conditional visibility checks...");
        // Use querySelectorAll to find triggers and dispatch change event
        document.querySelectorAll('#ns-applicable, #prev-marriage-applicable, input[name="applicant_other_citizenship"]').forEach(input => {
            if (input) input.dispatchEvent(new Event('change', { bubbles: true }));
         });
         triggerInitialEmploymentCheck(); // For nested conditions
    }

     // Specific function for nested employment check
    const triggerInitialEmploymentCheck = () => {
         const container = document.getElementById('prev-children-container');
         if(!container) return;
         container.querySelectorAll('input[type="radio"][name^="prev_child"][name$="[employed]"]:checked').forEach(radio => {
             const fieldset = radio.closest('fieldset.repeatable-item');
             if (!fieldset) return;
             const detailsDiv = fieldset.querySelector('div[data-condition*="[employed]"]');
             if (detailsDiv) {
                 const shouldShow = radio.value === 'Yes';
                 detailsDiv.classList.toggle('hidden', !shouldShow);
                 const textarea = detailsDiv.querySelector('textarea');
                 if(textarea) textarea.required = shouldShow;
             }
         });
    };

    // --- Repeatable Sections Logic ---
    // Helper to update numbering and remove buttons for a specific group
    function updateRepeatableItemsUI(container, groupName) {
        if(!container) return;
        const items = container.querySelectorAll(`.repeatable-item[data-group="${groupName}"]`);
        items.forEach((item, index) => {
            const removeButton = item.querySelector('.remove-item-button');
            if (removeButton) { removeButton.classList.toggle('hidden', items.length <= 1 && !item.dataset.canBeEmpty); }
            const legend = item.querySelector('legend');
            if (legend) { legend.textContent = legend.textContent.replace(/#|\d+/, `${index + 1}`); }
             // Update IDs/Fors containing placeholder (use #)
             item.querySelectorAll(`[id*="-#"], label[for*="-#"]`).forEach(el => {
                 if (el.id) el.id = el.id.replace(`#`, `${index + 1}`);
                 if (el.htmlFor) el.htmlFor = el.htmlFor.replace(`#`, `${index + 1}`);
             });
            // Update names containing placeholder [#]
            item.querySelectorAll(`[name*="[#]"]`).forEach(input => {
                input.name = input.name.replace('[#]', `[${index + 1}]`);
            });
        });
    }

    function setupRepeatable(containerId, addButtonId, templateId, groupName) {
        const container = document.getElementById(containerId);
        const addButton = document.getElementById(addButtonId);
        const template = document.getElementById(templateId);
        if (!container || !addButton || !template) { console.warn(`Setup failed for repeatable section: Missing elements for ${groupName}`); return; }

        addButton.addEventListener('click', () => {
            const clone = template.content.cloneNode(true);
            const newItem = clone.querySelector('.repeatable-item');
            if (!newItem) { console.error(`Template ${templateId} missing .repeatable-item.`); return; }
            newItem.dataset.group = groupName; // Ensure group name is set

            const removeButton = newItem.querySelector('.remove-item-button');
            if (removeButton) {
                removeButton.addEventListener('click', (e) => { e.target.closest('.repeatable-item').remove(); updateRepeatableItemsUI(container, groupName); });
            } else { console.warn(`Template ${templateId} missing .remove-item-button`); }

            container.appendChild(newItem); // Add to DOM
            updateRepeatableItemsUI(container, groupName); // Update numbering/buttons for all items

            // Trigger initial conditional checks within the newly added item
             newItem.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(input => {
                 input.dispatchEvent(new Event('change', { bubbles: true }));
             });
        });

        // Add remove listeners to initially present buttons
        container.querySelectorAll(`.repeatable-item[data-group="${groupName}"] .remove-item-button`).forEach(button => {
             if (!button.dataset.listenerAttached) {
                 button.addEventListener('click', (e) => { e.target.closest('.repeatable-item').remove(); updateRepeatableItemsUI(container, groupName); });
                 button.dataset.listenerAttached = 'true';
             }
         });
        updateRepeatableItemsUI(container, groupName); // Initial setup
    }

    // --- Form Submission Validation ---
    function setupFormSubmit() {
        if (form) {
            form.addEventListener('submit', (e) => {
                console.log("Form submit event triggered.");
                let firstInvalid = null;
                // Check elements required that are VISIBLE
                form.querySelectorAll('input[required], select[required], textarea[required]').forEach(input => {
                    // Reset previous styles
                    input.style.border = '';
                    input.style.backgroundColor = '';

                    // Check if element or ancestor is hidden or display:none
                    let isHidden = false;
                    let currentElement = input;
                    while (currentElement && currentElement !== document.body) {
                        if (currentElement.classList.contains('hidden') || window.getComputedStyle(currentElement).display === 'none' || window.getComputedStyle(currentElement).visibility === 'hidden') {
                            isHidden = true;
                            break;
                        }
                        // Check offsetParent as a reliable visibility check
                        if(currentElement.offsetParent === null && currentElement !== document.body) {
                            // Only consider truly hidden, not just temporarily off-screen due to scroll
                            const rect = currentElement.getBoundingClientRect();
                            if (rect.width === 0 && rect.height === 0) {
                                isHidden = true;
                                break;
                            }
                        }
                        currentElement = currentElement.parentElement;
                    }

                    if (!isHidden && !input.validity.valid) {
                        if (!firstInvalid) firstInvalid = input;
                        console.warn("Invalid field:", input.name, input.validationMessage, input);
                        input.style.border = '2px solid red';
                        input.style.backgroundColor = '#ffeeee';
                    }
                });

                if (firstInvalid) {
                    e.preventDefault();
                    const fieldLabel = firstInvalid.labels.length > 0 ? firstInvalid.labels[0].innerText.replace('*','').trim() : '';
                    const fieldName = fieldLabel || `Field named '${firstInvalid.name}'`;
                    alert(`Please fill out the required field: ${fieldName}`);

                    const section = firstInvalid.closest('.form-section');
                    if (section && formContainer) {
                         section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                         setTimeout(() => { try { firstInvalid.focus(); } catch(err){} }, 300);
                     } else {
                          try { firstInvalid.focus(); } catch(err){}
                     }
                    console.log("Form submission prevented due to validation errors.");
                } else {
                    console.log("Form seems valid client-side, attempting to submit to Netlify...");
                    const draftKey = getDraftKey();
                    if (currentUserId !== 'anonymous') {
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
    }


    // ==================================
    //  Initialization Orchestration
    // ==================================

    // --- Function to Initialize Auth0 and the rest of the app ---
    async function initializeApp() {
        console.log("Attempting to initialize Auth0 client inside initializeApp...");
        // Note: auth0 should be defined by now if waitForAuth0Sdk succeeded
        if (!auth0) {
            console.error("initializeApp called but auth0 client is still null.");
            if (authLoadingElement) authLoadingElement.textContent = "Fatal error during authentication setup.";
            if (bodyElement) bodyElement.classList.remove('loading');
            return;
        }

        // --- Handle Redirect Callback ---
         if (window.location.search.includes("code=") && window.location.search.includes("state=")) {
             console.log("Detected Auth0 callback parameters.");
             try {
                 console.log("Attempting handleRedirectCallback...");
                 await auth0.handleRedirectCallback();
                 console.log("Handled redirect callback.");
                 console.log("Cleaning URL parameters.");
                 window.history.replaceState({}, document.title, window.location.pathname);
             } catch (e) {
                 console.error("Error handling redirect callback:", e);
             }
         } else {
             console.log("No Auth0 callback parameters detected.");
         }

        // --- Setup Event Listeners ---
        setupEventListeners();

        // --- Setup Other App Logic ---
        setupConditionalLogic(); // Setup show/hide logic for sections
        setupRepeatables(); // Setup add/remove for repeatable sections
        setupNavigation(); // Setup side navigation scrolling/highlighting
        setupFormSubmit(); // Setup form validation on submit

        // --- Initial UI Update & Draft Load ---
        console.log("Performing initial UI update...");
        await updateUI(); // Update UI based on auth state (loads draft if logged in)
        console.log("Initial UI update complete.");

    }

    // --- Function to Check if Auth0 SDK is ready ---
    function waitForAuth0Sdk(callback, maxAttempts = 20, interval = 150) { // Slightly increased interval
        let attempts = 0;
        const check = () => {
            const sdkFunctionAvailable = typeof createAuth0Client === 'function';
            console.log(`Checking for createAuth0Client, attempt ${attempts + 1}... Type: ${typeof createAuth0Client}, Available: ${sdkFunctionAvailable}`);

            if (sdkFunctionAvailable) {
                console.log("createAuth0Client found!");
                callback(); // SDK ready, proceed with initialization
            } else {
                attempts++;
                if (attempts < maxAttempts) {
                    setTimeout(check, interval); // Check again shortly
                } else {
                    console.error(`Auth0 SDK (createAuth0Client) not found after ${maxAttempts} attempts.`);
                    if (authLoadingElement) authLoadingElement.textContent = "Error loading authentication library. Please check Network tab or refresh.";
                    if (bodyElement) bodyElement.classList.remove('loading'); // Stop loading state
                }
            }
        };
        check(); // Start checking
    }


     // --- Define Setup Functions (Called by initializeApp) ---
     function setupEventListeners() {
         console.log("Setting up event listeners...");
         if (btnLogin) { btnLogin.addEventListener('click', login); } else { console.error("Login button not found"); }
         if (btnLogout) { btnLogout.addEventListener('click', logout); } else { console.error("Logout button not found"); }
         // Note: Save button listener is added directly as it depends on draftKey logic tied to auth state
     }

     function setupConditionalLogic() {
        console.log("Setting up conditional logic...");
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
                     const detailsDiv = fieldset.querySelector('div[data-condition*="[employed]"]');
                     if (detailsDiv) {
                         const shouldShow = event.target.checked && event.target.value === 'Yes';
                         detailsDiv.classList.toggle('hidden', !shouldShow);
                         const textarea = detailsDiv.querySelector('textarea');
                         if(textarea) textarea.required = shouldShow;
                     }
                 }
             });
         }
     }

     function setupRepeatables() {
        console.log("Setting up repeatable sections...");
         // Setup All Repeatable Sections
         setupRepeatable('siblings-container', 'add-sibling', 'sibling-template', 'sibling');
         setupRepeatable('education-container', 'add-education', 'education-template', 'education');
         setupRepeatable('employment-container', 'add-employment', 'employment-template', 'employment');
         setupRepeatable('absence-container', 'add-absence', 'absence-template', 'absence');
         setupRepeatable('passport-container', 'add-passport', 'passport-template', 'passport');
         setupRepeatable('prev-marriage-container', 'add-prev-marriage', 'prev-marriage-template', 'prev_marriage');
         setupRepeatable('prev-children-container', 'add-prev-child', 'prev-child-template', 'prev_child');
     }

     function setupNavigation() {
         console.log("Setting up navigation...");
         if(formContainer) formContainer.addEventListener('scroll', setActiveLink);
          sideNavLinks.forEach(link => {
             link.addEventListener('click', (e) => {
                 e.preventDefault();
                 const targetId = link.getAttribute('href');
                 const targetSection = document.querySelector(targetId);
                 if (targetSection && formContainer) {
                     if(targetSection.offsetParent !== null) {
                         formContainer.scrollTo({ top: targetSection.offsetTop - 10, behavior: 'smooth' });
                         sideNavLinks.forEach(l => l.classList.remove('active'));
                         link.classList.add('active');
                      } else { console.warn(`Nav target section ${targetId} not visible.`); }
                 } else { console.warn(`Nav target ${targetId} or form container not found.`); }
             });
         });
         setActiveLink(); // Initial call
     }

     function setupFormSubmit() {
         console.log("Setting up form submit listener...");
         // The submit listener logic is defined within this function in the previous combined version,
         // so just ensure that logic is correctly placed here or called from here.
         // The code for the submit listener provided before is already self-contained.
         if (form) {
             form.addEventListener('submit', (e) => {
                 // PASTE THE FORM SUBMIT VALIDATION LOGIC HERE (from previous response)
                console.log("Form submit event triggered.");
                let firstInvalid = null;
                formContainer.querySelectorAll('input[required], select[required], textarea[required]').forEach(input => {
                    input.style.border = ''; input.style.backgroundColor = ''; // Reset styles
                    let isHidden = false; let currentElement = input;
                    while (currentElement && currentElement !== document.body) {
                        if (currentElement.classList.contains('hidden') || window.getComputedStyle(currentElement).display === 'none' || window.getComputedStyle(currentElement).visibility === 'hidden') { isHidden = true; break; }
                        if(currentElement.offsetParent === null && currentElement !== document.body) { const rect = currentElement.getBoundingClientRect(); if (rect.width === 0 && rect.height === 0) { isHidden = true; break; } }
                        currentElement = currentElement.parentElement;
                    }
                    if (!isHidden && !input.validity.valid) {
                        if (!firstInvalid) firstInvalid = input;
                        console.warn("Invalid field:", input.name, input.validationMessage, input);
                        input.style.border = '2px solid red'; input.style.backgroundColor = '#ffeeee';
                    }
                });

                if (firstInvalid) {
                    e.preventDefault();
                    const fieldLabel = firstInvalid.labels.length > 0 ? firstInvalid.labels[0].innerText.replace('*','').trim() : '';
                    const fieldName = fieldLabel || `Field named '${firstInvalid.name}'`;
                    alert(`Please fill out the required field: ${fieldName}`);
                    const section = firstInvalid.closest('.form-section');
                    if (section && formContainer) {
                         section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                         setTimeout(() => { try { firstInvalid.focus(); } catch(err){} }, 300);
                     } else { try { firstInvalid.focus(); } catch(err){} }
                    console.log("Form submission prevented due to validation errors.");
                } else {
                    console.log("Form seems valid client-side, attempting to submit to Netlify...");
                    const draftKey = getDraftKey();
                    if (currentUserId !== 'anonymous') { localStorage.removeItem(draftKey); console.log("Draft cleared:", draftKey); }
                    const submitButton = form.querySelector('button[type="submit"]');
                    if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Submitting...'; }
                }
             }); // End submit listener callback
         } else { console.error("Form element not found! Cannot add submit listener."); }
     } // End setupFormSubmit function


    // --- Start the application ---
    waitForAuth0Sdk(initializeApp); // Wait for SDK then initialize the app

}); // End DOMContentLoaded
