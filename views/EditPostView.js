import View from './View.js';
import MarkdownEditor from '../components/MarkdownEditor.js';
import authService from '../services/AuthService.js';
import editPostService from '../services/EditPostService.js';

class EditPostView extends View {
  constructor(params = {}) {
    super(params);
    this.title = 'Edit Post';
    this.user = authService.getCurrentUser();
    this.postTitle = '';
    this.postBody = '';
    // First tag = post category, immutable after publish (parent_permlink on chain)
    this.lockedFirstTag = '';
    this.additionalTags = [];
    this.isSubmitting = false;
    this.markdownEditor = null;

    // Original post data
    this.originalPost = null;
    this.author = params.author || '';
    this.permlink = params.permlink || '';

    this.isLoading = true;
    this.loadError = null;
  }

  async render(element) {
    this.element = element;

    // Clear container
    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild);
    }

    // Verifica che l'utente sia loggato
    if (!this.user) {
      this.renderLoginRequired();
      return;
    }

    // Show loading state
    this.renderLoadingState();

    try {
      // Load the post data
      await this.loadPostData();

      // Check if post was found
      if (!this.originalPost) {
        this.renderNotFound();
        return;
      }

      // Check if user is the author
      if (this.user.username !== this.originalPost.author) {
        this.renderNotAuthorized();
        return;
      }

      // Render the edit form with loaded data
      this.renderEditForm();
    } catch (error) {
      console.error('Error loading post:', error);
      this.loadError = error.message;
      this.renderError();
    }
  }

  async loadPostData() {
    if (!this.author || !this.permlink) {
      this.loadError = 'Post not found. Missing author or permlink.';
      throw new Error(this.loadError);
    }

    try {
      this.originalPost = await editPostService.getPost(this.author, this.permlink);

      // Set initial values from the post
      this.postTitle = this.originalPost.title;
      this.postBody = this.originalPost.body;

      const tags = (this.originalPost.tags || []).map(t => String(t).toLowerCase());
      this.lockedFirstTag = tags[0] || '';
      this.additionalTags = tags.slice(1);

      this.isLoading = false;
    } catch (error) {
      this.isLoading = false;
      this.loadError = error.message;
      throw error;
    }
  }

  renderLoadingState() {
    const loadingContainer = document.createElement('div');
    loadingContainer.className = 'loading-container';
    loadingContainer.innerHTML = `
      <div class="spinner"></div>
      <p>Loading post data...</p>
    `;
    this.element.appendChild(loadingContainer);
  }

  renderNotFound() {
    const container = document.createElement('div');
    container.className = 'error-container';
    container.innerHTML = `
      <h2>Post Not Found</h2>
      <p>The post you're trying to edit could not be found.</p>
      <a href="/" class="btn secondary-btn">Return to Home</a>
    `;
    this.element.appendChild(container);
  }

  renderNotAuthorized() {
    const container = document.createElement('div');
    container.className = 'error-container';
    container.innerHTML = `
      <h2>Not Authorized</h2>
      <p>You can only edit your own posts.</p>
      <a href="/" class="btn secondary-btn">Return to Home</a>
    `;
    this.element.appendChild(container);
  }

  renderError() {
    const container = document.createElement('div');
    container.className = 'error-container';
    container.innerHTML = `
      <h2>Error Loading Post</h2>
      <p>${this.loadError || 'An unknown error occurred.'}</p>
      <a href="/" class="btn secondary-btn">Return to Home</a>
    `;
    this.element.appendChild(container);
  }

  renderEditForm() {
    // Clear container first
    while (this.element.firstChild) {
      this.element.removeChild(this.element.firstChild);
    }

    // Create post editor container
    const postEditor = document.createElement('div');
    postEditor.className = 'post-editor-container';

    // Create header
    const header = document.createElement('header');
    header.className = 'editor-header';

    const heading = document.createElement('h1');
    heading.textContent = 'Edit Post';
    header.appendChild(heading);

    // Create form
    const form = document.createElement('form');
    form.className = 'post-form';
    form.addEventListener('submit', (e) => this.handleSubmit(e));

    // Status message container
    const statusArea = document.createElement('div');
    statusArea.id = 'post-status-message';
    statusArea.className = 'status-message hidden';
    form.appendChild(statusArea);

    // Community is intentionally not editable here — it's encoded in the
    // post's parent_permlink and immutable after publish.

    // Title input
    const titleGroup = document.createElement('div');
    titleGroup.className = 'form-group';

    const titleLabel = document.createElement('label');
    titleLabel.htmlFor = 'post-title';
    titleLabel.textContent = 'Title';
    titleGroup.appendChild(titleLabel);

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.id = 'post-title';
    titleInput.className = 'form-control';
    titleInput.placeholder = 'Enter a title for your post';
    titleInput.required = true;
    titleInput.value = this.postTitle;
    titleInput.addEventListener('input', (e) => {
      this.postTitle = e.target.value;
    });
    titleGroup.appendChild(titleInput);

    form.appendChild(titleGroup);

    // Content editor - Sostituiamo il textarea con MarkdownEditor
    const contentGroup = document.createElement('div');
    contentGroup.className = 'form-group';

    const contentLabel = document.createElement('label');
    contentLabel.htmlFor = 'markdown-editor-container';
    contentLabel.textContent = 'Content';
    contentGroup.appendChild(contentLabel);

    // Container per l'editor Markdown
    const editorContainer = document.createElement('div');
    editorContainer.id = 'markdown-editor-container';
    contentGroup.appendChild(editorContainer);

    form.appendChild(contentGroup);

    // Tags input — first tag is locked (immutable category on chain)
    const tagsGroup = document.createElement('div');
    tagsGroup.className = 'form-group';

    const tagsLabel = document.createElement('label');
    tagsLabel.htmlFor = 'post-tags';
    tagsLabel.textContent = 'Tags';
    tagsGroup.appendChild(tagsLabel);

    const tagsRow = document.createElement('div');
    tagsRow.className = 'tags-edit-row';

    if (this.lockedFirstTag) {
      const lockedChip = document.createElement('span');
      lockedChip.className = 'tag-chip locked';
      lockedChip.title = 'The main category cannot be changed after publishing';

      const lockIcon = document.createElement('span');
      lockIcon.className = 'material-icons';
      lockIcon.textContent = 'lock';
      lockedChip.appendChild(lockIcon);

      const lockedText = document.createElement('span');
      lockedText.textContent = this.lockedFirstTag;
      lockedChip.appendChild(lockedText);

      tagsRow.appendChild(lockedChip);
    }

    const tagsInput = document.createElement('input');
    tagsInput.type = 'text';
    tagsInput.id = 'post-tags';
    tagsInput.className = 'form-control tags-input-editable';
    tagsInput.placeholder = 'Add more tags separated by spaces';
    tagsInput.value = this.additionalTags.join(' ');
    tagsInput.addEventListener('input', (e) => {
      // Steem tags must be lowercase — coerce as the user types
      const lowered = e.target.value.toLowerCase();
      if (e.target.value !== lowered) {
        const cursor = e.target.selectionStart;
        e.target.value = lowered;
        e.target.setSelectionRange(cursor, cursor);
      }
      this.additionalTags = lowered.split(' ').filter(tag => tag.trim() !== '');
      this.updateTagsValidation();
    });
    tagsRow.appendChild(tagsInput);

    tagsGroup.appendChild(tagsRow);

    const tagsHelp = document.createElement('small');
    tagsHelp.className = 'form-text';
    tagsHelp.textContent = this.lockedFirstTag
      ? `The main category "${this.lockedFirstTag}" is locked. You can add up to 4 more tags.`
      : 'Add up to 5 tags to help categorize your post.';
    tagsGroup.appendChild(tagsHelp);
    this.tagsHelpEl = tagsHelp;

    form.appendChild(tagsGroup);

    // Submit button
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'btn primary-btn';
    submitBtn.id = 'submit-post-btn';
    submitBtn.textContent = 'Update Post';
    form.appendChild(submitBtn);

    // Add Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'btn secondary-btn';
    cancelBtn.style.marginLeft = '10px';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      window.history.back();
    });
    form.appendChild(cancelBtn);

    // Append form to container
    postEditor.appendChild(header);
    postEditor.appendChild(form);

    // Add the container to the page
    this.element.appendChild(postEditor);

    // Inizializza l'editor Markdown
    this.markdownEditor = new MarkdownEditor(
      document.getElementById('markdown-editor-container'),
      {
        placeholder: 'Write your post content here using Markdown...',
        onChange: (value) => {
          this.postBody = value;
        },
        height: '500px',
        initialValue: this.postBody || ''
      }
    );
    this.markdownEditor.render();

    // Reflect the initial tag state: a post loaded with more tags than allowed
    // must surface the problem (and block submit) before the user even edits.
    this.updateTagsValidation();
  }

  /**
   * Aggiorna il feedback sui tag in tempo reale: mostra un avviso e disabilita
   * il pulsante di submit quando i tag superano il massimo consentito on-chain
   * (5 totali, cioè la categoria bloccata + 4, oppure 5 se non c'è categoria).
   */
  updateTagsValidation() {
    const cap = this.lockedFirstTag ? 4 : 5;
    const over = this.additionalTags.length > cap;
    const submitBtn = document.getElementById('submit-post-btn');
    const helpEl = this.tagsHelpEl;

    if (over) {
      const excess = this.additionalTags.length - cap;
      if (helpEl) {
        helpEl.textContent = `Too many tags — remove ${excess} (max ${cap}${this.lockedFirstTag ? ` besides the locked "${this.lockedFirstTag}"` : ''}).`;
        helpEl.style.color = 'var(--error-dark, #d32f2f)';
      }
      if (submitBtn) submitBtn.disabled = true;
    } else {
      if (helpEl) {
        helpEl.textContent = this.lockedFirstTag
          ? `The main category "${this.lockedFirstTag}" is locked. You can add up to ${cap} more tags.`
          : `Add up to ${cap} tags to help categorize your post.`;
        helpEl.style.color = '';
      }
      // Don't re-enable mid-submit (the spinner state owns the button then).
      if (submitBtn && !this.isSubmitting) submitBtn.disabled = false;
    }
  }

  /**
   * Gestisce il submit del form
   * @param {Event} e - Evento submit
   */
  async handleSubmit(e) {
    e.preventDefault();

    if (this.isSubmitting) return;

    // Verifica dati
    if (!this.postTitle.trim()) {
      this.showError('Please enter a title for your post');
      return;
    }

    if (!this.postBody.trim()) {
      this.showError('Please enter content for your post');
      return;
    }

    // Recompose tags: the first one is locked (immutable parent_permlink)
    const finalTags = this.lockedFirstTag
      ? [this.lockedFirstTag, ...this.additionalTags]
      : [...this.additionalTags];

    if (finalTags.length === 0) {
      this.showError('Please add at least one tag');
      return;
    }

    if (finalTags.length > 5) {
      const cap = this.lockedFirstTag ? 4 : 5;
      this.showError(`You can only add up to ${cap} additional tags`);
      return;
    }

    // Imposta stato di invio
    this.isSubmitting = true;
    const submitBtn = document.getElementById('submit-post-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Updating...';

    try {
      // Notifica inizio aggiornamento
      this.showStatus('Updating your post...', 'info');

      // Prepare update data (community/parent_permlink are immutable on chain)
      const updateData = {
        title: this.postTitle,
        body: this.postBody,
        tags: finalTags,
        author: this.originalPost.author,
        permlink: this.originalPost.permlink,
        parentPermlink: this.originalPost.parentPermlink,
        originalMetadata: this.originalPost.originalMetadata || {}
      };

      // Usa il servizio centralizzato per aggiornare post
      const result = await editPostService.updatePost(updateData);
      
      // Mostra messaggio di successo
      this.showStatus('Post updated successfully!', 'success');

      // Reindirizza alla pagina del post dopo un breve ritardo
      setTimeout(() => {
        window.location.href = `/@${this.originalPost.author}/${this.originalPost.permlink}`;
      }, 2000);
    } catch (error) {
      console.error('Failed to update post:', error);
      
      // Check if it's a cancellation
      if (error.isCancelled) {
        this.showStatus('Update cancelled.', 'info');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Update Post';
      } else {
        this.showError(`Failed to update post: ${error.message}`);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Update Post';
      }
    } finally {
      this.isSubmitting = false;
    }
  }

  /**
   * Mostra un messaggio di errore
   * @param {string} message - Messaggio di errore
   */
  showError(message) {
    this.showStatus(message, 'error');
  }

  /**
   * Mostra un messaggio di stato
   * @param {string} message - Messaggio da mostrare
   * @param {string} type - Tipo di messaggio (info, error, success)
   */
  showStatus(message, type = 'info') {
    const statusArea = document.getElementById('post-status-message');
    if (!statusArea) return;

    statusArea.textContent = message;
    // `visible` is required: the base .status-message rule keeps the box at
    // opacity:0 / max-height:0, so without it the message never appeared.
    statusArea.className = `status-message ${type} visible`;

    // Bring it into view — on mobile the status area sits at the top of the
    // form, off-screen while the user taps Update at the bottom.
    statusArea.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Nascondi automaticamente dopo un po' se è un successo
    if (type === 'success') {
      setTimeout(() => {
        statusArea.className = 'status-message hidden';
      }, 5000);
    }
  }

  /**
   * Visualizza messaggio di login richiesto
   */
  renderLoginRequired() {
    const container = document.createElement('div');
    container.className = 'login-required-container';

    const message = document.createElement('div');
    message.className = 'login-message';
    message.innerHTML = `
      <h2>Login Required</h2>
      <p>You need to be logged in to edit a post.</p>
      <a href="/login" class="btn primary-btn">Login Now</a>
    `;

    container.appendChild(message);
    this.element.appendChild(container);
  }

  /**
   * Pulisce gli event listener quando la vista viene smontata
   */
  unmount() {
    if (this.markdownEditor) {
      this.markdownEditor = null;
    }

    super.unmount();
  }
}

export default EditPostView;
