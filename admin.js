import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDPeJBZsAULItqYCGNYdYRIofcmz0mh4fw",
  authDomain: "founding-fathers-application.firebaseapp.com",
  projectId: "founding-fathers-application",
  storageBucket: "founding-fathers-application.firebasestorage.app",
  messagingSenderId: "23460729842",
  appId: "1:23460729842:web:dbddeb887a2c033c51116b",
  measurementId: "G-787X72SL31"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const ownerAdminUid = "2vxWgt5PXCcBYH3uQAylQpRSSXv2";

const adminLoading = document.getElementById("adminLoading");
const accessDenied = document.getElementById("accessDenied");
const dashboardContent = document.getElementById("dashboardContent");
const applicationsState = document.getElementById("applicationsState");
const applicationsList = document.getElementById("applicationsList");
const searchInput = document.getElementById("applicationSearch");
const filterGroup = document.getElementById("filterGroup");
const signOutBtn = document.getElementById("adminSignOutBtn");
const toast = document.getElementById("adminToast");

const countElements = {
  total: document.getElementById("totalCount"),
  pending: document.getElementById("pendingCount"),
  "founding-author": document.getElementById("acceptedCount"),
  rejected: document.getElementById("rejectedCount"),
  waitlist: document.getElementById("waitlistCount"),
  "needs-more-info": document.getElementById("needsInfoCount")
};

const statusLabels = {
  pending: "Pending Review",
  "founding-author": "Founding Author",
  rejected: "Rejected",
  waitlist: "Waitlist",
  "needs-more-info": "Needs More Info"
};

const statusActions = [
  ["founding-author", "Accept as Founding Author"],
  ["rejected", "Reject"],
  ["waitlist", "Waitlist"],
  ["needs-more-info", "Needs More Info"],
  ["pending", "Reset to Pending"]
];

let currentAdmin = null;
let applications = [];
let activeFilter = "all";
let toastTimer = null;

const showToast = (message, isError = false) => {
  if (!toast) return;

  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.toggle("is-error", isError);
  toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 4200);
};

