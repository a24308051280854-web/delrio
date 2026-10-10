// Parte el titular del Dashboard en palabras para la secuencia de entrada.
// Se carga justo después del <h1> para dividirlo antes de que se pinte.
(() => {
  const root = document.documentElement;
  const h1 = document.getElementById("greet");
  if (!h1 || !root.classList.contains("dr-intro")) return;

  try {
    // El texto completo sigue en el DOM; el h1 se nombra con la frase y los spans se ocultan a lectores.
    h1.setAttribute("aria-label", h1.textContent.replace(/\s+/g, " ").trim());
    const segmenter = "Segmenter" in Intl ? new Intl.Segmenter("es", { granularity: "word" }) : null;
    const pieces = (text) => (segmenter ? Array.from(segmenter.segment(text), (s) => s.segment) : text.split(/(\s+)/));
    let index = 0;

    const word = (text) => {
      const outer = document.createElement("span");
      const inner = document.createElement("span");
      outer.className = "w";
      outer.setAttribute("aria-hidden", "true");
      inner.className = "w-in";
      inner.style.setProperty("--i", index++);
      inner.textContent = text;
      outer.append(inner);
      return outer;
    };

    // Une los segmentos hasta cada espacio para que «¡Listo» y «turno!» conserven su puntuación.
    const split = (node) => {
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          let current = "";
          const flush = () => { if (current) frag.append(word(current)); current = ""; };
          for (const piece of pieces(child.data)) {
            if (/^\s+$/.test(piece)) { flush(); frag.append(piece); } else current += piece;
          }
          flush();
          child.replaceWith(frag);
        } else if (child.nodeType === Node.ELEMENT_NODE && child.namespaceURI !== "http://www.w3.org/2000/svg") {
          split(child);
        }
      }
    };
    split(h1);
  } catch {
    // Si algo falla, el titular queda como texto normal y visible.
  }

  // Al terminar la última animación se marca la sesión y se retira la clase,
  // para que volver a la pestaña no repita la intro ni bloquee los estados :active.
  document.addEventListener("animationend", function done(e) {
    if (e.animationName !== "intro-rise" || !e.target.classList.contains("global")) return;
    document.removeEventListener("animationend", done);
    try { sessionStorage.setItem("dr.portal.intro", "1"); } catch {}
    root.classList.remove("dr-intro");
  });
})();
