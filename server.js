const express = require('express');
const multer = require('multer');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const XLSX = require('xlsx'); 

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/edvantage', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
    console.log('Connected to MongoDB');
});

// ==================== SCHEMAS ====================

// Teacher Schema
const teacherSchema = new mongoose.Schema({
    teacherId: String,
    name: String,
    email: String,
    phone: String,
    password: String,
});

// Student Schema
const studentSchema = new mongoose.Schema({
    studentId: String,
    name: String,
    rollNumber: String,  // Add this line
    email: String,
    phone: String,
    password: String,
    messages: [String],
});

// Course Schema
const courseSchema = new mongoose.Schema({ 
    name: String 
});

// Subject Schema
const subjectSchema = new mongoose.Schema({ 
    name: String, 
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' } 
});

// Class Schema
const classSchema = new mongoose.Schema({ 
    name: String,
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    attendance: [Object] // For storing attendance data
});

// Resource Schema
const resourceSchema = new mongoose.Schema({
    filename: String,
    path: String,
    category: String,
});

// Attendance Schema
// Updated Attendance Schema
const attendanceSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    studentName: String,
    rollNumber: String,
    className: String,
    teacherName: String,
    status: { type: String, enum: ['present', 'absent'], required: true },
    date: { type: Date, required: true },  // Specific date of attendance
    time: { type: String },  // Time of attendance recording
    recordedAt: { type: Date, default: Date.now }  // When record was created
}, { timestamps: true });


// performance schema

const performanceSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    studentName: { type: String, required: true },
    subject: { type: String, required: true },
    marks: {
      firstInternal: { type: Number, default: 0 },
      secondInternal: { type: Number, default: 0 },
      thirdInternal: { type: Number, default: 0 },
      externalMarks: { type: Number, default: 0 },
      assignmentMarks: { type: Number, default: 0 },
      labInternal: { type: Number, default: 0 },
      labExternal: { type: Number, default: 0 }
    }
  }, { timestamps: true });
  
  


// Event Schema
const eventSchema = new mongoose.Schema({
    title: String,
    description: String,
    announcementDate: { type: Date, default: Date.now },
    commencementDate: Date,
});

// Leave Request Schema
const leaveRequestSchema = new mongoose.Schema({
    studentName: String,
    leaveDate: Date,
    reason: String,
    status: { type: String, default: "Pending" },
});

// Task Schema
const taskSchema = new mongoose.Schema({
    taskText: String,
    date: Date,
    time: String,
    duration: String,
    status: { type: String, default: "Pending" },
});

// ==================== MODELS ====================
const Teacher = mongoose.model('Teacher', teacherSchema);
const Student = mongoose.model('Student', studentSchema);
const Course = mongoose.model('Course', courseSchema);
const Subject = mongoose.model('Subject', subjectSchema);
const Class = mongoose.model('Class', classSchema);
const Resource = mongoose.model('Resource', resourceSchema);
const Attendance = mongoose.model('Attendance', attendanceSchema);
const Performance = mongoose.model('Performance', performanceSchema);
const Event = mongoose.model('Event', eventSchema);
const LeaveRequest = mongoose.model('LeaveRequest', leaveRequestSchema);
const Task = mongoose.model('Task', taskSchema);

// ==================== MULTER CONFIG ====================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    },
});

const upload = multer({ storage });

// ==================== ROUTES ====================

// ---------- Authentication Routes ----------
app.post('/login-student', async (req, res) => {
    const { email, password } = req.body;
    try {
      const student = await Student.findOne({ studentId: email });
      if (!student || student.password !== password) {
        return res.status(401).json({ error: 'Invalid student ID or password' });
      }
      res.json({ message: 'Login successful', _id: student._id, name: student.name });
    } catch (err) {
      res.status(500).json({ error: 'Server error during student login' });
    }
  });
  
  app.post('/login-teacher', async (req, res) => {
    const { email, password } = req.body;
    try {
      const teacher = await Teacher.findOne({ teacherId: email });
      if (!teacher || teacher.password !== password) {
        return res.status(401).json({ error: 'Invalid teacher ID or password' });
      }
      res.json({ message: 'Login successful', _id: teacher._id, name: teacher.name });
    } catch (err) {
      res.status(500).json({ error: 'Server error during teacher login' });
    }
  });

  // Admin Schema
const adminSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    role: { type: String, default: 'admin' }
});

const Admin = mongoose.model('Admin', adminSchema);

