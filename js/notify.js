(function(){
  const KEY_LAST = 'i30-last-visit';
  const KEY_STREAK = 'i30-streak';
  const KEY_PREF = 'i30-notif-enabled';
  const KEY_LAST_DAY = 'i30-last-day';

  const ODIA_DIGITS = ['୦','୧','୨','୩','୪','୫','୬','୭','୮','୯'];
  function toOdiaNumber(n){ return String(n).split('').map(c => ODIA_DIGITS[c] || c).join(''); }

  function todayStr(){ return new Date().toISOString().slice(0,10); }
  function yesterdayStr(){ const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); }

  if(typeof window.CURRENT_DAY === 'number'){
    localStorage.setItem(KEY_LAST_DAY, String(window.CURRENT_DAY));
  }

  function nextDayMessage(streak){
    const lastDay = parseInt(localStorage.getItem(KEY_LAST_DAY) || '0', 10);
    const nextDay = lastDay + 1;
    const builtDays = window.BUILT_DAYS || [];
    if(builtDays.includes(nextDay)){
      return `ଦିନ ${toOdiaNumber(nextDay)} ଆପଣଙ୍କୁ ଅପେକ୍ଷା କରୁଛି! 🔥`;
    }
    return 'ନୂଆ ଦିନ ଆସିଛି! 🔥';
  }

  async function showNotif(title, body){
    const opts = { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' };
    if(navigator.serviceWorker){
      try{
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('sw-timeout')), 1500));
        const reg = await Promise.race([navigator.serviceWorker.ready, timeout]);
        if(reg && reg.showNotification){ reg.showNotification(title, opts); return; }
      }catch(e){}
    }
    if('Notification' in window) new Notification(title, opts);
  }

  function prefOn(){
    return localStorage.getItem(KEY_PREF) === '1' && 'Notification' in window && Notification.permission === 'granted';
  }

  function trackVisitAndMaybeRemind(){
    const today = todayStr();
    const last = localStorage.getItem(KEY_LAST);
    if(last === today) return;

    const streak = (last === yesterdayStr()) ? (parseInt(localStorage.getItem(KEY_STREAK) || '0', 10) + 1) : 1;
    localStorage.setItem(KEY_STREAK, String(streak));

    if(last && prefOn()){
      showNotif(nextDayMessage(streak), `ଆପଣଙ୍କ streak: ${toOdiaNumber(streak)} ଦିନ — ଆଜିର challenge ସମ୍ପୂର୍ଣ୍ଣ କରନ୍ତୁ।`);
    }
    localStorage.setItem(KEY_LAST, today);
  }

  function bindNotifButton(){
    const btn = document.getElementById('notifBtn');
    if(!btn) return;
    if(!('Notification' in window)){ btn.hidden = true; return; }

    function render(){
      btn.textContent = prefOn() ? '🔔 Reminder ON' : '🔕 Reminder OFF';
    }
    render();

    btn.addEventListener('click', async ()=>{
      if(prefOn()){
        localStorage.setItem(KEY_PREF, '0');
        render();
        return;
      }
      const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if(perm === 'granted'){
        localStorage.setItem(KEY_PREF, '1');
        showNotif('ସୂଚନା ଅନ୍ ହେଲା 🎉', 'ପ୍ରତିଦିନ ଆପଣ ଆସିଲେ, ଆପଣଙ୍କୁ ଏକ reminder ମିଳିବ।');
      }
      render();
    });
  }

  trackVisitAndMaybeRemind();
  bindNotifButton();
})();
