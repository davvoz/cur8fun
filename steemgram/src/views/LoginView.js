import eventEmitter from '../utils/EventEmitter.js';
import router from '../utils/Router.js';

class LoginView {
  constructor(params = {}) {
    this.params = params;
    this.element = null; // Sarà impostato nel metodo render
  }
  
  render(container) {
    this.element = container;
    
    // Creo il contenuto HTML del form di login
    this.element.innerHTML = `
      <div class="content-wrapper">
        <div class="login-container">
          <h2>Login to Steemgram</h2>
          <form id="login-form">
            <div class="form-group">
              <label for="username">Username</label>
              <input type="text" id="username" name="username" required>
            </div>
            <div class="form-group">
              <label for="password">Private Posting Key</label>
              <input type="password" id="password" name="password" required>
            </div>
            <button type="submit" class="btn-primary">Login</button>
          </form>
          <p class="login-message"></p>
        </div>
      </div>
    `;
    
    // Aggiungo gli event listeners
    this.bindEvents();
  }
  
  bindEvents() {
    const loginForm = this.element.querySelector('#login-form');
    const messageEl = this.element.querySelector('.login-message');
    
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = loginForm.username.value.trim();
      const privateKey = loginForm.password.value.trim();
      
      if (!username || !privateKey) {
        messageEl.textContent = 'Please enter both username and private key';
        messageEl.classList.add('error');
        return;
      }
      
      try {
        // Qui andrebbe implementata la vera autenticazione con Steem
        // Per ora simuliamo un login riuscito
        const user = { username, avatar: `https://steemitimages.com/u/${username}/avatar` };
        localStorage.setItem('currentUser', JSON.stringify(user));
        
        // Emetti evento di autenticazione
        eventEmitter.emit('auth:changed', { user });
        
        // Notifica successo
        eventEmitter.emit('notification', {
          type: 'success',
          message: `Welcome back, ${username}!`
        });
        
        // Reindirizza (se c'è un returnUrl nei params, usa quello, altrimenti vai alla home)
        if (this.params.returnUrl) {
          router.navigate(this.params.returnUrl);
        } else {
          router.navigate('/');
        }
      } catch (error) {
        messageEl.textContent = `Login failed: ${error.message || 'Invalid credentials'}`;
        messageEl.classList.add('error');
      }
    });
  }
  
  unmount() {
    // Pulizia degli event listeners se necessario
    const loginForm = this.element?.querySelector('#login-form');
    if (loginForm) {
      loginForm.removeEventListener('submit', this.handleSubmit);
    }
  }
}

export default LoginView;
