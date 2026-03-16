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

    function inferFromPatch(patch) {
        var modelData = global.BarlinePatchCnnModelData;
        if (!modelData) {
            throw new Error("BarlinePatchCnnModelData is not loaded.");
        }
        var layers = modelData.layers;
        var x = patch;

        x = reluInPlace(convSame(x, 64, 32, 1, layers.conv2d));
        x = reluInPlace(convSame(x, 64, 32, 16, layers.conv2d_1));
        var pooled1 = maxPool2x2(x, 64, 32, 16);

        x = reluInPlace(convSame(pooled1.data, pooled1.height, pooled1.width, pooled1.channels, layers.conv2d_2));
        x = reluInPlace(convSame(x, pooled1.height, pooled1.width, 32, layers.conv2d_3));
        var pooled2 = maxPool2x2(x, pooled1.height, pooled1.width, 32);

        x = reluInPlace(convSame(pooled2.data, pooled2.height, pooled2.width, pooled2.channels, layers.conv2d_4));
        var gap = globalAveragePool(x, pooled2.height, pooled2.width, 64);
        var dense1 = dense(gap, layers.dense, true);
        var dense2 = dense(dense1, layers.dense_1, false);
        return sigmoid(dense2[0]);
    }

    var api = {
        cropCandidatePatch: cropCandidatePatch,
        predictFromPatch: inferFromPatch,
        predictCandidate: function (pixelData, stride, width, xCol, staffTop, staffBot, spatium) {
            var patch = cropCandidatePatch(pixelData, stride, width, xCol, staffTop, staffBot, spatium, 1.5, 1.0, 32, 64);
            if (!patch) return null;
            return inferFromPatch(patch);
        }
    };

    global.BarlinePatchCNN = api;
})(window);
