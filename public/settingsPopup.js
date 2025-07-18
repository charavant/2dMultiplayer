(function(){
  class SettingsPopup {
    constructor(el, closeBtn){
      this.el = el;
      this.closeBtn = closeBtn;
      this.returnTo = null;
      if(this.closeBtn){
        this.closeBtn.addEventListener('click', () => this.close());
      }
    }
    open(from){
      this.returnTo = from || null;
      this.el.style.display = 'flex';
    }
    close(){
      this.el.style.display = 'none';
      if(this.onClose) this.onClose(this.returnTo);
      this.returnTo = null;
    }
  }
  window.SettingsPopup = SettingsPopup;
})();
