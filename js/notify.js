(function(){
  const KEY_LAST = 'i30-last-visit';
  const KEY_STREAK = 'i30-streak';
  const KEY_PREF = 'i30-notif-enabled';
  const KEY_LAST_DAY = 'i30-last-day';
  const KEY_SUB_ENDPOINT = 'i30-push-endpoint';

  const VAPID_PUBLIC_KEY = 'REPLACE_AFTER_DEPLOY';
  const WORKER_URL = 'https://intraday30-push.REPLACE_AFTER_DEPLOY.workers.dev';

  const ODIA_DIGITS = ['୦','୧','୨','୩','୪','୫','୬','୭','୮','୯'];
  function toOdiaNumber(n){ return String(n).split('').map(c => ODIA_DIGITS[c] || c).join(''); }

  function todayStr(){ return new Date().toISOString().slice(0,10); }
  function yesterdayStr(){ const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); }

  function urlBase64ToUint8Array(base64String){
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g,'+').replace(/_/g,'/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  }

  async function getExistingSubscription(){
    if(!('serviceWorker' in navigator)) return null;
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  }

  async function subscribeToPush(){
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
    await fetch(WORKER_URL + '/subscribe', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify(sub.toJSON()),
    });
    localStorage.setItem(KEY_SUB_ENDPOINT, sub.endpoint);
    return sub;
  }

  async function unsubscribeFromPush(){
    const sub = await getExistingSubscription();
    if(!sub) return;
    await fetch(WORKER_URL + '/unsubscribe', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(()=>{});
    await sub.unsubscribe().catch(()=>{});
    localStorage.removeItem(KEY_SUB_ENDPOINT);
  }

  function pingProgress(day){
    const endpoint = localStorage.getItem(KEY_SUB_ENDPOINT);
    if(!endpoint) return;
    fetch(WORKER_URL + '/progress', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ endpoint, day }),
    }).catch(()=>{});
  }

  if(typeof window.CURRENT_DAY === 'number'){
    localStorage.setItem(KEY_LAST_DAY, String(window.CURRENT_DAY));
    pingProgress(window.CURRENT_DAY);
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

  function trackVisit(){
    const today = todayStr();
    const last = localStorage.getItem(KEY_LAST);
    if(last === today) return parseInt(localStorage.getItem(KEY_STREAK) || '0', 10);

    const streak = (last === yesterdayStr()) ? (parseInt(localStorage.getItem(KEY_STREAK) || '0', 10) + 1) : 1;
    localStorage.setItem(KEY_STREAK, String(streak));
    localStorage.setItem(KEY_LAST, today);
    return streak;
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
        await unsubscribeFromPush();
        render();
        return;
      }
      const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if(perm === 'granted'){
        localStorage.setItem(KEY_PREF, '1');
        try{ await subscribeToPush(); }catch(e){ console.error('push subscribe failed', e); }
        showNotif('ସୂଚନା ଅନ୍ ହେଲା 🎉', 'ପ୍ରତିଦିନ ନୂଆ ଦିନ ଖୋଲିଲେ, ଆପଣଙ୍କୁ ଏକ reminder ମିଳିବ।');
      }
      render();
    });
  }

  trackVisit();
  bindNotifButton();
})();