const formatDate = (timestamp) => {
  const date = timestamp?.toDate?.() || (timestamp instanceof Date ? timestamp : null);

  if (!date || Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
};

const timestampMillis = (timestamp) => {
  if (typeof timestamp?.toMillis === "function") return timestamp.toMillis();
  if (timestamp instanceof Date) return timestamp.getTime();
  return 0;
};

const setText = (parent, className, value) => {
  const element = parent.querySelector(`.${className}`);
  if (element) element.textContent = value;
};

const updateStats = () => {
  const counts = {
    total: applications.length,
    pending: 0,
    "founding-author": 0,
    rejected: 0,
    waitlist: 0,
    "needs-more-info": 0
  };

  applications.forEach((application) => {
    const status = statusLabels[application.status] ? application.status : "pending";
    counts[status] += 1;
  });

  Object.entries(countElements).forEach(([key, element]) => {
    if (element) element.textContent = String(counts[key] || 0);
  });
};

const setCardBusy = (card, isBusy) => {
  card.querySelectorAll("button, textarea").forEach((control) => {
    control.disabled = isBusy;
  });
};

const createMetadataItem = (label, value) => {
  const item = document.createElement("div");
  item.className = "metadata-item";

  const labelElement = document.createElement("span");
  labelElement.className = "metadata-label";
  labelElement.textContent = label;

  const valueElement = document.createElement("span");
  valueElement.className = "metadata-value";
  valueElement.textContent = value;

  item.append(labelElement, valueElement);
  return item;
};

const createAnswerBlock = (label, value) => {
  const block = document.createElement("div");
  block.className = "answer-block";

  const labelElement = document.createElement("span");
  labelElement.className = "answer-label";
  labelElement.textContent = label;

  const text = document.createElement("p");
  text.className = "answer-text";
  text.textContent = value || "Not provided";

  block.append(labelElement, text);
  return block;
};

const updateLocalApplication = (uid, changes) => {
  const application = applications.find((item) => item.uid === uid);
  if (application) Object.assign(application, changes);
};

const reviewFields = () => ({
  updatedAt: serverTimestamp(),
  reviewedAt: serverTimestamp(),
  reviewedBy: currentAdmin.uid,
  reviewedByEmail: currentAdmin.email || ""
});

const updateStatus = async (application, status, card) => {
  if (!currentAdmin || !statusLabels[status]) return;

  setCardBusy(card, true);

  try {
    await updateDoc(doc(db, "foundingAuthorApplications", application.uid), {
      status,
      adminNote: application.adminNote || "",
      ...reviewFields()
    });

    updateLocalApplication(application.uid, {
      status,
      reviewedAt: new Date(),
      reviewedBy: currentAdmin.uid,
      reviewedByEmail: currentAdmin.email || ""
    });
    updateStats();
    renderApplications();
    showToast(`${application.fullName || "Application"} updated to ${statusLabels[status]}.`);
  } catch (error) {
    console.error("Application status update failed:", error);
    setCardBusy(card, false);
    showToast(`Could not update status: ${error.message}`, true);
  }
};

const saveNote = async (application, note, card) => {
  if (!currentAdmin) return;

  setCardBusy(card, true);

  try {
    await updateDoc(doc(db, "foundingAuthorApplications", application.uid), {
      adminNote: note,
      ...reviewFields()
    });

    updateLocalApplication(application.uid, {
      adminNote: note,
      reviewedAt: new Date(),
      reviewedBy: currentAdmin.uid,
      reviewedByEmail: currentAdmin.email || ""
    });
    renderApplications();
    showToast(`Admin note saved for ${application.fullName || "applicant"}.`);
  } catch (error) {
    console.error("Admin note update failed:", error);
    setCardBusy(card, false);
    showToast(`Could not save note: ${error.message}`, true);
  }
};

const copyEmail = async (email) => {
  if (!email) {
    showToast("No email address is available.", true);
    return;
  }

  try {
    await navigator.clipboard.writeText(email);
    showToast("Email copied.");
  } catch (error) {
    console.error("Copy email failed:", error);
    showToast("Could not copy the email address.", true);
  }
};

const createApplicationCard = (application) => {
  const status = statusLabels[application.status] ? application.status : "pending";
  const card = document.createElement("article");
  card.className = "application-card";
  card.dataset.uid = application.uid;

  const header = document.createElement("div");
  header.className = "card-header";

  const applicant = document.createElement("div");
  const name = document.createElement("h2");
  name.className = "applicant-name";
  name.textContent = application.fullName || "Name not provided";
  const email = document.createElement("p");
  email.className = "applicant-email";
  email.textContent = application.email || "Email not provided";
  applicant.append(name, email);

  const badge = document.createElement("span");
  badge.className = `status-badge status-${status}`;
  badge.textContent = statusLabels[status];
  header.append(applicant, badge);

  const body = document.createElement("div");
  body.className = "card-body";

  const metadata = document.createElement("div");
  metadata.className = "metadata-grid";
  metadata.append(
    createMetadataItem("UID", application.uid || "Not provided"),
    createMetadataItem("Over 18", application.over17 === true ? "Yes" : "No"),
    createMetadataItem("Submitted", formatDate(application.submittedAt)),
    createMetadataItem("Reviewed", formatDate(application.reviewedAt)),
    createMetadataItem("Reviewed by UID", application.reviewedBy || "Not reviewed"),
    createMetadataItem("Reviewed by email", application.reviewedByEmail || "Not reviewed")
  );

  const answers = document.createElement("div");
  answers.className = "answers";
  answers.append(
    createAnswerBlock("Writing experience", application.experience),
    createAnswerBlock("Books and Founding Author answer", application.bookAnswer)
  );

  const reviewPanel = document.createElement("div");
  reviewPanel.className = "review-panel";
  const noteWrap = document.createElement("label");
  const noteLabel = document.createElement("span");
  noteLabel.className = "note-label";
  noteLabel.textContent = "Admin note";
  const note = document.createElement("textarea");
  note.className = "admin-note";
  note.maxLength = 5000;
  note.placeholder = "Add a private review note";
  note.value = application.adminNote || "";
  noteWrap.append(noteLabel, note);

  const saveNoteBtn = document.createElement("button");
  saveNoteBtn.className = "save-note-btn";
  saveNoteBtn.type = "button";
  saveNoteBtn.textContent = "Save Note";
  saveNoteBtn.addEventListener("click", () => saveNote(application, note.value.trim(), card));
  reviewPanel.append(noteWrap, saveNoteBtn);

  const actions = document.createElement("div");
  actions.className = "status-actions";
  statusActions.forEach(([actionStatus, label]) => {
    const button = document.createElement("button");
    button.className = "action-btn";
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", () => updateStatus(application, actionStatus, card));
    actions.append(button);
  });

  const copyButton = document.createElement("button");
  copyButton.className = "copy-btn";
  copyButton.type = "button";
  copyButton.textContent = "Copy Email";
  copyButton.addEventListener("click", () => copyEmail(application.email));
  actions.append(copyButton);

  body.append(metadata, answers, reviewPanel, actions);
  card.append(header, body);
  return card;
};

function renderApplications() {
  const search = searchInput?.value.trim().toLowerCase() || "";
  const filtered = applications.filter((application) => {
    const matchesFilter = activeFilter === "all" || application.status === activeFilter;
    const searchable = `${application.fullName || ""} ${application.email || ""}`.toLowerCase();
    return matchesFilter && searchable.includes(search);
  });

  applicationsList.replaceChildren();

  if (filtered.length === 0) {
    applicationsState.textContent = applications.length === 0
      ? "No applications found."
      : "No applications match this search or filter.";
    applicationsState.hidden = false;
    return;
  }

  applicationsState.hidden = true;
  const fragment = document.createDocumentFragment();
  filtered.forEach((application) => fragment.append(createApplicationCard(application)));
  applicationsList.append(fragment);
}

const loadApplications = async () => {
  applicationsState.textContent = "Loading applications...";
  applicationsState.hidden = false;

  try {
    const applicationsQuery = query(
      collection(db, "foundingAuthorApplications"),
      orderBy("submittedAt", "desc")
    );
    const snapshot = await getDocs(applicationsQuery);
    applications = snapshot.docs.map((applicationDoc) => ({
      ...applicationDoc.data(),
      uid: applicationDoc.id
    }));
  } catch (orderedError) {
    console.warn("Ordered application query failed; loading without ordering:", orderedError);

    try {
      const snapshot = await getDocs(collection(db, "foundingAuthorApplications"));
      applications = snapshot.docs.map((applicationDoc) => ({
        ...applicationDoc.data(),
        uid: applicationDoc.id
      }));
      applications.sort((a, b) => timestampMillis(b.submittedAt) - timestampMillis(a.submittedAt));
    } catch (error) {
      console.error("Application loading failed:", error);
      applicationsState.textContent = error.code === "permission-denied"
        ? "Applications could not be loaded. Confirm this Firebase UID exists in the admins collection and that the Firestore rules are deployed."
        : `Applications could not be loaded: ${error.message}`;
      showToast("Could not load applications.", true);
      return;
    }
  }

  updateStats();
  renderApplications();
};

filterGroup?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;

  activeFilter = button.dataset.filter;
  filterGroup.querySelectorAll("[data-filter]").forEach((filterButton) => {
    filterButton.classList.toggle("is-active", filterButton === button);
  });
  renderApplications();
});

