const C='evo-v6';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  if(e.request.url.includes('api.anthropic')||e.request.url.includes('firebase')||e.request.url.includes('googleapis'))return;
  e.respondWith(caches.open(C).then(c=>c.match(e.request).then(r=>r||fetch(e.request).then(res=>{if(res.ok)c.put(e.request,res.clone());return res;}).catch(()=>r))));
});
self.addEventListener('message',e=>{
  if(e.data&&e.data.type==='SCHEDULE_NOTIF'){
    setTimeout(()=>{self.registration.showNotification(e.data.title,{body:e.data.body,tag:e.data.tag||'evo',vibrate:[200,100,200]});},e.data.delayMs||500);
  }
});
