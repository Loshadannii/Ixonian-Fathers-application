import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

console.log("script.js loaded");

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
const provider = new GoogleAuthProvider();
const actionCodeSettings = {
  url: window.location.origin + window.location.pathname,
  handleCodeInApp: true
};
const pendingEmailApplicationKey = "ixonian-pending-email-application";

const googleBtn = document.getElementById("googleSignInBtn");
const form = document.getElementById("foundingAuthorForm");
const emailInput = document.getElementById("email");
const emailNotification = document.getElementById("emailNotification");
const emailNotificationTitle = document.getElementById("emailNotificationTitle");
const emailNotificationText = document.getElementById("emailNotificationText");
const emailNotificationClose = document.getElementById("emailNotificationClose");
const continueBtn = document.querySelector(".continue-btn");
const submitBtn = form?.querySelector('button[type="submit"]');
const submitGateMessage = document.getElementById("submitGateMessage");
const signOutBtn = document.getElementById("signOutBtn");
const displayNameEl = document.getElementById("displayName");
const userEmailEl = document.getElementById("userEmail");
const profileTitleEl = document.getElementById("profileTitle");
const profileSubtitleEl = document.getElementById("profileSubtitle");
const profileStatusDisplayEl = document.getElementById("profileStatusDisplay");
const profileStatusLoaderEl = document.getElementById("profileStatusLoader");
const statusTextEl = document.getElementById("statusText");
const statusValueEl = document.getElementById("statusValue");
const submittedValueEl = document.getElementById("submittedValue");
const profileMessageEl = document.getElementById("profileMessage");
const currentPage = window.location.pathname.split("/").pop() || "index.html";
const isSignInPage = currentPage === "sign-in.html";
const isIndexPage = currentPage === "index.html" || isSignInPage;
const isProfilePage = currentPage === "profile.html" || currentPage === "pending.html";
let hasClickedContinue = !continueBtn;
let keepIndexOpenForApplication = false;

const characterLimits = {
  fullName: 80,
  experience: 500,
  bookAnswer: 3000
};

const fieldErrors = {
  fullName: document.getElementById("fullNameError"),
  email: document.getElementById("emailError"),
  experience: document.getElementById("experienceError"),
  over17: document.getElementById("over17Error"),
  bookAnswer: document.getElementById("bookAnswerError")
};

const charCounters = {
  fullName: document.getElementById("fullNameCounter"),
  experience: document.getElementById("experienceCounter"),
  bookAnswer: document.getElementById("bookAnswerCounter")
};

const showFieldError = (field, message) => {
  if (!fieldErrors[field]) return;
  fieldErrors[field].textContent = message;
  fieldErrors[field].classList.add("show");
};

const clearFieldErrors = () => {
  Object.values(fieldErrors).forEach((errorEl) => {
    if (!errorEl) return;
    errorEl.textContent = "";
    errorEl.classList.remove("show");
  });
};

let emailNotificationTimer = null;

const hideEmailNotification = () => {
  if (!emailNotification) return;

  emailNotification.classList.remove("show");
  window.setTimeout(() => {
    emailNotification.hidden = true;
  }, 220);
};

const showEmailNotification = (title, message) => {
  if (!emailNotification || !emailNotificationTitle || !emailNotificationText) {
    console.log(`${title}: ${message}`);
    return;
  }

  if (emailNotificationTimer) {
    window.clearTimeout(emailNotificationTimer);
  }

  emailNotificationTitle.textContent = title;
  emailNotificationText.textContent = message;
  emailNotification.hidden = false;
  window.requestAnimationFrame(() => {
    emailNotification.classList.add("show");
  });

  emailNotificationTimer = window.setTimeout(hideEmailNotification, 7000);
};

if (emailNotificationClose) {
  emailNotificationClose.addEventListener("click", hideEmailNotification);
}

const updateCharacterCounter = (field) => {
  const input = document.getElementById(field);
  const counter = charCounters[field];
  const limit = characterLimits[field];

  if (!input || !counter || !limit) return;

  const remaining = limit - input.value.trim().length;
  counter.classList.toggle("over-limit", remaining < 0);
  counter.textContent = remaining >= 0
    ? `${remaining} characters remaining`
    : `${Math.abs(remaining)} characters over limit`;
};

