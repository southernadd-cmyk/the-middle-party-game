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
  ["Could do without it", "Essential to modern life"],
  ["A drink", "A dessert"],
  ["Needs ketchup", "Ruined by ketchup"],
  ["Under-seasoned", "Aggressively seasoned"],
  ["A biscuit", "A cake"],
  ["A light lunch", "A full Sunday roast"],
  ["Mildly spicy", "Medically inadvisable"],
  ["A single scoop", "Everything on the menu"],
  ["A morning coffee", "A fourth espresso"],
  ["Would eat it past the use-by date", "Would not risk it"],
  ["A little bit sweet", "Purely sugar"],
  ["A tiny portion of chips", "Chips for the table"],
  ["Definitely a scam", "Completely legitimate"],
  ["Turn it off and on again", "Ring the manufacturer"],
  ["A weak password", "Genuinely uncrackable"],
  ["Analogue", "Digital"],
  ["Should have been an email", "Should have been a meeting"],
  ["A helpful notification", "Delete the app"],
  ["A free trial", "Worth the subscription"],
  ["Reads the manual first", "Presses every button"],
  ["A minor bug", "Start again from scratch"],
  ["Dial-up slow", "Instant"],
  ["A robot could do it", "Only a human could do it"],
  ["A sensible number of tabs", "The browser has given up"],
  ["Would read the terms and conditions", "Just clicks accept"],
  ["A useful app", "Screen-time regret"],
  ["A tidy desk", "An archaeological dig"],
  ["A stranger", "A close friend"],
  ["A wave from across the road", "A full hug"],
  ["Arrives early", "Arrives fashionably late"],
  ["A polite laugh", "Genuinely funny"],
  ["Texts back instantly", "Replies in three days"],
  ["Keeps every receipt", "Loses it immediately"],
  ["Reads the room", "Completely oblivious"],
  ["A good listener", "A great storyteller"],
  ["Would apologise first", "Would never apologise"],
  ["Splits the bill exactly", "Just get it next time"],
  ["A reliable friend", "Cancels every time"],
  ["A friendly rivalry", "Genuine loathing"],
  ["A polite disagreement", "A full argument"],
  ["A quiet confidence", "Pure arrogance"],
  ["A polite refusal", "An outright no"],
  ["Would tip generously", "Would leave nothing"],
  ["A polite nod", "A standing ovation"],
  ["A gentle prank", "Police involved"],
  ["A firm handshake", "Bone-crushing"],
  ["A gentle competitive streak", "Would cheat at cards"],
  ["Would go to the party", "Would leave early"],
  ["A short goodbye", "A tearful farewell"],
  ["A calculated risk", "Pure recklessness"],
  ["Cuts corners", "Does it properly"],
  ["A rough draft", "Ready to publish"],
  ["A gentle nudge", "A serious intervention"],
  ["An amateur", "A professional"],
  ["A hobby", "A calling"],
  ["Self-taught", "Formally trained"],
  ["A participation medal", "An actual trophy"],
  ["Perfectly competent", "World class"],
  ["A useful skill", "A party trick"],
  ["A gentle beginner", "An absolute veteran"],
  ["A quick lesson", "A three-year course"],
  ["A little help", "Doing it for them"],
  ["A modest ambition", "Total world domination"],
  ["A hobby project", "A commercial product"],
  ["A gentle warning", "A final warning"],
  ["A modest achievement", "Frame the certificate"],
  ["A small win", "Life-changing"],
  ["A gentle exercise", "Genuinely brutal"],
  ["A gentle hobby", "An extreme sport"],
  ["Beige", "Neon"],
  ["Comfortable", "Stylish"],
  ["Should be black and white", "Needs full colour"],
  ["A sensible haircut", "A statement haircut"],
  ["Would hang it on the wall", "Would hide it in a drawer"],
  ["Fits in anywhere", "Impossible to miss"],
  ["A safe colour", "A brave colour"],
  ["A cheerful colour", "A funeral colour"],
  ["A sensible hat", "An unforgivable hat"],
  ["A small tattoo", "A full sleeve"],
  ["A sensible car", "A ridiculous car"],
  ["A modest wedding", "Visible from space"],
  ["A normal amount of glitter", "Glitter forever"],
  ["A reasonable number of cushions", "Cannot find the sofa"],
  ["Neat handwriting", "A doctor's prescription"],
  ["Five minutes", "All weekend"],
  ["A morning person", "A night owl"],
  ["Ahead of its time", "Long overdue"],
  ["Do it now", "Do it eventually"],
  ["An ordinary Tuesday", "A national holiday"],
  ["A quick nap", "Down for the night"],
  ["A quick shower", "An hour-long bath"],
  ["A quick tidy", "A full deep clean"],
  ["A weekday activity", "A holiday activity"],
  ["A gentle animal", "Would absolutely bite"],
  ["A garden bird", "A jungle predator"],
  ["Cute", "Terrifying"],
  ["Domesticated", "Wild"],
  ["A puddle", "An ocean"],
  ["A breeze", "A gale"],
  ["A small dog", "A very large dog"],
  ["A houseplant that survives anything", "Dead within a week"],
  ["A small spider", "Call the fire brigade"],
  ["Slightly damp", "Completely submerged"],
  ["A gentle slope", "A vertical cliff"],
  ["A little bit cold", "Genuinely dangerous"],
  ["A bargain", "A rip-off"],
  ["Would haggle", "Would pay full price"],
  ["Should be free", "Worth every penny"],
  ["A one-hit wonder", "A whole discography"],
  ["Skip the intro", "Watch every credit"],
  ["A short story", "A trilogy"],
  ["Ends too soon", "Went on far too long"],
  ["A sequel nobody asked for", "A sequel that beats the original"],
  ["An okay film", "Changed my life"],
  ["An easy read", "Hard work"],
  ["A children's film", "Definitely not for children"],
  ["An emoji", "A full paragraph"],
  ["A short email", "A wall of text"],
  ["Underrated", "Overrated"],
  ["Easily replaced", "Irreplaceable"],
  ["A pleasant surprise", "A genuine shock"],
  ["A believable rumour", "Obvious nonsense"],
  ["Should be taught in school", "Learn it yourself"],
  ["Reasonable in the moment", "Baffling in hindsight"],
  ["A minor superstition", "Ruled by it"],
  ["A normal thing to collect", "A concerning collection"],
  ["An acceptable smell", "Evacuate the building"],
  ["An acceptable level of noise", "A noise complaint"],
  ["A quiet library", "A football crowd"],
  ["Room temperature", "Radiator on in June"],
  ["An easy exam", "Nobody passed"],
  ["A useful meeting", "Two hours of your life"],
  ["A neat solution", "Held together with tape"],
  ["Would fit in a bag", "Needs a van"],
  ["A useful lie", "A cruel lie"],
  ["A cheap thrill", "A profound experience"],
  ["A hand-me-down", "Brand new"],
  ["A reasonable request", "Absolute cheek"],
  ["A helpful teacher", "A legendary teacher"],
  ["Would survive a zombie apocalypse", "First to go"],
  ["A single sock lost", "The whole wash ruined"],
  ["Easy to pronounce", "Nobody says it right"],
  ["A sensible souvenir", "How did that clear customs"],
  ["Would go back", "Never again"],
  ["A modest online following", "Internet famous"]
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
    deckSeed: randomToken(),
    deckIndex: 0,
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

