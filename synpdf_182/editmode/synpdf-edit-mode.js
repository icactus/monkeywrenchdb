//~ Copyright (C) 2023-2025: Isaac Trapkus
//~ Revision: 182, Copyright (C) 2015-2023: Willem Vree, contributions Stéphane David.
//~ This program is free software; you can redistribute it and/or modify it under the terms of the
//~ GNU General Public License as published by the Free Software Foundation; either version 2 of
//~ the License, or (at your option) any later version.
//~ This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
//~ without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
//~ See the GNU General Public License for more details. <http://www.gnu.org/licenses/gpl.html>.

pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';


var playing$$module$mixer = 0,
    sampleRate$$module$mixer = 44100,
    audioCtx$$module$mixer, urls$$module$mixer, audbuf$$module$mixer = [],
    audnode$$module$mixer = [],
    analyser$$module$mixer, fft_size$$module$mixer = 2048,
    anaData$$module$mixer = new Float32Array(fft_size$$module$mixer),
    vuMeter$$module$mixer, masterGain$$module$mixer, trackGain$$module$mixer = [],
    trackMute$$module$mixer = [],
    trackPan$$module$mixer = [],
    tracksOn$$module$mixer, tracksOnPrev$$module$mixer, soloTrk$$module$mixer, startTime$$module$mixer, playPos$$module$mixer =
        0,
    playbtn$$module$mixer, posElm$$module$mixer, progressElm$$module$mixer, nframes$$module$mixer = 0,
    animFrame$$module$mixer, vumax$$module$mixer = 0,
    duration$$module$mixer, wasplaying$$module$mixer = 0,
    trkhrz$$module$mixer = '<div class="trkblk"><span>XXX</span>\n    <div>\n        <input id="muteYYY" type="button" value="mute">\n        <input id="soloYYY" type="button" value="solo">\n    </div>\n    <div><span>vol</span><input id="volYYY" type="range"></div>\n    <div><span>pan</span><input id="panYYY" type="range"></div>\n</div>',
    trkvrt$$module$mixer = '<div class="trkblk"><span>XXX</span>\n    <div>\n        <input id="muteYYY" type="button" value="mute">\n        <input id="soloYYY" type="button" value="solo">\n    </div>\n    <div class="volpan">vol pan</div>\n    <div>\n        <input id="volYYY" type="range" orient="vertical" class="vert">\n        <input id="panYYY" type="range" orient="vertical" class="vert">\n    </div>\n</div>',
    mstvrt$$module$mixer = '<div class="mstvrt"><span><b>master</b></span>\n    <div><input id="mute5" type="button" value="mute"></div>\n    <div>vol VU</div>\n    <div>\n        <input id="mstr" type="range" orient="vertical" class="vert">\n        <meter id="vu" class="mtrvrt" max="2" value="0" high="1.5">VU</meter>\n    </div>\n</div>',
    msthrz$$module$mixer = '<div class="trkblk"><span><b>Master</b></span>\n    <div><input id="mute5" type="button" value="mute"></div>\n    <div><span>vol</span><input id="mstr" type="range"></div>\n    <div><span>VU</span><meter id="vu" class="mtrhrz" max="2" value="0" high="1.5">VU</meter></div>\n</div>',
    posblk$$module$mixer = '<div class="posblk">\n    <div><span>time: </span><span id="pos"></span></div>\n    <input type="range" id="pro2" min="0" max="1" step="0.01">\n    <input id="play" type="button" value="play">\n</div>',
    CSSmixer$$module$mixer = "\n.trkblk { display: flex; flex-direction: column; justify-content: space-around; align-items: center;\n    border: solid black 1px; padding: 5px; }\n.trkblk > div { margin-top: 5px; }\n.mstvrt { display: flex; flex-direction: column; justify-content: space-around; align-items: center;\n    padding: 3px; border: solid black 1px; min-width: 80px; }\n.mstvrt > div { margin-top: 5px; }\n.mstvrt #mstr { margin-left: -20px; }\n.msthrz { display: flex; flex-direction: column; align-items: center; margin: 7px; }\n#play { margin: 5px; width: 4em; }\n#pos  { width: 4em; }\n.vert { appearance: slider-vertical; width: 20px }\n.mtrhrz { width: 120px; }\n.mtrvrt { position: absolute; width: 130px; margin-left: 10px; transform-origin: 100% 0; \n          transform: translate(-100%,10%) rotate(-90deg); }\n.posblk { margin-top: 10px; padding: 3px; text-align: center;\n          display:flex; flex-direction: column; justify-content: center; align-items: center; }\n";

function logerr$$module$mixer(a) {
    document.getElementById("err");
    err.innerText += a + "\n"
}

function readAudio$$module$mixer(a) {
    return $jscomp.asyncExecutePromiseGeneratorProgram(function(b) {
        return b.return(new Promise(function(b, d) {
            var c = new XMLHttpRequest;
            c.open("GET", a, !0);
            c.responseType = "arraybuffer";
            c.onload = function() {
                audioCtx$$module$mixer.decodeAudioData(c.response, function(c) {
                    logerr$$module$mixer("url: " + a + ", duration: " + c.duration.toFixed(3) + " seconds");
                    $("#loadmsg").append("<br>url: " + a + ", duration: " + c.duration.toFixed(3) + " seconds");
                    b(c)
                }, function(a) {
                    d("decode audio error or file missing")
                })
            };
            c.onerror = function(a) {
                d("XHR read error")
            };
            c.send()
        }))
    })
}

function mkAudBuffers$$module$mixer() {
    var a, b, c, d, e;
    return $jscomp.asyncExecutePromiseGeneratorProgram(function(f) {
        switch (f.nextAddress) {
            case 1:
                a = duration$$module$mixer = 0;
            case 2:
                if (!(a < urls$$module$mixer.length)) {
                    f.jumpTo(4);
                    break
                }
                f.setCatchFinallyBlocks(5);
                b = audbuf$$module$mixer;
                c = a;
                return f.yield(readAudio$$module$mixer(urls$$module$mixer[a]), 7);
            case 7:
                b[c] = f.yieldResult;
                d = audbuf$$module$mixer[a].duration;
                d > duration$$module$mixer && (duration$$module$mixer = d);
                f.leaveTryBlock(3);
                break;
            case 5:
                return e =
                    f.enterCatchBlock(), logerr$$module$mixer(e), f.return(0);
            case 3:
                ++a;
                f.jumpTo(2);
                break;
            case 4:
                return f.return(1)
        }
    })
}

function startstop$$module$mixer(a) {
    for (var b = 0; b < urls$$module$mixer.length; ++b)
        if (playing$$module$mixer) audnode$$module$mixer[b].stop(), audnode$$module$mixer[b].disconnect();
        else {
            var c = audioCtx$$module$mixer.createBufferSource();
            c.buffer = audbuf$$module$mixer[b];
            c.connect(trackMute$$module$mixer[b]);
            c.start(0, a);
            audnode$$module$mixer[b] = c
        } playing$$module$mixer ? (playing$$module$mixer = 0, playbtn$$module$mixer.value = "play", playPos$$module$mixer = audioCtx$$module$mixer.currentTime - startTime$$module$mixer,
            cancelAnimationFrame(animFrame$$module$mixer)) : (playing$$module$mixer = 1, playbtn$$module$mixer.value = "pause", startTime$$module$mixer = audioCtx$$module$mixer.currentTime - a, peakMeter$$module$mixer())
}

function peakMeter$$module$mixer() {
    analyser$$module$mixer.getFloatTimeDomainData(anaData$$module$mixer);
    for (var a = $jscomp.makeIterator(anaData$$module$mixer), b = a.next(); !b.done; b = a.next()) b = b.value, 0 > b && (b = -b), b > vumax$$module$mixer && (vumax$$module$mixer = b);
    playPos$$module$mixer = audioCtx$$module$mixer.currentTime - startTime$$module$mixer;
    nframes$$module$mixer += 1;
    playing$$module$mixer && (animFrame$$module$mixer = requestAnimationFrame(peakMeter$$module$mixer));
    tick$$module$synpdf(nframes$$module$mixer);
    0 == nframes$$module$mixer % 4 && (vuMeter$$module$mixer.value = vumax$$module$mixer, vumax$$module$mixer = 0, posElm$$module$mixer.innerHTML = playPos$$module$mixer.toFixed(1), progressElm$$module$mixer.value = playPos$$module$mixer / duration$$module$mixer)
}

function setButtons$$module$mixer() {
    for (var a = 0; a < tracksOn$$module$mixer.length; ++a) {
        var b = document.getElementById("mute" + a);
        b.style.background = tracksOn$$module$mixer[a] ? "" : "red";
        trackMute$$module$mixer[a].gain.value = tracksOn$$module$mixer[a] ? 1 : 0;
        b = document.getElementById("solo" + a);
        b.style.background = a == soloTrk$$module$mixer ? "lightgreen" : ""
    }
}

function mute$$module$mixer(a) {
    a = 1 * a.target.id.replace("mute", "");
    tracksOn$$module$mixer[a] = 1 == tracksOn$$module$mixer[a] ? 0 : 1;
    soloTrk$$module$mixer == a && (soloTrk$$module$mixer = -1);
    setButtons$$module$mixer()
}

function solo$$module$mixer(a) {
    var b = 1 * a.target.id.replace("solo", "");
    b == soloTrk$$module$mixer ? (tracksOn$$module$mixer = tracksOnPrev$$module$mixer.slice(), tracksOnPrev$$module$mixer = null, soloTrk$$module$mixer = -1) : (tracksOnPrev$$module$mixer || (tracksOnPrev$$module$mixer = tracksOn$$module$mixer.slice()), tracksOn$$module$mixer = tracksOn$$module$mixer.map(function(a, d) {
        return d == b ? 1 : 0
    }), soloTrk$$module$mixer = b);
    setButtons$$module$mixer()
}

function setvol$$module$mixer(a) {
    a = 1 * a.target.id.replace("vol", "");
    var b = document.getElementById("vol" + a);
    trackGain$$module$mixer[a].gain.value = Math.pow(100, (1 * b.value - 50) / 166)
}

function setmstr$$module$mixer() {
    var a = document.getElementById("mstr");
    masterGain$$module$mixer.gain.value = Math.pow(100, (1 * a.value - 50) / 166)
}

function mutemstr$$module$mixer() {
    var a = document.getElementById("mute5");
    "red" == a.style.background ? (a.style.background = "", setmstr$$module$mixer()) : (a.style.background = "red", masterGain$$module$mixer.gain.value = 0)
}

function setpan$$module$mixer(a) {
    a = 1 * a.target.id.replace("pan", "");
    var b = (1 * document.getElementById("pan" + a).value - 50) / 50;
    trackPan$$module$mixer[a].pan.value = b
}

function setTrkNames$$module$mixer(a) {
    for (var b = urls$$module$mixer.map(function(a) {
        return a.split("/").pop().split(".")[0]
    }), c = document.getElementById("buttons"), d = 0; d < b.length; ++d) {
        var e = "hrz" == a || "left" == a ? trkhrz$$module$mixer : trkvrt$$module$mixer;
        e = e.replace("XXX", "<b>" + b[d] + "</b>").replace(/YYY/g, d);
        c.insertAdjacentHTML("beforeend", e)
    }
    "hrz" == a || "left" == a ? c.insertAdjacentHTML("beforeend", msthrz$$module$mixer + posblk$$module$mixer) : c.insertAdjacentHTML("beforeend", mstvrt$$module$mixer + posblk$$module$mixer);
    tracksOn$$module$mixer = b.map(function(a) {
        return 1
    });
    "left" == a && (document.body.style["flex-direction"] = "row", c.style["flex-direction"] = "column");
    media_file$$module$synpdf && (document.querySelector(".posblk").style.display = "none")
}

function setTrkHandlers$$module$mixer() {
    playbtn$$module$mixer = document.getElementById("play");
    playbtn$$module$mixer.disabled = "true";
    playbtn$$module$mixer.addEventListener("click", function(a) {
        return keyDown$$module$synpdf({
            key: " "
        })
    });
    vuMeter$$module$mixer = document.getElementById("vu");
    posElm$$module$mixer = document.getElementById("pos");
    posElm$$module$mixer.innerHTML = "0";
    progressElm$$module$mixer = document.getElementById("pro2");
    progressElm$$module$mixer.value = 0;
    progressElm$$module$mixer.addEventListener("input",
        function(a) {
            playing$$module$mixer && (wasplaying$$module$mixer = 1, startstop$$module$mixer(0));
            playPos$$module$mixer = a = duration$$module$mixer * progressElm$$module$mixer.value;
            posElm$$module$mixer.innerHTML = a.toFixed(1);
            tick$$module$synpdf()
        });
    progressElm$$module$mixer.addEventListener("change", function(a) {
        wasplaying$$module$mixer && startstop$$module$mixer(playPos$$module$mixer);
        wasplaying$$module$mixer = 0;
        progressElm$$module$mixer.blur()
    });
    for (var a = 0; a < urls$$module$mixer.length; ++a) {
        var b = document.getElementById("mute" +
            a);
        b.addEventListener("click", function(a) {
            return mute$$module$mixer(a)
        });
        b = document.getElementById("solo" + a);
        b.addEventListener("click", function(a) {
            return solo$$module$mixer(a)
        });
        b = document.getElementById("vol" + a);
        b.addEventListener("input", function(a) {
            return setvol$$module$mixer(a)
        });
        b = document.getElementById("pan" + a);
        b.addEventListener("input", function(a) {
            return setpan$$module$mixer(a)
        })
    }
    b = document.getElementById("mstr");
    b.addEventListener("input", function(a) {
        return setmstr$$module$mixer()
    });
    (b =
        document.getElementById("mute5")) && b.addEventListener("click", function(a) {
            return mutemstr$$module$mixer()
        })
}

function setTrkOrient$$module$mixer(a) {
    var b = playbtn$$module$mixer.value;
    document.getElementById("buttons").replaceChildren();
    var c = document.querySelector(".msthrz");
    c && c.remove();
    setTrkNames$$module$mixer(a);
    setTrkHandlers$$module$mixer();
    playbtn$$module$mixer.disabled = "";
    playbtn$$module$mixer.value = b
}

