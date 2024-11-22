// Ensure we don't initialize multiple times
if (typeof window.eyedropperInitialized === 'undefined') {
  window.eyedropperInitialized = true;

  // UI Configuration
  const MAGNIFIER_SIZE = 100;  // Size of the zoom window in pixels
  const ZOOM_LEVEL = 6;       // Default zoom level (10x magnification)
  const PREVIEW_SIZE = 16;     // Size of the color preview square
  const GRID_SIZE = 16;         // Size of grid cells in zoom view
  const BORDER_WIDTH = 1;      // Width of borders in pixels

  // Timing Configuration
  const CLOSE_DELAY = 800;     // How long to wait before closing after copy (ms)
  const SCROLL_DEBOUNCE = 150; // Delay for screenshot update after scroll (ms)
  const ANIMATION_DURATION = 100; // Duration of UI animations (ms)

  // Layout Configuration
  const PREVIEW_OFFSET = {
    WITH_ZOOM: 70,    // Distance from cursor when zoom is enabled
    WITHOUT_ZOOM: 30  // Distance from cursor when zoom is disabled
  };

  // Position Configuration
  const EDGE_THRESHOLD = {
    WITH_ZOOM: MAGNIFIER_SIZE,
    WITHOUT_ZOOM: 50
  };

  const POSITION_OFFSET = {
    EDGE: 10,         // Offset from screen edge
    DEFAULT: -50      // Default transform percentage
  };

  // Feature Configuration
  const COLOR_HISTORY_SIZE = 10;  // Number of colors to keep in history
  const DEFAULT_CURSOR = 'crosshair';  // Default cursor style
  const ZOOM_CURSOR = 'none';     // Cursor style when zoom is enabled
  const SAMPLING_AREA = 3;        // Size of color sampling area (3x3 pixels)

  // Style Configuration
  const PREVIEW_STYLES = {
    borderRadius: '3px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
    darkBorder: 'rgba(0, 0, 0, 0.3)',
    lightBorder: 'rgba(255, 255, 255, 0.3)'
  };

  // Canvas Configuration
  const CANVAS_QUALITY = {
    alpha: false,
    desynchronized: true,
    willReadFrequently: true
  };

  // Key Configuration
  const KEY_CODES = {
    ENTER: 13,
    ESCAPE: 27,
    LEFT: 37,
    UP: 38,
    RIGHT: 39,
    DOWN: 40,
    SHIFT: 16
  };

  const MOVEMENT = {
    NORMAL: 1,
    FAST: 10    // When shift is pressed
  };

  // CSS Helper Classes
  const CSS_CLASSES = {
    PREVIEW_CONTAINER: `
      position: fixed;
      pointer-events: none;
      z-index: 999999;
      transform: translate(-50%, -50%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `,
    PREVIEW_INNER: `
      background: rgba(0, 0, 0, 0.8);
      padding: 6px 10px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      backdrop-filter: blur(5px);
    `,
    COLOR_PREVIEW: `
      width: ${PREVIEW_SIZE}px;
      height: ${PREVIEW_SIZE}px;
      border: ${BORDER_WIDTH}px solid rgba(255, 255, 255, 0.3);
      border-radius: ${PREVIEW_STYLES.borderRadius};
      box-shadow: ${PREVIEW_STYLES.boxShadow};
    `,
    HEX_PREVIEW: `
      color: white;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 13px;
      text-align: center;
      letter-spacing: 0.5px;
      text-shadow: 0 1px 2px rgba(0,0,0,0.2);
    `,
    ZOOM_CONTAINER: `
      position: fixed;
      pointer-events: none;
      z-index: 999998;
      transform: translate(-50%, -50%);
      width: ${MAGNIFIER_SIZE}px;
      height: ${MAGNIFIER_SIZE}px;
      border-radius: 50%;
      background: white;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      border: 2px solid #e0e0e0;
      overflow: hidden;
    `,
    ZOOM_CANVAS: `
      image-rendering: -moz-crisp-edges;
      image-rendering: -webkit-crisp-edges;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
    `,
    OVERLAY: `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 999998;
      cursor: ${DEFAULT_CURSOR};
      background: transparent;
      user-select: none;
      -moz-user-select: none;
      -webkit-user-select: none;
      pointer-events: auto;
    `
  };

  // Helper method to apply CSS classes
  const applyStyles = (element, styles) => {
    element.style.cssText = styles;
  };

  class Eyedropper {
    constructor() {
      this.isActive = false;
      this.canvas = null;
      this.ctx = null;
      this.mouseX = 0;
      this.mouseY = 0;
      this.scrollX = window.scrollX;
      this.scrollY = window.scrollY;
      this.overlay = null;
      this.previewContainer = null;
      this.zoomContainer = null;
      this.zoomCanvas = null;
      this.zoomCtx = null;
      this.hexPreview = null;
      this.colorPreview = null;
      this.isZoomEnabled = false; // zoom by default
      this.zoomLevel = ZOOM_LEVEL; // Configurable zoom level
      this.debounceTimeout = null;
      this.hasJustCopied = false;
      this.colorFormat = 'hex'; // Default color format
      this.setupEventListeners();
    }

    setupEventListeners() {
      // We'll add event listeners to the overlay instead of document
      this.handleMouseMove = this.handleMouseMove.bind(this);
      this.handleClick = this.handleClick.bind(this);
      this.handleKeyDown = this.handleKeyDown.bind(this);
      this.handleScroll = this.handleScroll.bind(this);
      
      // Global key listener for escape
      document.addEventListener('keydown', this.handleKeyDown);
    }

    createPreviewElements() {
      const container = document.createElement('div');
      container.id = 'eyedropper-preview-container';
      applyStyles(container, CSS_CLASSES.PREVIEW_CONTAINER);

      const previewContainer = document.createElement('div');
      applyStyles(previewContainer, CSS_CLASSES.PREVIEW_INNER);

      const colorPreview = document.createElement('div');
      colorPreview.id = 'eyedropper-color-preview';
      applyStyles(colorPreview, CSS_CLASSES.COLOR_PREVIEW);

      const hexPreview = document.createElement('div');
      hexPreview.id = 'eyedropper-hex-preview';
      applyStyles(hexPreview, CSS_CLASSES.HEX_PREVIEW);
      
      previewContainer.appendChild(colorPreview);
      previewContainer.appendChild(hexPreview);
      container.appendChild(previewContainer);
      document.body.appendChild(container);
      
      return { container, hexPreview, colorPreview };
    }

    createZoomCanvas() {
      const container = document.createElement('div');
      container.id = 'eyedropper-zoom-container';
      applyStyles(container, CSS_CLASSES.ZOOM_CONTAINER);

      const canvas = document.createElement('canvas');
      canvas.width = MAGNIFIER_SIZE;
      canvas.height = MAGNIFIER_SIZE;
      applyStyles(canvas, CSS_CLASSES.ZOOM_CANVAS);
      
      container.appendChild(canvas);
      document.body.appendChild(container);
      
      const ctx = canvas.getContext('2d', {
        alpha: false,
        imageSmoothingEnabled: false
      });
      
      ctx.imageSmoothingEnabled = false;
      ctx.mozImageSmoothingEnabled = false;
      ctx.webkitImageSmoothingEnabled = false;
      ctx.msImageSmoothingEnabled = false;
      
      return { container, canvas };
    }

    createOverlay() {
      this.overlay = document.createElement('div');
      applyStyles(this.overlay, CSS_CLASSES.OVERLAY);

      // Update cursor style based on zoom state
      if (this.isZoomEnabled) {
        this.overlay.style.cursor = ZOOM_CURSOR;
      }

      // Prevent any events from reaching elements below
      this.overlay.addEventListener('mouseenter', e => e.preventDefault());
      this.overlay.addEventListener('mouseover', e => e.preventDefault());
      this.overlay.addEventListener('mousemove', this.handleMouseMove);
      this.overlay.addEventListener('click', this.handleClick);
      this.overlay.addEventListener('mousedown', e => e.preventDefault());
      this.overlay.addEventListener('mouseup', e => e.preventDefault());
      this.overlay.addEventListener('contextmenu', e => e.preventDefault());
      
      document.body.appendChild(this.overlay);
      window.addEventListener('scroll', this.handleScroll, { passive: true });
    }

    drawZoom(x, y) {
      if (!this.isActive || !this.zoomCanvas || !this.zoomCtx) return;

      const devicePixelRatio = window.devicePixelRatio || 1;
      
      // Calculate the area to capture
      const zoomedWidth = this.zoomCanvas.width / this.zoomLevel;
      const zoomedHeight = this.zoomCanvas.height / this.zoomLevel;
      
      const sx = Math.max(0, (x * devicePixelRatio) - (zoomedWidth / 2));
      const sy = Math.max(0, (y * devicePixelRatio) - (zoomedHeight / 2));
      const sw = zoomedWidth;
      const sh = zoomedHeight;

      // Clear previous content
      this.zoomCtx.clearRect(0, 0, this.zoomCanvas.width, this.zoomCanvas.height);

      // Disable image smoothing for crisp pixels
      this.zoomCtx.imageSmoothingEnabled = false;
      this.zoomCtx.mozImageSmoothingEnabled = false;
      this.zoomCtx.webkitImageSmoothingEnabled = false;
      this.zoomCtx.msImageSmoothingEnabled = false;

      try {
        // Draw zoomed content
        this.zoomCtx.drawImage(
          this.canvas,
          sx, sy,
          sw, sh,
          0, 0,
          this.zoomCanvas.width, this.zoomCanvas.height
        );

        // Draw grid
        this.drawZoomGrid();
        
        // Draw crosshair
        this.drawZoomCrosshair();

      } catch (e) {
        console.warn('Error drawing zoom:', e);
      }
    }

    drawZoomGrid() {
      if (!this.zoomCtx) return;

      const cellSize = Math.floor(this.zoomCanvas.width / GRID_SIZE);
      
      this.zoomCtx.beginPath();
      this.zoomCtx.strokeStyle = 'rgba(143, 143, 143, 0.2)';
      this.zoomCtx.lineWidth = 1;

      // Draw vertical lines
      for (let x = 0; x <= this.zoomCanvas.width; x += cellSize) {
        this.zoomCtx.moveTo(x - 0.5, 0);
        this.zoomCtx.lineTo(x - 0.5, this.zoomCanvas.height);
      }

      // Draw horizontal lines
      for (let y = 0; y <= this.zoomCanvas.height; y += cellSize) {
        this.zoomCtx.moveTo(0, y - 0.5);
        this.zoomCtx.lineTo(this.zoomCanvas.width, y - 0.5);
      }

      this.zoomCtx.stroke();
    }

    drawZoomCrosshair() {
      if (!this.zoomCtx) return;

      const centerCell = Math.floor(GRID_SIZE / 2);
      const cellSize = Math.floor(this.zoomCanvas.width / GRID_SIZE);
      const x = centerCell * cellSize;
      const y = centerCell * cellSize;

      // Draw outer stroke (black)
      this.zoomCtx.strokeStyle = 'rgba(0, 0, 0, 1)';
      this.zoomCtx.lineWidth = 3;
      this.zoomCtx.strokeRect(
        x - 0.5,
        y - 0.5,
        cellSize,
        cellSize
      );

      // Draw inner stroke (white)
      this.zoomCtx.strokeStyle = 'rgba(255, 255, 255, 1)';
      this.zoomCtx.lineWidth = 1;
      this.zoomCtx.strokeRect(
        x - 0.5,
        y - 0.5,
        cellSize,
        cellSize
      );
    }

    handleScroll(event) {
      if (!this.isActive) return;

      // Update scroll position
      this.scrollX = window.scrollX;
      this.scrollY = window.scrollY;

      // Debounce screenshot update
      if (this.debounceTimeout) {
        clearTimeout(this.debounceTimeout);
      }

      this.debounceTimeout = setTimeout(async () => {
        await this.updateScreenshot();
        this.updateZoom();
      }, SCROLL_DEBOUNCE); // Delay screenshot update to avoid too many captures
    }

    async updateScreenshot() {
      if (!this.isActive) return;

      try {
        this.hideUI();
        await new Promise(resolve => setTimeout(resolve, ANIMATION_DURATION));
        
        const screenshot = await browser.runtime.sendMessage({ action: 'captureVisibleTab' });
        const response = await fetch(screenshot);
        const imageBlob = await response.blob();
        const imageBitmap = await createImageBitmap(imageBlob);
        
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
        
        // Reset transformation matrix before scaling
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        // Draw with proper scaling
        this.ctx.scale(dpr, dpr);
        this.ctx.drawImage(imageBitmap, 0, 0, window.innerWidth, window.innerHeight);
        
        imageBitmap.close();
        this.showUI();
        this.updateZoom();
      } catch (error) {
        console.error('Failed to update screenshot:', error);
        this.showUI();
      }
    }

    hideUI() {
      if (this.previewContainer) this.previewContainer.style.display = 'none';
      if (this.zoomContainer) this.zoomContainer.style.display = 'none';
    }

    showUI() {
      if (this.previewContainer) this.previewContainer.style.display = 'block';
      if (this.zoomContainer && this.isZoomEnabled) this.zoomContainer.style.display = 'block';
    }

    async start() {
      if (this.isActive) return;
      
      // Get zoom preference from storage
      try {
          const { zoomEnabled = false } = await browser.storage.local.get('zoomEnabled');
          this.isZoomEnabled = zoomEnabled;
      } catch (error) {
          console.error('Failed to get zoom preference:', error);
          this.isZoomEnabled = false; // Default to disabled on error
      }
      
      this.isActive = true;
      this.hasJustCopied = false;

      // Add keyboard event listener
      document.addEventListener('keydown', this.handleKeyDown.bind(this));

      await this.setupCanvas();
      this.createOverlay();
      
      // Always create preview elements
      const previewElements = this.createPreviewElements();
      this.previewContainer = previewElements.container;
      this.hexPreview = previewElements.hexPreview;
      this.colorPreview = previewElements.colorPreview;
      
      if (this.isZoomEnabled) {
          const zoomElements = this.createZoomCanvas();
          this.zoomCanvas = zoomElements.canvas;
          this.zoomCtx = this.zoomCanvas.getContext('2d', {
            alpha: false,
            imageSmoothingEnabled: false
          });
          this.zoomCtx.imageSmoothingEnabled = false;
          this.zoomCtx.mozImageSmoothingEnabled = false;
          this.zoomCtx.webkitImageSmoothingEnabled = false;
          this.zoomCtx.msImageSmoothingEnabled = false;
          this.zoomContainer = zoomElements.container;
      }
    }

    stop() {
      if (!this.isActive) return;

      this.isActive = false;
      
      // Remove event listeners
      document.removeEventListener('keydown', this.handleKeyDown);
      
      // Clean up UI elements
      if (this.overlay) {
        document.body.removeChild(this.overlay);
        this.overlay = null;
      }

      if (this.canvas) {
        document.body.removeChild(this.canvas);
        this.canvas = null;
        this.ctx = null;
      }

      if (this.zoomContainer) {
        document.body.removeChild(this.zoomContainer);
        this.zoomContainer = null;
        this.zoomCanvas = null;
        this.zoomCtx = null;
      }

      if (this.previewContainer) {
        document.body.removeChild(this.previewContainer);
        this.previewContainer = null;
        this.hexPreview = null;
        this.colorPreview = null;
      }
    }

    async handleColorPick(event) {
      if (!this.isActive) return;

      const color = this.getColorAtPoint(event.clientX, event.clientY);
      if (color) {
        // Add visual feedback for color pick
        if (this.colorPreview) {
          this.colorPreview.style.transform = 'scale(1.1)';
          setTimeout(() => {
            if (this.colorPreview) {
              this.colorPreview.style.transform = 'scale(1)';
            }
          }, ANIMATION_DURATION);
        }

        // Send color to background script
        browser.runtime.sendMessage({
          action: 'colorPicked',
          color: color
        });
      }

      this.stop();
    }

    async handleClick(event) {
      if (!this.isActive) return;
      event.preventDefault();
      event.stopPropagation();
      
      const color = this.getColorAtPoint(event.clientX, event.clientY);
      if (color) {
        // Store the color immediately when picked
        await browser.storage.local.set({ 
          lastPickedColor: color,
          colorHistory: await this.updateColorHistory(color)
        });
        
        // Copy color to clipboard
        await this.copyToClipboard(color);
        
        // Update preview with copied message
        if (this.hexPreview) {
          this.hasJustCopied = true;
          this.hexPreview.textContent = 'Copied!';
          
          // Send color to background script
          browser.runtime.sendMessage({
            action: 'colorPicked',
            color: color
          });

          // Stop picker after 800ms
          setTimeout(() => {
            this.stop();
          }, CLOSE_DELAY);
        }
      }
    }

    handleKeyDown(event) {
      if (!this.isActive) return;

      // Ignore if modifiers except shift are pressed
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      // Handle color selection
      if (event.keyCode === KEY_CODES.ENTER) {
        this.handleColorPick({ clientX: this.mouseX, clientY: this.mouseY });
        event.preventDefault();
        return;
      }

      // Handle cancellation
      if (event.keyCode === KEY_CODES.ESCAPE) {
        event.preventDefault();
        this.stop();
        // Notify that picking was canceled
        browser.runtime.sendMessage({ action: 'pickingCanceled' });
        // Remove event listeners
        document.removeEventListener('keydown', this.handleKeyDown);
        return;
      }

      let offsetX = 0;
      let offsetY = 0;
      const modifier = event.shiftKey ? MOVEMENT.FAST : MOVEMENT.NORMAL;

      // Handle arrow keys
      switch (event.keyCode) {
        case KEY_CODES.LEFT:
          offsetX = -1;
          break;
        case KEY_CODES.RIGHT:
          offsetX = 1;
          break;
        case KEY_CODES.UP:
          offsetY = -1;
          break;
        case KEY_CODES.DOWN:
          offsetY = 1;
          break;
        default:
          return;
      }

      // Apply movement speed modifier
      offsetX *= modifier;
      offsetY *= modifier;

      if (offsetX !== 0 || offsetY !== 0) {
        // Calculate new position
        const newX = Math.max(0, Math.min(this.mouseX + offsetX, window.innerWidth));
        const newY = Math.max(0, Math.min(this.mouseY + offsetY, window.innerHeight));

        // Move the cursor to the new position
        this.moveMouse(newX, newY);

        event.preventDefault();
      }
    }

    handleMouseMove(event) {
      if (!this.isActive) return;
      event.preventDefault();
      
      this.mouseX = event.clientX;
      this.mouseY = event.clientY;

      // Update cursor style based on zoom state
      if (this.overlay) {
        this.overlay.style.cursor = this.isZoomEnabled ? ZOOM_CURSOR : DEFAULT_CURSOR;
      }

      // Get the current pixel color with device pixel ratio support
      const dpr = window.devicePixelRatio || 1;
      const pixelData = this.ctx.getImageData(
        Math.round(this.mouseX * dpr),
        Math.round(this.mouseY * dpr),
        1,
        1
      ).data;

      // Update preview with current color
      this.updatePreview(pixelData);

      // Update positions of preview and zoom
      this.moveTo(this.mouseX, this.mouseY);

      if (this.isZoomEnabled) {
        this.updateZoom();
      }
    }

    moveMouse(x, y) {
      // Calculate screen coordinates
      const screenX = window.screenX + x;
      const screenY = window.screenY + y;
  
      // Create and dispatch a mouse movement event
      const moveEvent = new MouseEvent('mousemove', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        screenX: screenX,
        screenY: screenY
      });
  
      // Dispatch the event from the overlay to ensure proper event handling
      if (this.overlay) {
        this.overlay.dispatchEvent(moveEvent);
      }
    }

    moveTo(x, y) {
      if (!this.previewContainer) return;

      // Update zoom container position if enabled
      if (this.isZoomEnabled && this.zoomContainer) {
        this.zoomContainer.style.left = x + 'px';
        this.zoomContainer.style.top = y + 'px';
      }

      // Calculate preview position
      let previewX = x;
      let previewY = y;
      const previewOffset = this.isZoomEnabled ? PREVIEW_OFFSET.WITH_ZOOM : PREVIEW_OFFSET.WITHOUT_ZOOM;
      
      // Adjust vertical position
      if (y >= window.innerHeight - (this.isZoomEnabled ? MAGNIFIER_SIZE : 50)) {
        // Move preview above the cursor if near bottom
        previewY = y - previewOffset;
        this.previewContainer.style.transform = `translate(${POSITION_OFFSET.DEFAULT}%, -100%)`;
      } else {
        // Default position below cursor
        previewY = y + previewOffset;
        this.previewContainer.style.transform = `translate(${POSITION_OFFSET.DEFAULT}%, 0)`;
      }

      // Adjust horizontal position
      const edgeThreshold = this.isZoomEnabled ? EDGE_THRESHOLD.WITH_ZOOM : EDGE_THRESHOLD.WITHOUT_ZOOM;
      if (x <= edgeThreshold) {
        // Move preview to the right if near left edge
        this.previewContainer.style.transform = this.previewContainer.style.transform.replace(`${POSITION_OFFSET.DEFAULT}%`, '0');
        previewX = x + POSITION_OFFSET.EDGE;
      } else if (x >= window.innerWidth - edgeThreshold) {
        // Move preview to the left if near right edge
        this.previewContainer.style.transform = this.previewContainer.style.transform.replace(`${POSITION_OFFSET.DEFAULT}%`, '-100%');
        previewX = x - POSITION_OFFSET.EDGE;
      }

      // Apply final positions to preview
      this.previewContainer.style.left = previewX + 'px';
      this.previewContainer.style.top = previewY + 'px';
    }

    getColorAtPoint(x, y) {
      if (!this.ctx) return null;

      try {
        const dpr = window.devicePixelRatio || 1;
        const centerX = Math.round(x * dpr);
        const centerY = Math.round(y * dpr);
        
        // Sample a 3x3 pixel area and average for better accuracy
        const area = this.ctx.getImageData(
          Math.max(0, centerX - 1),
          Math.max(0, centerY - 1),
          SAMPLING_AREA, SAMPLING_AREA
        ).data;
        
        let r = 0, g = 0, b = 0, count = 0;
        
        // Average the colors
        for (let i = 0; i < area.length; i += 4) {
          r += area[i];
          g += area[i + 1];
          b += area[i + 2];
          count++;
        }
        
        // Return the averaged center pixel color
        return this.formatColor(
          Math.round(r / count),
          Math.round(g / count),
          Math.round(b / count)
        );
      } catch (e) {
        console.warn('Error sampling color:', e);
        return null;
      }
    }

    formatColor(r, g, b) {
      try {
        if (!Number.isInteger(r) || !Number.isInteger(g) || !Number.isInteger(b) ||
            r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
          throw new Error('Invalid color values');
        }
        const pad = (n) => n.toString(16).padStart(2, '0');
        return `#${pad(r)}${pad(g)}${pad(b)}`.toUpperCase();
      } catch (e) {
        console.warn('Error formatting color:', e);
        return '#000000';
      }
    }

    async updateColorHistory(newColor) {
      try {
        const { colorHistory = [] } = await browser.storage.local.get('colorHistory');
        
        // Remove duplicate if exists
        const newHistory = colorHistory.filter(c => c.hex !== newColor);
        
        // Add new color to the beginning
        newHistory.unshift({ hex: newColor });
        
        // Keep only the last COLOR_HISTORY_SIZE colors
        if (newHistory.length > COLOR_HISTORY_SIZE) {
          newHistory.pop();
        }
        
        return newHistory;
      } catch (error) {
        console.error('Failed to update color history:', error);
        return [];
      }
    }

    async copyToClipboard(text) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.error('Failed to copy:', err);
        return false;
      }
    }

    async setupCanvas() {
      this.canvas = document.createElement('canvas');
      this.canvas.style.display = 'none';
      document.body.appendChild(this.canvas);
      
      try {
        const { ctx, dpr } = await this.setupCanvasContext(this.canvas);
        this.ctx = ctx;
        
        const imageBitmap = await this.captureScreenshot();
        this.ctx.drawImage(imageBitmap, 0, 0, window.innerWidth, window.innerHeight);
        imageBitmap.close();
      } catch (error) {
        console.error('Failed to capture screenshot:', error);
        // First notify about the error
        await browser.runtime.sendMessage({ 
          action: 'pickingCanceled',
          error: 'Failed to capture screenshot'
        });
        // Then cleanup
        this.stop();
      }
    }

    async setupCanvasContext(canvas, options = CANVAS_QUALITY) {
      const ctx = canvas.getContext('2d', options);
      const dpr = window.devicePixelRatio || 1;
      
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      
      // Reset transformation matrix before scaling
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      
      return { ctx, dpr };
    }

    async captureScreenshot() {
      const screenshot = await browser.runtime.sendMessage({ action: 'captureVisibleTab' });
      const response = await fetch(screenshot);
      const imageBlob = await response.blob();
      return await createImageBitmap(imageBlob);
    }

    validateColor(r, g, b) {
      if (!Number.isInteger(r) || !Number.isInteger(g) || !Number.isInteger(b) ||
          r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) {
        throw new Error('Invalid color values');
      }
      return true;
    }

    updatePreview(pixelData) {
      if (!this.hexPreview || !this.colorPreview) return;
      
      try {
        const [r, g, b] = pixelData;
        this.validateColor(r, g, b);

        const hex = this.formatColor(r, g, b);
        
        // Only update hex preview if we haven't copied a color yet
        if (!this.hasJustCopied) {
          this.hexPreview.textContent = hex.toUpperCase();
        }
        
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const borderColor = luminance > 0.5 ? PREVIEW_STYLES.darkBorder : PREVIEW_STYLES.lightBorder;
        
        // Update color preview immediately
        Object.assign(this.colorPreview.style, {
          backgroundColor: `rgb(${r}, ${g}, ${b})`,
          width: `${PREVIEW_SIZE}px`,
          height: `${PREVIEW_SIZE}px`,
          border: `${BORDER_WIDTH}px solid ${borderColor}`,
          borderRadius: PREVIEW_STYLES.borderRadius,
          boxShadow: PREVIEW_STYLES.boxShadow,
          transition: `transform ${ANIMATION_DURATION}ms ease-out`
        });

      } catch (error) {
        console.warn('Error updating preview:', error);
        // Set a default preview state
        this.hexPreview.textContent = 'Invalid';
        this.colorPreview.style.backgroundColor = 'transparent';
      }
    }

    updateZoom() {
      if (!this.isZoomEnabled || !this.zoomCtx || !this.ctx) return;

      this.drawZoom(this.mouseX, this.mouseY);
    }
  }

  // Initialize eyedropper when receiving message
  let currentEyedropper = null;

  // Handle messages from popup
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    let response = { success: false };

    try {
      switch (message.action) {
        case 'startPicking':
          if (!currentEyedropper || !currentEyedropper.isActive) {
            currentEyedropper = new Eyedropper();
            currentEyedropper.isZoomEnabled = message.zoomEnabled;
            currentEyedropper.start();
            browser.runtime.sendMessage({ action: 'pickingStarted' });
            response.success = true;
          }
          break;
          
        case 'stopPicking':
          if (currentEyedropper && currentEyedropper.isActive) {
            currentEyedropper.stop();
            browser.runtime.sendMessage({ action: 'pickingStopped' });
            currentEyedropper = null;
            response.success = true;
          }
          break;
          
        case 'toggleZoom':
          if (currentEyedropper && currentEyedropper.isActive) {
            currentEyedropper.isZoomEnabled = message.enabled;
            
            if (currentEyedropper.isZoomEnabled) {
              if (!currentEyedropper.zoomContainer) {
                const zoomElements = currentEyedropper.createZoomCanvas();
                currentEyedropper.zoomCanvas = zoomElements.canvas;
                currentEyedropper.zoomCtx = currentEyedropper.zoomCanvas.getContext('2d', {
                  alpha: false,
                  imageSmoothingEnabled: false
                });
                currentEyedropper.zoomCtx.imageSmoothingEnabled = false;
                currentEyedropper.zoomCtx.mozImageSmoothingEnabled = false;
                currentEyedropper.zoomCtx.webkitImageSmoothingEnabled = false;
                currentEyedropper.zoomCtx.msImageSmoothingEnabled = false;
                currentEyedropper.zoomContainer = zoomElements.container;
              }
              currentEyedropper.updateZoom();
            } else if (currentEyedropper.zoomContainer) {
              currentEyedropper.zoomContainer.remove();
              currentEyedropper.zoomContainer = null;
              currentEyedropper.zoomCtx = null;
            }
            response.success = true;
          }
          break;
      }
    } catch (error) {
      console.error('Error handling message:', error);
      response.error = error.message;
      browser.runtime.sendMessage({ 
        action: 'pickingCanceled',
        error: error.message 
      });
    } finally {
      // Always send a response
      sendResponse(response);
    }
    // Return true to indicate we'll send a response asynchronously
    return true;
  });

  // Export for content script injection check
  window.startEyedropper = true;
}
