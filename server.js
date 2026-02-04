const express = require("express");
const admin = require("firebase-admin");

const app = express();

/* ⭐ Render PORT FIX */
const PORT = process.env.PORT || 3000;

const ADMIN_PASSWORD = "12345";

let SETTINGS = {
  subject: "BSc 4th ODE",
  subjects: [
    "BSc 1st Maths",
    "BSc 2nd Physics",
    "BSc 3rd Chemistry",
    "BSc 4th ODE",
    "BSc 5th English"
  ],
  classLat: 0,
  classLon: 0,
};

const ALLOWED_DISTANCE = 100;

/* ⭐ SECURE FIREBASE KEY (Render ENV VARIABLE) */
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

app.use(express.json({ limit: "20mb" }));
app.use(express.static("public"));

/* DISTANCE FUNCTION */
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/* ADMIN LOGIN */
app.post("/api/admin/login", (req, res) => {
  const { password } = req.body;
  if (!password || password.trim() !== ADMIN_PASSWORD) {
    return res.status(401).json({ message: "Wrong password" });
  }
  res.json({ message: "Login success" });
});

/* UPDATE SUBJECT + LOCATION */
app.post("/api/admin/settings", (req, res) => {
  const { password, subject, classLat, classLon } = req.body;

  if (!password || password.trim() !== ADMIN_PASSWORD) {
    return res.status(401).json({ message: "Wrong password" });
  }

  SETTINGS.subject = subject;
  SETTINGS.classLat = Number(classLat || 0);
  SETTINGS.classLon = Number(classLon || 0);

  res.json({ message: "Updated Successfully ✔" });
});

/* ADD SUBJECT */
app.post("/api/admin/add-subject", (req, res) => {
  const { password, subject } = req.body;

  if (!password || password.trim() !== ADMIN_PASSWORD) {
    return res.status(401).json({ message: "Wrong password" });
  }

  const s = subject.trim();

  if (s && !SETTINGS.subjects.includes(s)) {
    SETTINGS.subjects.push(s);
  }

  SETTINGS.subject = s;

  res.json({ message: "Subject added ✔" });
});

/* SUBJECT LIST */
app.get("/api/admin/subjects", (req, res) => {
  const password = req.query.password;

  if (!password || password.trim() !== ADMIN_PASSWORD) {
    return res.status(401).json({ message: "Wrong password" });
  }

  res.json(SETTINGS.subjects);
});

/* STUDENT ATTENDANCE */
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

/* ADMIN VIEW ATTENDANCE */
app.get("/api/admin/attendance", async (req, res) => {
  const password = req.query.password;
  const subject = req.query.subject;

  if (!password || password.trim() !== ADMIN_PASSWORD) {
    return res.status(401).json({ message: "Wrong password" });
  }

  let query = db.collection("attendance");

  if (subject) {
    query = query.where("subject", "==", subject);
  }

  const snapshot = await query.orderBy("createdAt", "desc").get();

  const list = [];
  snapshot.forEach(doc => list.push(doc.data()));

  res.json(list);
});

/* SERVER START */
app.listen(PORT, () => {
  console.log("Server running...");
});
