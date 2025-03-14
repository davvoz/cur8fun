export const REGEX_PATTERNS = {
  // URL and Media Patterns
  URL: /(https?:\/\/[^\s]+)/g,
  IMAGE: /(https?:\/\/.*\.(?:tiff?|jpe?g|gif|png|svg|ico|heic|webp))(.*)/gim,
  IPFS: /^https?:\/\/[^/]+\/(ip[fn]s)\/([^/?#]+)/gim,
  
  // Post and Community Patterns
  POST: /^https?:\/\/(.*)\/(.*)\/(@[\w.\d-]+)\/(.*)/i,
  CCC: /^https?:\/\/(.*)\/ccc\/([\w.\d-]+)\/(.*)/i,
  MENTION: /^https?:\/\/(.*)\/(@[\w.\d-]+)$/i,
  TOPIC: /^https?:\/\/(.*)\/(trending|hot|created|promoted|muted|payout)\/(.*)$/i,
  
  // Internal Patterns
  INTERNAL_MENTION: /^\/@[\w.\d-]+$/i,
  INTERNAL_TOPIC: /^\/(trending|hot|created|promoted|muted|payout)\/(.*)$/i,
  INTERNAL_POST_TAG: /(.*)\/(@[\w.\d-]+)\/(.*)/i,
  INTERNAL_POST: /^\/(@[\w.\d-]+)\/(.*)$/i,
  
  // Video Platform Patterns
  YOUTUBE: {
    MAIN: /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:&\S+)?/g,
    EMBED: /<iframe[^>]*src=["'](?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})(?:\?[^"'>]+)?["'][^>]*><\/iframe>/g,
    SHORTS: /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})(?:\?\S+)?/g
  },
  VIMEO: {
    MAIN: /(https?:\/\/)?(www\.)?(?:vimeo)\.com.*(?:videos|video|channels|)\/([\d]+)/i,
    EMBED: /https:\/\/player\.vimeo\.com\/video\/([0-9]+)/
  },
  
  // Other Video Platforms
  BITCHUTE: /^(?:https?:\/\/)?(?:www\.)?bitchute.com\/(?:video|embed)\/([a-z0-9]+)/i,
  DTUBE: {
    MAIN: /(https?:\/\/d.tube.#!\/v\/)(\w+)\/(\w+)/g,
    SECONDARY: /(https?:\/\/d.tube\/v\/)(\w+)\/(\w+)/g,
    EMBED: /^https:\/\/emb.d.tube\/.*/i
  },
  
  // Streaming Platforms
  TWITCH: {
    MAIN: /https?:\/\/(?:www.)?twitch.tv\/(?:(videos)\/)?([a-zA-Z0-9][\w]{3,24})/i,
    EMBED: /^(https?:)?\/\/player.twitch.tv\/.*/i
  },
  
  // Music Platforms
  SPOTIFY: {
    MAIN: /^https:\/\/open\.spotify\.com\/playlist\/(.*)?$/gi,
    EMBED: /^https:\/\/open\.spotify\.com\/(embed|embed-podcast)\/(playlist|show|episode|track|album)\/(.*)/i
  },
  SOUNDCLOUD: /^https:\/\/w.soundcloud.com\/player\/.*/i,
  
  // Other Media Platforms 
  DAPPLR: /^(https?:)?\/\/[a-z]*\.dapplr.in\/file\/dapplr-videos\/.*/i,
  TRUVVL: /^https?:\/\/embed.truvvl.com\/(@[\w.\d-]+)\/(.*)/i,
  LBRY: /^(https?:)?\/\/lbry.tv\/\$\/embed\/.*/i,
  ODYSEE: /^(https?:)?\/\/odysee.com\/\$\/embed\/.*/i,
  
  // Misc Patterns
  ENTITY: /&([a-z0-9]+|#[0-9]{1,6}|#x[0-9a-fA-F]{1,6});/ig,
  SECTION: /\B(\#[\da-zA-Z-_]+\b)(?!;)/i
};

export default REGEX_PATTERNS;
