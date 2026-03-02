import { collection, query, where, getDocs, getDoc, doc, setDoc, updateDoc, writeBatch, serverTimestamp, orderBy } from 'https://www.gstatic.com/firebasejs/11.3.0/firebase-firestore.js';
import { db } from './firebase-config.js';

// ── Load & Tree Building ─────────────────────────────────────────────

export async function loadAllFolders() {
    const snap = await getDocs(query(
        collection(db, 'folders'),
        where('isActive', '==', true)
    ));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function buildFolderTree(folders) {
    const map = {};
    const roots = [];

    folders.forEach(f => { map[f.id] = { ...f, children: [] }; });
    folders.forEach(f => {
        if (f.parentId && map[f.parentId]) {
            map[f.parentId].children.push(map[f.id]);
        } else {
            roots.push(map[f.id]);
        }
    });

    const sortChildren = (node) => {
        node.children.sort((a, b) => (a.order || 0) - (b.order || 0));
        node.children.forEach(sortChildren);
    };
    roots.sort((a, b) => (a.order || 0) - (b.order || 0));
    roots.forEach(sortChildren);

    return roots;
}

// ── Descendant Queries ───────────────────────────────────────────────

export async function getDescendantFolderIds(rootFolderId) {
    const rootDoc = await getDoc(doc(db, 'folders', rootFolderId));
    if (!rootDoc.exists()) return [rootFolderId];
    const rootPath = rootDoc.data().path;

    const snap = await getDocs(query(
        collection(db, 'folders'),
        where('path', '>=', rootPath),
        where('path', '<', rootPath + '\uf8ff'),
        where('isActive', '==', true)
    ));

    return snap.docs.map(d => d.id);
}

// Get descendant IDs from already-loaded folders (no extra Firestore reads)
export function getDescendantFolderIdsLocal(rootFolderId, allFolders) {
    const root = allFolders.find(f => f.id === rootFolderId);
    if (!root) return [rootFolderId];
    const rootPath = root.path;
    return allFolders
        .filter(f => f.path && f.path.startsWith(rootPath))
        .map(f => f.id);
}

// ── CRUD Operations ──────────────────────────────────────────────────

export async function createFolder(name, parentId, adminUid) {
    const folderRef = doc(collection(db, 'folders'));
    const folderId = folderRef.id;

    let path, depth, order;

    if (parentId) {
        const parentDoc = await getDoc(doc(db, 'folders', parentId));
        if (!parentDoc.exists()) throw new Error('Parent folder not found');
        const parent = parentDoc.data();
        path = parent.path + '/' + folderId;
        depth = (parent.depth || 0) + 1;

        // Count existing siblings for order
        const siblingsSnap = await getDocs(query(
            collection(db, 'folders'),
            where('parentId', '==', parentId),
            where('isActive', '==', true)
        ));
        order = siblingsSnap.size;
    } else {
        path = '/' + folderId;
        depth = 0;
        const rootsSnap = await getDocs(query(
            collection(db, 'folders'),
            where('parentId', '==', null),
            where('isActive', '==', true)
        ));
        order = rootsSnap.size;
    }

    await setDoc(folderRef, {
        name,
        parentId: parentId || null,
        path,
        depth,
        order,
        questionCount: 0,
        createdAt: serverTimestamp(),
        createdBy: adminUid,
        isActive: true
    });

    return { id: folderId, name, parentId: parentId || null, path, depth, order, questionCount: 0, isActive: true };
}

export async function renameFolder(folderId, newName) {
    await updateDoc(doc(db, 'folders', folderId), { name: newName });
}

export async function deleteFolder(folderId) {
    // Soft-delete folder and all descendants + their questions
    const folderDoc = await getDoc(doc(db, 'folders', folderId));
    if (!folderDoc.exists()) return;
    const folderData = folderDoc.data();
    const folderPath = folderData.path;

    // Find all descendant folders
    const descendantsSnap = await getDocs(query(
        collection(db, 'folders'),
        where('path', '>=', folderPath),
        where('path', '<', folderPath + '\uf8ff'),
        where('isActive', '==', true)
    ));

    const folderIds = descendantsSnap.docs.map(d => d.id);

    // Batch deactivate folders
    const folderChunks = chunkArray(descendantsSnap.docs, 450);
    for (const chunk of folderChunks) {
        const batch = writeBatch(db);
        for (const d of chunk) {
            batch.update(d.ref, { isActive: false });
        }
        await batch.commit();
    }

    // Deactivate questions in these folders (batch by 30 for 'in' queries)
    const idChunks = chunkArray(folderIds, 30);
    for (const idChunk of idChunks) {
        const questionsSnap = await getDocs(query(
            collection(db, 'questions'),
            where('folderId', 'in', idChunk),
            where('isActive', '==', true)
        ));
        const qChunks = chunkArray(questionsSnap.docs, 450);
        for (const qChunk of qChunks) {
            const batch = writeBatch(db);
            for (const d of qChunk) {
                batch.update(d.ref, { isActive: false });
            }
            await batch.commit();
        }
    }
}

// ── Question Count Helpers ───────────────────────────────────────────

export function getRecursiveQuestionCount(folderId, allFolders) {
    const ids = getDescendantFolderIdsLocal(folderId, allFolders);
    return allFolders
        .filter(f => ids.includes(f.id))
        .reduce((sum, f) => sum + (f.questionCount || 0), 0);
}

export async function incrementQuestionCount(folderId, delta) {
    const folderDoc = await getDoc(doc(db, 'folders', folderId));
    if (!folderDoc.exists()) return;
    const current = folderDoc.data().questionCount || 0;
    await updateDoc(doc(db, 'folders', folderId), {
        questionCount: Math.max(0, current + delta)
    });
}

// ── Path & Breadcrumb ────────────────────────────────────────────────

export function getFolderBreadcrumb(folderId, allFolders) {
    const parts = [];
    let current = allFolders.find(f => f.id === folderId);
    while (current) {
        parts.unshift(current.name);
        current = current.parentId ? allFolders.find(f => f.id === current.parentId) : null;
    }
    return parts.join(' > ');
}

// ── Folder Tree Rendering ────────────────────────────────────────────

export function renderFolderTree(roots, selectedId, expandedSet, allFolders) {
    if (!roots || roots.length === 0) {
        return `<div class="text-[11px] text-slate-400 text-center py-4">No folders yet</div>`;
    }
    return roots.map(node => renderFolderNode(node, selectedId, expandedSet, allFolders)).join('');
}

function renderFolderNode(node, selectedId, expandedSet, allFolders) {
    const isSelected = node.id === selectedId;
    const isExpanded = expandedSet.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const indent = (node.depth || 0) * 16;
    const recursiveCount = getRecursiveQuestionCount(node.id, allFolders);

    return `
        <div class="folder-node" data-folder-id="${node.id}">
            <div class="group flex items-center gap-1 py-1.5 px-2 rounded-lg cursor-pointer transition-all
                ${isSelected ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-600 hover:bg-slate-50'}"
                style="padding-left: ${indent + 8}px"
                onclick="window.__selectFolder('${node.id}')">
                <button class="size-5 flex items-center justify-center flex-shrink-0"
                    onclick="event.stopPropagation(); window.__toggleExpand('${node.id}')">
                    ${hasChildren
                        ? `<span class="material-symbols-outlined text-[14px] text-slate-400 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}">expand_more</span>`
                        : '<span class="w-[14px]"></span>'}
                </button>
                <span class="material-symbols-outlined text-[16px] ${isSelected ? 'text-primary' : 'text-slate-400'}">
                    ${isExpanded && hasChildren ? 'folder_open' : 'folder'}
                </span>
                <span class="text-[12px] truncate flex-1">${node.name}</span>
                <span class="text-[9px] ${isSelected ? 'text-primary/60' : 'text-slate-400'} font-bold tabular-nums">${recursiveCount}</span>
                <button class="folder-actions size-5 rounded hover:bg-slate-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    onclick="event.stopPropagation(); window.__folderMenu('${node.id}', event)">
                    <span class="material-symbols-outlined text-[14px] text-slate-400">more_vert</span>
                </button>
            </div>
            ${isExpanded && hasChildren ? `<div class="folder-children">${node.children.map(c => renderFolderNode(c, selectedId, expandedSet, allFolders)).join('')}</div>` : ''}
        </div>`;
}

// ── Folder Picker (for Tests page modal) ─────────────────────────────

export function renderFolderPickerTree(roots, selectedId, allFolders) {
    if (!roots || roots.length === 0) {
        return `<div class="text-[11px] text-slate-400 text-center py-4">No folders yet. Create folders in the Questions page first.</div>`;
    }
    return roots.map(node => renderPickerNode(node, selectedId, allFolders)).join('');
}

function renderPickerNode(node, selectedId, allFolders) {
    const isSelected = node.id === selectedId;
    const hasChildren = node.children && node.children.length > 0;
    const indent = (node.depth || 0) * 16;
    const recursiveCount = getRecursiveQuestionCount(node.id, allFolders);

    return `
        <div class="picker-node">
            <div class="flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-all
                ${isSelected ? 'bg-primary/10 text-primary ring-1 ring-primary/30' : 'text-slate-600 hover:bg-slate-50'}"
                style="padding-left: ${indent + 12}px"
                onclick="window.__pickFolder('${node.id}', '${getFolderBreadcrumb(node.id, allFolders).replace(/'/g, "\\'")}')">
                <span class="material-symbols-outlined text-[16px] ${isSelected ? 'text-primary' : 'text-slate-400'}">folder</span>
                <span class="text-[12px] font-medium flex-1">${node.name}</span>
                <span class="text-[10px] text-slate-400">${recursiveCount} Q</span>
            </div>
            ${hasChildren ? `<div>${node.children.map(c => renderPickerNode(c, selectedId, allFolders)).join('')}</div>` : ''}
        </div>`;
}

// ── Utilities ────────────────────────────────────────────────────────

export function chunkArray(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}
