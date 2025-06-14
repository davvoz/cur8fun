import { displayResult } from './dialog.js';
import { ApiClient } from '../api/api-client.js';
import { t } from '../i18n/translationService.js';

const apiClient = new ApiClient();

/**
 * Shows the account creation dialog
 */
export function showCreateAccountDialog() {
    const dialog = createAccountDialog();
    document.body.appendChild(dialog);
    dialog.showModal();
}

/**
 * Creates the account creation dialog element
 */
function createAccountDialog() {
    const dialog = document.createElement('dialog');
    dialog.classList.add('dialog', 'create-account-dialog');
    
    dialog.innerHTML = `
        <div class="create-account-container">
            <h2>${t('create_account')}</h2>
            <form id="accountCreationForm">
                <div class="form-group">
                    <label for="newAccountName">${t('account_name')}:</label>
                    <input type="text" id="newAccountName" required 
                           placeholder="${t('enter_account_name')}"
                           pattern="[a-z0-9\\.-]+" 
                           title="${t('account_name_requirements')}"
                           oninput="this.value = this.value.toLowerCase()" />
                </div>
                <div class="buttons-container">
                    <button type="submit" class="action-btn" id="createAccountBtn">${t('create_account')}</button>
                    <button type="button" class="action-btn" id="cancelCreateAccountBtn">${t('dialog_cancel')}</button>
                </div>
            </form>
            
            <div class="loading hide" id="accountCreationLoading">
                <div class="spinner-border"></div>
                <p>${t('creating_account')}</p>
            </div>
            
            <div class="error hide" id="accountCreationError"></div>
            
            <div class="keys-container hide" id="keysContainer">
                <h3>${t('account_created_success')}</h3>
                <p>${t('account_name')}: <code id="createdAccountName"></code></p>
                <div id="keysContent"></div>
                <div class="buttons-container">
                    <button id="downloadPdfBtn" class="action-btn">${t('download_pdf')}</button>
                    <button id="closeAccountDialogBtn" class="action-btn">${t('dialog_close')}</button>
                </div>
            </div>
        </div>
    `;

    // Add event listeners
    const form = dialog.querySelector('#accountCreationForm');
    const cancelBtn = dialog.querySelector('#cancelCreateAccountBtn');
    
    cancelBtn.addEventListener('click', () => {
        dialog.remove();
    });
    
    dialog.addEventListener('close', () => {
        dialog.remove();
    });
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await performAccountCreation(dialog);
    });
    
    // Add close button event listener for the keys container
    const closeBtn = dialog.querySelector('#closeAccountDialogBtn');
    closeBtn.addEventListener('click', () => {
        dialog.remove();
    });
    
    return dialog;
}

/**
 * Performs the actual account creation process
 */
async function performAccountCreation(dialog) {
    const accountName = dialog.querySelector('#newAccountName').value.toLowerCase();
    const loading = dialog.querySelector('#accountCreationLoading');
    const error = dialog.querySelector('#accountCreationError');
    const keysContainer = dialog.querySelector('#keysContainer');
    const form = dialog.querySelector('#accountCreationForm');
    const downloadPdfBtn = dialog.querySelector('#downloadPdfBtn');
    
    error.classList.add('hide');
    keysContainer.classList.add('hide');
    loading.classList.remove('hide');
    
    try {
        // Check if account exists
        const accountExists = await apiClient.checkAccountExists(accountName);
        if (accountExists) {
            throw new Error(t('account_name_exists'));
        }
        
        // Use the ApiClient to create the account
        const result = await apiClient.createAccount(accountName);
        
        if (result && result.keys) {
            // Hide the form after successful creation
            form.classList.add('hide');
            
            const keysContent = dialog.querySelector('#keysContent');
            dialog.querySelector('#createdAccountName').textContent = accountName;
            keysContent.innerHTML = `
                <p>${result.message || ''}</p>
                <p><strong>${t('keys')}:</strong></p>
                <p>${t('active_key')}: <code class="copyable">${result.keys.active_key}</code></p>
                <p>${t('master_key')}: <code class="copyable">${result.keys.master_key}</code></p>
                <p>${t('memo_key')}: <code class="copyable">${result.keys.memo_key}</code></p>
                <p>${t('owner_key')}: <code class="copyable">${result.keys.owner_key}</code></p>
                <p>${t('posting_key')}: <code class="copyable">${result.keys.posting_key}</code></p>
            `;
            keysContainer.classList.remove('hide');
            downloadPdfBtn.classList.remove('hide');
            
            dialog.accountData = {
                accountName: accountName,
                keys: result.keys,
                message: result.message || ''
            };
            
            // Add copy functionality to key codes
            dialog.querySelectorAll('.copyable').forEach(codeElement => {
                codeElement.addEventListener('click', function() {
                    const textToCopy = this.textContent;
                    navigator.clipboard.writeText(textToCopy).then(() => {
                        displayResult({ message: t('copied_to_clipboard') }, 'success');
                    });
                });
                codeElement.title = t('click_to_copy');
                codeElement.style.cursor = 'pointer';
            });
            
            // Add PDF download functionality
            downloadPdfBtn.addEventListener('click', () => {
                downloadAccountPDF(dialog.accountData);
            });
        } else {
            throw new Error(result.error || t('failed_create_account'));
        }
    } catch (err) {
        error.textContent = err.message;
        error.classList.remove('hide');
    } finally {
        loading.classList.add('hide');
    }
}

