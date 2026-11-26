const cacheName='carnet-immo-v1-'+self.registration.scope;
self.addEventListener('install',e=>e.waitUntil(caches.open(cacheName).then(c=>c.addAll(['./','index.html','style.css','app.js','app.webmanifest','icon192.png','icon512.png']))));
self.addEventListener('fetch',e=>{
 if(e.request.method==='GET' && e.request.url.startsWith(self.registration.scope))
 e.respondWith(caches.open(cacheName).then(async c=>(await c.match(e.request)) || fetch(e.request)));
});
