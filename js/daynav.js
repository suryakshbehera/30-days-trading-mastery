(function(){
  const TOTAL_DAYS = 30;
  const BUILT_DAYS = [1, 2];
  window.BUILT_DAYS = BUILT_DAYS;

  function pad(n){ return String(n).padStart(2, '0'); }

  window.renderDayGrid = function(mountId){
    const mount = document.getElementById(mountId);
    if(!mount) return;
    let html = '';
    for(let d = 1; d <= TOTAL_DAYS; d++){
      const built = BUILT_DAYS.includes(d);
      html += built
        ? `<a href="day-${pad(d)}.html" class="day-grid-item">${d}</a>`
        : `<span class="day-grid-item locked">${d}</span>`;
    }
    mount.innerHTML = html;
  };

  window.renderDayStrip = function(mountId, currentDay){
    const mount = document.getElementById(mountId);
    if(!mount) return;
    let html = '';
    for(let d = 1; d <= TOTAL_DAYS; d++){
      const built = BUILT_DAYS.includes(d);
      const active = d === currentDay ? ' active' : '';
      html += built
        ? `<a href="day-${pad(d)}.html" class="day-jump-pill${active}">${d}</a>`
        : `<span class="day-jump-pill locked">${d}</span>`;
    }
    mount.innerHTML = html;
    const activeEl = mount.querySelector('.active');
    if(activeEl) activeEl.scrollIntoView({inline: 'center', block: 'nearest'});
  };
})();
