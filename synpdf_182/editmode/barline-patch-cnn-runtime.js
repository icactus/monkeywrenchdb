(function (global) {
    'use strict';

    function clamp(value, minValue, maxValue) {
        return Math.max(minValue, Math.min(maxValue, value));
    }

    function reluInPlace(arr) {
        for (var i = 0; i < arr.length; i++) {
            if (arr[i] < 0) arr[i] = 0;
        }
        return arr;
    }

    function sigmoid(x) {
        return 1 / (1 + Math.exp(-x));
    }

    function convSame(input, inH, inW, inC, layerData) {
        var kernelShape = layerData.kernel_shape;
        var outC = kernelShape[3];
        var kernel = layerData.kernel;
        var bias = layerData.bias;
        var output = new Float32Array(inH * inW * outC);
        var kH = kernelShape[0];
        var kW = kernelShape[1];
        var padY = Math.floor(kH / 2);
        var padX = Math.floor(kW / 2);

        for (var y = 0; y < inH; y++) {
            for (var x = 0; x < inW; x++) {
                for (var oc = 0; oc < outC; oc++) {
                    var sum = bias[oc];
                    for (var ky = 0; ky < kH; ky++) {
                        var iy = y + ky - padY;
                        if (iy < 0 || iy >= inH) continue;
                        for (var kx = 0; kx < kW; kx++) {
                            var ix = x + kx - padX;
                            if (ix < 0 || ix >= inW) continue;
                            var baseInput = ((iy * inW) + ix) * inC;
                            var baseKernel = (((ky * kW) + kx) * inC) * outC + oc;
                            for (var ic = 0; ic < inC; ic++) {
                                sum += input[baseInput + ic] * kernel[baseKernel + ic * outC];
                            }
                        }
                    }
                    output[((y * inW) + x) * outC + oc] = sum;
                }
            }
        }
        return output;
    }

    function maxPool2x2(input, inH, inW, inC) {
        var outH = Math.floor(inH / 2);
        var outW = Math.floor(inW / 2);
        var output = new Float32Array(outH * outW * inC);
        for (var y = 0; y < outH; y++) {
            for (var x = 0; x < outW; x++) {
                for (var c = 0; c < inC; c++) {
                    var maxVal = -Infinity;
                    for (var dy = 0; dy < 2; dy++) {
                        for (var dx = 0; dx < 2; dx++) {
                            var iy = y * 2 + dy;
                            var ix = x * 2 + dx;
                            var val = input[((iy * inW) + ix) * inC + c];
                            if (val > maxVal) maxVal = val;
                        }
                    }
                    output[((y * outW) + x) * inC + c] = maxVal;
                }
            }
        }
        return { data: output, height: outH, width: outW, channels: inC };
    }

    function globalAveragePool(input, inH, inW, inC) {
        var output = new Float32Array(inC);
        var denom = Math.max(1, inH * inW);
        for (var y = 0; y < inH; y++) {
            for (var x = 0; x < inW; x++) {
                var base = ((y * inW) + x) * inC;
                for (var c = 0; c < inC; c++) {
                    output[c] += input[base + c];
                }
            }
        }
        for (var i = 0; i < inC; i++) output[i] /= denom;
        return output;
    }

    function dense(input, layerData, applyRelu) {
        var kernelShape = layerData.kernel_shape;
        var outUnits = kernelShape[1];
        var kernel = layerData.kernel;
        var bias = layerData.bias;
        var output = new Float32Array(outUnits);
        for (var o = 0; o < outUnits; o++) {
            var sum = bias[o];
            for (var i = 0; i < input.length; i++) {
                sum += input[i] * kernel[i * outUnits + o];
            }
            output[o] = applyRelu ? Math.max(0, sum) : sum;
        }
        return output;
    }

    function grayToBinary(pixelData, stride, width, x, y) {
        if (x < 0 || x >= width) return 0;
        var height = Math.floor(pixelData.length / stride);
        if (y < 0 || y >= height) return 0;
        var idx = y * stride + x * 4;
        if (idx < 0 || idx + 2 >= pixelData.length) return 0;
        var avg = (pixelData[idx] + pixelData[idx + 1] + pixelData[idx + 2]) / 3;
        return avg < 128 ? 1 : 0;
    }

    function cropCandidatePatch(pixelData, stride, width, xCol, staffTop, staffBot, spatium, xSpatiums, ySpatiums, patchWidth, patchHeight) {
        var pixelLen = pixelData.length;
        var height = Math.floor(pixelLen / stride);
        var xMargin = Math.max(1, Math.round(xSpatiums * spatium));
        var yMargin = Math.max(1, Math.round(ySpatiums * spatium));
        var x0 = clamp(Math.round(xCol - xMargin), 0, width - 1);
        var x1 = clamp(Math.round(xCol + xMargin), 0, width - 1);
        var y0 = clamp(Math.round(staffTop - yMargin), 0, height - 1);
        var y1 = clamp(Math.round(staffBot + yMargin), 0, height - 1);
        if (x1 <= x0 || y1 <= y0) return null;

        var srcW = x1 - x0 + 1;
        var srcH = y1 - y0 + 1;
        var scale = Math.min(patchWidth / srcW, patchHeight / srcH);
        var scaledW = Math.max(1, Math.round(srcW * scale));
        var scaledH = Math.max(1, Math.round(srcH * scale));
        var patch = new Float32Array(patchWidth * patchHeight);
        var xOff = Math.floor((patchWidth - scaledW) / 2);
        var yOff = Math.floor((patchHeight - scaledH) / 2);
        var srcXs = new Int32Array(scaledW);
        for (var pxInit = 0; pxInit < scaledW; pxInit++) {
            var sx = x0 + Math.min(srcW - 1, Math.floor(pxInit / scale));
            srcXs[pxInit] = (sx >= 0 && sx < width) ? sx * 4 : -1;
        }

        for (var py = 0; py < scaledH; py++) {
            var srcY = y0 + Math.min(srcH - 1, Math.floor(py / scale));
            if (srcY < 0 || srcY >= height) continue;
            var rowOffset = srcY * stride;
            var dstRow = (py + yOff) * patchWidth + xOff;
            for (var px = 0; px < scaledW; px++) {
                var colByte = srcXs[px];
                if (colByte < 0) continue;
                var idx = rowOffset + colByte;
                if (idx >= 0 && idx + 2 < pixelLen && (pixelData[idx] + pixelData[idx + 1] + pixelData[idx + 2] < 384)) {
                    patch[dstRow + px] = 1;
                }
            }
        }
        return patch;
    }

    function flattenOutputScores(outputTensor) {
        if (!outputTensor || !outputTensor.data) return null;
        var dims = outputTensor.dims || [];
        var data = outputTensor.data;
        if (dims.length === 1) {
            return Array.prototype.slice.call(data);
        }
        if (dims.length === 2 && dims[1] === 1) {
            var values = new Array(dims[0]);
            for (var i = 0; i < dims[0]; i++) values[i] = data[i];
            return values;
        }
        return Array.prototype.slice.call(data);
    }

    function createPatchCnnRuntime(options) {
        options = options || {};

        var modelDataName = options.modelDataName || 'BarlinePatchCnnModelData';
        var configName = options.configName || 'BarlinePatchCnnOnnxConfig';
        var logPrefix = options.logPrefix || 'BarlinePatchCNN';
        var onnxState = {
            metadata: null,
            metadataPromise: null,
            session: null,
            sessionPromise: null,
            workerPool: null,
            backend: null,
            failed: false,
            threadFallbackAttempted: false
        };

        var webGpuScriptLoadPromise = null;

        function resolveAbsoluteUrl(url) {
            if (!url) return url;
            try {
                if (global.location && global.location.href) {
                    return new URL(url, global.location.href).href;
                }
            } catch (_err) { /* Keep raw URL if URL resolution is unavailable. */ }
            return url;
        }

        function loadScriptOnce(url) {
            if (webGpuScriptLoadPromise) return webGpuScriptLoadPromise;
            if (typeof document === 'undefined' || !document.createElement) {
                return Promise.reject(new Error('DOM script loader unavailable'));
            }
            webGpuScriptLoadPromise = new Promise(function (resolve, reject) {
                var script = document.createElement('script');
                script.src = url;
                script.async = true;
                script.onload = function () { resolve(); };
                script.onerror = function () {
                    webGpuScriptLoadPromise = null;
                    reject(new Error('Failed to load script: ' + url));
                };
                (document.head || document.documentElement).appendChild(script);
            });
            return webGpuScriptLoadPromise;
        }

        function createWasmWorkerPool(config, modelBytes) {
            if (typeof Worker !== 'function' || typeof Blob !== 'function' || typeof URL !== 'function' || typeof URL.createObjectURL !== 'function') {
                return Promise.resolve(null);
            }
            if (config.useWorkerPool === false) return Promise.resolve(null);

            var hc = (global.navigator && Number(global.navigator.hardwareConcurrency)) || 4;
            var requestedWorkers = Number(config.wasmWorkers);
            var workerCount = (isFinite(requestedWorkers) && requestedWorkers > 0)
                ? Math.floor(requestedWorkers)
                : Math.max(1, Math.min(Math.ceil(hc / 2), 8));
            if (workerCount <= 1 && global.crossOriginIsolated === true && (!isFinite(requestedWorkers) || requestedWorkers <= 0)) {
                workerCount = Math.max(1, Math.min(hc, 4));
            }
            var threadsPerWorker = workerCount > 1
                ? 1
                : (global.crossOriginIsolated === true ? Math.max(1, Math.min(hc, 4)) : 1);

            var ortUrl = resolveAbsoluteUrl(config.ortWasmScriptUrl || (config.wasmRoot ? config.wasmRoot + 'ort.wasm.min.js' : null));
            var wasmRootUrl = resolveAbsoluteUrl(config.wasmRoot || '');
            if (!ortUrl || !wasmRootUrl) return Promise.resolve(null);

            var workerSource = [
                'self.onmessage = async function (event) {',
                '  var msg = event.data;',
                '  try {',
                '    if (msg.type === "init") {',
                '      importScripts(msg.ortUrl);',
                '      if (self.ort && self.ort.env && self.ort.env.wasm) {',
                '        self.ort.env.wasm.wasmPaths = msg.wasmRoot;',
                '        self.ort.env.wasm.numThreads = msg.threads;',
                '      }',
                '      self._session = await self.ort.InferenceSession.create(new Uint8Array(msg.modelBuffer), {',
                '        executionProviders: ["wasm"],',
                '        graphOptimizationLevel: "all"',
                '      });',
                '      self._inputName = self._session.inputNames[0];',
                '      self._outputName = self._session.outputNames[0];',
                '      self.postMessage({ type: "ready" });',
                '      return;',
                '    }',
                '    if (msg.type === "run") {',
                '      var data = new Float32Array(msg.buffer);',
                '      var tensor = new self.ort.Tensor("float32", data, [msg.batchSize, msg.patchHeight, msg.patchWidth, 1]);',
                '      var feeds = {};',
                '      feeds[self._inputName] = tensor;',
                '      var outputs = await self._session.run(feeds, [self._outputName]);',
                '      var outData = outputs[self._outputName].data;',
                '      var result = new Float32Array(outData.length);',
                '      result.set(outData);',
                '      self.postMessage({ type: "result", id: msg.id, buffer: result.buffer }, [result.buffer]);',
                '    }',
                '  } catch (err) {',
                '    self.postMessage({ type: "error", id: msg && msg.id, message: err && err.message ? err.message : String(err) });',
                '  }',
                '};'
            ].join('\n');

            var blobUrl = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
            var workers = [];
            var idleWorkers = [];
            var queue = [];
            var nextJobId = 1;
            var destroyed = false;

            function destroyAll() {
                destroyed = true;
                for (var i = 0; i < workers.length; i++) {
                    try { workers[i].worker.terminate(); } catch (_err) { /* ignore */ }
                }
                workers = [];
                idleWorkers = [];
                try { URL.revokeObjectURL(blobUrl); } catch (_err) { /* ignore */ }
            }

            function pump() {
                while (!destroyed && idleWorkers.length > 0 && queue.length > 0) {
                    var slot = idleWorkers.shift();
                    var job = queue.shift();
                    slot.currentJob = job;
                    slot.worker.postMessage({
                        type: 'run',
                        id: job.id,
                        batchSize: job.batchSize,
                        patchHeight: job.patchHeight,
                        patchWidth: job.patchWidth,
                        buffer: job.buffer
                    }, [job.buffer]);
                }
            }

            var initPromises = [];
            for (var w = 0; w < workerCount; w++) {
                initPromises.push(new Promise(function (resolve, reject) {
                    var worker;
                    try {
                        worker = new Worker(blobUrl);
                    } catch (err) {
                        reject(err);
                        return;
                    }
                    var slot = { worker: worker, currentJob: null };
                    var initialized = false;
                    workers.push(slot);

                    worker.onerror = function (errEvent) {
                        var err = new Error(errEvent && errEvent.message ? errEvent.message : 'Worker error');
                        if (!initialized) {
                            reject(err);
                        } else if (slot.currentJob) {
                            var failedJob = slot.currentJob;
                            slot.currentJob = null;
                            failedJob.reject(err);
                        }
                    };
                    worker.onmessage = function (event) {
                        var msg = event.data;
                        if (!initialized) {
                            if (msg && msg.type === 'ready') {
                                initialized = true;
                                idleWorkers.push(slot);
                                resolve(slot);
                            } else {
                                reject(new Error(msg && msg.message ? msg.message : 'Worker init failed'));
                            }
                            return;
                        }
                        var job = slot.currentJob;
                        slot.currentJob = null;
                        if (!destroyed) idleWorkers.push(slot);
                        if (job) {
                            if (msg && msg.type === 'result') {
                                job.resolve(new Float32Array(msg.buffer));
                            } else {
                                job.reject(new Error(msg && msg.message ? msg.message : 'Worker inference failed'));
                            }
                        }
                        pump();
                    };

                    var bytesCopy = modelBytes.slice(0);
                    worker.postMessage({
                        type: 'init',
                        ortUrl: ortUrl,
                        wasmRoot: wasmRootUrl,
                        threads: threadsPerWorker,
                        modelBuffer: bytesCopy
                    }, [bytesCopy]);
                }));
            }

            return Promise.all(initPromises).then(function () {
                return {
                    workerCount: workerCount,
                    threadsPerWorker: threadsPerWorker,
                    runChunk: function (inputData, batchSize, patchHeight, patchWidth) {
                        return new Promise(function (resolve, reject) {
                            if (destroyed) {
                                reject(new Error('Worker pool destroyed'));
                                return;
                            }
                            queue.push({
                                id: nextJobId++,
                                batchSize: batchSize,
                                patchHeight: patchHeight,
                                patchWidth: patchWidth,
                                buffer: inputData.buffer,
                                resolve: resolve,
                                reject: reject
                            });
                            pump();
                        });
                    },
                    destroy: destroyAll
                };
            }).catch(function (err) {
                destroyAll();
                console.warn(logPrefix + ' WASM worker pool unavailable, falling back to single session:', err && err.message ? err.message : err);
                return null;
            });
        }

        async function tryCreateWebGpuSession(config, modelBytes, metadata) {
            if (config.webGpuEnabled === false || !config.ortWebGpuScriptUrl) return null;
            if (!global.navigator || !global.navigator.gpu || typeof global.navigator.gpu.requestAdapter !== 'function') {
                return null;
            }
            try {
                var adapter = await global.navigator.gpu.requestAdapter();
                if (!adapter) return null;
                await loadScriptOnce(resolveAbsoluteUrl(config.ortWebGpuScriptUrl));
                if (!global.ort || !global.ort.InferenceSession) return null;
                if (global.ort.env && global.ort.env.wasm && config.wasmRoot) {
                    global.ort.env.wasm.wasmPaths = resolveAbsoluteUrl(config.wasmRoot);
                }
                var session = await global.ort.InferenceSession.create(new Uint8Array(modelBytes), {
                    executionProviders: ['webgpu'],
                    graphOptimizationLevel: 'all'
                });
                // Verify finite output on a tiny 1-patch warmup before committing to WebGPU.
                var inputShape = (metadata && metadata.input_shape) || [64, 32, 1];
                var h = inputShape[0];
                var w = inputShape[1];
                var dummy = new global.ort.Tensor('float32', new Float32Array(h * w), [1, h, w, 1]);
                var feeds = {};
                feeds[session.inputNames[0]] = dummy;
                var out = await session.run(feeds, [session.outputNames[0]]);
                var scores = flattenOutputScores(out[session.outputNames[0]]);
                if (!scores || scores.length !== 1 || !isFinite(scores[0])) {
                    if (typeof session.release === 'function') await session.release();
                    return null;
                }
                return session;
            } catch (err) {
                console.warn(logPrefix + ' WebGPU init failed, using WASM workers:', err && err.message ? err.message : err);
                return null;
            }
        }

        function getModelData() {
            return global[modelDataName] || null;
        }

        function getFallbackMetadata() {
            var modelData = getModelData() || {};
            return {
                input_shape: modelData.input_shape || [64, 32, 1],
                crop_config: modelData.crop_config || { x_spatiums: 1.5, y_spatiums: 1.0 }
            };
        }

        function getRuntimeConfig() {
            return global[configName] || null;
        }

        function getCurrentMetadataSync() {
            return onnxState.metadata || getFallbackMetadata();
        }

        function inferFromPatchFallback(patch, metadata) {
            var modelData = getModelData();
            if (!modelData) {
                throw new Error(modelDataName + " is not loaded.");
            }
            var inputShape = metadata.input_shape || [64, 32, 1];
            var inH = inputShape[0];
            var inW = inputShape[1];
            var layers = modelData.layers;
            var x = patch;

            x = reluInPlace(convSame(x, inH, inW, 1, layers.conv2d));
            x = reluInPlace(convSame(x, inH, inW, 32, layers.conv2d_1));
            var pooled1 = maxPool2x2(x, inH, inW, 32);

            x = reluInPlace(convSame(pooled1.data, pooled1.height, pooled1.width, pooled1.channels, layers.conv2d_2));
            x = reluInPlace(convSame(x, pooled1.height, pooled1.width, 64, layers.conv2d_3));
            var pooled2 = maxPool2x2(x, pooled1.height, pooled1.width, 64);

            x = reluInPlace(convSame(pooled2.data, pooled2.height, pooled2.width, pooled2.channels, layers.conv2d_4));
            var gap = globalAveragePool(x, pooled2.height, pooled2.width, 128);
            var dense1 = dense(gap, layers.dense, true);
            var dense2 = dense(dense1, layers.dense_1, false);
            return sigmoid(dense2[0]);
        }

        async function getOnnxMetadata() {
            if (onnxState.metadata) return onnxState.metadata;
            if (onnxState.failed) return null;
            var config = getRuntimeConfig();
            if (!config || !config.enabled || !config.metadataUrl || typeof fetch !== 'function') {
                return null;
            }
            if (!onnxState.metadataPromise) {
                onnxState.metadataPromise = fetch(config.metadataUrl, { cache: 'no-store' })
                    .then(function (response) {
                        if (!response.ok) {
                            throw new Error("Metadata HTTP " + response.status);
                        }
                        return response.json();
                    })
                    .then(function (metadata) {
                        onnxState.metadata = metadata;
                        return metadata;
                    })
                    .catch(function (err) {
                        console.warn(logPrefix + " ONNX metadata load failed:", err);
                        onnxState.failed = true;
                        return null;
                    });
            }
            return onnxState.metadataPromise;
        }

        async function getOnnxSession() {
            if (onnxState.workerPool || onnxState.session) return onnxState.workerPool || onnxState.session;
            if (onnxState.failed) return null;
            var config = getRuntimeConfig();
            if (!config || !config.enabled || !config.modelUrl || !global.ort || !global.ort.InferenceSession) {
                return null;
            }
            if (!onnxState.sessionPromise) {
                onnxState.sessionPromise = (async function () {
                    var metadata = await getOnnxMetadata();
                    var modelBytes = null;
                    if (typeof fetch === 'function') {
                        try {
                            var resp = await fetch(config.modelUrl);
                            if (resp.ok) modelBytes = await resp.arrayBuffer();
                        } catch (_err) { /* Fall back to URL loading in ORT. */ }
                    }

                    // 1. Prefer WebGPU when a real GPU adapter and full ORT bundle are available.
                    if (modelBytes) {
                        var gpuSession = await tryCreateWebGpuSession(config, modelBytes, metadata);
                        if (gpuSession) {
                            onnxState.session = gpuSession;
                            onnxState.backend = 'webgpu';
                            console.log(logPrefix + ' initialized backend: webgpu');
                            return gpuSession;
                        }
                    }

                    // 2. Otherwise use a parallel WASM Web Worker pool to utilize all CPU cores
                    // without blocking the main UI thread (works with or without crossOriginIsolated).
                    if (modelBytes) {
                        var pool = await createWasmWorkerPool(config, modelBytes);
                        if (pool) {
                            onnxState.workerPool = pool;
                            onnxState.backend = 'wasm-pool(' + pool.workerCount + 'w x ' + pool.threadsPerWorker + 't)';
                            console.log(logPrefix + ' initialized backend: ' + onnxState.backend);
                            return pool;
                        }
                    }

                    // 3. Fallback: single main-thread ONNX Runtime WASM session.
                    var threadCounts = [];
                    var hc = (global.navigator && Number(global.navigator.hardwareConcurrency)) || 4;
                    var requestedThreads = config.wasmThreads || Math.max(1, Math.min(hc, 8));
                    if (global.crossOriginIsolated === true && requestedThreads > 1) {
                        threadCounts.push(requestedThreads);
                    }
                    threadCounts.push(1);

                    for (var i = 0; i < threadCounts.length; i++) {
                        var threadCount = threadCounts[i];
                        try {
                            if (global.ort.env && global.ort.env.wasm) {
                                if (config.wasmRoot) {
                                    global.ort.env.wasm.wasmPaths = resolveAbsoluteUrl(config.wasmRoot);
                                }
                                global.ort.env.wasm.numThreads = threadCount;
                            }
                            var source = modelBytes ? new Uint8Array(modelBytes) : config.modelUrl;
                            var session = await global.ort.InferenceSession.create(source, {
                                executionProviders: ['wasm'],
                                graphOptimizationLevel: 'all'
                            });
                            if (threadCount !== requestedThreads) {
                                console.warn(logPrefix + " ONNX fell back to single-threaded wasm.", {
                                    requestedThreads: requestedThreads
                                });
                                onnxState.threadFallbackAttempted = true;
                            }
                            onnxState.session = session;
                            onnxState.backend = 'wasm(' + threadCount + 't)';
                            console.log(logPrefix + ' initialized backend: ' + onnxState.backend);
                            return session;
                        } catch (err) {
                            console.warn(logPrefix + " ONNX session init failed:", err && err.message ? err.message : err, {
                                crossOriginIsolated: typeof global.crossOriginIsolated === 'boolean' ? global.crossOriginIsolated : null,
                                wasmThreads: threadCount,
                                wasmRoot: config.wasmRoot,
                                modelUrl: config.modelUrl
                            });
                        }
                    }

                    onnxState.failed = true;
                    return null;
                })();
            }
            return onnxState.sessionPromise;
        }

        async function getOnnxResources() {
            var results = await Promise.all([getOnnxMetadata(), getOnnxSession()]);
            if (!results[0] || !results[1]) return null;
            return {
                metadata: results[0],
                session: onnxState.session,
                workerPool: onnxState.workerPool
            };
        }

        async function inferPatchesOnnxAsync(patches, metadata) {
            var resources = await getOnnxResources();
            if (!resources) return null;

            var inputShape = metadata.input_shape || [64, 32, 1];
            var patchHeight = inputShape[0];
            var patchWidth = inputShape[1];
            var patchArea = patchHeight * patchWidth;
            var batchSize = patches.length;

            if (resources.workerPool) {
                var pool = resources.workerPool;
                var chunkCount = (pool.workerCount > 1 && batchSize >= 64)
                    ? Math.min(pool.workerCount, Math.ceil(batchSize / 48))
                    : 1;
                if (chunkCount === 1) {
                    var singleData = new Float32Array(batchSize * patchArea);
                    for (var s = 0; s < batchSize; s++) {
                        singleData.set(patches[s], s * patchArea);
                    }
                    var singleOut = await pool.runChunk(singleData, batchSize, patchHeight, patchWidth);
                    return Array.prototype.slice.call(singleOut);
                }
                var chunkPromises = [];
                var baseSize = Math.floor(batchSize / chunkCount);
                var remainder = batchSize % chunkCount;
                var offset = 0;
                for (var c = 0; c < chunkCount; c++) {
                    var len = baseSize + (c < remainder ? 1 : 0);
                    var chunkData = new Float32Array(len * patchArea);
                    for (var p = 0; p < len; p++) {
                        chunkData.set(patches[offset + p], p * patchArea);
                    }
                    offset += len;
                    chunkPromises.push(pool.runChunk(chunkData, len, patchHeight, patchWidth));
                }
                var chunkOutputs = await Promise.all(chunkPromises);
                var merged = new Array(batchSize);
                var writeIdx = 0;
                for (var co = 0; co < chunkOutputs.length; co++) {
                    var arr = chunkOutputs[co];
                    for (var k = 0; k < arr.length; k++) {
                        merged[writeIdx++] = arr[k];
                    }
                }
                return merged;
            }

            var session = resources.session;
            var inputData = new Float32Array(batchSize * patchArea);

            for (var i = 0; i < batchSize; i++) {
                inputData.set(patches[i], i * patchArea);
            }

            var inputName = session.inputNames[0];
            var outputName = session.outputNames[0];
            var tensor = new global.ort.Tensor('float32', inputData, [batchSize, patchHeight, patchWidth, 1]);
            var outputs = await session.run((function () {
                var feeds = {};
                feeds[inputName] = tensor;
                return feeds;
            })(), [outputName]);
            return flattenOutputScores(outputs[outputName]);
        }

        async function predictBatchCandidatesAsync(pixelData, stride, width, candidates) {
            var metadata = (await getOnnxMetadata()) || getFallbackMetadata();
            var inputShape = metadata.input_shape || [64, 32, 1];
            var patchHeight = inputShape[0];
            var patchWidth = inputShape[1];
            var cropConfig = metadata.crop_config || {};
            var xSpatiums = cropConfig.x_spatiums != null ? cropConfig.x_spatiums : 1.5;
            var ySpatiums = cropConfig.y_spatiums != null ? cropConfig.y_spatiums : 1.0;
            var scores = new Array(candidates.length).fill(null);
            var patches = [];
            var patchIndices = [];

            for (var i = 0; i < candidates.length; i++) {
                var candidate = candidates[i];
                var patch = cropCandidatePatch(
                    pixelData,
                    stride,
                    width,
                    candidate.xCol,
                    candidate.staffTop,
                    candidate.staffBot,
                    candidate.spatium,
                    xSpatiums,
                    ySpatiums,
                    patchWidth,
                    patchHeight
                );
                if (!patch) continue;
                patches.push(patch);
                patchIndices.push(i);
            }

            if (!patches.length) return scores;

            try {
                var onnxScores = await inferPatchesOnnxAsync(patches, metadata);
                if (onnxScores) {
                    for (var ps = 0; ps < patchIndices.length; ps++) {
                        scores[patchIndices[ps]] = onnxScores[ps];
                    }
                    return scores;
                }
            } catch (err) {
                console.warn(logPrefix + " ONNX inference failed, falling back to JS runtime:", err);
                onnxState.failed = true;
            }

            for (var fp = 0; fp < patchIndices.length; fp++) {
                scores[patchIndices[fp]] = inferFromPatchFallback(patches[fp], metadata);
            }
            return scores;
        }

        async function predictCandidateAsync(pixelData, stride, width, xCol, staffTop, staffBot, spatium) {
            var scores = await predictBatchCandidatesAsync(pixelData, stride, width, [{
                xCol: xCol,
                staffTop: staffTop,
                staffBot: staffBot,
                spatium: spatium
            }]);
            return scores[0];
        }

        function predictCandidateSync(pixelData, stride, width, xCol, staffTop, staffBot, spatium) {
            var metadata = getCurrentMetadataSync();
            var inputShape = metadata.input_shape || [64, 32, 1];
            var cropConfig = metadata.crop_config || {};
            var patchHeight = inputShape[0];
            var patchWidth = inputShape[1];
            var xSpatiums = cropConfig.x_spatiums != null ? cropConfig.x_spatiums : 1.5;
            var ySpatiums = cropConfig.y_spatiums != null ? cropConfig.y_spatiums : 1.0;
            var patch = cropCandidatePatch(
                pixelData, stride, width, xCol, staffTop, staffBot, spatium,
                xSpatiums, ySpatiums, patchWidth, patchHeight
            );
            if (!patch) return null;
            return inferFromPatchFallback(patch, metadata);
        }

        return {
            cropCandidatePatch: cropCandidatePatch,
            predictFromPatch: function (patch) {
                return inferFromPatchFallback(patch, getCurrentMetadataSync());
            },
            predictCandidate: predictCandidateSync,
            predictCandidateAsync: predictCandidateAsync,
            predictBatchCandidatesAsync: predictBatchCandidatesAsync,
            loadAsync: async function () {
                return getOnnxResources();
            },
            isOnnxConfigured: function () {
                var config = getRuntimeConfig();
                return !!(config && config.enabled);
            },
            hasModelData: function () {
                return !!getModelData();
            },
            getBackendInfo: function () {
                return onnxState.backend || (onnxState.failed ? 'js-fallback' : 'uninitialized');
            }
        };
    }

    global.createPatchCnnRuntime = createPatchCnnRuntime;
    global.BarlinePatchCNN = createPatchCnnRuntime({
        modelDataName: 'BarlinePatchCnnModelData',
        configName: 'BarlinePatchCnnOnnxConfig',
        logPrefix: 'BarlinePatchCNN'
    });
    global.PianoBarlinePatchCNN = createPatchCnnRuntime({
        modelDataName: 'PianoBarlinePatchCnnModelData',
        configName: 'PianoBarlinePatchCnnOnnxConfig',
        logPrefix: 'PianoBarlinePatchCNN'
    });
})(window);
