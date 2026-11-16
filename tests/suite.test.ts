import { memoryStorage } from './setup-env';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  Card,
  CollectionItem,
  Deck,
  DeckTag,
  ProxyItem,
  isCardNameMatch,
  isSameCardPrint,
  isDoubleFacedCard,
} from '../src/types';

import {
  DEFAULT_DECK_TAGS,
  normalizeDeck,
  getStoredCollection,
  saveCollection,
  getStoredDeckTags,
  saveStoredDeckTags,
  getUiSettings,
  saveUiSettings,
  calculateCollectionDeckUsage,
  createSystemBackup,
  parseSystemBackup,
} from '../src/services/storage';

import {
  extractGoogleDriveId,
  parseMpcFillXml,
  buildProxyItemsFromMpcOrder,
  buildDeckFromMpcOrder,
  isMpcAlterForCard,
} from '../src/services/mpcFillService';

import {
  cleanCardForCloud,
  buildCloudPayload,
  registerUser,
  loginUser,
  logoutUser,
  saveUserCloudData,
  loadUserCloudData,
  subscribeToUserCloudData,
} from '../src/services/firebase';

import {
  CARD_TEMPLATES,
  createBlankCard,
  createBlankFace,
  detectFrameColors,
  normalizeManaCost,
  parseManaCost,
  parsePlaneswalkerText,
  parseSagaText,
  resolveFrameColors,
  isLegendary,
  sanitizeFileName,
} from '../src/services/cardMaker/model';
import { tokenizeRules, layoutParagraphs, Measurer } from '../src/services/cardMaker/richText';
import {
  applyRefToCard,
  buildSearchQuery,
  createCardFromRef,
  parseRef,
  RefField,
} from '../src/services/cardMaker/scryfallRef';
import { buildProjectFile, normalizeCard, parseProjectFile } from '../src/services/cardMaker/storage';

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: overrides.id || 'card-1',
    oracleId: overrides.oracleId || 'oracle-1',
    name: overrides.name || 'Sol Ring',
    manaCost: overrides.manaCost || '{1}',
    cmc: overrides.cmc ?? 1,
    typeLine: overrides.typeLine || 'Artifact',
    oracleText: overrides.oracleText || '{T}: Add {C}{C}.',
    colors: overrides.colors || [],
    colorIdentity: overrides.colorIdentity || [],
    setCode: overrides.setCode || 'CMM',
    setName: overrides.setName || 'Commander Masters',
    collectorNumber: overrides.collectorNumber || '1',
    rarity: overrides.rarity || 'uncommon',
    artist: overrides.artist || 'Mark Tedin',
    imageUrl: overrides.imageUrl || 'https://cards.scryfall.io/normal/front/sol-ring.jpg',
    imageUrlLarge: overrides.imageUrlLarge || 'https://cards.scryfall.io/large/front/sol-ring.jpg',
    imageUrlArtCrop: overrides.imageUrlArtCrop || 'https://cards.scryfall.io/art_crop/front/sol-ring.jpg',
    ...overrides,
  };
}

function makeDeck(overrides: Partial<Deck> = {}): Deck {
  const now = new Date().toISOString();
  return {
    id: overrides.id || 'deck-1',
    name: overrides.name || 'Test Commander',
    format: overrides.format || 'commander',
    cards: overrides.cards || [],
    createdAt: overrides.createdAt || now,
    updatedAt: overrides.updatedAt || now,
    ...overrides,
  };
}

test.beforeEach(() => {
  memoryStorage.clear();
});

// =========================================================================
// 1. types/index.ts: matching, print comparison, DFC detection
// =========================================================================
test('types: isCardNameMatch matches DFC front names & slash variations cleanly', () => {
  assert.equal(isCardNameMatch('Delver of Secrets', 'Delver of Secrets // Insectile Aberration'), true);
  assert.equal(isCardNameMatch('Wear/Tear', 'Wear // Tear'), true);
  assert.equal(isCardNameMatch('Sol Ring', 'sol ring'), true);
  assert.equal(isCardNameMatch('Greed', 'Horn of Greed'), false);
});

