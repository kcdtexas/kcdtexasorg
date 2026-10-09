/* Key dates: the NOW line follows today in Central time on the poster rail; on Event Day only its tag; none outside the window. */
(function(d){var b=d.querySelector('[data-pr]');if(!b)return;var P={};
new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).forEach(function(x){P[x.type]=x.value});
function t(s){return Date.parse(s+'T12:00:00Z')}
var day=P.year+'-'+P.month+'-'+P.day,s=b.dataset.start,e=b.dataset.end,p=(t(day)-t(s))/(t(e)-t(s))*100;
[].forEach.call(b.querySelectorAll('.pr-now'),function(n){
if(day<s||day>=e){n.remove();return}
var c=n.classList;n.setAttribute('x',p.toFixed(2)+'%');c.toggle('at-start',p<3);c.toggle('at-end',p>94);c.toggle('at-event',day==b.dataset.event)})
})(document);
