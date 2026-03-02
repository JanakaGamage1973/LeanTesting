import { collection, query, where, getDocs, getDoc, doc, setDoc, updateDoc, serverTimestamp, Timestamp } from 'https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js';
import { db } from './firebase-config.js?v=2';
import { loadAllFolders, getDescendantFolderIdsLocal, chunkArray } from './folder-service.js?v=2';

export async function selectQuestions(testId, testConfig) {
    const questionsRef = collection(db, 'questions');

    // Use folder-based selection if test has a folderId, otherwise legacy testId path
    if (testConfig.folderId) {
        return selectQuestionsFromFolder(questionsRef, testConfig);
    }
    return selectQuestionsLegacy(questionsRef, testId, testConfig);
}

// New: folder-based question selection (uses single-field queries to avoid composite indexes)
async function selectQuestionsFromFolder(questionsRef, testConfig) {
    // Load all folders locally and compute descendant IDs (avoids composite index on folders)
    const allFolders = await loadAllFolders();
    const folderIds = getDescendantFolderIdsLocal(testConfig.folderId, allFolders);
    const folderChunks = chunkArray(folderIds, 30);

    // Query only by folderId (single-field index), filter isActive & difficulty client-side
    const allDocs = [];
    const promises = folderChunks.map(chunk =>
        getDocs(query(questionsRef, where('folderId', 'in', chunk)))
    );
    const snapshots = await Promise.all(promises);
    const seenQuestions = new Set();
    let rawCount = 0, inactiveCount = 0, dupCount = 0;
    for (const snap of snapshots) {
        for (const d of snap.docs) {
            rawCount++;
            const data = d.data();
            if (!data.isActive) { inactiveCount++; continue; }
            // Deduplicate by question text to avoid duplicate questions in the quiz
            const key = (data.question || '').trim().toLowerCase();
            if (seenQuestions.has(key)) { dupCount++; continue; }
            seenQuestions.add(key);
            allDocs.push(d);
        }
    }

    const easyDocs = allDocs.filter(d => d.data().difficulty === 'easy');
    const mediumDocs = allDocs.filter(d => d.data().difficulty === 'medium');
    const hardDocs = allDocs.filter(d => d.data().difficulty === 'hard');

    // Log diagnostics to help debug question count issues
    console.log('[QuizEngine] Selection stats:', {
        folders: folderIds.length,
        rawFromDB: rawCount, inactive: inactiveCount, duplicates: dupCount,
        uniqueActive: allDocs.length,
        easy: easyDocs.length, medium: mediumDocs.length, hard: hardDocs.length,
        unmatched: allDocs.length - easyDocs.length - mediumDocs.length - hardDocs.length,
        config: { easy: testConfig.easyCount, medium: testConfig.mediumCount, hard: testConfig.hardCount, total: testConfig.totalQuestions }
    });

    const easyTarget = testConfig.easyCount || 12;
    const mediumTarget = testConfig.mediumCount || 9;
    const hardTarget = testConfig.hardCount || 9;
    const totalTarget = testConfig.totalQuestions || (easyTarget + mediumTarget + hardTarget);

    const selectedEasy = shuffleArray(easyDocs).slice(0, easyTarget);
    const selectedMedium = shuffleArray(mediumDocs).slice(0, mediumTarget);
    const selectedHard = shuffleArray(hardDocs).slice(0, hardTarget);

    let selected = [...selectedEasy, ...selectedMedium, ...selectedHard];

    // If difficulty pools didn't have enough, fill up from remaining questions
    if (selected.length < totalTarget && allDocs.length > selected.length) {
        const selectedIds = new Set(selected.map(d => d.id));
        const remaining = shuffleArray(allDocs.filter(d => !selectedIds.has(d.id)));
        selected = [...selected, ...remaining.slice(0, totalTarget - selected.length)];
        console.log('[QuizEngine] Filled up to', selected.length, 'of', totalTarget, 'target');
    }

    const result = selected.map(d => ({ id: d.id, ...d.data() }));
    console.log('[QuizEngine] Final question count:', result.length);
    return shuffleArray(result);
}

