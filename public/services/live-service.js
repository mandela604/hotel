;(function(global){
  'use strict';
  var socket=null, connected=false, fallbackTimer=null, reconnectDelay=1000, maxDelay=30000;
  var listeners={};
  function getDept(){
    try{
      var p=location.pathname;
      if(p.indexOf('/restaurant')!==-1) return 'restaurant';
      if(p.indexOf('/poolbar')!==-1) return 'poolbar';
      if(p.indexOf('/kitchen')!==-1) return 'kitchen';
      if(p.indexOf('/store')!==-1) return 'store';
      if(p.indexOf('/booking')!==-1) return 'booking';
      if(p.indexOf('/procurement')!==-1) return 'procurement';
      if(p.indexOf('/accounting')!==-1) return 'accounting';
      if(p.indexOf('/gym')!==-1) return 'gym';
    }catch(e){}
    return 'global';
  }
  function emitLocal(event, data){
    var arr=listeners[event]||[];
    arr.forEach(function(cb){ try{cb(data);}catch(e){} });
  }
  function stopPolling(){
    if(fallbackTimer){ clearInterval(fallbackTimer); fallbackTimer=null; }
  }
  function connect(){
    if(typeof io==='undefined'){
      startPolling(); return;
    }
    var dept=getDept();
    socket=io({ query:{dept:dept}, auth:{dept:dept}, transports:['websocket','polling'], withCredentials:true });
    socket.on('connect', function(){ connected=true; reconnectDelay=1000; stopPolling(); socket.emit('join', dept); socket.emit('join','global'); });
    socket.on('disconnect', function(){ connected=false; startPolling(); scheduleReconnect(); });
    socket.on('connect_error', function(){ connected=false; startPolling(); scheduleReconnect(); });
    socket.onAny(function(event, data){ emitLocal(event, data); });
  }
  function scheduleReconnect(){
    if(socket && socket.connected) return;
    var d=reconnectDelay;
    reconnectDelay=Math.min(maxDelay, Math.floor(reconnectDelay*1.8+Math.random()*400));
    setTimeout(function(){ try{ if(!connected){ if(socket){ try{socket.connect();}catch(e){} } else connect(); } }catch(e){} }, d);
  }
  function startPolling(){
    if(fallbackTimer) return;
    fallbackTimer=setInterval(function(){ emitLocal('poll:tick', Date.now()); },5000);
  }
  function on(event, cb){
    if(!listeners[event]) listeners[event]=[];
    listeners[event].push(cb);
    if(socket) socket.on(event, cb);
  }
  function off(event, cb){
    if(!listeners[event]) return;
    listeners[event]=listeners[event].filter(function(fn){return fn!==cb;});
    if(socket) socket.off(event, cb);
  }
  function emit(event, data){
    if(socket && connected) socket.emit(event, data);
  }
  // auto-connect when script loads
  try{ connect(); }catch(e){}
  // load socket.io client if not present
  if(typeof io==='undefined'){
    var s=document.createElement('script');
    s.src='/socket.io/socket.io.js';
    s.onload=connect;
    document.head.appendChild(s);
  }
  global.LiveService={ on:on, off:off, emit:emit, getDept:getDept };
  // ── auto-wire: debounced refresh on dept:updated + poll:tick ──
  function _doLiveRefresh(){
    try{
      if(typeof window.refreshDataAndRender==='function'){ window.refreshDataAndRender(); return; }
      if(typeof window.loadData==='function'){ window.loadData(); return; }
      if(typeof window.fetchData==='function'){ window.fetchData(); return; }
      if(typeof window.render==='function'){ try{ window.render(); }catch(e){} return; }
      if(typeof window.loadInventory==='function'){ window.loadInventory(); return; }
      if(typeof window.loadStock==='function'){ window.loadStock(); return; }
      if(typeof window.reloadData==='function'){ window.reloadData(); return; }
      if(typeof window.refresh==='function'){ window.refresh(); return; }
      window.dispatchEvent(new CustomEvent('live:update'));
    }catch(e){}
  }
  var _liveDebounce=null;
  function _debouncedLiveRefresh(){ if(_liveDebounce) clearTimeout(_liveDebounce); _liveDebounce=setTimeout(_doLiveRefresh,400); }
  function _wireLiveAuto(){
    try{
      var d=getDept();
      if(d==='global') return;
      on(d+':updated', _debouncedLiveRefresh);
      on('poll:tick', _debouncedLiveRefresh);
    }catch(e){}
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', _wireLiveAuto);
  } else {
    try{ _wireLiveAuto(); }catch(e){}
  }
})(window);
