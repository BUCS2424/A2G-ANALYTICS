! function(w) {
    'use strict';

    // Anonymous, first-party (per-site, not cross-site) visitor id used only
    // to count repeat visits to THIS site. No fingerprinting, no cross-site
    // tracking — cookie lives on the tracked domain itself.
    var VISITOR_COOKIE = '_a2g_vid';

    function getCookie(name) {
        var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? match[2] : null;
    }

    function setCookie(name, value) {
        var maxAge = 60 * 60 * 24 * 365 * 2; // ~2 years
        document.cookie = name + '=' + value + ';path=/;max-age=' + maxAge + ';SameSite=Lax';
    }

    function getOrCreateVisitorId() {
        var existing = getCookie(VISITOR_COOKIE);
        if (existing) return existing;
        var id = (w.crypto && w.crypto.randomUUID) ? w.crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2));
        setCookie(VISITOR_COOKIE, id);
        return id;
    }

    // Tracks the most recently reported pageview's server-assigned id and
    // load time, so we can report time-on-page when the visitor leaves.
    var currentPageview = null;

    function reportDuration() {
        if (!currentPageview || !currentPageview.id) return;
        var seconds = Math.round((Date.now() - currentPageview.startedAt) / 1000);
        if (seconds <= 0) return;
        var trackingCode = document.getElementById('ZwSg9rf6GA');
        var payload = JSON.stringify({ id: currentPageview.id, duration: seconds });
        if (navigator.sendBeacon) {
            navigator.sendBeacon(trackingCode.getAttribute('data-host') + '/api/event/duration', new Blob([payload], { type: 'application/json' }));
        }
        currentPageview = null;
    }

    /**
     * Send the request
     * @param event
     * @param referrer Needed for SPAs dynamic history push
     */
    function sendRequest(event, referrer) {
        // Tracking code element
        var trackingCode = document.getElementById('ZwSg9rf6GA');

        if (trackingCode.getAttribute('data-dnt') === 'true') {
            // If the user's has DNT enabled
            if (navigator.doNotTrack) {
                // Cancel the request
                return false;
            }
        }

        // A new page is starting — report the previous one's time-on-page first.
        reportDuration();

        // Request parameters
        var params = {};

        // If a referrer is set
        if (referrer) {
            params.referrer = referrer;
        } else {
            // Get the referrer
            params.referrer = w.document.referrer;
        }

        // Get the preferred color scheme
        if (window.matchMedia) {
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                params.theme = 'dark';
            } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
                params.theme = 'light';
            }
        }

        // Get the current page
        params.page = w.location.href.replace(/#.+$/,'');

        // Get the screen resolution
        params.screen_resolution = screen.width + 'x' + screen.height;

        if (event) {
            params.event = event;
        } else {
            params.visitor_id = getOrCreateVisitorId();
        }

        // Send the request
        var request = new XMLHttpRequest();
        request.open("POST", trackingCode.getAttribute('data-host') + "/api/event", true);
        request.setRequestHeader("Content-Type", "application/json; charset=utf-8");
        if (!event) {
            request.onload = function () {
                try {
                    var response = JSON.parse(request.responseText);
                    if (response && response.id) {
                        currentPageview = { id: response.id, startedAt: Date.now() };
                    }
                } catch (e) {}
            };
        }
        request.send(JSON.stringify(params));
    }

    try {
        // Rewrite the push state function to detect path changes in SPAs
        var pushState = history.pushState;
        history.pushState = function () {
            var referrer = w.location.href.replace(/#.+$/,'');
            pushState.apply(history, arguments);
            sendRequest(null, referrer);
        };

        // Listen to the browser's back & forward buttons
        w.onpopstate = function(event) {
            sendRequest(null);
        };

        // Report time-on-page when the visitor leaves or backgrounds the tab.
        w.addEventListener('pagehide', reportDuration);
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'hidden') reportDuration();
        });

        // Define the event method
        w.pa = {}; w.pa.track = sendRequest;

        // Send the initial request
        sendRequest(null);
    } catch (e) {
        console.log(e.message);
    }
}(window);
