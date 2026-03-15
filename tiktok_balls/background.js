let tabTimes = {};
let activeTabId = null;
let lastTimeSaved = Date.now();

// Monitorear cuando cambiamos de pestaña
chrome.tabs.onActivated.addListener((activeInfo) => {
  const previousTabId = activeTabId;
  const currentTime = Date.now();

  // Guardamos el tiempo que pasamos en la pestaña anterior
  if (previousTabId !== null && tabTimes[previousTabId] !== undefined) {
    const timeSpent = currentTime - lastTimeSaved;
    tabTimes[previousTabId] += timeSpent;
  }

  // Actualizamos la nueva pestaña actual
  activeTabId = activeInfo.tabId;
  lastTimeSaved = currentTime;

  if (tabTimes[activeTabId] === undefined) {
    tabTimes[activeTabId] = 0;
  }
});

// Inicializar y detectar cuando abrimos nuevas pestañas
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs.length > 0) {
    activeTabId = tabs[0].id;
    if (tabTimes[activeTabId] === undefined) {
      tabTimes[activeTabId] = 0;
    }
  }
});

// Limpiar memoria si cerramos pestañas
chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabTimes[tabId];
});

// Escuchar peticiones desde content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "switchToMostProductiveTab") {
    
    // Primero, guardamos el tiempo actual de esta pestaña antes de cambiar
    if (activeTabId !== null) {
      tabTimes[activeTabId] += (Date.now() - lastTimeSaved);
      lastTimeSaved = Date.now();
    }

    // Pedimos las URLs bloqueadas por el usuario para ignorarlas
    chrome.storage.sync.get(['blockedSites'], (data) => {
      let blockedSites = (data.blockedSites && data.blockedSites.length > 0) 
        ? data.blockedSites 
        : ['tiktok.com', 'instagram.com', 'youtube.com', 'facebook.com', 'twitter.com', 'x.com', 'reddit.com', 'twitch.tv', 'netflix.com'];

      // Leer todas las pestañas de la ventana actual
      chrome.tabs.query({ currentWindow: true }, (tabs) => {
        let bestTab = null;
        let lowestTime = Infinity;

        tabs.forEach((tab) => {
          // Ignorar la pestaña en la que estamos ahorita mismo
          if (tab.id === sender.tab.id) return;
          // Ignorar los sitios "castigados" (como tiktok)
          if (blockedSites.some(badSite => tab.url && tab.url.includes(badSite))) return;
          // Ignorar pestañas raras como la de configuración, nueva pestaña o de extensiones
          if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://'))) return;

          let timeSpent = tabTimes[tab.id] || 0;
          if (timeSpent < lowestTime) {
            lowestTime = timeSpent;
            bestTab = tab;
          }
        });

        // Acción final: saltar a la pestaña productiva y luego cerrar la de origen
        const proceedToClose = () => {
          // Si cerramos la misma pestaña en la que estábamos, se cerrará
          const isSenderBlocked = blockedSites.some(badSite => sender.tab.url && sender.tab.url.includes(badSite));
          if (isSenderBlocked && sender.tab && sender.tab.id) {
            chrome.tabs.remove(sender.tab.id);
          }
        };

        // Si encontramos una pestaña "productiva", nos cambiamos a ella
        if (bestTab) {
          chrome.tabs.update(bestTab.id, { active: true }, proceedToClose);
        } else {
          // Fallback: si solo tiene tiktok y pestañas prohibidas, abre una nueva
          chrome.tabs.create({ url: "https://google.com" }, proceedToClose);
        }
      });
    });
    
    return true; // Mantener vivo si usamos async respond 
  }
});
