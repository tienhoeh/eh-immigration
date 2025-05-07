// js/section_common.js
console.log("Section Common Script Loaded for:", window.location.pathname);

// Potential future use: Listen for data requests or initial data from parent
window.addEventListener('message', (event) => {
    // IMPORTANT: Always verify the origin of the message for security
    // if (event.origin !== 'YOUR_EXPECTED_PARENT_ORIGIN') { // e.g., https://your-site-name.netlify.app
    //     console.warn("Ignoring message from unexpected origin:", event.origin);
    //     return;
    // }

    const { type, payload } = event.data;

    if (type === 'GET_SECTION_DATA') {
        console.log("Parent requested section data.");
        const sectionForm = document.querySelector('section'); // Or specific form/div
        if (sectionForm) {
            const formData = new FormData(sectionForm.closest('form') || sectionForm); // Try finding form or use section
            const data = Object.fromEntries(formData.entries());
            console.log("Sending data back to parent:", data);
            window.parent.postMessage({
                type: 'SECTION_DATA_RESPONSE',
                payload: data,
                sectionName: window.location.pathname // Or derive from element ID
            }, '*'); // Use specific origin in production
        }
    } else if (type === 'LOAD_SECTION_DATA') {
         console.log("Parent sent data to load:", payload);
         // TODO: Logic to populate form fields in this section from payload
    }
});

// Optional: Send message to parent when data changes in this section
const sectionForm = document.querySelector('section'); // Adjust selector if needed
if(sectionForm) {
    sectionForm.addEventListener('input', (event) => {
         console.log(`Input change detected in ${window.location.pathname}:`, event.target.name, event.target.value);
         // Debounce this in a real app
         // Send simple notification for now, actual data sent on request
          window.parent.postMessage({ type: 'SECTION_DATA_CHANGED', sectionName: window.location.pathname }, '*'); // Use specific origin
    });
}

 // --- Repeatable Sections Setup (Needed within iframe pages too!) ---
// Helper to update numbering and remove buttons for a specific group
function updateRepeatableItemsUI(container, groupName) { /* ... Copy from main script.js ... */ }
function setupRepeatable(containerId, addButtonId, templateId, groupName) { /* ... Copy from main script.js ... */ }

// Call setup for any repeatable sections *within this specific HTML file*
// Example for section-siblings.html:
if(document.getElementById('siblings-container')) {
    console.log("Setting up repeatable for siblings inside iframe");
    setupRepeatable('siblings-container', 'add-sibling', 'sibling-template', 'sibling');
}
 // Example for section-education.html:
 if(document.getElementById('education-container')) {
    console.log("Setting up repeatable for education inside iframe");
    setupRepeatable('education-container', 'add-education', 'education-template', 'education');
}
 // Add similar calls for employment, absence, passport, prev_marriage, prev_child IF their respective add buttons/templates are within their section HTMLs
