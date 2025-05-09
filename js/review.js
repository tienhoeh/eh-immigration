// js/review.js

// Helper function to get current section key from its own path
function getCurrentSectionKeyFromPath() {
    // For review.js, this isn't strictly needed for its *own* data,
    // but good to have if it follows the same pattern for consistency
    try {
        const pathname = window.location.pathname;
        if (!pathname) return null;
        const match = pathname.match(/section-([a-zA-Z0-9_-]+)(\.html)?$/);
        if (match && match[1]) { return match[1].replace(/-/g, '_'); }
    } catch (e) { console.error("Error deriving section name:", e); }
    return 'review'; // Default key for this page
}

const currentSectionKey = getCurrentSectionKeyFromPath();
let fullConsolidatedData = null; // To store the received data

document.addEventListener('DOMContentLoaded', () => {
    console.log(`Review.js - DOMContentLoaded for ${currentSectionKey}.`);

    const reviewContentDiv = document.getElementById('review-content');
    const loadingReviewEl = document.getElementById('loading-review');
    const errorReviewEl = document.getElementById('error-review');
    const finalDeclarationCheckbox = document.getElementById('final-declaration');
    const finalSubmitButton = document.getElementById('final-submit-button');
    const submitStatusElement = document.getElementById('submit-status');

    // --- Request Full Data from Parent ---
    if (window.parent && window.parent !== window) {
        console.log("Review.js - Requesting GET_FULL_DRAFT_DATA from parent.");
        window.parent.postMessage({ type: 'GET_FULL_DRAFT_DATA' }, '*'); // Use specific origin in production
    } else {
        showError("Cannot communicate with the main application frame.");
        if(finalSubmitButton) finalSubmitButton.disabled = true;
    }

    // --- Message Listener for Data from Parent ---
    window.addEventListener('message', (event) => {
        // IMPORTANT: Add strict origin check for production
        // if (event.origin !== window.location.origin_of_parent) return;

        const { type, payload } = event.data;
        console.log("Review.js - Message received from parent:", type);

        if (type === 'FULL_DRAFT_DATA_RESPONSE') {
            if (loadingReviewEl) loadingReviewEl.style.display = 'none';
            if (!payload || Object.keys(payload).length === 0) {
                showError("No data received or draft is empty. Please fill out the questionnaire.");
                if(finalSubmitButton) finalSubmitButton.disabled = true;
                return;
            }
            fullConsolidatedData = payload; // Store the data
            console.log("Review.js - Received full draft data:", fullConsolidatedData);
            renderReviewData(fullConsolidatedData);
            // Enable submit button only if declaration is also checked (handled by listener)
            if(finalDeclarationCheckbox) finalDeclarationCheckbox.dispatchEvent(new Event('change'));

        } else if (type === 'SUBMISSION_SUCCESS') {
            if(submitStatusElement) {
                submitStatusElement.textContent = 'Application submitted successfully!';
                submitStatusElement.style.color = 'green';
            }
            if(finalSubmitButton) finalSubmitButton.disabled = true; // Prevent re-submission
            if(finalSubmitButton) finalSubmitButton.textContent = 'Submitted';

        } else if (type === 'SUBMISSION_ERROR') {
            if(submitStatusElement) {
                submitStatusElement.textContent = `Error submitting: ${payload.message || 'Unknown error'}`;
                submitStatusElement.style.color = 'red';
            }
            if(finalSubmitButton) finalSubmitButton.disabled = false; // Allow retry
            if(finalSubmitButton) finalSubmitButton.textContent = 'Submit Application';
        }
    });

    // --- Render Data ---
    function renderReviewData(data) {
        if (!reviewContentDiv) return;
        reviewContentDiv.innerHTML = ''; // Clear loading/error messages

        // Define display order and friendly names
        const sectionOrder = [
            { key: 'applicant_details', title: 'Applicant Details' },
            { key: 'parents', title: "Parent's Information" },
            { key: 'sibling', title: "Sibling's Information", isArray: true },
            { key: 'education', title: 'Education History', isArray: true },
            { key: 'employment', title: 'Employment History', isArray: true },
            { key: 'absence', title: 'Absence From Singapore', isArray: true },
            { key: 'passports', title: 'Travel Documents (Passports)', isArray: true },
            { key: 'ns', title: 'National Service Details' },
            { key: 'prev_marriage', title: 'Previous Marriage Information', isArray: true },
            { key: 'prev_child', title: 'Children from Previous Marriages', isArray: true }
        ];

        // Field labels mapping (optional, for more user-friendly labels)
        const fieldLabels = {
            applicant_name: "Full Name (as per passport)",
            applicant_race_religion: "Race & Religion",
            spouse_name: "Spouse's Name", // Example
            // Add more mappings as needed, especially for complex field names
            ns_applicable: "National Service Applicable",
            ns_organization: "NS Organization",
            // ... etc.
        };

        sectionOrder.forEach(sectionInfo => {
            const sectionData = data[sectionInfo.key];
            if (!sectionData) {
                // Optionally display a message if a section has no data
                // console.log(`No data for section: ${sectionInfo.title}`);
                return;
            }

            const sectionDiv = document.createElement('div');
            sectionDiv.innerHTML = `<h3>${sectionInfo.title}</h3>`;

            if (sectionInfo.isArray && Array.isArray(sectionData)) {
                if (sectionData.length === 0) {
                    sectionDiv.innerHTML += `<p><em>No entries for this section.</em></p>`;
                }
                sectionData.forEach((item, index) => {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'repeatable-item-review';
                    itemDiv.innerHTML = `<legend>${sectionInfo.title.replace("'s Information", "")} ${index + 1}</legend>`;
                    const dl = document.createElement('dl');
                    for (const fieldKey in item) {
                        if (Object.hasOwnProperty.call(item, fieldKey)) {
                            const dt = document.createElement('dt');
                            dt.textContent = fieldLabels[fieldKey] || formatFieldKey(fieldKey);
                            const dd = document.createElement('dd');
                            dd.textContent = formatValue(item[fieldKey]);
                            dl.appendChild(dt);
                            dl.appendChild(dd);
                        }
                    }
                    itemDiv.appendChild(dl);
                    sectionDiv.appendChild(itemDiv);
                });
            } else if (typeof sectionData === 'object') { // For single objects like applicant_details, ns
                const dl = document.createElement('dl');
                for (const fieldKey in sectionData) {
                    if (Object.hasOwnProperty.call(sectionData, fieldKey)) {
                        const dt = document.createElement('dt');
                        dt.textContent = fieldLabels[`${sectionInfo.key}_${fieldKey}`] || fieldLabels[fieldKey] || formatFieldKey(fieldKey);
                        const dd = document.createElement('dd');
                        dd.textContent = formatValue(sectionData[fieldKey]);
                        dl.appendChild(dt);
                        dl.appendChild(dd);
                    }
                }
                sectionDiv.appendChild(dl);
            }
            reviewContentDiv.appendChild(sectionDiv);
            reviewContentDiv.appendChild(document.createElement('hr')); // Separator
        });
    }

    function formatFieldKey(key) {
        // Simple formatter: replace underscores with spaces, capitalize words
        return key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
    }

    function formatValue(value) {
        if (typeof value === 'boolean') {
            return value ? 'Yes' : 'No';
        }
        if (Array.isArray(value)) {
            return value.join(', ') || 'N/A';
        }
        return value || 'N/A'; // Display 'N/A' for empty/null/undefined values
    }

    function showError(message) {
        if (loadingReviewEl) loadingReviewEl.style.display = 'none';
        if (errorReviewEl) {
            errorReviewEl.textContent = message;
            errorReviewEl.classList.remove('hidden');
        }
    }

    // --- Submit Button Logic ---
    if (finalSubmitButton && finalDeclarationCheckbox) {
        const toggleSubmitButton = () => {
            finalSubmitButton.disabled = !finalDeclarationCheckbox.checked || !fullConsolidatedData;
        };

        finalDeclarationCheckbox.addEventListener('change', toggleSubmitButton);
        toggleSubmitButton(); // Initial state

        finalSubmitButton.addEventListener('click', async () => {
            if (!finalDeclarationCheckbox.checked) {
                alert("Please confirm the declaration before submitting.");
                return;
            }
            if (!fullConsolidatedData) {
                alert("Data is not loaded yet. Cannot submit.");
                return;
            }

            console.log("Review.js - Final Submit button clicked.");
            finalSubmitButton.disabled = true;
            finalSubmitButton.textContent = 'Submitting...';
            if(submitStatusElement) {
                submitStatusElement.textContent = 'Processing submission...';
                submitStatusElement.style.color = 'orange';
                submitStatusElement.classList.remove('hidden');
            }

            // --- Placeholder for actual submission logic ---
            // In a real app, this would send `fullConsolidatedData` to a backend/Netlify Function
            console.log("Submitting the following data:", JSON.stringify(fullConsolidatedData, null, 2));

            // Example of posting to a Netlify function:
            try {
                const response = await fetch('/.netlify/functions/submit-application', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(fullConsolidatedData)
                });

                if (response.ok) {
                    const result = await response.json();
                    console.log("Submission successful:", result);
                    if(submitStatusElement) {
                        submitStatusElement.textContent = result.message || 'Application submitted successfully!';
                        submitStatusElement.style.color = 'green';
                    }
                    // Disable button permanently or redirect
                    finalSubmitButton.textContent = 'Submitted';
                     // Optionally clear the draft from parent
                     if (window.parent && window.parent !== window) {
                         window.parent.postMessage({ type: 'CLEAR_DRAFT_AFTER_SUBMIT' }, '*');
                     }

                } else {
                    const errorResult = await response.json();
                    console.error("Submission failed:", response.status, errorResult);
                    showError(`Submission failed: ${errorResult.message || response.statusText}`);
                    if(submitStatusElement) {
                        submitStatusElement.textContent = `Submission error: ${errorResult.message || response.statusText}`;
                        submitStatusElement.style.color = 'red';
                    }
                    finalSubmitButton.disabled = false;
                    finalSubmitButton.textContent = 'Submit Application';
                }
            } catch (error) {
                console.error("Network error during submission:", error);
                showError(`Submission network error: ${error.message}`);
                if(submitStatusElement) {
                    submitStatusElement.textContent = `Network error: ${error.message}`;
                    submitStatusElement.style.color = 'red';
                }
                finalSubmitButton.disabled = false;
                finalSubmitButton.textContent = 'Submit Application';
            }
        });
    } else {
        console.error("Submit button or declaration checkbox not found.");
    }

    console.log(`Review.js - Initial setup complete for ${currentSectionKey}.`);

}); // End DOMContentLoaded
