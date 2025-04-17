import router from '../../utils/Router.js';
import followersModal from '../FollowersModal.js';
import followingModal from '../FollowingModal.js';

export default class ProfileHeader {
  constructor(profile, currentUser, onFollowAction) {
    this.profile = profile;
    this.currentUser = currentUser;
    this.onFollowAction = onFollowAction;
    this.isFollowing = false;
    this.container = null;
  }
  
  render(container) {
    this.container = container;
    const header = this.createProfileHeader();
    container.appendChild(header);
    return header;
  }
  
  createProfileHeader() {
    const header = document.createElement('div');
    header.className = 'profile-header';

    // Add cover image with better styling and error handling
    const coverDiv = document.createElement('div');
    coverDiv.className = 'profile-cover';

    // Check multiple possible locations for cover image
    let coverImageUrl = null;

    // Check direct coverImage property
    if (this.profile.coverImage) {
      coverImageUrl = this.profile.coverImage;
    }
    // Check in posting_json_metadata.cover_image as an alternative location
    else if (this.profile.posting_json_metadata) {
      try {
        const metadata = typeof this.profile.posting_json_metadata === 'string'
          ? JSON.parse(this.profile.posting_json_metadata)
          : this.profile.posting_json_metadata;
        if (metadata && metadata.cover_image) {
          coverImageUrl = metadata.cover_image;
        }
      } catch (e) {
        console.error('Error parsing posting_json_metadata:', e);
      }
    }

    if (coverImageUrl) {
      // Check if URL needs proxy for CORS issues
      if (!coverImageUrl.startsWith('data:') && !coverImageUrl.includes('steemitimages.com/0x0/')) {
        // Use Steemit proxy to avoid CORS issues and ensure image loading
        coverImageUrl = `https://steemitimages.com/0x0/${coverImageUrl}`;
      }

      coverDiv.style.backgroundImage = `url(${coverImageUrl})`;

      // Add error handling for cover image
      const testImg = new Image();
      testImg.onerror = () => {
        console.error('Failed to load cover image, using fallback gradient');
        coverDiv.style.backgroundImage = 'linear-gradient(45deg, var(--primary-color) 0%, var(--secondary-color) 100%)';
      };
      testImg.src = coverImageUrl;
    }

    // Avatar with enhanced styling
    const infoSection = document.createElement('div');
    infoSection.className = 'profile-info';

    const avatar = document.createElement('div');
    avatar.className = 'profile-avatar';

    const avatarImg = document.createElement('img');
    avatarImg.src = `https://steemitimages.com/u/${this.profile.username}/avatar`;
    avatarImg.alt = this.profile.username;
    avatarImg.loading = 'eager'; // Prioritize avatar loading
    avatarImg.onerror = () => {
      avatarImg.src = '/assets/img/default-avatar.png';
    };

    avatar.appendChild(avatarImg);

    // Profile stats with improved layout
    const stats = document.createElement('div');
    stats.className = 'profile-stats';

    // User metadata with enhanced styling
    const userMeta = document.createElement('div');
    userMeta.className = 'user-metadata';

    const name = document.createElement('h1');
    name.className = 'profile-name';
    name.textContent = this.profile.username;

    const handle = document.createElement('div');
    handle.className = 'profile-handle';
    handle.textContent = `@${this.profile.username}`;

    const reputation = document.createElement('span');
    reputation.className = 'profile-reputation';
    reputation.textContent = ` (${this.profile.reputation.toFixed(1)})`;
    handle.appendChild(reputation);

    userMeta.appendChild(name);
    userMeta.appendChild(handle);

    // Bio with modern styling
    const bio = document.createElement('div');
    bio.className = 'profile-bio';

    // Add profile description with better formatting
    if (this.profile.about) {
      const bioText = document.createElement('p');
      bioText.textContent = this.profile.about;
      bio.appendChild(bioText);
    } else {
      const noBio = document.createElement('p');
      noBio.className = 'no-bio';
      noBio.textContent = 'No bio provided';
      bio.appendChild(noBio);
    }

    // Add location if available
    if (this.profile.location) {
      const location = document.createElement('div');
      location.className = 'profile-location';

      const locationIcon = document.createElement('span');
      locationIcon.className = 'material-icons';
      locationIcon.textContent = 'location_on';

      const locationText = document.createElement('span');
      locationText.textContent = this.profile.location;

      location.appendChild(locationIcon);
      location.appendChild(locationText);
      bio.appendChild(location);
    }

    // Add website if available
    if (this.profile.website) {
      const website = document.createElement('div');
      website.className = 'profile-website';

      const websiteIcon = document.createElement('span');
      websiteIcon.className = 'material-icons';
      websiteIcon.textContent = 'language';

      const websiteLink = document.createElement('a');
      websiteLink.href = this.profile.website;
      websiteLink.target = '_blank';
      websiteLink.rel = 'noopener noreferrer';
      websiteLink.textContent = this.profile.website.replace(/^https?:\/\//, '');

      website.appendChild(websiteIcon);
      website.appendChild(websiteLink);
      bio.appendChild(website);
    }

    // Stats metrics with modern card design
    const metrics = document.createElement('div');
    metrics.className = 'profile-metrics';

    metrics.appendChild(this.createStatElement('Posts', this.profile.postCount));
    metrics.appendChild(this.createStatElement('Followers', this.profile.followerCount, true));
    metrics.appendChild(this.createStatElement('Following', this.profile.followingCount, true)); // Added true to make Following clickable

    // Actions with enhanced button styling
    const actions = document.createElement('div');
    actions.className = 'profile-actions';

    if (this.currentUser && this.currentUser.username !== this.profile.username) {
      const followBtn = document.createElement('button');
      followBtn.className = 'follow-btn';
      followBtn.textContent = this.isFollowing ? 'Unfollow' : 'Follow';
      followBtn.classList.toggle('following', this.isFollowing);

      // Add icon to follow button
      const followIcon = document.createElement('span');
      followIcon.className = 'material-icons';
      followIcon.textContent = 'person_add';
      followBtn.prepend(followIcon);

      followBtn.addEventListener('click', () => this.onFollowAction());
      actions.appendChild(followBtn);

      
    } else if (this.currentUser && this.currentUser.username === this.profile.username) {
      // Add edit profile button for own profile
      const editBtn = document.createElement('button');
      editBtn.className = 'edit-profile-btn';

      const editIcon = document.createElement('span');
      editIcon.className = 'material-icons';
      editIcon.textContent = 'edit';

      editBtn.appendChild(editIcon);
      editBtn.appendChild(document.createTextNode('Edit Profile'));

      editBtn.addEventListener('click', () => {
        router.navigate(`/edit-profile/${this.profile.username}`);
      });

      actions.appendChild(editBtn);
    }

    // Assemble all components with improved structure
    stats.appendChild(userMeta);
    stats.appendChild(bio);
    stats.appendChild(metrics);
    stats.appendChild(actions);

    infoSection.append(avatar, stats);
    header.append(coverDiv, infoSection);

    return header;
  }
  
  createStatElement(label, value, isClickable = false) {
    const stat = document.createElement('div');
    stat.className = 'stat-container';
    
    if (isClickable) {
      stat.classList.add('clickable-stat');
      stat.title = `View ${label}`;
      stat.style.cursor = 'pointer';
    }

    const statValue = document.createElement('div');
    statValue.className = 'stat-value';
    statValue.textContent = value.toLocaleString();

    const statLabel = document.createElement('div');
    statLabel.className = 'stat-label';
    statLabel.textContent = label;

    stat.append(statValue, statLabel);
    
    // Add event listener for clickable stats
    if (isClickable) {
      if (label === 'Followers') {
        stat.addEventListener('click', () => {
          followersModal.open(this.profile.username);
        });
      } else if (label === 'Following') {
        stat.addEventListener('click', () => {
          followingModal.open(this.profile.username);
        });
      }
    }
    
    return stat;
  }
  
  updateFollowStatus(isFollowing) {
    this.isFollowing = isFollowing;
    this.updateFollowButton();
  }
  
  // Metodo per mostrare lo stato di caricamento sul pulsante follow
  setFollowButtonLoading(isLoading) {
    const followBtn = this.container.querySelector('.follow-btn');
    if (!followBtn) return;
    
    if (isLoading) {
      // Salva lo stato attuale di following per ripristinarlo dopo
      followBtn.setAttribute('data-is-following', this.isFollowing);
      
      // Disabilita il pulsante durante il caricamento
      followBtn.disabled = true;
      
      // Cambia l'icona in un'icona di caricamento
      const icon = followBtn.querySelector('.material-icons');
      if (icon) {
        icon.textContent = 'sync';
        icon.classList.add('rotating');
      }
      
      // Cambia il testo in "Loading..."
      const textNode = Array.from(followBtn.childNodes).find(node => 
        node.nodeType === Node.TEXT_NODE
      );
      if (textNode) {
        textNode.nodeValue = 'Loading...';
      }
      
      // Aggiungi classe di stile per il caricamento
      followBtn.classList.add('loading');
    } else {
      // Riabilita il pulsante
      followBtn.disabled = false;
      
      // Rimuovi la classe di loading
      followBtn.classList.remove('loading');
      
      // Il testo e l'icona verranno ripristinati da updateFollowButton()
      this.updateFollowButton();
    }
  }
  
  updateFollowButton() {
    const followBtn = this.container.querySelector('.follow-btn');
    if (!followBtn) return;

    // Ottieni l'icona esistente o creane una nuova se non esiste
    let followIcon = followBtn.querySelector('.material-icons');
    if (!followIcon) {
      followIcon = document.createElement('span');
      followIcon.className = 'material-icons';
    }
    
    // Imposta l'icona corretta (non più "sync")
    followIcon.textContent = 'person_add';
    followIcon.classList.remove('rotating');

    // Svuota il contenuto del pulsante ma salva l'icona
    followBtn.innerHTML = '';
    
    // Aggiungi nuovamente l'icona
    followBtn.appendChild(followIcon);
    
    // Aggiungi il testo appropriato
    const textNode = document.createTextNode(this.isFollowing ? 'Unfollow' : 'Follow');
    followBtn.appendChild(textNode);

    // Aggiorna correttamente le classi CSS per lo stile
    if (this.isFollowing) {
      followBtn.classList.add('following');
    } else {
      followBtn.classList.remove('following');
    }
  }
}