// Admin Registration
app.post('/register-admin', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Check if username or email already exists
        const existingAdmin = await Admin.findOne({ $or: [{ username }, { email }] });
        if (existingAdmin) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }

        const admin = new Admin({ username, email, password });
        await admin.save();
        
        res.json({ 
            message: 'Admin registered successfully', 
            _id: admin._id 
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to register admin' });
    }
});

// Admin Login
app.post('/login-admin', async (req, res) => {
    const { username, password } = req.body;
    try {
        const admin = await Admin.findOne({ username });
        if (!admin || admin.password !== password) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        res.json({ 
            message: 'Login successful', 
            _id: admin._id 
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error during admin login' });
    }
});
  

// ---------- Teacher/Student Management ----------
app.post('/add-teacher', async (req, res) => {
    try {
        const { teacherId, name, email, phone, password } = req.body;
        const teacher = new Teacher({ teacherId, name, email, phone, password });
        await teacher.save();
        res.status(201).json(teacher);
    } catch (error) {
        res.status(500).json({ error: 'Failed to add teacher' });
    }
});

app.post('/add-student', async (req, res) => {
    try {
        const { studentId, name, email, phone, password } = req.body;
        const student = new Student({ studentId, name, email, phone, password });
        await student.save();
        res.status(201).json(student);
    } catch (error) {
        res.status(500).json({ error: 'Failed to add student' });
    }
});

app.get('/teachers', async (req, res) => {
    try {
        const teachers = await Teacher.find();
        res.json(teachers);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch teachers' });
    }
});

app.get('/students', async (req, res) => {
    try {
        const students = await Student.find();
        res.json(students);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch students' });
    }
});

app.get('/students/:id', async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) return res.status(404).json({ error: 'Student not found' });
        res.json(student);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch student' });
    }
});

// ---------- Course/Subject/Class Management ----------
app.post('/add-course', async (req, res) => {
    try {
        const course = new Course({ name: req.body.name });
        await course.save();
        res.status(201).json(course);
    } catch (error) {
        res.status(500).json({ error: 'Failed to add course' });
    }
});

app.post('/add-subject', async (req, res) => {
    try {
        const subject = new Subject({ name: req.body.name, course: req.body.courseId });
        await subject.save();
        res.status(201).json(subject);
    } catch (error) {
        res.status(500).json({ error: 'Failed to add subject' });
    }
});

app.post('/assign-class', async (req, res) => {
    try {
        const { className, teacherId, studentIds, courseId, subjectId } = req.body;
        const classData = new Class({ 
            name: className, 
            teacher: teacherId, 
            students: studentIds, 
            course: courseId, 
            subject: subjectId 
        });
        await classData.save();
        res.status(201).json(classData);
    } catch (error) {
        res.status(500).json({ error: 'Failed to assign class' });
    }
});

app.get('/courses', async (req, res) => {
    try {
        const courses = await Course.find();
        res.json(courses);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch courses' });
    }
});

app.get('/subjects', async (req, res) => {
    try {
        const subjects = await Subject.find().populate('course');
        res.json(subjects);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch subjects' });
    }
});

app.get('/classes', async (req, res) => {
    try {
        const classes = await Class.find()
            .populate('teacher')
            .populate('students')
            .populate('course')
            .populate('subject');
        res.json(classes);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch classes' });
    }
});

// ---------- Resource Management ----------
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const { category } = req.body;
        const { filename, path } = req.file;

        const newResource = new Resource({
            filename,
            path,
            category,
        });

        await newResource.save();
        res.status(200).json({ message: 'File uploaded successfully!', resource: newResource });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ message: 'Failed to upload file', error: error.message });
    }
});

// ---------- Attendance Management ----------
app.post('/attendance', async (req, res) => {
    try {
        const attendances = req.body; // Expecting an array of attendance records

        // Save each attendance record
        const savedRecords = await Promise.all(
            attendances.map(async (attendance) => {
                const newAttendance = new Attendance({
                    studentId: attendance.studentId,
                    studentName: attendance.studentName,
                    rollNumber: attendance.rollNumber,
                    status: attendance.status,
                    date: new Date(),
                    className: 'General', // Default class name, can be updated as needed
                    teacherName: 'Teacher' // Default teacher name, can be updated as needed
                });
                return await newAttendance.save();
            })
        );

        res.status(200).json({ 
            message: 'Attendance updated successfully!',
            records: savedRecords
        });
    } catch (error) {
        console.error('Error updating attendance:', error);
        res.status(500).json({ message: 'Failed to update attendance', error: error.message });
    }
});

