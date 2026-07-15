// ===== Hover fill direzionale dei bottoni (stile karocrafts.com) =====
// All'hover il bottone si riempie con un RETTANGOLO che entra dal lato da cui
// arriva il cursore (dal basso, dall'alto, da destra o da sinistra) e, all'uscita,
// esce verso il lato da cui il cursore se ne va. Vanilla JS, nessuna dipendenza.
// Resiste ai cambi di textContent (es. nickname, "saved").
(function () {
    "use strict";

    var SEL = ".primary-button, .secondary-button, .back-button, .icon-button";

    document.documentElement.classList.add("btn-fill-on");

    function interactive(btn) {
        if (btn.disabled) return false;
        return getComputedStyle(btn).cursor === "pointer";
    }

    // Lato d'ingresso/uscita del cursore -> 0 alto, 1 destra, 2 basso, 3 sinistra.
    function edge(e, r) {
        var w = r.width, h = r.height;
        var x = (e.clientX - r.left - w / 2) * (w > h ? h / w : 1);
        var y = (e.clientY - r.top - h / 2) * (h > w ? w / h : 1);
        return (Math.round((Math.atan2(y, x) * (180 / Math.PI) + 180) / 90) + 3) % 4;
    }

    // Posizione "fuori dal bottone" da cui il rettangolo entra / verso cui esce.
    function offscreen(dir) {
        return dir === 0 ? "translateY(-101%)"
             : dir === 1 ? "translateX(101%)"
             : dir === 2 ? "translateY(101%)"
             : "translateX(-101%)";
    }

    function hasBareText(btn) {
        for (var n = btn.firstChild; n; n = n.nextSibling) {
            if (n.nodeType === 3 && n.textContent.trim()) return true;
        }
        return false;
    }

    // Avvolge i testi nudi in una label (sopra il fill) e garantisce il fill.
    function ensureFill(btn) {
        Array.prototype.slice.call(btn.childNodes).forEach(function (node) {
            if (node.nodeType === 3 && node.textContent.trim()) {
                var span = document.createElement("span");
                span.className = "btn-label";
                node.parentNode.replaceChild(span, node);
                span.appendChild(node);
            }
        });
        var fill = btn.querySelector(":scope > .btn-fill");
        if (!fill) {
            fill = document.createElement("span");
            fill.className = "btn-fill";
            btn.insertBefore(fill, btn.firstChild);
        } else if (fill !== btn.firstChild) {
            btn.insertBefore(fill, btn.firstChild);
        }
        return fill;
    }

    function currentFill(btn) { return btn.querySelector(":scope > .btn-fill"); }

    function setup(btn) {
        if (btn.dataset.btnFill) return;
        btn.dataset.btnFill = "1";
        btn.classList.add("btn-fill-host");
        ensureFill(btn);

        // Ripristina label + fill se il contenuto viene riscritto (nickname/"saved"/...).
        var mo = new MutationObserver(function () {
            if (!currentFill(btn) || hasBareText(btn)) {
                mo.disconnect();
                ensureFill(btn);
                mo.observe(btn, { childList: true });
            }
        });
        mo.observe(btn, { childList: true });

        btn.addEventListener("pointerenter", function (e) {
            if (e.pointerType === "touch" || !interactive(btn)) return;
            btn.classList.remove("btn-tapped"); // nuovo hover: si riparte pulito
            var fill = currentFill(btn);
            if (!fill) return;
            var r = btn.getBoundingClientRect();
            // parti dal lato d'ingresso (senza transizione)...
            fill.style.transition = "none";
            fill.style.transform = offscreen(edge(e, r));
            void fill.offsetWidth; // reflow
            // ...poi sali a coprire il bottone.
            fill.style.transition = "";
            fill.style.transform = "translate(0, 0)";
        });

        // Al click: stato "tapped" immediato (finché il puntatore resta sopra) e
        // niente più animazione di hover.
        btn.addEventListener("pointerdown", function (e) {
            if (e.pointerType === "touch" || !interactive(btn)) return;
            btn.classList.add("btn-tapped");
            var fill = currentFill(btn);
            if (!fill) return;
            fill.style.transition = "none";
            fill.style.transform = "translateY(101%)"; // nascondi subito il fill hover
        });

        btn.addEventListener("pointerleave", function (e) {
            btn.classList.remove("btn-tapped"); // uscito: il prossimo hover si rianima
            if (e.pointerType === "touch") return;
            var fill = currentFill(btn);
            if (!fill) return;
            var r = btn.getBoundingClientRect();
            // esci verso il lato d'uscita.
            fill.style.transition = "";
            fill.style.transform = offscreen(edge(e, r));
        });
    }

    function setupAll(root) { (root || document).querySelectorAll(SEL).forEach(setup); }

    function init() {
        setupAll(document);
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