// Legacy: testId-based question selection (backward compatibility)
// Uses single-field query to avoid composite index requirements
async function selectQuestionsLegacy(questionsRef, testId, testConfig) {
    const snap = await getDocs(query(questionsRef, where('testId', '==', testId)));

    const allDocs = snap.docs.filter(d => d.data().isActive);
    const easyDocs = allDocs.filter(d => d.data().difficulty === 'easy');
    const mediumDocs = allDocs.filter(d => d.data().difficulty === 'medium');
    const hardDocs = allDocs.filter(d => d.data().difficulty === 'hard');

    console.log('[QuizEngine Legacy] Selection stats:', {
        total: allDocs.length, easy: easyDocs.length, medium: mediumDocs.length, hard: hardDocs.length,
        config: { easy: testConfig.easyCount, medium: testConfig.mediumCount, hard: testConfig.hardCount, total: testConfig.totalQuestions }
    });

    const easyTarget = testConfig.easyCount || 12;
    const mediumTarget = testConfig.mediumCount || 9;
    const hardTarget = testConfig.hardCount || 9;
    const totalTarget = testConfig.totalQuestions || (easyTarget + mediumTarget + hardTarget);

    const selectedEasy = shuffleArray(easyDocs).slice(0, easyTarget);
    const selectedMedium = shuffleArray(mediumDocs).slice(0, mediumTarget);
    const selectedHard = shuffleArray(hardDocs).slice(0, hardTarget);

    let selected = [...selectedEasy, ...selectedMedium, ...selectedHard];

    // If difficulty pools didn't have enough, fill up from remaining questions
    if (selected.length < totalTarget && allDocs.length > selected.length) {
        const selectedIds = new Set(selected.map(d => d.id));
        const remaining = shuffleArray(allDocs.filter(d => !selectedIds.has(d.id)));
        selected = [...selected, ...remaining.slice(0, totalTarget - selected.length)];
        console.log('[QuizEngine Legacy] Filled up to', selected.length, 'of', totalTarget, 'target');
    }

    const result = selected.map(d => ({ id: d.id, ...d.data() }));
    console.log('[QuizEngine Legacy] Final question count:', result.length);
    return shuffleArray(result);
}

export function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

export class QuizTimer {
    constructor(durationMinutes, onTick, onExpire) {
        this.totalSeconds = durationMinutes * 60;
        this.remainingSeconds = this.totalSeconds;
        this.onTick = onTick;
        this.onExpire = onExpire;
        this.intervalId = null;
    }

    start() {
        this.onTick(this.remainingSeconds);
        this.intervalId = setInterval(() => {
            this.remainingSeconds--;
            this.onTick(this.remainingSeconds);
            if (this.remainingSeconds <= 0) {
                this.stop();
                this.onExpire();
            }
        }, 1000);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    setRemaining(seconds) {
        this.remainingSeconds = seconds;
    }

    getFormatted() {
        const m = Math.floor(this.remainingSeconds / 60);
        const s = this.remainingSeconds % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
}

export async function createAttempt(userId, testId, questions) {
    const attemptRef = doc(collection(db, 'attempts'));
    const attemptData = {
        userId,
        testId,
        startedAt: serverTimestamp(),
        completedAt: null,
        status: 'in_progress',
        score: 0,
        totalQuestions: questions.length,
        percentage: 0,
        timeTaken: 0,
        answers: questions.map(q => ({
            questionId: q.id,
            questionText: q.question,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            selectedAnswer: null,
            correctAnswer: q.correctAnswer,
            isCorrect: false,
            difficulty: q.difficulty
        }))
    };

    await setDoc(attemptRef, attemptData);
    return { id: attemptRef.id, ...attemptData };
}

export async function submitAttempt(attemptId, answers, timerRemaining, totalSeconds) {
    let correct = 0;
    const gradedAnswers = answers.map(a => {
        const isCorrect = a.selectedAnswer === a.correctAnswer;
        if (isCorrect) correct++;
        return { ...a, isCorrect };
    });

    const timeTaken = totalSeconds - timerRemaining;
    const percentage = Math.round((correct / answers.length) * 100);

    await updateDoc(doc(db, 'attempts', attemptId), {
        completedAt: serverTimestamp(),
        status: timerRemaining <= 0 ? 'timed_out' : 'completed',
        score: correct,
        percentage,
        timeTaken,
        answers: gradedAnswers
    });

    return { score: correct, totalQuestions: answers.length, percentage, timeTaken };
}

export function saveQuizState(attemptId, answers, remainingSeconds, questionOrder) {
    try {
        localStorage.setItem(`quiz_${attemptId}`, JSON.stringify({
            answers,
            remainingSeconds,
            questionOrder,
            savedAt: Date.now()
        }));
    } catch (e) {
        console.warn('Could not save quiz state:', e);
    }
}

export function loadQuizState(attemptId) {
    try {
        const data = localStorage.getItem(`quiz_${attemptId}`);
        if (!data) return null;
        const state = JSON.parse(data);
        // Expire after 45 minutes
        if (Date.now() - state.savedAt > 45 * 60 * 1000) {
            localStorage.removeItem(`quiz_${attemptId}`);
            return null;
        }
        return state;
    } catch (e) {
        return null;
    }
}

export function clearQuizState(attemptId) {
    localStorage.removeItem(`quiz_${attemptId}`);
}

export function calculateBreakdown(answers) {
    const breakdown = { easy: { correct: 0, total: 0 }, medium: { correct: 0, total: 0 }, hard: { correct: 0, total: 0 } };
    for (const a of answers) {
        const d = a.difficulty;
        if (breakdown[d]) {
            breakdown[d].total++;
            if (a.isCorrect) breakdown[d].correct++;
        }
    }
    return breakdown;
}
