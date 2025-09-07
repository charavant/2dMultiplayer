/**
 * Reusable Edit Name Popup functionality
 * Can be used across different game screens
 */
class EditNamePopup {
  constructor(socket, saveProfileCallback) {
    this.socket = socket;
    this.saveProfileCallback = saveProfileCallback;
    this.popup = document.getElementById('editNamePopup');
    this.input = document.getElementById('editNameInput');
    this.saveBtn = document.getElementById('saveNameBtn');
    this.cancelBtn = document.getElementById('cancelEditNameBtn');
    this.currentPlayer = null;
    
    this.init();
  }

  init() {
    if (!this.popup || !this.input || !this.saveBtn || !this.cancelBtn) {
      console.warn('EditNamePopup: Required elements not found');
      return;
    }

    this.saveBtn.addEventListener('click', () => this.saveNewName());
    this.cancelBtn.addEventListener('click', () => this.closePopup());
    
    // Handle Enter key in input
    this.input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.saveNewName();
      }
    });
    
    // Close popup when clicking outside
    this.popup.addEventListener('click', (e) => {
      if (e.target === this.popup) {
        this.closePopup();
      }
    });

    // Handle keyboard events for mobile positioning
    this.input.addEventListener('focus', () => this.handleKeyboardOpen());
    this.input.addEventListener('blur', () => this.handleKeyboardClose());
    
    // Handle viewport changes (keyboard open/close)
    window.addEventListener('resize', () => this.handleViewportChange());
    window.addEventListener('orientationchange', () => this.handleViewportChange());
  }

  setPlayer(player) {
    this.currentPlayer = player;
  }

  openPopup() {
    if (this.currentPlayer && this.currentPlayer.name) {
      this.input.value = this.currentPlayer.name;
      this.popup.style.display = 'flex';
      
      // Position popup for mobile landscape
      this.positionForMobile();
      
      this.input.focus();
      this.input.select();
    }
  }

  closePopup() {
    this.popup.style.display = 'none';
    // Reset positioning
    this.popup.style.alignItems = 'center';
    this.popup.style.paddingTop = '10vh';
  }

  positionForMobile() {
    // Check if we're in mobile landscape mode
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                     (navigator.maxTouchPoints && navigator.maxTouchPoints > 1);
    const isLandscape = window.matchMedia('(orientation: landscape)').matches;
    
    if (isMobile && isLandscape) {
      // Position popup higher up to account for keyboard
      this.popup.style.paddingTop = '5vh';
      this.popup.style.justifyContent = 'flex-start';
      // keep horizontal center
      this.popup.style.alignItems = 'center';
    } else {
      // Default centered positioning
      this.popup.style.paddingTop = '0';
      this.popup.style.justifyContent = 'center';
      this.popup.style.alignItems = 'center';
    }
  }

  handleKeyboardOpen() {
    // When keyboard opens, scroll the popup up
    setTimeout(() => {
      this.scrollToInput();
    }, 300); // Delay to allow keyboard animation
  }

  handleKeyboardClose() {
    // When keyboard closes, reset positioning
    setTimeout(() => {
      this.positionForMobile();
    }, 300);
  }

  handleViewportChange() {
    // Handle orientation changes and viewport resizing
    setTimeout(() => {
      if (this.popup.style.display === 'flex') {
        this.positionForMobile();
        this.scrollToInput();
      }
    }, 500);
  }

  scrollToInput() {
    // Scroll the popup to ensure input is visible above keyboard
    if (this.popup && this.input) {
      const popupRect = this.popup.getBoundingClientRect();
      const inputRect = this.input.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      
      // If input is in the lower half of the screen, scroll up
      if (inputRect.bottom > viewportHeight * 0.5) {
        const scrollAmount = inputRect.bottom - (viewportHeight * 0.4);
        this.popup.scrollTop = Math.max(0, scrollAmount);
      }
    }
  }

  saveNewName() {
    const newName = this.input.value.trim();
    if (!newName || newName === this.currentPlayer.name) {
      this.closePopup();
      return;
    }
    
    // Save to profile if callback provided
    if (this.saveProfileCallback) {
      this.saveProfileCallback({ name: newName });
    }
    
    // Emit to server
    if (this.socket) {
      this.socket.emit('changeName', { newName });
    }
    
    this.closePopup();
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EditNamePopup;
} else if (typeof window !== 'undefined') {
  window.EditNamePopup = EditNamePopup;
}
