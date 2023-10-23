//~ Copyright (C) 2015-2023
//~ Isaac Trapkus,
//~ Willem Vree, contributions Stéphane David.
//~ This program is free software; you can redistribute it and/or modify it under the terms of the
//~ GNU General Public License as published by the Free Software Foundation; either version 2 of
//~ the License, or (at your option) any later version.
//~ This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
//~ without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
//~ See the GNU General Public License for more details. <http://www.gnu.org/licenses/gpl.html>.

//  This is a heavily modified and stripped version of Synpdf v.182. The original software
//  can be found at https://wim.vree.org/js2/index.html.

pdfjsLib.GlobalWorkerOptions.workerSrc = '//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.9.179/pdf.worker.min.js';

var opt$$module$synpdf, times_arr$$module$synpdf, offset_js$$module$synpdf, pdf_file$$module$synpdf, pdf_data$$module$synpdf, jpg_data$$module$synpdf, media_dir$$module$synpdf, metric_arr$$module$synpdf, pdfDoc$$module$synpdf, pdfData$$module$synpdf, jpgData$$module$synpdf, nPage$$module$synpdf =
    1,
    Cs$$module$synpdf = [],
    times$$module$synpdf, tixlb$$module$synpdf, ybplayer$$module$synpdf, yubchk$$module$synpdf = 0,
    pbrates$$module$synpdf = [],
    bodyWidth$$module$synpdf, opt_url$$module$synpdf = {},
    offset$$module$synpdf = 0,
    rendering$$module$synpdf = 0,
    doresize$$module$synpdf = 0,
    resizeTimer$$module$synpdf = -1,
    gFac$$module$synpdf, mediaFnm$$module$synpdf, pdfFnm$$module$synpdf, scoreFnm$$module$synpdf, bottomSpace$$module$synpdf = 500,
    touch_tb$$module$synpdf,
    touch_moved$$module$synpdf = 0,
    touchDev$$module$synpdf = void 0,
    dottedHeight$$module$synpdf = 30,
    m1_timer$$module$synpdf, spatium$$module$synpdf, deMaten$$module$synpdf = [],
    deTijden$$module$synpdf = [],
    demix$$module$synpdf, detix$$module$synpdf, lastSynced$$module$synpdf = -1,
    deMetriek$$module$synpdf = [],
    repMaten$$module$synpdf = [],
    deNot$$module$synpdf = 0,
    pageStfIx$$module$synpdf = [],
    fullmenu$$module$synpdf, pageNumChanged$$module$synpdf = {},
    xcurprev$$module$synpdf = -1,
    ycurprev$$module$synpdf = -1,
    dummyPlayer$$module$synpdf = new DummyPlayer$$module$synpdf,
    TOFF$$module$synpdf = .01,
    elmed$$module$synpdf, msc_wz$$module$synpdf, doReadPdf$$module$synpdf, skipn$$module$synpdf = null,
    onYouTubeAPIContinue$$module$synpdf,

    //default options for page reading//
    opt_default$$module$synpdf = {
        no_menu: 0,
        btns: 1,
        spdctl: 1,
        cropx: 0,
        drmpl: .4,
        pagewd: 1E3,
        synbox: 0,
        wpdf: 1,
        lncsr: 0,
        nomed: 0,
        noplyr: 0,
        nodash: 0,
        skipn: 0,
        bpmsr: "4-20-1",
        fscr: 0,
        pagenum: 1,
        playbtn: 0,
        mmin: "",
        fixwd: 1E3,
        lastSynced: -2,
        eerst: 0,
        sysprf: 0,
        onestf: 0
    };
window.onYouTubeIframeAPIReady = yubApiReady$$module$synpdf;

function initPreload$$module$synpdf() {
    //sets options to default//
    opt$$module$synpdf = opt_default$$module$synpdf;
    metric_arr$$module$synpdf = pdf_data$$module$synpdf = offset_js$$module$synpdf = times_arr$$module$synpdf = void 0;
    pdf_file$$module$synpdf = pdfFnm$$module$synpdf = mediaFnm$$module$synpdf =
        "";
    yubchk$$module$synpdf = 0;
    elmed$$module$synpdf = null;
    deMetriek$$module$synpdf[0] = opt$$module$synpdf.pagewd
}