Object.keys(characterLimits).forEach((field) => {
  const input = document.getElementById(field);
  if (!input) return;

  updateCharacterCounter(field);
  input.addEventListener("input", () => {
    updateCharacterCounter(field);
  });
});

if (submitBtn && !hasClickedContinue) {
  submitBtn.disabled = true;
}

if (continueBtn) {
  continueBtn.addEventListener("click", () => {
    hasClickedContinue = true;

    if (submitBtn) {
      submitBtn.disabled = false;
    }

    if (submitGateMessage) {
      submitGateMessage.textContent = "Submission unlocked. Complete the form and submit when ready.";
      submitGateMessage.classList.add("is-unlocked");
    }
  });
}

const saveProfileUser = (user) => {
  const storedName = localStorage.getItem("ixonian-name");
  const displayName = user.displayName || storedName || user.email?.split("@")[0] || "Founding Author";
  const photoURL = user.photoURL || "";

  localStorage.setItem("ixonian-email", user.email || "");
  localStorage.setItem("ixonian-name", displayName);

  if (photoURL) {
    localStorage.setItem("ixonian-photo", photoURL);
  } else {
    localStorage.removeItem("ixonian-photo");
  }

  if (displayNameEl) {
    displayNameEl.textContent = displayName;
  }

  if (userEmailEl) {
    userEmailEl.textContent = user.email || "-";
  }
};

const loadStoredProfile = () => {
  if (displayNameEl) {
    displayNameEl.textContent = localStorage.getItem("ixonian-name") || "Founding Author";
  }

  if (userEmailEl) {
    userEmailEl.textContent = localStorage.getItem("ixonian-email") || "-";
  }
};

const clearStoredProfile = () => {
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith("ixonian-")) {
      localStorage.removeItem(key);
    }
  });
  sessionStorage.clear();
};

const showSignedInState = (user, statusText = "Sign-in complete") => {
  if (emailInput) {
    emailInput.value = user.email || "";
    emailInput.readOnly = true;
  }

  if (googleBtn) {
    googleBtn.classList.add("is-authenticated");
    googleBtn.replaceChildren();

    const instruction = document.createElement("span");
    instruction.className = "signed-in-instruction";

    const kicker = document.createElement("span");
    kicker.className = "signed-in-kicker";
    kicker.textContent = statusText;

    const copy = document.createElement("span");
    copy.className = "signed-in-copy";
    copy.textContent = "Please fill in the information above to validate the application. Thank you.";

    instruction.append(kicker, copy);
    googleBtn.append(instruction);
    googleBtn.disabled = true;
  }
};

const getApplicationRef = (user) => {
  return doc(db, "foundingAuthorApplications", user.uid);
};

const isGoogleUser = (user) => {
  return user.providerData.some((providerInfo) => providerInfo.providerId === "google.com");
};

const saveApplicationProfile = (user, applicationData = {}) => {
  const displayName = applicationData.fullName || user.displayName || user.email?.split("@")[0] || "Founding Author";
  const photoURL = user.photoURL || "";

  localStorage.setItem("ixonian-email", applicationData.email || user.email || "");
  localStorage.setItem("ixonian-name", displayName);

  if (photoURL) {
    localStorage.setItem("ixonian-photo", photoURL);
  } else {
    localStorage.removeItem("ixonian-photo");
  }

  if (displayNameEl) {
    displayNameEl.textContent = displayName;
  }

  if (userEmailEl) {
    userEmailEl.textContent = applicationData.email || user.email || "-";
  }
};

const getExistingApplication = async (user) => {
  try {
    return await getDoc(getApplicationRef(user));
  } catch (error) {
    console.error("Existing application lookup error:", error);
    return null;
  }
};

