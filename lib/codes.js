// Return codes: the whole "login". Tapping START creates an anonymous participant and hands
// back a random code like MANGO-RIVER-4821. Entering that code later (any device) lets the
// person edit their own answers. Nothing about the person is collected or linked to it.
//
// Only a SHA-256 hash of the normalised code is stored. With ~200 words × 200 words × 10,000
// numbers there are ~400 million codes, which is plenty for a classroom alongside the
// failed-guess rate limit in lib/auth.js.
import { createHash, randomInt } from 'node:crypto';

const WORDS = `
AMBER APPLE APRON ARROW ATLAS BAGEL BAMBOO BANJO BASIL BEACH BERRY BIRCH BISON BLOOM BLUE
BREAD BREEZE BRICK BROOK BRUSH BUBBLE BUTTON CACTUS CAMEL CANDLE CANOE CARROT CASTLE CEDAR
CHALK CHERRY CHILLI CIRCLE CLOUD CLOVER COCOA COMET CORAL COTTON CRANE CRAYON CRYSTAL
CUMIN DAISY DELTA DESERT DIESEL DOLPHIN DRAGON DRUM EAGLE ECHO EMBER FALCON FEATHER FERN
FIG FLUTE FOREST FOSSIL FROST GALAXY GARDEN GINGER GLOBE GRAPE GRAVEL GUAVA HARBOR HAZEL
HELIX HONEY ICICLE INDIGO ISLAND IVORY JASMINE JELLY JUNGLE KAYAK KETTLE KITE KIWI LADDER
LAGOON LANTERN LEMON LENTIL LILAC LIME LOTUS MAGNET MANGO MAPLE MARBLE MEADOW MELON METEOR
MINT MIRROR MONSOON MOSS NECTAR NEEDLE NOODLE NUTMEG OASIS OCEAN OLIVE ONION ORBIT ORCHID
OTTER PADDLE PAPAYA PARROT PEACH PEARL PEBBLE PENCIL PEPPER PICKLE PILLOW PINE PIXEL PLANET
PLUM POCKET POLLEN POPCORN PRISM PUFFIN PUMPKIN QUARTZ QUILL RADISH RAIN RAINBOW RAVEN
RIBBON RIVER ROCKET SAFFRON SAIL SALT SAND SATURN SCARF SEED SHELL SILVER SKETCH SLATE
SPARROW SPICE SPONGE SPROUT SQUASH STAR STONE SUGAR SUMMIT SUNSET SWAN TAMARIND TEAPOT
THUNDER TIGER TOAST TOMATO TOPAZ TULIP TUNNEL TURTLE VELVET VIOLET WAFFLE WALNUT WILLOW
WINDOW WINTER YARN ZEBRA ZEST
`.trim().split(/\s+/);

export function newCode() {
  const word = () => WORDS[randomInt(WORDS.length)];
  return `${word()}-${word()}-${String(randomInt(10_000)).padStart(4, '0')}`;
}

// "mango river 4821", "Mango-River-4821" and "MANGORIVER4821" are all the same code.
export function normalizeCode(input) {
  return String(input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function hashCode(input) {
  return createHash('sha256').update(normalizeCode(input)).digest('hex');
}
