import { MediaHandlers } from './media-handlers.js';

export class TableHandler {
  static parseCells(row) {
    return row.split('|')
      .map(cell => cell.trim())
      .filter(cell => cell.length > 0);
  }

  static isSeparatorRow(row) {
    return row.replace(/[|\s-]/g, '').length === 0;
  }

  static processTable(tableMatch) {
    try {
      const rows = tableMatch.split('\n').filter(row => row.trim());
      if (rows.length < 3) return tableMatch;

      let tableHtml = ['<table class="markdown-table">'];
      let headerProcessed = false;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (this.isSeparatorRow(row)) continue;

        const cells = this.parseCells(row);
        
        if (!headerProcessed) {
          tableHtml.push(this.generateHeader(cells));
          headerProcessed = true;
        } else {
          tableHtml.push(this.generateRow(cells));
        }
      }

      tableHtml.push('</tbody></table>');
      return tableHtml.join('');
    } catch (error) {
      console.error('Error parsing table:', error);
      return tableMatch;
    }
  }

  static generateHeader(cells) {
    return '<thead><tr>' + 
           cells.map(cell => `<th>${cell}</th>`).join('') +
           '</tr></thead><tbody>';
  }

  static generateRow(cells) {
    return '<tr>' +
           cells.map(cell => `<td>${this.processCellContent(cell)}</td>`).join('') +
           '</tr>';
  }

  static processCellContent(cell) {
    return cell.trim()
      .replace(/<a[^>]*><img[^>]*><\/a>/g, '')
      .replace(/(https:\/\/cdn\.steemitimages\.com\/[^\s]+)/gi, url => MediaHandlers.generateMediaTag(url));
  }
  
  // Special table handling methods for custom formatting
  static processCenteredDivWithTableMarker(html) {
    return html.replace(
      /<center><div class=([^>]+)>([^<]+)<\/div><\/center>\s*\|\s*-\s*\|/g,
      (_, className, content) => {
        return `<table class="markdown-table">
          <thead>
            <tr>
              <th><div class=${className}>${content}</div></th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>`;
      }
    );
  }

  static processCenteredTextWithTableMarker(html) {
    return html.replace(
      /<center>([^<]+)<\/center>\s*\|\s*-\s*\|/g,
      (_, content) => {
        return `<table class="markdown-table">
          <thead>
            <tr>
              <th><center>${content}</center></th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>`;
      }
    );
  }

  static cleanupTableMarkers(html) {
    // Clean up newlines between center and table markers
    html = html.replace(
      /(<center>.*?<\/center>)\s*\|\s*-\s*\|/g,
      '$1|-|'
    );
    
    return html;
  }

  static processCenteredContentWithTableMarkers(html) {
    // Transform centered content followed by table markers
    html = html.replace(
      /(<center>(.*?)<\/center>)\|-\|/g,
      (match, centerTag, content) => {
        return `<table class="markdown-table">
          <thead>
            <tr>
              <th>${content}</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>`;
      }
    );
    
    return html;
  }

  static normalizeTableMarkersAfterCenteredContent(html) {
    return html.replace(
      /(<center>.*?<\/center>)\s*\|\s*-+\s*\|/g,
      (match, centerContent) => {
        const content = centerContent.replace(/<\/?center>/g, '').trim();
        return `<table class="markdown-table">
          <thead>
            <tr>
              <th>${content}</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>`;
      }
    );
  }

  static processCenteredContentWithNewlineTableMarker(html) {
    return html.replace(
      /(<center>([^<]+)<\/center>)\s*\|\s*\n\s*-/g,
      (_, centerTag, content) => {
        return `<table class="markdown-table">
          <thead>
            <tr>
              <th>${content}</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>`;
      }
    );
  }

  static removeRemainingPipeDashMarkers(html) {
    return html.replace(/\|\s*\n\s*-/g, '');
  }
  
  // Main method to process all table-related content
  static processAllTables(html) {
    // Process special table cases
    html = this.processCenteredDivWithTableMarker(html);
    html = this.processCenteredTextWithTableMarker(html);
    html = this.cleanupTableMarkers(html);
    html = this.processCenteredContentWithTableMarkers(html);
    html = this.normalizeTableMarkersAfterCenteredContent(html);
    html = this.processCenteredContentWithNewlineTableMarker(html);
    html = this.removeRemainingPipeDashMarkers(html);
    
    // Process regular tables
    html = html.replace(
      /([^\n]+\|[^\n]+)(\n[-|\s]+\n)([^\n]*\|[^\n]*\n?)+/g,
      match => this.processTable(match)
    );
    
    return html;
  }
}
