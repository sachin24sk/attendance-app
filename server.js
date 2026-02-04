const express = require("express");
const admin = require("firebase-admin");
const session = require("express-session");

const app = express();
const PORT = process.env.PORT || 3000;

/* ================= ERP TEACHER SYSTEM ================= */

const TEACHERS = {
  teacher1: { pass: "12345", class: "BSc 4th" },
  teacher2: { pass: "67890", class: "BSc 3rd" }
};

/* GLOBAL SETTINGS */
let SETTINGS = {
  subject: "ODE",
  className: "BSc 4th",
  classLat: 0,
  classLon: 0
};

const ALLOWED_DISTANCE = 100;

/* FIREBASE */
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

app.use(express.json({ limit: "20mb" }));
app.use(express.static("public"));

app.use(session({
  secret: "erp-secret",
  resave: false,
  saveUninitialized: true
}));

/* DISTANCE CALC */
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ================= LOGIN ================= */

app.post("/api/admin/login", (req, res) => {

  const { id, password } = req.body;

  if (!TEACHERS[id] || TEACHERS[id].pass !== password) {
    return res.status(401).json({ message: "Wrong login" });
  }

  req.session.admin = id;

  res.json({
    message: "Login success",
    class: TEACHERS[id].class
  });
});

/* CURRENT SUBJECT FOR STUDENT PAGE */
app.get("/api/current-subject", (req, res) => {
  res.json({
    subject: SETTINGS.subject,
    className: SETTINGS.className
  });
});

/* ================= ADMIN SETTINGS ================= */

app.post("/api/admin/settings", (req, res) => {

  if (!req.session.admin)
    return res.status(401).json({ message: "Not logged in" });

  const { subject, className, classLat, classLon } = req.body;

  SETTINGS.subject = subject;
  SETTINGS.className = className;
  SETTINGS.classLat = Number(classLat || 0);
  SETTINGS.classLon = Number(classLon || 0);

  res.json({ message: "ERP Updated ✔" });
});

/* ================= STUDENT ATTENDANCE ================= */

app.post("/api/attendance", async (req, res) => {

  const { name, photo, latitude, longitude, time } = req.body;

  const todayDate = new Date().toLocaleDateString();

  const distance = getDistanceInMeters(
    SETTINGS.classLat,
    SETTINGS.classLon,
    latitude,
    longitude
  );

  if (distance > ALLOWED_DISTANCE) {
    return res.status(403).json({ message: "Outside class location" });
  }

  /* DUPLICATE CHECK */
  const existing = await db.collection("attendance")
    .where("name", "==", name)
    .where("subject", "==", SETTINGS.subject)
    .where("date", "==", todayDate)
    .get();

  if (!existing.empty) {
    return res.json({
      message: "Already marked today ✔",
      subject: SETTINGS.subject,
      date: todayDate
    });
  }

  await db.collection("attendance").add({
    name,
    className: SETTINGS.className,
    subject: SETTINGS.subject,
    photo,
    latitude,
    longitude,
    time,
    date: todayDate,
    createdAt: new Date()
  });

  res.json({
    message: "Attendance saved ✔",
    subject: SETTINGS.subject,
    date: todayDate
  });
});

/* ================= ERP DASHBOARD ================= */

app.get("/api/admin/attendance", async (req, res) => {

  if (!req.session.admin)
    return res.status(401).json({ message: "Not logged in" });

  const snapshot = await db.collection("attendance")
    .orderBy("createdAt", "desc")
    .get();

  const list = [];
  snapshot.forEach(doc => list.push(doc.data()));

  res.json(list);
});

/* ⭐ STUDENT PERCENTAGE ERP */
app.get("/api/admin/stats", async (req, res) => {

  if (!req.session.admin)
    return res.status(401).json({ message: "Not logged in" });

  const snapshot = await db.collection("attendance").get();

  const students = {};

  snapshot.forEach(doc => {
    const d = doc.data();
    students[d.name] = (students[d.name] || 0) + 1;
  });

  res.json(students);
});

/* ================= START SERVER ================= */

app.listen(PORT, () => {
  console.log("🚀 ULTIMATE ERP SCHOOL SYSTEM RUNNING");
});
