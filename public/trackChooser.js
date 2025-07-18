(function(){
  class TrackChooser {
    constructor(el, tracks, onChange){
      this.el = el;
      this.tracks = tracks || [];
      this.onChange = onChange;
      this.index = 0;
      this.wrap = el.querySelector('.tc-name-wrap');
      this.left = el.querySelector('.tc-arrow.left');
      this.right = el.querySelector('.tc-arrow.right');
      this.left.addEventListener('click', () => this.move(-1));
      this.right.addEventListener('click', () => this.move(1));
      this.show(0);
    }
    show(i){
      this.wrap.innerHTML = '';
      const span = document.createElement('span');
      span.className = 'tc-name';
      span.textContent = this.tracks[i] || '';
      this.wrap.appendChild(span);
      this.label = span;
      this.index = i;
      if(this.onChange) this.onChange(this.tracks[this.index]);
    }
    move(dir){
      if(!this.tracks.length) return;
      const newIndex = (this.index + dir + this.tracks.length) % this.tracks.length;
      const oldSpan = this.label;
      const newSpan = document.createElement('span');
      newSpan.className = 'tc-name';
      newSpan.textContent = this.tracks[newIndex];
      newSpan.classList.add(dir>0? 'slide-in-right' : 'slide-in-left');
      oldSpan.classList.add(dir>0? 'slide-out-left' : 'slide-out-right');
      this.wrap.appendChild(newSpan);
      setTimeout(() => oldSpan.remove(), 250);
      this.label = newSpan;
      this.index = newIndex;
      if(this.onChange) this.onChange(this.tracks[this.index]);
    }
  }
  window.TrackChooser = TrackChooser;
})();
