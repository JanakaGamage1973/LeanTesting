import { onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.3.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.3.0/firebase-auth.js';
import { auth, db, EMAIL_DOMAIN } from './firebase-config.js';

function getBasePath() {
    const path = window.location.pathname;
    const segments = path.split('/');
    // Find index of LeanTesting in the path
    const idx = segments.indexOf('LeanTesting');
    if (idx !== -1) {
        return segments.slice(0, idx + 1).join('/');
    }
    return '';
}

export const BASE_PATH = getBasePath();

export function navigateTo(path) {
    window.location.href = `${BASE_PATH}${path}`;
}

export function requireAuth() {
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe();
            if (!user) {
                navigateTo('/index.html');
                reject('Not authenticated');
                return;
            }
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (!userDoc.exists()) {
                    await logout();
                    reject('User profile not found');
                    return;
                }
                resolve({ uid: user.uid, email: user.email, ...userDoc.data() });
            } catch (e) {
                console.error('Auth error:', e);
                reject(e);
            }
        });
    });
}

export async function requireAdmin() {
    const user = await requireAuth();
    if (user.role !== 'admin') {
        navigateTo('/index.html');
        throw new Error('Admin access required');
    }
    return user;
}

export async function requireStudent() {
    const user = await requireAuth();
    if (user.role !== 'student') {
        navigateTo('/admin/index.html');
        throw new Error('Student access required');
    }
    return user;
}

export async function login(username, password) {
    const email = `${username.toLowerCase().trim()}${EMAIL_DOMAIN}`;
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const userDoc = await getDoc(doc(db, 'users', credential.user.uid));
    if (!userDoc.exists()) {
        await signOut(auth);
        throw new Error('User profile not found');
    }
    return { uid: credential.user.uid, ...userDoc.data() };
}

export async function logout() {
    await signOut(auth);
    navigateTo('/index.html');
}

// Create user using secondary app to avoid signing out admin
let secondaryApp = null;
let secondaryAuth = null;

function getSecondaryAuth() {
    if (!secondaryApp) {
        const config = JSON.parse(JSON.stringify(auth.app.options));
        secondaryApp = initializeApp(config, 'SecondaryApp');
        secondaryAuth = getAuth(secondaryApp);
    }
    return secondaryAuth;
}

export async function createUser(username, password, displayName, role, adminUid) {
    const secAuth = getSecondaryAuth();
    const email = `${username.toLowerCase().trim()}${EMAIL_DOMAIN}`;

    const credential = await createUserWithEmailAndPassword(secAuth, email, password);
    await signOut(secAuth);

    await setDoc(doc(db, 'users', credential.user.uid), {
        username: username.toLowerCase().trim(),
        email,
        displayName,
        role: role || 'student',
        createdAt: serverTimestamp(),
        createdBy: adminUid,
        isActive: true
    });

    return credential.user.uid;
}
