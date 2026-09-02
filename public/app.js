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
  dialMover: null,
  connected: true
};

let toastTimer;
let dialSendTimer;
let dialInteracting = false;
let dialMoverTimer;

/*
  Who is moving the dial right now. Derived on the client from a timer rather
  than a server timestamp, so it never depends on the two clocks agreeing.
*/
function trackDialActivity(previous, room) {
  if (room.phase !== "guess") {
    clearTimeout(dialMoverTimer);
    state.dialMover = null;
    return;
  }
  const moved = room.dialMovedBy
    && (room.dialAngle !== previous.dialAngle || room.dialMovedBy !== previous.dialMovedBy);
  if (!moved) return;
  state.dialMover = room.dialMovedBy;
  clearTimeout(dialMoverTimer);
  dialMoverTimer = setTimeout(() => {
    state.dialMover = null;
    render();
  }, 1800);
}

function lockState(room = state.room) {
  const locked = room?.dialLocks || [];
  return {
    locked,
    lockedCount: locked.length,
    needed: room?.dialLocksNeeded || 1,
    total: room?.dialLockTotal || 0,
    mine: locked.includes(state.playerId)
  };
}

function dialGuessers(room) {
  return room.players.filter(
    (player) => player.team === room.activeTeam && player.id !== room.cluegiverId && player.connected
  );
}

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

function teamShort(team) {
  return team === "coral" ? "Coral" : "Cyan";
}