function initGlobals$$module$synpdf() {
    offset$$module$synpdf = offset_js$$module$synpdf || 0; // need this =offsetjs || part otherwise offset stays 0 on instrument swap
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

function Wijzer$$module$synpdf(a, b, c, d) {
    this.width = b.width;
    this.$cvs = $(b);
    $("#notation").empty();
    b = $('<div id="rollijn" class="dashed"></div>');
    $("#notation").append(b);
    this.maatloper = $('<div class="demaat" style="background:rgba(215,255,71,0.2); left:0px; top:0px; width:0px; height:0px; z-index:2"></div>');
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

Wijzer$$module$synpdf.prototype.setOffsetX = function() {
    var a = this.xoffset || 0;
    this.xoffset = this.$cvs.offset().left;
    0 <= this.cursorTime && this.time2x(this.cursorTime);
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
                msc_wz$$module$synpdf.goMsre(1, {});
                pauseer$$module$synpdf();
                break
            }
            if (c = deMaten$$module$synpdf[demix$$module$synpdf]) {
                a = c.x;
                d = c.w;
                if (a == xcurprev$$module$synpdf && c.y == ycurprev$$module$synpdf) break;
                xcurprev$$module$synpdf = a;
                b = this.maatloper[0].style;
                b.left = a + "px";
                b.top = c.y + "px";
                b.width = d + "px";
                b.height = c.h + "px";
                var distanceToScroll = c.y - ycurprev$$module$synpdf; //if too far then pass 0 which will auto scroll instead of smooth
                console.log(distanceToScroll);
                c.y != ycurprev$$module$synpdf && doeRol$$module$synpdf(c.y - this.tmargin, Math.abs(distanceToScroll) > 500 ? 1 : 0);
                ycurprev$$module$synpdf = c.y;
                break
            }
        }
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
            //Save measure globally for position restoration if recording or part is changed.
            currentMeasureIndex = d;
            for (b = 0; b < deTijden$$module$synpdf.length; ++b)
                if (d == deTijden$$module$synpdf[b].mix) {
                    d = deTijden$$module$synpdf[b].t;
                    //Get the time for the first repeat version of this measure otherwise other recordings can mess this up.
                    currentMeasureTime = d ;
                    var f = b < deTijden$$module$synpdf.length - 1 ? deTijden$$module$synpdf[b +
                        1].t : d + 2;
                    b = d + (f - d) * (a - e.x) / e.w;
                    if (elmed$$module$synpdf.getPlayerState() === 5) {
                        elmed$$module$synpdf.seekTo(d + TOFF$$module$synpdf + offset$$module$synpdf);
                        break
                    };
                    c ? opt$$module$synpdf.loop && this.doLoopTag(a, e.y, b, d, f, {
                        x1: e.x,
                        x2: e.x + e.w
                    }) : (b = (opt$$module$synpdf.lncsr ? b : d + TOFF$$module$synpdf) + offset$$module$synpdf, playPause2$$module$synpdf(!1, b));
                    break
                } break
        }
    }
};

function findCurrentMeasureTime() {
    return new Promise((resolve, reject) => {
      let d;
      for (let b = 0; b < deTijden$$module$synpdf.length; b++) {
        console.log('findcurrentmeasuretime');
        if (demix$$module$synpdf === deTijden$$module$synpdf[b].mix) {
          d = deTijden$$module$synpdf[b].t;
          currentMeasureTime = d;
          resolve();
          break;
        }
      }
      reject("Measure time not found");
    });
}
  
  

Wijzer$$module$synpdf.prototype.goMsre = function(a, b) {
    0 == deTijden$$module$synpdf.length || b.altKey || b.ctrlKey || b
        .shiftKey || b.metaKey || (b.preventDefault && b.preventDefault(),
            detix$$module$synpdf += a ? 1 : -1, 0 > detix$$module$synpdf &&
            (detix$$module$synpdf = deTijden$$module$synpdf.length - 1),
            detix$$module$synpdf >= deTijden$$module$synpdf.length && (
                detix$$module$synpdf = 0), playPause2$$module$synpdf(!1,
                deTijden$$module$synpdf[detix$$module$synpdf].t +
                TOFF$$module$synpdf + offset$$module$synpdf))
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
    a.time = (deTijden$$module$synpdf[detix$$module$synpdf + 1].t - deTijden$$module$synpdf[detix$$module$synpdf].t) / b[0] ;
    a.num = b[0];
    return a
};


