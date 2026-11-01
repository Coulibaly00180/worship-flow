/** Script exécuté avant l'affichage pour éviter un flash de mauvais thème (clé alignée sur src/lib/theme.ts). */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("cp-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`
