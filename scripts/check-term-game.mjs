import assert from 'node:assert/strict';
import { normalizeAnswer, questionPool, makeRound, QuizSession } from '../assets/term-game.js';

// Synthetic vocabulary tests game rules, not historical equivalences.
const words = ['Alfa','Bravo','Ceviz','Deniz','Elma','Fener','Güneş','Halı','Işık','Jale','Kutu','Lale'];
const fixtures = words.map((word,i)=>({slug:`fixture-${i}`,headword_en:`Fixture ${i}`,
  ottoman_period_term:word,category:i<6?'Group A':'Group B',status:'published'}));
assert.equal(normalizeAnswer('MÜLÂZIM-ı Şânî'),normalizeAnswer('mulazim i sani'));
const ambiguous = {slug:'ambiguous',headword_en:'Ambiguous',ottoman_period_term:'Tek'};
const pool = questionPool([...fixtures, {...fixtures[0],slug:'same-entry'},
  ambiguous, {...ambiguous,slug:'ambiguous-compound',ottoman_period_term:'Başka / Terim'},
  {slug:'blank',headword_en:'Blank',ottoman_period_term:''},
  {slug:'compound',headword_en:'Compound',ottoman_period_term:'Bir / İki'},
  {slug:'draft',headword_en:'Draft',ottoman_period_term:'Gizli',status:'draft'},
  {slug:'identical',headword_en:'Same',ottoman_period_term:'Same'},null]);
assert.equal(pool.length,12,'Exclude conflicting, compound, blank, unpublished and identical entries; deduplicate headwords');
assert.equal(makeRound(pool.slice(0,3)).length,0,'Never render a question without four safe options');

const seed = value => () => {value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296;};
for (let i=0;i<50;i++) {
  const round = makeRound(pool,10,seed(i));
  assert.equal(round.length,10);
  assert.equal(new Set(round.map(q=>q.term.slug)).size,10,'No repeated question in a round');
  for (const q of round) {
    assert.equal(q.options.length,4);
    assert.equal(new Set(q.options.map(option=>normalizeAnswer(option.ottoman_period_term))).size,4);
    assert.equal(q.options.filter(option=>option.slug===q.term.slug).length,1);
    assert(q.options.every(option=>option.category===q.term.category),'Prefer distractors in the same category');
  }
}
assert.deepEqual(fixtures.map(item=>item.ottoman_period_term),words,'Shuffling must not mutate source records');
const targets = [pool[2],pool[8]];
const review = makeRound(pool,targets.length,seed(55),targets);
assert.deepEqual(new Set(review.map(q=>q.term.slug)),new Set(targets.map(term=>term.slug)),'Review targets only the missed entries');

const session = new QuizSession(makeRound(pool,10,seed(123)));
assert.equal(session.advance(),false,'Cannot skip an unanswered question');
for (const invalid of [-1,4,1.5,NaN]) assert.equal(session.answer(invalid),null);
const pattern = [true,true,false,true,true,true,false,false,true,true];
for (const expected of pattern) {
  const index = session.current.options.findIndex(item=>(item.slug===session.current.term.slug)===expected);
  assert.equal(session.answer(index).correct,expected);
  assert.equal(session.answer(index),null,'Double clicks must never change the score');
  assert.equal(session.advance(),true);
}
assert.equal(session.complete,true);
assert.equal(session.answer(0),null,'A completed round cannot accept answers');
assert.equal(session.advance(),false);
assert.deepEqual(session.stats,{right:7,wrong:3,streak:2,bestStreak:3,score:70,accuracy:70});
assert.equal(new QuizSession(review).stats.score,0,'Practice starts with a fresh score');
assert.equal(new QuizSession([]).complete,true);
console.log('Term game checks passed: 50 seeded rounds, safe choices, ambiguity filtering, scoring, double-click guards and targeted review.');