const profileStatuses = {
  pending: {
    title: "You're in.",
    subtitle: "Your application is under review",
    label: "Pending Review",
    color: "#f0c040",
    message: (name) => `Thanks for applying, ${name}. We'll review your submission and reach out soon.`
  },
  "founding-author": {
    title: "Accepted.",
    subtitle: "Welcome, Founding Author",
    label: "Founding Author",
    color: "#64c987",
    message: (name) => `Congratulations, ${name}. Your application has been accepted. You are now part of Ixonian's founding authors.`
  },
  rejected: {
    title: "Application reviewed.",
    subtitle: "Not accepted at this time",
    label: "Rejected",
    color: "#ef6b6b",
    message: (name) => `Thank you for applying, ${name}. Your application was reviewed, but it was not accepted at this time.`
  },
  waitlist: {
    title: "Waitlisted.",
    subtitle: "Your application is still being considered",
    label: "Waitlist",
    color: "#70a9e8",
    message: (name) => `Thanks for applying, ${name}. Your application is on the waitlist and may be reviewed again later.`
  },
  "needs-more-info": {
    title: "More information needed.",
    subtitle: "Please check your inbox",
    label: "Needs More Info",
    color: "#c58be2",
    message: (name) => `Thanks for applying, ${name}. We may need more information before making a final decision.`
  }
};

const formatProfileDate = (timestamp) => {
  const date = timestamp?.toDate?.() || (timestamp instanceof Date ? timestamp : null);

  if (!date || Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
};

const renderProfileApplication = (user, applicationData = {}) => {
  if (!isProfilePage) return;

  const status = profileStatuses[applicationData.status] || profileStatuses.pending;
  const name = applicationData.fullName || user.displayName || user.email?.split("@")[0] || "Founding Author";

  if (profileTitleEl) profileTitleEl.textContent = status.title;
  if (profileSubtitleEl) profileSubtitleEl.textContent = status.subtitle;
  if (statusTextEl) {
    statusTextEl.textContent = status.label;
    statusTextEl.style.color = status.color;
  }
  if (statusValueEl) {
    statusValueEl.textContent = status.label;
    statusValueEl.style.color = status.color;
  }
  if (submittedValueEl) submittedValueEl.textContent = formatProfileDate(applicationData.submittedAt);
  if (profileStatusDisplayEl) {
    profileStatusDisplayEl.style.color = status.color;
    profileStatusDisplayEl.classList.toggle("is-pending", applicationData.status === "pending");
  }
  if (profileStatusLoaderEl) profileStatusLoaderEl.hidden = applicationData.status !== "pending";
  if (profileMessageEl) profileMessageEl.textContent = status.message(name);
};

const redirectExistingGoogleApplication = async (user) => {
  if (!isGoogleUser(user)) {
    return false;
  }

  const applicationSnapshot = await getExistingApplication(user);

  if (!applicationSnapshot?.exists()) {
    return false;
  }

  saveApplicationProfile(user, applicationSnapshot.data());
  console.log("Existing Google application found. Redirecting to profile.html");
  window.location.replace("profile.html");
  return true;
};

const getPendingEmailApplication = () => {
  try {
    const pendingApplication = localStorage.getItem(pendingEmailApplicationKey);
    return pendingApplication ? JSON.parse(pendingApplication) : null;
  } catch (error) {
    console.error("Pending application read error:", error);
    localStorage.removeItem(pendingEmailApplicationKey);
    return null;
  }
};

const savePendingEmailApplication = (applicationData) => {
  localStorage.setItem(pendingEmailApplicationKey, JSON.stringify(applicationData));
};

const clearPendingEmailApplication = () => {
  localStorage.removeItem(pendingEmailApplicationKey);
};

const saveApplicationToFirestore = async (user, applicationData) => {
  await setDoc(getApplicationRef(user), {
    uid: user.uid,
    fullName: applicationData.fullName,
    email: user.email,
    experience: applicationData.experience,
    over17: applicationData.over17,
    bookAnswer: applicationData.bookAnswer,
    status: "pending",
    createdAt: serverTimestamp(),
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    reviewedAt: null,
    reviewedBy: null,
    reviewedByEmail: null,
    adminNote: ""
  });
};

const saveSubmittedProfile = (user, applicationData) => {
  localStorage.setItem("ixonian-email", user.email || applicationData.email);
  localStorage.setItem("ixonian-name", applicationData.fullName);

  if (user.photoURL) {
    localStorage.setItem("ixonian-photo", user.photoURL);
  } else {
    localStorage.removeItem("ixonian-photo");
  }
};

const sendEmailVerificationForApplication = async (applicationData) => {
  await sendSignInLinkToEmail(auth, applicationData.email, actionCodeSettings);
  localStorage.setItem("emailForSignIn", applicationData.email);
  savePendingEmailApplication(applicationData);
  showEmailNotification("Verify email", "We sent a verification link to your email. Open it to finish your application.");
};

const getEmailSubmissionUser = async (email, applicationData) => {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    await sendEmailVerificationForApplication(applicationData);
    return null;
  }

  await currentUser.reload();
  const refreshedUser = auth.currentUser || currentUser;

  if (refreshedUser.email?.toLowerCase() !== email.toLowerCase()) {
    throw new Error("Please sign out before using a different email.");
  }

  if (!isGoogleUser(refreshedUser) && !refreshedUser.emailVerified) {
    await sendEmailVerificationForApplication(applicationData);
    return null;
  }

  return refreshedUser;
};

