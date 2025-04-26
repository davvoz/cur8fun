import View from './View.js';

/**
 * FAQ view displaying work in progress status
 */
class FAQView extends View {
  constructor(params = {}) {
    super(params);
    this.title = 'Frequently Asked Questions | cur8.fun';
  }

  async render(element) {
    this.element = element;

    // Clear container
    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild);
    }

    // Create work in progress container
    const wipContainer = document.createElement('div');
    wipContainer.className = 'work-in-progress-container';
    wipContainer.style.textAlign = 'center';
    wipContainer.style.padding = '50px 20px';

    // Create icon
    const icon = document.createElement('div');
    icon.className = 'material-icons wip-icon';
    icon.textContent = 'construction';
    icon.style.fontSize = '64px';
    icon.style.color = '#ffa500';
    icon.style.marginBottom = '20px';
    wipContainer.appendChild(icon);

    // Create title
    const title = document.createElement('h1');
    title.textContent = 'Work in Progress';
    title.style.margin = '0 0 20px 0';
    wipContainer.appendChild(title);

    // Create message
    const message = document.createElement('p');
    message.textContent = 'We\'re currently building our FAQ section to better serve you. Please check back soon!';
    message.style.fontSize = '18px';
    message.style.maxWidth = '600px';
    message.style.margin = '0 auto 30px auto';
    wipContainer.appendChild(message);

    // Create contact info
    const contactInfo = document.createElement('div');
    contactInfo.className = 'contact-info';
    contactInfo.style.marginTop = '20px';

    const contactText = document.createElement('p');
    contactText.textContent = 'In the meantime, if you have any questions, please contact us:';
    contactInfo.appendChild(contactText);

    const telegramLink = document.createElement('a');
    telegramLink.href = 'https://t.me/steemchat';
    telegramLink.target = '_blank';
    telegramLink.rel = 'noopener noreferrer';
    telegramLink.style.display = 'inline-block';
    telegramLink.style.margin = '10px';
    telegramLink.style.textDecoration = 'none';

    const telegramIcon = document.createElement('i');
    telegramIcon.className = 'fa-brands fa-telegram';
    telegramIcon.style.marginRight = '5px';
    telegramLink.appendChild(telegramIcon);

    const telegramText = document.createTextNode(' Telegram Group');
    telegramLink.appendChild(telegramText);
    
    contactInfo.appendChild(telegramLink);
    
    const emailLink = document.createElement('a');
    emailLink.href = 'mailto:support@cur8.fun';
    emailLink.style.display = 'inline-block';
    emailLink.style.margin = '10px';
    emailLink.style.textDecoration = 'none';

    const emailIcon = document.createElement('i');
    emailIcon.className = 'fas fa-envelope';
    emailIcon.style.marginRight = '5px';
    emailLink.appendChild(emailIcon);

    const emailText = document.createTextNode(' Email Support');
    emailLink.appendChild(emailText);
    
    contactInfo.appendChild(emailLink);
    wipContainer.appendChild(contactInfo);

    // Add the container to the element
    this.element.appendChild(wipContainer);
  }
}

export default FAQView;