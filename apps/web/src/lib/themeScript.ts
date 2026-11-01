import { ACCENT_IDS, DEFAULT_ACCENT, LYRICS_FONTS, MOTIONS, STORAGE_KEY, TEXT_SIZES } from "@/lib/appearanceCore"

/**
 * Script exécuté avant l'affichage : applique thème, accent, taille du texte, police des paroles et
 * mouvement enregistrés, pour éviter tout « flash » du réglage par défaut (clés alignées sur
 * src/lib/theme.ts et src/lib/appearanceCore.ts).
 */
export const THEME_INIT_SCRIPT = `try{var d=document.documentElement,t=localStorage.getItem("cp-theme");if(t==="light"||t==="dark")d.setAttribute("data-theme",t);var u=JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})||"{}");function s(n,v,l,x){if(l.indexOf(v)>-1&&v!==x)d.setAttribute(n,v)}s("data-accent",u.accent,${JSON.stringify(ACCENT_IDS)},${JSON.stringify(DEFAULT_ACCENT)});s("data-text",u.textSize,${JSON.stringify(TEXT_SIZES)},"normal");s("data-lyrics",u.lyricsFont,${JSON.stringify(LYRICS_FONTS)},"sans");s("data-motion",u.motion,${JSON.stringify(MOTIONS)},"auto")}catch(e){}`
