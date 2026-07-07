// background.js - Service worker for background tasks (Manifest V3)

// ── Generate download URL — Google transformations, SPADA passthrough ──
function getDownloadUrl(file) {
  // Non-Google URLs: return as-is (SPADA/Moodle direct links)
  if (file.url && !file.url.includes('google.com')) {
    // Moodle mod/resource URLs: append forcedownload to skip intermediate page
    if (file.url.includes('mod/resource/view.php') && !file.url.includes('forcedownload')) {
      const sep = file.url.includes('?') ? '&' : '?';
      return file.url + sep + 'forcedownload=1';
    }
    return file.url;
  }

  if (!file.id) return file.url;

  switch (file.type) {
    case 'document':
      return `https://docs.google.com/document/d/${file.id}/export?format=pdf`;
    case 'presentation':
      return `https://docs.google.com/presentation/d/${file.id}/export/pdf`;
    case 'spreadsheet':
      return `https://docs.google.com/spreadsheets/d/${file.id}/export?format=pdf`;
    case 'form':
      return `https://docs.google.com/forms/d/${file.id}/export?format=pdf`;
    case 'drawing':
      return `https://docs.google.com/drawings/d/${file.id}/export/pdf`;
    default:
      return `https://drive.google.com/uc?export=download&confirm=t&id=${file.id}`;
  }
}

// ── Fetch file with auth cookies (for Moodle/SPADA) and return data: URL ──
async function fetchToDataUrl(url) {
  const urlObj = new URL(url);
  const domainUrl = urlObj.origin + '/';

  // Ambil cookies dari browser store untuk domain ini
  const cookies = await chrome.cookies.getAll({ url: domainUrl });
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

  const headers = { 'Referer': domainUrl };
  if (cookieHeader) {
    headers['Cookie'] = cookieHeader;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const mimeType = response.headers.get('content-type') || 'application/octet-stream';
  return 'data:' + mimeType + ';base64,' + btoa(binary);
}

// ── Extension mapping ──
function getExtensionByType(type) {
  switch (type) {
    case 'document': case 'presentation': case 'spreadsheet': case 'form': case 'drawing':
      return '.pdf';
    case 'image':  return '.png';
    case 'video':  return '.mp4';
    case 'audio':  return '.mp3';
    case 'archive': return '.zip';
    default: return '';
  }
}

// ── Filename with extension ──
function getFilename(file) {
  const hasExt = /\.[a-z0-9]{3,5}$/i.test(file.title);
  if (hasExt) return file.title;
  const ext = getExtensionByType(file.type);
  return `${file.title}${ext}`;
}

// ── Download a single file ──
async function downloadOne(file) {
  // URL resources (external links) — open in new tab instead of downloading
  if (file.type === 'url') {
    chrome.tabs.create({ url: file.url, active: false });
    return 'opened';
  }

  const downloadUrl = getDownloadUrl(file);
  const filename = `GCR_Materi/${getFilename(file)}`;

  const isNonGoogle = file.url && !file.url.includes('google.com');

  // Step 1: Coba direct download dulu (browser kirim cookies otomatis)
  try {
    const result = await new Promise((resolve, reject) => {
      chrome.downloads.download({
        url: downloadUrl,
        filename: filename,
        saveAs: false
      }, (downloadId) => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else if (downloadId === undefined) reject(new Error('Download ID undefined'));
        else resolve(downloadId);
      });
    });
    return result;
  } catch (directErr) {
    // Step 2: Kalau gagal dan ini URL non-Google, coba fetch-to-dataURL
    if (isNonGoogle) {
      console.warn(`Direct download gagal [${filename}]: ${directErr.message}. Trying fetch...`);
      const dataUrl = await fetchToDataUrl(downloadUrl);
      return new Promise((resolve, reject) => {
        chrome.downloads.download({
          url: dataUrl,
          filename: filename,
          saveAs: false
        }, (downloadId) => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else if (downloadId === undefined) reject(new Error('Download ID undefined (fetch)'));
          else resolve(downloadId);
        });
      });
    }
    throw directErr; // Google URL gagal, rethrow
  }
}

// ── Download queue ──
async function startDownloadQueue(files) {
  const total = files.length;
  let current = 0, success = 0, failed = 0;

  function notify(currentFile) {
    try {
      chrome.runtime.sendMessage({
        action: 'download_progress',
        status: { current, total, success, failed, currentFile }
      });
    } catch (_) {}
  }

  for (const file of files) {
    current++;
    notify(file);

    try {
      await downloadOne(file);
      success++;
    } catch (err) {
      failed++;
      console.error(`Download gagal [${getFilename(file)}]: ${err.message}`);
    }

    if (current < total) {
      await new Promise(r => setTimeout(r, 800));
    }
  }

  notify(null);
}

// ── Message listener ──
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'start_downloads' && request.files?.length > 0) {
    startDownloadQueue(request.files);
    return true;
  }
});
