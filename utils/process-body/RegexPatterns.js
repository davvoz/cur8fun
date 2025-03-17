/**
 * File contenente tutti i pattern regex utilizzati nell'applicazione
 * Organizzati per categoria per facilitare la manutenzione
 */

// Immagini
export const imagePatterns = {
  // Discord image links
  discordImages: /https:\/\/media\.discordapp\.net\/attachments\/[\w\/\-\.]+\.(jpg|jpeg|png|gif|webp)/gi,
  
  // Steemit image links
  steemitImages: /https:\/\/(?:steemitimages\.com|cdn\.steemitimages\.com)\/[^\s<>")]+/gi,
  
  // Imgur direct links
  imgurImages: /https:\/\/i\.imgur\.com\/[a-zA-Z0-9]+\.(?:jpg|jpeg|png|gif|webp)/gi,
  
  // PostImage links
  postImageLinks: /https:\/\/(?:[a-z0-9-]+\.)*postimg\.cc\/[^\s<>"']+\.(?:jpg|jpeg|png|gif|webp)/gi,
  
  // General image URLs
  generalImages: /https?:\/\/[^\s<>"']+\.(?:jpg|jpeg|png|gif|webp)(?:\?[^\s<>"']*)?/gi,
  
  // Add support for peakd.com URLs
  peakdImages: /https?:\/\/files\.peakd\.com\/file\/.*?\.(?:png|jpg|jpeg|gif|webp)(?:\?\S*)?/gi,

  // CDN Steemitimages links
  cdnSteemitImages: /https:\/\/cdn\.steemitimages\.com\/[^\s<>"']+\.(?:jpg|jpeg|png|gif|webp)/gi,
  
  // Markdown image syntax
  markdownImages: /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/gi,
  
  // HTML img tags
  htmlImages: /<img[^>]+src=["']([^"']+)["']/gi,
  
  // Markdown reference images
  markdownReference: /!\[([^\]]+)\]\[([^\]]+)\]/gi
};

// Pattern per immagini animate
export const animatedImagePatterns = {
  // GIF direct links
  gifImages: /https?:\/\/[^\s<>"']+\.gif(?:\?[^\s<>"']*)?/gi,
  
  // Animated WebP
  animatedWebp: /https?:\/\/[^\s<>"']+\.webp(?:\?[^\s<>"']*)?\b(?:[^\s<>"']*animation|[^\s<>"']*animated)/gi,
  
  // Giphy links
  giphyImages: /https?:\/\/(?:media\.giphy\.com|giphy\.com\/media)\/[^\s<>"']+/gi,
  
  // Tenor GIF links
  tenorImages: /https?:\/\/(?:media\.tenor\.com|tenor\.com\/view)\/[^\s<>"']+/gi
};

// Pattern per immagini di grandi dimensioni
export const largeImagePatterns = [
  // Discord large image links
  /https:\/\/media\.discordapp\.net\/attachments\/[^\s<>"']+/i,
  
  // Steemit full-size image links (not thumbnails)
  /https:\/\/(?:steemitimages\.com|cdn\.steemitimages\.com)\/(?:0x0|DQm|p\/)/i,
  
  // Imgur direct links to large images
  /https:\/\/i\.imgur\.com\/[a-zA-Z0-9]+\.(?:jpg|png|gif)/i,
  
  // Large peakd.com images
  /https?:\/\/files\.peakd\.com\/file\/.*?\.(?:png|jpg|jpeg|gif|webp)(?:\?\S*)?/gi,

  // Large CDN Steemitimages links
  /https:\/\/cdn\.steemitimages\.com\/DQm[^\s<>"']+\.(?:jpg|jpeg|png|gif|webp)/i
];

// Pattern video YouTube
export const youtubePatterns = {
  // Standard YouTube watch URLs
  standardWatch: /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(?:&\S+)?/g,
  
  // YouTube short URLs
  shortUrl: /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})(?:\?\S+)?/g,
  
  // YouTube embed URLs
  embedUrl: /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})(?:\?\S+)?/g,
  
  // YouTube shorts URLs
  shortsUrl: /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})(?:\?\S+)?/g,
  
  // HTML iframe embeds
  iframeEmbed: /<iframe[^>]*src=["'](?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})(?:\?[^"'>]+)?["'][^>]*><\/iframe>/g
};

// Pattern per formattazione del testo
export const formattingPatterns = {
  // Headers
  header1: /^#\s+(.+)$/gm,
  header2: /^##\s+(.+)$/gm,
  header3: /^###\s+(.+)$/gm,
  
  // Text formatting
  bold: /\*\*([^*]+)\*\*/g,
  italic: /(?<!\*)\*([^*]+)\*(?!\*)/g,
  
  // Lists
  unorderedList: /^[\s]*[-*+]\s+(.+)$/gm
};

// Funzione di utility per resettare lastIndex in tutte le regex di un oggetto
export function resetRegexLastIndex(regexObject) {
  if (!regexObject) return;
  
  if (Array.isArray(regexObject)) {
    regexObject.forEach(regex => {
      if (regex instanceof RegExp) regex.lastIndex = 0;
    });
  } else {
    Object.values(regexObject).forEach(regex => {
      if (regex instanceof RegExp) regex.lastIndex = 0;
    });
  }
}

// Helper per creare regex sicuri da pattern string
export function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default {
  imagePatterns,
  animatedImagePatterns,
  largeImagePatterns,
  youtubePatterns,
  formattingPatterns,
  resetRegexLastIndex,
  escapeRegExp
};