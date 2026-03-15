document.addEventListener('DOMContentLoaded', () => {
  const sitesInput = document.getElementById('sitesInput');
  const saveBtn = document.getElementById('saveBtn');

  // Cargar configuración inicial (tiktok por defecto)
  chrome.storage.sync.get(['blockedSites'], (data) => {
    if (data.blockedSites && data.blockedSites.length > 0) {
      sitesInput.value = data.blockedSites.join('\n');
    } else {
      sitesInput.value = 'tiktok.com\ninstagram.com\nyoutube.com/shorts/\nfacebook.com\ntwitter.com\nx.com\nreddit.com\ntwitch.tv\nnetflix.com';
    }
  });

  // Guardar configuración al darle al botón
  saveBtn.addEventListener('click', () => {
    const rawSites = sitesInput.value.split(/[\n,]+/);
    // Limpiamos espacios y quitamos items vacíos
    const sites = rawSites.map(s => s.trim().toLowerCase()).filter(s => s.length > 0);
    
    chrome.storage.sync.set({ blockedSites: sites }, () => {
      // Feedback visual del botón
      const originalText = saveBtn.innerText;
      saveBtn.innerText = '¡Guardado!';
      saveBtn.style.backgroundColor = '#2ECC40';
      
      setTimeout(() => {
        saveBtn.innerText = originalText;
        saveBtn.style.backgroundColor = '#F012BE';
      }, 1500);
    });
  });
});
