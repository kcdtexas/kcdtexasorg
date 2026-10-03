/* Theme: the stored choice, before paint, and the switch. Kept in this browser. */
(function(d,k){var r=d.documentElement,m=matchMedia('(prefers-color-scheme:dark)'),L;try{L=localStorage}catch(e){}
function s(){return m.matches?'dark':'light'}
function a(){var v;try{v=L[k]}catch(e){}v=v=='dark'||v=='light'?v:0;v?r.dataset.theme=v:delete r.dataset.theme;
var c=v||s(),C=c=='dark'?'Dark':'Light',n=c=='dark'?'Light':'Dark';
d.querySelectorAll('meta[name=theme-color]').forEach(function(t){t.content=t.dataset[v?c:t.dataset.for]});
var b=d.querySelector('[data-theme-toggle]');if(b){b.hidden=!1;b.dataset.now=c;
b.children[2].textContent=C+' theme. Switch to ';b.children[3].textContent=n}return C}
a();m.addEventListener('change',a);d.addEventListener('DOMContentLoaded',a);
d.addEventListener('click',function(e){if(e.target.closest('[data-theme-toggle]')){var n=a()=='Dark'?'light':'dark';
try{n==s()?L.removeItem(k):L[k]=n}catch(e){}d.querySelector('.theme-status').textContent=a()+' theme on'}})})(document,'theme');
