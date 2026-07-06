// content.js - Injected into Google Classroom tab

(function() {
  function getFileTypeFromUrl(url) {
    if (url.includes('docs.google.com/document')) return 'document';
    if (url.includes('docs.google.com/presentation')) return 'presentation';
    if (url.includes('docs.google.com/spreadsheets')) return 'spreadsheet';
    if (url.includes('docs.google.com/forms')) return 'form';
    
    // For drive links, try to guess if it's a PDF or video from title later, 
    // but default to 'unknown' or 'drive_file' for now.
    return 'unknown';
  }

  function sanitizeFilename(name) {
    // Remove invalid characters for filenames
    return name.replace(/[<>:"\/\\|?*\x00-\x1F]/g, '').trim();
  }

  function extractFiles() {
    const files = [];
    const seenIds = new Set();

    function addFile(title, url, fileId) {
      if (!fileId || seenIds.has(fileId)) return;
      seenIds.add(fileId);
      
      let type = getFileTypeFromUrl(url);
      if (type === 'unknown') {
        const lowerTitle = title.toLowerCase();
        if (lowerTitle.endsWith('.pdf')) type = 'pdf';
        else if (lowerTitle.endsWith('.jpg') || lowerTitle.endsWith('.png') || lowerTitle.endsWith('.jpeg')) type = 'image';
        else if (lowerTitle.endsWith('.mp4') || lowerTitle.endsWith('.mkv')) type = 'video';
        else if (lowerTitle.endsWith('.zip') || lowerTitle.endsWith('.rar')) type = 'archive';
      }

      files.push({
        url: url,
        title: sanitizeFilename(title) || 'Untitled_Material',
        type: type,
        id: fileId
      });
    }

    // STRATEGY 1: DOM Elements (Aria-labels and links)
    // Classroom often uses aria-label="Attachment: Filename" for attachment cards
    const elements = document.querySelectorAll('[aria-label*="Attachment" i], [aria-label*="Lampiran" i], a[href]');
    
    elements.forEach(el => {
      let title = el.getAttribute('aria-label') || el.innerText.trim();
      if (title.toLowerCase().startsWith('attachment:')) title = title.substring(11).trim();
      else if (title.toLowerCase().startsWith('lampiran:')) title = title.substring(9).trim();
      title = title.replace(/\s*-\s*Google (Docs|Sheets|Slides|Drive)$/i, '').trim();

      const html = el.outerHTML;
      let url = el.href || '';
      let fileId = extractIdFromUrl(url);

      // If no ID in href, search the outerHTML of this element (e.g., thumbnail img src or jsdata)
      if (!fileId) {
        const urlMatch = html.match(/https?:\/\/(?:drive|docs)\.google\.com\/[^"'\s]+/i);
        if (urlMatch) {
          url = urlMatch[0];
          fileId = extractIdFromUrl(url);
        }
      }
      
      // As a last resort, look for an ID in the thumbnail query param
      if (!fileId) {
        const idMatch = html.match(/[?&]id=([a-zA-Z0-9_-]{25,35})/);
        if (idMatch) {
          fileId = idMatch[1];
          url = `https://drive.google.com/file/d/${fileId}/view`;
        }
      }

      if (fileId && title) {
        addFile(title, url, fileId);
      }
    });

    // STRATEGY 2: Raw HTML / JS Data Scraping (Catches collapsed/unexpanded materials)
    // Google injects data in script tags. We regex the whole document for Drive URLs.
    const pageHtml = document.documentElement.innerHTML;
    // Look for patterns like: ["Title.pdf", "https://drive.google.com/file/d/ID/view"]
    // Or just the URLs themselves
    const urlRegex = /https:\/\/(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?id=|document\/d\/|presentation\/d\/|spreadsheets\/d\/)([a-zA-Z0-9_-]{25,35})/gi;
    
    let match;
    while ((match = urlRegex.exec(pageHtml)) !== null) {
      const fullUrl = match[0];
      const fileId = match[1];
      
      if (!seenIds.has(fileId)) {
        // Try to find the title nearby in the HTML (usually right before the URL in JSON arrays)
        // Extract a chunk of text before the URL
        const snippetIndex = Math.max(0, match.index - 150);
        const snippet = pageHtml.substring(snippetIndex, match.index);
        
        let foundTitle = "Untitled_Material";
        // Look for a string in quotes that might be the filename
        const titleMatch = snippet.match(/"([^"]+\.(?:pdf|docx?|xlsx?|pptx?|jpg|png|mp4|zip))"/i);
        if (titleMatch) {
          foundTitle = titleMatch[1];
        } else {
          // If no extension, just try to grab the string immediately preceding it in the JSON array
          const genericTitleMatch = snippet.match(/,?"([^"]+)",\s*\[?$/);
          if (genericTitleMatch) foundTitle = genericTitleMatch[1];
        }

        addFile(foundTitle, fullUrl, fileId);
      }
    }

    return files;
  }

  function extractIdFromUrl(url) {
    if (!url) return null;
    let match = url.match(/\/d\/([a-zA-Z0-9_-]{25,35})/);
    if (match) return match[1];
    
    match = url.match(/[?&]id=([a-zA-Z0-9_-]{25,35})/);
    return match ? match[1] : null;
  }

  // Execute and return directly for chrome.scripting.executeScript
  return extractFiles();
})();
