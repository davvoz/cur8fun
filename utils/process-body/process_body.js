function transformSteemitLinks(html) {
    // Transform steemit.com links with community tags to our app format
    return html.replace(
        /https:\/\/steemit\.com\/[^\/]+\/@([^\/]+)\/([^\/\s"']+)/gi,
        (match, author, permlink) => {
            if (author && permlink) {
                return `#/post/${author}/${permlink}`;
            }
            return match;
        }
    ).replace(
        /https:\/\/steemit\.com\/@([^\/\s"']+)/gi,
        (match, username) => {
            // Transform profile links
            return `#/profile/${username}`;
        }
    );
}

export function generatePostContent(htmlContent) {
    console.log(htmlContent);
    
    // Transform Steemit links before any other transformations
    htmlContent = transformSteemitLinks(htmlContent);
    
    // Add this at the very beginning of the function, before any other transformations
    // Handle raw image URLs first
    htmlContent = htmlContent.replace(
        /(https?:\/\/(?:[a-z0-9-]+\.)*(?:postimg\.cc|imgur\.com|ibb\.co)[^\s<>"']+\.(?:jpg|jpeg|png|gif|webp))(?:\s|$)/gi,
        (match, url) => `<img src="${url}" alt="image" class="content-image">`
    );

    // Add this near the beginning of the function, after the initial transformations
    
    // Handle nested CDN image links first
    htmlContent = htmlContent.replace(
        /<a[^>]*href="(https:\/\/(?:steemitimages\.com|cdn\.steemitimages\.com)\/\d+x\d+\/[^"]+)"[^>]*>[^<]*<\/a>/gi,
        (match, url) => generateMediaTag(url)
    );

    // Handle any remaining direct image links
    htmlContent = htmlContent.replace(
        /https:\/\/(?:steemitimages\.com|cdn\.steemitimages\.com)\/\d+x\d+\/[^\s<>"']+/gi,
        url => generateMediaTag(url)
    );
    
    let convertedHtml = typeof marked !== 'undefined' ? marked.parse(htmlContent) : htmlContent;
    console.log(convertedHtml);

    function parseCells(row) {
        return row.split('|')
            .map(cell => cell.trim())
            .filter(cell => cell.length > 0);
    }

    function isSeparatorRow(row) {
        return row.replace(/[|\s-]/g, '').length === 0;
    }

    function generateMediaTag(url, alt = '') {
        // Decode URL to handle encoded characters
        let decodedUrl = decodeURIComponent(url);

        // Handle nested Steem CDN URLs with dimensions
        const nestedCdnRegex = /https:\/\/(?:steemitimages\.com|cdn\.steemitimages\.com)\/(?:\d+x\d+\/)?(?:https:\/\/(?:steemitimages\.com|cdn\.steemitimages\.com)\/[^"]+)/;
        const match = decodedUrl.match(nestedCdnRegex);
        if (match) {
            // Extract the base URL by removing any dimension specifications
            decodedUrl = decodedUrl.replace(/https:\/\/(?:steemitimages\.com|cdn\.steemitimages\.com)\/(?:\d+x\d+\/)?/, '');
            // If it starts with another CDN URL, clean that up too
            decodedUrl = decodedUrl.replace(/^https:\/\/(?:steemitimages\.com|cdn\.steemitimages\.com)\//, '');
            // Add back the CDN prefix
            decodedUrl = 'https://cdn.steemitimages.com/' + decodedUrl;
        }

        // Handle simple dimension-only URLs
        const dimensionRegex = /https:\/\/(?:steemitimages\.com|cdn\.steemitimages\.com)\/\d+x\d+\/([^"]+)/;
        const dimensionMatch = decodedUrl.match(dimensionRegex);
        if (dimensionMatch) {
            decodedUrl = 'https://cdn.steemitimages.com/' + dimensionMatch[1];
        }

        if (decodedUrl.match(/\.(mp4|webm|ogg)$/i)) {
            return `<video controls><source src="${decodedUrl}" type="video/${decodedUrl.split('.').pop()}">Your browser does not support the video tag.</video>`;
        } else if (decodedUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            return `<img src="${decodedUrl}" 
                        alt="${alt || 'image'}" 
                        class="content-image"
                        onerror="this.onerror=null; this.src='/images/broken-image.png'; this.classList.add('broken-image');">`;
        }
        return `<a href="${decodedUrl}" target="_blank">${decodedUrl}</a>`;
    }

    // First, handle all image patterns - BEFORE any other transformations

    // 1. Handle centered images first
    convertedHtml = convertedHtml.replace(
        /<center>!\[([^\]]*)\]\(([^)]+)\)<\/center>/g,
        (_, alt, url) => {
            if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                return `<center><img src="${url}" alt="${alt || 'image'}" class="content-image"></center>`;
            }
            return `<center>${generateMediaTag(url, alt)}</center>`;
        }
    );

    // 2. Handle non-centered images with CDN resize URL pattern
    convertedHtml = convertedHtml.replace(
        /!\[([^\]]*)\]\((https:\/\/cdn\.steemitimages\.com\/\d+x\d+\/[^)]+)\)/g,
        (_, alt, url) => {
            if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                return `<img src="${url}" alt="${alt || 'image'}" class="content-image">`;
            }
            return generateMediaTag(url, alt);
        }
    );

    // 3. Handle regular images
    convertedHtml = convertedHtml.replace(
        /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g,
        (_, alt, url) => {
            if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                return `<img src="${url}" alt="${alt || 'image'}" class="content-image">`;
            }
            return generateMediaTag(url, alt);
        }
    );

    // Handle standalone CDN URLs and text formatting at the start
    convertedHtml = convertedHtml.replace(
        /(<div[^>]*>)?\s*(https:\/\/cdn\.steemitimages\.com\/[^\s<>"]+?\.(?:jpg|jpeg|png|gif|webp|mp4|webm|ogg))(?:\s|$)/gi,
        (match, divTag, url) => {
            const mediaTag = generateMediaTag(url);
            if (divTag) {
                // If URL was in a div, keep the div
                return `${divTag}${mediaTag}`;
            }
            return mediaTag;
        }
    );

    // Handle text with pull-left/pull-right classes
    convertedHtml = convertedHtml.replace(
        /<div\s+class=["']?pull-(left|right)["']?>(https:\/\/cdn\.steemitimages\.com\/[^\s<>"]+?\.(?:jpg|jpeg|png|gif|webp|mp4|webm|ogg))<\/div>/gi,
        (match, position, url) => {
            return `<div class="pull-${position}">${generateMediaTag(url)}</div>`;
        }
    );

    // Handle centered markdown images with proper alt text
    convertedHtml = convertedHtml.replace(
        /<center>!\[([^\]]+)\]\((https:\/\/cdn\.steemitimages\.com\/[^\s<>"]+?\.(?:jpg|jpeg|png|gif|webp|mp4|webm|ogg))\)<\/center>/gi,
        (match, alt, url) => {
            return `<center>${generateMediaTag(url, alt)}</center>`;
        }
    );

    // Handle text with sup tags in center
    convertedHtml = convertedHtml.replace(
        /<center><sup>\*\*([^*]+)\*\*<\/sup><\/center>/g,
        (_, text) => `<center><sup><strong>${text}</strong></sup></center>`
    );

    // Then handle all other transformations

    // Handle special case of centered div with class followed by table marker
    convertedHtml = convertedHtml.replace(
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
    //se troviamo | |- dopo un center allora dobbiamo trasformare il tutto in una tabella con una sola colonna e una riga
    //bonifichiamo precedentemente il | |- da eventuali end line
    

    // Handle special case of centered text followed by table marker
    convertedHtml = convertedHtml.replace(
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

    // Clean up newlines between center and table markers
    convertedHtml = convertedHtml.replace(
        /(<center>.*?<\/center>)\s*\|\s*-\s*\|/g,
        '$1|-|'
    );

    // Transform centered content followed by table markers into a single-column table
    convertedHtml = convertedHtml.replace(
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

    // First clean up and normalize table markers after centered content
    convertedHtml = convertedHtml.replace(
        /(<center>.*?<\/center>)\s*\|\s*-+\s*\|/g,
        (match, centerContent) => {
            // Extract the content from center tags
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

    // Handle specific case of centered content followed by table markers with newline
    convertedHtml = convertedHtml.replace(
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

    // Remove any remaining pipe/dash markers
    convertedHtml = convertedHtml.replace(/\|\s*\n\s*-/g, '');

    // Handle any remaining regular tables
    convertedHtml = convertedHtml.replace(
        /([^\n]+\|[^\n]+)(\n[-|\s]+\n)([^\n]*\|[^\n]*\n?)+/g,
        (match) => {
            try {
                const rows = match.split('\n').filter(row => row.trim());
                if (rows.length < 3) return match;

                let tableHtml = ['<table class="markdown-table">'];
                let headerProcessed = false;

                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    if (isSeparatorRow(row)) continue;

                    const cells = parseCells(row);

                    if (!headerProcessed) {
                        tableHtml.push('<thead><tr>');
                        cells.forEach(cell => {
                            tableHtml.push(`<th>${cell}</th>`);
                        });
                        tableHtml.push('</tr></thead><tbody>');
                        headerProcessed = true;
                    } else {
                        tableHtml.push('<tr>');
                        cells.forEach(cell => {
                            // First, clean up any existing partial conversions
                            let cleanCell = cell.replace(/<a[^>]*><img[^>]*><\/a>/g, '');

                            // Process CDN URLs in the cell
                            cleanCell = cleanCell.replace(
                                /(https:\/\/cdn\.steemitimages\.com\/(?:\d+x\d+\/)?[^\s]+?\.(?:jpg|jpeg|png|gif|webp|mp4|webm|ogg))(?:\s+|$)/gi,
                                (match, url) => generateMediaTag(url) + ' '
                            );

                            tableHtml.push(`<td>${cleanCell.trim()}</td>`);
                        });
                        tableHtml.push('</tr>');
                    }
                }

                tableHtml.push('</tbody></table>');
                return tableHtml.join('');
            } catch (error) {
                console.error('Error parsing table:', error);
                return match;
            }
        }
    );

    // Other transformations
    convertedHtml = convertedHtml.replace(
        /<center>\s*\*([^\*]+)\*\s*<\/center>/g,
        (_, text) => `<center><strong>${text}</strong></center>`
    );

    convertedHtml = convertedHtml.replace(
        /<a\s+href="([^"]+\.(mp4|webm|ogg))">\s*\1\s*<\/a>/gi,
        (_, url) => generateMediaTag(url)
    );

    convertedHtml = convertedHtml.replace(
        /\*\*([^\*]+)\*\*/g,
        (_, text) => `<strong>${text}</strong>`
    );
    //convertiamo il center che precede un <center>SPUNTI DI RIFLESSIONE</center> |
    //|-
    //in una tabella con una sola colonna e una riga





    convertedHtml = convertedHtml.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        (_, text, url) => {
            if (url.match(/\.(mp4|webm|ogg)$/i)) {
                return generateMediaTag(url);
            }
            return `<a href="${url}" target="_blank">${text} <i class="fas fa-external-link-alt"></i></a>`;
        }
    );

    //per tutti i link a che sono immagini o video convertirli in tag img o video
    //sono cose del genere : <center><a href="https://cdn.steemitimages.com/DQmaaNuF8gaoBCnFXZ2atqX8RbaceziqKXatioiUEQZHMMm/Progetto senza titolo (10" target="_blank">https://cdn.steemitimages.com/DQmaaNuF8gaoBCnFXZ2atqX8RbaceziqKXatioiUEQZHMMm/Progetto senza titolo (10</a>.jpg)</center>
    //fai attenzione ai doppi apici

    // Handle direct links to media files that are broken across elements
    convertedHtml = convertedHtml.replace(
        /<center>(?:<a[^>]+>)?(https:\/\/cdn\.steemitimages\.com\/[^<]+)<\/a>([^<]*\.(?:jpg|jpeg|png|gif|webp|mp4|webm|ogg))<\/center>/gi,
        (match, url, extension) => {
            const fullUrl = url + extension;
            return `<center>${generateMediaTag(fullUrl)}</center>`;
        }
    );

    // Also handle non-centered media links
    convertedHtml = convertedHtml.replace(
        /(?:<a[^>]+>)?(https:\/\/cdn\.steemitimages\.com\/[^<]+)<\/a>([^<]*\.(?:jpg|jpeg|png|gif|webp|mp4|webm|ogg))/gi,
        (match, url, extension) => {
            const fullUrl = url + extension;
            return generateMediaTag(fullUrl);
        }
    );

    function replaceLinInMediaTag(match, url) {
        return generateMediaTag(url);
    }

    // Handle direct links to media files that are broken across elements
    convertedHtml = convertedHtml.replace(
        /<center>(?:<a[^>]+>)?([^<]+)<\/a>([^<]*\.(?:jpg|jpeg|png|gif|webp|mp4|webm|ogg))<\/center>/gi,
        replaceLinInMediaTag
    );

    // Also handle non-centered media links
    convertedHtml = convertedHtml.replace(
        /(?:<a[^>]+>)?([^<]+)<\/a>([^<]*\.(?:jpg|jpeg|png|gif|webp|mp4|webm|ogg))/gi,
        replaceLinInMediaTag
    );

    // Handle URLs within paragraph tags
    convertedHtml = convertedHtml.replace(
        /<p><a[^>]*>(https:\/\/cdn\.steemitimages\.com\/[^<]+?\.(?:jpg|jpeg|png|gif|webp|mp4|webm|ogg))<\/a><\/p>/gi,
        (match, url) => `<p>${generateMediaTag(url)}</p>`
    );

    // Handle URLs followed by centered captions
    convertedHtml = convertedHtml.replace(
        /(<p>(?:<a[^>]*>)?https:\/\/cdn\.steemitimages\.com\/[^<]+?\.(?:jpg|jpeg|png|gif|webp|mp4|webm|ogg)(?:<\/a>)?<\/p>)\s*<center><sup><strong>([^<]+)<\/strong><\/sup><\/center>/gi,
        (match, imgPart, caption) => {
            const url = imgPart.replace(/<\/?[^>]+(>|$)/g, '');
            return `<figure>
                ${generateMediaTag(url)}
                <figcaption><center><sup><strong>${caption}</strong></sup></center></figcaption>
            </figure>`;
        }
    );

    // Handle URLs in pull-left/right divs without anchor tags
    convertedHtml = convertedHtml.replace(
        /<div\s+class=["']?pull-(left|right)["']?>\s*(https:\/\/cdn\.steemitimages\.com\/[^<\s]+?\.(?:jpg|jpeg|png|gif|webp|mp4|webm|ogg))\s*<\/div>/gi,
        (match, position, url) => `<div class="pull-${position}">${generateMediaTag(url)}</div>`
    );

    // Handle markdown images in center tags (without creating nested tags)
    convertedHtml = convertedHtml.replace(
        /<center>!\[[^\]]*\]\((https:\/\/cdn\.steemitimages\.com\/[^)]+)\)<\/center>/gi,
        (match, url) => `<center>${generateMediaTag(url)}</center>`
    );

    // Handle text-justify div wrapper
    convertedHtml = convertedHtml.replace(
        /<div class="text-justify">([\s\S]*?)<\/div>/gi,
        (match, content) => `<div class="text-justify">${content}</div>`
    );

    // Handle <a> tags where href and text content are the same CDN URL
    convertedHtml = convertedHtml.replace(
        /<a\s+href="(https:\/\/cdn\.steemitimages\.com\/[^"]+)">[^<]*?cdn\.steemitimages\.com\/[^<]+<\/a>/gi,
        (_, url) => generateMediaTag(url)
    );

    // More aggressive URL matching inside <a> tags
    convertedHtml = convertedHtml.replace(
        /<a[^>]*>(https:\/\/cdn\.steemitimages\.com\/[^<]+)<\/a>/gi,
        (_, url) => generateMediaTag(url)
    );

    //il center che precedede un | |- deve essere una tabella con una sola colonna e una riga

    // Final pass: Convert content followed by | and - markers
    convertedHtml = convertedHtml.replace(
        /(<center>[^<]+<\/center>)\s*\|\s*\n\s*-/g,
        (match, centerContent) => {
            // Clean the center content and convert to table
            return `<table class="markdown-table">
                <thead>
                    <tr>
                        <th>${centerContent}</th>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>`;
        }
    );

    // Transform links in the final converted HTML again
    // This catches any links that might have been generated during markdown conversion
    convertedHtml = transformSteemitLinks(convertedHtml);

    return `<div class="post-content">
        <div class="post-body markdown-content">${convertedHtml}</div>
    </div>`;
}