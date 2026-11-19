/* Cotizador de Florencia Blanco · Prevención Salud
   Lee config.json y planes.json, arma las tarjetas de planes y maneja el formulario.
   No guarda datos: al final arma un mensaje y abre WhatsApp. */
(function () {
  'use strict';

  var CONFIG = null;
  var PLANES = null;
  var form = document.getElementById('form');
  var step = 1;
  var TOTAL = 4;

  /* Medición (paso 10): por ahora no hace nada. */
  function track(evento) {
    try { if (window.goatcounter && window.goatcounter.count) window.goatcounter.count({ path: evento, event: true }); } catch (e) {}
  }

  /* ---------- Utilidades ---------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function val(name) {
    var el = form.elements[name];
    if (!el) return '';
    if (el.tagName === 'OUTPUT') return el.value;
    if (el.length && !el.tagName) { // RadioNodeList
      for (var i = 0; i < el.length; i++) if (el[i].checked) return el[i].value;
      return '';
    }
    return (el.value || '').trim();
  }
  function digits(s) { return String(s || '').replace(/\D/g, ''); }
  function money(n) { return '$' + Number(n).toLocaleString('es-AR'); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function waLink(texto) { return 'https://wa.me/' + CONFIG.whatsapp.numero + '?text=' + encodeURIComponent(texto); }
  function esObligatorio() { var t = val('trabajo'); return t === 'dependencia' || t === 'monotributo'; }
  var TRABAJO_TXT = { dependencia: 'Relación de dependencia', monotributo: 'Monotributo', ri: 'Responsable inscripto', particular: 'Sin aportes / particular' };

  /* ---------- Carga de datos ---------- */
  Promise.all([
    fetch('config.json').then(function (r) { return r.json(); }),
    fetch('planes.json').then(function (r) { return r.json(); })
  ]).then(function (res) {
    CONFIG = res[0];
    PLANES = res[1];
    iniciar();
  }).catch(function () {
    $('#planes').innerHTML = '<p class="muted">No se pudieron cargar los planes. Recargá la página.</p>';
  });

  function iniciar() {
    // Provincias y categorías
    var prov = form.elements.provincia;
    CONFIG.provincias.forEach(function (p) { prov.add(new Option(p, p)); });
    $all('[data-categorias]').forEach(function (sel) {
      CONFIG.monotributo_categorias.forEach(function (c) { sel.add(new Option('Categoría ' + c, c)); });
    });
    // Links de "hablar directo"
    $('#talkDirect').href = waLink(CONFIG.whatsapp.mensaje_hablar_directo);
    $('#talkDirect').addEventListener('click', function () { track('hablar-directo'); });

    renderPlanes();
    renderComparacion();
    renderPlanOptions();
    actualizarVisibles();
    irAPaso(1, false);
  }

  /* ---------- Planes ---------- */
  function visibles() { return PLANES.planes.filter(function (p) { return p.visible !== false; }); }

  function renderPlanes() {
    var html = visibles().map(function (p) {
      var dest = p.destacados.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('');
      var det = '';
      if (p.detalle && p.detalle.length) {
        det = '<details><summary>Ver coberturas</summary>' +
          p.detalle.map(function (d) { return '<div class="detail-row"><span>' + esc(d.tema) + '</span><span>' + esc(d.cobertura) + '</span></div>'; }).join('') +
          (p.link_oficial ? '<p class="fine"><a class="link" href="' + esc(p.link_oficial) + '" target="_blank" rel="noopener">Ver detalle completo en prevencionsalud.com.ar</a></p>' : '') +
          '</details>';
      }
      return '<article class="plan">' +
        '<div class="plan-head"><h3>' + esc(p.nombre) + '</h3>' + (p.etiqueta ? '<span class="tag">' + esc(p.etiqueta) + '</span>' : '') + '</div>' +
        '<p class="plan-sum">' + esc(p.resumen) + '</p>' +
        '<ul>' + dest + '</ul>' + det +
        '<div class="plan-actions"><a href="#cotizar" class="btn btn-primary btn-sm" data-cotizar-plan="' + esc(p.id) + '">Cotizar este plan</a></div>' +
        '</article>';
    }).join('');
    $('#planes').innerHTML = html;
  }

  function renderComparacion() {
    var c = PLANES.comparacion_a2_vs_a2cp;
    if (!c) return;
    var filas = c.filas.map(function (f) { return '<tr><td>' + esc(f.tema) + '</td><td>' + esc(f.A2) + '</td><td>' + esc(f.A2CP) + '</td></tr>'; }).join('');
    var box = $('#comparacion');
    box.innerHTML = '<h3>' + esc(c.titulo) + '</h3>' +
      '<table class="cmp"><thead><tr><th></th><th>A2</th><th>A2 CP</th></tr></thead><tbody>' + filas + '</tbody></table>' +
      (c.consejo ? '<p>' + esc(c.consejo) + '</p>' : '');
    box.hidden = false;
  }

  function renderPlanOptions() {
    var opts = visibles().map(function (p) {
      return '<label class="chip"><input type="checkbox" name="plan" value="' + esc(p.nombre) + '" data-id="' + esc(p.id) + '"><span>' + esc(p.nombre) + '</span></label>';
    });
    opts.push('<label class="chip"><input type="checkbox" name="plan" value="asesorame" data-id="asesorame"><span>No sé, asesorame</span></label>');
    $('#planOptions').innerHTML = opts.join('');
  }

  function planesElegidos() { return $all('input[name=plan]:checked').map(function (i) { return i.value; }); }

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.name !== 'plan') return;
    var max = CONFIG.limites.planes_max_a_elegir;
    var err = $('[data-error-for=planes]');
    err.textContent = '';
    if (t.checked && t.value === 'asesorame') {
      $all('input[name=plan]').forEach(function (i) { if (i !== t) i.checked = false; });
    } else if (t.checked) {
      var ase = $('input[name=plan][value=asesorame]'); if (ase) ase.checked = false;
      var elegidos = $all('input[name=plan]:checked');
      if (elegidos.length > max) { t.checked = false; err.textContent = 'Podés elegir hasta ' + max + ' planes.'; }
    }
  });

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-cotizar-plan]');
    if (!b) return;
    var id = b.getAttribute('data-cotizar-plan');
    var input = $('input[name=plan][data-id="' + id + '"]');
    if (input && !input.checked) {
      var ase = $('input[name=plan][value=asesorame]'); if (ase) ase.checked = false;
      var elegidos = $all('input[name=plan]:checked');
      if (elegidos.length >= CONFIG.limites.planes_max_a_elegir) elegidos[0].checked = false;
      input.checked = true;
    }
    $('[data-error-for=planes]').textContent = '';
    actualizarEnvio();
    track('cotizar-plan-' + id);
  });

  /* ---------- Mostrar / ocultar según respuestas ---------- */
  function actualizarVisibles() {
    $all('[data-show-when]').forEach(function (el) {
      var cond = el.getAttribute('data-show-when');
      var ok;
      if (cond.indexOf('>') > -1) { var p = cond.split('>'); ok = Number(val(p[0])) > Number(p[1]); }
      else { var q = cond.split('='); ok = val(q[0]) === q[1]; }
      el.hidden = !ok;
    });
    var oblig = esObligatorio();
    $all('[data-solo-obligatorio]').forEach(function (el) { el.hidden = !oblig; });
  }
  form.addEventListener('change', actualizarVisibles);
  form.addEventListener('input', function (e) {
    var t = e.target;
    if (t.name === 'sueldo' || t.name === 'parejaSueldo') {
      var d = digits(t.value).slice(0, 10);
      t.value = d ? Number(d).toLocaleString('es-AR') : '';
    }
    if (t.name === 'dni' || t.name === 'parejaDni') t.value = digits(t.value).slice(0, 8);
    var err = $('[data-error-for="' + t.name + '"]');
    if (err) { err.textContent = ''; t.classList.remove('invalid'); }
  });

  /* ---------- Contadores ---------- */
  $all('[data-counter]').forEach(function (box) {
    var name = box.getAttribute('data-counter');
    var out = box.querySelector('output');
    var max = name === 'hijos' ? 10 : 3;
    function pintar() {
      var n = Number(out.value);
      box.querySelector('[data-dec]').disabled = n <= 0;
      box.querySelector('[data-inc]').disabled = n >= max;
    }
    box.addEventListener('click', function (e) {
      if (CONFIG) max = name === 'hijos' ? CONFIG.limites.hijos_max : CONFIG.limites.familiares_a_cargo_max;
      var n = Number(out.value);
      if (e.target.closest('[data-inc]') && n < max) n++;
      if (e.target.closest('[data-dec]') && n > 0) n--;
      out.value = n;
      pintar();
      actualizarVisibles();
    });
    pintar();
  });

  /* ---------- Validación ---------- */
  function marcar(name, msg) {
    var err = $('[data-error-for="' + name + '"]');
    if (err) err.textContent = msg;
    var el = form.elements[name];
    if (el && el.classList) el.classList.add('invalid');
    return { name: name };
  }

  function validar(n) {
    var errores = [];
    var tope = CONFIG.sueldo_bruto_tope;
    if (n === 1) {
      if (val('nombre').length < 3) errores.push(marcar('nombre', 'Escribí tu nombre y apellido.'));
      var dni = digits(val('dni'));
      if (dni.length < 7 || dni.length > 8) errores.push(marcar('dni', 'Revisá el DNI: tiene que tener 7 u 8 números.'));
      if (!val('provincia')) errores.push(marcar('provincia', 'Elegí tu provincia.'));
      if (val('localidad').length < 2) errores.push(marcar('localidad', 'Escribí tu localidad.'));
      var mail = val('email');
      if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) errores.push(marcar('email', 'Revisá el email.'));
    }
    if (n === 2) {
      var t = val('trabajo');
      if (!t) errores.push(marcar('trabajo', 'Elegí una opción.'));
      if (t === 'dependencia') {
        var s = Number(digits(val('sueldo')));
        if (!s) errores.push(marcar('sueldo', 'Escribí tu sueldo bruto.'));
        else if (s > tope) errores.push(marcar('sueldo', 'El sueldo bruto que toma el sistema es hasta ' + money(tope) + '. Si cobrás más, poné ese monto.'));
      }
      if (t === 'monotributo' && !val('categoria')) errores.push(marcar('categoria', 'Elegí tu categoría.'));
    }
    if (n === 3 && val('pareja') === 'si') {
      if (val('parejaNombre').length < 3) errores.push(marcar('parejaNombre', 'Escribí el nombre y apellido de tu pareja.'));
      var pd = digits(val('parejaDni'));
      if (pd.length < 7 || pd.length > 8) errores.push(marcar('parejaDni', 'Revisá el DNI: tiene que tener 7 u 8 números.'));
      else if (pd === digits(val('dni'))) errores.push(marcar('parejaDni', 'Es el mismo DNI que el tuyo. Revisalo.'));
      if (esObligatorio() && val('parejaAportes') === 'si') {
        var pt = val('parejaTrabajo');
        if (!pt) errores.push(marcar('parejaTrabajo', 'Elegí cómo trabaja tu pareja.'));
        if (pt === 'dependencia') {
          var ps = Number(digits(val('parejaSueldo')));
          if (!ps) errores.push(marcar('parejaSueldo', 'Escribí el sueldo bruto de tu pareja.'));
          else if (ps > tope) errores.push(marcar('parejaSueldo', 'El sueldo bruto que toma el sistema es hasta ' + money(tope) + '. Si cobra más, poné ese monto.'));
        }
        if (pt === 'monotributo' && !val('parejaCategoria')) errores.push(marcar('parejaCategoria', 'Elegí la categoría de tu pareja.'));
      }
    }
    if (n === 4) {
      if (!planesElegidos().length) errores.push(marcar('planes', 'Elegí al menos un plan, o "No sé, asesorame".'));
      if (val('referido') === 'si' && val('refNombre').length < 3) errores.push(marcar('refNombre', 'Escribí el nombre de quien te recomendó.'));
    }
    if (errores.length) {
      var first = form.elements[errores[0].name];
      var target = first && first.focus ? first : (first && first[0]) || $('[data-error-for="' + errores[0].name + '"]');
      if (target && target.scrollIntoView) target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      if (target && target.focus) try { target.focus({ preventScroll: true }); } catch (e) {}
    }
    return !errores.length;
  }

  /* ---------- Datos y mensaje ---------- */
  function datos() {
    var oblig = esObligatorio();
    var d = {
      nombre: val('nombre'), dni: digits(val('dni')), provincia: val('provincia'), localidad: val('localidad'),
      email: val('email'), trabajo: val('trabajo'), sueldo: Number(digits(val('sueldo'))), categoria: val('categoria'),
      origen: oblig ? 'OBLIGATORIO' : 'VOLUNTARIO',
      pareja: val('pareja') === 'si', parejaNombre: val('parejaNombre'), parejaDni: digits(val('parejaDni')),
      parejaAportes: oblig && val('pareja') === 'si' && val('parejaAportes') === 'si',
      parejaTrabajo: val('parejaTrabajo'), parejaSueldo: Number(digits(val('parejaSueldo'))), parejaCategoria: val('parejaCategoria'),
      hijos: Number(val('hijos')), familiares: oblig ? Number(val('familiares')) : 0,
      planes: planesElegidos(), referido: val('referido') === 'si', refNombre: val('refNombre'), refCel: val('refCel')
    };
    return d;
  }
  function fmtDni(n) { return n ? Number(n).toLocaleString('es-AR') : ''; }
  function detalleTrabajo(tipo, sueldo, cat) {
    if (tipo === 'dependencia') return 'Sueldo bruto: ' + money(sueldo);
    if (tipo === 'monotributo') return 'Categoría monotributo: ' + cat;
    return '';
  }

  function mensaje(d) {
    var L = [];
    L.push('Hola Flor! Quiero cotizar mi plan 🙌', '');
    L.push('TITULAR');
    L.push('Nombre: ' + d.nombre);
    L.push('DNI: ' + fmtDni(d.dni));
    L.push('Localidad: ' + d.localidad + ', ' + d.provincia);
    L.push('Email: ' + (d.email || '—'));
    L.push('Trabajo: ' + TRABAJO_TXT[d.trabajo]);
    var dt = detalleTrabajo(d.trabajo, d.sueldo, d.categoria); if (dt) L.push(dt);
    L.push('➡ Origen: ' + d.origen, '');
    L.push('GRUPO FAMILIAR');
    L.push('Pareja: ' + (d.pareja ? d.parejaNombre + ' – DNI ' + fmtDni(d.parejaDni) : 'No'));
    if (d.pareja && d.origen === 'OBLIGATORIO') {
      L.push('Suma aportes: ' + (d.parejaAportes ? 'Sí – ' + TRABAJO_TXT[d.parejaTrabajo] + ' – ' + detalleTrabajo(d.parejaTrabajo, d.parejaSueldo, d.parejaCategoria) : 'No'));
    }
    L.push('Hijos: ' + d.hijos);
    if (d.origen === 'OBLIGATORIO') L.push('Familiar a cargo: ' + d.familiares);
    L.push('');
    L.push('PLAN DE INTERÉS: ' + (d.planes[0] === 'asesorame' ? 'No sabe, asesorar' : d.planes.join(' / ')));
    L.push('REFERIDO: ' + (d.referido ? 'Sí – ' + d.refNombre + (d.refCel ? ' (' + d.refCel + ')' : '') : 'No'));
    return L.join('\n');
  }

  function renderResumen() {
    var d = datos();
    function bloque(titulo, paso, lineas) {
      return '<div class="sum-block"><div class="sum-head"><span>' + titulo + '</span><button type="button" data-editar="' + paso + '">Editar</button></div>' +
        lineas.filter(Boolean).map(function (l) { return '<p class="sum-line">' + esc(l) + '</p>'; }).join('') + '</div>';
    }
    var pareja = d.pareja ? 'Pareja: ' + d.parejaNombre + ' (DNI ' + fmtDni(d.parejaDni) + ')' : 'Sin pareja';
    var aportes = d.pareja && d.origen === 'OBLIGATORIO' ? ('Suma aportes: ' + (d.parejaAportes ? TRABAJO_TXT[d.parejaTrabajo] + ' · ' + detalleTrabajo(d.parejaTrabajo, d.parejaSueldo, d.parejaCategoria) : 'No')) : '';
    $('#summary').innerHTML =
      bloque('Tus datos', 1, [d.nombre + ' · DNI ' + fmtDni(d.dni), d.localidad + ', ' + d.provincia, d.email]) +
      bloque('Tu trabajo', 2, [TRABAJO_TXT[d.trabajo], detalleTrabajo(d.trabajo, d.sueldo, d.categoria)]) +
      bloque('Grupo familiar', 3, [pareja, aportes, 'Hijos: ' + d.hijos, d.origen === 'OBLIGATORIO' ? 'Familiares a cargo: ' + d.familiares : '']);
  }

  function actualizarEnvio() {
    if (!CONFIG) return;
    var link = waLink(mensaje(datos()));
    $('#send').href = link;
    $('#sendAgain').href = link;
  }
  form.addEventListener('change', function () { if (step === 4) actualizarEnvio(); });
  form.addEventListener('input', function () { if (step === 4) actualizarEnvio(); });

  /* ---------- Navegación entre pasos ---------- */
  function irAPaso(n, scroll) {
    step = n;
    $all('.fstep').forEach(function (f) { f.hidden = Number(f.getAttribute('data-step')) !== n; });
    $all('.progress span').forEach(function (s, i) { s.classList.toggle('on', i < Math.min(n, TOTAL)); });
    var done = n > TOTAL;
    $('#stepCount').textContent = done ? '¡Listo!' : 'Paso ' + n + ' de ' + TOTAL;
    $('#nav').hidden = done;
    $('#nav').classList.toggle('last', n === TOTAL);
    $('#prev').style.visibility = n === 1 ? 'hidden' : 'visible';
    $('#next').hidden = n === TOTAL;
    $('#send').hidden = n !== TOTAL;
    $('#sendNote').hidden = n !== TOTAL;
    if (n === TOTAL) { renderResumen(); actualizarEnvio(); }
    if (scroll !== false) $('#cotizar').scrollIntoView({ behavior: 'smooth' });
    track('paso-' + (done ? 'listo' : n));
  }

  $('#next').addEventListener('click', function () { if (validar(step)) irAPaso(step + 1); });
  $('#prev').addEventListener('click', function () { if (step > 1) irAPaso(step - 1); });
  $('#summary').addEventListener('click', function (e) {
    var b = e.target.closest('[data-editar]');
    if (b) irAPaso(Number(b.getAttribute('data-editar')));
  });
  $('#send').addEventListener('click', function (e) {
    if (!validar(4)) { e.preventDefault(); return; }
    actualizarEnvio();
    track('envio-whatsapp');
    setTimeout(function () { irAPaso(TOTAL + 1); }, 400);
  });
  $('#restart').addEventListener('click', function () {
    form.reset();
    $all('output').forEach(function (o) { o.value = 0; });
    $all('[data-counter] [data-dec]').forEach(function (b) { b.disabled = true; });
    $all('[data-counter] [data-inc]').forEach(function (b) { b.disabled = false; });
    actualizarVisibles();
    irAPaso(1);
  });
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  $all('[data-ir-form]').forEach(function (a) { a.addEventListener('click', function () { track('click-cotizar-portada'); }); });
})();