test('types: isSameCardPrint distinguishes Sol Ring MPC/custom alters and DFC back faces', () => {
  const officialSolRing = makeCard({ id: 'sol-official', setCode: 'LEA' });
  const mpcSolRing = makeCard({
    id: 'mpc-alter-123',
    setCode: 'MPC',
    imageUrl: 'https://lh3.googleusercontent.com/d/123',
  });
  const mpcSolRingSame = makeCard({
    id: 'mpc-alter-123',
    setCode: 'MPC',
    imageUrl: 'https://lh3.googleusercontent.com/d/123',
  });

  assert.equal(isSameCardPrint(officialSolRing, mpcSolRing), false);
  assert.equal(isSameCardPrint(mpcSolRing, mpcSolRingSame), true);

  const dfcA = makeCard({
    id: 'dfc-1',
    layout: 'transform',
    cardFaces: [
      { name: 'Delver of Secrets', imageUrl: 'https://img/front.jpg' },
      { name: 'Insectile Aberration', imageUrl: 'https://img/back-1.jpg' },
    ],
  });
  const dfcCustomBack = makeCard({
    id: 'dfc-1',
    layout: 'transform',
    cardFaces: [
      { name: 'Delver of Secrets', imageUrl: 'https://img/front.jpg' },
      { name: 'Insectile Aberration', imageUrl: 'https://lh3.googleusercontent.com/d/custom-back' },
    ],
  });
  assert.equal(isSameCardPrint(dfcA, dfcCustomBack), false);
});

test('types: isDoubleFacedCard identifies true physical DFCs vs single-faced split/adventure', () => {
  const transform = makeCard({
    layout: 'transform',
    cardFaces: [
      { name: 'Front', imageUrl: 'https://a' },
      { name: 'Back', imageUrl: 'https://b' },
    ],
  });
  const adventure = makeCard({
    layout: 'adventure',
    cardFaces: [
      { name: 'Creature', imageUrl: 'https://a' },
      { name: 'Adventure', imageUrl: 'https://a' },
    ],
  });

  assert.equal(isDoubleFacedCard(transform), true);
  assert.equal(isDoubleFacedCard(adventure), false);
});

// =========================================================================
// 2. storage.ts: Sol Ring art preservation, Partner normalization, coverPosition, tags, UI settings, backup
// =========================================================================
test('storage: collection persistence preserves Sol Ring MPC and CUSTOM arts', () => {
  const solMpc = makeCard({
    id: 'mpc-alter-abc',
    name: 'Sol Ring',
    setCode: 'MPC',
    imageUrl: 'https://lh3.googleusercontent.com/d/abc',
    imageUrlLarge: 'https://lh3.googleusercontent.com/d/abc',
    imageUrlArtCrop: 'https://lh3.googleusercontent.com/d/abc',
  });
  const solCustom = makeCard({
    id: 'custom-art-999',
    name: 'Sol Ring',
    setCode: 'CUSTOM',
    imageUrl: 'data:image/webp;base64,AAAA',
  });

  saveCollection([
    { card: solMpc, quantity: 1, addedAt: '2026-01-01T00:00:00.000Z' },
    { card: solCustom, quantity: 1, addedAt: '2026-01-01T00:00:00.000Z' },
  ]);

  const loaded = getStoredCollection();
  assert.equal(loaded[0].card.setCode, 'MPC');
  assert.equal(loaded[0].card.imageUrl, 'https://lh3.googleusercontent.com/d/abc');
  assert.equal(loaded[1].card.setCode, 'CUSTOM');
  assert.equal(loaded[1].card.imageUrl, 'data:image/webp;base64,AAAA');
});

test('storage: normalizeDeck preserves dual Partner commanders, ungroups singleton copies, clamps coverPosition', () => {
  const tymna = makeCard({
    id: 'tymna-1',
    name: 'Tymna the Weaver',
    typeLine: 'Legendary Creature — Human Cleric',
    oracleText: 'Partner',
    keywords: ['Partner'],
    imageUrlArtCrop: 'https://img/tymna-crop.jpg',
  });
  const thrasios = makeCard({
    id: 'thrasios-1',
    name: 'Thrasios, Triton Hero',
    typeLine: 'Legendary Creature — Merfolk Wizard',
    oracleText: 'Partner',
    keywords: ['Partner'],
    imageUrlArtCrop: 'https://img/thrasios-crop.jpg',
  });
  const solRing = makeCard({ id: 'sol-1', name: 'Sol Ring', typeLine: 'Artifact' });
  const swamp = makeCard({ id: 'swamp-1', name: 'Swamp', typeLine: 'Basic Land — Swamp' });

  const normalized = normalizeDeck(
    makeDeck({
      format: 'commander',
      commanderCard: tymna,
      coverPosition: 145, // out of bounds -> should clamp to 100
      cards: [
        { card: tymna, quantity: 1, category: 'commander' },
        { card: thrasios, quantity: 1, category: 'commander' },
        { card: solRing, quantity: 2, category: 'main' },
        { card: swamp, quantity: 10, category: 'main' },
      ],
    })
  );

  const commanders = normalized.cards.filter((c) => c.category === 'commander');
  assert.equal(commanders.length, 2, 'Both Partner commanders must remain separate');
  const solEntries = normalized.cards.filter((c) => c.card.name === 'Sol Ring');
  assert.equal(solEntries.length, 2, 'Ungroups quantity into independent card slots');
  assert.ok(solEntries.every((s) => s.quantity === 1));
  const swampEntries = normalized.cards.filter((c) => c.card.name === 'Swamp');
  assert.equal(swampEntries.length, 10, 'Basic lands expand cleanly into 10 independent art slots');
  assert.equal(normalized.coverPosition, 100);

  const negativePosDeck = normalizeDeck(makeDeck({ coverPosition: -25 }));
  assert.equal(negativePosDeck.coverPosition, 0);
});

