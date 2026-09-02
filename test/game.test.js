const test = require("node:test");
const assert = require("node:assert/strict");
const { io: Client } = require("socket.io-client");
const { createGameServer } = require("../server");
const { createRoom, publicRoom, scoreRound, drawPrompt, resetMatch, PROMPTS } = require("../game-engine");

function call(socket, event, payload = {}) {
  return new Promise((resolve) => socket.emit(event, payload, resolve));
}

function waitFor(socket, event, predicate = () => true, timeout = 1500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeout);
    function handler(payload) {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    }
    socket.on(event, handler);
  });
}

test("a full multiplayer round keeps the target private and scores the reveal", async (context) => {
  const game = createGameServer();
  await new Promise((resolve) => game.httpServer.listen(0, "127.0.0.1", resolve));
  const { port } = game.httpServer.address();
  const url = `http://127.0.0.1:${port}`;
  const sockets = [];
  context.after(async () => {
    for (const socket of sockets) socket.close();
    game.io.close();
    await new Promise((resolve) => game.httpServer.close(resolve));
  });

  function connect() {
    const socket = Client(url, { transports: ["websocket"], forceNew: true });
    sockets.push(socket);
    return new Promise((resolve) => socket.on("connect", () => resolve(socket)));
  }

  const host = await connect();
  const created = await call(host, "create-room");
  assert.equal(created.ok, true);
  assert.match(created.code, /^[A-Z2-9]{4}$/);

  const players = [];
  for (const name of ["Ada", "Bo", "Cy", "Di"]) {
    const socket = await connect();
    const joined = await call(socket, "join-room", { code: created.code, name });
    assert.equal(joined.ok, true);
    players.push({ socket, ...joined });
  }

  assert.equal((await call(players[0].socket, "choose-team", { code: created.code, team: "coral" })).ok, true);
  assert.equal((await call(players[1].socket, "choose-team", { code: created.code, team: "coral" })).ok, true);
  assert.equal((await call(players[2].socket, "choose-team", { code: created.code, team: "cyan" })).ok, true);
  assert.equal((await call(players[3].socket, "choose-team", { code: created.code, team: "cyan" })).ok, true);

  const privateTargetPromise = Promise.race(players.map(({ socket }) =>
    waitFor(socket, "private-target").then((payload) => ({ socket, payload }))
  ));
  assert.equal((await call(host, "start-game", { code: created.code })).ok, true);
  const privateMessage = await privateTargetPromise;
  assert.equal(typeof privateMessage.payload.targetAngle, "number");

  const room = game.rooms.get(created.code);
  const publicState = require("../game-engine").publicRoom(room);
  assert.equal(publicState.targetAngle, null);
  assert.equal(room.phase, "clue");

  const cluegiver = players.find((player) => player.playerId === room.cluegiverId);
  assert.ok(cluegiver);
  assert.equal((await call(cluegiver.socket, "submit-clue", { code: room.code, clue: "A medium-sized celebration" })).ok, true);
  assert.equal(room.phase, "guess");

  const teammate = players.find((player) => {
    const stored = room.players.get(player.playerId);
    return stored.team === room.activeTeam && stored.id !== room.cluegiverId;
  });
  assert.equal((await call(teammate.socket, "set-dial", { code: room.code, angle: room.targetAngle })).ok, true);
  assert.equal((await call(teammate.socket, "lock-dial", { code: room.code })).ok, true);
  assert.equal(room.phase, "side");

  const opponents = players.filter((player) => room.players.get(player.playerId).team !== room.activeTeam);
  for (const opponent of opponents) {
    assert.equal((await call(opponent.socket, "submit-side", { code: room.code, side: "left" })).ok, true);
  }
  assert.equal(room.phase, "ready");
  assert.equal((await call(host, "reveal-round", { code: room.code })).ok, true);
  assert.equal(room.phase, "reveal");
  assert.equal(room.roundResult.activePoints, 4);
  assert.equal(require("../game-engine").publicRoom(room).targetAngle, room.targetAngle);
});

test("the server rejects a start without two players on each team", async (context) => {
  const game = createGameServer();
  await new Promise((resolve) => game.httpServer.listen(0, "127.0.0.1", resolve));
  const { port } = game.httpServer.address();
  const host = Client(`http://127.0.0.1:${port}`, { transports: ["websocket"] });
  context.after(async () => {
    host.close();
    game.io.close();
    await new Promise((resolve) => game.httpServer.close(resolve));
  });
  await new Promise((resolve) => host.on("connect", resolve));
  const created = await call(host, "create-room");
  const response = await call(host, "start-game", { code: created.code });
  assert.equal(response.ok, false);
  assert.match(response.error, /two connected players/i);
});

