/* global io */
const socket = io();
const app = document.querySelector("#app");
const toast = document.querySelector("#toast");

const state = {
  screen: "home",
  entryTab: "join",
  role: null,
  room: null,
  playerId: null,
  playerToken: null,
  hostToken: null,
  privateTarget: null,
  connected: true
};

let toastTimer;
let dialSendTimer;
let dialInteracting = false;

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message, isError = false) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = `toast show${isError ? " error" : ""}`;
  toastTimer = setTimeout(() => { toast.className = "toast"; }, 3200);
}

function emit(eventName, payload = {}) {
  return new Promise((resolve) => {
    socket.emit(eventName, payload, (response) => {
      if (!response?.ok && response?.error) showToast(response.error, true);
      resolve(response || { ok: false, error: "No response from server." });
    });
  });
}

function playerById(id) {
  return state.room?.players.find((player) => player.id === id);
}

function me() {
  return playerById(state.playerId);
}

function teamLabel(team) {
  return team === "coral" ? "Coral Team" : "Cyan Team";
}

function initials(name) {
  return String(name || "?").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function phaseLabel(phase) {
  return {
    lobby: "Lobby",
    clue: "Private clue",
    guess: "Place the dial",
    side: "Side vote",
    ready: "Ready to reveal",
    reveal: "Result"
  }[phase] || phase;
}

function instruction(room) {
  const cluegiver = playerById(room.cluegiverId);
  const active = teamLabel(room.activeTeam);
  if (room.phase === "clue") return `${cluegiver?.name || "The clue-giver"} is studying the hidden target and writing a clue.`;
  if (room.phase === "guess") return `${active} is moving the dial. Talk it through, then lock the final position.`;
  if (room.phase === "side") return `The opposing team is voting: is the hidden target left or right of the dial?`;
  if (room.phase === "ready") return `Both teams are locked in. The host can reveal the target.`;
  if (room.phase === "reveal") return `Target revealed — points have been added automatically.`;
  return "Players join on their phones using the room code.";
}

function polar(angle, radius = 244, cx = 320, cy = 320) {
  const radians = angle * Math.PI / 180;
  return { x: cx + radius * Math.sin(radians), y: cy - radius * Math.cos(radians) };
}

function sectorPath(startAngle, endAngle, innerRadius = 174, outerRadius = 250) {
  const outerStart = polar(startAngle, outerRadius);
  const outerEnd = polar(endAngle, outerRadius);
  const innerEnd = polar(endAngle, innerRadius);
  const innerStart = polar(startAngle, innerRadius);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    "Z"
  ].join(" ");
}

function spectrumSvg({ dialAngle = 0, targetAngle = null, compact = false } = {}) {
  const needle = polar(dialAngle, 218);
  const ticks = [];
  for (let angle = -80; angle <= 80; angle += 5) {
    const major = angle % 20 === 0;
    const from = polar(angle, major ? 258 : 262);
    const to = polar(angle, major ? 279 : 273);
    ticks.push(`<line class="tick${major ? " major" : ""}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" />`);
  }
  const zones = targetAngle === null ? "" : `
    <path class="score-2" d="${sectorPath(targetAngle - 16, targetAngle - 9)}" />
    <path class="score-3" d="${sectorPath(targetAngle - 9, targetAngle - 4)}" />
    <path class="score-4" d="${sectorPath(targetAngle - 4, targetAngle + 4)}" />
    <path class="score-3" d="${sectorPath(targetAngle + 4, targetAngle + 9)}" />
    <path class="score-2" d="${sectorPath(targetAngle + 9, targetAngle + 16)}" />`;
  const concealed = targetAngle === null ? `
    <path class="conceal" d="${sectorPath(-80, 80)}" />
    <text class="conceal-text" x="320" y="91" text-anchor="middle">TARGET CONCEALED</text>` : "";

  return `<svg class="spectrum${compact ? " compact" : ""}" viewBox="0 0 640 350" role="img" aria-label="Spectrum dial">
    <path class="base" d="${sectorPath(-80, 80, 170, 252)}" />
    ${zones}
    ${concealed}
    <path class="inner-mask" d="M 0 321 H 640 V 350 H 0 Z" />
    ${ticks.join("")}
    <line class="needle" x1="320" y1="320" x2="${needle.x}" y2="${needle.y}" />
    <circle class="hub-outer" cx="320" cy="320" r="21" />
    <circle class="hub-inner" cx="320" cy="320" r="8" />
  </svg>`;
}

