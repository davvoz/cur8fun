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
    container.innerHTML = `
      <div class="edit-profile-container">
        <h2>Edit Profile</h2>
        <form id="edit-profile-form" class="edit-profile-form">
          <div class="form-group">
            <label for="profile-image">Profile Image</label>
            <div class="image-input-group">
              <input type="text" id="profile-image" name="profileImage" value="${this.profile.profileImage || ''}" placeholder="Profile Image URL">
              <button type="button" class="preview-btn" data-target="profile-image">Preview</button>
            </div>
            <div class="image-preview" id="profile-image-preview"></div>
          </div>
          <div class="form-group">
            <label for="cover-image">Cover Image</label>
            <div class="image-input-group">
              <input type="text" id="cover-image" name="coverImage" value="${this.profile.coverImage || ''}" placeholder="Cover Image URL">
              <button type="button" class="preview-btn" data-target="cover-image">Preview</button>
            </div>
            <div class="image-preview cover-preview" id="cover-image-preview"></div>
          </div>
          <div class="form-group">
            <label for="about">About</label>
            <textarea id="about" name="about" placeholder="Tell us about yourself">${this.profile.about || ''}</textarea>
          </div>
          <div class="form-group">
            <label for="location">Location</label>
            <input type="text" id="location" name="location" value="${this.profile.location || ''}" placeholder="Your Location">
          </div>
          <div class="form-group">
            <label for="website">Website</label>
            <input type="text" id="website" name="website" value="${this.profile.website || ''}" placeholder="Your Website URL">
          </div>
          <button type="submit" class="save-btn">Save</button>
        </form>
      </div>
    `;

    // Add event listeners for form submission
    container.querySelector('#edit-profile-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleFormSubmit();
    });
    
    // Add event listeners for image previews
    const previewButtons = container.querySelectorAll('.preview-btn');
    previewButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const inputField = document.getElementById(targetId);
        const previewContainer = document.getElementById(`${targetId}-preview`);
        
        if (inputField && previewContainer) {
          let imageUrl = inputField.value.trim();
          
          if (imageUrl) {
            // Check if we need to use a proxy to avoid CORS issues
            if (!imageUrl.startsWith('data:') && !imageUrl.includes('steemitimages.com/0x0/')) {
              imageUrl = `https://steemitimages.com/0x0/${imageUrl}`;
            }
            
            if (targetId === 'profile-image') {
              previewContainer.innerHTML = `<img src="${imageUrl}" alt="Profile image preview">`;
            } else if (targetId === 'cover-image') {
              previewContainer.style.backgroundImage = `url(${imageUrl})`;
            }
          } else {
            previewContainer.innerHTML = '<p>Please enter a valid image URL</p>';
          }
        }
      });
    });
    
    // Show initial previews if images are already set
    if (this.profile.profileImage) {
      const profilePreview = document.getElementById('profile-image-preview');
      let profileImageUrl = this.profile.profileImage;
      if (!profileImageUrl.startsWith('data:') && !profileImageUrl.includes('steemitimages.com/0x0/')) {
        profileImageUrl = `https://steemitimages.com/0x0/${profileImageUrl}`;
      }
      profilePreview.innerHTML = `<img src="${profileImageUrl}" alt="Profile image preview">`;
    }
    
    if (this.profile.coverImage) {
      const coverPreview = document.getElementById('cover-image-preview');
      let coverImageUrl = this.profile.coverImage;
      if (!coverImageUrl.startsWith('data:') && !coverImageUrl.includes('steemitimages.com/0x0/')) {
        coverImageUrl = `https://steemitimages.com/0x0/${coverImageUrl}`;
      }
      coverPreview.style.backgroundImage = `url(${coverImageUrl})`;
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
