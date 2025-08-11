import { Database } from 'sqlite3';
import express, { Request, Response } from 'express';
import path from 'path';
import bodyParser from 'body-parser';
import axios from 'axios';
/**
 * This code simulates a simple internal ERP system.
 * By integrating with the n8n service, the local database can seamlessly synchronize with Quire.
 */

const N8N_WEBHOOK_URL = "http://localhost:5678/webhook/14309cb8-d4ff-4ea3-bbcb-5e6e6e762497";

const app = express();

// Database setup: using SQLite for demonstration purposes
const dbPath = path.join(__dirname, 'tasks.db');
const db = new Database(dbPath);

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'pending'
  )`);
});

/**
 * API endpoint for the client (demo ERP page) to retrieve all tasks from the local database.
 */
app.get('/api/getAllTask', (_: Request, res: Response) => {
  db.all('SELECT * FROM tasks', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

/**
 * API endpoint for creating or updating a task, accessible by both the client and n8n.
 *
 * Request body:
 *   - name: string (required) — The name of the task.
 *   - status: string (optional) — The status of the task. Defaults to 'pending' if not provided.
 *   - triggerN8N: boolean (optional) — If true, triggers the n8n webhook after the operation.
 *
 * Functionality:
 *   - If a task with the specified name exists, its status will be updated.
 *   - If no such task exists, a new task will be created with the provided name and status.
 *   - If triggerN8N is true, a POST request containing the task information will be sent to the n8n webhook.
 *
 * Response:
 *   - { updated: true, id } if the task was updated
 *   - { inserted: true, id } if a new task was created
 *
 *
 * Client update flow:
 *   client [upsertTask] → {task: pending} → n8n updates Quire → Quire updated, sends event to n8n
 *   → n8n posts to [upsertTask] → task name exists, status updated → {task: to-do (Quire default status)}
 */
app.post('/api/upsertTask', async (req: Request, res: Response) => {
  const { name, status, triggerN8N } = req.body;
  if (!name) return res.status(400).json({ error: 'Missing task name' });
  db.get('SELECT id FROM tasks WHERE name = ?', [name], (err, row: { id?: number } | undefined) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row && typeof row.id !== 'undefined') {
      db.run('UPDATE tasks SET status = ? WHERE name = ?', [status || 'pending', name], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (triggerN8N) axios.post(N8N_WEBHOOK_URL, { id: row.id, name, status: status || 'pending' }).catch(() => {});
        res.json({ updated: true, id: row.id });
      });
    } else {
      db.run('INSERT INTO tasks (name, status) VALUES (?, ?)', [name, status || 'pending'], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (triggerN8N) axios.post(N8N_WEBHOOK_URL, { id: this.lastID, name, status: status || 'pending' }).catch(() => {});
        res.json({ inserted: true, id: this.lastID });
      });
    }
  });
});

/**
 * API endpoint for n8n to call when a Quire task is deleted.
 *
 * This will remove the corresponding task from the local database by name.
 */
app.delete('/api/deleteTask', (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Missing task name' });
  db.run('DELETE FROM tasks WHERE name = ?', [name], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes > 0 });
  });
});

/**
 * API endpoint for the client to clear all tasks from the local SQLite database.
 */
app.post('/api/clearDb', (_: Request, res: Response) => {
  db.run('DELETE FROM tasks', err => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
