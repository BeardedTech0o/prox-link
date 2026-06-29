(function () {
  try {
    var t = localStorage.getItem('kb-theme') || 'light';
    var a = localStorage.getItem('kb-accent') || 'violet';
    var A = {
      sky: ['56 189 248', '125 211 252'],
      violet: ['139 92 246', '167 139 250'],
      emerald: ['16 185 129', '52 211 153'],
      orange: ['249 115 22', '251 146 60'],
      pink: ['236 72 153', '244 114 182'],
      indigo: ['99 102 241', '129 140 248'],
    };
    var p = A[a] || A.violet;
    if (t === 'dark') document.documentElement.classList.add('dark');
    document.documentElement.style.setProperty('--c-accent', p[0]);
    document.documentElement.style.setProperty('--c-accent-hover', p[1]);
  } catch (e) {}
})();
