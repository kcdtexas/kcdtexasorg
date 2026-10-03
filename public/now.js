/* Key dates: Now follows today in Central time, "As of" keeps the build day; no Now after the strip ends. */
(function(d){var b=d.querySelector('[data-tl-start]');if(!b)return;var D=new Date(),P={};
function f(o){o.timeZone='America/Chicago';o.year='numeric';return new Intl.DateTimeFormat('en-US',o)}
function t(s){return Date.parse(s+'T12:00:00Z')}
function A(e,k,v){e&&e.setAttribute(k,v)}
f({month:'2-digit',day:'2-digit'}).formatToParts(D).forEach(function(x){P[x.type]=x.value});
var day=P.year+'-'+P.month+'-'+P.day,s=b.dataset.tlStart,e=b.dataset.tlEnd,p=Math.min(100,Math.max(0,(t(day)-t(s))/(t(e)-t(s))*100)),x=p.toFixed(2)+'%',
r=b.querySelector('.tl-past'),n=b.querySelector('.tl-now'),l=b.querySelector('.tl-now-label');
A(r,'x2',x);
if(day<s||day>=e){n&&n.remove();l&&l.remove();return}
A(n,'x1',x);A(n,'x2',x);A(l,'x',x);A(l,'dx',p>6?-7:7);A(l,'text-anchor',p>6?'end':'start')
})(document);