function DummyPlayer$$module$synpdf() {
    this.paused = !0;
    this.currentTime = 0;
    this.klok = -1;
    this.step = 200;
    this.playing = 0;
}
DummyPlayer$$module$synpdf.prototype.pause = function() {
    this.clearKlok();
    this.paused = !0;
    this.klok = -1;
};
DummyPlayer$$module$synpdf.prototype.play = function() {
    this.paused = !1;
    if (-1 == this.klok) {
        var a = this;
        this.setKlok(function() {
            a.currentTime += a.step / 1E3 ;
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

function setPagenum$$module$synpdf(a) {
    1 > opt$$module$synpdf.pagenum && (opt$$module$synpdf.pagenum = pdfDoc$$module$synpdf.numPages);
    opt$$module$synpdf.pagenum > pdfDoc$$module$synpdf.numPages && (opt$$module$synpdf.pagenum = 1);
    $("#pagenum").val(opt$$module$synpdf.pagenum);
    elmed$$module$synpdf.currentTime = 0;
    pageNumChanged$$module$synpdf = 1;
    resizePdfSyn$$module$synpdf()
}

function doeRol$$module$synpdf(a, b) {
    if (0 > a) {
        a = deMaten$$module$synpdf[demix$$module$synpdf] || deMaten$$module$synpdf[0];
        deNot$$module$synpdf.scrollTop = 0;
        $("#rollijn").css("top", a.y + $("#notation").offset().top - dottedHeight$$module$synpdf - 1);
        msc_wz$$module$synpdf && msc_wz$$module$synpdf.setTmargin();
    } else {
        a = Math.round(a);
        if (deNot$$module$synpdf.scrollTop != a) {
            if (scrollFlag === 1) {
                deNot$$module$synpdf.style["scroll-behavior"] = "auto" ;
                deNot$$module$synpdf.scrollTop = a;
            } 
            else {
                deNot$$module$synpdf.style["scroll-behavior"] = b ? "auto" : "smooth";
                deNot$$module$synpdf.scrollTop = a;
            }
        }
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
    $("#notation").append('<div id="leeg" style="height:' + bottomSpace$$module$synpdf +
        'px">&nbsp;</div>');
    msc_wz$$module$synpdf && msc_wz$$module$synpdf.setTmargin()
}

function readPdfdoc$$module$synpdf() {
    var startTime = performance.now();
    opt$$module$synpdf.pagewd = deNot$$module$synpdf.clientWidth;
    schaalMetriek$$module$synpdf();
    Cs$$module$synpdf = [];
    pageStfIx$$module$synpdf = [];
    deMaten$$module$synpdf = [];
    demix$$module$synpdf = 0;
    msc_wz$$module$synpdf = null;
    skipn$$module$synpdf = parseInt(opt$$module$synpdf.skipn);
    rendering$$module$synpdf = 1;
    // $("#render").html("rendering ...").toggle(!0);
    return goPage$$module$synpdf(1, 0).then(function() {
        var endTime = performance.now();
        var timeTaken = endTime - startTime;
        console.log("goPage$$module$synpdf took " + timeTaken + " milliseconds");
        return Promise.resolve(); // Resolve the promise after all pages are processed
    });
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
        const loadingTask = pdfjsLib.getDocument(a);
        loadingTask.onProgress = function(progressData) {
            var percentComplete = Math.min((progressData.loaded / progressData.total) * 100, 99);
            // Update the 'notation' div with the progress
            $("#notation").html('<h2>Loading PDF: ' + percentComplete.toFixed(0) + '%</h2>');
        };
        loadingTask.promise.then(function(a) {
          pdfDoc$$module$synpdf = a;
          $("#pagenum").attr("max", pdfDoc$$module$synpdf.numPages);
          readPdfdoc$$module$synpdf();
        });
      }
          
  }

//now returns a promise after each page so once it's all done we can call time2x in readpdfdoc() to scroll return on window resize.
function goPage$$module$synpdf(a, b) {
    return pdfDoc$$module$synpdf.getPage(a).then(function(page) {
        var viewport2 = page.getViewport({ scale: (deMetriek$$module$synpdf[0] / page._pageInfo.view[2]) });
        var viewport = page.getViewport({ scale: 3 });
        var canvas = document.createElement("canvas");
        var ctx = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        canvas.style.width = viewport2.width + "px";
        canvas.style.height = viewport2.height + "px";
        return page.render({
            canvasContext: ctx,
            viewport: viewport,
        }).promise.then(function() {
            canvas = compPage$$module$synpdf(canvas, a, b);
            if (a === 1 && newInstrumentTime2xFlag === 1) {
                msc_wz$$module$synpdf.time2x(elmed$$module$synpdf.getCurrentTime() - offset$$module$synpdf);
                newInstrumentTime2xFlag = 0;
              }
            if (doresize$$module$synpdf) {
                resizePdf$$module$synpdf();
            } else {
                if (a < pdfDoc$$module$synpdf.numPages) {
                    return goPage$$module$synpdf(a + 1, b + viewport2.height);
                } else {
                    rendering$$module$synpdf = 0;
                    addDummySys$$module$synpdf();
                }
            }
        });
    });
}

function compPage$$module$synpdf(a, b, c) {
    var d = deMetriek$$module$synpdf[b];
    pageNumChanged$$module$synpdf = 0;
    a = knip$$module$synpdf(a, d, c);
    pageStfIx$$module$synpdf.push(Cs$$module$synpdf.length);
    Cs$$module$synpdf = Cs$$module$synpdf.concat(d.cxs);
    msc_wz$$module$synpdf || startIntf$$module$synpdf(a);
    $("#notation").append(a);
    $(a).on("mousedown touchstart", kliklang$$module$synpdf);
    deMaten$$module$synpdf.length >= demix$$module$synpdf && msc_wz$$module$synpdf.cursorTime && msc_wz$$module$synpdf.time2x(msc_wz$$module$synpdf.cursorTime);
    return a
}

function tick$$module$synpdf(a) {
    if (elmed$$module$synpdf && msc_wz$$module$synpdf && (!yubchk$$module$synpdf || elmed$$module$synpdf == ybplayer$$module$synpdf)) {
        var b = (yubchk$$module$synpdf ? elmed$$module$synpdf.getCurrentTime() : elmed$$module$synpdf.currentTime) - offset$$module$synpdf;
        !msc_wz$$module$synpdf || a && 0 != a % 10 || msc_wz$$module$synpdf.time2x(b);
        scrollFlag = 0;

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
                console.log(c);
                c && opt$$module$synpdf.annot ? msc_wz$$module$synpdf.annot(d, a) : msc_wz$$module$synpdf.x2time(d, a, c)
            }
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
}

function resizePdf$$module$synpdf(scrollType) {
    if (scrollType === 1) {
        doresize$$module$synpdf = 1 ;
        deNot$$module$synpdf.style["scroll-behavior"] = "auto" ;
    }
    pdfDoc$$module$synpdf && ($("#wait").text("Recomputing systems ..."), $("#wait").css({
        display: "block",
        background: "rgb(200,200,255)"
    }), readPdfdoc$$module$synpdf().then(function() {
        msc_wz$$module$synpdf.time2x(elmed$$module$synpdf.getCurrentTime() - offset$$module$synpdf);
    }))
}

function resizePdfSyn$$module$synpdf() {
    rendering$$module$synpdf ? (doresize$$module$synpdf = 1, $("#wait").html("Resize waits on rendering ..."), $("#wait").css({
        display: "block",
        background: "rgb(255,200,200)"
    })) : resizePdf$$module$synpdf()
}

function yubApiReady$$module$synpdf() {
    ybplayer$$module$synpdf = new YT.Player("vidyub", {
        events: {
            'onReady': function() {
                $("#yubuse").prop("checked", !0);
                yubload$$module$synpdf()
            },
            'onStateChange': onPlayerStateChange
        }
    })
}
//Need async function so that music doesn't scroll back to 0 briefly while seeking.
async function onPlayerStateChange(event) {
    
    if (bypassTickFlag === 1) {
        console.log('change recordingflag: ', bypassTickFlag);
        try {
            console.log(newPlayerCue);
            await seekToPromise(newPlayerCue);  // Seek to newPlayerCue seconds
            console.log('Video has been successfully seeked');
            elmed$$module$synpdf.playVideo(); 
            bypassTickFlag = 0;
        } catch (error) {
            console.error('Failed to seek video:', error);
        }
    }
    event.data == YT.PlayerState.PLAYING ? (dummyPlayer$$module$synpdf.setKlok(tick$$module$synpdf, 200), setPauseState$$module$synpdf(!1)) : (dummyPlayer$$module$synpdf.clearKlok(), setPauseState$$module$synpdf(!0));
    //newPlayerCue needs to subtract offset because time2x uses teTijden time to find deMaten position, not video time
    if (event.data == YT.PlayerState.CUED) {
        scrollFlag = 1 ;
        msc_wz$$module$synpdf.time2x(newPlayerCue - offset$$module$synpdf);
        setNotationHeight$$module$synpdf();
    }
    if (event.data == YT.PlayerState.PAUSED) {
        scrollFlag = 1 ;
    }
}

function seekToPromise(time) {
    return new Promise((resolve, reject) => {
      elmed$$module$synpdf.seekTo(time, true);
  
      // Listen for the video time to update
      const interval = setInterval(() => {
        if (elmed$$module$synpdf.getCurrentTime() === time) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
  
      // Optionally, add a timeout to reject the promise after a certain period
      setTimeout(() => {
        clearInterval(interval);
        reject(new Error('Timeout after trying to seek to the desired time'));
      }, 10000);  // 10 seconds timeout
    });
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
        a.on("playing", function() {
            dummyPlayer$$module$synpdf.setKlok(null, 0);
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
        setNotationHeight$$module$synpdf()
        // below media_height is changed from 30% to 200px
    } else yubchk$$module$synpdf = 1, opt$$module$synpdf.media_height || (opt$$module$synpdf.media_height = "200px"), $("#vid, #aud").css("display", "none"), $("#vidyub").css("display", "inline-block"), yubload$$module$synpdf(function() {
        elmed$$module$synpdf = ybplayer$$module$synpdf;
        elmed$$module$synpdf.cueVideoById({
            videoId: opt$$module$synpdf.yubvid,
            startSeconds: c
        });
    })
}

function changeStartTime(newTime) {
    console.log('changing starttime to ', newTime);
    elmed$$module$synpdf.cueVideoById({
        videoId: opt$$module$synpdf.yubvid,
        startSeconds: newTime
    });
   
}
function setNotationHeight$$module$synpdf() {
    $("#buttons").toggleClass("noheight", !!opt$$module$synpdf.noplyr);
    $("#knop").toggle(!!opt$$module$synpdf.playbtn);
    var a = parseFloat($("#buttons").css("height"));
    // $("#vidyub").css("width", (1.52 * a).toFixed());
    msc_wz$$module$synpdf && msc_wz$$module$synpdf.setTmargin();
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

function playPause2$$module$synpdf(play, time) {
    play = play + ":" + time.toFixed(2) + ":" + (play && $("#cntin").prop("checked"));
    playPause$$module$synpdf(play, 0)
}

function setPauseState$$module$synpdf(a) {
    msc_wz$$module$synpdf && (msc_wz$$module$synpdf.paused = a, $("#knop").val(a ? "Play" : "Pause"), $("#sync_out").css("background", a ? "" : "#ff0"))
}

function pauseer$$module$synpdf() {
    yubchk$$module$synpdf ? 1 == elmed$$module$synpdf.getPlayerState() && elmed$$module$synpdf.pauseVideo() : elmed$$module$synpdf.paused || elmed$$module$synpdf.pause()
}

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
            var time = yubchk$$module$synpdf ? elmed$$module$synpdf.getCurrentTime() : elmed$$module$synpdf.currentTime;
            playPause2$$module$synpdf(!0, time);
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
            incrementSpeed();
            break;
        case "-":
            decrementSpeed();
            break;
        case "Escape":
            $("#menu, #saveDlg").toggle(!1);
            $("#help").toggleClass("showhlp", !1);
            break;
            
        default:
            c = 0
    }
    if (opt$$module$synpdf.synbox && msc_wz$$module$synpdf && !c) {
        switch (b) {
            case "b":
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
    }
}

function msc_check_preload$$module$synpdf() {
    // fills out opt with defaults in needed
    for (var b in opt_default$$module$synpdf) opt$$module$synpdf[b] = b in opt$$module$synpdf ? opt$$module$synpdf[b] : opt_default$$module$synpdf[b];
    metric_arr$$module$synpdf && (deMetriek$$module$synpdf = metric_arr$$module$synpdf, schaalMetriek$$module$synpdf());
    media_dir$$module$synpdf && pdf_file$$module$synpdf && (pdf_file$$module$synpdf = media_dir$$module$synpdf + pdf_file$$module$synpdf);
    pdfFnm$$module$synpdf = pdf_file$$module$synpdf;
    pdf_file$$module$synpdf && readPdf$$module$synpdf(pdf_file$$module$synpdf, "url");
    offset_js$$module$synpdf && (offset$$module$synpdf = offset_js$$module$synpdf);
    opt$$module$synpdf.yubvid && !opt$$module$synpdf.nomed && setPlayer$$module$synpdf("", "");
    opt$$module$synpdf.no_menu && !fullmenu$$module$synpdf && ($("#sync").css("display", "none"), opt$$module$synpdf.btns = 0, $("body").on("contextmenu", function(a) {
        a.preventDefault()
    }));
    resetIntf$$module$synpdf(!1)
    
}

function schaalMetriek$$module$synpdf() {
    var a = (deMetriek$$module$synpdf[0]),
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
    $(window).off("resize").on("resize", function() {
        doResize$$module$synpdf();
    });    
}

function doResize$$module$synpdf() {
    var a = $("body").prop("clientWidth");
    a == bodyWidth$$module$synpdf ? msc_wz$$module$synpdf && msc_wz$$module$synpdf.setTmargin() : (bodyWidth$$module$synpdf = a, clearTimeout(resizeTimer$$module$synpdf), resizeTimer$$module$synpdf = setTimeout(function() {
        resizePdfSyn$$module$synpdf()
    }, 200))
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
    bodyWidth$$module$synpdf = $("body").prop("clientWidth");
    initPreload$$module$synpdf()
    resetIntf$$module$synpdf(!0);
    $("body").keydown(keyDown$$module$synpdf);
    $("#buttons, #sync").keydown(function(a) {
        " " == a.key && a.stopPropagation()
    });
    
    $("#closehelp").click(function() {
        $("#help").toggleClass("showhlp", 0)
    });
    $("#helpm").click(function() {
        $("#help").toggleClass("showhlp")
    });
    $("input[type=number]").keydown(function(a) {
        a.stopPropagation()
    });
    $("#mbar").click(function(a) {
        if ($("#menu").css("display") === "none") {
          doReadPdf$$module$synpdf = 0;
          $("#menu").css("display", "block");
          $("#sync").css("border-top-left-radius", "16px");
        } else {
          hideMenu$$module$synpdf();
          $("#sync").css("border-top-left-radius", "0px");
        }
      });
    $(window).resize(function() {
        msc_wz$$module$synpdf && msc_wz$$module$synpdf.setTmargin();

    });

    $("body").on("fullscreenchange webkitfullscreenchange mozfullscreenchange",
        function() {
            var a = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;
            $("#fscr").prop("checked", null != a)
        });
    window.addEventListener("message", function(a) {
        "play" == a.data && keyDown$$module$synpdf({
            key: " "
        });
        a.data.startsWith("key=") &&
            (a = a.data.match(/^key=(.+)$/)) && keyDown$$module$synpdf({
                key: a[1]
            })
    })
      
});
