<!DOCTYPE HTML>
<html>

<head>
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-YG4R4TFWVX"></script>
    <script>
        window.dataLayer = window.dataLayer || [];

        function gtag() {
            dataLayer.push(arguments);
        }
        gtag('js', new Date());

        gtag('config', 'G-YG4R4TFWVX');
    </script>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <link rel="stylesheet" href="fonts.css" />
    <link rel="stylesheet" type="text/css" href="stripped-synpdf-styles.css?v=63" />
    <link rel="icon" type="image/png" sizes="32x32" href="favicon-32x32.png">
    <script src="jquery.min.js"></script>
    <title>monkey wrench database</title>
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
                    <div id="monkeywrench-logo-text">
                        <a href="/">
                            <h2>MONKEY WRENCH DATABASE</h2>
                            <h3 id="logotext-line2">sheet music synced with youtube</h3>
                        </a>
                    </div>
                </div>
                <div class="nav-menu">
                    <a id="help-link" href="javascript:void(0)" onclick="toggleHelpLinkMenu(); return false;">Help</a>
                    <a id="about-link" href="javascript:void(0)" onclick="toggleAboutLinkMenu(); return false;">About</a>
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
                <label class="mnrm" id="lp"><span>full screen:</span> <input id="fscr" type="checkbox" /></label>
                <label class="mnrm" id="l3"><span>speed ctrl:</span> <input id="spdctl" type="checkbox" /></label>
                <label class="mnrm" id="lo"><span>annotate:</span> <input id="annot" type="checkbox" /></label>
                <label class="mnrm" id="l7"><span>hide player:</span> <input id="noplyr" type="checkbox" /></label>
                <label class="mnrm" id="ld"><span>hide dashes:</span> <input id="nodash" type="checkbox" /></label>
                <label class="mnrm" id="ln"><span>count in:</span> <input id="cntin" type="checkbox" /></label>
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
            <div id="notation-scroll">
                <!-- TAB HEADERS -->
                <div class="tabs">
                    <ul class="tab-header-row">
                        <li class="tab-header active" data-tab="tab-instruments">
                            <h2 id="instruments-heading">1. Select Instrument</h2>
                        </li>
                        <li class="tab-header disabled" data-tab="tab-pieces">
                            <h2 id="pieces-heading">2. Select Piece</h2>
                        </li>
                        <li class="tab-header disabled" data-tab="tab-recordings">
                            <h2 id="recordings-heading">3. Select Recording</h2>
                        </li>
                    </ul>
                </div>
                <div class="tab-contents">
                    <div id="tab-instruments" class="tab-content active" style="display:block;">
                        <div class="search-content instrument-container" id="instrument-links">
                        </div>
                    </div>
                    <div id="tab-pieces" class="tab-content" style="display:none;">
                        <div class="search-content" id="pieces-container">
                        </div>
                    </div>
                    <div id="tab-recordings" class="tab-content" style="display:none;">
                        <div class="search-content" id="recordings-container">
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <sidecontentbar>
            <div id="sidecontent">
                <div id="composer-toggle-wrapper">
                    <div id="composer-piece-name"></div>
                    <div id="sidecontent-toggle">
                        <h3>[hide]</h3>
                    </div>
                </div>
                <div id="first-controls">
                    <div id="speed-part-row">
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
                                <option value="">Change Part</option>
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
                        <option value="">Change Recording</optionfrom part to score>
                    </select>
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
            -->
            <div id="div2">
                <pre></pre>
            </div>
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
            <span>Navigatable sheet music synced to YouTube!</span><br>
            <ul>
                <li>Two-way sync: <b>click/touch</b> measures or player to navigate.</li>
                <li>Jump between recordings or from part to score without losing your place.</li>
                <li>Play along, score study, and practice aid.</li>
                <li>Growing database of the most performed classical music.</li>
            </ul>
            <span>Keyboard controls:</span>
            <table class="helptbl">
                <tr>
                    <td><b>spacebar</b> or tap<br>in left margin</td>
                    <td>play / pause</td>
                    <td><b>PgUp / PgDn</b></td>
                    <td>page up / page down</td>
                </tr>
                <tr>
                    <td><b>arrow keys</b></td>
                    <td>navigate measures</td>
                    <td><b>h</b></td>
                    <td>toggle help</td>
                </tr>
                <tr>
                    <td><b>+</b>/<b>-</b></td>
                    <td>change player speed</td>
                    <td><b></b></td>
                    <td></td>
                </tr>
            </table>
            <ul>
                <li>This site is under heavy contruction and it's just me so please be patient with improvements!</li>
            </ul>
            <button id="closehelp">Close</button>
        </div>
        <div id="about">
            <p><b>Monkey Wrench Database</b> is built on a modified fork of <a href="https://wim.vree.org/" target="_blank" rel="noopener noreferrer">Willem Vree's</a> SynPdf. Without his amazing open source project none of this would be possible.</p>
            <p>This site is a solo project by Isaac Trapkus, bassist with the NY Phil. I am not a professional programmer (<a href="https://bassmentrosin.com" target="_blank" rel="noopener noreferrer">but I do make bass rosin</a>). Please forgive my many skill issues.</p>
            <p>Syncing is done by detecting staves and barlines algorithmically with manual correction. It takes 1-2 minutes per page of sheet music. AI is still not at the point where it can do this task. Recordings are manually synced by playing through the video and logging timestamps with keypresses (usually at 1.5-2x playback speed). Dynamic Time Warping makes it possible to automate adding additional recordings once a piece has a manual timestamp record. But the time to proof-read the recording is about the same as doing it manually.</p>
            <p>If you find this project important and have the programming skills to make meaningful contributions to its development, please be in touch! icactusmusic AT gmail DOT com.</p>
            <button id="closeabout">Close</button>
        </div>
    </section3>
    <!-- Notification Element -->
    <div id="notification" style="display: none; position: fixed; bottom: 60px; right: 20px; background: #333; color: #fff; padding: 10px 20px; border-radius: 5px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);">
        Link copied to clipboard!
    </div>
    <script src="stripped-synpdf.js?v=175"></script>
    <script src="stripped-synpdf-extras.js?v=152"></script>
</body>

</html>