test('storage: getStoredDeckTags returns defaults initially and preserves explicit empty array []', () => {
  const initial = getStoredDeckTags();
  assert.deepEqual(initial, DEFAULT_DECK_TAGS);

  saveStoredDeckTags([]);
  const afterDeleteAll = getStoredDeckTags();
  assert.deepEqual(afterDeleteAll, []);
});

test('storage: saveUiSettings clamps gridCardSize and emits local vs cloud events', () => {
  let localEvents = 0;
  let cloudEvents = 0;
  const onLocal = () => {
    localEvents += 1;
  };
  const onCloud = () => {
    cloudEvents += 1;
  };
  window.addEventListener('proliferate:ui-settings-local', onLocal);
  window.addEventListener('proliferate:ui-settings-cloud', onCloud);

  try {
    const saved = saveUiSettings({ deckViewMode: 'table', gridCardSize: 999, gridShowDetails: false }, 'local');
    assert.equal(saved.deckViewMode, 'table');
    assert.equal(saved.gridCardSize, 340);
    assert.equal(saved.gridShowDetails, false);
    assert.equal(localEvents, 1);
    assert.equal(cloudEvents, 0);

    saveUiSettings({ collectionViewMode: 'table', gridCardSize: 50 }, 'cloud');
    const reloaded = getUiSettings();
    assert.equal(reloaded.collectionViewMode, 'table');
    assert.equal(reloaded.gridCardSize, 110);
    assert.equal(localEvents, 1);
    assert.equal(cloudEvents, 1);
  } finally {
    window.removeEventListener('proliferate:ui-settings-local', onLocal);
    window.removeEventListener('proliferate:ui-settings-cloud', onCloud);
  }
});

test('storage: calculateCollectionDeckUsage tracks multi-deck allocation accurately', () => {
  const sol = makeCard({ id: 'sol-1', name: 'Sol Ring' });
  const collection: CollectionItem[] = [
    {
      card: sol,
      quantity: 3,
      addedAt: '2026-01-01T00:00:00.000Z',
    },
  ];
  const decks: Deck[] = [
    makeDeck({ id: 'd1', name: 'Deck One', cards: [{ card: sol, quantity: 1, category: 'main' }] }),
    makeDeck({ id: 'd2', name: 'Deck Two', cards: [{ card: sol, quantity: 1, category: 'main' }] }),
  ];

  const computed = calculateCollectionDeckUsage(collection, decks);
  assert.equal(computed[0].inUseQuantity, 2);
  assert.equal(computed[0].availableQuantity, 1);
  assert.equal(computed[0].usedInDecks?.length, 2);
});

test('storage: createSystemBackup + parseSystemBackup round-trip preserves deckTags [], coverPosition, and alters', () => {
  const solMpc = makeCard({
    id: 'mpc-alter-sol99',
    name: 'Sol Ring',
    setCode: 'MPC',
    imageUrl: 'https://lh3.googleusercontent.com/d/sol99',
  });
  const deck = makeDeck({
    id: 'd-cover',
    coverPosition: 68,
    coverImageUrl: 'https://img/cover.jpg',
    cards: [{ card: solMpc, quantity: 1, category: 'main' }],
  });
  const proxies: ProxyItem[] = [{ id: 'p-1', card: solMpc, quantity: 2, category: 'card' }];
  const tags: DeckTag[] = [];

  const backup = createSystemBackup([], [deck], proxies, tags);
  const restored = parseSystemBackup(JSON.stringify(backup));

  assert.equal(restored.decks.length, 1);
  assert.equal(restored.decks[0].coverPosition, 68);
  assert.equal(restored.decks[0].cards[0].card.id, 'mpc-alter-sol99');
  assert.deepEqual(restored.deckTags, []);
  assert.equal(restored.proxies.length, 1);

  assert.throws(() => parseSystemBackup('not-json'), /não é um JSON válido/i);
});

