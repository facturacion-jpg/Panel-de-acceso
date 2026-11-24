import {html,useState,useMemo,useEffect,fd,hoy,TO} from '../lib.js';
import {Badge,Chips,Head} from '../components/ui.js';

function Filtro({value,placeholder,options,onChange,label}){
 const [open,setOpen]=useState(false);
 return html`<div className="filter-select" onBlur=${x=>{if(!x.currentTarget.contains(x.relatedTarget))setOpen(false)}} onKeyDown=${x=>{if(x.key==='Escape')setOpen(false)}}>
 <button type="button" className="filter-trigger" aria-label=${label} aria-haspopup="listbox" aria-expanded=${open} onClick=${()=>setOpen(!open)}>${value||placeholder}<span className="filter-chevron" aria-hidden="true"></span></button>
 ${open&&html`<div className="filter-menu" role="listbox" aria-label=${label}>${options.map(o=>html`<button type="button" key=${o.value || 'all'} role="option" aria-selected=${value===o.value} className=${'filter-option'+(value===o.value?' selected':'')} onClick=${()=>{onChange(o.value);setOpen(false)}}>${o.label}</button>`)}</div>`}
 </div>`;
}

function Tablero({sets}){
 const [q,setQ]=useState(''),[m,setM]=useState(''),[e,setE]=useState('');
 const marcas=[...new Set(sets.map(s=>s.marca))];
 const est=s=>s.web!=='ok'?'Auditoría web':s.fin==='aprobado'?'Aprobado':s.fin==='rechazado'?'Rechazado':'Auditoría final';
 const rows=sets.filter(s=>(!q||(s.ref+s.oc).includes(q))&&(!m||s.marca===m)&&(!e||est(s)===e));
 const n=f=>sets.filter(f).length;
 return html`<div className="tablero-view"><${Head} t="Tablero" s="Todos los sets de tallas y en qué etapa van."/>
 <div className="stats"><div><b>${n(s=>s.web!=='ok')}</b><span>en auditoría web</span></div><div><b>${n(s=>s.web==='ok'&&s.fin!=='aprobado')}</b><span>en auditoría final</span></div><div><b>${n(s=>s.fin==='aprobado')}</b><span>aprobados</span></div></div>
 <div className="tools"><input placeholder="Buscar por REF u OC" value=${q} onInput=${x=>setQ(x.target.value)} aria-label="Buscar"/>
 <${Filtro} value=${m} placeholder="Todas las marcas" label="Marca" options=${[{value:'',label:'Todas las marcas'},...marcas.map(x=>({value:x,label:x}))]} onChange=${setM}/>
 <${Filtro} value=${e} placeholder="Todos los estados" label="Estado" options=${[{value:'',label:'Todos los estados'},...['Auditoría web','Auditoría final','Rechazado','Aprobado'].map(x=>({value:x,label:x}))]} onChange=${setE}/></div>
 <div className="tw"><table><thead><tr><th>REF</th><th>OC</th><th>Marca</th><th>Colores</th><th>Auditoría web</th><th>Auditoría final</th><th>Unidades</th></tr></thead><tbody>
 ${rows.map(s=>html`<tr key=${s.id}><td className="ref">${s.ref}</td><td>${s.oc}</td><td>${s.marca}</td><td><${Chips} l=${s.colores}/></td>
 <td><${Badge} e=${s.web}/><div className="mut">${fd(s.webF)}</div></td><td><${Badge} e=${s.fin}/><div className="mut">${fd(s.finF)}</div></td><td>${s.unid||'—'}</td></tr>`)}</tbody></table>
 ${!rows.length&&html`<div className="empty">No hay sets con ese filtro.</div>`}</div></div>`}

export default Tablero;
