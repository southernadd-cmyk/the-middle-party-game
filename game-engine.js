const crypto = require("node:crypto");

const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TEAM_CORAL = "coral";
const TEAM_CYAN = "cyan";
const WINNING_SCORE = 10;

const PROMPTS = [
  ["Quietly impressive", "Obvious show-off"],
  ["Worth the effort", "More trouble than it’s worth"],
  ["A harmless habit", "A worrying obsession"],
  ["Belongs in a museum", "Belongs in the bin"],
  ["Surprisingly useful", "Completely pointless"],
  ["A tiny inconvenience", "Day absolutely ruined"],
  ["Easy to explain", "Impossible to explain"],
  ["Trust immediately", "Would not trust at all"],
  ["A sensible purchase", "An outrageous purchase"],
  ["Barely a sport", "The ultimate sport"],
  ["Good background noise", "Needs your full attention"],
  ["A little awkward", "Leave the country forever"],
  ["Fine in moderation", "Never enough"],
  ["Looks homemade", "Looks impossibly expensive"],
  ["A weak excuse", "Completely understandable"],
  ["Best alone", "Best with a crowd"],
  ["An acquired taste", "Everyone loves it"],
  ["A minor talent", "A genuine superpower"],
  ["Very predictable", "Total chaos"],
  ["A boring job", "A dream job"],
  ["Feels ancient", "Feels futuristic"],
  ["A terrible gift", "The perfect gift"],
  ["Makes you look younger", "Makes you look older"],
  ["Not worth arguing about", "A hill to die on"],
  ["A snack", "A full meal"],
  ["Safe for work", "Instant meeting disaster"],
  ["Bare minimum effort", "Above and beyond"],
  ["A private moment", "Needs an audience"],
  ["Reasonably priced", "Financially reckless"],
  ["A forgettable day", "A core memory"],
  ["Would survive a week", "Would survive anything"],
  ["An innocent mistake", "Absolutely unforgivable"],
  ["Comfortably familiar", "Excitingly strange"],
  ["Low-maintenance", "Needs constant attention"],
  ["A bad idea", "So bad it might work"],
  ["Better in theory", "Better in practice"],
  ["A slow afternoon", "Time moves at light speed"],
  ["Barely competitive", "Taken far too seriously"],
  ["A local secret", "World famous"],
  ["Softly spoken", "Can hear it three streets away"],
  ["Mildly suspicious", "Clearly the villain"],
  ["A temporary fix", "Built to last"],
  ["Easy to give up", "Impossible to quit"],
  ["A normal pet", "An alarming pet"],
  ["Good on paper", "Good in real life"],
  ["A niche interest", "Basically universal"],
  ["A bit dramatic", "Perfectly reasonable reaction"],
  ["A gentle learning curve", "Utterly bewildering"],
  ["A casual outfit", "Dressed for history"],
  ["Would tell nobody", "Would tell everyone"],
  ["Small talk", "Deep conversation"],
  ["A quick favour", "A lifelong debt"],
  ["Mild weather", "Apocalyptic weather"],
  ["A little old-fashioned", "Painfully trendy"],
  ["Better as a child", "Better as an adult"],
  ["A normal amount of cheese", "A heroic amount of cheese"],
  ["Easy first date", "Bold first date"],
  ["Background character", "Main-character energy"],
  ["A useful invention", "Humanity peaked here"],
  ["Slightly haunted", "Absolutely haunted"],
  ["A reasonable queue", "Civilisation has collapsed"],
  ["A gentle roast", "Friendship-ending insult"],
  ["A decent view", "Worth travelling for"],
  ["Needs instructions", "Completely intuitive"],
  ["A small lie", "A breathtaking deception"],
  ["Forgotten tomorrow", "Quoted for years"],
  ["A quiet night", "A legendary night"],
  ["Mostly luck", "Mostly skill"],
  ["A normal breakfast", "An unhinged breakfast"],
  ["Probably fine", "Call an expert"],
  ["Too early", "Perfect timing"],
  ["Subtle decoration", "Maximum decoration"],
  ["A guilty pleasure", "Excellent taste"],
  ["Just a phase", "A whole personality"],
  ["Would lend it", "Nobody touches it"],
  ["A fair challenge", "Basically impossible"],
  ["Tiny risk", "Absolutely not worth it"],
  ["An average name", "An unforgettable name"],
  ["Politely interested", "Deeply invested"],
  ["Could do without it", "Essential to modern life"]
];

