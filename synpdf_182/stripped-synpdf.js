pdfjsLib.GlobalWorkerOptions.workerSrc = '//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.9.179/pdf.worker.min.js';

//POLYFILL FOR BROWSER COMPATIBILITY//
var $jscomp = $jscomp || {};
$jscomp.scope = {};
$jscomp.arrayIteratorImpl = function(a) {
    var b = 0;
    return function() {
        return b < a.length ? {
            done: !1,
            value: a[b++]
        } : {
            done: !0
        }
    }
};
$jscomp.arrayIterator = function(a) {
    return {
        next: $jscomp.arrayIteratorImpl(a)
    }
};
$jscomp.makeIterator = function(a) {
    var b = "undefined" != typeof Symbol && Symbol.iterator && a[Symbol.iterator];
    return b ? b.call(a) : $jscomp.arrayIterator(a)
};
$jscomp.getGlobal = function(a) {
    a = ["object" == typeof window && window, "object" == typeof self && self, "object" == typeof global && global, a];
    for (var b = 0; b < a.length; ++b) {
        var c = a[b];
        if (c && c.Math == Math) return c
    }
    return globalThis
};
$jscomp.global = $jscomp.getGlobal(this);
$jscomp.ASSUME_ES5 = !1;
$jscomp.ASSUME_NO_NATIVE_MAP = !1;
$jscomp.ASSUME_NO_NATIVE_SET = !1;
$jscomp.SIMPLE_FROUND_POLYFILL = !1;
$jscomp.defineProperty = $jscomp.ASSUME_ES5 || "function" == typeof Object.defineProperties ? Object.defineProperty : function(a, b, c) {
    a != Array.prototype && a != Object.prototype && (a[b] = c.value)
};
$jscomp.polyfill = function(a, b, c, d) {
    if (b) {
        c = $jscomp.global;
        a = a.split(".");
        for (d = 0; d < a.length - 1; d++) {
            var e = a[d];
            e in c || (c[e] = {});
            c = c[e]
        }
        a = a[a.length - 1];
        d = c[a];
        b = b(d);
        b != d && null != b && $jscomp.defineProperty(c, a, {
            configurable: !0,
            writable: !0,
            value: b
        })
    }
};
$jscomp.FORCE_POLYFILL_PROMISE = !1;
$jscomp.polyfill("Promise", function(a) {
    function b() {
        this.batch_ = null
    }

    function c(a) {
        return a instanceof e ? a : new e(function(b, c) {
            b(a)
        })
    }
    if (a && !$jscomp.FORCE_POLYFILL_PROMISE) return a;
    b.prototype.asyncExecute = function(a) {
        if (null == this.batch_) {
            this.batch_ = [];
            var b = this;
            this.asyncExecuteFunction(function() {
                b.executeBatch_()
            })
        }
        this.batch_.push(a)
    };
    var d = $jscomp.global.setTimeout;
    b.prototype.asyncExecuteFunction = function(a) {
        d(a, 0)
    };
    b.prototype.executeBatch_ = function() {
        for (; this.batch_ && this.batch_.length;) {
            var a =
                this.batch_;
            this.batch_ = [];
            for (var b = 0; b < a.length; ++b) {
                var c = a[b];
                a[b] = null;
                try {
                    c()
                } catch (n) {
                    this.asyncThrow_(n)
                }
            }
        }
        this.batch_ = null
    };
    b.prototype.asyncThrow_ = function(a) {
        this.asyncExecuteFunction(function() {
            throw a;
        })
    };
    var e = function(a) {
        this.state_ = 0;
        this.result_ = void 0;
        this.onSettledCallbacks_ = [];
        var b = this.createResolveAndReject_();
        try {
            a(b.resolve, b.reject)
        } catch (m) {
            b.reject(m)
        }
    };
    e.prototype.createResolveAndReject_ = function() {
        function a(a) {
            return function(d) {
                c || (c = !0, a.call(b, d))
            }
        }
        var b = this,
            c = !1;
        return {
            resolve: a(this.resolveTo_),
            reject: a(this.reject_)
        }
    };
    e.prototype.resolveTo_ = function(a) {
        if (a === this) this.reject_(new TypeError("A Promise cannot resolve to itself"));
        else if (a instanceof e) this.settleSameAsPromise_(a);
        else {
            a: switch (typeof a) {
                case "object":
                    var b = null != a;
                    break a;
                case "function":
                    b = !0;
                    break a;
                default:
                    b = !1
            }
            b ? this.resolveToNonPromiseObj_(a) : this.fulfill_(a)
        }
    };
    e.prototype.resolveToNonPromiseObj_ = function(a) {
        var b = void 0;
        try {
            b = a.then
        } catch (m) {
            this.reject_(m);
            return
        }
        "function" == typeof b ?
            this.settleSameAsThenable_(b, a) : this.fulfill_(a)
    };
    e.prototype.reject_ = function(a) {
        this.settle_(2, a)
    };
    e.prototype.fulfill_ = function(a) {
        this.settle_(1, a)
    };
    e.prototype.settle_ = function(a, b) {
        if (0 != this.state_) throw Error("Cannot settle(" + a + ", " + b + "): Promise already settled in state" + this.state_);
        this.state_ = a;
        this.result_ = b;
        this.executeOnSettledCallbacks_()
    };
    e.prototype.executeOnSettledCallbacks_ = function() {
        if (null != this.onSettledCallbacks_) {
            for (var a = 0; a < this.onSettledCallbacks_.length; ++a) f.asyncExecute(this.onSettledCallbacks_[a]);
            this.onSettledCallbacks_ = null
        }
    };
    var f = new b;
    e.prototype.settleSameAsPromise_ = function(a) {
        var b = this.createResolveAndReject_();
        a.callWhenSettled_(b.resolve, b.reject)
    };
    e.prototype.settleSameAsThenable_ = function(a, b) {
        var c = this.createResolveAndReject_();
        try {
            a.call(b, c.resolve, c.reject)
        } catch (n) {
            c.reject(n)
        }
    };
    e.prototype.then = function(a, b) {
        function c(a, b) {
            return "function" == typeof a ? function(b) {
                try {
                    d(a(b))
                } catch (u) {
                    f(u)
                }
            } : b
        }
        var d, f, g = new e(function(a, b) {
            d = a;
            f = b
        });
        this.callWhenSettled_(c(a, d), c(b, f));
        return g
    };
    e.prototype.catch = function(a) {
        return this.then(void 0, a)
    };
    e.prototype.callWhenSettled_ = function(a, b) {
        function c() {
            switch (d.state_) {
                case 1:
                    a(d.result_);
                    break;
                case 2:
                    b(d.result_);
                    break;
                default:
                    throw Error("Unexpected state: " + d.state_);
            }
        }
        var d = this;
        null == this.onSettledCallbacks_ ? f.asyncExecute(c) : this.onSettledCallbacks_.push(c)
    };
    e.resolve = c;
    e.reject = function(a) {
        return new e(function(b, c) {
            c(a)
        })
    };
    e.race = function(a) {
        return new e(function(b, d) {
            for (var f = $jscomp.makeIterator(a), e = f.next(); !e.done; e = f.next()) c(e.value).callWhenSettled_(b,
                d)
        })
    };
    e.all = function(a) {
        var b = $jscomp.makeIterator(a),
            d = b.next();
        return d.done ? c([]) : new e(function(a, f) {
            function e(b) {
                return function(c) {
                    g[b] = c;
                    m--;
                    0 == m && a(g)
                }
            }
            var g = [],
                m = 0;
            do g.push(void 0), m++, c(d.value).callWhenSettled_(e(g.length - 1), f), d = b.next(); while (!d.done)
        })
    };
    return e
}, "es6", "es3");
$jscomp.SYMBOL_PREFIX = "jscomp_symbol_";
$jscomp.initSymbol = function() {
    $jscomp.initSymbol = function() {};
    $jscomp.global.Symbol || ($jscomp.global.Symbol = $jscomp.Symbol)
};
$jscomp.SymbolClass = function(a, b) {
    this.$jscomp$symbol$id_ = a;
    $jscomp.defineProperty(this, "description", {
        configurable: !0,
        writable: !0,
        value: b
    })
};
$jscomp.SymbolClass.prototype.toString = function() {
    return this.$jscomp$symbol$id_
};
$jscomp.Symbol = function() {
    function a(c) {
        if (this instanceof a) throw new TypeError("Symbol is not a constructor");
        return new $jscomp.SymbolClass($jscomp.SYMBOL_PREFIX + (c || "") + "_" + b++, c)
    }
    var b = 0;
    return a
}();
$jscomp.initSymbolIterator = function() {
    $jscomp.initSymbol();
    var a = $jscomp.global.Symbol.iterator;
    a || (a = $jscomp.global.Symbol.iterator = $jscomp.global.Symbol("Symbol.iterator"));
    "function" != typeof Array.prototype[a] && $jscomp.defineProperty(Array.prototype, a, {
        configurable: !0,
        writable: !0,
        value: function() {
            return $jscomp.iteratorPrototype($jscomp.arrayIteratorImpl(this))
        }
    });
    $jscomp.initSymbolIterator = function() {}
};
$jscomp.initSymbolAsyncIterator = function() {
    $jscomp.initSymbol();
    var a = $jscomp.global.Symbol.asyncIterator;
    a || (a = $jscomp.global.Symbol.asyncIterator = $jscomp.global.Symbol("Symbol.asyncIterator"));
    $jscomp.initSymbolAsyncIterator = function() {}
};
$jscomp.iteratorPrototype = function(a) {
    $jscomp.initSymbolIterator();
    a = {
        next: a
    };
    a[$jscomp.global.Symbol.iterator] = function() {
        return this
    };
    return a
};
$jscomp.underscoreProtoCanBeSet = function() {
    var a = {
            a: !0
        },
        b = {};
    try {
        return b.__proto__ = a, b.a
    } catch (c) {}
    return !1
};
$jscomp.setPrototypeOf = "function" == typeof Object.setPrototypeOf ? Object.setPrototypeOf : $jscomp.underscoreProtoCanBeSet() ? function(a, b) {
    a.__proto__ = b;
    if (a.__proto__ !== b) throw new TypeError(a + " is not extensible");
    return a
} : null;
$jscomp.generator = {};
$jscomp.generator.ensureIteratorResultIsObject_ = function(a) {
    if (!(a instanceof Object)) throw new TypeError("Iterator result " + a + " is not an object");
};
$jscomp.generator.Context = function() {
    this.isRunning_ = !1;
    this.yieldAllIterator_ = null;
    this.yieldResult = void 0;
    this.nextAddress = 1;
    this.finallyAddress_ = this.catchAddress_ = 0;
    this.finallyContexts_ = this.abruptCompletion_ = null
};
$jscomp.generator.Context.prototype.start_ = function() {
    if (this.isRunning_) throw new TypeError("Generator is already running");
    this.isRunning_ = !0
};
$jscomp.generator.Context.prototype.stop_ = function() {
    this.isRunning_ = !1
};
$jscomp.generator.Context.prototype.jumpToErrorHandler_ = function() {
    this.nextAddress = this.catchAddress_ || this.finallyAddress_
};
$jscomp.generator.Context.prototype.next_ = function(a) {
    this.yieldResult = a
};
$jscomp.generator.Context.prototype.throw_ = function(a) {
    this.abruptCompletion_ = {
        exception: a,
        isException: !0
    };
    this.jumpToErrorHandler_()
};
$jscomp.generator.Context.prototype.return = function(a) {
    this.abruptCompletion_ = {
        return: a
    };
    this.nextAddress = this.finallyAddress_
};
$jscomp.generator.Context.prototype.jumpThroughFinallyBlocks = function(a) {
    this.abruptCompletion_ = {
        jumpTo: a
    };
    this.nextAddress = this.finallyAddress_
};
$jscomp.generator.Context.prototype.yield = function(a, b) {
    this.nextAddress = b;
    return {
        value: a
    }
};
$jscomp.generator.Context.prototype.yieldAll = function(a, b) {
    a = $jscomp.makeIterator(a);
    var c = a.next();
    $jscomp.generator.ensureIteratorResultIsObject_(c);
    if (c.done) this.yieldResult = c.value, this.nextAddress = b;
    else return this.yieldAllIterator_ = a, this.yield(c.value, b)
};
$jscomp.generator.Context.prototype.jumpTo = function(a) {
    this.nextAddress = a
};
$jscomp.generator.Context.prototype.jumpToEnd = function() {
    this.nextAddress = 0
};
$jscomp.generator.Context.prototype.setCatchFinallyBlocks = function(a, b) {
    this.catchAddress_ = a;
    void 0 != b && (this.finallyAddress_ = b)
};
$jscomp.generator.Context.prototype.setFinallyBlock = function(a) {
    this.catchAddress_ = 0;
    this.finallyAddress_ = a || 0
};
$jscomp.generator.Context.prototype.leaveTryBlock = function(a, b) {
    this.nextAddress = a;
    this.catchAddress_ = b || 0
};
$jscomp.generator.Context.prototype.enterCatchBlock = function(a) {
    this.catchAddress_ = a || 0;
    a = this.abruptCompletion_.exception;
    this.abruptCompletion_ = null;
    return a
};
$jscomp.generator.Context.prototype.enterFinallyBlock = function(a, b, c) {
    c ? this.finallyContexts_[c] = this.abruptCompletion_ : this.finallyContexts_ = [this.abruptCompletion_];
    this.catchAddress_ = a || 0;
    this.finallyAddress_ = b || 0
};
$jscomp.generator.Context.prototype.leaveFinallyBlock = function(a, b) {
    b = this.finallyContexts_.splice(b || 0)[0];
    if (b = this.abruptCompletion_ = this.abruptCompletion_ || b) {
        if (b.isException) return this.jumpToErrorHandler_();
        void 0 != b.jumpTo && this.finallyAddress_ < b.jumpTo ? (this.nextAddress = b.jumpTo, this.abruptCompletion_ = null) : this.nextAddress = this.finallyAddress_
    } else this.nextAddress = a
};
$jscomp.generator.Context.prototype.forIn = function(a) {
    return new $jscomp.generator.Context.PropertyIterator(a)
};
$jscomp.generator.Context.PropertyIterator = function(a) {
    this.object_ = a;
    this.properties_ = [];
    for (var b in a) this.properties_.push(b);
    this.properties_.reverse()
};
$jscomp.generator.Context.PropertyIterator.prototype.getNext = function() {
    for (; 0 < this.properties_.length;) {
        var a = this.properties_.pop();
        if (a in this.object_) return a
    }
    return null
};
$jscomp.generator.Engine_ = function(a) {
    this.context_ = new $jscomp.generator.Context;
    this.program_ = a
};
$jscomp.generator.Engine_.prototype.next_ = function(a) {
    this.context_.start_();
    if (this.context_.yieldAllIterator_) return this.yieldAllStep_(this.context_.yieldAllIterator_.next, a, this.context_.next_);
    this.context_.next_(a);
    return this.nextStep_()
};
$jscomp.generator.Engine_.prototype.return_ = function(a) {
    this.context_.start_();
    var b = this.context_.yieldAllIterator_;
    if (b) return this.yieldAllStep_("return" in b ? b["return"] : function(a) {
        return {
            value: a,
            done: !0
        }
    }, a, this.context_.return);
    this.context_.return(a);
    return this.nextStep_()
};
$jscomp.generator.Engine_.prototype.throw_ = function(a) {
    this.context_.start_();
    if (this.context_.yieldAllIterator_) return this.yieldAllStep_(this.context_.yieldAllIterator_["throw"], a, this.context_.next_);
    this.context_.throw_(a);
    return this.nextStep_()
};
$jscomp.generator.Engine_.prototype.yieldAllStep_ = function(a, b, c) {
    try {
        var d = a.call(this.context_.yieldAllIterator_, b);
        $jscomp.generator.ensureIteratorResultIsObject_(d);
        if (!d.done) return this.context_.stop_(), d;
        var e = d.value
    } catch (f) {
        return this.context_.yieldAllIterator_ = null, this.context_.throw_(f), this.nextStep_()
    }
    this.context_.yieldAllIterator_ = null;
    c.call(this.context_, e);
    return this.nextStep_()
};
$jscomp.generator.Engine_.prototype.nextStep_ = function() {
    for (; this.context_.nextAddress;) try {
        var a = this.program_(this.context_);
        if (a) return this.context_.stop_(), {
            value: a.value,
            done: !1
        }
    } catch (b) {
        this.context_.yieldResult = void 0, this.context_.throw_(b)
    }
    this.context_.stop_();
    if (this.context_.abruptCompletion_) {
        a = this.context_.abruptCompletion_;
        this.context_.abruptCompletion_ = null;
        if (a.isException) throw a.exception;
        return {
            value: a.return,
            done: !0
        }
    }
    return {
        value: void 0,
        done: !0
    }
};
$jscomp.generator.Generator_ = function(a) {
    this.next = function(b) {
        return a.next_(b)
    };
    this.throw = function(b) {
        return a.throw_(b)
    };
    this.return = function(b) {
        return a.return_(b)
    };
    $jscomp.initSymbolIterator();
    this[Symbol.iterator] = function() {
        return this
    }
};
$jscomp.generator.createGenerator = function(a, b) {
    b = new $jscomp.generator.Generator_(new $jscomp.generator.Engine_(b));
    $jscomp.setPrototypeOf && $jscomp.setPrototypeOf(b, a.prototype);
    return b
};
$jscomp.asyncExecutePromiseGenerator = function(a) {
    function b(b) {
        return a.next(b)
    }

    function c(b) {
        return a.throw(b)
    }
    return new Promise(function(d, e) {
        function f(a) {
            a.done ? d(a.value) : Promise.resolve(a.value).then(b, c).then(f, e)
        }
        f(a.next())
    })
};
$jscomp.asyncExecutePromiseGeneratorFunction = function(a) {
    return $jscomp.asyncExecutePromiseGenerator(a())
};
$jscomp.asyncExecutePromiseGeneratorProgram = function(a) {
    return $jscomp.asyncExecutePromiseGenerator(new $jscomp.generator.Generator_(new $jscomp.generator.Engine_(a)))
};
$jscomp.polyfill("globalThis", function(a) {
    return a || $jscomp.global
}, "es_next", "es3");
$jscomp.iteratorFromArray = function(a, b) {
    $jscomp.initSymbolIterator();
    a instanceof String && (a += "");
    var c = 0,
        d = {
            next: function() {
                if (c < a.length) {
                    var e = c++;
                    return {
                        value: b(e, a[e]),
                        done: !1
                    }
                }
                d.next = function() {
                    return {
                        done: !0,
                        value: void 0
                    }
                };
                return d.next()
            }
        };
    d[Symbol.iterator] = function() {
        return d
    };
    return d
};
$jscomp.polyfill("Array.prototype.keys", function(a) {
    return a ? a : function() {
        return $jscomp.iteratorFromArray(this, function(a) {
            return a
        })
    }
}, "es6", "es3");
$jscomp.checkStringArgs = function(a, b, c) {
    if (null == a) throw new TypeError("The 'this' value for String.prototype." + c + " must not be null or undefined");
    if (b instanceof RegExp) throw new TypeError("First argument to String.prototype." + c + " must not be a regular expression");
    return a + ""
};
$jscomp.polyfill("String.prototype.startsWith", function(a) {
    return a ? a : function(a, c) {
        var b = $jscomp.checkStringArgs(this, a, "startsWith");
        a += "";
        var e = b.length,
            f = a.length;
        c = Math.max(0, Math.min(c | 0, b.length));
        for (var g = 0; g < f && c < e;)
            if (b[c++] != a[g++]) return !1;
        return g >= f
    }
}, "es6", "es3");

