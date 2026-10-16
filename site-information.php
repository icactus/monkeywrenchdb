<!-- Help/About Backdrops -->
<div id="help-backdrop" class="modal-backdrop"></div>
<div id="about-backdrop" class="modal-backdrop"></div>
<div id="help">
    <div class="modal-header">
        <h3>How to Use</h3>
        <button class="modal-close" onclick="toggleHelpLinkMenu()" aria-label="Close">&times;</button>
    </div>
    <div class="modal-content">
        <p><strong>Interactive Sheet Music</strong></p>
        <ul>
            <li><b>Tap or click</b> any measure to jump to that spot in the video</li>
            <li>The music follows along as the video plays</li>
            <li>Switch between recordings or parts without losing your place</li>
        </ul>
        <p><strong>Keyboard Shortcuts</strong></p>
        <table class="helptbl">
            <tr>
                <td><b>Spacebar</b></td>
                <td>Play / Pause</td>
            </tr>
            <tr>
                <td><b>↑ ↓ ← →</b> Arrow keys</td>
                <td>Navigate measures</td>
            </tr>
            <tr>
                <td><b>+ / −</b></td>
                <td>Speed up / Slow down</td>
            </tr>
            <tr>
                <td><b>PgUp / PgDn</b></td>
                <td>Previous / Next page</td>
            </tr>
            <tr>
                <td><b>Shift + Click</b> / <b>Double-tap</b></td>
                <td>Play last repeat of measure</td>
            </tr>
        </table>
        <p class="help-note">This project is a work in progress. Want to help? Email
            <b><a href="#contact-email" data-contact-email>icactusmusic AT gmail DOT com</a></b>
        </p>
    </div>
</div>
<div id="about">
    <div class="modal-header">
        <h3>About</h3>
        <button class="modal-close" onclick="toggleAboutLinkMenu()" aria-label="Close">&times;</button>
    </div>
    <div class="modal-content">
        <p><b>Monkey Wrench Database</b> is a free and open-source project built on a modified version of
            <a href="https://wim.vree.org/js2/index.html" target="_blank" rel="noopener noreferrer">Wim Vree's SynPdf</a>.
            The source code is available on <a href="https://github.com/icactus/monkeywrenchdb"
                target="_blank" rel="noopener noreferrer">GitHub</a>.</p>
        <p>This has been a solo passion project by Isaac Trapkus, bassist with the New York Philharmonic.
            The project began in 2021 and finally launched in 2026. I'm not a
            software developer by trade, so please bear with my many skill issues.</p>
        <p>Every page of sheet music is synced by algorithmically detecting staves and barlines, with manual
            correction (about 1 minute per page). Recordings are synced by logging timestamps while playing
            through at 1–2x speed.</p>
        <p>Without the help of volunteers, this database will not be able to scale. If you find this project
            valuable and want to contribute, I'd love to hear from you:
            <b><a href="#contact-email" data-contact-email>icactusmusic AT gmail DOT com</a></b></p>
    </div>
</div>
