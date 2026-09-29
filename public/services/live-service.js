;(function(global){
  'use strict';
  var socket=null, connected=false, fallbackTimer=null;
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
  function connect(){
    if(typeof io==='undefined'){
      // socket.io client not loaded — use polling fallback
      startPolling(); return;
    }
    var dept=getDept();
    socket=io({ query:{dept:dept}, auth:{dept:dept}, transports:['websocket','polling'] });
    socket.on('connect', function(){ connected=true; socket.emit('join', dept); socket.emit('join','global'); });
    socket.on('disconnect', function(){ connected=false; startPolling(); });
    socket.onAny(function(event, data){ emitLocal(event, data); });
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
})(window);
