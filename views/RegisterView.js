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
    
    // Add note about account creation
    const note = document.createElement('div');
    note.className = 'auth-note';
    note.innerHTML = `
      <p>Important: Creating a Steem account typically requires a small fee paid in STEEM cryptocurrency.</p>
      <p>A PDF with your account details and private keys will be sent to your email.</p>
      <p><strong>Please keep this PDF in a safe place! Your keys cannot be recovered if lost.</strong></p>
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
    
    // Add lowercase restriction to username field
    if (id === 'username') {
      input.pattern = '[a-z0-9.-]+';  // Removed the escaped hyphen which was causing problems
      input.title = 'Only lowercase letters, numbers, dots and dashes allowed';
      input.addEventListener('input', (e) => {
        e.target.value = e.target.value.toLowerCase();
      });
    }
    
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
    
    // Reset previous error messages
    const errorElement = form.querySelector('.auth-error');
    if (errorElement) {
      errorElement.remove();
    }
    
    try {
      // Disable button and show loading state
      submitButton.disabled = true;
      submitButton.textContent = 'Creating Account...';
      
      // Call register service with username and email
      const result = await registerService.createAccount({
        username,
        email
      });
      
      // Success! Show notification
      eventEmitter.emit('notification', {
        type: 'success',
        message: 'Account created successfully! Please check your email for account details.'
      });
      
      // Show success message in the form
      this.showSuccessMessage(form, username, email);
      
    } catch (error) {
      console.error('Registration failed:', error);
      this.showError(form, error.message || 'Failed to create account');
      
      // Reset button state
      submitButton.disabled = false;
      submitButton.textContent = 'Create Account';
    }
  }
  
  showSuccessMessage(form, username, email) {
    // Hide the form
    form.style.display = 'none';
    
    // Create success container
    const successContainer = document.createElement('div');
    successContainer.className = 'auth-success';
    
    // Add success message
    const successMessage = document.createElement('div');
    successMessage.className = 'success-message';
    successMessage.innerHTML = `
      <h3>Account Created Successfully!</h3>
      <p>Your Steem account <strong>${username}</strong> has been created.</p>
      <p>We've sent your account details and private keys to <strong>${email}</strong>.</p>
      <p>Please check your email (including spam folder) and save the PDF in a secure location.</p>
      <p><strong>Important:</strong> Your private keys are the only way to access your account. They cannot be recovered if lost!</p>
    `;
    successContainer.appendChild(successMessage);
    
    // Add buttons
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'success-buttons';
    
    // Login button
    const loginButton = document.createElement('button');
    loginButton.className = 'auth-button';
    loginButton.textContent = 'Go to Login';
    loginButton.addEventListener('click', () => {
      router.navigate('/login');
    });
    buttonsContainer.appendChild(loginButton);
    
    // Create another account button
    const createAnotherButton = document.createElement('button');
    createAnotherButton.className = 'secondary-button';
    createAnotherButton.textContent = 'Create Another Account';
    createAnotherButton.addEventListener('click', () => {
      // Clear the container and re-render the form
      this.render(this.element);
    });
    buttonsContainer.appendChild(createAnotherButton);
    
    successContainer.appendChild(buttonsContainer);
    
    // Add to parent element
    this.element.querySelector('.auth-container').appendChild(successContainer);
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