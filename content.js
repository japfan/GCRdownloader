// content.js — Multi-platform scraper (Google Classroom + SPADA/Moodle)

(function() {
  const host = window.location.hostname;

  // ═════════════════════════════════════════════════════
  //  DISPATCHER
  // ═════════════════════════════════════════════════════
  if (host === 'classroom.google.com') {
    return scrapeGoogleClassroom();
  }
  if (host === 'spada.uns.ac.id') {
    return scrapeMoodle();
  }
  // Generic Moodle: any domain with "/course/view.php" or "/mod/" in URL
  if (window.location.pathname.includes('/course/view.php') ||
      window.location.pathname.includes('/mod/') ||
      document.querySelector('li.activity, li.section, .course-content')) {
    return scrapeMoodle();
  }
  // Unsupported
  return [{
    title: 'DEBUG: Unsupported page. Buka Google Classroom atau SPADA course page.',
    url: '#',
    type: 'unknown',
    id: 'debug_unsupported_page'
  }];

  // ═════════════════════════════════════════════════════
  //  SHARED UTILITIES
  // ═════════════════════════════════════════════════════
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

  function getFileTypeFromExtension(filename) {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.pdf')) return 'pdf';
    if (lower.endsWith('.doc') || lower.endsWith('.docx')) return 'document';
    if (lower.endsWith('.ppt') || lower.endsWith('.pptx')) return 'presentation';
    if (lower.endsWith('.xls') || lower.endsWith('.xlsx')) return 'spreadsheet';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.gif') || lower.endsWith('.webp')) return 'image';
    if (lower.endsWith('.mp4') || lower.endsWith('.mkv') || lower.endsWith('.webm') || lower.endsWith('.mov')) return 'video';
    if (lower.endsWith('.mp3') || lower.endsWith('.wav') || lower.endsWith('.ogg')) return 'audio';
    if (lower.endsWith('.zip') || lower.endsWith('.rar') || lower.endsWith('.7z')) return 'archive';
    if (lower.endsWith('.txt') || lower.endsWith('.csv')) return 'document';
    return 'unknown';
  }

  function sanitizeFilename(name) {
    return name.replace(/[<>:"\/\\|?*\x00-\x1F]/g, '').trim();
  }

  // ═════════════════════════════════════════════════════
  //  GOOGLE CLASSROOM SCRAPER (existing, unchanged)
  // ═════════════════════════════════════════════════════
  function scrapeGoogleClassroom() {
    function refineTypeFromTitle(title, currentType) {
      if (currentType !== 'drive_file' && currentType !== 'unknown') return currentType;
      return getFileTypeFromExtension(title) !== 'unknown' ? getFileTypeFromExtension(title) : 'pdf';
    }

    function extractIdFromUrl(url) {
      if (!url) return null;
      let m = url.match(/\/(?:d|file\/d|document\/d|presentation\/d|spreadsheets\/d|forms\/d|drawings\/d|folders?\/?)\/([a-zA-Z0-9_-]{20,100})/);
      if (m) return m[1];
      m = url.match(/\/drive\/folders\/([a-zA-Z0-9_-]{20,100})/);
      if (m) return m[1];
      m = url.match(/[?&]id=([a-zA-Z0-9_-]{20,100})/);
      if (m) return m[1];
      m = url.match(/\/a\/[^\/]+\/d\/([a-zA-Z0-9_-]{20,100})/);
      if (m) return m[1];
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

    const files = [];
    const seenIds = new Set();
    const debugLogs = [];
    let folderCount = 0;

    function addFile(title, url, fileId) {
      if (!fileId || seenIds.has(fileId)) return;
      seenIds.add(fileId);
      let type = getFileTypeFromUrl(url);
      type = refineTypeFromTitle(title, type);
      files.push({ url, title: sanitizeFilename(title) || 'Untitled_Material', type, id: fileId });
    }

    // Strategy 1: <a> tags
    try {
      const allLinks = document.querySelectorAll('a[href*="drive.google.com"], a[href*="docs.google.com"]');
      debugLogs.push(`Link scan: ${allLinks.length} Google links`);
      allLinks.forEach(link => {
        const url = link.href;
        if (!url || url === 'https://drive.google.com/' || url === 'https://docs.google.com/') return;
        if (url.includes('/folders/') || url.includes('/folder/') || url.includes('/drive/folders')) { folderCount++; return; }
        const fileId = extractIdFromUrl(url);
        if (!fileId) return;
        addFile(extractTitle(link, url), url, fileId);
      });
      debugLogs.push(`After link scan: ${files.length} files, ${folderCount} folders`);
    } catch (e) { debugLogs.push(`Link scan ERROR: ${e.message}`); }

    // Strategy 2: Material containers
    try {
      const containers = document.querySelectorAll(
        '[data-material-id], [data-coursework-id], [data-announcement-id], ' +
        '[data-stream-item-id], [data-topic-material-id], [data-post-id], ' +
        '[data-item-id], [data-material-type], [data-content-type], ' +
        'li[class*="aRs"], li[class*="onkc"], li[class*="yrNS"]'
      );
      if (containers.length > 0) {
        containers.forEach(container => {
          container.querySelectorAll('a[href*="drive.google.com"], a[href*="docs.google.com"]').forEach(link => {
            const url = link.href;
            if (!url || url === 'https://drive.google.com/' || url === 'https://docs.google.com/') return;
            if (url.includes('/folders/') || url.includes('/folder/')) { folderCount++; return; }
            const fileId = extractIdFromUrl(url);
            if (!fileId) return;
            addFile(extractTitle(container, url), url, fileId);
          });
          container.querySelectorAll('[data-url], [data-href], [data-target-url], [data-link]').forEach(el => {
            let url = el.getAttribute('data-url') || el.getAttribute('data-href') || el.getAttribute('data-target-url') || el.getAttribute('data-link');
            if (!url || !url.includes('google.com')) return;
            if (url.includes('/folders/') || url.includes('/folder/')) { folderCount++; return; }
            const fileId = extractIdFromUrl(url);
            if (!fileId) return;
            addFile(extractTitle(container, url), url, fileId);
          });
        });
      }
    } catch (e) { debugLogs.push(`Container scan ERROR: ${e.message}`); }

    // Strategy 3: Script tags
    try {
      document.querySelectorAll('script:not([src])').forEach(s => {
        const txt = s.textContent || '';
        if (!txt.includes('drive.google.com') && !txt.includes('docs.google.com')) return;
        const urlRegex = /https?:\/\/(?:drive|docs)\.google\.com\/[^\s"'\\<>]+/gi;
        let m;
        while ((m = urlRegex.exec(txt)) !== null) {
          const url = m[0].replace(/\\\//g, '/');
          if (url.includes('/folders/') || url.includes('/folder/')) continue;
          const fileId = extractIdFromUrl(url);
          if (!fileId || seenIds.has(fileId)) continue;
          seenIds.add(fileId);
          const nearby = txt.substring(Math.max(0, m.index - 300), m.index);
          let title = 'Untitled_Material';
          const nm = nearby.match(/"name"\s*:\s*"([^"]+)"/);
          if (nm) title = nm[1];
          if (title === 'Untitled_Material') { const tm = nearby.match(/"title"\s*:\s*"([^"]+)"/); if (tm) title = tm[1]; }
          files.push({ url, title: sanitizeFilename(title), type: getFileTypeFromUrl(url), id: fileId });
        }
      });
    } catch (e) {}

    // Strategy 4: Deep HTML scan
    try {
      let html = document.documentElement.innerHTML.replace(/\\\//g, '/').replace(/\\u002f/gi, '/');
      const patterns = [
        /https?:\/\/drive\.google\.com\/(?:open|file\/d)\?[^"'\s<>]*id=([a-zA-Z0-9_-]{20,60})[^"'\s<>]*/gi,
        /https?:\/\/docs\.google\.com\/(?:document|presentation|spreadsheets|forms|drawings)\/d\/([a-zA-Z0-9_-]{20,60})[^"'\s<>]*/gi,
        /"https?:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]{20,60})[^"]*"/gi,
        /"https?:\/\/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]{20,60})[^"]*"/gi,
        /https?:\/\/(?:drive|docs)\.google\.com\/[^"'\s<>]*?\/d\/([a-zA-Z0-9_-]{20,60})[^"'\s<>]*/gi,
      ];
      patterns.forEach(pattern => {
        let m;
        while ((m = pattern.exec(html)) !== null) {
          const fullUrl = m[0].replace(/^["']|["']$/g, '');
          if (fullUrl.includes('/folders/')) continue;
          const fileId = m[1];
          if (!fileId || seenIds.has(fileId)) continue;
          seenIds.add(fileId);
          const ctx = html.substring(Math.max(0, m.index - 400), m.index);
          let title = '';
          const nm = ctx.match(/"name"\s*:\s*"([^"]{2,150})"/);
          if (nm) title = nm[1];
          if (!title) { const tm = ctx.match(/"title"\s*:\s*"([^"]{2,150})"/); if (tm) title = tm[1]; }
          if (!title) title = fullUrl.split('/').pop()?.split('?')[0] || 'Untitled_Material';
          files.push({ url: fullUrl, title: sanitizeFilename(title), type: getFileTypeFromUrl(fullUrl), id: fileId });
        }
      });
    } catch (e) {}

    // Strategy 5: Iframes
    try {
      document.querySelectorAll('iframe[src*="docs.google.com"], iframe[src*="drive.google.com"]').forEach(iframe => {
        const url = iframe.src;
        if (url.includes('/folders/')) return;
        const fileId = extractIdFromUrl(url);
        if (!fileId || seenIds.has(fileId)) return;
        seenIds.add(fileId);
        addFile(iframe.getAttribute('title') || iframe.getAttribute('aria-label') || 'Embedded_Document', url, fileId);
      });
    } catch (e) {}

    // Count folders in raw HTML
    if (folderCount === 0) {
      try {
        const fm = document.documentElement.innerHTML.match(/drive\.google\.com\/[^"'\s]*folders?\/[a-zA-Z0-9_-]{20,}/gi);
        if (fm) folderCount = fm.length;
      } catch (e) {}
    }

    // Result
    if (files.length === 0) {
      if (folderCount > 0) {
        files.push({ title: `FOLDER_ONLY:${folderCount}`, url: '#', type: 'folder_warning', id: 'folders_only' });
      } else {
        files.push({ title: `DEBUG: ${debugLogs.join(' | ')} | URL: ${window.location.href}`, url: '#', type: 'unknown', id: 'debug_no_materials_found' });
      }
    }
    return files;
  }

  // ═════════════════════════════════════════════════════
  //  MOODLE / SPADA SCRAPER
  //  Hanya ambil link file nyata (pluginfile.php + ekstensi file)
  //  Skip SEMUA link mod/* karena itu halaman HTML, bukan file
  // ═════════════════════════════════════════════════════
  function scrapeMoodle() {
    const files = [];
    const seenUrls = new Set();
    const debugLogs = [];
    const FILE_EXTS = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx',
      'zip', 'rar', '7z', 'png', 'jpg', 'jpeg', 'gif', 'webp',
      'mp4', 'mkv', 'webm', 'mov', 'mp3', 'wav', 'ogg', 'txt', 'csv'];

    function isRealFileUrl(url) {
      // pluginfile.php = file download langsung dari Moodle
      if (url.includes('pluginfile.php')) return true;
      // Cek apakah URL punya ekstensi file (bukan halaman .php)
      const path = url.split('?')[0].split('#')[0];
      const lastSegment = path.split('/').pop();
      const ext = lastSegment.split('.').pop()?.toLowerCase();
      return FILE_EXTS.includes(ext);
    }

    function extractFilename(url) {
      // Dari pluginfile.php URL: ambil segmen terakhir sebelum query string
      const path = url.split('?')[0].split('#')[0];
      const segments = path.split('/');
      // Cari segmen dengan ekstensi file
      for (let i = segments.length - 1; i >= 0; i--) {
        const ext = segments[i].split('.').pop()?.toLowerCase();
        if (FILE_EXTS.includes(ext)) return decodeURIComponent(segments[i]);
      }
      return decodeURIComponent(segments[segments.length - 1]) || 'Untitled';
    }

    function addItem(title, url) {
      if (!url || seenUrls.has(url)) return;
      if (url.startsWith('#') || url === window.location.href) return;
      if (!isRealFileUrl(url)) return;
      seenUrls.add(url);

      const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
      const type = getFileTypeFromExtension('.' + ext);

      files.push({
        url: url,
        title: sanitizeFilename(title) || extractFilename(url),
        type: type || 'unknown',
        id: 'moodle-' + (files.length + 1)
      });
    }

    // ═══ STRATEGY 1: pluginfile.php + forcedownload links (sumber file utama SPADA) ═══
    try {
      const pluginLinks = document.querySelectorAll('a[href*="pluginfile.php"], a[href*="forcedownload=1"]');
      debugLogs.push(`pluginfile links: ${pluginLinks.length}`);

      pluginLinks.forEach(link => {
        const url = link.href;
        if (!url || seenUrls.has(url)) return;
        let title = (link.textContent || '').trim().replace(/\s+/g, ' ');
        if (!title || title.length < 2) title = extractFilename(url);
        addItem(title, url);
      });
      debugLogs.push(`After pluginfile scan: ${files.length} files`);
    } catch (e) { debugLogs.push(`pluginfile scan ERROR: ${e.message}`); }

    // ═══ STRATEGY 2: Link ekstensi file langsung (pdf, pptx, docx, dll) ═══
    try {
      FILE_EXTS.forEach(ext => {
        try {
          document.querySelectorAll(`a[href*=".${ext}"]`).forEach(link => {
            const url = link.href;
            if (!url || seenUrls.has(url)) return;
            // Skip kalau ini link ke halaman php (false positive)
            if (url.includes('view.php') || url.includes('mod/')) return;
            let title = (link.textContent || '').trim().replace(/\s+/g, ' ');
            if (!title || title.length < 2) title = extractFilename(url);
            addItem(title, url);
          });
        } catch (e) {}
      });
      debugLogs.push(`After extension scan: ${files.length} files`);
    } catch (e) { debugLogs.push(`Ext scan ERROR: ${e.message}`); }

    // ═══ STRATEGY 2.5: mod/resource links (individual file resources) ═══
    try {
      const resourceLinks = document.querySelectorAll(
        'li.activity.modtype_resource .activityinstance a, ' +
        'li.activity.modtype_resource a.aalink, ' +
        'a[href*="mod/resource/view.php"]'
      );

      debugLogs.push(`mod/resource links: ${resourceLinks.length}`);

      resourceLinks.forEach(link => {
        const url = link.href;
        if (!url || seenUrls.has(url)) return;
        if (!url.includes('mod/resource/view.php')) return;

        // Extract title from activity
        const activity = link.closest('li.activity');
        let title = '';
        if (activity) {
          const nameEl = activity.querySelector('.instancename');
          if (nameEl) title = (nameEl.textContent || '').trim().replace(/\s+/g, ' ');
        }
        if (!title) title = (link.textContent || '').trim().replace(/\s+/g, ' ');
        if (!title || title.length < 2) {
          // Derive from URL id
          const idMatch = url.match(/id=(\d+)/);
          title = 'Resource_' + (idMatch ? idMatch[1] : '');
        }

        // Guess type from activity icon
        let type = 'unknown';
        if (activity) {
          const icon = activity.querySelector('.activityicon, img[src*="icon"]');
          if (icon) {
            const src = (icon.src || '').toLowerCase();
            if (src.includes('/pdf') || src.includes('/document')) type = 'pdf';
            else if (src.includes('/ppt') || src.includes('/powerpoint')) type = 'presentation';
            else if (src.includes('/xls') || src.includes('/spreadsheet')) type = 'spreadsheet';
            else if (src.includes('/zip') || src.includes('/archive')) type = 'archive';
            else if (src.includes('/video') || src.includes('/mp4')) type = 'video';
            else if (src.includes('/image') || src.includes('/png') || src.includes('/jpg')) type = 'image';
          }
        }
        // Try from title extension
        if (type === 'unknown') {
          type = getFileTypeFromExtension(title);
        }

        seenUrls.add(url);
        const idMatch = url.match(/id=(\d+)/);
        files.push({
          url, title: sanitizeFilename(title) || 'Resource',
          type, id: 'moodle-res-' + (idMatch ? idMatch[1] : (files.length + 1))
        });
      });

      debugLogs.push(`After resource scan: ${files.length} files`);
    } catch (e) { debugLogs.push(`Resource scan ERROR: ${e.message}`); }

    // ═══ STRATEGY 3: Deep HTML scan (tangkap pluginfile.php di raw HTML) ═══
    try {
      let html = document.documentElement.innerHTML;
      // Cari pluginfile.php URLs
      const pluginRegex = /https?:\/\/[^"'\s<>]+pluginfile\.php\/[^"'\s<>]+/gi;
      let m;
      while ((m = pluginRegex.exec(html)) !== null) {
        const url = m[0].split('"')[0].split("'")[0]; // clean trailing quote
        if (seenUrls.has(url)) continue;
        if (!isRealFileUrl(url)) continue;
        seenUrls.add(url);
        const title = extractFilename(url);
        const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
        files.push({
          url, title,
          type: getFileTypeFromExtension('.' + ext) || 'unknown',
          id: 'moodle-dl-' + (files.length + 1)
        });
      }
      debugLogs.push(`After HTML deep scan: ${files.length} files`);
    } catch (e) {}

    // ═══ STRATEGY 4: URL resources (external links) ═══
    try {
      document.querySelectorAll('li.activity.modtype_url a.aalink, ' +
        'li.activity.modtype_url .activityinstance a').forEach(link => {
        const url = link.href;
        if (!url || seenUrls.has(url)) return;
        if (url.includes(window.location.hostname)) return;
        const activity = link.closest('li.activity');
        let title = '';
        if (activity) {
          const nameEl = activity.querySelector('.instancename');
          if (nameEl) title = (nameEl.textContent || '').trim();
        }
        if (!title) title = (link.textContent || '').trim();
        if (!title) title = url;
        seenUrls.add(url);
        files.push({ url, title, type: 'url', id: 'moodle-url-' + (files.length + 1) });
      });
    } catch (e) {}

    // ═══ RESULT ═══
    debugLogs.push(`RESULT: ${files.length} files`);

    if (files.length === 0) {
      debugLogs.push(`URL: ${window.location.href}`);
      debugLogs.push(`Title: "${document.title}"`);
      debugLogs.push(`Total <a>: ${document.querySelectorAll('a').length}`);
      // Sample beberapa link
      document.querySelectorAll('a[href*="pluginfile"], a[href*=".pdf"], a[href*=".pptx"]').forEach((l, i) => {
        if (i < 5) debugLogs.push(`Sample#${i}: ${l.href.substring(0, 120)}`);
      });

      files.push({
        title: `MOODLE_DEBUG: ${debugLogs.join(' | ')}`,
        url: '#', type: 'unknown', id: 'debug_no_materials_found'
      });
    }

    return files;
  }
})();