// =========================================================================
// 3. mpcFillService.ts: Drive ID parsing, XML order parsing, proxy/deck builders
// =========================================================================
test('mpcFillService: extracts Google Drive IDs, parses XML order, and builds deck & proxies', () => {
  assert.equal(
    extractGoogleDriveId('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQr/view'),
    '1AbCdEfGhIjKlMnOpQr'
  );
  assert.equal(
    extractGoogleDriveId('https://lh3.googleusercontent.com/d/1XyZ9876543210ABC'),
    '1XyZ9876543210ABC'
  );
  assert.equal(isMpcAlterForCard('Greed (Modern Izzy)', 'Greed'), true);
  assert.equal(isMpcAlterForCard('Horn of Greed', 'Greed'), false);

  const xml = `
    <order>
      <details>
        <quantity>2</quantity>
        <stock>(S30) Standard Smooth</stock>
        <foil>false</foil>
      </details>
      <fronts>
        <card>
          <id>1SolRingDriveId123</id>
          <slots>0</slots>
          <name>Sol Ring (Retro)</name>
          <query>Sol Ring</query>
        </card>
        <card>
          <id>1CommandTowerId456</id>
          <slots>1</slots>
          <name>Command Tower</name>
          <query>Command Tower</query>
        </card>
      </fronts>
      <cardback>1DefaultBackId789</cardback>
    </order>
  `;

  const parsed = parseMpcFillXml(xml);
  assert.equal(parsed.details.quantity, 2);
  assert.equal(parsed.fronts.length, 2);
  assert.equal(parsed.cardbackId, '1DefaultBackId789');

  const proxyItems = buildProxyItemsFromMpcOrder(parsed);
  assert.equal(proxyItems.length, 2);
  assert.equal(proxyItems[0].card.setCode, 'MPC');

  const builtDeck = buildDeckFromMpcOrder(parsed, 'Imported MPC Deck');
  assert.equal(builtDeck.name, 'Imported MPC Deck');
  assert.equal(builtDeck.cards.length, 2);
  assert.ok(builtDeck.cards.every((c) => c.card.setCode === 'MPC'));
});

// =========================================================================
// 4. firebase.ts: Cloud payload sanitization, compression, multi-device sync, clock-skew & offline flush
// =========================================================================
test('firebase: cleanCardForCloud and buildCloudPayload strip transient fields, keep alters/covers/tags/settings', async () => {
  const solMpc = makeCard({
    id: 'mpc-alter-sol',
    name: 'Sol Ring',
    namePt: 'Anel Solar',
    frame: '1997',
    printsSearchUri: 'https://api.scryfall.com/cards/search?q=sol+ring',
    setCode: 'MPC',
    imageUrl: 'https://lh3.googleusercontent.com/d/sol-drive',
    allPrints: [
      {
        id: 'print-extra',
        setCode: 'LEA',
        setName: 'Alpha',
        collectorNumber: '1',
        artist: 'Mark Tedin',
        imageUrl: 'https://extra',
      },
    ],
    cardFaces: [
      { name: 'Front', imageUrl: 'https://img/f.jpg', frame: '2015' },
      { name: 'Back', imageUrl: 'https://lh3.googleusercontent.com/d/back', frame: '2015' },
    ],
  });

  const cleaned = cleanCardForCloud(solMpc);
  assert.equal((cleaned as any).allPrints, undefined);
  assert.equal(cleaned.namePt, 'Anel Solar');
  assert.equal(cleaned.frame, '1997');
  assert.equal(cleaned.printsSearchUri, 'https://api.scryfall.com/cards/search?q=sol+ring');
  assert.equal(cleaned.cardFaces?.[1].imageUrl, 'https://lh3.googleusercontent.com/d/back');

  const collection: CollectionItem[] = [
    {
      card: solMpc,
      quantity: 1,
      addedAt: '2026-01-01T00:00:00.000Z',
      inUseQuantity: 1,
      availableQuantity: 0,
      usedInDecks: [{ deckId: 'd1', deckName: 'D1', quantity: 1 }],
    },
  ];
  const deck = makeDeck({
    id: 'd1',
    coverImageUrl: 'https://img/cover.jpg',
    coverPosition: 37,
    tags: ['tag-custom'],
    cards: [{ card: solMpc, quantity: 1, category: 'main' }],
  });

  const payload = await buildCloudPayload({
    collection,
    decks: [deck],
    proxies: [{ id: 'p1', card: solMpc, quantity: 1, category: 'card' }],
    deckTags: [],
    settings: {
      collectionViewMode: 'table',
      deckViewMode: 'table',
      gridCardSize: 220,
      gridShowDetails: false,
    },
    clientSessionId: 'device-a',
    syncRevision: 4,
  });

  // Ensure zero undefined values anywhere in serialized JSON
  const serialized = JSON.stringify(payload);
  assert.ok(!serialized.includes('undefined'));
  assert.equal((payload.collection[0] as any).inUseQuantity, undefined);
  assert.equal((payload.collection[0] as any).availableQuantity, undefined);
  assert.equal((payload.collection[0] as any).usedInDecks, undefined);
  assert.equal(payload.decks[0].coverPosition, 37);
  assert.equal(payload.decks[0].cards[0].card.id, 'mpc-alter-sol');
  assert.deepEqual(payload.deckTags, []);
  assert.equal(payload.settings?.deckViewMode, 'table');
  assert.equal(payload.syncRevision, 4);
  assert.equal(payload.clientSessionId, 'device-a');
});

