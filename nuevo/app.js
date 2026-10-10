(() => {
  "use strict";

  /* ===================================================================
     0. Utilidades
     =================================================================== */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const norm = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const MXN = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
  const money = (cents) => MXN.format(cents / 100);
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SVGNS = "http://www.w3.org/2000/svg";

  /** Crea nodos DOM sin innerHTML (el texto que escribe la persona nunca se interpreta como HTML). */
  function h(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? "" : v);
    }
    for (const c of kids.flat(Infinity)) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(String(c)));
    return n;
  }
  function ico(id, cls = "ic") {
    const s = document.createElementNS(SVGNS, "svg"), u = document.createElementNS(SVGNS, "use");
    s.setAttribute("class", cls); s.setAttribute("aria-hidden", "true"); u.setAttribute("href", "#" + id); s.append(u); return s;
  }
  const live = (msg) => { const el = $("#live"); el.textContent = ""; setTimeout(() => (el.textContent = msg), 30); };
  function toast(msg, kind = "") {
    const good = kind === "ok", bad = kind === "bad";
    const t = h("div", { class: "toast " + kind, role: bad ? "alert" : "status", "aria-live": bad ? "assertive" : "polite" },
      ico(good ? "i-ok" : "i-alert"), h("span", {}, msg));
    $("#toasts").append(t);
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 350); }, 3400);
  }
  /** Resalta coincidencias (sin acentos, sin mayúsculas) con <mark>. */
  function highlight(text, q) {
    const f = document.createDocumentFragment(), terms = norm(q).split(/\s+/).filter((w) => w.length >= 2);
    if (!terms.length) { f.append(text); return f; }
    let n = "", map = [], offset = 0;
    for (const char of text) {
      const normalized = norm(char);
      for (let i = 0; i < normalized.length; i++) map.push([offset, offset + char.length]);
      n += normalized; offset += char.length;
    }
    const rs = [];
    for (const t of terms) for (let i = n.indexOf(t); i >= 0; i = n.indexOf(t, i + t.length)) {
      rs.push([map[i][0], map[i + t.length - 1][1]]);
    }
    rs.sort((a, b) => a[0] - b[0]);
    const m = []; for (const r of rs) { const l = m[m.length - 1]; if (l && r[0] <= l[1]) l[1] = Math.max(l[1], r[1]); else m.push([...r]); }
    let p = 0; for (const [a, b] of m) { if (a > p) f.append(text.slice(p, a)); f.append(h("mark", {}, text.slice(a, b))); p = b; }
    if (p < text.length) f.append(text.slice(p)); return f;
  }

  /* ===================================================================
     1. Almacenamiento local (siempre con try/catch)
     =================================================================== */
  const KEY = "dr.portal.v1";
  const fresh = () => ({ theme: null, checklist: {}, checkDate: "", shift: "dia", manual: {}, exam: { best: null, certified: false, at: null }, pos: { sales: 0, cents: 0 } });
  let S = fresh();
  try { const raw = JSON.parse(localStorage.getItem(KEY) || "{}"); S = { ...S, ...raw, exam: { ...S.exam, ...(raw.exam || {}) }, pos: { ...S.pos, ...(raw.pos || {}) } }; } catch { /* sin almacenamiento: funciona sin guardar */ }
  const subs = new Set();
  let saveTimer = 0;
  function save() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* ignorar */ } }, 120); subs.forEach((f) => f()); }
  const onChange = (f) => subs.add(f);

  /* ===================================================================
     2. Datos (contenido de ejemplo para práctica)
     =================================================================== */
  const MANUAL = [
    { id: "ac1", cat: "Atención al cliente", title: "Saludo y primer contacto", body: [
      ["p", "El primer contacto marca la compra. Saluda con una sonrisa y contacto visual en cuanto el cliente llegue a tu área."],
      ["ul", "Saluda primero: «Buen día, bienvenido a Tiendas Del Río».", "Pregunta si encontró lo que buscaba.", "Despídete agradeciendo la visita."]] },
    { id: "ac2", cat: "Atención al cliente", title: "Cuando un cliente tiene una queja", body: [
      ["p", "Una queja es una oportunidad de resolver. La prisa o la discusión la empeoran."],
      ["ol", "Escucha completo sin interrumpir y sin discutir.", "Repite con tus palabras lo que entendiste.", "Explica lo que sí puedes hacer dentro de tus facultades.", "Si el cliente pide algo que no puedes autorizar, llama a tu supervisor."]] },
    { id: "ac3", cat: "Atención al cliente", title: "Si no sabes la respuesta", body: [
      ["p", "No inventes precios, promociones ni políticas. Una respuesta equivocada cuesta más que una espera corta."],
      ["ul", "Di: «Permítame confirmarlo con mi supervisor».", "Pregunta y regresa con la respuesta correcta.", "Si el tema no está en este manual, canalízalo."]] },
    { id: "pe1", cat: "Rotación PEPS", title: "¿Qué es PEPS?", body: [
      ["p", "PEPS significa Primeras Entradas, Primeras Salidas: el producto que llegó primero es el primero que debe venderse."],
      ["ul", "Evita que el producto se venza en la bodega o el refrigerador.", "Reduce las mermas por caducidad.", "Aplica a alimentos, bebidas, hielo y desechables."]] },
    { id: "pe2", cat: "Rotación PEPS", title: "Cómo rotar producto en anaquel y refrigerador", body: [
      ["ol", "Revisa la fecha de caducidad o de entrada de lo que ya está acomodado.", "Saca lo más antiguo y ponlo al frente.", "Coloca el producto nuevo detrás.", "Deja las etiquetas y fechas visibles hacia el cliente."]] },
    { id: "pe3", cat: "Rotación PEPS", title: "Producto caducado o dañado (merma)", body: [
      ["p", "Un producto vencido, roto o en mal estado no se vende."],
      ["ol", "Retíralo del piso de venta de inmediato.", "Sepáralo en el área indicada por tu supervisor.", "Registra la merma con producto y cantidad.", "Avisa al supervisor; no lo deseches por tu cuenta."]] },
    { id: "li1", cat: "Limpieza", title: "Limpieza del piso de venta", body: [
      ["p", "Un piso limpio y seco evita accidentes y se nota."],
      ["ul", "Barre y trapea en las horas de menos clientes.", "Retira cajas y exhibidores que estorben el paso.", "Mantén los pasillos libres."]] },
    { id: "li2", cat: "Limpieza", title: "Área de hot dogs y café", body: [
      ["p", "Donde se preparan alimentos, la higiene va primero."],
      ["ol", "Lávate las manos con agua y jabón antes de empezar y después de tocar basura o dinero.", "Limpia y desinfecta superficies y utensilios al terminar.", "Cubre el pelo y mantén el uniforme limpio.", "Tira la basura en bolsas cerradas."]] },
    { id: "li3", cat: "Limpieza", title: "Derrames y piso mojado", body: [
      ["p", "Un derrame se atiende al momento."],
      ["ul", "Coloca la señal de piso mojado antes de limpiar.", "Recoge el líquido y seca bien la zona.", "Retira la señal solo cuando el piso esté seco."]] },
    { id: "pr1", cat: "Recepción de proveedores", title: "Antes de recibir mercancía", body: [
      ["p", "Nadie recibe mercancía sin que el supervisor lo sepa."],
      ["ul", "Avisa al supervisor que llegó el proveedor.", "Confirma quién autoriza la recepción.", "Despeja el área donde se va a descargar."]] },
    { id: "pr2", cat: "Recepción de proveedores", title: "Revisión de la mercancía", body: [
      ["ol", "Compara lo que llega con lo que indica el documento del proveedor.", "Cuenta cantidades.", "Revisa fechas de caducidad y el estado del empaque.", "Si algo no coincide o viene dañado, no lo aceptes y avisa al supervisor."]] },
    { id: "pr3", cat: "Recepción de proveedores", title: "Registro y acomodo", body: [
      ["p", "Lo recibido se registra y se acomoda con PEPS."],
      ["ul", "El supervisor valida el registro de la entrada.", "Acomoda lo nuevo detrás de lo que ya había.", "Mantén separada la merma recibida."]] },
  ];
  const CATS = ["Atención al cliente", "Rotación PEPS", "Limpieza", "Recepción de proveedores"];

  // Precios de ejemplo en centavos, antes de IVA. Todos múltiplos de $5 para que el total quede en múltiplos de $0.10.
  const PRODUCTS = [
    { id: "p1", nm: "Hot Dog Vikingo", cat: "Comida", em: "🌭", c: 4500 },
    { id: "p2", nm: "Café 355 ml", cat: "Bebidas", em: "☕", c: 2500 },
    { id: "p3", nm: "Refresco 600 ml", cat: "Bebidas", em: "🥤", c: 2000 },
    { id: "p4", nm: "Refresco 2 L", cat: "Bebidas", em: "🥤", c: 4000 },
    { id: "p5", nm: "Agua 600 ml", cat: "Bebidas", em: "💧", c: 1500 },
    { id: "p6", nm: "Hielo bolsa 2 kg", cat: "Hielo", em: "🧊", c: 3000 },
    { id: "p7", nm: "Hielo bolsa 5 kg", cat: "Hielo", em: "🧊", c: 6000 },
    { id: "p8", nm: "Botana individual", cat: "Comida", em: "🍿", c: 2000 },
  ];
  const PCATS = ["Comida", "Bebidas", "Hielo"];
  const IVA_RATE = 8; // por ciento (zona fronteriza)
  const DENOMS = [[50000, "$500", "bill"], [20000, "$200", "bill"], [10000, "$100", "bill"], [5000, "$50", "bill"], [2000, "$20", "bill"], [1000, "$10", "coin"], [500, "$5", "coin"], [200, "$2", "coin"], [100, "$1", "coin"], [50, "50 ¢", "coin"], [20, "20 ¢", "coin"], [10, "10 ¢", "coin"]];

  const TASKS = [
    { id: "d1", shift: "dia", t: "Revisar el fondo de caja con el supervisor", tag: "Caja" },
    { id: "d2", shift: "dia", t: "Barrer y trapear el piso de venta", tag: "Limpieza" },
    { id: "d3", shift: "dia", t: "Revisar fechas en refrigerador y anaquel (PEPS)", tag: "PEPS" },
    { id: "d4", shift: "dia", t: "Surtir hielo, vasos y tapas del área de café", tag: "Surtido" },
    { id: "d5", shift: "dia", t: "Recibir y revisar pedidos de proveedores", tag: "Proveedores" },
    { id: "d6", shift: "dia", t: "Registrar mermas del turno", tag: "Merma" },
    { id: "n1", shift: "noche", t: "Limpiar y desinfectar el área de hot dogs", tag: "Limpieza" },
    { id: "n2", shift: "noche", t: "Rotar producto con PEPS y frentear anaqueles", tag: "PEPS" },
    { id: "n3", shift: "noche", t: "Registrar y apartar la merma del día", tag: "Merma" },
    { id: "n4", shift: "noche", t: "Cierre de caja junto con el supervisor", tag: "Caja" },
    { id: "n5", shift: "noche", t: "Sacar la basura y limpiar los botes", tag: "Limpieza" },
    { id: "n6", shift: "noche", t: "Verificar que puertas y refrigeradores queden cerrados", tag: "Seguridad" },
  ];

  const QUESTIONS = [
    { q: "¿Cómo se aplica PEPS al acomodar producto nuevo?", o: ["Se pone al frente para que se vea mejor", "Se pone detrás de lo que ya estaba, para que salga primero lo más antiguo", "Se mezcla sin fijarse en las fechas", "Solo se vende lo más nuevo"], ok: 1, why: "PEPS: Primeras Entradas, Primeras Salidas. Lo nuevo va detrás y lo más antiguo al frente (Manual: Rotación PEPS)." },
    { q: "Un cliente se queja y pide algo que no puedes autorizar. ¿Qué haces?", o: ["Le dices que no se puede y sigues con otra tarea", "Haces la excepción por tu cuenta para evitar problemas", "Lo escuchas sin discutir, explicas lo que sí puedes hacer y llamas al supervisor", "Esperas a que se vaya"], ok: 2, why: "Se escucha, se explica lo que sí está en tus facultades y se llama al supervisor para lo demás (Manual: Atención al cliente)." },
    { q: "Llega un proveedor con mercancía. ¿Qué haces antes de acomodarla?", o: ["La acomodas de inmediato para no estorbar", "Firmas lo que traiga sin revisar", "Avisas al supervisor y revisas cantidades, fechas de caducidad y empaque", "La dejas en bodega sin registrarla"], ok: 2, why: "Se avisa al supervisor y se compara lo que llega con el documento: cantidades, caducidad y estado del empaque (Manual: Recepción de proveedores)." },
  ];

  const TIPS = [
    "Primeras entradas, primeras salidas: lo que llegó antes sale primero.",
    "Un cliente molesto también quiere ser escuchado. Escucha primero y resuelve después.",
    "Si no sabes algo, pregunta a tu supervisor. Inventar una respuesta sale más caro que esperar.",
    "Cuenta el cambio dos veces: cuando lo calculas y cuando lo entregas.",
    "Piso mojado, señal puesta. Siempre.",
    "Producto vencido, fuera del piso de venta y registrado como merma.",
  ];
  const HORARIOS = [["Matutino", "6:00 – 14:00"], ["Vespertino", "14:00 – 22:00"], ["Nocturno", "22:00 – 6:00"], ["Fines de semana", "Horario por definir"]];

  /* ===================================================================
     3. Tema, perfil y estado
     =================================================================== */
  const themeBtn = $("#themeBtn");
  function applyTheme(t) {
    document.documentElement.dataset.theme = t; themeBtn.setAttribute("aria-pressed", String(t === "dark"));
    themeBtn.setAttribute("aria-label", t === "dark" ? "Cambiar a modo día" : "Cambiar a modo noche");
    $('meta[name="theme-color"]').setAttribute("content", t === "dark" ? "#0F172A" : "#0B53CA");
  }
  applyTheme(document.documentElement.dataset.theme || "light");
  themeBtn.addEventListener("click", () => { const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; applyTheme(t); S.theme = t; save(); });

  const pBtn = $("#profileBtn"), pPop = $("#profilePop");
  function togglePop(open) { pPop.hidden = !open; pBtn.setAttribute("aria-expanded", String(open)); }
  pBtn.addEventListener("click", (e) => { e.stopPropagation(); togglePop(pPop.hidden); });
  document.addEventListener("click", (e) => { if (!pPop.hidden && !e.target.closest(".profile")) togglePop(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !pPop.hidden) { togglePop(false); pBtn.focus(); } });
  $("#wipeBtn").addEventListener("click", async () => {
    togglePop(false);
    if (await confirmDialog("Borrar mis datos", "Se borra tu checklist, tu examen y tu avance de este navegador.", "Borrar")) {
      const theme = S.theme; S = fresh(); S.theme = theme; try { localStorage.removeItem(KEY); } catch { /* ignorar */ }
      renderManual(); renderChecklist(); renderExam(); save(); toast("Datos borrados", "ok");
    }
  });

  /* ===================================================================
     4. Diálogos reutilizables
     =================================================================== */
  const modal = $("#modal");
  function confirmDialog(title, text, okLabel) {
    return new Promise((res) => {
      let done = false; const finish = (v) => { done = true; modal.close(); res(v); };
      modal.className = "";
      modal.replaceChildren(
        h("div", { class: "modal-head" }, h("h2", { id: "modalTitle" }, title)),
        h("div", { class: "modal-body" }, h("p", {}, text)),
        h("div", { class: "modal-foot" }, h("button", { class: "btn btn-ghost", type: "button", onclick: () => finish(false) }, "Cancelar"), h("button", { class: "btn btn-red", type: "button", onclick: () => finish(true) }, okLabel)));
      modal.addEventListener("close", () => { if (!done) res(false); }, { once: true });
      modal.showModal();
    });
  }
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.close(); });

  /* ===================================================================
     5. Pestañas (data-tab) con teclado, hash y animación
     =================================================================== */
  const TABS = ["dashboard", "manual", "pos", "checklist", "examen", "solicitud"];
  let currentTab = "dashboard";
  const styleguide = $("#styleguide");
  const tablist = $("#tablist"), indicator = $(".tab-indicator", tablist);
  let indicatorObserver = null, indicatorFrame = 0, indicatorScrollTimer = 0, fallbackCleanup = null, transitionToken = 0;
  function updateIndicator() {
    const tab = $("#tab-" + currentTab);
    if (!indicator || !tab || styleguide && !styleguide.hidden) return;
    const listRect = tablist.getBoundingClientRect(), tabRect = tab.getBoundingClientRect();
    indicator.style.setProperty("--indicator-x", `${tabRect.left - listRect.left + tablist.scrollLeft - tablist.clientLeft}px`);
    indicator.style.setProperty("--indicator-scale", String(tabRect.width));
    indicator.style.opacity = "1";
  }
  function scheduleIndicatorUpdate() {
    cancelAnimationFrame(indicatorFrame);
    indicatorFrame = requestAnimationFrame(updateIndicator);
  }
  function setupIndicator() {
    if (!indicator || !("ResizeObserver" in window)) return;
    indicatorObserver = new ResizeObserver(scheduleIndicatorUpdate);
    indicatorObserver.observe(tablist);
    $$(".tab", tablist).forEach((tab) => indicatorObserver.observe(tab));
  }
  setupIndicator();
  tablist.addEventListener("scroll", () => {
    tablist.classList.add("is-scrolling");
    scheduleIndicatorUpdate();
    clearTimeout(indicatorScrollTimer);
    indicatorScrollTimer = setTimeout(() => tablist.classList.remove("is-scrolling"), 120);
  }, { passive: true });
  window.addEventListener("resize", scheduleIndicatorUpdate);
  function clearFallback() {
    if (fallbackCleanup) fallbackCleanup();
    fallbackCleanup = null;
    $$(".panel.is-leaving, .panel.is-entering").forEach((panel) => {
      panel.classList.remove("is-leaving", "is-entering");
      panel.inert = false;
      if (panel.id !== "panel-" + currentTab) panel.hidden = true;
    });
  }
  function showStyleguide({ hash = true } = {}) {
    clearFallback();
    transitionToken++;
    TABS.forEach((t) => {
      $("#tab-" + t).setAttribute("aria-selected", "false");
      $("#tab-" + t).tabIndex = -1;
      $("#panel-" + t).hidden = true;
      $("#panel-" + t).inert = false;
    });
    styleguide.hidden = false;
    document.body.classList.add("styleguide-open");
    if (hash && location.hash !== "#/estilos") history.pushState(null, "", "#/estilos");
    if (indicator) indicator.style.opacity = "0";
    document.title = "Página de estilos · Portal del Ayudante · Tiendas Del Río";
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    styleguide.focus({ preventScroll: true });
  }
  function activate(id, { focus = false, scroll = true, hash = true } = {}) {
    if (!TABS.includes(id)) id = "dashboard";
    if (id === currentTab && styleguide.hidden) {
      if (focus) $("#tab-" + id).focus({ preventScroll: true });
      document.title = `${$("#tab-" + id).textContent.trim()} · Portal del Ayudante · Tiendas Del Río`;
      scheduleIndicatorUpdate();
      return;
    }
    const wasStyleguide = !styleguide.hidden;
    const focusWasInOutgoing = wasStyleguide ? styleguide.contains(document.activeElement) : $("#panel-" + currentTab).contains(document.activeElement);
    const oldId = currentTab, oldIndex = TABS.indexOf(oldId), newIndex = TABS.indexOf(id);
    const direction = newIndex >= oldIndex ? "forward" : "backward";
    document.documentElement.dataset.dir = direction;
    clearFallback();
    const token = ++transitionToken;
    currentTab = id;
    styleguide.hidden = true;
    document.body.classList.remove("styleguide-open");
    if (hash && location.hash !== "#" + id) history.pushState(null, "", "#" + id);
    const oldPanel = wasStyleguide ? null : $("#panel-" + oldId), nextPanel = $("#panel-" + id);
    const update = (keepOutgoing = false, inertOutgoing = true) => {
      TABS.forEach((t) => {
        const on = t === id, tab = $("#tab-" + t), panel = $("#panel-" + t);
        tab.setAttribute("aria-selected", String(on)); tab.tabIndex = on ? 0 : -1;
        panel.hidden = !on && !(keepOutgoing && panel === oldPanel);
        if (on) {
          panel.hidden = false;
          panel.inert = false;
          $$(".reveal", panel).forEach((el) => el.classList.remove("in"));
          requestAnimationFrame(() => observeReveal(panel));
        } else if (panel !== oldPanel || !inertOutgoing) panel.inert = false;
      });
      if (inertOutgoing && oldPanel && oldPanel !== nextPanel) oldPanel.inert = true;
    };
    let usedViewTransition = false;
    if (!reduceMotion && typeof document.startViewTransition === "function") {
      try {
        const viewTransition = document.startViewTransition(update);
        usedViewTransition = true;
        const releaseOutgoing = () => { oldPanel.inert = false; };
        if (oldPanel) viewTransition.finished.then(releaseOutgoing, releaseOutgoing);
      } catch (error) {
        console.warn("No se pudo iniciar la transición de vista; se usará el fallback.", error);
      }
    }
    if (!usedViewTransition) {
      update(!reduceMotion, !reduceMotion);
      if (!reduceMotion && oldPanel && oldPanel !== nextPanel) {
        oldPanel.hidden = false;
        oldPanel.classList.add("is-leaving");
        nextPanel.classList.add("is-entering");
        let timer = 0;
        const finish = () => {
          if (token !== transitionToken) return;
          clearTimeout(timer);
          oldPanel.removeEventListener("animationend", onEnd);
          nextPanel.removeEventListener("animationend", onEnd);
          oldPanel.classList.remove("is-leaving");
          nextPanel.classList.remove("is-entering");
          oldPanel.hidden = true;
          oldPanel.inert = false;
          fallbackCleanup = null;
        };
        const onEnd = (event) => {
          if (event.target === nextPanel && event.animationName.startsWith("panel-fallback-in-")) finish();
        };
        oldPanel.addEventListener("animationend", onEnd);
        nextPanel.addEventListener("animationend", onEnd);
        timer = setTimeout(finish, 400);
        fallbackCleanup = () => {
          clearTimeout(timer);
          oldPanel.removeEventListener("animationend", onEnd);
          nextPanel.removeEventListener("animationend", onEnd);
          oldPanel.hidden = true;
          oldPanel.inert = false;
          oldPanel.classList.remove("is-leaving");
          nextPanel.classList.remove("is-entering");
        };
      }
    }
    const tab = $("#tab-" + id);
    if (focus || focusWasInOutgoing) tab.focus({ preventScroll: true });
    tab.scrollIntoView({ inline: "center", block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
    scheduleIndicatorUpdate();
    if (scroll) window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    document.title = `${tab.textContent.trim()} · Portal del Ayudante · Tiendas Del Río`;
    live(`Sección: ${tab.textContent.trim()}`);
    if (id === "dashboard") renderDashboard();
  }
  tablist.addEventListener("click", (e) => { const t = e.target.closest("[data-tab]"); if (t) activate(t.dataset.tab, { focus: true }); });
  tablist.addEventListener("keydown", (e) => {
    const i = TABS.indexOf(currentTab); let n = -1;
    if (e.key === "ArrowRight") n = (i + 1) % TABS.length; else if (e.key === "ArrowLeft") n = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") n = 0; else if (e.key === "End") n = TABS.length - 1;
    if (n >= 0) { e.preventDefault(); activate(TABS[n], { focus: true, scroll: false }); }
  });
  document.addEventListener("click", (e) => { const l = e.target.closest("[data-tab-link]"); if (l) { e.preventDefault(); activate(l.dataset.tabLink); } });
  function syncRouteFromLocation() {
    const id = location.hash.slice(1);
    if (id === "/estilos") { if (styleguide.hidden) showStyleguide({ hash: false }); }
    else if (!id || TABS.includes(id)) {
      const target = TABS.includes(id) ? id : "dashboard";
      if (target !== currentTab || !styleguide.hidden) activate(target, { hash: false, focus: true });
    }
  }
  addEventListener("hashchange", syncRouteFromLocation);
  addEventListener("popstate", syncRouteFromLocation);

  /* Entrada al viewport */
  const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: .12, rootMargin: "0px 0px -5% 0px" }) : null;
  function observeReveal(root = document) { $$(".reveal:not(.in)", root).forEach((el) => (io && !reduceMotion ? io.observe(el) : el.classList.add("in"))); }

  /* ===================================================================
     6. Dashboard: progreso global, accesos rápidos y consejos
     =================================================================== */
  const dayTasks = TASKS.filter((t) => t.shift === "dia"), nightTasks = TASKS.filter((t) => t.shift === "noche");
  const pct = (list) => (list.length ? list.filter((t) => S.checklist[t.id]).length / list.length : 0);
  function progress() {
    const check = TASKS.filter((t) => S.checklist[t.id]).length / TASKS.length;
    const manual = MANUAL.filter((m) => S.manual[m.id]).length / MANUAL.length;
    const exam = S.exam.certified ? 1 : S.exam.best != null ? S.exam.best / QUESTIONS.length * .5 : 0;
    const pos = Math.min(S.pos.sales / 1, 1);
    const parts = [["Checklist", check], ["Manual", manual], ["Caja", pos], ["Examen", exam]];
    return { total: parts.reduce((a, p) => a + p[1], 0) / parts.length, parts, check, manual, exam, pos };
  }
  function renderDashboard() {
    const p = progress(), v = Math.round(p.total * 100);
    $("#levelName").textContent = S.exam.certified ? "Ayudante Certificado" : "Ayudante Novato";
    $("#globalPct").textContent = v + "%";
    const bar = $("#globalBar"); bar.setAttribute("aria-valuenow", String(v)); bar.firstChild.style.setProperty("--v", p.total);
    $("#globalParts").replaceChildren(...p.parts.map(([n, x]) => h("span", {}, n + ": ", h("b", {}, Math.round(x * 100) + "%"))));
    $("#popPct").textContent = v + "%"; $("#popBar").style.setProperty("--v", p.total);
    const cards = [
      ["manual", "i-book", "Manual interactivo", "Busca y repasa atención al cliente, PEPS, limpieza y proveedores.", `${MANUAL.filter((m) => S.manual[m.id]).length}/${MANUAL.length} temas`, p.manual],
      ["pos", "i-pos", "Simulador de caja", "Cobra con IVA 8% y entrega el cambio exacto.", S.pos.sales ? `${S.pos.sales} cobro(s)` : "Sin practicar", p.pos],
      ["checklist", "i-check", "Checklist de turno", "Tareas diurnas y nocturnas con avance guardado.", `${Math.round(p.check * 100)}% hecho`, p.check],
      ["examen", "i-cert", "Examen de certificación", "3 preguntas y la insignia Ayudante Certificado.", S.exam.certified ? "Certificado" : S.exam.best != null ? `Mejor: ${S.exam.best}/3` : "Pendiente", p.exam],
      ["solicitud", "i-form", "Solicitud de empleo", "Formulario con folio de demostración.", "Demostración", 0],
    ];
    $("#quick").replaceChildren(...cards.map(([id, ic, t, d, meta, val], i) => {
      const state = val >= 1 ? "Completo" : val > 0 ? "En curso" : "Pendiente";
      const b = h("button", { class: "q-card glass reveal in", type: "button", "data-tab-link": id, style: `--d:${i * 0.05}s` },
        h("span", { class: "ico", "aria-hidden": "true" }, ico(ic)), h("h3", {}, t), h("p", {}, d),
        h("span", { class: `quick-status ${val >= 1 ? "complete" : val > 0 ? "progress" : "pending"}` }, state),
        h("div", { class: "bar", "aria-hidden": "true" }, h("i", { style: `--v:${val}` })),
        h("div", { class: "meta" }, h("span", {}, meta), h("span", {}, "Abrir")));
      return b;
    }));
  }
  let tipI = 0, tipTimer = 0;
  function nextTip() { const el = $("#tipText"); const n = el.cloneNode(false); n.textContent = TIPS[tipI++ % TIPS.length]; el.replaceWith(n); n.id = "tipText"; }
  function startTips() { nextTip(); clearInterval(tipTimer); if (!reduceMotion) tipTimer = setInterval(() => { if (!document.hidden && currentTab === "dashboard") nextTip(); }, 7000); }

  /* Para usar el arte oficial autorizado, escribe aquí su ruta (por ejemplo "img/guacamayo.png"). */
  const MASCOT_SRC = "";
  if (MASCOT_SRC) {
    $("#mascotSlot img").src = MASCOT_SRC;
    const headerMascot = h("img", { src: MASCOT_SRC, alt: "", "aria-hidden": "true" });
    $(".mascot-avatar-badge").replaceChildren(headerMascot);
  }

  /* ===================================================================
     7. Manual interactivo: acordeón con búsqueda en tiempo real
     =================================================================== */
  let mCat = "Todos", mQuery = "";
  const openSet = new Set();
  function bodyNodes(item, q) {
    return item.body.map(([type, ...rest]) => {
      if (type === "p") return h("p", {}, highlight(rest[0], q));
      return h(type, {}, rest.map((li) => h("li", {}, highlight(li, q))));
    });
  }
  const itemText = (m) => [m.title, m.cat, ...m.body.flatMap(([, ...r]) => r)].join(" ");
  function renderManual() {
    const terms = norm(mQuery).split(/\s+/).filter(Boolean);
    const list = MANUAL.filter((m) => (mCat === "Todos" || m.cat === mCat) && terms.every((t) => norm(itemText(m)).includes(t)));
    const acc = $("#acc"); acc.replaceChildren();
    list.forEach((m) => {
      const open = openSet.has(m.id) || (terms.length > 0 && list.length <= 4);
      const btn = h("button", { class: "acc-btn", type: "button", id: "ab-" + m.id, "aria-expanded": String(open), "aria-controls": "ap-" + m.id },
        h("span", { class: "tag " + (m.cat === "Rotación PEPS" ? "blue" : "") }, highlight(m.cat, mQuery)), h("span", { class: "ttl" }, highlight(m.title, mQuery)),
        S.manual[m.id] ? h("span", { class: "seen", title: "Leído" }, ico("i-ok")) : null, ico("i-chev", "ic chev"));
      const panel = h("div", { class: "acc-panel", id: "ap-" + m.id, role: "region", "aria-labelledby": "ab-" + m.id }, h("div", { class: "acc-inner" }, h("div", { class: "acc-body" }, bodyNodes(m, mQuery))));
      if (!open) panel.setAttribute("inert", "");
      const item = h("article", { class: "acc-item glass" + (open ? " open" : "") }, btn, panel);
      btn.addEventListener("click", () => toggleItem(m.id, item, btn, panel));
      acc.append(item);
      if (open && !S.manual[m.id]) markRead(m.id);
    });
    $("#manualCount").textContent = list.length ? `${list.length} ${list.length === 1 ? "resultado" : "resultados"} de ${MANUAL.length} temas` + (mQuery ? ` para «${mQuery}»` : "") : `0 resultados de ${MANUAL.length} temas`;
    if (!list.length) acc.append(h("div", { class: "empty glass card" }, ico("i-search"), h("strong", {}, "No encontré eso en el manual"), h("p", {}, "Prueba con otra palabra. Si es una duda de trabajo y no está aquí, pregúntale a tu supervisor.")));
    live(list.length ? `${list.length} temas` : "Sin resultados");
  }
  function markRead(id) { if (!S.manual[id]) { S.manual[id] = true; save(); } }
  function toggleItem(id, item, btn, panel) {
    const open = !item.classList.contains("open");
    item.classList.toggle("open", open); btn.setAttribute("aria-expanded", String(open));
    if (open) { panel.removeAttribute("inert"); openSet.add(id); if (!S.manual[id]) { markRead(id); if (!btn.querySelector(".seen")) btn.insertBefore(h("span", { class: "seen", title: "Leído" }, ico("i-ok")), btn.lastChild); } }
    else { panel.setAttribute("inert", ""); openSet.delete(id); }
  }
  function buildManualControls() {
    const cats = $("#cats");
    cats.replaceChildren(...["Todos", ...CATS].map((c) => h("button", { class: "chip", type: "button", "aria-pressed": String(c === mCat), onclick: (e) => { mCat = c; $$(".chip", cats).forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget))); renderManual(); } }, c)));
    let t = 0; $("#manualQ").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => { mQuery = e.target.value.trim(); renderManual(); }, 120); });
    $("#manualQ").addEventListener("keydown", (e) => { if (e.key === "Escape" && e.target.value) { e.target.value = ""; mQuery = ""; renderManual(); } });
    $("#expandAll").addEventListener("click", () => { MANUAL.forEach((m) => openSet.add(m.id)); renderManual(); });
    $("#collapseAll").addEventListener("click", () => { openSet.clear(); renderManual(); });
  }

  /* ===================================================================
     8. Simulador POS (aritmética en centavos enteros)
     =================================================================== */
  const cart = new Map();
  let pCat = "Todos", pQuery = "", lastChange = null;
  const subtotal = () => { let s = 0; cart.forEach((q, id) => (s += PRODUCTS.find((p) => p.id === id).c * q)); return s; };
  const ivaOf = (sub) => Math.round((sub * IVA_RATE) / 100);
  /** "123.45" -> 12345. Devuelve null si el formato no es válido. */
  function parseCents(txt) {
    const t = String(txt).trim().replace(/^\$/, "").replace(/,/g, "");
    if (!/^\d{1,6}(\.\d{0,2})?$/.test(t)) return null;
    const [a, b = ""] = t.split("."); return parseInt(a, 10) * 100 + parseInt((b + "00").slice(0, 2), 10);
  }
  /** Desglose voraz de cambio por denominaciones (en centavos). */
  function breakdown(cents) {
    const out = []; let rest = cents;
    for (const [v, label, kind] of DENOMS) { const n = Math.floor(rest / v); if (n > 0) { out.push({ label, kind, n }); rest -= n * v; } }
    return { out, rest };
  }
  function renderProducts() {
    const q = norm(pQuery), list = PRODUCTS.filter((p) => (pCat === "Todos" || p.cat === pCat) && (!q || norm(p.nm + " " + p.cat).includes(q)));
    $("#products").replaceChildren(...list.map((p) => h("button", { class: "prod", type: "button", onclick: () => addToCart(p.id), "aria-label": `Agregar ${p.nm}, ${money(p.c)} más IVA` },
      h("span", { class: "em", "aria-hidden": "true" }, p.em), h("span", { class: "nm" }, highlight(p.nm, pQuery)), h("span", { class: "cat" }, p.cat), h("span", { class: "pr" }, money(p.c)))));
    $("#prodCount").textContent = list.length ? `${list.length} producto(s)` : "Sin productos que coincidan.";
  }
  function addToCart(id, d = 1) {
    const cur = cart.get(id) || 0, n = Math.max(0, Math.min(99, cur + d));
    if (n === 0) cart.delete(id); else cart.set(id, n);
    if (d > 0) live(`Agregado: ${PRODUCTS.find((p) => p.id === id).nm}. Cantidad ${n}`);
    lastChange = null; renderCart();
  }
  function renderCart() {
    const lines = $("#lines");
    if (!cart.size) lines.replaceChildren(h("p", { class: "faint", style: "text-align:center;padding:1rem 0" }, "Toca un producto para agregarlo."));
    else lines.replaceChildren(...[...cart].map(([id, q]) => {
      const p = PRODUCTS.find((x) => x.id === id);
      return h("div", { class: "line" }, h("span", { class: "nm" }, `${p.em} ${p.nm}`), h("span", { class: "lt" }, money(p.c * q)),
        h("div", { class: "qty", role: "group", "aria-label": `Cantidad de ${p.nm}` },
          h("button", { type: "button", "aria-label": `Quitar una unidad de ${p.nm}`, onclick: () => addToCart(id, -1) }, ico("i-minus")),
          h("output", { "aria-label": "Cantidad" }, String(q)),
          h("button", { type: "button", "aria-label": `Agregar una unidad de ${p.nm}`, onclick: () => addToCart(id, 1) }, ico("i-plus")),
          h("button", { type: "button", class: "del", "aria-label": `Quitar ${p.nm} del ticket`, onclick: () => { cart.delete(id); lastChange = null; renderCart(); } }, ico("i-trash"))),
        h("span", { class: "faint", style: "text-align:right" }, `${money(p.c)} c/u`));
    }));
    const sub = subtotal(), iva = ivaOf(sub), total = sub + iva;
    $("#tSub").textContent = money(sub); $("#tIva").textContent = money(iva); $("#tTotal").textContent = money(total);
    renderQuickCash(total); cashPreview();
    if (!lastChange) $("#change").hidden = true;
  }
  function renderQuickCash(total) {
    const exact = total > 0 ? [h("button", { class: "chip", type: "button", onclick: () => { $("#cash").value = (total / 100).toFixed(2); cashPreview(); } }, "Exacto")] : [];
    const bills = [50, 100, 200, 500].map((b) => h("button", { class: "chip", type: "button", onclick: () => { $("#cash").value = b.toFixed(2); cashPreview(); } }, "$" + b));
    $("#quickCash").replaceChildren(...exact, ...bills);
  }
  function cashPreview() {
    const st = $("#cashState"), v = $("#cash").value, total = subtotal() + ivaOf(subtotal());
    st.className = "cash-state"; $("#cash").removeAttribute("aria-invalid");
    if (!v.trim()) { st.textContent = total ? "Escribe cuánto entregó el cliente." : ""; return; }
    const c = parseCents(v);
    if (c == null) { st.textContent = "Escribe un monto válido, por ejemplo 100 o 100.50."; st.classList.add("bad"); $("#cash").setAttribute("aria-invalid", "true"); return; }
    if (!total) { st.textContent = "Agrega productos primero."; return; }
    if (c < total) { st.textContent = `Faltan ${money(total - c)}.`; st.classList.add("bad"); return; }
    st.textContent = `Cambio: ${money(c - total)}`; st.classList.add("ok");
  }
  function charge() {
    const sub = subtotal(), total = sub + ivaOf(sub);
    if (!total) { toast("Agrega al menos un producto.", "bad"); return; }
    const c = parseCents($("#cash").value);
    if (c == null) { cashPreview(); $("#cash").focus(); toast("Escribe el efectivo recibido.", "bad"); return; }
    if (c < total) { cashPreview(); $("#cash").focus(); toast(`Faltan ${money(total - c)} para cubrir el total.`, "bad"); return; }
    const change = c - total, bd = breakdown(change);
    lastChange = { total, cash: c, change };
    S.pos.sales++; S.pos.cents += total; save();
    const box = $("#change"); box.hidden = false;
    box.replaceChildren(...[h("h4", {}, "Cobro registrado (simulación)"),
      h("p", {}, `Total ${money(total)} · Recibido ${money(c)} · `, h("strong", {}, `Cambio ${money(change)}`)),
      change === 0 ? h("p", {}, "Pago exacto: no hay cambio que entregar.") : h("div", { class: "denoms", role: "list", "aria-label": "Desglose del cambio" }, bd.out.map((d) => h("div", { class: "denom " + d.kind, role: "listitem" }, `${d.n} × `, h("b", {}, d.label), h("small", {}, d.kind === "bill" ? "billete" : "moneda")))),
      bd.rest ? h("p", { class: "faint" }, `Residuo menor a $0.10: ${money(bd.rest)}`) : null,
      h("button", { class: "btn btn-blue btn-sm", type: "button", style: "margin-top:.8rem", onclick: newSale }, "Nueva venta")].filter(Boolean));
    live(`Cobro registrado. Cambio ${money(change)}`); toast(`Cobro simulado. Cambio ${money(change)}`, "ok");
  }
  function newSale() { cart.clear(); lastChange = null; $("#cash").value = ""; renderCart(); $("#change").hidden = true; }
  function buildPOS() {
    const pc = $("#prodCats");
    pc.replaceChildren(...["Todos", ...PCATS].map((c) => h("button", { class: "chip", type: "button", "aria-pressed": String(c === pCat), onclick: (e) => { pCat = c; $$(".chip", pc).forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget))); renderProducts(); } }, c)));
    let t = 0; $("#prodQ").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => { pQuery = e.target.value.trim(); renderProducts(); }, 100); });
    $("#cash").addEventListener("input", cashPreview);
    $("#cash").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); charge(); } });
    $("#charge").addEventListener("click", charge);
    $("#clearCart").addEventListener("click", () => { cart.clear(); lastChange = null; $("#cash").value = ""; renderCart(); });
    renderProducts(); renderCart();
  }

  /* ===================================================================
     9. Checklist con localStorage
     =================================================================== */
  function todayKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
  if (S.checkDate && S.checkDate !== todayKey()) { S.checklist = {}; S.checkDate = todayKey(); setTimeout(() => toast("Nuevo día: tu checklist se reinició.", ""), 800); }
  if (!S.checkDate) S.checkDate = todayKey();
  function renderChecklist() {
    const shift = S.shift === "noche" ? "noche" : "dia", list = TASKS.filter((t) => t.shift === shift);
    $$("#shiftSwitch button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.shift === shift)));
    $("#tasks").replaceChildren(...list.map((t) => {
      const cb = h("input", { type: "checkbox", id: "t-" + t.id }); cb.checked = !!S.checklist[t.id];
      const row = h("label", { class: "task" + (cb.checked ? " done" : ""), for: "t-" + t.id }, cb, h("span", { class: "box" }, ico("i-ok")), h("span", { class: "txt" }, t.t), h("span", { class: "tag" }, t.tag));
      cb.addEventListener("change", () => {
        if (cb.checked) S.checklist[t.id] = true; else delete S.checklist[t.id];
        S.checkDate = todayKey(); row.classList.toggle("done", cb.checked); save(); paintChecklistStats();
        if (cb.checked && pct(list) === 1) { toast(shift === "dia" ? "¡Turno diurno completo!" : "¡Turno nocturno completo!", "ok"); }
      });
      return row;
    }));
    paintChecklistStats();
  }
  function paintChecklistStats() {
    const shift = S.shift === "noche" ? "noche" : "dia", cur = pct(TASKS.filter((t) => t.shift === shift)), d = pct(dayTasks), n = pct(nightTasks);
    $("#shiftPct").textContent = Math.round(cur * 100) + "%";
    const sb = $("#shiftBar"); sb.setAttribute("aria-valuenow", String(Math.round(cur * 100))); sb.style.setProperty("--progress", `${Math.round(cur * 100)}%`);
    $("#dayPct").textContent = Math.round(d * 100) + "%"; $("#dayBar").style.setProperty("--v", d);
    $("#nightPct").textContent = Math.round(n * 100) + "%"; $("#nightBar").style.setProperty("--v", n);
  }
  function buildChecklist() {
    $("#shiftSwitch").addEventListener("click", (e) => { const b = e.target.closest("[data-shift]"); if (!b) return; S.shift = b.dataset.shift; save(); renderChecklist(); });
    $("#resetChecklist").addEventListener("click", async () => { if (await confirmDialog("Reiniciar lista", "Se desmarcan todas las tareas de ambos turnos.", "Reiniciar")) { S.checklist = {}; S.checkDate = todayKey(); save(); renderChecklist(); toast("Lista reiniciada"); } });
    renderChecklist();
  }

  /* ===================================================================
     10. Examen de certificación
     =================================================================== */
  function badgeSvg() {
    const s = document.createElementNS(SVGNS, "svg"), u = document.createElementNS(SVGNS, "use");
    s.setAttribute("viewBox", "0 0 64 64"); s.setAttribute("aria-hidden", "true"); u.setAttribute("href", "#badge"); s.append(u); return s;
  }
  function sealNode(on) {
    const d = h("div", { class: "seal " + (on ? "on" : "off"), role: "img", "aria-label": on ? "Insignia Ayudante Certificado" : "Insignia bloqueada" });
    d.append(badgeSvg(), h("span", {}, "Ayudante", h("br"), "Certificado")); return d;
  }
  let examQuestion = 0, examSubmitted = false;
  function updateExamStep() {
    const form = $("#exam"), steps = $$(".q", form);
    steps.forEach((step, i) => { step.hidden = i !== examQuestion; });
    $$(".exam-step", form).forEach((step, i) => {
      step.classList.toggle("current", i === examQuestion);
      step.classList.toggle("answered", !!form.querySelector(`input[name="q${i}"]:checked`));
      if (i === examQuestion) step.setAttribute("aria-current", "step");
      else step.removeAttribute("aria-current");
    });
    $("#examStep").textContent = `Pregunta ${examQuestion + 1} de ${QUESTIONS.length}`;
    $("#examProgress").setAttribute("aria-valuenow", String(Math.round(((examQuestion + 1) / QUESTIONS.length) * 100)));
    $("#examProgress").style.setProperty("--v", (examQuestion + 1) / QUESTIONS.length);
    $("#examPrevious").disabled = examQuestion === 0;
    $("#examNext").hidden = examQuestion === QUESTIONS.length - 1;
    $("#gradeBtn").hidden = examQuestion !== QUESTIONS.length - 1 || examSubmitted;
  }
  function renderExam() {
    const form = $("#exam"); form.replaceChildren();
    examQuestion = 0; examSubmitted = false;
    form.append(
      h("p", { class: "exam-step-count", id: "examStep", "aria-live": "polite" }),
      h("div", { class: "exam-progress bar", id: "examProgress", role: "progressbar", "aria-label": "Avance del examen", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": "0" }, h("i")),
      h("ol", { class: "exam-steps", "aria-label": "Pasos del examen" },
        QUESTIONS.map((_, i) => h("li", { class: "exam-step" }, `Pregunta ${i + 1}`))));
    QUESTIONS.forEach((q, i) => {
      form.append(h("fieldset", { class: "q glass", "data-q": i },
        h("legend", {}, h("span", { class: "qt" }, h("span", { class: "qn" }, String(i + 1)), q.q)),
        q.o.map((t, k) => h("label", { class: "opt" }, h("input", { type: "radio", name: "q" + i, value: k, required: true }), h("span", { class: "dot" }), h("span", {}, t))),
        h("div", { class: "why", hidden: true })));
    });
    form.append(
      h("p", { class: "exam-msg", id: "examMsg", role: "alert" }),
      h("div", { class: "exam-controls" },
        h("button", { class: "btn btn-ghost", type: "button", id: "examPrevious", onclick: () => { if (examQuestion > 0) { examQuestion--; updateExamStep(); } } }, "Anterior"),
        h("button", { class: "btn btn-blue", type: "button", id: "examNext", onclick: () => {
          const answer = form.querySelector(`input[name="q${examQuestion}"]:checked`);
          if (!answer) { $("#examMsg").textContent = "Elige una respuesta para continuar."; form.querySelector(`input[name="q${examQuestion}"]`).focus(); return; }
          $("#examMsg").textContent = ""; examQuestion++; updateExamStep();
        } }, "Siguiente"),
        h("button", { class: "btn btn-red", type: "submit", id: "gradeBtn" }, "Calificar examen"),
        S.exam.best != null ? h("span", { class: "faint exam-best" }, `Tu mejor resultado: ${S.exam.best} de ${QUESTIONS.length}`) : null),
      h("div", { id: "examResult" }));
    updateExamStep();
    if (S.exam.certified) $("#examResult").replaceChildren(h("div", { class: "result glass stitch" }, sealNode(true), h("div", {}, h("p", { class: "faint" }, "Ya estás certificado"), h("p", { class: "score" }, `${S.exam.best} / ${QUESTIONS.length}`), h("p", { class: "muted" }, "Puedes repetir el examen cuando quieras."))));
  }
  function gradeExam(e) {
    e.preventDefault();
    if (examSubmitted) return;
    const form = $("#exam"), msg = $("#examMsg"); msg.textContent = "";
    if (examQuestion < QUESTIONS.length - 1 && !examSubmitted) {
      if (!form.querySelector(`input[name="q${examQuestion}"]:checked`)) {
        msg.textContent = "Elige una respuesta para continuar.";
        form.querySelector(`input[name="q${examQuestion}"]`).focus();
        return;
      }
      examQuestion++; updateExamStep(); return;
    }
    const answers = QUESTIONS.map((_, i) => { const c = form.querySelector(`input[name="q${i}"]:checked`); return c ? Number(c.value) : null; });
    const miss = answers.findIndex((a) => a == null);
    if (miss >= 0) { examQuestion = miss; updateExamStep(); msg.textContent = `Falta responder la pregunta ${miss + 1}.`; form.querySelector(`input[name="q${miss}"]`).focus(); return; }
    let score = 0;
    QUESTIONS.forEach((q, i) => {
      const fs = form.querySelector(`[data-q="${i}"]`), opts = $$(".opt", fs);
      opts.forEach((o, k) => { o.classList.remove("right", "wrong"); const inp = $("input", o); inp.disabled = true; if (k === q.ok) o.classList.add("right"); else if (k === answers[i]) o.classList.add("wrong"); });
      if (answers[i] === q.ok) score++;
      const why = $(".why", fs); why.hidden = false; why.textContent = (answers[i] === q.ok ? "Correcto. " : "Respuesta correcta marcada en verde. ") + q.why;
    });
    const pass = score >= 2, grade = Math.round((score / QUESTIONS.length) * 100);
    S.exam.best = Math.max(S.exam.best ?? 0, score); S.exam.certified = S.exam.certified || pass; S.exam.at = Date.now(); save();
    examSubmitted = true; updateExamStep();
    $("#examResult").replaceChildren(h("div", { class: "result glass stitch" }, sealNode(pass),
      h("div", { class: "stack" }, h("p", { class: "faint" }, "Tu calificación"), h("p", { class: "score" }, `${score} / ${QUESTIONS.length} · ${grade}%`),
        h("p", { class: "muted" }, pass ? "¡Aprobaste! Obtuviste la insignia «Ayudante Certificado»." : "Todavía no alcanzas la insignia. Repasa el manual y vuelve a intentarlo."),
        h("div", { style: "display:flex;gap:.6rem;flex-wrap:wrap;margin-top:.6rem" }, h("button", { class: "btn btn-blue btn-sm", type: "button", onclick: () => { renderExam(); window.scrollTo({ top: 0 }); } }, ico("i-reset"), "Repetir examen"), h("button", { class: "btn btn-ghost btn-sm", type: "button", "data-tab-link": "manual" }, ico("i-book"), "Repasar el manual")))));
    live(`Calificación ${score} de ${QUESTIONS.length}. ${pass ? "Aprobado" : "No aprobado"}`);
    if (pass) toast("¡Ayudante Certificado!", "ok");
    $("#examResult").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  }
  $("#exam").addEventListener("submit", gradeExam);

  /* ===================================================================
     11. Solicitud de empleo: validación interactiva, folio y modal
     =================================================================== */
  const form = $("#jobForm");
  const hints = { nombre: "Nombre y apellido.", tel: "Solo números.", correo: "Ejemplo: nombre@correo.com", sucursal: "Elige la más cercana a tu casa.", exp: "Si no tienes, también puedes aplicar.", horario: "Elige un horario.", msg: "0 de 280 caracteres.", aviso: "" };
  const rules = {
    nombre: (v) => { if (!v.trim()) return ["bad", "Escribe tu nombre completo."]; const w = v.trim().split(/\s+/).filter((x) => x.length >= 2); return !/^[\p{L}][\p{L}\s.'-]{2,59}$/u.test(v.trim()) ? ["bad", "Usa solo letras."] : w.length < 2 ? ["bad", "Escribe nombre y apellido."] : ["ok", "Listo."]; },
    tel: (v) => { const d = v.replace(/[\s\-()]/g, ""); return /^\d{10}$/.test(d) ? ["ok", "Listo."] : /\D/.test(d) ? ["bad", "Solo números, sin letras."] : ["bad", `Faltan ${Math.max(0, 10 - d.length)} dígitos (deben ser 10).`]; },
    correo: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? ["ok", "Listo."] : ["bad", "Escribe un correo completo, como nombre@correo.com."]),
    sucursal: (v) => (v ? ["ok", "Listo."] : ["bad", "Elige una sucursal."]),
    exp: (v) => (v ? ["ok", "Listo."] : ["bad", "Elige una opción."]),
    horario: () => (form.querySelector('input[name="horario"]:checked') ? ["ok", "Listo."] : ["bad", "Elige un horario."]),
    msg: (v) => ["", `${v.length} de 280 caracteres.`],
    aviso: () => ($("#f-aviso").checked ? ["ok", ""] : ["bad", "Marca la casilla para continuar."]),
  };
  const touched = new Set();
  function setHint(field, message, state = "") {
    const hint = $(".hint", field);
    const icon = state === "bad" ? ico("i-alert", "ic hint-icon") : state === "ok" ? ico("i-ok", "ic hint-icon") : null;
    if (icon) {
      icon.setAttribute("role", "img");
      icon.setAttribute("aria-label", state === "bad" ? "Error" : "Correcto");
    }
    hint.replaceChildren(...[icon, message ? h("span", {}, message) : null].filter(Boolean));
  }
  function validate(name, show = true) {
    const f = $(`[data-f="${name}"]`), el = form.elements[name];
    const val = name === "horario" || name === "aviso" ? "" : el.value;
    const [st, msg] = rules[name](val);
    if (show) {
      if (st) f.dataset.state = st; else delete f.dataset.state;
      setHint(f, msg, st);
      if (el.setAttribute && el.type !== "radio" && el.length === undefined) el.setAttribute("aria-invalid", String(st === "bad"));
    }
    return st !== "bad";
  }
  function genFolio() {
    const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; let c = "";
    const r = new Uint32Array(4); (crypto && crypto.getRandomValues ? crypto.getRandomValues(r) : r.forEach((_, i) => (r[i] = Math.random() * 4294967296)));
    r.forEach((n) => (c += A[n % A.length])); return `DR-${c}-2026`;
  }
  function buildForm() {
    $("#shiftOpts").replaceChildren(...HORARIOS.map(([n, t], i) => h("label", { class: "shift" }, h("input", { type: "radio", name: "horario", value: n + " (" + t + ")", ...(i === 0 ? { required: true } : {}) }), h("b", {}, n), h("small", {}, t))));
    form.addEventListener("input", (e) => { const n = e.target.name; if (!n) return; if (n === "msg") validate("msg"); else if (touched.has(n)) validate(n); });
    form.addEventListener("change", (e) => { const n = e.target.name; if (n === "horario" || n === "aviso" || n === "sucursal" || n === "exp") { touched.add(n); validate(n); } });
    form.addEventListener("focusout", (e) => { const n = e.target.name; if (n && n !== "msg" && n !== "horario" && n !== "aviso") { touched.add(n); validate(n); } });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const names = ["nombre", "tel", "correo", "sucursal", "exp", "horario", "aviso"]; names.forEach((n) => touched.add(n));
      const oks = names.map((n) => validate(n)), first = names.find((_, i) => !oks[i]);
      if (first) { $("#formMsg").textContent = "Revisa los campos marcados en rojo."; const el = first === "horario" ? form.querySelector('input[name="horario"]') : form.elements[first]; el.focus(); return; }
      $("#formMsg").textContent = "";
      const folio = genFolio(), v = Object.fromEntries(new FormData(form).entries());
      showFolio(folio, v);
    });
    form.addEventListener("reset", () => { setTimeout(() => { touched.clear(); $$(".field", form).forEach((f) => { delete f.dataset.state; const k = f.dataset.f; setHint(f, hints[k] || ""); }); $$("[aria-invalid]", form).forEach((x) => x.removeAttribute("aria-invalid")); $("#formMsg").textContent = ""; }); });
  }
  function showFolio(folio, v) {
    modal.className = "";
    modal.replaceChildren(
      h("div", { class: "modal-head" }, badgeSvg(), h("h2", { id: "modalTitle" }, "Solicitud registrada")),
      h("div", { class: "modal-body" },
        h("div", { class: "folio" }, h("small", {}, "Tu folio de demostración"), h("b", {}, folio)),
        h("dl", {}, h("dt", {}, "Nombre"), h("dd", {}, v.nombre.trim()), h("dt", {}, "Sucursal"), h("dd", {}, v.sucursal), h("dt", {}, "Horario"), h("dd", {}, v.horario)),
        h("p", { class: "notice" }, "Es una demostración: no se envió ni se guardó tu información. Con la versión real, Recursos Humanos te contactaría.")),
      h("div", { class: "modal-foot" },
        h("button", { class: "btn btn-ghost", type: "button", onclick: async () => { try { await navigator.clipboard.writeText(folio); toast("Folio copiado", "ok"); } catch { toast("No se pudo copiar. Anótalo: " + folio); } } }, ico("i-copy"), "Copiar folio"),
        h("button", { class: "btn btn-blue", type: "button", onclick: () => modal.close() }, "Cerrar")));
    modal.addEventListener("close", () => form.reset(), { once: true });
    modal.showModal(); live("Solicitud registrada. Folio " + folio);
  }

  /* ===================================================================
     12. Estado del sistema, reloj y arranque
     =================================================================== */
  function status() {
    const dot = $("#netDot"), txt = $("#netTxt"), set = () => { const on = navigator.onLine; dot.style.background = on ? "#5EE3A1" : "#FF6B5E"; txt.textContent = on ? "En línea" : "Sin conexión (la app sigue funcionando)"; };
    addEventListener("online", set); addEventListener("offline", set); set();
    const fmt = new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit" }), clock = $("#clock");
    const tick = () => { const d = new Date(); clock.textContent = fmt.format(d); clock.dateTime = d.toISOString(); }; tick(); setInterval(tick, 20000);
    $("#year").textContent = new Date().getFullYear();
  }

  onChange(() => { if (currentTab === "dashboard") renderDashboard(); else { const p = progress(); $("#popPct").textContent = Math.round(p.total * 100) + "%"; $("#popBar").style.setProperty("--v", p.total); } });

  buildManualControls(); renderManual();
  buildPOS(); buildChecklist(); renderExam(); buildForm(); status();
  if (location.hash === "#/estilos") showStyleguide({ hash: false });
  else activate(TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "dashboard", { scroll: false, hash: false });
  startTips();
  save();
})();
