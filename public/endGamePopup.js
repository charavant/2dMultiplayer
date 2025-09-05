(function(){
  class EndGamePopup {
    constructor(el){
      this.el = el;
      this.titleEl = el.querySelector('#winnerTitle');
      this.blueTable = el.querySelector('#winnerBlue');
      this.redTable = el.querySelector('#winnerRed');
      this.blueScoreEl = el.querySelector('#finalBlueScore');
      this.redScoreEl = el.querySelector('#finalRedScore');
      this.timerEl = el.querySelector('#timer');
    }
    truncateName(name){
      if(!name) return 'Unnamed';
      return name.length > 12 ? name.slice(0,12) + '\u2026' : name;
    }
    calcScore(p){
      return Math.ceil((p.kills || 0) * 50 + (p.assists || 0) * 10 + (p.damage || 0));
    }
    show(data){
      let winner = 'draw';
      if (Math.ceil(data.scoreBlue) === Math.ceil(data.scoreRed)) {
        let dmgBlue = 0, dmgRed = 0;
        const allP = Object.values(data.players)
          .concat(Object.values(data.disconnectedPlayers || {}));
        allP.forEach(p => {
          if (p.team === 'left') dmgBlue += p.damage || 0;
          else if (p.team === 'right') dmgRed += p.damage || 0;
        });
        if (dmgBlue > dmgRed) winner = 'blue';
        else if (dmgRed > dmgBlue) winner = 'red';
      } else if (data.scoreBlue > data.scoreRed) {
        winner = 'blue';
      } else {
        winner = 'red';
      }
      if (winner === 'blue') {
        this.titleEl.className = 'scoreBox scoreBlue';
        this.titleEl.textContent = 'Blue Team Wins';
      } else if (winner === 'red') {
        this.titleEl.className = 'scoreBox scoreRed';
        this.titleEl.textContent = 'Red Team Wins';
      } else {
        this.titleEl.className = 'scoreBox';
        this.titleEl.textContent = 'Draw';
      }
      if(this.blueScoreEl) this.blueScoreEl.textContent = Math.ceil(data.scoreBlue);
      if(this.redScoreEl) this.redScoreEl.textContent = Math.ceil(data.scoreRed);
      const header = '<thead><tr><th>Name</th><th>Kills</th><th>Deaths</th><th>Assists</th><th>Damage</th><th>Score</th></tr></thead><tbody></tbody>';
      this.blueTable.innerHTML = header;
      this.redTable.innerHTML = header;
      const blueBody = this.blueTable.querySelector('tbody');
      const redBody = this.redTable.querySelector('tbody');
      const all = Object.values(data.players)
        .concat(Object.values(data.disconnectedPlayers || {}));
      const blue = all.filter(p => p.team === 'left').sort((a,b) => this.calcScore(b) - this.calcScore(a));
      const red = all.filter(p => p.team === 'right').sort((a,b) => this.calcScore(b) - this.calcScore(a));
      const appendRows = (body, arr) => {
        arr.forEach(p => {
          const row = document.createElement('tr');
          const score = this.calcScore(p);
          const device = p.device==='pc' ? '<i class="bi bi-pc-display"></i>' : '<i class="bi bi-phone"></i>';
          const disc = p.disconnected ? ' <i class="bi bi-wifi-off text-warning"></i>' : '';
          const name = this.truncateName(p.name || 'Unnamed');
          row.innerHTML = `<td class="nameCell">${name} ${device}${disc}</td><td>${p.kills || 0}</td><td>${p.deaths || 0}</td><td>${p.assists || 0}</td><td>${Math.ceil(p.damage || 0)}</td><td>${score}</td>`;
          body.appendChild(row);
        });
      };
      appendRows(blueBody, blue);
      appendRows(redBody, red);
      document.getElementById('overlay').classList.add('blur');
      document.getElementById('gameCanvas').classList.add('blur');
      this.el.style.display = 'block';
    }
    hide(){
      this.el.style.display = 'none';
      document.getElementById('overlay').classList.remove('blur');
      document.getElementById('gameCanvas').classList.remove('blur');
    }
  }
  window.EndGamePopup = EndGamePopup;
})();