const completeEmailLinkSignIn = async () => {
  if (!isSignInWithEmailLink(auth, window.location.href)) {
    return;
  }

  keepIndexOpenForApplication = true;
  const email = localStorage.getItem("emailForSignIn");

  if (!email) {
    showEmailNotification("Verification link expired", "Please submit the application again to send a new verification link.");
    return;
  }

  try {
    const result = await signInWithEmailLink(auth, email, window.location.href);
    await result.user.reload();
    const verifiedUser = auth.currentUser || result.user;
    localStorage.removeItem("emailForSignIn");
    window.history.replaceState({}, document.title, window.location.pathname);
    const pendingApplication = getPendingEmailApplication();

    if (emailInput) {
      emailInput.value = verifiedUser.email || email;
      emailInput.readOnly = true;
    }

    const existingApplication = await getExistingApplication(verifiedUser);

    if (existingApplication?.exists()) {
      clearPendingEmailApplication();
      saveApplicationProfile(verifiedUser, existingApplication.data());
      console.log("Existing email application found. Redirecting to profile.html");
      window.location.replace("profile.html");
      return;
    }

    if (pendingApplication && pendingApplication.email?.toLowerCase() === verifiedUser.email?.toLowerCase()) {
      await verifiedUser.getIdToken(true);
      console.log("Submitting application...");
      await saveApplicationToFirestore(verifiedUser, pendingApplication);
      clearPendingEmailApplication();
      saveSubmittedProfile(verifiedUser, pendingApplication);
      console.log("Application saved to Firestore");
      showEmailNotification("Email verified", "Your application has been submitted.");
      window.setTimeout(() => {
        window.location.replace("profile.html");
      }, 900);
      return;
    }

    saveProfileUser(verifiedUser);
    showSignedInState(verifiedUser, "Email verified");
    showEmailNotification("Email verified", "You may now submit your application.");
    console.log(`Signed in as: ${verifiedUser.email}`);
  } catch (error) {
    console.error("Email link sign-in error:", error);
    showEmailNotification("Application failed", error.message);
  }
};

completeEmailLinkSignIn();

if (googleBtn) {
  console.log("Google button found");

  googleBtn.addEventListener("click", async () => {
    console.log("Google button clicked");
    keepIndexOpenForApplication = true;

    try {
      const result = await signInWithPopup(auth, provider);

      if (await redirectExistingGoogleApplication(result.user)) {
        return;
      }

      saveProfileUser(result.user);

      if (isSignInPage) {
        console.log("Google sign-in complete. Redirecting to profile.html");
        window.location.replace("profile.html");
        return;
      }

      showSignedInState(result.user, "Google sign-in complete");
      console.log(`Signed in as: ${result.user.email}`);
    } catch (error) {
      console.error("Google sign-in error:", error);
      alert("Google sign-in failed: " + error.message);
    }
  });
}

