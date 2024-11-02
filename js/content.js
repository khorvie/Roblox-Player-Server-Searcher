autoCheckUpdate();



function autoCheckUpdate() {
    const githubOwner = "Raihann22";
    const githubRepo = "Roblox-Player-Server-Searcher";

    chrome.storage.local.get(null, async (RPSS) => {
        const currentDate = Math.floor(Date.now() / 1000);
        const oneDay = (currentDate - RPSS.lastUpdateAlert) / (60 * 60) > 24;

        /**
         *  after user closing new update alert, it will show the alert again in 24 hours (if there is an update)
         *  if its equal or more than 24 hours, it will check if there an update every 30 minutes (only when change tab/reload)
         */
        if (!oneDay || (currentDate - RPSS.lastCheckUpdate) / 60 < 30) return;

        const availableVersion = await fetch(`https://api.github.com/repos/${githubOwner}/${githubRepo}/releases/latest`).then(async response => {
            const isRateLimitExceeded = response.status === 403;
            const rateLimitReset = Number(response.headers.get("x-ratelimit-reset")) - 1740;
            const result = await response.json();
            const version = result.tag_name;

            RPSS.lastCheckUpdate = isRateLimitExceeded ? rateLimitReset : currentDate;
            await chrome.storage.local.set(RPSS);

            if (isRateLimitExceeded || !version) return;
            return version.slice(1);
        });

        if (!availableVersion) return;

        const currentVersion = chrome.runtime.getManifest().version;
        if (currentVersion !== availableVersion) {
            RPSS.lastCheckUpdate = 0;
            await chrome.storage.local.set(RPSS);

            const container = await showUpdate(currentVersion, availableVersion);
            container.children[0].addEventListener("click", async () => {   // close alert
                container.hidden = true;
                RPSS.lastUpdateAlert = currentDate;
                await chrome.storage.local.set(RPSS);
            });
        }
    });

    async function showUpdate(currentVersion, availableVersion) {
        return await fetch(chrome.runtime.getURL("resources/html/new-update.html")).then(x => x.text()).then(html => {
            const updateAlert = document.createElement("div");
            const body = document.body;
            body.firstChild ? body.insertBefore(updateAlert, body.firstChild) : body.appendChild(updateAlert);
            updateAlert.outerHTML = html;

            const container = document.getElementById("RPSS-ACU-Container");
            container.children[0].style.backgroundImage = `url(${chrome.runtime.getURL("resources/svg/close.svg")}`;      // close icon
            container.children[3].children[0].children[1].innerText = `v${currentVersion}`;                     // current version
            container.children[3].children[1].children[1].innerText = `v${availableVersion}`;                   // available version
            container.lastElementChild.href = `https://github.com/${githubOwner}/${githubRepo}#how-to-download-and-install-or-update`;      // link to readme

            return container;
        });
    }
}
