import {html,useState,useMemo,useEffect,fd,hoy,TO} from '../lib.js';
import {Badge,Chips,Head} from '../components/ui.js';

function Nuevo({plano,sets,add,go}){
 const [q,setQ]=useState(''),[open,setOpen]=useState(false),[ref,setRef]=useState(''),[sel,setSel]=useState({});
 const todas=useMemo(()=>[...new Set(plano.map(p=>p.ref))],[plano]);
 const completa=r=>plano.filter(p=>p.ref===r).every(p=>sets.some(s=>s.oc===p.oc&&s.ref===r));
 const refs=useMemo(()=>todas.filter(r=>!completa(r)),[todas,plano,sets]);
 const lista=refs.filter(r=>r.includes(q.trim())).slice(0,30);
 const yaEnProceso=q.trim()&&!lista.length&&todas.includes(q.trim());
 const ocs=plano.filter(p=>p.ref===ref);
 const pick=r=>{setRef(r);setQ(r);setOpen(false);const o={};plano.filter(p=>p.ref===r).forEach(p=>o[p.oc]=!sets.some(s=>s.oc===p.oc&&s.ref===r));setSel(o)};
 const marca=ocs[0]?.marca,col=[...new Set(ocs.flatMap(o=>o.colores))];
 const nSel=ocs.filter(o=>sel[o.oc]).length;
 const crear=()=>{add(ocs.filter(o=>sel[o.oc]));go('web')};
 return html`<div className="nuevo-view"><${Head} t="Nuevo set de tallas" s="Elige la REF y el sistema trae la OC, la marca y los colores del plano."/>
 <div className="panel" style=${{maxWidth:'620px'}}>
 <div className="fl cb"><label htmlFor="ref">Referencia</label>
 <input id="ref" role="combobox" aria-expanded=${open} autoComplete="off" disabled=${!plano.length} placeholder=${plano.length?'Escribe o busca la REF':'Carga un plano para crear sets'} value=${q} onFocus=${()=>setOpen(true)} onInput=${x=>{setQ(x.target.value);setOpen(true);setRef('')}}/>
 ${!plano.length&&html`<p className="mut">El plano está vacío. Carga un archivo desde la sección Plano para habilitar la creación de sets.</p>`}
 ${open&&plano.length&&html`<div className="dd">${lista.length?lista.map(r=>html`<button key=${r} type="button" onClick=${()=>pick(r)}><span className="ref">${r}</span><span className="mut">${plano.filter(p=>p.ref===r).map(p=>p.marca)[0]}</span></button>`):html`<div className="empty">${yaEnProceso?'Esa REF ya tiene set creado en todas sus OC.':'Esa REF no está en el plano.'}</div>`}</div>`}</div>
 ${ref&&html`<div className="ref-details">
  <div className="fl"><span className="lbl">Marca</span><div>${marca}</div></div>
  <div className="fl"><span className="lbl">Colores</span><${Chips} l=${col}/></div>
  <div className="fl ocs"><span className="lbl">${ocs.length>1?'Esta REF está en varias OC. Desmarca las que no aplican.':'Orden de compra'}</span>
  ${ocs.map(o=>{const ya=sets.some(s=>s.oc===o.oc&&s.ref===ref);return html`<label key=${o.oc}><input type="checkbox" disabled=${ya} checked=${!!sel[o.oc]} onChange=${x=>setSel({...sel,[o.oc]:x.target.checked})}/><span><b>OC ${o.oc}</b>${ya&&html`<span className="mut"> · ya tiene set creado</span>`}</span></label>`})}</div>
  <button type="button" className="btn" disabled=${!nSel} onClick=${crear}>Crear ${nSel>1?nSel+' sets':'set'}</button>
 </div>`}
 </div></div>`}

export default Nuevo;