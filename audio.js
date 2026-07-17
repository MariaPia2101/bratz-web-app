// ===== BRATZ AUDIO: normalizzazione del volume (tutte le tracce allo stesso livello) =====
// I file audio caricati hanno loudness molto diverse (misurate: magazine ~-14dB,
// timetoplay ~-33dB, canzoni ~-9dB...). Per portarli TUTTI allo stesso volume di
// INTRO non basta .volume (non può amplificare oltre 1): si instrada ogni traccia
// in un GainNode (Web Audio) con guadagno = livello_target / livello_traccia,
// limitato dal picco per non distorcere. Anche INTRO viene portato al target, così
// ogni suono dell'app è allo stesso volume.
(function () {
    var TARGET_RMS = 0.06;   // livello comune (~-24 dBFS)
    var PEAK_CEIL = 0.95;    // tetto sul picco: evita il clipping quando si amplifica

    // RMS e picco (lineare) misurati una volta su Chromium. INTRO è AAC: misurato a runtime.
    var TRACKS = {
        "magazine":   { url: "assets/audio/magazine.mp3",    rms: 0.1932, peak: 0.987 },
        "styling":    { url: "assets/audio/styling.mp3",     rms: 0.0550, peak: 0.613 },
        "slamming":   { url: "assets/audio/slamming.mp3",    rms: 0.0432, peak: 0.310 },
        "rocking":    { url: "assets/audio/rocking.mp3",     rms: 0.0459, peak: 0.460 },
        "timetoplay": { url: "assets/audio/timetoplay.mp3",  rms: 0.0226, peak: 0.157 },
        // click: NON normalizzato — resta al suo volume naturale (basso).
        "click":      { url: "assets/audio/click2.mp3",      raw: true },
        "song0":      { url: "assets/audio/Dollz Doll by Sasha  Official Audio  Bratz.mp3",         rms: 0.3544, peak: 1.0 },
        "song1":      { url: "assets/audio/Superbloomin by Yasmin  Official Audio  Bratz.mp3",      rms: 0.3399, peak: 1.0 },
        "song2":      { url: "assets/audio/If I’m Being Honest by Cloe  Official Audio  Bratz.mp3", rms: 0.3570, peak: 1.0 }
    };

    // Guadagno lineare per portare (rms) al target, senza superare il tetto di picco.
    function gainFor(rms, peak) {
        if (!rms || rms <= 0) return 1;
        var g = TARGET_RMS / rms;
        if (peak && peak > 0) g = Math.min(g, PEAK_CEIL / peak);
        return g;
    }

    // ---- AudioContext condiviso + sblocco al primo gesto utente ----
    var ctx = null;
    function getCtx() {
        if (ctx) return ctx;
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { ctx = new AC(); } catch (_) { ctx = null; }
        return ctx;
    }
    function resumeCtx() {
        var c = getCtx();
        if (c && c.state === "suspended") { try { c.resume(); } catch (_) {} }
    }
    ["pointerdown", "keydown", "touchstart", "click"].forEach(function (ev) {
        window.addEventListener(ev, resumeCtx, { capture: true });
    });

    // Esegue cb quando il contesto è "running" (dopo un gesto), o subito se già attivo.
    function whenRunning(cb) {
        var c = getCtx();
        if (!c) { cb(false); return; }
        if (c.state === "running") { cb(true); return; }
        var handler = function () {
            if (c.state === "running") { c.removeEventListener("statechange", handler); cb(true); }
        };
        c.addEventListener("statechange", handler);
        resumeCtx();
    }

    // ---- Riproduzione normalizzata (streaming: nessun decode completo in memoria) ----
    // opts: { loop:false }. Ritorna un handle { el, pause, resume, stop, fadeOut }.
    function play(name, opts) {
        opts = opts || {};
        var t = TRACKS[name];
        if (!t) return null;
        var el = new Audio(encodeURI(t.url));
        el.loop = !!opts.loop;
        var handle = { el: el, gainNode: null };

        // Tracce "raw": nessuna normalizzazione, volume naturale del file. Si
        // riproducono direttamente (senza passare dal GainNode).
        if (t.raw) {
            handle.pause = function () { try { el.pause(); } catch (_) {} };
            handle.resume = function () { var p = el.play(); if (p && p.catch) p.catch(function () {}); };
            handle.stop = function () { try { el.pause(); el.currentTime = 0; } catch (_) {} };
            handle.fadeOut = function () { try { el.volume = 0; } catch (_) {} };
            resumeCtx();
            var pr = el.play(); if (pr && pr.catch) pr.catch(function () {});
            return handle;
        }

        var c = getCtx();
        if (c && c.createMediaElementSource) {
            try {
                var src = c.createMediaElementSource(el);
                var g = c.createGain();
                g.gain.value = gainFor(t.rms, t.peak);
                src.connect(g);
                g.connect(c.destination);
                handle.gainNode = g;
                handle._src = src;
            } catch (_) {
                el.volume = Math.min(1, gainFor(t.rms, t.peak)); // fallback: solo attenuazione
            }
        } else {
            el.volume = Math.min(1, gainFor(t.rms, t.peak));
        }

        // Pulizia dei nodi a fine traccia (per le one-shot, non in loop).
        if (!el.loop) {
            el.addEventListener("ended", function () {
                try { if (handle._src) handle._src.disconnect(); if (handle.gainNode) handle.gainNode.disconnect(); } catch (_) {}
            }, { once: true });
        }

        handle.pause = function () { try { el.pause(); } catch (_) {} };
        handle.resume = function () { whenRunning(function () { var p = el.play(); if (p && p.catch) p.catch(function () {}); }); };
        handle.stop = function () { try { el.pause(); el.currentTime = 0; } catch (_) {} };
        handle.fadeOut = function (ms) {
            if (handle.gainNode && c) {
                var now = c.currentTime;
                try {
                    handle.gainNode.gain.cancelScheduledValues(now);
                    handle.gainNode.gain.setValueAtTime(handle.gainNode.gain.value, now);
                    handle.gainNode.gain.linearRampToValueAtTime(0.0001, now + (ms || 500) / 1000);
                } catch (_) {}
            } else {
                el.volume = 0;
            }
        };

        // Parte appena il contesto è attivo (subito se c'è già stato un gesto).
        whenRunning(function () { var p = el.play(); if (p && p.catch) p.catch(function () {}); });
        return handle;
    }

    // ---- INTRO (AAC): misura a runtime + riproduzione via BufferSource con fade ----
    // opts: { fadeInMs, fadeOutMs, onStarted, onEnded, onFail }
    function playIntro(url, opts) {
        opts = opts || {};
        var c = getCtx();
        var failed = false;
        function fail() { if (!failed) { failed = true; if (opts.onFail) opts.onFail(); } }
        if (!c) { fail(); return; }

        fetch(encodeURI(url)).then(function (r) { return r.arrayBuffer(); }).then(function (ab) {
            return new Promise(function (res, rej) {
                var p = c.decodeAudioData(ab, res, rej);
                if (p && p.then) p.then(res, rej);
            });
        }).then(function (buf) {
            // misura RMS/peak per il guadagno di normalizzazione
            var sum = 0, n = 0, peak = 0;
            for (var ch = 0; ch < buf.numberOfChannels; ch++) {
                var d = buf.getChannelData(ch);
                for (var i = 0; i < d.length; i++) { var s = d[i]; sum += s * s; var a = s < 0 ? -s : s; if (a > peak) peak = a; }
                n += d.length;
            }
            var rms = Math.sqrt(sum / (n || 1));
            var base = gainFor(rms, peak);

            var srcNode = c.createBufferSource();
            srcNode.buffer = buf;
            var g = c.createGain();
            srcNode.connect(g); g.connect(c.destination);

            var fin = (opts.fadeInMs || 0) / 1000;
            var fout = (opts.fadeOutMs || 0) / 1000;
            var dur = buf.duration;
            var t0 = c.currentTime;
            if (fin > 0) {
                g.gain.setValueAtTime(0.0001, t0);
                g.gain.linearRampToValueAtTime(base, t0 + fin);
            } else {
                g.gain.setValueAtTime(base, t0);
            }
            if (fout > 0 && dur > fout) {
                g.gain.setValueAtTime(base, t0 + dur - fout);
                g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
            }
            srcNode.onended = function () { if (opts.onEnded) opts.onEnded(); };
            resumeCtx();
            srcNode.start();
            if (opts.onStarted) opts.onStarted();
        }).catch(fail);
    }

    window.BratzAudio = { play: play, playIntro: playIntro, gainFor: gainFor, TARGET_RMS: TARGET_RMS };
})();
