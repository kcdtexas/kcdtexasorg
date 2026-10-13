/* The video player: a "Watch" link to one talk (a.watch) plays it in a dialog, from youtube-nocookie.com.
   Nothing loads from YouTube before the click (ADR 0007). Close and Escape remove the player, so playback
   stops, and focus goes back to the link. Without this script, the link goes to YouTube. */
(function(d){var g,l;
d.addEventListener('click',function(e){
var a=e.target.closest&&e.target.closest('a.watch');
if(!a||e.button||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
var u=new URL(a.href),id=u.searchParams.get('v')||'';
if(u.hostname!='www.youtube.com'||u.pathname!='/watch'||u.searchParams.has('list')||!/^[\w-]{11}$/.test(id))return;
e.preventDefault();l=a;
if(!g){g=d.createElement('dialog');g.className='player';
g.innerHTML='<div class="player-bar"><p class="player-title"></p><button type="button" class="btn btn--sm btn--line">Close</button></div><div class="player-frame"></div>';
g.querySelector('button').onclick=function(){g.close()};
g.onclose=function(){g.lastChild.textContent='';l.focus()};
d.body.append(g)}
var t=(a.querySelector('.sr-only')||a).textContent.replace(/^[\s:]+/,'').trim(),f=d.createElement('iframe');
f.src='https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1&cc_load_policy=1&cc_lang_pref=en&rel=0';
f.title=t;f.allow='autoplay; encrypted-media; fullscreen; picture-in-picture';f.allowFullscreen=true;
g.querySelector('p').textContent=t;g.setAttribute('aria-label',t);
g.lastChild.append(f);g.showModal()})
})(document);
