import { Database } from 'sqlite3';
import express, { Request, Response } from 'express';
import path from 'path';
import bodyParser from 'body-parser';
import axios from 'axios';

const N8N_WEBHOOK_URL = "http://localhost:5678/webhook/14309cb8-d4ff-4ea3-bbcb-5e6e6e762497";

const app = express();
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

app.get('/api/getAllTask', (_: Request, res: Response) => {
  db.all('SELECT * FROM tasks', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

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

app.delete('/api/deleteTask', (req: Request, res: Response) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Missing task name' });
  db.run('DELETE FROM tasks WHERE name = ?', [name], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ deleted: this.changes > 0 });
  });
});

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
