let targetSites = ['tiktok.com', 'instagram.com', 'youtube.com/shorts/', 'facebook.com', 'twitter.com', 'x.com', 'reddit.com', 'twitch.tv', 'netflix.com'];
let isTargetSite = false;

// Estado
let balls = [];
let isAnimating = false;

// Contadores de tiempo
let activeTimeCounter = 0;
let inactiveTimeCounter = 0;

// Configuración de tiempos (en segundos)
const SECONDS_TO_ADD = 5;
const SECONDS_TO_REMOVE = 2.5;

// Obtener 1/5 de la dimensión más pequeña de la pantalla
let BALL_SIZE = Math.min(window.innerWidth, window.innerHeight) / 5;

// Estado del Killer Ball
let killerBall = null;
let killerCounter = 10;
let timeUntilNextKiller = 45; // Tardará más en salir la primera vez

// Actualizar el tamaño si el usuario redimensiona la ventana
window.addEventListener('resize', () => {
  BALL_SIZE = Math.min(window.innerWidth, window.innerHeight) / 5;
  // Actualizar también el tamaño de todas las bolitas existentes visualmente
  balls.forEach(ball => {
    ball.style.width = `${BALL_SIZE}px`;
    ball.style.height = `${BALL_SIZE}px`;
  });
  if (killerBall) {
    killerBall.style.width = `${BALL_SIZE * 1.2}px`;
    killerBall.style.height = `${BALL_SIZE * 1.2}px`;
  }
});

// Comprobar si estamos en uno de los sitios objetivo
function updateTargetSites() {
  chrome.storage.sync.get(['blockedSites'], (data) => {
    if (data.blockedSites && data.blockedSites.length > 0) {
      targetSites = data.blockedSites;
    }
    const url = window.location.href;
    isTargetSite = targetSites.some(site => url.includes(site));
  });
}

updateTargetSites();

// Escuchar cambios desde otras pestañas o ventanas
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.blockedSites) {
    updateTargetSites();
  }
  // Si otra pestaña actualiza el contador de bolitas, nos sincronizamos
  if (area === 'local' && changes.ballCount) {
    syncBalls(changes.ballCount.newValue || 0);
  }
});

// Cargar la cantidad de bolitas al iniciar la pestaña
chrome.storage.local.get(['ballCount'], (data) => {
  syncBalls(data.ballCount || 0);
});

// Sincronizar el número de bolitas visuales con el estado global
function syncBalls(desiredCount) {
  while (balls.length < desiredCount) {
    addBall();
  }
  while (balls.length > desiredCount) {
    removeBall();
  }
}

function addBall() {
  const ball = document.createElement('div');
  ball.className = 'focus-extension-ball';
  ball.style.width = `${BALL_SIZE}px`;
  ball.style.height = `${BALL_SIZE}px`;
  
  // Color aleatorio atractivo
  const colors = ['#FF4136', '#2ECC40', '#0074D9', '#B10DC9', '#FF851B', '#39CCCC', '#F012BE'];
  ball.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
  
  // Posición inicial aleatoria, evitando que se salga de la pantalla
  const x = Math.random() * Math.max(0, window.innerWidth - BALL_SIZE);
  const y = Math.random() * Math.max(0, window.innerHeight - BALL_SIZE);
  ball.style.left = `${x}px`;
  ball.style.top = `${y}px`;

  // Velocidad aleatoria
  ball.dataset.vx = (Math.random() * 3 + 3) * (Math.random() > 0.5 ? 1 : -1);
  ball.dataset.vy = (Math.random() * 3 + 3) * (Math.random() > 0.5 ? 1 : -1);

  document.body.appendChild(ball);
  balls.push(ball);

  if (!isAnimating) {
    isAnimating = true;
    requestAnimationFrame(animateBalls);
  }
}

function removeBall() {
  if (balls.length > 0) {
    const ball = balls.pop();
    ball.remove();
  }
  if (balls.length === 0 && !killerBall) {
    isAnimating = false;
  }
}

