import View from './View.js';
import profileService from '../services/ProfileService.js';
import authService from '../services/AuthService.js';
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

        form.appendChild(this.createImageField('profile-image', 'Profile Image', this.profile.profileImage));
        form.appendChild(this.createImageField('cover-image', 'Cover Image', this.profile.coverImage));
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

        const input = document.createElement('input');
        input.type = 'text';
        input.id = id;
        input.name = id.replace('-', '');
        input.value = value || '';
        input.placeholder = `${labelText} URL`;

        const previewBtn = document.createElement('button');
        previewBtn.type = 'button';
        previewBtn.className = 'preview-btn';
        previewBtn.dataset.target = id;
        previewBtn.textContent = 'Preview';

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
            previewContainer.innerHTML = `<img src="${processedUrl}" alt="Profile image preview">`;
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
        if (this.profile.profileImage) {
            this.showImagePreview('profile-image');
        }

        if (this.profile.coverImage) {
            this.showImagePreview('cover-image');
        }
    }

    async handleFormSubmit() {
        const form = this.container.querySelector('#edit-profile-form');
        const formData = new FormData(form);

        const updatedProfile = {
            profileImage: formData.get('profileImage'),
            coverImage: formData.get('coverImage'),
            about: formData.get('about'),
            location: formData.get('location'),
            website: formData.get('website')
        };

        try {
            await profileService.updateProfile(this.username, updatedProfile);
            eventEmitter.emit('notification', {
                type: 'success',
                message: 'Profile updated successfully'
            });
            router.navigate(`/@${this.username}`);
        } catch (error) {
            console.error('Error updating profile:', error);
            eventEmitter.emit('notification', {
                type: 'error',
                message: 'Failed to update profile'
            });
        }
    }
}

export default EditProfileView;