function promptHtml(room) {
  if (!room.prompt) return "";
  return `<div class="prompt-card">
    <div class="pole">${esc(room.prompt[0])}</div>
    <div class="versus">TO</div>
    <div class="pole">${esc(room.prompt[1])}</div>
  </div>`;
}

function scorebarHtml(room) {
  return `<div class="scorebar">
    <div class="score-team coral${room.activeTeam === "coral" ? " active" : ""}">
      <span class="dot"></span><div><strong>${room.scores.coral}</strong><small>Coral team</small></div>
    </div>
    <div class="round-chip"><strong>${room.round || "—"}</strong>Round</div>
    <div class="score-team cyan${room.activeTeam === "cyan" ? " active" : ""}">
      <div><strong>${room.scores.cyan}</strong><small>Cyan team</small></div><span class="dot"></span>
    </div>
  </div>`;
}

function topbarHtml(host = false) {
  return `<header class="topbar">
    <div class="brand-mini">THE <span>MIDDLE</span></div>
    <div class="room-pill"><small>Room</small><strong class="room-code">${esc(state.room.code)}</strong><button class="button ghost" data-copy-code>Copy</button></div>
    <div class="top-actions">${host ? `<button class="button ghost" data-copy-link>Join link</button><button class="button ghost" data-reset>Reset</button>` : ""}</div>
  </header>`;
}

function playerRows(players, hostControls = false) {
  if (!players.length) return `<p class="instruction">Waiting for players…</p>`;
  return `<div class="player-list">${players.map((player) => `
    <div class="player-row ${player.team}${player.connected ? "" : " offline"}">
      <span class="avatar">${esc(initials(player.name))}</span>
      <span class="name">${esc(player.name)}</span>
      <small>${player.id === state.room.cluegiverId ? "Clue" : player.connected ? "Online" : "Away"}</small>
      ${hostControls ? `<button class="remove" data-remove-player="${player.id}" aria-label="Remove ${esc(player.name)}">×</button>` : ""}
    </div>`).join("")}</div>`;
}

function homeView() {
  const queryCode = new URLSearchParams(location.search).get("room") || "";
  if (queryCode) state.entryTab = "join";
  app.innerHTML = `<div class="shell home">
    <section>
      <p class="eyebrow">A LIVE SOCIAL SPECTRUM GAME</p>
      <h1 class="wordmark"><span>THE</span><span>MIDDLE</span></h1>
      <p class="home-copy">Players split into two teams.<br/>
      Each round, one player becomes the clue-giver and privately sees a hidden target somewhere between two opposite ideas.<br/>
      They give their team one clue, and their teammates discuss it before placing the shared dial where they think the target lies.<br/>
      Once the dial is locked, the opposing team predicts whether the real target is to its left or right.<br/> 
      The target is then revealed:<br/> 
      the active team earns up to four points for accuracy, while the opposing team can earn a bonus point for predicting the correct side.<br/> 
      <br/>The teams then swap roles and a new clue-giver takes over.</p>
      <div class="home-art" aria-hidden="true"><div class="arc"></div><div class="needle"></div></div>
    </section>
    <section class="entry-card">
      <div class="tabs">
        <button class="tab ${state.entryTab === "join" ? "active" : ""}" data-tab="join">Join game</button>
        <button class="tab ${state.entryTab === "host" ? "active" : ""}" data-tab="host">Host game</button>
      </div>
      ${state.entryTab === "join" ? `<form class="entry-panel" id="join-form">
        <h2>Join the room</h2><p>Enter the code on the shared screen. You’ll get your role privately.</p>
        <div class="field"><label for="room-code">Room code</label><input class="input code" id="room-code" name="code" maxlength="4" autocomplete="off" value="${esc(queryCode.toUpperCase())}" required /></div>
        <div class="field"><label for="player-name">Your name</label><input class="input" id="player-name" name="name" maxlength="24" autocomplete="nickname" required /></div>
        <button class="button block" type="submit">Join room →</button>
      </form>` : `<div class="entry-panel">
        <h2>Put this on the big screen</h2><p>Create a room, then let everyone else join from their phones. Four players minimum.</p>
        <button class="button block" data-create-room>Create room →</button>
      </div>`}
    </section>
  </div>`;
}