app.post('/submit-attendance', async (req, res) => {
    try {
        const { classId, attendanceData } = req.body;
        await Class.findByIdAndUpdate(classId, { attendance: attendanceData });
        res.json({ message: 'Attendance submitted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to submit attendance' });
    }
});

app.get('/download-attendance', async (req, res) => {
    try {
        const attendances = await Attendance.find();
        const doc = new PDFDocument();
        const filePath = path.join(__dirname, 'attendance_report.pdf');
        doc.pipe(fs.createWriteStream(filePath));

        doc.fontSize(16).text('Attendance Report', { align: 'center' });
        doc.moveDown();

        attendances.forEach((attendance, index) => {
            doc.fontSize(12).text(
                `${index + 1}. ${attendance.studentName} (Roll No: ${attendance.rollNumber}) - ${attendance.status}`
            );
            doc.moveDown();
        });

        doc.end();

        res.download(filePath, 'attendance_report.pdf', (err) => {
            if (err) {
                console.error('Error downloading PDF:', err);
                res.status(500).json({ message: 'Failed to download PDF', error: err.message });
            } else {
                fs.unlinkSync(filePath);
            }
        });
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ message: 'Failed to generate PDF', error: error.message });
    }
});

// In server.js - update the students-with-attendance endpoint
app.get('/students-with-attendance', async (req, res) => {
    try {
        // Fetch all students
        const students = await Student.find({}, 'name rollNumber');

        // Generate attendance stats for each student
        const response = await Promise.all(students.map(async (student) => {
            const records = await Attendance.find({ studentId: student._id });

            const total = records.length;
            const present = records.filter(r => r.status === 'present').length;
            const percentage = total > 0 ? Math.round((present / total) * 100) : 100;

            return {
                _id: student._id,
                name: student.name,
                rollNumber: student.rollNumber,
                attendanceStatus: records[records.length - 1]?.status || 'present',
                attendancePercentage: percentage
            };
        }));

        res.status(200).json(response);
    } catch (error) {
        console.error('Error fetching students with attendance:', error);
        res.status(500).json({ message: 'Failed to fetch students', error: error.message });
    }
});


// Updated /attendance endpoint
app.post('/attendance', async (req, res) => {
    try {
        const { studentId, studentName, rollNumber, status, date, time } = req.body;
        
        if (!date) {
            return res.status(400).json({ message: 'Date is required' });
        }

        // Create new attendance record with date and time
        const newAttendance = new Attendance({
            studentId,
            studentName,
            rollNumber,
            status,
            date: new Date(date),
            time: time || '00:00',
            className: req.body.className || 'General',
            teacherName: req.body.teacherName || 'Teacher'
        });

        await newAttendance.save();
        
        // Calculate new attendance percentage
        const attendanceStats = await Attendance.aggregate([
            {
                $match: { studentId: mongoose.Types.ObjectId(studentId) }
            },
            {
                $group: {
                    _id: "$studentId",
                    presentCount: {
                        $sum: {
                            $cond: [{ $eq: ["$status", "present"] }, 1, 0]
                        }
                    },
                    totalCount: { $sum: 1 }
                }
            }
        ]);

        const percentage = attendanceStats.length > 0 
            ? Math.round((attendanceStats[0].presentCount / attendanceStats[0].totalCount) * 100)
            : 100;

        res.status(200).json({ 
            message: 'Attendance updated successfully!',
            attendancePercentage: percentage
        });
    } catch (error) {
        console.error('Error updating attendance:', error);
        res.status(500).json({ message: 'Failed to update attendance', error: error.message });
    }
});

// Updated bulk attendance endpoint
app.post('/attendance-bulk', async (req, res) => {
    try {
        const attendances = req.body;
        const date = req.body.date || new Date();

        const updates = await Promise.all(attendances.map(async ({ studentId, studentName, rollNumber, status }) => {
            const newAttendance = new Attendance({
                studentId,
                studentName,
                rollNumber,
                status,
                date: new Date(date),
                time: req.body.time || '00:00',
                className: req.body.className || 'General',
                teacherName: req.body.teacherName || 'Teacher'
            });

            await newAttendance.save();

            const stats = await Attendance.aggregate([
                { $match: { studentId: mongoose.Types.ObjectId(studentId) } },
                {
                    $group: {
                        _id: "$studentId",
                        presentCount: {
                            $sum: {
                                $cond: [{ $eq: ["$status", "present"] }, 1, 0]
                            }
                        },
                        totalCount: { $sum: 1 }
                    }
                }
            ]);

            const percentage = stats.length > 0
                ? Math.round((stats[0].presentCount / stats[0].totalCount) * 100)
                : 100;

            return { studentId, percentage };
        }));

        res.json({ message: 'Bulk attendance updated', updates });
    } catch (error) {
        console.error('Bulk attendance error:', error);
        res.status(500).json({ message: 'Failed to update attendance', error: error.message });
    }
});

