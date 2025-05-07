// js/section_common.js

// Helper function to get current section name from its own path
function getCurrentSectionNameFromPath() {
    const pathname = window.location.pathname; // Path of the iframe's document
    if (!pathname) return null;
    const parts = pathname.split('/');
    const fileName = parts.pop() || parts.pop(); // Handle potential trailing slash
    if (fileName && fileName.startsWith('section-') && fileName.endsWith('.html')) {
        // Extract the part between "section-" and ".html"
        return fileName.substring(8, fileName.length - 5).replace(/-/g, '_'); // e.g., applicant_details, prev_marriage
    }
    return null; // Or derive from a specific element ID if more reliable
}

const currentSectionKey = getCurrentSectionNameFromPath(); // e.g., 'applicant_details'
console.log(`Section_common.js - Loaded for section key: ${currentSectionKey || 'Unknown Section'} (Path: ${window.location.pathname})`);

// --- Repeatable Sections Setup (Needed within iframe pages) ---

// Helper to update numbering and remove buttons for a specific group
function updateRepeatableItemsUI(container, groupName) {
    if (!container) {
        console.warn(`updateRepeatableItemsUI: Container not found for group ${groupName}`);
        return;
    }
    const items = container.querySelectorAll(`.repeatable-item[data-group="${groupName}"]`);
    console.log(`Updating UI for ${items.length} items in group ${groupName}`);
    items.forEach((item, index) => {
        const itemIndex = index + 1; // Use 1-based index for display and names
        const removeButton = item.querySelector('.remove-item-button');
        if (removeButton) { removeButton.classList.toggle('hidden', items.length <= 1 && !item.dataset.canBeEmpty); }
        const legend = item.querySelector('legend');
        if (legend) { legend.textContent = legend.textContent.replace(/#|\d+/, `${itemIndex}`); }

        // Update IDs/Fors using placeholder (e.g., id="sibling-#-name" -> id="sibling-1-name")
        item.querySelectorAll(`[id*="#"], label[for*="#"]`).forEach(el => {
            const newId = el.id ? el.id.replace(/#/g, `${itemIndex}`) : null; // Replace all '#'
            const newFor = el.htmlFor ? el.htmlFor.replace(/#/g, `${itemIndex}`) : null;
            if(newId) el.id = newId;
            if(newFor) el.htmlFor = newFor;
        });
        // Update names containing placeholder (e.g., name="sibling[#][name]" -> name="sibling[1][name]")
        item.querySelectorAll(`[name*="[#]"]`).forEach(input => {
            const newName = input.name.replace(/\[#\]/g, `[${itemIndex}]`); // Replace all '[#]'
            input.name = newName;
            // Set initial required status based on visibility and data attribute
            const isInitiallyRequired = input.dataset.initiallyRequired === 'true';
             if (!input.closest('.hidden')) { input.required = isInitiallyRequired; }
             else { input.required = false; } // Always false if hidden
        });
    });
}

function setupRepeatable(containerId, addButtonId, templateId, groupName) {
    const container = document.getElementById(containerId);
    const addButton = document.getElementById(addButtonId);
    const template = document.getElementById(templateId);

    if (!container || !addButton || !template) {
        // Don't warn if elements just aren't on this specific section page
        // console.warn(`Setup failed for repeatable section: Missing elements for ${groupName} (Container: ${containerId}, Button: ${addButtonId}, Template: ${templateId})`);
        return false; // Indicate setup didn't happen
    }
    console.log(`Section_common: Setting up repeatable for ${groupName} (Button: #${addButtonId})`);

    addButton.addEventListener('click', () => {
        console.log(`Section_common: Add button clicked for ${groupName}`);
        const clone = template.content.cloneNode(true);
        const newItem = clone.querySelector('.repeatable-item');
        if (!newItem) { console.error(`Template ${templateId} missing .repeatable-item.`); return; }
        newItem.dataset.group = groupName; // Ensure group name is set

        // Add remove listener to the new button *before* appending
        const removeButton = newItem.querySelector('.remove-item-button');
        if (removeButton) {
            removeButton.addEventListener('click', (e) => {
                console.log(`Removing item for group ${groupName}`);
                e.target.closest('.repeatable-item').remove();
                updateRepeatableItemsUI(container, groupName); // Update numbering after removing
            });
        } else { console.warn(`Template ${templateId} missing .remove-item-button`); }

        container.appendChild(newItem); // Add to DOM
        updateRepeatableItemsUI(container, groupName); // Update numbering/buttons for all items

        // Trigger initial conditional checks within the newly added item
        newItem.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(input => {
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        // You might need a more specific way to trigger conditional logic setup for the new item
        // if window.triggerInitialConditionalChecksForSection exists, call it for the newItem
        if(typeof triggerInitialConditionalChecksForSection === "function"){
            triggerInitialConditionalChecksForSection(newItem);
        }

    });

    // Add remove listeners to initially present buttons
    container.querySelectorAll(`.repeatable-item[data-group="${groupName}"] .remove-item-button`).forEach(button => {
         if (!button.dataset.listenerAttached) { // Prevent adding multiple listeners
             button.addEventListener('click', (e) => {
                console.log(`Removing initial item for group ${groupName}`);
                e.target.closest('.repeatable-item').remove();
                updateRepeatableItemsUI(container, groupName);
             });
             button.dataset.listenerAttached = 'true';
         }
     });
    updateRepeatableItemsUI(container, groupName); // Initial setup for numbering/buttons
    return true; // Indicate setup happened
}


// --- Form Data Collection and Population ---

// Collects data from inputs within this section's scope
function collectSectionFormData() {
    // Find the best container: the form section itself is a good boundary
    const sectionElement = document.querySelector(`section#section-${currentSectionKey ? currentSectionKey.replace(/_/g, '-') : ''}`) || document.body;
    if (!sectionElement) {
        console.error(`Section_common: Could not find container (section#section-${currentSectionKey ? currentSectionKey.replace(/_/g, '-') : ''}) to collect data from.`);
        return {};
    }

    const data = {};
    const inputs = sectionElement.querySelectorAll('input, select, textarea');

    inputs.forEach(input => {
        const name = input.name;
        if (!name || input.closest('.hidden')) { // Skip unnamed or hidden inputs
            return;
        }

        // Extract base name and index for repeatable fields (e.g., "sibling" and "1" from "sibling[1][name]")
        const repeatableMatch = name.match(/^(\w+)\[(\d+)\]\[(\w+)\]$/); // Matches pattern like sibling[1][name]
        const groupName = repeatableMatch ? repeatableMatch[1] : null;
        const index = repeatableMatch ? parseInt(repeatableMatch[2]) - 1 : null; // 0-based index
        const fieldName = repeatableMatch ? repeatableMatch[3] : name;

        if (groupName && index !== null) {
             // Handle repeatable field data structure (e.g., array of objects)
             if (!data[groupName]) {
                 data[groupName] = []; // Initialize array for the group
             }
             // Ensure array is long enough
             while (data[groupName].length <= index) {
                 data[groupName].push({});
             }
             // Add field data to the correct object in the array
             if (input.type === 'checkbox') {
                 if (!input.value || input.value.toLowerCase() === 'on') { // Single checkbox without specific value
                    data[groupName][index][fieldName] = input.checked;
                 } else { // Checkbox group part (though less common within repeatables this way)
                     if (!data[groupName][index][fieldName]) data[groupName][index][fieldName] = [];
                     if(input.checked) data[groupName][index][fieldName].push(input.value);
                 }
             } else if (input.type === 'radio') {
                 if (input.checked) {
                     data[groupName][index][fieldName] = input.value;
                 }
             } else {
                 data[groupName][index][fieldName] = input.value;
             }
        } else {
             // Handle non-repeatable field data
             if (input.type === 'checkbox') {
                  if (!input.value || input.value.toLowerCase() === 'on') { // Single checkbox
                     data[fieldName] = input.checked;
                  } else { // Checkbox group (array of values)
                      if (!data[fieldName]) data[fieldName] = [];
                      if (input.checked) data[fieldName].push(input.value);
                  }
             } else if (input.type === 'radio') {
                 if (input.checked) {
                     data[fieldName] = input.value;
                 }
             } else {
                 data[fieldName] = input.value;
             }
        }
    });

    console.log(`Section_common: Collected data for ${currentSectionKey}:`, data);
    return data;
}


// Populates form fields within this section from received data object
function populateSectionForm(dataToLoad) {
    if (!dataToLoad || Object.keys(dataToLoad).length === 0) {
        console.log(`Section_common: No data provided to populate ${currentSectionKey}.`);
        return;
    }
    console.log(`Section_common: Populating form for ${currentSectionKey} with:`, dataToLoad);
    const sectionElement = document.querySelector(`section#section-${currentSectionKey ? currentSectionKey.replace(/_/g, '-') : ''}`) || document.body;
    if (!sectionElement) {
        console.error(`Section_common: Could not find container (section#section-${currentSectionKey ? currentSectionKey.replace(/_/g, '-') : ''}) to populate data into.`);
        return;
    }

    // --- Handle Adding Repeatable Sections based on dataToLoad ---
    // This assumes dataToLoad contains arrays for repeatable groups, e.g., dataToLoad.sibling = [ {...}, {...} ]
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
                console.log(`Section_common: Populating repeatable ${groupName}: Items in data ${itemsInData}, existing ${existingItems}, adding ${itemsToAdd}`);
                for (let i = 0; i < itemsToAdd; i++) {
                    if(addButton) addButton.click(); // Simulate adding items
                }
            }
        }
    });


    // --- Populate All Fields (Use timeout for DOM updates from adding repeatables) ---
    setTimeout(() => {
        console.log("Section_common: Populating individual form fields...");
        sectionElement.querySelectorAll('input, select, textarea').forEach(input => {
            const name = input.name;
            if (!name || name === 'bot-field' || name === 'form-name') return;

            // Find value from dataToLoad (handles simple and repeatable fields)
            let value = undefined;
            const repeatableMatch = name.match(/^(\w+)\[(\d+)\]\[(\w+)\]$/);
            if (repeatableMatch) {
                const groupName = repeatableMatch[1];
                const index = parseInt(repeatableMatch[2]) - 1; // 0-based index
                const fieldName = repeatableMatch[3];
                if (dataToLoad[groupName] && dataToLoad[groupName][index] && dataToLoad[groupName][index][fieldName] !== undefined) {
                    value = dataToLoad[groupName][index][fieldName];
                }
            } else {
                 // Handle checkbox groups possibly stored under base name
                 if(input.type === 'checkbox' && name.endsWith('[]')){
                    const baseName = name.slice(0, -2);
                    value = dataToLoad[baseName]; // Expecting an array
                 } else {
                    value = dataToLoad[name]; // Simple field name
                 }
            }

            // Skip if no value found for this input
            if (value === undefined) {
                 // Uncheck radios if no value found for their group
                 if(input.type === 'radio' && dataToLoad[name] === undefined){
                     input.checked = false;
                 }
                 return;
            }

            // Set value based on type
            if (input.type === 'checkbox') {
                 if (name.endsWith('[]')) { // Checkbox group
                     input.checked = Array.isArray(value) && value.includes(input.value);
                 } else { // Single checkbox
                     input.checked = value === true || value === 'true' || value === 'on';
                 }
             } else if (input.type === 'radio') {
                 input.checked = (input.value === String(value)); // Compare as strings
             } else {
                 input.value = value;
             }
             // Trigger change event AFTER setting value for conditional logic
             input.dispatchEvent(new Event('change', { bubbles: true }));
        });

        console.log(`Section_common: Form population for ${currentSectionKey} complete.`);
        // Re-trigger any conditional checks within this section
         if(typeof triggerInitialConditionalChecksForSection === "function"){
            triggerInitialConditionalChecksForSection(sectionElement);
        }

    }, 300); // Delay population slightly longer
}

// --- Message Handling (Communication with Parent Iframe) ---
window.addEventListener('message', (event) => {
    // IMPORTANT: Verify origin for security in production
    // For now, allow self/parent origin (might need adjustment based on deployment)
    if (event.origin !== window.location.origin && event.origin !== 'null') {
         // A more robust check might be needed if origins differ subtly
         // console.warn(`Section_common (${currentSectionKey}): Ignoring message from unexpected origin: ${event.origin}`);
         // return;
    }

    const { type, payload, sectionName: requestedSectionName } = event.data;
    console.log(`Section_common (${currentSectionKey}): Message received from parent: Type=${type}`);

    if (type === 'GET_SECTION_DATA') {
        // Parent is requesting data from THIS section
        // Check if the request is for this specific section
        if (currentSectionKey && requestedSectionName === currentSectionKey) {
            const sectionData = collectSectionFormData();
            console.log(`Section_common (${currentSectionName}): Sending data response to parent:`, sectionData);
            // Respond TO the specific window that sent the message (the parent)
            event.source.postMessage({
                type: 'SECTION_DATA_RESPONSE',
                payload: sectionData,
                sectionName: currentSectionKey
            }, event.origin); // Respond to the specific origin that sent the request
        } else {
             console.warn(`Section_common (${currentSectionKey}): GET_SECTION_DATA request was for section "${requestedSectionName}", ignoring.`);
        }
    } else if (type === 'LOAD_SECTION_DATA') {
        // Parent is sending data TO THIS section
        console.log(`Section_common (${currentSectionKey}): Received data to load:`, payload);
        populateSectionForm(payload);
    }
});


// --- Initialization on DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', () => {
    console.log(`Section_common: DOMContentLoaded for ${currentSectionKey || 'Unknown Section'}.`);

    // Auto-detect and setup repeatable sections on the current page
    const repeatableSetupSuccess = { // Keep track if setup was needed/attempted
        sibling: false, education: false, employment: false, absence: false,
        passport: false, prev_marriage: false, prev_child: false
    };
    if(currentSectionKey === 'siblings') repeatableSetupSuccess.sibling = setupRepeatable('siblings-container', 'add-sibling', 'sibling-template', 'sibling');
    if(currentSectionKey === 'education') repeatableSetupSuccess.education = setupRepeatable('education-container', 'add-education', 'education-template', 'education');
    if(currentSectionKey === 'employment') repeatableSetupSuccess.employment = setupRepeatable('employment-container', 'add-employment', 'employment-template', 'employment');
    if(currentSectionKey === 'absence') repeatableSetupSuccess.absence = setupRepeatable('absence-container', 'add-absence', 'absence-template', 'absence');
    if(currentSectionKey === 'passports') repeatableSetupSuccess.passport = setupRepeatable('passport-container', 'add-passport', 'passport-template', 'passport');
    if(currentSectionKey === 'prev_marriage') repeatableSetupSuccess.prev_marriage = setupRepeatable('prev-marriage-container', 'add-prev-marriage', 'prev-marriage-template', 'prev_marriage');
    if(currentSectionKey === 'prev_children') repeatableSetupSuccess.prev_child = setupRepeatable('prev-children-container', 'add-prev-child', 'prev-child-template', 'prev_child');


    // Setup Conditional Logic (Specific examples)
    // Define triggerInitialConditionalChecksForSection if used above
    window.triggerInitialConditionalChecksForSection = (containerElement = document) => {
        // NS Check
        const nsApplicableCheckbox = containerElement.querySelector('#ns-applicable');
        const nsDetailsContainer = containerElement.querySelector('#ns-details-container');
        if(nsApplicableCheckbox && nsDetailsContainer) {
            const checkNSVisibility = () => { const shouldShow = nsApplicableCheckbox.checked; nsDetailsContainer.classList.toggle('hidden', !shouldShow); nsDetailsContainer.querySelectorAll('input, select, textarea').forEach(input => { input.required = shouldShow && input.dataset.initiallyRequired === 'true'; }); };
            if(!nsApplicableCheckbox.dataset.listenerAttached) { nsApplicableCheckbox.addEventListener('change', checkNSVisibility); nsApplicableCheckbox.dataset.listenerAttached = 'true'; }
            checkNSVisibility(); // Initial check
        }
        // Prev Marriage Check
        const prevMarriageCheckbox = containerElement.querySelector('#prev-marriage-applicable');
        const prevMarriageContainer = containerElement.querySelector('#prev-marriage-container');
        const addPrevMarriageButton = containerElement.querySelector('#add-prev-marriage');
        const prevChildrenSection = document.getElementById('section-prev-children'); // Note: This element might not be in the *current* iframe/section
        if(prevMarriageCheckbox && prevMarriageContainer && addPrevMarriageButton){ // Check only elements within current scope
            const checkPrevMarriageVisibility = () => { const shouldShow = prevMarriageCheckbox.checked; prevMarriageContainer.classList.toggle('hidden', !shouldShow); addPrevMarriageButton.classList.toggle('hidden', !shouldShow); if(prevChildrenSection) prevChildrenSection.classList.toggle('hidden', !shouldShow); /* ... toggle required ... */ };
             if(!prevMarriageCheckbox.dataset.listenerAttached) { prevMarriageCheckbox.addEventListener('change', checkPrevMarriageVisibility); prevMarriageCheckbox.dataset.listenerAttached = 'true';}
             checkPrevMarriageVisibility();
        }
        // Child Employment Check
        const prevChildrenContainer = containerElement.querySelector('#prev-children-container');
        if(prevChildrenContainer) {
            // Listener should already be attached via DOMContentLoaded block below
            // Trigger initial check for existing items
             prevChildrenContainer.querySelectorAll('input[type="radio"][name^="prev_child"][name$="[employed]"]:checked').forEach(radio => { radio.dispatchEvent(new Event('change', {bubbles: true})); });
        }
    };

    // Initial setup for conditional logic already present
     triggerInitialConditionalChecksForSection(document);

     // Add event listener for child employment toggle (needs to be setup once)
     const prevChildCont = document.getElementById('prev-children-container');
     if(prevChildCont && !prevChildCont.dataset.listenerAttached) {
          prevChildCont.addEventListener('change', (event) => {
              if (event.target.matches('input[type="radio"][name^="prev_child"][name$="[employed]"]')) {
                  const fieldset = event.target.closest('fieldset.repeatable-item'); if (!fieldset) return;
                  const detailsDiv = fieldset.querySelector('div[data-condition*="[employed]"]');
                  if (detailsDiv) {
                      const shouldShow = event.target.checked && event.target.value === 'Yes';
                      detailsDiv.classList.toggle('hidden', !shouldShow);
                      detailsDiv.querySelectorAll('input, textarea').forEach(input => { input.required = shouldShow && input.dataset.initiallyRequired !== 'false'; });
                  }
              }
          });
          prevChildCont.dataset.listenerAttached = 'true'; // Mark listener as attached
      }


    // --- Notify parent that this section's initial setup is done ---
    if (currentSectionKey && window.parent && window.parent !== window) {
        console.log(`Section_common (${currentSectionKey}): Sending SECTION_READY to parent.`);
        window.parent.postMessage({
            type: 'SECTION_READY',
            sectionName: window.location.pathname // Send path for parent to derive key
        }, '*'); // Replace '*' with parent's origin in production
    }

    // Optional: Auto-save on input change
    const formForAutoSave = document.querySelector('form') || document.querySelector('section.form-section');
    if (formForAutoSave && currentSectionKey && window.parent && window.parent !== window) {
        let debounceTimer;
        formForAutoSave.addEventListener('input', (event) => {
            // Only react to user input, not programmatic changes during load
            if (!event.isTrusted) return;

            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                console.log(`Section_common (${currentSectionKey}): Input detected, sending auto-save data to parent.`);
                const sectionData = collectSectionFormData();
                window.parent.postMessage({
                    type: 'SECTION_DATA_CHANGED_AUTOSAVE',
                    payload: sectionData,
                    sectionName: currentSectionKey // Send derived key
                }, '*'); // Target specific origin
            }, 750); // Debounce for 750ms
        });
        console.log(`Section_common (${currentSectionKey}): Auto-save listener attached.`);
    }

}); // End DOMContentLoaded