function lobbyHostView() {
  const coral = state.room.players.filter((player) => player.team === "coral");
  const cyan = state.room.players.filter((player) => player.team === "cyan");
  const ready = coral.filter((p) => p.connected).length >= 2 && cyan.filter((p) => p.connected).length >= 2;
  const joinUrl = `${location.origin}${location.pathname}?room=${state.room.code}`;
  app.innerHTML = `<div class="shell">
    ${topbarHtml(true)}
    <section class="panel stage">
      <div class="status-line"><h1>Build your teams</h1><span class="phase-chip">Lobby</span></div>
      <p class="instruction">Players choose a side on their phones. You need at least two connected players on each team.</p>
      <div class="lobby">
        <section class="panel team-panel"><div class="team-heading coral"><span class="swatch"></span><h2>Coral Team · ${coral.length}</h2></div>${playerRows(coral, true)}</section>
        <section class="panel team-panel"><div class="team-heading cyan"><span class="swatch"></span><h2>Cyan Team · ${cyan.length}</h2></div>${playerRows(cyan, true)}</section>
        <div class="lobby-actions"><p>Join at</p><div class="join-link">${esc(joinUrl)}</div><button class="button" data-start-game ${ready ? "" : "disabled"}>Start game →</button></div>
      </div>
    </section>
  </div>`;
}

function hostGameView() {
  const room = state.room;
  const coral = room.players.filter((player) => player.team === "coral");
  const cyan = room.players.filter((player) => player.team === "cyan");
  const voteValues = Object.values(room.sideVotes);
  const leftVotes = voteValues.filter((vote) => vote === "left").length;
  const rightVotes = voteValues.filter((vote) => vote === "right").length;
  const target = room.phase === "reveal" ? room.targetAngle : null;
  let action = "";
  if (["side", "ready"].includes(room.phase)) action = `<button class="button" data-reveal>Reveal target</button>`;
  if (room.phase === "reveal") action = `<button class="button" data-next-round>Next round →</button>`;
  const result = room.roundResult ? `<div class="result-strip">
    <div class="result-box"><strong>+${room.roundResult.activePoints}</strong><small>${teamLabel(room.activeTeam)}</small></div>
    <div class="result-box"><strong>+${room.roundResult.sidePoint}</strong><small>${teamLabel(room.roundResult.defendingTeam)} side bet</small></div>
  </div>` : "";

  app.innerHTML = `<div class="shell">
    ${topbarHtml(true)}
    ${scorebarHtml(room)}
    <div class="game-grid">
      <section class="panel stage">
        <div class="status-line"><h1>${esc(teamLabel(room.activeTeam))} are up</h1><span class="phase-chip">${esc(phaseLabel(room.phase))}</span></div>
        <p class="instruction">${esc(instruction(room))}</p>
        <div class="spectrum-wrap">${spectrumSvg({ dialAngle: room.dialAngle, targetAngle: target })}</div>
        ${promptHtml(room)}
        ${room.clue ? `<div class="clue-card"><small>The clue</small><strong>${esc(room.clue)}</strong></div>` : ""}
        ${result}
        <div class="host-controls">${action}</div>
      </section>
      <aside class="sidebar">
        <section class="panel"><div class="panel-title"><h2>Coral team</h2><small>${coral.filter((p) => p.connected).length} online</small></div>${playerRows(coral)}</section>
        <section class="panel"><div class="panel-title"><h2>Cyan team</h2><small>${cyan.filter((p) => p.connected).length} online</small></div>${playerRows(cyan)}</section>
        <section class="panel"><div class="panel-title"><h2>Side vote</h2><small>${voteValues.length} cast</small></div><div class="vote-meter"><div><strong>${leftVotes}</strong><small>Left</small></div><div><strong>${rightVotes}</strong><small>Right</small></div></div></section>
      </aside>
    </div>
  </div>`;
}