function initials(name) {
  return String(name || "?").split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function winningScore(room = state.room) {
  return room?.winningScore || 10;
}

function phaseLabel(phase) {
  return {
    lobby: "Lobby",
    clue: "Private clue",
    guess: "Place the dial",
    side: "Side vote",
    ready: "Ready to reveal",
    reveal: "Round result",
    finished: "Game over"
  }[phase] || phase;
}

function instruction(room) {
  const cluegiver = playerById(room.cluegiverId);
  const active = teamLabel(room.activeTeam);
  if (room.phase === "clue") return `${cluegiver?.name || "The clue-giver"} can see the hidden target and is choosing one clue.`;
  if (room.phase === "guess") {
    const mover = state.dialMover ? playerById(state.dialMover) : null;
    if (mover) return `${mover.name} is moving the dial.`;
    const { lockedCount, needed } = lockState(room);
    return `${active} is placing the shared dial — ${lockedCount} of ${needed} locks in.`;
  }
  if (room.phase === "side") return `The other team is betting whether the target is left or right of the dial.`;
  if (room.phase === "ready") return `Everyone is locked in. Reveal the target when the room is ready.`;
  if (room.phase === "reveal") return `The target is revealed and this round’s points are on the board.`;
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
    <path class="score-zone score-2" d="${sectorPath(targetAngle - 16, targetAngle - 9)}" />
    <path class="score-zone score-3" d="${sectorPath(targetAngle - 9, targetAngle - 4)}" />
    <path class="score-zone score-4" d="${sectorPath(targetAngle - 4, targetAngle + 4)}" />
    <path class="score-zone score-3" d="${sectorPath(targetAngle + 4, targetAngle + 9)}" />
    <path class="score-zone score-2" d="${sectorPath(targetAngle + 9, targetAngle + 16)}" />`;
  const concealed = targetAngle === null ? `
    <path class="conceal" d="${sectorPath(-80, 80)}" />
    <text class="conceal-text" x="320" y="101" text-anchor="middle">TARGET HIDDEN</text>` : "";

  return `<svg class="spectrum${compact ? " compact" : ""}" viewBox="0 0 640 350" role="img" aria-label="Spectrum dial">
    <path class="base" d="${sectorPath(-80, 80, 170, 252)}" />
    ${zones}
    ${concealed}
    <path class="inner-mask" d="M 0 321 H 640 V 350 H 0 Z" />
    ${ticks.join("")}
    <line class="needle" x1="320" y1="320" x2="${needle.x}" y2="${needle.y}" />
    <circle class="hub-outer" cx="320" cy="320" r="22" />
    <circle class="hub-inner" cx="320" cy="320" r="8" />
  </svg>`;
}

function logoHtml() {
  return `<span class="logo-mark" aria-hidden="true"><i></i><i></i><i></i></span><span class="brand-name">THE <strong>MIDDLE</strong></span>`;
}

function promptHtml(room) {
  if (!room.prompt) return "";
  return `<div class="prompt-card">
    <div class="pole"><small>Left</small><strong>${esc(room.prompt[0])}</strong></div>
    <div class="versus" aria-hidden="true">↔</div>
    <div class="pole"><small>Right</small><strong>${esc(room.prompt[1])}</strong></div>
  </div>`;
}

function scorebarHtml(room) {
  const goal = winningScore(room);
  return `<section class="scorebar" aria-label="Score — first to ${goal}">
    <div class="score-team coral${room.activeTeam === "coral" && room.phase !== "finished" ? " active" : ""}">
      <span class="team-signal"></span>
      <div class="score-copy"><small>Coral</small><strong>${room.scores.coral}<span> / ${goal}</span></strong></div>
      <div class="score-progress" aria-hidden="true"><i style="width:${Math.min(100, room.scores.coral / goal * 100)}%"></i></div>
    </div>
    <div class="round-chip"><small>Round</small><strong>${room.round || "—"}</strong></div>
    <div class="score-team cyan${room.activeTeam === "cyan" && room.phase !== "finished" ? " active" : ""}">
      <div class="score-copy"><small>Cyan</small><strong>${room.scores.cyan}<span> / ${goal}</span></strong></div>
      <span class="team-signal"></span>
      <div class="score-progress" aria-hidden="true"><i style="width:${Math.min(100, room.scores.cyan / goal * 100)}%"></i></div>
    </div>
  </section>`;
}

function compactScoreHtml(room) {
  return `<div class="compact-score" aria-label="Coral ${room.scores.coral}, Cyan ${room.scores.cyan}">
    <span class="coral">${room.scores.coral}</span><small>—</small><span class="cyan">${room.scores.cyan}</span>
  </div>`;
}

function topbarHtml(host = false) {
  return `<header class="topbar">
    <div class="brand-mini">${logoHtml()}</div>
    <div class="room-pill"><small>Room</small><strong class="room-code">${esc(state.room.code)}</strong><button class="button ghost small" data-copy-code>Copy code</button></div>
    <div class="top-actions">${host ? `<button class="button ghost small" data-copy-link>Copy join link</button><button class="button ghost small" data-reset>Return to lobby</button>` : ""}</div>
  </header>`;
}

function playerRows(players, hostControls = false) {
  if (!players.length) return `<div class="empty-team"><span>+</span><p>Waiting for players</p></div>`;
  return `<div class="player-list">${players.map((player) => `
    <div class="player-row ${player.team}${player.connected ? "" : " offline"}">
      <span class="avatar">${esc(initials(player.name))}</span>
      <span class="name">${esc(player.name)}</span>
      <small>${player.id === state.room.cluegiverId ? "Clue-giver" : player.connected ? "Ready" : "Away"}</small>
      ${hostControls ? `<button class="remove" data-remove-player="${player.id}" aria-label="Remove ${esc(player.name)}">×</button>` : ""}
    </div>`).join("")}</div>`;
}

function homeView() {
  const queryCode = new URLSearchParams(location.search).get("room") || "";
  if (queryCode) state.entryTab = "join";
  app.innerHTML = `<div class="home-shell">
    <header class="home-header"><div class="brand-mini">${logoHtml()}</div><div class="win-pill"><span></span> First team to 10 wins</div></header>
    <div class="home-layout">
      <section class="home-intro">
        <p class="eyebrow">A LIVE SOCIAL SPECTRUM GAME</p>
        <h1 class="wordmark"><span>FIND THE</span><strong>MIDDLE.</strong></h1>
        <p class="home-copy">One clue-giver privately sees a hidden target between two opposite ideas. Their team discusses one clue and places the dial; the other team bets left or right before the target is revealed.</p>
        <ol class="game-steps" aria-label="How the game works">
          <li><span>01</span><div><strong>See it</strong><small>One player sees the hidden target.</small></div></li>
          <li><span>02</span><div><strong>Clue it</strong><small>They give their team one clue.</small></div></li>
          <li><span>03</span><div><strong>Place it</strong><small>The team agrees where the dial belongs.</small></div></li>
          <li><span>04</span><div><strong>Reveal it</strong><small>Score up to 4. First to 10 wins.</small></div></li>
        </ol>
      </section>
      <section class="entry-card">
        <div class="tabs" role="tablist" aria-label="Join or host">
          <button class="tab ${state.entryTab === "join" ? "active" : ""}" role="tab" aria-selected="${state.entryTab === "join"}" data-tab="join">Join a game</button>
          <button class="tab ${state.entryTab === "host" ? "active" : ""}" role="tab" aria-selected="${state.entryTab === "host"}" data-tab="host">Host a game</button>
        </div>
        ${state.entryTab === "join" ? `<form class="entry-panel" id="join-form">
          <div class="entry-heading"><span class="step-number">01</span><div><p class="eyebrow">PLAYER PHONE</p><h2>Join the room</h2></div></div>
          <p>Enter the four-character code from the shared screen.</p>
          <div class="field"><label for="room-code">Room code</label><input class="input code" id="room-code" name="code" maxlength="4" inputmode="text" autocomplete="off" value="${esc(queryCode.toUpperCase())}" placeholder="ABCD" required /></div>
          <div class="field"><label for="player-name">Your name</label><input class="input" id="player-name" name="name" maxlength="24" autocomplete="nickname" placeholder="What should we call you?" required /></div>
          <button class="button block" type="submit">Join room <span>→</span></button>
        </form>` : `<div class="entry-panel">
          <div class="entry-heading"><span class="step-number">TV</span><div><p class="eyebrow">SHARED SCREEN</p><h2>Start a new room</h2></div></div>
          <p>Put this page on a TV or projector. Players join from their phones and choose teams.</p>
          <div class="host-note"><strong>4+</strong><span>players<br />minimum</span><strong>20</strong><span>players<br />maximum</span></div>
          <button class="button block" data-create-room>Create room <span>→</span></button>
        </div>`}
      </section>
    </div>
  </div>`;
}

function lobbyHostView() {
  const coral = state.room.players.filter((player) => player.team === "coral");
  const cyan = state.room.players.filter((player) => player.team === "cyan");
  const coralReady = coral.filter((player) => player.connected).length;
  const cyanReady = cyan.filter((player) => player.connected).length;
  const ready = coralReady >= 2 && cyanReady >= 2;
  const joinUrl = `${location.origin}${location.pathname}?room=${state.room.code}`;
  app.innerHTML = `<div class="shell">
    ${topbarHtml(true)}
    <section class="join-hero panel">
      <div class="join-copy"><p class="eyebrow">OPEN ON YOUR PHONES</p><h1>Join room <strong>${esc(state.room.code)}</strong></h1><p>${esc(joinUrl)}</p></div>
      <div class="join-tools">
        <div class="join-qr">
          <img src="/qr/${encodeURIComponent(state.room.code)}" alt="QR code to join room ${esc(state.room.code)}" width="150" height="150" />
          <div><small>Scan to join</small><strong>Open your camera</strong><span>No app needed</span></div>
        </div>
        <button class="button secondary" data-copy-link>Copy join link</button>
      </div>
    </section>
    <section class="lobby-heading"><div><p class="eyebrow">BUILD YOUR TEAMS</p><h2>${state.room.players.length} player${state.room.players.length === 1 ? "" : "s"} in the room</h2></div><div class="readiness${ready ? " ready" : ""}"><span></span>${ready ? "Ready to play" : "2 players needed on each team"}</div></section>
    <div class="lobby">
      <section class="panel team-panel coral"><div class="team-heading"><span class="swatch"></span><div><small>TEAM ONE</small><h2>Coral <span>${coralReady}</span></h2></div></div>${playerRows(coral, true)}</section>
      <section class="panel team-panel cyan"><div class="team-heading"><span class="swatch"></span><div><small>TEAM TWO</small><h2>Cyan <span>${cyanReady}</span></h2></div></div>${playerRows(cyan, true)}</section>
    </div>
    <footer class="lobby-actions"><p><strong>First to ${winningScore()} wins.</strong> Teams alternate clue-givers every round.</p><button class="button" data-start-game ${ready ? "" : "disabled"}>Start game <span>→</span></button></footer>
  </div>`;
}

function turnStepsHtml(room) {
  const order = ["clue", "guess", "side", "reveal"];
  const currentPhase = room.phase === "ready" ? "side" : room.phase;
  const currentIndex = order.indexOf(currentPhase);
  const labels = { clue: "Clue", guess: "Dial", side: "Side bet", reveal: "Reveal" };
  return `<ol class="turn-steps">${order.map((phase, index) => `<li class="${index < currentIndex ? "done" : index === currentIndex ? "current" : ""}"><span>${index < currentIndex ? "✓" : index + 1}</span><small>${labels[phase]}</small></li>`).join("")}</ol>`;
}

function dialPanelHtml(room) {
  const isGuessing = room.phase === "guess";
  const { locked, lockedCount, needed, total } = lockState(room);
  const mover = state.dialMover ? playerById(state.dialMover) : null;
  const guessers = dialGuessers(room);
  const chips = guessers.length
    ? guessers.map((player) => {
        const isLocked = locked.includes(player.id);
        const isMoving = !isLocked && state.dialMover === player.id;
        const label = isLocked ? "locked" : isMoving ? "moving" : "talking";
        return `<span class="lock-chip${isLocked ? " locked" : ""}${isMoving ? " moving" : ""}">${esc(player.name)}<small>${label}</small></span>`;
      }).join("")
    : `<span class="lock-chip">Nobody on the dial</span>`;

  let line = "The guess is committed.";
  if (isGuessing) {
    line = mover
      ? `${esc(mover.name)} is moving the dial.`
      : `Any ${needed} of ${total} can commit the guess.`;
  }

  return `<section class="panel dial-panel${isGuessing ? " active" : ""}">
    <div class="panel-title"><div><p class="eyebrow">${esc(teamShort(room.activeTeam))} TEAM</p><h2>Shared dial</h2></div><small>${isGuessing ? `${lockedCount}/${needed} locked` : "Locked"}</small></div>
    <div class="lock-list">${chips}</div>
    <p>${line}</p>
  </section>`;
}

function sideVoteHtml(room, voteValues) {
  const leftVotes = voteValues.filter((vote) => vote === "left").length;
  const rightVotes = voteValues.filter((vote) => vote === "right").length;
  const isVoting = ["side", "ready"].includes(room.phase);
  return `<section class="panel side-panel${isVoting ? " active" : ""}">
    <div class="panel-title"><div><p class="eyebrow">OTHER TEAM</p><h2>Side bet</h2></div><small>${voteValues.length} cast</small></div>
    <div class="vote-meter"><div><small>Left</small><strong>${leftVotes}</strong></div><span>or</span><div><small>Right</small><strong>${rightVotes}</strong></div></div>
    <p>${isVoting ? "Is the target left or right of the locked dial?" : "This opens after the active team locks its dial."}</p>
  </section>`;
}

function hostGameView() {
  const room = state.room;
  const coral = room.players.filter((player) => player.team === "coral");
  const cyan = room.players.filter((player) => player.team === "cyan");
  const voteValues = Object.values(room.sideVotes);
  const target = room.phase === "reveal" ? room.targetAngle : null;
  let action = `<div class="waiting-action"><span></span>${room.phase === "clue" ? "Waiting for the clue" : "Players control this round on their phones"}</div>`;
  if (["side", "ready"].includes(room.phase)) action = `<button class="button" data-reveal>Reveal target <span>→</span></button>`;
  if (room.phase === "reveal") action = `<button class="button" data-next-round>Next round <span>→</span></button>`;
  const result = room.roundResult ? `<div class="round-result">
    <div><small>${teamShort(room.activeTeam)} accuracy</small><strong>+${room.roundResult.activePoints}</strong></div>
    <div><small>${teamShort(room.roundResult.defendingTeam)} side bet</small><strong>+${room.roundResult.sidePoint}</strong></div>
  </div>` : "";

  app.innerHTML = `<div class="shell">
    ${topbarHtml(true)}
    ${scorebarHtml(room)}
    <div class="game-grid">
      <section class="panel stage">
        <div class="status-line"><div><p class="eyebrow">${esc(teamLabel(room.activeTeam))} · ROUND ${room.round}</p><h1>${esc(phaseLabel(room.phase))}</h1></div><span class="phase-chip">${esc(instruction(room))}</span></div>
        <div class="spectrum-wrap phase-${esc(room.phase)}">${spectrumSvg({ dialAngle: room.dialAngle, targetAngle: target })}</div>
        ${promptHtml(room)}
        ${room.clue ? `<div class="clue-card"><small>The clue</small><strong>${esc(room.clue)}</strong></div>` : ""}
        ${result}
        <div class="host-controls">${action}</div>
      </section>
      <aside class="sidebar">
        <section class="panel turn-panel"><div class="panel-title"><div><p class="eyebrow">ROUND FLOW</p><h2>What’s happening</h2></div></div>${turnStepsHtml(room)}</section>
        ${dialPanelHtml(room)}
        ${sideVoteHtml(room, voteValues)}
        <section class="panel roster-panel"><div class="panel-title"><h2>Teams</h2><small>${room.players.filter((player) => player.connected).length} online</small></div><div class="mini-rosters"><div><strong class="coral">Coral</strong>${playerRows(coral)}</div><div><strong class="cyan">Cyan</strong>${playerRows(cyan)}</div></div></section>
      </aside>
    </div>
  </div>`;
}

function lobbyPlayerView() {
  const player = me();
  const coralCount = state.room.players.filter((item) => item.team === "coral").length;
  const cyanCount = state.room.players.filter((item) => item.team === "cyan").length;
  app.innerHTML = `<div class="phone-shell">
    ${phoneTopbar(player)}
    <section class="panel phone-card hero">
      <p class="eyebrow">ROOM ${esc(state.room.code)} · LOBBY</p>
      <h1>Choose your team.</h1>
      <p>Pick a side now. You can swap until the host starts the game.</p>
      <div class="team-picker">
        <button class="team-choice coral${player.team === "coral" ? " selected" : ""}" data-team="coral"><span></span><strong>Coral</strong><small>${coralCount} player${coralCount === 1 ? "" : "s"}</small></button>
        <button class="team-choice cyan${player.team === "cyan" ? " selected" : ""}" data-team="cyan"><span></span><strong>Cyan</strong><small>${cyanCount} player${cyanCount === 1 ? "" : "s"}</small></button>
      </div>
      <div class="waiting-line"><span></span>Waiting for the host to start</div>
    </section>
  </div>`;
}

function phoneTopbar(player) {
  return `<header class="phone-topbar"><div class="brand-mini">${logoHtml()}</div>${state.room.phase !== "lobby" ? compactScoreHtml(state.room) : ""}<div class="identity ${player.team}"><span class="team-dot"></span><div><strong>${esc(player.name)}</strong><small>${esc(teamShort(player.team))}</small></div></div></header>`;
}

function waitingCard(title, copy) {
  return `<section class="panel phone-card hero"><p class="eyebrow">ROUND ${state.room.round} · ${esc(teamShort(state.room.activeTeam))} TURN</p><h1>${esc(title)}</h1><p>${esc(copy)}</p>${promptHtml(state.room)}${state.room.clue ? `<div class="clue-card"><small>The clue</small><strong>${esc(state.room.clue)}</strong></div>` : ""}<div class="waiting-line"><span></span>Follow the shared screen</div></section>`;
}

function cluegiverCard() {
  const room = state.room;
  return `<section class="panel phone-card">
    <div class="private-banner"><span>●</span> Private view — only you see the target</div>
    <p class="eyebrow">YOU ARE THE CLUE-GIVER</p><h1>Give them one clue.</h1><p>Help your team find the target without saying either end of the scale.</p>
    ${promptHtml(room)}
    <div class="private-scale">${spectrumSvg({ dialAngle: room.targetAngle ?? state.privateTarget ?? 0, targetAngle: room.targetAngle ?? state.privateTarget })}</div>
    <form id="clue-form"><div class="field"><label for="clue">Your clue</label><input class="input" id="clue" name="clue" maxlength="80" placeholder="Something that belongs here…" required /></div><button class="button block" type="submit">Send clue <span>→</span></button></form>
  </section>`;
}

function guesserCard(player) {
  const room = state.room;
  if (player.id === room.cluegiverId) {
    const { lockedCount, needed } = lockState(room);
    return waitingCard(
      "Keep a straight face.",
      `Your clue is live. Your team is placing the dial without you — ${lockedCount} of ${needed} locks in.`
    );
  }
  const { lockedCount, needed, total, mine } = lockState(room);
  const mover = state.dialMover && state.dialMover !== player.id ? playerById(state.dialMover) : null;
  const lockLabel = mine
    ? "Locked — tap to change your mind"
    : needed > 1
      ? `Lock my guess (${lockedCount} of ${needed})`
      : "Lock team guess";
  const helper = mover
    ? `${esc(mover.name)} is moving the dial right now.`
    : total > 1
      ? `Everyone shares this dial. It commits when ${needed} of ${total} of you lock — and moving it withdraws every lock.`
      : "You are the only one on the dial this round, so your lock commits the guess.";
  return `<section class="panel phone-card">
    <p class="eyebrow">YOUR TEAM IS GUESSING</p><h1>Where did they mean?</h1>
    ${promptHtml(room)}
    <div class="clue-card"><small>The clue</small><strong>${esc(room.clue)}</strong></div>
    <div class="dial-control"><div class="dial-labels"><span>${esc(room.prompt[0])}</span><span>${esc(room.prompt[1])}</span></div><input class="range" type="range" min="-80" max="80" step="1" value="${room.dialAngle}" aria-label="Set the team dial" data-dial /><div class="dial-value"><small>Dial position</small><strong>${Math.round(room.dialAngle)}</strong></div></div>
    ${dialCrewHtml(player)}
    <button class="button block${mine ? " secondary" : ""}" data-lock-dial aria-pressed="${mine}">${lockLabel}</button>
    <p class="helper-copy">${helper}</p>
  </section>`;
}

/*
  Who else is on the dial, and where each of them stands. This is the part that
  makes a shared control legible: you can see a teammate reaching for it, and
  you can see how close the team is to committing.
*/
function dialCrewHtml(player) {
  const room = state.room;
  const { locked } = lockState(room);
  const crew = dialGuessers(room).filter((item) => item.id !== player.id);
  if (!crew.length) return "";
  return `<div class="lock-list">${crew.map((item) => {
    const isLocked = locked.includes(item.id);
    const isMoving = !isLocked && state.dialMover === item.id;
    const label = isLocked ? "locked" : isMoving ? "moving it" : "talking";
    return `<span class="lock-chip${isLocked ? " locked" : ""}${isMoving ? " moving" : ""}">${esc(item.name)}<small>${label}</small></span>`;
  }).join("")}</div>`;
}

function sideVoteCard(player) {
  const room = state.room;
  if (player.team === room.activeTeam) return waitingCard("Dial locked.", "The other team is deciding whether the hidden target sits left or right of your guess.");
  const currentVote = room.sideVotes[player.id];
  return `<section class="panel phone-card hero">
    <p class="eyebrow">STEAL A BONUS POINT</p><h1>Which side?</h1><p>Is the hidden target left or right of the locked dial?</p>
    ${promptHtml(room)}
    <div class="clue-card"><small>The clue</small><strong>${esc(room.clue)}</strong></div>
    <div class="side-buttons"><button class="side-button${currentVote === "left" ? " selected" : ""}" data-side="left"><span>←</span><strong>Left</strong></button><button class="side-button${currentVote === "right" ? " selected" : ""}" data-side="right"><strong>Right</strong><span>→</span></button></div>
    <p class="helper-copy">${currentVote ? "Vote received. You can change it until the reveal." : "Your team’s majority answer is used."}</p>
  </section>`;
}

function resultCard(player) {
  const room = state.room;
  const result = room.roundResult;
  const ownPoints = player.team === room.activeTeam ? result.activePoints : result.sidePoint;
  return `<section class="panel phone-card">
    <p class="eyebrow">TARGET REVEALED</p><h1>${ownPoints ? `Your team scores ${ownPoints}.` : "No points this round."}</h1>
    <div class="private-scale">${spectrumSvg({ dialAngle: room.dialAngle, targetAngle: room.targetAngle })}</div>
    ${promptHtml(room)}
    <div class="clue-card"><small>The clue</small><strong>${esc(room.clue)}</strong></div>
    <div class="result-strip"><div class="coral"><small>Coral</small><strong>${room.scores.coral}</strong></div><div class="cyan"><small>Cyan</small><strong>${room.scores.cyan}</strong></div></div>
    <div class="waiting-line"><span></span>Waiting for the next round</div>
  </section>`;
}

function hostFinishedView() {
  const room = state.room;
  const winner = teamShort(room.winner);
  app.innerHTML = `<div class="shell">
    ${topbarHtml(true)}
    ${scorebarHtml(room)}
    <section class="winner-card panel ${room.winner}">
      <div class="winner-burst" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
      <p class="eyebrow">GAME OVER · ROUND ${room.round}</p>
      <div class="winner-mark"><span></span></div>
      <h1>${esc(winner)} wins.</h1>
      <p>First to ${winningScore(room)} with a clear lead. That’s the middle found.</p>
      <div class="final-score"><div><small>Coral</small><strong>${room.scores.coral}</strong></div><span>—</span><div><small>Cyan</small><strong>${room.scores.cyan}</strong></div></div>
      <div class="winner-actions"><button class="button" data-play-again>Play again <span>↻</span></button><button class="button secondary" data-reset>Change teams</button></div>
    </section>
  </div>`;
}

function playerFinishedView(player) {
  const room = state.room;
  const won = player.team === room.winner;
  return `<div class="phone-shell">${phoneTopbar(player)}<section class="winner-card phone-winner panel ${room.winner}">
    <p class="eyebrow">GAME OVER</p><div class="winner-mark"><span></span></div>
    <h1>${won ? "Your team wins!" : `${teamShort(room.winner)} wins.`}</h1>
    <p>${won ? "You found the middle first." : "Good read. Time for the rematch?"}</p>
    <div class="final-score"><div><small>Coral</small><strong>${room.scores.coral}</strong></div><span>—</span><div><small>Cyan</small><strong>${room.scores.cyan}</strong></div></div>
    <div class="waiting-line"><span></span>Waiting for the host</div>
  </section></div>`;
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
  if (state.role === "host") {
    if (state.room.phase === "lobby") return lobbyHostView();
    if (state.room.phase === "finished") return hostFinishedView();
    return hostGameView();
  }
  if (state.role === "player") {
    if (state.room.phase === "lobby") return lobbyPlayerView();
    if (state.room.phase === "finished") return app.innerHTML = playerFinishedView(me());
    return playerGameView();
  }
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
  if (event.target.closest("[data-play-again]")) await emit("play-again", { code: state.room.code });
  if (event.target.closest("[data-lock-dial]")) {
    clearTimeout(dialSendTimer);
    const dial = document.querySelector("[data-dial]");
    const pending = dial ? Number(dial.value) : null;
    /*
      Only flush the slider if it actually differs from the committed position.
      A pointless set-dial would withdraw every teammate's lock on the way in.
    */
    if (pending !== null && pending !== state.room.dialAngle) {
      await emit("set-dial", { code: state.room.code, angle: pending });
    }
    const response = await emit("lock-dial", { code: state.room.code });
    if (response.ok) {
      if (response.advanced) showToast("Team guess locked in.");
      else if (response.locked) {
        const short = Math.max(0, response.needed - response.lockedCount);
        showToast(short === 1 ? "Locked. One more teammate to go." : `Locked. Waiting for ${short} more.`);
      } else {
        showToast("Lock withdrawn.");
      }
    }
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
    if (confirm("Return everyone to the lobby and reset the scores?")) await emit("reset-game", { code: state.room.code });
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
  const label = document.querySelector(".dial-value strong");
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
    const previous = state.room;
    state.room = room;
    trackDialActivity(previous, room);
    const hadLock = (previous.dialLocks || []).includes(state.playerId);
    const hasLock = (room.dialLocks || []).includes(state.playerId);
    if (previous.phase === "guess" && room.phase === "guess" && hadLock && !hasLock) {
      showToast("The dial moved, so your lock was withdrawn.");
    }
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
