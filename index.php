<!DOCTYPE HTML>
<html>
<head>
    <!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-YG4R4TFWVX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-YG4R4TFWVX');
</script>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<meta name="apple-mobile-web-app-capable" content="yes" />
    <link rel="stylesheet" href="fonts.css" />
    <link rel="stylesheet" type="text/css" href="stripped-synpdf-styles.css?v=4" />
    <link rel="icon" type="image/png" sizes="32x32" href="favicon-32x32.png">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.0/jquery.min.js"></script>
    <!-- <script src="https://code.jquery.com/ui/1.13.0/jquery-ui.min.js"></script> -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.9.179/pdf.min.js"></script>
    <script src="stripped-synpdf.js?v=5"></script>
    <title>monkey wrench</title>
</head>
<body>
    <!-- <sidebar></sidebar> -->
        <section1>
            <div id="header">
                <audio id="aud" controls="controls">Your browser does not support the audio element.</audio>
                <video id="vid" controls="controls">Your browser does not support the video element.</video>
                <div id="logo-bar-wrapper">
                    <div id="logo-bar">
                        <a href="/">
                            <img id="monkey-logo" src="monkeywrench-monkey100x100.png"></img>
                        </a>
                        <div class="monkeywrench-logo-text">
                            <a href="/">
                                <h2>MONKEY WRENCH</h2>
                                <h2 id="logotext-database">DATABASE</h2>
                            </a>
                        </div>  
                    </div>
                </div>
                
                <div id="vidyub">
                </div>
            </div>
                
                <div id="sync">
                    <div id="mbar">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24px" height="24px">
                                <path d="M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z" />
                            </svg>
                    </div>
                    <form id="menu">
                        <label class="mnrm" id="lp"><span>full screen:</span> <input id="fscr" type="checkbox"/></label>
                        <label class="mnrm" id="l3"><span>speed ctrl:</span> <input id="spdctl" type="checkbox"/></label>
                        <label class="mnrm" id="lo"><span>annotate:</span> <input id="annot" type="checkbox"/></label>
                        <label class="mnrm" id="l7"><span>hide player:</span> <input id="noplyr" type="checkbox"/></label>
                        <label class="mnrm" id="ld"><span>hide dashes:</span> <input id="nodash" type="checkbox"/></label>
                        <label class="mnrm" id="ln"><span>count in:</span> <input id="cntin" type="checkbox"/></label>
                        <label class="mexp" id="lu"><span>page number:</span> <input type="number" step="1" min="1" id="pagenum"></input></label>
                        <label class="mnrm" id="helpm">help</label>
                    </form>
                    <div id="sync_out">
                        <div id="sync_info"></div>
                        <label><span><button id="reset">Backspace</button></span> one measure</label>
                    </div>
                </div>
            <input id="knop" type="button" value="play">

        </section1>
        <section2>
            <div id="loadingMessage2">
            </div>
            <div class="notation" id="notation"><!--width needed for editmode pixel mapping -->
                <div class="collapsible">
                    <div class="search-heading" id="instruments-heading"><h2>Select Instrument</h2></div>
                    <div class="search-content instrument-container" id="instrument-links">
                        
                    </div>
                </div>
                <div class="collapsible">
                    <div class="search-heading" id="pieces-heading"><h2>Select Piece</h2></div>
                    <div class="search-content" id="pieces-container">

                    </div>
                </div>
                <div class="collapsible">
                    <div class="search-heading" id="recordings-heading"><h2>Select Recording</h2></div>
                    <div class="search-content" id="recordings-container">

                    </div>
                </div>
            </div>
            
            <sidecontentbar>
                <div id="sidecontent">
                    <div id="first-controls">
                        <div id="speed-part-row">
                                <!-- <button id="hide-sidebar-button">sidebar</button> -->
    <!--                        <div id="highlight-control">
                                <label for="favcolor"><p><b>Highlight</b></p></label>
                                <input type="color" id="favcolor" name="favcolor" value="#00d4ff">
                                <button id="reset-button">
                                    <svg xmlns="http://www.w3.org/2000/svg" height="16" width="16" viewBox="0 0 512 512">-->
                                    <!--!Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2023 Fonticons, Inc.-->
    <!--                            <path d="M212.3 224.3H12c-6.6 0-12-5.4-12-12V12C0 5.4 5.4 0 12 0h48c6.6 0 12 5.4 12 12v78.1C117.8 39.3 184.3 7.5 258.2 8c136.9 1 246.4 111.6 246.2 248.5C504 393.3 393.1 504 256.3 504c-64.1 0-122.5-24.3-166.5-64.2-5.1-4.6-5.3-12.6-.5-17.4l34-34c4.5-4.5 11.7-4.7 16.4-.5C170.8 415.3 211.6 432 256.3 432c97.3 0 176-78.7 176-176 0-97.3-78.7-176-176-176-58.5 0-110.3 28.5-142.3 72.3h98.3c6.6 0 12 5.4 12 12v48c0 6.6-5.4 12-12 12z"/>
                                    </svg>
                                </button>
                            </div>-->
                            <div id="change-part-wrapper">
                                <h3>Change Part</h3>
                                <select id="instruments-dropdown">
                                    <option value="">Select Part</option>
                                </select>
                            </div>
                            <div id="speed-control">
                                <div id="speed-title">
                                    <h3>Speed</h3>
                                </div>
                                <div id="speed-content">
                                    <button id="decrementButton">-</button>
                                    <button id="incrementButton">+</button>
                                    <input type="text" id="speedField" readonly>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="change-recording-wrapper">
                        <h3>Change Recording</h3>
                        <select id="recordings-dropdown">
                            <option value="">Select Recording</option>
                        </select>
                        <div>
                            <button id="invertButton">Dark Mode (buggy)</button>
                        </div>
                    </div>
                </div>
            </sidecontentbar>
        </section2>
        <section3>
            <div id="wait" class="dlog"></div>
            <div id="loadmsg" class="dlog"></div>
            <pre id="yubload" class="dlog">Youtube player loading, please wait ...</pre>
            <div id="countin" class="dlog"></div>
            <div id="saveDlg">
                <div id="div1"></div>
                <div id="div4"></div><!--no space between inline-block elements! because it is rendered!!!
            --><div id="div2"><pre></pre></div>
                <div id="div1"></div>
                <div id="div3">
                    <button id="saveok">Close</button><button id="save">Save</button>
                    <span>When the save button gives a (false) security error, select and save all text above as .js file.</span>
                </div>
            </div>
            <div id="saveDiv" style="display:none;"></div>
            <div id="render" class="dlog" style="left:5%; padding:0.5em;"></div>
            <div id="noklik"></div>
            <div id="help">
                The menu is explained in the <a href="readme.html#menu" target="_blank">usage instructions</a><br>
                <span>You can use the following keys:</span>
                <table class="helptbl">
                    <tr><td><b>spacebar</b> or tap<br>in left margin</td>
                        <td>pause / continue</td>
                        <td><b>f</b></td><td>toggle file buttons</td></tr>
                    <tr><td><b>right arrow</b></td><td>go to next measure</td>       <td><b>l</b></td><td>toggle line cursor</td></tr>
                    <tr><td><b>left arrow</b></td><td>go to previous measure</td>   <td><b>h</b></td><td>toggle help</td></tr>
                    <tr><td><b>+</b>/<b>-</b></td><td>increase / decrease speed</td>  <td><b>m</b></td><td>toggle menu</td></tr>
                </table>

                In addition, when synchronization is enabled:
                <table class="helptbl">
                    <tr><td><b>b</b> or tap in score</td><td>record <a href="readme.html#sync" target="_blank">sync point</a>, 
                        move to the next measure.</td>
                        <td><b>g</b></td><td>remove a pair of <a href="readme.html#repeats" target="_blank">repeat marks</a>.</td></tr>
                    <tr><td><b>backspace</b> or clear button</td>
                        <td>backup one measure: erase current sync point (and all following, if any)</td>
                        <td><b>long</b> click or <b>shift</b> click in measure</td>
                        <td>add a <a href="readme.html#repeats" target="_blank">repeat mark</a> to the measure</td></tr>
                    <tr><td><b>,</b></td><td>shorten the duration of the current measure</td>
                        <td><b>ctrl-,</b></td><td>shorten the initial offset (play back time in the media file where
                                                the first measure starts).</td></tr>
                    <tr><td><b>.</b></td><td>lengthen the duration of the current measure.</td>
                        <td><b>ctrl-.</b></td><td>lengthen the initial offset.</td></tr>
                    <tr><td><b>w</b> or<br/>save&nbsp;button</td>
                        <td colspan="3">save timings, pdf data and other settings to a file (see
                        <a href="readme.html#preload" target="_blank">preload file</a>).
                        Also works with dropbox. You can load a preload file with the score file button.
                        </td></tr>
                </table>
                synchronizing:<ul>
                    <li>At the start of every new (unsynchronized) measure the program waits for a click/tap in the score
                    (or key press &apos;B&apos;)</li>
                    <li>By clicking in the score (or typing key &apos;B&apos;) you synchronize the *first* beat of that measure to the audio.</li>
                    <li>The duration of the current measure and the initial offset are shown in the top right corner of the display.
                    You can precisely adjust these numbers with the keyboard sync commands (preferably when media is paused).</li>
                </ul>
                <button id="closehelp">Close</button>
            </div>
        </section3>

<script src="stripped-synpdf-extras.js?v=5"></script>
</body>
</html>
