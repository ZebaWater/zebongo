/**
 * ZeBongo — firebase.js
 * Central Firebase integration: auth, Firestore helpers, scoring, achievements, shop.
 */

import { initializeApp }                      from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword,
         signInWithEmailAndPassword, signOut,
         onAuthStateChanged, updateProfile }  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc,
         updateDoc, addDoc, collection, query,
         where, orderBy, limit, getDocs, deleteDoc,
         serverTimestamp, increment,
         runTransaction, arrayUnion }         from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ─── Firebase Config ──────────────────────────────────────────────────────────
// REPLACE THESE VALUES with your own project's config.
const firebaseConfig = {
  apiKey:            "AIzaSyB0phZJ788X8GcNM-po0-k-roypaxYzli4",
  authDomain:        "zebongo-d94fd.firebaseapp.com",
  projectId:         "zebongo-d94fd",
  storageBucket:     "zebongo-d94fd.firebasestorage.app",
  messagingSenderId: "955105468045",
  appId:             "1:955105468045:web:dd61a1d01ecaa1077cccc4",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

// ─── Achievements Definition ──────────────────────────────────────────────────
// Each entry: { id, name, desc, icon, check(playerData) → bool }
// 'check' receives the *updated* (post-play) player data object.
export const ACHIEVEMENTS = [
  { id: 'first_play',    name: 'First Beat',      icon: '🥁', desc: 'Play your first song',                   check: p => p.stats.totalPlays       >= 1    },
  { id: 'plays_10',      name: 'Warming Up',       icon: '🎶', desc: 'Play 10 songs',                          check: p => p.stats.totalPlays       >= 10   },
  { id: 'plays_50',      name: 'Dedicated',        icon: '🎵', desc: 'Play 50 songs',                          check: p => p.stats.totalPlays       >= 50   },
  { id: 'plays_100',     name: 'Veteran',          icon: '🏆', desc: 'Play 100 songs',                         check: p => p.stats.totalPlays       >= 100  },
  { id: 'plays_500',     name: 'Legendary',        icon: '👑', desc: 'Play 500 songs',                         check: p => p.stats.totalPlays       >= 500  },
  { id: 'combo_50',      name: 'On A Roll',        icon: '🔥', desc: 'Reach a 50-note combo',                  check: p => p.stats.highestCombo     >= 50   },
  { id: 'combo_100',     name: 'Unstoppable',      icon: '⚡', desc: 'Reach a 100-note combo',                 check: p => p.stats.highestCombo     >= 100  },
  { id: 'combo_200',     name: 'Machine',          icon: '🤖', desc: 'Reach a 200-note combo',                 check: p => p.stats.highestCombo     >= 200  },
  { id: 'full_combo',    name: 'Full House',       icon: '💯', desc: 'Get a Full Combo (no miss/bad)',          check: p => p.stats.totalFullCombo   >= 1    },
  { id: 'fc_5',          name: 'FC Collector',     icon: '🌟', desc: 'Get 5 Full Combos',                      check: p => p.stats.totalFullCombo   >= 5    },
  { id: 'perfect_100',   name: 'Flawless',         icon: '✨', desc: 'Clear a map at 100.00% accuracy',        check: p => p.stats.bestAccuracy     >= 100  },
  { id: 'perfect_98',    name: 'Near Perfection',  icon: '💎', desc: 'Clear a map at 98% or above accuracy',   check: p => p.stats.bestAccuracy     >= 98   },
  { id: 'cleared_10',    name: 'Map Conqueror',    icon: '🗺️', desc: 'Clear 10 different maps',               check: p => p.stats.totalMapsCleared >= 10   },
  { id: 'creator',       name: 'Beat Maker',       icon: '🎹', desc: 'Publish your first level',               check: p => p.stats.totalMapsCreated >= 1    },
  { id: 'maps_5',        name: 'Chartist',         icon: '📝', desc: 'Publish 5 levels',                       check: p => p.stats.totalMapsCreated >= 5    },
  { id: 'maps_10',       name: 'Studio Pro',       icon: '🎙️', desc: 'Publish 10 levels',                     check: p => p.stats.totalMapsCreated >= 10   },
  { id: 'rich_500',      name: 'Saving Up',        icon: '💰', desc: 'Hold 500 coins at once',                 check: p => p.currency               >= 500  },
  { id: 'rich_2000',     name: 'Loaded',           icon: '💸', desc: 'Hold 2000 coins at once',                check: p => p.currency               >= 2000 },
];

// ─── Shop Items ───────────────────────────────────────────────────────────────
export const SHOP_ITEMS = [
  // ─── Avatars ─────────────────────────────────────────────────────────
  { id: 'avatar_fire',      type: 'avatar', name: 'Inferno',      price: 200,  preview: '🔥', unlockedBy: null },
  { id: 'avatar_electric',  type: 'avatar', name: 'Voltage',      price: 200,  preview: '⚡', unlockedBy: null },
  { id: 'avatar_ice',       type: 'avatar', name: 'Frozen',       price: 200,  preview: '❄️', unlockedBy: null },
  { id: 'avatar_cosmic',    type: 'avatar', name: 'Cosmic',       price: 500,  preview: '🌌', unlockedBy: null },
  { id: 'avatar_ghost',     type: 'avatar', name: 'Ghost',        price: 300,  preview: '👻', unlockedBy: null },
  { id: 'avatar_skull',     type: 'avatar', name: 'Skull',        price: 400,  preview: '💀', unlockedBy: null },
  { id: 'avatar_crown',     type: 'avatar', name: 'Royalty',      price: 1000, preview: '👑', unlockedBy: null },
  { id: 'avatar_robot',     type: 'avatar', name: 'Mech',         price: 350,  preview: '🤖', unlockedBy: null },
  { id: 'avatar_alien',     type: 'avatar', name: 'Extraterrestrial', price: 400, preview: '👾', unlockedBy: null },
  { id: 'avatar_dragon',    type: 'avatar', name: 'Dragon',       price: 600,  preview: '🐉', unlockedBy: null },
  { id: 'avatar_ninja',     type: 'avatar', name: 'Shinobi',      price: 450,  preview: '🥷', unlockedBy: null },
  { id: 'avatar_demon',     type: 'avatar', name: 'Demon',        price: 700,  preview: '😈', unlockedBy: null },
  { id: 'avatar_angel',     type: 'avatar', name: 'Seraph',       price: 700,  preview: '😇', unlockedBy: null },
  { id: 'avatar_cat',       type: 'avatar', name: 'Night Cat',    price: 250,  preview: '🐱', unlockedBy: null },
  { id: 'avatar_dj',        type: 'avatar', name: 'DJ',           price: 500,  preview: '🎧', unlockedBy: null },
  { id: 'avatar_reaper',    type: 'avatar', name: 'Reaper',       price: 900,  preview: '☠️', unlockedBy: null },
  { id: 'avatar_star',      type: 'avatar', name: 'Superstar',    price: 800,  preview: '🌟', unlockedBy: null },
  // ─── Note skins ──────────────────────────────────────────────────────
  { id: 'notes_neon',       type: 'notes',  name: 'Neon',         price: 0,    preview: '💠', unlockedBy: null },
  { id: 'notes_fire',       type: 'notes',  name: 'Flame',        price: 300,  preview: '🔴', unlockedBy: null },
  { id: 'notes_matrix',     type: 'notes',  name: 'Matrix',       price: 400,  preview: '💚', unlockedBy: null },
  { id: 'notes_gold',       type: 'notes',  name: 'Golden',       price: 600,  preview: '⭐', unlockedBy: null },
  { id: 'notes_ice',        type: 'notes',  name: 'Crystal',      price: 500,  preview: '🔷', unlockedBy: null },
  { id: 'notes_void',       type: 'notes',  name: 'Void',         price: 700,  preview: '🟣', unlockedBy: null },
  { id: 'notes_blood',      type: 'notes',  name: 'Bloodbath',    price: 600,  preview: '🩸', unlockedBy: null },
  { id: 'notes_candy',      type: 'notes',  name: 'Candy',        price: 350,  preview: '🍬', unlockedBy: null },
  { id: 'notes_mono',       type: 'notes',  name: 'Monochrome',   price: 400,  preview: '⬜', unlockedBy: null },
  { id: 'notes_toxic',      type: 'notes',  name: 'Toxic',        price: 550,  preview: '☢️', unlockedBy: null },
  // ─── Titles (stored + equipped as item IDs; display via titleValue) ─
  { id: 'title_newcomer',   type: 'title',  name: 'Newcomer',     price: 0,    value: 'Newcomer',      unlockedBy: null },
  { id: 'title_ghost',      type: 'title',  name: 'Ghost',        price: 300,  value: 'Ghost',         unlockedBy: null },
  { id: 'title_champion',   type: 'title',  name: 'Champion',     price: 500,  value: 'Champion',      unlockedBy: null },
  { id: 'title_maestro',    type: 'title',  name: 'Maestro',      price: 500,  value: 'Maestro',       unlockedBy: null },
  { id: 'title_bongo_lord', type: 'title',  name: 'Bongo Lord',   price: 1000, value: 'Bongo Lord',    unlockedBy: null },
  { id: 'title_untouchable',type: 'title',  name: 'Untouchable',  price: 800,  value: 'Untouchable',   unlockedBy: null },
  { id: 'title_phantom',    type: 'title',  name: 'Phantom',      price: 600,  value: 'Phantom',       unlockedBy: null },
  { id: 'title_no_mercy',   type: 'title',  name: 'No Mercy',     price: 700,  value: 'No Mercy',      unlockedBy: null },
  { id: 'title_ascended',   type: 'title',  name: 'Ascended',     price: 1200, value: 'Ascended',      unlockedBy: null },
  { id: 'title_rhythm_god', type: 'title',  name: 'Rhythm God',   price: 1500, value: 'Rhythm God',    unlockedBy: null },
  { id: 'title_four_keys',  type: 'title',  name: 'Four Keys',    price: 200,  value: 'Four Keys',     unlockedBy: null },
  { id: 'title_machine',    type: 'title',  name: 'The Machine',  price: 900,  value: 'The Machine',   unlockedBy: null },
  { id: 'title_cursed',     type: 'title',  name: 'Cursed',       price: 400,  value: 'Cursed',        unlockedBy: null },
  { id: 'title_lurker',     type: 'title',  name: 'Lurker',       price: 350,  value: 'Lurker',        unlockedBy: null },
  { id: 'title_void_walker',type: 'title',  name: 'Void Walker',  price: 1100, value: 'Void Walker',   unlockedBy: null },
  // ─── Profile borders ────────────────────────────────────────────────
  { id: 'border_none',      type: 'border', name: 'No border',    price: 0,    preview: '⬜', unlockedBy: null },
  { id: 'border_gold',      type: 'border', name: 'Gold frame',   price: 800,  preview: '🟨', unlockedBy: null },
  { id: 'border_crimson',   type: 'border', name: 'Crimson',      price: 600,  preview: '🟥', unlockedBy: null },
  { id: 'border_void',      type: 'border', name: 'Void',         price: 700,  preview: '⬛', unlockedBy: null },
  { id: 'border_neon',      type: 'border', name: 'Neon Pulse',   price: 900,  preview: '🟩', unlockedBy: null },
  { id: 'border_ice',       type: 'border', name: 'Glacial',      price: 750,  preview: '🔷', unlockedBy: null },
  { id: 'border_rainbow',   type: 'border', name: 'Prismatic',    price: 1200, preview: '🌈', unlockedBy: null },
  { id: 'border_plasma',    type: 'border', name: 'Plasma',       price: 1000, preview: '🟪', unlockedBy: null },
  { id: 'border_ghost',     type: 'border', name: 'Wraith',       price: 850,  preview: '🔲', unlockedBy: null },
  // ─── Profile effects ────────────────────────────────────────────────
  { id: 'effect_none',      type: 'effect', name: 'No effect',    price: 0,    preview: '∅',  unlockedBy: null },
  { id: 'effect_sparkle',   type: 'effect', name: 'Sparkle',      price: 600,  preview: '✨', unlockedBy: null },
  { id: 'effect_flames',    type: 'effect', name: 'Flames',       price: 800,  preview: '🔥', unlockedBy: null },
  { id: 'effect_aurora',    type: 'effect', name: 'Aurora',       price: 1000, preview: '🌈', unlockedBy: null },
  { id: 'effect_void',      type: 'effect', name: 'Void Rift',    price: 900,  preview: '🌀', unlockedBy: null },
  { id: 'effect_rain',      type: 'effect', name: 'Acid Rain',    price: 700,  preview: '🌧️', unlockedBy: null },
  { id: 'effect_glitch',    type: 'effect', name: 'Glitch',       price: 1100, preview: '📺', unlockedBy: null },
  { id: 'effect_midnight',  type: 'effect', name: 'Midnight',     price: 500,  preview: '🌙', unlockedBy: null },
];

/** Get a shop item by id (handy in the UI). */
export function getShopItem(id) { return SHOP_ITEMS.find(i => i.id === id); }

/** Given an equipped-title ID (or legacy value), return the display string. */
export function titleDisplay(titleRef) {
  if (!titleRef) return '';
  const byId = SHOP_ITEMS.find(i => i.type === 'title' && i.id === titleRef);
  if (byId) return byId.value;
  // Legacy: some older docs stored the display string directly
  return titleRef;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function _defaultPlayer(uid, username, email) {
  return {
    uid,
    username,
    // Lowercase copy used for case-insensitive search & uniqueness checks
    usernameLower: (username || '').toLowerCase(),
    email,
    // Admin/moderation. Only admins can verify levels. isAdmin is protected
    // by Firestore rules — a regular user cannot set this on themselves.
    isAdmin: false,
    // ─── Public profile fields (optional, all default to empty) ──────
    bio:          '',      // free-text, up to 280 chars
    country:      '',      // ISO-2 code e.g. 'HR', 'US'
    pronouns:     '',      // short free-text 'she/her', 'they/them'
    birthday:     '',      // ISO date string 'YYYY-MM-DD' or empty
    showBirthday: true,    // whether to display month/day publicly
    // Avatar upload (imgBB). When either is empty we fall back to avatarId emoji.
    profilePicUrl:       '',
    profilePicDeleteUrl: '',   // kept so the user can manually clean up imgBB
    // Custom appearance
    accentColor: '#FFE566',     // CSS hex used as accent on their profile page
    borderId:    'border_none', // equipped profile-frame
    effectId:    'effect_none', // equipped profile effect
    // ─── Cosmetics ───────────────────────────────────────────────────
    avatarId:     'default',
    noteSkinsId:  'notes_neon',
    equippedTitle: 'title_newcomer',
    // ─── Economy ─────────────────────────────────────────────────────
    currency: 100,
    xp:       0,
    level:    1,
    // ─── Play statistics ─────────────────────────────────────────────
    stats: {
      totalPlays:        0,
      totalScore:        0,
      totalPerfects:     0,
      totalGreats:       0,
      totalGoods:        0,
      totalBads:         0,
      totalMisses:       0,
      bestAccuracy:      0,
      totalMapsCleared:  0,
      totalFullCombo:    0,
      totalMapsCreated:  0,
      highestCombo:      0,
    },
    // ─── Progress ────────────────────────────────────────────────────
    achievements:       [],
    unlockedAvatars:    ['default'],
    unlockedNoteColors: ['notes_neon'],
    unlockedTitles:     ['title_newcomer'],
    unlockedBorders:    ['border_none'],
    unlockedEffects:    ['effect_none'],
    // ─── Social ──────────────────────────────────────────────────────
    friendCount: 0,
    unreadCount: 0,
    // ─── Metadata ────────────────────────────────────────────────────
    createdAt: serverTimestamp(),
    lastSeen:  serverTimestamp(),
  };
}

/**
 * XP thresholds: level = floor(sqrt(xp/100)) + 1
 * e.g. level 2 = 100 XP, level 5 = 1600 XP, level 10 = 8100 XP
 */
export function xpToLevel(xp) {
  return Math.floor(Math.sqrt((xp || 0) / 100)) + 1;
}

export function xpForNextLevel(xp) {
  const lv = xpToLevel(xp);
  const nextLvXP = Math.pow(lv, 2) * 100; // XP needed to reach next level
  const thisLvXP = Math.pow(lv - 1, 2) * 100;
  return { current: xp - thisLvXP, required: nextLvXP - thisLvXP };
}

/**
 * Currency reward formula:
 *   reward = floor(difficulty_stars * (1 + accuracy_as_0_to_1))
 *
 * So a perfect clear of a 5★ map gives 5*(1+1) = 10 coins.
 * A 95% clear of a 3★ map gives floor(3*1.95) = 5 coins.
 *
 * IMPORTANT: Only *verified* levels earn coins. Unverified (user-submitted
 * but not yet reviewed by an admin) levels give 0. This prevents players
 * from farming coins on trivially easy self-made levels.
 *
 * Notes:
 *  - Accuracy is clamped to 0..100 because the engine's accuracy metric
 *    can drift above 100 on partial-note runs due to floating-point math.
 *  - The old flat +50 FC bonus and tiered-accuracy bonuses are gone —
 *    accuracy now enters the formula multiplicatively instead.
 *  - "isFullCombo" is still computed so we can flag it in the UI / stats,
 *    it just no longer grants a cash bonus.
 */
function _calcReward(results, level) {
  const isFc = results.counts.MISS === 0 && results.counts.BAD === 0;
  if (!level || !level.isVerified) {
    return { reward: 0, isFullCombo: isFc, unverified: true };
  }
  const diff = Math.max(1, Math.min(6, level.difficulty || 1));
  const acc  = Math.max(0, Math.min(100, results.accuracy || 0)) / 100;
  const reward = Math.floor(diff * (1 + acc));
  return { reward, isFullCombo: isFc, unverified: false };
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────

export async function registerUser(email, password, username) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: username });
  await setDoc(doc(db, 'players', cred.user.uid), _defaultPlayer(cred.user.uid, username, email));
  return cred.user;
}

