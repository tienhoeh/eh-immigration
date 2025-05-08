// js/section_common.js

(function() { // Wrap in an IIFE to avoid polluting global scope unnecessarily

    /**
     * Helper function to get current section key from its own path.
     * Derives a key like 'applicant_details' from '/sections/section-applicant-details.html'.
     * @returns {string|null} The derived section key or null.
     */
    function getCurrentSectionKeyFromPath() {
        try {
            const pathname = window.location.pathname;
            if (!pathname) return null;
            const parts = pathname.split('/');
            const fileName = parts.pop() || parts.pop(); // Handle potential trailing slash
            if (fileName && fileName.startsWith('section-') && fileName.endsWith('.html')) {
                return fileName.substring(8, fileName.length - 5).replace(/-/g, '_');
            }
        } catch (e) {
            console.error("Error deriving section key from path:", e);
        }
        // Fallback if path doesn't match expected pattern
        return document.body.dataset.sectionKey || document.body.id || null;
    }

    const currentSectionKey = getCurrentSectionKeyFromPath();
    // Don't log excessively on every section load, only if key is missing
    if (!currentSectionKey) {
        console.warn(`Section_common.js - Could not determine section key for path: ${window.location.pathname}`);
    }

    // =============================================
    // --- Repeatable Sections Setup ---
    // =============================================

    /**
     * Updates UI elements within repeatable items (legends, buttons, names, IDs).
     * @param {HTMLElement} container - The container holding the repeatable items.
     * @param {string} groupName - The data-group identifier.
     */
    function updateRepeatableItemsUI(container, groupName) {
        if (!container) return;
        const items = container.querySelectorAll(`.repeatable-item[data-group="${groupName}"]`);
        items.forEach((item, index) => {
            const itemIndex = index + 1; // 1-based index
            const removeButton = item.querySelector('.remove-item-button');
            if (removeButton) removeButton.classList.toggle('hidden', items.length <= 1 && !item.dataset.canBeEmpty);
            const legend = item.querySelector('legend');
            if (legend) legend.textContent = legend.textContent.replace(/#|\d+/, `${itemIndex}`);
            // Update IDs/Fors based on pattern (e.g., id="groupName-#-fieldName")
            item.querySelectorAll(`[id*="${groupName}-#"], label[for*="${groupName}-#"]`).forEach(el => {
                 const baseAttr = el.id ? 'id' : 'htmlFor';
                 const currentVal = el[baseAttr];
                 // More robust replace ensuring placeholder is part of ID structure
                 if(currentVal && currentVal.includes(`${groupName}-#-`)){
                     el[baseAttr] = currentVal.replace(`#`, `${itemIndex}`);
                 } else if (currentVal && currentVal.includes('#')) { // Fallback simple replace
                      el[baseAttr] = currentVal.replace(/#/g, `${itemIndex}`);
                 }
            });
            // Update names based on pattern name="groupName[#][fieldName]"
            item.querySelectorAll(`[name^="${groupName}[#]"]`).forEach(input => {
                input.name = input.name.replace(/\[#\]/g, `[${itemIndex}]`);
                 // Set required status
                 const isInitiallyRequired = input.dataset.initiallyRequired === 'true';
                 input.required = !input.closest('.hidden') && isInitiallyRequired;
            });
        });
    }

    /**
     * Sets up add/remove functionality for a repeatable section within this iframe page.
     * @param {string} containerId - ID of the items container.
     * @param {string} addButtonId - ID of the 'Add' button.
     * @param {string} templateId - ID of the HTML template.
     * @param {string} groupName - data-group value.
     * @returns {boolean} - True if setup was relevant and attempted.
     */
    function setupRepeatable(containerId, addButtonId, templateId, groupName) {
        const container = document.getElementById(containerId);
        const addButton = document.getElementById(addButtonId);
        const template = document.getElementById(templateId);

        if (!container) return false; // Section not on this page
        if (!addButton || !template) { console.error(`Section_common: Missing Add button (#${addButtonId}) or Template (#${templateId}) for repeatable group "${groupName}" in container #${containerId}.`); return false; }

        console.log(`Section_common: Setting up repeatable for ${groupName}`);

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
                } else { console.warn(`Template ${templateId} missing .remove-item-button`); }

                container.appendChild(newItem);
                updateRepeatableItemsUI(container, groupName); // Update all items

                // Setup conditional visibility within the newly added item
                if(typeof setupConditionalVisibilityForItem === "function"){
                    setupConditionalVisibilityForItem(newItem);
                }
            } catch (error) { console.error(`Section_common: Error adding item for ${groupName}:`, error); }
        });

        // Attach listeners to existing remove buttons
        container.querySelectorAll(`.repeatable-item[data-group="${groupName}"] .remove-item-button`).forEach(button => {
             if (!button.dataset.listenerAttached) {
                 button.addEventListener('click', (e) => {
                     const itemToRemove = e.target.closest('.repeatable-item[data-group="' + groupName + '"]');
                     if(itemToRemove) { itemToRemove.remove(); updateRepeatableItemsUI(container, groupName); }
                 });
                 button.dataset.listenerAttached = 'true';
             }
         });
        updateRepeatableItemsUI(container, groupName); // Initial setup
        return true;
    }

    // =============================================
    // --- Form Data Collection and Population ---
    // =============================================

    /**
     * Collects form data from elements within this section's scope.
     * @returns {object} - The collected data.
     */
    function collectSectionFormData() {
        const sectionElement = document.querySelector(`section#section-${currentSectionKey ? currentSectionKey.replace(/_/g, '-') : ''}`) || document.body;
        if (!sectionElement) { console.error(`Section_common (${currentSectionKey}): Cannot find section element to collect data.`); return {}; }

        const data = {};
        const inputs = sectionElement.querySelectorAll('input:not([type="button"]):not([type="submit"]), select, textarea');

        inputs.forEach(input => {
            const name = input.name;
            if (!name || input.closest('.hidden')) return;

            const repeatableMatch = name.match(/^(\w+)\[(\d+)\]\[(\w+)\]$/);

            if (repeatableMatch) { // Repeatable field
                const groupName = repeatableMatch[1]; const index = parseInt(repeatableMatch[2]) - 1; const fieldName = repeatableMatch[3];
                if (!data[groupName]) data[groupName] = []; while (data[groupName].length <= index) data[groupName].push({}); const currentItem = data[groupName][index];
                if (input.type === 'checkbox') { if (fieldName.endsWith('[]')) { const actualFieldName = fieldName.slice(0,-2); if (!currentItem[actualFieldName]) currentItem[actualFieldName] = []; if (input.checked) currentItem[actualFieldName].push(input.value); } else if (!input.value || input.value.toLowerCase() === 'on') { currentItem[fieldName] = input.checked; } else { if (!currentItem[fieldName]) currentItem[fieldName] = []; if (input.checked) currentItem[fieldName].push(input.value); } }
                else if (input.type === 'radio') { if (input.checked) currentItem[fieldName] = input.value; }
                else { currentItem[fieldName] = input.value; }
            } else { // Non-repeatable
                if (input.type === 'checkbox') { if (name.endsWith('[]')) { const baseName = name.slice(0, -2); if (!data[baseName]) data[baseName] = []; if (input.checked) data[baseName].push(input.value); } else { data[name] = input.checked; } }
                else if (input.type === 'radio') { if (input.checked) data[name] = input.value; }
                else { data[name] = input.value; }
            }
        });
        return data;
    }

    /**
     * Populates form fields within this section from loaded data.
     * @param {object} dataToLoad - Data specific to this section.
     */
    function populateSectionForm(dataToLoad) {
        if (!dataToLoad || typeof dataToLoad !== 'object' || Object.keys(dataToLoad).length === 0) { console.log(`Section_common (${currentSectionKey}): No data provided to populate.`); return; }
        console.log(`Section_common (${currentSectionKey}): Populating form...`);
        const sectionElement = document.querySelector(`section#section-${currentSectionKey ? currentSectionKey.replace(/_/g, '-') : ''}`) || document.body;
        if (!sectionElement) { console.error(`Section_common (${currentSectionKey}): Cannot find section to populate.`); return; }

        // --- Add Repeatable Sections ---
        const repeatableGroups = ['sibling', 'education', 'employment', 'absence', 'passport', 'prev_marriage', 'prev_child'];
        repeatableGroups.forEach(groupName => {
            if (Array.isArray(dataToLoad[groupName])) {
                const itemsInData = dataToLoad[groupName].length;
                const containerId = `${groupName.replace('_', '-')}-container`; const addButtonId = `add-${groupName.replace('_', '-')}`;
                const container = document.getElementById(containerId); const addButton = document.getElementById(addButtonId);
                if (container && addButton && itemsInData > 0) {
                    const existingItems = container.querySelectorAll(`.repeatable-item[data-group="${groupName}"]`).length;
                    const itemsToAdd = itemsInData - existingItems;
                    if (itemsToAdd > 0) { console.log(`Adding ${itemsToAdd} repeatable item(s) for ${groupName}.`); for (let i = 0; i < itemsToAdd; i++) addButton.click(); }
                    updateRepeatableItemsUI(container, groupName);
                }
            }
        });

        // --- Populate Fields (Use timeout) ---
        setTimeout(() => {
            console.log(`Section_common (${currentSectionKey}): Populating fields...`);
            sectionElement.querySelectorAll('input:not([type="button"]):not([type="submit"]), select, textarea').forEach(input => {
                const name = input.name; if (!name) return;
                let value = undefined;
                const repeatableMatch = name.match(/^(\w+)\[(\d+)\]\[(\w+)\]$/);
                try {
                    if (repeatableMatch) { const groupName = repeatableMatch[1]; const index = parseInt(repeatableMatch[2]) - 1; const fieldName = repeatableMatch[3]; if (dataToLoad[groupName]?.[index]?.[fieldName] !== undefined) value = dataToLoad[groupName][index][fieldName]; }
                    else { if (input.type === 'checkbox' && name.endsWith('[]')) value = dataToLoad[name.slice(0, -2)]; else value = dataToLoad[name]; }

                    if (value !== undefined) {
                         if (input.type === 'checkbox') { if (name.endsWith('[]')) input.checked = Array.isArray(value) && value.includes(input.value); else input.checked = value === true || String(value).toLowerCase() === 'true' || String(value).toLowerCase() === 'yes' || String(value).toLowerCase() === 'on'; }
                         else if (input.type === 'radio') { input.checked = (input.value === String(value)); }
                         else input.value = value;
                         input.dispatchEvent(new Event('change', { bubbles: true }));
                    } else { if (input.type === 'radio' && dataToLoad[name] === undefined) input.checked = false; }
                } catch (e) { console.error(`Error populating field ${name}:`, e); }
            });
            console.log(`Section_common (${currentSectionKey}): Population finished. Triggering conditional checks.`);
             if (typeof triggerInitialConditionalChecksForSection === "function") { triggerInitialConditionalChecksForSection(sectionElement); }
        }, 450); // Increased delay
    }

    // =============================================
    // --- Conditional Visibility Setup ---
    // =============================================

    /** Toggles visibility and required attributes */
    function handleVisibility(checkbox, container) {
        if (!checkbox || !container) return;
        const shouldShow = checkbox.checked;
        container.classList.toggle('hidden', !shouldShow);
        container.querySelectorAll('input, select, textarea').forEach(input => {
            const isInitiallyRequired = input.dataset.initiallyRequired === 'true';
            input.required = shouldShow && isInitiallyRequired;
        });
    }

    /** Sets up conditional listeners within a scope */
    function setupConditionalVisibilityForItem(scopeElement = document) {
        console.log(`Section_common (${currentSectionKey}): Setting up conditional visibility for scope...`);
        // --- National Service ---
        const nsApplicableCheckbox = scopeElement.querySelector('#ns-applicable');
        const nsDetailsContainer = scopeElement.querySelector('#ns-details-container');
        if (nsApplicableCheckbox && nsDetailsContainer && !nsApplicableCheckbox.dataset.cvListenerAttached) {
            console.log("Attaching NS listener");
            const checkNSVisibility = () => handleVisibility(nsApplicableCheckbox, nsDetailsContainer);
            nsApplicableCheckbox.addEventListener('change', checkNSVisibility);
            nsApplicableCheckbox.dataset.cvListenerAttached = 'true'; checkNSVisibility();
        }
        // --- Previous Marriage ---
        const prevMarriageCheckbox = scopeElement.querySelector('#prev-marriage-applicable');
        const prevMarriageContainer = scopeElement.querySelector('#prev-marriage-container');
        const addPrevMarriageButton = scopeElement.querySelector('#add-prev-marriage');
        if (prevMarriageCheckbox && prevMarriageContainer && addPrevMarriageButton && !prevMarriageCheckbox.dataset.cvListenerAttached) {
            console.log("Attaching Prev Marriage listener");
            const checkPrevMarriageVisibility = () => {
                const shouldShow = prevMarriageCheckbox.checked;
                handleVisibility(prevMarriageCheckbox, prevMarriageContainer);
                if(addPrevMarriageButton) addPrevMarriageButton.classList.toggle('hidden', !shouldShow);
                // Inform parent to toggle children section
                 if (window.parent && window.parent !== window) window.parent.postMessage({ type: 'TOGGLE_SECTION_VISIBILITY', sectionKey: 'prev_children', show: shouldShow }, '*');
                 // Update required for this container's fields
                 prevMarriageContainer.querySelectorAll('input, select, textarea').forEach(input => { const isReq = input.dataset.initiallyRequired === 'true'; input.required = shouldShow && isReq; });
            };
            prevMarriageCheckbox.addEventListener('change', checkPrevMarriageVisibility);
            prevMarriageCheckbox.dataset.cvListenerAttached = 'true'; checkPrevMarriageVisibility();
        }
        // --- Previous Child Employment ---
        const prevChildrenContainer = scopeElement.id === 'prev-children-container' ? scopeElement : scopeElement.querySelector('#prev-children-container');
        if (prevChildrenContainer && !prevChildrenContainer.dataset.cvListenerAttached) {
             console.log("Attaching Prev Child Employment listener");
            prevChildrenContainer.addEventListener('change', (event) => {
                 if (event.target.matches('input[type="radio"][name^="prev_child"][name$="[employed]"]')) {
                     const fieldset = event.target.closest('fieldset.repeatable-item'); if (!fieldset) return;
                     const detailsDiv = fieldset.querySelector('div[data-condition*="[employed]"]'); if (!detailsDiv) return;
                     const shouldShow = event.target.checked && event.target.value === 'Yes';
                     detailsDiv.classList.toggle('hidden', !shouldShow);
                     detailsDiv.querySelectorAll('input, textarea').forEach(input => { input.required = shouldShow && input.dataset.initiallyRequired !== 'false'; });
                 }
             });
            prevChildrenContainer.dataset.cvListenerAttached = 'true';
             prevChildrenContainer.querySelectorAll('input[type="radio"][name^="prev_child"][name$="[employed]"]:checked').forEach(radio => { radio.dispatchEvent(new Event('change',{bubbles: true})); });
        }
    } // End setupConditionalVisibilityForItem

     // Make trigger function global within this script's scope if needed by populateSectionForm
     window.triggerInitialConditionalChecksForSection = setupConditionalVisibilityForItem;


    // =============================================
    // --- DOMContentLoaded Initializations ---
    // =============================================
    document.addEventListener('DOMContentLoaded', () => {
        console.log(`Section_common: DOMContentLoaded listener executing for ${currentSectionKey}.`);

        // Setup Repeatables
        if (document.getElementById('siblings-container')) setupRepeatable('siblings-container', 'add-sibling', 'sibling-template', 'sibling');
        if (document.getElementById('education-container')) setupRepeatable('education-container', 'add-education', 'education-template', 'education');
        if (document.getElementById('employment-container')) setupRepeatable('employment-container', 'add-employment', 'employment-template', 'employment');
        if (document.getElementById('absence-container')) setupRepeatable('absence-container', 'add-absence', 'absence-template', 'absence');
        if (document.getElementById('passport-container')) setupRepeatable('passport-container', 'add-passport', 'passport-template', 'passport');
        if (document.getElementById('prev-marriage-container')) setupRepeatable('prev-marriage-container', 'add-prev-marriage', 'prev-marriage-template', 'prev_marriage');
        if (document.getElementById('prev-children-container')) setupRepeatable('prev-children-container', 'add-prev-child', 'prev-child-template', 'prev_child');

        // Setup Conditional Logic initially
        setupConditionalVisibilityForItem(document.body);

        // Notify Parent Frame
        if (currentSectionKey && window.parent && window.parent !== window) {
            console.log(`Section_common (${currentSectionKey}): Sending SECTION_READY.`);
            setTimeout(() => { window.parent.postMessage({ type: 'SECTION_READY', sectionName: window.location.pathname }, '*'); }, 150); // Delay slightly more
        }

        // Setup Auto-Save Listener
        const formForAutoSave = document.querySelector('form') || document.querySelector('section.form-section');
        if (formForAutoSave && currentSectionKey && window.parent && window.parent !== window) {
            let debounceTimer;
            formForAutoSave.addEventListener('input', (event) => {
                if (!event.isTrusted) return; // Ignore programmatic changes
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                     if (!currentSectionKey) { console.error("Cannot auto-save, section key missing."); return; }
                    console.log(`Section_common (${currentSectionKey}): Input detected, sending auto-save data.`);
                    const sectionData = collectSectionFormData();
                    window.parent.postMessage({ type: 'SECTION_DATA_CHANGED_AUTOSAVE', payload: sectionData, sectionName: currentSectionKey }, '*');
                }, 1000);
            });
            console.log(`Section_common (${currentSectionKey}): Auto-save listener attached.`);
        }

        console.log(`Section_common: Initial setup complete for ${currentSectionKey || 'Unknown Section'}.`);
    }); // End DOMContentLoaded

})(); // End IIFE
