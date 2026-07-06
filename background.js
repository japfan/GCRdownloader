// background.js - Service worker for background tasks (Manifest V3)

// Generate the direct download URL for a Google file
function getDownloadUrl(file) {
  if (!file.id) return file.url; // fallback to original

  if (file.type === 'document') {
    return `https://docs.google.com/document/d/${file.id}/export?format=pdf`;
  } else if (file.type === 'presentation') {
    return `https://docs.google.com/presentation/d/${file.id}/export/pdf`;
  } else if (file.type === 'spreadsheet') {
    return `https://docs.google.com/spreadsheets/d/${file.id}/export?format=pdf`;
  } else {
    // For standard Drive files (PDFs, Images, etc.)
    return `https://drive.google.com/uc?export=download&id=${file.id}`;
  }
}

// Generate the desired filename including extension
function getFilename(file) {
  let ext = '';
  if (file.type === 'document' || file.type === 'presentation' || file.type === 'spreadsheet') {
    ext = '.pdf';
  }
  
  // If title already has an extension that looks valid, don't append
  const hasExt = /\.[a-z0-9]{3,4}$/i.test(file.title);
  
  if (hasExt) {
    return file.title;
  }
  return `${file.title}${ext}`;
}

async function startDownloadQueue(files) {
  const total = files.length;
  let current = 0;
  let success = 0;
  let failed = 0;

  for (const file of files) {
    current++;
    
    // Notify popup of current progress
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

    const downloadUrl = getDownloadUrl(file);
    const filename = getFilename(file);

    try {
      await new Promise((resolve, reject) => {
        chrome.downloads.download({
          url: downloadUrl,
          filename: `GCR_Materi/${filename}`, // Save in a subfolder
          saveAs: false // Don't prompt for each file
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            console.error("Download failed for", file.title, chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            resolve(downloadId);
          }
        });
      });
      success++;
    } catch (error) {
      failed++;
    }

    // Delay between downloads to avoid rate limits / blocking
    // Google might block if too many rapid requests
    if (current < total) {
      await new Promise(r => setTimeout(r, 600)); // 600ms delay
    }
  }

  // Final notification
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
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "start_downloads" && request.files && request.files.length > 0) {
    startDownloadQueue(request.files);
    // Return true to indicate async response (though we use separate progress messages)
    return true; 
  }
});