if (signOutBtn) {
  console.log("Sign out button found");

  signOutBtn.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    console.log("Sign out clicked");
    signOutBtn.disabled = true;
    signOutBtn.innerText = "Signing out...";

    try {
      await signOut(auth);
      console.log("Signed out");
    } catch (error) {
      console.error("Sign out error:", error);
    } finally {
      clearStoredProfile();
      window.location.replace("index.html");
    }
  });
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    const applicationSnapshot = await getExistingApplication(user);

    if (applicationSnapshot?.exists()) {
      const applicationData = applicationSnapshot.data();
      saveApplicationProfile(user, applicationData);
      renderProfileApplication(user, applicationData);
    } else {
      saveProfileUser(user);
    }

    if (isIndexPage && !keepIndexOpenForApplication) {
      console.log("Signed-in user recognized. Redirecting to profile.html");
      window.location.replace("profile.html");
      return;
    }

    showSignedInState(user);
    console.log(`Signed in as: ${user.email}`);
  } else {
    if (isProfilePage) {
      clearStoredProfile();
      console.log("Not signed in. Redirecting to index.html");
      window.location.replace("index.html");
      return;
    }

    loadStoredProfile();
    console.log("Not signed in");
  }
});

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log("Submit button clicked");
    clearFieldErrors();

    const fullName = document.getElementById("fullName")?.value.trim() || "";
    const submittedEmail = emailInput?.value.trim() || "";
    const experience = document.getElementById("experience")?.value.trim() || "";
    const over17 = document.getElementById("over17")?.checked || false;
    const bookAnswer = document.getElementById("bookAnswer")?.value.trim() || "";
    let hasRequiredError = false;

    if (!fullName) {
      showFieldError("fullName", "Required field");
      hasRequiredError = true;
    }

    if (!submittedEmail) {
      showFieldError("email", "Required field");
      hasRequiredError = true;
    }

    if (!experience) {
      showFieldError("experience", "Required field");
      hasRequiredError = true;
    }

    if (!over17) {
      showFieldError("over17", "Required field");
      hasRequiredError = true;
    }

    if (!bookAnswer) {
      showFieldError("bookAnswer", "Required field");
      hasRequiredError = true;
    }

    if (hasRequiredError) {
      return;
    }

    if (!hasClickedContinue) {
      if (submitGateMessage) {
        submitGateMessage.textContent = "Please click Continue in the Founding Author Application section before submitting.";
        submitGateMessage.classList.remove("is-unlocked");
      }
      return;
    }

    let hasLimitError = false;

    if (fullName.length < 2) {
      showFieldError("fullName", "Full Legal Name must be at least 2 characters.");
      hasLimitError = true;
    }

    if (fullName.length > characterLimits.fullName) {
      showFieldError("fullName", "Character limit exceeded.");
      hasLimitError = true;
    }

    if (experience.length > characterLimits.experience) {
      showFieldError("experience", "Character limit exceeded.");
      hasLimitError = true;
    }

    if (bookAnswer.length < 30) {
      showFieldError("bookAnswer", "Book answer must be at least 30 characters.");
      hasLimitError = true;
    }

    if (bookAnswer.length > characterLimits.bookAnswer) {
      showFieldError("bookAnswer", "Character limit exceeded.");
      hasLimitError = true;
    }

    if (hasLimitError) {
      return;
    }

    const applicationData = {
      fullName,
      email: submittedEmail,
      experience,
      over17,
      bookAnswer
    };
    let user;

    try {
      keepIndexOpenForApplication = true;
      user = await getEmailSubmissionUser(submittedEmail, applicationData);
      console.log("Current user:", user);

      if (!user) {
        return;
      }

      await user.getIdToken(true);
      console.log("Submitting application...");

      await saveApplicationToFirestore(user, applicationData);
      saveSubmittedProfile(user, applicationData);

      console.log("Application saved to Firestore");
      window.location.href = "profile.html";
    } catch (error) {
      console.error("Firestore save error:", error);

      if (error.code === "permission-denied" && isGoogleUser(user)) {
        if (await redirectExistingGoogleApplication(user)) {
          return;
        }
      }

      alert("Application failed: " + error.message);
    }
  });
}
