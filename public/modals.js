(function(){
  class Modal {
    constructor(opts){
      this.el = document.createElement('div');
      this.el.className = 'modal-bg';
      this.box = document.createElement('div');
      this.box.className = 'modal-box';
      if(opts.title){
        const h = document.createElement('h3');
        h.textContent = opts.title;
        this.box.appendChild(h);
      }
      this.form = document.createElement('div');
      this.box.appendChild(this.form);
      const btnRow = document.createElement('div');
      btnRow.style.marginTop = '1rem';
      const save = document.createElement('button');
      save.textContent = 'Apply';
      btnRow.appendChild(save);
      this.box.appendChild(btnRow);
      this.el.appendChild(this.box);
      document.body.appendChild(this.el);
      save.addEventListener('click', ()=>{ if(this.onSave) this.onSave(); this.close(); });
    }
    addNumberField(label, key){
      const wrap = document.createElement('label');
      wrap.textContent = label;
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = settings[key];
      inp.oninput = ()=> settings[key] = parseFloat(inp.value);
      wrap.appendChild(inp);
      wrap.style.display = 'block';
      wrap.style.margin = '4px 0';
      this.form.appendChild(wrap);
    }
    open(){ this.el.style.display = 'flex'; }
    close(){ this.el.remove(); }
  }
  function showBalanceModal(){
    const modal = new Modal({ title:'Balance Tweaker' });
    modal.addNumberField('Passive XP /s','XP_PASSIVE');
    modal.addNumberField('XP per Hit','XP_PER_HIT');
    modal.addNumberField('XP per Kill','XP_PER_KILL');
    modal.addNumberField('XP Base','xpBase');
    modal.addNumberField('XP Growth Exp','xpGrowthExp');
    modal.addNumberField('Damage +0-4','dmgStepLow');
    modal.addNumberField('Damage @5','dmgStepCap');
    modal.addNumberField('Damage post-5','dmgStepHi');
    modal.onSave = ()=>{
      if(window.socket) socket.emit('reloadSettings', settings);
    };
    modal.open();
  }
  window.showBalanceModal = showBalanceModal;
})();
