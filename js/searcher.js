const sleep = time => new Promise(x => setTimeout(x, time));

const userInput = document.getElementById("RPSS-UserInput");
const searchButton = document.getElementById("RPSS-SearchButton");
const warningContainer = document.getElementById("RPSS-PSA-Container");
const warningText = document.getElementById("RPSS-PSA-Warning");

let serverSizeMoreThan5;
let activePlayersInGame;
let currentProgress = 0;

userInput.addEventListener("input", () => {
    userInput.value = userInput.value.replace(/[^a-zA-Z0-9_]/g, '');

    searchButton.children[0].style.backgroundImage = "url('https://tr.rbxcdn.com/59f4dbf786e05b0900ec6dbffd296035/150/150/AvatarHeadshot/Png/isCircular')";
    PROGRESS_BAR.style.width = "0%";
    warningContainer.style.transform = "translateX(180px)";

    if (userInput.value.length < 3 || userInput.value.length > 20) {
        searchButton.style.cursor = "not-allowed";
        searchButton.disabled = true;
    } else {
        searchButton.style.cursor = "";
        searchButton.disabled = false;
    }
});


searchButton.addEventListener("click", async () => {
    await chrome.storage.local.get(null, async (RPSS) => {
        if (!RPSS.EULA) return showEULA(RPSS);

        disableInptBtn(true);

        const gameDetail = await fetch(`https://games.roblox.com/v1/games?universeIds=${PLACE_UNIVERSE_ID}`).then(res => res.json());
        serverSizeMoreThan5 = gameDetail.data[0].maxPlayers > 5;
        activePlayersInGame = gameDetail.data[0].playing;

        const result = await findPlayer();
        PROGRESS_BAR.style.width = "100%";
        switch (result[0]) {
            /**
             *  0 = User doesn't exist.
             *  1 = Player offline.
             *  2 = Player online.
             *  3 = Player in studio.
             *  4 = No Server.
             *  5 = Player not in this game.
             *  6 = Player in a different game.
             */

            case 0:
                warningText.innerHTML = "User doesn't exist!";
                break;

            case 1:
                warningText.innerHTML = "Player is offline!";
                break;

            case 2:
                warningText.innerHTML = "Player is online, but not in a game.";
                break;

            case 3:
                warningText.innerHTML = "Player is in Roblox Studio!";
                break;

            case 4:
                warningText.innerHTML = "No Servers Found!";
                break;

            case 5:
                warningText.innerHTML = "Player not found in this game!";
                break;

            case 6:
                PLAYER_IN_OTHER_GAME_JS.showAlert(result[1], result[2], result[3]);
                break;

            default:
                // player found!
                const gameId = result[0].toString().length > 1 ? result[0] : result[1];
                const avatar = result[0].toString().length > 1 ? result[1] : result[2];
                const username = result[0].toString().length > 1 ? result[2] : result[3];

                JOIN_JS.join(gameId, avatar, username);
                break;
        }
        if (typeof result[0] === "number" && result[0] <= 5) warningContainer.style.transform = "translateX(0px)";

        disableInptBtn(false);
    });
});



function showEULA(RPSS) {
    fetch(chrome.runtime.getURL("resources/html/eula.html")).then(result => result.text()).then(html => {
        const eulaAlert = document.createElement("div");
        eulaAlert.innerHTML = html;

        const body = document.body;
        body.firstChild ? body.insertBefore(eulaAlert, body.firstChild) : body.appendChild(eulaAlert);
        eulaAlert.children[0].style.height = `${eulaAlert.children[0].offsetHeight * 0.8}px`;

        const agreeCheckbox = document.getElementById("RPSS-AGMT-Agree");
        const countdown = document.getElementById("RPSS-AGMT-Countdown");

        let countdownInterval;
        agreeCheckbox.addEventListener("change", (event) => {
            clearInterval(countdownInterval);

            countdown.style.visibility = countdown.style.visibility === "visible" ? "" : "visible";

            if (event.target.checked) {
                let secondsRemaining = 10;
                countdown.innerText = `Applying in ${secondsRemaining--} seconds`;

                countdownInterval = setInterval(() => {
                    countdown.innerText = `Applying in ${secondsRemaining--} seconds`;

                    if (secondsRemaining < 0) {
                        clearInterval(countdownInterval);
                        eulaAlert.hidden = true;

                        RPSS.EULA = true;
                        chrome.storage.local.set(RPSS);
                    }
                }, 1000);
            }
        });
    });
}

function disableInptBtn(disable) {
    userInput.disabled = disable;
    searchButton.disabled = disable;

    userInput.style.cursor = disable ? "wait" : "";
    searchButton.style.cursor = disable ? "wait" : "";
}



