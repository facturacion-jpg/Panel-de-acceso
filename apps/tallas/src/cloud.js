import { collection, doc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { auth, db } from './firebase.js';

const COLLECTION = 'app_records';
const APP_ID = 'tallas';
const LEGACY_OWNER_KEY = 'tallas:legacy-import-owner';
const recordId = (uid, id) => `tallas_${uid}_${String(id).replace(/\//g, '_')}`;
const planId = (uid) => `tallas_${uid}_plan`;

function readLegacy(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function ownerFields(user) {
  if (!user?.uid || !user.email) throw new Error('Inicia sesión para guardar los datos de Tallas.');
  return { appId: APP_ID, ownerUid: user.uid, ownerEmail: user.email.trim() };
}

export async function loadTallasData() {
  const user = auth.currentUser;
  ownerFields(user);
  const snapshot = await getDocs(query(collection(db, COLLECTION), where('ownerUid', '==', user.uid), where('appId', '==', APP_ID)));
  const records = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  const setItems = records.filter((item) => item.recordType === 'set');
  const setRecords = setItems.map((item) => item.record);
  const planRecord = records.find((item) => item.recordType === 'plan');
  const migrationOwner = localStorage.getItem(LEGACY_OWNER_KEY);
  const canReadLegacy = !migrationOwner || migrationOwner === user.uid;
  const userSets = readLegacy(`tallas:${user.uid}:sets`, null);
  const userPlan = readLegacy(`tallas:${user.uid}:plano`, null);
  const legacySets = userSets || (canReadLegacy ? readLegacy('sets', []) : []);
  const legacyPlan = userPlan || (canReadLegacy ? readLegacy('plano', []) : []);
  if (!migrationOwner) localStorage.setItem(LEGACY_OWNER_KEY, user.uid);
  const cloudIds = new Set(setRecords.map((record) => String(record.id)));
  const missingLegacySets = legacySets.filter((record) => !cloudIds.has(String(record.id)));
  const sets = [...setRecords, ...missingLegacySets];
  const plano = planRecord?.record || legacyPlan;

  if (missingLegacySets.length) {
    await Promise.all(missingLegacySets.map((record) => saveTallasSet(user, record)));
  }
  if (!planRecord && legacyPlan.length) await saveTallasPlan(user, legacyPlan);
  if (canReadLegacy && (legacySets.length || legacyPlan.length)) localStorage.setItem(LEGACY_OWNER_KEY, user.uid);
  return { sets, plano };
}

export function saveTallasSet(user, record) {
  return setDoc(doc(db, COLLECTION, recordId(user.uid, record.id)), {
    ...ownerFields(user), recordType: 'set', record, updatedAt: serverTimestamp(),
  }, { merge: true });
}

export function saveTallasPlan(user, record) {
  return setDoc(doc(db, COLLECTION, planId(user.uid)), {
    ...ownerFields(user), recordType: 'plan', record, updatedAt: serverTimestamp(),
  }, { merge: true });
}
