document.addEventListener('DOMContentLoaded', () => {
  const btnScan = document.getElementById('btn-scan');
  const btnDownload = document.getElementById('btn-download');
  const btnBack = document.getElementById('btn-back');
  const btnTheme = document.getElementById('btn-theme');
  const checkboxAll = document.getElementById('checkbox-all');

  const initialState = document.getElementById('initial-state');
  const errorState = document.getElementById('error-state');
  const resultsState = document.getElementById('results-state');
  const fileList = document.getElementById('file-list');
  const fileCount = document.getElementById('file-count');

  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  const progressPercent = document.getElementById('progress-percent');
  const statusBadge = document.getElementById('status-badge');

  let detectedFiles = [];

  // ── Dark / Light mode toggle ──
  const THEME_KEY = 'gcr_theme';

  function getPreferredTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    // Default: follow system
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.body.classList.add('dark');
      btnTheme.textContent = '☀️';
      btnTheme.title = 'Switch ke light mode';
    } else {
      document.body.classList.remove('dark');
      btnTheme.textContent = '🌙';
      btnTheme.title = 'Switch ke dark mode';
    }
  }

  function toggleTheme() {
    const current = document.body.classList.contains('dark') ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }

  // Init theme on load
  applyTheme(getPreferredTheme());

  btnTheme.addEventListener('click', toggleTheme);

  function showError(msg) {
    initialState.classList.add('hidden');
    resultsState.classList.add('hidden');
    errorState.classList.remove('hidden');
    document.getElementById('error-message').innerText = msg;
  }

  function showResults() {
    initialState.classList.add('hidden');
    errorState.classList.add('hidden');
    resultsState.classList.remove('hidden');
    resultsState.classList.add('flex');
  }

  btnBack.addEventListener('click', () => {
    errorState.classList.add('hidden');
    initialState.classList.remove('hidden');
  });

  // ── Scan Button ──
  btnScan.addEventListener('click', async () => {
    btnScan.disabled = true;
    btnScan.textContent = 'Scanning...';

    try {
      let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab.url.includes('classroom.google.com') && !tab.url.includes('spada.uns.ac.id')) {
        showError('Ekstensi ini bekerja di:\n• Google Classroom → tab Materi Kelas\n• SPADA UNS → halaman course\n\nBuka salah satu halaman tersebut lalu klik Scan.');
        btnScan.disabled = false;
        btnScan.textContent = 'Scan Materi';
        return;
      }

      if (tab.url.includes('classroom.google.com') && !tab.url.includes('/c/') && !tab.url.includes('/w/')) {
        showError('Pastikan Anda sudah membuka salah satu kelas di Google Classroom (tab "Materi Kelas" / Classwork).');
        btnScan.disabled = false;
        btnScan.textContent = 'Scan Materi';
        return;
      }

      if (tab.url.includes('spada.uns.ac.id') && !tab.url.includes('/course/') && !tab.url.includes('/mod/')) {
        showError('Pastikan Anda sudah membuka halaman course di SPADA (course/view.php?id=...).');
        btnScan.disabled = false;
        btnScan.textContent = 'Scan Materi';
        return;
      }

      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      }, (injectionResults) => {
        btnScan.disabled = false;
        btnScan.textContent = 'Scan Materi';

        if (chrome.runtime.lastError) {
          showError('Error eksekusi: ' + chrome.runtime.lastError.message);
          return;
        }
        if (!injectionResults || !injectionResults[0]) {
          showError('Gagal men-scan halaman. Muat ulang halaman lalu coba lagi.');
          return;
        }

        const files = injectionResults[0].result;
        if (!files || files.length === 0) {
          showError('Tidak ada materi yang ditemukan. Pastikan semua materi sudah termuat di halaman.');
          return;
        }

        // Check: only folders found
        if (files.length === 1 && files[0].id === 'folders_only') {
          const count = parseInt(files[0].title.split(':')[1]) || 0;
          showError(
            `Hanya ${count} folder Google Drive yang terdeteksi.\n\n` +
            'Materi di kelas ini disimpan dalam bentuk folder Drive, bukan file langsung.\n' +
            'Buka folder satu per satu dari Google Classroom untuk mengunduh isinya.'
          );
          return;
        }

        // Check: debug only
        if (files.length === 1 && (files[0].id === 'debug_no_materials_found' || files[0].id === 'debug_unsupported_page')) {
          const rawTitle = files[0].title
            .replace(/^(DEBUG|MOODLE_DEBUG):\s*/, '')
            .replace(/\s*\|\s*/g, '\n• ');
          showError('Gagal mendeteksi materi.\n\nDetail debug:\n• ' + rawTitle);
          return;
        }

        detectedFiles = files;
        renderFileList(files);
        showResults();
      });
    } catch (err) {
      showError('Terjadi kesalahan: ' + err.message);
      btnScan.disabled = false;
      btnScan.textContent = 'Scan Materi';
    }
  });

  // ── Render Checkbox List ──
  function renderFileList(files) {
    fileList.innerHTML = '';
    fileCount.textContent = `${files.length} File Terdeteksi`;

    files.forEach((file, index) => {
      const item = document.createElement('div');
      item.className = 'flex items-start p-2 hover:bg-gray-50 border-b border-gray-100 last:border-0 rounded';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'file-checkbox mt-1 mr-3 rounded text-blue-600 focus:ring-blue-500 cursor-pointer flex-shrink-0';
      checkbox.dataset.index = index;
      checkbox.checked = true;
      checkbox.addEventListener('change', updateDownloadButton);

      const infoDiv = document.createElement('div');
      infoDiv.className = 'flex-1 overflow-hidden min-w-0';

      const title = document.createElement('p');
      title.className = 'text-sm font-medium text-gray-800 truncate';
      title.title = file.title;
      title.textContent = file.title;

      let typeText = file.type;
      let iconColor = 'icon-unknown';

      if (file.type === 'document') { typeText = 'Docs'; iconColor = 'icon-document'; }
      else if (file.type === 'presentation') { typeText = 'Slides'; iconColor = 'icon-presentation'; }
      else if (file.type === 'spreadsheet') { typeText = 'Sheets'; iconColor = 'icon-spreadsheet'; }
      else if (file.type === 'form') { typeText = 'Forms'; iconColor = 'icon-form'; }
      else if (file.type === 'drawing') { typeText = 'Drawing'; iconColor = 'icon-drawing'; }
      else if (file.type === 'pdf') { typeText = 'PDF'; iconColor = 'icon-pdf'; }
      else if (file.type === 'drive_file') { typeText = 'Drive'; iconColor = 'icon-drive'; }
      else if (file.type === 'image') { typeText = 'Image'; iconColor = 'icon-image'; }
      else if (file.type === 'video') { typeText = 'Video'; iconColor = 'icon-video'; }
      else if (file.type === 'audio') { typeText = 'Audio'; iconColor = 'icon-audio'; }
      else if (file.type === 'archive') { typeText = 'Archive'; iconColor = 'icon-archive'; }

      const typeBadge = document.createElement('span');
      typeBadge.className = 'text-xs text-gray-500 uppercase';
      const iconSvg = `<svg class="inline w-3 h-3 mr-1 ${iconColor}" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd"></path></svg>`;
      typeBadge.innerHTML = `${iconSvg} ${typeText}`;

      infoDiv.appendChild(title);
      infoDiv.appendChild(typeBadge);

      const label = document.createElement('label');
      label.className = 'flex flex-1 items-start cursor-pointer w-full min-w-0';
      label.appendChild(checkbox);
      label.appendChild(infoDiv);

      item.appendChild(label);
      fileList.appendChild(item);
    });

    updateDownloadButton();
  }

  // ── Toggle All ──
  checkboxAll.addEventListener('change', (e) => {
    document.querySelectorAll('.file-checkbox').forEach(cb => cb.checked = e.target.checked);
    updateDownloadButton();
  });

  // ── Update Download Button ──
  function updateDownloadButton() {
    const checkboxes = document.querySelectorAll('.file-checkbox:checked');
    const total = checkboxes.length;
    btnDownload.disabled = total === 0;

    if (total === 0) {
      btnDownload.classList.add('opacity-50', 'cursor-not-allowed');
      btnDownload.innerHTML = 'Pilih file untuk diunduh';
    } else {
      btnDownload.classList.remove('opacity-50', 'cursor-not-allowed');
      btnDownload.innerHTML = `<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg> Download (${total})`;
    }

    const allCheckboxes = document.querySelectorAll('.file-checkbox');
    if (allCheckboxes.length > 0) {
      checkboxAll.checked = checkboxes.length === allCheckboxes.length;
    }
  }

  // ── Download ──
  btnDownload.addEventListener('click', () => {
    const selectedIndexes = Array.from(document.querySelectorAll('.file-checkbox:checked'))
      .map(cb => parseInt(cb.dataset.index));

    if (selectedIndexes.length === 0) return;

    const filesToDownload = selectedIndexes.map(idx => detectedFiles[idx]);

    btnDownload.disabled = true;
    btnDownload.classList.add('opacity-50');
    progressContainer.classList.remove('hidden');
    checkboxAll.disabled = true;
    document.querySelectorAll('.file-checkbox').forEach(cb => cb.disabled = true);

    statusBadge.textContent = 'Processing...';
    statusBadge.classList.remove('hidden');
    statusBadge.classList.replace('text-yellow-900', 'text-blue-900');
    statusBadge.classList.replace('bg-yellow-400', 'bg-blue-400');

    chrome.runtime.sendMessage({
      action: 'start_downloads',
      files: filesToDownload
    });
  });

  // ── Progress ──
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'download_progress') {
      const { current, total, success, failed, currentFile } = request.status;

      const percent = Math.round((current / total) * 100);
      progressBar.style.width = `${percent}%`;
      progressPercent.textContent = `${percent}%`;
      progressText.textContent = `Mengunduh: ${currentFile ? currentFile.title : 'Selesai'} (${current}/${total})`;

      if (current === total) {
        statusBadge.textContent = 'Selesai';
        statusBadge.classList.replace('bg-blue-400', 'bg-green-400');
        statusBadge.classList.replace('text-blue-900', 'text-green-900');

        btnDownload.innerHTML = 'Selesai';
        progressText.textContent = `Selesai! Berhasil: ${success}, Gagal: ${failed}`;

        if (failed > 0) {
          progressBar.classList.replace('bg-blue-600', 'bg-yellow-500');
        } else {
          progressBar.classList.replace('bg-blue-600', 'bg-green-600');
        }
      }
    }
  });
});
