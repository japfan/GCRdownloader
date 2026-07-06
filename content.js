// content.js - Injected into Google Classroom tab

(function() {
  function getFileTypeFromUrl(url) {
    if (!url) return 'unknown';
    const lower = url.toLowerCase();
    if (lower.includes('docs.google.com/document')) return 'document';
    if (lower.includes('docs.google.com/presentation')) return 'presentation';
    if (lower.includes('docs.google.com/spreadsheets')) return 'spreadsheet';
    if (lower.includes('docs.google.com/forms')) return 'form';
    if (lower.includes('docs.google.com/drawings')) return 'drawing';
    if (lower.includes('drive.google.com')) return 'drive_file';
    return 'unknown';
  }

  function refineTypeFromTitle(title, currentType) {
    if (currentType !== 'drive_file' && currentType !== 'unknown') return currentType;
    const lower = title.toLowerCase();
    if (lower.endsWith('.pdf') || lower.includes('.pdf')) return 'pdf';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.gif') || lower.endsWith('.webp')) return 'image';
    if (lower.endsWith('.mp4') || lower.endsWith('.mkv') || lower.endsWith('.webm') || lower.endsWith('.mov')) return 'video';
    if (lower.endsWith('.mp3') || lower.endsWith('.wav') || lower.endsWith('.ogg')) return 'audio';
    if (lower.endsWith('.zip') || lower.endsWith('.rar') || lower.endsWith('.7z')) return 'archive';
    if (lower.endsWith('.doc') || lower.endsWith('.docx')) return 'document';
    if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) return 'spreadsheet';
    if (lower.endsWith('.ppt') || lower.endsWith('.pptx')) return 'presentation';
    // Default: treat unknown drive files as PDF/viewable
    return 'pdf';
  }

  function sanitizeFilename(name) {
    return name.replace(/[<>:"\/\\|?*\x00-\x1F]/g, '').trim();
  }

  function extractIdFromUrl(url) {
    if (!url) return null;

    // Pattern 1: Standard /d/ or /file/d/ or /document/d/ etc.
    let match = url.match(/\/(?:d|file\/d|document\/d|presentation\/d|spreadsheets\/d|forms\/d|drawings\/d|folders?\/?)\/([a-zA-Z0-9_-]{20,60})/);
    if (match) return match[1];

    // Pattern 2: ?id= parameter (e.g., drive.google.com/open?id=...)
    match = url.match(/[?&]id=([a-zA-Z0-9_-]{20,60})/);
    if (match) return match[1];

    // Pattern 3: /a/ domain variant
    match = url.match(/\/a\/[^\/]+\/d\/([a-zA-Z0-9_-]{20,60})/);
    if (match) return match[1];

    return null;
  }

  function extractFiles() {
    const files = [];
    const seenIds = new Set();
    const debugLogs = [];

    function addFile(title, url, fileId) {
      if (!fileId || seenIds.has(fileId)) return;
      if (title === 'Untitled_Material' && url === '#') return; // skip debug placeholder

      seenIds.add(fileId);
      let type = getFileTypeFromUrl(url);
      type = refineTypeFromTitle(title, type);

      files.push({
        url: url,
        title: sanitizeFilename(title) || 'Untitled_Material',
        type: type,
        id: fileId
      });
    }

    // ── HELPER: Extract clean title from an element ──
    function extractTitle(element, fallbackUrl) {
      // Try aria-label first (most reliable on GCR)
      let aria = element.getAttribute('aria-label');
      if (aria) {
        aria = aria.replace(/^(Attachment|Lampiran):\s*/i, '').trim();
        aria = aria.replace(/\s*[-–]\s*(Google (Docs|Sheets|Slides|Drive|Forms|Drawings))$/i, '').trim();
        if (aria.length > 2) return aria;
      }

      // Try direct text of the element
      let text = (element.textContent || element.innerText || '').trim();
      // If it's a link wrapping other elements, text might include a lot of junk
      if (text.length > 0 && text.length < 200) {
        text = text.replace(/\s+/g, ' ').trim();
        if (text.length > 2) return text;
      }

      // Walk up to parent containers and look for title text
      let parent = element.closest('li, [role="listitem"], .aRsW2b, .onkcGd, .yrNSTd, .uVccjd');
      if (!parent) parent = element.parentElement;
      if (parent) {
        // Look for common GCR title elements within the parent
        for (let depth = 0; depth < 5 && parent; depth++) {
          const titleEl = parent.querySelector('[role="heading"], h1, h2, h3, h4, .QRiHXd, .q2K6Rd, .YVvGBb');
          if (titleEl) {
            const t = (titleEl.textContent || '').replace(/\s+/g, ' ').trim();
            if (t.length > 2 && t.length < 200) return t;
          }
          parent = parent.parentElement;
        }
      }

      // Last resort: try to derive from URL
      if (fallbackUrl) {
        const lastPart = fallbackUrl.split('/').pop().split('?')[0];
        if (lastPart && lastPart.length > 2) return decodeURIComponent(lastPart);
      }

      return 'Untitled_Material';
    }

    // ═══════════════════════════════════════════
    // STRATEGY 1: Find all <a> tags with Google URLs
    // ═══════════════════════════════════════════
    try {
      const allLinks = document.querySelectorAll('a[href*="drive.google.com"], a[href*="docs.google.com"]');
      debugLogs.push(`Link scan: ${allLinks.length} Google links found`);

      allLinks.forEach(link => {
        const url = link.href;
        if (!url) return;

        // Skip non-file URLs
        if (url.includes('/folders/') || url.includes('/folder/')) return;
        // Skip empty/placeholder Google URLs
        if (url === 'https://drive.google.com/' || url === 'https://docs.google.com/') return;

        const fileId = extractIdFromUrl(url);
        if (!fileId) {
          debugLogs.push(`  No ID from: ${url.substring(0, 80)}`);
          return;
        }

        const title = extractTitle(link, url);
        addFile(title, url, fileId);
      });

      debugLogs.push(`After link scan: ${files.length} files found`);
    } catch (e) {
      debugLogs.push(`Link scan ERROR: ${e.message}`);
    }

    // ═══════════════════════════════════════════
    // STRATEGY 2: Scan <div>/<li> containers with data attributes
    // ═══════════════════════════════════════════
    try {
      // Google Classroom material items often have these patterns
      const materialContainers = document.querySelectorAll(
        '[data-material-id], [data-coursework-id], [data-announcement-id], ' +
        '[data-stream-item-id], [data-topic-material-id]'
      );

      if (materialContainers.length > 0) {
        debugLogs.push(`Material containers found: ${materialContainers.length}`);

        materialContainers.forEach(container => {
          // Find Google links inside
          const links = container.querySelectorAll('a[href*="drive.google.com"], a[href*="docs.google.com"]');
          links.forEach(link => {
            const url = link.href;
            if (!url || url.includes('/folders/')) return;

            const fileId = extractIdFromUrl(url);
            if (!fileId) return;

            const title = extractTitle(container, url);
            addFile(title, url, fileId);
          });
        });

        debugLogs.push(`After container scan: ${files.length} files found`);
      }
    } catch (e) {
      debugLogs.push(`Container scan ERROR: ${e.message}`);
    }

    // ═══════════════════════════════════════════
    // STRATEGY 3: Deep HTML scan for Drive/Docs URLs in JS data
    // ═══════════════════════════════════════════
    try {
      let pageHtml = document.documentElement.innerHTML;
      debugLogs.push(`HTML size: ${Math.round(pageHtml.length / 1024)} KB`);

      // Normalize escaped slashes
      pageHtml = pageHtml.replace(/\\\//g, '/').replace(/\\u002f/gi, '/');

      // Find all Google Drive/Docs URLs in the raw HTML
      const urlPatterns = [
        /https?:\/\/drive\.google\.com\/(?:open|file\/d|drive\/folders)\?[^"'\s<>]*id=([a-zA-Z0-9_-]{20,60})[^"'\s<>]*/gi,
        /https?:\/\/docs\.google\.com\/(?:document|presentation|spreadsheets|forms|drawings)\/d\/([a-zA-Z0-9_-]{20,60})[^"'\s<>]*/gi,
        /"https?:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{20,60})[^"]*"/gi,
      ];

      urlPatterns.forEach((pattern, patternIdx) => {
        let match;
        while ((match = pattern.exec(pageHtml)) !== null) {
          const fullUrl = match[0].replace(/^["']|["']$/g, '');
          let fileId = match[1];

          // Re-extract with the proper function to be safe
          const extractedId = extractIdFromUrl(fullUrl);
          if (extractedId) fileId = extractedId;

          if (fileId && !seenIds.has(fileId)) {
            // Try to find a title near this URL in the HTML
            const urlPos = match.index;
            const contextBefore = pageHtml.substring(Math.max(0, urlPos - 500), urlPos);

            // Try various title patterns in the surrounding HTML
            let foundTitle = '';

            // Look for text content in nearby elements
            const headingMatch = contextBefore.match(/aria-label="([^"]{2,150})"/i);
            if (headingMatch) foundTitle = headingMatch[1];

            if (!foundTitle) {
              const textMatch = contextBefore.match(/["']([^"']{5,120})["']\s*[,\]\}\)]/);
              if (textMatch && !textMatch[1].startsWith('http')) foundTitle = textMatch[1];
            }

            if (!foundTitle) {
              // Derive from URL path
              foundTitle = fullUrl.split('/').pop()?.split('?')[0] || '';
              if (foundTitle.length < 3) foundTitle = 'Untitled_Material';
            }

            addFile(foundTitle, fullUrl, fileId);
          }
        }
      });

      debugLogs.push(`After HTML scan: ${files.length} files found`);
    } catch (e) {
      debugLogs.push(`HTML scan ERROR: ${e.message}`);
    }

    // ═══════════════════════════════════════════
    // STRATEGY 4: Look for iframe embeds (Google Docs embedded)
    // ═══════════════════════════════════════════
    try {
      const iframes = document.querySelectorAll('iframe[src*="docs.google.com"], iframe[src*="drive.google.com"]');
      debugLogs.push(`Iframe scan: ${iframes.length} found`);

      iframes.forEach(iframe => {
        const url = iframe.src;
        const fileId = extractIdFromUrl(url);
        if (!fileId) return;

        const title = iframe.getAttribute('title') || iframe.getAttribute('aria-label') || 'Embedded_Document';
        addFile(title, url, fileId);
      });

      debugLogs.push(`After iframe scan: ${files.length} files found`);
    } catch (e) {
      debugLogs.push(`Iframe scan ERROR: ${e.message}`);
    }

    // ═══════════════════════════════════════════
    // DEBUG: If nothing found, return diagnostic info
    // ═══════════════════════════════════════════
    if (files.length === 0) {
      const pageTitle = document.title || '';
      const urlHref = window.location.href || '';
      const linkCount = document.querySelectorAll('a').length;
      const allDriveLinks = document.querySelectorAll('a[href*="drive.google.com"], a[href*="docs.google.com"]');

      debugLogs.push(`Page: "${pageTitle}"`);
      debugLogs.push(`URL: ${urlHref}`);
      debugLogs.push(`Total <a> tags: ${linkCount}`);
      debugLogs.push(`Google links in DOM: ${allDriveLinks.length}`);
      if (allDriveLinks.length > 0) {
        debugLogs.push(`Sample: ${allDriveLinks[0].href}`);
      }

      files.push({
        title: `DEBUG: ${debugLogs.join(' | ')}`,
        url: "#",
        type: "unknown",
        id: "debug_no_materials_found"
      });
    }

    return files;
  }

  return extractFiles();
})();
