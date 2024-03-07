const fs = require('fs').promises;
const path = require('path');

async function processAndWriteToFile() {
  try {
    const inputFilePath = path.join(__dirname, 'strip-cs-file');
    const outputFilePath = path.join(__dirname, 'cs-stripped-output.txt');
    
    const fileContent = await fs.readFile(inputFilePath, 'utf8');
    let data = JSON.parse(fileContent);

    // Ensure the first entry is a number for scaling, if not, parse it
    const originalFirstEntryValue = parseFloat(data[0]);
    if (isNaN(originalFirstEntryValue)) {
      throw new Error("First entry is not a valid number.");
    }

    // Calculate scale factor to make the first entry become 1000
    const scaleFactor = 1000 / originalFirstEntryValue;

    // Explicitly set the first entry to 1000
    data[0] = 1000;

    // Apply scaling to the rest of the data
    // Start loop from 1 since the first entry is already set to 1000
    for (let i = 1; i < data.length; i++) {
      data[i] = scaleValues(data[i], scaleFactor);
    }

    let jsonData = JSON.stringify(data);
    jsonData = jsonData.replace(/({"cxs":)/g, '\n$1');

    await fs.writeFile(outputFilePath, jsonData, 'utf8');
    console.log('The processed data has been saved to cs-stripped-output.txt');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Adjusted scaleValues function to handle the rest of the data
function scaleValues(obj, scaleFactor) {
    if (Array.isArray(obj)) {
        return obj.map(item => scaleValues(item, scaleFactor));
    } else if (typeof obj === 'object' && obj !== null) {
        // Special handling for 'cs' array
        if (obj.hasOwnProperty('cs') && Array.isArray(obj.cs)) {
            if (obj.cs.length > 1) {
                const first = parseFloat((obj.cs[0] * scaleFactor).toFixed(1));
                const last = parseFloat((obj.cs[obj.cs.length - 1] * scaleFactor).toFixed(1));
                obj.cs = [first, last];
            } else {
                obj.cs = [parseFloat((obj.cs[0] * scaleFactor).toFixed(1))];
            }
        } else {
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    obj[key] = scaleValues(obj[key], scaleFactor);
                }
            }
        }

        // Round x1 and x2 in 'xs' objects if they exist
        if (obj.hasOwnProperty('xs')) {
            if (typeof obj.xs.x1 === 'number') {
                obj.xs.x1 = parseFloat((obj.xs.x1 * scaleFactor).toFixed(1));
            }
            if (typeof obj.xs.x2 === 'number') {
                obj.xs.x2 = parseFloat((obj.xs.x2 * scaleFactor).toFixed(1));
            }
        }
    } else if (typeof obj === 'number') {
        return parseFloat((obj * scaleFactor).toFixed(1));
    }
    return obj;
}

// Call the function to process the data and write to a file
processAndWriteToFile();
