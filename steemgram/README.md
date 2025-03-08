# SteemGram

SteemGram is a modern social network interface for the Steem blockchain. It provides a user-friendly way to interact with Steem content, allowing users to browse, create, vote, and comment on posts while earning cryptocurrency rewards.

![SteemGram Logo](./src/assets/img/logo_tra.png)

## Features

- **Content Discovery**: Browse trending, hot, new, and promoted posts
- **User Authentication**: Login with Steem credentials
- **Content Creation**: Create and publish posts to the Steem blockchain
- **Social Interactions**: Comment, upvote, and share content
- **User Profiles**: View user information, posts, and statistics
- **Responsive Design**: Optimized for desktop and mobile devices

## Technologies

- Vanilla JavaScript (ES6+)
- CSS3 with responsive design
- Steem JavaScript APIs
- Client-side routing

## Getting Started

### Prerequisites

- Node.js 12+ and npm

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/steemgram.git
   cd steemgram
   ```

2. Install the dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm start
   ```

4. Open your browser and navigate to `http://localhost:1234` (or the port shown in your terminal)

## Project Structure

```
steemgram/
├── src/                  # Source files
│   ├── assets/           # Static assets
│   │   ├── css/          # CSS styles
│   │   └── img/          # Images
│   ├── components/       # Reusable UI components
│   ├── models/           # Data models
│   ├── services/         # API services
│   ├── utils/            # Utility functions
│   ├── views/            # Page views
│   ├── index.html        # Main HTML file
│   └── index.js          # Entry point
└── package.json          # Project metadata and dependencies
```

## Usage Examples

### Browsing Content

Visit different content feeds:
- Trending: `/trending`
- Hot: `/hot`
- New: `/new`
- Promoted: `/promoted`

### User Profiles

View any Steem user's profile:
```
/@username
```

### Individual Posts

View specific posts:
```
/@author/permlink
```

## Contributing

1. Fork the project
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Steem blockchain and community
- Contributors and developers

---

Built with ❤️ for the Steem community