test('firebase: multi-device cloud sync round-trip propagates all user actions without losing empty tags, Sol Ring art, coverPosition, or settings', async () => {
  // 1. User registers on Device A
  const profileA = await registerUser('davi', 'davi@example.com', 'secret123');
  assert.equal(profileA.username, 'davi');

  // Duplicate email fails cleanly
  await assert.rejects(() => registerUser('other', 'davi@example.com', 'secret123'), /já está em uso/i);

  // Wrong password fails cleanly
  await logoutUser();
  await assert.rejects(() => loginUser('davi@example.com', 'wrongpass'), /incorretos?/i);

  // Device B logs in as same user and subscribes to cloud updates
  const profileB = await loginUser('davi@example.com', 'secret123');
  assert.equal(profileB.uid, profileA.uid);

  const receivedByDeviceB: Array<Awaited<ReturnType<typeof loadUserCloudData>>> = [];
  const unsubscribeB = subscribeToUserCloudData(profileB.uid, (cloudData) => {
    receivedByDeviceB.push(cloudData);
  });

  try {
    // 2. Device A mutates collection, deck art (Sol Ring), coverPosition, tags ([]), proxies, UI settings
    const solCustom = makeCard({
      id: 'mpc-alter-sol-ring-42',
      name: 'Sol Ring',
      setCode: 'MPC',
      imageUrl: 'https://lh3.googleusercontent.com/d/sol42',
      imageUrlLarge: 'https://lh3.googleusercontent.com/d/sol42',
      imageUrlArtCrop: 'https://lh3.googleusercontent.com/d/sol42',
    });

    const deckA = makeDeck({
      id: 'deck-sync-1',
      name: 'Drawpocalypse',
      coverImageUrl: 'https://cards.scryfall.io/art_crop/front/sheoldred.jpg',
      coverPosition: 82,
      tags: [],
      cards: [{ card: solCustom, quantity: 1, category: 'main' }],
    });

    const saved = await saveUserCloudData(profileA.uid, {
      collection: [{ card: solCustom, quantity: 2, addedAt: '2026-05-01T00:00:00.000Z' }],
      decks: [deckA],
      proxies: [{ id: 'proxy-sol', card: solCustom, quantity: 4, category: 'card' }],
      deckTags: [],
      settings: {
        collectionViewMode: 'table',
        deckViewMode: 'table',
        gridCardSize: 255,
        gridShowDetails: false,
      },
      clientSessionId: 'device-a-session',
      syncRevision: 1,
    });

    assert.equal(saved.syncRevision, 1);

    // 3. Device B real-time subscriber received the update
    const latestFromSub = receivedByDeviceB[receivedByDeviceB.length - 1];
    assert.ok(latestFromSub, 'Device B subscriber should receive cloud snapshot');
    assert.equal(latestFromSub.clientSessionId, 'device-a-session');
    assert.equal(latestFromSub.syncRevision, 1);
    assert.equal(latestFromSub.decks[0].coverPosition, 82);
    assert.equal(latestFromSub.decks[0].cards[0].card.id, 'mpc-alter-sol-ring-42');
    assert.deepEqual(latestFromSub.deckTags, []);
    assert.equal(latestFromSub.proxies[0].quantity, 4);
    assert.equal(latestFromSub.collection[0].quantity, 2);
    assert.equal(latestFromSub.settings?.collectionViewMode, 'table');
    assert.equal(latestFromSub.settings?.gridCardSize, 255);
    assert.equal(latestFromSub.settings?.gridShowDetails, false);

    // 4. Device B cold-loads from cloud storage (simulating fresh tab/device open)
    const coldLoadedB = await loadUserCloudData(profileB.uid);
    assert.ok(coldLoadedB);
    assert.equal(coldLoadedB.decks[0].coverPosition, 82);
    assert.equal(coldLoadedB.decks[0].cards[0].card.imageUrl, 'https://lh3.googleusercontent.com/d/sol42');
    assert.deepEqual(coldLoadedB.deckTags, []);
    assert.equal(coldLoadedB.settings?.deckViewMode, 'table');

    // 5. Simulated clock skew test: Device A pushes syncRevision: 2 even if timestamp appears earlier
    const skewedPayload = await saveUserCloudData(profileA.uid, {
      collection: [{ card: solCustom, quantity: 5, addedAt: '2026-05-01T00:00:00.000Z' }],
      decks: [{ ...deckA, name: 'Drawpocalypse Updated' }],
      proxies: [{ id: 'proxy-sol', card: solCustom, quantity: 4, category: 'card' }],
      deckTags: [{ id: 'tag-1', name: 'Ready', color: 'emerald' }],
      settings: {
        collectionViewMode: 'grid',
        deckViewMode: 'grid',
        gridCardSize: 180,
        gridShowDetails: true,
      },
      clientSessionId: 'device-a-session',
      syncRevision: 2,
    });
    assert.equal(skewedPayload.syncRevision, 2);
    const loadedRevision2 = await loadUserCloudData(profileB.uid);
    assert.equal(loadedRevision2?.syncRevision, 2);
    assert.equal(loadedRevision2?.collection[0].quantity, 5);
    assert.equal(loadedRevision2?.decks[0].name, 'Drawpocalypse Updated');
    assert.equal(loadedRevision2?.deckTags?.[0].name, 'Ready');
  } finally {
    unsubscribeB();
  }
});

