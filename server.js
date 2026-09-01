const path = require("node:path");
const http = require("node:http");
const express = require("express");
const { Server } = require("socket.io");
const {
  TEAM_CORAL,
  TEAM_CYAN,
  cleanText,
  makeRoomCode,
  makePlayer,
  chooseTeam,
  createRoom,
  connectedTeamPlayers,
  beginRound,
  scoreRound,
  publicRoom
} = require("./game-engine");

function createGameServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: true, credentials: true }
  });
  const rooms = new Map();

  app.disable("x-powered-by");
  app.use(express.static(path.join(__dirname, "public")));
  app.get("/health", (_request, response) => {
    response.json({ ok: true, rooms: rooms.size });
  });
  app.use((_request, response) => {
    response.sendFile(path.join(__dirname, "public", "index.html"));
  });

  function acknowledge(callback, payload) {
    if (typeof callback === "function") callback(payload);
  }

  function fail(callback, message) {
    acknowledge(callback, { ok: false, error: message });
  }

  function findRoom(rawCode) {
    return rooms.get(cleanText(rawCode, 4).toUpperCase());
  }

  function playerForSocket(room, socket) {
    return [...room.players.values()].find((player) => player.socketId === socket.id);
  }

  function isHost(room, socket) {
    return room && room.hostSocketId === socket.id;
  }

  function broadcast(room) {
    room.updatedAt = Date.now();
    io.to(room.code).emit("room-state", publicRoom(room));
    if (room.phase === "clue" && room.cluegiverId) {
      const cluegiver = room.players.get(room.cluegiverId);
      if (cluegiver?.connected) {
        io.to(cluegiver.socketId).emit("private-target", {
          roomCode: room.code,
          targetAngle: room.targetAngle
        });
      }
    }
  }

  function requireHost(room, socket, callback) {
    if (!room || !isHost(room, socket)) {
      fail(callback, "Only the host can do that.");
      return false;
    }
    return true;
  }

  io.on("connection", (socket) => {
    socket.on("create-room", (_payload, callback) => {
      const code = makeRoomCode(new Set(rooms.keys()));
      const room = createRoom(code, socket.id);
      rooms.set(code, room);
      socket.join(code);
      acknowledge(callback, {
        ok: true,
        code,
        hostToken: room.hostToken,
        room: publicRoom(room)
      });
      broadcast(room);
    });

    socket.on("host-rejoin", (payload, callback) => {
      const room = findRoom(payload?.code);
      if (!room || payload?.hostToken !== room.hostToken) {
        return fail(callback, "That host session is no longer available.");
      }
      room.hostSocketId = socket.id;
      room.hostConnected = true;
      socket.join(room.code);
      acknowledge(callback, { ok: true, room: publicRoom(room) });
      broadcast(room);
    });

    socket.on("join-room", (payload, callback) => {
      const room = findRoom(payload?.code);
      if (!room) return fail(callback, "Room not found. Check the four-character code.");

      const previousPlayer = payload?.playerToken
        ? [...room.players.values()].find((player) => player.token === payload.playerToken)
        : null;

      if (previousPlayer) {
        previousPlayer.socketId = socket.id;
        previousPlayer.connected = true;
        if (cleanText(payload?.name, 24)) previousPlayer.name = cleanText(payload.name, 24);
        socket.join(room.code);
        acknowledge(callback, {
          ok: true,
          playerId: previousPlayer.id,
          playerToken: previousPlayer.token,
          room: publicRoom(room)
        });
        broadcast(room);
        return;
      }

      if (room.phase !== "lobby") return fail(callback, "This game has already started.");
      if (room.players.size >= 20) return fail(callback, "This room is full.");
      const name = cleanText(payload?.name, 24);
      if (!name) return fail(callback, "Enter a player name.");

      const player = makePlayer(name, socket.id, chooseTeam(room.players));
      room.players.set(player.id, player);
      socket.join(room.code);
      acknowledge(callback, {
        ok: true,
        playerId: player.id,
        playerToken: player.token,
        room: publicRoom(room)
      });
      broadcast(room);
    });

    socket.on("choose-team", (payload, callback) => {
      const room = findRoom(payload?.code);
      const player = room && playerForSocket(room, socket);
      if (!room || !player) return fail(callback, "Player session not found.");
      if (room.phase !== "lobby") return fail(callback, "Teams are locked after the game starts.");
      if (![TEAM_CORAL, TEAM_CYAN].includes(payload?.team)) return fail(callback, "Unknown team.");
      player.team = payload.team;
      acknowledge(callback, { ok: true });
      broadcast(room);
    });

    socket.on("remove-player", (payload, callback) => {
      const room = findRoom(payload?.code);
      if (!requireHost(room, socket, callback)) return;
      const player = room.players.get(payload?.playerId);
      if (!player) return fail(callback, "Player not found.");
      io.to(player.socketId).emit("removed-from-room");
      room.players.delete(player.id);
      acknowledge(callback, { ok: true });
      broadcast(room);
    });

    socket.on("start-game", (payload, callback) => {
      const room = findRoom(payload?.code);
      if (!requireHost(room, socket, callback)) return;
      if (room.phase !== "lobby") return fail(callback, "The game is already running.");
      const coralCount = connectedTeamPlayers(room, TEAM_CORAL).length;
      const cyanCount = connectedTeamPlayers(room, TEAM_CYAN).length;
      if (coralCount < 2 || cyanCount < 2) {
        return fail(callback, "You need at least two connected players on each team.");
      }
      beginRound(room);
      acknowledge(callback, { ok: true });
      broadcast(room);
    });

    socket.on("submit-clue", (payload, callback) => {
      const room = findRoom(payload?.code);
      const player = room && playerForSocket(room, socket);
      if (!room || !player || player.id !== room.cluegiverId || room.phase !== "clue") {
        return fail(callback, "It is not your clue turn.");
      }
      const clue = cleanText(payload?.clue, 80);
      if (!clue) return fail(callback, "Enter a clue first.");
      room.clue = clue;
      room.phase = "guess";
      acknowledge(callback, { ok: true });
      broadcast(room);
    });

    socket.on("set-dial", (payload, callback) => {
      const room = findRoom(payload?.code);
      const player = room && playerForSocket(room, socket);
      if (!room || !player || room.phase !== "guess") return fail(callback, "The dial is locked.");
      if (player.team !== room.activeTeam || player.id === room.cluegiverId) {
        return fail(callback, "Only the guessing team can move the dial.");
      }
      const angle = Number(payload?.angle);
      if (!Number.isFinite(angle)) return fail(callback, "Invalid dial position.");
      room.dialAngle = Math.max(-80, Math.min(80, Math.round(angle * 10) / 10));
      acknowledge(callback, { ok: true });
      broadcast(room);
    });

    socket.on("lock-dial", (payload, callback) => {
      const room = findRoom(payload?.code);
      const player = room && playerForSocket(room, socket);
      if (!room || !player || room.phase !== "guess") return fail(callback, "The dial cannot be locked now.");
      if (player.team !== room.activeTeam || player.id === room.cluegiverId) {
        return fail(callback, "Only the guessing team can lock the dial.");
      }
      room.phase = "side";
      acknowledge(callback, { ok: true });
      broadcast(room);
    });

    socket.on("submit-side", (payload, callback) => {
      const room = findRoom(payload?.code);
      const player = room && playerForSocket(room, socket);
      if (!room || !player || !["side", "ready"].includes(room.phase)) {
        return fail(callback, "Side voting is not open.");
      }
      if (player.team === room.activeTeam) return fail(callback, "Only the opposing team votes.");
      if (!["left", "right"].includes(payload?.side)) return fail(callback, "Choose left or right.");
      room.sideVotes[player.id] = payload.side;
      const opponents = connectedTeamPlayers(room, player.team);
      if (opponents.length && opponents.every((opponent) => room.sideVotes[opponent.id])) {
        room.phase = "ready";
      }
      acknowledge(callback, { ok: true });
      broadcast(room);
    });

    socket.on("reveal-round", (payload, callback) => {
      const room = findRoom(payload?.code);
      if (!requireHost(room, socket, callback)) return;
      if (!["side", "ready"].includes(room.phase)) return fail(callback, "Finish and lock the team guess first.");
      scoreRound(room);
      acknowledge(callback, { ok: true });
      broadcast(room);
    });

    socket.on("next-round", (payload, callback) => {
      const room = findRoom(payload?.code);
      if (!requireHost(room, socket, callback)) return;
      if (room.phase !== "reveal") return fail(callback, "Reveal this round before starting another.");
      room.activeTeam = room.activeTeam === TEAM_CORAL ? TEAM_CYAN : TEAM_CORAL;
      try {
        beginRound(room);
      } catch (error) {
        return fail(callback, error.message);
      }
      acknowledge(callback, { ok: true });
      broadcast(room);
    });

    socket.on("reset-game", (payload, callback) => {
      const room = findRoom(payload?.code);
      if (!requireHost(room, socket, callback)) return;
      room.phase = "lobby";
      room.activeTeam = TEAM_CORAL;
      room.scores = { [TEAM_CORAL]: 0, [TEAM_CYAN]: 0 };
      room.round = 0;
      room.targetAngle = null;
      room.dialAngle = 0;
      room.prompt = null;
      room.clue = "";
      room.cluegiverId = null;
      room.clueIndexes = { [TEAM_CORAL]: 0, [TEAM_CYAN]: 0 };
      room.sideVotes = {};
      room.roundResult = null;
      acknowledge(callback, { ok: true });
      broadcast(room);
    });

    socket.on("disconnect", () => {
      for (const room of rooms.values()) {
        if (room.hostSocketId === socket.id) {
          room.hostConnected = false;
          broadcast(room);
        }
        const player = playerForSocket(room, socket);
        if (player) {
          player.connected = false;
          broadcast(room);
        }
      }
    });
  });

  const cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - 6 * 60 * 60 * 1000;
    for (const [code, room] of rooms.entries()) {
      if (room.updatedAt < cutoff) rooms.delete(code);
    }
  }, 30 * 60 * 1000);
  cleanupTimer.unref();

  return { app, httpServer, io, rooms };
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const { httpServer } = createGameServer();
  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`THE MIDDLE is running at http://localhost:${port}`);
  });
}

module.exports = { createGameServer };
