import {html,useState} from '../lib.js';
import {Badge,Head,AuditDialog} from '../components/ui.js';

function Web({sets,upd}){
 const l=sets.filter(s=>s.web!=='ok');
 return html`<div className="web-view"><${Head} t="Auditoría en web" s="Sets pendientes. Pon la fecha y márcalos OK para pasarlos a auditoría final."/>
 <div className="cards">${l.map(s=>html`<${WebCard} key=${s.id} s=${s} upd=${upd}/>`)}</div>${!l.length&&html`<div className="panel empty">No hay sets pendientes en auditoría web.</div>`}</div>`}

function WebCard({s,upd}){const [f,setF]=useState(s.webF||''),[open,setOpen]=useState(false);
 const close=()=>setOpen(false);
 const save=()=>{upd(s.id,{web:'ok',webF:f});close()};
 return html`<div className="card audit-card"><div className="hd"><button type="button" className="reference-trigger" aria-haspopup="dialog" onClick=${()=>setOpen(true)}>REF ${s.ref}</button><${Badge} e="pendiente"/></div>
 ${open&&html`<${AuditDialog} s=${s} title="Auditoría web" onClose=${close}>
 <div className="fl"><label htmlFor=${'w'+s.id}>Fecha de auditoría</label><input id=${'w'+s.id} type="date" value=${f} onInput=${x=>setF(x.target.value)}/></div>
 <div className="audit-actions"><button type="button" className="btn" disabled=${!f} onClick=${save}>Marcar OK</button></div>
 </${AuditDialog}>`}</div>`}

export default Web;
