import View from './View.js';
import profileService from '../services/ProfileService.js';
import authService from '../services/AuthService.js';
import router from '../utils/Router.js';
import eventEmitter from '../utils/EventEmitter.js';
import { proxifyImage } from '../utils/ImageUtils.js';

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

        this.displayName = this.profile.displayName || this.profile.rawData?.profile?.name || '';
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

        const header = document.createElement('div');
        header.className = 'edit-profile-header';

        const heading = document.createElement('h2');
        heading.className = 'edit-profile-title';
        heading.textContent = 'Edit Profile';

        const subtitle = document.createElement('p');
        subtitle.className = 'edit-profile-subtitle';
        subtitle.textContent = 'Update your avatar, cover, and profile details. Changes are applied on-chain.';

        header.appendChild(heading);
        header.appendChild(subtitle);
        container.appendChild(header);

        return container;
    }

    createProfileForm() {
        const form = document.createElement('form');
        form.id = 'edit-profile-form';
        form.className = 'edit-profile-form';

        const mediaSection = document.createElement('section');
        mediaSection.className = 'ep-section ep-section-media';
        mediaSection.appendChild(this.createSectionHeader('Images', 'Avatar and cover shown on your profile and posts.'));

        const mediaGrid = document.createElement('div');
        mediaGrid.className = 'ep-media-grid';
        mediaGrid.appendChild(this.createImageField('profile-image', 'Profile Image', this.profileImage));
        mediaGrid.appendChild(this.createImageField('cover-image', 'Cover Image', this.coverImage));
        mediaSection.appendChild(mediaGrid);

        const profileSection = document.createElement('section');
        profileSection.className = 'ep-section ep-section-details';
        profileSection.appendChild(this.createSectionHeader('Profile Details', 'Tell people who you are and where to find you.'));

        const detailsGrid = document.createElement('div');
        detailsGrid.className = 'ep-details-grid';
        detailsGrid.appendChild(this.createTextField('display-name', 'Display Name', this.displayName, 'Name shown on your profile'));
        detailsGrid.appendChild(this.createTextareaField('about', 'About', this.profile.about, 'Tell us about yourself'));
        detailsGrid.appendChild(this.createTextField('location', 'Location', this.profile.location, 'Your location'));
        detailsGrid.appendChild(this.createTextField('website', 'Website', this.profile.website, 'https://your-site.com'));
        profileSection.appendChild(detailsGrid);

        const actions = document.createElement('div');
        actions.className = 'ep-actions';
        actions.appendChild(this.createSubmitButton());

        form.appendChild(mediaSection);
        form.appendChild(profileSection);
        form.appendChild(actions);

        return form;
    }

    createSectionHeader(title, description) {
        const wrapper = document.createElement('div');
        wrapper.className = 'ep-section-header';

        const heading = document.createElement('h3');
        heading.className = 'ep-section-title';
        heading.textContent = title;

        const text = document.createElement('p');
        text.className = 'ep-section-description';
        text.textContent = description;

        wrapper.appendChild(heading);
        wrapper.appendChild(text);

        return wrapper;
    }

    createImageField(id, labelText, value) {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group ep-media-card';

        const fieldHeader = document.createElement('div');
        fieldHeader.className = 'ep-field-header';

        const label = document.createElement('label');
        label.htmlFor = id;
        label.className = 'ep-label';
        label.textContent = labelText;

        const helper = document.createElement('span');
        helper.className = 'ep-helper';
        helper.textContent = 'Paste URL or upload a file';

        fieldHeader.appendChild(label);
        fieldHeader.appendChild(helper);

        const inputGroup = document.createElement('div');
        inputGroup.className = 'image-input-group ep-input-inline';

        // Use snake_case field names to match Steem expectations
        const fieldName = id === 'profile-image' ? 'profile_image' : 
                         (id === 'cover-image' ? 'cover_image' : id.replace('-', '_'));
        
        const input = document.createElement('input');
        input.type = 'text';
        input.id = id;
        input.name = fieldName; // Use snake_case field names
        input.className = 'ep-input';
        input.value = value || '';
        input.placeholder = `${labelText} URL`;
        
        let uploadContainer = null;
        // Add file upload button for profile image and cover image
        if (id === 'profile-image' || id === 'cover-image') {
            uploadContainer = document.createElement('div');
            uploadContainer.className = 'upload-container ep-upload-container';
            
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
        }

        const preview = document.createElement('div');
        preview.className = id === 'cover-image' ? 'image-preview cover-preview' : 'image-preview profile-preview';
        preview.id = `${id}-preview`;

        const emptyState = document.createElement('p');
        emptyState.className = 'ep-preview-placeholder';
        emptyState.textContent = id === 'cover-image' ? 'Cover preview' : 'Avatar preview';
        preview.appendChild(emptyState);

        inputGroup.appendChild(input);
        formGroup.appendChild(fieldHeader);
        formGroup.appendChild(inputGroup);
        if (uploadContainer) {
            formGroup.appendChild(uploadContainer);
        }
        formGroup.appendChild(preview);

        return formGroup;
    }

    createTextField(id, labelText, value, placeholder) {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group ep-field';

        const label = document.createElement('label');
        label.htmlFor = id;
        label.className = 'ep-label';
        label.textContent = labelText;

        const input = document.createElement('input');
        input.type = 'text';
        input.id = id;
        input.name = id;
        input.className = 'ep-input';
        input.value = value || '';
        input.placeholder = placeholder;

        formGroup.appendChild(label);
        formGroup.appendChild(input);

        return formGroup;
    }

    createTextareaField(id, labelText, value, placeholder) {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group ep-field ep-field-about';

        const label = document.createElement('label');
        label.htmlFor = id;
        label.className = 'ep-label';
        label.textContent = labelText;

        const textarea = document.createElement('textarea');
        textarea.id = id;
        textarea.name = id;
        textarea.className = 'ep-input ep-textarea';
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
        saveBtn.textContent = 'Save Changes';

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
        const profileImageInput = this.container.querySelector('#profile-image');
        const coverImageInput = this.container.querySelector('#cover-image');

        if (profileImageInput) {
            profileImageInput.addEventListener('input', () => this.showImagePreview('profile-image'));
        }

        if (coverImageInput) {
            coverImageInput.addEventListener('input', () => this.showImagePreview('cover-image'));
        }
        
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
        if (!url || url.startsWith('data:')) return url;
        return proxifyImage(url, 640);
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

    setSavingState(isSaving) {
        const saveBtn = this.container?.querySelector('.save-btn');
        if (!saveBtn) return;

        saveBtn.disabled = isSaving;
        saveBtn.classList.toggle('is-saving', isSaving);
        saveBtn.setAttribute('aria-busy', isSaving ? 'true' : 'false');
        saveBtn.textContent = isSaving ? 'Saving...' : 'Save Changes';
    }

    async handleFormSubmit() {
        const form = this.container.querySelector('#edit-profile-form');
        const formData = new FormData(form);

        // Create proper Steem profile format with snake_case keys
        const updatedProfile = {
            name: (formData.get('display-name') || '').trim(),
            profile_image: formData.get('profile_image'),
            cover_image: formData.get('cover_image'),
            about: formData.get('about'),
            location: formData.get('location'),
            website: formData.get('website')
        };

        this.setSavingState(true);
        try {
            const loginMethod = this.currentUser?.loginMethod;

            // Automatic auth routing (no choice modal):
            // - keychain login  -> keychain signing
            // - privateKey login -> wallet-style active-key + PIN flow
            if (loginMethod === 'keychain') {
                await profileService.updateProfile(this.username, updatedProfile);
            } else {
                await profileService.updateProfile(this.username, updatedProfile);
            }

            // After a successful save, update the in-memory/localStorage avatar so the
            // navbar and other places that rely on user.avatar reflect the change immediately
            // without waiting for the steemitimages CDN to invalidate.
            if (updatedProfile.profile_image) {
                authService.updateAvatar(updatedProfile.profile_image);
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
        } finally {
            this.setSavingState(false);
        }
    }
}

export default EditProfileView;
