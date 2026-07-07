// diagnose.js — Jalankan di Console DevTools pada halaman SPADA
// 1. Buka https://spada.uns.ac.id/course/view.php?id=... (halaman course)
// 2. F12 → Console → copy-paste script ini → Enter
// 3. Copy output JSON-nya, paste ke chat

(function() {
  const report = {
    url: window.location.href,
    title: document.title,
    timestamp: new Date().toISOString(),
    total_links: 0,
    sample_links: [],
    moodle_patterns: {},
    containers: [],
    resource_links: [],
    file_links: [],
    raw_html_sample: ''
  };

  // 1. Semua <a> tag
  const allLinks = document.querySelectorAll('a[href]');
  report.total_links = allLinks.length;

  // Sample 10 link pertama
  allLinks.forEach((l, i) => {
    if (i < 10) {
      report.sample_links.push({
        href: l.href.substring(0, 200),
        text: (l.textContent || '').trim().substring(0, 80),
        class: (l.className || '').substring(0, 100)
      });
    }
  });

  // 2. Hitung elemen dengan pattern Moodle
  const patterns = [
    'li.section', 'li.activity', 'div.activity', '.activityinstance',
    '[class*="resource"]', '[class*="modtype"]', '[class*="activity"]',
    '.section', '.course-content', '#coursecontent',
    '.instancename', '.aalink', '.mod-indent',
    '.contentwithoutlink', '.activityiconcontainer',
    'a[href*="pluginfile.php"]', 'a[href*="mod/resource"]',
    'a[href*="mod/assign"]', 'a[href*="mod/url"]',
    'a[href*="mod/folder"]', 'a[href*="mod/page"]',
    'a[href*="mod/forum"]', 'a[href*="mod/quiz"]',
    '[role="main"]', '.generalbox', '.box',
    'span.instancename', '.activity-info'
  ];

  patterns.forEach(sel => {
    try {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        report.moodle_patterns[sel] = els.length;
      }
    } catch(e) {}
  });

  // 3. Inspect 5 container/activity pertama
  const activitySelectors = [
    'li.activity', 'li.section', '.activity-item',
    '[class*="modtype"]', '.activityinstance'
  ];

  let inspected = 0;
  for (const sel of activitySelectors) {
    if (inspected >= 5) break;
    try {
      const items = document.querySelectorAll(sel);
      for (const item of items) {
        if (inspected >= 5) break;
        const info = {
          tag: item.tagName.toLowerCase(),
          classes: (item.className || '').substring(0, 150),
          text: (item.textContent || '').trim().substring(0, 150).replace(/\s+/g, ' '),
          id: item.id || '',
          data_attrs: [],
          inner_links: []
        };

        // Data attributes
        for (const attr of item.attributes) {
          if (attr.name.startsWith('data-') && attr.value.length < 200) {
            info.data_attrs.push(`${attr.name}="${attr.value.substring(0, 100)}"`);
          }
        }

        // Links inside
        item.querySelectorAll('a[href]').forEach(l => {
          info.inner_links.push({
            href: l.href.substring(0, 200),
            text: (l.textContent || '').trim().substring(0, 80),
            classes: (l.className || '').substring(0, 80)
          });
        });

        report.containers.push(info);
        inspected++;
      }
    } catch(e) {}
  }

  // 4. Link resource spesifik
  const resourcePatterns = [
    'a[href*="pluginfile.php"]',
    'a[href*="mod/resource"]',
    'a[href*="mod/assign"]',
    'a[href*="mod/url"]',
    'a[href*="mod/folder"]',
    'a[href*="mod/page"]',
    'a[href$=".pdf"]',
    'a[href$=".docx"]',
    'a[href$=".doc"]',
    'a[href$=".pptx"]',
    'a[href$=".ppt"]',
    'a[href$=".xlsx"]',
    'a[href$=".xls"]',
    'a[href$=".zip"]',
    'a[href$=".rar"]'
  ];

  const seenUrls = new Set();
  resourcePatterns.forEach(sel => {
    try {
      document.querySelectorAll(sel).forEach(el => {
        const url = el.href;
        if (!url || seenUrls.has(url)) return;
        seenUrls.add(url);
        report.resource_links.push({
          selector: sel,
          href: url.substring(0, 250),
          text: (el.textContent || '').trim().substring(0, 100),
          parent_tag: el.parentElement ? el.parentElement.tagName : '',
          parent_classes: el.parentElement ? (el.parentElement.className || '').substring(0, 100) : ''
        });
      });
    } catch(e) {}
  });

  // 5. Link ke file (ekstensi langsung)
  document.querySelectorAll('a[href]').forEach(el => {
    const url = el.href;
    const ext = url.split('?')[0].split('.').pop().toLowerCase();
    const fileExts = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'zip', 'rar', 'png', 'jpg', 'jpeg', 'mp4', 'mp3', 'txt', 'csv'];
    if (fileExts.includes(ext) && !seenUrls.has(url)) {
      seenUrls.add(url);
      report.file_links.push({
        ext: ext,
        href: url.substring(0, 250),
        text: (el.textContent || '').trim().substring(0, 80)
      });
    }
  });

  // 6. Sample raw HTML snippet (bagian activity pertama)
  const firstActivity = document.querySelector('li.activity, li.section, .activity-item');
  if (firstActivity) {
    report.raw_html_sample = firstActivity.outerHTML.substring(0, 3000);
  }

  // ── Output ──
  console.log('=== SPADA DIAGNOSTIC REPORT ===');
  console.log(JSON.stringify(report, null, 2));
  console.log('');
  console.log('COPY output JSON di atas, kirimkan ke developer.');
  console.log('=== END ===');

  return report;
})();
