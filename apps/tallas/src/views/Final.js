import {html,useState} from '../lib.js';
import {Badge,Head,AuditDialog} from '../components/ui.js';

function Final({sets,upd,mail}){
 const l=sets.filter(s=>s.web==='ok'&&s.fin!=='aprobado');
 return html`<div className="final-view"><${Head} t="Auditoría final" s="Registra el resultado, la fecha y lo que se envió. Al guardar (pendiente, aprobado o rechazado) se prepara un correo con el estado y las observaciones."/>
 <div className="cards">${l.map(s=>html`<${FinCard} key=${s.id} s=${s} upd=${upd} mail=${mail}/>`)}</div>${!l.length&&html`<div className="panel empty">No hay sets pendientes en auditoría final.</div>`}</div>`}

function FinCard({s,upd,mail}){
 const [e,setE]=useState(s.fin),[f,setF]=useState(s.finF),[u,setU]=useState(s.unid),[env,setEnv]=useState(s.env),[o,setO]=useState(s.obs),[open,setOpen]=useState(false);
 const ok=f&&(e==='pendiente'||(e==='rechazado'&&o.trim())||(e==='aprobado'&&u&&env.length));
 const close=()=>setOpen(false);
 const save=()=>{const p={fin:e,finF:f,unid:u,env,obs:o};upd(s.id,p);close();mail({...s,...p})};
 const tg=c=>setEnv(env.includes(c)?env.filter(x=>x!==c):[...env,c]);
 return html`<div className="card audit-card"><div className="hd"><button type="button" className="reference-trigger" aria-haspopup="dialog" onClick=${()=>setOpen(true)}>REF ${s.ref}</button><${Badge} e=${s.fin}/></div>
 ${open&&html`<${AuditDialog} s=${s} title="Auditoría final" onClose=${close}>
 <div className="row"><div className="fl"><label htmlFor=${'e'+s.id}>Estado</label><select id=${'e'+s.id} value=${e} onChange=${x=>setE(x.target.value)}><option value="pendiente">Pendiente</option><option value="rechazado">Rechazado</option><option value="aprobado">Aprobado</option></select></div>
 <div className="fl"><label htmlFor=${'f'+s.id}>Fecha</label><input id=${'f'+s.id} type="date" value=${f} onInput=${x=>setF(x.target.value)}/></div>
 <div className="fl"><label htmlFor=${'u'+s.id}>Unidades enviadas</label><input id=${'u'+s.id} type="number" min="0" value=${u} onInput=${x=>setU(x.target.value)}/></div></div>
 <div className="fl"><span className="lbl">Colores enviados</span><div className="chips">${s.colores.map(c=>html`<label key=${c} className="color-option"><input type="checkbox" checked=${env.includes(c)} onChange=${()=>tg(c)}/><span className=${'chip'+(env.includes(c)?' selected':'')}>${c}</span></label>`)}</div></div>
 <div className="fl"><label htmlFor=${'o'+s.id}>Observaciones</label><textarea id=${'o'+s.id} rows="2" value=${o} onInput=${x=>setO(x.target.value)} placeholder="Ej. Se envía nuevamente, pendiente insumo de cordón"></textarea></div>
 <div className="audit-actions"><button type="button" className="btn" disabled=${!ok} onClick=${save}>${e==='aprobado'?'Aprobar y avisar':e==='rechazado'?'Rechazar y avisar':'Guardar y avisar'}</button></div>
 ${e==='aprobado'&&!(u&&env.length)&&html`<span className="mut"> Falta indicar unidades y colores enviados.</span>`}
 ${e==='rechazado'&&!o.trim()&&html`<span className="mut"> Escribe el motivo del rechazo.</span>`}
 </${AuditDialog}>`}</div>`}

export default Final;