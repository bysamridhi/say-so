// Fake participants with plausible answers, for seeing what a full Wall looks like.
// Seeded participants are flagged (participants.is_seed) so clearSeed() removes exactly them
// and the CSV export ignores them.
import { hashCode, newCode } from './codes.js';
import { DAYS, parseDaySubmission, saveDay } from './probe.js';

const SAMPLES = {
  d1_q1: ['talks back to elders', 'comes home after dark', 'laughs too loudly', 'sits with her legs apart', 'argues at the dinner table',
    'wears sleeveless to a family function', 'says no to a relative', 'goes out without telling anyone', 'cuts her hair short', 'asks for more'],
  d1_q2: ['is asking for attention', 'won’t get a good rishta', 'has no shame', 'is trying too hard', 'wasn’t raised properly',
    'is too free', 'doesn’t know her place', 'will be talked about'],
  d1_q3: ['won’t last in her in-laws’ house', 'has been spoiled', 'gets it from her mother', 'is disrespectful', 'will learn the hard way',
    'thinks she’s too smart', 'is a bad influence on her sisters'],
  d1_q4: ['is rebellious', 'won’t find a husband', 'has bad friends', 'isn’t from a good family', 'is trying to be Western',
    'will regret it later', 'is “that kind” of girl'],
  d1_q5: ['is inviting trouble', 'has no sanskaar', 'is showing off', 'wants people to look', 'should cover up at the temple',
    'is embarrassing her parents'],
  d1_q6: ['fair', 'educated', 'married', 'quiet', 'from a good family', 'earning', 'not too modern', 'homely', 'tall'],
  d1_q7: ['a good girl never…', 'at least she’s…', 'what will people say', 'a girl who talks back…', 'a girl who dresses like that…'],
  d1_q9: ['a sigh', 'a slammed door', 'tongue clicking', 'a whisper behind a hand', 'a pressure cooker whistle', 'an aunty saying “hai”',
    'silence at the dinner table', 'bangles clinking', 'the TV turned up louder'],
  d1_q10: ['Most of these came from women, not men.', 'I’ve said some of these to my younger cousin without thinking.',
    'My brother never heard any of these.', 'They all sound like advice.', 'Some were said with love, which makes it harder.'],
  d2_q1: ['My nani, and the whole colony behind her', 'A faceless aunty at a wedding', 'My mother’s voice, but my grandmother’s words',
    'The family WhatsApp group', 'My dad’s side of the family', 'Honestly, my own voice now', 'The neighbours on their balcony',
    'A future mother-in-law I haven’t met yet'],
  d2_q3: ['a sharp voice in a kitchen', 'a living room full of relatives on a Sunday', 'the front gate of our building',
    'a cotton saree, never smiling', 'no face, just a tone', 'a wedding hall where everyone turns to look', 'my phone buzzing'],
  d3_q1: ['Don’t laugh too loudly', 'Be home before dark', 'Don’t wear short clothes in front of elders', 'Don’t sit with your legs open',
    'Don’t cut your hair short', 'Learn to cook before marriage', 'Don’t enter the kitchen during your period',
    'Don’t argue with elders', 'Cover your head in front of in-laws', 'No piercings except ears and nose'],
  d3_q3: ['my grandmother → my mother → me', 'my dad’s mother → my mother → me', 'the neighbours → my mother → me',
    'my aunt → my mother → me', 'it stops at my nani — no idea before that', 'teachers → my mother → me',
    'the priest → my grandmother → everyone'],
  d3_q4: ['No reason was given', '“Because people will talk”', 'For my safety', '“That’s how it’s done”',
    '“You’ll understand when you’re older”', 'The family’s izzat', 'Religious reasons, supposedly'],
  d3_q5: ['Helps the family’s reputation, costs me my freedom', 'Nobody, really', 'Helps men feel in control; costs the girls',
    'Helps my mother avoid gossip, costs me my evenings', 'I don’t know', 'Helps elders feel respected, costs honesty',
    'Costs the girls, helps the aunties look good'],
  d3_q6: ['a locked door', 'a dupatta', 'a curfew bell', 'a pressure cooker', 'a leash', 'a closed window',
    'an old radio stuck on one station', 'a heavy bangle', 'a measuring tape'],
  d4_q1: ['Girls couldn’t study outside the city — my cousin was the first', 'Wearing jeans at home, for my mother’s generation',
    'Working after marriage', 'My aunt wasn’t allowed to drive; now I do', 'Hair had to stay long — now nobody minds',
    'Love marriage was unthinkable; my sister had one', 'Girls couldn’t sleep over at friends’ houses'],
  d4_q3: ['Did it quietly and didn’t tell anyone', 'Changed clothes at a friend’s house', 'Waited it out',
    'Got their brothers to argue for them', 'Went along with it and complained to each other', 'Found loopholes — “group study”',
    'Some just gave up on it'],
  d4_q5: ['rules', 'tradition', 'sanskaar', '“the way things are”', 'family pressure', 'log kya kahenge', 'control',
    'double standards', 'upbringing', 'the system'],
  d4_q6: ['I take back nothing.', 'My parents are more flexible than this makes them sound.', 'It’s changing, slowly.',
    'Writing this down made it feel bigger.', 'I wish my mother could answer these too.'],
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function fakeAnswers(day) {
  const answers = {};
  for (const p of day.prompts) {
    if (Math.random() < (p.optional ? 0.65 : 0.12)) continue; // skipped
    if (p.type === 'text') {
      answers[p.id] = pick(SAMPLES[p.id] || ['(sample answer)']);
    } else if (p.multi) {
      const chosen = p.options.filter(() => Math.random() < 0.35);
      answers[p.id] = chosen.length ? chosen : [pick(p.options)];
    } else {
      answers[p.id] = [pick(p.options)];
    }
  }
  return answers;
}

// Creates `count` fake participants. Most finish all four days (so any of their codes opens The
// Wall); a few stop early, like real people. Returns the codes of those who finished.
export async function seedDatabase(db, count) {
  const finished = [];
  for (let i = 0; i < count; i++) {
    const code = newCode();
    const [row] = await db.query(
      'insert into participants (code_hash, is_seed) values ($1, true) on conflict (code_hash) do nothing returning id',
      [hashCode(code)],
    );
    if (!row) { i--; continue; }
    const days = Math.random() < 0.85 ? DAYS : DAYS.slice(0, 1 + Math.floor(Math.random() * 3));
    for (const day of days) {
      const { rows } = parseDaySubmission({ day: day.key, answers: fakeAnswers(day) });
      await saveDay(db, row.id, day, rows);
    }
    if (days.length === DAYS.length) finished.push(code);
  }
  return finished;
}

export async function clearSeed(db) {
  const rows = await db.query('delete from participants where is_seed returning id');
  return rows.length;
}