function spawnKillerBall() {
  if (killerBall) return;
  killerCounter = 10;
  killerBall = document.createElement('div');
  killerBall.className = 'focus-extension-killer-ball';
  killerBall.style.width = `${BALL_SIZE * 1.2}px`;
  killerBall.style.height = `${BALL_SIZE * 1.2}px`;
  
  killerBall.innerText = killerCounter;
  
  const x = Math.random() * Math.max(0, window.innerWidth - BALL_SIZE * 1.2);
  const y = Math.random() * Math.max(0, window.innerHeight - BALL_SIZE * 1.2);
  killerBall.style.left = `${x}px`;
  killerBall.style.top = `${y}px`;

  killerBall.dataset.vx = (Math.random() * 5 + 3) * (Math.random() > 0.5 ? 1 : -1);
  killerBall.dataset.vy = (Math.random() * 5 + 3) * (Math.random() > 0.5 ? 1 : -1);

  killerBall.addEventListener('click', (e) => {
    e.stopPropagation();
    killerCounter--;
    killerBall.innerText = killerCounter;
    if (killerCounter <= 0) {
      destroyKillerBall();
      // ¡Victoria! Destruimos todas las bolas
      chrome.storage.local.set({ ballCount: 0 });
      // Cambiar de pestaña instantáneamente
      chrome.runtime.sendMessage({ action: "switchToMostProductiveTab" });
    }
  });

  document.body.appendChild(killerBall);

  killerBall.dataset.intervalId = setInterval(() => {
    killerCounter++;
    killerBall.innerText = killerCounter;
  }, 1000);

  if (!isAnimating) {
    isAnimating = true;
    requestAnimationFrame(animateBalls);
  }
}

function destroyKillerBall() {
  if (killerBall) {
    clearInterval(parseInt(killerBall.dataset.intervalId));
    killerBall.remove();
    killerBall = null;
    timeUntilNextKiller = 30 + Math.random() * 20; // Tardará entre 30 y 50 seg en volver
  }
  if (balls.length === 0 && !killerBall) {
    isAnimating = false;
  }
}

