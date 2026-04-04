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
        var height = Math.floor(pixelData.length / stride);
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

        for (var py = 0; py < scaledH; py++) {
            var srcY = y0 + Math.min(srcH - 1, Math.floor(py / scale));
            for (var px = 0; px < scaledW; px++) {
                var srcX = x0 + Math.min(srcW - 1, Math.floor(px / scale));
                var val = grayToBinary(pixelData, stride, width, srcX, srcY);
                patch[(py + yOff) * patchWidth + (px + xOff)] = val;
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
            failed: false,
            threadFallbackAttempted: false
        };

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
            if (onnxState.session) return onnxState.session;
            if (onnxState.failed) return null;
            var config = getRuntimeConfig();
            if (!config || !config.enabled || !config.modelUrl || !global.ort || !global.ort.InferenceSession) {
                return null;
            }
            if (!onnxState.sessionPromise) {
                onnxState.sessionPromise = (async function () {
                    var threadCounts = [];
                    var requestedThreads = config.wasmThreads || 4;
                    threadCounts.push(requestedThreads);
                    if (requestedThreads !== 1) {
                        threadCounts.push(1);
                    }

                    for (var i = 0; i < threadCounts.length; i++) {
                        var threadCount = threadCounts[i];
                        try {
                            if (global.ort.env && global.ort.env.wasm) {
                                if (config.wasmRoot) {
                                    global.ort.env.wasm.wasmPaths = config.wasmRoot;
                                }
                                global.ort.env.wasm.numThreads = threadCount;
                            }
                            var session = await global.ort.InferenceSession.create(config.modelUrl, {
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
                session: results[1]
            };
        }

        async function inferPatchesOnnxAsync(patches, metadata) {
            var resources = await getOnnxResources();
            if (!resources) return null;

            var session = resources.session;
            var inputShape = metadata.input_shape || [64, 32, 1];
            var patchHeight = inputShape[0];
            var patchWidth = inputShape[1];
            var batchSize = patches.length;
            var inputData = new Float32Array(batchSize * patchHeight * patchWidth);

            for (var i = 0; i < batchSize; i++) {
                inputData.set(patches[i], i * patchHeight * patchWidth);
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
