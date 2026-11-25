import {html,useState,useMemo,useEffect,useLS,fd,hoy,TO,PLANO0,SETS0} from './lib.js';
import Tablero from './views/Tablero.js';
import Nuevo from './views/Nuevo.js';
import Web from './views/Web.js';
import Final from './views/Final.js';
import { auth } from './firebase.js';
import { loadTallasData, saveTallasPlan, saveTallasSet } from './cloud.js';
function App(){
 const user=auth.currentUser;
  const inicial=(user?.email||'?').trim().charAt(0).toUpperCase()||'?';
 const [cloudReady,setCloudReady]=useState(false),[cloudError,setCloudError]=useState(''),[PlanoView,setPlanoView]=useState(null),[MailView,setMailView]=useState(null);
 const [v,setV]=useState('tablero'),[plano,setPlano]=useLS(`tallas:${user?.uid}:plano`,PLANO0),[sets,setSets]=useLS(`tallas:${user?.uid}:sets`,SETS0),[por,setPor]=useLS('por','Mari'),[theme,setTheme]=useLS('theme','light'),[menuOpen,setMenuOpen]=useState(() => typeof window !== 'undefined' ? window.matchMedia('(min-width: 821px)').matches : true),[navCompact,setNavCompact]=useState(false),[m,setM]=useState(null);
 useEffect(()=>{let canceled=false;loadTallasData().then(data=>{if(canceled)return;setSets(data.sets);setPlano(data.plano);setCloudError('');setCloudReady(true)}).catch(error=>{console.error('No se pudieron sincronizar los datos de Tallas:',error);if(canceled)return;setCloudError(`No se pudieron sincronizar los datos con Firebase (${error?.code||'error'}). Los cambios nuevos podrían quedar solo en este dispositivo.`);setCloudReady(true)});return()=>{canceled=true}},[user?.uid]);
 useEffect(()=>{document.documentElement.dataset.theme=theme},[theme]);
 useEffect(()=>{if(v!=='plano'||PlanoView)return;let active=true;import('./views/Plano.js').then(mod=>{if(active)setPlanoView(()=>mod.default)}).catch(error=>console.error('No se pudo cargar el plano de Excel:',error));return()=>{active=false}},[v,PlanoView]);
 useEffect(()=>{if(!m||MailView)return;let active=true;import('./views/Mail.js').then(mod=>{if(active)setMailView(()=>mod.default)}).catch(error=>console.error('No se pudo cargar el formulario de correo:',error));return()=>{active=false}},[m,MailView]);
 useEffect(()=>{let lastY=window.scrollY,deltaSinceChange=0;const onScroll=()=>{const y=window.scrollY;deltaSinceChange+=y-lastY;lastY=y;if(y<8){deltaSinceChange=0;setNavCompact(false)}else if(deltaSinceChange>12){deltaSinceChange=0;setNavCompact(true)}else if(deltaSinceChange< -12){deltaSinceChange=0;setNavCompact(false)}};window.addEventListener('scroll',onScroll,{passive:true});return()=>window.removeEventListener('scroll',onScroll)},[]);
 const navigate=k=>{setV(k);if(window.matchMedia('(max-width: 820px)').matches)setMenuOpen(false)};
 const themeToggle=html`<button type="button" className="theme-toggle" aria-label=${theme==='dark'?'Cambiar a tema claro':'Cambiar a tema oscuro'} title=${theme==='dark'?'Tema claro':'Tema oscuro'} onClick=${()=>setTheme(theme==='dark'?'light':'dark')}><span className="theme-icon" aria-hidden="true">${theme==='dark'?'☀':'☾'}</span></button>`;
 const upd=(id,p)=>{const current=sets.find(s=>s.id===id);if(!current)return;const updated={...current,...p};setSets(prev=>prev.map(s=>s.id===id?updated:s));saveTallasSet(user,updated).then(()=>setCloudError('')).catch(error=>{console.error(error);setCloudError('No se pudo guardar el cambio en Firebase.')})};
 const add=l=>{const nuevos=l.map((o,i)=>({id:Date.now()+i,oc:o.oc,ref:o.ref,marca:o.marca,colores:o.colores,web:'pendiente',webF:'',fin:'pendiente',finF:'',unid:'',env:[],obs:'',por}));setSets(prev=>[...prev,...nuevos]);Promise.all(nuevos.map(record=>saveTallasSet(user,record))).then(()=>setCloudError('')).catch(error=>{console.error(error);setCloudError('No se pudieron guardar los sets en Firebase.')})};
 const changePlano=updater=>{const next=typeof updater==='function'?updater(plano):updater;setPlano(next);saveTallasPlan(user,next).then(()=>setCloudError('')).catch(error=>{console.error(error);setCloudError('No se pudo guardar el plano en Firebase.')})};
 const N=[['tablero','Tablero',0,'grid'],['nuevo','Nuevo set',0,'plus'],['web','Auditoría web',sets.filter(s=>s.web!=='ok').length,'globe'],['final','Auditoría final',sets.filter(s=>s.web==='ok'&&s.fin!=='aprobado').length,'check'],['plano','Plano',0,'file']];
 const icon=name=>name==='grid'?html`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`:
 name==='plus'?html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`:
 name==='globe'?html`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>`:
 name==='check'?html`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></svg>`:
 html`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>`;
 const quien=html`<span className="who-field" key="por-field"><label key="por-label" htmlFor="por">Diligenciado por</label><input key="por-input" id="por" value=${por} onInput=${x=>setPor(x.target.value)}/></span>`;
 if(!cloudReady)return html`<main className="panel empty" role="status">Cargando los datos compartidos de Tallas…</main>`;
 return html`<div className=${'app'+(menuOpen?' menu-open':'')}><aside className="side" aria-label="Menú principal"><div className="brand">Estado set de tallas<small>Control de auditorías</small></div>
 ${N.map(([k,t,c,i])=>html`<button key=${k} type="button" className="nav" data-tip=${t} aria-label=${t} aria-current=${v===k?'page':undefined} onClick=${()=>navigate(k)}><span className="nav-icon">${icon(i)}</span><span className="nav-label">${t}</span>${c>0&&html`<span className="cnt">${c}</span>`}</button>`)}
 <div className="side-user" title=${user?.email||''}><span className="side-avatar" aria-hidden="true">${inicial}</span><span className="side-user-text"><span>Sesión</span><b>${user?.email||'—'}</b></span></div></aside>
 ${menuOpen&&html`<button type="button" className="menu-backdrop" aria-label="Cerrar menú" onClick=${()=>setMenuOpen(false)}></button>`}
 <main><div className="topbar"><button type="button" className="menu-toggle" aria-label=${menuOpen?'Cerrar menú':'Abrir menú'} aria-expanded=${menuOpen} onClick=${()=>setMenuOpen(!menuOpen)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button><div className="theme-bar"><a className="back-to-panel" href="/?retornoAplicativo=1" aria-label="Volver al panel de aplicativos"><span aria-hidden="true">←</span><span>Volver al panel</span></a>${quien}${themeToggle}</div></div>
 ${cloudError&&html`<p className="mail-error" role="alert">${cloudError}</p>`}
 ${v==='tablero'&&html`<${Tablero} sets=${sets}/>`}${v==='nuevo'&&html`<${Nuevo} plano=${plano} sets=${sets} add=${add} go=${setV}/>`}
 ${v==='web'&&html`<${Web} sets=${sets} upd=${upd}/>`}${v==='final'&&html`<${Final} sets=${sets} upd=${upd} mail=${setM}/>`}${v==='plano'&&(PlanoView?html`<${PlanoView} plano=${plano} setPlano=${changePlano}/>`:html`<p className="panel empty" role="status">Cargando herramienta de Excel…</p>`)}</main>
 <nav className=${'mobile-nav'+(navCompact?' is-compact':'')} aria-label="Navegación principal">${N.map(([k,t,c,i])=>html`<button key=${k} type="button" aria-current=${v===k?'page':undefined} aria-label=${t} onClick=${()=>navigate(k)}><span className="mobile-nav-icon">${icon(i)}</span><span className="mobile-nav-label">${t==='Auditoría web'?'Aud. web':t==='Auditoría final'?'Aud. final':t==='Nuevo set'?'Nuevo':t}</span>${c>0&&html`<span className="mobile-nav-count">${c}</span>`}</button>`)}</nav>
 ${m&&MailView&&html`<${MailView} s=${m} por=${por} close=${()=>setM(null)}/>`}</div>`}

export default App;
