import View from './View.js';
import profileService from '../services/ProfileService.js';
import authService from '../services/AuthService.js';
import activeKeyInput from '../components/auth/ActiveKeyInputComponent.js';
import router from '../utils/Router.js';
import eventEmitter from '../utils/EventEmitter.js';

class EditProfileView extends View {
    constructor(params) {
        super();
        this.params = params || {};
        this.username = this.params.username;
        this.profile = null;
        this.currentUser = authService.getCurrentUser();
    }

    async render(container) {
        this.container = container;

        // Check if the user is logged in
        if (!this.currentUser || this.currentUser.username !== this.username) {
            router.navigate('/login');
            return;
        }

        // Load profile data
        await this.loadProfileData();

        // Render the edit profile form
        this.renderEditProfileForm(container);
    }

    async loadProfileData() {
        this.profile = await profileService.getProfile(this.username);
        if (!this.profile) {
            throw new Error(`Profile not found for @${this.username}`);
        }
        
        // Extract profile images from correct location
        if (this.profile.profile) {
            // If the images are in a nested profile object
            this.profileImage = this.profile.profile.profile_image || this.profile.profile.profileImage;
            this.coverImage = this.profile.profile.cover_image || this.profile.profile.coverImage;
        } else {
            // If the images are directly on the profile object
            this.profileImage = this.profile.profileImage || this.profile.profile_image;
            this.coverImage = this.profile.coverImage || this.profile.cover_image;
        }
    }

    renderEditProfileForm(container) {
        container.innerHTML = '';

        const editProfileContainer = this.createMainContainer();
        const form = this.createProfileForm();

        editProfileContainer.appendChild(form);
        container.appendChild(editProfileContainer);

        this.addFormSubmitListener();
        this.addImagePreviewListeners();
        this.showInitialPreviews();
    }

    createMainContainer() {
        const container = document.createElement('div');
        container.className = 'edit-profile-container';

        const heading = document.createElement('h2');
        heading.textContent = 'Edit Profile';
        container.appendChild(heading);

        return container;
    }

    createProfileForm() {
        const form = document.createElement('form');
        form.id = 'edit-profile-form';
        form.className = 'edit-profile-form';

        // Use the extracted image values instead of accessing from profile directly
        form.appendChild(this.createImageField('profile-image', 'Profile Image', this.profileImage));
        form.appendChild(this.createImageField('cover-image', 'Cover Image', this.coverImage));
        form.appendChild(this.createTextareaField('about', 'About', this.profile.about, 'Tell us about yourself'));
        form.appendChild(this.createTextField('location', 'Location', this.profile.location, 'Your Location'));
        form.appendChild(this.createTextField('website', 'Website', this.profile.website, 'Your Website URL'));
        form.appendChild(this.createSubmitButton());

        return form;
    }

    createImageField(id, labelText, value) {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';

        const label = document.createElement('label');
        label.htmlFor = id;
        label.textContent = labelText;

        const inputGroup = document.createElement('div');
        inputGroup.className = 'image-input-group';

        // Use snake_case field names to match Steem expectations
        const fieldName = id === 'profile-image' ? 'profile_image' : 
                         (id === 'cover-image' ? 'cover_image' : id.replace('-', '_'));
        
        const input = document.createElement('input');
        input.type = 'text';
        input.id = id;
        input.name = fieldName; // Use snake_case field names
        input.value = value || '';
        input.placeholder = `${labelText} URL`;

        const previewBtn = document.createElement('button');
        previewBtn.type = 'button';
        previewBtn.className = 'preview-btn';
        previewBtn.dataset.target = id;
        previewBtn.textContent = 'Preview';
        
        // Add file upload button for profile image and cover image
        if (id === 'profile-image' || id === 'cover-image') {
            const uploadContainer = document.createElement('div');
            uploadContainer.className = 'upload-container';
            
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.id = `${id}-file`;
            fileInput.accept = 'image/*';
            fileInput.className = 'file-input';
            
            const uploadBtn = document.createElement('button');
            uploadBtn.type = 'button';
            uploadBtn.className = 'upload-btn';
            uploadBtn.textContent = 'Upload Image';
            uploadBtn.onclick = () => fileInput.click();
            
            uploadContainer.appendChild(fileInput);
            uploadContainer.appendChild(uploadBtn);
            
            formGroup.appendChild(uploadContainer);
        }

        const preview = document.createElement('div');
        preview.className = id === 'cover-image' ? 'image-preview cover-preview' : 'image-preview';
        preview.id = `${id}-preview`;

        inputGroup.appendChild(input);
        inputGroup.appendChild(previewBtn);
        formGroup.appendChild(label);
        formGroup.appendChild(inputGroup);
        formGroup.appendChild(preview);

        return formGroup;
    }