test('firebase: rejects oversized uncompressible cloud document (> 1.04MB) with descriptive error', async () => {
  const giantNonDataString = 'X'.repeat(1_100_000);
  const brokenCard = makeCard({ oracleText: giantNonDataString });

  await assert.rejects(
    () =>
      buildCloudPayload({
        collection: [{ card: brokenCard, quantity: 1, addedAt: '2026-01-01T00:00:00.000Z' }],
        decks: [],
        proxies: [],
      }),
    /excedem o limite máximo/i
  );
});


/* ------------------------------------------------------------------ */
/* Card Maker                                                           */
/* ------------------------------------------------------------------ */

test('card maker: parseManaCost aceita chaves e formato curto', () => {
  assert.deepEqual(parseManaCost('{2}{W}{U}'), ['2', 'W', 'U']);
  assert.deepEqual(parseManaCost('2WU'), ['2', 'W', 'U']);
  assert.deepEqual(parseManaCost('{W/U}{2/G}{R/P}'), ['W/U', '2/G', 'R/P']);
  assert.deepEqual(parseManaCost(''), []);
  assert.equal(normalizeManaCost('10xg'), '{10}{X}{G}');
});

test('card maker: detecta cores do frame pelo custo e tipo', () => {
  const f = (manaCost: string, typeLine = 'Criatura') => ({ manaCost, typeLine });
  assert.deepEqual(detectFrameColors(f('{1}{R}'), 'gold'), ['R']);
  assert.deepEqual(detectFrameColors(f('{R}{G}'), 'gold'), ['M']);
  assert.deepEqual(detectFrameColors(f('{R}{G}'), 'gradient'), ['R', 'G']);
  assert.deepEqual(detectFrameColors(f('{W}{U}{B}'), 'gradient'), ['M']);
  assert.deepEqual(detectFrameColors(f('{W/U}'), 'gold'), ['M']);
  assert.deepEqual(detectFrameColors(f('{3}', 'Artefato — Equipamento'), 'gold'), ['A']);
  assert.deepEqual(detectFrameColors(f('', 'Terreno'), 'gold'), ['L']);
  assert.deepEqual(detectFrameColors(f('', 'Feitiço'), 'gold'), ['C']);
  assert.equal(isLegendary('Criatura Lendária — Elfo'), true);
  assert.equal(isLegendary('Legendary Creature — Elf'), true);
  assert.equal(isLegendary('Creature — Elf'), false);
});

test('card maker: resolveFrameColors respeita escolha manual', () => {
  const face = { ...createBlankFace(), manaCost: '{R}', autoColor: false, colors: ['G', 'U'] as ('G' | 'U')[] };
  assert.deepEqual(resolveFrameColors(face, { multiStyle: 'gradient' }), ['G', 'U']);
  assert.deepEqual(resolveFrameColors(face, { multiStyle: 'gold' }), ['M']);
  assert.deepEqual(resolveFrameColors({ ...face, autoColor: true }, { multiStyle: 'gold' }), ['R']);
});

