import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  initializeAppCheck,
  ReCaptchaV3Provider
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app-check.js";

const firebaseConfig = {
  apiKey: "AIzaSyCAbGKfBG1VWkRqCMAVZQfU90IxG8qfTBY",
  authDomain: "reservas-salones-968de.firebaseapp.com",
  projectId: "reservas-salones-968de",
  storageBucket: "reservas-salones-968de.firebasestorage.app",
  messagingSenderId: "479805028463",
  appId: "1:479805028463:web:01108e65e86f8f4dc4359a"
};

const app = initializeApp(firebaseConfig);

initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider("6Lf2JvssAAAAANofChpVxcYVi-es1zEoUnjP0VfF"),
  isTokenAutoRefreshEnabled: true
});

export const db = getFirestore(app);
