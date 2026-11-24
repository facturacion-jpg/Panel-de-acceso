import {html,useEffect} from '../lib.js';
export const Badge=({e})=>html`<span className=${'b '+e}>${e==='ok'?'OK':e[0].toUpperCase()+e.slice(1)}</span>`;
export const Chips=({l})=>html`<div className="chips">${l.map((c,i)=>html`<span key=${String(c)+'-'+i} className="chip">${c}</span>`)}</div>`;
export const Head=({t,s})=>[html`<h1 key="head-title">${t}</h1>`, html`<p key="head-sub" className="sub">${s}</p>`];

export function AuditDialog({s,title,onClose,children}){
 useEffect(()=>{
  const onKeyDown=e=>{if(e.key==='Escape')onClose()};
  window.addEventListener('keydown',onKeyDown);
  return()=>window.removeEventListener('keydown',onKeyDown);
 },[onClose]);
 return html`<div className="ov audit-overlay" role="dialog" aria-modal="true" aria-labelledby="audit-dialog-title" onClick=${e=>{if(e.target===e.currentTarget)onClose()}}>
 <section className="audit-dialog">
 <div className="audit-dialog-head"><div><p className="audit-kicker">${title}</p><h2 id="audit-dialog-title">REF ${s.ref}</h2></div><button type="button" className="audit-close" aria-label="Cerrar formulario de auditoría" onClick=${onClose}>×</button></div>
 ${children}
 </section></div>`;
}
