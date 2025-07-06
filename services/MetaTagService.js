/**
 * Service per la gestione dinamica dei meta tag per social media sharing
 * Migliora le anteprime di post, profili e community
 */
class MetaTagService {
  constructor() {
    this.defaultMeta = {
      title: 'cur8.fun',
      description: 'Your Steem community social platform',
      image: 'https://cur8.fun/assets/img/logo_tra.png',
      url: 'https://cur8.fun/',
      type: 'website'
    };
  }

  /**
   * Aggiorna i meta tag per un post specifico
   * @param {Object} post - Dati del post
   * @param {Object} options - Opzioni aggiuntive
   */
  updatePostMetaTags(post, options = {}) {
    if (!post) return;

    // Estrai immagine dal post
    const imageUrl = this.extractBestImage(post);
    
    // Crea descrizione dal contenuto
    const description = this.createDescription(post.body, 160);
    
    // Definisci i meta tag
    const metaData = {
      title: post.title || 'Post su Steem',
      description: description,
      image: imageUrl || this.defaultMeta.image,
      url: window.location.href,
      type: 'article',
      author: post.author,
      publishedTime: post.created,
      tags: this.extractTags(post)
    };

    this.setMetaTags(metaData, 'post');
  }

  /**
   * Aggiorna i meta tag per un profilo utente
   * @param {Object} profile - Dati del profilo
   */
  updateProfileMetaTags(profile) {
    if (!profile) return;

    const metaData = {
      title: `@${profile.name} su cur8.fun`,
      description: profile.profile?.about || `Profilo di ${profile.name} su Steem`,
      image: profile.profile?.profile_image || `https://steemitimages.com/u/${profile.name}/avatar`,
      url: window.location.href,
      type: 'profile'
    };

    this.setMetaTags(metaData, 'profile');
  }

  /**
   * Aggiorna i meta tag per una community
   * @param {Object} community - Dati della community
   */
  updateCommunityMetaTags(community) {
    if (!community) return;

    const metaData = {
      title: community.title || community.name,
      description: community.about || `Community ${community.name} su Steem`,
      image: community.avatar || this.defaultMeta.image,
      url: window.location.href,
      type: 'website'
    };

    this.setMetaTags(metaData, 'community');
  }

  /**
   * Ripristina i meta tag predefiniti
   */
  resetToDefault() {
    this.setMetaTags(this.defaultMeta, 'default');
  }

  /**
   * Imposta i meta tag nel documento
   * @param {Object} metaData - Dati dei meta tag
   * @param {string} type - Tipo di contenuto
   */
  setMetaTags(metaData, type) {
    // Rimuovi meta tag esistenti per evitare conflitti
    this.removeExistingMetaTags();

    // Open Graph tags
    this.createMetaTag('og:title', metaData.title);
    this.createMetaTag('og:description', metaData.description);
    this.createMetaTag('og:image', metaData.image);
    this.createMetaTag('og:image:url', metaData.image);
    this.createMetaTag('og:image:secure_url', metaData.image);
    this.createMetaTag('og:url', metaData.url);
    this.createMetaTag('og:type', metaData.type);
    this.createMetaTag('og:site_name', 'cur8.fun');

    // Dimensioni immagine per migliore compatibilità
    this.createMetaTag('og:image:width', '1200');
    this.createMetaTag('og:image:height', '630');
    this.createMetaTag('og:image:alt', metaData.title);

    // Twitter Card tags
    const cardType = metaData.image ? 'summary_large_image' : 'summary';
    this.createMetaTag('twitter:card', cardType, false);
    this.createMetaTag('twitter:title', metaData.title, false);
    this.createMetaTag('twitter:description', metaData.description, false);
    this.createMetaTag('twitter:image', metaData.image, false);
    this.createMetaTag('twitter:image:alt', metaData.title, false);

    // Tag specifici per articoli
    if (type === 'post' && metaData.author) {
      this.createMetaTag('article:author', `https://cur8.fun/@${metaData.author}`);
      this.createMetaTag('article:published_time', metaData.publishedTime);
      
      if (metaData.tags && metaData.tags.length > 0) {
        metaData.tags.forEach(tag => {
          this.createMetaTag('article:tag', tag);
        });
      }
    }

    // Tag per profili
    if (type === 'profile') {
      this.createMetaTag('profile:username', metaData.title.replace('@', '').replace(' su cur8.fun', ''));
    }

    // Schema.org structured data
    this.updateStructuredData(metaData, type);

    // Aggiorna il title della pagina
    document.title = metaData.title;

    // Link canonical
    this.updateCanonicalLink(metaData.url);
  }

