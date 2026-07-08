(function () {
  try {
    var t = localStorage.getItem('kb-theme') || 'dark';
    var a = localStorage.getItem('kb-accent') || 'lime';
    var A = {
      lime: ['215 255 62', '183 217 53'],
      yellow: ['249 249 0', '212 212 0'],
      blue: ['59 130 246', '50 111 209'],
      purple: ['139 92 246', '118 78 209'],
      orange: ['245 158 11', '208 134 9'],
      red: ['239 68 68', '203 58 58'],
      pink: ['236 72 153', '201 61 130'],
    };
    var p = A[a] || A.lime;
    if (t === 'dark') document.documentElement.classList.add('dark');
    document.documentElement.style.setProperty('--c-accent', p[0]);
    document.documentElement.style.setProperty('--c-accent-hover', p[1]);
  } catch (e) {}
})();
