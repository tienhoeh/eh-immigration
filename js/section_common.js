// js/section_common.js

// Helper function to get current section name from its own path
function getCurrentSectionNameFromPath() {
    const pathname = window.location.pathname; // Path of the iframe's document
    if (!pathname) return null;
    const parts = pathname.split('/');
    const fileName = parts.pop() || parts.pop(); // Handle potential trailing slash
    if (fileName && fileName.startsWith('section-') && fileName.endsWith('.html')) {
        // Extract the part between "section-" and ".html", replace dashes with underscores for key consistency
        // Example: section-applicant-details.html -> applicant_details
        return fileName.substring(8, fileName.length - 5).replace(/-/g, '_');
    }
    // Fallback: Try to get from a potential body ID or data attribute if path fails
    return document.body.dataset.sectionKey || document.body.id || null;
}

const currentSectionKey = getCurrentSectionNameFromPath();
console.log(`Section_common.js - Loaded for section key: ${currentSectionKey || 'Unknown Section'} (Path: ${window.location.pathname})`);

// --- Repeatable Sections Setup ---

/**
 * Updates legend numbers, remove button visibility, names, and IDs for items in a repeatable group.
 * Ensures unique IDs and correct name indexing.
 * @param {HTMLElement} container - The container element holding the repeatable items.
 * @param {string} groupName - The data-group name for the items.
 */