test('card maker: tokeniza símbolos e texto lembrete em itálico', () => {
  const paragraphs = tokenizeRules('{T}: Adicione {G}. (Isto é um lembrete.)\nVoar');
  assert.equal(paragraphs.length, 2);
  const first = paragraphs[0].tokens;
  assert.equal(first[0].kind, 'sym');
  assert.equal((first[0] as { sym: string }).sym, 'T');
  const reminderWords = first.filter((t) => t.kind === 'word' && t.italic).map((t) => (t as { text: string }).text);
  assert.deepEqual(reminderWords, ['(Isto', 'é', 'um', 'lembrete.)']);
  assert.equal(tokenizeRules('Texto', true)[0].tokens.every((t) => t.italic), true);
  assert.equal(tokenizeRules('\n\n  \n').length, 0);
});

test('card maker: quebra de linha gulosa respeita largura e agrupa parágrafos', () => {
  const m: Measurer = { text: (t, _i, size) => t.length * size * 0.5, sym: (size) => size };
  const paragraphs = tokenizeRules('um dois tres quatro cinco seis\nsete oito');
  const block = layoutParagraphs(paragraphs, m, { width: 100, size: 10, lineHeightRatio: 1.2, paragraphGap: 4 });
  assert.ok(block.lines.length >= 3);
  assert.ok(block.lines.every((l) => l.width <= 100 + 0.001));
  assert.equal(block.lines.filter((l) => l.paragraphEnd).length, 2);
  assert.ok(block.height > 0);
});

test('card maker: converte texto de planeswalker e saga', () => {
  const abilities = parsePlaneswalkerText('+1: Compre um card.\n−2: Destrua o alvo.\nSe você controlar dois, vença.');
  assert.equal(abilities.length, 3);
  assert.equal(abilities[0].cost, '+1');
  assert.equal(abilities[1].cost, '−2');
  assert.equal(abilities[2].cost, '');

  const saga = parseSagaText('(Lembrete)\nI — Faça A.\nII, III — Faça B\ncontinuando.');
  assert.equal(saga.chapters.length, 2);
  assert.equal(saga.chapters[1].marks, 'II, III');
  assert.equal(saga.chapters[1].text, 'Faça B continuando.');
  assert.equal(saga.rest, '(Lembrete)');
});

test('card maker: busca monta consultas Scryfall por modo', () => {
  assert.equal(buildSearchQuery('goblin guide', 'name'), 'goblin guide');
  assert.equal(buildSearchQuery('draw a card', 'rules'), 'o:"draw a card"');
  assert.equal(buildSearchQuery('lightning', 'flavor'), 'ft:"lightning"');
  assert.equal(buildSearchQuery('bolt', 'flavorByName'), 'bolt has:flavor');
  assert.equal(buildSearchQuery('t:goblin c:r', 'name'), 't:goblin c:r');
  assert.equal(buildSearchQuery('   ', 'name'), '');
});

const rawGoblin = {
  id: 'abc',
  oracle_id: 'oid',
  name: 'Goblin Guide',
  lang: 'en',
  layout: 'normal',
  mana_cost: '{R}',
  type_line: 'Creature — Goblin Scout',
  oracle_text: 'Haste\nWhenever Goblin Guide attacks, defending player reveals the top card of their library.',
  flavor_text: 'Go!',
  power: '2',
  toughness: '2',
  colors: ['R'],
  rarity: 'rare',
  set: 'zen',
  set_name: 'Zendikar',
  collector_number: '126',
  artist: 'Steve Argyle',
  image_uris: { art_crop: 'https://img/art.jpg', normal: 'https://img/n.jpg' },
};

test('card maker: parseRef normaliza carta simples e dupla face', () => {
  const ref = parseRef(rawGoblin);
  assert.equal(ref.setCode, 'ZEN');
  assert.equal(ref.rarity, 'rare');
  assert.equal(ref.isDfc, false);
  assert.equal(ref.faces[0].artCrop, 'https://img/art.jpg');

  const dfc = parseRef({
    ...rawGoblin,
    layout: 'transform',
    image_uris: undefined,
    card_faces: [
      { name: 'Front', mana_cost: '{1}{G}', type_line: 'Creature', oracle_text: 'A', image_uris: { art_crop: 'f' } },
      { name: 'Back', type_line: 'Creature', oracle_text: 'B', image_uris: { art_crop: 'b' } },
    ],
  });
  assert.equal(dfc.isDfc, true);
  assert.equal(dfc.faces.length, 2);
  assert.equal(dfc.faces[1].artCrop, 'b');

  const adventure = parseRef({
    ...rawGoblin,
    layout: 'adventure',
    card_faces: [
      { name: 'Main', mana_cost: '{2}{R}', type_line: 'Creature', oracle_text: 'Haste' },
      { name: 'Side', mana_cost: '{R}', type_line: 'Instant — Adventure', oracle_text: 'Deal 1.' },
    ],
  });
  assert.equal(adventure.faces.length, 1);
  assert.match(adventure.faces[0].oracleText, /Side/);
});

