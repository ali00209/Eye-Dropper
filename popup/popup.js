document.addEventListener('DOMContentLoaded', async () => {
  const colorDisplay = document.getElementById('colorDisplay');
  const eyedropperBtn = document.getElementById('eyedropper');
  const copyBtn = document.getElementById('copyColor');
  const zoomToggle = document.getElementById('zoomToggle');
  const hexValue = document.getElementById('hexValue');
  const rgbValue = document.getElementById('rgbValue');
  const hslValue = document.getElementById('hslValue');
  const colorHistory = document.getElementById('colorHistory');
  const feedback = document.getElementById('feedback');
  const themeToggle = document.getElementById('themeToggle');
  const html = document.documentElement;

  let currentColor = null;
  let colorHistoryList = [];
  let isZoomEnabled = false;

  // Load saved state
  browser.storage.local.get(['colorHistory', 'lastPickedColor', 'zoomEnabled']).then(result => {
    if (result.colorHistory) {
      colorHistoryList = result.colorHistory;
      updateColorHistory();
    }
    if (result.lastPickedColor) {
      updateColorDisplay(result.lastPickedColor);
    }
    if (result.zoomEnabled) {
      isZoomEnabled = result.zoomEnabled;
      updateZoomButton();
    }
  });

  // Check for saved theme preference
  const savedTheme = localStorage.getItem('theme') || 'light';
  html.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme === 'dark');

  // Toggle zoom
  zoomToggle.addEventListener('click', () => {
    isZoomEnabled = !isZoomEnabled;
    updateZoomButton();
    browser.storage.local.set({ zoomEnabled: isZoomEnabled });
  });

  function updateZoomButton() {
    if (isZoomEnabled) {
      zoomToggle.classList.add('zoom-active');
      zoomToggle.title = 'Zoom enabled';
    } else {
      zoomToggle.classList.remove('zoom-active');
      zoomToggle.title = 'Zoom disabled';
    }
  }

  // Start eyedropper
  eyedropperBtn.addEventListener('click', async () => {
    // Get fresh active tab status each time
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    
    if (!activeTab || (!activeTab.url.startsWith('http://') && !activeTab.url.startsWith('https://'))) {
      showNotification('Please open a webpage to use the color picker.', 'error');
      return;
    }

    try {
      // First send message to start picking
      await browser.tabs.sendMessage(activeTab.id, { 
        action: 'startPicking',
        zoomEnabled: isZoomEnabled
      });
      await browser.runtime.sendMessage({ action: 'startPicking' });
      
      // Close the popup
      window.close();
    } catch (error) {
      showNotification('Failed to start color picker. Please refresh the page and try again.', 'error');
    }
  });

  // Copy color value
  copyBtn.addEventListener('click', () => {
    if (!currentColor) {
      showNotification('Please pick a color first.', 'error');
      return;
    }

    const format = document.querySelector('.color-format[data-format].active') || 
                  document.querySelector('.color-format[data-format="hex"]');
    const value = format.querySelector('span').textContent;
    
    navigator.clipboard.writeText(value).then(() => {
      showNotification('Color copied!', 'success');
    }).catch(() => {
      showNotification('Failed to copy color.', 'error');
    });
  });

  // Handle color format clicks
  document.querySelectorAll('.color-format').forEach(format => {
    format.addEventListener('click', () => {
      if (!currentColor) return;
      
      document.querySelectorAll('.color-format').forEach(f => f.classList.remove('active'));
      format.classList.add('active');
      
      const value = format.querySelector('span').textContent;
      navigator.clipboard.writeText(value).then(() => {
        showNotification('Color copied!', 'success');
      }).catch(() => {
        showNotification('Failed to copy color.', 'error');
      });
    });
  });

  // Handle color history clicks
  colorHistory.addEventListener('click', (e) => {
    const colorDiv = e.target.closest('.history-color');
    if (!colorDiv) return;

    const color = colorDiv.getAttribute('data-color');
    updateColorDisplay(color);
  });

  function updateColorDisplay(color) {
    if (!color || !isValidColor(color)) {
      console.error('Invalid color format:', color);
      return;
    }

    currentColor = color;
    colorDisplay.style.backgroundColor = color;
    
    // Update color values
    const rgb = hexToRgb(color);
    if (!rgb) {
      console.error('Failed to parse color:', color);
      return;
    }

    const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);
    
    hexValue.textContent = color;
    rgbValue.textContent = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    hslValue.textContent = `hsl(${Math.round(h)}deg, ${Math.round(s)}%, ${Math.round(l)}%)`;

    // Save the color
    browser.storage.local.set({ lastPickedColor: color });
  }

  function isValidColor(color) {
    // Check if it's a valid hex color
    return /^#[0-9A-F]{6}$/i.test(color);
  }

  function addToHistory(color) {
    if (!color || !isValidColor(color)) return;

    if (!colorHistoryList.includes(color)) {
      colorHistoryList.unshift(color);
      if (colorHistoryList.length > 10) {
        colorHistoryList.pop();
      }
      browser.storage.local.set({ colorHistory: colorHistoryList });
      updateColorHistory();
    }
  }

  function updateColorHistory() {
    colorHistory.innerHTML = '';
    colorHistoryList.forEach(color => {
      if (color && isValidColor(color)) {
        const div = document.createElement('div');
        div.className = 'history-color';
        div.style.backgroundColor = color;
        div.setAttribute('data-color', color);
        div.title = color;
        colorHistory.appendChild(div);
      }
    });
  }

  function showNotification(message, type = '') {
    const container = document.querySelector('.notification-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    // Remove any existing notifications
    const existingToast = container.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    container.appendChild(toast);
    
    // Remove after animation
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(100px)';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  // Theme toggle functionality
  themeToggle.addEventListener('click', () => {
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme === 'dark');
  });

  function updateThemeIcon(isDark) {
    const themeToggle = document.getElementById('themeToggle');
    
    // Clear existing content
    while (themeToggle.firstChild) {
        themeToggle.removeChild(themeToggle.firstChild);
    }
    
    // Create SVG element
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    
    // Create path element
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    
    if (isDark) {
        // Sun icon
        svg.classList.add('sun');
        path.setAttribute("d", "M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42");
        
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", "12");
        circle.setAttribute("cy", "12");
        circle.setAttribute("r", "5");
        svg.appendChild(circle);
    } else {
        // Moon icon
        svg.classList.add('moon');
        path.setAttribute("d", "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z");
    }
    
    svg.appendChild(path);
    themeToggle.appendChild(svg);
  }

  // Listen for messages from content script
  browser.runtime.onMessage.addListener((message) => {
    if (message.action === 'colorPicked') {
      if (message.color && isValidColor(message.color)) {
        updateColorDisplay(message.color);
        addToHistory(message.color);
      } else {
        console.error('Invalid color received:', message.color);
        showNotification('Invalid color format received', 'error');
      }
    } else if (message.action === 'pickingCanceled') {
      if (message.error) {
        showNotification(message.error, 'error');
      }
    }
  });

  function hexToRgb(hex) {
    // Remove # if present
    hex = hex.replace(/^#/, '');
    
    // Parse the hex values
    const bigint = parseInt(hex, 16);
    if (isNaN(bigint)) return null;
    
    return {
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255
    };
  }

  function rgbToHsl(r, g, b) {
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
  
    return {
      h: h * 360,
      s: s * 100,
      l: l * 100
    };
  }
});
