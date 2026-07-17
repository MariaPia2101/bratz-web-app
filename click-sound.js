// ===== SUONO DEL CLICK (globale) =====
// Ad OGNI click sulla pagina si sente assets/audio/click.mp3.
// Un click è già un gesto utente, quindi l'autoplay del suono è consentito.
// Si clona l'elemento audio ad ogni click così clic ravvicinati si sovrappongono
// senza tagliarsi a vicenda.
(function () {
    var SRC = "assets/audio/click.mp3";
    var base = null;
    try { base = new Audio(SRC); base.preload = "auto"; } catch (_) { base = null; }

    function playClick() {
        try {
            var a = base ? base.cloneNode(true) : new Audio(SRC);
            a.currentTime = 0;
            var p = a.play();
            if (p && typeof p.then === "function") p.catch(function () {});
        } catch (_) { /* audio non disponibile: nessun blocco */ }
    }

    // Fase di cattura: si sente anche se un handler chiama stopPropagation.
    document.addEventListener("click", playClick, true);
})();