function lobbyPlayerView() {
  const player = me();
  const coralCount = state.room.players.filter((p) => p.team === "coral").length;
  const cyanCount = state.room.players.filter((p) => p.team === "cyan").length;
  app.innerHTML = `<div class="phone-shell">
    ${phoneTopbar(player)}
    <section class="panel phone-card hero">
      <p class="eyebrow">ROOM ${esc(state.room.code)}</p>
      <h1>Choose your side.</h1>
      <p>You can swap teams until the host starts. Each side needs at least two players.</p>
      <div class="team-picker">
        <button class="team-choice coral${player.team === "coral" ? " selected" : ""}" data-team="coral"><strong>Coral Team</strong><small>${coralCount} player${coralCount === 1 ? "" : "s"}</small></button>
        <button class="team-choice cyan${player.team === "cyan" ? " selected" : ""}" data-team="cyan"><strong>Cyan Team</strong><small>${cyanCount} player${cyanCount === 1 ? "" : "s"}</small></button>
      </div>
      <p>Waiting for the host to start…</p>
    </section>
  </div>`;
}

function phoneTopbar(player) {
  return `<header class="phone-topbar"><div class="brand-mini">THE <span>MIDDLE</span></div><div class="identity ${player.team}"><span class="team-dot"></span><div><strong>${esc(player.name)}</strong><small>${esc(teamLabel(player.team))}</small></div></div></header>`;
}

function waitingCard(title, copy) {
  return `<section class="panel phone-card hero"><p class="eyebrow">ROUND ${state.room.round}</p><h1>${esc(title)}</h1><p>${esc(copy)}</p>${promptHtml(state.room)}${state.room.clue ? `<div class="clue-card"><small>The clue</small><strong>${esc(state.room.clue)}</strong></div>` : ""}</section>`;
}

function cluegiverCard() {
  const room = state.room;
  return `<section class="panel phone-card">
    <div class="private-banner">Private — only you can see this target</div>
    <p class="eyebrow">YOU ARE THE CLUE-GIVER</p><h1>Connect the target.</h1>
    ${promptHtml(room)}
    <div class="private-scale">${spectrumSvg({ dialAngle: room.targetAngle ?? state.privateTarget ?? 0, targetAngle: room.targetAngle ?? state.privateTarget })}</div>
    <form id="clue-form"><div class="field"><label for="clue">Give one clue</label><input class="input" id="clue" name="clue" maxlength="80" placeholder="Something that belongs here…" required /></div><button class="button block" type="submit">Send clue →</button></form>
  </section>`;
}

function guesserCard(player) {
  const room = state.room;
  const isCluegiver = player.id === room.cluegiverId;
  if (isCluegiver) return waitingCard("Keep a straight face.", "Your clue is live. Your teammates must place the dial without any more help from you.");
  return `<section class="panel phone-card">
    <p class="eyebrow">YOUR TEAM IS GUESSING</p><h1>Where did they mean?</h1>
    ${promptHtml(room)}
    <div class="clue-card"><small>The clue</small><strong>${esc(room.clue)}</strong></div>
    <div class="dial-control"><div class="dial-labels"><span>${esc(room.prompt[0])}</span><span>${esc(room.prompt[1])}</span></div><input class="range" type="range" min="-80" max="80" step="1" value="${room.dialAngle}" data-dial /><div class="dial-value">Dial: <span>${Math.round(room.dialAngle)}</span></div></div>
    <button class="button block" data-lock-dial>Lock team guess</button>
    <p>Everyone on your team can move the shared dial. Talk before you lock it.</p>
  </section>`;
}

