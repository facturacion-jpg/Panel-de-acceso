import { collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { auth, db } from '../firebase.js';

const STORAGE_KEY = 'crearte_inspeccion_telas_v1';
const COLLECTION = 'app_records';
const APP_ID = 'telas';
const LEGACY_OWNER_KEY = `${STORAGE_KEY}:legacy-import-owner`;
const documentId = (uid, id) => `telas_${uid}_${String(id).replace(/\//g, '_')}`;

function readStorage(key) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

const userStorageKey = (user) => `${STORAGE_KEY}:${user.uid}`;

export function loadInspections(user = auth.currentUser) {
  if (!user?.uid) return readStorage(STORAGE_KEY);
  const userCache = localStorage.getItem(userStorageKey(user));
  if (userCache) return readStorage(userStorageKey(user));
  const migratedOwner = localStorage.getItem(LEGACY_OWNER_KEY);
  return !migratedOwner || migratedOwner === user.uid ? readStorage(STORAGE_KEY) : [];
}

function writeLocal(records, user) {
  try {
    localStorage.setItem(user?.uid ? userStorageKey(user) : STORAGE_KEY, JSON.stringify(records.slice(0, 100)));
  } catch (error) { console.warn('No se pudo actualizar la copia local:', error); }
}

function currentUser(user) {
  const owner = user || auth.currentUser;
  if (!owner?.uid || !owner.email) throw new Error('Inicia sesión para sincronizar las inspecciones.');
  return owner;
}

async function writeRemote(record, user) {
  const owner = currentUser(user);
  await setDoc(doc(db, COLLECTION, documentId(owner.uid, record.id)), {
    appId: APP_ID,
    recordType: 'inspection',
    ownerUid: owner.uid,
    ownerEmail: owner.email.trim(),
    record,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export function subscribeInspections(user, onRecords, onError, onReady) {
  const owner = currentUser(user);
  let migrationStarted = false;
  const recordsQuery = query(collection(db, COLLECTION), where('ownerUid', '==', owner.uid), where('appId', '==', APP_ID));
  return onSnapshot(recordsQuery, async (snapshot) => {
    const docs = snapshot.docs
      .map((item) => item.data())
      .filter((item) => item.recordType === 'inspection' && item.record)
      .map((item) => item.record)
      .sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')));

    if (!migrationStarted) {
      const migratedOwner = localStorage.getItem(LEGACY_OWNER_KEY);
      const canClaimLegacy = !migratedOwner || migratedOwner === owner.uid;
      if (!migratedOwner) localStorage.setItem(LEGACY_OWNER_KEY, owner.uid);
      if (!docs.length && canClaimLegacy) {
        const legacy = loadInspections(owner);
        if (legacy.length) {
          migrationStarted = true;
          try {
            await Promise.all(legacy.map((record) => writeRemote(record, owner)));
            return;
          } catch (error) {
            onError?.(error);
            onRecords(legacy);
            onReady?.();
            return;
          }
        }
      }
      migrationStarted = true;
    }
    writeLocal(docs, owner);
    onRecords(docs);
    onReady?.();
  }, onError);
}

export async function saveInspection(record, user) {
  const owner = currentUser(user);
  const updated = [record, ...loadInspections(owner).filter((item) => item.id !== record.id)].slice(0, 100);
  writeLocal(updated, owner);
  await writeRemote(record, owner);
  return record;
}

export async function deleteInspection(id, user) {
  const owner = currentUser(user);
  await deleteDoc(doc(db, COLLECTION, documentId(owner.uid, id)));
  const remaining = loadInspections(owner).filter((record) => record.id !== id);
  writeLocal(remaining, owner);
  return remaining;
}
