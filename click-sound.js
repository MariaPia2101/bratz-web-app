// ===== SUONO DEL CLICK (globale) =====
// Ad OGNI click sulla pagina si sente assets/audio/click.mp3, normalizzato allo
// stesso volume delle altre tracce (via BratzAudio). Un click è già un gesto
// utente, quindi il suono è consentito. Ogni click crea una riproduzione a sé,
// così clic ravvicinati si sovrappongono senza tagliarsi.
(function () {
    function playClick() {
        if (window.BratzAudio) {
            window.BratzAudio.play("click");
        } else {
            // Fallback minimale se audio.js non è caricato.
            try { var a = new Audio("assets/audio/click.mp3"); a.play().catch(function () {}); } catch (_) {}
        }
    }
    // Fase di cattura: si sente anche se un handler chiama stopPropagation.
    document.addEventListener("click", playClick, true);
})();