app.get('/attendance/export/excel', async (req, res) => {
    try {
        const { date } = req.query;
        let query = {};
        
        if (date) {
            const startDate = new Date(date);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);
            query.date = { $gte: startDate, $lte: endDate };
        }

        const attendances = await Attendance.find(query).populate('studentId', 'name rollNumber');
        const data = attendances.map(a => ({
            Name: a.studentId?.name || a.studentName || 'Unknown',
            RollNumber: a.studentId?.rollNumber || a.rollNumber || 'N/A',
            Status: a.status,
            Date: a.date.toLocaleDateString(),
            Time: a.time || 'N/A',
            Class: a.className || 'General',
            Teacher: a.teacherName || 'Teacher'
        }));

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');

        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        const filename = date ? 
            `attendance_report_${date.replace(/-/g, '')}.xlsx` : 
            'attendance_report_all.xlsx';

        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error) {
        console.error('Excel export error:', error);
        res.status(500).json({ error: 'Failed to export Excel file' });
    }
});


// Get attendance by date
app.get('/attendance-by-date', async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({ error: 'Date parameter is required' });
        }

        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);

        const attendance = await Attendance.find({
            date: { $gte: startDate, $lte: endDate }
        }).populate('studentId', 'name rollNumber');

        res.json(attendance);
    } catch (error) {
        console.error('Error fetching attendance by date:', error);
        res.status(500).json({ error: 'Failed to fetch attendance' });
    }
});



// ---------- Performance Management ----------
app.get('/performance/:studentId', async (req, res) => {
    const { studentId } = req.params;
  
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ error: 'Invalid studentId' });
    }
  
    try {
      const records = await Performance.find({ studentId });
      res.status(200).json(records);
    } catch (err) {
      console.error('Error fetching performance:', err);
      res.status(500).json({ error: 'Failed to fetch performance' });
    }
  });
  

  app.get('/performance/:studentId/:subject', async (req, res) => {
    const { studentId, subject } = req.params;
  
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ error: 'Invalid studentId' });
    }
  
    try {
      const record = await Performance.findOne({ studentId, subject });
  
      if (!record) {
        return res.status(404).json({ message: 'No performance record found for this subject' });
      }
  
      res.status(200).json(record);
    } catch (err) {
      console.error('Error fetching subject performance:', err);
      res.status(500).json({ error: 'Failed to fetch subject performance' });
    }
  });
  



  app.delete('/performance/:studentId/:subject', async (req, res) => {
    const { studentId, subject } = req.params;
    try {
      const result = await Performance.deleteOne({ studentId, subject });
      res.status(200).json({ message: 'Deleted', result });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete performance record' });
    }
  });
  
  

  app.post('/performance', async (req, res) => {
    const { studentId, subject, marks } = req.body;
  
    if (!studentId || !subject || !marks) {
      return res.status(400).json({ error: 'Missing studentId, subject or marks' });
    }
  
    if (!mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ error: 'Invalid studentId' });
    }
  
    try {
      // Get student name from DB
      const student = await Student.findById(studentId);
      if (!student) return res.status(404).json({ error: 'Student not found' });
  
      let record = await Performance.findOne({ studentId, subject });
  
      if (record) {
        record.marks = marks;
        record.studentName = student.name; // update name if changed
      } else {
        record = new Performance({
          studentId,
          studentName: student.name,
          subject,
          marks
        });
      }
  
      await record.save();
      res.status(200).json({ message: 'Performance saved successfully', performance: record });
    } catch (err) {
      console.error('Error saving performance:', err);
      res.status(500).json({ error: 'Failed to save performance' });
    }
  });
  
  
  

// ---------- Event Management ----------
app.get('/events', async (req, res) => {
    try {
        const events = await Event.find();
        res.status(200).json(events);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ message: 'Failed to fetch events', error: error.message });
    }
});

