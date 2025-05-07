// js/section_common.js

// Helper function to get current section name from its own path
function getCurrentSectionNameFromPath() {
    const pathname = window.location.pathname; // Path of the iframe's document
    if (!pathname) return null;
    const parts = pathname.split('/');
    const fileName = parts.pop() || parts.pop(); // Handle potential trailing slash
    if (fileName && fileName.startsWith('section-') && fileName.endsWith('.html')) {
        // Extract the part between "section-" and ".html", replace dashes with underscores for key consistency
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
 * @param {HTMLElement} container - The container element holding the repeatable items.
 * @param {string} groupName - The data-group name for the items.
 */
function updateRepeatableItemsUI(container, groupName) {
    if (!container) {
        console.warn(`updateRepeatableItemsUI: Container not found for group ${groupName}`);
        return;
    }
    const items = container.querySelectorAll(`.repeatable-item[data-group="${groupName}"]`);
    // console.log(`Updating UI for ${items.length} items in group ${groupName}`); // Optional: Verbose log

    items.forEach((item, index) => {
        const itemIndex = index + 1; // Use 1-based index for display and names

        // Toggle remove button visibility
        const removeButton = item.querySelector('.remove-item-button');
        if (removeButton) {
            removeButton.classList.toggle('hidden', items.length <= 1 && !item.dataset.canBeEmpty); // Hide if only one left, unless empty is allowed
        }

        // Update legend number
        const legend = item.querySelector('legend');
        if (legend) {
            legend.textContent = legend.textContent.replace(/#|\d+/, `${itemIndex}`); // Replace # or existing number
        }

        // Update IDs and label 'for' attributes using '#' placeholder
        item.querySelectorAll(`[id*="#"], label[for*="#"]`).forEach(el => {
            if (el.id) el.id = el.id.replace(/#/g, `${itemIndex}`); // Replace all '#' placeholders
            if (el.htmlFor) el.htmlFor = el.htmlFor.replace(/#/g, `${itemIndex}`);
        });

        // Update input/select/textarea names using '[#]' placeholder
        item.querySelectorAll(`[name*="[#]"]`).forEach(input => {
            const newName = input.name.replace(/\[#\]/g, `[${itemIndex}]`); // Replace all '[#]' placeholders
            input.name = newName;

            // Set initial required status based on visibility and data attribute
            const isInitiallyRequired = input.dataset.initiallyRequired === 'true';
             if (!input.closest('.hidden')) { input.required = isInitiallyRequired; }
             else { input.required = false; } // Never required if hidden
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

    // Check if essential elements exist for this specific section
    if (!container) {
        // console.log(`Section_common: Container #${containerId} not found (normal if not this section).`); // Less noisy log
        return false; // This section doesn't have this repeatable group
    }
    if (!addButton) {
        console.error(`Section_common: Repeatable setup FAILED for "${groupName}". Reason: Add button with ID "${addButtonId}" not found.`);
        return false;
    }
     if (!template) {
        console.error(`Section_common: Repeatable setup FAILED for "${groupName}". Reason: Template element with ID "${templateId}" not found.`);
        return false;
    }

    console.log(`Section_common: Setting up repeatable for ${groupName} (Button: #${addButtonId}, Container: #${containerId}, Template: #${templateId})`);

    // --- Add Button Event Listener ---
    addButton.addEventListener('click', () => {
        console.log(`Section_common: Add button clicked for ${groupName}`);
        try {
            const clone = template.content.cloneNode(true); // Clone template content
            console.log(`Section_common: Cloned template content for ${groupName}.`);

            const newItem = clone.querySelector('.repeatable-item'); // Find the main fieldset/div in the clone
            if (!newItem) {
                console.error(`Template ${templateId} is missing a root element with class ".repeatable-item".`);
                return;
            }
            newItem.dataset.group = groupName; // Ensure group name is set

            // Find and setup the remove button within the *cloned* item
            const removeButton = newItem.querySelector('.remove-item-button');
            if (removeButton) {
                removeButton.classList.remove('hidden'); // Make sure remove button is visible on new items
                removeButton.addEventListener('click', (e) => {
                    console.log(`Removing item for group ${groupName}`);
                    // Find the closest ancestor that is the repeatable item and remove it
                    const itemToRemove = e.target.closest('.repeatable-item[data-group="' + groupName + '"]');
                    if(itemToRemove) {
                        itemToRemove.remove();
                        updateRepeatableItemsUI(container, groupName); // Update numbering after removing
                    } else {
                        console.error("Could not find repeatable item parent to remove.");
                    }
                });
            } else {
                console.warn(`Template ${templateId} is missing a ".remove-item-button".`);
            }

            container.appendChild(newItem); // Append the fully prepared new item to the container
            console.log(`Section_common: New item appended for ${groupName}. Now updating UI.`);

            // Update numbering, names, IDs, and remove button visibility for ALL items
            updateRepeatableItemsUI(container, groupName);

            // Trigger conditional checks within the newly added item scope if needed
            if(typeof triggerInitialConditionalChecksForSection === "function"){
                triggerInitialConditionalChecksForSection(newItem);
            }
            console.log(`Section_common: Finished processing add click for ${groupName}.`);

        } catch (error) {
            console.error(`Section_common: Error occurred inside Add button click handler for ${groupName}:`, error);
        }
    });
    console.log(`Section_common: Event listener added to button #${addButtonId}.`);

    // --- Initial Setup for Existing Items ---
    // Add remove listeners to initially present buttons (the first item)
    container.querySelectorAll(`.repeatable-item[data-group="${groupName}"] .remove-item-button`).forEach(button => {
         if (!button.dataset.listenerAttached) { // Prevent adding multiple listeners
             button.addEventListener('click', (e) => {
                 console.log(`Removing initial item for group ${groupName}`);
                  const itemToRemove = e.target.closest('.repeatable-item[data-group="' + groupName + '"]');
                 if(itemToRemove) {
                    itemToRemove.remove();
                    updateRepeatableItemsUI(container, groupName);
                 }
             });
             button.dataset.listenerAttached = 'true';
         }
     });
    // Run UI update initially for the first item(s) present in HTML
    updateRepeatableItemsUI(container, groupName);
    return true; // Indicate setup was successful
}


// --- Form Data Collection and Population ---

function collectSectionFormData() {
    const sectionElement = document.querySelector(`section#section-${currentSectionKey ? currentSectionKey.replace(/_/g, '-') : ''}`) || document.body;
    if (!sectionElement) { console.error("Section_common: Could not find section container to collect data from."); return {}; }

    const data = {};
    const inputs = sectionElement.querySelectorAll('input:not([type="button"]):not([type="submit"]), select, textarea'); // Exclude buttons

    inputs.forEach(input => {
        const name = input.name;
        if (!name || input.closest('.hidden')) return; // Skip unnamed, hidden

        const repeatableMatch = name.match(/^(\w+)\[(\d+)\]\[(\w+)\]$/);
        const groupName = repeatableMatch ? repeatableMatch[1] : null;
        const index = repeatableMatch ? parseInt(repeatableMatch[2]) - 1 : null; // 0-based index
        const fieldName = repeatableMatch ? repeatableMatch[3] : name; // Actual field key

        if (groupName !== null && index !== null) { // Repeatable field
             if (!data[groupName]) data[groupName] = [];
             while (data[groupName].length <= index) data[groupName].push({});

             if (input.type === 'checkbox') {
                 if (!input.value || input.value.toLowerCase() === 'on') {
                     data[groupName][index][fieldName] = input.checked;
                 } else { // Checkbox group part
                     if (!data[groupName][index][fieldName]) data[groupName][index][fieldName] = [];
                     if (input.checked) data[groupName][index][fieldName].push(input.value);
                 }
             } else if (input.type === 'radio') {
                 if (input.checked) data[groupName][index][fieldName] = input.value;
             } else { data[groupName][index][fieldName] = input.value; }

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
             } else { data[name] = input.value; }
        }
    });
    // console.log(`Section_common: Collected data for ${currentSectionKey}:`, data); // Optional: Verbose log
    return data;
}


function populateSectionForm(dataToLoad) {
    if (!dataToLoad || Object.keys(dataToLoad).length === 0) { console.log(`Section_common: No data provided to populate ${currentSectionKey}.`); return; }
    console.log(`Section_common: Populating form for ${currentSectionKey} with:`, dataToLoad);
    const sectionElement = document.querySelector(`section#section-${currentSectionKey ? currentSectionKey.replace(/_/g, '-') : ''}`) || document.body;
    if (!sectionElement) { console.error(`Section_common: Could not find section container to populate.`); return; }

    // --- Handle Adding Repeatable Sections based on dataToLoad ---
    const repeatableGroups = ['sibling', 'education', 'employment', 'absence', 'passport', 'prev_marriage', 'prev_child'];
    repeatableGroups.forEach(groupName => {
        if (Array.isArray(dataToLoad[groupName])) { // Assumes draft data has arrays e.g., data.sibling = [{}, {}]
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
                    if(addButton) addButton.click(); // Simulate adding items via setupRepeatable
                }
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

            if (value === undefined) { // No value found in draft for this input
                if (input.type === 'radio') { // Uncheck radio if no value for its group
                    if (dataToLoad[name] === undefined) input.checked = false;
                }
                return; // Skip setting value
            }

            // Set value based on type
            if (input.type === 'checkbox') {
                 if (name.endsWith('[]')) { // Checkbox group
                     input.checked = Array.isArray(value) && value.includes(input.value);
                 } else { // Single checkbox
                     input.checked = value === true || String(value).toLowerCase() === 'true' || String(value).toLowerCase() === 'yes' || String(value).toLowerCase() === 'on';
                 }
             } else if (input.type === 'radio') {
                 input.checked = (input.value === String(value));
             } else {
                 input.value = value;
             }
            input.dispatchEvent(new Event('change', { bubbles: true })); // Trigger change event
        });
        console.log(`Section_common: Form population attempt finished for ${currentSectionKey}.`);
        // Re-run conditional checks AFTER population
         if(typeof triggerInitialConditionalChecksForSection === "function"){
            triggerInitialConditionalChecksForSection(sectionElement);
        }
    }, 350); // Increased delay further
}

// --- Message Handling ---
window.addEventListener('message', (event) => {
    // Basic origin check - enhance in production if possible
    if (event.origin !== window.location.origin && event.origin !== 'null') {
         console.warn(`Section_common (${currentSectionKey}): Ignoring message from potentially insecure origin: ${event.origin}`);
         return;
    }

    const { type, payload, sectionName: requestedSectionName } = event.data;
    console.log(`Section_common (${currentSectionKey}): Message received from parent: Type=${type}`);

    if (type === 'GET_SECTION_DATA') {
        if (currentSectionKey && requestedSectionName === currentSectionKey) {
            const sectionData = collectSectionFormData();
            console.log(`Section_common (${currentSectionName}): Sending data response to parent:`, sectionData);
            event.source.postMessage({
                type: 'SECTION_DATA_RESPONSE',
                payload: sectionData,
                sectionName: currentSectionKey
            }, event.origin); // Respond to specific origin
        } else {
             console.warn(`Section_common (${currentSectionKey}): GET_SECTION_DATA request was for section "${requestedSectionName}", ignoring.`);
        }
    } else if (type === 'LOAD_SECTION_DATA') {
        console.log(`Section_common (${currentSectionKey}): Received data to load:`, payload);
        populateSectionForm(payload);
    }
});


// --- Initialization on DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', () => {
    console.log(`Section_common: DOMContentLoaded for ${currentSectionKey || 'Unknown Section'}.`);

    // --- Setup Repeatables for this section ---
    let setupAttempted = { sibling: false, education: false, employment: false, absence: false, passport: false, prev_marriage: false, prev_child: false };
    if (document.getElementById('siblings-container')) setupAttempted.sibling = setupRepeatable('siblings-container', 'add-sibling', 'sibling-template', 'sibling');
    if (document.getElementById('education-container')) setupAttempted.education = setupRepeatable('education-container', 'add-education', 'education-template', 'education');
    if (document.getElementById('employment-container')) setupAttempted.employment = setupRepeatable('employment-container', 'add-employment', 'employment-template', 'employment');
    if (document.getElementById('absence-container')) setupAttempted.absence = setupRepeatable('absence-container', 'add-absence', 'absence-template', 'absence');
    if (document.getElementById('passport-container')) setupAttempted.passport = setupRepeatable('passport-container', 'add-passport', 'passport-template', 'passport');
    if (document.getElementById('prev-marriage-container')) setupAttempted.prev_marriage = setupRepeatable('prev-marriage-container', 'add-prev-marriage', 'prev-marriage-template', 'prev_marriage');
    if (document.getElementById('prev-children-container')) setupAttempted.prev_child = setupRepeatable('prev-children-container', 'add-prev-child', 'prev-child-template', 'prev_child');
    console.log("Section_common: Repeatable setup attempts:", setupAttempted);

    // --- Setup Conditional Logic for this section ---
     window.triggerInitialConditionalChecksForSection = (containerElement = document) => {
        console.log("Section_common: Running conditional checks for container:", containerElement);
        // NS Check
        const nsAppCheck = containerElement.querySelector('#ns-applicable');
        const nsDetCont = containerElement.querySelector('#ns-details-container');
        if(nsAppCheck && nsDetCont) { const check = () => { /*...*/ }; if(!nsAppCheck.dataset.caLs) { nsAppCheck.addEventListener('change', check); nsAppCheck.dataset.caLs='true'; } check(); }

        // Prev Marriage Check
        const prevMarrCheck = containerElement.querySelector('#prev-marriage-applicable');
        const prevMarrCont = containerElement.querySelector('#prev-marriage-container');
        const addPrevMarrBtn = containerElement.querySelector('#add-prev-marriage');
        const prevChildSec = document.getElementById('section-prev-children'); // Note: Can't directly control parent page elements here
        if(prevMarrCheck && prevMarrCont && addPrevMarrBtn){ const check = () => { /*...*/ }; if(!prevMarrCheck.dataset.caLs) { prevMarrCheck.addEventListener('change', check); prevMarrCheck.dataset.caLs='true'; } check(); }

        // Child Employment Check (within the current section context)
        const prevChildCont = containerElement.id === 'prev-children-container' ? containerElement : containerElement.querySelector('#prev-children-container'); // Find container
        if(prevChildCont) {
             prevChildCont.querySelectorAll('input[type="radio"][name^="prev_child"][name$="[employed]"]:checked').forEach(radio => { radio.dispatchEvent(new Event('change',{bubbles: true})); }); // Trigger initial
             if(!prevChildCont.dataset.caLs) { // Attach listener only once
                prevChildCont.addEventListener('change', (event) => { if (event.target.matches('input[type="radio"][name^="prev_child"][name$="[employed]"]')) { /*...*/ } });
                prevChildCont.dataset.caLs='true';
             }
        }
     };
     triggerInitialConditionalChecksForSection(document); // Run initial checks for the whole section body

    // --- Notify parent that this section is ready ---
    if (currentSectionKey && window.parent && window.parent !== window) {
        console.log(`Section_common (${currentSectionKey}): Sending SECTION_READY to parent.`);
        window.parent.postMessage({
            type: 'SECTION_READY',
            sectionName: window.location.pathname // Send path
        }, '*'); // Replace '*' with parent's origin
    }

    // --- Auto-Save ---
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
            }, 1000); // Debounce interval 1 second
        });
        console.log(`Section_common (${currentSectionKey}): Auto-save listener attached.`);
    }

    console.log(`Section_common: Initial setup complete for ${currentSectionKey || 'Unknown Section'}.`);

}); // End DOMContentLoaded