function updateRepeatableItemsUI(container, groupName) {
    if (!container) {
        console.warn(`updateRepeatableItemsUI: Container not found for group ${groupName}`);
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
        // We need a consistent pattern, e.g., id="groupName-#-fieldName"
        item.querySelectorAll(`[id*="${groupName}-#"], label[for*="${groupName}-#"]`).forEach(el => {
            const baseId = el.id ? el.id.substring(0, el.id.indexOf('-#-') + 1) : null; // Get base part before #
            const baseFor = el.htmlFor ? el.htmlFor.substring(0, el.htmlFor.indexOf('-#-') + 1) : null;

            if (el.id && baseId) {
                 el.id = el.id.replace(/#/g, `${itemIndex}`);
             } else if (el.id && el.id.includes('#')) { // Fallback if pattern differs slightly
                el.id = el.id.replace(/#/g, `${itemIndex}`);
             }

            if (el.htmlFor && baseFor) {
                 el.htmlFor = el.htmlFor.replace(/#/g, `${itemIndex}`);
             } else if (el.htmlFor && el.htmlFor.includes('#')) { // Fallback
                 el.htmlFor = el.htmlFor.replace(/#/g, `${itemIndex}`);
             }
        });

        // Update input/select/textarea names using '[#]' placeholder
        item.querySelectorAll(`[name*="[#]"]`).forEach(input => {
            input.name = input.name.replace(/\[#\]/g, `[${itemIndex}]`);

            // Set initial required status based on visibility and data attribute
            const isInitiallyRequired = input.dataset.initiallyRequired === 'true';
             if (!input.closest('.hidden')) { input.required = isInitiallyRequired; }
             else { input.required = false; }
        });
    });
}

/**
 * Sets up the add/remove functionality for a repeatable section.
 * @param {string} containerId - The ID of the element containing the repeatable items.
 * @param {string} addButtonId - The ID of the button used to add new items.
 * @param {string} templateId - The ID of the template element holding the HTML for a new item.
 * @param {string} groupName - The value for the data-group attribute to identify items.
 * @returns {boolean} - True if setup was successful, false otherwise.
 */
function setupRepeatable(containerId, addButtonId, templateId, groupName) {
    const container = document.getElementById(containerId);
    const addButton = document.getElementById(addButtonId);
    const template = document.getElementById(templateId);

    if (!container) return false; // Element not on this page, normal
    if (!addButton) { console.error(`Section_common: Repeatable setup FAILED for "${groupName}". Reason: Add button with ID "${addButtonId}" not found.`); return false; }
    if (!template) { console.error(`Section_common: Repeatable setup FAILED for "${groupName}". Reason: Template element with ID "${templateId}" not found.`); return false; }

    console.log(`Section_common: Setting up repeatable for ${groupName} (Button: #${addButtonId}, Container: #${containerId}, Template: #${templateId})`);

    addButton.addEventListener('click', () => {
        console.log(`Section_common: Add button clicked for ${groupName}`);
        try {
            const clone = template.content.cloneNode(true);
            const newItem = clone.querySelector('.repeatable-item');
            if (!newItem) { console.error(`Template ${templateId} is missing a root element with class ".repeatable-item".`); return; }
            newItem.dataset.group = groupName;

            const removeButton = newItem.querySelector('.remove-item-button');
            if (removeButton) {
                removeButton.classList.remove('hidden');
                removeButton.addEventListener('click', (e) => {
                    const itemToRemove = e.target.closest('.repeatable-item[data-group="' + groupName + '"]');
                    if(itemToRemove) { itemToRemove.remove(); updateRepeatableItemsUI(container, groupName); }
                    else { console.error("Could not find repeatable item parent to remove."); }
                });
            } else { console.warn(`Template ${templateId} is missing a ".remove-item-button".`); }

            container.appendChild(newItem);
            updateRepeatableItemsUI(container, groupName);

            // Trigger conditional checks within the newly added item scope
            if(typeof triggerInitialConditionalChecksForSection === "function"){
                triggerInitialConditionalChecksForSection(newItem);
            }
            console.log(`Section_common: Finished processing add click for ${groupName}.`);
        } catch (error) { console.error(`Section_common: Error occurred inside Add button click handler for ${groupName}:`, error); }
    });
    console.log(`Section_common: Event listener added to button #${addButtonId}.`);

    // Initial setup for existing items
    container.querySelectorAll(`.repeatable-item[data-group="${groupName}"] .remove-item-button`).forEach(button => {
         if (!button.dataset.listenerAttached) {
             button.addEventListener('click', (e) => {
                 const itemToRemove = e.target.closest('.repeatable-item[data-group="' + groupName + '"]');
                 if(itemToRemove) { itemToRemove.remove(); updateRepeatableItemsUI(container, groupName); }
             });
             button.dataset.listenerAttached = 'true';
         }
     });
    updateRepeatableItemsUI(container, groupName);
    return true;
}


// --- Form Data Collection and Population ---

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
        // Skip unnamed, or buttons inside the collection query (shouldn't happen but safe)
        if (!name || input.type === 'button' || input.type === 'submit' || input.closest('.hidden')) return;

        const repeatableMatch = name.match(/^(\w+)\[(\d+)\]\[(\w+)\]$/);

        if (repeatableMatch) { // Repeatable field: groupName[index][fieldName]
             const groupName = repeatableMatch[1];
             const index = parseInt(repeatableMatch[2]) - 1; // 0-based index for array
             const fieldName = repeatableMatch[3];

             if (!data[groupName]) data[groupName] = [];
             // Ensure array is long enough
             while (data[groupName].length <= index) data[groupName].push({});

             const currentItem = data[groupName][index];

             if (input.type === 'checkbox') {
                 // If checkbox is part of a group within repeatable (e.g., employment[1][skills][]) - less common
                 if (fieldName.endsWith('[]')) {
                     const actualFieldName = fieldName.slice(0, -2);
                     if (!currentItem[actualFieldName]) currentItem[actualFieldName] = [];
                     if (input.checked) currentItem[actualFieldName].push(input.value);
                 }
                  // If single checkbox within repeatable (e.g., employment[1][current_job])
                  else if (!input.value || input.value.toLowerCase() === 'on') {
                      currentItem[fieldName] = input.checked;
                  }
                  // If checkbox group where value matters (e.g. prev_child[1][hobbies][])
                  else {
                       if (!currentItem[fieldName]) currentItem[fieldName] = [];
                       if (input.checked) currentItem[fieldName].push(input.value);
                  }
             } else if (input.type === 'radio') {
                 if (input.checked) currentItem[fieldName] = input.value;
             } else {
                 currentItem[fieldName] = input.value;
             }

        } else { // Non-repeatable field
             if (input.type === 'checkbox') {
                 if (name.endsWith('[]')) { // Checkbox group e.g. ns_organization[]
                     const baseName = name.slice(0, -2);
                     if (!data[baseName]) data[baseName] = [];
                     if (input.checked) data[baseName].push(input.value);
                 } else { // Single checkbox e.g. ns_applicable
                      data[name] = input.checked;
                 }
             } else if (input.type === 'radio') {
                 if (input.checked) data[name] = input.value;
             } else {
                 data[name] = input.value;
             }
        }
    });
    // console.log(`Section_common: Collected data for ${currentSectionKey}:`, data);
    return data;
}

/**
 * Populates the form fields within the current section from loaded data.
 * Handles adding repeatable items if needed.
 * @param {object} dataToLoad - The data object for this section.
 */
function populateSectionForm(dataToLoad) {
    if (!dataToLoad || typeof dataToLoad !== 'object' || Object.keys(dataToLoad).length === 0) {
        console.log(`Section_common: No valid data provided to populate ${currentSectionKey}.`);
        return;
    }
    console.log(`Section_common: Populating form for ${currentSectionKey} with:`, dataToLoad);
    const sectionElement = document.querySelector(`section#section-${currentSectionKey ? currentSectionKey.replace(/_/g, '-') : ''}`) || document.body;
    if (!sectionElement) { console.error(`Section_common: Could not find section container to populate.`); return; }

    // --- Handle Adding Repeatable Sections based on dataToLoad ---
    const repeatableGroups = ['sibling', 'education', 'employment', 'absence', 'passport', 'prev_marriage', 'prev_child'];
    repeatableGroups.forEach(groupName => {
        // Check if the data for this group exists and is an array
        if (Array.isArray(dataToLoad[groupName])) {
            const itemsInData = dataToLoad[groupName].length;
            const containerId = `${groupName.replace('_', '-')}-container`;
            const addButtonId = `add-${groupName.replace('_', '-')}`;
            const container = document.getElementById(containerId);
            const addButton = document.getElementById(addButtonId);
            if (container && addButton && itemsInData > 0) {
                const existingItems = container.querySelectorAll(`.repeatable-item[data-group="${groupName}"]`).length;
                const itemsToAdd = itemsInData - existingItems;
                console.log(`Section_common: Populating repeatable ${groupName}: Items in data ${itemsInData}, existing ${existingItems}, adding ${itemsToAdd}`);
                for (let i = 0; i < itemsToAdd; i++) {
                    if(addButton) addButton.click(); // Simulate adding items
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

            try { // Wrap population in try-catch per field
                if (repeatableMatch) { // Repeatable field
                    const groupName = repeatableMatch[1];
                    const index = parseInt(repeatableMatch[2]) - 1;
                    const fieldName = repeatableMatch[3];
                    if (dataToLoad[groupName]?.[index]?.[fieldName] !== undefined) {
                        value = dataToLoad[groupName][index][fieldName];
                    }
                } else { // Non-repeatable field
                    if (input.type === 'checkbox' && name.endsWith('[]')) {
                         const baseName = name.slice(0, -2);
                         value = dataToLoad[baseName]; // Expecting array
                    } else {
                        value = dataToLoad[name];
                    }
                }

                if (value !== undefined) { // Only proceed if value exists in draft
                     if (input.type === 'checkbox') {
                         if (name.endsWith('[]')) {
                             input.checked = Array.isArray(value) && value.includes(input.value);
                         } else {
                             input.checked = value === true || String(value).toLowerCase() === 'true' || String(value).toLowerCase() === 'yes' || String(value).toLowerCase() === 'on';
                         }
                     } else if (input.type === 'radio') {
                         input.checked = (input.value === String(value));
                     } else if (input.tagName === 'SELECT') {
                        input.value = value;
                        // Double check if value actually set for select-multiple edge cases or if value doesn't exist
                        if (input.value !== String(value)) {
                            console.warn(`Section_common: Could not set value "${value}" for select[name="${name}"]. Option might be missing.`);
                        }
                     } else {
                         input.value = value;
                     }
                    input.dispatchEvent(new Event('change', { bubbles: true })); // Trigger change event
                } else {
                    // Handle cases where value is undefined (e.g., radio groups)
                     if (input.type === 'radio' && dataToLoad[name] === undefined) {
                         input.checked = false; // Ensure radio is unchecked if its group wasn't in data
                     }
                }
            } catch (fieldError) {
                console.error(`Section_common: Error populating field [name="${name}"] with value "${value}":`, fieldError);
            }
        }); // End loop through inputs

        console.log(`Section_common: Form population finished for ${currentSectionKey}. Triggering conditional checks.`);
        // Re-run conditional checks AFTER population is complete
         if(typeof triggerInitialConditionalChecksForSection === "function"){
            triggerInitialConditionalChecksForSection(sectionElement);
        }

    }, 350); // Delay to allow DOM updates from adding repeatables
}

// --- Message Handling ---
window.addEventListener('message', (event) => {
    // Add a stricter origin check for production
    // const allowedOrigin = window.location.origin; // Or specific parent origin
    // if (event.origin !== allowedOrigin) return;

    const { type, payload, sectionName: requestedSectionName } = event.data;
    // console.log(`Section_common (${currentSectionKey}): Message received from parent: Type=${type}`); // Less noisy

    if (type === 'GET_SECTION_DATA') {
        if (currentSectionKey && requestedSectionName === currentSectionKey) {
            const sectionData = collectSectionFormData();
            console.log(`Section_common (${currentSectionKey}): Sending data response to parent.`);
            event.source.postMessage({
                type: 'SECTION_DATA_RESPONSE',
                payload: sectionData,
                sectionName: currentSectionKey
            }, event.origin); // Respond to specific origin
        }
    } else if (type === 'LOAD_SECTION_DATA') {
        console.log(`Section_common (${currentSectionKey}): Received data to load.`);
        populateSectionForm(payload);
    }
});


// --- Conditional Visibility Logic (Specific to elements within this section) ---
/** Sets up conditional visibility listeners within a given scope */
function setupConditionalVisibilityForItem(scopeElement = document) {

    // --- National Service ---
    const nsApplicableCheckbox = scopeElement.querySelector('#ns-applicable');
    const nsDetailsContainer = scopeElement.querySelector('#ns-details-container');
    if (nsApplicableCheckbox && nsDetailsContainer && !nsApplicableCheckbox.dataset.cvListener) {
        console.log("Section_common: Setting up NS conditional visibility.");
        const checkNSVisibility = () => handleVisibility(nsApplicableCheckbox, nsDetailsContainer);
        nsApplicableCheckbox.addEventListener('change', checkNSVisibility);
        nsApplicableCheckbox.dataset.cvListener = 'true'; // Mark as attached
        checkNSVisibility(); // Initial check
    }

    // --- Previous Marriage ---
    const prevMarriageCheckbox = scopeElement.querySelector('#prev-marriage-applicable');
    const prevMarriageContainer = scopeElement.querySelector('#prev-marriage-container');
    const addPrevMarriageButton = scopeElement.querySelector('#add-prev-marriage');
    // Note: Controlling prevChildrenSection visibility from here is complex as it's a separate section file.
    // This should ideally be handled by the parent based on the prev_marriage_applicable checkbox state.
    if (prevMarriageCheckbox && prevMarriageContainer && addPrevMarriageButton && !prevMarriageCheckbox.dataset.cvListener) {
        console.log("Section_common: Setting up Previous Marriage conditional visibility.");
        const checkPrevMarriageVisibility = () => {
            const shouldShow = prevMarriageCheckbox.checked;
            handleVisibility(prevMarriageCheckbox, prevMarriageContainer);
            if(addPrevMarriageButton) addPrevMarriageButton.classList.toggle('hidden', !shouldShow);
            // Post message to parent to toggle the children section visibility? More complex.
        };
        prevMarriageCheckbox.addEventListener('change', checkPrevMarriageVisibility);
        prevMarriageCheckbox.dataset.cvListener = 'true'; // Mark as attached
        checkPrevMarriageVisibility(); // Initial Check
    }

    // --- Previous Child Employment ---
    const prevChildrenContainer = scopeElement.id === 'prev-children-container' ? scopeElement : scopeElement.querySelector('#prev-children-container');
    if (prevChildrenContainer && !prevChildrenContainer.dataset.cvListener) {
        console.log("Section_common: Setting up Previous Child employment conditional visibility listener.");
        prevChildrenContainer.addEventListener('change', (event) => {
            if (event.target.matches('input[type="radio"][name^="prev_child"][name$="[employed]"]')) {
                const fieldset = event.target.closest('fieldset.repeatable-item');
                if (!fieldset) return;
                const detailsDiv = fieldset.querySelector('div[data-condition*="[employed]"]'); // Find the employment details div
                if (detailsDiv) {
                    const shouldShow = event.target.checked && event.target.value === 'Yes';
                    detailsDiv.classList.toggle('hidden', !shouldShow);
                    // Toggle required on the inputs inside
                    detailsDiv.querySelectorAll('input, textarea').forEach(input => {
                         const isInitiallyRequired = input.dataset.initiallyRequired === 'true'; // Check if it's meant to be required
                         input.required = shouldShow && isInitiallyRequired;
                    });
                }
            }
        });
        prevChildrenContainer.dataset.cvListener = 'true'; // Mark listener as attached
         // Trigger initial check for already loaded items within this scope
        prevChildrenContainer.querySelectorAll('input[type="radio"][name^="prev_child"][name$="[employed]"]:checked').forEach(radio => {
            radio.dispatchEvent(new Event('change', {bubbles: true}));
         });
    }
}

// --- Initialization on DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', () => {
    console.log(`Section_common: DOMContentLoaded for ${currentSectionKey || 'Unknown Section'}.`);

    // --- Auto-detect and setup repeatable sections ---
    setupRepeatable('siblings-container', 'add-sibling', 'sibling-template', 'sibling');
    setupRepeatable('education-container', 'add-education', 'education-template', 'education');
    setupRepeatable('employment-container', 'add-employment', 'employment-template', 'employment');
    setupRepeatable('absence-container', 'add-absence', 'absence-template', 'absence');
    setupRepeatable('passport-container', 'add-passport', 'passport-template', 'passport');
    setupRepeatable('prev-marriage-container', 'add-prev-marriage', 'prev-marriage-template', 'prev_marriage');
    setupRepeatable('prev-children-container', 'add-prev-child', 'prev-child-template', 'prev_child');

    // --- Setup Conditional Logic for the whole section initially ---
    setupConditionalVisibilityForItem(document.body);

    // --- Notify parent that this section is ready ---
    if (currentSectionKey && window.parent && window.parent !== window) {
        console.log(`Section_common (${currentSectionKey}): Sending SECTION_READY to parent.`);
        // Short delay to ensure page rendering is more complete
        setTimeout(() => {
            window.parent.postMessage({
                type: 'SECTION_READY',
                sectionName: window.location.pathname // Parent uses this path
            }, '*'); // Replace '*' with parent's actual origin in production
        }, 100);
    }

    // --- Auto-Save ---
    const formForAutoSave = document.querySelector('form') || document.querySelector('section.form-section');
    if (formForAutoSave && currentSectionKey && window.parent && window.parent !== window) {
        let debounceTimer;
        formForAutoSave.addEventListener('input', (event) => {
            if (!event.isTrusted) return; // Ignore programmatic changes
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                console.log(`Section_common (${currentSectionKey}): Input detected, sending auto-save data.`);
                const sectionData = collectSectionFormData();
                window.parent.postMessage({
                    type: 'SECTION_DATA_CHANGED_AUTOSAVE',
                    payload: sectionData,
                    sectionName: currentSectionKey // Use the derived key
                }, '*'); // Use specific origin
            }, 1000); // Debounce interval 1 second
        });
        console.log(`Section_common (${currentSectionKey}): Auto-save listener attached.`);
    }

    console.log(`Section_common: Initial setup complete for ${currentSectionKey || 'Unknown Section'}.`);
}); // End DOMContentLoaded
