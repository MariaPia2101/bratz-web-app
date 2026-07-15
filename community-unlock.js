// ===== Sblocco globale del bottone "community" dopo la stampa del magazine =====
// Una volta stampato il primo magazine (bratz_magazine_printed = "1"), su ogni
// pagina il primary_button "community" diventa attivo e porta a community_page.
(function () {
    "use strict";
    if (localStorage.getItem("bratz_magazine_printed") !== "1") return;

    var IDS = ["user-community-btn", "go-community-btn", "enter-community-btn"];

    function unlock() {
        IDS.forEach(function (id) {
            var b = document.getElementById(id);
            if (!b || b.dataset.communityReady) return;
            b.dataset.communityReady = "1";
            b.disabled = false;
            b.classList.add("active");
            b.addEventListener("click", function () { window.location.href = "community_page.html"; });
        });
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", unlock);
    else unlock();
})();