export async function loginUser(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  // Touch lastSeen for presence — but don't fail login if the player doc
  // is missing (self-heal runs on the next getPlayer call).
  try {
    await updateDoc(doc(db, 'players', cred.user.uid), { lastSeen: serverTimestamp() });
  } catch (_) {}
  return cred.user;
}

export function logoutUser() { return signOut(auth); }

export function onAuthChange(cb) { return onAuthStateChanged(auth, cb); }

// ─── PLAYERS ─────────────────────────────────────────────────────────────────

export async function getPlayer(uid) {
  const snap = await getDoc(doc(db, 'players', uid));
  if (snap.exists()) return snap.data();

  // Self-heal: if a player is logged in but has no doc (edge case where
  // registration partially failed, or the doc was deleted), create a default
  // doc so the profile / menu pages don't break.
  const authUser = auth.currentUser;
  if (authUser && authUser.uid === uid) {
    const username = authUser.displayName
      || ('Player-' + uid.slice(0, 6).toUpperCase());
    const defaults = _defaultPlayer(uid, username, authUser.email || '');
    try {
      await setDoc(doc(db, 'players', uid), defaults);
      return defaults;
    } catch (e) {
      console.warn('getPlayer self-heal failed:', e.message);
    }
  }
  return null;
}

export async function getTopPlayers(count = 20) {
  // Fetch a larger batch and sort client-side to avoid requiring a composite
  // index on the nested field stats.totalScore.
  const snap = await getDocs(query(collection(db, 'players'), limit(count * 5)));
  const players = snap.docs.map(d => d.data());
  players.sort((a, b) => ((b.stats?.totalScore || 0) - (a.stats?.totalScore || 0)));
  return players.slice(0, count).map((p, i) => ({ rank: i + 1, ...p }));
}