async function findPlayer() {
    PROGRESS_BAR.style.width = `0%`
    warningContainer.style.transform = "translateX(180px)";

    let targetPlayer = userInput.value;
    let username;
    const playerAvatarHeadshot = await fetchPlayerAvatarHeadshot();
    if (!targetPlayer) return [0];

    const avatarImageUrl = playerAvatarHeadshot.state === "Completed" ? playerAvatarHeadshot.imageUrl : chrome.runtime.getURL("resources/svg/error-404.svg");
    const searchButtonAvatar = document.getElementById("RPSS-SearchButtonAvatar");
    searchButtonAvatar.style.backgroundImage = `url(${avatarImageUrl})`;

    const playerStatus = await checkStatus();
    if (playerStatus[0] !== 4) return playerStatus;

    let allTokens = [];
    return await fetchServers();



    async function fetchPlayerAvatarHeadshot() {
        if (!/^\d+$/.test(targetPlayer)) {  // getting target's userId if searching using username
            username = targetPlayer;
            await fetch("https://users.roblox.com/v1/usernames/users", {
                method: "POST",
                headers: { "accept": "application/json", "Content-Type": "application/json" },
                body: JSON.stringify({
                    "usernames": [targetPlayer],
                    "excludeBannedUsers": true
                })
            }).then(x => x.json()).then(res => targetPlayer = res.data[0]?.id);
        }
        if (!targetPlayer) return;
        if (!username) username = await fetch(`https://users.roblox.com/v1/users/${targetPlayer}`).then(x => x.json()).then(res => res.name);

        return await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${targetPlayer}&size=150x150&format=Png&isCircular=true`).then(x => x.json()).then(res => {
            if (res.errors || res.data.length === 0) return targetPlayer = undefined;    // if userId doesn't exist
            return res.data[0];
        });
    }

    async function checkStatus() {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ msg: "Fetch_PresenceApi", content: targetPlayer }, (response) => {
                const statusId = response.userPresenceType;
                const statusPlaceId = response.placeId;
                let status = [];

                if (statusId < 2 || statusId === 3) {
                    status.push(statusId === 3 ? statusId : statusId + 1);
                } else {
                    status.push(4);
                    if (statusPlaceId !== null) {
                        if (statusPlaceId !== PLACE_ID) {
                            status[0] = 6;
                            status.push(response);
                            PROGRESS_BAR.style.width = "50%";
                        } else {
                            status[0] = 7;
                            status.push(response.gameId);
                        }
                        status.push(avatarImageUrl, username);
                    }
                }

                resolve(status);
            });
        });
    }

    async function fetchServers(cursor = "") {
        currentProgress = 0;

        do {
            if (cursor) await sleep(serverSizeMoreThan5 ? 20000 : 50);

            const servers = await fetch(`https://games.roblox.com/v1/games/${PLACE_ID}/servers/0?limit=100&cursor=${cursor}`, {
                /**
                 * omit: will return all players, but can only send 3 requests per minute
                 * include: only return 5 players (less likely to get rate limited)
                 */
                "credentials": serverSizeMoreThan5 ? "omit" : "include"
            }).then(response => response.json());

            const { nextPageCursor, data, errors } = servers;
            if (errors) {
                await sleep(serverSizeMoreThan5 ? 20000 : 1000);
                continue; // retry
            }

            for (let server of data) {
                for (let playerToken of server.playerTokens) {
                    allTokens.push({
                        requestId: server.id,
                        token: playerToken,
                        type: "AvatarHeadshot",
                        size: "150x150",
                        format: "png",
                        isCircular: true
                    });
                }
            }

            const userRequestId = await fetchTokens();
            if (userRequestId) return userRequestId;

            cursor = nextPageCursor;
            allTokens = [];
        } while (cursor);

        currentProgress = 100;
        return [5];
    }

    async function fetchTokens() {
        if (allTokens.length === 0) return [4];
        const foundUser = [avatarImageUrl, username];

        const chunkedTokens = splitTokensIntoChunks(allTokens);
        let redyToFetch = [];

        for (let i = 0; i < chunkedTokens.length; i++) {
            redyToFetch.push(chunkedTokens[i]);

            if (redyToFetch.length === 50 || i === (chunkedTokens.length - 1)) {
                const results = await Promise.all(redyToFetch.map(tokens => fetchThumbnails(tokens)));
                redyToFetch = [];

                if (results.some(found => found)) return foundUser;
            }
        }

        async function fetchThumbnails(tokens) {
            let attempts = 1
            while (attempts <= 3) {
                try {
                    const response = await fetch("https://thumbnails.roblox.com/v1/batch", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "Accept": "application/json" },
                        body: JSON.stringify(tokens)
                    }).then(x => x.json());
                    if (response.errors) throw response.errors;


                    const targetUserData = response.data.find(data => data.imageUrl === avatarImageUrl);
                    if (targetUserData) {
                        PROGRESS_BAR.style.width = "100%";

                        foundUser.unshift(targetUserData.requestId);
                        return true;
                    }

                    if (currentProgress !== 100) {
                        const newProgress = (tokens.length / activePlayersInGame) * 100;
                        PROGRESS_BAR.style.width = `${currentProgress += Number(newProgress.toFixed(5))}%`;
                    };
                    break;
                } catch (error) {
                    console.error(error);
                    await sleep(Number(`${attempts}000`));
                    console.log("[ERROR] Retrying...");
                    attempts++
                }
            }

            return false;
        }

        function splitTokensIntoChunks(array) {
            const result = [];
            for (let i = 0; i < array.length; i += 100) {
                // Slice the array into chunks of 100
                result.push(array.slice(i, i + 100));
            }
            return result;
        }
    }
}