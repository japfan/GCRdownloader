// background.js - Service worker for background tasks (Manifest V3)

// Generate the direct download URL for a Google file
function getDownloadUrl(file) {
  if (!file.id) return file.url; // fallback to original

  switch (file.type) {
    case 'document':
      return `https://docs.google.com/document/d/${file.id}/export?format=pdf`;
    case 'presentation':
      return `https://docs.google.com/presentation/d/${file.id}/export/pdf`;
    case 'spreadsheet':
      return `https://docs.google.com/spreadsheets/d/${file.id}/export?format=pdf`;
    case 'form':
      // Forms export as zip (responses), fallback ke view
      return `https://docs.google.com/forms/d/${file.id}/export?format=pdf`;
    case 'drawing':
      return `https://docs.google.com/drawings/d/${file.id}/export/pdf`;
    default:
      // For standard Drive files (PDFs, Images, Videos, etc.)
      // confirm=t bypasses Google's "large file virus scan" warning page
      return `https://drive.google.com/uc?export=download&confirm=t&id=${file.id}`;
  }
}

// Map file type to default extension
function getExtensionByType(type) {
  switch (type) {
    case 'document':
    case 'presentation':
    case 'spreadsheet':
    case 'form':
    case 'drawing':
      return '.pdf';
    case 'image':
      return '.png';
    case 'video':
      return '.mp4';
    case 'audio':
      return '.mp3';
    case 'archive':
      return '.zip';
    default:
      return '';
  }
}

// Generate the desired filename including extension
function getFilename(file) {
  const hasExt = /\.[a-z0-9]{3,5}$/i.test(file.title);

  if (hasExt) {
    return file.title;
  }

  const ext = getExtensionByType(file.type);
  return `${file.title}${ext}`;
}

// Track download errors for reporting
const downloadErrors = [];

async function startDownloadQueue(files) {
  const total = files.length;
  let current = 0;
  let success = 0;
  let failed = 0;
  downloadErrors.length = 0;

  for (const file of files) {
    current++;

    // Notify popup of current progress
    try {
      chrome.runtime.sendMessage({
        action: "download_progress",
        status: {
          current,
          total,
          success,
          failed,
          currentFile: file
        }
      });
    } catch (_) {
      // Popup might be closed, ignore
    }

    const downloadUrl = getDownloadUrl(file);
    const filename = getFilename(file);

    try {
      await new Promise((resolve, reject) => {
        chrome.downloads.download({
          url: downloadUrl,
          filename: `GCR_Materi/${filename}`,
          saveAs: false
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            const errMsg = chrome.runtime.lastError.message || 'Unknown error';
            console.error(`Download gagal [${filename}]: ${errMsg}`);
            console.error(`  URL: ${downloadUrl}`);
            downloadErrors.push({ file: filename, error: errMsg });
            reject(chrome.runtime.lastError);
          } else if (downloadId === undefined) {
            // Download silently failed (e.g., blocked by Chrome policy)
            console.error(`Download gagal tanpa error [${filename}]`);
            downloadErrors.push({ file: filename, error: 'Download ditolak (cek popup blocker / setting Chrome)' });
            reject(new Error('Download ID undefined'));
          } else {
            resolve(downloadId);
          }
        });
      });
      success++;
    } catch (error) {
      failed++;
    }

    // Delay between downloads to avoid rate limits
    // Google might throttle rapid requests to Drive
    if (current < total) {
      await new Promise(r => setTimeout(r, 800)); // 800ms delay
    }
  }

  // Final notification with error details
  try {
    chrome.runtime.sendMessage({
      action: "download_progress",
      status: {
        current: total,
        total,
        success,
        failed,
        currentFile: null
      }
    });

    if (failed > 0 && downloadErrors.length > 0) {
      // Show last error for context
      const lastErr = downloadErrors[downloadErrors.length - 1];
      console.warn(`${failed}/${total} download gagal. Error terakhir: [${lastErr.file}] ${lastErr.error}`);
    }
  } catch (_) {
    // Popup might be closed
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "start_downloads" && request.files && request.files.length > 0) {
    startDownloadQueue(request.files);
    return true; // Async response
  }
});
