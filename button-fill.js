// ===== Hover fill animato dei bottoni (stile GSAP) =====
// All'hover il bottone si riempie con un cerchio che PARTE dal punto in cui il
// mouse entra e, all'uscita, si contrae verso il punto da cui esce. Vanilla JS:
// nessuna dipendenza esterna. Gestisce anche i bottoni aggiunti dinamicamente.
(function () {
    "use strict";

    var SEL = ".primary-button, .secondary-button, .back-button, .icon-button";

    // Segnala al CSS che il fill animato è attivo (disattiva l'hover "istantaneo").
    document.documentElement.classList.add("btn-fill-on");

    // Anima solo se il bottone è davvero interattivo (cursore a "manina").
    function interactive(btn) {
        if (btn.disabled) return false;
        return getComputedStyle(btn).cursor === "pointer";
    }

    function setup(btn) {
        if (btn.dataset.btnFill) return;
        btn.dataset.btnFill = "1";
        btn.classList.add("btn-fill-host");

        // I nodi di testo "nudi" vanno avvolti così restano SOPRA il riempimento.
        Array.prototype.slice.call(btn.childNodes).forEach(function (node) {
            if (node.nodeType === 3 && node.textContent.trim()) {
                var span = document.createElement("span");
                span.className = "btn-label";
                node.parentNode.replaceChild(span, node);
                span.appendChild(node);
            }
        });

        var fill = document.createElement("span");
        fill.className = "btn-fill";
        btn.insertBefore(fill, btn.firstChild);

        // Diametro che copre il bottone da qualunque punto (raggio = diagonale).
        function diameter(r) { return 2 * Math.hypot(r.width, r.height); }

        btn.addEventListener("pointerenter", function (e) {
            if (e.pointerType === "touch" || !interactive(btn)) return;
            var r = btn.getBoundingClientRect();
            var x = e.clientX - r.left, y = e.clientY - r.top, D = diameter(r);
            // parti collassato nel punto d'ingresso (senza transizione)...
            fill.style.transition = "none";
            fill.style.width = fill.style.height = D + "px";
            fill.style.transformOrigin = (D / 2) + "px " + (D / 2) + "px";
            fill.style.transform = "translate(" + (x - D / 2) + "px," + (y - D / 2) + "px) scale(0)";
            void fill.offsetWidth; // reflow: fissa lo stato iniziale
            // ...poi cresci fino a riempire il bottone.
            fill.style.transition = "";
            fill.style.transform = "translate(" + (x - D / 2) + "px," + (y - D / 2) + "px) scale(1)";
        });

        btn.addEventListener("pointerleave", function (e) {
            if (e.pointerType === "touch") return;
            var r = btn.getBoundingClientRect();
            var x = e.clientX - r.left, y = e.clientY - r.top, D = diameter(r);
            // contrai verso il punto d'uscita.
            fill.style.transition = "";
            fill.style.transformOrigin = (D / 2) + "px " + (D / 2) + "px";
            fill.style.transform = "translate(" + (x - D / 2) + "px," + (y - D / 2) + "px) scale(0)";
        });
    }

    function setupAll(root) {
        (root || document).querySelectorAll(SEL).forEach(setup);
    }

    function init() {
        setupAll(document);
        // Bottoni aggiunti dopo (card storie, pop-up del 3D, ...).
        var mo = new MutationObserver(function (muts) {
            muts.forEach(function (m) {
                Array.prototype.forEach.call(m.addedNodes, function (n) {
                    if (n.nodeType !== 1) return;
                    if (n.matches && n.matches(SEL)) setup(n);
                    if (n.querySelectorAll) setupAll(n);
                });
            });
        });
        if (document.body) mo.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
