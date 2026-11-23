(()=>{
 const VIEW='lt-cloud-view-v1';let pending=null,busy=false;
 const box=document.createElement('div');box.id='cloudContextPicker';box.style.cssText='position:fixed;bottom:18px;left:20px;z-index:14;max-width:70vw;font:14px serif;color:var(--text)';
 const label=document.createElement('label');label.textContent='共用語境 ';const pick=document.createElement('select');pick.setAttribute('aria-label','已發布的共用語境');label.append(pick);const status=document.createElement('span');status.style.marginLeft='12px';status.setAttribute('role','status');box.append(label,status);document.body.append(box);
 function load(){try{return JSON.parse(localStorage.getItem(VIEW)||'null')||{controls:{},appearance:{},contexts:[],active:''};}catch{return {controls:{},appearance:{},contexts:[],active:''};}}
 function notify(value){localStorage.setItem(VIEW,JSON.stringify(value));dispatchEvent(new StorageEvent('storage',{key:VIEW,newValue:JSON.stringify(value)}));}
 function render(){const d=load();pick.replaceChildren();for(const c of d.contexts||[])pick.add(new Option(c.name,c.id));pick.value=d.active;pick.disabled=!pick.options.length;}
 function use(snapshot){const d=load();d.contexts=snapshot.contexts.map(c=>({id:c.id,name:c.name,words:c.words,glossaryText:c.glossaryText,glossaryFrom:c.glossaryFrom,glossaryTo:c.glossaryTo}));d.active=d.contexts.some(c=>c.id===d.active)?d.active:d.contexts[0]?.id||'';if(!d.contexts.length){document.getElementById('vocabIn').value='';document.getElementById('vocabSave').click();}notify(d);localStorage.setItem('lt-public-snapshot-v1',JSON.stringify(snapshot));render();status.textContent='詞庫版本 '+snapshot.version;}
 async function refresh(){if(busy)return;busy=true;try{const r=await fetch('/api/cloud',{cache:'no-store'});if(!r.ok)throw Error();const s=await r.json();if(!Array.isArray(s.contexts))throw Error();const old=JSON.parse(localStorage.getItem('lt-public-snapshot-v1')||'null');if(!old||old.version!==s.version){if(running){pending=s;status.textContent='有新詞庫，停止收音後更新';}else use(s);}else if(!pending)status.textContent='詞庫版本 '+s.version;}catch{status.textContent='無法連線，保留已下載詞庫';}finally{busy=false;}}
 pick.onchange=()=>{if(running){render();status.textContent='請先停止收音再切換語境';return;}const d=load();d.active=pick.value;notify(d);render();};
 new MutationObserver(()=>{if(!running&&pending){const s=pending;pending=null;use(s);}}).observe(document.getElementById('start'),{childList:true,subtree:true,characterData:true});
 try{const cached=JSON.parse(localStorage.getItem('lt-public-snapshot-v1')||'null');if(cached)use(cached);else render();}catch{}
 refresh();setInterval(refresh,30000);addEventListener('online',refresh);addEventListener('storage',e=>{if(e.key===VIEW)render();});
})();
