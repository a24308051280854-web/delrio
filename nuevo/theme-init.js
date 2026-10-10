try {
  const storedTheme = JSON.parse(localStorage.getItem("dr.portal.v1") || "{}").theme;
  const theme = storedTheme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.dataset.theme = theme;
} catch {
  // Keep the default theme when browser storage is unavailable.
}

// Secuencia de entrada del Dashboard: una vez por sesión y nunca con movimiento reducido.
// Sin JS no se agrega la clase, así que todo queda visible y sin animación.
try {
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches && !sessionStorage.getItem("dr.portal.intro")) {
    document.documentElement.classList.add("dr-intro");
  }
} catch {
  // Sin sessionStorage no se reproduce la intro.
}
