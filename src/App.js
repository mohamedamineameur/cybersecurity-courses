import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import './App.css';
function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}
function normalize(s) {
    return s
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
}
function getHashRoute() {
    const raw = window.location.hash.replace(/^#/, '');
    if (!raw)
        return { name: 'home' };
    const [name, a, b] = raw.split('/');
    if (name === 'acronyms')
        return { name: 'acronyms' };
    if (name === 'topic' && a && b)
        return { name: 'topic', subsectionId: decodeURIComponent(a), topicId: decodeURIComponent(b) };
    if (name === 'quiz' && a && b)
        return { name: 'quiz', subsectionId: decodeURIComponent(a), topicId: decodeURIComponent(b) };
    return { name: 'home' };
}
function setHashRoute(r) {
    if (r.name === 'home')
        window.location.hash = '';
    if (r.name === 'acronyms')
        window.location.hash = '#acronyms';
    if (r.name === 'topic')
        window.location.hash = `#topic/${encodeURIComponent(r.subsectionId)}/${encodeURIComponent(r.topicId)}`;
    if (r.name === 'quiz')
        window.location.hash = `#quiz/${encodeURIComponent(r.subsectionId)}/${encodeURIComponent(r.topicId)}`;
}
function useHashRoute() {
    const [route, setRoute] = useState(() => getHashRoute());
    useEffect(() => {
        const onHash = () => setRoute(getHashRoute());
        window.addEventListener('hashchange', onHash);
        return () => window.removeEventListener('hashchange', onHash);
    }, []);
    return route;
}
function useLocalStorageState(key, initial) {
    const [value, setValue] = useState(() => {
        try {
            const raw = localStorage.getItem(key);
            if (!raw)
                return initial;
            return JSON.parse(raw);
        }
        catch {
            return initial;
        }
    });
    useEffect(() => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        }
        catch {
            // ignore
        }
    }, [key, value]);
    return [value, setValue];
}
function useCourseData() {
    const [data, setData] = useState(null);
    const [err, setErr] = useState(null);
    useEffect(() => {
        let cancelled = false;
        Promise.all([
            fetch('/data/course.json').then((r) => r.json()),
            fetch('/data/acronyms.json').then((r) => r.json()),
        ])
            .then(([course, acronyms]) => {
            if (cancelled)
                return;
            setData(course);
            window.__acronyms = acronyms;
        })
            .catch((e) => {
            if (cancelled)
                return;
            setErr(e instanceof Error ? e.message : String(e));
        });
        return () => {
            cancelled = true;
        };
    }, []);
    return { data, err };
}
function getAcronyms() {
    const w = window;
    return w.__acronyms ?? null;
}
function findTopic(course, subsectionId, topicId) {
    for (const section of course.sections) {
        for (const sub of section.subsections) {
            if (sub.id !== subsectionId)
                continue;
            const topic = sub.topics.find((t) => t.id === topicId);
            if (topic)
                return { section, sub, topic };
        }
    }
    return null;
}
function topicText(t) {
    const parts = [];
    parts.push(t.title);
    if (t.content)
        parts.push(t.content);
    const walk = (item) => {
        if (item.title)
            parts.push(item.title);
        if (item.name)
            parts.push(item.name);
        if (item.description)
            parts.push(item.description);
        if (item.content)
            parts.push(item.content);
        if (item.examples?.length)
            parts.push(item.examples.join(' '));
        item.items?.forEach(walk);
    };
    t.items?.forEach(walk);
    if (t.quiz?.length)
        parts.push(t.quiz.map((q) => `${q.question} ${q.choices.join(' ')} ${q.correctAnswer} ${q.explanation ?? ''}`).join(' '));
    return normalize(parts.join(' '));
}
function formatInline(text, acronymMap) {
    const words = text.split(/(\b)/);
    return words.map((w, idx) => {
        const key = w.toUpperCase();
        const expanded = acronymMap.get(key);
        if (!expanded)
            return _jsx("span", { children: w }, idx);
        return (_jsx("span", { className: "acronym", title: expanded, "aria-label": `${w}: ${expanded}`, children: w }, idx));
    });
}
function ItemList({ items, acronymMap }) {
    return (_jsx("ul", { className: "itemList", children: items.map((it) => (_jsxs("li", { className: "itemCard", children: [_jsxs("div", { className: "itemHeader", children: [_jsx("div", { className: "itemTitle", children: it.name ?? it.title ?? it.id }), it.id ? _jsx("div", { className: "pill", children: it.id }) : null] }), it.description ? _jsx("p", { className: "muted", children: formatInline(it.description, acronymMap) }) : null, it.content ? _jsx("p", { children: formatInline(it.content, acronymMap) }) : null, it.examples?.length ? (_jsx("div", { className: "chips", children: it.examples.map((ex) => (_jsx("span", { className: "chip", children: formatInline(ex, acronymMap) }, ex))) })) : null, it.items?.length ? _jsx(ItemList, { items: it.items, acronymMap: acronymMap }) : null] }, it.id))) }));
}
function Quiz({ quiz, onDone }) {
    const [idx, setIdx] = useState(0);
    const [picked, setPicked] = useState(null);
    const [score, setScore] = useState(0);
    const q = quiz[idx];
    const done = idx >= quiz.length;
    useEffect(() => {
        setPicked(null);
    }, [idx]);
    if (done) {
        return (_jsxs("div", { className: "panel", children: [_jsx("h2", { children: "Bravo" }), _jsxs("p", { className: "muted", children: ["Score: ", _jsx("strong", { children: score }), " / ", quiz.length] }), _jsx("button", { className: "btnPrimary", onClick: () => onDone(score, quiz.length), children: "Revenir au cours" })] }));
    }
    const isCorrect = picked !== null && picked === q.correctAnswer;
    const isWrong = picked !== null && picked !== q.correctAnswer;
    return (_jsxs("div", { className: "panel", children: [_jsxs("div", { className: "quizTop", children: [_jsxs("div", { className: "pill", children: ["Question ", idx + 1, "/", quiz.length] }), _jsx("div", { className: "progress", "aria-label": "Progression", children: _jsx("div", { className: "bar", style: { width: `${Math.round(((idx + 1) / quiz.length) * 100)}%` } }) })] }), _jsx("h2", { className: "quizQ", children: q.question }), _jsx("div", { className: "choices", children: q.choices.map((c) => {
                    const selected = picked === c;
                    const correct = picked !== null && c === q.correctAnswer;
                    return (_jsx("button", { className: ['choice', selected ? 'selected' : '', correct ? 'correct' : '', selected && !correct ? 'wrong' : ''].join(' '), onClick: () => setPicked(c), disabled: picked !== null, children: c }, c));
                }) }), picked !== null ? (_jsxs("div", { className: ['feedback', isCorrect ? 'ok' : '', isWrong ? 'no' : ''].join(' '), children: [_jsx("div", { className: "feedbackTitle", children: isCorrect ? 'Correct' : 'Pas tout à fait' }), _jsx("div", { className: "muted", children: q.explanation ?? (isCorrect ? 'Bien joué.' : `La bonne réponse était: ${q.correctAnswer}.`) })] })) : null, _jsxs("div", { className: "quizActions", children: [_jsx("button", { className: "btnSecondary", onClick: () => {
                            const next = clamp(idx - 1, 0, quiz.length - 1);
                            setIdx(next);
                            setPicked(null);
                        }, disabled: idx === 0 || picked === null, children: "Pr\u00E9c\u00E9dent" }), _jsx("button", { className: "btnPrimary", onClick: () => {
                            if (picked === q.correctAnswer)
                                setScore((s) => s + 1);
                            setIdx((i) => i + 1);
                        }, disabled: picked === null, children: "Suivant" })] })] }));
}
function App() {
    const route = useHashRoute();
    const { data: course, err } = useCourseData();
    const [query, setQuery] = useState('');
    const [doneTopics, setDoneTopics] = useLocalStorageState('doneTopicsV1', {});
    const [quizScores, setQuizScores] = useLocalStorageState('quizScoresV1', {});
    const acronyms = getAcronyms();
    const acronymMap = useMemo(() => {
        const m = new Map();
        if (!acronyms)
            return m;
        for (const e of acronyms.entries) {
            const k = e.acronym.toUpperCase();
            if (!m.has(k))
                m.set(k, e.spelledOut);
        }
        return m;
    }, [acronyms]);
    const flatTopics = useMemo(() => {
        if (!course)
            return [];
        const list = [];
        for (const section of course.sections) {
            for (const sub of section.subsections) {
                for (const topic of sub.topics) {
                    list.push({ section, sub, topic, text: topicText(topic) });
                }
            }
        }
        return list;
    }, [course]);
    const totalTopics = flatTopics.length;
    const doneCount = Object.keys(doneTopics).length;
    const completionPct = totalTopics ? Math.round((doneCount / totalTopics) * 100) : 0;
    const qn = normalize(query);
    const results = useMemo(() => {
        if (!qn)
            return flatTopics.slice(0, 18);
        const hits = flatTopics
            .filter((x) => x.text.includes(qn) || normalize(x.sub.title).includes(qn) || normalize(x.section.title).includes(qn))
            .slice(0, 40);
        return hits;
    }, [flatTopics, qn]);
    const current = course && (route.name === 'topic' || route.name === 'quiz') ? findTopic(course, route.subsectionId, route.topicId) : null;
    const page = !course ? (_jsxs("div", { className: "panel", children: [_jsx("div", { className: "muted", children: "Chargement des cours\u2026" }), err ? _jsxs("div", { className: "error", children: ["Erreur: ", err] }) : null] })) : route.name === 'acronyms' ? (_jsx(AcronymsPage, { entries: acronyms?.entries ?? [] })) : route.name === 'quiz' && current?.topic.quiz?.length ? (_jsx(Quiz, { quiz: current.topic.quiz, onDone: (score, total) => {
            const key = `${current.sub.id}::${current.topic.id}`;
            setQuizScores((prev) => {
                const old = prev[key];
                const best = Math.max(old?.best ?? 0, score);
                return { ...prev, [key]: { best, total, at: Date.now() } };
            });
            setHashRoute({ name: 'topic', subsectionId: current.sub.id, topicId: current.topic.id });
        } })) : route.name === 'topic' && current ? (_jsx(TopicPage, { sectionTitle: current.section.title, subsection: current.sub, topic: current.topic, doneAt: doneTopics[`${current.sub.id}::${current.topic.id}`], bestQuiz: quizScores[`${current.sub.id}::${current.topic.id}`], acronymMap: acronymMap, onBack: () => setHashRoute({ name: 'home' }), onToggleDone: () => {
            const key = `${current.sub.id}::${current.topic.id}`;
            setDoneTopics((prev) => {
                const next = { ...prev };
                if (next[key])
                    delete next[key];
                else
                    next[key] = Date.now();
                return next;
            });
        }, onStartQuiz: () => setHashRoute({ name: 'quiz', subsectionId: current.sub.id, topicId: current.topic.id }) })) : (_jsx(HomePage, { course: course, query: query, onQuery: setQuery, completionPct: completionPct, doneCount: doneCount, totalTopics: totalTopics, results: results, doneTopics: doneTopics, quizScores: quizScores, onOpenTopic: (subsectionId, topicId) => setHashRoute({ name: 'topic', subsectionId, topicId }) }));
    return (_jsxs("div", { className: "appShell", children: [_jsxs("header", { className: "topBar", children: [_jsxs("div", { className: "brand", onClick: () => setHashRoute({ name: 'home' }), role: "button", tabIndex: 0, children: [_jsx("div", { className: "brandMark", "aria-hidden": "true", children: "S+" }), _jsxs("div", { className: "brandText", children: [_jsx("div", { className: "brandTitle", children: "R\u00E9vision Security+" }), _jsx("div", { className: "brandSub", children: "Cours + quiz + acronymes" })] })] }), _jsxs("nav", { className: "topNav", children: [_jsx("button", { className: ['navBtn', route.name === 'home' ? 'active' : ''].join(' '), onClick: () => setHashRoute({ name: 'home' }), children: "R\u00E9viser" }), _jsx("button", { className: ['navBtn', route.name === 'acronyms' ? 'active' : ''].join(' '), onClick: () => setHashRoute({ name: 'acronyms' }), children: "Acronymes" })] })] }), _jsx("main", { className: "main", children: page }), _jsxs("footer", { className: "bottomBar", "aria-label": "Navigation", children: [_jsxs("button", { className: ['bottomBtn', route.name === 'home' ? 'active' : ''].join(' '), onClick: () => setHashRoute({ name: 'home' }), children: [_jsx("span", { className: "bottomIcon", "aria-hidden": "true", children: "\u2301" }), _jsx("span", { className: "bottomLabel", children: "Accueil" })] }), _jsxs("button", { className: ['bottomBtn', route.name === 'acronyms' ? 'active' : ''].join(' '), onClick: () => setHashRoute({ name: 'acronyms' }), children: [_jsx("span", { className: "bottomIcon", "aria-hidden": "true", children: "Aa" }), _jsx("span", { className: "bottomLabel", children: "Acronymes" })] })] })] }));
}
export default App;
import { useEffect, useMemo } from 'react';
function HomePage(props) {
    const { course, query, onQuery, completionPct, doneCount, totalTopics, results, doneTopics, quizScores, onOpenTopic } = props;
    return (_jsxs("div", { className: "stack", children: [_jsxs("section", { className: "heroCard", children: [_jsx("div", { className: "heroGlow", "aria-hidden": "true" }), _jsxs("div", { className: "heroInner", children: [_jsx("div", { className: "heroKicker", children: course.domain }), _jsx("h1", { className: "heroTitle", children: "R\u00E9vise vite, r\u00E9vise bien." }), _jsx("p", { className: "heroSubtitle", children: "Recherche instantan\u00E9e, cours lisibles sur mobile, quiz par topic, progression sauvegard\u00E9e." }), _jsxs("div", { className: "heroStats", children: [_jsxs("div", { className: "stat", children: [_jsxs("div", { className: "statTop", children: [_jsx("div", { className: "pill", children: "Progression" }), _jsxs("div", { className: "statPct", children: [completionPct, "%"] })] }), _jsx("div", { className: "progress big", "aria-label": "Progression totale", children: _jsx("div", { className: "bar", style: { width: `${completionPct}%` } }) }), _jsxs("div", { className: "muted", children: [doneCount, "/", totalTopics, " topics coch\u00E9s"] })] }), _jsxs("div", { className: "stat side", children: [_jsx("div", { className: "pill", children: "Version" }), _jsx("div", { className: "statPct", children: course.version }), _jsx("div", { className: "muted", children: "Donn\u00E9es locales (JSON)" })] })] })] })] }), _jsxs("section", { className: "panel", children: [_jsxs("div", { className: "searchRow", children: [_jsx("input", { className: "search", value: query, onChange: (e) => onQuery(e.target.value), placeholder: "Rechercher un concept (ex: Zero Trust, CIA, AES, IDS...)", inputMode: "search", "aria-label": "Recherche" }), _jsx("button", { className: "btnSecondary", onClick: () => onQuery(''), disabled: !query, children: "Effacer" })] }), _jsx("div", { className: "muted", children: "Astuce: les acronymes connus sont surlign\u00E9s dans les pages de cours." })] }), _jsx("section", { className: "grid", children: results.map(({ section, sub, topic }) => {
                    const key = `${sub.id}::${topic.id}`;
                    const done = Boolean(doneTopics[key]);
                    const best = quizScores[key];
                    const hasQuiz = Boolean(topic.quiz?.length);
                    return (_jsxs("button", { className: ['topicCard', done ? 'done' : ''].join(' '), onClick: () => onOpenTopic(sub.id, topic.id), children: [_jsxs("div", { className: "topicTop", children: [_jsx("div", { className: "topicTitle", children: topic.title }), _jsxs("div", { className: "chips", children: [_jsx("span", { className: "pill", children: sub.id }), hasQuiz ? _jsx("span", { className: "pill accent", children: "Quiz" }) : _jsx("span", { className: "pill", children: "Cours" })] })] }), _jsxs("div", { className: "muted small", children: [section.title, " \u2022 ", sub.title] }), _jsxs("div", { className: "topicBottom", children: [done ? _jsx("span", { className: "badge ok", children: "Fait" }) : _jsx("span", { className: "badge", children: "\u00C0 faire" }), best ? (_jsxs("span", { className: "badge", children: ["Best quiz: ", best.best, "/", best.total] })) : null] })] }, key));
                }) }), _jsxs("section", { className: "panel", children: [_jsx("h2", { children: "Plan de r\u00E9vision (par sections)" }), _jsx("div", { className: "outline", children: course.sections.map((s) => (_jsxs("details", { className: "outlineBlock", children: [_jsxs("summary", { children: [_jsxs("span", { className: "outlineTitle", children: [s.id, " \u2014 ", s.title] }), _jsxs("span", { className: "pill", children: [s.subsections.reduce((n, ss) => n + ss.topics.length, 0), " topics"] })] }), _jsx("div", { className: "outlineInner", children: s.subsections.map((ss) => (_jsxs("div", { className: "outlineRow", children: [_jsxs("div", { className: "outlineLeft", children: [_jsx("div", { className: "pill", children: ss.id }), _jsx("div", { className: "outlineName", children: ss.title })] }), _jsxs("div", { className: "outlineTopics", children: [ss.topics.slice(0, 6).map((t) => (_jsx("button", { className: "outlineTopic", onClick: () => onOpenTopic(ss.id, t.id), children: t.title }, t.id))), ss.topics.length > 6 ? _jsxs("div", { className: "muted small", children: ["+", ss.topics.length - 6, " autres"] }) : null] })] }, ss.id))) })] }, s.id))) })] })] }));
}
function TopicPage(props) {
    const { sectionTitle, subsection, topic, doneAt, bestQuiz, acronymMap, onBack, onToggleDone, onStartQuiz } = props;
    return (_jsxs("div", { className: "stack", children: [_jsxs("section", { className: "panel", children: [_jsxs("div", { className: "topicHeader", children: [_jsx("button", { className: "btnSecondary", onClick: onBack, children: "\u2190 Retour" }), _jsxs("div", { className: "crumbs", children: [_jsx("span", { className: "pill", children: subsection.id }), _jsxs("span", { className: "muted small", children: [sectionTitle, " \u2022 ", subsection.title] })] })] }), _jsx("h1", { className: "pageTitle", children: topic.title }), topic.content ? _jsx("p", { className: "lead", children: formatInline(topic.content, acronymMap) }) : null, _jsxs("div", { className: "actionsRow", children: [_jsx("button", { className: ['btnPrimary', doneAt ? 'ghost' : ''].join(' '), onClick: onToggleDone, children: doneAt ? '✓ Marqué comme fait' : 'Marquer comme fait' }), topic.quiz?.length ? (_jsxs("button", { className: "btnSecondary", onClick: onStartQuiz, children: ["Lancer le quiz (", topic.quiz.length, ")"] })) : (_jsx("button", { className: "btnSecondary", disabled: true, children: "Quiz indisponible" }))] }), bestQuiz ? (_jsxs("div", { className: "feedback ok", children: [_jsx("div", { className: "feedbackTitle", children: "Meilleur score quiz" }), _jsxs("div", { className: "muted", children: [bestQuiz.best, "/", bestQuiz.total] })] })) : null] }), topic.items?.length ? (_jsxs("section", { className: "panel", children: [_jsx("h2", { children: "Points cl\u00E9s" }), _jsx(ItemList, { items: topic.items, acronymMap: acronymMap })] })) : null, topic.quiz?.length ? (_jsxs("section", { className: "panel", children: [_jsx("h2", { children: "Mini-quiz (aper\u00E7u)" }), _jsx("div", { className: "muted", children: "Tu peux lancer le quiz complet en haut." }), _jsx("div", { className: "miniQuiz", children: topic.quiz.slice(0, 2).map((q) => (_jsxs("div", { className: "miniQ", children: [_jsx("div", { className: "miniQTitle", children: q.question }), _jsx("div", { className: "chips", children: q.choices.slice(0, 4).map((c) => (_jsx("span", { className: "chip", children: c }, c))) }), _jsxs("div", { className: "muted small", children: ["R\u00E9ponse: ", q.correctAnswer] })] }, q.question))) })] })) : null] }));
}
function AcronymsPage({ entries }) {
    const [q, setQ] = useState('');
    const qq = normalize(q);
    const filtered = useMemo(() => {
        const list = entries.slice().sort((a, b) => a.acronym.localeCompare(b.acronym));
        if (!qq)
            return list.slice(0, 250);
        return list.filter((e) => normalize(e.acronym).includes(qq) || normalize(e.spelledOut).includes(qq)).slice(0, 250);
    }, [entries, qq]);
    return (_jsxs("div", { className: "stack", children: [_jsxs("section", { className: "heroCard small", children: [_jsx("div", { className: "heroGlow", "aria-hidden": "true" }), _jsxs("div", { className: "heroInner", children: [_jsx("div", { className: "heroKicker", children: "Glossaire" }), _jsx("h1", { className: "heroTitle", children: "Acronymes Security" }), _jsx("p", { className: "heroSubtitle", children: "Recherche rapide. Appuie sur un acronyme pour copier." })] })] }), _jsx("section", { className: "panel", children: _jsxs("div", { className: "searchRow", children: [_jsx("input", { className: "search", value: q, onChange: (e) => setQ(e.target.value), placeholder: "Ex: AES, RBAC, SIEM\u2026", "aria-label": "Recherche acronymes" }), _jsx("button", { className: "btnSecondary", onClick: () => setQ(''), disabled: !q, children: "Effacer" })] }) }), _jsx("section", { className: "grid", children: filtered.map((e) => (_jsxs("button", { className: "topicCard", onClick: async () => {
                        try {
                            await navigator.clipboard.writeText(`${e.acronym} — ${e.spelledOut}`);
                        }
                        catch {
                            // ignore
                        }
                    }, children: [_jsxs("div", { className: "topicTop", children: [_jsx("div", { className: "topicTitle", children: e.acronym }), _jsx("div", { className: "pill", children: "Copier" })] }), _jsx("div", { className: "muted", children: e.spelledOut })] }, `${e.acronym}::${e.spelledOut}`))) })] }));
}
