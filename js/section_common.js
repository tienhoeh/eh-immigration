// js/section_common.js
console.log("Section Common Script Loaded for:", window.location.pathname);

// --- Repeatable Sections Setup (Needed within iframe pages) ---
// Helper to update numbering and remove buttons for a specific group
function updateRepeatableItemsUI(container, groupName) {
    if (!container) return;
    const items = container.querySelectorAll(`.repeatable-item[data-group="${groupName}"]`);
    items.forEach((item, index) => {
        const removeButton = item.querySelector('.remove-item-button');
        if (removeButton) { removeButton.classList.toggle('hidden', items.length <= 1 && !item.dataset.canBeEmpty); }
        const legend = item.querySelector('legend');
        if (legend) { legend.textContent = legend.textContent.replace(/#|\d+/, `${index + 1}`); }
        // Update IDs/Fors using placeholder (e.g., name="sibling[#][name]")
        item.querySelectorAll(`[id*="#"], label[for*="#"]`).forEach(el => {
            if (el.id) el.id = el.id.replace(/#/, `${index + 1}`); // Simple replace for first #
            if (el.htmlFor) el.htmlFor = el.htmlFor.replace(/#/, `${index + 1}`);
        });
        item.querySelectorAll(`[name*="[#]"]`).forEach(input => {
            input.name = input.name.replace('[#]', `[${index + 1}]`);
        });
    });
}

function setupRepeatable(containerId, addButtonId, templateId, groupName) {
    const container = document.getElementById(containerId);
    const addButton = document.getElementById(addButtonId);
    const template = document.getElementById(templateId);
    if (!container || !addButton || !template) {
        console.warn(`Setup failed for repeatable section (in section_common): Missing elements for ${groupName} (Container: ${containerId}, Button: ${addButtonId}, Template: ${templateId})`);
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

        // Trigger conditional checks within the newly added item if needed
        newItem.querySelectorAll('input[type="radio"], input[type="checkbox"]').forEach(input => {
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
    });

    container.querySelectorAll(`.repeatable-item[data-group="${groupName}"] .remove-item-button`).forEach(button => {
         if (!button.dataset.listenerAttached) {
             button.addEventListener('click', (e) => { e.target.closest('.repeatable-item').remove(); updateRepeatableItemsUI(container, groupName); });
             button.dataset.listenerAttached = 'true';
         }
     });
    updateRepeatableItemsUI(container, groupName); // Initial setup
}

// Auto-detect and setup repeatable sections on the current page (iframe content)
document.addEventListener('DOMContentLoaded', () => {
    console.log("section_common.js: DOMContentLoaded");
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

    // Conditional Logic setup (if any within a specific section)
    // Example for prev_child employment toggle
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
                     detailsDiv.querySelectorAll('input, textarea').forEach(input => {
                         // Only make required if initially marked and now visible
                         input.required = shouldShow && input.dataset.initiallyRequired !== 'false';
                     });
                 }
             }
         });
         // Trigger initial check for already loaded items
         prevChildrenContainer.querySelectorAll('input[type="radio"][name^="prev_child"][name$="[employed]"]:checked').forEach(radio => {
            radio.dispatchEvent(new Event('change', {bubbles: true}));
         });
     }

    // National Service conditional logic (if ns-applicable is in this section file)
    const nsApplicableCheckbox = document.getElementById('ns-applicable');
    const nsDetailsContainer = document.getElementById('ns-details-container');
    if(nsApplicableCheckbox && nsDetailsContainer) {
        const checkNSVisibility = () => {
            const shouldShow = nsApplicableCheckbox.checked;
            nsDetailsContainer.classList.toggle('hidden', !shouldShow);
            nsDetailsContainer.querySelectorAll('input, select, textarea').forEach(input => {
                 const isInitiallyRequired = input.dataset.initiallyRequired === 'true';
                 input.required = shouldShow && isInitiallyRequired;
            });
        };
        nsApplicableCheckbox.addEventListener('change', checkNSVisibility);
        checkNSVisibility(); // Initial check
    }
     // Previous Marriage conditional logic
     const prevMarriageCheckbox = document.getElementById('prev-marriage-applicable');
     const prevMarriageContainer = document.getElementById('prev-marriage-container');
     const addPrevMarriageButton = document.getElementById('add-prev-marriage');
     const prevChildrenSection = document.getElementById('section-prev-children'); // Assuming this section visibility is also tied

     if(prevMarriageCheckbox && prevMarriageContainer && addPrevMarriageButton && prevChildrenSection){
         const checkPrevMarriageVisibility = () => {
             const shouldShow = prevMarriageCheckbox.checked;
             prevMarriageContainer.classList.toggle('hidden', !shouldShow);
             addPrevMarriageButton.classList.toggle('hidden', !shouldShow);
             prevChildrenSection.classList.toggle('hidden', !shouldShow); // Toggle children section too

             const elementsToToggleRequired = [prevMarriageContainer, prevChildrenSection];
             elementsToToggleRequired.forEach(container => {
                 container.querySelectorAll('input, select, textarea').forEach(input => {
                     const isInitiallyRequired = input.dataset.initiallyRequired === 'true';
                     input.required = shouldShow && isInitiallyRequired;
                 });
             });
         };
         prevMarriageCheckbox.addEventListener('change', checkPrevMarriageVisibility);
         checkPrevMarriageVisibility(); // Initial Check
     }
});

// TODO: Add postMessage logic for sending data TO parent (questionnaire.html)
// and receiving data FROM parent (e.g., for populating from a draft).
