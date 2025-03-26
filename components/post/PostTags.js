import router from '../../utils/Router.js';

class PostTags {
  constructor(tags) {
    this.tags = tags || [];
  }

  render() {
    const tagsContainer = document.createElement('div');
    tagsContainer.className = 'post-tags-container';

    // If no tags, don't show the section
    if (this.tags.length === 0) {
      return document.createDocumentFragment();
    }

    // Create a label for the tags section
    const tagsLabel = document.createElement('span');
    tagsLabel.className = 'tags-label';
    tagsLabel.innerHTML = '<span class="material-icons">local_offer</span> Tags:';
    tagsContainer.appendChild(tagsLabel);

    // Create tag elements
    const tagsListContainer = document.createElement('div');
    tagsListContainer.className = 'tags-list';

    this.tags.forEach(tag => {
      const tagElement = document.createElement('a');
      tagElement.className = 'tag-pill';
      tagElement.textContent = tag;
      tagElement.href = "javascript:void(0)";
      tagElement.addEventListener('click', (e) => {
        e.preventDefault();
        router.navigate(`/tag/${tag}`);
      });
      tagsListContainer.appendChild(tagElement);
    });

    tagsContainer.appendChild(tagsListContainer);
    return tagsContainer;
  }

  unmount() {
    // Clean up any event listeners if necessary
  }
}

export default PostTags;
