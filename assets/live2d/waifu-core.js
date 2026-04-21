const ICONS = {
  photo:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M220.6 121.2L271.1 96 448 96l0 96-114.8 0c-21.9-15.1-48.5-24-77.2-24s-55.2 8.9-77.2 24L64 192l0-64 128 0c9.9 0 19.7-2.3 28.6-6.8zM0 128L0 416c0 35.3 28.7 64 64 64l384 0c35.3 0 64-28.7 64-64l0-320c0-35.3-28.7-64-64-64L271.1 32c-9.9 0-19.7 2.3-28.6 6.8L192 64l-32 0 0-16c0-8.8-7.2-16-16-16L80 32c-8.8 0-16 7.2-16 16l0 16C28.7 64 0 92.7 0 128zM168 304a88 88 0 1 1 176 0 88 88 0 1 1 -176 0z"/></svg>',
  info:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336l24 0 0-64-24 0c-13.3 0-24-10.7-24-24s10.7-24 24-24l48 0c13.3 0 24 10.7 24 24l0 88 8 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-80 0c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0 64 32 32 0 1 1 0-64z"/></svg>',
  quit:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/></svg>'
};

let hideWaifuTimeoutId = null;
let hideWaifuTransitionCleanup = null;
let dragResizeCleanup = null;
let currentManager = null;

function clearHideWaifuTimeout() {
  if (hideWaifuTimeoutId !== null) {
    window.clearTimeout(hideWaifuTimeoutId);
    hideWaifuTimeoutId = null;
  }

  if (hideWaifuTransitionCleanup) {
    hideWaifuTransitionCleanup();
    hideWaifuTransitionCleanup = null;
  }
}

function scheduleHideWaifu(waifu, toggle) {
  clearHideWaifuTimeout();

  const finishHide = () => {
    if (hideWaifuTransitionCleanup) {
      hideWaifuTransitionCleanup();
      hideWaifuTransitionCleanup = null;
    }

    if (hideWaifuTimeoutId !== null) {
      window.clearTimeout(hideWaifuTimeoutId);
      hideWaifuTimeoutId = null;
    }

    if (waifu?.classList.contains('waifu-active')) {
      return;
    }

    waifu?.classList.add('waifu-hidden');
    toggle?.classList.add('waifu-toggle-active');
  };

  const handleTransitionEnd = (event) => {
    if (event.target !== waifu || event.propertyName !== 'bottom') {
      return;
    }

    finishHide();
  };

  waifu?.addEventListener('transitionend', handleTransitionEnd);
  hideWaifuTransitionCleanup = () => {
    waifu?.removeEventListener('transitionend', handleTransitionEnd);
  };

  // Fallback in case transitionend does not fire.
  hideWaifuTimeoutId = window.setTimeout(finishHide, 3200);
}

function clearDragHandlers() {
  document.onmousemove = null;
  document.onmouseup = null;

  if (dragResizeCleanup) {
    dragResizeCleanup();
    dragResizeCleanup = null;
  }
}

