import { REGEX_PATTERNS } from '../utils/markdown/regex-config.js';

class RegexService {
  constructor() {
    this.patterns = REGEX_PATTERNS;
  }
  
  createRegex(pattern, flags = 'g') {
    // Reset pattern and create new RegExp instance
    return new RegExp(pattern.source || pattern, flags);
  }
  
  escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  matchAll(text, pattern) {
    const regex = this.createRegex(pattern);
    const matches = [];
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      matches.push(match);
    }
    
    return matches;
  }
  
  testPattern(text, pattern) {
    const regex = this.createRegex(pattern);
    return regex.test(text);
  }
  
  replaceAll(text, pattern, replacement) {
    const regex = this.createRegex(pattern);
    return text.replace(regex, replacement);
  }
}

export default new RegexService();