// END POLYFILL ---- BEGIN SYNPDF //
var msc_VERSION$$module$synpdf = 182,
    opt$$module$synpdf, times_arr$$module$synpdf, offset_js$$module$synpdf, pdf_file$$module$synpdf, media_file$$module$synpdf, pdf_data$$module$synpdf, jpg_data$$module$synpdf, media_dir$$module$synpdf, annots$$module$synpdf, lpRec$$module$synpdf, metric_arr$$module$synpdf, pdfDoc$$module$synpdf, pdfData$$module$synpdf, jpgData$$module$synpdf, nPage$$module$synpdf =
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
    hasSmooth$$module$synpdf, deNot$$module$synpdf = 0,
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
        speed: 1,
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
        loop: 0,
        annot: 0,
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
    pdf_file$$module$synpdf = media_file$$module$synpdf = pdfFnm$$module$synpdf = mediaFnm$$module$synpdf =
        "";
    yubchk$$module$synpdf = 0;
    elmed$$module$synpdf = null;
    annots$$module$synpdf = [];
    initLoopRec$$module$synpdf();
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
    this.maatloper = $('<div class="demaat" style="background:rgba(215,255,71,0.2); left:0px; top:0px; width:0px; height:0px"></div>');
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
                msc_wz$$module$synpdf.goMsre(1, {});
                pauseer$$module$synpdf();
                break
            }
            if (c = deMaten$$module$synpdf[demix$$module$synpdf]) {
                opt$$module$synpdf.lncsr &&
                    b < deTijden$$module$synpdf.length - 1 ? (b = deTijden$$module$synpdf[b + 1], a = c.x + c.w * (a - d.t) / (b.t - d.t), d = 6) : (a = c.x, d = c.w);
                if (a == xcurprev$$module$synpdf && c.y == ycurprev$$module$synpdf) break;
                xcurprev$$module$synpdf = a;
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
    initPbRates$$module$synpdf(.25, 2, .05)
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
            deNot$$module$synpdf.style["scroll-behavior"] = b ? "auto" : "smooth";
            deNot$$module$synpdf.scrollTop = a;
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
    opt$$module$synpdf.pagewd = opt$$module$synpdf.advncd ? opt$$module$synpdf.fixwd : deNot$$module$synpdf.clientWidth;
    schaalMetriek$$module$synpdf();
    Cs$$module$synpdf = [];
    pageStfIx$$module$synpdf = [];
    deMaten$$module$synpdf = [];
    demix$$module$synpdf = 0;
    msc_wz$$module$synpdf = null;
    skipn$$module$synpdf = parseInt(opt$$module$synpdf.skipn);
    rendering$$module$synpdf = 1;
    // $("#render").html("rendering ...").toggle(!0);

    if (goPageQuickFlag === 1) {
        return goPageQuick$$module$synpdf(1, 0);
    } else {
        return goPage$$module$synpdf(1, 0).then(function() {
            return Promise.resolve(); // Resolve the promise after all pages are processed
        });
    }
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

//now returns a promise after each page so once it's all done we can call time2x in readpdfdoc() to scroll return on window resize.
function goPage$$module$synpdf(a, b) {
    opt$$module$synpdf.advncd && (a = 1 * opt$$module$synpdf.pagenum);
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
            console.log('gopagenormal', a);
            canvasesGlobal[a - 1] = canvas;
            canvas = compPage$$module$synpdf(canvas, a, b);
            if (a === 1 && newInstrumentTime2xFlag === 1) {
                msc_wz$$module$synpdf.time2x(elmed$$module$synpdf.getCurrentTime() - offset$$module$synpdf);
                newInstrumentTime2xFlag = 0;
              }
            if (opt$$module$synpdf.advncd) {
                rendering$$module$synpdf = 0;
                addDummySys$$module$synpdf();
            } else {
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
            }
        });
    });
}
  
