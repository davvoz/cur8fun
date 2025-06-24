# Cur8.fun Architecture Document

## 1. Overview

Cur8.fun (previously SteemGram) is a modern web application built to interact with the Steem blockchain. It provides a user-friendly interface for browsing, creating, and interacting with content on the Steem ecosystem. The application has a vanilla JavaScript (ES6+) frontend with a lightweight Flask backend for enhanced functionality and API services. The core UI is built with HTML, CSS, and JavaScript without dependencies on heavy frameworks.

## 2. Architectural Pattern

The application follows a hybrid architecture with clear separation of concerns:

- **Frontend MVC Pattern**: 
  - **Models**: Represent data structures
  - **Views**: Handle UI rendering and user interaction
  - **Controllers**: Manage business logic and data flow
  - **Services**: Provide API interactions (blockchain operations and backend API)

- **Backend Flask API**:
  - **RESTful Endpoints**: Provide data services and persistence
  - **Database Models**: Structured data storage
  - **Static File Serving**: Deliver frontend assets with proper MIME types
  - **SPA Fallback**: Support for HTML5 history API routing

## 3. Core Components

### 3.1 Routing System

The routing system (`utils/Router.js`) is a client-side router that enables SPA (Single Page Application) navigation:

- **URL Handling**: Supports both hash-based (`#/path`) and history API routing
- **Route Definitions**: Each route is mapped to a specific view
- **Parameter Extraction**: Extracts URL parameters (e.g., `/tag/:tag`) for dynamic routing
- **Navigation Guard**: Guards routes that require authentication
- **Route History**: Tracks navigation history for back/forward functionality

```javascript
// Example route registration
router
  .addRoute('/', HomeView, { tag: 'trending' })
  .addRoute('/login', LoginView)
  .addRoute('/tag/:tag', TagView)
  .addRoute('/@:username', ProfileView)
  .setNotFound(NotFoundView);
```

### 3.2 View System

Views (`views/`) are responsible for rendering pages and managing user interactions:

- **Base View**: All views inherit from `View.js` base class
- **Lifecycle Methods**: `render()` for initialization, `unmount()` for cleanup
- **Event Management**: Automatic event subscription tracking for cleanup
- **Component Composition**: Views often compose multiple smaller components

```javascript
class ProfileView extends View {
  constructor(params) {
    super(params);
    this.username = params.username;
  }
  
  async render(element) {
    // Render UI elements
    // Load data from services
    // Register event handlers
  }
  
  unmount() {
    // Clean up resources
    super.unmount();
  }
}
```

### 3.3 Component System

Components (`components/`) are reusable UI elements with their own lifecycle:

- **Base Component**: Components inherit from `Component.js` base class
- **Self-Contained**: Each component manages its own state and rendering
- **Event Management**: Components track event handlers for automatic cleanup
- **Composability**: Components can be nested to create complex UI structures

```javascript
class PostCard extends Component {
  constructor(parentElement, post, options) {
    super(parentElement, options);
    this.post = post;
  }
  
  render() {
    const element = document.createElement('div');
    element.className = 'post-card';
    // Build UI elements
    this.parentElement.appendChild(element);
    this.element = element;
    
    // Register event handlers
    this.registerEventHandler(element, 'click', this.handleClick.bind(this));
    
    return element;
  }
}
```

### 3.4 Services

Services (`services/`) handle API calls and blockchain interactions:

- **API Abstraction**: Hide complexities of blockchain interactions
- **Caching**: Implement caching for improved performance
- **Authentication**: Manage user credentials and sessions
- **Data Processing**: Transform raw blockchain data into app-friendly formats

Key services include:
- **SteemService**: Core interface to the Steem blockchain API
- **AuthService**: Handle user authentication and session management
- **ProfileService**: Manage user profile data
- **PostService**: Create, read, and manipulate posts
- **CommentService**: Handle comment operations
- **VoteService**: Manage voting operations
- **NotificationsService**: Track and display user notifications

### 3.5 Event System

The event system (`utils/EventEmitter.js`) enables loose coupling between components:

- **Event Subscription**: Components can subscribe to global events
- **Event Broadcasting**: Services and controllers can broadcast events
- **Automatic Cleanup**: Views track subscriptions for cleanup on unmount

```javascript
// Broadcasting an event
eventEmitter.emit('notification', {
  type: 'success',
  message: 'Post created successfully'
});

// Subscribing to an event
this.subscribe('auth:changed', this.updateUserStatus.bind(this));
```

### 3.6 Backend System

The backend system (`app.py` and `app/python` directory) provides additional server-side capabilities:

- **Flask API**: Lightweight RESTful API for persistence and scheduled operations
- **SQLAlchemy ORM**: Object-relational mapping for database interactions
- **Static File Server**: Serves frontend assets with proper MIME types
- **Route Handling**: Support for HTML5 History API routing

```python
# Example API endpoint
@app.route('/api/scheduled_posts', methods=['GET'])
def get_scheduled_posts():
    username = request.args.get('username')
    posts = ScheduledPost.query.filter_by(username=username).all()
    return jsonify([p.to_dict() for p in posts])
```

## 4. Data Flow

### 4.1 Post Loading Flow

1. User navigates to a route (e.g., `/trending`)
2. Router initializes the appropriate view (e.g., `HomeView`)
3. View calls service methods (e.g., `steemService.getTrendingPosts()`)
4. Service fetches data from the blockchain
5. View receives data and renders UI elements
6. Components handle user interactions (votes, comments, etc.)