app.post('/events', async (req, res) => {
    try {
        const { title, description, commencementDate } = req.body;

        const newEvent = new Event({
            title,
            description,
            commencementDate: new Date(commencementDate),
        });

        await newEvent.save();
        res.status(200).json({ message: 'Event added successfully!', event: newEvent });
    } catch (error) {
        console.error('Error adding event:', error);
        res.status(500).json({ message: 'Failed to add event', error: error.message });
    }
});

app.delete('/events/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Event.findByIdAndDelete(id);
        res.status(200).json({ message: 'Event deleted successfully!' });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ message: 'Failed to delete event', error: error.message });
    }
});

// ---------- Leave Request Management ----------
app.get('/leave-requests', async (req, res) => {
    try {
        const leaveRequests = await LeaveRequest.find();
        res.status(200).json(leaveRequests);
    } catch (error) {
        console.error('Error fetching leave requests:', error);
        res.status(500).json({ message: 'Failed to fetch leave requests', error: error.message });
    }
});

app.post('/leave-requests', async (req, res) => {
    try {
        const { studentName, leaveDate, reason } = req.body;

        const newLeaveRequest = new LeaveRequest({
            studentName,
            leaveDate: new Date(leaveDate),
            reason,
        });

        await newLeaveRequest.save();
        res.status(200).json({ message: 'Leave request submitted successfully!', leaveRequest: newLeaveRequest });
    } catch (error) {
        console.error('Error submitting leave request:', error);
        res.status(500).json({ message: 'Failed to submit leave request', error: error.message });
    }
});

app.put('/leave-requests/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Find the leave request first to get student info
        const leaveRequest = await LeaveRequest.findById(id);
        if (!leaveRequest) {
            return res.status(404).json({ message: 'Leave request not found' });
        }

        // Update the leave request
        const updatedLeaveRequest = await LeaveRequest.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );

        // Create a notification message for the student
        const message = `Your leave request for ${new Date(leaveRequest.leaveDate).toLocaleDateString()} has been ${status.toLowerCase()}.`;

        // Find the student and add the message
        await Student.findOneAndUpdate(
            { name: leaveRequest.studentName },
            { $push: { messages: message } }
        );

        res.status(200).json({ 
            message: 'Leave request updated successfully!', 
            leaveRequest: updatedLeaveRequest 
        });
    } catch (error) {
        console.error('Error updating leave request:', error);
        res.status(500).json({ message: 'Failed to update leave request', error: error.message });
    }
});

// ---------- Task Management ----------
app.get('/tasks', async (req, res) => {
    try {
        const tasks = await Task.find();
        res.status(200).json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ message: 'Failed to fetch tasks', error: error.message });
    }
});

app.post('/tasks', async (req, res) => {
    try {
        const { taskText, date, time, duration } = req.body;

        const newTask = new Task({
            taskText,
            date: new Date(date),
            time,
            duration,
        });

        await newTask.save();
        res.status(200).json({ message: 'Task added successfully!', task: newTask });
    } catch (error) {
        console.error('Error adding task:', error);
        res.status(500).json({ message: 'Failed to add task', error: error.message });
    }
});

app.put('/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const updatedTask = await Task.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );

        if (!updatedTask) {
            return res.status(404).json({ message: 'Task not found' });
        }

        res.status(200).json({ message: 'Task updated successfully!', task: updatedTask });
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ message: 'Failed to update task', error: error.message });
    }
});

app.delete('/tasks/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Task.findByIdAndDelete(id);
        res.status(200).json({ message: 'Task deleted successfully!' });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ message: 'Failed to delete task', error: error.message });
    }
});