function animateBalls() {
  if (!isAnimating) return;

  const allBalls = [...balls];
  if (killerBall) allBalls.push(killerBall);

  let centerX = window.innerWidth / 2;
  let centerY = window.innerHeight / 2;

  // 1. Mover todas las bolitas y rebotar contra las paredes
  allBalls.forEach(ball => {
    let size = parseFloat(ball.style.width) || BALL_SIZE;
    let x = parseFloat(ball.style.left);
    let y = parseFloat(ball.style.top);
    let vx = parseFloat(ball.dataset.vx);
    let vy = parseFloat(ball.dataset.vy);

    // Gravedad hacia el centro
    let ballCenterX = x + size / 2;
    let ballCenterY = y + size / 2;
    let dirX = centerX - ballCenterX;
    let dirY = centerY - ballCenterY;
    let len = Math.sqrt(dirX * dirX + dirY * dirY);
    if (len > 0) {
      vx += (dirX / len) * 0.15; // Atrae al centro suavemente
      vy += (dirY / len) * 0.15;
    }

    // Límite de velocidad
    let speed = Math.sqrt(vx * vx + vy * vy);
    const maxSpeed = 12;
    if (speed > maxSpeed) {
      vx = (vx / speed) * maxSpeed;
      vy = (vy / speed) * maxSpeed;
    }

    x += vx;
    y += vy;

    // Rebote horizontal
    if (x <= 0) {
      vx = Math.abs(vx);
      x = 0;
    } else if (x + size >= window.innerWidth) {
      vx = -Math.abs(vx);
      x = window.innerWidth - size;
    }
    
    // Rebote vertical
    if (y <= 0) {
      vy = Math.abs(vy);
      y = 0;
    } else if (y + size >= window.innerHeight) {
      vy = -Math.abs(vy);
      y = window.innerHeight - size;
    }

    ball.style.left = `${x}px`;
    ball.style.top = `${y}px`;
    ball.dataset.vx = vx;
    ball.dataset.vy = vy;
  });

  // 2. Comprobar colisiones entre bolitas
  for (let i = 0; i < allBalls.length; i++) {
    for (let j = i + 1; j < allBalls.length; j++) {
      let b1 = allBalls[i];
      let b2 = allBalls[j];

      let size1 = parseFloat(b1.style.width) || BALL_SIZE;
      let size2 = parseFloat(b2.style.width) || BALL_SIZE;
      let r1 = size1 / 2;
      let r2 = size2 / 2;

      let x1 = parseFloat(b1.style.left) + r1;
      let y1 = parseFloat(b1.style.top) + r1;
      let x2 = parseFloat(b2.style.left) + r2;
      let y2 = parseFloat(b2.style.top) + r2;

      let dx = x2 - x1;
      let dy = y2 - y1;
      let dist = Math.sqrt(dx * dx + dy * dy);
      let minDist = r1 + r2;

      if (dist < minDist && dist > 0) {
        let vx1 = parseFloat(b1.dataset.vx);
        let vy1 = parseFloat(b1.dataset.vy);
        let vx2 = parseFloat(b2.dataset.vx);
        let vy2 = parseFloat(b2.dataset.vy);

        let overlap = minDist - dist;
        let nx = dx / dist;
        let ny = dy / dist;

        let separateX = (nx * overlap) / 2;
        let separateY = (ny * overlap) / 2;

        b1.style.left = `${parseFloat(b1.style.left) - separateX}px`;
        b1.style.top = `${parseFloat(b1.style.top) - separateY}px`;
        b2.style.left = `${parseFloat(b2.style.left) + separateX}px`;
        b2.style.top = `${parseFloat(b2.style.top) + separateY}px`;

        b1.dataset.vx = vx2;
        b1.dataset.vy = vy2;
        b2.dataset.vx = vx1;
        b2.dataset.vy = vy1;
      }
    }
  }

  requestAnimationFrame(animateBalls);
}

// Bucle principal: cada 1 segundo
setInterval(() => {
  // Para evitar que múltiples pestañas aceleren el tiempo,
  // solo la pestaña actualmente VISIBLE gestionará el reloj global.
  if (document.visibilityState !== 'visible') return;

  // Soporte SPA: YouTube cambia de URL sin recargar la página.
  // Re-evaluamos la URL en cada medio segundo para detectar cambios en el mismo tab.
  const url = window.location.href;
  isTargetSite = targetSites.some(site => url.includes(site));

  if (isTargetSite) {
    activeTimeCounter += 0.5;
    inactiveTimeCounter = 0;

    // Recompensa: cada 5 segundos obtenemos una bolita nueva
    if (activeTimeCounter > 0 && activeTimeCounter % SECONDS_TO_ADD === 0) {
      chrome.storage.local.get(['ballCount'], (data) => {
        let count = (data.ballCount || 0) + 1;
        chrome.storage.local.set({ ballCount: count });
      });
    }

    // Gestionar la bola roja destructora (Killer Ball)
    timeUntilNextKiller -= 0.5;
    // Necesitamos que hayan mínimo 6 bolas agobiandonos para que salga la salvación
    if (timeUntilNextKiller <= 0 && !killerBall && balls.length >= 6) {
      spawnKillerBall();
    }
  } else {
    inactiveTimeCounter += 0.5;
    activeTimeCounter = 0;

    // Castigo: si estamos en OTRA web (no tiktok), cada 2.5 segundos nos quitan una.
    if (inactiveTimeCounter > 0 && inactiveTimeCounter % SECONDS_TO_REMOVE === 0) {
      chrome.storage.local.get(['ballCount'], (data) => {
        let count = data.ballCount || 0;
        if (count > 0) {
          chrome.storage.local.set({ ballCount: count - 1 });
        }
      });
    }
  }
}, 500);
