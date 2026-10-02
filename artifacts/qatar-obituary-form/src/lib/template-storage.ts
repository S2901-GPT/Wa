import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  type Firestore,
} from "firebase/firestore";
import firebaseConfig from "../../../../firebase-applet-config.json";
import {
  type CondolenceTemplate,
  BUILT_IN_TEMPLATES,
  DEFAULT_TEMPLATE_OFFICIAL,
} from "./template-schema";

let firestoreInstance: Firestore | null = null;
try {
  const app: FirebaseApp = getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig);
  firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
} catch (e) {
  console.warn("Firestore initialization error in template storage, using fallback:", e);
}

const LOCAL_STORAGE_KEY = "qatar_condolence_templates_v2";
const DEFAULT_TEMPLATE_KEY = "qatar_condolence_default_template_id";
// علامة ترحيل لمرة واحدة: المتصفحات التي حُفظ فيها الافتراضي القديم تنتقل إلى قالب النسخ، ويبقى أي اختيار لاحق محترماً.
const NASKH_MIGRATION_KEY = "qatar_condolence_default_naskh_v1";
const FALLBACK_TEMPLATE_ID = "naskh";

function getLocalCustomTemplates(): Record<string, CondolenceTemplate> {
  if (typeof window === "undefined" || !window.localStorage) return {};
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalCustomTemplates(templates: Record<string, CondolenceTemplate>) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(templates));
  } catch (e) {
    console.warn("Failed saving templates to localStorage:", e);
  }
}

export function getDefaultTemplateId(): string {
  if (typeof window === "undefined" || !window.localStorage) return FALLBACK_TEMPLATE_ID;
  if (!localStorage.getItem(NASKH_MIGRATION_KEY)) {
    localStorage.setItem(NASKH_MIGRATION_KEY, "1");
    localStorage.setItem(DEFAULT_TEMPLATE_KEY, FALLBACK_TEMPLATE_ID);
    return FALLBACK_TEMPLATE_ID;
  }
  return localStorage.getItem(DEFAULT_TEMPLATE_KEY) || FALLBACK_TEMPLATE_ID;
}

export function setDefaultTemplateId(id: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  localStorage.setItem(DEFAULT_TEMPLATE_KEY, id);
}

export async function fetchAllTemplates(): Promise<Record<string, CondolenceTemplate>> {
  // Start with built-ins
  const allTemplates: Record<string, CondolenceTemplate> = { ...BUILT_IN_TEMPLATES };

  // Overlay local storage customizations
  const localCustom = getLocalCustomTemplates();
  for (const [id, t] of Object.entries(localCustom)) {
    allTemplates[id] = t;
  }

  // Fetch remote from Firestore if available
  if (firestoreInstance) {
    try {
      const colRef = collection(firestoreInstance, "condolence_templates");
      const snapshot = await getDocs(colRef);
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as CondolenceTemplate;
        if (data && data.id) {
          allTemplates[data.id] = data;
        }
      });
    } catch (err) {
      console.warn("Firestore fetch error for templates, using local:", err);
    }
  }

  return allTemplates;
}

export async function saveTemplate(template: CondolenceTemplate): Promise<void> {
  const updated: CondolenceTemplate = {
    ...template,
    updatedAt: new Date().toISOString(),
  };

  // Update localStorage
  const local = getLocalCustomTemplates();
  local[updated.id] = updated;
  saveLocalCustomTemplates(local);

  // Update Firestore
  if (firestoreInstance) {
    try {
      const docRef = doc(firestoreInstance, "condolence_templates", updated.id);
      await setDoc(docRef, updated);
    } catch (err) {
      console.warn("Firestore save error, template saved locally:", err);
    }
  }
}

export async function duplicateTemplate(
  sourceTemplate: CondolenceTemplate,
  newName: string,
): Promise<CondolenceTemplate> {
  const newId = `custom-${Date.now()}`;
  const cloned: CondolenceTemplate = {
    ...sourceTemplate,
    id: newId,
    name: newName || `نسخة من ${sourceTemplate.name}`,
    isBuiltIn: false,
    isDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await saveTemplate(cloned);
  return cloned;
}

export async function deleteCustomTemplate(templateId: string): Promise<boolean> {
  if (BUILT_IN_TEMPLATES[templateId]) {
    // Built-in templates cannot be deleted
    return false;
  }

  // Remove from localStorage
  const local = getLocalCustomTemplates();
  delete local[templateId];
  saveLocalCustomTemplates(local);

  // Remove from Firestore
  if (firestoreInstance) {
    try {
      const docRef = doc(firestoreInstance, "condolence_templates", templateId);
      await deleteDoc(docRef);
    } catch (err) {
      console.warn("Firestore delete error:", err);
    }
  }

  // If was default, revert to the built-in default
  if (getDefaultTemplateId() === templateId) {
    setDefaultTemplateId(FALLBACK_TEMPLATE_ID);
  }

  return true;
}

export function resetTemplateToBuiltIn(templateId: string): CondolenceTemplate | null {
  const factory = BUILT_IN_TEMPLATES[templateId];
  if (!factory) return null;

  // Clear customization from local storage
  const local = getLocalCustomTemplates();
  delete local[templateId];
  saveLocalCustomTemplates(local);

  return factory;
}
