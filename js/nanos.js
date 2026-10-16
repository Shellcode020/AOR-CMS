document.addEventListener('DOMContentLoaded', async () => {
 const links=[...document.querySelectorAll('[data-profession]')];
 const panels=[...document.querySelectorAll('[data-profession-panel]')];
 function show(slug,updateHash=true){
  const panel=panels.find(p=>p.dataset.professionPanel===slug)||panels[0];if(!panel)return;
  links.forEach(a=>a.classList.toggle('active',a.dataset.profession===panel.dataset.professionPanel));
  panels.forEach(p=>{p.hidden=p!==panel;p.classList.toggle('active',p===panel)});
  if(updateHash&&location.hash!=='#'+panel.id)history.replaceState(null,'','#'+panel.id);
 }
 links.forEach(a=>a.addEventListener('click',e=>{e.preventDefault();show(a.dataset.profession)}));
 show(decodeURIComponent(location.hash.slice(1))||'adventurer',false);
 function addTooltip(nameCell, nano){
  const effects=Array.isArray(nano.effects)?nano.effects.filter(e=>e&&e.stat&&e.amount!==undefined&&e.amount!==null&&String(e.amount)!==''):[];
  const description=(nano.description||'').trim();
  if(!effects.length&&!description)return;
  nameCell.classList.add('nano-name-with-tooltip');
  const tip=document.createElement('span');tip.className='nano-tooltip';tip.setAttribute('role','tooltip');
  const title=document.createElement('strong');title.className='nano-tooltip-title';title.textContent=nano.name||'Nano program';tip.append(title);
  if(effects.length){
   const list=document.createElement('span');list.className='nano-tooltip-effects';
   effects.forEach(effect=>{
    const line=document.createElement('span');line.className='nano-tooltip-effect';
    let amount=String(effect.amount).trim();
    const stat=String(effect.stat).trim();
    const isHeal=/(current health|health|healing|heal)/i.test(stat)||effect.type==='heal';
    if(isHeal){
     if(!/^[+−-]/.test(amount))amount='+'+amount;
     line.textContent=amount+' '+(effect.label||'Healing');
    }else{
     if(!/^[+−-]/.test(amount))amount='+'+amount;
     line.textContent=amount+' '+(effect.label||stat);
    }
    list.append(line);
   });tip.append(list);
  }
  if(description){const desc=document.createElement('span');desc.className='nano-tooltip-description';desc.textContent=description;tip.append(desc)}
  nameCell.append(tip);
 }
 try {
  const res=await fetch('assets/data/json/nanos.json',{cache:'no-store'}); if(!res.ok)return;
  const db=await res.json();
  panels.forEach(panel=>{
   const records=Array.isArray(db[panel.dataset.professionPanel])?db[panel.dataset.professionPanel]:[];
   const tbody=panel.querySelector('tbody'); if(!tbody)return;
   tbody.replaceChildren();
   if(!records.length)return;
   let lastCategory=null;
   records.forEach(n=>{
    const category=(n.category||'').trim()||'Uncategorised';
    if(category!==lastCategory){
     const heading=document.createElement('tr');heading.className='nano-category-row';
     const cell=document.createElement('th');cell.colSpan=5;cell.scope='colgroup';cell.textContent=category;
     heading.append(cell);tbody.append(heading);lastCategory=category;
    }
    const tr=document.createElement('tr');
    const ql=document.createElement('td');ql.className='nano-ql-cell';
    const qlBox=document.createElement('span');qlBox.className='nano-ql';
    const qlLabel=document.createElement('b');qlLabel.textContent='QL';
    const qlValue=document.createElement('span');qlValue.textContent=n.ql??'—';
    qlBox.append(qlLabel,qlValue);ql.append(qlBox);
    const icon=document.createElement('td');icon.className='nano-icon-cell';
    if(n.icon){const img=document.createElement('img');img.className='nano-icon';img.src=n.icon;img.alt='';img.loading='lazy';img.onerror=()=>{img.hidden=true;icon.textContent='—'};icon.append(img)}else icon.textContent='—';
    const name=document.createElement('td');name.className='nano-name';
    const nameText=document.createElement('span');nameText.className='nano-name-text';nameText.textContent=n.name||'Unnamed nano';name.append(nameText);
    addTooltip(name,n);
    const locationCell=document.createElement('td');locationCell.className='nano-location';locationCell.textContent=(n.location||'—').trim()||'—';
    const req=document.createElement('td');req.className='nano-requirements-cell';
    const reqGrid=document.createElement('div');reqGrid.className='nano-requirements';req.append(reqGrid);
    const skills=n.skills&&typeof n.skills==='object'?n.skills:{};
    ['MM','BM','PM','SI','TS','MC'].forEach(skill=>{
     const item=document.createElement('span');item.className='nano-skill'+(skills[skill]===undefined?' is-empty':'');
     const label=document.createElement('b');label.textContent=skill;
     const value=document.createElement('span');value.textContent=skills[skill]??'—';
     item.append(label,value);reqGrid.append(item);
    });
    [ql,icon,name,locationCell,req].forEach(c=>tr.append(c));tbody.append(tr);
   });
   const empty=panel.querySelector('.empty-nanos');if(empty)empty.hidden=true;
  });
 } catch(e) { console.error('Unable to load nano data:',e); }
});
