const el=id=>document.getElementById(id);
const profiles=['Achat','Sous-location','Conciergerie'];
const stages=['À examiner','Gardées','Contactées','Écartées'];
const fields=['url','budget','area','words','detail','dpeMax','roomsMin'];
const db=await new Promise((resolve,reject)=>{
 const req=indexedDB.open('carnet-immo-v1',1);
 req.onupgradeneeded=()=>req.result.createObjectStore('projects');
 req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
});
function access(profile,fn){
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('projects',fn?'readwrite':'readonly'),store=tx.objectStore('projects'),req=store.get(profile);
  let data;
  req.onsuccess=()=>{data=req.result||{settings:{},ads:[]};if(fn){fn(data);store.put(data,profile)}};
  tx.oncomplete=()=>resolve(data);tx.onabort=()=>reject(tx.error);
 });
}
const profile=()=>el('profile').value;
const msg=t=>el('msg').textContent=t;
function node(tag,text){const n=document.createElement(tag);n.textContent=text;return n}
function safeUrl(value,search=false){
 try{const u=new URL(value);return u.protocol==='https:' && ['www.leboncoin.fr','leboncoin.fr'].includes(u.hostname) && (!search || u.pathname==='/recherche')?u.href:''}catch{return ''}
}
function normalize(a){
 const attr=k=>a.attributes?.find?.(v=>v.key===k);
 const value=k=>attr(k)?.valueLabel||attr(k)?.value||'';
 return {id:String(a.id),title:String(a.title||'Annonce'),city:a.city||'',zipcode:a.zipcode||'',department:a.department||'',price:a.price==null?null:Number(a.price),surface:Number(attr('square')?.value)||null,description:a.description||'',rooms:value('rooms'),bedrooms:value('bedrooms'),bathrooms:value('nb_bathrooms'),showerRooms:value('nb_shower_room'),landSurface:value('land_plot_surface'),saleType:value('type_real_estate_sale')||value('immo_sell_type'),propertyType:value('real_estate_type')||a.categoryName||'',features:attr('specificities')?.valueLabel||'',dpe:value('energy_rate'),ges:value('ges'),reference:value('custom_ref'),date:a.firstPublicationDate,url:safeUrl(a.url),images:(a.images||[]).filter(x=>typeof x==='string'&&x.startsWith('https://img.leboncoin.fr/')).slice(0,12),ownerType:a.ownerType,ownerName:a.ownerName,attributes:a.attributes||[],pricePerM2:value('price_per_square_meter'),notaryFees:value('estimated_notary_fees'),totalProject:value('estimated_total_property_price'),annualCharges:value('annual_charges'),tax:value('property_tax'),floor:value('floor_display')||value('floor_number'),outside:value('outside_access'),heating:[value('heating_type'),value('heating_mode')].filter(Boolean).join(' · '),oldPrice:value('old_price')};
}
function rank(a,s){
 const reasons=[];let missing=false,excluded=false;
 for(const [threshold,value,fail,label] of [[s.budget,a.price,(v,t)=>v>t,'Budget'],[s.area,a.surface,(v,t)=>v<t,'Surface']]){
  if(!Number(threshold))continue;
  if(value==null){missing=true;reasons.push(label+' à vérifier')}
  else if(fail(value,+threshold)){excluded=true;reasons.push(label+' hors critère')}
  else reasons.push(label+' conforme');
 }
 if(s.roomsMin){const rooms=Number(String(a.rooms||'').match(/\d+/)?.[0]);if(!rooms){missing=true;reasons.push('Pièces à vérifier')}else if(rooms<Number(s.roomsMin)){excluded=true;reasons.push('Pièces sous le minimum')}else reasons.push('Pièces conformes')}
 if(s.dpeMax){const ranks='ABCDEFG',max=ranks.indexOf(String(s.dpeMax).toUpperCase()),actual=ranks.indexOf(String(a.dpe||'').toUpperCase());if(actual<0){missing=true;reasons.push('DPE à vérifier')}else if(actual>max){excluded=true;reasons.push('DPE au-delà du maximum')}else reasons.push('DPE conforme')}
 const content=(a.title+' '+a.description).toLocaleLowerCase('fr');
 const matches=String(s.words||'').split(',').map(x=>x.trim().toLowerCase()).filter(x=>x && content.includes(x));
 return {score:(excluded?-2000:missing?-1000:0)+Math.min(matches.length,99),why:[...reasons,...matches].join(' · ')};
}
async function render(fill=false){
 const p=profile(),data=await access(p);if(p!==profile())return;
 if(fill)for(const k of fields){if(k==='detail')el(k).checked=!!data.settings[k];else el(k).value=data.settings[k]||''}
 const cards=el('cards');cards.replaceChildren();
 const rows=data.ads.filter(a=>el('scope').value==='Toutes'||(a.stage||stages[0])===el('scope').value)
 .map(a=>({a,...rank(a,data.settings)})).sort((x,y)=>y.score-x.score||String(y.a.date||'').localeCompare(String(x.a.date||'')));
 if(!rows.length){cards.append(node('p','Aucune annonce dans cette vue.'));return}
 for(const {a,why} of rows){
  const card=node('article','');card.append(node('b',[a.demo?'Exemple':null,a.city,a.price==null?'Prix à vérifier':Number(a.price).toLocaleString('fr-FR')+' €',a.surface?a.surface+' m²':null].filter(Boolean).join(' · ')),node('h2',a.title));
  if(why)card.append(node('p',why));
  const facts=[['Type de vente',a.saleType],['Type de bien',a.propertyType],['Surface habitable',a.surface&&a.surface+' m²'],['Surface du terrain',a.landSurface],['Nombre de pièces',a.rooms],['Nombre de chambres',a.bedrooms],['Salles de bain',a.bathrooms],['Caractéristiques',a.features?.join(', ')],['Référence',a.reference]];
  if(a.images?.length){const gallery=node('div','');gallery.className='gallery';for(const [index,src] of a.images.entries()){const image=document.createElement('img');image.src=src;image.alt=`Photo ${index+1} de l'annonce`;image.loading=index?'lazy':'eager';image.onerror=()=>image.remove();gallery.append(image)}card.append(gallery)}
  const section=node('section','');section.className='property-facts';
  const money=[['Prix au m²',a.pricePerM2&&Number(a.pricePerM2).toLocaleString('fr-FR')+' €/m²'],['Frais de notaire estimés',a.notaryFees&&Number(a.notaryFees).toLocaleString('fr-FR')+' €'],['Montant estimé du projet',a.totalProject&&Number(a.totalProject).toLocaleString('fr-FR')+' €'],['Charges annuelles',a.annualCharges&&Number(a.annualCharges).toLocaleString('fr-FR')+' €'],['Taxe foncière',a.tax&&Number(a.tax).toLocaleString('fr-FR')+' €'],['Ancien prix',a.oldPrice&&Number(a.oldPrice).toLocaleString('fr-FR')+' €']];
  const financial=money.filter(([,value])=>value);if(financial.length){section.append(node('h3','Budget et charges'));for(const [label,value] of financial){const row=node('div','');row.className='fact';row.append(node('span',label),node('strong',String(value)));section.append(row)}}
  for(const [label,value] of facts)if(value){const row=node('div','');row.className='fact';row.append(node('span',label),node('strong',String(value)));section.append(row)}
  if(a.dpe||a.ges){section.append(node('h3','Diagnostics'));for(const [label,value] of [['Classe énergie',a.dpe],['GES',a.ges]])if(value){const row=node('div','');row.className='fact';row.append(node('span',label),node('strong',String(value).toUpperCase()));section.append(row)}}
  if(a.city) {section.append(node('h3','Localisation'));section.append(node('p',[a.city,a.department,a.zipcode].filter(Boolean).join(' · ')))}
  if(a.ownerType||a.ownerName){const row=node('div','');row.className='fact';row.append(node('span','Vendeur'),node('strong',[a.ownerName,a.ownerType==='pro'?'Professionnel':a.ownerType==='private'?'Particulier':''].filter(Boolean).join(' · ')));section.append(row)}
  if(section.childElementCount)card.append(section);
  if(a.description){const disclosure=document.createElement('details'),summary=node('summary','Lire la description');disclosure.append(summary,node('p',a.description));card.append(disclosure)}
  if(a.date)card.append(node('p','Publiée le '+new Date(a.date.replace(' ','T')+'Z').toLocaleDateString('fr-FR')));
  if(safeUrl(a.url)){const link=node('a',"Ouvrir l'annonce");link.href=a.url;link.target='_blank';link.rel='noopener';card.append(link)}
  const footer=node('footer',''),label=node('label','Suivi'),sel=node('select',''),memo=node('label','Note'),note=node('textarea','');
  for(const v of stages)sel.add(new Option(v,v));sel.value=a.stage||stages[0];note.value=a.note||'';
  const update=(key,value)=>access(p,d=>{const existing=d.ads.find(x=>x.id===a.id);if(existing)existing[key]=value});
  sel.onchange=async()=>{await update('stage',sel.value);render()};note.oninput=()=>update('note',note.value);
  label.append(sel);memo.append(note);footer.append(label,memo);card.append(footer);cards.append(card);
 }
}
for(const k of fields)el(k).onchange=async()=>{const v=k==='detail'?el(k).checked:el(k).value;await access(profile(),d=>d.settings[k]=v);render()};
el('profile').onchange=()=>{msg('');render(true)};el('scope').onchange=()=>render();
el('demo').onclick=async()=>{
 const p=profile();await access(p,d=>{for(const [i,city,surface] of [[1,'Noisiel',48],[2,'Lognes',34]]){
 const id='demo-'+i;if(!d.ads.some(x=>x.id===id))d.ads.push({id,demo:true,city,surface,price:p==='Achat'?surface*3900:surface*22,title:i===1?'Appartement avec balcon':'Deux pièces proche du RER',description:'Annonce fictive pour tester le classement.'})}});
 render();msg('Exemples fictifs chargés.');
};
el('refresh').onclick=async()=>{
 const p=profile(),url=safeUrl(el('url').value,true),token=el('token').value.trim();
 if(!url||!token){msg('Renseigne une URL de recherche Leboncoin et ta clé Apify.');return}
 el('refresh').disabled=true;msg('Recherche en cours…');
 try{
 const res=await fetch('https://api.apify.com/v2/acts/silentflow~leboncoin-scraper-ppr/run-sync-get-dataset-items',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({searchUrl:url,maxItems:10,browseMode:el('detail').checked})});
 if(!res.ok)throw Error('Apify HTTP '+res.status);
 const rows=await res.json();if(!Array.isArray(rows)||rows.some(a=>!a?.id))throw Error('Format de réponse inattendu');
 let count=0;await access(p,d=>{for(const raw of rows){const a=normalize(raw),old=d.ads.find(x=>x.id===a.id);if(old){for(const [k,v] of Object.entries(a))if(v!=null&&v!=='')old[k]=v}else{d.ads.push(a);count++}}});
 msg(p+' · '+rows.length+' résultats, '+count+' nouveaux.');render();
 }catch(e){msg(e.message+'. Vérifie les exécutions dans Apify avant de relancer.')}finally{el('refresh').disabled=false}
};
el('save').onclick=async()=>{
 const projects={};for(const p of profiles)projects[p]=await access(p);
 const url=URL.createObjectURL(new Blob([JSON.stringify({version:1,projects})],{type:'application/json'}));
 const a=node('a','');a.download='carnet-immo.json';a.href=url;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
el('restore').onchange=async e=>{
 try{const b=JSON.parse(await e.target.files[0].text());if(b.version!==1||!profiles.every(p=>b.projects?.[p]?.settings&&Array.isArray(b.projects[p].ads)&&b.projects[p].ads.every(x=>typeof x?.id==='string'&&typeof x.title==='string')))throw Error();
 if(!confirm('Remplacer le carnet de cet appareil par la sauvegarde ?'))return;
 const tx=db.transaction('projects','readwrite');for(const p of profiles)tx.objectStore('projects').put(b.projects[p],p);
 tx.oncomplete=()=>{render(true);msg('Carnet restauré.')};tx.onabort=()=>msg('Échec de la restauration.');
 }catch{msg('Sauvegarde invalide.')}finally{e.target.value=''}
};
await render(true);
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>msg('Mode hors ligne indisponible.'));