### 4.2 Authentication Flow

1. User navigates to `/login`
2. LoginView presents authentication options
3. User provides credentials
4. AuthService validates credentials with the blockchain
5. On success, AuthService stores session data
6. EventEmitter broadcasts 'auth:changed' event
7. UI components update to reflect authenticated state

## 5. Application Structure

```
/
├── app.py              # Flask application entry point
├── requirements.txt    # Python dependencies
├── app/                # Python backend modules
│   ├── __init__.py
│   ├── models.py       # SQLAlchemy database models
│   └── routes/         # API route handlers
├── assets/             # Static assets
│   ├── css/            # CSS stylesheets and modules
│   └── img/            # Images and graphics
├── components/         # Reusable UI components
│   ├── comments/       # Comment-related components
│   ├── post/           # Post display components
│   ├── profile/        # User profile components
│   └── wallet/         # Wallet and finance components
├── controllers/        # Business logic controllers
├── models/             # Frontend data models
├── services/           # API and blockchain services
├── utils/              # Utility functions
└── views/              # Page views and layouts
```

## 6. UI Component Hierarchy

- `App` (Root container)
  - `NavigationBar`
    - `SearchBar`
    - `UserMenu`
  - `MainContent` (Router container)
    - Current View (e.g., `HomeView`, `ProfileView`, etc.)
      - View-specific components (e.g., `PostsList`, `ProfileHeader`)
        - Shared components (e.g., `PostCard`, `CommentThread`)

## 7. Key Features Implementation

### 7.1 Content Feeds

Multiple content views are implemented through specialized views:
- `HomeView`: Shows posts from different categories (trending, hot, new)
- `TagView`: Shows posts for a specific tag
- `CommunityView`: Shows posts within a Steem community
- `SearchView`: Shows search results for posts, users, or tags

### 7.2 Draft Management

The draft system allows users to save and manage post drafts:

- **Multi-Draft Support**: Users can have multiple drafts (up to 10)
- **Auto-save**: Posts are automatically saved as drafts
- **Draft Organization**: Users can view, edit, and delete drafts from the DraftsView

### 7.3 Wallet & Transactions

The wallet system provides financial information and transaction capabilities:

- **Balance Display**: Shows STEEM, SBD, and Steem Power balances
- **Resource Credits**: Monitors blockchain resource usage
- **Transaction History**: Shows history of transactions
- **Reward Claims**: Allows claiming of pending rewards

### 7.4 Post Scheduling System

The post scheduling system allows users to create and schedule posts for future publication:

- **Backend Integration**: Post schedules are stored in a SQLite database via Flask APIs
- **Persistence**: Schedule data stored in SQLAlchemy models instead of localStorage
- **Schedule Management**: Calendar-based interface for selecting publication dates and times
- **Queue Management**: API for retrieving, modifying and deleting scheduled posts
- **Publishing Service**: Automatic publication at the scheduled date and time

```python
# Example SQLAlchemy model for scheduled posts
class ScheduledPost(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), nullable=False, index=True)
    title = db.Column(db.String(255), nullable=False)
    body = db.Column(db.Text, nullable=False)
    scheduled_datetime = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.String(32), default='scheduled')
```

## 8. Security Considerations

- **XSS Protection**: Content sanitization using DOMPurify
- **Credential Management**: Secure handling of user credentials
- **Permission Handling**: Proper permission checks before transactions

## 9. Performance Optimizations

- **Infinite Scrolling**: Load content progressively as user scrolls
- **Lazy Loading**: Load images and content only when needed
- **Content Caching**: Cache frequently accessed blockchain data
- **Grid Controller**: Optimize layout calculations for content rendering

## 10. PWA Features

The application includes Progressive Web App features:

- **Service Worker**: Enables offline functionality
- **Cache API**: Caches app shell for faster loading
- **Update Notification**: Notifies users about app updates

## 11. Conclusion

Cur8.fun's architecture is designed for modularity, maintainability, and user experience. The component-based approach with clear separation of concerns allows for easy extension and maintenance. The application leverages vanilla JavaScript without dependencies on heavy frameworks, resulting in a lightweight yet powerful user interface for the Steem blockchain.

## 12. Backend Integration

### 12.1 Data Persistence

The application uses multiple storage approaches depending on data requirements:

- **Client-Side Storage**: 
  - **LocalStorage**: User preferences, drafts, and session data
  - **Cache API**: Cached content for offline functionality

- **Server-Side Storage**:
  - **SQLite Database**: Scheduled posts and other persistent data
  - **SQLAlchemy ORM**: Object-relational mapping for database operations

### 12.2 API Integration

The frontend interacts with multiple APIs:

- **Blockchain API**: Direct interaction with Steem blockchain via JavaScript libraries
- **Flask Backend API**: REST API for data persistence and services not handled by the blockchain
  - `/api/scheduled_posts`: Manage scheduled posts
  - Future expansion points: analytics, caching, user preferences

### 12.3 Deployment Architecture

The application can be deployed in multiple configurations:

- **Static Hosting**: Deploy the frontend on GitHub Pages or other static hosts
- **Flask Hosting**: Deploy frontend and backend together using Flask
  - Development: Flask built-in development server
  - Production: WSGI server (Gunicorn) with reverse proxy (Nginx)

```
[Frontend SPA] ↔ [Flask App] ↔ [SQLite DB]
```
