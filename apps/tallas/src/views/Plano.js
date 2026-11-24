import {html,useEffect,useState} from '../lib.js';
import {Chips,Head} from '../components/ui.js';
import * as XLSX from 'xlsx';

const norm=x=>(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const decode=buf=>{try{return new TextDecoder('utf-8',{fatal:true}).decode(buf)}catch(e){return new TextDecoder('windows-1252').decode(buf)}};
function splitRow(line,d){
 const out=[];let cur='',q=false;
 for(let i=0;i<line.length;i++){
  const c=line[i];
  if(q){if(c==='"'){if(line[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c}
  else if(c==='"')q=true;
  else if(c===d){out.push(cur);cur=''}
  else cur+=c;
 }
 out.push(cur);
 return out.map(x=>x.trim());
}
function parsePlano(text){
 const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(l=>l.replace(/[,;\t\s"]/g,''));
 if(!lines.length)return {rows:[],skipped:0};
 const d=[',',';','\t'].map(c=>[c,lines[0].split(c).length]).sort((a,b)=>b[1]-a[1])[0][0];
 const raw=splitRow(lines[0],d),cells=raw.map(norm);
 const find=names=>cells.findIndex(c=>names.includes(c));
 let iOc=find(['OC','ORDEN','ORDENDECOMPRA']),iRef=find(['REF','REFERENCIA']),iMarca=find(['MARCA']),iColor=find(['COLOR','COLORES']),start=1;
 if(iOc<0||iRef<0){iOc=0;iRef=1;iMarca=2;iColor=3;if(/^\d+$/.test(raw[0]||''))start=0}
 if(iMarca<0)iMarca=2;
 if(iColor<0)iColor=3;
 const m={};let skipped=0;
 lines.slice(start).forEach(l=>{
  const r=splitRow(l,d),oc=r[iOc]||'',ref=r[iRef]||'';
  if(!oc||!ref){skipped++;return}
  const k=oc+'|'+ref;
  m[k]=m[k]||{oc,ref,marca:(r[iMarca]||'').toUpperCase(),colores:[]};
  (r[iColor]||'').split(/[,;|]/).map(x=>x.trim()).filter(Boolean).forEach(c=>{if(!m[k].colores.includes(c))m[k].colores.push(c)});
 });
 return {rows:Object.values(m),skipped};
}

function mergePlano(actual,nuevos){
 const merged=actual.map(p=>({...p,colores:[...(p.colores||[])]}));
 const index=new Map(merged.map((p,i)=>[`${p.oc.trim().toUpperCase()}|${p.ref.trim().toUpperCase()}`,i]));
 nuevos.forEach(n=>{
  const key=`${n.oc.trim().toUpperCase()}|${n.ref.trim().toUpperCase()}`;
  const i=index.get(key);
  if(i===undefined){index.set(key,merged.length);merged.push({...n,colores:[...(n.colores||[])]});return}
  const existente=merged[i];
  if(!existente.marca&&n.marca)existente.marca=n.marca;
  const colores=new Set((existente.colores||[]).map(c=>c.trim().toUpperCase()));
  (n.colores||[]).forEach(c=>{if(!colores.has(c.trim().toUpperCase())){existente.colores.push(c);colores.add(c.trim().toUpperCase())}});
 });
 return merged;
}

function AddSetDialog({onClose,children}){
 useEffect(()=>{
  const onKeyDown=e=>{if(e.key==='Escape')onClose()};
  window.addEventListener('keydown',onKeyDown);
  return()=>window.removeEventListener('keydown',onKeyDown);
 },[onClose]);
 return html`<div className="ov" role="dialog" aria-modal="true" aria-labelledby="add-set-title" onClick=${e=>{if(e.target===e.currentTarget)onClose()}}>
 <section className="audit-dialog">
 <div className="audit-dialog-head"><div><p className="audit-kicker">Plano de referencias</p><h2 id="add-set-title">Agregar set</h2></div><button type="button" className="audit-close" aria-label="Cerrar formulario" onClick=${onClose}>×</button></div>
 ${children}
 </section></div>`;
}

function Plano({plano,setPlano}){
 const [oc,setOc]=useState(''),[ref,setRef]=useState(''),[marca,setMarca]=useState(''),[colores,setColores]=useState(''),[formError,setFormError]=useState(''),[showAdd,setShowAdd]=useState(false),[msg,setMsg]=useState(null);
  const closeAdd=()=>{setShowAdd(false);setFormError('')};
  const addReference=ev=>{
  ev.preventDefault();
  const cleanOc=oc.trim(),cleanRef=ref.trim(),cleanMarca=marca.trim().toUpperCase();
  const cleanColors=[...new Set(colores.split(',').map(c=>c.trim()).filter(Boolean))];
  if(!cleanOc||!cleanRef||!cleanMarca||!cleanColors.length){
   setFormError('Completa OC, referencia, marca y al menos un color.');
   return;
  }
  if(plano.some(p=>p.oc.trim().toUpperCase()===cleanOc.toUpperCase()&&p.ref.trim().toUpperCase()===cleanRef.toUpperCase())){
   setFormError(`La combinación OC ${cleanOc} / REF ${cleanRef} ya existe en el plano.`);
   return;
  }
  setPlano(actual=>mergePlano(actual,[{oc:cleanOc,ref:cleanRef,marca:cleanMarca,colores:cleanColors}]));
  setOc('');setRef('');setMarca('');setColores('');closeAdd();
 };
 const load=ev=>{
  const input=ev.target,f=input.files[0];
  if(!f)return;
  f.arrayBuffer().then(b=>{
   const ext=f.name.split('.').pop().toLowerCase();
   let content;
   if(ext==='csv'||ext==='txt')content=decode(b);
   else {
    const workbook=XLSX.read(b,{type:'array'});
    const sheet=workbook.Sheets[workbook.SheetNames[0]];
    content=sheet?XLSX.utils.sheet_to_csv(sheet):'';
   }
   const {rows,skipped}=parsePlano(content);
   if(!rows.length){setMsg({ok:false,text:'No se encontraron registros. Revisa que la primera hoja tenga las columnas OC, REF, MARCA y COLOR, con esos encabezados o en ese orden.'});return}
   setPlano(actual=>mergePlano(actual,rows));
   setMsg({ok:true,text:`Se agregaron ${rows.length} registro${rows.length===1?'':'s'}${skipped?` · ${skipped} fila${skipped===1?'':'s'} omitida${skipped===1?'':'s'} por no tener OC o REF`:''}.`});
  }).catch(()=>setMsg({ok:false,text:'No se pudo leer el archivo.'})).finally(()=>{input.value=''});
 };
 return html`<div className="plano-view"><${Head} t="Plano de referencias" s="Carga un archivo Excel (.xlsx o .xls) o CSV con las columnas OC, REF, MARCA y COLOR. Los registros del archivo se agregan al plano; las OC y referencias existentes se conservan."/>
  <div className="tools"><button type="button" className="btn" onClick=${()=>setShowAdd(true)}>Agregar set</button><label className="btn g" style=${{display:'inline-flex',alignItems:'center'}}>Subir plano (Excel o CSV)<input type="file" accept=".xlsx,.xls,.xlsm,.csv,.txt" onChange=${load} hidden/></label></div>
 ${msg&&html`<p className=${msg.ok?'mail-success':'mail-error'} role=${msg.ok?'status':'alert'}>${msg.text}</p>`}
 ${plano.length?html`<div className="tw"><table><thead><tr><th>OC</th><th>REF</th><th>Marca</th><th>Colores</th></tr></thead><tbody>${plano.map((p,i)=>html`<tr key=${i}><td>${p.oc}</td><td className="ref">${p.ref}</td><td>${p.marca}</td><td><${Chips} l=${p.colores}/></td></tr>`)}</tbody></table></div>`:html`<div className="panel empty">El plano está vacío. Agrega un set o sube un archivo para crear referencias.</div>`}
 ${showAdd&&html`<${AddSetDialog} onClose=${closeAdd}><form onSubmit=${addReference}>
 <div className="row"><div className="fl"><label htmlFor="plan-oc">OC</label><input id="plan-oc" required value=${oc} onInput=${e=>setOc(e.target.value)} placeholder="Ej. 54677"/></div>
 <div className="fl"><label htmlFor="plan-ref">Referencia</label><input id="plan-ref" required value=${ref} onInput=${e=>setRef(e.target.value)} placeholder="Ej. 41959"/></div></div>
 <div className="fl"><label htmlFor="plan-marca">Marca</label><input id="plan-marca" required value=${marca} onInput=${e=>setMarca(e.target.value)} placeholder="Ej. BRONZINI"/></div>
 <div className="fl"><label htmlFor="plan-colores">Colores</label><input id="plan-colores" required value=${colores} onInput=${e=>setColores(e.target.value)} placeholder="Separados por coma: Negro, Blanco"/></div>
 ${formError&&html`<p className="mail-error" role="alert">${formError}</p>`}
 <div className="audit-actions"><button type="submit" className="btn">Agregar set</button></div>
 </form></${AddSetDialog}>`}</div>`}

export default Plano;
