// Questions use published dictionary records; no generated historical content.
export function normalizeAnswer(value) {
  return String(value || '').toLocaleLowerCase('tr-TR').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

export function questionPool(items) {
  const byHeadword = new Map();
  for (const item of items) {
    if (!item || (item.status && item.status !== 'published') ||
        typeof item.slug !== 'string' || !item.slug || typeof item.headword_en !== 'string' ||
        typeof item.ottoman_period_term !== 'string') continue;
    const key = normalizeAnswer(item.headword_en);
    const group = byHeadword.get(key) || [];
    group.push(item); byHeadword.set(key, group);
  }
  // Check ambiguity before removing long or compound answers.
  return [...byHeadword.values()]
    .filter(group => new Set(group.map(item => normalizeAnswer(item.ottoman_period_term))).size === 1)
    .map(group => group[0])
    .filter(item => item.headword_en.trim().length >= 2 && item.headword_en.length <= 65 &&
      item.ottoman_period_term.trim().length >= 2 && item.ottoman_period_term.length <= 55 &&
      !/[\n\r/;=]/.test(item.headword_en + item.ottoman_period_term) &&
      normalizeAnswer(item.headword_en) !== normalizeAnswer(item.ottoman_period_term));
}

function shuffled(items, random = Math.random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function questionFor(pool, term, random) {
  const correct = normalizeAnswer(term.ottoman_period_term);
  const used = new Set([correct]);
  const tokens = new Set(correct.split(' '));
  const category = normalizeAnswer(term.category);
  const candidates = shuffled(pool, random);
  // Prefer related distractors when the dictionary supplies a shared category.
  const ordered = category ? [
    ...candidates.filter(item => normalizeAnswer(item.category) === category),
    ...candidates.filter(item => normalizeAnswer(item.category) !== category)
  ] : candidates;
  const alternatives = [];
  for (const item of ordered) {
    const answer = normalizeAnswer(item.ottoman_period_term);
    if (used.has(answer) || answer.split(' ').some(token => tokens.has(token)) ||
        normalizeAnswer(item.headword_en) === normalizeAnswer(term.headword_en)) continue;
    used.add(answer); alternatives.push(item);
    if (alternatives.length === 3) return { term, options: shuffled([term, ...alternatives], random) };
  }
  return null;
}

export function makeQuestion(pool, previousSlug, random = Math.random) {
  for (const term of shuffled(pool.filter(item => item.slug !== previousSlug), random)) {
    const question = questionFor(pool, term, random);
    if (question) return question;
  }
  return null;
}

export function makeRound(pool, count = 10, random = Math.random, targets = pool) {
  const questions = [], used = new Set();
  for (const term of shuffled(targets, random)) {
    const key = normalizeAnswer(term.headword_en);
    if (used.has(key) || questions.length >= count) continue;
    const question = questionFor(pool, term, random);
    if (question) { used.add(key); questions.push(question); }
  }
  return questions;
}

export class QuizSession {
  constructor(questions) { this.questions = questions; this.index = 0; this.answers = []; }
  get current() { return this.questions[this.index]; }
  get complete() { return this.index >= this.questions.length; }
  get answered() { return this.answers.length > this.index; }
  answer(index) {
    if (this.complete || this.answered || !Number.isInteger(index) || !this.current.options[index]) return null;
    const selected = this.current.options[index];
    const record = { term: this.current.term, selected, correct: selected.slug === this.current.term.slug };
    this.answers.push(record);
    return record;
  }
  advance() {
    if (this.complete || !this.answered) return false;
    this.index++; return true;
  }
  get stats() {
    let right = 0, streak = 0, bestStreak = 0;
    for (const answer of this.answers) {
      if (answer.correct) { right++; streak++; bestStreak = Math.max(streak, bestStreak); }
      else streak = 0;
    }
    return { right, wrong: this.answers.length - right, streak, bestStreak, score: right * 10,
      accuracy: this.answers.length ? Math.round(right / this.answers.length * 100) : 0 };
  }
}

const COPY = {
  tr: {
    loading:'Sorular hazırlanıyor…', unavailable:'Sorular şu anda yüklenemedi. Yeniden deneyebilirsiniz.', retry:'Yeniden dene',
    workshop:'SÖZLÜK ATÖLYESİ', welcome:'Dönem terimlerine ne kadar hâkimsiniz?',
    description:'İngilizce terimlerin sözlükteki Osmanlıca / dönem karşılıklarını bulun. Her cevapta öğrenin, tur sonunda bilginizi değerlendirin.',
    roundLabel:'SORULUK TUR', questions:n=>`${n} soru`, choices:'4 seçenek', untimed:'Süre sınırı yok', start:'Tura başla',
    guide:'Her doğru cevap 10 puan.', guideMore:'Yanlış bildiğiniz terimleri tur sonunda yeniden çalışabilirsiniz.',
    best:n=>`Bu cihazdaki en iyi tur: ${n} / 100`, normal:'KARIŞIK TUR', practice:'TEKRAR TURU',
    step:(n,total)=>`Soru ${n} / ${total}`, progress:'Tamamlanan sorular', points:'Puan', right:'Doğru', wrong:'Yanlış', streak:'Doğru serisi',
    question:'Bu terimin sözlükteki Osmanlıca / dönem karşılığını seçin.',
    correct:'Doğru bildiniz', incorrect:'Doğru karşılığı öğrenelim', period:'Dönem karşılığı', modern:'Günümüz karşılığı',
    selected:'Seçiminiz', correctAnswer:'Doğru cevap', next:'Sonraki soru', finish:'Sonuçları gör', source:'Sözlük maddesini incele ↗',
    sourceHint:'Cevaplar sözlükteki maddeye göre değerlendirilir.',
    done:'Tur tamamlandı', practiceDone:'Tekrar tamamlandı', perfect:'Bütün terimleri doğru eşleştirdiniz.',
    good:'Güzel bir tur. Cevapları gözden geçirerek bilginizi pekiştirebilirsiniz.',
    keepLearning:'Her terim yeni bir bilgi. Yanlış cevapladığınız maddeleri yeniden çalışabilirsiniz.',
    accuracy:'Başarı', longest:'En uzun seri', newRound:'Yeni tur', reviewWrong:'Yanlışları tekrar çalış',
    review:n=>`Cevapları gözden geçir (${n})`, reviewLink:'Maddeyi aç', back:'Başlangıca dön',
    saved:'En iyi skor yalnızca bu cihazda tutulur.'
  },
  en: {
    loading:'Preparing your questions…', unavailable:'Questions could not be loaded. Please try again.', retry:'Try again',
    workshop:'DICTIONARY PRACTICE', welcome:'How well do you know the period terms?',
    description:'Match English terms with the Ottoman / period equivalents in this dictionary. Learn with each answer and review your round.',
    roundLabel:'QUESTIONS PER ROUND', questions:n=>`${n} questions`, choices:'4 choices', untimed:'No time limit', start:'Start round',
    guide:'Each correct answer earns 10 points.', guideMore:'Practise the terms you missed at the end of the round.',
    best:n=>`Best round on this device: ${n} / 100`, normal:'MIXED ROUND', practice:'REVIEW ROUND',
    step:(n,total)=>`Question ${n} / ${total}`, progress:'Questions completed', points:'Points', right:'Correct', wrong:'Incorrect', streak:'Correct streak',
    question:'Choose the Ottoman / period equivalent given in this dictionary entry.',
    correct:'Correct answer', incorrect:'Learn the correct equivalent', period:'Period equivalent', modern:'Modern Turkish equivalent',
    selected:'Your choice', correctAnswer:'Correct answer', next:'Next question', finish:'See results', source:'Read the dictionary entry ↗',
    sourceHint:'Answers are assessed against the dictionary entry.',
    done:'Round complete', practiceDone:'Review complete', perfect:'You matched every term correctly.',
    good:'A good round. Review the answers to reinforce what you learned.',
    keepLearning:'Every term is a chance to learn. Practise the entries you missed.',
    accuracy:'Accuracy', longest:'Longest streak', newRound:'New round', reviewWrong:'Practise missed terms',
    review:n=>`Review answers (${n})`, reviewLink:'Open entry', back:'Back to start',
    saved:'Your best score is saved on this device only.'
  }
};

function init(root) {
  const en = document.documentElement.lang.startsWith('en');
  const copy = COPY[en ? 'en' : 'tr'];
  const body = root.querySelector('.term-game__body');
  let pool, deck, session, practice = false, busy = false;
  const storageKey = 'ats-term-game-best-v1';
  let best = 0;
  try { best = Math.min(100, Math.max(0, Number(localStorage.getItem(storageKey)) || 0)); } catch { /* Storage is optional. */ }
  const node = (tag, className, value = '') => {
    const el = document.createElement(tag); el.className = className; el.textContent = value; return el;
  };
  const button = (label, action, secondary = false) => {
    const el = node('button', secondary ? 'term-game__secondary' : 'term-game__next', label);
    el.type = 'button'; el.addEventListener('click', action); return el;
  };
  const entryLink = (term, label, className = 'term-game__source') => {
    const el = node('a', className, label);
    el.href = `${en ? '/en/term/' : '/terim/'}${encodeURIComponent(term.slug)}/`;
    el.target = '_blank'; el.rel = 'noopener'; return el;
  };
  function focusTitle() { body.querySelector('h3')?.focus({preventScroll:true}); }
  function title(value, className) {
    const el = node('h3', className, value); el.tabIndex = -1; return el;
  }
  function stat(label, value) {
    const el = node('div', 'term-game__stat');
    el.append(node('strong', '', value), node('span', '', label)); return el;
  }
  async function loadPool() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const get = async offset => {
        const response = await fetch(`/api/terms?limit=100&offset=${offset}`, {headers:{Accept:'application/json'},signal:controller.signal});
        const data = await response.json();
        if (!response.ok || !data.ok || !Array.isArray(data.items)) throw new Error('unavailable');
        return data;
      };
      const first = await get(0);
      const total = Math.max(first.items.length, Number(first.total) || 0);
      const offsets = shuffled(Array.from({length:Math.ceil(total / 100)}, (_,i)=>i*100)).slice(0,3);
      const pages = await Promise.all(offsets.map(offset => offset === 0 ? first : get(offset)));
      return questionPool(pages.flatMap(page => page.items));
    } finally { clearTimeout(timer); }
  }
  function welcome() {
    body.replaceChildren();
    const welcome = node('div', 'term-game__welcome');
    const content = node('div', 'term-game__welcome-copy');
    content.append(node('p','term-game__eyebrow',copy.workshop), title(copy.welcome,'term-game__welcome-title'),
      node('p','term-game__description',copy.description));
    const facts = node('ul','term-game__facts');
    [copy.questions(deck.length),copy.choices,copy.untimed].forEach(value => facts.append(node('li','',value)));
    content.append(facts,button(copy.start+' →',()=>begin(false)));
    const aside = node('div','term-game__welcome-aside');
    aside.append(node('span','term-game__round-number',String(deck.length)),node('span','term-game__round-label',copy.roundLabel),
      node('p','term-game__guide',copy.guide),node('p','term-game__guide-detail',copy.guideMore));
    welcome.append(content,aside); body.append(welcome);
    if (best) body.append(node('p','term-game__best',copy.best(best)));
  }
  function begin(isPractice, targets) {
    practice = isPractice;
    const questions = practice ? makeRound(pool,targets.length,Math.random,targets) : deck;
    session = new QuizSession(questions);
    renderQuestion(); focusTitle();
  }
  function renderQuestion() {
    body.replaceChildren();
    const question = session.current;
    const top = node('div','term-game__session-top');
    top.append(node('span','term-game__eyebrow',practice ? copy.practice : copy.normal),
      node('span','term-game__step',copy.step(session.index+1,session.questions.length)));
    const progress = node('progress','term-game__progress');
    progress.max = session.questions.length; progress.value = session.answers.length;
    progress.setAttribute('aria-label',copy.progress);
    const stats = node('div','term-game__stats');
    const paintStats = () => {
      const values = session.stats;
      stats.replaceChildren(stat(copy.points,`${values.score} / ${session.questions.length*10}`),
        stat(copy.right,String(values.right)),stat(copy.streak,String(values.streak)));
      progress.value = session.answers.length;
    };
    paintStats();
    const card = node('div','term-game__question-card');
    card.append(node('p','term-game__prompt',copy.question),title(question.term.headword_en,'term-game__term'));
    const choices = node('div','term-game__choices');
    choices.setAttribute('role','group'); choices.setAttribute('aria-label',copy.choices);
    const feedback = node('div','term-game__feedback');
    feedback.setAttribute('role','status'); feedback.setAttribute('aria-atomic','true');
    const footer = node('div','term-game__footer'); footer.hidden = true;
    const next = button((session.index+1 === session.questions.length ? copy.finish : copy.next)+' →',()=>{
      if (!session.advance()) return;
      if (session.complete) renderResults(); else renderQuestion();
      focusTitle();
    });
    question.options.forEach((item,index) => {
      const choice = node('button','term-game__choice'); choice.type = 'button';
      choice.append(node('span','term-game__letter',String.fromCharCode(65+index)),
        node('span','term-game__answer',item.ottoman_period_term));
      choice.addEventListener('click',()=>{
        const answer = session.answer(index);
        if (!answer) return;
        choice.classList.add('is-selected');
        [...choices.children].forEach((el,i)=>{
          el.disabled = true;
          if (question.options[i].slug === question.term.slug) el.classList.add('is-correct');
        });
        if (!answer.correct) choice.classList.add('is-incorrect');
        feedback.classList.add(answer.correct ? 'is-correct' : 'is-incorrect');
        feedback.append(node('strong','term-game__feedback-title',(answer.correct ? '✓ ' : '↗ ')+(answer.correct ? copy.correct : copy.incorrect)),
          node('p','term-game__equivalent',question.term.ottoman_period_term));
        const modern = question.term.modern_equivalent_tr?.trim();
        if (modern && modern !== '—' && normalizeAnswer(modern) !== normalizeAnswer(question.term.ottoman_period_term)) {
          feedback.append(node('p','term-game__modern',`${copy.modern}: ${modern}`));
        }
        paintStats(); footer.hidden = false;
        next.focus({preventScroll:true});
      });
      choices.append(choice);
    });
    footer.append(entryLink(question.term,copy.source),next);
    card.append(choices,feedback,footer);
    body.append(top,progress,stats,card,node('p','term-game__note',copy.sourceHint));
  }
  function renderResults() {
    const stats = session.stats;
    if (!practice && session.questions.length === 10) {
      best = Math.max(best,stats.score);
      try { localStorage.setItem(storageKey,String(best)); } catch { /* Quiz works without storage. */ }
    }
    body.replaceChildren();
    const result = node('div','term-game__result');
    const score = node('div','term-game__result-score');
    score.append(node('strong','',String(stats.score)),node('span','',`/ ${session.questions.length*10}`));
    const summary = node('div','term-game__result-copy');
    summary.append(node('p','term-game__eyebrow',copy.workshop),title(practice ? copy.practiceDone : copy.done,'term-game__welcome-title'),
      node('p','term-game__description',stats.accuracy === 100 ? copy.perfect : stats.accuracy >= 60 ? copy.good : copy.keepLearning));
    result.append(score,summary);
    const numbers = node('div','term-game__stats term-game__stats--result');
    numbers.append(stat(copy.right,String(stats.right)),stat(copy.wrong,String(stats.wrong)),
      stat(copy.accuracy,`${stats.accuracy}%`),stat(copy.longest,String(stats.bestStreak)));
    const actions = node('div','term-game__result-actions');
    const missed = session.answers.filter(answer=>!answer.correct).map(answer=>answer.term);
    actions.append(button(copy.newRound+' →',()=>{deck = makeRound(pool); begin(false);}));
    if (missed.length) actions.append(button(copy.reviewWrong,()=>begin(true,missed),true));
    actions.append(button(copy.back,()=>{deck = makeRound(pool); welcome(); focusTitle();},true));
    const review = node('details','term-game__review');
    review.append(node('summary','',copy.review(session.answers.length)));
    const list = node('ol','term-game__review-list');
    session.answers.forEach(answer=>{
      const row = node('li',answer.correct ? 'is-correct' : 'is-incorrect');
      const content = node('div','term-game__review-copy');
      content.append(node('strong','',answer.term.headword_en),
        node('span','',`${copy.correctAnswer}: ${answer.term.ottoman_period_term}`));
      if (!answer.correct) content.append(node('span','term-game__review-selected',`${copy.selected}: ${answer.selected.ottoman_period_term}`));
      const mark = node('span','term-game__review-mark',answer.correct ? '✓' : '✕');
      mark.setAttribute('aria-label',answer.correct ? copy.right : copy.wrong);
      row.append(mark,content,entryLink(answer.term,copy.reviewLink)); list.append(row);
    });
    review.append(list); body.append(result,numbers,actions,review);
    if (best) body.append(node('p','term-game__best',`${copy.best(best)} · ${copy.saved}`));
  }
  async function start() {
    if (busy || pool) return;
    busy = true; body.setAttribute('aria-busy','true');
    const status = node('p','term-game__loading',copy.loading); status.setAttribute('role','status');
    body.replaceChildren(status);
    try {
      pool = await loadPool(); deck = makeRound(pool);
      if (!deck.length) throw new Error('not_enough_choices');
      welcome();
    } catch {
      pool = null;
      const error = node('p','term-game__loading',copy.unavailable); error.setAttribute('role','status');
      body.replaceChildren(error,button(copy.retry,start));
    } finally { busy = false; body.setAttribute('aria-busy','false'); }
  }
  root.addEventListener('toggle',()=>{if (root.open) start();});
  if (window.location.hash === `#${root.id}`) root.open = true;
  if (root.open) start();
}
if (typeof document !== 'undefined') document.querySelectorAll('[data-term-game]').forEach(init);
