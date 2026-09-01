const test = require("node:test");
const assert = require("node:assert/strict");
const { io: Client } = require("socket.io-client");
const { createGameServer } = require("../server");
const { createRoom, publicRoom, scoreRound } = require("../game-engine");

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
