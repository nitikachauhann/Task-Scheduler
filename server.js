const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// MySQL connection setup
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "Nisha@17",
  database: "task_scheduler"
});

db.connect(err => {
  if (err) throw err;
  console.log("✅ MySQL connected.");
});

// ------------------- DFS & Topo Sort Logic -------------------

function buildGraph(tasks) {
  const graph = {};
  const inDegree = {};
  const priorityRank = { High: 3, Medium: 2, Low: 1 };

  tasks.forEach(task => {
    graph[task.id] = [];
    inDegree[task.id] = 0;
  });

  for (let i = 0; i < tasks.length; i++) {
    for (let j = 0; j < tasks.length; j++) {
      if (i === j) continue;

      const A = tasks[i];
      const B = tasks[j];

      if (
        priorityRank[B.priority] > priorityRank[A.priority] &&
        B.estimated_time > A.estimated_time
      ) {
        // B depends on A
        graph[A.id].push(B.id);
        inDegree[B.id]++;
      }
    }
  }

  return { graph, inDegree };
}

function topologicalSort(graph, inDegree) {
  const stack = [];
  const order = [];

  for (const node in inDegree) {
    if (inDegree[node] === 0) {
      stack.push(parseInt(node));
    }
  }

  while (stack.length) {
    const node = stack.pop();
    order.push(node);
    for (const neighbor of graph[node]) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) {
        stack.push(neighbor);
      }
    }
  }

  return order;
}

// ------------------- Routes -------------------

// Add new task
app.post("/tasks", (req, res) => {
  const { name, estimated_time, status, priority } = req.body;
  const sql = `INSERT INTO tasks (name, estimated_time, status, priority) VALUES (?, ?, ?, ?)`;

  db.query(sql, [name, estimated_time, status, priority], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: "Task added successfully!", taskId: result.insertId });
  });
});

// Get all tasks with optional sorting
app.get("/tasks", (req, res) => {
  let baseQuery = `SELECT * FROM tasks`;
  const { sort } = req.query;

  if (sort === "priority") {
    baseQuery += ` ORDER BY FIELD(priority, 'High', 'Medium', 'Low')`;
  } else if (sort === "estimated_time") {
    baseQuery += ` ORDER BY estimated_time ASC`;
  } else {
    baseQuery += `
      ORDER BY FIELD(status, 'Begin', 'Working', 'Done'), 
               FIELD(priority, 'High', 'Medium', 'Low')
    `;
  }

  db.query(baseQuery, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Get DFS-sorted tasks
app.get("/tasks/sorted", (req, res) => {
  db.query("SELECT * FROM tasks", (err, tasks) => {
    if (err) return res.status(500).json({ error: err.message });

    const { graph, inDegree } = buildGraph(tasks);
    const sortedIds = topologicalSort(graph, inDegree);

    const idToTask = {};
    tasks.forEach(task => { idToTask[task.id] = task; });
    const sortedTasks = sortedIds.map(id => idToTask[id]);

    res.json(sortedTasks);
  });
});

// Mark a task as done
app.put("/tasks/:id/done", (req, res) => {
  const taskId = req.params.id;
  const sql = "UPDATE tasks SET status = 'Done' WHERE id = ?";
  db.query(sql, [taskId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Task marked as done!" });
  });
});

// Delete task
app.delete("/tasks/:id", (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM tasks WHERE id = ?";
  db.query(sql, [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Task deleted successfully." });
  });
});

// Start server
app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});