test("the host lobby QR code opens the exact public room link", async (context) => {
  const game = createGameServer();
  await new Promise((resolve) => game.httpServer.listen(0, "127.0.0.1", resolve));
  const { port } = game.httpServer.address();
  const url = `http://127.0.0.1:${port}`;
  const host = Client(url, { transports: ["websocket"] });
  context.after(async () => {
    host.close();
    game.io.close();
    await new Promise((resolve) => game.httpServer.close(resolve));
  });
  await new Promise((resolve) => host.on("connect", resolve));

  const created = await call(host, "create-room");
  const response = await fetch(`${url}/qr/${created.code}`, {
    headers: {
      "x-forwarded-proto": "https",
      "x-forwarded-host": "party.example"
    }
  });

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^image\/svg\+xml/);
  assert.equal(response.headers.get("content-location"), `https://party.example/?room=${created.code}`);
  assert.match(await response.text(), /^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);

  const missing = await fetch(`${url}/qr/NOPE`);
  assert.equal(missing.status, 404);
});

test("the game finishes when one team reaches ten with a clear lead", () => {
  const room = createRoom("WIN1", "host");
  room.phase = "ready";
  room.activeTeam = "coral";
  room.scores.coral = 8;
  room.targetAngle = 0;
  room.dialAngle = 0;

  scoreRound(room);

  assert.equal(room.scores.coral, 12);
  assert.equal(room.winner, "coral");
  assert.equal(room.phase, "finished");
  assert.equal(publicRoom(room).targetAngle, 0);
});

test("a tie at ten continues into a deciding round", () => {
  const room = createRoom("TIE1", "host");
  room.phase = "ready";
  room.activeTeam = "coral";
  room.scores = { coral: 8, cyan: 9 };
  room.targetAngle = -10;
  room.dialAngle = 0;
  room.sideVotes = { cyanPlayer: "left" };

  scoreRound(room);

  assert.deepEqual(room.scores, { coral: 10, cyan: 10 });
  assert.equal(room.winner, null);
  assert.equal(room.phase, "reveal");
});

test("a three-strong guessing team needs a majority of locks to commit the dial", async (context) => {
  const game = createGameServer();
  await new Promise((resolve) => game.httpServer.listen(0, "127.0.0.1", resolve));
  const { port } = game.httpServer.address();
  const url = `http://127.0.0.1:${port}`;
  const sockets = [];
  context.after(async () => {
    for (const socket of sockets) socket.close();
    game.io.close();
    await new Promise((resolve) => game.httpServer.close(resolve));
  });
  function connect() {
    const socket = Client(url, { transports: ["websocket"], forceNew: true });
    sockets.push(socket);
    return new Promise((resolve) => socket.on("connect", () => resolve(socket)));
  }

  const host = await connect();
  const created = await call(host, "create-room");
  const players = [];
  for (const name of ["Ada", "Bo", "Cy", "Di", "Eve", "Fay"]) {
    const socket = await connect();
    const joined = await call(socket, "join-room", { code: created.code, name });
    players.push({ socket, ...joined });
  }
  /* Four on coral so the guessing team is three once the clue-giver is out */
  for (const index of [0, 1, 2, 3]) {
    await call(players[index].socket, "choose-team", { code: created.code, team: "coral" });
  }
  for (const index of [4, 5]) {
    await call(players[index].socket, "choose-team", { code: created.code, team: "cyan" });
  }
  assert.equal((await call(host, "start-game", { code: created.code })).ok, true);

  const room = game.rooms.get(created.code);
  const cluegiver = players.find((player) => player.playerId === room.cluegiverId);
  await call(cluegiver.socket, "submit-clue", { code: room.code, clue: "A mid-sized dog" });
  assert.equal(room.phase, "guess");

  const guessers = players.filter((player) => {
    const stored = room.players.get(player.playerId);
    return stored.team === room.activeTeam && stored.id !== room.cluegiverId;
  });
  assert.equal(guessers.length, 3);
  assert.equal(publicRoom(room).dialLocksNeeded, 2);

  /* One lock is not enough */
  const first = await call(guessers[0].socket, "lock-dial", { code: room.code });
  assert.equal(first.locked, true);
  assert.equal(first.advanced, false);
  assert.equal(room.phase, "guess");

  /* Locking again withdraws it */
  const withdrawn = await call(guessers[0].socket, "lock-dial", { code: room.code });
  assert.equal(withdrawn.locked, false);
  assert.equal(publicRoom(room).dialLocks.length, 0);

  /* Moving the dial withdraws every lock and reports who moved it */
  await call(guessers[0].socket, "lock-dial", { code: room.code });
  assert.equal(publicRoom(room).dialLocks.length, 1);
  await call(guessers[1].socket, "set-dial", { code: room.code, angle: 21.5 });
  assert.equal(publicRoom(room).dialLocks.length, 0);
  assert.equal(publicRoom(room).dialMovedBy, guessers[1].playerId);
  assert.equal(room.phase, "guess");

  /* A majority commits it */
  assert.equal((await call(guessers[0].socket, "lock-dial", { code: room.code })).advanced, false);
  const second = await call(guessers[2].socket, "lock-dial", { code: room.code });
  assert.equal(second.advanced, true);
  assert.equal(room.phase, "side");
  assert.equal(publicRoom(room).dialMovedBy, null);
});

