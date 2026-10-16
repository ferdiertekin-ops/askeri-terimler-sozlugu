// Optional dictionary game. Questions and choices come from published records.
export function normalizeAnswer(value) {
  return String(value || '').toLocaleLowerCase('tr-TR').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

export function questionPool(items) {
  const candidates = items.filter(item => item && typeof item.slug === 'string' &&
    typeof item.headword_en === 'string' && typeof item.ottoman_period_term === 'string' &&
    item.headword_en.trim().length >= 2 && item.headword_en.length <= 65 &&
    item.ottoman_period_term.trim().length >= 2 && item.ottoman_period_term.length <= 55 &&
    !/[\n\r/;=]/.test(item.headword_en + item.ottoman_period_term) &&
    normalizeAnswer(item.headword_en) !== normalizeAnswer(item.ottoman_period_term));
  const byHeadword = new Map();
  for (const item of candidates) {
    const key = normalizeAnswer(item.headword_en);
    const group = byHeadword.get(key) || [];
    group.push(item); byHeadword.set(key, group);
  }
  return [...byHeadword.values()].filter(group => new Set(group.map(item => normalizeAnswer(item.ottoman_period_term))).size === 1)
    .map(group => group[0]);
}

function shuffled(items, random = Math.random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function makeQuestion(pool, previousSlug, random = Math.random) {
  for (const term of shuffled(pool.filter(item => item.slug !== previousSlug), random)) {
    const correct = normalizeAnswer(term.ottoman_period_term);
    const used = new Set([correct]);
    const tokens = new Set(correct.split(' '));
    const alternatives = [];
    for (const item of shuffled(pool, random)) {
      const answer = normalizeAnswer(item.ottoman_period_term);
      if (used.has(answer) || answer.split(' ').some(token => tokens.has(token)) ||
          normalizeAnswer(item.headword_en) === normalizeAnswer(term.headword_en)) continue;
      used.add(answer); alternatives.push(item);
      if (alternatives.length === 3) break;
    }
    if (alternatives.length === 3) return { term, options: shuffled([term, ...alternatives], random) };
  }
  return previousSlug ? makeQuestion(pool, null, random) : null;
}

async function init(root) {
  const en = document.documentElement.lang.startsWith('en');
  const copy = en ? {
    loading:'Preparing a question…', unavailable:'A question could not be loaded. Please try again.',
    retry:'Try again', question:'Which period equivalent is given in this dictionary entry?',
    correct:'Correct.', incorrect:'Incorrect. The answer in this entry is', next:'Next question',
    source:'Read the entry ↗', score:(right,total)=>`${right} / ${total} correct`,
    period:'Period equivalent'
  } : {
    loading:'Soru hazırlanıyor…', unavailable:'Soru yüklenemedi. Yeniden deneyebilirsiniz.',
    retry:'Yeniden dene', question:'Bu maddenin sözlükteki dönem karşılığı hangisidir?',
    correct:'Doğru cevap.', incorrect:'Yanlış cevap. Bu maddede verilen karşılık:', next:'Yeni soru',
    source:'Maddeyi incele ↗', score:(right,total)=>`${total} soruda ${right} doğru`,
    period:'Dönem karşılığı'
  };
  const body = root.querySelector('.term-game__body');
  let pool, question, answered = false, previousSlug, correctCount = 0, totalCount = 0, busy = false;
  const text = (tag, className, value) => {
    const node = document.createElement(tag); node.className = className; node.textContent = value; return node;
  };
  async function loadPool() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const get = async offset => {
        const response = await fetch(`/api/terms?limit=100&offset=${offset}`, {headers:{Accept:'application/json'},signal:controller.signal});
        const data = await response.json();
        if (!response.ok || !data.ok || !Array.isArray(data.items)) throw new Error('unavailable');
        return data;
      };
      const first = await get(0);
      const total = Number(first.total) || first.items.length;
      const offset = Math.floor(Math.random() * Math.max(1, total - 99));
      const sample = offset > 0 ? await get(offset) : first;
      return questionPool([...first.items, ...sample.items]);
    } finally { clearTimeout(timer); }
  }
  function renderQuestion() {
    question = makeQuestion(pool, previousSlug);
    if (!question) throw new Error('not_enough_choices');
    previousSlug = question.term.slug; answered = false;
    body.replaceChildren();
    body.append(text('p','term-game__prompt',copy.question),text('h3','term-game__term',question.term.headword_en));
    const choices = text('div','term-game__choices','');
    const feedback = text('p','term-game__feedback','');
    feedback.setAttribute('role','status');
    const footer = text('div','term-game__footer',''); footer.hidden = true;
    question.options.forEach((item,index) => {
      const button = text('button','term-game__choice',''); button.type = 'button';
      button.append(text('span','term-game__letter',String.fromCharCode(65+index)),text('span','',item.ottoman_period_term));
      button.addEventListener('click', () => {
        if (answered) return;
        answered = true; totalCount++;
        button.classList.add('is-selected');
        const correct = item.slug === question.term.slug;
        if (correct) correctCount++;
        [...choices.children].forEach((choice,i) => {
          choice.disabled = true;
          if (question.options[i].slug === question.term.slug) choice.classList.add('is-correct');
        });
        if (!correct) button.classList.add('is-incorrect');
        feedback.classList.add(correct ? 'is-correct' : 'is-incorrect');
        feedback.textContent = correct ? `✓ ${copy.correct} ${copy.score(correctCount,totalCount)}.` : `✕ ${copy.incorrect} ${question.term.ottoman_period_term}. ${copy.score(correctCount,totalCount)}.`;
        footer.hidden = false;
      });
      choices.append(button);
    });
    const source = text('a','term-game__source',copy.source);
    source.href = `${en ? '/en/term/' : '/terim/'}${encodeURIComponent(question.term.slug)}/`;
    const next = text('button','term-game__next',copy.next+' →'); next.type = 'button';
    next.addEventListener('click', () => { renderQuestion(); body.querySelector('button')?.focus(); });
    footer.append(source,next); body.append(choices,feedback,footer);
  }
  async function start() {
    if (busy || pool) return;
    busy = true; body.replaceChildren(text('p','term-game__feedback',copy.loading));
    try { pool = await loadPool(); renderQuestion(); }
    catch {
      pool = null; body.replaceChildren(text('p','term-game__feedback',copy.unavailable));
      const retry = text('button','term-game__next',copy.retry); retry.type = 'button';
      retry.addEventListener('click',start); body.append(retry);
    } finally { busy = false; }
  }
  root.addEventListener('toggle', () => { if (root.open) start(); });
}
if (typeof document !== 'undefined') document.querySelectorAll('[data-term-game]').forEach(init);