function sideVoteCard(player) {
  const room = state.room;
  if (player.team === room.activeTeam) return waitingCard("Dial locked.", "The other team is deciding whether the hidden target sits left or right of your guess.");
  const currentVote = room.sideVotes[player.id];
  return `<section class="panel phone-card hero">
    <p class="eyebrow">STEAL A BONUS POINT</p><h1>Which side?</h1><p>Is the hidden target to the left or right of the locked dial?</p>
    ${promptHtml(room)}
    <div class="clue-card"><small>The clue</small><strong>${esc(room.clue)}</strong></div>
    <div class="side-buttons"><button class="side-button${currentVote === "left" ? " selected" : ""}" data-side="left">← Left</button><button class="side-button${currentVote === "right" ? " selected" : ""}" data-side="right">Right →</button></div>
    <p>${currentVote ? "Vote received. You can change it until the reveal." : "Your team’s majority answer is used."}</p>
  </section>`;
}

function resultCard(player) {
  const room = state.room;
  const result = room.roundResult;
  const ownPoints = player.team === room.activeTeam ? result.activePoints : result.sidePoint;
  return `<section class="panel phone-card">
    <p class="eyebrow">TARGET REVEALED</p><h1>${ownPoints ? `Your team gets ${ownPoints}!` : "No points this time."}</h1>
    <div class="private-scale">${spectrumSvg({ dialAngle: room.dialAngle, targetAngle: room.targetAngle })}</div>
    ${promptHtml(room)}
    <div class="clue-card"><small>The clue</small><strong>${esc(room.clue)}</strong></div>
    <div class="result-strip"><div class="result-box"><strong>${room.scores.coral}</strong><small>Coral total</small></div><div class="result-box"><strong>${room.scores.cyan}</strong><small>Cyan total</small></div></div>
    <p>Waiting for the host to begin the next round.</p>
  </section>`;
}

function playerGameView() {
  const player = me();
  const room = state.room;
  let content;
  if (room.phase === "clue") content = player.id === room.cluegiverId ? cluegiverCard() : waitingCard(`${playerById(room.cluegiverId)?.name || "Your clue-giver"} is thinking…`, "The target is private. Wait for their clue.");
  else if (room.phase === "guess") content = player.team === room.activeTeam ? guesserCard(player) : waitingCard("Read the room.", "The other team is placing its dial. You’ll soon predict which side missed the target.");
  else if (["side", "ready"].includes(room.phase)) content = sideVoteCard(player);
  else content = resultCard(player);

  app.innerHTML = `<div class="phone-shell">${phoneTopbar(player)}${!room.hostConnected ? `<div class="connection-warning">The host is reconnecting…</div>` : ""}${content}</div>`;
}

function render() {
  if (!state.room || state.screen === "home") return homeView();
  if (state.role === "host") return state.room.phase === "lobby" ? lobbyHostView() : hostGameView();
  if (state.role === "player") return state.room.phase === "lobby" ? lobbyPlayerView() : playerGameView();
}

async function createRoom() {
  const response = await emit("create-room");
  if (!response.ok) return;
  state.role = "host";
  state.screen = "room";
  state.room = response.room;
  state.hostToken = response.hostToken;
  sessionStorage.setItem("middle-host", JSON.stringify({ code: response.code, hostToken: response.hostToken }));
  history.replaceState({}, "", `${location.pathname}?host=${response.code}`);
  render();
}

async function joinRoom(code, name) {
  const saved = JSON.parse(localStorage.getItem(`middle-player-${code}`) || "null");
  const response = await emit("join-room", { code, name, playerToken: saved?.playerToken });
  if (!response.ok) return;
  state.role = "player";
  state.screen = "room";
  state.room = response.room;
  state.playerId = response.playerId;
  state.playerToken = response.playerToken;
  localStorage.setItem(`middle-player-${response.room.code}`, JSON.stringify({ playerToken: response.playerToken, name }));
  history.replaceState({}, "", `${location.pathname}?room=${response.room.code}`);
  render();
}

