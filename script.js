document.addEventListener('DOMContentLoaded', () => {
    // --- Global Elements ---
    const form = document.querySelector('form[name="immigration-questionnaire"]');
    const sideNavLinks = document.querySelectorAll('.side-nav a');
    const formSections = document.querySelectorAll('.form-section');
    const saveButton = document.getElementById('save-progress');
    const saveStatus = document.getElementById('save-status');
    const formContainer = document.getElementById('form-container');
    const loginPrompt = document.getElementById('login-prompt');
    const identityWidget = window.netlifyIdentity; // Get the widget object

    // --- Helper: Get User-Specific Draft Key ---
    const getDraftKey = () => {
        const user = identityWidget ? identityWidget.currentUser() : null;
        const userId = user ? user.id : 'anonymous'; // Use 'anonymous' if not logged in (though form is hidden)
        return `ehImmigrationDraft_${userId}`;
    };

    // --- Navigation ---
    function setActiveLink() {
        let currentSectionId = '';
        const scrollPosition = formContainer.scrollTop || window.pageYOffset; // Use container scroll or window scroll
        const offset = 100; // Offset to trigger activation slightly before section top hits viewport top

        formSections.forEach(section => {
            // Check if the top of the section is within the viewport + offset
            if (section.offsetTop <= scrollPosition + offset) {
                currentSectionId = section.id;
            }
        });

        // Fallback if scrolled past all sections or initial load
        if (!currentSectionId && formSections.length > 0) {
            // If scroll is very low, likely near the beginning
            if (scrollPosition < formSections[0].offsetTop + offset) {
                 currentSectionId = formSections[0].id;
            }
             // Could add logic for end if needed, but usually last section check above works
             // else { currentSectionId = formSections[formSections.length - 1].id; }
        }


        sideNavLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${currentSectionId}`) {
                link.classList.add('active');
            }
        });
    }

    sideNavLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            if (targetSection) {
                // Scroll the form container, not the window
                formContainer.scrollTo({
                    top: targetSection.offsetTop - 5, // Adjust offset slightly
                    behavior: 'smooth'
                 });

                // Manually set active class immediately for better feedback
                sideNavLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
            }
        });
    });

    // Update active link on scroll within the form container
    formContainer.addEventListener('scroll', setActiveLink);
    setActiveLink(); // Initial check

    // --- Conditional Logic ---
    const otherCitizenshipRadio = form.querySelectorAll('input[name="applicant_other_citizenship"]');
    const otherCitizenshipDetails = document.getElementById('other-citizenship-details');
    const nsApplicableCheckbox = document.getElementById('ns-applicable');
    const nsDetailsContainer = document.getElementById('ns-details-container');
    const prevMarriageCheckbox = document.getElementById('prev-marriage-applicable');
    const prevMarriageContainer = document.getElementById('prev-marriage-container');
    const addPrevMarriageButton = document.getElementById('add-prev-marriage');
    const prevChildrenSection = document.getElementById('section-prev-children'); // The whole section

    // Generic function to toggle visibility and required status
    function setupConditionalVisibility(triggerElementOrNodeList, targetElement, showConditionCallback, dependentElements = []) {
        const elements = triggerElementOrNodeList instanceof NodeList ? Array.from(triggerElementOrNodeList) : [triggerElementOrNodeList];

        const checkVisibility = () => {
            const shouldShow = showConditionCallback(elements);
            targetElement.classList.toggle('hidden', !shouldShow);

            // Toggle required attribute for inputs inside the target container
            targetElement.querySelectorAll('input, select, textarea').forEach(input => {
                 // Don't make hidden inputs required (like honeypot)
                 if (input.type !== 'hidden' && !input.closest('.hidden')) { // Double check parent isn't hidden
                      // Only make required if parent container is shown
                     input.required = shouldShow;
                 } else {
                      input.required = false; // Ensure hidden fields aren't required
                 }
            });

            // Handle dependent elements (like add buttons or entire sections)
            dependentElements.forEach(dep => {
                dep.element.classList.toggle(dep.classToToggle || 'hidden', !shouldShow);
                // Also toggle required on inputs within dependent sections if needed
                 if (dep.toggleRequired) {
                     dep.element.querySelectorAll('input, select, textarea').forEach(input => {
                         if (input.type !== 'hidden' && !input.closest('.hidden')) {
                            input.required = shouldShow;
                         } else {
                             input.required = false;
                         }
                     });
                 }
            });
        };

        elements.forEach(element => {
            element.addEventListener('change', checkVisibility);
        });

        checkVisibility(); // Initial check on load
    }

    // Setup specific conditions
    setupConditionalVisibility(
        otherCitizenshipRadio,
        otherCitizenshipDetails,
        (elements) => elements.some(radio => radio.checked && radio.value === 'Yes')
    );

    setupConditionalVisibility(
        nsApplicableCheckbox,
        nsDetailsContainer,
        (elements) => elements[0].checked // Checkbox just needs to be checked
    );

    setupConditionalVisibility(
        prevMarriageCheckbox,
        prevMarriageContainer,
        (elements) => elements[0].checked, // Checkbox checked
        [ // Dependent elements
            { element: addPrevMarriageButton, classToToggle: 'hidden' },
            { element: prevChildrenSection, classToToggle: 'hidden', toggleRequired: true } // Also toggle required for inputs in this section
        ]
    );

    // Conditional visibility for employed child in previous marriage (using event delegation on container)
    document.getElementById('prev-children-container').addEventListener('change', (event) => {
        // Matches radio buttons for employment status within any prev_child fieldset
        if (event.target.matches('input[type="radio"][name^="prev_child"][name$="[employed]"]')) {
            const fieldset = event.target.closest('fieldset.repeatable-item');
            if (!fieldset) return;
            const detailsDiv = fieldset.querySelector('div[data-condition*="[employed]"]'); // Find the employment details div
            if (detailsDiv) {
                const shouldShow = event.target.checked && event.target.value === 'Yes';
                detailsDiv.classList.toggle('hidden', !shouldShow);
                // Toggle required on the textarea inside
                detailsDiv.querySelectorAll('textarea').forEach(ta => {
                    ta.required = shouldShow;
                });
            }
        }
    });
     // Initial check for existing employment detail divs on load (needed for saved drafts)
    const triggerInitialEmploymentCheck = () => {
         document.querySelectorAll('#prev-children-container input[type="radio"][name^="prev_child"][name$="[employed]"]:checked').forEach(radio => {
             const fieldset = radio.closest('fieldset.repeatable-item');
             if (!fieldset) return;
             const detailsDiv = fieldset.querySelector('div[data-condition*="[employed]"]');
             if (detailsDiv) {
                 const shouldShow = radio.value === 'Yes';
                 detailsDiv.classList.toggle('hidden', !shouldShow);
                 detailsDiv.querySelectorAll('textarea').forEach(ta => {
                    ta.required = shouldShow;
                });
             }
         });
    };


    // --- Repeatable Sections ---
    function setupRepeatable(containerId, addButtonId, templateId, groupName) {
        const container = document.getElementById(containerId);
        const addButton = document.getElementById(addButtonId);
        const template = document.getElementById(templateId);

        if (!container || !addButton || !template) {
            console.warn(`Setup failed for repeatable section: Missing elements for ${groupName} (Container: ${containerId}, Button: ${addButtonId}, Template: ${templateId})`);
            return;
        }

        // Function to update remove buttons visibility and legend numbers
        const updateItemsUI = () => {
            const items = container.querySelectorAll(`.repeatable-item[data-group="${groupName}"]`);
            items.forEach((item, index) => {
                const removeButton = item.querySelector('.remove-item-button');
                if (removeButton) {
                    removeButton.classList.toggle('hidden', items.length <= 1 && !item.dataset.canBeEmpty); // Hide if only one left, unless it can be empty
                }
                // Update legend number
                const legend = item.querySelector('legend');
                if (legend) {
                    // Replace # placeholder or existing number
                    legend.textContent = legend.textContent.replace(/#|\d+/, `${index + 1}`);
                }
                // Update IDs and label 'for' attributes if they contain index placeholders like '-#-`
                item.querySelectorAll('[id*="-#-"], label[for*="-#-"]').forEach(el => {
                     if (el.id) el.id = el.id.replace('-#-', `-${index + 1}-`);
                     if (el.htmlFor) el.htmlFor = el.htmlFor.replace('-#-', `-${index + 1}-`);
                 });
                // Update input names with correct index
                item.querySelectorAll('[name*="[#]"]').forEach(input => {
                    input.name = input.name.replace('[#]', `[${index + 1}]`);
                     // Ensure initial required status is set correctly based on visibility
                     // (Conditional logic should handle toggling later if needed)
                     if (input.dataset.initiallyRequired === 'true' && !input.closest('.hidden')) {
                        input.required = true;
                     }
                 });
            });
        };


        addButton.addEventListener('click', () => {
            const clone = template.content.cloneNode(true);
            const newItem = clone.querySelector('.repeatable-item'); // Assume template contains one fieldset
            if (!newItem) {
                console.error(`Template ${templateId} does not contain a .repeatable-item element.`);
                return;
            }

            newItem.dataset.group = groupName; // Ensure the group name is set

            // Add remove listener to the new button *before* appending
            const removeButton = newItem.querySelector('.remove-item-button');
            if (removeButton) {
                removeButton.addEventListener('click', (e) => {
                    e.target.closest('.repeatable-item').remove();
                    updateItemsUI(); // Update visibility and numbering after removing
                });
            } else {
                 console.warn(`Template ${templateId} is missing a .remove-item-button`);
            }

            container.appendChild(newItem);
            updateItemsUI(); // Update visibility and numbering after adding
             // Trigger conditional checks within the newly added item if needed
             newItem.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(input => {
                 input.dispatchEvent(new Event('change', { bubbles: true }));
             });
        });

        // Add remove listeners to initially present buttons (in case template starts with >1 item)
        container.querySelectorAll(`.repeatable-item[data-group="${groupName}"] .remove-item-button`).forEach(button => {
            if (!button.dataset.listenerAttached) { // Prevent adding multiple listeners on load
                button.addEventListener('click', (e) => {
                    e.target.closest('.repeatable-item').remove();
                    updateItemsUI();
                });
                button.dataset.listenerAttached = 'true';
            }
        });

        updateItemsUI(); // Initial check for remove button visibility and numbering
    }

    // --- Setup All Repeatable Sections ---
    setupRepeatable('siblings-container', 'add-sibling', 'sibling-template', 'sibling');
    setupRepeatable('education-container', 'add-education', 'education-template', 'education');
    setupRepeatable('employment-container', 'add-employment', 'employment-template', 'employment');
    setupRepeatable('absence-container', 'add-absence', 'absence-template', 'absence');
    setupRepeatable('passport-container', 'add-passport', 'passport-template', 'passport');
    setupRepeatable('prev-marriage-container', 'add-prev-marriage', 'prev-marriage-template', 'prev_marriage');
    setupRepeatable('prev-children-container', 'add-prev-child', 'prev-child-template', 'prev_child');


    // --- Save/Load Progress (localStorage) ---
    saveButton.addEventListener('click', () => {
        const draftKey = getDraftKey();
        if (!form || draftKey.endsWith('anonymous')) { // Don't save if form element not found or user not logged in
             saveStatus.textContent = 'Please log in to save draft.';
             saveStatus.style.color = 'orange';
             setTimeout(() => { saveStatus.textContent = ''; }, 3000);
             return;
         }

        const dataObject = {};
        // Use FormData for easier handling of fields, but manually handle checkboxes/radios for clarity
        const formData = new FormData(form);

        // Iterate over form elements directly for more control over values
        form.querySelectorAll('input, select, textarea').forEach(input => {
            const name = input.name;
            // Skip unnamed inputs, honeypot, form-name, or inputs inside hidden containers
            if (!name || name === 'bot-field' || name === 'form-name' || input.closest('.hidden')) {
                return;
            }

            if (input.type === 'checkbox') {
                if (name.endsWith('[]')) { // Checkbox group (like ns_organization[])
                    const baseName = name.slice(0, -2);
                    if (!dataObject[baseName]) dataObject[baseName] = [];
                    if (input.checked) {
                        dataObject[baseName].push(input.value);
                    }
                } else { // Single checkbox
                    dataObject[name] = input.checked;
                }
            } else if (input.type === 'radio') {
                if (input.checked) {
                    dataObject[name] = input.value;
                } else if (dataObject[name] === undefined) {
                     // Ensure the key exists even if no radio in the group is checked initially
                     // dataObject[name] = null; // Or handle as needed
                 }
            } else {
                dataObject[name] = input.value;
            }
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
        if (!savedData || !form) {
             console.log("No draft found or form not ready.");
             return;
         }

        try {
            const dataObject = JSON.parse(savedData);
            console.log("Loading draft for key:", draftKey);

            // --- Load Repeatable Sections First ---
            // Find max index for each repeatable group and add necessary items
            const repeatableGroups = ['sibling', 'education', 'employment', 'absence', 'passport', 'prev_marriage', 'prev_child'];
            repeatableGroups.forEach(groupName => {
                const groupKeys = Object.keys(dataObject).filter(k => k.startsWith(`${groupName}[`));
                let maxIndex = 0;
                groupKeys.forEach(key => {
                    const match = key.match(new RegExp(`^${groupName}\\[(\\d+)\\]`));
                    if (match && parseInt(match[1]) > maxIndex) {
                        maxIndex = parseInt(match[1]);
                    }
                });

                 // Add necessary sections beyond the initial one(s)
                 const container = document.getElementById(`${groupName.replace('_', '-')}-container`); // e.g., prev-marriage-container
                 const addButton = document.getElementById(`add-${groupName.replace('_', '-')}`); // e.g., add-prev-marriage
                 if (container && addButton && maxIndex > 0) {
                     const existingItems = container.querySelectorAll(`.repeatable-item[data-group="${groupName}"]`).length;
                     const itemsToAdd = maxIndex - existingItems;
                     for (let i = 0; i < itemsToAdd; i++) {
                         addButton.click(); // Simulate click to add section using the template
                     }
                 } else if (maxIndex > 0) {
                     console.warn(`Container or Add button not found for repeatable group: ${groupName}`);
                 }
            });


            // --- Populate All Fields (including newly added repeatable ones) ---
            form.querySelectorAll('input, select, textarea').forEach(input => {
                const name = input.name;
                if (!name || name === 'bot-field' || name === 'form-name') return;

                const value = dataObject[name];

                // Handle undefined value (don't try to set it)
                 if (value === undefined && !(input.type === 'checkbox' && name.endsWith('[]'))) { // Checkbox groups might not have the key if all are unchecked
                     // For radio buttons, ensure only one is checked for the group
                     if (input.type === 'radio') {
                         // Check if another radio in the same group HAS a value in dataObject
                         const groupRadios = form.querySelectorAll(`input[type="radio"][name="${name}"]`);
                         let groupHasSavedValue = false;
                         groupRadios.forEach(r => {
                             if (dataObject[name] === r.value) {
                                 groupHasSavedValue = true;
                             }
                         });
                          // If no radio in this group was saved as checked, uncheck this one
                         if (!groupHasSavedValue) input.checked = false;
                     }
                      // Otherwise, skip setting value for this input
                     return;
                 }


                // Set values based on type
                if (input.type === 'checkbox') {
                    if (name.endsWith('[]')) { // Checkbox group
                        const baseName = name.slice(0, -2);
                        // Check if the array exists and includes this checkbox's value
                        input.checked = Array.isArray(dataObject[baseName]) && dataObject[baseName].includes(input.value);
                    } else { // Single checkbox
                        input.checked = value === true || value === 'yes' || value === 'on'; // Handle boolean and common string representations
                    }
                } else if (input.type === 'radio') {
                    input.checked = (input.value === value);
                } else {
                    input.value = value; // Handles text, date, month, select, textarea, etc.
                }

                // Trigger change event AFTER setting value to ensure conditional logic re-evaluates
                 input.dispatchEvent(new Event('change', { bubbles: true }));
            });

             // Special trigger after all fields are potentially loaded
             triggerInitialEmploymentCheck(); // Ensure employment details visibility is correct

            saveStatus.textContent = 'Draft loaded.';
            saveStatus.style.color = 'blue';
            setTimeout(() => { saveStatus.textContent = ''; }, 3000);

        } catch (e) {
            console.error("Error loading draft:", e);
            // Optionally clear corrupted draft
            // localStorage.removeItem(draftKey);
            saveStatus.textContent = 'Error loading draft.';
            saveStatus.style.color = 'red';
        }
    }


    // --- Netlify Identity Integration ---
    // Function to update UI based on login status
    const updateUserUI = (user) => {
        if (user) {
            // User is logged in
            console.log("User logged in:", user.email);
            formContainer.classList.remove('hidden'); // Show form
            if (loginPrompt) loginPrompt.classList.add('hidden'); // Hide prompt
            setActiveLink(); // Recalculate active link now that form is visible
            loadDraft(); // Load user-specific draft AFTER showing form
        } else {
            // User is logged out
            console.log("User logged out");
            formContainer.classList.add('hidden'); // Hide form
            if (loginPrompt) loginPrompt.classList.remove('hidden'); // Show prompt
            // Optionally clear form fields visually when logged out
            // if (form) form.reset();
            // Optionally clear save status message
            if (saveStatus) saveStatus.textContent = '';
        }
    };

    // Check if Widget exists
    if (identityWidget) {
        // Initial check
        updateUserUI(identityWidget.currentUser());

        // Listen for login events
        identityWidget.on('login', (user) => {
            console.log('Login event');
            updateUserUI(user);
            identityWidget.close(); // Close the modal on successful login
        });

        // Listen for logout events
        identityWidget.on('logout', () => {
            console.log('Logout event');
            updateUserUI(null);
        });

        // Listen for signup events (user signed up but might need confirmation)
        identityWidget.on('open', (modal) => {
             console.log('Widget modal opened:', modal);
         });
        identityWidget.on('close', () => {
             console.log('Widget modal closed');
         });
         identityWidget.on('init', (user) => {
            console.log('Widget initialized. User:', user);
            // Potentially call updateUserUI here too if needed, though initial check should cover
         });
        identityWidget.on('error', (err) => {
            console.error('Identity Error:', err);
            if (loginPrompt) loginPrompt.innerHTML += `<p style="color: red;">Login Error: ${err.message || 'Unknown error'}</p>`;
        });

    } else {
        console.error("Netlify Identity Widget not loaded!");
        // Display error in login prompt area if widget fails to load
        if (loginPrompt) loginPrompt.innerHTML = "<p style='color:red;'>Error loading login system. Please refresh.</p>";
        // Hide the form container definitively if login fails
        if (formContainer) formContainer.classList.add('hidden');
    }


    // --- Form Submission Validation ---
    if (form) {
        form.addEventListener('submit', (e) => {
            // Re-check required fields *visible* just before submission
            let firstInvalid = null;
            form.querySelectorAll('input[required], select[required], textarea[required]').forEach(input => {
                 // Check if the element itself or any ancestor up to the form container is hidden
                let isHidden = false;
                 let currentElement = input;
                 while (currentElement && currentElement !== formContainer) {
                     if (currentElement.classList.contains('hidden')) {
                         isHidden = true;
                         break;
                     }
                     currentElement = currentElement.parentElement;
                 }

                if (!isHidden && !input.validity.valid) {
                    if (!firstInvalid) firstInvalid = input;
                    console.warn("Invalid field:", input.name, input.validationMessage, input);
                     // Add a visual marker (optional)
                     input.style.border = '2px solid red';
                } else {
                    // Remove visual marker if field becomes valid (optional)
                    input.style.border = ''; // Reset border
                }
            });

            if (firstInvalid) {
                e.preventDefault(); // Prevent submission
                const fieldName = firstInvalid.labels.length > 0 ? firstInvalid.labels[0].innerText : `Field named '${firstInvalid.name}'`;
                alert(`Please fill out the required field: ${fieldName}`);

                // Find the section and scroll to it
                const section = firstInvalid.closest('.form-section');
                if (section) {
                     formContainer.scrollTo({
                         top: section.offsetTop - 10,
                         behavior: 'smooth'
                      });
                 }
                firstInvalid.focus(); // Focus the invalid field
            } else {
                console.log("Form seems valid client-side, submitting to Netlify...");
                // Clear the draft for this user upon successful submission intent
                 const draftKey = getDraftKey();
                 localStorage.removeItem(draftKey);
                 console.log("Draft cleared:", draftKey);
                 // Optional: Disable submit button to prevent double submission
                 const submitButton = form.querySelector('button[type="submit"]');
                 if(submitButton) submitButton.disabled = true;
                 if(submitButton) submitButton.textContent = 'Submitting...';
            }
        });
    } else {
         console.error("Form element not found!");
    }

}); // End DOMContentLoaded