// ---------- Message Management ----------
app.post('/send-message', async (req, res) => {
    try {
        const { studentId, content } = req.body;
        await Student.findByIdAndUpdate(studentId, { $push: { messages: content } });
        res.json({ message: 'Message sent successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// ---------- Dashboard ----------
app.get('/api/dashboard/:teacherId', async (req, res) => {
    try {
        const teacherId = req.params.teacherId;
        
        // Validate teacherId format
        if (!mongoose.Types.ObjectId.isValid(teacherId)) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid teacher ID format' 
            });
        }

        // Check teacher exists
        const teacher = await Teacher.findById(teacherId);
        if (!teacher) {
            return res.status(404).json({ 
                success: false,
                message: 'Teacher not found' 
            });
        }

        // Get all counts with individual error handling
        let totalCourses, totalStudents, upcomingEvents, pendingLeaves;
        
        try {
            totalCourses = await Course.countDocuments();
        } catch (err) {
            console.error('Error counting courses:', err);
            totalCourses = 0;
        }

        try {
            totalStudents = await Student.countDocuments();
        } catch (err) {
            console.error('Error counting students:', err);
            totalStudents = 0;
        }

        try {
            upcomingEvents = await Event.countDocuments({ 
                commencementDate: { $gte: new Date() } 
            });
        } catch (err) {
            console.error('Error counting events:', err);
            upcomingEvents = 0;
        }

        try {
            pendingLeaves = await LeaveRequest.countDocuments({ 
                status: 'Pending' 
            });
        } catch (err) {
            console.error('Error counting leave requests:', err);
            pendingLeaves = 0;
        }

        res.status(200).json({
            success: true,
            data: {
                name: teacher.name,
                totalCourses,
                totalStudents,
                upcomingEvents,
                pendingLeaves,
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to fetch dashboard data',
            error: error.message 
        });
    }
});

// Add this endpoint to your server
app.post('/import-students', async (req, res) => {
    try {
        const { students } = req.body;
        
        // Validate and process each student
        const results = await Promise.allSettled(
            students.map(student => {
                const newStudent = new Student({
                    studentId: student.studentId,
                    name: student.name,
                    email: student.email,
                    phone: student.phone,
                    password: student.password
                });
                return newStudent.save();
            })
        );

        const successfulImports = results.filter(r => r.status === 'fulfilled').length;
        const failedImports = results.filter(r => r.status === 'rejected').length;

        res.status(200).json({
            message: `Import completed: ${successfulImports} successful, ${failedImports} failed`,
            details: results
        });
    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ message: 'Failed to import students', error: error.message });
    }
});

app.post('/import-students', async (req, res) => {
    try {
        const { students } = req.body;
        
        // Validate request structure
        if (!Array.isArray(students)) {
            return res.status(400).json({ error: 'Invalid data format' });
        }

        // Validate each student
        const validationErrors = [];
        students.forEach((student, index) => {
            if (!student.studentId) {
                validationErrors.push(`Row ${index+1}: Missing Student ID`);
            }
            if (!student.name) {
                validationErrors.push(`Row ${index+1}: Missing Name`);
            }
            if (!student.email) {
                validationErrors.push(`Row ${index+1}: Missing Email`);
            }
            // Password defaults to "password123" if empty
            if (!student.password) {
                student.password = 'password123';
            }
        });

        if (validationErrors.length > 0) {
            return res.status(400).json({ 
                error: 'Validation failed',
                details: validationErrors
            });
        }

        // Insert students
        const result = await Student.insertMany(students);
        res.json({ 
            success: true,
            imported: result.length
        });
        
    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ 
            error: 'Import failed',
            details: error.message
        });
    }
});

// Student Attendance Endpoint
app.get('/attendance/student', async (req, res) => {
    console.log('=== STARTING ATTENDANCE REQUEST ===');
    console.log('Query params:', req.query);
    
    try {
        const { studentId } = req.query;
        console.log('Received studentId:', studentId);
        
        if (!studentId) {
            console.log('No studentId provided');
            return res.status(400).json({ error: 'Student ID required' });
        }

        console.log('Querying database...');
        const records = await Attendance.find({ studentId }).lean();
        console.log(`Found ${records.length} records`);
        
        const response = records.map(r => ({
            date: r.date,
            status: r.status,
            className: r.className || 'General',
            teacherName: r.teacherName || 'Not specified'
        }));
        
        console.log('Sending response:', response);
        res.json(response);
        
    } catch (error) {
        console.error('ATTENDANCE ERROR:', error);
        res.status(500).json({ error: error.message });
    }
});
// Add this with your other route definitions
app.get('/api/attendance/student', async (req, res) => {
    try {
        const { studentId } = req.query;
        
        if (!studentId) {
            return res.status(400).json({ error: 'Student ID is required' });
        }

        // Find attendance records for this student
        const attendance = await Attendance.find({ studentId })
            .sort({ date: -1 }); // Newest first

        res.json(attendance.map(record => ({
            date: record.date,
            status: record.status,
            className: record.className || 'General Class',
            teacherName: record.teacherName || 'Teacher'
        })));

    } catch (error) {
        console.error('Error fetching attendance:', error);
        res.status(500).json({ error: 'Failed to fetch attendance records' });
    }
});

// In server.js temporary route
app.post('/test-data', async (req, res) => {
    await new Attendance({
        studentId: '67f26974de6223478a4b7c71',
        status: 'present',
        className: 'Mathematics',
        teacherName: 'Dr. Smith',
        date: new Date()
    }).save();
    res.send('Test record added');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});