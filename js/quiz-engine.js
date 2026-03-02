import { collection, query, where, getDocs, doc, setDoc, updateDoc, serverTimestamp, Timestamp } from 'https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js';
import { db } from './firebase-config.js';

export async function selectQuestions(testId, testConfig) {
    const questionsRef = collection(db, 'questions');

    const [easySnap, mediumSnap, hardSnap] = await Promise.all([
        getDocs(query(questionsRef, where('testId', '==', testId), where('difficulty', '==', 'easy'), where('isActive', '==', true))),
        getDocs(query(questionsRef, where('testId', '==', testId), where('difficulty', '==', 'medium'), where('isActive', '==', true))),
        getDocs(query(questionsRef, where('testId', '==', testId), where('difficulty', '==', 'hard'), where('isActive', '==', true)))
    ]);

    const easyDocs = shuffleArray(easySnap.docs).slice(0, testConfig.easyCount || 12);
    const mediumDocs = shuffleArray(mediumSnap.docs).slice(0, testConfig.mediumCount || 9);
    const hardDocs = shuffleArray(hardSnap.docs).slice(0, testConfig.hardCount || 9);

    const selected = [...easyDocs, ...mediumDocs, ...hardDocs].map(d => ({
        id: d.id,
        ...d.data()
    }));

    return shuffleArray(selected);
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