function cleanText(value, maxLength) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function randomToken() {
  return crypto.randomBytes(24).toString("base64url");
}

function makeRoomCode(existingCodes) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    let code = "";
    for (let index = 0; index < 4; index += 1) {
      code += ROOM_ALPHABET[crypto.randomInt(0, ROOM_ALPHABET.length)];
    }
    if (!existingCodes.has(code)) return code;
  }
  throw new Error("Could not allocate a room code");
}

function makePlayer(name, socketId, team) {
  return {
    id: crypto.randomUUID(),
    token: randomToken(),
    name: cleanText(name, 24) || "Player",
    socketId,
    team,
    connected: true,
    joinedAt: Date.now()
  };
}

function chooseTeam(players) {
  const counts = { [TEAM_CORAL]: 0, [TEAM_CYAN]: 0 };
  for (const player of players.values()) counts[player.team] += 1;
  return counts[TEAM_CORAL] <= counts[TEAM_CYAN] ? TEAM_CORAL : TEAM_CYAN;
}

function createRoom(code, hostSocketId) {
  return {
    code,
    hostToken: randomToken(),
    hostSocketId,
    hostConnected: true,
    players: new Map(),
    phase: "lobby",
    activeTeam: TEAM_CORAL,
    scores: { [TEAM_CORAL]: 0, [TEAM_CYAN]: 0 },
    winner: null,
    round: 0,
    targetAngle: null,
    dialAngle: 0,
    prompt: null,
    clue: "",
    cluegiverId: null,
    clueIndexes: { [TEAM_CORAL]: 0, [TEAM_CYAN]: 0 },
    dialMovedBy: null,
    dialLocks: {},
    sideVotes: {},
    roundResult: null,
    previousPromptIndex: -1,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

function connectedTeamPlayers(room, team) {
  return [...room.players.values()]
    .filter((player) => player.team === team && player.connected)
    .sort((a, b) => a.joinedAt - b.joinedAt);
}

/*
  The players who actually control the dial this round: connected, on the active
  team, and not the clue-giver. The clue-giver is excluded on purpose — they can
  see the target, so a lock from them would be a lock from the answer sheet.
*/
function guessingPlayers(room) {
  return connectedTeamPlayers(room, room.activeTeam).filter((player) => player.id !== room.cluegiverId);
}

/*
  A simple majority commits the guess: 1 of 1, 2 of 2 or 3, 3 of 4 or 5. With a
  minimum team of two there is only one guesser, so a solo lock still works and
  nothing about small games changes.
*/
function lockTally(room) {
  const guessers = guessingPlayers(room);
  const locked = guessers.filter((player) => room.dialLocks?.[player.id]).map((player) => player.id);
  return {
    locked,
    lockedCount: locked.length,
    total: guessers.length,
    needed: Math.max(1, Math.floor(guessers.length / 2) + 1)
  };
}

function selectPrompt(room) {
  let index = crypto.randomInt(0, PROMPTS.length);
  if (PROMPTS.length > 1 && index === room.previousPromptIndex) {
    index = (index + 1) % PROMPTS.length;
  }
  room.previousPromptIndex = index;
  return PROMPTS[index];
}

function beginRound(room) {
  const teamPlayers = connectedTeamPlayers(room, room.activeTeam);
  if (teamPlayers.length < 2) {
    throw new Error("Each team needs at least two connected players");
  }

  const cursor = room.clueIndexes[room.activeTeam] % teamPlayers.length;
  const cluegiver = teamPlayers[cursor];
  room.clueIndexes[room.activeTeam] = (cursor + 1) % teamPlayers.length;
  room.round += 1;
  room.phase = "clue";
  room.prompt = selectPrompt(room);
  room.targetAngle = crypto.randomInt(-600, 601) / 10;
  room.dialAngle = 0;
  room.clue = "";
  room.cluegiverId = cluegiver.id;
  room.dialMovedBy = null;
  room.dialLocks = {};
  room.sideVotes = {};
  room.roundResult = null;
  room.updatedAt = Date.now();
}

function scoreRound(room) {
  const distance = Math.abs(room.targetAngle - room.dialAngle);
  let activePoints = 0;
  if (distance <= 4) activePoints = 4;
  else if (distance <= 9) activePoints = 3;
  else if (distance <= 16) activePoints = 2;

  const defendingTeam = room.activeTeam === TEAM_CORAL ? TEAM_CYAN : TEAM_CORAL;
  const votes = Object.values(room.sideVotes);
  const leftVotes = votes.filter((vote) => vote === "left").length;
  const rightVotes = votes.filter((vote) => vote === "right").length;
  const teamSide = leftVotes === rightVotes ? null : leftVotes > rightVotes ? "left" : "right";
  const correctSide = room.targetAngle < room.dialAngle ? "left" : "right";
  const sidePoint = teamSide === correctSide ? 1 : 0;

  room.scores[room.activeTeam] += activePoints;
  room.scores[defendingTeam] += sidePoint;
  room.roundResult = {
    activePoints,
    sidePoint,
    defendingTeam,
    teamSide,
    correctSide,
    distance: Math.round(distance * 10) / 10
  };
  const coralScore = room.scores[TEAM_CORAL];
  const cyanScore = room.scores[TEAM_CYAN];
  const leader = coralScore === cyanScore
    ? null
    : coralScore > cyanScore ? TEAM_CORAL : TEAM_CYAN;
  room.winner = leader && Math.max(coralScore, cyanScore) >= WINNING_SCORE ? leader : null;
  room.phase = room.winner ? "finished" : "reveal";
  room.updatedAt = Date.now();
  return room.roundResult;
}

function resetMatch(room) {
  room.phase = "lobby";
  room.activeTeam = TEAM_CORAL;
  room.scores = { [TEAM_CORAL]: 0, [TEAM_CYAN]: 0 };
  room.winner = null;
  room.round = 0;
  room.targetAngle = null;
  room.dialAngle = 0;
  room.prompt = null;
  room.clue = "";
  room.cluegiverId = null;
  room.clueIndexes = { [TEAM_CORAL]: 0, [TEAM_CYAN]: 0 };
  room.dialMovedBy = null;
  room.dialLocks = {};
  room.sideVotes = {};
  room.roundResult = null;
  room.previousPromptIndex = -1;
  room.updatedAt = Date.now();
}

function publicRoom(room) {
  const revealTarget = ["reveal", "finished"].includes(room.phase);
  const tally = lockTally(room);
  return {
    code: room.code,
    hostConnected: room.hostConnected,
    phase: room.phase,
    activeTeam: room.activeTeam,
    scores: { ...room.scores },
    winner: room.winner,
    winningScore: WINNING_SCORE,
    round: room.round,
    targetAngle: revealTarget ? room.targetAngle : null,
    dialAngle: room.dialAngle,
    prompt: room.prompt ? [...room.prompt] : null,
    clue: room.clue,
    cluegiverId: room.cluegiverId,
    dialMovedBy: room.phase === "guess" ? room.dialMovedBy : null,
    dialLocks: tally.locked,
    dialLocksNeeded: tally.needed,
    dialLockTotal: tally.total,
    sideVotes: { ...room.sideVotes },
    roundResult: room.roundResult ? { ...room.roundResult } : null,
    players: [...room.players.values()].map((player) => ({
      id: player.id,
      name: player.name,
      team: player.team,
      connected: player.connected
    }))
  };
}

module.exports = {
  TEAM_CORAL,
  TEAM_CYAN,
  WINNING_SCORE,
  PROMPTS,
  cleanText,
  randomToken,
  makeRoomCode,
  makePlayer,
  chooseTeam,
  createRoom,
  connectedTeamPlayers,
  guessingPlayers,
  lockTally,
  beginRound,
  scoreRound,
  resetMatch,
  publicRoom
};