function goPageQuick$$module$synpdf(a, b) {
    console.log('gopagequick');
    opt$$module$synpdf.advncd && (a = 1 * opt$$module$synpdf.pagenum);  // If advanced mode is on, set the page number to the predefined value
    pdfDoc$$module$synpdf.getPage(a).then(function(page) { 
        // $("#render").html("rendering page: " + a + "/" + pdfDoc$$module$synpdf._pdfInfo.numPages);  // Update the HTML element with id='render' with the page number
        var viewport2 = page.getViewport({ scale : (deMetriek$$module$synpdf[0] / page._pageInfo.view[2])});
        var viewport = page.getViewport({scale : 3});
        var canvas = document.createElement("canvas");  // Create a canvas element
        var ctx = canvas.getContext("2d");
        canvas.height = viewport.height;  // Set the dimensions of the canvas to match the page size
        canvas.width = viewport.width;
        canvas.style.width = (viewport2.width + 'px');
        canvas.style.height = (viewport2.height + 'px');

        // skip rendering, proceed to further process the page
        canvas = canvasesGlobal[a - 1];
        canvas = compPage$$module$synpdf(canvas, a, b);
        if(opt$$module$synpdf.advncd) {  // Continue based on global condition variables
            rendering$$module$synpdf = 0;
            addDummySys$$module$synpdf();
        } else {
            if(doresize$$module$synpdf) {
                resizePdf$$module$synpdf();
            } else {
                if(a < pdfDoc$$module$synpdf.numPages) {
                    goPageQuick$$module$synpdf(a + 1, b + viewport2.height);
                } else {
                    rendering$$module$synpdf = 0;
                    addDummySys$$module$synpdf();
                }
            }
        }
    })
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
        var c = b;
        opt$$module$synpdf.loop && (b > lpRec$$module$synpdf.loopEnd && (b = lpRec$$module$synpdf.loopStart),
        b < lpRec$$module$synpdf.loopStart && (b = lpRec$$module$synpdf.loopStart + TOFF$$module$synpdf),
        b != c && (yubchk$$module$synpdf ? elmed$$module$synpdf.seekTo(b + offset$$module$synpdf, !0) :
        elmed$$module$synpdf.currentTime = b + offset$$module$synpdf));
        !msc_wz$$module$synpdf || a && 0 != a % 10 || msc_wz$$module$synpdf.time2x(b);
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
}

