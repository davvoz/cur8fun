export default class UIComponents {
  static createMetadataItem(iconName, text, className) {
    const container = document.createElement('span');
    container.className = className;

    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.textContent = iconName;

    const textSpan = document.createElement('span');
    textSpan.textContent = text;

    container.appendChild(icon);
    container.appendChild(textSpan);

    return container;
  }
  
  static createExcerpt(body, maxLength = 150) {
    if (!body) return '';

    // Remove markdown and html
    const plainText = body
      .replace(/!\[.*?\]\(.*?\)/g, '') // remove markdown images
      .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // remove markdown links but keep text
      .replace(/<\/?[^>]+(>|$)/g, '') // remove html tags
      .replace(/#{1,6}\s/g, '') // remove headings
      .replace(/(\*\*|__)(.*?)(\*\*|__)/g, '$2') // convert bold to normal text
      .replace(/(\*|_)(.*?)(\*|_)/g, '$2') // convert italic to normal text
      .replace(/~~(.*?)~~/g, '$1') // convert strikethrough to normal text
      .replace(/```[\s\S]*?```/g, '') // remove code blocks
      .replace(/\n\n/g, ' ') // replace double newlines with space
      .replace(/\n/g, ' ') // replace single newlines with space
      .trim();

    // Truncate and add ellipsis if necessary
    if (plainText.length <= maxLength) {
      return plainText;
    }

    return plainText.substring(0, maxLength) + '...';
  }
}