test("the clue-giver cannot lock, and a guesser leaving can complete a majority", async (context) => {
  const game = createGameServer();
  await new Promise((resolve) => game.httpServer.listen(0, "127.0.0.1", resolve));
  const { port } = game.httpServer.address();
  const url = `http://127.0.0.1:${port}`;
  const sockets = [];
  context.after(async () => {
    for (const socket of sockets) socket.close();
    game.io.close();
    await new Promise((resolve) => game.httpServer.close(resolve));
  });
  function connect() {
    const socket = Client(url, { transports: ["websocket"], forceNew: true });
    sockets.push(socket);
    return new Promise((resolve) => socket.on("connect", () => resolve(socket)));
  }

  const host = await connect();
  const created = await call(host, "create-room");
  const players = [];
  for (const name of ["Ada", "Bo", "Cy", "Di", "Eve"]) {
    const socket = await connect();
    const joined = await call(socket, "join-room", { code: created.code, name });
    players.push({ socket, ...joined });
  }
  for (const index of [0, 1, 2]) {
    await call(players[index].socket, "choose-team", { code: created.code, team: "coral" });
  }
  for (const index of [3, 4]) {
    await call(players[index].socket, "choose-team", { code: created.code, team: "cyan" });
  }
  await call(host, "start-game", { code: created.code });

  const room = game.rooms.get(created.code);
  const cluegiver = players.find((player) => player.playerId === room.cluegiverId);
  await call(cluegiver.socket, "submit-clue", { code: room.code, clue: "A quiet Tuesday" });

  /* The clue-giver has seen the target, so they get no vote on the dial */
  const refused = await call(cluegiver.socket, "lock-dial", { code: room.code });
  assert.equal(refused.ok, false);
  assert.match(refused.error, /guessing team/i);

  const guessers = players.filter((player) => {
    const stored = room.players.get(player.playerId);
    return stored.team === room.activeTeam && stored.id !== room.cluegiverId;
  });
  assert.equal(guessers.length, 2);
  assert.equal(publicRoom(room).dialLocksNeeded, 2);

  /* One of two locks, then the other drops out: the majority is now met */
  assert.equal((await call(guessers[0].socket, "lock-dial", { code: room.code })).advanced, false);
  assert.equal(room.phase, "guess");
  await call(host, "remove-player", { code: room.code, playerId: guessers[1].playerId });
  assert.equal(room.phase, "side");
});

test("prompts are dealt from a shuffled deck, so a game never repeats a spectrum", () => {
  const room = createRoom("AAAA", "host");
  const seen = [];
  for (let draw = 0; draw < PROMPTS.length; draw += 1) {
    seen.push(drawPrompt(room).join("|"));
  }
  assert.equal(seen.length, PROMPTS.length);
  assert.equal(new Set(seen).size, PROMPTS.length, "a full pass through the deck repeated a prompt");

  /* Spent deck: it reshuffles rather than stopping, and does not repeat the seam */
  const lastOfDeck = seen[seen.length - 1];
  const firstOfNext = drawPrompt(room).join("|");
  assert.notEqual(firstOfNext, lastOfDeck);
  assert.equal(room.deckIndex, 1);
});

test("a deck seed reproduces the same deal", () => {
  const first = createRoom("AAAA", "host");
  const second = createRoom("BBBB", "host");
  second.deckSeed = first.deckSeed;
  second.deckIndex = 0;
  const dealA = [];
  const dealB = [];
  for (let draw = 0; draw < 12; draw += 1) {
    dealA.push(drawPrompt(first).join("|"));
    dealB.push(drawPrompt(second).join("|"));
  }
  assert.deepEqual(dealB, dealA);

  /* Two rooms with their own seeds should not march in lockstep */
  const third = createRoom("CCCC", "host");
  const dealC = [];
  for (let draw = 0; draw < 12; draw += 1) dealC.push(drawPrompt(third).join("|"));
  assert.notDeepEqual(dealC, dealA);
});

test("a reset deals a fresh deck", () => {
  const room = createRoom("AAAA", "host");
  drawPrompt(room);
  drawPrompt(room);
  assert.equal(room.deckIndex, 2);
  const seedBefore = room.deckSeed;
  resetMatch(room);
  assert.equal(room.deckIndex, 0);
  assert.notEqual(room.deckSeed, seedBefore);
});
