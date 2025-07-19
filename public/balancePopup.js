(function(){
  class BalancePopup {
    constructor(el){
      this.el = el;
      this.applyBtn = el.querySelector('.balance-apply');
      this.closeBtn = el.querySelector('.balance-close');
      this.inputs = Array.from(el.querySelectorAll('input[data-setting]'));
      if(this.applyBtn) this.applyBtn.addEventListener('click', () => this.apply());
      if(this.closeBtn) this.closeBtn.addEventListener('click', () => this.close());
    }
    open(){
      this.inputs.forEach(inp => {
        const key = inp.dataset.setting;
        if(settings[key] !== undefined) inp.value = settings[key];
      });
      this.el.style.display = 'flex';
    }
    close(){ this.el.style.display = 'none'; }
    apply(){
      this.inputs.forEach(inp => {
        const key = inp.dataset.setting;
        const val = parseFloat(inp.value);
        if(!isNaN(val)) settings[key] = val;
      });
      if(window.socket) socket.emit('reloadSettings', settings);
      this.close();
    }
  }
  window.BalancePopup = BalancePopup;
})();
