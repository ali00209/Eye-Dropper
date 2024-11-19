// Ensure we don't initialize multiple times
if (typeof window.eyedropperInitialized === 'undefined') {
  window.eyedropperInitialized = true;

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
      this.isZoomEnabled = false; // Default zoom disabled
      this.debounceTimeout = null;
      this.hasJustCopied = false; // Flag to track when a color has been copied
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
      container.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 999999;
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 5px;
      `;

      const previewContainer = document.createElement('div');
      previewContainer.style.cssText = `
        background: rgba(0, 0, 0, 0.7);
        padding: 3px 8px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      `;

      const colorPreview = document.createElement('div');
      colorPreview.id = 'eyedropper-color-preview';
      colorPreview.style.cssText = `
        width: 14px;
        height: 14px;
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 2px;
      `;

      const hexPreview = document.createElement('div');
      hexPreview.id = 'eyedropper-hex-preview';
      hexPreview.style.cssText = `
        color: white;
        font-family: monospace;
        font-size: 12px;
        text-align: center;
      `;
      
      previewContainer.appendChild(colorPreview);
      previewContainer.appendChild(hexPreview);
      container.appendChild(previewContainer);
      document.body.appendChild(container);
      
      return { container, hexPreview, colorPreview };
    }

    createZoomCanvas() {
      const container = document.createElement('div');
      container.id = 'eyedropper-zoom-container';
      container.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 999999;
        transform: translate(-50%, -50%);
        cursor: none;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 5px;
      `;

      const zoomCanvas = document.createElement('canvas');
      zoomCanvas.id = 'eyedropper-zoom';
      zoomCanvas.width = 120; 
      zoomCanvas.height = 120; 
      
      zoomCanvas.style.cssText = `
        border: 2px solid #fff;
        border-radius: 50%;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        image-rendering: pixelated;
      `;
      
      container.appendChild(zoomCanvas);
      document.body.appendChild(container);
      return { container, canvas: zoomCanvas };
    }

    drawZoom(ctx, zoomCtx, x, y, zoomLevel = 10) {
      const zoomSize = 13; 
      const pixelSize = zoomCtx.canvas.width / zoomSize; 
      const halfZoom = Math.floor(zoomSize / 2);
      const radius = zoomCtx.canvas.width / 2;
      
      // Clear the zoom canvas
      zoomCtx.clearRect(0, 0, zoomCtx.canvas.width, zoomCtx.canvas.height);
      
      // Create circular clip
      zoomCtx.save();
      zoomCtx.beginPath();
      zoomCtx.arc(radius, radius, radius - 2, 0, Math.PI * 2);
      zoomCtx.clip();
      
      // Draw the zoomed pixels
      for (let offsetY = -halfZoom; offsetY <= halfZoom; offsetY++) {
        for (let offsetX = -halfZoom; offsetX <= halfZoom; offsetX++) {
          const sourceX = x + offsetX;
          const sourceY = y + offsetY;
          
          // Get the color of the current pixel
          const pixelData = ctx.getImageData(sourceX, sourceY, 1, 1).data;
          
          // Calculate position in zoom canvas
          const zoomX = (offsetX + halfZoom) * pixelSize;
          const zoomY = (offsetY + halfZoom) * pixelSize;
          
          // Draw the pixel
          zoomCtx.fillStyle = `rgba(${pixelData[0]}, ${pixelData[1]}, ${pixelData[2]}, ${pixelData[3] / 255})`;
          zoomCtx.fillRect(zoomX, zoomY, pixelSize, pixelSize);
        }
      }
      
      // Draw the grid within the circle
      zoomCtx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; 
      zoomCtx.lineWidth = 0.5;
      
      // Draw vertical grid lines
      for (let i = 1; i < zoomSize; i++) {
        const x = i * pixelSize;
        zoomCtx.beginPath();
        zoomCtx.moveTo(x, 0);
        zoomCtx.lineTo(x, zoomCtx.canvas.height);
        zoomCtx.stroke();
      }
      
      // Draw horizontal grid lines
      for (let i = 1; i < zoomSize; i++) {
        const y = i * pixelSize;
        zoomCtx.beginPath();
        zoomCtx.moveTo(0, y);
        zoomCtx.lineTo(zoomCtx.canvas.width, y);
        zoomCtx.stroke();
      }
      
      // Restore context to remove clip
      zoomCtx.restore();
      
      // Draw circular border
      zoomCtx.beginPath();
      zoomCtx.arc(radius, radius, radius - 2, 0, Math.PI * 2);
      zoomCtx.strokeStyle = '#fff';
      zoomCtx.lineWidth = 2;
      zoomCtx.stroke();
      
      // Add a subtle black outline for better visibility on light backgrounds
      zoomCtx.beginPath();
      zoomCtx.arc(radius, radius, radius - 1, 0, Math.PI * 2);
      zoomCtx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
      zoomCtx.lineWidth = 1;
      zoomCtx.stroke();
      
      // Highlight the center pixel
      const centerX = halfZoom * pixelSize;
      const centerY = halfZoom * pixelSize;
      
      // Create square highlight for center pixel
      zoomCtx.save();
      zoomCtx.beginPath();
      zoomCtx.arc(radius, radius, radius - 2, 0, Math.PI * 2);
      zoomCtx.clip();
      
      // Draw highlight border around center pixel
      zoomCtx.strokeStyle = '#fff';
      zoomCtx.lineWidth = 2;
      zoomCtx.strokeRect(centerX, centerY, pixelSize, pixelSize);
      
      // Draw black inner border
      zoomCtx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
      zoomCtx.lineWidth = 1;
      zoomCtx.strokeRect(centerX, centerY, pixelSize, pixelSize);
      
      zoomCtx.restore();
    }

    createOverlay() {
      this.overlay = document.createElement('div');
      this.overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 999998;
        cursor: ${this.isZoomEnabled ? 'none' : 'crosshair'};
        background: transparent;
        user-select: none;
        -moz-user-select: none;
        -webkit-user-select: none;
        pointer-events: auto;
      `;

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
      }, 150); // Delay screenshot update to avoid too many captures
    }

    async updateScreenshot() {
      if (!this.isActive) return;

      try {
        const screenshot = await browser.runtime.sendMessage({ action: 'captureVisibleTab' });
        const img = new Image();
        img.src = screenshot;
        await new Promise(resolve => img.onload = resolve);
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(img, 0, 0);
      } catch (error) {
        console.error('Failed to update screenshot:', error);
      }
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
          this.zoomCtx = this.zoomCanvas.getContext('2d');
          this.zoomContainer = zoomElements.container;
      }
    }

    stop() {
      this.isActive = false;
      window.removeEventListener('scroll', this.handleScroll);
      if (this.debounceTimeout) {
        clearTimeout(this.debounceTimeout);
      }
      if (this.canvas) {
        this.canvas.remove();
        this.canvas = null;
        this.ctx = null;
      }
      if (this.overlay) {
        this.overlay.remove();
        this.overlay = null;
      }
      if (this.zoomContainer) {
        this.zoomContainer.remove();
        this.zoomContainer = null;
        this.zoomCanvas = null;
        this.zoomCtx = null;
      }
      if (this.previewContainer) {
        this.previewContainer.remove();
        this.previewContainer = null;
        this.hexPreview = null;
        this.colorPreview = null;
      }
    }

    async setupCanvas() {
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d');
      this.canvas.style.display = 'none';
      document.body.appendChild(this.canvas);
      
      try {
        const screenshot = await browser.runtime.sendMessage({ action: 'captureVisibleTab' });
        const img = new Image();
        img.src = screenshot;
        await new Promise(resolve => img.onload = resolve);
        
        // Set canvas size to full document size
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.ctx.drawImage(img, 0, 0);
      } catch (error) {
        console.error('Failed to capture screenshot:', error);
        this.stop();
        browser.runtime.sendMessage({ 
          action: 'pickingCanceled',
          error: 'Failed to capture screenshot'
        });
      }
    }

    updateZoom() {
      if (!this.isZoomEnabled || !this.zoomCtx || !this.ctx) return;

      this.drawZoom(this.ctx, this.zoomCtx, this.mouseX, this.mouseY);
    }

    updatePreview(pixelData) {
      if (!this.hexPreview || !this.colorPreview) return;
      
      const [r, g, b] = pixelData;
      // Only update hex preview if we haven't copied a color yet
      if (!this.hasJustCopied) {
        const hex = '#' + [r, g, b].map(x => {
          const hex = x.toString(16);
          return hex.length === 1 ? '0' + hex : hex;
        }).join('');
        this.hexPreview.textContent = hex.toUpperCase();
      }
      this.colorPreview.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
    }

    async handleColorPick(event) {
      if (!this.isActive) return;

      const color = this.getColorAtPoint(event.clientX, event.clientY);
      if (color) {
        // Send color to background script
        browser.runtime.sendMessage({
          action: 'colorPicked',
          color: color,
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
          }, 800);
        }
      }
    }

    handleKeyDown(event) {
      if (!this.isActive) return;
      
      if (event.key === 'Escape') {
        event.preventDefault();
        this.stop();
        browser.runtime.sendMessage({ action: 'pickingCanceled' });
      }
    }

    handleMouseMove(event) {
      if (!this.isActive) return;
      event.preventDefault();
      
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = event.clientX;
      this.mouseY = event.clientY;

      // Update cursor style based on zoom state
      if (this.overlay) {
        this.overlay.style.cursor = this.isZoomEnabled ? 'none' : 'crosshair';
      }

      // Get the current pixel color
      const pixelData = this.ctx.getImageData(
        this.mouseX - rect.left,
        this.mouseY - rect.top,
        1,
        1
      ).data;

      // Update preview
      this.updatePreview(pixelData);

      // Position the preview container
      const previewOffset = this.isZoomEnabled ? 70 : 30; // Adjust offset based on zoom state
      this.previewContainer.style.left = this.mouseX + 'px';
      this.previewContainer.style.top = (this.mouseY + previewOffset) + 'px';

      if (this.isZoomEnabled) {
        this.updateZoom();
        // Position the zoom container
        this.zoomContainer.style.left = this.mouseX + 'px';
        this.zoomContainer.style.top = this.mouseY + 'px';
      }
    }

    getColorAtPoint(x, y) {
      if (!this.ctx) return null;
      
      try {
        // Get color at current mouse position
        const pixel = this.ctx.getImageData(x, y, 1, 1).data;
        return this.rgbToHex(pixel[0], pixel[1], pixel[2]);
      } catch (error) {
        console.error('Failed to get pixel color:', error);
        return null;
      }
    }

    rgbToHex(r, g, b) {
      const toHex = (n) => {
        const hex = n.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      };
      return '#' + toHex(r) + toHex(g) + toHex(b);
    }

    rgbToHsl(r, g, b) {
      r /= 255;
      g /= 255;
      b /= 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h, s, l = (max + min) / 2;

      if (max === min) {
        h = s = 0;
      } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
      }

      return [
        Math.round(h * 360),
        Math.round(s * 100),
        Math.round(l * 100)
      ];
    }

    async updateColorHistory(newColor) {
      try {
        const { colorHistory = [] } = await browser.storage.local.get('colorHistory');
        
        // Remove duplicate if exists
        const newHistory = colorHistory.filter(c => c.hex !== newColor);
        
        // Add new color to the beginning
        newHistory.unshift({ hex: newColor });
        
        // Keep only the last 10 colors
        if (newHistory.length > 10) {
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
  }

  // Initialize eyedropper when receiving message
  let currentEyedropper = null;

  browser.runtime.onMessage.addListener((message) => {
    if (message.action === 'startPicking') {
      currentEyedropper = new Eyedropper();
      currentEyedropper.start();
    } else if (message.action === 'stopPicking') {
      if (currentEyedropper) {
        currentEyedropper.stop();
        currentEyedropper = null;
      }
    }
  });
}

// Export for content script injection check
window.startEyedropper = true;