function initMixer$$module$mixer(a, b) {
    var c, d, e;
    return $jscomp.asyncExecutePromiseGeneratorProgram(function(f) {
        if (1 == f.nextAddress) {
            urls$$module$mixer = a;
            c = document.querySelector("style");
            c.insertAdjacentHTML("beforeend", CSSmixer$$module$mixer);
            setTrkNames$$module$mixer(b);
            setTrkHandlers$$module$mixer();
            d = window.AudioContext || window.webkitAudioContext;
            (audioCtx$$module$mixer = void 0 != d ? new d({
                sampleRate: sampleRate$$module$mixer
            }) : null) || alert("Your browser does not support the Web Audio API");
            analyser$$module$mixer =
                audioCtx$$module$mixer.createAnalyser();
            analyser$$module$mixer.fftSize = fft_size$$module$mixer;
            masterGain$$module$mixer = audioCtx$$module$mixer.createGain();
            masterGain$$module$mixer.gain.value = 1;
            masterGain$$module$mixer.connect(analyser$$module$mixer);
            masterGain$$module$mixer.connect(audioCtx$$module$mixer.destination);
            for (e = 0; e < urls$$module$mixer.length; ++e) trackMute$$module$mixer[e] = audioCtx$$module$mixer.createGain(), trackGain$$module$mixer[e] = audioCtx$$module$mixer.createGain(), trackPan$$module$mixer[e] =
                audioCtx$$module$mixer.createStereoPanner(), trackMute$$module$mixer[e].connect(trackGain$$module$mixer[e]), trackGain$$module$mixer[e].connect(trackPan$$module$mixer[e]), trackPan$$module$mixer[e].connect(masterGain$$module$mixer);
            $("#loadmsg").html("Loading audio files");
            $("#loadmsg").css({
                display: "block"
            });
            $("#noklik").css({
                display: "block"
            });
            return f.yield(mkAudBuffers$$module$mixer(a), 2)
        }
        $("#loadmsg").css({
            display: "none"
        });
        $("#noklik").css("display", "none");
        playbtn$$module$mixer = document.getElementById("play");
        playbtn$$module$mixer.disabled = "";
        f.jumpToEnd()
    })
}
var mixplayer$$module$mixer = {
    get currentTime() {
        return playPos$$module$mixer
    },
    set currentTime(a) {
        playing$$module$mixer && (startstop$$module$mixer(0), startstop$$module$mixer(a));
        playPos$$module$mixer = a;
        posElm$$module$mixer.innerHTML = a.toFixed(1);
        progressElm$$module$mixer.value = a / duration$$module$mixer
    },
    get paused() {
        return !playing$$module$mixer
    },
    init: function(a, b, c) {
        return initMixer$$module$mixer(a, b, c)
    },
    setTrkOrient: function(a) {
        return setTrkOrient$$module$mixer(a)
    },
    play: function() {
        playing$$module$mixer ||
            startstop$$module$mixer(playPos$$module$mixer)
    },
    pause: function() {
        playing$$module$mixer && startstop$$module$mixer(0)
    }
},
    module$mixer = {
        mixplayer: mixplayer$$module$mixer
    };
var msc_VERSION$$module$synpdf = 182,
    opt$$module$synpdf, msc_credits$$module$synpdf, times_arr$$module$synpdf, offset_js$$module$synpdf, pdf_file$$module$synpdf, media_file$$module$synpdf, pdf_data$$module$synpdf, jpg_data$$module$synpdf, tix_lb$$module$synpdf, annots$$module$synpdf, lpRec$$module$synpdf, metric_arr$$module$synpdf, play_list$$module$synpdf, adv_settings$$module$synpdf, msc_tracks$$module$synpdf, media_dir$$module$synpdf, pdfDoc$$module$synpdf, pdfData$$module$synpdf, jpgData$$module$synpdf, nPage$$module$synpdf =
        1,
    Cs$$module$synpdf = [],
    times$$module$synpdf, tixlb$$module$synpdf, lbtix$$module$synpdf, ybplayer$$module$synpdf, yubchk$$module$synpdf = 0,
    pbrates$$module$synpdf = [],
    bodyWidth$$module$synpdf, opt_url$$module$synpdf = {},
    offset$$module$synpdf = 0,
    rendering$$module$synpdf = 0,
    doresize$$module$synpdf = 0,
    resizeTimer$$module$synpdf = -1,
    gFac$$module$synpdf, mediaFnm$$module$synpdf, pdfFnm$$module$synpdf, scoreFnm$$module$synpdf, tixlb_score$$module$synpdf, bottomSpace$$module$synpdf = 500,
    annot_fontpx$$module$synpdf = 32,
    touch_tb$$module$synpdf,
    touch_moved$$module$synpdf = 0,
    touchDev$$module$synpdf = void 0,
    dottedHeight$$module$synpdf = 30,
    m1_timer$$module$synpdf, spatium$$module$synpdf, deMaten$$module$synpdf = [],
    deTijden$$module$synpdf = [],
    demix$$module$synpdf, detix$$module$synpdf, lastSynced$$module$synpdf = -1,
    deMetriek$$module$synpdf = [],
    repMaten$$module$synpdf = [],
    witArr$$module$synpdf = [],
    hasSmooth$$module$synpdf, deNot$$module$synpdf, playLstIx$$module$synpdf = 0,
    pageStfIx$$module$synpdf = [],
    fullmenu$$module$synpdf, pageNumChanged$$module$synpdf, adv_parms$$module$synpdf = {},
    xcurprev$$module$synpdf = -1,
    ycurprev$$module$synpdf = -1,
    hasMixer$$module$synpdf = 0,
    dummyPlayer$$module$synpdf = new DummyPlayer$$module$synpdf,
    TOFF$$module$synpdf = .01,
    elmed$$module$synpdf, msc_wz$$module$synpdf, doReadPdf$$module$synpdf, skipn$$module$synpdf, sok$$module$synpdf = null,
    onYouTubeAPIContinue$$module$synpdf,

    //default options for page reading//
    opt_default$$module$synpdf = {
        speed: 1,
        no_menu: 0,
        btns: 1,
        spdctl: 1,
        cropx: 0,
        drmpl: .4,
        pagewd: 1E3,
        synbox: 0,
        wpdf: 0,
        lncsr: 0,
        nomed: 0,
        noplyr: 0,
        nodash: 0,
        skipn: 0,
        drmpl2: 0.1,
        seln: 0,
        delay: 0,
        ipaddr: "",
        mstr: 0,
        bpmsr: "4-20-1",
        loop: 0,
        annot: 0,
        zwgrens: .7,
        voorna: .9,
        mtdrmpl: .8,
        dx: 5,
        fscr: 0,
        pagenum: 1,
        playbtn: 0,
        mmin: "",
        fixwd: 1E3,
        lastSynced: -2,
        eerst: 0,
        sysprf: 0,
        onestf: 0
    },
    //advanced options for identifying measures//
    adv_names$$module$synpdf = {
        drmpl: 1,
        drmpl2: 1,
        skipn: 1,
        seln: 1,
        eerst: 1,
        sysprf: 1,
        onestf: 1,
        zwgrens: 1,
        voorna: 1,
        mtdrmpl: 1,
        dx: 1,
        fixwd: 1
    };
window.onYouTubeIframeAPIReady = yubApiReady$$module$synpdf;

function initPreload$$module$synpdf() {
    //sets options to default//
    opt$$module$synpdf = opt_default$$module$synpdf;
    $("#yubuse").prop("checked", !1);
    $("#yvdlbl, #vidyub").css("display", "none");
    msc_credits$$module$synpdf = void 0;
    $("#credits").html("");
    adv_settings$$module$synpdf = metric_arr$$module$synpdf = pdf_data$$module$synpdf = tix_lb$$module$synpdf = offset_js$$module$synpdf = times_arr$$module$synpdf = void 0;
    $("#buttons").css("height", "");
    pdf_file$$module$synpdf = media_file$$module$synpdf = pdfFnm$$module$synpdf = mediaFnm$$module$synpdf =
        "";
    yubchk$$module$synpdf = 0;
    elmed$$module$synpdf = null;
    annots$$module$synpdf = [];
    initLoopRec$$module$synpdf();
    deMetriek$$module$synpdf[0] = opt$$module$synpdf.pagewd
}

function initGlobals$$module$synpdf() {
    offset$$module$synpdf = 0;
    gFac$$module$synpdf = .1;
    pdfDoc$$module$synpdf = {};
    jpgData$$module$synpdf = pdfData$$module$synpdf = null;
    (deTijden$$module$synpdf = times_arr$$module$synpdf ? times_arr$$module$synpdf : []) && deTijden$$module$synpdf.length && deTijden$$module$synpdf[0].length && (deTijden$$module$synpdf = deTijden$$module$synpdf.reduce(function(a, b) {
        return a.concat(b.slice(1))
    }), deTijden$$module$synpdf = deTijden$$module$synpdf.map(function(a, b) {
        return {
            t: a,
            mix: b
        }
    }));
    detix$$module$synpdf =
        0;
    lastSynced$$module$synpdf = -2 == opt$$module$synpdf.lastSynced ? deTijden$$module$synpdf.length - 1 : opt$$module$synpdf.lastSynced;
    doReadPdf$$module$synpdf = 0;
    repMaten$$module$synpdf = []
}

function initLoopRec$$module$synpdf() {
    lpRec$$module$synpdf = {
        loopBtn: 1,
        loopStart: 0,
        loopEnd: 7200
    }
}

