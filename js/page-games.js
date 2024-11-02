let PLACE_ID;
let PLACE_UNIVERSE_ID;
let PROGRESS_BAR;
let JOIN_HTML;
let JOIN_JS;
let PLAYER_IN_OTHER_GAME_HTML;
let PLAYER_IN_OTHER_GAME_JS;

(async () => {
    PLACE_ID = Number((window.location.href).match(/\/games\/(\d+)\//)[1]);
    PLACE_UNIVERSE_ID = document.getElementById("game-detail-meta-data").getAttribute("data-universe-id");
    JOIN_HTML = await fetch(chrome.runtime.getURL("resources/html/joining.html")).then(x => x.text());
    JOIN_JS = await import(chrome.runtime.getURL("resources/js/join.js"));
    PLAYER_IN_OTHER_GAME_HTML = await fetch(chrome.runtime.getURL("resources/html/player-in-other-game.html")).then(x => x.text());
    PLAYER_IN_OTHER_GAME_JS = await import(chrome.runtime.getURL("resources/js/player-in-other-game.js"));



    const winLocHash = window.location.hash?.split("&");
    if (winLocHash[1] && winLocHash[1].startsWith("rpss_join")) {   // check direct join
        window.location.hash = winLocHash[0];

        const gameInfos = winLocHash[1].slice(10).split(",");
        JOIN_JS.join(gameInfos[0], gameInfos[1], gameInfos[2], (gameInfos[3] === "customServer"));
    }
    createLayout();


    function createLayout() {
        const observer = new MutationObserver((mutationsList, observer) => {
            const element = document.querySelector(".server-list-options");
            if (element?.children?.length === 2) {
                observer.disconnect();
                appendLayout();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        function appendLayout() {
            fetch(chrome.runtime.getURL("resources/html/layout.html")).then(result => result.text()).then(RPSSlayout => {
                const layout = document.createElement("div");
                const serverListOptions = document.getElementsByClassName("server-list-options")[0];
                serverListOptions.append(layout);
                layout.outerHTML = RPSSlayout;
                PROGRESS_BAR = document.getElementById("RPSS-ProgressBar");
                
                chrome.runtime.sendMessage({ msg: "RPSS_Run_searcher.js" });
            });
        }
    }
})();