test('card maker: parseRef usa texto impresso em outros idiomas', () => {
  const ref = parseRef({ ...rawGoblin, lang: 'pt', printed_name: 'Guia Goblin', printed_text: 'Ímpeto', printed_type_line: 'Criatura — Goblin Batedor' });
  assert.equal(ref.name, 'Guia Goblin');
  assert.equal(ref.faces[0].oracleText, 'Ímpeto');
  assert.equal(ref.faces[0].typeLine, 'Criatura — Goblin Batedor');
});

test('card maker: aplica apenas os campos escolhidos da referência', () => {
  const ref = parseRef(rawGoblin);
  const card = createBlankCard();
  card.faces[0].name = 'Minha Carta';
  card.faces[0].rulesText = 'Texto antigo';

  const rulesOnly = applyRefToCard(card, 0, ref, new Set<RefField>(['rules']), { rulesMode: 'replace' });
  assert.equal(rulesOnly.faces[0].name, 'Minha Carta');
  assert.match(rulesOnly.faces[0].rulesText, /^Haste/);
  assert.equal(rulesOnly.faces[0].flavorText, '');

  const appended = applyRefToCard(card, 0, ref, new Set<RefField>(['rules']), { rulesMode: 'append' });
  assert.match(appended.faces[0].rulesText, /^Texto antigo\nHaste/);

  const flavorOnly = applyRefToCard(card, 0, ref, new Set<RefField>(['flavor', 'artist']), { rulesMode: 'replace' });
  assert.equal(flavorOnly.faces[0].flavorText, 'Go!');
  assert.equal(flavorOnly.faces[0].artist, 'Steve Argyle');
  assert.equal(flavorOnly.faces[0].rulesText, 'Texto antigo');

  const withSet = applyRefToCard(card, 0, ref, new Set<RefField>(['set', 'art']), { rulesMode: 'replace' });
  assert.equal(withSet.meta.setCode, 'ZEN');
  assert.equal(withSet.meta.iconMode, 'set');
  assert.equal(withSet.faces[0].art.src, 'https://img/art.jpg');
  // original intacto (imutabilidade)
  assert.equal(card.meta.setCode, 'CUS');
});

test('card maker: importar planeswalker troca o layout e cria habilidades', () => {
  const pw = parseRef({
    ...rawGoblin,
    name: 'Jace',
    type_line: 'Legendary Planeswalker — Jace',
    mana_cost: '{2}{U}{U}',
    oracle_text: '+2: Look at the top card.\n0: Draw three cards.\n−1: Return target creature.',
    loyalty: '3',
    power: undefined,
    toughness: undefined,
  });
  const card = createCardFromRef(pw);
  assert.equal(card.faces[0].layout, 'planeswalker');
  assert.equal(card.faces[0].abilities.length, 3);
  assert.equal(card.faces[0].loyalty, '3');
  assert.equal(card.meta.setCode, 'ZEN');
});

test('card maker: modelos iniciais são válidos e únicos', () => {
  const ids = new Set(CARD_TEMPLATES.map((t) => t.id));
  assert.equal(ids.size, CARD_TEMPLATES.length);
  for (const t of CARD_TEMPLATES) {
    const c = t.build();
    assert.ok(c.faces.length >= 1 && c.faces.length <= 2, t.id);
    assert.ok(c.id.startsWith('card-'));
  }
  assert.equal(CARD_TEMPLATES.find((t) => t.id === 'dfc')!.build().faces.length, 2);
  assert.equal(CARD_TEMPLATES.find((t) => t.id === 'planeswalker')!.build().faces[0].layout, 'planeswalker');
});

test('card maker: projeto exporta/importa e normaliza cartas antigas', () => {
  const card = CARD_TEMPLATES.find((t) => t.id === 'legend')!.build();
  const file = buildProjectFile([card]);
  const parsed = parseProjectFile(JSON.stringify(file));
  assert.equal(parsed.length, 1);
  assert.notEqual(parsed[0].id, card.id);
  assert.equal(parsed[0].faces[0].name, card.faces[0].name);

  const legacy = normalizeCard({ id: 'x', faces: [{ name: 'Velha' }] } as never);
  assert.equal(legacy.faces[0].name, 'Velha');
  assert.equal(legacy.faces[0].art.zoom, 1);
  assert.equal(legacy.meta.frameStyle, 'modern');

  assert.throws(() => parseProjectFile('não é json'), /JSON/);
  assert.throws(() => parseProjectFile('{"foo":1}'), /não reconhecido/);
  assert.equal(sanitizeFileName('Aurélia, Guardiã das Brasas!'), 'Aurelia-Guardia-das-Brasas');
});
