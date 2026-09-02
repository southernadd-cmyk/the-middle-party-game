const crypto = require("node:crypto");

const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TEAM_CORAL = "coral";
const TEAM_CYAN = "cyan";
const WINNING_SCORE = 10;

const PROMPTS = 
[
  ["Bad actor", "Good actor"],
  ["Basic", "Hipster"],
  ["Worthless", "Priceless"],
  ["Nature", "Nurture"],
  ["Happens slowly", "Happens suddenly"],
  ["Job", "Career"],
  ["Round", "Pointy"],
  ["Proof that God exists", "Proof that God doesn't exist"],
  ["Loved", "Hated"],
  ["The Light Side of the Force", "The Dark Side of the Force"],
  ["Stupid", "Brilliant"],
  ["Artisanal", "Mass Produced"],
  ["Nobody does it", "Everybody does it"],
  ["Short lived", "Long lived"],
  ["Dangerous job", "Safe job"],
  ["Fantasy", "Sci-Fi"],
  ["Plain", "Fancy"],
  ["Has a bad reputation", "Has a good reputation"],
  ["Ethical to eat", "Unethical to eat"],
  ["Movie", "Film"],
  ["Unfashionable", "Fashionable"],
  ["Freedom fighter", "Terrorist"],
  ["Bad superpower", "Good superpower"],
  ["Ineffective", "Effective"],
  ["Better hot", "Better cold"],
  ["Square", "Round"],
  ["Temporary", "Permanent"],
  ["Looks like a person", "Doesn't look like a person"],
  ["Uncool", "Cool"],
  ["Worst living person", "Greatest living person"],
  ["Underrated", "Overrated"],
  ["Messy food", "Clean food"],
  ["Unforgivable", "Forgivable"],
  ["Failure", "Masterpiece"],
  ["Harmless", "Harmful"],
  ["Gryffindor", "Slytherin"],
  ["Unhygienic", "Hygienic"],
  ["Bad music", "Good music"],
  ["Useless", "Useful"],
  ["Movie that Godzilla would ruin", "Movie that Godzilla would improve"],
  ["Unimportant", "Important"],
  ["Easy to spell", "Hard to spell"],
  ["Vice", "Virtue"],
  ["Underrated musician", "Overrated musician"],
  ["Unpopular activity", "Popular activity"],
  ["Divided", "Whole"],
  ["Unreliable", "Reliable"],
  ["Easy to kill", "Hard to kill"],
  ["Unstable", "Stable"],
  ["Round animal", "Pointy animal"],
  ["Bad TV show", "Good TV show"],
  ["Traditionally masculine", "Traditionally feminine"],
  ["Useless body part", "Useful body part"],
  ["Fad", "Classic"],
  ["Weak", "Strong"],
  ["Disgusting cereal", "Delicious cereal"],
  ["Bad", "Good"],
  ["Mildly addictive", "Highly addictive"],
  ["Useless in an emergency", "Useful in an emergency"],
  ["For kids", "For adults"],
  ["Villain", "Hero"],
  ["Underrated thing to do", "Overrated thing to do"],
  ["Boring", "Exciting"],
  ["Smelly in a bad way", "Smelly in a good way"],
  ["Unpopular", "Popular"],
  ["Friend", "Enemy"],
  ["Useless invention", "Useful invention"],
  ["Liberal", "Conservative"],
  ["Hot", "Cold"],
  ["Normal", "Weird"],
  ["Colorless", "Colorful"],
  ["Low calorie", "High calorie"],
  ["Easy subject", "Hard subject"],
  ["Unknown", "Famous"],
  ["Rare", "Common"],
  ["Unsexy emoji", "Sexy emoji"],
  ["Cheap", "Expensive"],
  ["Underrated weapon", "Overrated weapon"],
  ["Feels bad", "Feels good"],
  ["Inessential", "Essential"],
  ["Dirty", "Clean"],
  ["Requires luck", "Requires skill"],
  ["Flavorless", "Flavorful"],
  ["Boring topic", "Fascinating topic"],
  ["Casual", "Formal"],
  ["Underpaid", "Overpaid"],
  ["Dry", "Wet"],
  ["Underrated skill", "Overrated skill"],
  ["Forbidden", "Encouraged"],
  ["Sad song", "Happy song"],
  ["Fragile", "Durable"],
  ["Geek", "Dork"],
  ["Good", "Evil"],
  ["Worst day of the year", "Best day of the year"],
  ["Bad habit", "Good habit"],
  ["Cat person", "Dog person"],
  ["Wise", "Intelligent"],
  ["Hard to do", "Easy to do"],
  ["Mental activity", "Physical activity"],
  ["Uncontroversial topic", "Controversial topic"],
  ["Guilty pleasure", "Openly love"],
  ["Untalented", "Talented"],
  ["Hard to find", "Easy to find"],
  ["Ugly Man", "Beautiful Man"],
  ["Hard to remember", "Easy to remember"],
  ["Lowbrow", "Highbrow"],
  ["Unhealthy", "Healthy"],
  ["Bad man", "Good man"],
  ["Historically important", "Historically irrelevant"],
  ["Hairless", "Hairy"],
  ["Inflexible", "Flexible"],
  ["Normal pet", "Exotic pet"],
  ["Introvert", "Extrovert"],
  ["Book was better", "Movie was better"],
  ["Bad movie", "Good movie"],
  ["Ugly", "Beautiful"],
  ["Mature person", "Immature person"],
  ["Underrated thing to own", "Overrated thing to own"],
  ["Ordinary", "Extraordinary"],
  ["Hard to pronounce", "Easy to pronounce"],
  ["Poorly made", "Well made"],
  ["Not a sandwich", "A sandwich"],
  ["Dangerous", "Safe"],
  ["Culturally significant", "Culturally insignificant"],
  ["Optional", "Mandatory"],
  ["Underrated letter of the alphabet", "Overrated letter of the alphabet"],
  ["Low quality", "High quality"],
  ["Unsexy animal", "Sexy animal"],
  ["Quiet place", "Loud place"],
  ["Comedy", "Drama"],
  ["Need", "Want"],
  ["Dry food", "Wet food"],
  ["Replaceable", "Irreplaceable"],
  ["Worst athlete of all time", "Greatest athlete of all time"],
  ["Unethical", "Ethical"],
  ["Boring hobby", "Interesting hobby"],
  ["Bad pizza topping", "Good pizza topping"],
  ["Dystopia", "Utopia"],
  ["Rough", "Smooth"],
  ["Bad for you", "Good for you"],
  ["Peaceful", "Warlike"],
  ["Underrated Movie", "Overrated movie"],
  ["Tastes bad", "Tastes good"],
  ["Sport", "Game"],
  ["Sad movie", "Happy movie"],
  ["Waste of time", "Good use of time"],
  ["Least evil company", "Most evil company"],
  ["Snack", "Meal"],
  ["Unbelievable", "Believable"],
  ["Trashy", "Classy"],
  ["Smells bad", "Smells good"],
  ["Star Wars", "Star Trek"],
  ["Scary animal", "Nice animal"],
  ["Mainstream", "Niche"],
  ["Dark", "Light"],
  ["Underrated actor", "Overrated actor"],
  ["Difficult to use", "Easy to use"],
  ["Tired", "Wired"],
  ["80s", "90s"],
  ["Bad person", "Good person"],
  ["Sustenance", "Haute cuisine"],
  ["Soft", "Hard"],
  ["Normal thing to own", "Weird thing to own"],
  ["Straight", "Curvy"],
  ["Role model", "Bad Influence"],
  ["Useless major", "Useful major"],
  ["Mean person", "Nice person"],
  ["Action movie", "Adventure movie"],
  ["Short", "Long"],
  ["Worst year in history", "Best year in history"],
  ["Famous", "Infamous"],
  ["Least powerful god", "Most powerful god"],
  ["Unsexy color", "Sexy color"],
  ["Benefits you", "Benefits everyone"],
  ["Bad president", "Good president"],
  ["Weird", "Strange"],
  ["Derivative", "Original"],
  ["Etiquette", "Manners"],
  ["The worst", "The best"],
  ["Small number", "Large number"],
  ["Not enough", "Too much"],
  ["Hard to sit on", "Easy to sit on"],
  ["Talent", "Skill"],
  ["Worst era to time travel", "Best era to time travel"],
  ["Not huggable", "Huggable"],
  ["Heterogeneous", "Homogeneous"],
  ["Out of control", "In control"],
  ["Popular", "Elitist"],
  ["Non-partisan", "Partisan"],
  ["Dog name", "Cat name"],
  ["Little known fact", "Well known fact"],
  ["Socialist", "Capitalist"],
  ["Bad candy", "Good candy"],
  ["Traditional", "Radical"],
  ["Bad mouthfeel", "Good mouthfeel"],
  ["Illegal", "Legal"],
  ["Never on time", "Always on time"],
  ["Won't live to 100", "Will live to 100"],
  ["Bad Disney character", "Good Disney character"],
  ["Similar", "Identical"],
  ["Limp", "Firm"],
  ["Funny topic", "Serious topic"],
  ["Unscented", "Scented"],
  ["Horizontal", "Vertical"],
  ["Small", "Tiny"],
  ["Ugly word", "Beautiful word"],
  ["Tick", "Tock"],
  ["Bad advice", "Good advice"],
  ["Illegal", "Prohibited"],
  ["Not art", "Art"],
  ["Gossip", "News"],
  ["Guilty pleasure", "Actually just bad"],
  ["Old fashioned", "Avant garde"],
  ["True", "False"],
  ["Normal greeting", "Weird greeting"],
  ["Dictatorship", "Democracy"],
  ["Powerless", "Powerful"],
  ["Vapes", "Doesn't Vape"],
  ["Boring person", "Fun person"],
  ["Underrated book", "Overrated book"],
  ["Deep thought", "Shallow thought"],
  ["Bad school", "Good school"],
  ["Conventional wisdom", "Fringe belief"],
  ["Worst chore", "Best chore"],
  ["Endangered species", "Overpopulated species"],
  ["Blue", "Green"],
  ["Fruit", "Vegetable"],
  ["Science", "Pseudoscience"],
  ["Small talk", "Heavy topic"],
  ["Bad investment", "Good investment"],
  ["Stationary", "Mobile"],
  ["Local issue", "Global issue"],
  ["Thrilling", "Terrifying"],
  ["Nerd", "Jock"],
  ["Expected", "Unexpected"],
  ["Person you could beat up", "Person who'd beat you up"],
  ["Limited", "Infinite"],
  ["Casual event", "Formal event"],
  ["Unreasonable phobia", "Reasonable phobia"],
  ["Underrated game", "Overrated game"],
  ["Religious", "Sacrilegious"],
  ["Mild", "Spicy"],
  ["Genuine person", "Phony person"],
  ["Unnatural", "Natural"],
  ["Secret", "Public Knowledge"],
  ["Too small", "Too big"],
  ["Art", "Commerce"],
  ["One hit wonder", "Pop icon"],
  ["Unsexy Pokémon", "Sexy Pokémon"],
  ["Quiet", "Loud"],
  ["Inclusive", "Exclusive"],
  ["Bad dog (breed)", "Good dog (breed)"]
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
