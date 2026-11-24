import emailjs from '@emailjs/browser';
import {html,useState,useLS,fd} from '../lib.js';

const serviceId=import.meta.env.VITE_EMAILJS_SERVICE_ID;
const templateId=import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const publicKey=import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
const configured=Boolean(serviceId&&templateId&&publicKey);
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function Mail({s,por,close}){
 const [sending,setSending]=useState(false);
 const [result,setResult]=useState('');
 const [error,setError]=useState('');
 const [toEmail,setToEmail]=useLS('emailTo','');
 const status=s.fin==='aprobado'?'Aprobado':s.fin==='rechazado'?'Rechazado':'Pendiente';
 const statusColors=s.fin==='aprobado'?{color:'#166534',background:'#dcfce7'}:s.fin==='rechazado'?{color:'#991b1b',background:'#fee2e2'}:{color:'#854d0e',background:'#fef3c7'};
 const reason=s.obs?.trim()||'Sin observaciones';
 const title=`Resultado de auditoría de set de tallas — REF ${s.ref}`;
 const subject=title;
 const notesLabel=s.fin==='rechazado'?'Motivo':'Observaciones';
 const units=s.unid||'—';
 const date=fd(s.finF);
 const fields=[['Unidades enviadas',units],[notesLabel,reason],['Referencia',s.ref],['OC',s.oc],['Marca',s.marca],['Fecha',date],['Diligenciado por',por]];
 const message=`Estado: ${status}\nUnidades enviadas: ${units}\n${notesLabel}: ${reason}\n\nReferencia: ${s.ref}\nOC: ${s.oc}\nMarca: ${s.marca}\nFecha: ${date}\nDiligenciado por: ${por}`;
 const htmlBody=`<div style="margin:0;padding:32px 12px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
 <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">Resultado de auditoría para la referencia ${escapeHtml(s.ref)}: ${escapeHtml(status)}.</div>
 <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:900px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">
  <tr><td style="padding:32px 40px;background:#10243a;color:#ffffff;border-bottom:4px solid #c69b4b">
   <div style="font-size:11px;letter-spacing:1.8px;text-transform:uppercase;color:#d8bd83;font-weight:bold">Control de calidad</div>
   <div style="font-size:25px;line-height:1.3;font-weight:bold;margin-top:9px">Resultado de auditoría</div>
   <div style="font-size:14px;color:#dbe4ed;margin-top:6px">Set de tallas · Referencia ${escapeHtml(s.ref)}</div>
  </td></tr>
  <tr><td style="padding:32px 40px 8px">
   <div style="font-size:14px;color:#64748b">Hola, ${escapeHtml(toEmail.trim())},</div>
   <div style="font-size:15px;line-height:1.6;color:#334155;margin-top:5px">Compartimos el resultado registrado para la auditoría del set de tallas.</div>
   <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px"><tr><td style="padding:8px 14px;border-radius:20px;background:${statusColors.background};color:${statusColors.color};font-size:13px;font-weight:bold;letter-spacing:.2px">${escapeHtml(status.toUpperCase())}</td></tr></table>
  </td></tr>
  <tr><td style="padding:20px 40px 8px">
   <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse">
    <tr><td colspan="2" style="padding:0 0 10px;color:#10243a;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase">Resumen de auditoría</td></tr>
    ${fields.map(([label,value],index)=>`<tr style="background:${index%2===0?'#f8fafc':'#ffffff'}"><td width="40%" style="padding:12px 14px;border-bottom:1px solid #e8edf2;color:#64748b;font-size:13px;vertical-align:top">${escapeHtml(label)}</td><td style="padding:12px 14px;border-bottom:1px solid #e8edf2;color:#1e293b;font-size:14px;font-weight:600;line-height:1.45;vertical-align:top;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`).join('')}
   </table>
  </td></tr>
  <tr><td style="padding:28px 40px 32px"><div style="height:1px;background:#e2e8f0;font-size:1px;line-height:1px">&nbsp;</div><div style="font-size:12px;line-height:1.6;color:#94a3b8;margin-top:16px">Este mensaje fue generado automáticamente por el sistema de auditoría de sets de tallas. Por favor, conserva la referencia para cualquier seguimiento.</div></td></tr>
 </table>
 </div>`;
 const validEmail=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail.trim());
 const send=async()=>{
  if(!configured){setError('Falta configurar EmailJS. Revisa las variables VITE_EMAILJS_* y reinicia la aplicación.');return;}
  if(!validEmail){setError('Escribe una dirección de correo válida para el destinatario.');return;}
  setSending(true);setError('');
  try{
   await emailjs.send(serviceId,templateId,{
    to_email:toEmail.trim(),subject,title,name:por||'Auditoría de sets de tallas',
    from_name:por||'Auditoría de sets de tallas',message,html_body:htmlBody,
    status,status_color:statusColors.color,status_background:statusColors.background,
    reason,observations:reason,units,reference:s.ref,order:s.oc,brand:s.marca,date,completed_by:por
   },{publicKey});
   setResult('Correo enviado correctamente.');
  }catch(err){
   console.error('Error al enviar correo con EmailJS:',err);
   setError(err?.text||'No se pudo enviar el correo. Verifica la configuración de EmailJS e inténtalo de nuevo.');
  }finally{setSending(false);}
 };
 return html`<div className="ov" role="dialog" aria-modal="true" aria-labelledby="mail-title"><div className="mail">
 <h3 id="mail-title" style=${{margin:0}}>${title}</h3>
 <div className="fl"><label htmlFor="email-to">Enviar a</label><input id="email-to" type="email" value=${toEmail} onInput=${x=>{setToEmail(x.target.value);setError('')}} placeholder="correo@empresa.com" autoComplete="email"/></div>
 <div className="mail-preview-status" style=${{color:statusColors.color,background:statusColors.background}}>${status}</div><pre>${message}</pre>
 ${!configured&&html`<p className="mut" role="status">EmailJS aún no está configurado. Consulta README.md. Si ya completaste .env.local, detén y vuelve a iniciar la aplicación (npm run dev).</p>`}
 ${error&&html`<p className="mail-error" role="alert">${error}</p>`}
 ${result&&html`<p className="mail-success" role="status">${result}</p>`}
 <div style=${{display:'flex',gap:'8px',justifyContent:'flex-end',marginTop:'12px'}}>
 <button type="button" className="btn" disabled=${sending||Boolean(result)} onClick=${send}>${sending?'Enviando…':result?'Enviado':'Enviar correo'}</button>
 <button type="button" className="btn btn-ghost" disabled=${sending} onClick=${close}>Cerrar</button>
 </div></div></div>`;
}

export default Mail;
