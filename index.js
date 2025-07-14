const express = require('express');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const app = express();
const PORT = 3000;

const DATA_FILE = path.join(__dirname, 'data.json');
const ADMIN_PASSWORD = 'admin123'; // You can change this later

let rawData = fs.readFileSync(DATA_FILE);
let { classes, studentIdCounter } = JSON.parse(rawData);

function saveData() {
  const data = { classes, studentIdCounter };
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.use(cors());
app.use(express.json());

// Create a class
app.post('/class', (req, res) => {
  const { className } = req.body;
  if (!className) return res.status(400).json({ error: 'className is required' });
  if (classes[className]) return res.status(400).json({ error: 'Class already exists' });

  classes[className] = [];
  saveData();
  res.status(201).json({ message: `Class "${className}" created.` });
});

// Add student
app.post('/student', async (req, res) => {
  const { name, className } = req.body;
  if (!name || !className) return res.status(400).json({ error: 'name and className are required' });
  if (!classes[className]) return res.status(404).json({ error: 'Class not found' });

  const studentId = studentIdCounter++;
  const qrData = `student-${studentId}`;
  const qrCode = await QRCode.toDataURL(qrData);

  const student = {
    id: studentId,
    name,
    className,
    points: 0,
    qrCode
  };

  classes[className].push(student);
  saveData();
  res.status(201).json({ message: 'Student added', student });
});

// Edit student
app.put('/student/:id', (req, res) => {
  const { id } = req.params;
  const { name, points, password } = req.body;

  if (password !== ADMIN_PASSWORD) return res.status(403).json({ error: 'Unauthorized' });

  const studentId = parseInt(id);
  for (const className in classes) {
    const student = classes[className].find(s => s.id === studentId);
    if (student) {
      if (name !== undefined) student.name = name;
      if (points !== undefined) student.points = points;
      saveData();
      return res.json({ message: 'Student updated', student });
    }
  }

  res.status(404).json({ error: 'Student not found' });
});

// Delete student
app.delete('/student/:id', (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  if (password !== ADMIN_PASSWORD) return res.status(403).json({ error: 'Unauthorized' });

  const studentId = parseInt(id);
  for (const className in classes) {
    const index = classes[className].findIndex(s => s.id === studentId);
    if (index !== -1) {
      const deleted = classes[className].splice(index, 1)[0];
      saveData();
      return res.json({ message: 'Student deleted', deleted });
    }
  }

  res.status(404).json({ error: 'Student not found' });
});

// View all students
app.get('/students', (req, res) => {
  let allStudents = [];
  for (const className in classes) {
    allStudents = allStudents.concat(classes[className]);
  }
  res.json({ students: allStudents });
});

app.get('/', (req, res) => {
  res.send('Classroom Tracker Backend is running.');
});

// QR scan
app.post('/scan', (req, res) => {
  const { qrCodeData, action, className, amount } = req.body;

  if (!qrCodeData || !action || !className || typeof amount !== 'number') {
    return res.status(400).json({ error: 'qrCodeData, action, className, and amount are required' });
  }

  const studentId = parseInt(qrCodeData.replace('student-', ''));
  const classStudents = classes[className];
  if (!classStudents) return res.status(404).json({ error: 'Class not found' });

  const student = classStudents.find(s => s.id === studentId);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  if (action === 'add') {
    student.points += amount;
  } else if (action === 'subtract') {
    student.points -= amount;
  } else {
    return res.status(400).json({ error: 'Invalid action (use "add" or "subtract")' });
  }

  saveData();
  res.json({ message: `Points ${action}ed`, student });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
