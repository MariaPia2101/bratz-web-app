// ===== Hover fill animato dei bottoni (stile GSAP) =====
// All'hover il bottone si riempie con un cerchio che PARTE dal punto in cui il
// mouse entra e, all'uscita, si contrae verso il punto da cui esce. Vanilla JS,
// nessuna dipendenza. Resiste ai cambi di textContent (es. nickname, "saved").
(function () {
    "use strict";

    var SEL = ".primary-button, .secondary-button, .back-button, .icon-button";
    // Fattore di dimensione del cerchio: più grande = il "cerchietto" iniziale si
    // nota meno (il riempimento arriva ai bordi molto prima).
    var SPREAD = 1.7;

    document.documentElement.classList.add("btn-fill-on");

    function interactive(btn) {
        if (btn.disabled) return false;
        return getComputedStyle(btn).cursor === "pointer";
    }

    // C'è un nodo di testo "nudo" (non ancora avvolto) fra i figli diretti?
    function hasBareText(btn) {
        for (var n = btn.firstChild; n; n = n.nextSibling) {
            if (n.nodeType === 3 && n.textContent.trim()) return true;
        }
        return false;
    }

    // Avvolge i testi nudi in una label (che sta sopra il fill) e garantisce il fill.
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
            btn.insertBefore(fill, btn.firstChild); // resta dietro a tutto
        }
        return fill;
    }

    function currentFill(btn) { return btn.querySelector(":scope > .btn-fill"); }
    function diameter(r) { return SPREAD * 2 * Math.hypot(r.width, r.height); }

    function setup(btn) {
        if (btn.dataset.btnFill) return;
        btn.dataset.btnFill = "1";
        btn.classList.add("btn-fill-host");
        ensureFill(btn);

        // Se il contenuto del bottone viene riscritto (textContent = nickname /
        // "saved" / ...), ripristina label + fill.
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
            var fill = currentFill(btn);
            if (!fill) return;
            var r = btn.getBoundingClientRect();
            var x = e.clientX - r.left, y = e.clientY - r.top, D = diameter(r);
            fill.style.transition = "none";
            fill.style.width = fill.style.height = D + "px";
            fill.style.transformOrigin = (D / 2) + "px " + (D / 2) + "px";
            fill.style.transform = "translate(" + (x - D / 2) + "px," + (y - D / 2) + "px) scale(0)";
            void fill.offsetWidth; // reflow: fissa lo stato iniziale
            fill.style.transition = "";
            fill.style.transform = "translate(" + (x - D / 2) + "px," + (y - D / 2) + "px) scale(1)";
        });

        btn.addEventListener("pointerleave", function (e) {
            if (e.pointerType === "touch") return;
            var fill = currentFill(btn);
            if (!fill) return;
            var r = btn.getBoundingClientRect();
            var x = e.clientX - r.left, y = e.clientY - r.top, D = diameter(r);
            fill.style.transition = "";
            fill.style.transformOrigin = (D / 2) + "px " + (D / 2) + "px";
            fill.style.transform = "translate(" + (x - D / 2) + "px," + (y - D / 2) + "px) scale(0)";
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
