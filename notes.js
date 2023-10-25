// RESIZE ALL CANVASES USING CSS
    function resizeDematenAndCanvas(scaleAmount) {
        deMaten$$module$synpdf = scaleNestedArray(deMaten$$module$synpdf, scaleAmount);
        scaleCanvasElements(scaleAmount);
        msc_wz$$module$synpdf.time2x(elmed$$module$synpdf.getCurrentTime() - offset$$module$synpdf);        }
  
// RECALCULATE KNIP VALUES
    // DO THIS BY JUST SCALING ALL VALUES IN DEMATEN.
    // KNIP JUST NEEDS TO RUN THE FIRST TIME TO GET THE RELATIVE HEIGHT AND THEN SHOULD BE SCALABLE....
    
    // THIS WILL SCALE THE DEMATEN ARRAY - scaleAmount NEEDS TO BE PERCENT SO 100, 125, 150
    function scaleNestedArray(arr, scaleAmount) {
        return arr.map(function(item) {
          if (Array.isArray(item)) {
            return scaleNestedArray(item, scaleAmount);
          } else if (typeof item === 'object' && item !== null && ('x' in item || 'y' in item || 'w' in item || 'h' in item)) {
            return {
              x: (item.x * (scaleAmount / 100)),
              y: (item.y * (scaleAmount / 100)),
              w: (item.w * (scaleAmount / 100)),
              h: (item.h * (scaleAmount / 100))
            };
          } else {
            return item;
          }
        }); 
      }

    // THEN CALL scaleNestedArray(deMaten$$module$synpdf, CALCULATE CHANGE BETWEEN NEW WIDTH AND OLD)

        // THIS SCALES THE CANVAS
        function scaleCanvasElements(scaleAmount) {
            var canvases = document.getElementsByTagName('canvas');
            for (var i = 0; i < canvases.length; i++) {
            var canvas = canvases[i];
            var currentWidth = canvas.style.width;
            var currentHeight = canvas.style.height;
            canvas.style.width = (parseFloat(currentWidth) * scaleAmount / 100) + 'px';
            canvas.style.height = (parseFloat(currentHeight) * scaleAmount / 100) + 'px';
            }
      }
      
    // STILL NEED TO CALC CHANGE BETWEEN NEW AND OLD WIDTH


    // NEED TO REDRAW VISIBLE DEMATEN