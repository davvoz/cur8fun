# cur8.fun - A Modern Steem Social Experience

<p align="center">
  <img src="./assets/img/logo_tra.png" alt="cur8.fun Logo" width="200">
</p>

<p align="center">
  <strong>A modern, feature-rich social media interface for the Steem blockchain.</strong>
</p>

<p align="center">
  <a href="https://cur8.fun">Live Demo</a> •
  <a href="#key-features">Features</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#project-structure">Project Structure</a> •
  <a href="#contributing">Contributing</a>
</p>

## 📖 Overview

cur8.fun (previously SteemGram) is a modern web application that provides a seamless interface to the Steem blockchain. It allows users to discover content, engage with the community, and earn cryptocurrency rewards through Steem's decentralized platform, all within an intuitive user interface built with vanilla JavaScript.

## ✨ Key Features

### 🔍 Content Discovery & Navigation
- **Multiple Content Feeds**: Browse trending, hot, new, and promoted posts
- **Advanced Search**: Find content by users, tags, or keywords
- **Community Exploration**: Discover specialized content through Steem communities
- **Responsive Layouts**: Grid, list, and compact views for content browsing

### 👤 User Experience
- **Seamless Authentication**: Login with Steem credentials or Keychain
- **Profile Management**: Create and edit profile information
- **User Following**: Follow favorite creators and track their content
- **Customizable Interface**: Personalize your browsing experience

### 📝 Content Creation
- **Rich Markdown Editor**: Create formatted posts with embedded media
- **Image Upload & Integration**: Easily add images to your content
- **Tag Management**: Categorize content for better discoverability
- **Beneficiary Settings**: Share rewards with other contributors
- **Draft Saving**: Never lose your work with automatic draft saving

### 💬 Social Interactions
- **Nested Comments**: Full support for threaded discussions
- **Voting**: Upvote/downvote content with customizable voting weight
- **Sharing**: Share content across various platforms
- **Real-time Notifications**: Stay updated with interactions

### 💰 Wallet & Economics
- **Balance Tracking**: Monitor your STEEM, SBD, and SP balances
- **Rewards Dashboard**: Track earnings from content and curation
- **Resource Credits**: Monitor and manage your blockchain resource usage
- **Transaction History**: Detailed history of your account transactions

### 📱 Responsive Design
- **Mobile-First Approach**: Optimized for all devices
- **Accessibility**: Compliant with web accessibility standards
- **Performance Optimizations**: Fast loading even on slower connections

## 🚀 Getting Started

### For Users

Simply visit [https://cur8.fun](https://cur8.fun) to start using the application immediately. No installation required!

### For Developers

#### Prerequisites
- Git
- Modern web browser
- Basic knowledge of HTML, CSS, and JavaScript
- (Optional) Visual Studio Code with Live Server extension

#### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/davvoz/steemee.git
   cd steemee
   ```

2. Serve the project locally:
   - **Using VS Code**: Install the Live Server extension and click "Go Live"
   - **Using Python**:
     ```bash
     python -m http.server
     ```
   - **Using Node.js**:
     ```bash
     npx serve
     ```

3. Open your browser and navigate to `http://localhost:8000` (or the port shown in your terminal)

#### Quick Start Script
For Windows users, you can use the included setup script:
```bash
./setup-steem-social-network.bat
```

## 🔧 Project Structure

```
/
├── assets/              # Static assets
│   ├── css/             # CSS stylesheets and modules
│   └── img/             # Images and graphics
├── components/          # Reusable UI components
│   ├── comments/        # Comment-related components
│   ├── post/            # Post display components
│   ├── profile/         # User profile components
│   └── wallet/          # Wallet and finance components
├── controllers/         # Business logic controllers
├── models/              # Data models
├── services/            # API and blockchain services
├── utils/               # Utility functions
└── views/               # Page views and layouts
```

## 🧩 Core Technologies

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Blockchain Integration**: Steem JavaScript libraries
- **Authentication**: SteemLogin, Keychain integration
- **Content Rendering**: Markdown parser (marked.js), DOMPurify for sanitization
- **Deployment**: Static site deployment (GitHub Pages compatible)

## 📋 Feature Roadmap

- [ ] Dark mode support
- [ ] Multiple language support
- [ ] Advanced content filtering
- [ ] Improved community management features
- [ ] Enhanced mobile experience

## 👥 Contributing

Contributions are always welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and commit them: `git commit -m 'Add amazing feature'`
4. Push to your branch: `git push origin feature/amazing-feature`
5. Open a pull request

Please ensure your code follows the project's coding style and includes appropriate tests.

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📬 Contact & Support

- <img src="https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png" height="16" width="16" alt="GitHub"> [GitHub Repository](https://github.com/davvoz/steemee)
- <img src="https://telegram.org/img/t_logo.svg" height="16" width="16" alt="Telegram"> [Telegram Support Group](https://t.me/cur8support)
- 🌐 [Official Website](https://cur8.fun)

## 🙏 Acknowledgements

- The Steem community for ongoing support and feedback
- All open-source contributors whose libraries make this project possible
- The development team for their dedication to creating a better Steem experience

---

<p align="center">
  Built with ❤️ for the Steem community since 2025
</p>

