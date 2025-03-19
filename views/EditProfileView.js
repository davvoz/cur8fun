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
            <input type="text" id="profile-image" name="profileImage" value="${this.profile.profileImage || ''}" placeholder="Profile Image URL">
          </div>
          <div class="form-group">
            <label for="cover-image">Cover Image</label>
            <input type="text" id="cover-image" name="coverImage" value="${this.profile.coverImage || ''}" placeholder="Cover Image URL">
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

    // Add event listener for form submission
    container.querySelector('#edit-profile-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleFormSubmit();
    });
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
