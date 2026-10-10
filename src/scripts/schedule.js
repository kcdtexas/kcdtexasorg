/* The program pages: My Schedule (stars kept only in this browser), the Schedule's filters and the My Schedule
   calendar file, Event Day's now and next per room (Central time), and offline use (/sw.js). Same-origin, so the
   CSP stays strict. */
(function (d) {
  var KEY = 'kcd-texas-2027-my-schedule', mine = [];
  try { mine = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) {}
  if (!Array.isArray(mine)) mine = [];
  function save() { try { localStorage.setItem(KEY, JSON.stringify(mine)); } catch (e) {} }
  function all(q, r) { return [].slice.call((r || d).querySelectorAll(q)); }
  function has(id) { return mine.indexOf(id) >= 0; }
  var status = d.createElement('p');
  status.className = 'sr-only'; status.setAttribute('role', 'status'); d.body.appendChild(status);

  // The stars: "Add to My Schedule" and "Remove from My Schedule".
  function paint() {
    all('[data-star]').forEach(function (b) {
      var on = has(b.dataset.star), t = b.querySelector('.star-words, .sr-only');
      b.hidden = false; b.dataset.on = on;
      t.textContent = t.textContent.replace(/^(Add to|Remove from)/, on ? 'Remove from' : 'Add to');
    });
  }
  d.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-star]');
    if (!b) return;
    var id = b.dataset.star, i = mine.indexOf(id);
    if (i >= 0) mine.splice(i, 1); else mine.push(id);
    save(); paint(); apply();
    status.textContent = i >= 0 ? 'Removed from My Schedule' : 'Added to My Schedule';
  });

  // The filters: a Session shows when it matches every group that has a box ticked.
  var board = d.querySelector('[data-schedule]');
  function apply() {
    if (!board) return;
    var on = {}, n = 0, total = 0;
    all('[data-filter]', board).forEach(function (i) { if (i.checked) (on[i.dataset.filter] = on[i.dataset.filter] || []).push(i.value); });
    var any = on.format || on.room || on.eu || on.my;
    all('.sch-item', board).forEach(function (li) {
      var D = li.dataset, ok = (!on.format || on.format.indexOf(D.format) >= 0) && (!on.room || on.room.indexOf(D.room) >= 0) &&
        (!on.eu || D.eu === '1') && (!on.my || has(D.id));
      li.hidden = !ok; total++; if (ok) n++;
    });
    all('[data-break]', board).forEach(function (li) { li.hidden = !!any; });
    all('[data-slot]', board).forEach(function (s) { s.hidden = !s.querySelector('.sch-item:not([hidden]),[data-break]:not([hidden])'); });
    board.querySelector('[data-count]').textContent = any ? 'Showing ' + n + ' of ' + total + ' Sessions' : '';
    board.querySelector('[data-my-tools]').hidden = !on.my;
    board.querySelector('[data-my-empty]').hidden = mine.length > 0;
    board.querySelector('[data-my-ics]').hidden = !mine.length;
  }
  if (board) {
    board.querySelector('[data-filters]').hidden = false;
    if (matchMedia('(min-width: 900px)').matches) board.querySelector('[data-more]').open = true;
    if (location.hash === '#my') board.querySelector('[data-filter="my"]').checked = true;
    board.addEventListener('change', apply);
    board.querySelector('[data-my-ics]').addEventListener('click', download);
  }

  // My Schedule as a calendar file, made here in the browser (the build's files follow the same rules).
  function download() {
    var z = 'America/Chicago', s = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    function t(v) { return v.replace(/[-:]/g, '') + '00'; }
    function x(v) { return v.replace(/[\\;,]/g, '\\$&').replace(/\r?\n/g, '\\n'); }
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//KCD Texas//kcdtexas.org//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:My Schedule, KCD Texas 2027',
      'BEGIN:VTIMEZONE', 'TZID:' + z, 'BEGIN:DAYLIGHT', 'TZOFFSETFROM:-0600', 'TZOFFSETTO:-0500', 'TZNAME:CDT', 'DTSTART:20070311T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'END:DAYLIGHT',
      'BEGIN:STANDARD', 'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0600', 'TZNAME:CST', 'DTSTART:20071104T020000', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'END:STANDARD', 'END:VTIMEZONE'];
    all('.sch-item', board).forEach(function (li) {
      var D = li.dataset;
      if (!has(D.id) || !D.start) return;
      L.push('BEGIN:VEVENT', 'UID:' + D.id + '@kcdtexas.org', 'DTSTAMP:' + s, 'DTSTART;TZID=' + z + ':' + t(D.start), 'DTEND;TZID=' + z + ':' + t(D.end),
        'SUMMARY:' + x(li.querySelector('.sch-title').textContent.trim()), 'LOCATION:' + x(D.room + ', KCD Texas 2027'), 'URL:' + location.origin + D.url, 'END:VEVENT');
    });
    L.push('END:VCALENDAR');
    // Lines of at most 75 octets, as calendar files require.
    L = L.map(function (l) {
      var out = [], cur = '', n = 0;
      Array.from(l).forEach(function (c) {
        var b = new TextEncoder().encode(c).length;
        if (n + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; n = 0; }
        cur += c; n += b;
      });
      return out.concat(cur).join('\r\n ');
    });
    var a = d.createElement('a');
    a.href = URL.createObjectURL(new Blob([L.join('\r\n') + '\r\n'], { type: 'text/calendar' }));
    a.download = 'kcd-texas-2027-my-schedule.ics';
    d.body.appendChild(a); a.click(); a.remove();
  }

  // Event Day: now and next in each room, by the clock in Central time; the page reloads every 5 minutes.
  var day = d.querySelector('[data-today]');
  function now() {
    var P = {};
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date()).forEach(function (p) { P[p.type] = p.value; });
    return P.year + '-' + P.month + '-' + P.day + 'T' + P.hour + ':' + P.minute;
  }
  function tick() {
    var t = now();
    all('[data-room-block]', day).forEach(function (r) {
      var list = all('.td-ses', r), on = null, next = null;
      list.forEach(function (s) { if (!on && s.dataset.start <= t && t < s.dataset.end) on = s; });
      list.forEach(function (s) { if (!next && s !== on && s.dataset.start >= t) next = s; });
      list.forEach(function (s) {
        s.hidden = s !== on && s !== next; s.classList.toggle('is-now', s === on);
        s.querySelector('[data-label]').textContent = s === on ? day.dataset.now : day.dataset.next;
      });
      r.querySelector('[data-none-now]').hidden = !!on;
      r.querySelector('[data-none-next]').hidden = !!next;
    });
    all('[data-breaks] [data-start]', day).forEach(function (b) { b.hidden = !(b.dataset.start <= t && t < b.dataset.end); });
  }
  if (day) { tick(); setInterval(tick, 60000); setTimeout(function () { location.reload(); }, 300000); }

  // Offline use: /sw.js keeps a copy of the program and Event Day pages (scope /2027/), told what this page loaded.
  // The build sets OFFLINE, and from the day after Event Day nothing registers.
  var OFFLINE = true, sw = navigator.serviceWorker;
  if (OFFLINE && sw) {
    sw.register('/sw.js', { scope: '/2027/' }).then(function () { return sw.ready; }).then(function (r) {
      function send() { r.active.postMessage({ keep: [location.href.split('#')[0]].concat(performance.getEntriesByType('resource').map(function (x) { return x.name; })) }); }
      if (d.readyState === 'complete') send(); else addEventListener('load', send);
    }).catch(function () {});
  }

  paint(); apply();
})(document);
