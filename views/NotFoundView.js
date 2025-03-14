import View from './View.js';

class NotFoundView extends View {
  render(element) {
    // Check if element exists before proceeding
    if (!element) {
      console.error('No element provided to NotFoundView.render()');
      return;
    }
    
    // Clear the container
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }

    const container = document.createElement('div');
    container.className = 'not-found-container';
    
    const errorCode = document.createElement('h1');
    errorCode.className = 'error-code';
    errorCode.textContent = '404';
    
    const errorHeading = document.createElement('h2');
    errorHeading.className = 'error-heading';
    errorHeading.textContent = 'Page Not Found';
    
    const errorDesc = document.createElement('p');
    errorDesc.className = 'error-description';
    errorDesc.textContent = "We couldn't find the page you were looking for.";
    
    const homeButton = document.createElement('button');
    homeButton.className = 'back-to-home-btn';
    homeButton.textContent = 'Back to Home';
    homeButton.addEventListener('click', () => {
      window.location.href = '/';
    });
    
    container.appendChild(errorCode);
    container.appendChild(errorHeading);
    container.appendChild(errorDesc);
    container.appendChild(homeButton);
    
    element.appendChild(container);
  }
}

export default NotFoundView;
