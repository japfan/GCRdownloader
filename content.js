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
    return 'pdf';
  }

  function sanitizeFilename(name) {
    return name.replace(/[<>:"\/\\|?*\x00-\x1F]/g, '').trim();
  }

  function extractIdFromUrl(url) {
    if (!url) return null;
    let match = url.match(/\/(?:d|file\/d|document\/d|presentation\/d|spreadsheets\/d|forms\/d|drawings\/d|folders?\/?)\/([a-zA-Z0-9_-]{20,100})/);
    if (match) return match[1];
    match = url.match(/\/drive\/folders\/([a-zA-Z0-9_-]{20,100})/);
    if (match) return match[1];
    match = url.match(/[?&]id=([a-zA-Z0-9_-]{20,100})/);
    if (match) return match[1];
    match = url.match(/\/a\/[^\/]+\/d\/([a-zA-Z0-9_-]{20,100})/);
    if (match) return match[1];
    return null;
  }

  function extractTitle(element, fallbackUrl) {
    let aria = element.getAttribute('aria-label');
    if (aria) {
      aria = aria.replace(/^(Attachment|Lampiran):\s*/i, '').trim();
      aria = aria.replace(/\s*[-–]\s*(Google (Docs|Sheets|Slides|Drive|Forms|Drawings))$/i, '').trim();
      if (aria.length > 2) return aria;
    }
    let text = (element.textContent || element.innerText || '').trim();
    if (text.length > 0 && text.length < 200) {
      text = text.replace(/\s+/g, ' ').trim();
      if (text.length > 2) return text;
    }
    let parent = element.closest('li, [role="listitem"], .aRsW2b, .onkcGd, .yrNSTd, .uVccjd');
    if (!parent) parent = element.parentElement;
    if (parent) {
      for (let depth = 0; depth < 5 && parent; depth++) {
        const titleEl = parent.querySelector('[role="heading"], h1, h2, h3, h4, .QRiHXd, .q2K6Rd, .YVvGBb');
        if (titleEl) {
          const t = (titleEl.textContent || '').replace(/\s+/g, ' ').trim();
          if (t.length > 2 && t.length < 200) return t;
        }
        parent = parent.parentElement;
      }
    }
    if (fallbackUrl) {
      const lastPart = fallbackUrl.split('/').pop().split('?')[0];
      if (lastPart && lastPart.length > 2) return decodeURIComponent(lastPart);
    }
    return 'Untitled_Material';
  }

  function extractFiles() {
    const files = [];
    const seenIds = new Set();
    const debugLogs = [];
    let folderCount = 0;

    function addFile(title, url, fileId) {
      if (!fileId || seenIds.has(fileId)) return;
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

    // ═══ STRATEGY 1: <a> tags ═══
    try {
      const allLinks = document.querySelectorAll('a[href*="drive.google.com"], a[href*="docs.google.com"]');
      debugLogs.push(`Link scan: ${allLinks.length} Google links`);

      allLinks.forEach(link => {
        const url = link.href;
        if (!url) return;
        if (url === 'https://drive.google.com/' || url === 'https://docs.google.com/') return;

        // Count folders
        if (url.includes('/folders/') || url.includes('/folder/') || url.includes('/drive/folders')) {
          folderCount++;
          return;
        }

        const fileId = extractIdFromUrl(url);
        if (!fileId) return;

        const title = extractTitle(link, url);
        addFile(title, url, fileId);
      });

      debugLogs.push(`After link scan: ${files.length} files, ${folderCount} folders`);
    } catch (e) {
      debugLogs.push(`Link scan ERROR: ${e.message}`);
    }

    // ═══ STRATEGY 2: Material containers ═══
    try {
      const containers = document.querySelectorAll(
        '[data-material-id], [data-coursework-id], [data-announcement-id], ' +
        '[data-stream-item-id], [data-topic-material-id], [data-post-id], ' +
        '[data-item-id], [data-material-type], [data-content-type], ' +
        'li[class*="aRs"], li[class*="onkc"], li[class*="yrNS"]'
      );

      if (containers.length > 0) {
        debugLogs.push(`Containers: ${containers.length}`);

        containers.forEach(container => {
          // <a> links
          container.querySelectorAll('a[href*="drive.google.com"], a[href*="docs.google.com"]').forEach(link => {
            const url = link.href;
            if (!url || url === 'https://drive.google.com/' || url === 'https://docs.google.com/') return;
            if (url.includes('/folders/') || url.includes('/folder/')) { folderCount++; return; }
            const fileId = extractIdFromUrl(url);
            if (!fileId) return;
            const title = extractTitle(container, url);
            addFile(title, url, fileId);
          });

          // data-url attributes
          container.querySelectorAll('[data-url], [data-href], [data-target-url], [data-link]').forEach(el => {
            let url = el.getAttribute('data-url') || el.getAttribute('data-href') || el.getAttribute('data-target-url') || el.getAttribute('data-link');
            if (!url || !url.includes('google.com')) return;
            if (url.includes('/folders/') || url.includes('/folder/')) { folderCount++; return; }
            const fileId = extractIdFromUrl(url);
            if (!fileId) return;
            const title = extractTitle(container, url);
            addFile(title, url, fileId);
          });
        });

        debugLogs.push(`After container scan: ${files.length} files`);
      }
    } catch (e) {
      debugLogs.push(`Container scan ERROR: ${e.message}`);
    }

    // ═══ STRATEGY 3: Script tags ═══
    try {
      const allScripts = document.querySelectorAll('script:not([src])');
      allScripts.forEach(s => {
        const txt = s.textContent || '';
        if (!txt.includes('drive.google.com') && !txt.includes('docs.google.com')) return;

        const urlRegex = /https?:\/\/(?:drive|docs)\.google\.com\/[^\s"'\\<>]+/gi;
        let match;
        while ((match = urlRegex.exec(txt)) !== null) {
          const url = match[0].replace(/\\\//g, '/');
          if (url.includes('/folders/') || url.includes('/folder/')) continue;
          const fileId = extractIdFromUrl(url);
          if (!fileId || seenIds.has(fileId)) continue;
          seenIds.add(fileId);

          const pos = match.index;
          const nearby = txt.substring(Math.max(0, pos - 300), pos);
          let title = 'Untitled_Material';
          const nm = nearby.match(/"name"\s*:\s*"([^"]+)"/);
          if (nm) title = nm[1];
          if (title === 'Untitled_Material') {
            const tm = nearby.match(/"title"\s*:\s*"([^"]+)"/);
            if (tm) title = tm[1];
          }

          let type = getFileTypeFromUrl(url);
          type = refineTypeFromTitle(title, type);
          files.push({
            url: url,
            title: sanitizeFilename(title),
            type: type,
            id: fileId
          });
        }
      });
      debugLogs.push(`After script scan: ${files.length} files`);
    } catch (e) {
      debugLogs.push(`Script scan ERROR: ${e.message}`);
    }

    // ═══ STRATEGY 4: Deep HTML scan ═══
    try {
      let pageHtml = document.documentElement.innerHTML.replace(/\\\//g, '/').replace(/\\u002f/gi, '/');
      debugLogs.push(`HTML: ${Math.round(pageHtml.length / 1024)} KB`);

      const patterns = [
        /https?:\/\/drive\.google\.com\/(?:open|file\/d)\?[^"'\s<>]*id=([a-zA-Z0-9_-]{20,60})[^"'\s<>]*/gi,
        /https?:\/\/docs\.google\.com\/(?:document|presentation|spreadsheets|forms|drawings)\/d\/([a-zA-Z0-9_-]{20,60})[^"'\s<>]*/gi,
        /"https?:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{20,60})[^"]*"/gi,
        /"https?:\/\/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]{20,60})[^"]*"/gi,
        /https?:\/\/(?:drive|docs)\.google\.com\/[^"'\s<>]*?\/d\/([a-zA-Z0-9_-]{20,60})[^"'\s<>]*/gi,
      ];

      patterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(pageHtml)) !== null) {
          const fullUrl = match[0].replace(/^["']|["']$/g, '');
          if (fullUrl.includes('/folders/')) continue;
          const fileId = match[1];
          if (!fileId || seenIds.has(fileId)) continue;
          seenIds.add(fileId);

          const ctx = pageHtml.substring(Math.max(0, match.index - 400), match.index);
          let title = '';
          const nm = ctx.match(/"name"\s*:\s*"([^"]{2,150})"/);
          if (nm) title = nm[1];
          if (!title) {
            const tm = ctx.match(/"title"\s*:\s*"([^"]{2,150})"/);
            if (tm) title = tm[1];
          }
          if (!title) title = fullUrl.split('/').pop()?.split('?')[0] || 'Untitled_Material';

          let type = getFileTypeFromUrl(fullUrl);
          type = refineTypeFromTitle(title, type);
          files.push({
            url: fullUrl,
            title: sanitizeFilename(title),
            type: type,
            id: fileId
          });
        }
      });
      debugLogs.push(`After HTML scan: ${files.length} files`);
    } catch (e) {
      debugLogs.push(`HTML scan ERROR: ${e.message}`);
    }

    // ═══ STRATEGY 5: Iframe embeds ═══
    try {
      document.querySelectorAll('iframe[src*="docs.google.com"], iframe[src*="drive.google.com"]').forEach(iframe => {
        const url = iframe.src;
        if (url.includes('/folders/')) return;
        const fileId = extractIdFromUrl(url);
        if (!fileId || seenIds.has(fileId)) return;
        seenIds.add(fileId);
        const title = iframe.getAttribute('title') || iframe.getAttribute('aria-label') || 'Embedded_Document';
        addFile(title, url, fileId);
      });
    } catch (e) {}

    // ═══ Count folders in raw HTML too ═══
    if (folderCount === 0) {
      try {
        const folderMatches = document.documentElement.innerHTML.match(/drive\.google\.com\/[^"'\s]*folders?\/[a-zA-Z0-9_-]{20,}/gi);
        if (folderMatches) folderCount = folderMatches.length;
      } catch (e) {}
    }

    // ═══ Return result ═══
    if (files.length === 0) {
      if (folderCount > 0) {
        // Short message: only folders found
        files.push({
          title: `FOLDER_ONLY:${folderCount}`,
          url: '#',
          type: 'folder_warning',
          id: 'folders_only'
        });
      } else {
        // Nothing found at all — debug info
        files.push({
          title: `DEBUG: ${debugLogs.join(' | ')} | URL: ${window.location.href}`,
          url: '#',
          type: 'unknown',
          id: 'debug_no_materials_found'
        });
      }
    }

    return files;
  }

  return extractFiles();
})();
