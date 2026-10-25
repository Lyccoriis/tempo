(function () {
  try {
    var boot = JSON.parse(localStorage.getItem('ui:boot') || '{}');
    var root = document.documentElement;
    if (boot.theme) root.setAttribute('data-theme', boot.theme);
    if (/^#[0-9a-f]{6}$/i.test(boot.accent || '')) {
      root.setAttribute('data-accent', 'custom');
      root.style.setProperty('--primary', boot.accent);
    } else if (boot.accent) root.setAttribute('data-accent', boot.accent);
    if (boot.density) root.setAttribute('data-density', boot.density);
    if (boot.radius) root.style.setProperty('--radius', boot.radius);
  } catch (err) {}
})();
