/* Applique le thème choisi avant le premier rendu (évite tout flash). */
(function () {
  'use strict';
  var t = 'clair';
  try {
    var raw = localStorage.getItem('nexus.theme');
    if (raw) t = JSON.parse(raw) || 'clair';
  } catch (e) { /* thème par défaut */ }
  document.documentElement.dataset.theme = t;
})();