function Wijzer$$module$synpdf(a, b, c, d) {
    this.width = b.width;
    this.$cvs = $(b);
    $("#notation").empty();
    this.atag = $('<div id="atag" style="display:none; position:absolute; color:red; margin-top:-1.5em; font-size:1.5em;"></div>');
    $("#notation").append(this.atag);
    this.btag = $('<div id="btag" style="display:none; position:absolute; color:red; margin-top:-1.5em; font-size:1.5em;"></div>');
    $("#notation").append(this.btag);
    b = $('<div id="rollijn" class="dashed"></div>');
    $("#notation").append(b);
    this.maatloper = $('<div class="demaat" style="background:#00d4ff; opacity:0.2; left:0px; top:0px; width:0px; height:0px"></div>');
    $("#notation").append(this.maatloper);
    this.times = a;
    this.tixlb = tixlb$$module$synpdf;
    this.cursorTime = 0;
    this.time_ix = d;
    var e = this;
    setTimeout(function() {
        e.setOffsetX.call(e)
    }, 0);
    this.line = c;
    this.repcnt = this.msre = 1;
    this.tmargin = this.lastTix = this.lastSync = 0;
    this.setTmargin();
    this.sinfo = $("#sync_info");
    this.paused = !0
}
Wijzer$$module$synpdf.prototype.drawRepTokens = function() {
    function a(a, b, c) {
        var d = b[0],
            f = b[1],
            e = b[2],
            n = b[3];
        b = c[a] || 1;
        c[a] = b + 1;
        a = deMaten$$module$synpdf[a];
        d = a.x + d * a.w + $("canvas").offset().left;
        e = $('<div class="reptkn">' + e + n + "</div>");
        e.css({
            top: a.y - 25 * b,
            left: d,
            position: "absolute",
            color: f
        });
        $("#notation").append(e)
    }
    var b = [],
        c = [];
    $(".reptkn").remove();
    repMaten$$module$synpdf.forEach(function(d) {
        a(d.jmp, d.tkj, b);
        void 0 != d.dst && a(d.dst, d.tkd, c)
    });
    $(".reptkn").toggle(!!opt$$module$synpdf.synbox)
};
Wijzer$$module$synpdf.prototype.setRepeat = function(a) {
    var b = repMaten$$module$synpdf[repMaten$$module$synpdf.length - 1];
    b && void 0 == b.dst ? (b.dst = a, b.tkd = [0, "red", "Repeat_", repMaten$$module$synpdf.length]) : (b = {}, repMaten$$module$synpdf.push(b), b.jmp = a, b.tkj = [.75, "blue", "Jump_", repMaten$$module$synpdf.length]);
    this.drawRepTokens()
};
Wijzer$$module$synpdf.prototype.setOffsetX = function() {
    var a = this.xoffset || 0;
    this.xoffset = this.$cvs.offset().left;
    0 <= this.cursorTime && this.time2x(this.cursorTime);
    if (1 < lpRec$$module$synpdf.loopBtn) {
        a -= this.xoffset;
        var b = this.atag.offset().left - a;
        this.atag.css("left", b);
        b = this.btag.offset().left - a;
        this.btag.css("left", b)
    }
    this.draw_annots(opt$$module$synpdf.annot);
    this.drawRepTokens()
};
Wijzer$$module$synpdf.prototype.time2x = function(a) {
    var b, c;
    this.cursorTime = a;
    for (b = deTijden$$module$synpdf.length - 1; 0 <= b; --b) {
        var d = deTijden$$module$synpdf[b];
        if (!(d.t > a)) {
            demix$$module$synpdf = d.mix;
            detix$$module$synpdf = b;
            if (!opt$$module$synpdf.synbox && detix$$module$synpdf == deTijden$$module$synpdf.length - 1 && !m1_timer$$module$synpdf) {
                pauseer$$module$synpdf();
                msc_wz$$module$synpdf.goMsre(1, {});
                $("body").trigger("play_end");
                break
            }
            if (c = deMaten$$module$synpdf[demix$$module$synpdf]) {
                opt$$module$synpdf.lncsr &&
                    b < deTijden$$module$synpdf.length - 1 ? (b = deTijden$$module$synpdf[b + 1], a = c.x + c.w * (a - d.t) / (b.t - d.t), d = 6) : (a = c.x, d = c.w);
                if (a == xcurprev$$module$synpdf && c.y == ycurprev$$module$synpdf) break;
                xcurprev$$module$synpdf = a;
                document.getElementById('detix-box').innerHTML = `<h3>detix: ${detix$$module$synpdf}</h3>`;
                document.getElementById('demix-box').innerHTML = `<h3>demix: ${demix$$module$synpdf}</h3>`;
                b = this.maatloper[0].style;
                b.left = a + "px";
                b.top = c.y + "px";
                b.width = d + "px";
                b.height = c.h + "px";
                c.y != ycurprev$$module$synpdf && doeRol$$module$synpdf(c.y - this.tmargin, 0);
                ycurprev$$module$synpdf = c.y;
                opt$$module$synpdf.synbox && this.showSyncInfo();
                break
            }
        }
    }
};
Wijzer$$module$synpdf.prototype.drawTags = function() {
    var a = this.width;
    var b = opt$$module$synpdf.cropx;
    for (var c in {
        atag: 1,
        btag: 1
    })
        if (c in lpRec$$module$synpdf) {
            var d = lpRec$$module$synpdf[c];
            var e = (2 * b + a) / (2 * d.c + d.w);
            e = (d.x + d.c) * e - b;
            d = d.y * a / d.w;
            this[c].css("left", e.toFixed(2) + "px");
            this[c].css("top", d.toFixed(2) + "px").text("atag" == c ? "<" : ">")
        }
};
Wijzer$$module$synpdf.prototype.doLoopTag = function(a, b, c, d, e, f) {
    function g(g, h, m) {
        opt$$module$synpdf.lncsr || (lpRec$$module$synpdf.loopStart == d + TOFF$$module$synpdf && (g = "btag", m = "loopEnd"), lpRec$$module$synpdf.loopEnd == e - TOFF$$module$synpdf && (g = "atag", m = "loopStart"), "loopStart" == m ? (a = f.x1, c = d + TOFF$$module$synpdf) : (a = f.x2, c = e - TOFF$$module$synpdf));
        lpRec$$module$synpdf[g] = {
            x: Math.floor(a),
            y: Math.floor(b),
            w: p.width,
            c: opt$$module$synpdf.cropx
        };
        lpRec$$module$synpdf.loopBtn = h;
        lpRec$$module$synpdf[m] = Math.round(100 *
            c) / 100;
        p.drawTags()
    }
    var p = this;
    switch (lpRec$$module$synpdf.loopBtn) {
        case 1:
            g("atag", 2, "loopStart");
            break;
        case 2:
            c > lpRec$$module$synpdf.loopStart && g("btag", 3, "loopEnd");
            break;
        case 3:
            var m = Math.abs(lpRec$$module$synpdf.loopStart - c);
            var n = Math.abs(lpRec$$module$synpdf.loopEnd - c);
            m < n ? g("atag", 3, "loopStart") : g("btag", 3, "loopEnd")
    }
};
Wijzer$$module$synpdf.prototype.x2time = function(a, b, c) {
    var d;
    for (d = 0; d < deMaten$$module$synpdf.length; ++d) {
        var e = deMaten$$module$synpdf[d];
        if (!(b > e.y + e.h || a > e.x + e.w)) {
            if (a < e.x) {
                keyDown$$module$synpdf({
                    key: " "
                });
                break
            }
            if (opt$$module$synpdf.synbox) {
                if (c) {
                    this.setRepeat(d);
                    break
                }
                if (!msc_wz$$module$synpdf.paused) {
                    this.keySync(0);
                    break
                }
            }
            for (b = 0; b < deTijden$$module$synpdf.length; ++b)
                if (d == deTijden$$module$synpdf[b].mix) {
                    d = deTijden$$module$synpdf[b].t;
                    var f = b < deTijden$$module$synpdf.length - 1 ? deTijden$$module$synpdf[b +
                        1].t : d + 2;
                    b = d + (f - d) * (a - e.x) / e.w;
                    c ? opt$$module$synpdf.loop && this.doLoopTag(a, e.y, b, d, f, {
                        x1: e.x,
                        x2: e.x + e.w
                    }) : (b = (opt$$module$synpdf.lncsr ? b : d + TOFF$$module$synpdf) + offset$$module$synpdf, playPause2$$module$synpdf(!1, b));
                    break
                } break
        }
    }
};
Wijzer$$module$synpdf.prototype.keySync = function(keyType) {
    if (opt$$module$synpdf.synbox) {
        this.paused && keyDown$$module$synpdf({
            key: " "
        });
        let currentTime = (yubchk$$module$synpdf ? elmed$$module$synpdf.getCurrentTime() : elmed$$module$synpdf.currentTime) - offset$$module$synpdf - .2;
        currentTime = Math.round(1E3 * currentTime) / 1E3;
        var detix = detix$$module$synpdf + 1;
        var demix = demix$$module$synpdf + 1;
        if (void 0 == deTijden$$module$synpdf[detix]) {
            if (deTijden$$module$synpdf[detix$$module$synpdf] && .2 > currentTime - deTijden$$module$synpdf[detix$$module$synpdf].t) {
                alert("you pressed B less then 0.2 secs after the previous bar line");
                return
            }
            deTijden$$module$synpdf[detix] = {};
            lastSynced$$module$synpdf = detix;
        } else {

            // If B was pressed in first half measure then change current measure start time, if in second half, change next measure.
            // var d = deTijden$$module$synpdf[detix$$module$synpdf].t;
            // .5 > (a - d) / (deTijden$$module$synpdf[b].t - d) && (b = detix$$module$synpdf, c = demix$$module$synpdf)
            if (keyType === 'b') {
                detix = detix$$module$synpdf + 1;
                demix = demix$$module$synpdf + 1;
            }
            if (keyType === 'c') {
                detix = detix$$module$synpdf;
                demix = demix$$module$synpdf;
            }
        }
        0 == detix && (offset$$module$synpdf = currentTime, currentTime -= offset$$module$synpdf);
        repMaten$$module$synpdf.length && repMaten$$module$synpdf[0].jmp == demix$$module$synpdf && (demix = repMaten$$module$synpdf.shift().dst, this.drawRepTokens());
        deTijden$$module$synpdf[detix].t = currentTime;
        deTijden$$module$synpdf[detix].mix = demix;
        this.time2x(currentTime);
        demix ==
            deMaten$$module$synpdf.length - 1 && (opt$$module$synpdf.synbox = 0, syncChk$$module$synpdf(), $("#synbox").prop("checked", !1), pauseer$$module$synpdf(), playPause2$$module$synpdf(!1, TOFF$$module$synpdf + offset$$module$synpdf))
    }
};
Wijzer$$module$synpdf.prototype.goMsre = function(a, b) {
    0 == deTijden$$module$synpdf.length || b.altKey || b.ctrlKey || b.shiftKey || b.metaKey || (b.preventDefault && b.preventDefault(), detix$$module$synpdf += a ? 1 : -1, 0 > detix$$module$synpdf && (detix$$module$synpdf = deTijden$$module$synpdf.length - 1), detix$$module$synpdf >= deTijden$$module$synpdf.length && (detix$$module$synpdf = 0), playPause2$$module$synpdf(!1, deTijden$$module$synpdf[detix$$module$synpdf].t + TOFF$$module$synpdf + offset$$module$synpdf))
};
Wijzer$$module$synpdf.prototype.goUpDown = function(a, b, c) {
    if (b && opt$$module$synpdf.advncd) c = 1 * opt$$module$synpdf.pagenum, opt$$module$synpdf.pagenum = a ? c + 1 : c - 1, setPagenum$$module$synpdf(c);
    else {
        var d = {},
            e;
        if (!(c.altKey || c.ctrlKey || c.shiftKey || c.metaKey)) {
            c.preventDefault && c.preventDefault();
            deMaten$$module$synpdf.forEach(function(a) {
                return d[a.y + a.h] = 1
            });
            d = Object.keys(d).sort(function(a, b) {
                return a - b
            });
            var f = deMaten$$module$synpdf[demix$$module$synpdf];
            c = f.x + f.w / 2;
            for (e = 0; d[e] < f.y;) e += 1;
            if (b) {
                for (b =
                    0; b <= pageStfIx$$module$synpdf.length && e >= pageStfIx$$module$synpdf[b]; ++b);
                a ? b == pageStfIx$$module$synpdf.length && (b = 0) : (b -= 2, 0 > b && (b = pageStfIx$$module$synpdf.length - 1));
                a = d[pageStfIx$$module$synpdf[b]] - 5
            } else a ? (a = d[e + 1] - 5, e == d.length - 1 && (a = d[0] - 5)) : (0 == e && (e = d.length), a = d[e - 1]);
            this.x2time(c, a, !1)
        }
    }
};
Wijzer$$module$synpdf.prototype.showSyncInfo = function() {
    this.sinfo.html("duration&nbsp;measure: " + (detix$$module$synpdf < deTijden$$module$synpdf.length - 1 ? deTijden$$module$synpdf[detix$$module$synpdf + 1].t - deTijden$$module$synpdf[detix$$module$synpdf].t : 0).toFixed(3) + " sec.<br>");
    this.sinfo.append("media&nbsp;offset: " + offset$$module$synpdf.toFixed(3) + " sec.")
};
Wijzer$$module$synpdf.prototype.changeTimesKeyb = function(a) {
    if (!(detix$$module$synpdf >= deTijden$$module$synpdf.length - 1)) {
        var b = deTijden$$module$synpdf[detix$$module$synpdf + 1];
        b.t += a;
        b.t = Math.round(1E3 * b.t) / 1E3
    }
};
Wijzer$$module$synpdf.prototype.changeOffset = function(a) {
    offset$$module$synpdf += a;
    offset$$module$synpdf = Math.round(1E3 * offset$$module$synpdf) / 1E3;
    for (var b = 1; b < deTijden$$module$synpdf.length; ++b) {
        var c = deTijden$$module$synpdf[b];
        c.t -= a;
        c.t = Math.round(1E3 * c.t) / 1E3
    }
};
Wijzer$$module$synpdf.prototype.startSync = function() {
    deTijden$$module$synpdf.splice(lastSynced$$module$synpdf + 1);
    lastSynced$$module$synpdf = deTijden$$module$synpdf.length - 1;
    //lastSynced$$module$synpdf = 9999;
    if (-1 == lastSynced$$module$synpdf) {
        $(".demaat").css({
            width: "0px",
            x: "0px"
        });
        xcurprev$$module$synpdf = -1;
        deTijden$$module$synpdf = [];
        for (var a = 0; a < detix$$module$synpdf; ++a) deTijden$$module$synpdf.push({
            t: 0,
            mix: a
        });
        --detix$$module$synpdf;
        --demix$$module$synpdf;
        offset$$module$synpdf = 0;
        playPause2$$module$synpdf(!1, 0)
    } else a = deTijden$$module$synpdf[lastSynced$$module$synpdf],
        a.mix < deMaten$$module$synpdf.length - 1 && playPause2$$module$synpdf(!1, a.t + TOFF$$module$synpdf + offset$$module$synpdf)
};
Wijzer$$module$synpdf.prototype.setTmargin = function() {
    var a = $("#notation").offset().top,
        b = $("#rollijn").offset().top;
    b < a && (b = a + 15, $("#rollijn").css("top", b + "px"));
    var c = deMaten$$module$synpdf[demix$$module$synpdf] || deMaten$$module$synpdf[0];
    b > c.y + a && (b = a + c.y - dottedHeight$$module$synpdf, $("#rollijn").css("top", b + "px"));
    var d = $("#notation").height();
    b + 2 * dottedHeight$$module$synpdf > a + d && (b = a + d - 2 * dottedHeight$$module$synpdf, $("#rollijn").css("top", b + "px"));
    this.tmargin = dottedHeight$$module$synpdf + b - a;
    doeRol$$module$synpdf(c.y - this.tmargin, 1)
};

Wijzer$$module$synpdf.prototype.compCountIn = function() {
    var a = {
        time: 2.5,
        num: 4
    },
        b = opt$$module$synpdf.bpmsr.split("-").map(function(a) {
            return parseInt(a)
        });
    a.time = (deTijden$$module$synpdf[detix$$module$synpdf + 1].t - deTijden$$module$synpdf[detix$$module$synpdf].t) / b[0] / opt$$module$synpdf.speed;
    a.num = b[0];
    return a
};
Wijzer$$module$synpdf.prototype.annot = function(a, b) {
    var c = Math.floor(annot_fontpx$$module$synpdf * msc_wz$$module$synpdf.width / 1E3);
    a = Math.floor(a) - 10;
    b = Math.floor(b) - c / 2;
    annots$$module$synpdf.push({
        x: a,
        y: b,
        w: this.width,
        c: opt$$module$synpdf.cropx,
        t: "click to edit this text",
        d: 0
    });
    this.draw_annots(1)
};
Wijzer$$module$synpdf.prototype.draw_annots = function(a) {
    var b;
    $(".ant").remove();
    var c = msc_wz$$module$synpdf.width;
    var d = opt$$module$synpdf.cropx;
    var e = Math.floor(annot_fontpx$$module$synpdf * c / 1E3);
    annots$$module$synpdf = annots$$module$synpdf.filter(function(a) {
        return 0 == a.d
    });
    for (b = 0; b < annots$$module$synpdf.length; ++b) {
        var f = annots$$module$synpdf[b];
        var g = (2 * d + c) / (2 * f.c + f.w);
        g = (f.x + f.c) * g - d;
        var p = f.y * c / f.w;
        var m = $('<div class="ant"></div>');
        m.css("font-size", e + "px");
        m.css("left", g.toFixed(2) + "px");
        m.css("top", p.toFixed(2) + "px").html(f.t);
        m.css({
            position: "absolute",
            background: "none",
            "user-select": "none"
        });
        m.attr("id", "ant" + b);
        m.on(touchDev$$module$synpdf ? "touchstart" : "mousedown", annot_move$$module$synpdf);
        m.toggleClass("annmov", 1 == a);
        $("#notation").append(m)
    }
};

function DummyPlayer$$module$synpdf() {
    this.paused = !0;
    this.currentTime = 0;
    this.klok = -1;
    this.step = 200;
    this.playing = 0;
    initPbRates$$module$synpdf(.1, 2, .05)
}
DummyPlayer$$module$synpdf.prototype.pause = function() {
    this.clearKlok();
    this.paused = !0;
    this.klok = -1;
    hasMixer$$module$synpdf && setPauseState$$module$synpdf(1)
};
DummyPlayer$$module$synpdf.prototype.play = function() {
    this.paused = !1;
    if (-1 == this.klok)
        if (hasMixer$$module$synpdf) setPauseState$$module$synpdf(0);
        else {
            var a = this;
            this.setKlok(function() {
                a.currentTime += a.step / 1E3 * opt$$module$synpdf.speed;
                tick$$module$synpdf()
            }, this.step)
        }
};
DummyPlayer$$module$synpdf.prototype.setKlok = function(a, b) {
    -1 != this.klok && clearInterval(this.klok);
    this.klok = a ? setInterval(a, b) : -1;
    this.paused = !1
};
DummyPlayer$$module$synpdf.prototype.clearKlok = function() {
    -1 != this.klok && clearInterval(this.klok);
    this.klok = -1;
    this.paused = !0;
    tick$$module$synpdf()
};

function getPage$$module$synpdf(a) {
    for (var b = 1, c = 0; c <= a && b < deMetriek$$module$synpdf.length;) c += deMetriek$$module$synpdf[b].bxs.reduce(function(a, b) {
        return a + b.length - 1
    }, 0), b += 1;
    return b - 1
}

function page2msr$$module$synpdf(a) {
    var b, c = 0;
    for (b = 1; b < a; ++b) c += deMetriek$$module$synpdf[b].bxs.reduce(function(a, b) {
        return a + b.length - 1
    }, 0);
    return c

}

function schakelParms$$module$synpdf(a, b) {
    adv_parms$$module$synpdf[a] = {};
    b = adv_parms$$module$synpdf[b];
    for (var c in adv_names$$module$synpdf)
        if (adv_parms$$module$synpdf[a][c] = opt$$module$synpdf[c], b) {
            opt$$module$synpdf[c] = b[c];
            var d = document.getElementById(c);
            "checkbox" == d.type && (d.checked = opt$$module$synpdf[c]);
            "number" == d.type && (d.value = opt$$module$synpdf[c])
        }
}

function setPagenum$$module$synpdf(a) {
    1 > opt$$module$synpdf.pagenum && (opt$$module$synpdf.pagenum = pdfDoc$$module$synpdf.numPages);
    opt$$module$synpdf.pagenum > pdfDoc$$module$synpdf.numPages && (opt$$module$synpdf.pagenum = 1);
    $("#pagenum").val(opt$$module$synpdf.pagenum);
    schakelParms$$module$synpdf(a, opt$$module$synpdf.pagenum);
    elmed$$module$synpdf.currentTime = 0;
    pageNumChanged$$module$synpdf = 1;
    resizePdfSyn$$module$synpdf()
}



function doeRol$$module$synpdf(a, b) {
    if (disableScrollingCheck === 1) return;

    if (0 > a) {
        a = deMaten$$module$synpdf[demix$$module$synpdf] || deMaten$$module$synpdf[0];
        deNot$$module$synpdf.scrollTop = 0;
        $("#rollijn").css("top", a.y + $("#notation").offset().top - dottedHeight$$module$synpdf - 1);
        msc_wz$$module$synpdf && msc_wz$$module$synpdf.setTmargin();
    } else {
        a = Math.round(a);
        if (deNot$$module$synpdf.scrollTop != a) {
            if (hasSmooth$$module$synpdf) {
                deNot$$module$synpdf.style["scroll-behavior"] = b ? "auto" : "smooth";
            }
            if (b || hasSmooth$$module$synpdf) {
                deNot$$module$synpdf.scrollTop = a;
            } else {
                $(deNot$$module$synpdf).animate({
                    scrollTop: a
                });
            }
        }
    }
}



function toggleScoreBtn$$module$synpdf() {
    var a = $("#pdflbl"),
        b = a.html(),
        c = $("#impbox").prop("checked");
    a.toggleClass("preimp", c);
    a.html(c ? b.replace("pdf file", "<b>import</b>") : b.replace("<b>import</b>", "pdf file"));
    c && !opt$$module$synpdf.btns && $("#btns").click()
}