function resizePdf$$module$synpdf() {
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


function readPdfOrJs$$module$synpdf(a) {
    var b = arrbuf2str$$module$synpdf(a);
        initPreload$$module$synpdf();
        msc_check_preload$$module$synpdf();
    
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
    console.log('change recordingflag: ', bypassTickFlag);
    if (bypassTickFlag === 1) {
        try {
            await seekToPromise(newPlayerCue);  // Seek to newPlayerCue seconds
            console.log('Video has been successfully seeked');
            elmed$$module$synpdf.pauseVideo(); 
            bypassTickFlag = 0;
        } catch (error) {
            console.error('Failed to seek video:', error);
        }
    }
    event.data == YT.PlayerState.PLAYING ? (dummyPlayer$$module$synpdf.setKlok(tick$$module$synpdf, 100), setSpeed$$module$synpdf(0), setPauseState$$module$synpdf(!1)) : (dummyPlayer$$module$synpdf.clearKlok(), setPauseState$$module$synpdf(!0));
    //newPlayerCue needs to subtract offset because time2x uses teTijden time to find deMaten position, not video time
    if (event.data == YT.PlayerState.CUED) {
        msc_wz$$module$synpdf.time2x(newPlayerCue - offset$$module$synpdf);
        setNotationHeight$$module$synpdf();
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
        setNotationHeight$$module$synpdf()
        // below media_height is changed from 30% to 200px
    } else yubchk$$module$synpdf = 1, opt$$module$synpdf.media_height || (opt$$module$synpdf.media_height = "200px"), $("#vid, #aud").css("display", "none"), $("#vidyub").css("display", "inline-block"), yubload$$module$synpdf(function() {
        elmed$$module$synpdf = ybplayer$$module$synpdf;
       /// pbrates$$module$synpdf = elmed$$module$synpdf.getAvailablePlaybackRates();     ///COMMENTING OUT ALLOWS YOUTUBE RATES AT 0.05 SPEED INCREMENT
        setSpeed$$module$synpdf(0);
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

function setSpeed$$module$synpdf(controlFlag) {
        let speedIndex;
    if (controlFlag === 2) {
        let userSpeed = $("#speed").val();
        let speedDifference = userSpeed - opt$$module$synpdf.speed;

        if (Math.abs(speedDifference) >= 0.06) {
            opt$$module$synpdf.speed = userSpeed;
            controlFlag = 0;
        } else {
            controlFlag = speedDifference > 0 ? 1 : -1;
        }
    }

    speedIndex = pbrates$$module$synpdf.map(function(rate, index) {
        console.log(speedIndex);

        return {
            difference: Math.abs(rate - opt$$module$synpdf.speed),
            index: index
        };
    }).sort(function(a, b) {
        return a.difference - b.difference;
    })[0].index;

    if (controlFlag === -1 && speedIndex > 0) {
        opt$$module$synpdf.speed = pbrates$$module$synpdf[speedIndex - 1];
    } else if (controlFlag === 1 && speedIndex < pbrates$$module$synpdf.length - 1) {
        opt$$module$synpdf.speed = pbrates$$module$synpdf[speedIndex + 1];
    } else if (controlFlag === 0) {
        opt$$module$synpdf.speed = pbrates$$module$synpdf[speedIndex];
    }

    $("#speed").val(opt$$module$synpdf.speed.toFixed(2));
    if (elmed$$module$synpdf && !yubchk$$module$synpdf) {
        elmed$$module$synpdf.playbackRate = opt$$module$synpdf.speed;
    } else if (elmed$$module$synpdf && yubchk$$module$synpdf) {
        elmed$$module$synpdf.setPlaybackRate(opt$$module$synpdf.speed);
    }
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
            setSpeed$$module$synpdf(1);
            break;
        case "-":
            setSpeed$$module$synpdf(-1);
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


function msc_preload$$module$synpdf(a) {
    initPreload$$module$synpdf();
    var b = a || window.location.href.split("?")[1];
    if (b === "#") {
        return;
    }
    if (b) {
        $("#wait").html("Loading ...");
        $("#wait").toggle(true);
        get_file$$module$synpdf(b, function(a) {
            msc_check_preload$$module$synpdf();
        });
    }
    
    return b;
}
function msc_check_preload$$module$synpdf() {
    // fills out opt with defaults in needed
    for (var b in opt_default$$module$synpdf) opt$$module$synpdf[b] = b in opt$$module$synpdf ? opt$$module$synpdf[b] : opt_default$$module$synpdf[b];
    metric_arr$$module$synpdf && (deMetriek$$module$synpdf = metric_arr$$module$synpdf, schaalMetriek$$module$synpdf());
    media_dir$$module$synpdf && pdf_file$$module$synpdf && (pdf_file$$module$synpdf = media_dir$$module$synpdf + pdf_file$$module$synpdf);
    pdfFnm$$module$synpdf = pdf_file$$module$synpdf;
    pdf_data$$module$synpdf ? (
        a = txt2pdf$$module$synpdf(pdf_data$$module$synpdf),
        readPdf$$module$synpdf(a, "pdfbin")
      ) : jpg_data$$module$synpdf ? (
        a = txt2pdf$$module$synpdf(jpg_data$$module$synpdf),
        readPdf$$module$synpdf(a, "jpgbin")
      ) : pdf_file$$module$synpdf && readPdf$$module$synpdf(pdf_file$$module$synpdf, "url");
          offset_js$$module$synpdf && (offset$$module$synpdf = offset_js$$module$synpdf);
    media_file$$module$synpdf && !opt$$module$synpdf.nomed && (media_dir$$module$synpdf && (media_file$$module$synpdf = media_dir$$module$synpdf + media_file$$module$synpdf), setPlayer$$module$synpdf(media_file$$module$synpdf, media_file$$module$synpdf));
    lpRec$$module$synpdf.atag && (lpRec$$module$synpdf.atag.y -= 500, lpRec$$module$synpdf.btag.y -= 500), annots$$module$synpdf && annots$$module$synpdf.forEach(function(a) {
        return a.y -= 500
    });
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
    for (var b in opt_url$$module$synpdf) opt$$module$synpdf[b] = opt_url$$module$synpdf[b];
    opt$$module$synpdf.ipadr && webSokOpen$$module$synpdf(opt$$module$synpdf.ipadr);
    opt$$module$synpdf.media_height && $("#buttons").css("left" == opt$$module$synpdf.hrz ? "width" : "height", opt$$module$synpdf.media_height);
    opt$$module$synpdf.mmin && !fullmenu$$module$synpdf && opt$$module$synpdf.mmin.split(",").forEach(function(a) {
        return $("#" + a).toggle(0)
    });
    for (b in opt$$module$synpdf) {
        a = $("#" + b);
        var c = a.attr("type");
        "checkbox" == c && a.prop("checked", opt$$module$synpdf[b]);
        "number" == c && a.val(opt$$module$synpdf[b])
    }
    $("#sync, #medbts, #err").css("visibility", "visible");
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
    $("#yubid").keydown(function(a) {
        a.stopPropagation()
    });
    $("input[type=number]").keydown(function(a) {
        a.stopPropagation()
    });
    $("#speed").change(function() {
        setSpeed$$module$synpdf(2)
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
//BEGIN EXTRA DOCUMENT.READY STUFF
       
});
var module$synpdf = {
    get media_file() {
        return media_file$$module$synpdf
    }
};

module$synpdf.keyDown = keyDown$$module$synpdf;
module$synpdf.tick = tick$$module$synpdf;

