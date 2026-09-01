/* GymService — production API (id:uuidv4, no localStorage) */
(function(global){
  'use strict';
  const CONFIG={API_BASE:'/api/gym'};
  async function apiFetch(path, opts){
    opts=opts||{};
    const h=Object.assign({'Content-Type':'application/json'},opts.headers||{});
    let r; try{ r=await fetch(CONFIG.API_BASE+path,Object.assign({},opts,{headers:h,credentials:'include'})); }catch(e){ throw new Error('Network error: '+e.message); }
    let b=null; try{ b=await r.json(); }catch(e){}
    if(!r.ok || (b&&b.success===false)){ throw new Error((b&&b.error)||('Request failed ('+r.status+')')); }
    return b?b.data:null;
  }
  function genId(){ const {v4}=global.uuid||{}; if(v4) return v4(); return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0,v=c==='x'?r:(r&0x3|0x8);return v.toString(16);}); }
  function daysUntil(d){ if(!d) return null; const a=new Date(d+'T00:00:00'), t=new Date(); t.setHours(0,0,0,0); return Math.round((a-t)/86400000); }
  function computeStatus(m){ if(!m.planId) return 'expired'; if(m.status==='frozen') return 'frozen'; const d=daysUntil(m.expiry); if(d===null) return 'active'; if(d<0) return 'expired'; if(d<=7) return 'expiring'; return 'active'; }
  function fmtN(n){return '₦'+Math.round(n||0).toLocaleString('en-NG');}
  function fmtDate(s){ if(!s) return '—'; return new Date(s+'T00:00:00').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); }
  function initials(n){return (n||'').split(' ').filter(Boolean).map(w=>w[0]).join('').toUpperCase().slice(0,2);}
  class GymService{
    constructor(){ this.state={members:[],plans:[],checkins:[],guests:[]}; this._listeners=[]; this._loaded=false; this.KEYS={MEMBERS:'gym-members',PLANS:'gym-plans',CHECKINS:'gym-checkins',GUESTS:'hotel-guests'}; }
    async loadAll(){ try{ const [m,p,c,g]=await Promise.all([apiFetch('/members'),apiFetch('/plans'),apiFetch('/checkins'),apiFetch('/guests')]); this.state.members=Array.isArray(m)?m:[]; this.state.plans=Array.isArray(p)?p:[]; this.state.checkins=Array.isArray(c)?c:[]; this.state.guests=Array.isArray(g)?g:[]; }catch(e){ console.error('[GymService] load failed',e.message); this.state.members=[]; this.state.plans=[]; this.state.checkins=[]; this.state.guests=[]; } this._loaded=true; this._notify(); return this.state; }
    onChange(cb){ if(typeof cb==='function'){ this._listeners.push(cb); if(this._loaded) cb(this.state); } }
    _notify(){ const s=this.state; this._listeners.forEach(fn=>{ try{ fn(s);}catch(e){}}); }
    getMembers(){return this.state.members;} getPlans(){return this.state.plans;} getCheckins(){return this.state.checkins;} getGuests(){return this.state.guests;}
    findMember(id){return this.state.members.find(m=>m.id===id);}
    findPlan(id){return this.state.plans.find(p=>p.id===id);}
    getDashboardKPIs(){ const withStatus=this.state.members.map(m=>({...m,_s:computeStatus(m)})); return {active:withStatus.filter(m=>m._s==='active').length, expiring:withStatus.filter(m=>m._s==='expiring').length, expired:withStatus.filter(m=>m._s==='expired').length, frozen:withStatus.filter(m=>m._s==='frozen').length, revenue:withStatus.filter(m=>m._s==='active'||m._s==='expiring').reduce((s,m)=>{const pl=this.findPlan(m.planId); return s+(pl?pl.price:0);},0), total:this.state.members.length};}
    async addMember(d){ const m=await apiFetch('/members',{method:'POST',body:JSON.stringify(d)}); if(m){ this.state.members.push(m); this._notify(); } return m; }
    async editMember(id,u){ const m=await apiFetch('/members/'+encodeURIComponent(id),{method:'PUT',body:JSON.stringify(u)}); if(m){ const i=this.state.members.findIndex(x=>x.id===id); if(i>-1) this.state.members[i]=m; this._notify(); } return m; }
    async deleteMember(id){ await apiFetch('/members/'+encodeURIComponent(id),{method:'DELETE'}); this.state.members=this.state.members.filter(m=>m.id!==id); this._notify(); }
    async checkIn(id){ const c=await apiFetch('/checkins',{method:'POST',body:JSON.stringify({memberId:id})}); if(c){ const mem=this.findMember(id); if(mem){ mem.checkins=(mem.checkins||0)+1; mem.lastCheckin=c.time; } this.state.checkins.unshift(c); if(this.state.checkins.length>100) this.state.checkins=this.state.checkins.slice(0,100); this._notify(); } return c; }
    async renewMember(id,expiry){ const m=await apiFetch('/members/'+encodeURIComponent(id)+'/renew',{method:'POST',body:JSON.stringify({expiry})}); if(m){ const i=this.state.members.findIndex(x=>x.id===id); if(i>-1) this.state.members[i]=m; this._notify(); } return m; }
    async addPlan(d){ const p=await apiFetch('/plans',{method:'POST',body:JSON.stringify(d)}); if(p){ this.state.plans.push(p); this._notify(); } return p; }
    async editPlan(id,u){ const p=await apiFetch('/plans/'+encodeURIComponent(id),{method:'PUT',body:JSON.stringify(u)}); if(p){ const i=this.state.plans.findIndex(x=>x.id===id); if(i>-1) this.state.plans[i]=p; this._notify(); } return p; }
    async deletePlan(id){ await apiFetch('/plans/'+encodeURIComponent(id),{method:'DELETE'}); this.state.plans=this.state.plans.filter(p=>p.id!==id); this._notify(); }
    async addGuest(d){ const g=await apiFetch('/guests',{method:'POST',body:JSON.stringify(d)}); if(g){ this.state.guests.push(g); this._notify(); } return g; }
    async deleteGuest(id){ await apiFetch('/guests/'+encodeURIComponent(id),{method:'DELETE'}); this.state.guests=this.state.guests.filter(g=>g.id!==id); this._notify(); }
    getRevenueReport(from,to){ const members=this.state.members, checkins=this.state.checkins, plans=this.state.plans; const planMap={}; plans.forEach(p=>planMap[p.id]=p); const filterDate=d=>{ if(!d) return false; if(from&&d<from) return false; if(to&&d>to) return false; return true; }; const newMembers=members.filter(m=>filterDate(m.joined)); const checkinsInRange=checkins.filter(ci=>{ const d=ci.time?ci.time.split('T')[0]:null; return filterDate(d);}); const revenueByPlan={}; let totalRevenue=0; newMembers.forEach(m=>{ const pl=planMap[m.planId]||{id:'none',name:'No Plan',price:0}; const k=pl.id; if(!revenueByPlan[k]) revenueByPlan[k]={plan:pl,count:0,subtotal:0}; revenueByPlan[k].count++; revenueByPlan[k].subtotal+=pl.price||0; totalRevenue+=pl.price||0; }); const activeMembers=members.filter(m=>{ if(!m.planId) return false; if(m.status==='frozen') return false; const d=daysUntil(m.expiry); return d!==null&&d>=0; }).length; return {period:{from,to},totalRevenue,newMembersCount:newMembers.length,checkinsCount:checkinsInRange.length,activeMembers,revenueByPlan:Object.values(revenueByPlan),newMembers}; }
  }
  global.GymService=new GymService();
})(window);
