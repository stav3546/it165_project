const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { randomUUID } = require('crypto');
require('dotenv').config();

const app = express();

const PORT = process.env.PORT || 5008;
const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/employee_management_db';

let memoryEmployees = [];
let dbConnected = false;

// Middleware
app.use(cors());
app.use(express.json());

// Employee Schema
const employeeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  position: { type: String, required: true },
  department: { type: String, required: true },
  salary: { type: Number, required: true, min: 0 }
});

const Employee = mongoose.model('Employee', employeeSchema);

// MongoDB Connection
const connectToDatabase = async () => {
  try {
    await mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 5000 });
    dbConnected = true;
    console.log('🚀 Successfully connected to MongoDB.');
  } catch (err) {
    dbConnected = false;
    console.warn('⚠ MongoDB not available. Falling back to in-memory storage.', err.message);
  }
};

// CREATE
const createEmployeeRecord = async (payload) => {
  if (dbConnected) {
    const newEmployee = new Employee(payload);
    return newEmployee.save();
  }

  const employee = {
    _id: randomUUID(),
    ...payload
  };

  memoryEmployees.push(employee);
  return employee;
};

// READ ALL
const readEmployeeRecords = async () => {
  if (dbConnected) {
    return Employee.find();
  }

  return memoryEmployees;
};

// READ ONE
const readOneEmployeeRecord = async (id) => {
  if (dbConnected) {
    return Employee.findById(id);
  }

  return memoryEmployees.find((employee) => employee._id === id);
};

// UPDATE
const updateEmployeeRecord = async (id, payload) => {
  if (dbConnected) {
    return Employee.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true
    });
  }

  const index = memoryEmployees.findIndex((employee) => employee._id === id);
  if (index === -1) return null;

  memoryEmployees[index] = { ...memoryEmployees[index], ...payload, _id: id };
  return memoryEmployees[index];
};

// DELETE
const deleteEmployeeRecord = async (id) => {
  if (dbConnected) {
    return Employee.findByIdAndDelete(id);
  }

  const index = memoryEmployees.findIndex((employee) => employee._id === id);
  if (index === -1) return null;

  const [deletedEmployee] = memoryEmployees.splice(index, 1);
  return deletedEmployee;
};

// 1. CREATE (POST)
app.post('/api/employees', async (req, res) => {
  try {
    const savedEmployee = await createEmployeeRecord(req.body);
    res.status(201).json(savedEmployee);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 2. READ ALL (GET)
app.get('/api/employees', async (req, res) => {
  try {
    const employees = await readEmployeeRecords();
    res.status(200).json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. READ ONE (GET BY ID)
app.get('/api/employees/:id', async (req, res) => {
  try {
    const employee = await readOneEmployeeRecord(req.params.id);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });

    res.status(200).json(employee);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 4. UPDATE (PUT)
app.put('/api/employees/:id', async (req, res) => {
  try {
    const updatedEmployee = await updateEmployeeRecord(req.params.id, req.body);
    if (!updatedEmployee) return res.status(404).json({ error: 'Employee not found' });

    res.status(200).json(updatedEmployee);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 5. DELETE (DELETE)
app.delete('/api/employees/:id', async (req, res) => {
  try {
    const deletedEmployee = await deleteEmployeeRecord(req.params.id);
    if (!deletedEmployee) return res.status(404).json({ error: 'Employee not found' });

    res.status(200).json({ message: 'Employee record deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    database: dbConnected ? 'mongo' : 'memory'
  });
});

connectToDatabase().catch(() => {});

const startServer = (port) => {
  const server = app.listen(port, () => {
    console.log(`📡 Server is actively listening on port ${port}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      const fallbackPort = port + 1;
      console.warn(`⚠ Port ${port} is busy. Trying ${fallbackPort} instead.`);
      startServer(fallbackPort);
    } else {
      throw error;
    }
  });
};

startServer(PORT);