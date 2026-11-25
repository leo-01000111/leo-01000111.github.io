/* Karty pracy menu on /korepetycje/: track tabs + right-click "copy link" menu. */
(function(){
  'use strict';
  var sec = document.getElementById('karty-pracy');
  if(!sec) return;
  var tabs = Array.prototype.slice.call(sec.querySelectorAll('.karty-tab'));
  var menu = document.getElementById('kartyMenu');
  var toast = document.getElementById('kartyToast');
  var current = null, toastTimer = 0;

  function select(tab){
    tabs.forEach(function(t){
      var on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      var p = document.getElementById(t.getAttribute('aria-controls'));
      if(p) p.hidden = !on;
    });
  }
  tabs.forEach(function(t, i){
    t.tabIndex = t.getAttribute('aria-selected') === 'true' ? 0 : -1;
    t.addEventListener('click', function(){ select(t); });
    t.addEventListener('keydown', function(e){
      var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if(!d) return;
      var n = tabs[(i + d + tabs.length) % tabs.length];
      select(n); n.focus();
    });
  });

  function isEn(){ return document.body.classList.contains('lang-en'); }

  function showToast(msg){
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ toast.hidden = true; }, 1800);
  }

  function copy(text){
    function fallback(){
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try{ ok = document.execCommand('copy'); }catch(e){}
      document.body.removeChild(ta);
      return ok;
    }
    var done = function(ok){
      showToast(ok ? (isEn() ? 'Link copied' : 'Skopiowano link') : text);
    };
    if(navigator.clipboard && window.isSecureContext){
      navigator.clipboard.writeText(text).then(function(){ done(true); }, function(){ done(fallback()); });
    } else done(fallback());
  }

  function hide(){ menu.hidden = true; current = null; }

  function openMenu(link, x, y){
    current = link;
    menu.hidden = false;
    var w = menu.offsetWidth, h = menu.offsetHeight;
    var left = Math.min(x, window.innerWidth - w - 8);
    var top = Math.min(y, window.innerHeight - h - 8);
    menu.style.left = Math.max(8, left) + 'px';
    menu.style.top = Math.max(8, top) + 'px';
    menu.querySelector('button').focus({preventScroll:true});
  }

  sec.addEventListener('contextmenu', function(e){
    var link = e.target.closest('.karta');
    if(!link) return;
    e.preventDefault();
    openMenu(link, e.clientX, e.clientY);
  });

  menu.addEventListener('click', function(e){
    var b = e.target.closest('button');
    if(!b || !current) return;
    var url = current.getAttribute('data-url') || current.href;
    if(b.getAttribute('data-act') === 'copy') copy(url);
    else window.open(current.href, '_blank', 'noopener');
    hide();
  });
  menu.addEventListener('keydown', function(e){
    var items = Array.prototype.slice.call(menu.querySelectorAll('button'));
    var i = items.indexOf(document.activeElement);
    if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){
      e.preventDefault();
      items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
    }
  });
  document.addEventListener('mousedown', function(e){ if(!menu.hidden && !menu.contains(e.target)) hide(); });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && !menu.hidden){ var c = current; hide(); if(c) c.focus(); } });
  window.addEventListener('scroll', function(){ if(!menu.hidden) hide(); }, {passive:true});
  window.addEventListener('resize', hide);
  window.addEventListener('blur', hide);

  /* deep link: /korepetycje/#karty-pracy opens the section; #karty-e8 etc. picks a tab */
  var m = location.hash.match(/^#karty-(\w+)$/);
  if(m){
    var t = document.getElementById('ktab-' + m[1]);
    if(t) select(t);
  }
})();
