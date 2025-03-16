import View from './View.js';
import router from '../utils/Router.js';
import registerService from '../services/RegisterService.js';
import eventEmitter from '../utils/EventEmitter.js';

class RegisterView extends View {
  constructor(params) {
    super(params);
    this.returnUrl = params.returnUrl || '/';
  }
  
  async render(element) {
    this.element = element;
    
    // Clear the element
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
    
    // Create container
    const container = document.createElement('div');
    container.className = 'auth-container';
    
    // Create form
    const form = document.createElement('form');
    form.id = 'register-form';
    form.className = 'auth-form';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'auth-header';
    
    const title = document.createElement('h2');
    title.textContent = 'Create a Steem Account';
    header.appendChild(title);
    
    const subtitle = document.createElement('p');
    subtitle.className = 'auth-subtitle';
    subtitle.textContent = 'Join the blockchain-based social network';
    header.appendChild(subtitle);
    
    form.appendChild(header);
    
    // Create form fields
    const usernameField = this.createFormField(
      'username', 
      'Username', 
      'person', 
      'text',
      'Choose a unique Steem username'
    );
    form.appendChild(usernameField);
    
    const emailField = this.createFormField(
      'email', 
      'Email', 
      'email', 
      'email',
      'Your email address'
    );
    form.appendChild(emailField);
    
    const passwordField = this.createFormField(
      'password', 
      'Password', 
      'lock', 
      'password',
      'Create a strong password'
    );
    form.appendChild(passwordField);
    
    const confirmPasswordField = this.createFormField(
      'confirm-password', 
      'Confirm Password', 
      'lock', 
      'password',
      'Type your password again'
    );
    form.appendChild(confirmPasswordField);
    
    // Add note about account creation
    const note = document.createElement('div');
    note.className = 'auth-note';
    note.innerHTML = `
      <p>Important: Creating a Steem account typically requires a small fee paid in STEEM cryptocurrency.</p>
      <p>After registration, save your password securely! It cannot be recovered if lost.</p>
    `;
    form.appendChild(note);
    
    // Create button
    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.className = 'auth-button';
    submitButton.textContent = 'Create Account';
    form.appendChild(submitButton);
    
    // Add login link
    const loginLink = document.createElement('div');
    loginLink.className = 'auth-link';
    loginLink.innerHTML = 'Already have an account? <a href="/login">Login here</a>';
    form.appendChild(loginLink);
    
    // Add form to container
    container.appendChild(form);
    
    // Add container to element
    element.appendChild(container);
    
    // Add event listener for form submission
    form.addEventListener('submit', this.handleSubmit.bind(this));
    
    return element;
  }
  
  createFormField(id, label, icon, type, placeholder) {
    const fieldContainer = document.createElement('div');
    fieldContainer.className = 'form-field';
    
    const fieldLabel = document.createElement('label');
    fieldLabel.htmlFor = id;
    fieldLabel.textContent = label;
    fieldContainer.appendChild(fieldLabel);
    
    const inputWrapper = document.createElement('div');
    inputWrapper.className = 'input-with-icon';
    
    const iconElement = document.createElement('span');
    iconElement.className = 'material-icons';
    iconElement.textContent = icon;
    inputWrapper.appendChild(iconElement);
    
    const input = document.createElement('input');
    input.type = type;
    input.id = id;
    input.name = id;
    input.placeholder = placeholder;
    input.required = true;
    inputWrapper.appendChild(input);
    
    fieldContainer.appendChild(inputWrapper);
    
    return fieldContainer;
  }
  
  async handleSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const username = form.username.value;
    const email = form.email.value;
    const password = form.password.value;
    const confirmPassword = form['confirm-password'].value;
    
    // Reset previous error messages
    const errorElement = form.querySelector('.auth-error');
    if (errorElement) {
      errorElement.remove();
    }
    
    // Validate passwords match
    if (password !== confirmPassword) {
      this.showError(form, 'Passwords do not match');
      return;
    }
    
    try {
      // Disable button and show loading state
      submitButton.disabled = true;
      submitButton.textContent = 'Creating Account...';
      
      // Call register service
      const result = await registerService.createAccount({
        username,
        email,
        password
      });
      
      // Success! Show notification and redirect
      eventEmitter.emit('notification', {
        type: 'success',
        message: 'Account created successfully! Please save your password!'
      });
      
      // In a real implementation, you might show the keys to the user
      // or direct them to a page with account details
      
      // Redirect to login page
      router.navigate('/login');
      
    } catch (error) {
      console.error('Registration failed:', error);
      this.showError(form, error.message || 'Failed to create account');
    } finally {
      // Reset button state
      submitButton.disabled = false;
      submitButton.textContent = 'Create Account';
    }
  }
  
  showError(form, message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'auth-error';
    errorElement.textContent = message;
    
    // Insert after header
    const header = form.querySelector('.auth-header');
    form.insertBefore(errorElement, header.nextSibling);
  }
}

export default RegisterView;