/* Standalone exercise controller. Official timings never enter the sync engine. */
(() => {
    'use strict';

    // Provisional scoring: each matching occurrence earns up to one point,
    // falling linearly to zero at one second of error. Missing/wrong events earn
    // zero. The closing marker is intentionally excluded from the percentage.
    function evaluate(official, actual, officialOffset, actualOffset, tolerance = 1) {
        const expected = official.slice(0, -1);
        const attempts = actual.slice(0, -1);
        const errors = expected.map((point, i) => {
            const attempt = attempts[i];
            return attempt && !attempt.end && attempt.mix === point.mix && Number.isFinite(attempt.t)
                ? Math.abs(attempt.t + actualOffset - (point.t + officialOffset)) : null;
        });
        const matched = errors.filter(error => error !== null);
        const extra = Math.max(0, attempts.length - expected.length);
        const points = errors.reduce((sum, error) => sum + (error === null ? 0 : Math.max(0, 1 - error / tolerance)), 0);
        return {
            percentage: Math.round(100 * points / (expected.length + extra || 1)),
            matched: matched.length, expected: expected.length,
            missingOrWrong: errors.length - matched.length, extra,
            meanError: matched.length ? matched.reduce((a, b) => a + b, 0) / matched.length : null,
            errors,
            closingError: actual.at(-1) && !actual.at(-1).end
                ? Math.abs(actual.at(-1).t + actualOffset - (official.at(-1).t + officialOffset)) : null
        };
    }
    if (typeof module !== 'undefined' && module.exports) module.exports = { evaluate };
    if (typeof window === 'undefined') return;

    const byId = id => document.getElementById(id);
    const get = name => window[name + '$$module$synpdf'];
    const set = (name, value) => { window[name + '$$module$synpdf'] = value; };
    let exercise, stage = 'loading', result = null, submitting = false;
    let videoRequested = false;
    let playbackStarted = false, infoStep = 'loading';
    const dismissedSteps = new Set();
    const lesson = byId('tutorial-lesson'), scoreStage = byId('yubsync-score-stage');
    const title = byId('tutorial-title'), copy = byId('tutorial-copy');
    const restart = byId('tutorial-restart');
    const submitButton = byId('addnewrecordingform').querySelector('[type="submit"]');

    function pause() {
        const player = get('elmed');
        if (get('yubchk') && typeof player?.getPlayerState !== 'function') player?.pause?.();
        else get('pauseer')();
        get('msc_wz').paused = true;
    }
    function seek(seconds, play = false) {
        pause();
        const player = get('elmed');
        if (get('yubchk') && typeof player.getPlayerState === 'function') {
            if (player.getPlayerState() === 5) {
                player.cueVideoById({ videoId: exercise.youtubeId, startSeconds: seconds });
            } else player.seekTo(seconds, true);
            if (play) player.playVideo();
        } else {
            player.currentTime = seconds;
            if (play) player.play();
        }
        get('msc_wz').paused = !play;
    }
    function clearTargets() {
        document.querySelectorAll('.tutorial-target').forEach(node => node.remove());
    }
    function showTargets() {
        clearTargets();
        const jump = exercise.repeats[0];
        const current = get('deTijden')?.[get('detix')]?.mix ?? 0;
        const targets = stage === 'repeat' ? [[jump.from, 'From · 49'], [jump.to, 'To · 1']]
            : [[stage === 'start' ? 0 : current, stage === 'start' ? 'Start · 1' : `Measure · ${current + 1}`]];
        for (const [index, label] of targets) {
            const box = get('deMaten')[index];
            if (!box) continue;
            const target = document.createElement('div');
            target.className = 'tutorial-target';
            target.dataset.label = label;
            target.dataset.measure = index;
            Object.assign(target.style, { left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px' });
            byId('notation').append(target);
        }
    }
    function positionInfo() {
        const notation = byId('notation');
        lesson.style.maxHeight = Math.max(80, scoreStage.clientHeight * 0.45) + 'px';
        // Let the final systems scroll above the box, just like earlier systems.
        notation.style.setProperty('--tutorial-scroll-space', lesson.hidden ? '0px'
            : lesson.getBoundingClientRect().height + 24 + 'px');
    }
    function setInfoStep(step) {
        infoStep = step;
        lesson.dataset.step = step;
        lesson.hidden = stage === 'complete' || dismissedSteps.has(step);
    }
    function playbackChanged() {
        window.YubSyncGuidance?.update();
    }
    function resetStart() {
        if (!exercise) return false;
        stage = 'start'; result = null;
        playbackStarted = false;
        dismissedSteps.clear();
        window.YubSyncTutorial.lastResult = null;
        seek(exercise.cueSeconds);
        return true;
    }
    function beforeStamp() {
        // Lessons only provide help; recording readiness is the only gate.
        return !!exercise && get('yubchk') && window.yubsyncLoadedVideoId === exercise.youtubeId;
    }
    function update(s) {
        document.body.classList.toggle('tutorial-loading', !s.videoReady);
        byId('yubsync-guide').hidden = true;
        byId('yubsync-end-here').hidden = true;
        byId('yubsync-end-here').disabled = true;
        byId('yubsync-show-details').textContent = 'Tutorial results';
        submitButton.value = submitting ? 'Submitting…' : 'Submit tutorial';
        submitButton.disabled = !s.complete || submitting || !!result;
        byId('yubsync-completion-title').textContent = result ? 'Tutorial results' : 'Tutorial complete';
        byId('yubsync-completion-copy').textContent = result
            ? 'Your timings have been compared with the official sync.'
            : 'Submit to compare your timings with the official sync. This practice attempt stays in your browser.';
        byId('yubsync-completion-eyebrow').textContent = 'SYNCING TUTORIAL';
        byId('addnewrecordingform').hidden = !s.complete || !!result;
        byId('tutorial-results').hidden = !result;
        byId('tutorial-try-again').hidden = !result;
        if (!exercise || !s.scoreReady) { positionInfo(); return; }
        // Finish PDF initialization on the dummy player before loading YouTube.
        // Otherwise a fast PDF can finish while the iframe API is still loading.
        if (!videoRequested) {
            videoRequested = true;
            window.dispatchEvent(new CustomEvent('yubsync:before-video-load'));
            get('opt').yubvid = exercise.youtubeId;
            get('setPlayer')('', '');
        }

        const jump = exercise.repeats[0];
        // Select the help text without pausing, seeking, or blocking B.
        stage = s.complete ? 'complete' : !s.recorded ? 'start'
            : s.last === jump.at - 1 ? 'repeat' : 'follow';
        if (!s.complete && result) result = null;
        const player = get('elmed');
        const playing = s.videoReady && (typeof player?.getPlayerState === 'function'
            ? player.getPlayerState() === 1 : player?.paused === false);
        playbackStarted ||= playing;
        const step = stage === 'start' ? (s.videoReady ? (playbackStarted ? 'mark-start' : 'play') : 'loading')
            : stage === 'repeat' ? 'repeat' : s.complete ? 'complete' : s.finishing ? 'finish'
                : s.last < 2 ? 'follow' : 'check-start';
        setInfoStep(step);
        byId('tutorial-start-help').hidden = step !== 'check-start';
        byId('tutorial-correction-help').hidden = step !== 'check-start';

        restart.disabled = submitting || !s.videoReady;
        byId('tutorial-step').textContent = stage === 'start' ? '1 / 3 · FIND THE START'
            : stage === 'repeat' ? '2 / 3 · MARK THE REPEAT' : s.complete ? '3 / 3 · COMPARE YOUR TIMINGS' : 'FOLLOW THE SCORE';
        title.textContent = step === 'loading' ? 'Preparing the recording…' : step === 'play' ? 'Start the recording'
            : step === 'mark-start' ? 'Mark the start' : stage === 'repeat' ? 'The music repeats here'
                : s.complete ? 'Ready to compare' : s.finishing ? 'Mark the end'
                    : step === 'check-start' ? 'Listen back when you’re ready' : 'Mark each measure';
        const instruction = step === 'loading' ? 'The score and player will be ready shortly.'
            : step === 'play' ? 'Press Play on the player to start.'
            : step === 'mark-start' ? 'Press B about a second before the first note to mark the start of syncing.'
            : stage === 'repeat'
                ? 'To add a repeat, shift click the measure with the repeat and then shift click the destination measure. Keep pressing B as the music continues; after marking the jump, B advances to its destination. You can also use this method to jump forward in the case of 2nd endings or cuts.'
                : s.complete ? 'Choose Submit tutorial to see how closely your timings match. Choose Start over to practice again.'
                    : s.finishing ? 'Let the last measure finish, then press B a few seconds after the final cutoff to finish the exercise.'
                        : s.last < 2 ? 'Press B on the first beat of each next measure.'
                            : 'Use Left / Right to listen back. Ctrl + Left / Right adjusts the first measure’s start. Then keep pressing B at each new measure.';
        if (copy.textContent !== instruction) copy.textContent = instruction;
        byId('tutorial-progress').textContent = `${Math.min(s.last + 1, exercise.official.length - 1)} / ${exercise.official.length - 1} measure starts marked`;
        if (!lesson.hidden && s.videoReady && !s.complete) showTargets(); else clearTargets();
        positionInfo();
    }
    function startOver() {
        if (submitting) return;
        if (!exercise || stage === 'error') { boot(); return; }
        pause(); clearTargets();
        set('repMaten', []);
        get('msc_wz').selectedRepeat = null;
        get('msc_wz').drawRepTokens();
        get('opt').synbox = 1;
        byId('synbox').checked = true;
        byId('tutorial-results').replaceChildren();
        byId('yubsync-submit-status').textContent = '';
        set('lastSynced', -1);
        get('msc_wz').startSync();
        get('msc_wz').showSyncInfo();
        byId('yubsync-zoom-in').focus();
    }
    async function submit() {
        if (submitting || result || !window.YubSyncGuidance.canSubmit()) return;
        submitting = true;
        byId('addnewrecordingform').setAttribute('aria-busy', 'true');
        const status = byId('yubsync-submit-status');
        status.textContent = 'Submitting… Comparing your timings.';
        window.YubSyncGuidance.update();
        // Yield a paint so the comparison status is visible. No network request.
        await new Promise(resolve => setTimeout(resolve, 250));
        try {
            result = evaluate(exercise.official, get('deTijden').slice(0, get('lastSynced') + 1), exercise.startSeconds, get('offset'));
            const output = byId('tutorial-results');
            output.replaceChildren();
            const score = document.createElement('strong');
            score.className = 'tutorial-score'; score.textContent = `${result.percentage}%`;
            const detail = document.createElement('p');
            detail.textContent = `${result.matched} of ${result.expected} measure starts matched in sequence.` +
                (result.meanError === null ? '' : ` Average timing difference: ${result.meanError.toFixed(2)} seconds.`) +
                (result.missingOrWrong || result.extra ? ' Check your repeat markers and the number of B presses.' : '');
            const explanation = document.createElement('p');
            explanation.textContent = 'Practice score: full credit for an exact match, decreasing to zero at one second of difference per marker. Missing or wrong markers receive zero. The closing marker is excluded. We may adjust this scoring.';
            output.append(score, detail, explanation);
            // Raw errors stay available for refining the scoring later.
            window.YubSyncTutorial.lastResult = result;
        } finally {
            submitting = false;
            byId('addnewrecordingform').setAttribute('aria-busy', 'false');
            status.textContent = '';
            window.YubSyncGuidance.update();
        }
    }
    async function boot() {
        stage = 'loading';
        playbackStarted = false;
        dismissedSteps.clear();
        setInfoStep('loading');
        title.textContent = 'Loading your exercise…';
        copy.textContent = 'Preparing the score and recording.';
        positionInfo();
        restart.disabled = true;
        restart.textContent = 'Start over';
        try {
            const response = await fetch('/assets/tutorials/yubsync-bach/exercise.json?v=1');
            if (!response.ok) throw new Error('The tutorial data could not be loaded.');
            exercise = await response.json();
            videoRequested = false;
            window.dispatchEvent(new CustomEvent('yubsync:before-score-load'));
            get('resetSyncVideo')();
            const metrics = structuredClone(exercise.metrics);
            window.yubsyncMetricContext = { tutorialId: exercise.id, metrics, pdfFile: exercise.pdf };
            set('pdf_file', exercise.pdf);
            set('metric_arr', metrics);
            set('adv_settings', {});
            set('times_arr', undefined);
            set('offset_js', 0);
            set('scoreFnm', 'yubsync-tutorial');
            Object.assign(get('opt'), { synbox: 1, lastSynced: -1, btime: exercise.cueSeconds, yubvid: '' });
            set('startSyncOnLoad', true);
            byId('yubid').value = exercise.youtubeId;
            get('msc_check_preload')();
        } catch (error) {
            stage = 'error';
            setInfoStep('error');
            title.textContent = 'Could not load the tutorial';
            copy.textContent = error.message;
            restart.disabled = false;
            restart.textContent = 'Retry';
            positionInfo();
        }
    }
    restart.addEventListener('click', startOver);
    byId('tutorial-try-again').addEventListener('click', startOver);
    byId('tutorial-close').addEventListener('click', () => {
        dismissedSteps.add(infoStep);
        lesson.hidden = true;
        clearTargets();
        positionInfo();
        byId('yubsync-zoom-in').focus();
    });
    lesson.addEventListener('toggle', positionInfo, true);
    window.addEventListener('resize', positionInfo);
    document.addEventListener('keydown', event => {
        if (window.YubSyncGuidance?.state().videoReady) return;
        if ([' ', 'Spacebar', 'b', 'B', 'Backspace', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
            'PageUp', 'PageDown', '+', '=', '-'].includes(event.key)) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    }, true);
    window.YubSyncTutorial = { update, resetStart, beforeStamp, playbackChanged, submit, evaluate, lastResult: null };
    $(document).ready(boot);
})();