document.addEventListener("click", async (event) => {
  const tab = event.target.closest("[data-tab]");
  if (tab) { state.entryTab = tab.dataset.tab; render(); return; }
  if (event.target.closest("[data-create-room]")) return createRoom();

  const team = event.target.closest("[data-team]");
  if (team) await emit("choose-team", { code: state.room.code, team: team.dataset.team });

  const remove = event.target.closest("[data-remove-player]");
  if (remove) await emit("remove-player", { code: state.room.code, playerId: remove.dataset.removePlayer });

  if (event.target.closest("[data-start-game]")) await emit("start-game", { code: state.room.code });
  if (event.target.closest("[data-lock-dial]")) {
    clearTimeout(dialSendTimer);
    const dial = document.querySelector("[data-dial]");
    if (dial) await emit("set-dial", { code: state.room.code, angle: Number(dial.value) });
    await emit("lock-dial", { code: state.room.code });
  }
  if (event.target.closest("[data-reveal]")) await emit("reveal-round", { code: state.room.code });
  if (event.target.closest("[data-next-round]")) await emit("next-round", { code: state.room.code });

  const side = event.target.closest("[data-side]");
  if (side) await emit("submit-side", { code: state.room.code, side: side.dataset.side });

  if (event.target.closest("[data-copy-code]")) {
    await navigator.clipboard.writeText(state.room.code);
    showToast("Room code copied.");
  }
  if (event.target.closest("[data-copy-link]")) {
    await navigator.clipboard.writeText(`${location.origin}${location.pathname}?room=${state.room.code}`);
    showToast("Join link copied.");
  }
  if (event.target.closest("[data-reset]")) {
    if (confirm("Reset scores and return everyone to the lobby?")) await emit("reset-game", { code: state.room.code });
  }
});

document.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  if (form.id === "join-form") {
    const data = new FormData(form);
    await joinRoom(String(data.get("code")).toUpperCase(), String(data.get("name")));
  }
  if (form.id === "clue-form") {
    const data = new FormData(form);
    await emit("submit-clue", { code: state.room.code, clue: data.get("clue") });
  }
});

document.addEventListener("input", (event) => {
  if (!event.target.matches("[data-dial]")) return;
  const value = Number(event.target.value);
  const label = document.querySelector(".dial-value span");
  if (label) label.textContent = Math.round(value);
  clearTimeout(dialSendTimer);
  dialSendTimer = setTimeout(() => emit("set-dial", { code: state.room.code, angle: value }), 45);
});

document.addEventListener("pointerdown", (event) => {
  if (event.target.matches("[data-dial]")) dialInteracting = true;
});

document.addEventListener("pointerup", (event) => {
  if (event.target.matches("[data-dial]")) dialInteracting = false;
});

socket.on("room-state", (room) => {
  if (state.room && room.code === state.room.code) {
    state.room = room;
    if (room.phase !== "clue") state.privateTarget = null;
    if (!(dialInteracting && room.phase === "guess")) render();
  }
});

socket.on("private-target", (payload) => {
  if (state.room?.code === payload.roomCode) {
    state.privateTarget = payload.targetAngle;
    render();
  }
});

socket.on("removed-from-room", () => {
  if (state.room) localStorage.removeItem(`middle-player-${state.room.code}`);
  Object.assign(state, { screen: "home", role: null, room: null, playerId: null, playerToken: null, privateTarget: null });
  history.replaceState({}, "", location.pathname);
  showToast("The host removed you from the room.", true);
  render();
});

socket.on("disconnect", () => {
  state.connected = false;
  showToast("Connection lost — trying to reconnect…", true);
});

socket.on("connect", async () => {
  const wasDisconnected = !state.connected;
  state.connected = true;
  if (!wasDisconnected || !state.room) return;
  if (state.role === "host") {
    const response = await emit("host-rejoin", { code: state.room.code, hostToken: state.hostToken });
    if (response.ok) state.room = response.room;
  } else if (state.role === "player") {
    const response = await emit("join-room", { code: state.room.code, name: me()?.name, playerToken: state.playerToken });
    if (response.ok) state.room = response.room;
  }
  render();
});

const hostQuery = new URLSearchParams(location.search).get("host");
const savedHost = JSON.parse(sessionStorage.getItem("middle-host") || "null");
if (hostQuery && savedHost?.code === hostQuery) {
  socket.on("connect", async () => {
    const response = await emit("host-rejoin", savedHost);
    if (response.ok) {
      Object.assign(state, { screen: "room", role: "host", room: response.room, hostToken: savedHost.hostToken });
      render();
    }
  });
}

render();