    createTextField(id, labelText, value, placeholder) {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';

        const label = document.createElement('label');
        label.htmlFor = id;
        label.textContent = labelText;

        const input = document.createElement('input');
        input.type = 'text';
        input.id = id;
        input.name = id;
        input.value = value || '';
        input.placeholder = placeholder;

        formGroup.appendChild(label);
        formGroup.appendChild(input);

        return formGroup;
    }

    createTextareaField(id, labelText, value, placeholder) {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';

        const label = document.createElement('label');
        label.htmlFor = id;
        label.textContent = labelText;

        const textarea = document.createElement('textarea');
        textarea.id = id;
        textarea.name = id;
        textarea.placeholder = placeholder;
        textarea.textContent = value || '';

        formGroup.appendChild(label);
        formGroup.appendChild(textarea);

        return formGroup;
    }

    createSubmitButton() {
        const saveBtn = document.createElement('button');
        saveBtn.type = 'submit';
        saveBtn.className = 'save-btn';
        saveBtn.textContent = 'Save';

        return saveBtn;
    }

    addFormSubmitListener() {
        const form = this.container.querySelector('#edit-profile-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleFormSubmit();
            });
        }
    }

    addImagePreviewListeners() {
        const previewButtons = this.container.querySelectorAll('.preview-btn');
        previewButtons.forEach(btn => {
            btn.addEventListener('click', () => this.showImagePreview(btn.dataset.target));
        });
        
        // Add event listeners for file uploads
        const profileFileInput = this.container.querySelector('#profile-image-file');
        const coverFileInput = this.container.querySelector('#cover-image-file');
        
        if (profileFileInput) {
            profileFileInput.addEventListener('change', (e) => this.handleFileUpload(e, 'profile-image'));
        }
        
        if (coverFileInput) {
            coverFileInput.addEventListener('change', (e) => this.handleFileUpload(e, 'cover-image'));
        }
    }
    
    async handleFileUpload(event, targetField) {
        const fileInput = event.target;
        const file = fileInput.files[0];
        
        if (!file) {
            return;
        }
        
        if (!file.type.startsWith('image/')) {
            eventEmitter.emit('notification', {
                type: 'error',
                message: 'Please select an image file'
            });
            return;
        }
        
        try {
            // Show loading state
            const previewContainer = document.getElementById(`${targetField}-preview`);
            
            if (targetField === 'profile-image') {
                previewContainer.innerHTML = '<p>Uploading image...</p>';
            } else {
                // For cover image, show loading text
                previewContainer.style.backgroundImage = '';
                previewContainer.innerHTML = '<p>Uploading cover image...</p>';
            }
            
            // Import the image upload service
            const imageUploadService = (await import('../services/ImageUploadService.js')).default;
            
            // Upload the image
            const imageUrl = await imageUploadService.uploadImage(file, this.username);
            
            // Update the input field with the new URL
            const imageInput = document.getElementById(targetField);
            if (imageInput && imageUrl) {
                imageInput.value = imageUrl;
                this.showImagePreview(targetField);
            }
        } catch (error) {
            eventEmitter.emit('notification', {
                type: 'error',
                message: `Failed to upload image: ${error.message || 'Unknown error'}`
            });
        }
    }

    showImagePreview(targetId) {
        const inputField = document.getElementById(targetId);
        const previewContainer = document.getElementById(`${targetId}-preview`);

        if (!inputField || !previewContainer) {
            return;
        }

        const imageUrl = inputField.value.trim();
        if (!imageUrl) {
            previewContainer.innerHTML = '<p>Please enter a valid image URL</p>';
            return;
        }

        const processedUrl = this.getProxyImageUrl(imageUrl);

        if (targetId === 'profile-image') {
            const imgElement = document.createElement('img');
            imgElement.src = processedUrl;
            imgElement.alt = "Profile image preview";
            previewContainer.innerHTML = '';
            previewContainer.appendChild(imgElement);
        } else if (targetId === 'cover-image') {
            previewContainer.style.backgroundImage = `url(${processedUrl})`;
        }
    }

    getProxyImageUrl(url) {
        if (url.startsWith('data:') || url.includes('steemitimages.com/0x0/')) {
            return url;
        }
        return `https://steemitimages.com/0x0/${url}`;
    }

    showInitialPreviews() {
        // Use the extracted values
        if (this.profileImage) {
            const inputField = document.getElementById('profile-image');
            if (inputField && !inputField.value) {
                inputField.value = this.profileImage;
            }
            this.showImagePreview('profile-image');
        }

        if (this.coverImage) {
            const inputField = document.getElementById('cover-image');
            if (inputField && !inputField.value) {
                inputField.value = this.coverImage;
            }
            this.showImagePreview('cover-image');
        }
    }

    async handleFormSubmit() {
        const form = this.container.querySelector('#edit-profile-form');
        const formData = new FormData(form);

        // Create proper Steem profile format with snake_case keys
        const updatedProfile = {
            profile_image: formData.get('profile_image'),
            cover_image: formData.get('cover_image'),
            about: formData.get('about'),
            location: formData.get('location'),
            website: formData.get('website')
        };

        try {
            // Show a modal that offers the user two options:
            // 1. Use an active key directly
            // 2. Use Steem Keychain (if available)
            const authChoice = await this.showAuthChoiceModal();
            
            if (authChoice === 'active_key') {
                // User chose to use an active key
                const activeKey = await this.promptForActiveKey();
                if (!activeKey) {
                    eventEmitter.emit('notification', {
                        type: 'warning',
                        message: 'Profile update cancelled. Active key is required.'
                    });
                    return;
                }
                
                // Update profile using the provided key
                await profileService.updateProfile(this.username, updatedProfile, activeKey);
            } 
            else if (authChoice === 'keychain') {
                // User chose to use Steem Keychain
                await profileService.updateProfile(this.username, updatedProfile);
            }
            else {
                // User cancelled
                return;
            }
            
            eventEmitter.emit('notification', {
                type: 'success',
                message: 'Profile updated successfully'
            });
            router.navigate(`/@${this.username}`);
        } catch (error) {
            eventEmitter.emit('notification', {
                type: 'error',
                message: 'Failed to update profile: ' + (error.message || 'Unknown error')
            });
        }
    }
    
    async showAuthChoiceModal() {
        return new Promise((resolve) => {
            const isKeychainAvailable = typeof window !== 'undefined' && window.steem_keychain;
            
            // Create modal HTML directly
            const modalHTML = `
                <div class="auth-modal-overlay" id="authModalOverlay">
                    <div class="auth-modal-content">
                        <h3 class="auth-modal-header">Choose Authentication Method</h3>
                        <p>
                            <strong>Updating your profile requires Active authority.</strong>
                            <br><br>
                            Please select how you want to authenticate this operation:
                        </p>
                        <div class="auth-options">
                            <div class="auth-option">
                                <h4>Use Active Key</h4>
                                <p>Enter your active private key to sign this transaction directly.</p>
                                <p>⚠️ Your key will only be used to sign this transaction and will not be stored.</p>
                                <button class="auth-btn auth-btn-primary" id="activeKeyBtn">Use Active Key</button>
                            </div>
                            ${isKeychainAvailable ? `
                                <div class="auth-option">
                                    <h4>Use Steem Keychain</h4>
                                    <p>Sign the transaction securely using the Steem Keychain browser extension.</p>
                                    <button class="auth-btn auth-btn-blue" id="keychainBtn">Use Keychain</button>
                                </div>
                            ` : `
                                <div class="auth-option">
                                    <h4>Steem Keychain Not Available</h4>
                                    <p>Steem Keychain extension is not detected in your browser.</p>
                                    <a href="https://github.com/steem-monsters/steem-keychain" target="_blank">Get Steem Keychain</a>
                                </div>
                            `}
                        </div>
                        <div class="auth-modal-footer">
                            <button class="auth-btn auth-btn-secondary" id="cancelAuthBtn">Cancel</button>
                        </div>
                    </div>
                </div>
            `;
            
            // Insert modal into DOM
            const modalContainer = document.createElement('div');
            modalContainer.innerHTML = modalHTML;
            document.body.appendChild(modalContainer.firstElementChild);
            
            // Get references to buttons after they're in the DOM
            const modal = document.getElementById('authModalOverlay');
            const activeKeyBtn = document.getElementById('activeKeyBtn');
            const keychainBtn = document.getElementById('keychainBtn');
            const cancelBtn = document.getElementById('cancelAuthBtn');
            
            // Add event listeners
            const cleanup = () => {
                if (modal && document.body.contains(modal)) {
                    document.body.removeChild(modal);
                }
            };
            
            if (activeKeyBtn) {
                activeKeyBtn.addEventListener('click', () => {
                    cleanup();
                    resolve('active_key');
                });
            }
            
            if (keychainBtn && isKeychainAvailable) {
                keychainBtn.addEventListener('click', () => {
                    cleanup();
                    resolve('keychain');
                });
            }
            
            if (cancelBtn) {
                cancelBtn.addEventListener('click', () => {
                    cleanup();
                    resolve(null);
                });
            }
        });
    }
    
    async showActiveKeyWarning() {
        return new Promise((resolve) => {
            // Create modal for the warning
            const modalContainer = document.createElement('div');
            modalContainer.className = 'modal-container';
            
            const modalContent = document.createElement('div');
            modalContent.className = 'modal-content';
            
            const header = document.createElement('h3');
            header.className = 'modal-header';
            header.textContent = 'Active Key Required';
            
            const message = document.createElement('p');
            message.className = 'modal-body';
            message.innerHTML = `
                <div class="banner banner-warning">
                    <span class="banner-icon">⚠️</span>
                    <div class="banner-content">
                        <strong>Security Notice:</strong> Editing your profile requires your Active key. 
                        This is a higher permission level than Posting key.
                    </div>
                </div>
                <p>Since Steem Keychain is not detected, you'll need to enter your Active key manually.</p>
                <p class="security-tip">Only enter your Active key on trusted websites and be cautious about potential phishing attempts.</p>
            `;
            
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'modal-footer';
            
            const cancelButton = document.createElement('button');
            cancelButton.className = 'modal-btn modal-btn-secondary';
            cancelButton.textContent = 'Cancel';
            
            const continueButton = document.createElement('button');
            continueButton.className = 'modal-btn modal-btn-primary';
            continueButton.textContent = 'Continue';
            
            buttonContainer.appendChild(cancelButton);
            buttonContainer.appendChild(continueButton);
            
            modalContent.appendChild(header);
            modalContent.appendChild(message);
            modalContent.appendChild(buttonContainer);
            
            modalContainer.appendChild(modalContent);
            document.body.appendChild(modalContainer);
            
            // Event listeners
            cancelButton.onclick = () => {
                document.body.removeChild(modalContainer);
                resolve(false);
            };
            
            continueButton.onclick = () => {
                document.body.removeChild(modalContainer);
                resolve(true);
            };
        });
    }
    
    async promptForActiveKey() {
        // Utilizzo il componente centralizzato
        return activeKeyInput.promptForActiveKey('Enter Active Key');
    }
}

export default EditProfileView;