function copyTiming$$module$synpdf(a, b) {
    if (0 > a.indexOf("//# This page")) alert("not a preload file");
    else {
        b && (a = arrbuf2str$$module$synpdf(b));
        a = a.replace(/\n/g, "");
        (b = a.match(/media_file = "([^"]*)";/)) && (media_file$$module$synpdf = b[1]);
        if (b = a.match(/yubvid":"([^"]*)"/)) opt$$module$synpdf.yubvid = b[1];
        (b = a.match(/offset_js = ([^;]*);/)) && (offset$$module$synpdf = offset_js$$module$synpdf = parseFloat(b[1]));
        (b = a.match(/times_arr = ([^;]*);/)) && (times$$module$synpdf = JSON.parse(b[1]));
        deTijden$$module$synpdf =
            times$$module$synpdf;
        detix$$module$synpdf = 0;
        lastSynced$$module$synpdf = deTijden$$module$synpdf.length - 1;
        msc_wz$$module$synpdf && playPause2$$module$synpdf(!1, TOFF$$module$synpdf + offset$$module$synpdf);
        $("#impbox").click().change();
        $("#wait").css("display", "none");
        media_file$$module$synpdf && setPlayer$$module$synpdf(media_file$$module$synpdf, media_file$$module$synpdf);
        opt$$module$synpdf.yubvid && setPlayer$$module$synpdf("", "")
    }
}

function knip$$module$synpdf(a, b, c) {
    var d = JSON.parse(JSON.stringify(b.cxs));
    b = JSON.parse(JSON.stringify(b.bxs));
    d.forEach(function(a) {
        a.cs = a.cs.map(function(a) {
            return 1 * a + c;
        })
    });
    var e;
    for (e = 0; e < d.length; ++e) {
        var f = d[e].cs;
        var g = f[0];
        var p = f[f.length - 1];
        var m = b[e];
        for (f = 0; f < m.length - 1; ++f) {
            var n = m[f];
            var l = m[f + 1];
            deMaten$$module$synpdf.push({
                x: n,
                y: g,
                w: l - n,
                h: p - g
            })
        }
    }
    for (e = deTijden$$module$synpdf.length; e < deMaten$$module$synpdf.length; ++e) deTijden$$module$synpdf.push({
        t: 0 < e ? deTijden$$module$synpdf[e - 1].t +
            2 : 0,
        mix: e
    });
    return a
}

function addDummySys$$module$synpdf() {
    var a = Cs$$module$synpdf[Cs$$module$synpdf.length - 1],
        b = a.xs.x2;
    Cs$$module$synpdf.push({
        cs: [a.cs[0], a.cs[a.cs.length - 1]],
        xs: {
            x1: b,
            x2: b - 4
        }
    });
    $("#render").toggle(!1);
    a = deMaten$$module$synpdf[deMaten$$module$synpdf.length - 1];
    deMaten$$module$synpdf.push({
        x: a.x + a.w,
        y: a.y,
        w: 2,
        h: a.h
    });
    a = deTijden$$module$synpdf.length;
    a < deMaten$$module$synpdf.length && deTijden$$module$synpdf.push({
        t: deTijden$$module$synpdf[a - 1].t + 2,
        mix: a
    });
    // $("#notation").append('<div id="leeg" style="height:' + bottomSpace$$module$synpdf +
    //     'px">&nbsp;</div>');
    msc_wz$$module$synpdf && msc_wz$$module$synpdf.setTmargin()
}

function readPdfdoc$$module$synpdf() {
    opt$$module$synpdf.pagewd = opt$$module$synpdf.advncd ? opt$$module$synpdf.fixwd : deNot$$module$synpdf.clientWidth;
    schaalMetriek$$module$synpdf();
    Cs$$module$synpdf = [];
    pageStfIx$$module$synpdf = [];
    deMaten$$module$synpdf = [];
    demix$$module$synpdf = 0;
    msc_wz$$module$synpdf = null;
    skipn$$module$synpdf = parseInt(opt$$module$synpdf.skipn);
    rendering$$module$synpdf = 1;
    $("#render").html("rendering ...").toggle(!0);
    pdfDoc$$module$synpdf.src ? setTimeout(function() {  // tries jpeg first, then reads as pdf
        goJpeg$$module$synpdf(0)
    },
        100) : goPage$$module$synpdf(1, 0)
}

function readPdf$$module$synpdf(a, b) {
    initGlobals$$module$synpdf();

    var c = a,
        d;

    if (b === "url") {
        d = /jpe?g$/i.test(c);
    }

    if (b === "pdfbin") {
        a = new Uint8Array(a);
    }

    if (b === "jpgbin") {
        jpgData = new Uint8Array(a);
        b = "url";
        c = new Blob([a], { type: "image/jpeg" });
        c = URL.createObjectURL(c);
    }

    if (b === "url" && (d || /^blob:/.test(c))) {
        pdfDoc$$module$synpdf = new Image();
        pdfDoc$$module$synpdf.crossOrigin = "anonymous";
        pdfDoc$$module$synpdf.src = c;
        pdfDoc$$module$synpdf.onload = function() {
            readPdfdoc$$module$synpdf();
        };
    } else {
        pdfjsLib.getDocument(a).promise.then(function(a) {
            pdfDoc$$module$synpdf = a;
            $("#pagenum").attr("max", pdfDoc$$module$synpdf.numPages);
            readPdfdoc$$module$synpdf();
        });
    }
}

function goPage$$module$synpdf(a, b) {
    opt$$module$synpdf.advncd && (a = 1 * opt$$module$synpdf.pagenum);  // If advanced mode is on, set the page number to the predefined value
    pdfDoc$$module$synpdf.getPage(a).then(function(page) {
        $("#render").html("rendering page: " + a + "/" + pdfDoc$$module$synpdf._pdfInfo.numPages);  // Update the HTML element with id='render' with the page number
        var d = page.getViewport({ scale: (deMetriek$$module$synpdf[0] / page._pageInfo.view[2]) });
        var e = document.createElement("canvas");  // Create a canvas element
        var f = e.getContext("2d");
        e.height = d.height;  // Set the dimensions of the canvas to match the page size
        e.width = d.width;
        page.render({  // Render the PDF page into the canvas
            canvasContext: f,
            viewport: d
        }).promise.then(function() {  // After rendering, proceed to further process the page
            e = compPage$$module$synpdf(e, a, b);
            if (opt$$module$synpdf.advncd) {  // Continue based on global condition variables
                rendering$$module$synpdf = 0;
                addDummySys$$module$synpdf();
            } else {
                if (doresize$$module$synpdf) {
                    resizePdf$$module$synpdf();
                } else {
                    if (a < pdfDoc$$module$synpdf.numPages) {
                        goPage$$module$synpdf(a + 1, b + e.height);
                    } else {
                        rendering$$module$synpdf = 0;
                        addDummySys$$module$synpdf();
                    }
                }
            }
        })
    })
}
//Check for disable scrolling at end of compPage. Otherwise this messes up the doeRol scrolling line.
let disableScrollingCheck = 0;
function disableScrolling() {
    window.scrollTo(0, initialScrollTop);
}
function compPage$$module$synpdf(a, b, c) {
    var d = deMetriek$$module$synpdf[b];
    if (!d || opt$$module$synpdf.advncd && !pageNumChanged$$module$synpdf) {
        d = countPix$$module$synpdf(a, parseInt(opt$$module$synpdf.seln));
        if (0 == d.cxs.length) return {
            height: 0
        };
        deMetriek$$module$synpdf[b] = d
    }
    pageNumChanged$$module$synpdf = 0;
    a = knip$$module$synpdf(a, d, c);
    pageStfIx$$module$synpdf.push(Cs$$module$synpdf.length);
    Cs$$module$synpdf = Cs$$module$synpdf.concat(d.cxs);
    msc_wz$$module$synpdf || startIntf$$module$synpdf(a);
    $("#notation").append(a);
    $(a).on("mousedown touchstart", kliklang$$module$synpdf);
    deMaten$$module$synpdf.length >= demix$$module$synpdf && msc_wz$$module$synpdf.cursorTime && msc_wz$$module$synpdf.time2x(msc_wz$$module$synpdf.cursorTime);
    maatStrepen$$module$synpdf();
    if (disableScrollingCheck === 1) disableScrolling();
    return a
}

function goJpeg$$module$synpdf(a) {   //allows loading of jpeg sheet music
    var b = document.createElement("canvas"),
        c = b.getContext("2d"),
        d = deMetriek$$module$synpdf[0] / pdfDoc$$module$synpdf.width;
    b.height = pdfDoc$$module$synpdf.height * d;
    b.width = pdfDoc$$module$synpdf.width * d;
    c.drawImage(pdfDoc$$module$synpdf, 0, 0, pdfDoc$$module$synpdf.width, pdfDoc$$module$synpdf.height, 0, 0, b.width, b.height);
    compPage$$module$synpdf(b, 1, a);
    rendering$$module$synpdf = 0;
    addDummySys$$module$synpdf()
}

function tick$$module$synpdf(a) {
    if (elmed$$module$synpdf && msc_wz$$module$synpdf && (!yubchk$$module$synpdf || elmed$$module$synpdf == ybplayer$$module$synpdf)) {
        var b = (yubchk$$module$synpdf ? elmed$$module$synpdf.getCurrentTime() : elmed$$module$synpdf.currentTime) - offset$$module$synpdf;
        var c = b;
        opt$$module$synpdf.loop && (b > lpRec$$module$synpdf.loopEnd && (b = lpRec$$module$synpdf.loopStart), b < lpRec$$module$synpdf.loopStart && (b =
            lpRec$$module$synpdf.loopStart + TOFF$$module$synpdf), b != c && (yubchk$$module$synpdf ? elmed$$module$synpdf.seekTo(b + offset$$module$synpdf, !0) : elmed$$module$synpdf.currentTime = b + offset$$module$synpdf));
        !msc_wz$$module$synpdf || a && 0 != a % 10 || msc_wz$$module$synpdf.time2x(b)
    }
}

function kliklang$$module$synpdf(a) {
    void 0 == touchDev$$module$synpdf && (touchDev$$module$synpdf = "touchstart" == a.type);
    var b = touchDev$$module$synpdf ? $(this) : $("body");
    a.stopPropagation();
    if (hideMenuHelp$$module$synpdf(0) || touchDev$$module$synpdf && "mousedown" == a.type) a.preventDefault();
    else {
        touch_moved$$module$synpdf = 0;
        a = touchDev$$module$synpdf ? a.originalEvent.changedTouches[0] : a;
        var c = a.clientY,
            d = a.clientX;
        touch_tb$$module$synpdf = (new Date).getTime();
        var e = a.shiftKey;
        b.on(touchDev$$module$synpdf ? "touchmove" :
            "mousemove",
            function(a) {
                a.stopPropagation();
                a = touchDev$$module$synpdf ? a.originalEvent.changedTouches[0] : a;
                touch_moved$$module$synpdf = 10 < Math.abs(a.clientY - c) + Math.abs(a.clientX - d)
            });
        b.on(touchDev$$module$synpdf ? "touchend" : "mouseup", function(a) {
            a.stopPropagation();
            a.preventDefault();
            b.off("mousemove touchmove mouseup touchend");
            if (!touch_moved$$module$synpdf) {
                a = touchDev$$module$synpdf ? a.originalEvent.changedTouches[0] : a;
                var c = 500 < (new Date).getTime() - touch_tb$$module$synpdf || e;
                var d = a.clientX;
                d -= msc_wz$$module$synpdf.xoffset;
                a = a.clientY;
                a -= $("#notation").offset().top;
                a += $("#notation").scrollTop();
                c && opt$$module$synpdf.annot ? msc_wz$$module$synpdf.annot(d, a) : msc_wz$$module$synpdf.x2time(d, a, c)
            }
        })
    }
}

function annot_move$$module$synpdf(a) {
    if (opt$$module$synpdf.annot) {
        var b = $(this);
        void 0 == touchDev$$module$synpdf && (touchDev$$module$synpdf = "touchstart" == a.type);
        var c = touchDev$$module$synpdf ? b : $("body"),
            d = parseInt(b.attr("id").replace("ant", ""));
        a.stopPropagation();
        a.preventDefault();
        a = touchDev$$module$synpdf ? a.originalEvent.changedTouches[0] : a;
        var e = $("#notation").scrollTop() - $("#notation").offset().top,
            f = $(this).offset(),
            g = a.clientX - f.left,
            p = a.clientY - f.top,
            m = a.clientY,
            n = a.clientX,
            l = a.shiftKey;
        touch_moved$$module$synpdf = 0;
        touch_tb$$module$synpdf = (new Date).getTime();
        c.on(touchDev$$module$synpdf ? "touchmove" : "mousemove", function(a) {
            a.stopPropagation();
            a.preventDefault();
            a = touchDev$$module$synpdf ? a.originalEvent.changedTouches[0] : a;
            if (touch_moved$$module$synpdf = 10 < Math.abs(a.clientY - m) + Math.abs(a.clientX - n)) {
                var c = a.clientY - p;
                a = a.clientX - g;
                b.css({
                    top: e + c + "px",
                    left: a - msc_wz$$module$synpdf.xoffset + "px"
                });
                var f = annots$$module$synpdf[d];
                f.w = msc_wz$$module$synpdf.width;
                f.c = opt$$module$synpdf.cropx;
                f.x = Math.round(100 * (a - msc_wz$$module$synpdf.xoffset)) / 100;
                f.y = Math.round(100 * (c + e)) / 100
            }
        });
        c.on(touchDev$$module$synpdf ? "touchend" : "mouseup", function(a) {
            a.stopPropagation();
            a.preventDefault();
            if (!touch_moved$$module$synpdf) {
                var d = (new Date).getTime() - touch_tb$$module$synpdf;
                a = parseInt(b.attr("id").replace("ant", ""));
                500 > d && !l ? (d = prompt("Edit the annotation", annots$$module$synpdf[a].t), null != d && (annots$$module$synpdf[a].t = d.length ? d : "right click on annotation deletes!", msc_wz$$module$synpdf.draw_annots(1))) :
                    confirm("Do you really want to delete this annotation?") && (annots$$module$synpdf[a].d = 1, b.remove())
            }
            c.off("mousemove touchmove mouseup touchend")
        })
    }
}

function startIntf$$module$synpdf(a) {
    elmed$$module$synpdf || (elmed$$module$synpdf = dummyPlayer$$module$synpdf);
    msc_wz$$module$synpdf = new Wijzer$$module$synpdf(times$$module$synpdf, a, msc_wz$$module$synpdf ? msc_wz$$module$synpdf.line : 0, msc_wz$$module$synpdf ? msc_wz$$module$synpdf.time_ix : 1);
    $("#wait").css("display", "none");
    $("#rollijn").on("mousedown touchstart", lijn_shift$$module$synpdf);
    opt$$module$synpdf.offrol && $("#rollijn").css("top", opt$$module$synpdf.offrol);
    doresize$$module$synpdf = 0;
    setTimeout(setLoop$$module$synpdf,
        0)
}

function resizePdf$$module$synpdf() {
    pdfDoc$$module$synpdf && ($("#wait").text("Recomputing systems ..."), $("#wait").css({
        display: "block",
        background: "rgb(200,200,255)"
    }), readPdfdoc$$module$synpdf())
}

function resizePdfSyn$$module$synpdf() {
    rendering$$module$synpdf ? (doresize$$module$synpdf = 1, $("#wait").html("Resize waits on rendering ..."), $("#wait").css({
        display: "block",
        background: "rgb(255,200,200)"
    })) : resizePdf$$module$synpdf()
}

function drawRes$$module$synpdf(a, b, c) {
    function d(a, b) {
        for (var c, d; 5 < a.length;)
            if (c = a.length - 1, d = a[1] - a[0], c = a[c] - a[c - 1], d > b + 1 || d < b - 1) a.shift();
            else if (c > b + 1 || c < b - 1) a.pop();
            else break;
        a[a.length - 1] - a[0] < 2 * b && (a = []);
        return a
    }
    a = function(a) {
        var b, c = a[0],
            d = 0,
            e = 0,
            f = 0,
            h = 0,
            k = [];
        a.push(a[a.length - 1] - 2);
        for (b = 0; b < a.length; b++) {
            var r = a[b];
            var q = r - c;
            1 > q && -1 < q || (0 < q ? q > d && (d = q, f = b) : (0 == d && q < e && (e = q, h = b), 0 < d && (-e > d && (d = -e), k.push({
                y: f,
                t: d,
                d: f - h
            }), d = 0, e = q, f = h = b)), c = r)
        }
        return k
    }(a);
    var e = a.map(function(a) {
        return a.t
    }).sort(function(a,
        b) {
        return b - a
    }).slice(0, 10).reduce(function(a, b) {
        return a + b
    }, 0) / 10 * opt$$module$synpdf.drmpl;
    a = a.filter(function(a) {
        return a.t >= e
    });
    b = function(a, b) {
        var c = 0,
            d = {};
        for (b = 0; b < a.length; ++b) {
            var e = a[b].y;
            c = e - c;
            d[c] = (d[c] || 0) + 1;
            c = e
        }
        a = Object.keys(d).sort(function(a, b) {
            return d[b] - d[a]
        });
        return parseInt(a[0])
    }(a, b);
    annot_fontpx$$module$synpdf = 4 * b;
    spatium$$module$synpdf = b;
    b = function(a, b) {
        var c = 4,
            e, f = a[0].y,
            g = [],
            h = [f];
        for (e = 1; e < a.length; ++e) {
            var k = a[e].y;
            if (k - f <= c * b + 2) switch (h.push(k), h.length) {
                case 1:
                    break;
                case 2:
                    c = 3;
                    break;
                case 3:
                    c = 2;
                    break;
                default:
                    c = 1
            } else h = d(h, b), h.length && g.push(h), c = 3, h = [k];
            f = k
        }
        h = d(h, b);
        h.length && g.push(d(h, b));
        return g
    }(a, b);
    b.map(function(a) {
        return a.reduce(function(a, b) {
            return a + b
        }) / a.length
    });
    return b
}

function countPix$$module$synpdf(image, sliceIndex) {
    var pixelIndex, avgRowColor;  // Define the local variables
    var imageWidth = image.width;  // Get the width of the image
    var g = 4 * imageWidth;  // Multiply width by 4 for later calculations
    var imageHeight = image.height;  // Get the height of the image
    var imagePixelData = image.getContext("2d").getImageData(0, 0, imageWidth, imageHeight).data;  // Extract the image data (RGBA values for each pixel)
    var currentPixelOffset = 0;  // Initialize variables for the upcoming loop
    var colorIntensityArray = [];
    var loopStartOffset = 3 * g / 4, loopEndOffset = g;  // Some calculations for the loop parameters
    opt$$module$synpdf.eerst && (loopStartOffset = 0, loopEndOffset = g / 4);  // Change loop offsets based on opt$$module$synpdf.eerst
    for (currentRow = 0; currentRow < imageHeight; currentRow++) {  // Go through each row in the image
        var colorSum = 0;  // Initialize colorSum, which will contain sum of pixels' color
        for (pixelIndex = currentPixelOffset + loopStartOffset; pixelIndex < currentPixelOffset + loopEndOffset; pixelIndex += 4)
            colorSum += imagePixelData[pixelIndex], colorSum += imagePixelData[pixelIndex + 1], colorSum += imagePixelData[pixelIndex + 2];  // Calculate the average color value in each row
        avgRowColor = colorSum / (3 * (loopEndOffset - loopStartOffset));  // Get an average color value
        colorIntensityArray.push(avgRowColor);  // Add this value into colorIntensityArray
        currentPixelOffset += g  // Increase currentPixelOffset for the next iteration
    }
    let drawResResult = drawRes$$module$synpdf(colorIntensityArray, imageWidth, imageHeight);  // Draw the results of the pixel analysis
    for (drawResResult = countVsys$$module$synpdf(drawResResult, g, imagePixelData); drawResResult.length && skipn$$module$synpdf;) drawResResult.shift(), --skipn$$module$synpdf;  // Further process the image data
    sliceIndex && (drawResResult = drawResResult.slice(sliceIndex - 1, sliceIndex));  // Slice the results based on parameter 'b'
    sliceIndex = findBarLines$$module$synpdf(drawResResult, g, imagePixelData);  // Find bar lines
    return {
        cxs: drawResResult,  // Return the results
        bxs: sliceIndex
    }
}

function countVsys$$module$synpdf(a, b, c) {
    var d, e, f, g = [],
        p = [],
        m = [];
    for (f = 0; f < a.length; ++f) {
        var n = a[f][0];
        var l = a[f][a[f].length - 1];
        var h = [];
        for (d = 0; d < b; d += 4) {
            var k = 0;
            for (e = n * b + d; e < l * b + d; e += b) k += c[e], k += c[e + 1], k += c[e + 2];
            h.push(k / (3 * (l - n)))
        }
        for (d = k = 0; d < h.length; ++d) h[d] > k && (k = h[d]);
        witArr$$module$synpdf[f] = k * opt$$module$synpdf.zwgrens;
        d = Math.floor(h.length / 2);
        e = d + d / 2;
        for (n = 0; d < e; d++) l = h[d], l > k - 10 && (n += 1);
        if (!(5 < n) || opt$$module$synpdf.eerst) {
            g.push(a[f]);
            l = [];
            for (d = 0; d < h.length;)
                if (h[d] > k - 15) d += 1;
                else {
                    for (e =
                        d; d < h.length && h[d] <= k - 5;) d += 1;
                    l.push([e, d - 1])
                } l.sort(function(a, b) {
                    return b[1] - b[0] - (a[1] - a[0])
                });
            h = l[0][0];
            d = l[0][1];
            m.push({
                x1: h,
                x2: d
            })
        }
    }
    a = g;
    g = [];
    if (0 == a.length) return a;
    for (f = 0; f < a.length - 1; ++f) {
        l = a[f][a[f].length - 1];
        n = a[f + 1][0];
        h = [];
        for (d = 0; d < b; d += 4) {
            k = 0;
            for (e = l * b + d; e < n * b + d; e += b) k += c[e], k += c[e + 1], k += c[e + 2];
            h.push(k / (3 * (n - l)))
        }
        e = h[0];
        for (d = k = 0; d < h.length; d++) l = h[d], e = Math.abs(l - e), 10 < e && e > k && (k = e), e = l;
        0 < k && p.push(k)
    }
    f = p.slice();
    f.sort(function(a, b) {
        return a - b
    });
    d = f[0];
    h = f[f.length - 1];
    b = d;
    c = h;
    d = [d];
    l = [h];
    $("#sysprf").prop("checked") && f.reverse();
    for (k = 1; k < f.length - 1; ++k) h = f[k], h - b > c - h ? l.push(h) : d.push(h), b = d.reduce(function(a, b) {
        return a + b
    }, 0) / d.length, c = l.reduce(function(a, b) {
        return a + b
    }, 0) / l.length;
    d = c > opt$$module$synpdf.drmpl2 * b && 5 * l.length > d.length && !opt$$module$synpdf.onestf;
    for (f = 0; f < a.length - 1; ++f) h = p[f], d & h - b > c - h || 0 == opt$$module$synpdf.drmpl2 ? a[f + 1] = a[f].concat(a[f + 1]) : g.push({
        cs: a[f],
        xs: m[f]
    });
    g.push({
        cs: a[f],
        xs: m[f]
    });
    return g
}

function findBarLines$$module$synpdf(a, b, c) {
    var d, e, f, g, p = opt$$module$synpdf.mtdrmpl,
        m = opt$$module$synpdf.voorna,
        n = 1 * opt$$module$synpdf.dx,
        l = 2 * spatium$$module$synpdf,
        h = [];
    for (d = 0; d < a.length; ++d) {
        var k = 3 * witArr$$module$synpdf[d];
        var r = a[d].xs;
        var q = r.x1 + 50;
        var u = r.x2 - 20;
        q >= u && (q = r.x1, u = r.x2);
        var t = a[d].cs;
        var v = t[0];
        var w = t[t.length - 1];
        var C = (v - l) * b;
        var z = v * b;
        var A = w * b;
        var D = (w + l) * b;
        t = [];
        var y = [];
        for (f = 0; f < b; f += 4) {
            var B = e = 0;
            for (g = C + f; g < z + f; g += b) {
                var x = c[g] + c[g + 1] + c[g + 2];
                e += x
            }
            for (g = z + f; g < A + f; g += b) {
                x =
                    c[g] + c[g + 1] + c[g + 2];
                var E = c[g + 4] + c[g + 5] + c[g + 6];
                B += Math.min(x, E) < k ? 1 : 0;
                e += x
            }
            for (g = A + f; g < D + f; g += b) x = c[g] + c[g + 1] + c[g + 2], e += x;
            t.push(e / (3 * (w - v + 2 * l)));
            y.push(B)
        }
        f = y.slice(q, u);
        f.sort(function(a, b) {
            return b - a
        });
        k = f[0];
        w = v = 0;
        for (f = q; f < u; f++) q = y[f], q > k * p && (t[f - n] > v && (v = t[f - n]), t[f + n] > w && (w = t[f + n]));
        e = [r.x1];
        u = e[0];
        for (f = 5; f < t.length - 5; f++) q = y[f], q > k * p && t[f - n] > v * m && t[f + n] > w * m && f - u > 3 * spatium$$module$synpdf && (e.push(f), u = f);
        r.x2 - u > 3 * spatium$$module$synpdf && e.push(r.x2);
        h.push(e)
    }
    return h
}

function maatStrepen$$module$synpdf() {
    $(".maten").remove();
    if (opt$$module$synpdf.advncd)
        for (var a = 0; a < deMaten$$module$synpdf.length; ++a) {
            var b = deMaten$$module$synpdf[a];
            b = $('<div class="maten"/>').css({
                background: a & 1 ? "rgba(0,255,0,0.2)" : "rgba(0,0,255,0.2)",
                left: b.x,
                top: b.y,
                width: b.w,
                height: b.h
            });
            $("#notation").append(b)
        }
}

function readDbxFile$$module$synpdf(a) {
    $("#err").text("");
    metric_arr$$module$synpdf = tix_lb$$module$synpdf = offset_js$$module$synpdf = times_arr$$module$synpdf = void 0;
    deMetriek$$module$synpdf = [opt$$module$synpdf.pagewd];
    adv_settings$$module$synpdf = void 0;
    annots$$module$synpdf = [];
    initLoopRec$$module$synpdf();
    var b = a[0].link;
    b = b.replace("www.dropbox", "dl.dropboxusercontent").split("?")[0];
    a = a[0].name.split(".");
    scoreFnm$$module$synpdf = a[0];
    $("#wait").html("Loading ...");
    $("#wait").toggle(!0);
    $("#err").text("link: " +
        b + "\n");
    /(pdf$)|(jpe?g$)/i.test(a[1]) ? (pdfFnm$$module$synpdf = b, readPdf$$module$synpdf(b, "url")) : get_file$$module$synpdf(b, function(a) {
        0 <= a.indexOf("//# This page") || 0 <= xs.indexOf("play_list") ? (initPreload$$module$synpdf(), evalPreload$$module$synpdf(a), msc_check_preload$$module$synpdf()) : $("#wait").append("<br>not a preload file")
    })
}

function readPdfOrJs$$module$synpdf(a) {
    var b = arrbuf2str$$module$synpdf(a.slice(0, 4E3));
    $("#impbox").prop("checked") ? copyTiming$$module$synpdf(b, a) : (msc_wz$$module$synpdf = null, 0 <= b.indexOf("//# This page") || 0 <= b.indexOf("play_list") ? (initPreload$$module$synpdf(), b = arrbuf2str$$module$synpdf(a), evalPreload$$module$synpdf(b), msc_check_preload$$module$synpdf()) : /jpe?g$/i.test(pdfFnm$$module$synpdf) ? readPdf$$module$synpdf(a, "jpgbin") : readPdf$$module$synpdf(a, "pdfbin"))
}

function readLocalFile$$module$synpdf() {
    metric_arr$$module$synpdf = tix_lb$$module$synpdf = offset_js$$module$synpdf = times_arr$$module$synpdf = void 0;
    deMetriek$$module$synpdf = [opt$$module$synpdf.pagewd];
    adv_settings$$module$synpdf = void 0;
    annots$$module$synpdf = [];
    initLoopRec$$module$synpdf();
    var a = new FileReader;
    a.onload = function(b) {
        readPdfOrJs$$module$synpdf(a.result)
    };
    var b = $("#fknp").prop("files")[0];
    pdfFnm$$module$synpdf = b.name;
    scoreFnm$$module$synpdf = b.name.split(".")[0];
    a.readAsArrayBuffer(b)
}

function readMedia$$module$synpdf(a, b) {
    "dbx" == a ? (a = b[0], b = a.link) : (a = "dd" == a ? b[0] : $("#mknp").prop("files")[0], b = window.URL.createObjectURL(a));
    setPlayer$$module$synpdf(a.name, b)
}

function readMediaYub$$module$synpdf() {
    $("#yubid")[0].checkValidity() ? (opt$$module$synpdf.yubvid = $("#yubid").val(), setPlayer$$module$synpdf("", "")) : alert("The youtube video id should be 11 characters long,\neach from 'A' to 'Z', 'a' to 'z', '0' to '9', '-' or '_'")
}

function initPbRates$$module$synpdf(a, b, c) {
    for (pbrates$$module$synpdf = []; a <= b + .001; a += c) a = Math.round(100 * a) / 100, pbrates$$module$synpdf.push(a)
}

function medbtnSwitch$$module$synpdf() {
    var a = $("#yubuse").prop("checked");
    $("#medlbl").css("display", a ? "none" : "block");
    $("#yvdlbl").css("display", a ? "block" : "none")
}

function yubApiReady$$module$synpdf() {
    ybplayer$$module$synpdf = new YT.Player("vidyub", {
        playerVars: {
            disablekb: 1 // keyboard controls mess up measure nav
        },
        events: {
            onReady: function() {
                $("#yubuse").prop("checked", !0);
                medbtnSwitch$$module$synpdf();
                yubload$$module$synpdf()
            },
            onStateChange: function(a) {
                a.data == YT.PlayerState.PLAYING ? (dummyPlayer$$module$synpdf.setKlok(tick$$module$synpdf, 100), setSpeed$$module$synpdf(0), setPauseState$$module$synpdf(!1)) : (dummyPlayer$$module$synpdf.clearKlok(), setPauseState$$module$synpdf(!0));
                a.data == YT.PlayerState.CUED && setNotationHeight$$module$synpdf()
            }
        }
    })
}

function yubload$$module$synpdf(a) {
    function b(a) {
        $("#yubuse").attr("disabled", a);
        $("#yublbl").css("color", a ? "#aaa" : "#000");
        $("#yubload").toggle(a)
    }
    a && (onYouTubeAPIContinue$$module$synpdf = a);
    "undefined" == typeof YT ? (b(!0), $("#yubuse").prop("checked", !1), $.getScript("https://www.youtube.com/iframe_api")) : (b(!1), onYouTubeAPIContinue$$module$synpdf())
}

function setPlayer$$module$synpdf(a, b) {
    b = b.replace("www.dropbox", "dl.dropboxusercontent").split("?")[0];
    mediaFnm$$module$synpdf = 0 == b.indexOf("http") ? b : a;
    a = a.split("?")[0];
    $("#vid, #aud").attr("src", "");
    ybplayer$$module$synpdf && ybplayer$$module$synpdf.stopVideo();
    dummyPlayer$$module$synpdf.pause();
    var c = 0 <= opt$$module$synpdf.btime ? opt$$module$synpdf.btime : offset$$module$synpdf;
    if (a) {
        yubchk$$module$synpdf = 0;
        if (/\.webm$|\.mp4$/i.test(a)) {
            a = $("#vid");
            if (0 == a.length) return;
            $("#vidyub, #aud").css("display",
                "none")
        } else {
            a = $("#aud");
            if (0 == a.length) return;
            $("#vidyub, #vid").css("display", "none")
        }
        a.css("display", "inline-block");
        elmed$$module$synpdf = a.get(0);
        /\.ogg$/i.test(b) && (elmed$$module$synpdf.canPlayType("audio/ogg") || (b = b.replace(/\.ogg$/i, ".mp3")));
        /\.webm$/i.test(b) && (elmed$$module$synpdf.canPlayType("video/webm") || (b = b.replace(/\.webm$/i, ".mp4")));
        a.attr("src", b);
        a.on("timeupdate", function() {
            hasMixer$$module$synpdf ? .5 < Math.abs(mixplayer$$module$mixer.currentTime - elmed$$module$synpdf.currentTime) &&
                (mixplayer$$module$mixer.currentTime = elmed$$module$synpdf.currentTime, tick$$module$synpdf()) : tick$$module$synpdf()
        });
        a.on("playing", function() {
            dummyPlayer$$module$synpdf.setKlok(null, 0);
            elmed$$module$synpdf.playbackRate = opt$$module$synpdf.speed;
            setPauseState$$module$synpdf(!1)
        });
        a.on("pause", function() {
            dummyPlayer$$module$synpdf.clearKlok();
            setPauseState$$module$synpdf(!0)
        });
        a.on("loadedmetadata", function() {
            setNotationHeight$$module$synpdf();
            elmed$$module$synpdf.currentTime = c
        });
        initPbRates$$module$synpdf(.5,
            2, .05);
        setSpeed$$module$synpdf(0);
        setNotationHeight$$module$synpdf() // below media_height is changed from 30% to 200px
    } else yubchk$$module$synpdf = 1, opt$$module$synpdf.media_height || (opt$$module$synpdf.media_height = "200px"), $("#vid, #aud").css("display", "none"), $("#vidyub").css("display", "inline-block"), yubload$$module$synpdf(function() {
        elmed$$module$synpdf = ybplayer$$module$synpdf;
        /// pbrates$$module$synpdf = elmed$$module$synpdf.getAvailablePlaybackRates();     ///COMMENTING OUT ALLOWS YOUTUBE RATES AT 0.05 SPEED INCREMENT
        setSpeed$$module$synpdf(0);
        setNotationHeight$$module$synpdf();
        elmed$$module$synpdf.cueVideoById({
            videoId: opt$$module$synpdf.yubvid,
            startSeconds: c
        })
    })
}

function setNotationHeight$$module$synpdf() {
    $("#buttons").toggleClass("noheight", !!opt$$module$synpdf.noplyr);
    $("#knop").toggle(!!opt$$module$synpdf.playbtn);
    var a = parseFloat($("#buttons").css("height"));
    $("#vidyub").css("width", (1.52 * a).toFixed());
    msc_wz$$module$synpdf && msc_wz$$module$synpdf.setTmargin()
}

function msc_shift$$module$synpdf(a) {
    if (!hideMenuHelp$$module$synpdf(0) && "buttons" == a.target.id) {
        a.preventDefault();
        a.stopPropagation();
        $("#buttons").toggleClass("rolgroen", !0);
        var b = "touchstart" == a.type,
            c = $("#buttons"),
            d = b ? a.originalEvent.touches[0].clientY : a.pageY,
            e = $("#buttons").height();
        c.css("cursor", "row-resize");
        c.on(b ? "touchmove" : "mousemove", function(a) {
            var c = $("body").height();
            opt$$module$synpdf.media_height = (100 * (e + (b ? a.originalEvent.touches[0].clientY : a.clientY) - d) / c).toFixed() + "%";
            $("#buttons").css("height",
                opt$$module$synpdf.media_height)
        });
        c.on(b ? "touchend" : "mouseup", function(a) {
            c.css("cursor", "initial");
            $("#buttons").toggleClass("rolgroen", !1);
            c.off("mousemove touchmove mouseup touchend");
            setNotationHeight$$module$synpdf()
        })
    }
}

function lijn_shift$$module$synpdf(a) {
    a.preventDefault();
    a.stopPropagation();
    var b = "touchstart" == a.type;
    $("#rollijn").toggleClass("rolgroen");
    var c = b ? $("#rollijn") : $("body");
    c.on(b ? "touchmove" : "mousemove", function(a) {
        $("#notation").offset();
        opt$$module$synpdf.offrol = (100 * ((b ? a.originalEvent.touches[0].clientY : a.clientY) - dottedHeight$$module$synpdf / 2) / document.body.clientHeight).toFixed(2) + "%";
        $("#rollijn").css("top", opt$$module$synpdf.offrol);
        msc_wz$$module$synpdf && msc_wz$$module$synpdf.setTmargin()
    });
    c.on(b ? "touchend" : "mouseup", function(a) {
        c.off("mousemove touchmove mouseup touchend");
        $("#rollijn").toggleClass("rolgroen")
    })
}

function setSpeed$$module$synpdf(a) {
    if (2 == a) {
        a = $("#speed").val();
        var b = a - opt$$module$synpdf.speed;
        .06 >= Math.abs(b) ? a = 0 < b ? 1 : -1 : (opt$$module$synpdf.speed = a, a = 0)
    }
    b = pbrates$$module$synpdf.map(function(a, b) {
        return {
            x: Math.abs(a - opt$$module$synpdf.speed),
            i: b
        }
    }).sort(function(a, b) {
        return a.x - b.x
    })[0].i; - 1 == a && 0 < b && (opt$$module$synpdf.speed = pbrates$$module$synpdf[b + a]);
    1 == a && b < pbrates$$module$synpdf.length - 1 && (opt$$module$synpdf.speed = pbrates$$module$synpdf[b + a]);
    0 == a && (opt$$module$synpdf.speed = pbrates$$module$synpdf[b]);
    $("#speed").val(opt$$module$synpdf.speed.toFixed(2));
    elmed$$module$synpdf && !yubchk$$module$synpdf && (elmed$$module$synpdf.playbackRate = opt$$module$synpdf.speed);
    elmed$$module$synpdf && yubchk$$module$synpdf && elmed$$module$synpdf.setPlaybackRate(opt$$module$synpdf.speed)
}

function setLoop$$module$synpdf() {
    msc_wz$$module$synpdf && msc_wz$$module$synpdf.drawTags();
    0 < detix$$module$synpdf && 0 == deTijden$$module$synpdf[detix$$module$synpdf].t && msc_wz$$module$synpdf.goMsre(1, {});
    opt$$module$synpdf.loop = $("#loop").prop("checked");
    $("#atag").css("display", opt$$module$synpdf.loop ? "block" : "none");
    $("#btag").css("display", opt$$module$synpdf.loop ? "block" : "none");
    tick$$module$synpdf()
}
var in_count_in$$module$synpdf = 0;

function do_count_in$$module$synpdf(a, b) {
    function c() {
        $("#countin").toggle(!1);
        clearInterval(in_count_in$$module$synpdf);
        in_count_in$$module$synpdf = 0
    }

    function d() {
        $("#countin").html("<b>" + e.num + "</b>").toggle(!0);
        0 == e.num-- && (c(), playPause$$module$synpdf(a, b))
    }
    if (in_count_in$$module$synpdf) c();
    else {
        a = a.replace(":true", ":false");
        var e = msc_wz$$module$synpdf.compCountIn();
        d();
        in_count_in$$module$synpdf = setInterval(d, 1E3 * e.time)
    }
}

function playPause$$module$synpdf(a, b) {
    if (elmed$$module$synpdf) {
        var c = a.split(":"),
            d = "true" == c[0],
            e = parseFloat(c[1]);
        c = "true" == c[2];
        var f = yubchk$$module$synpdf ? elmed$$module$synpdf.getPlayerState() : 0,
            g = yubchk$$module$synpdf ? 1 != f : elmed$$module$synpdf.paused;
        yubchk$$module$synpdf ? 5 != f && elmed$$module$synpdf.seekTo(e, !0) : elmed$$module$synpdf.currentTime = e;
        msc_wz$$module$synpdf && msc_wz$$module$synpdf.time2x(e - offset$$module$synpdf);
        if (d) {
            if (g) {
                if (c) {
                    do_count_in$$module$synpdf(a,
                        b);
                    return
                }
                if (b) {
                    setTimeout(function() {
                        playPause$$module$synpdf(a, 0)
                    }, b);
                    return
                }
                yubchk$$module$synpdf ? elmed$$module$synpdf.playVideo() : elmed$$module$synpdf.play()
            } else yubchk$$module$synpdf ? 5 != f && elmed$$module$synpdf.pauseVideo() : elmed$$module$synpdf.pause();
            msc_wz$$module$synpdf && (msc_wz$$module$synpdf.paused = !g)
        }
    }
}

function playPause2$$module$synpdf(a, b) {
    a = a + ":" + b.toFixed(2) + ":" + (a && $("#cntin").prop("checked"));
    sok$$module$synpdf ? sok$$module$synpdf.send(a) : playPause$$module$synpdf(a, 0)
}

function sendMsg$$module$synpdf(a) {
    window.parent.postMessage(a);
    window.postMessage(a)
}

function setPauseState$$module$synpdf(a) {
    msc_wz$$module$synpdf && (msc_wz$$module$synpdf.paused = a, $("#knop").val(a ? "Play" : "Pause"), $("#sync_out").css("background", a ? "" : "#ff0"), $("#vidyub, #vid").blur(), sendMsg$$module$synpdf(a ? "paused" : "playing"))
}

function pauseer$$module$synpdf() {
    yubchk$$module$synpdf ? 1 == elmed$$module$synpdf.getPlayerState() && elmed$$module$synpdf.pauseVideo() : elmed$$module$synpdf.paused || elmed$$module$synpdf.pause()
}

//Global scroll position variable
let initialScrollTop = window.scrollY; // Store the initial scroll position

function keyDown$$module$synpdf(a) {
    var b = a.key,
        c = 1;
    switch (b) {
        case "ArrowLeft":
        case "Left":
            msc_wz$$module$synpdf.goMsre(0, a);
            break;
        case "ArrowRight":
        case "Right":
            msc_wz$$module$synpdf.goMsre(1, a);
            break;
        case "ArrowUp":
        case "Up":
            msc_wz$$module$synpdf.goUpDown(0, 0, a);
            break;
        case "ArrowDown":
        case "Down":
            msc_wz$$module$synpdf.goUpDown(1, 0, a);
            break;
        case "PageUp":
            msc_wz$$module$synpdf.goUpDown(0, 1, a);
            break;
        case "PageDown":
            msc_wz$$module$synpdf.goUpDown(1, 1, a);
            break;
        case "Spacebar":
        case " ":
            a.preventDefault &&
                a.preventDefault();
            if (!elmed$$module$synpdf) break;
            var d = yubchk$$module$synpdf ? elmed$$module$synpdf.getCurrentTime() : elmed$$module$synpdf.currentTime;
            playPause2$$module$synpdf(!0, d);
            break;
        case "f":
            $("#btns").click();
            break;
        case "h":
            $("#help").toggleClass("showhlp");
            break;
        case "l":
            $("#lncsr").click();
            break;
        case "m":
            $("#menu").toggle();
            break;
        case "+":
        case "=":
            setSpeed$$module$synpdf(1);
            break;
        case "-":
            setSpeed$$module$synpdf(-1);
            break;
        case "Escape":
            $("#menu, #saveDlg").toggle(!1);
            $("#help").toggleClass("showhlp", !1);
            break;
        case "r":
            disableScrollingCheck = 1;
            initialScrollTop = window.scrollY;
            element = document.getElementById('notation');
            element.style.overflowY = 'visible';
            element.style.overflowX = 'visible';
            deMetriek$$module$synpdf = JSON.parse(localStorage.getItem('jsonString'));
            setPagenum$$module$synpdf(opt$$module$synpdf.pagenum);
            break;


        default:
            c = 0
    }
    if (opt$$module$synpdf.synbox && msc_wz$$module$synpdf && !c) {
        switch (b) {
            case "b":
            case "c":
                msc_wz$$module$synpdf.keySync(b);
                break;
            case ".":
                a.ctrlKey ? msc_wz$$module$synpdf.changeOffset(gFac$$module$synpdf) : msc_wz$$module$synpdf.changeTimesKeyb(gFac$$module$synpdf);
                break;
            case ",":
                a.ctrlKey ? msc_wz$$module$synpdf.changeOffset(-gFac$$module$synpdf) : msc_wz$$module$synpdf.changeTimesKeyb(-gFac$$module$synpdf);
                break;
            case "w":
                saveTiming$$module$synpdf();
                break;
            case "Backspace":
            case "c":
                resetTiming$$module$synpdf();
                break;
            case "g":
                repMaten$$module$synpdf.splice(-1), msc_wz$$module$synpdf.drawRepTokens()
        }
        a.preventDefault();
        msc_wz$$module$synpdf.showSyncInfo()
    }
}

function arrbuf2str$$module$synpdf(a) {
    a = new Uint8Array(a);
    for (var b = "", c = 0; c < a.length; ++c) b += String.fromCharCode(a[c]);
    return b
}

function str2arrbuf$$module$synpdf(a) {
    for (var b = new ArrayBuffer(a.length), c = new Uint8Array(b), d = 0; d < a.length; d++) c[d] = a.charCodeAt(d);
    return b
}

function bin2txt$$module$synpdf(a) {
    a = arrbuf2str$$module$synpdf(a);
    a = window.btoa(a);
    for (var b = [], c = 0; c <= a.length;) b.push(a.substr(c, 150)), c += 150;
    return '["' + b.join('",\n"') + '"]'
}

function txt2pdf$$module$synpdf(a) {
    a = a.join("");
    a = window.atob(a);
    return str2arrbuf$$module$synpdf(a)
}

function saveTiming$$module$synpdf() {
    function a(a) {
        for (var b = 0; a.length > b;) {
            b = a.indexOf(",", b + 90);
            if (-1 == b) break;
            a = a.slice(0, b + 1) + "\n" + a.slice(b + 1)
        }
        return a
    }
    var b = 'pdf_file = "' + pdfFnm$$module$synpdf + '";\n';
    if (pdfDoc$$module$synpdf && pdfDoc$$module$synpdf.pdfInfo && !pdfData$$module$synpdf) pdfDoc$$module$synpdf.getData().then(function(a) {
        pdfData$$module$synpdf = a;
        saveTiming$$module$synpdf()
    });
    else {
        var c = opt$$module$synpdf.wpdf && pdfData$$module$synpdf ? "pdf_data = " + bin2txt$$module$synpdf(pdfData$$module$synpdf) +
            ";\n" : "";
        c = opt$$module$synpdf.wpdf && jpgData$$module$synpdf ? "jpg_data = " + bin2txt$$module$synpdf(jpgData$$module$synpdf) + ";\n" : c;
        var d = 'media_file = "' + (yubchk$$module$synpdf ? "" : mediaFnm$$module$synpdf) + '";\n';
        var e = "msc_tracks = " + (msc_tracks$$module$synpdf ? JSON.stringify(msc_tracks$$module$synpdf) : '""') + ";\n";
        var f = "undefined" != typeof msc_credits$$module$synpdf ? "msc_credits = " + JSON.stringify(msc_credits$$module$synpdf) + ";\n" : "";
        var g = "offset_js = " + offset$$module$synpdf.toFixed(2) + ";\n";
        opt$$module$synpdf.synbox =
            0;
        opt$$module$synpdf.lastSynced = lastSynced$$module$synpdf;
        var p = a("opt = " + JSON.stringify(opt$$module$synpdf) + ";\n");
        var m = annots$$module$synpdf.length ? "annots = " + JSON.stringify(annots$$module$synpdf) + ";\n" : "";
        var n = lpRec$$module$synpdf.loopBtn ? "lpRec = " + JSON.stringify(lpRec$$module$synpdf) + ";\n" : "";
        var l = a("times_arr = " + JSON.stringify(deTijden$$module$synpdf) + ";\n");
        var h = a("metric_arr = " + JSON.stringify(deMetriek$$module$synpdf) + ";\n");
        var k = a("adv_settings = " + JSON.stringify(adv_parms$$module$synpdf) +
            ";\n");
        l = '//########################################\n//# This page contains score data, timing data and the media file path. Save it as a javascipt file in\n//# the same folder as synpdf.html. Synpdf preloads score and media when it is opened with the\n//# file name as parameter in the url, for example: http://your.domain.org/synpdf.html?file_name.js\n//# Also works locally with file:///path/to/synpdf.html?file_name.js\n//# **** You may have to correct the path to the media file below! (media_file="...";) ****\n//########################################\n//#\n' +
            (b + d + e + f + g + p + m + n + l + k + h + c + "\n");
        var r = "data:text/plain;charset=utf-8;base64," + btoa(unescape(encodeURIComponent(l)));
        $("#drpuse").prop("checked") ? ($("#err").text(""), Dropbox.save(r, scoreFnm$$module$synpdf + ".js", {
            success: function() {
                $("#err").text('"' + scoreFnm$$module$synpdf + '.js" saved to your Dropbox.\n')
            },
            progress: function(a) { },
            cancel: function() { },
            error: function(a) {
                $("#err").text("Error: " + a + "\n");
                $("#err").append("fnm: " + scoreFnm$$module$synpdf + ", len: " + r.length + "\n")
            }
        })) : "save" == $(this).attr("id") ?
            (l = document.createElement("a"), l.href = r, l.download = scoreFnm$$module$synpdf + ".js", l.text = "Save synchronization data", $("#saveDiv").append(l), l.click()) : ($("#saveDlg pre").html(l), $("#saveDlg").css("display", "block"))
    }
}

function resetTiming$$module$synpdf() {
    $(this).blur(); - 1 != lastSynced$$module$synpdf && (lastSynced$$module$synpdf = detix$$module$synpdf - 1, msc_wz$$module$synpdf.startSync())
}

function get_file$$module$synpdf(a, b) {
    var c = new XMLHttpRequest;
    c.open("GET", a, !0);
    c.responseType = "text";
    c.onload = function(a) {
        $("#err").append("preload loaded.\n");
        b(c.response)
    };
    c.onerror = function(a) {
        $("#wait,#err").append("preload failed.\n")
    };
    c.send()
}


let jsonString = [];
function evalPreload$$module$synpdf(a) {
    var b = a.match(/^\s*[\w]+\s*=\s*/mg),
        c = a.split(/^\s*[\w]+\s*=\s*/mg);
    b.forEach(function(a, b) {
        a = a.replace(/\s*=\s*/, "");
        b = c[b + 1].replace(/;?\s*$/, "");
        b = JSON.parse(b);
        switch (a) {
            case "pdf_file":
                const hostname = window.location.hostname;
                pdf_file$$module$synpdf = (hostname === "localhost" ? "../../pdfs/" : "../pdfs/") + b;
                console.log(pdf_file$$module$synpdf);
                break;
            case "media_dir":
                media_dir$$module$synpdf = b;
                break;
            case "media_file":
                media_file$$module$synpdf = b;
                break;
            case "msc_credits":
                msc_credits$$module$synpdf = b;
                break;
            case "msc_tracks":
                msc_tracks$$module$synpdf = b;
                break;
            case "offset_js":
                offset_js$$module$synpdf =
                    b;
                break;
            case "opt":
                opt$$module$synpdf = b;
                break;
            case "annots":
                annots$$module$synpdf = b;
                break;
            case "lpRec":
                lpRec$$module$synpdf = b;
                break;
            case "times_arr":
                times_arr$$module$synpdf = b;
                break;
            case "metric_arr":
                metric_arr$$module$synpdf = b; // in the future set b to whatever variable will have the cxsbxs array and it will use that instead.
                jsonString = JSON.stringify(b);
                localStorage.setItem('jsonString', jsonString);
                break;
            case "pdf_data":
                pdf_data$$module$synpdf = b
        }
    })
}

//REPLACE PRELOAD WITH MYSQL DATABASE VIA PHP
function getPreloadFromDB() {
    return new Promise((resolve, reject) => {
        $.ajax({
            url: 'get_preload.php',
            success: function(response) {
                try {
                    response = JSON.parse(response); // Parse the JSON string
                } catch (error) {
                    console.error('Error parsing JSON:', error);
                }
                resolve(response);
            },
            error: function(error) {
                reject(error);
            }
        });
    });
}

function fetchDataFromDB() {
    return getPreloadFromDB()
        .then(function(response) {
            // Return the response to be handled in the chain
            return response;
        })
        .catch(function(error) {
            // Handle any errors that occurred during the AJAX call
            console.error(error);
        });
}


function msc_preload$$module$synpdf(a) {
    initPreload$$module$synpdf();
    $("#err").text("");
    var b, c;
    var d = window.location.href.replace("?dl=0", "").split("?");
    a && (d = ["", a]);
    if (a = d[0].match(/:\/\/([^/:]+)/)) var e = a[1];
    if (1 < d.length)
        for (d = d[1].split("&"), c = 0; c < d.length; c++) {
            var f = d[c].replace(/d:(\w{15}\/[^.]+\.)/, "https://dl.dropboxusercontent.com/s/$1");
            (a = f.match(/ln=([01])/)) ? opt_url$$module$synpdf.lncsr = parseInt(a[1]) : (a = f.match(/ip=(\d+.\d+.\d+.\d+)/)) ? opt_url$$module$synpdf.ipadr = a[1] : (a = f.match(/^d([\d.]+)$/)) ?
                opt_url$$module$synpdf.delay = parseFloat(a[1]) : (a = f.match(/^mmin=([\w,]*)$/)) ? opt_url$$module$synpdf.mmin = a[1] : (a = f.match(/^trks=(.*)$/)) ? msc_tracks$$module$synpdf = a[1].split(",") : (a = f.match(/^mdir=(.*)$/)) ? media_dir$$module$synpdf = a[1] : f.match(/ip=host/) && e ? opt_url$$module$synpdf.ipadr = e : "mstr" == f ? opt_url$$module$synpdf.mstr = 1 : "nomed" == f ? (opt_url$$module$synpdf.nomed = 1, opt_url$$module$synpdf.noplyr = 1) : "playbtn" == f ? opt_url$$module$synpdf.playbtn = 1 : (a = f.match(/cnt=([\d-]+)/)) ? opt_url$$module$synpdf.bpmsr =
                    a[1] : "nosm" == f ? hasSmooth$$module$synpdf = !1 : "fullmenu" == f ? fullmenu$$module$synpdf = 1 : "hrz" == f ? opt_url$$module$synpdf.hrz = "hrz" : "hrzleft" == f ? opt_url$$module$synpdf.hrz = "left" : b = f;
            /\.(pdf|jpg)$/.test(b) && (pdf_file$$module$synpdf = b, b = "");
            /\.(ogg|mp3|mp4|webm)$/.test(b) && (media_file$$module$synpdf = b, b = "")
        }
    if (b || pdf_file$$module$synpdf) $("#wait").html("Loading ..."), $("#wait").toggle(!0);
    pdf_file$$module$synpdf || media_file$$module$synpdf || msc_tracks$$module$synpdf && !b ? msc_check_preload$$module$synpdf() :
        b && (0 <= b.indexOf("dropbox.com") && (b += "?dl=1"), get_file$$module$synpdf(b, function(a) {
            evalPreload$$module$synpdf(a);
            msc_check_preload$$module$synpdf()
        }));
    return b || pdf_file$$module$synpdf || media_file$$module$synpdf || msc_tracks$$module$synpdf
}

function msc_check_preload$$module$synpdf() {
    if (0 == playLstIx$$module$synpdf && play_list$$module$synpdf) $("body").trigger("play_end");
    else {
        for (var a in opt_url$$module$synpdf) opt$$module$synpdf[a] = opt_url$$module$synpdf[a];
        for (var b in opt_default$$module$synpdf) opt$$module$synpdf[b] = b in opt$$module$synpdf ? opt$$module$synpdf[b] : opt_default$$module$synpdf[b];
        metric_arr$$module$synpdf && (deMetriek$$module$synpdf = metric_arr$$module$synpdf, schaalMetriek$$module$synpdf());
        adv_settings$$module$synpdf && (adv_parms$$module$synpdf =
            adv_settings$$module$synpdf);
        media_dir$$module$synpdf && pdf_file$$module$synpdf && (pdf_file$$module$synpdf = media_dir$$module$synpdf + pdf_file$$module$synpdf);
        pdfFnm$$module$synpdf = pdf_file$$module$synpdf;
        pdf_data$$module$synpdf ? (a = txt2pdf$$module$synpdf(pdf_data$$module$synpdf), readPdf$$module$synpdf(a, "pdfbin")) : jpg_data$$module$synpdf ? (a = txt2pdf$$module$synpdf(jpg_data$$module$synpdf), readPdf$$module$synpdf(a, "jpgbin")) : pdf_file$$module$synpdf && readPdf$$module$synpdf(pdf_file$$module$synpdf, "url");
        offset_js$$module$synpdf && (offset$$module$synpdf = offset_js$$module$synpdf);
        media_file$$module$synpdf && !opt$$module$synpdf.nomed && (media_dir$$module$synpdf && (media_file$$module$synpdf = media_dir$$module$synpdf + media_file$$module$synpdf), setPlayer$$module$synpdf(media_file$$module$synpdf, media_file$$module$synpdf));
        msc_tracks$$module$synpdf && msc_tracks$$module$synpdf.length && (media_dir$$module$synpdf && (msc_tracks$$module$synpdf = msc_tracks$$module$synpdf.map(function(a) {
            return media_dir$$module$synpdf +
                a
        })), mixplayer$$module$mixer.init(msc_tracks$$module$synpdf, opt$$module$synpdf.hrz), hasMixer$$module$synpdf = 1);
        void 0 == msc_tracks$$module$synpdf && (lpRec$$module$synpdf.atag && (lpRec$$module$synpdf.atag.y -= 500, lpRec$$module$synpdf.btag.y -= 500), annots$$module$synpdf && annots$$module$synpdf.forEach(function(a) {
            return a.y -= 500
        }));
        opt$$module$synpdf.yubvid && !opt$$module$synpdf.nomed && setPlayer$$module$synpdf("", "");
        msc_credits$$module$synpdf && (a = msc_credits$$module$synpdf.reduce(function(a, b) {
            return a + b
        }),
            $("#credits").html(a));
        opt$$module$synpdf.no_menu && !fullmenu$$module$synpdf && ($("#sync").css("display", "none"), opt$$module$synpdf.btns = 0, $("body").on("contextmenu", function(a) {
            a.preventDefault()
        }));
        resetIntf$$module$synpdf(!1)
    }
}

function schaalMetriek$$module$synpdf() {
    var a = deMetriek$$module$synpdf[0],
        b = 1;
    null == a ? (a = opt$$module$synpdf.pagewd, b = a / 1E3) : deMetriek$$module$synpdf[0] != opt$$module$synpdf.pagewd && (a = opt$$module$synpdf.pagewd, b = a / deMetriek$$module$synpdf[0]);
    deMetriek$$module$synpdf[0] = a;
    1 != b && deMetriek$$module$synpdf.forEach(function(a, d) {
        0 != d && (a.cxs.forEach(function(a) {
            a.cs.forEach(function(c, d) {
                return a.cs[d] = c * b
            });
            a.xs.x1 *= b;
            a.xs.x2 *= b
        }), a.bxs.forEach(function(a) {
            a.forEach(function(c, d) {
                return a[d] = c * b
            })
        }))
    })
}

function resetIntf$$module$synpdf(a) {
    for (var b in opt_url$$module$synpdf) opt$$module$synpdf[b] = opt_url$$module$synpdf[b];
    opt$$module$synpdf.ipadr && webSokOpen$$module$synpdf(opt$$module$synpdf.ipadr);
    //Commenting out below - We don't need space for buttons since player is to the side.
    //opt$$module$synpdf.media_height && $("#buttons").css("left" == opt$$module$synpdf.hrz ? "width" : "height", opt$$module$synpdf.media_height);
    opt$$module$synpdf.mmin && !fullmenu$$module$synpdf && opt$$module$synpdf.mmin.split(",").forEach(function(a) {
        return $("#" + a).toggle(0)
    });
    hasMixer$$module$synpdf && (opt$$module$synpdf.spdctl =
        0, opt$$module$synpdf.speed = 1, setSpeed$$module$synpdf(0), document.getElementById("spdctl").disabled = !0);
    for (b in opt$$module$synpdf) {
        a = $("#" + b);
        var c = a.attr("type");
        "checkbox" == c && a.prop("checked", opt$$module$synpdf[b]);
        "number" == c && a.val(opt$$module$synpdf[b])
    }
    toggleBtns$$module$synpdf();
    syncChk$$module$synpdf();
    hideSpeedChk$$module$synpdf();
    $("#sync, #medbts, #err").css("visibility", "visible");
    $(window).off("resize").on("resize", doResize$$module$synpdf);
    playLstIx$$module$synpdf && keyDown$$module$synpdf({
        key: " "
    })
}

function logerr$$module$synpdf(a) {
    $("#err").append(a + "\n")
}

function webSokOpen$$module$synpdf(a) {
    sok$$module$synpdf ? logerr$$module$synpdf("websocket already open") : (sok$$module$synpdf = new WebSocket("ws://" + a + ":8091/"), sok$$module$synpdf.onmessage = function(a) {
        "master" == a.data ? $("#mbar").css("background", "rgba(255,0,0,0.2)") : playPause$$module$synpdf(a.data, 100 * opt$$module$synpdf.delay)
    }, sok$$module$synpdf.onerror = function(a) {
        logerr$$module$synpdf("socket error (server inaccessible?)");
        sok$$module$synpdf = null
    }, sok$$module$synpdf.onopen = function(a) {
        $("#mbar").css("background",
            "rgba(0,255,0,0.2)");
        opt$$module$synpdf.mstr && sok$$module$synpdf.send("master");
        logerr$$module$synpdf("connection opened")
    }, sok$$module$synpdf.onclose = function(a) {
        $("#mbar").css("background", "");
        logerr$$module$synpdf("connection closed: " + a.code);
        sok$$module$synpdf = null
    })
}

function checkMenu$$module$synpdf(a) {
    a = $(this).attr("type");
    var b = $(this).attr("id");
    if (opt$$module$synpdf.advncd && !$(this)[0].reportValidity()) $(this).val(opt$$module$synpdf[b]);
    else {
        var c = opt$$module$synpdf.pagenum;
        "checkbox" == a && (opt$$module$synpdf[b] = $(this).prop("checked"));
        "number" == a && (opt$$module$synpdf[b] = $(this).val());
        switch (b) {
            case "btns":
                toggleBtns$$module$synpdf();
                break;
            case "spdctl":
            case "nodash":
                hideSpeedChk$$module$synpdf();
                break;
            case "drmpl":
                opt$$module$synpdf.drmpl = parseFloat(opt$$module$synpdf.drmpl);
                resizePdfSyn$$module$synpdf();
                break;
            case "drmpl2":
                opt$$module$synpdf.drmpl2 = parseFloat(opt$$module$synpdf.drmpl2);
                resizePdfSyn$$module$synpdf();
                break;
            case "eerst":
            case "sysprf":
                resizePdfSyn$$module$synpdf();
                break;
            case "skipn":
            case "seln":
                resizePdfSyn$$module$synpdf();
                break;
            case "synbox":
                syncChk$$module$synpdf();
                $(this).blur();
                break;
            case "noplyr":
                setNotationHeight$$module$synpdf();
                sendMsg$$module$synpdf(opt$$module$synpdf[b] ? "hide_player" : "show_player");
                break;
            case "lncsr":
                msc_wz$$module$synpdf && msc_wz$$module$synpdf.time2x(msc_wz$$module$synpdf.cursorTime);
                break;
            case "impbox":
                toggleScoreBtn$$module$synpdf();
                break;
            case "onestf":
                resizePdfSyn$$module$synpdf();
                break;
            case "advncd":
                if (!msc_wz$$module$synpdf) break;
                $(".mexp").toggle(opt$$module$synpdf[b]);
                $(".mnrm").toggle(!opt$$module$synpdf[b]);
                $("#snclbl").toggle(!opt$$module$synpdf[b]);
                if (!opt$$module$synpdf.advncd) {
                    schakelParms$$module$synpdf(opt$$module$synpdf.pagenum, -1);
                    elmed$$module$synpdf.currentTime = deTijden$$module$synpdf[page2msr$$module$synpdf(opt$$module$synpdf.pagenum)].t;
                    resizePdfSyn$$module$synpdf();
                    break
                }
                opt$$module$synpdf.pagenum = getPage$$module$synpdf(demix$$module$synpdf);
            case "pagenum":
                setPagenum$$module$synpdf(c);
                break;
            case "annot":
                $(".ant").toggleClass("annmov", opt$$module$synpdf[b]);
                break;
            case "zwgrens":
            case "voorna":
            case "mtdrmpl":
            case "dx":
                resizePdfSyn$$module$synpdf();
                break;
            case "fscr":
                setFullscreen$$module$synpdf();
                break;
            case "fixwd":
                resizePdfSyn$$module$synpdf()
        }
    }
}

function toggleBtns$$module$synpdf() {
    $("#medbts").css("display", opt$$module$synpdf.btns ? "inline" : "none");
    $("#err").css("display", opt$$module$synpdf.btns ? "block" : "none");
    document.getElementById("btns").checked = !!opt$$module$synpdf.btns;
    setNotationHeight$$module$synpdf()
}

function hideSpeedChk$$module$synpdf() {
    var a = $("#spdctl").prop("checked");
    $("#spdlbl").css("display", a ? "block" : "none");
    $("#rollijn").toggleClass("dashed", !opt$$module$synpdf.nodash)
}

function syncChk$$module$synpdf() {
    if (msc_wz$$module$synpdf)
        if ($("#sync_out, .reptkn").toggle(!!opt$$module$synpdf.synbox), $("#lm").toggle(!opt$$module$synpdf.synbox), opt$$module$synpdf.advncd ? $(".mexp").toggle(!opt$$module$synpdf.synbox) : $(".mnrm").toggle(!opt$$module$synpdf.synbox), opt$$module$synpdf.synbox) msc_wz$$module$synpdf.showSyncInfo(), msc_wz$$module$synpdf.startSync();
        else
            for (var a = lastSynced$$module$synpdf + 1; a < deMaten$$module$synpdf.length; ++a) deTijden$$module$synpdf.push({
                t: 0 < a ? deTijden$$module$synpdf[a -
                    1].t + 2 : 0,
                mix: a
            })
}

function doResize$$module$synpdf() {
    var a = $("body").prop("clientWidth");
    a == bodyWidth$$module$synpdf ? msc_wz$$module$synpdf && msc_wz$$module$synpdf.setTmargin() : (bodyWidth$$module$synpdf = a, clearTimeout(resizeTimer$$module$synpdf), resizeTimer$$module$synpdf = setTimeout(function() {
        resizePdfSyn$$module$synpdf()
    }, 200))
}

function loaddrop$$module$synpdf() {
    var a = Dropbox.createChooseButton({
        success: readDbxFile$$module$synpdf,
        cancel: function() { },
        linkType: "preview",
        multiselect: !1,
        extensions: [".pdf", ".txt", ".js", ".jpg"]
    }),
        b = Dropbox.createChooseButton({
            success: function(a) {
                readMedia$$module$synpdf("dbx", a)
            },
            cancel: function() { },
            linkType: "preview",
            multiselect: !1,
            extensions: [".ogg", ".mp3", ".webm", ".mp4"]
        });
    $("#pdffile").append(a);
    $("#mediafile").append(b)
}

function dropuse$$module$synpdf() {
    function a(a) {
        $("#drpuse").prop("checked", !a);
        $("#drpuse").attr("disabled", a);
        $("#drplbl").css("color", a ? "#aaa" : "#000")
    }
    if ("undefined" == typeof Dropbox) a(!0), $.ajax({
        url: "https://www.dropbox.com/static/api/2/dropins.js",
        dataType: "script",
        cache: !0
    }).done(function() {
        a(!1);
        Dropbox.init({
            appKey: "ckknarypgq10318"
        });
        loaddrop$$module$synpdf();
        dropuse$$module$synpdf()
    });
    else {
        var b = $("#drpuse").prop("checked");
        $(".dropbox-dropin-btn").css("display", b ? "inline-block" : "none");
        $("#fknp, #mknp").css("display", b ? "none" : "inline-block")
    }
}

function addtips$$module$synpdf() {
    $("#snclbl").attr("title", "enter synchronization mode and show the submenu");
    $("#implbl").attr("title", "import timing data from another preload file into this document");
    $("#save, #show").attr("title", "save timing data, file URL's and menu settings in a preload file");
    $("#reset").attr("title", "clear timing data in the current and subsequent measures.\nposition cursor to previous measure.");
    $("#spdlbl").attr("title", "change the play back speed of the media");
    $("#l1").attr("title",
        "show/hide the file browse buttons at the top left corner of the page");
    $("#l2").attr("title", "show/hide the light red line that moves within the currently playing staff");
    $("#l3").attr("title", "show/hide the speed setting");
    $("#l6").attr("title", "Fix horizontal width of the score to 1000 pixels.\nAll advanced parameters are preset to values that work best with this width.\nIf you uncheck this item you will probably have to change some parameters\n(like dx and some thresholds)");
    $("#l8").attr("title",
        "when the average blackness of a horizontal line is above this number\nit is treated as a staff line");
    $("#l9").attr("title", "only the first quarter of the document is scanned for staff lines (normally it is the last quarter)");
    $("#lc").attr("title", "include the whole pdf document in the preload file when saving\n(normally only the URL is saved)");
    $("#ld").attr("title", "show/hide the dashed line to which the currently playing staff is aligned");
    $("#le").attr("title", "discards the given number of systems at the top of the first page (use for bogus sytems)");
    $("#lf").attr("title", "stronger preference for clustering of staves into systems");
    $("#lg").attr("title", "allows setting of two loopmarks (use long click to position the marks)");
    $("#lh").attr("title", "completely disable grouping of staves into systems.");
    $("#lj").attr("title", "save a preload file that hides the menu for the user");
    $("#lk").attr("title", "lower this number to force clustering of staves into systems, increase this number to avoid clustering");
    $("#ll").attr("title", "select a particular system on each page (to focus on an instrument in conductor scores), zero means no selection");
    $("#lm").attr("title", "show advanced settings");
    $("#ln").attr("title", "shows a count in dialog before starting play back");
    $("#lo").attr("title", "annotation mode: a long click/tap adds an annotation where you can enter (html formatted) text");
    $("#lp").attr("title", "enter/exit full sreen mode");
    $("#lq").attr("title", "pixel values (0-255) below this number are treated as black.\nonly applies when searching for bar lines.");
    $("#lr").attr("title", "fraction (0-1) of maximum whiteness before and after a bar line.\n(lower number -> more bar lines)");
    $("#ls").attr("title", "fraction (0-1) of maximum blackness that a bar line should have\n(lower number -> more potential bar lines)");
    $("#lt").attr("title", "the distance in pixels where whiteness (before/after barline) is measured");
    $("#lu").attr("title", "absolute change in blackness (0-255) above which the begin/end of a staff is assumed.");
    $("#lv").attr("title", "save settings, synchronization timing and (optionally) pdf data to a preload file")
}

function hideMenu$$module$synpdf() {
    $("#menu").toggle(!1);

    doReadPdf$$module$synpdf && (resizePdfSyn$$module$synpdf(), doReadPdf$$module$synpdf = 0)
}

function hideMenuHelp$$module$synpdf(a) {
    var b = "none" != $("#menu").css("display") || $("#help").hasClass("showhlp");
    b ? ($("#help").toggleClass("showhlp", !1), setTimeout(hideMenu$$module$synpdf, 0)) : a && keyDown$$module$synpdf({
        key: " "
    });
    return b
}

function setFullscreen$$module$synpdf() {
    var a = document.body,
        b = a.requestFullscreen || a.mozRequestFullScreen || a.webkitRequestFullscreen,
        c = document.exitFullscreen || document.mozCancelFullScreen || document.webkitExitFullscreen;
    b && c && (opt$$module$synpdf.fscr ? b.call(a) : c.call(document))
}
$(document).ready(function() {
    deNot$$module$synpdf = document.getElementById("notation");
    hasSmooth$$module$synpdf = CSS.supports("scroll-behavior", "smooth");
    bodyWidth$$module$synpdf = $("body").prop("clientWidth");
    msc_preload$$module$synpdf() || resetIntf$$module$synpdf(!0);
    $("body").keydown(keyDown$$module$synpdf);
    $("#buttons, #sync").keydown(function(a) {
        " " == a.key && a.stopPropagation()
    });
    var a = '<a href="http://wim.vree.org/js2/" target="_blank">synpdf</a> (version: ' + msc_VERSION$$module$synpdf + ")</br>\u00a9Willem Vree";
    $("#help").prepend('<div style="position: absolute; right: 5px;">' + a + "</div>");
    $("#closehelp").click(function() {
        $("#help").toggleClass("showhlp", 0)
    });
    $("#helpm").click(function() {
        $("#help").toggleClass("showhlp")
    });
    $("#buttons").on("mousedown touchstart", msc_shift$$module$synpdf);
    $("#fknp").change(readLocalFile$$module$synpdf);
    $("#mknp").change(function() {
        readMedia$$module$synpdf("btn", [])
    });
    $("#yknp").click(readMediaYub$$module$synpdf);
    $("#yubid").keydown(function(a) {
        a.stopPropagation()
    });
    $("input[type=number]").keydown(function(a) {
        a.stopPropagation()
    });
    $("#yubuse").change(medbtnSwitch$$module$synpdf);
    $("#drpuse").click(dropuse$$module$synpdf);
    $("#notation").mousedown(function(a) {
        hideMenuHelp$$module$synpdf(a.clientX < this.clientWidth)
    });
    $("#knop").click(function() {
        keyDown$$module$synpdf({
            key: " "
        });
        $(this).blur()
    });
    $("#speed").change(function() {
        setSpeed$$module$synpdf(2)
    });
    $("#save").click(saveTiming$$module$synpdf);
    $("#show").click(saveTiming$$module$synpdf);
    $("#reset").click(resetTiming$$module$synpdf);
    $("#saveDlg #saveok").click(function() {
        $("#saveDlg").toggle()
    });
    $("#loop").click(setLoop$$module$synpdf);
    $("#sync_out * input").change(checkMenu$$module$synpdf);
    $("#menu * input").change(checkMenu$$module$synpdf);
    $(".mexp").toggle(!1);
    $("#mbar").click(function(a) {
        "none" == $("#menu").css("display") ? (doReadPdf$$module$synpdf = 0, $("#menu").toggle(!0)) : hideMenu$$module$synpdf()
    });
    $(window).resize(function() {
        msc_wz$$module$synpdf && msc_wz$$module$synpdf.setTmargin()
    });
    addtips$$module$synpdf();
    $("body").on("fullscreenchange webkitfullscreenchange mozfullscreenchange",
        function() {
            var a = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;
            $("#fscr").prop("checked", null != a)
        });
    $("body").on("play_end", function() {
        !play_list$$module$synpdf || playLstIx$$module$synpdf >= play_list$$module$synpdf.length || (msc_preload$$module$synpdf(play_list$$module$synpdf[playLstIx$$module$synpdf]), playLstIx$$module$synpdf += 1)
    });
    window.addEventListener("message", function(a) {
        "play" == a.data && keyDown$$module$synpdf({
            key: " "
        });
        a.data.startsWith("key=") &&
            (a = a.data.match(/^key=(.+)$/)) && keyDown$$module$synpdf({
                key: a[1]
            })
    });
    //Adding Line Threshold control SET and GET
    let drmplValue = parseFloat($('#menu input#drmpl').get(0).value);

    Object.defineProperty(opt$$module$synpdf, 'drmpl', {
        get: function() {
            return drmplValue;
        },
        set: function(newValue) {
            drmplValue = newValue;
            $('#menu input#drmpl').get(0).value = newValue;
        }
    });
    //Adding Cluster Threshold control SET and GET
    let drmpl2Value = parseFloat($('#menu input#drmpl2').get(0).value);

    Object.defineProperty(opt$$module$synpdf, 'drmpl2', {
        get: function() {
            return drmpl2Value;
        },
        set: function(newValue) {
            drmpl2Value = newValue;
            $('#menu input#drmpl2').get(0).value = newValue;
        }
    });
    //Adding Barline Threshold control SET and GET
    let mtdrmplValue = parseFloat($('#menu input#mtdrmpl').get(0).value);

    Object.defineProperty(opt$$module$synpdf, 'mtdrmpl', {
        get: function() {
            return mtdrmplValue;
        },
        set: function(newValue) {
            mtdrmplValue = newValue;
            $('#menu input#mtdrmpl').get(0).value = newValue;
        }
    });
});
var module$synpdf = {
    get media_file() {
        return media_file$$module$synpdf
    }
};
module$synpdf.keyDown = keyDown$$module$synpdf;
module$synpdf.tick = tick$$module$synpdf;