function destroyCurrentManager() {
  currentManager = null;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-live2d-runtime="${src}"]`);
    if (existing) {
      if (existing.dataset.live2dRuntimeLoaded === 'true') {
        resolve();
        return;
      }

      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), {
        once: true
      });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.dataset.live2dRuntime = src;
    script.onload = () => {
      script.dataset.live2dRuntimeLoaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

class Live2DManager {
  constructor(config) {
    const normalizedScale = Number(config.scale);
    const normalizedOffsetX = Number(config.offsetX);
    const normalizedOffsetY = Number(config.offsetY);
    this.config = {
      ...config,
      scale: Number.isFinite(normalizedScale) && normalizedScale > 0 ? normalizedScale : 1,
      offsetX: Number.isFinite(normalizedOffsetX) ? normalizedOffsetX : 0,
      offsetY: Number.isFinite(normalizedOffsetY) ? normalizedOffsetY : 0
    };
    this.cubism2Model = null;
    this.cubism5Model = null;
    this.currentModelVersion = 0;
    this.loading = false;
  }

  resetCanvas() {
    const canvasWrapper = document.getElementById('waifu-canvas');
    if (!canvasWrapper) {
      return;
    }

    canvasWrapper.innerHTML = '<canvas id="live2d" width="800" height="800"></canvas>';
  }

  async loadModel() {
    if (this.loading) {
      return;
    }

    this.loading = true;

    try {
      const response = await fetch(this.config.modelPath, { cache: 'no-store' });
      const modelSetting = await response.json();
      const version = modelSetting.Version === 3 || modelSetting.FileReferences ? 3 : 2;

      if (version === 2) {
        await this.loadCubism2(modelSetting);
      } else {
        await this.loadCubism5();
      }

      this.currentModelVersion = version;
    } finally {
      this.loading = false;
    }
  }

  async loadCubism2(modelSetting) {
    if (!this.config.cubism2Path) {
      throw new Error('No cubism2Path configured.');
    }

    if (!this.cubism2Model) {
      await loadScript(this.config.cubism2Path);
      const module = await import('./chunk/index.js');
      this.cubism2Model = new module.default();
    }

    if (this.currentModelVersion === 3 && this.cubism5Model) {
      this.cubism5Model.release();
      this.resetCanvas();
    }

    if (this.currentModelVersion === 3 || !this.cubism2Model.gl) {
      await this.cubism2Model.init('live2d', this.config.modelPath, modelSetting);
    } else {
      await this.cubism2Model.changeModelWithJSON(this.config.modelPath, modelSetting);
    }
  }

  async loadCubism5() {
    if (!this.config.cubism5Path) {
      throw new Error('No cubism5Path configured.');
    }

    await loadScript(this.config.cubism5Path);
    const module = await import('./chunk/index2.js');

    if (!this.cubism5Model) {
      this.cubism5Model = new module.AppDelegate();
    }

    if (this.currentModelVersion === 2 && this.cubism2Model) {
      this.cubism2Model.destroy();
      this.resetCanvas();
    }

    if (this.currentModelVersion === 2 || !this.cubism5Model.subdelegates.at(0)) {
      this.cubism5Model.initialize();
      this.cubism5Model.changeModel(
        this.config.modelPath,
        this.config.scale,
        this.config.offsetX,
        this.config.offsetY
      );
      this.cubism5Model.run();
    } else {
      this.cubism5Model.changeModel(
        this.config.modelPath,
        this.config.scale,
        this.config.offsetX,
        this.config.offsetY
      );
    }
  }

  destroy() {
    this.cubism2Model?.destroy?.();
    this.cubism2Model = null;

    this.cubism5Model?.release?.();
    this.cubism5Model = null;

    this.currentModelVersion = 0;
    this.loading = false;
  }
}

function installDrag() {
  clearDragHandlers();

  const waifu = document.getElementById('waifu');
  const canvas = document.getElementById('live2d');

  if (!waifu || !canvas) {
    return;
  }

  let viewportWidth = window.innerWidth;
  let viewportHeight = window.innerHeight;
  const widgetWidth = waifu.offsetWidth;
  const widgetHeight = waifu.offsetHeight;

  waifu.addEventListener('mousedown', (event) => {
    if (event.button === 2 || event.target !== canvas) {
      return;
    }

    event.preventDefault();

    const startX = event.offsetX;
    const startY = event.offsetY;

    document.onmousemove = (moveEvent) => {
      let left = moveEvent.clientX - startX;
      let top = moveEvent.clientY - startY;

      if (left < 0) left = 0;
      if (top < 0) top = 0;
      if (left > viewportWidth - widgetWidth) left = viewportWidth - widgetWidth;
      if (top > viewportHeight - widgetHeight) top = viewportHeight - widgetHeight;

      waifu.style.left = `${left}px`;
      waifu.style.top = `${top}px`;
      waifu.style.right = 'auto';
      waifu.style.bottom = 'auto';
    };

    document.onmouseup = () => {
      document.onmousemove = null;
      document.onmouseup = null;
    };
  });

  const handleResize = () => {
    viewportWidth = window.innerWidth;
    viewportHeight = window.innerHeight;
  };

  window.addEventListener('resize', handleResize);
  dragResizeCleanup = () => {
    window.removeEventListener('resize', handleResize);
  };
}

function registerTools(config) {
  const toolContainer = document.getElementById('waifu-tool');
  if (!toolContainer) {
    return;
  }

  const toolActions = {
    photo() {
      const canvas = document.getElementById('live2d');
      if (!canvas) {
        return;
      }

      const link = document.createElement('a');
      link.href = canvas.toDataURL();
      link.download = 'live2d-photo.png';
      link.click();
    },
    info() {
      window.open('https://steamcommunity.com/sharedfiles/filedetails/?id=3575069170', '_blank', 'noopener,noreferrer');
    },
    quit() {
      const waifu = document.getElementById('waifu');
      const toggle = document.getElementById('waifu-toggle');
      localStorage.setItem('waifu-display', Date.now().toString());
      waifu?.classList.remove('waifu-active');
      scheduleHideWaifu(waifu, toggle);
    }
  };

  for (const toolName of config.tools || []) {
    if (!toolActions[toolName] || !ICONS[toolName]) {
      continue;
    }

    const button = document.createElement('span');
    button.id = `waifu-tool-${toolName}`;
    button.innerHTML = ICONS[toolName];
    button.addEventListener('click', toolActions[toolName]);
    toolContainer.appendChild(button);
  }
}

function ensureToggle() {
  let toggle = document.getElementById('waifu-toggle');
  if (toggle) {
    return toggle;
  }

  document.body.insertAdjacentHTML(
    'beforeend',
    '<div id="waifu-toggle"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512"><path d="M96 64a64 64 0 1 1 128 0A64 64 0 1 1 96 64zm48 320l0 96c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-192.2L59.1 321c-9.4 15-29.2 19.4-44.1 10S-4.5 301.9 4.9 287l39.9-63.3C69.7 184 113.2 160 160 160s90.3 24 115.2 63.6L315.1 287c9.4 15 4.9 34.7-10 44.1s-34.7 4.9-44.1-10L240 287.8 240 480c0 17.7-14.3 32-32 32s-32-14.3-32-32l0-96-32 0z"/></svg></div>'
  );
  toggle = document.getElementById('waifu-toggle');
  return toggle;
}

async function mountWaifu(config) {
  clearHideWaifuTimeout();
  clearDragHandlers();
  destroyCurrentManager();
  document.getElementById('waifu')?.remove();

  document.body.insertAdjacentHTML(
    'beforeend',
    '<div id="waifu"><div id="waifu-canvas"><canvas id="live2d" width="800" height="800"></canvas></div><div id="waifu-tool"></div></div>'
  );
  const waifu = document.getElementById('waifu');

  const toolContainer = document.getElementById('waifu-tool');
  if (toolContainer) {
    toolContainer.innerHTML = '';
  }

  registerTools(config);

  currentManager = new Live2DManager(config);
  await currentManager.loadModel();

  if (config.drag) {
    installDrag();
  }

  waifu?.classList.add('waifu-active');
}

window.initWidget = function initWidget(config) {
  const toggle = ensureToggle();
  if (!toggle) {
    return;
  }

  if (!toggle.dataset.live2dBound) {
    toggle.dataset.live2dBound = 'true';
    toggle.addEventListener('click', async () => {
      toggle.classList.remove('waifu-toggle-active');
      localStorage.removeItem('waifu-display');
      await mountWaifu(config);
    });
  }

  const recentlyHidden = Number(localStorage.getItem('waifu-display'));
  if (recentlyHidden && Date.now() - recentlyHidden <= 86400000) {
    toggle.classList.add('waifu-toggle-active');
    return;
  }

  mountWaifu(config).catch((error) => {
    console.warn('Live2D widget was not initialized.', error);
  });
};