export async function searchPlayers(username, count = 10) {
  // Firestore prefix search — requires an index on 'username'
  const q = query(
    collection(db, 'players'),
    where('username', '>=', username),
    where('username', '<=', username + '\uf8ff'),
    limit(count)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}

export async function updatePlayerProfile(uid, updates) {
  await updateDoc(doc(db, 'players', uid), updates);
}

export async function equipCosmetic(uid, type, itemId) {
  const fieldMap = {
    avatar: 'avatarId',
    notes:  'noteSkinsId',
    title:  'equippedTitle',
    border: 'borderId',
    effect: 'effectId',
  };
  const field = fieldMap[type];
  if (!field) throw new Error(`Unknown cosmetic type: ${type}`);
  // Always store the item ID — display strings are derived via titleDisplay().
  await updateDoc(doc(db, 'players', uid), { [field]: itemId });
}

// ─── LEVELS ──────────────────────────────────────────────────────────────────

export async function createLevel(uid, username, chartData) {
  const docData = {
    title:         chartData.title       || 'Untitled',
    artist:        chartData.artist      || 'Unknown',
    creatorUid:    uid,
    creatorUsername: username,
    audioUrl:      chartData.audioUrl    || null,
    coverUrl:      chartData.coverUrl    || null,
    bpm:           chartData.bpm         || 128,
    offset:        chartData.offset      ?? 0,
    difficulty:    chartData.difficulty  ?? 1,
    noteSpeed:     chartData.noteSpeed   ?? 1.0,
    hpMode:        chartData.hpMode      ?? 'Normal',
    durationBeats: chartData.durationBeats || 32,
    tags:          chartData.tags        || [],
    notes:         chartData.notes       || [],
    noteCount:     chartData.noteCount   ?? (chartData.notes?.length || 0),
    isPublished:   false,
    // Verification state: set by admins via verifyLevel(). Unverified levels
    // still appear in Browse (once published) but do NOT earn the player
    // any coins on clear.
    isVerified:    false,
    playCount:     0,
    likeCount:     0,
    createdAt:     serverTimestamp(),
    updatedAt:     serverTimestamp(),
  };
  const ref = await addDoc(collection(db, 'levels'), docData);
  return ref.id;
}

export async function updateLevel(levelId, uid, chartData) {
  const ref = doc(db, 'levels', levelId);
  const snap = await getDoc(ref);
  if (!snap.exists())                    throw new Error('Level not found');
  if (snap.data().creatorUid !== uid)    throw new Error('Not authorized to edit this level');
  await updateDoc(ref, {
    title:         chartData.title,
    artist:        chartData.artist,
    audioUrl:      chartData.audioUrl    || null,
    bpm:           chartData.bpm,
    offset:        chartData.offset,
    difficulty:    chartData.difficulty,
    noteSpeed:     chartData.noteSpeed   ?? 1.0,
    hpMode:        chartData.hpMode      ?? 'Normal',
    durationBeats: chartData.durationBeats,
    tags:          chartData.tags        || [],
    notes:         chartData.notes,
    noteCount:     chartData.noteCount   ?? (chartData.notes?.length || 0),
    updatedAt:     serverTimestamp(),
  });
}

export async function publishLevel(levelId, uid) {
  const ref       = doc(db, 'levels', levelId);
  const playerRef = doc(db, 'players', uid);
  return runTransaction(db, async (tx) => {
    const [levelSnap, playerSnap] = await Promise.all([tx.get(ref), tx.get(playerRef)]);
    if (!levelSnap.exists())                   throw new Error('Level not found');
    if (levelSnap.data().creatorUid !== uid)   throw new Error('Not authorized');

    const wasPublishedBefore = !!levelSnap.data().hasBeenPublished;

    tx.update(ref, {
      isPublished: true,
      hasBeenPublished: true,
      updatedAt: serverTimestamp(),
    });

    // Count the map the first time it goes public, and only then check
    // creator-achievements so "Beat Maker" actually unlocks on publish.
    if (!wasPublishedBefore && playerSnap.exists()) {
      const player = playerSnap.data();
      const newCreated = (player.stats?.totalMapsCreated || 0) + 1;
      const simPlayer = {
        ...player,
        stats: { ...player.stats, totalMapsCreated: newCreated },
      };
      const earned = ACHIEVEMENTS
        .filter(a => !(player.achievements || []).includes(a.id) && a.check(simPlayer))
        .map(a => a.id);
      const updates = {
        'stats.totalMapsCreated': increment(1),
        lastSeen: serverTimestamp(),
      };
      if (earned.length > 0) updates.achievements = arrayUnion(...earned);
      tx.update(playerRef, updates);
    }
  });
}

export async function unpublishLevel(levelId, uid) {
  const ref = doc(db, 'levels', levelId);
  const snap = await getDoc(ref);
  if (!snap.exists())                 throw new Error('Level not found');
  if (snap.data().creatorUid !== uid) throw new Error('Not authorized');
  await updateDoc(ref, { isPublished: false, updatedAt: serverTimestamp() });
}

/**
 * Permanently delete a level. Only the creator can delete their own level.
 * NOTE: this doesn't cascade-delete subcollections (leaderboard entries).
 * Those orphan records are harmless but show up if someone replays. For a
 * small-scale game that's acceptable; production would use a Cloud Function.
 */
export async function deleteLevel(levelId, uid) {
  const ref = doc(db, 'levels', levelId);
  const snap = await getDoc(ref);
  if (!snap.exists())                 throw new Error('Level not found');
  if (snap.data().creatorUid !== uid) throw new Error('Not authorized');
  await deleteDoc(ref);
}

// ─── ADMIN ───────────────────────────────────────────────────────────────

/** Returns true if the given player doc has isAdmin === true. */
export function isAdminPlayer(playerData) {
  return !!(playerData && playerData.isAdmin === true);
}

/**
 * Check whether the currently-signed-in user is an admin by re-reading
 * their player doc. Network round-trip — cache the result in your page.
 */
export async function isCurrentUserAdmin() {
  const u = auth.currentUser;
  if (!u) return false;
  const snap = await getDoc(doc(db, 'players', u.uid));
  return snap.exists() && snap.data().isAdmin === true;
}

/**
 * Mark a level as verified. Only admins are allowed by Firestore rules;
 * the client-side check here is a fast-fail — the real enforcement is
 * server-side in firestore.rules.
 */
export async function verifyLevel(levelId, adminUid) {
  // Load the admin's own doc to double-check before making the call
  const adminSnap = await getDoc(doc(db, 'players', adminUid));
  if (!adminSnap.exists() || adminSnap.data().isAdmin !== true) {
    throw new Error('Only admins can verify levels');
  }
  await updateDoc(doc(db, 'levels', levelId), {
    isVerified:    true,
    verifiedBy:    adminUid,
    verifiedAt:    serverTimestamp(),
    updatedAt:     serverTimestamp(),
  });
}

export async function unverifyLevel(levelId, adminUid) {
  const adminSnap = await getDoc(doc(db, 'players', adminUid));
  if (!adminSnap.exists() || adminSnap.data().isAdmin !== true) {
    throw new Error('Only admins can unverify levels');
  }
  await updateDoc(doc(db, 'levels', levelId), {
    isVerified:    false,
    verifiedBy:    null,
    verifiedAt:    null,
    updatedAt:     serverTimestamp(),
  });
}

/**
 * Admin-only: list published-but-unverified levels so admins can triage.
 * Uses a single where() clause (no composite index needed); client-side
 * filters out already-verified ones.
 */
export async function getUnverifiedLevels(count = 50) {
  const snap = await getDocs(query(
    collection(db, 'levels'),
    where('isPublished', '==', true),
    limit(150)
  ));
  const levels = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(l => !l.isVerified);
  levels.sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  return levels.slice(0, count);
}

export async function getLevel(levelId) {
  const snap = await getDoc(doc(db, 'levels', levelId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/**
 * Get published levels. Supports search, sort (client-side), and difficulty filter.
 * Uses only a single where() clause so no composite indexes are required.
 */

/**
 * Returns true when a level matches the plain-text search query.
 * Checks: title, artist, creator username, HP mode, note speed (e.g. "2x" or "2.5"),
 * difficulty label (e.g. "★★★"), and the special difficulty names
 * (easy, normal, hard, expert, master, phd).
 */
function matchesSearch(l, search) {
  const q = search.toLowerCase().trim();
  if (!q) return true;

  const DIFF_NAMES = ['', 'easy', 'normal', 'hard', 'expert', 'master', 'phd'];
  const diffName   = DIFF_NAMES[l.difficulty] || '';
  const diffStars  = '★'.repeat(l.difficulty || 0);
  // Allow "2x" / "2.5x" / "2.0x" style speed queries
  const speedStr   = l.noteSpeed ? String(l.noteSpeed) : '';
  const speedAlt   = l.noteSpeed ? String(l.noteSpeed) + 'x' : '';
  const verTag     = l.isVerified ? 'verified' : 'unverified';

  return (
    (l.title           || '').toLowerCase().includes(q) ||
    (l.artist          || '').toLowerCase().includes(q) ||
    (l.creatorUsername || '').toLowerCase().includes(q) ||
    (l.hpMode          || '').toLowerCase().includes(q) ||
    diffName.includes(q) ||
    diffStars.includes(q) ||
    speedStr.startsWith(q) ||
    speedAlt.startsWith(q.replace('×','x')) ||
    verTag.includes(q)
  );
}

export async function getLevels({ search = '', sortBy = 'createdAt', difficulty = null, verifiedOnly = false, count = 20 } = {}) {
  // Single where() — no composite index needed.
  const snap = await getDocs(query(
    collection(db, 'levels'),
    where('isPublished', '==', true),
    limit(150)   // generous batch; filtering + sorting done client-side
  ));
  let levels = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  if (difficulty !== null) {
    levels = levels.filter(l => l.difficulty === difficulty);
  }
  if (verifiedOnly) {
    levels = levels.filter(l => l.isVerified === true);
  }
  if (search) {
    levels = levels.filter(l => matchesSearch(l, search));
  }

  // Client-side sort descending
  levels.sort((a, b) => {
    if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
      return (b[sortBy]?.seconds || 0) - (a[sortBy]?.seconds || 0);
    }
    return (b[sortBy] || 0) - (a[sortBy] || 0);
  });

  return levels.slice(0, count);
}

export async function getMyLevels(uid) {
  // Single where() — no composite index needed; sort client-side.
  const snap = await getDocs(query(
    collection(db, 'levels'),
    where('creatorUid', '==', uid)
  ));
  const levels = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return levels.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

// ─── SCORES ──────────────────────────────────────────────────────────────────

/**
 * Submit a play result. This single transaction:
 *  1. Updates player stats (plays, score, accuracy, combo, etc.)
 *  2. Increments level play count
 *  3. Updates player's personal-best leaderboard entry (only if score is higher)
 *  4. Appends to player's play history subcollection
 *  5. Earns currency reward
 *  6. Grants new XP and recalculates level
 *  7. Unlocks newly earned achievements
 *
 * Returns { reward, isFullCombo, newAchievements, isFirstClear, isNewBest }
 */
export async function submitScore(uid, levelId, results) {
  const playerRef  = doc(db, 'players', uid);
  const levelRef   = doc(db, 'levels', levelId);
  const lbRef      = doc(db, 'levels', levelId, 'leaderboard', uid);
  const histRef    = doc(collection(db, 'players', uid, 'playHistory'));

  return runTransaction(db, async (tx) => {
    const [playerSnap, levelSnap, lbSnap] = await Promise.all([
      tx.get(playerRef), tx.get(levelRef), tx.get(lbRef),
    ]);

    if (!playerSnap.exists()) throw new Error('Player document not found');
    if (!levelSnap.exists())  throw new Error('Level document not found');

    const player      = playerSnap.data();
    const level       = levelSnap.data();
    const prevBest    = lbSnap.exists() ? lbSnap.data() : null;

    // Guard: legacy/migrated player docs may not have a full stats object.
    // Read via a local default so we never throw
    // `Cannot read properties of undefined`. The server-side increment()
    // ops below auto-create missing fields.
    const stats = player.stats || {};

    // results.failed is set by engine.getResults() when HP hit 0. We treat
    // fails specially below: no coins, no leaderboard entry, no "maps
    // cleared" stat bump.
    const failed = !!results.failed;

    // "First verified clear" tracking. The earlier logic was
    //   isFirstClear = !prevBest
    // which permanently burned the first-clear flag if the player's very
    // first play was unverified (or a fail). Now we stamp
    // `firstVerifiedClearAt` on the leaderboard doc the first time the
    // player clears a *verified* map, and gate the bonus on that instead.
    const { reward, isFullCombo, unverified } = _calcReward(results, level);
    const priorFirstClear = !!prevBest?.firstVerifiedClearAt;
    const isFirstClear    = !failed && !unverified && !priorFirstClear;
    const isNewBest       = !failed && (!prevBest || results.score > prevBest.score);
    const bonusFirstClear = isFirstClear ? 30 : 0;
    const totalReward     = failed ? 0 : reward + bonusFirstClear;

    // Compute updated fields for achievement checking
    const newPlays    = (stats.totalPlays    || 0) + 1;
    const newBestAcc  = Math.max(stats.bestAccuracy  || 0, results.accuracy);
    const newHiCombo  = Math.max(stats.highestCombo  || 0, results.maxCombo);
    const newFC       = (stats.totalFullCombo || 0) + ((isFullCombo && !failed) ? 1 : 0);
    const newCleared  = (stats.totalMapsCleared || 0) + (isFirstClear ? 1 : 0);
    const newXP       = (player.xp || 0) + Math.floor(results.accuracy * 1.5);
    const newCurrency = (player.currency || 0) + totalReward;

    // Simulated updated player state for achievement evaluation
    const simPlayer = {
      ...player,
      currency: newCurrency,
      xp: newXP,
      stats: {
        ...stats,
        totalPlays:       newPlays,
        bestAccuracy:     newBestAcc,
        highestCombo:     newHiCombo,
        totalFullCombo:   newFC,
        totalMapsCleared: newCleared,
      },
    };
    const earned = ACHIEVEMENTS
      .filter(a => !(player.achievements || []).includes(a.id) && a.check(simPlayer))
      .map(a => a.id);

    // --- Apply writes ---

    const statsUpdate = {
      'stats.totalPlays':       increment(1),
      'stats.totalScore':       increment(results.score),
      'stats.totalPerfects':    increment(results.counts.PERFECT || 0),
      'stats.totalGreats':      increment(results.counts.GREAT   || 0),
      'stats.totalGoods':       increment(results.counts.GOOD    || 0),
      'stats.totalBads':        increment(results.counts.BAD     || 0),
      'stats.totalMisses':      increment(results.counts.MISS    || 0),
      'stats.bestAccuracy':     newBestAcc,
      'stats.highestCombo':     newHiCombo,
      'stats.totalFullCombo':   newFC,
      'stats.totalMapsCleared': newCleared,
      currency:                 increment(totalReward),
      xp:                       newXP,
      level:                    xpToLevel(newXP),
      lastSeen:                 serverTimestamp(),
    };
    if (earned.length > 0) statsUpdate.achievements = arrayUnion(...earned);

    tx.update(playerRef,  statsUpdate);
    // NOTE: playCount on the level doc is NOT updated inside this
    // transaction. A non-creator bumping another user's level doc can fail
    // the whole transaction if the "narrow playCount" rule isn't in place
    // or doesn't match precisely, which silently kills coin awards and
    // leaderboard writes. We do that as a separate best-effort update
    // AFTER the transaction succeeds (see below), so a rules hiccup only
    // desyncs a cosmetic counter rather than eating the entire play.

    if (isNewBest) {
      // Preserve firstVerifiedClearAt if prior entry had it; stamp it now
      // if this is the first verified clear. Otherwise leave null.
      const firstVerifiedClearAt = prevBest?.firstVerifiedClearAt
        || (isFirstClear ? serverTimestamp() : null);
      tx.set(lbRef, {
        uid,
        username:      player.username,
        avatarId:      player.avatarId,
        profilePicUrl: player.profilePicUrl || '',
        borderId:      player.borderId || 'border_none',
        equippedTitle: player.equippedTitle || '',
        score:         results.score,
        accuracy:      results.accuracy,
        maxCombo:      results.maxCombo,
        counts:        results.counts,
        isFullCombo,
        firstVerifiedClearAt,
        playedAt:      serverTimestamp(),
      });
    } else if (isFirstClear) {
      // Not a new best (e.g. unverified play had a higher score), but it
      // IS our first verified clear — stamp the flag without clobbering
      // the score, so we don't re-award the first-clear bonus next time.
      tx.update(lbRef, { firstVerifiedClearAt: serverTimestamp() });
    }

    tx.set(histRef, {
      levelId,
      levelTitle:  level.title,
      levelArtist: level.artist,
      score:       results.score,
      accuracy:    results.accuracy,
      maxCombo:    results.maxCombo,
      counts:      results.counts,
      isFullCombo,
      playedAt:    serverTimestamp(),
    });

    return { reward: totalReward, isFullCombo, unverified: !!unverified, newAchievements: earned, isFirstClear, isNewBest };
  }).then(result => {
    // Best-effort: bump playCount on the level doc after the core
    // transaction has already committed. If this fails (e.g. rules don't
    // allow a non-creator to update someone else's level), the player's
    // score/coins/stats have already been saved — we just miss one
    // increment on a cosmetic counter. Logged but not surfaced.
    updateDoc(doc(db, 'levels', levelId), { playCount: increment(1) })
      .catch(e => console.warn('playCount bump skipped:', e?.message || e));
    return result;
  });
}

// ─── LEADERBOARD ─────────────────────────────────────────────────────────────

export async function getLeaderboard(levelId, count = 15) {
  const q = query(
    collection(db, 'levels', levelId, 'leaderboard'),
    orderBy('score', 'desc'),
    limit(count)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d, i) => ({ rank: i + 1, ...d.data() }));
}

export async function getPlayerRankOnLevel(levelId, uid) {
  const mySnap = await getDoc(doc(db, 'levels', levelId, 'leaderboard', uid));
  if (!mySnap.exists()) return null;
  const myScore = mySnap.data().score;
  const q = query(
    collection(db, 'levels', levelId, 'leaderboard'),
    where('score', '>', myScore)
  );
  const above = await getDocs(q);
  return { rank: above.size + 1, ...mySnap.data() };
}

// ─── PLAY HISTORY ────────────────────────────────────────────────────────────

export async function getPlayHistory(uid, count = 30) {
  const q = query(
    collection(db, 'players', uid, 'playHistory'),
    orderBy('playedAt', 'desc'),
    limit(count)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── LIKES ───────────────────────────────────────────────────────────────────

export async function getLikedLevels(uid) {
  const snap = await getDoc(doc(db, 'players', uid, 'meta', 'likes'));
  return snap.exists() ? (snap.data().levelIds || []) : [];
}

export async function toggleLike(uid, levelId) {
  const likeRef  = doc(db, 'players', uid, 'meta', 'likes');
  const levelRef = doc(db, 'levels', levelId);
  return runTransaction(db, async (tx) => {
    const likeSnap = await tx.get(likeRef);
    const ids = likeSnap.exists() ? (likeSnap.data().levelIds || []) : [];
    const liked = ids.includes(levelId);
    tx.set(likeRef,   { levelIds: liked ? ids.filter(i => i !== levelId) : [...ids, levelId] });
    tx.update(levelRef, { likeCount: increment(liked ? -1 : 1) });
    return !liked;
  });
}

// ─── SHOP ────────────────────────────────────────────────────────────────────

export async function purchaseItem(uid, itemId) {
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) throw new Error('Item not found in shop');

  const playerRef = doc(db, 'players', uid);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(playerRef);
    if (!snap.exists()) throw new Error('Player not found');
    const player = snap.data();

    const field =
      item.type === 'avatar' ? 'unlockedAvatars' :
      item.type === 'notes'  ? 'unlockedNoteColors' :
      item.type === 'title'  ? 'unlockedTitles' :
      item.type === 'border' ? 'unlockedBorders' :
      item.type === 'effect' ? 'unlockedEffects' : null;
    if (!field) throw new Error('Unknown item type');
    if ((player[field] || []).includes(itemId)) throw new Error('Already owned');
    if (player.currency < item.price)           throw new Error('Not enough coins');

    tx.update(playerRef, {
      currency: increment(-item.price),
      [field]:  arrayUnion(itemId),
    });
    return item;
  });
}

// ─── UTILITIES ───────────────────────────────────────────────────────────────

/** Convert a Firestore Timestamp or null to a JS Date string. */
export function tsToDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function difficultyLabel(n) {
  return ['?','★','★★','★★★','★★★★','★★★★★','★★★★★★'][n] || '?';
}

export function difficultyColor(n) {
  return ['#888','#4DC4FF','#88FF99','#FFE566','#FFB347','#FF4D6D','#C084FC'][n] || '#888';
}

/** Returns true when a difficulty is the special PhD tier (6). */
export function difficultyIsPhD(n) {
  return n === 6;
}

// ─── PROFILE EDITS ───────────────────────────────────────────────────────────

/**
 * Whitelisted profile edits. Only a fixed set of fields can be changed
 * through this function — anything else is silently dropped. This keeps
 * callers honest and prevents a caller from accidentally (or deliberately)
 * writing to protected fields like isAdmin, currency, stats, etc.
 */
const PROFILE_EDIT_FIELDS = new Set([
  'bio', 'country', 'pronouns', 'birthday', 'showBirthday',
  'accentColor', 'profilePicUrl', 'profilePicDeleteUrl',
]);

export async function updateProfileFields(uid, updates) {
  const clean = {};
  for (const k of Object.keys(updates)) {
    if (PROFILE_EDIT_FIELDS.has(k)) clean[k] = updates[k];
  }
  // Light validation
  if (clean.bio       && clean.bio.length       > 280) clean.bio      = clean.bio.slice(0, 280);
  if (clean.pronouns  && clean.pronouns.length  > 24)  clean.pronouns = clean.pronouns.slice(0, 24);
  if (clean.country   && clean.country.length   > 3)   clean.country  = clean.country.slice(0, 3).toUpperCase();
  if (Object.keys(clean).length === 0) return;
  clean.lastSeen = serverTimestamp();
  await updateDoc(doc(db, 'players', uid), clean);
}

// ─── PRESENCE ────────────────────────────────────────────────────────────────

/**
 * Updates lastSeen for the current user. Call this on page load, and on an
 * interval (e.g. every 60s) if you want a "recently active" feel.
 * Swallows errors silently — it's fire-and-forget.
 */
export async function pingPresence(uid) {
  try {
    await updateDoc(doc(db, 'players', uid), { lastSeen: serverTimestamp() });
  } catch (_) {}
}

/** Returns true if lastSeen is within the last N seconds (default 180). */
export function isOnline(player, windowSeconds = 180) {
  if (!player?.lastSeen) return false;
  const ms = player.lastSeen.toMillis ? player.lastSeen.toMillis() : new Date(player.lastSeen).getTime();
  return (Date.now() - ms) < windowSeconds * 1000;
}

// ─── PUBLIC PROFILE LOOKUPS ──────────────────────────────────────────────────

export async function getPublicProfile(uid) {
  const snap = await getDoc(doc(db, 'players', uid));
  if (!snap.exists()) return null;
  const p = snap.data();
  // Scrub anything that shouldn't be visible to other users
  const { email, ...rest } = p;
  return rest;
}

// ─── FRIENDS ─────────────────────────────────────────────────────────────────

/**
 * Friend model: two collections kept in sync by the app (client-side).
 *   players/{uid}/friends/{friendUid}  →  { since, username, avatarId }
 * Friend requests flow through the inbox (`type: 'friend_request'`). Accepting
 * a request creates the friends doc on both sides; declining just deletes
 * the inbox message.
 *
 * We denormalize username/avatarId onto the friends doc so the friends list
 * renders without a second round-trip per friend. If a user renames, their
 * friends' lists will still show the old name until the next ping from that
 * user — acceptable for a small-scale game.
 */
export async function listFriends(uid) {
  const snap = await getDocs(collection(db, 'players', uid, 'friends'));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

export async function areFriends(uid, otherUid) {
  const snap = await getDoc(doc(db, 'players', uid, 'friends', otherUid));
  return snap.exists();
}

export async function sendFriendRequest(fromUid, toUid, fromPlayer) {
  if (fromUid === toUid) throw new Error("You can't friend yourself");
  if (await areFriends(fromUid, toUid)) throw new Error('Already friends');

  // NOTE: We cannot query the recipient's inbox to check for an existing
  // pending request — Firestore rules only allow isSelf(uid) to read an
  // inbox, so any getDocs on toUid's inbox throws a permissions error for
  // the sender. The areFriends() check above covers the main duplicate path.
  // A rare double-tap is harmless: the recipient just sees two requests and
  // accepting either one works correctly.

  await addDoc(collection(db, 'players', toUid, 'inbox'), {
    type:         'friend_request',
    from:         fromUid,
    fromUsername: fromPlayer.username,
    fromAvatarId: fromPlayer.avatarId || 'default',
    body:         '',
    read:         false,
    sentAt:       serverTimestamp(),
  });
  // NOTE: Same as sendMessage — we cannot write to the recipient's player doc.
  // unreadCount is recomputed by _syncUnreadCount on the next getInbox() call.
}

/**
 * Accept an inbox friend_request message: creates friends docs on both
 * sides, deletes the inbox message, increments friendCount on both users.
 * We do this as a transaction — if any of the writes fail the whole
 * operation rolls back so we never end up with half-applied friendships.
 */
export async function acceptFriendRequest(myUid, inboxMsgId, myPlayer) {
  const msgRef = doc(db, 'players', myUid, 'inbox', inboxMsgId);
  const msgSnap = await getDoc(msgRef);
  if (!msgSnap.exists()) throw new Error('Request not found');
  const msg = msgSnap.data();
  if (msg.type !== 'friend_request') throw new Error('Not a friend request');

  const fromUid = msg.from;
  const fromRef = doc(db, 'players', fromUid);
  const fromSnap = await getDoc(fromRef);
  if (!fromSnap.exists()) throw new Error('Requesting user no longer exists');
  const fromPlayer = fromSnap.data();

  const myFriendRef   = doc(db, 'players', myUid, 'friends', fromUid);
  const theirFriendRef = doc(db, 'players', fromUid, 'friends', myUid);

  await runTransaction(db, async (tx) => {
    const now = serverTimestamp();
    tx.set(myFriendRef,    { since: now, username: fromPlayer.username, avatarId: fromPlayer.avatarId || 'default' });
    tx.set(theirFriendRef, { since: now, username: myPlayer.username,   avatarId: myPlayer.avatarId   || 'default' });
    // Only update OUR OWN player doc in the transaction. Writing to fromRef
    // would throw permissions error (isSelf rule). Sender count resynced below.
    tx.update(doc(db, 'players', myUid), { friendCount: increment(1) });
    tx.delete(msgRef);
  });
  // Resync sender count outside the transaction (best-effort, no rollback risk).
  syncFriendCount(fromUid).catch(() => {});
}

export async function removeFriend(myUid, otherUid) {
  await Promise.all([
    deleteDoc(doc(db, 'players', myUid,    'friends', otherUid)),
    deleteDoc(doc(db, 'players', otherUid, 'friends', myUid)),
  ]);
  // Each user can only update their own player doc (isSelf rule).
  // We resync both counts from the actual subcollection size — our own
  // immediately, the other user's as a best-effort (they will also resync
  // on their next load). This avoids the -1 drift caused by the old code
  // where one side's decrement was silently swallowed by the catch.
  await syncFriendCount(myUid).catch(() => {});
  syncFriendCount(otherUid).catch(() => {});
}

/**
 * Resyncs a user's friendCount field to the actual size of their /friends
 * subcollection. Call this after any add/remove operation to keep the
 * denormalized counter accurate without needing cross-user writes.
 * Only works when called by the owner of the doc (isSelf rule); for the
 * other party we fire-and-forget and they self-heal on next load.
 */
export async function syncFriendCount(uid) {
  const snap = await getDocs(collection(db, 'players', uid, 'friends'));
  await updateDoc(doc(db, 'players', uid), { friendCount: snap.size });
}

/**
 * Resyncs a user's unreadCount field from their actual inbox.
 * Call this on page load to fix any drift from cross-user write failures.
 */
export async function syncUnreadCount(uid) {
  const snap = await getDocs(collection(db, 'players', uid, 'inbox'));
  const unread = snap.docs.filter(d => !d.data().read).length;
  await updateDoc(doc(db, 'players', uid), { unreadCount: unread });
}

// ─── INBOX / MESSAGING ───────────────────────────────────────────────────────

const INBOX_MAX_MSGS    = 50;                 // keep the newest N per inbox
const INBOX_EXPIRE_DAYS = 30;                 // auto-delete read messages after this

export async function sendMessage(fromUid, toUid, fromPlayer, body) {
  if (!body || !body.trim()) throw new Error('Message is empty');
  if (body.length > 500)     throw new Error('Message too long (500 char max)');
  if (fromUid === toUid)     throw new Error("Can't message yourself");

  await addDoc(collection(db, 'players', toUid, 'inbox'), {
    type:         'message',
    from:         fromUid,
    fromUsername: fromPlayer.username,
    fromAvatarId: fromPlayer.avatarId || 'default',
    body:         body.slice(0, 500),
    read:         false,
    sentAt:       serverTimestamp(),
  });
  // NOTE: We intentionally do NOT increment unreadCount on the recipient's
  // player doc here. Firestore rules only allow a user to update their own
  // player doc (isSelf), so a sender writing to the recipient's doc would
  // throw a permissions error. The unreadCount is recomputed accurately by
  // _syncUnreadCount whenever the recipient calls getInbox().
}

/**
 * Fetch inbox. Performs opportunistic cleanup: deletes read messages older
 * than INBOX_EXPIRE_DAYS, and if count > INBOX_MAX_MSGS trims the oldest
 * read ones first, then the oldest overall. Without Cloud Functions this
 * is the best we can do for bloat control.
 */
export async function getInbox(uid) {
  const col = collection(db, 'players', uid, 'inbox');
  // Order newest-first for display
  const snap = await getDocs(query(col, orderBy('sentAt', 'desc'), limit(100)));
  const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Opportunistic cleanup
  const now = Date.now();
  const expireBefore = now - INBOX_EXPIRE_DAYS * 86400 * 1000;
  const tooOld = msgs.filter(m => {
    if (!m.read) return false;   // never auto-delete unread
    const ts = m.sentAt?.toMillis?.() ?? 0;
    return ts > 0 && ts < expireBefore;
  });
  const overCap = msgs.length > INBOX_MAX_MSGS
    ? msgs.slice(INBOX_MAX_MSGS).filter(m => !tooOld.includes(m))
    : [];
  const toDelete = [...tooOld, ...overCap];
  let remaining = msgs;
  if (toDelete.length > 0) {
    await Promise.allSettled(
      toDelete.map(m => deleteDoc(doc(db, 'players', uid, 'inbox', m.id)))
    );
    remaining = msgs.filter(m => !toDelete.includes(m));
  }
  // Always resync the unread badge. Since senders cannot write to the
  // recipient's player doc (isSelf rule), the unreadCount field can drift.
  // Recomputing it here on every getInbox() call is the self-healing fix.
  await _syncUnreadCount(uid, remaining);
  return remaining;
}

async function _syncUnreadCount(uid, messages) {
  const unread = messages.filter(m => !m.read).length;
  try { await updateDoc(doc(db, 'players', uid), { unreadCount: unread }); }
  catch (_) {}
}

export async function markMessageRead(uid, msgId) {
  await updateDoc(doc(db, 'players', uid, 'inbox', msgId), { read: true });
  // Recompute unread lazily on next getInbox; do a quick decrement here so
  // the UI badge drops immediately.
  try { await updateDoc(doc(db, 'players', uid), { unreadCount: increment(-1) }); }
  catch (_) {}
}

export async function deleteMessage(uid, msgId) {
  await deleteDoc(doc(db, 'players', uid, 'inbox', msgId));
}

export async function getUnreadCount(uid) {
  // Read directly from the inbox subcollection so the badge is always
  // accurate — the denormalized unreadCount field on the player doc can
  // drift because senders cannot write to the recipient's doc (isSelf rule).
  const snap = await getDocs(collection(db, 'players', uid, 'inbox'));
  const unread = snap.docs.filter(d => !d.data().read).length;
  // Heal the stored field while we are here (self-write, always allowed).
  updateDoc(doc(db, 'players', uid), { unreadCount: unread }).catch(() => {});
  return unread;
}