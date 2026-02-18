#!/usr/bin/env python3
"""
Web Interface for DTW Audio Sync Pipeline

Run with: python3 scripts/web_interface.py
Then open http://localhost:5000 in your browser.
"""

import json
import sys
import os

# Add scripts directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, render_template_string, request, jsonify
from run_full_pipeline_web import run_pipeline_custom

app = Flask(__name__)

HTML_TEMPLATE = '''
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DTW Audio Sync Pipeline</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-primary: #0f0f23;
            --bg-secondary: #1a1a2e;
            --bg-tertiary: #252542;
            --accent-primary: #6c63ff;
            --accent-secondary: #4ecdc4;
            --accent-warning: #ff6b6b;
            --accent-success: #2ecc71;
            --text-primary: #ffffff;
            --text-secondary: #a0a0c0;
            --border-color: #3a3a5c;
            --shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Inter', sans-serif;
            background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
            color: var(--text-primary);
            min-height: 100vh;
            padding: 2rem;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        
        header {
            text-align: center;
            margin-bottom: 2rem;
        }
        
        h1 {
            font-size: 2.5rem;
            font-weight: 700;
            background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 0.5rem;
        }
        
        .subtitle {
            color: var(--text-secondary);
            font-size: 1rem;
        }
        
        .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2rem;
        }
        
        @media (max-width: 1024px) {
            .grid {
                grid-template-columns: 1fr;
            }
        }
        
        .card {
            background: var(--bg-secondary);
            border-radius: 16px;
            padding: 1.5rem;
            border: 1px solid var(--border-color);
            box-shadow: var(--shadow);
        }
        
        .card-title {
            font-size: 1.25rem;
            font-weight: 600;
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .card-title::before {
            content: '';
            width: 4px;
            height: 1.25rem;
            background: linear-gradient(180deg, var(--accent-primary), var(--accent-secondary));
            border-radius: 2px;
        }
        
        .form-group {
            margin-bottom: 1rem;
        }
        
        label {
            display: block;
            font-size: 0.875rem;
            font-weight: 500;
            color: var(--text-secondary);
            margin-bottom: 0.5rem;
        }
        
        input, textarea {
            width: 100%;
            padding: 0.75rem 1rem;
            background: var(--bg-tertiary);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            color: var(--text-primary);
            font-family: 'Inter', monospace;
            font-size: 0.875rem;
            transition: border-color 0.2s, box-shadow 0.2s;
        }
        
        input:focus, textarea:focus {
            outline: none;
            border-color: var(--accent-primary);
            box-shadow: 0 0 0 3px rgba(108, 99, 255, 0.2);
        }
        
        textarea {
            resize: vertical;
            min-height: 200px;
            font-family: 'Consolas', 'Monaco', monospace;
        }
        
        .row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
        }
        
        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            padding: 0.875rem 1.5rem;
            font-size: 1rem;
            font-weight: 600;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        
        .btn-primary {
            background: linear-gradient(135deg, var(--accent-primary), #8b5cf6);
            color: white;
            width: 100%;
        }
        
        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(108, 99, 255, 0.4);
        }
        
        .btn-primary:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
        }
        
        .btn-copy {
            background: var(--bg-tertiary);
            color: var(--text-primary);
            border: 1px solid var(--border-color);
            padding: 0.5rem 1rem;
            font-size: 0.75rem;
        }
        
        .btn-copy:hover {
            background: var(--accent-primary);
            border-color: var(--accent-primary);
        }
        
        .results-section {
            margin-top: 2rem;
        }
        
        .offset-display {
            background: linear-gradient(135deg, var(--bg-tertiary), var(--bg-secondary));
            border: 2px solid var(--accent-secondary);
            border-radius: 12px;
            padding: 1.5rem;
            text-align: center;
            margin-bottom: 1rem;
        }
        
        .offset-label {
            font-size: 0.875rem;
            color: var(--text-secondary);
            margin-bottom: 0.5rem;
        }
        
        .offset-value {
            font-size: 2.5rem;
            font-weight: 700;
            color: var(--accent-secondary);
            font-family: 'Consolas', monospace;
        }
        
        .output-box {
            position: relative;
        }
        
        .output-box .btn-copy {
            position: absolute;
            top: 0.5rem;
            right: 0.5rem;
        }
        
        .output-textarea {
            min-height: 300px;
            font-size: 0.75rem;
        }
        
        .logs-textarea {
            min-height: 400px;
            font-size: 0.7rem;
            line-height: 1.4;
            white-space: pre;
            overflow-x: auto;
        }
        
        .status {
            padding: 0.75rem 1rem;
            border-radius: 8px;
            margin-bottom: 1rem;
            display: none;
        }
        
        .status.loading {
            display: block;
            background: rgba(108, 99, 255, 0.2);
            border: 1px solid var(--accent-primary);
            color: var(--accent-primary);
        }
        
        .status.success {
            display: block;
            background: rgba(46, 204, 113, 0.2);
            border: 1px solid var(--accent-success);
            color: var(--accent-success);
        }
        
        .status.error {
            display: block;
            background: rgba(255, 107, 107, 0.2);
            border: 1px solid var(--accent-warning);
            color: var(--accent-warning);
        }
        
        .spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid transparent;
            border-top-color: currentColor;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        .hidden {
            display: none !important;
        }
        
        .warnings-list {
            max-height: 200px;
            overflow-y: auto;
            background: var(--bg-tertiary);
            border-radius: 8px;
            padding: 1rem;
            font-size: 0.75rem;
            font-family: monospace;
        }
        
        .warning-item {
            padding: 0.25rem 0;
            color: var(--accent-warning);
        }
        
        .info-item {
            padding: 0.25rem 0;
            color: var(--text-secondary);
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>🎵 DTW Audio Sync Pipeline</h1>
            <p class="subtitle">Map timestamps between two recordings using Dynamic Time Warping</p>
        </header>
        
        <div class="grid">
            <div class="card">
                <h2 class="card-title">Input Configuration</h2>
                <form id="pipelineForm">
                    <div class="form-group">
                        <label for="url1">Recording 1 URL (YouTube)</label>
                        <input type="text" id="url1" name="url1" placeholder="https://www.youtube.com/watch?v=...">
                    </div>
                    
                    <div class="form-group">
                        <label for="url2">Recording 2 URL (YouTube)</label>
                        <input type="text" id="url2" name="url2" placeholder="https://www.youtube.com/watch?v=...">
                    </div>
                    
                    <div class="row">
                        <div class="form-group">
                            <label for="offset1">Rec 1 Start (seconds)</label>
                            <input type="number" id="offset1" name="offset1" value="0" step="0.01">
                        </div>
                        <div class="form-group">
                            <label for="end1">Rec 1 End (HH:MM:SS or empty)</label>
                            <input type="text" id="end1" name="end1" value="" placeholder="e.g. 25:00 or leave empty">
                        </div>
                    </div>
                    
                    <div class="row">
                        <div class="form-group">
                            <label for="offset2">Rec 2 Start (HH:MM:SS or seconds)</label>
                            <input type="text" id="offset2" name="offset2" value="0" placeholder="0:00 or 0">
                        </div>
                        <div class="form-group">
                            <label for="end2">Rec 2 End (HH:MM:SS or empty)</label>
                            <input type="text" id="end2" name="end2" value="" placeholder="e.g. 16:34 or leave empty">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="timestamps">Rec 1 Timestamps (JSON)</label>
                        <textarea id="timestamps" name="timestamps" placeholder='[{"mix": 0, "t": 0}, {"mix": 1, "t": 2.5}, ...]'></textarea>
                    </div>

                    <div class="form-group">
                        <label for="rec1_timestamps_offset">Rec 1 Timestamps Offset (seconds)</label>
                        <input type="number" id="rec1_timestamps_offset" name="rec1_timestamps_offset" value="0" step="0.01">
                        <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
                            If your timestamps start at t=0 but the audio actually starts later (e.g. t=2s), enter 2 here.
                        </p>
                    </div>

                    <div class="form-group" style="border-top: 1px solid var(--border-color); padding-top: 1rem; margin-top: 1rem;">
                        <label for="timestamps_rec2">Recording 2 Manual Timestamps (Ground Truth - Optional)</label>
                        <p style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                            If provided, the pipeline will compare its output against these values index-by-index.
                        </p>
                        <textarea id="timestamps_rec2" name="timestamps_rec2" placeholder='[{"mix": 0, "t": 0}, {"mix": 1, "t": 4.9}, ...]' style="min-height: 120px;"></textarea>
                    </div>

                    <div class="form-group">
                        <label for="rec2_timestamps_offset">Rec 2 Ground Truth Offset (seconds)</label>
                        <input type="number" id="rec2_timestamps_offset" name="rec2_timestamps_offset" value="0" step="0.01">
                        <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
                            If your ground truth timestamps start at t=0 but the audio actually starts later, enter the offset here.
                        </p>
                    </div>
                    
                    <button type="submit" class="btn btn-primary" id="submitBtn">
                        <span class="btn-text">Run Pipeline</span>
                    </button>
                </form>
            </div>
            
            <div class="card">
                <h2 class="card-title">Results</h2>
                
                <div id="status" class="status"></div>
                
                <div id="resultsSection" class="hidden">
                    <div class="offset-display">
                        <div class="offset-label">Total Offset for Recording 2</div>
                        <div class="offset-value" id="totalOffset">--</div>
                    </div>
                    
                    <div class="form-group output-box">
                        <label>Output Timestamps (Zero-Based)</label>
                        <button type="button" class="btn btn-copy" onclick="copyTimestamps()">📋 Copy</button>
                        <textarea id="outputTimestamps" class="output-textarea" readonly></textarea>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="results-section hidden" id="logsSection">
            <div class="card">
                <h2 class="card-title">Console Output & Warnings</h2>
                <div class="output-box">
                    <button type="button" class="btn btn-copy" onclick="copyLogs()">📋 Copy Logs</button>
                    <textarea id="logsOutput" class="logs-textarea" readonly></textarea>
                </div>
            </div>
            
            <div class="card" style="margin-top: 2rem;">
                 <h2 class="card-title">Preview Visualization</h2>
                 <p class="subtitle" style="margin-bottom: 1rem;">View this synchronization in the main Monkey Wrench interface.</p>
                 
                 <div class="form-group">
                    <label for="previewMetricId">Metric Array ID (Context)</label>
                    <input type="text" id="previewMetricId" placeholder="e.g. 103" value="103">
                    <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
                        Required to load the correct sheet music.
                    </p>
                 </div>

                 <div class="form-group">
                    <label for="previewBaseUrl">Base URL (Local/Prod)</label>
                    <input type="text" id="previewBaseUrl" placeholder="https://monkeywrenchdb.org/" value="http://localhost:8000/">
                    <p style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 0.25rem;">
                        For local testing, start a PHP server in the repo root: <code>php -S localhost:8000</code>
                    </p>
                 </div>
                 
                 <button type="button" class="btn btn-primary" id="previewBtn" onclick="generatePreview()">
                    👁️ Generate Preview Link
                 </button>
                 
                 <div id="previewResult" class="hidden" style="margin-top: 1rem;">
                    <label>Preview URL</label>
                    <div style="display: flex; gap: 0.5rem;">
                        <input type="text" id="previewUrl" readonly>
                        <button class="btn" style="background: var(--bg-tertiary); border: 1px solid var(--border-color);" onclick="copyPreviewUrl()">📋</button>
                        <a id="previewLinkOpen" href="#" target="_blank" class="btn" style="background: var(--accent-success); color: white; text-decoration: none;">Open</a>
                    </div>
                 </div>
            </div>
        </div>
    </div>
    
    <script>
        const form = document.getElementById('pipelineForm');
        const submitBtn = document.getElementById('submitBtn');
        const status = document.getElementById('status');
        const resultsSection = document.getElementById('resultsSection');
        const logsSection = document.getElementById('logsSection');
        
        // Parse time string (HH:MM:SS, MM:SS, M:SS) to seconds
        function parseTimeToSeconds(timeStr) {
            if (!timeStr) return null;
            timeStr = timeStr.trim();
            
            // If it's already a number, return it
            if (!isNaN(parseFloat(timeStr)) && !timeStr.includes(':')) {
                return parseFloat(timeStr);
            }
            
            const parts = timeStr.split(':').map(p => parseFloat(p));
            if (parts.some(isNaN)) return null;
            
            if (parts.length === 3) {
                // HH:MM:SS
                return parts[0] * 3600 + parts[1] * 60 + parts[2];
            } else if (parts.length === 2) {
                // MM:SS or M:SS
                return parts[0] * 60 + parts[1];
            } else if (parts.length === 1) {
                return parts[0];
            }
            return null;
        }
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Get form data
            const url1 = document.getElementById('url1').value;
            const url2 = document.getElementById('url2').value;
            const offset1 = parseFloat(document.getElementById('offset1').value) || 0;
            const end1 = parseTimeToSeconds(document.getElementById('end1').value);
            const offset2 = parseTimeToSeconds(document.getElementById('offset2').value);
            const end2 = parseTimeToSeconds(document.getElementById('end2').value);
            const timestampsRaw = document.getElementById('timestamps').value;
            const rec1TimestampsOffset = parseFloat(document.getElementById('rec1_timestamps_offset').value) || 0;
            const timestampsRec2Raw = document.getElementById('timestamps_rec2').value.trim();
            const rec2TimestampsOffset = parseFloat(document.getElementById('rec2_timestamps_offset').value) || 0;
            
            // Validate time parsing
            if (offset2 === null) {
                showStatus('error', 'Invalid Rec 2 Start Time format. Use HH:MM:SS, MM:SS, or seconds.');
                return;
            }
            // end2 can be empty (use full recording)
            const end2Raw = document.getElementById('end2').value.trim();
            if (end2Raw !== '' && end2 === null) {
                showStatus('error', 'Invalid Rec 2 End Time format. Use HH:MM:SS, MM:SS, or seconds.');
                return;
            }
            
            // end1 can be empty (use full recording)
            const end1Raw = document.getElementById('end1').value.trim();
            if (end1Raw !== '' && end1 === null) {
                showStatus('error', 'Invalid Rec 1 End Time format. Use HH:MM:SS, MM:SS, or seconds.');
                return;
            }
            
            // Parse timestamps
            let timestamps;
            try {
                timestamps = JSON.parse(timestampsRaw);
            } catch (err) {
                showStatus('error', 'Invalid JSON in Rec 1 timestamps field: ' + err.message);
                return;
            }

            // Parse Rec 2 ground truth if provided
            let timestampsRec2 = null;
            if (timestampsRec2Raw) {
                try {
                    timestampsRec2 = JSON.parse(timestampsRec2Raw);
                } catch (err) {
                    showStatus('error', 'Invalid JSON in Rec 2 ground truth field: ' + err.message);
                    return;
                }
            }
            
            // Validate
            if (!url1 || !url2) {
                showStatus('error', 'Please provide both recording URLs');
                return;
            }
            
            if (!timestamps || timestamps.length === 0) {
                showStatus('error', 'Please provide at least one timestamp');
                return;
            }
            
            // Show loading
            submitBtn.disabled = true;
            showStatus('loading', '<span class="spinner"></span> Running pipeline... This may take several minutes.');
            resultsSection.classList.add('hidden');
            logsSection.classList.add('hidden');
            
            try {
                const response = await fetch('/run', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url1, url2, offset1, end1, offset2, end2, 
                        timestamps, rec1_timestamps_offset: rec1TimestampsOffset,
                        timestamps_rec2: timestampsRec2, rec2_timestamps_offset: rec2TimestampsOffset
                    })
                });
                
                const data = await response.json();
                
                if (data.error) {
                    showStatus('error', 'Error: ' + data.error);
                } else {
                    showStatus('success', '✓ Pipeline completed successfully!');
                    
                    // Display results
                    document.getElementById('totalOffset').textContent = data.total_offset_rec2.toFixed(3) + 's';
                    
                    // Format output: only t and mix, in that order
                    const cleanOutput = data.zero_based_results.map(item => ({
                        t: item.t,
                        mix: item.mix
                    }));
                    document.getElementById('outputTimestamps').value = JSON.stringify(cleanOutput, null, 2);
                    document.getElementById('logsOutput').value = data.logs;
                    
                     // Store full results for preview generation
                    window.fullPipelineResults = data.zero_based_results;
                    console.log("[DEBUG] Received results:", data.zero_based_results.length, "items");
                    if (data.zero_based_results.length > 0) {
                        console.log("[DEBUG] Sample item:", data.zero_based_results[0]);
                    }

                    // Generate fix list (low confidence items)
                    window.fullFixList = data.zero_based_results
                        .map((item, index) => ({ ...item, detix: index }))
                        .filter(item => item.confidence && (String(item.confidence).toLowerCase() === 'low' || item.confidence < 0.5));
                    
                    console.log("[DEBUG] Generated Fix List:", window.fullFixList.length, "items");

                    resultsSection.classList.remove('hidden');
                    logsSection.classList.remove('hidden');
                }
            } catch (err) {
                showStatus('error', 'Network error: ' + err.message);
            } finally {
                submitBtn.disabled = false;
            }
        });
        
        function showStatus(type, message) {
            status.className = 'status ' + type;
            status.innerHTML = message;
        }
        
        function copyTimestamps() {
            const textarea = document.getElementById('outputTimestamps');
            textarea.select();
            document.execCommand('copy');
            
            const btn = event.target;
            const originalText = btn.textContent;
            btn.textContent = '✓ Copied!';
            setTimeout(() => btn.textContent = originalText, 2000);
        }
        
        function copyLogs() {
            const textarea = document.getElementById('logsOutput');
            textarea.select();
            document.execCommand('copy');
            
            const btn = event.target;
            const originalText = btn.textContent;
            btn.textContent = '✓ Copied!';
            setTimeout(() => btn.textContent = originalText, 2000);
        }
        
        async function generatePreview() {
            const btn = document.getElementById('previewBtn');
            const metricArrId = document.getElementById('previewMetricId').value;
            const outputTimestampsVal = document.getElementById('outputTimestamps').value;
            
            if (!outputTimestampsVal) {
                alert("No timestamps available to preview. Please run the pipeline first.");
                return;
            }
            
            let timestamps;
            try {
                timestamps = JSON.parse(outputTimestampsVal);
            } catch(e) {
                alert("Error parsing timestamp results");
                return;
            }
            
            // Get original inputs for context
            const totalOffsetTxt = document.getElementById('totalOffset').textContent.replace('s', '');
            const totalOffset = parseFloat(totalOffsetTxt) || 0;
            const url2 = document.getElementById('url2').value;
            
            // Extract video ID from URL2
            let videoId = '';
            try {
                const urlObj = new URL(url2);
                if (urlObj.hostname.includes('youtube.com')) {
                    videoId = urlObj.searchParams.get('v');
                } else if (urlObj.hostname.includes('youtu.be')) {
                    videoId = urlObj.pathname.substring(1);
                }
            } catch(e) {}
            
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner"></span> Generating...';
            
            try {
                // Build the preview data object
                const previewData = {
                    times_arr_data: timestamps,
                    offset: totalOffset,
                    youtube_id: videoId,
                    fix_list: window.fullFixList || []
                };
                
                console.log("[DEBUG] Preview Data to encode:", previewData);
                
                // Base64 encode the JSON
                const jsonStr = JSON.stringify(previewData);
                const base64Data = btoa(unescape(encodeURIComponent(jsonStr)));
                
                let baseUrl = document.getElementById('previewBaseUrl').value;
                if (!baseUrl.endsWith('/')) {
                    baseUrl += '/';
                }
                
                // Construct the preview link with data in hash fragment
                const previewLink = `${baseUrl}preview-editor.php?metricArrId=${metricArrId}#data=${base64Data}`;
                
                document.getElementById('previewUrl').value = previewLink;
                document.getElementById('previewLinkOpen').href = previewLink;
                document.getElementById('previewResult').classList.remove('hidden');
                
            } catch (err) {
                alert("Error generating preview: " + err.message);
            } finally {
                btn.disabled = false;
                btn.textContent = '👁️ Generate Preview Link';
            }
        }
        
        function copyPreviewUrl() {
            const input = document.getElementById('previewUrl');
            input.select();
            document.execCommand('copy');
            
            const btn = event.target;
            const originalText = btn.textContent;
            btn.textContent = '✓';
            setTimeout(() => btn.textContent = '📋', 2000);
        }
    </script>
</body>
</html>
'''


