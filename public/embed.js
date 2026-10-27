/*
 * Mapa de Desastres · ajusta el alto de los widgets insertados con <iframe>.
 * Cada widget avisa su alto con postMessage; este script se lo pone al iframe correspondiente.
 */
(function () {
  if (window.__mapaDesastresEmbed) return;
  window.__mapaDesastresEmbed = true;
  // El origen del sitio sale de la dirección de este mismo script (sirve aunque cambie el dominio).
  var me = document.currentScript, ORIGIN = me && me.src ? new URL(me.src).origin : 'https://desastres-naturales-rho.vercel.app';
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.type !== 'mapa-desastres:height' || typeof d.height !== 'number') return;
    if (e.origin !== ORIGIN && e.origin !== location.origin) return;
    var frames = document.getElementsByTagName('iframe');
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow === e.source) frames[i].style.height = Math.min(4000, Math.max(120, Math.ceil(d.height))) + 'px';
    }
  });
})();
