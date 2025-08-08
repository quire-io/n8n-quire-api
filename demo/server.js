"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var sqlite3_1 = require("sqlite3");
var express_1 = require("express");
var path_1 = require("path");
var body_parser_1 = require("body-parser");
var axios_1 = require("axios");
var N8N_WEBHOOK_URL = "http://localhost:5678/webhook/14309cb8-d4ff-4ea3-bbcb-5e6e6e762497";
var app = (0, express_1.default)();
var dbPath = path_1.default.join(__dirname, 'tasks.db');
var db = new sqlite3_1.Database(dbPath);
app.use(body_parser_1.default.json());
app.use(express_1.default.static(path_1.default.join(__dirname, 'public')));
db.serialize(function () {
    db.run("CREATE TABLE IF NOT EXISTS tasks (\n    id INTEGER PRIMARY KEY AUTOINCREMENT,\n    name TEXT NOT NULL,\n    status TEXT DEFAULT 'pending'\n  )");
});
app.get('/api/getAllTask', function (_, res) {
    db.all('SELECT * FROM tasks', function (err, rows) {
        if (err)
            return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});
app.post('/api/upsertTask', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, name, status, triggerN8N;
    return __generator(this, function (_b) {
        _a = req.body, name = _a.name, status = _a.status, triggerN8N = _a.triggerN8N;
        if (!name)
            return [2 /*return*/, res.status(400).json({ error: 'Missing task name' })];
        db.get('SELECT id FROM tasks WHERE name = ?', [name], function (err, row) {
            if (err)
                return res.status(500).json({ error: err.message });
            if (row && typeof row.id !== 'undefined') {
                db.run('UPDATE tasks SET status = ? WHERE name = ?', [status || 'pending', name], function (err) {
                    if (err)
                        return res.status(500).json({ error: err.message });
                    if (triggerN8N)
                        axios_1.default.post(N8N_WEBHOOK_URL, { id: row.id, name: name, status: status || 'pending' }).catch(function () { });
                    res.json({ updated: true, id: row.id });
                });
            }
            else {
                db.run('INSERT INTO tasks (name, status) VALUES (?, ?)', [name, status || 'pending'], function (err) {
                    if (err)
                        return res.status(500).json({ error: err.message });
                    if (triggerN8N)
                        axios_1.default.post(N8N_WEBHOOK_URL, { id: this.lastID, name: name, status: status || 'pending' }).catch(function () { });
                    res.json({ inserted: true, id: this.lastID });
                });
            }
        });
        return [2 /*return*/];
    });
}); });
app.delete('/api/deleteTask', function (req, res) {
    var name = req.body.name;
    if (!name)
        return res.status(400).json({ error: 'Missing task name' });
    db.run('DELETE FROM tasks WHERE name = ?', [name], function (err) {
        if (err)
            return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes > 0 });
    });
});
app.post('/api/clearDb', function (_, res) {
    db.run('DELETE FROM tasks', function (err) {
        if (err)
            return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});
var PORT = process.env.PORT || 3000;
app.listen(PORT, function () {
    console.log("Server running at http://localhost:".concat(PORT));
});