@app.route('/')
def index():
    return render_template_string(HTML_TEMPLATE)


@app.route('/run', methods=['POST'])
def run():
    try:
        data = request.get_json()
        
        url1 = data.get('url1')
        url2 = data.get('url2')
        offset1 = float(data.get('offset1', 0))
        end1 = data.get('end1')
        if end1:
            end1 = float(end1)
            
        offset2 = float(data.get('offset2', 0))
        end2 = data.get('end2')
        if end2:
            end2 = float(end2)
        timestamps = data.get('timestamps', [])
        rec1_timestamps_offset = float(data.get('rec1_timestamps_offset', 0))
        timestamps_rec2 = data.get('timestamps_rec2')
        rec2_timestamps_offset = float(data.get('rec2_timestamps_offset', 0))
        
        # DEBUG: Print what we're receiving
        print(f"[DEBUG] Received: offset1={offset1}, end1={end1}, offset2={offset2}, end2={end2}")
        
        # Run the pipeline
        result = run_pipeline_custom(
            url1=url1,
            url2=url2,
            offset1=offset1,
            end1=end1,
            offset2=offset2,
            end2=end2,
            timestamps_list=timestamps,
            rec1_timestamps_offset=rec1_timestamps_offset,
            timestamps_list_rec2=timestamps_rec2,
            rec2_timestamps_offset=rec2_timestamps_offset
        )
        
        return jsonify({
            'success': True,
            'total_offset_rec2': result['total_offset_rec2'],
            'first_mapped_t': result['first_mapped_t'],
            'final_results': result['final_results'],
            'zero_based_results': result['zero_based_results'],
            'logs': result['logs']
        })
        
    except Exception as e:
        import traceback
        return jsonify({
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500


@app.route('/save_preview', methods=['POST'])
def save_preview():
    try:
        data = request.get_json()
        
        # Validate required fields
        if 'timestamps' not in data:
            return jsonify({'error': 'Missing timestamps'}), 400
            
        # Get data
        timestamps = data.get('timestamps')
        youtube_id = data.get('youtube_id', '') # Optional, might just use existing
        offset = data.get('offset', 0)
        
        # Create preview ID
        import uuid
        import time
        preview_id = f"preview_{int(time.time())}_{str(uuid.uuid4())[:8]}"
        filename = f"{preview_id}.json"
        
        # Ensure directory exists
        # Navigate from scripts/ to root/assets/previews
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        preview_dir = os.path.join(base_dir, 'assets', 'previews')
        os.makedirs(preview_dir, exist_ok=True)
        
        filepath = os.path.join(preview_dir, filename)
        
        # Struct to save
        preview_data = {
            'metric_arr_id': data.get('metricArrId'), # Context
            'youtube_id': youtube_id,
            'offset': offset,
            'times_arr_data': json.dumps(timestamps) if not isinstance(timestamps, str) else timestamps,
            'created_at': time.time()
        }
        
        with open(filepath, 'w') as f:
            json.dump(preview_data, f)
            
        return jsonify({
            'success': True,
            'filename': filename,
            'path': f"assets/previews/{filename}",
            'preview_id': preview_id
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({
            'error': str(e),
            'traceback': traceback.format_exc()
        }), 500


if __name__ == '__main__':
    print("Starting DTW Audio Sync Pipeline Web Interface...")
    print("Open http://localhost:5000 in your browser")
    app.run(host='0.0.0.0', port=5000, debug=True)