searchInput?.addEventListener("input", renderApplications);

signOutBtn?.addEventListener("click", async () => {
  signOutBtn.disabled = true;
  signOutBtn.textContent = "Signing out...";

  try {
    await signOut(auth);
    window.location.replace("index.html");
  } catch (error) {
    console.error("Admin sign out failed:", error);
    signOutBtn.disabled = false;
    signOutBtn.textContent = "Sign Out";
    showToast(`Sign out failed: ${error.message}`, true);
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace("sign-in.html");
    return;
  }

  currentAdmin = user;

  try {
    const isOwnerAdmin = user.uid === ownerAdminUid;
    const adminSnapshot = isOwnerAdmin
      ? null
      : await getDoc(doc(db, "admins", user.uid));

    if (!isOwnerAdmin && !adminSnapshot.exists()) {
      adminLoading.hidden = true;
      accessDenied.hidden = false;
      dashboardContent.hidden = true;
      return;
    }

    adminLoading.hidden = true;
    accessDenied.hidden = true;
    dashboardContent.hidden = false;
    await loadApplications();
  } catch (error) {
    console.error("Admin access check failed:", error);
    adminLoading.hidden = true;
    accessDenied.hidden = false;
    accessDenied.innerHTML = "<strong>Access denied</strong>Admin access could not be verified. Confirm your UID exists in the admins collection and deploy the supplied Firestore rules.";
  }
});
