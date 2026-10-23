(() => {
  "use strict";
  const STORE = "my-work-pay-v1";
  const $ = id => document.getElementById(id);
  const now = new Date();
  const isoDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const monthKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
  const timeNow = () => `${String(new Date().getHours()).padStart(2,"0")}:${String(new Date().getMinutes()).padStart(2,"0")}`;
  const money = n => new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"}).format(Number.isFinite(n)?n:0);
  const num = (v, fallback=0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const esc = s => String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const defaultData = () => ({
    settings:{hourlyRate:12.5,dailyHours:7.5,leaveAllowance:28,pensionRate:0,pensionMethod:"netpay",taxRegion:"england",taxCode:"1257L",defaultBreak:30},
    shifts:[], leaves:[], activeShiftId:null
  });
  let data = loadData();
  let toastTimer;
  function loadData(){
    try { const x=JSON.parse(localStorage.getItem(STORE)); if(x && x.settings && Array.isArray(x.shifts) && Array.isArray(x.leaves)) return {...defaultData(),...x,settings:{...defaultData().settings,...x.settings}}; } catch(e){}
    return defaultData();
  }
  function save(){ localStorage.setItem(STORE,JSON.stringify(data)); renderAll(); }
  function toast(message){ const el=$("toast"); el.textContent=message; el.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("show"),2600); }
  function parseShift(s){
    const start=new Date(`${s.date}T${s.start}:00`);
    let end=new Date(`${s.date}T${s.end}:00`);
    if(end<=start) end.setDate(end.getDate()+1);
    const elapsed=Math.max(0,(end-start)/3600000);
    const hours=Math.max(0,elapsed-num(s.breakMinutes)/60);
    return {start,end,elapsed,hours};
  }
  function shiftHours(s){return parseShift(s).hours;}
  function shiftGross(s){return shiftHours(s)*num(s.rate,data.settings.hourlyRate);}
  function monthShifts(m){return data.shifts.filter(s=>s.date && s.end && s.date.slice(0,7)===m);}
  function monthLeaves(m){return data.leaves.filter(l=>l.date && l.date.slice(0,7)===m);}
  function leaveIsPaid(l){return l.paid==="yes";}
  function leaveHours(l){return num(l.days)*num(l.hoursPerDay,data.settings.dailyHours);}
  function leaveGross(l){return leaveIsPaid(l)?leaveHours(l)*num(data.settings.hourlyRate):0;}
  function leaveTypeLabel(l){return ({paid:"Paid annual leave",unpaid:"Unpaid leave",sick:"Sick leave",otherPaid:"Other paid leave"}[l.type]||"Leave");}
  function formatDate(s){if(!s)return "";const d=new Date(`${s}T12:00:00`);return d.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"});}
  function allMonthly(m){
    const shifts=monthShifts(m), leaves=monthLeaves(m);
    const hours=shifts.reduce((a,s)=>a+shiftHours(s),0);
    const paidLeaveHours=leaves.filter(leaveIsPaid).reduce((a,l)=>a+leaveHours(l),0);
    const unpaidDays=leaves.filter(l=>!leaveIsPaid(l)).reduce((a,l)=>a+num(l.days),0);
    const gross=shifts.reduce((a,s)=>a+shiftGross(s),0)+leaves.reduce((a,l)=>a+leaveGross(l),0);
    const pay=estimateDeductions(gross);
    return {shifts,leaves,hours,paidLeaveHours,unpaidDays,gross,...pay};
  }
  function estimateDeductions(monthGross){
    // Simplified 2026/27 annualised estimate. Not an HMRC payroll calculation.
    const s=data.settings, annualGross=Math.max(0,monthGross*12);
    const pension=Math.max(0,monthGross*num(s.pensionRate)/100);
    const annualPension=pension*12;
    const taxableAnnual = s.pensionMethod==="netpay" ? Math.max(0,annualGross-annualPension) : annualGross;
    const personalAllowance=Math.max(0,12570-Math.max(0,annualGross-100000)/2);
    const taxable=Math.max(0,taxableAnnual-personalAllowance);
    let tax=0;
    if(s.taxRegion==="scotland"){
      // Scottish non-savings income bands; simplified annual bands for 2026/27.
      const bands=[[0,2827,.19],[2827,14921,.20],[14921,31092,.21],[31092,62430,.42],[62430,125140,.45],[125140,Infinity,.48]];
      let prev=0;
      for(const [upper,unused,rate] of []){} // no-op, keeps this branch explicit
      const slices=[[2827,.19],[14921,.20],[31092,.21],[62430,.42],[125140,.45],[Infinity,.48]];
      let remaining=taxable, lower=0;
      for(const [upper,rate] of slices){const width=upper-lower;const amount=Math.min(remaining,width);tax+=amount*rate;remaining-=amount;lower=upper;if(remaining<=0)break;}
    } else {
      const bands=[[37700,.20],[125140-personalAllowance-37700,.40],[Infinity,.45]];
      let remaining=taxable;
      for(const [width,rate] of bands){const amount=Math.min(remaining,width);tax+=amount*rate;remaining-=amount;if(remaining<=0)break;}
    }
    // Employee NI approximation using monthly thresholds annualised over 12.
    const niable=Math.max(0,monthGross-1048);
    const ni=Math.min(niable,4189-1048)*.08+Math.max(0,niable-(4189-1048))*.02;
    let monthlyTax=tax/12;
    // Relief-at-source: pension is paid from net pay; basic relief is added to pension pot,
    // not paid to the employee. Higher-rate relief not modelled.
    const pensionCashCost = s.pensionMethod==="relief" ? pension*0.8 : pension;
    const takeHome=Math.max(0,monthGross-monthlyTax-ni-pensionCashCost);
    return {tax:monthlyTax,ni,pension,net:takeHome};
  }
  function activeShift(){return data.shifts.find(s=>s.id===data.activeShiftId && !s.end) || null;}
  function setMonthInputs(){
    const m=monthKey(now);
    ["dashboardMonth","shiftMonth","reportMonth"].forEach(id=>{if(!$ (id).value) $(id).value=m;});
  }
  function renderClock(){
    const active=activeShift();
    $("clockStatus").textContent=active?`On shift since ${active.start}`:"Not clocked in";
    $("statusDot").style.background=active?"#ffce73":"#b8e6b4";
    $("clockInBtn").disabled=!!active;
    $("clockOutBtn").disabled=!active;
    $("clockHint").textContent=active?"When your shift ends, clock out. You can enter break minutes after clocking out.":"Clock in to start a shift. Add breaks and edit details later.";
  }
  function renderOverview(){
    const m=$("dashboardMonth").value||monthKey(now), x=allMonthly(m);
    $("monthHours").textContent=`${x.hours.toFixed(1)} h`;
    $("monthShiftCount").textContent=`${x.shifts.length} shift${x.shifts.length===1?"":"s"}`;
    $("monthGross").textContent=money(x.gross);
    $("monthNet").textContent=money(x.net);
    const used=data.leaves.filter(l=>l.type==="paid" && l.paid==="yes" && l.date.slice(0,4)===String(now.getFullYear())).reduce((a,l)=>a+num(l.days),0);
    $("leaveRemaining").textContent=`${Math.max(0,num(data.settings.leaveAllowance)-used).toFixed(1)} days`;
    const recent=[...monthShifts(m)].sort((a,b)=>(b.date+b.start).localeCompare(a.date+a.start)).slice(0,4);
    $("recentShifts").innerHTML=recent.length?recent.map(shiftCard).join(""):'<div class="empty">No shifts recorded for this month yet.</div>';
  }
  function shiftCard(s){
    const h=shiftHours(s), gross=shiftGross(s);
    return `<div class="list-item"><div class="list-main"><strong>${esc(formatDate(s.date))} · ${esc(s.start)}–${esc(s.end||"In progress")}</strong><p>${h.toFixed(2)} paid hours · ${num(s.breakMinutes)} min break${s.notes?" · "+esc(s.notes):""}</p></div><div class="list-side"><strong>${money(gross)}</strong><button data-edit-shift="${esc(s.id)}">Edit</button></div></div>`;
  }
  function renderShifts(){
    const m=$("shiftMonth").value||monthKey(now);
    const list=[...monthShifts(m)].sort((a,b)=>(b.date+b.start).localeCompare(a.date+a.start));
    $("shiftList").innerHTML=list.length?list.map(shiftCard).join(""):'<div class="empty">No shifts in this month. Tap “Add shift” or use Clock in.</div>';
  }
  function renderLeave(){
    const allowance=num(data.settings.leaveAllowance);
    const used=data.leaves.filter(l=>l.type==="paid"&&leaveIsPaid(l)&&l.date.slice(0,4)===String(now.getFullYear())).reduce((a,l)=>a+num(l.days),0);
    $("leaveAllowanceText").textContent=`${allowance.toFixed(1)} days`;
    $("leaveUsedText").textContent=`${used.toFixed(1)} days`;
    $("leaveBalanceText").textContent=`${Math.max(0,allowance-used).toFixed(1)} days`;
    const list=[...data.leaves].sort((a,b)=>b.date.localeCompare(a.date));
    $("leaveList").innerHTML=list.length?list.map(l=>`<div class="list-item"><div class="list-main"><strong>${esc(formatDate(l.date))} · ${esc(leaveTypeLabel(l))}</strong><p>${num(l.days)} day(s) · ${leaveIsPaid(l)?"Paid":"Unpaid"}${l.notes?" · "+esc(l.notes):""}</p></div><div class="list-side"><strong>${money(leaveGross(l))}</strong><button data-edit-leave="${esc(l.id)}">Edit</button></div></div>`).join(""):'<div class="empty">No leave recorded yet.</div>';
  }
  function renderReport(){
    const m=$("reportMonth").value||monthKey(now),x=allMonthly(m);
    $("rHours").textContent=`${x.hours.toFixed(2)} h`;
    $("rLeaveHours").textContent=`${x.paidLeaveHours.toFixed(2)} h`;
    $("rUnpaidDays").textContent=x.unpaidDays.toFixed(2);
    $("rGross").textContent=money(x.gross);
    $("rTax").textContent=money(x.tax);
    $("rNI").textContent=money(x.ni);
    $("rPension").textContent=money(x.pension);
    $("rNet").textContent=money(x.net);
  }
  function renderAll(){renderClock();renderOverview();renderShifts();renderLeave();renderReport();fillSettings();}
  function fillSettings(){
    const s=data.settings;
    ["hourlyRate","dailyHours","leaveAllowance","pensionRate","pensionMethod","taxRegion","taxCode","defaultBreak"].forEach(k=>{const el=$(k);if(el && document.activeElement!==el)el.value=s[k]??"";});
  }
  function openShift(s=null){
    $("shiftDialogTitle").textContent=s?"Edit shift":"Add shift";
    $("shiftId").value=s?.id||"";
    $("shiftDate").value=s?.date||isoDate(new Date());
    $("shiftStart").value=s?.start||"07:00";
    $("shiftEnd").value=s?.end||"15:00";
    $("shiftBreak").value=s?.breakMinutes??data.settings.defaultBreak;
    $("shiftRate").value=s?.rate??data.settings.hourlyRate;
    $("shiftNotes").value=s?.notes||"";
    $("shiftDialog").showModal();
  }
  function openLeave(l=null){
    $("leaveDialogTitle").textContent=l?"Edit leave":"Add leave";
    $("leaveId").value=l?.id||"";
    $("leaveType").value=l?.type||"paid";
    $("leaveDate").value=l?.date||isoDate(new Date());
    $("leaveDays").value=l?.days??1;
    $("leaveHours").value=l?.hoursPerDay??data.settings.dailyHours;
    $("leavePaid").value=l?.paid??"yes";
    $("leaveNotes").value=l?.notes||"";
    $("leaveDialog").showModal();
  }
  function uid(){return `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;}
  function download(filename, content, type){
    const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function exportBackup(){download(`my-work-pay-backup-${isoDate(new Date())}.json`,JSON.stringify({...data,exportedAt:new Date().toISOString(),schemaVersion:1},null,2),"application/json");toast("Backup exported. Keep it somewhere safe.");}
  function exportCsv(){
    const m=$("reportMonth").value||monthKey(now),x=allMonthly(m);
    const rows=[["My Work & Pay report",m],["Shift date","Start","End","Break minutes","Paid hours","Hourly rate","Gross pay","Notes"]];
    x.shifts.forEach(s=>rows.push([s.date,s.start,s.end,s.breakMinutes,shiftHours(s).toFixed(2),s.rate,shiftGross(s).toFixed(2),s.notes||""]));
    rows.push([],["Metric","Amount"],["Shift hours",x.hours.toFixed(2)],["Paid leave hours",x.paidLeaveHours.toFixed(2)],["Unpaid leave days",x.unpaidDays.toFixed(2)],["Gross pay",x.gross.toFixed(2)],["Estimated Income Tax",x.tax.toFixed(2)],["Estimated NI",x.ni.toFixed(2)],["Estimated pension",x.pension.toFixed(2)],["Estimated take-home",x.net.toFixed(2)]);
    const csv=rows.map(row=>row.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(",")).join("\r\n");
    download(`my-work-pay-${m}.csv`,csv,"text/csv;charset=utf-8");toast("Monthly CSV report exported.");
  }
  function clockIn(){
    if(activeShift())return;
    const d=new Date(),s={id:uid(),date:isoDate(d),start:timeNow(),end:"",breakMinutes:num(data.settings.defaultBreak),rate:num(data.settings.hourlyRate),notes:"",createdAt:d.toISOString()};
    data.shifts.push(s);data.activeShiftId=s.id;save();toast("Clocked in. Remember to clock out at the end of your shift.");
  }
  function clockOut(){
    const s=activeShift();if(!s)return;
    s.end=timeNow();
    data.activeShiftId=null;
    save();$("shiftMonth").value=s.date.slice(0,7);openShift(s);toast("Clocked out. Check your break and shift details.");
  }
  function switchTab(name){
    document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===name));
    document.querySelectorAll(".panel").forEach(p=>p.classList.toggle("active",p.id===`panel-${name}`));
  }
  document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));
  $("settingsShortcut").addEventListener("click",()=>switchTab("settings"));
  $("clockInBtn").addEventListener("click",clockIn);
  $("clockOutBtn").addEventListener("click",clockOut);
  $("addShiftBtn").addEventListener("click",()=>openShift());
  $("addShiftShortcut").addEventListener("click",()=>openShift());
  $("addLeaveBtn").addEventListener("click",()=>openLeave());
  $("addLeaveShortcut").addEventListener("click",()=>openLeave());
  $("exportShortcut").addEventListener("click",exportBackup);
  $("exportBtn").addEventListener("click",exportBackup);
  $("downloadCsvBtn").addEventListener("click",exportCsv);
  ["dashboardMonth","shiftMonth","reportMonth"].forEach(id=>$(id).addEventListener("change",renderAll));
  document.addEventListener("click",e=>{
    const es=e.target.closest("[data-edit-shift]");
    const el=e.target.closest("[data-edit-leave]");
    if(es){const s=data.shifts.find(x=>x.id===es.dataset.editShift);if(s)openShift(s);}
    if(el){const l=data.leaves.find(x=>x.id===el.dataset.editLeave);if(l)openLeave(l);}
  });
  $("shiftForm").addEventListener("submit",e=>{
    e.preventDefault();
    const id=$("shiftId").value;
    const s={id:id||uid(),date:$("shiftDate").value,start:$("shiftStart").value,end:$("shiftEnd").value,breakMinutes:num($("shiftBreak").value),rate:num($("shiftRate").value),notes:$("shiftNotes").value.trim()};
    if(!s.date||!s.start||!s.end){toast("Please enter a date, start and end time.");return;}
    const elapsed=parseShift(s).elapsed;
    if(num(s.breakMinutes)>elapsed*60){if(!confirm("Break time is longer than the shift. Save anyway?"))return;}
    if(id){const i=data.shifts.findIndex(x=>x.id===id);if(i>=0)data.shifts[i]={...data.shifts[i],...s};}
    else data.shifts.push(s);
    if(data.activeShiftId===id && s.end)data.activeShiftId=null;
    $("shiftDialog").close();save();toast("Shift saved.");
  });
  $("leaveForm").addEventListener("submit",e=>{
    e.preventDefault();
    const id=$("leaveId").value,type=$("leaveType").value;
    const l={id:id||uid(),type,date:$("leaveDate").value,days:num($("leaveDays").value),hoursPerDay:num($("leaveHours").value),paid:$("leavePaid").value,notes:$("leaveNotes").value.trim()};
    if(type==="unpaid")l.paid="no";
    if(!l.date||l.days<=0){toast("Enter a valid date and number of days.");return;}
    if(id){const i=data.leaves.findIndex(x=>x.id===id);if(i>=0)data.leaves[i]={...data.leaves[i],...l};}else data.leaves.push(l);
    $("leaveDialog").close();save();toast("Leave saved.");
  });
  $("settingsForm").addEventListener("submit",e=>{
    e.preventDefault();
    data.settings={hourlyRate:num($("hourlyRate").value),dailyHours:num($("dailyHours").value),leaveAllowance:num($("leaveAllowance").value),pensionRate:num($("pensionRate").value),pensionMethod:$("pensionMethod").value,taxRegion:$("taxRegion").value,taxCode:$("taxCode").value.trim(),defaultBreak:num($("defaultBreak").value)};
    save();toast("Settings saved.");
  });
  $("leaveType").addEventListener("change",()=>{
    if($("leaveType").value==="unpaid")$("leavePaid").value="no";
    else if($("leaveType").value==="paid"||$("leaveType").value==="otherPaid")$("leavePaid").value="yes";
  });
  $("importFile").addEventListener("change",async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try{
      const parsed=JSON.parse(await file.text());
      if(!parsed.settings||!Array.isArray(parsed.shifts)||!Array.isArray(parsed.leaves))throw new Error("This does not look like a My Work & Pay backup.");
      if(!confirm("Importing replaces the current app data. Export a backup first if you want to keep it. Continue?"))return;
      data={...defaultData(),...parsed,settings:{...defaultData().settings,...parsed.settings},activeShiftId:parsed.activeShiftId||null};save();toast("Backup imported.");
    }catch(err){alert("Could not import this file. Please choose a valid My Work & Pay JSON backup.");}
    finally{e.target.value="";}
  });
  $("clearDataBtn").addEventListener("click",()=>{
    if(confirm("Delete all shifts, leave records and settings stored by this app on this device? This cannot be undone unless you have a backup.")){
      data=defaultData();localStorage.removeItem(STORE);save();toast("App data cleared.");
    }
  });
  setMonthInputs();
  renderAll();
  const tick=()=>{$("liveTime").textContent=new Date().toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit",second:"2-digit"});};
  tick();setInterval(tick,1000);
  if("serviceWorker" in navigator && location.protocol.startsWith("http"))navigator.serviceWorker.register("./sw.js").catch(()=>{});
})();