/*
  Prompts are dealt from a shuffled deck rather than drawn at random, so a game
  works through every pair before any of them can come round again. Picking at
  random meant a long game could serve the same spectrum three times while
  leaving dozens unused.

  The order is derived from a seed, which costs nothing and buys two things: the
  deal is reproducible in a test, and a room's whole sequence can be recreated
  from four characters if a game ever needs debugging. Unlike a serverless
  version of this game, we do not need the seed to keep clients in step — the
  server is the only thing that touches the deck.
*/
function hashSeed(seed) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/* mulberry32: small, fast, and good enough to shuffle a card deck */
function seededRandom(seed) {
  let state = hashSeed(seed);
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleOrder(seed) {
  const next = seededRandom(seed);
  const order = PROMPTS.map((pair, index) => index);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/* One-entry cache: a room draws once per round and its seed lasts the game */
let orderCache = { seed: null, order: null };

function deckOrder(seed) {
  if (orderCache.seed !== seed) orderCache = { seed, order: shuffleOrder(seed) };
  return orderCache.order;
}

function drawPrompt(room) {
  if (!room.deckSeed) {
    room.deckSeed = randomToken();
    room.deckIndex = 0;
  }
  let order = deckOrder(room.deckSeed);

  if (room.deckIndex >= order.length) {
    /*
      Deck spent. Reshuffle, but never let the fresh deck open on the pair that
      just came up — the one repeat a player would actually notice.
    */
    const lastDrawn = order[order.length - 1];
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const seed = randomToken();
      const candidate = deckOrder(seed);
      if (PROMPTS.length < 2 || candidate[0] !== lastDrawn) {
        room.deckSeed = seed;
        room.deckIndex = 0;
        order = candidate;
        break;
      }
    }
  }

  const prompt = PROMPTS[order[room.deckIndex]];
  room.deckIndex += 1;
  return prompt;
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
  room.prompt = drawPrompt(room);
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
  room.deckSeed = randomToken();
  room.deckIndex = 0;
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
  drawPrompt,
  guessingPlayers,
  lockTally,
  beginRound,
  scoreRound,
  resetMatch,
  publicRoom
};