/**
 * Downloads account information as a PDF
 */
function downloadAccountPDF(accountData) {
    if (!window.jspdf) {
        // Load jsPDF if not already loaded
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload = () => generatePDF(accountData);
        document.body.appendChild(script);
    } else {
        generatePDF(accountData);
    }
}

/**
 * Generates a PDF with account details
 */
function generatePDF(data) {
    try {
        const jsPDF = window.jspdf.jsPDF;
        const doc = new jsPDF();
        
        doc.setFontSize(20);
        doc.text('Steem Account Details', 20, 20);
        
        doc.setFontSize(12);
        doc.text(`Account Name: ${data.accountName}`, 20, 40);
        doc.text('Keys:', 20, 55);
        doc.text(`Active Key: ${data.keys.active_key}`, 20, 70);
        doc.text(`Master Key: ${data.keys.master_key}`, 20, 85);
        doc.text(`Memo Key: ${data.keys.memo_key}`, 20, 100);
        doc.text(`Owner Key: ${data.keys.owner_key}`, 20, 115);
        doc.text(`Posting Key: ${data.keys.posting_key}`, 20, 130);

        // For mobile compatibility, use blob and data URL approach
        const pdfBlob = doc.output('blob');
        const pdfUrl = URL.createObjectURL(pdfBlob);

        // Create a temporary link and trigger download
        const downloadLink = document.createElement('a');
        downloadLink.href = pdfUrl;
        downloadLink.download = `steem-account-${data.accountName}.pdf`;
        downloadLink.style.display = 'none';
        document.body.appendChild(downloadLink);
        downloadLink.click();

        // Clean up
        setTimeout(() => {
            URL.revokeObjectURL(pdfUrl);
            document.body.removeChild(downloadLink);
        }, 100);
        
        displayResult({ message: t('pdf_download_started') }, 'success');
    } catch (error) {
        console.error("PDF generation error:", error);
        displayResult({ error: t('pdf_generation_failed') }, 'error');
        
        // Fallback: offer text information if PDF fails
        offerTextDownload(data);
    }
}

/**
 * Fallback function to offer account details as text if PDF fails
 */
function offerTextDownload(data) {
    const textContent = `
Steem Account Details
====================
Account Name: ${data.accountName}

Keys:
- Active Key: ${data.keys.active_key}
- Master Key: ${data.keys.master_key}
- Memo Key: ${data.keys.memo_key}
- Owner Key: ${data.keys.owner_key}
- Posting Key: ${data.keys.posting_key}
    `;
    
    const textBlob = new Blob([textContent], { type: 'text/plain' });
    const textUrl = URL.createObjectURL(textBlob);
    
    const downloadLink = document.createElement('a');
    downloadLink.href = textUrl;
    downloadLink.download = `steem-account-${data.accountName}.txt`;
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    
    setTimeout(() => {
        URL.revokeObjectURL(textUrl);
        document.body.removeChild(downloadLink);
    }, 100);
}