  /**
   * Crea un meta tag
   * @param {string} property - Proprietà del meta tag
   * @param {string} content - Contenuto del meta tag
   * @param {boolean} useProperty - Se usare property o name
   */
  createMetaTag(property, content, useProperty = true) {
    if (!content) return;

    const metaTag = document.createElement('meta');
    
    if (useProperty) {
      metaTag.setAttribute('property', property);
    } else {
      metaTag.setAttribute('name', property);
    }
    
    metaTag.setAttribute('content', content);
    document.head.appendChild(metaTag);
  }

  /**
   * Rimuove i meta tag esistenti per evitare conflitti
   */
  removeExistingMetaTags() {
    const selectors = [
      'meta[property^="og:"]',
      'meta[name^="twitter:"]',
      'meta[property^="article:"]',
      'meta[property^="profile:"]',
      'meta[name="description"]',
      'script[type="application/ld+json"]'
    ];
    
    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(tag => {
        tag.remove();
      });
    });
  }

  /**
   * Estrae la migliore immagine da un post
   * @param {Object} post - Dati del post
   * @returns {string|null} URL dell'immagine
   */
  extractBestImage(post) {
    try {
      // 1. Controlla metadata.image
      const metadata = this.parseMetadata(post.json_metadata);
      if (metadata?.image?.[0]) {
        return this.optimizeImageUrl(metadata.image[0]);
      }

      // 2. Controlla metadata.thumbnail
      if (metadata?.thumbnail) {
        return this.optimizeImageUrl(metadata.thumbnail);
      }

      // 3. Estrai da markdown nel body
      const markdownImageRegex = /!\[.*?\]\((https?:\/\/[^\s\)]+)\)/;
      const markdownMatch = post.body?.match(markdownImageRegex);
      if (markdownMatch) {
        return this.optimizeImageUrl(markdownMatch[1]);
      }

      // 4. Estrai da HTML img tags
      const htmlImageRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/i;
      const htmlMatch = post.body?.match(htmlImageRegex);
      if (htmlMatch) {
        return this.optimizeImageUrl(htmlMatch[1]);
      }

      // 5. Estrai URL di immagini dirette con parametri
      const directImageRegex = /(https?:\/\/[^\s<>"']+\.(?:jpg|jpeg|png|gif|webp)(?:\?[^\s<>"']*)?)/i;
      const directMatch = post.body?.match(directImageRegex);
      if (directMatch) {
        return this.optimizeImageUrl(directMatch[1]);
      }

      // 6. Estrai da servizi di immagini specifici (Steemit, Hive, ecc.)
      const steemImageRegex = /https?:\/\/(?:steemitimages\.com|images\.hive\.blog|gateway\.pinata\.cloud|ipfs\.io)\/[^\s<>"']+/i;
      const steemMatch = post.body?.match(steemImageRegex);
      if (steemMatch) {
        return this.optimizeImageUrl(steemMatch[0]);
      }

      return null;
    } catch (error) {
      console.error('Error extracting image:', error);
      return null;
    }
  }

  /**
   * Ottimizza URL immagine usando proxy Steem
   * @param {string} url - URL originale
   * @returns {string} URL ottimizzato
   */
  optimizeImageUrl(url) {
    if (!url || url.includes('steemitimages.com')) return url;
    
    // Pulisci l'URL rimuovendo parametri non necessari
    const cleanUrl = url.split('?')[0];
    
    // Verifica se l'URL è valido
    try {
      new URL(cleanUrl);
      return `https://steemitimages.com/1200x630/${encodeURIComponent(cleanUrl)}`;
    } catch (e) {
      console.warn('Invalid image URL:', url);
      return this.defaultMeta.image;
    }
  }

  /**
   * Crea descrizione pulita dal contenuto
   * @param {string} content - Contenuto grezzo
   * @param {number} maxLength - Lunghezza massima
   * @returns {string} Descrizione pulita
   */
  createDescription(content, maxLength = 160) {
    if (!content) return this.defaultMeta.description;

    return content
      .replace(/!\[.*?\]\(.*?\)/g, '') // Rimuovi immagini markdown
      .replace(/\[.*?\]\(.*?\)/g, '') // Rimuovi link markdown
      .replace(/<[^>]*>/g, '') // Rimuovi HTML
      .replace(/#{1,6}\s/g, '') // Rimuovi header markdown
      .replace(/\*{1,2}(.*?)\*{1,2}/g, '$1') // Rimuovi bold/italic
      .replace(/`{1,3}(.*?)`{1,3}/g, '$1') // Rimuovi code
      .replace(/\n+/g, ' ') // Sostituisci newline con spazi
      .replace(/\s+/g, ' ') // Rimuovi spazi multipli
      .trim()
      .substring(0, maxLength) + (content.length > maxLength ? '...' : '');
  }

  /**
   * Estrae tag dal post
   * @param {Object} post - Dati del post
   * @returns {Array} Array di tag
   */
  extractTags(post) {
    try {
      const metadata = this.parseMetadata(post.json_metadata);
      return metadata?.tags?.slice(0, 5) || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Parse metadata JSON
   * @param {string|Object} metadata - Metadata da parsare
   * @returns {Object} Metadata parsati
   */
  parseMetadata(metadata) {
    try {
      if (typeof metadata === 'string') {
        return JSON.parse(metadata);
      }
      return metadata || {};
    } catch (error) {
      return {};
    }
  }

  /**
   * Aggiorna structured data per SEO
   * @param {Object} metaData - Dati meta
   * @param {string} type - Tipo di contenuto
   */
  updateStructuredData(metaData, type) {
    let structuredData;

    switch (type) {
      case 'post':
        structuredData = {
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          "headline": metaData.title,
          "description": metaData.description,
          "image": metaData.image,
          "url": metaData.url,
          "datePublished": metaData.publishedTime,
          "author": {
            "@type": "Person",
            "name": metaData.author,
            "url": `https://cur8.fun/@${metaData.author}`
          },
          "publisher": {
            "@type": "Organization",
            "name": "cur8.fun",
            "logo": {
              "@type": "ImageObject",
              "url": "https://cur8.fun/assets/img/logo_tra.png"
            }
          }
        };
        break;

      case 'profile':
        structuredData = {
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          "name": metaData.title,
          "description": metaData.description,
          "image": metaData.image,
          "url": metaData.url
        };
        break;

      default:
        structuredData = {
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": metaData.title,
          "description": metaData.description,
          "url": metaData.url
        };
    }

    const scriptTag = document.createElement('script');
    scriptTag.type = 'application/ld+json';
    scriptTag.textContent = JSON.stringify(structuredData);
    document.head.appendChild(scriptTag);
  }

  /**
   * Aggiorna link canonical
   * @param {string} url - URL canonical
   */
  updateCanonicalLink(url) {
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = url;
  }

  /**
   * Debug function per testare l'estrazione delle immagini
   * @param {Object} post - Dati del post
   * @returns {Object} Dettagli dell'estrazione
   */
  debugImageExtraction(post) {
    console.log('🔍 Debug Image Extraction for post:', post.title);
    
    const metadata = this.parseMetadata(post.json_metadata);
    console.log('📋 Metadata:', metadata);
    
    const extractionResults = {
      metadataImage: metadata?.image?.[0] || null,
      metadataThumbnail: metadata?.thumbnail || null,
      markdownImages: [],
      htmlImages: [],
      directImages: [],
      steemImages: []
    };
    
    // Test markdown images
    const markdownRegex = /!\[.*?\]\((https?:\/\/[^\s\)]+)\)/g;
    let match;
    while ((match = markdownRegex.exec(post.body)) !== null) {
      extractionResults.markdownImages.push(match[1]);
    }
    
    // Test HTML images
    const htmlRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    while ((match = htmlRegex.exec(post.body)) !== null) {
      extractionResults.htmlImages.push(match[1]);
    }
    
    // Test direct images
    const directRegex = /(https?:\/\/[^\s<>"']+\.(?:jpg|jpeg|png|gif|webp)(?:\?[^\s<>"']*)?)/gi;
    while ((match = directRegex.exec(post.body)) !== null) {
      extractionResults.directImages.push(match[1]);
    }
    
    // Test Steem images
    const steemRegex = /https?:\/\/(?:steemitimages\.com|images\.hive\.blog|gateway\.pinata\.cloud|ipfs\.io)\/[^\s<>"']+/gi;
    while ((match = steemRegex.exec(post.body)) !== null) {
      extractionResults.steemImages.push(match[1]);
    }
    
    console.log('🖼️ Extraction Results:', extractionResults);
    
    const finalImage = this.extractBestImage(post);
    console.log('✅ Final Selected Image:', finalImage);
    
    return extractionResults;
  }

  /**
   * Genera anteprima URL per test
   * @param {string} url - URL da testare
   * @returns {Object} Link per test anteprime
   */
  getPreviewTestUrls(url) {
    const encodedUrl = encodeURIComponent(url);
    return {
      facebook: `https://developers.facebook.com/tools/debug/?q=${encodedUrl}`,
      twitter: `https://cards-dev.twitter.com/validator?url=${encodedUrl}`,
      linkedin: `https://www.linkedin.com/post-inspector/inspect/${encodedUrl}`,
      whatsapp: `https://developers.facebook.com/tools/debug/?q=${encodedUrl}`,
      telegram: `https://t.me/share/url?url=${encodedUrl}`
    };
  }
}

// Debug helpers - aggiungi alla console globale per testing
if (typeof window !== 'undefined') {
  window.debugMetaTags = function(post) {
    return metaTagService.debugImageExtraction(post);
  };
  
  window.testPreview = function(url) {
    return metaTagService.getPreviewTestUrls(url);
  };
}

export default new MetaTagService();
