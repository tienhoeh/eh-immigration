// js/section_common.js

// --- Global Helper Functions (Can be defined outside DOMContentLoaded) ---

/**
 * Helper function to get current section name from its own path.
 * Derives a key like 'applicant_details' from '/sections/section-applicant-details.html'.
 * @returns {string|null} The derived section key or null.
 */
function getCurrentSectionNameFromPath() {
    try {
        const pathname = window.location.pathname;
        if (!pathname) return null;
        const parts = pathname.split('/');
        const fileName = parts.pop() || parts.pop(); // Handle potential trailing slash
        if (fileName && fileName.startsWith('section-') && fileName.endsWith('.html')) {
            // Extract the part between "section-" and ".html", replace dashes with underscores
            return fileName.substring(8, fileName.length - 5).replace(/-/g, '_');
        }
    } catch (e) {
        console.error("Error deriving section name from path:", e);
    }
    // Fallback if path doesn't match expected pattern
    return document.body.dataset.sectionKey || document.body.id || null;
}

/**
 * Updates legend numbers, remove button visibility, names, and IDs for items in a repeatable group.
 * @param {HTMLElement} container - The container element holding the repeatable items.
 * @param {string} groupName - The data-group name for the items.
 */
function updateRepeatableItemsUI(container, groupName) {
    if (!container) {
        // This is expected if the container isn't on the current section page
        // console.warn(`updateRepeatableItemsUI: Container not found for group ${groupName}`);
        return;
    }
    const items = container.querySelectorAll(`.repeatable-item[data-group="${groupName}"]`);
    // console.log(`Updating UI for ${items.length} items in group ${groupName}`);

    items.forEach((item, index) => {
        const itemIndex = index + 1; // Use 1-based index for display and names

        // Toggle remove button visibility
        const removeButton = item.querySelector('.remove-item-button');
        if (removeButton) {
            removeButton.classList.toggle('hidden', items.length <= 1 && !item.dataset.canBeEmpty);
        }

        // Update legend number
        const legend = item.querySelector('legend');
        if (legend) {
            legend.textContent = legend.textContent.replace(/#|\d+/, `${itemIndex}`);
        }

        // Update IDs and label 'for' attributes using '#' placeholder
        // Assumes a pattern like id="groupName-#-fieldName" or similar with #
        item.querySelectorAll(`[id*="#"], label[for*="#"]`).forEach(el => {
            if (el.id) el.id = el.id.replace(/#/g, `${itemIndex}`);
            if (el.htmlFor) el.htmlFor = el.htmlFor.replace(/#/g, `${itemIndex}`);
        });

        // Update input/select/textarea names using '[#]' placeholder
        item.querySelectorAll(`[name*="[#]"]`).forEach(input => {
            input.name = input.name.replace(/\[#\]/g, `[${itemIndex}]`);

            // Set initial required status based on visibility and data attribute
            const isInitiallyRequired = input.dataset.initiallyRequired === 'true';
            if (!input.closest('.hidden')) { // Only require if visible
                input.required = isInitiallyRequired;
            } else {
                input.required = false; // Never required if hidden
            }
        });
    });
}

/**
 * Sets up the add/remove functionality for a repeatable section.
 * @param {string} containerId - The ID of the element containing the repeatable items.
 * @param {string} addButtonId - The ID of the button used to add new items.
 * @param {string} templateId - The ID of the template element holding the HTML for a new item.
 * @param {string} groupName - The value for the data-group attribute to identify items.
 * @returns {boolean} - True if setup was relevant and attempted, false otherwise.
 */
function setupRepeatable(containerId, addButtonId, templateId, groupName) {
    const container = document.getElementById(containerId);
    const addButton = document.getElementById(addButtonId);
    const template = document.getElementById(templateId);

    // If container doesn't exist, this repeatable section isn't on this page.
    if (!container) {
        return false; // Not relevant to this section page
    }
    // If container exists, button and template *must* exist for it to work.
    if (!addButton) { console.error(`Section_common: Repeatable setup FAILED for "${groupName}". Reason: Add button with ID "${addButtonId}" not found in container "${containerId}".`); return false; }
    if (!template) { console.error(`Section_common: Repeatable setup FAILED for "${groupName}". Reason: Template element with ID "${templateId}" not found.`); return false; }

    console.log(`Section_common: Setting up repeatable for ${groupName} (Button: #${addButtonId}, Container: #${containerId})`);

    // --- Add Button Event Listener ---
    addButton.addEventListener('click', () => {
        console.log(`Section_common: Add button clicked for ${groupName}`);
        try {
            const clone = template.content.cloneNode(true);
            const newItem = clone.querySelector('.repeatable-item');
            if (!newItem) { console.error(`Template ${templateId} missing .repeatable-item.`); return; }
            newItem.dataset.group = groupName;

            const removeButton = newItem.querySelector('.remove-item-button');
            if (removeButton) {
                removeButton.classList.remove('hidden');
                removeButton.addEventListener('click', (e) => {
                    const itemToRemove = e.target.closest('.repeatable-item[data-group="' + groupName + '"]');
                    if(itemToRemove) { itemToRemove.remove(); updateRepeatableItemsUI(container, groupName); }
                });
            } else { console.warn(`Template ${templateId} missing a ".remove-item-button".`); }

            container.appendChild(newItem); // Append the new item
            updateRepeatableItemsUI(container, groupName); // Update numbering/names AFTER appending

            // Setup conditional logic within the new item
            if(typeof setupConditionalVisibilityForItem === "function"){
                 setupConditionalVisibilityForItem(newItem); // Pass the new item as scope
            }
            console.log(`Section_common: Finished processing add click for ${groupName}.`);
        } catch (error) { console.error(`Section_common: Error in Add button click for ${groupName}:`, error); }
    });

    // --- Initial Setup for Existing Items ---
    container.querySelectorAll(`.repeatable-item[data-group="${groupName}"] .remove-item-button`).forEach(button => {
         if (!button.dataset.listenerAttached) {
             button.addEventListener('click', (e) => {
                 const itemToRemove = e.target.closest('.repeatable-item[data-group="' + groupName + '"]');
                 if(itemToRemove) { itemToRemove.remove(); updateRepeatableItemsUI(container, groupName); }
             });
             button.dataset.listenerAttached = 'true';
         }
     });
    updateRepeatableItemsUI(container, groupName); // Initial setup for numbering/buttons
    return true; // Setup was relevant and done
}


/**
 * Collects form data from the current section, handling repeatable fields.
 * @returns {object} - An object containing the form data.
 */
function collectSectionFormData() {
    const sectionElement = document.querySelector(`section#section-${currentSectionKey ? currentSectionKey.replace(/_/g, '-') : ''}`) || document.body;
    if (!sectionElement) { console.error("Section_common: Could not find section container to collect data from."); return {}; }

    const data = {};
    const inputs = sectionElement.querySelectorAll('input:not([type="button"]):not([type="submit"]), select, textarea');

    inputs.forEach(input => {
        const name = input.name;
        if (!name || input.closest('.hidden')) return; // Skip unnamed, hidden

        const repeatableMatch = name.match(/^(\w+)\[(\d+)\]\[(\w+)\]$/);

        if (repeatableMatch) { // Repeatable field: groupName[index][fieldName]
             const groupName = repeatableMatch[1];
             const index = parseInt(repeatableMatch[2]) - 1;
             const fieldName = repeatableMatch[3];

             if (!data[groupName]) data[groupName] = [];
             while (data[groupName].length <= index) data[groupName].push({});
             const currentItem = data[groupName][index];

             if (input.type === 'checkbox') {
                 if (name.endsWith('[]')) { const actualFieldName = fieldName.slice(0,-2); if (!currentItem[actualFieldName]) currentItem[actualFieldName] = []; if (input.checked) currentItem[actualFieldName].push(input.value); }
                 else if (!input.value || input.value.toLowerCase() === 'on') { currentItem[fieldName] = input.checked; }
                 else { if (!currentItem[fieldName]) currentItem[fieldName] = []; if (input.checked) currentItem[fieldName].push(input.value); }
             } else if (input.type === 'radio') { if (input.checked) currentItem[fieldName] = input.value; }
             else { currentItem[fieldName] = input.value; }
        } else { // Non-repeatable field
             if (input.type === 'checkbox') {
                 if (name.endsWith('[]')) { const baseName = name.slice(0, -2); if (!data[baseName]) data[baseName] = []; if (input.checked) data[baseName].push(input.value); }
                 else { data[name] = input.checked; }
             } else if (input.type === 'radio') { if (input.checked) data[name] = input.value; }
             else { data[name] = input.value; }
        }
    });
    return data;
}

/**
 * Populates the form fields within the current section from loaded data.
 * @param {object} dataToLoad - The data object for this section.
 */
function populateSectionForm(dataToLoad) {
    if (!dataToLoad || typeof dataToLoad !== 'object' || Object.keys(dataToLoad).length === 0) { console.log(`Section_common: No valid data provided to populate ${currentSectionKey}.`); return; }
    console.log(`Section_common: Populating form for ${currentSectionKey}...`); // Data logged in message handler
    const sectionElement = document.querySelector(`section#section-${currentSectionKey ? currentSectionKey.replace(/_/g, '-') : ''}`) || document.body;
    if (!sectionElement) { console.error(`Section_common: Could not find section container to populate.`); return; }

    // --- Add Repeatable Sections based on dataToLoad ---
    const repeatableGroups = ['sibling', 'education', 'employment', 'absence', 'passport', 'prev_marriage', 'prev_child'];
    repeatableGroups.forEach(groupName => {
        if (Array.isArray(dataToLoad[groupName])) {
            const itemsInData = dataToLoad[groupName].length;
            const containerId = `${groupName.replace('_', '-')}-container`;
            const addButtonId = `add-${groupName.replace('_', '-')}`;
            const container = document.getElementById(containerId);
            const addButton = document.getElementById(addButtonId);
            if (container && addButton && itemsInData > 0) {
                const existingItems = container.querySelectorAll(`.repeatable-item[data-group="${groupName}"]`).length;
                const itemsToAdd = itemsInData - existingItems;
                 if (itemsToAdd > 0) {
                    console.log(`Section_common: Adding ${itemsToAdd} repeatable item(s) for ${groupName}.`);
                    for (let i = 0; i < itemsToAdd; i++) { addButton.click(); }
                 }
                 // Ensure UI is updated after potentially adding items
                 updateRepeatableItemsUI(container, groupName);
            }
        }
    });

    // --- Populate All Fields (Use timeout for DOM updates) ---
    setTimeout(() => {
        console.log("Section_common: Populating individual form fields...");
        sectionElement.querySelectorAll('input:not([type="button"]):not([type="submit"]), select, textarea').forEach(input => {
            const name = input.name;
            if (!name) return;

            let value = undefined;
            const repeatableMatch = name.match(/^(\w+)\[(\d+)\]\[(\w+)\]$/);

            try {
                if (repeatableMatch) {
                    const groupName = repeatableMatch[1];
                    const index = parseInt(repeatableMatch[2]) - 1;
                    const fieldName = repeatableMatch[3];
                    if (dataToLoad[groupName]?.[index]?.[fieldName] !== undefined) { value = dataToLoad[groupName][index][fieldName]; }
                } else {
                     if (input.type === 'checkbox' && name.endsWith('[]')) { value = dataToLoad[name.slice(0, -2)]; }
                     else { value = dataToLoad[name]; }
                }

                if (value !== undefined) {
                    if (input.type === 'checkbox') {
                         if (name.endsWith('[]')) { input.checked = Array.isArray(value) && value.includes(input.value); }
                         else { input.checked = value === true || String(value).toLowerCase() === 'true' || String(value).toLowerCase() === 'yes' || String(value).toLowerCase() === 'on'; }
                    } else if (input.type === 'radio') { input.checked = (input.value === String(value)); }
                     else { input.value = value; }
                    input.dispatchEvent(new Event('change', { bubbles: true })); // Trigger change for conditional logic
                } else {
                     if (input.type === 'radio' && dataToLoad[name] === undefined) { input.checked = false; }
                 }
            } catch (fieldError) { console.error(`Section_common: Error populating field [name="${name}"] with value "${value}":`, fieldError); }
        }); // End loop through inputs

        console.log(`Section_common: Form population finished for ${currentSectionKey}. Triggering conditional checks.`);
        // Re-run conditional checks AFTER population is complete
         if(typeof triggerInitialConditionalChecksForSection === "function"){
            triggerInitialConditionalChecksForSection(sectionElement);
        }
    }, 400); // Increased delay slightly more for complex DOM updates
}


// --- Message Handling (Between iframe and parent) ---
window.addEventListener('message', (event) => {
    // Add strict origin check in production:
    // const parentOrigin = "https://your-site-name.netlify.app"; // Get from config?
    // if (event.origin !== parentOrigin) { console.warn(...); return; }

    const { type, payload, sectionName: requestedSectionName } = event.data;
    // console.log(`Section_common (${currentSectionKey}): Message received from parent: Type=${type}`);

    if (type === 'GET_SECTION_DATA') {
        if (currentSectionKey && requestedSectionName === currentSectionKey) {
            const sectionData = collectSectionFormData();
            console.log(`Section_common (${currentSectionKey}): Sending data response to parent.`);
            event.source.postMessage({ type: 'SECTION_DATA_RESPONSE', payload: sectionData, sectionName: currentSectionKey }, event.origin); // Respond to specific origin
        }
    } else if (type === 'LOAD_SECTION_DATA') {
        console.log(`Section_common (${currentSectionKey}): Received data to load.`);
        populateSectionForm(payload);
    }
});


// --- Initialization on DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', () => {
    console.log(`Section_common: DOMContentLoaded for ${currentSectionKey || 'Unknown Section'}.`);

    // --- Define Conditional Logic Handlers WITHIN DOMContentLoaded ---

    /**
     * Toggles visibility of a container and sets required attributes based on checkbox state.
     * @param {HTMLInputElement} checkbox The controlling checkbox element.
     * @param {HTMLElement} container The container element to show/hide.
     */
    function handleVisibility(checkbox, container) {
        if (!checkbox || !container) { console.warn("handleVisibility: Checkbox or container missing."); return; }
        const shouldShow = checkbox.checked;
        container.classList.toggle('hidden', !shouldShow);
        container.querySelectorAll('input, select, textarea').forEach(input => {
            const isInitiallyRequired = input.dataset.initiallyRequired === 'true';
            // Only require if it's marked as initially required AND the container is now shown
            input.required = shouldShow && isInitiallyRequired;
        });
    }

    /** Sets up conditional visibility listeners within a given scope (e.g., document or new repeatable item) */
    function setupConditionalVisibilityForItem(scopeElement = document) {
        console.log("Section_common: Setting up conditional visibility listeners for scope:", scopeElement === document.body ? 'document' : scopeElement);

        // --- National Service ---
        const nsApplicableCheckbox = scopeElement.querySelector('#ns-applicable');
        const nsDetailsContainer = scopeElement.querySelector('#ns-details-container');
        if (nsApplicableCheckbox && nsDetailsContainer && !nsApplicableCheckbox.dataset.cvListenerAttached) {
            console.log("Section_common: Setting up NS listener.");
            const checkNSVisibility = () => handleVisibility(nsApplicableCheckbox, nsDetailsContainer);
            nsApplicableCheckbox.addEventListener('change', checkNSVisibility);
            nsApplicableCheckbox.dataset.cvListenerAttached = 'true'; // Prevent re-attaching
            checkNSVisibility(); // Initial check
        }

        // --- Previous Marriage ---
        const prevMarriageCheckbox = scopeElement.querySelector('#prev-marriage-applicable');
        const prevMarriageContainer = scopeElement.querySelector('#prev-marriage-container');
        const addPrevMarriageButton = scopeElement.querySelector('#add-prev-marriage');
        if (prevMarriageCheckbox && prevMarriageContainer && addPrevMarriageButton && !prevMarriageCheckbox.dataset.cvListenerAttached) {
            console.log("Section_common: Setting up Previous Marriage listener.");
            const checkPrevMarriageVisibility = () => {
                const shouldShow = prevMarriageCheckbox.checked;
                handleVisibility(prevMarriageCheckbox, prevMarriageContainer); // Toggle local container
                if(addPrevMarriageButton) addPrevMarriageButton.classList.toggle('hidden', !shouldShow); // Toggle add button
                // Inform parent to toggle the next section (prev children)
                 if (window.parent && window.parent !== window) {
                     window.parent.postMessage({ type: 'TOGGLE_SECTION_VISIBILITY', sectionKey: 'prev_children', show: shouldShow }, '*'); // Use key
                 }
            };
            prevMarriageCheckbox.addEventListener('change', checkPrevMarriageVisibility);
            prevMarriageCheckbox.dataset.cvListenerAttached = 'true';
            checkPrevMarriageVisibility(); // Initial Check
        }

        // --- Previous Child Employment (Event Delegation on Container) ---
        const prevChildrenContainer = scopeElement.matches && scopeElement.matches('#prev-children-container') ? scopeElement : scopeElement.querySelector('#prev-children-container');
        if (prevChildrenContainer && !prevChildrenContainer.dataset.cvListenerAttached) {
            console.log("Section_common: Setting up Previous Child employment listener.");
            prevChildrenContainer.addEventListener('change', (event) => {
                if (event.target.matches('input[type="radio"][name^="prev_child"][name$="[employed]"]')) {
                    const fieldset = event.target.closest('fieldset.repeatable-item');
                    if (!fieldset) return;
                    const detailsDiv = fieldset.querySelector('div[data-condition*="[employed]"]');
                    if (detailsDiv) {
                        const shouldShow = event.target.checked && event.target.value === 'Yes';
                        detailsDiv.classList.toggle('hidden', !shouldShow);
                        detailsDiv.querySelectorAll('input, textarea').forEach(input => {
                             input.required = shouldShow && input.dataset.initiallyRequired !== 'false'; // Check data attr
                        });
                    }
                }
            });
            prevChildrenContainer.dataset.cvListenerAttached = 'true';
             // Trigger initial check for items already present within this scope
             prevChildrenContainer.querySelectorAll('input[type="radio"][name^="prev_child"][name$="[employed]"]:checked').forEach(radio => {
                radio.dispatchEvent(new Event('change',{bubbles: true}));
             });
        }
    } // --- End setupConditionalVisibilityForItem ---


    // --- Run Initial Setups ---
    // Setup repeatable sections first, as they might contain conditional elements
    setupRepeatable('siblings-container', 'add-sibling', 'sibling-template', 'sibling');
    setupRepeatable('education-container', 'add-education', 'education-template', 'education');
    setupRepeatable('employment-container', 'add-employment', 'employment-template', 'employment');
    setupRepeatable('absence-container', 'add-absence', 'absence-template', 'absence');
    setupRepeatable('passport-container', 'add-passport', 'passport-template', 'passport');
    setupRepeatable('prev-marriage-container', 'add-prev-marriage', 'prev-marriage-template', 'prev_marriage');
    setupRepeatable('prev-children-container', 'add-prev-child', 'prev-child-template', 'prev_child');

    // Setup conditional logic for the initial page load
    setupConditionalVisibilityForItem(document.body);

    // --- Notify parent that this section is ready ---
    if (currentSectionKey && window.parent && window.parent !== window) {
        console.log(`Section_common (${currentSectionKey}): Sending SECTION_READY to parent.`);
        setTimeout(() => { window.parent.postMessage({ type: 'SECTION_READY', sectionName: window.location.pathname }, '*'); }, 100);
    }

    // --- Auto-Save Setup ---
    const formForAutoSave = document.querySelector('form') || document.querySelector('section.form-section');
    if (formForAutoSave && currentSectionKey && window.parent && window.parent !== window) {
        let debounceTimer;
        formForAutoSave.addEventListener('input', (event) => {
            if (!event.isTrusted) return;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                console.log(`Section_common (${currentSectionKey}): Input detected, sending auto-save data.`);
                const sectionData = collectSectionFormData();
                window.parent.postMessage({ type: 'SECTION_DATA_CHANGED_AUTOSAVE', payload: sectionData, sectionName: currentSectionKey }, '*');
            }, 1000);
        });
        console.log(`Section_common (${currentSectionKey}): Auto-save listener attached.`);
    }

    console.log(`Section_common: Initial setup complete for ${currentSectionKey || 'Unknown Section'}.`);

}); // End DOMContentLoaded
