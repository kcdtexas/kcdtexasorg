/* Key dates: NOW follows today (Central time); running phases fill up to it. On Event Day only its tag. */
(function(d){var b=d.querySelector('[data-pr]');if(!b)return;var D=b.dataset,P={};
new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).forEach(function(x){P[x.type]=x.value});
function t(s){return Date.parse(s+'T12:00:00Z')}
function p(s){return Math.min(100,Math.max(0,(t(s)-t(D.start))/(t(D.end)-t(D.start))*100))}
function a(q,f){[].forEach.call(b.querySelectorAll(q),f)}
var day=P.year+'-'+P.month+'-'+P.day,n=p(day),off=day<D.start||day>D.event;
a('.pr-now',function(m){if(off)return m.remove();var c=m.classList;m.setAttribute('x',n.toFixed(2)+'%');c.toggle('at-start',n<3);c.toggle('at-end',n>94);c.toggle('at-event',day==D.event)});
a('[data-from]',function(r){r.setAttribute('width',Math.max(0,Math.min(n,p(r.dataset.to))-p(r.dataset.from)).toFixed(2)+'%');r.classList.toggle('is-past',day>=r.dataset.to)})
})(document);
