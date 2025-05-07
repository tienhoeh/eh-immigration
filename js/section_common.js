// js/section_common.js

// Helper function to get current section name from its own path
function getCurrentSectionNameFromPath() {
    const pathname = window.location.pathname; // Path of the iframe's document
    if (!pathname) return null;
    const parts = pathname.split('/');
    const fileName = parts.pop(); // Get the last part (e.g., section-applicant-details.html)
    if (fileName && fileName.startsWith('section-') && fileName.endsWith('.html')) {
        return fileName.substring(0, fileName.length - 5); // Remove .html (e.g., section-applicant-details)
    }
    return null; // Or derive from a specific element ID if more reliable
}

const currentSectionName = getCurrentSectionNameFromPath();
console.log(`Section_common.js - Loaded for section: ${currentSectionName || 'Unknown Section'}`);

// --- Repeatable Sections Setup (Needed within iframe pages) ---
function updateRepeatableItemsUI(container, groupName) {
    if (!container) {
        console.warn(`updateRepeatableItemsUI: Container not found for group ${groupName}`);
        return;
    }
    const items = container.querySelectorAll(`.repeatable-item[data-group="${groupName}"]`);
    items.forEach((item, index) => {
        const removeButton = item.querySelector('.remove-item-button');
        if (removeButton) { removeButton.classList.toggle('hidden', items.length <= 1 && !item.dataset.canBeEmpty); }
        const legend = item.querySelector('legend');
        if (legend) { legend.textContent = legend.textContent.replace(/#|\d+/, `${index + 1}`); }
        // Update IDs/Fors using placeholder (e.g., sibling[#][name] -> sibling[1][name])
        // Assumes IDs/Fors have a pattern like fieldname-#-subfield
        item.querySelectorAll(`[id*="#"], label[for*="#"]`).forEach(el => {
            if (el.id) el.id = el.id.replace(/#/, `${index + 1}`);
            if (el.htmlFor) el.htmlFor = el.htmlFor.replace(/#/, `${index + 1}`);
        });
        item.querySelectorAll(`[name*="[#]"]`).forEach(input => {
            input.name = input.name.replace('[#]', `[${index + 1}]`);
            // Set initial required status based on visibility and data attribute
             const isInitiallyRequired = input.dataset.initiallyRequired === 'true';
             if (!input.closest('.hidden')) { input.required = isInitiallyRequired; }
             else { input.required = false; }
        });
    });
}

function setupRepeatable(containerId, addButtonId, templateId, groupName) {
    const container = document.getElementById(containerId);
    const addButton = document.getElementById(addButtonId);
    const template = document.getElementById(templateId);

    if (!container || !addButton || !template) {
        console.warn(`Section_common: Setup failed for repeatable: Missing elements for ${groupName} (Container: ${containerId}, Button: ${addButtonId}, Template: ${templateId})`);
        return;
    }
    console.log(`Section_common: Setting up repeatable for ${groupName} (Button: #${addButtonId})`);

    addButton.addEventListener('click', () => {
        console.log(`Section_common: Add button clicked for ${groupName}`);
        const clone = template.content.cloneNode(true);
        const newItem = clone.querySelector('.repeatable-item');
        if (!newItem) { console.error(`Template ${templateId} missing .repeatable-item.`); return; }
        newItem.dataset.group = groupName;

        const removeButton = newItem.querySelector('.remove-item-button');
        if (removeButton) {
            removeButton.addEventListener('click', (e) => { e.target.closest('.repeatable-item').remove(); updateRepeatableItemsUI(container, groupName); });
        } else { console.warn(`Template ${templateId} missing .remove-item-button`); }

        container.appendChild(newItem);
        updateRepeatableItemsUI(container, groupName);

        // Trigger conditional checks within the newly added item
        newItem.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(input => {
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        // Re-run specific conditional checks if needed for the new item
        if(window.triggerInitialConditionalChecksForSection) {
            window.triggerInitialConditionalChecksForSection(newItem);
        }
    });

    // Add remove listeners to initially present buttons (if any)
    container.querySelectorAll(`.repeatable-item[data-group="${groupName}"] .remove-item-button`).forEach(button => {
         if (!button.dataset.listenerAttached) {
             button.addEventListener('click', (e) => { e.target.closest('.repeatable-item').remove(); updateRepeatableItemsUI(container, groupName); });
             button.dataset.listenerAttached = 'true';
         }
     });
    updateRepeatableItemsUI(container, groupName); // Initial setup
}


// --- Form Data Collection and Population ---
function collectSectionFormData() {
    // Find the main form or a designated container for this section's inputs
    // This assumes there's one primary form or a div wrapping all inputs.
    // If multiple forms, this needs adjustment.
    const formElement = document.querySelector('form') || document.querySelector('section.form-section > div.form-grid') || document.body;
    if (!formElement) {
        console.error("Section_common: Could not find form/container to collect data from.");
        return {};
    }

    const formData = new FormData(formElement.closest('form') || formElement); // If formElement is not a form, find closest
    const data = {};

    // Handle FormData correctly, especially for multi-select and checkboxes
    for (let [key, value] of formData.entries()) {
        if (key.endsWith('[]')) { // Handle checkbox groups or multi-selects named like 'field[]'
            const actualKey = key.slice(0, -2);
            if (!data[actualKey]) {
                data[actualKey] = [];
            }
            data[actualKey].push(value);
        } else {
            // Check if key already exists (e.g., multiple radio buttons with same name)
            if (data[key] !== undefined) {
                // If it's not already an array, make it one
                if (!Array.isArray(data[key])) {
                    data[key] = [data[key]];
                }
                data[key].push(value); // This might not be what you want for radios, typically only checked one is sent
            } else {
                data[key] = value;
            }
        }
    }
     // For checkboxes not part of a group (single checkbox with a name)
     formElement.querySelectorAll('input[type="checkbox"]:not([name$="[]"])').forEach(checkbox => {
         if(checkbox.name && checkbox.name.trim() !== ''){
             data[checkbox.name] = checkbox.checked;
         }
     });
     // For radio buttons, FormData typically only includes the checked one.
     // If you need all radio values, you'd iterate them separately.

    console.log(`Section_common: Collected data for ${currentSectionName}:`, data);
    return data;
}

function populateSectionForm(dataToLoad) {
    if (!dataToLoad || Object.keys(dataToLoad).length === 0) {
        console.log(`Section_common: No data provided to populate ${currentSectionName}.`);
        return;
    }
    console.log(`Section_common: Populating form for ${currentSectionName} with:`, dataToLoad);
    const formElement = document.querySelector('form') || document.querySelector('section.form-section > div.form-grid') || document.body;
    if (!formElement) {
        console.error("Section_common: Could not find form/container to populate data into.");
        return;
    }

    // --- Load Repeatable Sections First based on dataToLoad ---
    const repeatableGroups = ['sibling', 'education', 'employment', 'absence', 'passport', 'prev_marriage', 'prev_child'];
    repeatableGroups.forEach(groupName => {
        // Check if data for this group exists (e.g., dataToLoad['sibling[1][name]'] or an array dataToLoad.sibling)
        // This requires knowing the structure of dataToLoad for repeatables.
        // Let's assume dataToLoad has arrays for repeatable items, e.g., dataToLoad.sibling = [ {name: ...}, {name: ...} ]
        // OR it uses indexed keys like dataToLoad['sibling[2][name]']

        let maxIndexInData = 0;
        if (Array.isArray(dataToLoad[groupName])) { // If data is like dataToLoad.sibling = [{...}, {...}]
            maxIndexInData = dataToLoad[groupName].length;
        } else { // If data is like dataToLoad['sibling[2][name]']
            const groupKeys = Object.keys(dataToLoad).filter(k => k.startsWith(`${groupName}[`));
            groupKeys.forEach(key => {
                const match = key.match(new RegExp(`^${groupName}\\[(\\d+)\\]`));
                if (match && parseInt(match[1]) > maxIndexInData) { maxIndexInData = parseInt(match[1]); }
            });
        }

        const container = document.getElementById(`${groupName.replace('_', '-')}-container`);
        const addButton = document.getElementById(`add-${groupName.replace('_', '-')}`);
        if (container && addButton && maxIndexInData > 0) {
            const existingItems = container.querySelectorAll(`.repeatable-item[data-group="${groupName}"]`).length;
            const itemsToAdd = maxIndexInData - existingItems;
            console.log(`Section_common: Populating repeatable ${groupName}: Max items in data ${maxIndexInData}, existing ${existingItems}, adding ${itemsToAdd}`);
            for (let i = 0; i < itemsToAdd; i++) {
                if(addButton) addButton.click(); // Simulate clicks to add items via setupRepeatable
            }
        }
    });

    // Use a timeout to allow DOM updates from adding repeatable sections to settle
    setTimeout(() => {
        console.log("Section_common: Populating individual form fields...");
        for (const key in dataToLoad) {
            if (Object.prototype.hasOwnProperty.call(dataToLoad, key)) {
                const elements = formElement.querySelectorAll(`[name="${key}"]`);
                if (elements.length > 0) {
                    elements.forEach(element => {
                        if (element.type === 'checkbox') {
                            if (key.endsWith('[]')) { // Checkbox group
                                // Assumes dataToLoad[key_base] is an array of values for checked boxes
                                const baseKey = key.slice(0, -2);
                                element.checked = Array.isArray(dataToLoad[baseKey]) && dataToLoad[baseKey].includes(element.value);
                            } else { // Single checkbox
                                element.checked = dataToLoad[key] === true || dataToLoad[key] === 'true' || dataToLoad[key] === 'on';
                            }
                        } else if (element.type === 'radio') {
                            element.checked = (element.value === dataToLoad[key]);
                        } else {
                            element.value = dataToLoad[key];
                        }
                        // Trigger change for conditional logic if any depends on this field
                        element.dispatchEvent(new Event('change', { bubbles: true }));
                    });
                } else {
                     // Handle cases where name might represent a group of checkboxes (e.g. dataToLoad.ns_organization = ['SAF', 'SPF'])
                     if(Array.isArray(dataToLoad[key])) {
                         dataToLoad[key].forEach(value => {
                             const checkbox = formElement.querySelector(`input[type="checkbox"][name="${key}[]"][value="${value}"]`);
                             if(checkbox) checkbox.checked = true;
                         });
                     }
                }
            }
        }
        console.log(`Section_common: Form population for ${currentSectionName} complete.`);
        // Re-run conditional visibility checks for the section
        if(window.triggerInitialConditionalChecksForSection) {
            window.triggerInitialConditionalChecksForSection(document.body); // Check whole section
        } else if(window.triggerInitialConditionalChecks) { // Fallback to less specific
            window.triggerInitialConditionalChecks();
        }
    }, 250); // Slightly longer delay for population
}


// --- Message Handling (Communication with Parent Iframe) ---
window.addEventListener('message', (event) => {
    // IMPORTANT: Verify origin for security in a production app
    // if (event.origin !== 'YOUR_PARENT_APP_ORIGIN') return;
    // For local file testing and simple Netlify, window.location.origin might be complex due to iframe.
    // A more robust check is needed in production if parent origin can vary.

    const { type, payload, sectionName: requestedSectionName } = event.data;
    console.log(`Section_common (${currentSectionName}): Message received from parent:`, event.data);

    if (type === 'GET_SECTION_DATA') {
        // Parent is requesting data from THIS section
        if (currentSectionName && requestedSectionName === currentSectionName) {
            const sectionData = collectSectionFormData();
            console.log(`Section_common (${currentSectionName}): Sending data response to parent:`, sectionData);
            window.parent.postMessage({
                type: 'SECTION_DATA_RESPONSE',
                payload: sectionData,
                sectionName: currentSectionName
            }, '*'); // Replace '*' with event.origin or parent's actual origin in production
        } else {
             console.warn(`Section_common (${currentSectionName}): GET_SECTION_DATA request was for section "${requestedSectionName}", ignoring.`);
        }
    } else if (type === 'LOAD_SECTION_DATA') {
        // Parent is sending data TO THIS section
        console.log(`Section_common (${currentSectionName}): Received data to load:`, payload);
        populateSectionForm(payload);
    }
});


// --- DOMContentLoaded specific setups for this section ---
document.addEventListener('DOMContentLoaded', () => {
    console.log(`Section_common: DOMContentLoaded for ${currentSectionName}.`);

    // Auto-detect and setup repeatable sections on the current page
    if (document.getElementById('siblings-container') && document.getElementById('add-sibling') && document.getElementById('sibling-template')) {
        setupRepeatable('siblings-container', 'add-sibling', 'sibling-template', 'sibling');
    }
    if (document.getElementById('education-container') && document.getElementById('add-education') && document.getElementById('education-template')) {
        setupRepeatable('education-container', 'add-education', 'education-template', 'education');
    }
    if (document.getElementById('employment-container') && document.getElementById('add-employment') && document.getElementById('employment-template')) {
        setupRepeatable('employment-container', 'add-employment', 'employment-template', 'employment');
    }
    if (document.getElementById('absence-container') && document.getElementById('add-absence') && document.getElementById('absence-template')) {
        setupRepeatable('absence-container', 'add-absence', 'absence-template', 'absence');
    }
    if (document.getElementById('passport-container') && document.getElementById('add-passport') && document.getElementById('passport-template')) {
        setupRepeatable('passport-container', 'add-passport', 'passport-template', 'passport');
    }
    if (document.getElementById('prev-marriage-container') && document.getElementById('add-prev-marriage') && document.getElementById('prev-marriage-template')) {
        setupRepeatable('prev-marriage-container', 'add-prev-marriage', 'prev-marriage-template', 'prev_marriage');
    }
    if (document.getElementById('prev-children-container') && document.getElementById('add-prev-child') && document.getElementById('prev-child-template')) {
        setupRepeatable('prev-children-container', 'add-prev-child', 'prev-child-template', 'prev_child');
    }

    // Conditional Logic (must be defined if used, or move setupConditionalVisibility here)
    // This part assumes setupConditionalVisibility and specific trigger elements are defined within this scope
    // or that the functions for it are globally available from another script (less ideal for modules).
    // For simplicity, let's assume these specific conditional triggers are in this file too if needed.

    const nsApplicableCheckbox = document.getElementById('ns-applicable');
    const nsDetailsContainer = document.getElementById('ns-details-container');
    if(nsApplicableCheckbox && nsDetailsContainer) {
        const checkNSVisibility = () => { /* ... as before ... */ }; nsApplicableCheckbox.addEventListener('change', checkNSVisibility); checkNSVisibility();
    }
    const prevMarriageCheckbox = document.getElementById('prev-marriage-applicable');
    const prevMarriageContainer = document.getElementById('prev-marriage-container');
    const addPrevMarriageButton = document.getElementById('add-prev-marriage');
    const prevChildrenSection = document.getElementById('section-prev-children');
    if(prevMarriageCheckbox && prevMarriageContainer && addPrevMarriageButton && prevChildrenSection){
        const checkPrevMarriageVisibility = () => { /* ... as before ... */ }; prevMarriageCheckbox.addEventListener('change', checkPrevMarriageVisibility); checkPrevMarriageVisibility();
    }
    // Child employment toggle
    const prevChildrenContainer = document.getElementById('prev-children-container');
    if(prevChildrenContainer) {
         prevChildrenContainer.addEventListener('change', (event) => { /* ... as before ... */ });
         prevChildrenContainer.querySelectorAll('input[type="radio"][name^="prev_child"][name$="[employed]"]:checked').forEach(radio => { radio.dispatchEvent(new Event('change', {bubbles: true})); });
    }

    // Notify parent that this section is ready (its DOM is loaded)
    // Ensure currentSectionName is valid
    if (currentSectionName && window.parent && window.parent !== window) {
        console.log(`Section_common (${currentSectionName}): Sending SECTION_READY to parent.`);
        window.parent.postMessage({
            type: 'SECTION_READY',
            sectionName: window.location.pathname // Parent can use this to derive section key
        }, '*'); // Replace '*' with parent's origin in production
    }

    // Optional: Auto-save on input change (can be very chatty, use debouncing in real app)
    const formForAutoSave = document.querySelector('form') || document.querySelector('section.form-section');
    if (formForAutoSave && currentSectionName && window.parent && window.parent !== window) {
        let debounceTimer;
        formForAutoSave.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                console.log(`Section_common (${currentSectionName}): Input detected, sending auto-save data to parent.`);
                const sectionData = collectSectionFormData();
                window.parent.postMessage({
                    type: 'SECTION_DATA_CHANGED_AUTOSAVE',
                    payload: sectionData,
                    sectionName: currentSectionName
                }, '*'); // Target specific origin
            }, 750); // Debounce for 750ms
        });
    }

});
