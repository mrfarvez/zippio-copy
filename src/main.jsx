import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { api } from "./services/api";
import "./styles.css";

const dimensions = [
  ["Productivity", 30],
  ["Quality", 25],
  ["Efficiency", 20],
  ["Reliability", 15],
  ["Consistency", 10],
];
const levels = [[0, "Starter"], [100, "Contributor"], [250, "Performer"], [500, "Advanced"], [800, "Expert"], [1200, "Elite"]];
const departmentManagers = {
  Development: "Nadia Karim",
  Engineering: "Ayesha Rahman",
  Design: "Sadia Ahmed",
  Marketing: "Tanvir Hasan",
  Accounts: "Moin Uddin",
};

function Icon({ name }) {
  const paths = {
    grid: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
    tasks: "M5 5h14M5 12h14M5 19h8",
    chart: "M4 19V5m0 14h16M8 16v-3m4 3V8m4 8v-6",
    users: "M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6-7a4 4 0 0 1 0 7.7M21 20v-1a4 4 0 0 0-3-3.9",
    clock: "M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    plus: "M12 5v14M5 12h14",
    bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4",
    logout: "M10 17l5-5-5-5m5 5H3m11-8V3h7v18h-7v-1",
    arrow: "M5 12h14m-6-6 6 6-6 6",
    check: "m5 12 4 4L19 6",
    menu: "M4 6h16M4 12h16M4 18h16",
    calendar: "M5 4v3m14-3v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z",
  };
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}

function formatTime(value) {
  return value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
}

function todayKey() {
  return new Date().toLocaleDateString("en-CA");
}

function formatDate(value = todayKey()) {
  return new Date(`${value}T00:00:00`).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric", year: "numeric" });
}

function levelFor(points) {
  let index = 0;
  levels.forEach((level, i) => { if (points >= level[0]) index = i; });
  return { index, title: levels[index][1], next: levels[index + 1] };
}

function kpiFor(employee) {
  return dimensions.reduce((total, [, weight], index) => total + employee.scores[index] * weight / 100, 0);
}

function Badge({ children, tone = "neutral" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function Button({ children, variant = "primary", icon, ...props }) {
  return <button className={`button button-${variant}`} {...props}>{icon && <Icon name={icon} />}{children}</button>;
}

function StatCard({ label, value, note, icon, tone = "blue" }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon name={icon} /></div><div><div className="eyebrow">{label}</div><div className="stat-value">{value}</div>{note && <div className="stat-note">{note}</div>}</div></div>;
}

function ProgressBar({ value, color = "blue" }) {
  return <div className="progress"><span className={`progress-${color}`} style={{ width: `${Math.min(value, 100)}%` }} /></div>;
}

function Login({ onLogin }) {
  const [role, setRole] = useState("manager");
  const [employee, setEmployee] = useState("e1");
  return <main className="auth-page"><section className="auth-visual"><div className="brand brand-light"><span className="brand-mark">Z</span>Zippio</div><div className="visual-copy"><Badge tone="light">CORPORATE HR & WORKFORCE PLATFORM</Badge><h1>Make people, work, and <em>growth</em> visible.</h1><p>One calm workspace to align work, manage requests, and help every team member grow.</p></div><div className="visual-footer"><span>Trusted by high-performing teams</span><span>● 99.9% uptime</span><span>● Secure by design</span></div></section><section className="auth-form"><div className="auth-form-inner"><div className="brand"><span className="brand-mark">Z</span>Zippio <span className="version">2.0</span></div><div className="auth-heading"><h2>Welcome back</h2><p>Sign in to continue to your workspace.</p></div><div className="role-switch role-switch-three"><button className={role === "manager" ? "active" : ""} onClick={() => setRole("manager")}>Manager</button><button className={role === "employee" ? "active" : ""} onClick={() => setRole("employee")}>Employee</button><button className={role === "hr" ? "active" : ""} onClick={() => setRole("hr")}>HR</button></div>{role === "employee" ? <label className="field">Choose employee<select value={employee} onChange={(e) => setEmployee(e.target.value)}><option value="e1">Rahim Uddin</option><option value="e2">Nusrat Jahan</option><option value="e3">Imran Hossain</option></select></label> : <label className="field">Work email<input type="email" placeholder={role === "hr" ? "hr@company.com" : "manager@company.com"} defaultValue={role === "hr" ? "hr@zippio.com" : "manager@zippio.com"} /></label>}<label className="field">Password<input type="password" placeholder="••••••••" defaultValue="password" /></label><div className="form-row"><label className="check"><input type="checkbox" defaultChecked /> Remember me</label><a href="#forgot">Forgot password?</a></div><Button onClick={() => onLogin(role, role === "employee" ? employee : null)}><span>Sign in</span><Icon name="arrow" /></Button><p className="auth-hint">Demo mode is active. API authentication can be connected in <code>src/services/api.js</code>.</p></div></section></main>;
}

function Sidebar({ role, page, setPage, onLogout, open, setOpen }) {
  const employeeItems = [["dashboard", "Overview", "grid"], ["tasks", "My tasks", "tasks"], ["performance", "Performance", "chart"], ["attendance", "Attendance", "clock"], ["leave", "Apply leave", "calendar"]];
  const managerItems = [["dashboard", "Overview", "grid"], ["tasks", "All tasks", "tasks"], ["employees", "Employees", "users"], ["reviews", "Review queue", "check"], ["reports", "Reports", "chart"]];
  const hrItems = [["dashboard", "Command center", "grid"], ["requests", "HR requests", "tasks"], ["employees", "Employees", "users"], ["analytics", "Analytics & reports", "chart"], ["support", "Helpdesk & support", "bell"]];
  const items = role === "employee" ? employeeItems : role === "hr" ? hrItems : managerItems;
  const isHr = role === "hr";
  return <aside className={`sidebar ${open ? "sidebar-open" : ""}`}><div className="sidebar-top"><div className="brand"><span className="brand-mark">Z</span>Zippio <span className="version">2.0</span></div><button className="mobile-close" onClick={() => setOpen(false)}>×</button></div><div className="workspace"><span className="workspace-avatar">{role === "manager" ? "M" : isHr ? "HR" : "R"}</span><div><strong>{role === "manager" ? "Acme workspace" : isHr ? "Acme HR workspace" : "Rahim Uddin"}</strong><small>{role === "manager" ? "Manager workspace" : isHr ? "Human resources" : "Product designer"}</small></div><span className="chevron">⌄</span></div>{isHr && <div className="sidebar-label">HR OPERATIONS</div>}<nav>{items.map(([id, label, icon]) => <button key={id} className={page === id ? "nav-item active" : "nav-item"} onClick={() => { setPage(id); setOpen(false); }}><Icon name={icon} /><span>{label}</span>{id === "reviews" && <Badge tone="red">3</Badge>}{id === "requests" && <Badge tone="red">5</Badge>}</button>)}</nav>{isHr && <><div className="sidebar-label sidebar-section-label">EMPLOYEE SUPPORT</div><button className={`nav-item ${page === "leave" ? "active" : ""}`} onClick={() => { setPage("leave"); setOpen(false); }}><Icon name="check" /><span>Leave & attendance</span></button><button className="nav-item" onClick={() => { setPage("support"); setOpen(false); }}><Icon name="tasks" /><span>Document requests</span></button></>}<div className="sidebar-bottom"><div className="help-card"><div className="help-icon">?</div><div><strong>Need a hand?</strong><small>Visit our help center</small></div></div><button className="nav-item" onClick={onLogout}><Icon name="logout" /><span>Sign out</span></button><div className="profile-row"><span className="avatar">{isHr ? "HR" : "MR"}</span><div><strong>{isHr ? "Ayesha Rahman" : "Md. Rahman"}</strong><small>{isHr ? "HR manager" : "Administrator"}</small></div><span className="dots">•••</span></div></div></aside>;
}

function Header({ title, subtitle, onMenu, onCreate, createLabel = "Create task", notifications = 0 }) {
  return <header className="topbar"><button className="mobile-menu" onClick={() => window.dispatchEvent(new Event("zippio:toggle-menu"))}><Icon name="menu" /></button><div><h1>{title}</h1><p>{subtitle}</p></div><div className="top-actions"><button className="icon-button notification"><Icon name="bell" />{notifications > 0 && <span>{notifications}</span>}</button>{onCreate && <Button icon="plus" onClick={onCreate}>{createLabel}</Button>}</div></header>;
}

function TaskCard({ task, employeeName, onStart, onSubmit, onOpen }) {
  const status = task.status === "todo" ? ["To do", "blue"] : task.status === "progress" ? ["In progress", "orange"] : task.status === "review" ? ["Pending review", "purple"] : task.status === "handoff" ? ["Owner review", "purple"] : ["Approved", "green"];
  return <article className="task-card task-card-clickable" onClick={() => onOpen?.(task)}><div className="task-top"><span className="task-id">{task.id}</span><Badge tone={task.priority === "Critical" || task.priority === "High" ? "red" : "neutral"}>{task.priority}</Badge></div><h3>{task.title}</h3>{employeeName && <p className="task-owner">{employeeName}</p>}<div className="task-meta"><span><Icon name="clock" />{task.hours}h estimate</span><span className="task-points">+{task.points} pts</span></div>{task.attachmentName && <div className="task-attachment">📎 {task.attachmentName}</div>}{task.githubRepo && <div className="task-attachment">⌘ {task.githubRepo}</div>}<div className="task-footer"><span className="task-due">Due {task.deadline}</span><Badge tone={status[1]}>{status[0]}</Badge></div></article>;
}

function DelegationRequestCard({ request, employees, onApprove, onReject }) {
  const [points, setPoints] = useState("");
  const parentPoints = request.parentPoints || 1;
  const target = employees.find((employee) => employee.id === request.toEmployeeId);
  const requester = employees.find((employee) => employee.id === request.fromEmployeeId);
  return <article className="task-card delegation-task-card"><div className="task-top"><span className="task-id">{request.id}</span><Badge tone="orange">Review needed</Badge></div><h3>{request.title}</h3><p className="task-owner">{requester?.name || "Employee"} → {target?.name || "Teammate"}</p><p className="delegation-task-details">{request.details}</p><div className="delegation-task-parent">Parent task: {request.parentTaskId} · Parent KPI +{parentPoints} pts</div><label className="field delegation-task-kpi">Manager KPI points<input type="number" min="1" max={parentPoints} value={points} onChange={(event) => setPoints(event.target.value)} placeholder={`1–${parentPoints}`} /></label><div className="delegation-task-actions"><Button variant="secondary" onClick={() => onReject(request.id)}>Reject</Button><Button disabled={!points || Number(points) < 1 || Number(points) > parentPoints} onClick={() => onApprove(request.id, Number(points))}>Approve</Button></div></article>;
}

function AttachmentPicker({ file, onChange }) {
  const size = file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "";
  return <label className={`upload-box ${file ? "upload-box-selected" : ""}`}><span className="upload-icon">{file ? "✓" : "↑"}</span><strong>{file ? file.name : "Choose a file to attach"}</strong><small>{file ? `${size} · Ready to upload` : "Drag & drop or browse · PDF, DOC, XLS, PNG, JPG or ZIP · Max 10 MB"}</small><input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip" onChange={(event) => onChange(event.target.files?.[0] || null)} /></label>;
}

function TaskDetails({ task, employeeName, currentEmployeeId, onClose, onUpload, onStart, onDelegate, onHandoffReview }) {
  const [file, setFile] = useState(null);
  const [githubRepo, setGithubRepo] = useState(task.githubRepo || "");
  const status = task.status === "todo" ? ["To do", "blue"] : task.status === "progress" ? ["In progress", "orange"] : task.status === "review" ? ["Pending review", "purple"] : task.status === "handoff" ? ["Owner review", "purple"] : ["Approved", "green"];
  const submitForReview = () => { onUpload(task.id, file, githubRepo); onClose(); };
  const isOwnerReviewer = task.status === "handoff" && task.reviewerId === currentEmployeeId;
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="task-details-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><div><div className="task-detail-id">{task.id}</div><h2>{task.title}</h2><p>{employeeName ? `Assigned to ${employeeName}` : "Your assigned task"}</p></div><button className="close-button" onClick={onClose}>×</button></div><div className="task-detail-badges"><Badge tone={status[1]}>{status[0]}</Badge><Badge tone={task.priority === "Critical" || task.priority === "High" ? "red" : "neutral"}>{task.priority} priority</Badge>{task.parentTaskId && <Badge tone="purple">Subtask</Badge>}</div><div className="task-detail-grid"><div><span className="eyebrow">Deadline</span><strong>{task.deadline}</strong></div><div><span className="eyebrow">Estimated time</span><strong>{task.hours} hours</strong></div><div><span className="eyebrow">KPI points</span><strong className="positive">+{task.points} pts</strong></div></div><div className="task-detail-section"><h3>Task description</h3><p>{task.note || "Complete the assigned work according to the agreed requirements and submit it for review before the deadline."}</p></div><div className="task-detail-section"><h3>Submission attachments <span className="optional-label">Optional</span></h3>{task.attachmentName && <div className="existing-attachment">📎 <span>{task.attachmentName}</span><small>Attached to task</small></div>}<AttachmentPicker file={file} onChange={setFile} /><label className="field repo-field">GitHub repository <span className="optional-label">Optional</span><input type="url" value={githubRepo} onChange={(event) => setGithubRepo(event.target.value)} placeholder="https://github.com/owner/repository" /></label></div><div className="task-detail-section"><h3>Work logs</h3>{task.startedAt ? <div className="work-started"><span className="work-started-dot" />Work started at {formatTime(task.startedAt)}</div> : <div className="detail-empty">No work has been started yet.</div>}</div>{isOwnerReviewer ? <div className="task-detail-actions"><Button variant="secondary" onClick={() => onHandoffReview(task.id, false)}>Request revision</Button><Button onClick={() => onHandoffReview(task.id, true)}>Accept subtask</Button></div> : task.status !== "review" && task.status !== "approved" && <div className="task-detail-actions">{task.status === "progress" && !task.parentTaskId && <Button variant="secondary" icon="users" onClick={() => onDelegate(task)}>Delegate task</Button>}{task.status === "todo" && <Button variant="green" icon="clock" onClick={() => onStart(task.id)}>Start work</Button>}<Button onClick={submitForReview}>Submit for review</Button></div>}</section></div>;
}

function DelegationModal({ task, employees, currentEmployeeId, onClose, onSubmit }) {
  const teammates = employees.filter((employee) => employee.id !== currentEmployeeId);
  const [form, setForm] = useState({ employeeId: teammates[0]?.id || "", title: `${task.title} — delegated work`, details: "" });
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = (event) => { event.preventDefault(); if (!form.details.trim() || !form.employeeId) return; onSubmit({ ...form, details: form.details.trim() }); };
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal delegation-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><div><Badge tone="purple">Task delegation</Badge><h2>Delegate part of this task</h2><p>Send a request to a teammate. A manager will set the KPI points during approval.</p></div><button className="close-button" onClick={onClose}>×</button></div><div className="delegation-parent"><strong>{task.id} · {task.title}</strong><span>Parent KPI: +{task.points} pts · Delegated KPI will be set by the manager</span></div><form onSubmit={submit}><div className="form-grid"><label className="field full">Assign to teammate<select value={form.employeeId} onChange={update("employeeId")}>{teammates.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.department}</option>)}</select></label><label className="field full">Subtask title<input required value={form.title} onChange={update("title")} /></label><label className="field full">Work to delegate<textarea required value={form.details} onChange={update("details")} placeholder="Explain the exact part, expected output, and handoff requirements" /></label></div><div className="modal-footer"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" icon="arrow">Send delegation request</Button></div></form></section></div>;
}

function EmployeeDashboard({ employee, tasks, onStart, onSubmit, onOpen, setPage, attendance, onCheckIn, onCheckOut }) {
  const points = employee.points, level = levelFor(points), kpi = kpiFor(employee), mine = tasks.filter((task) => task.employeeId === employee.id);
  const isToday = attendance.date === todayKey(), active = isToday && attendance.checkIn && !attendance.checkOut, completed = isToday && attendance.checkIn && attendance.checkOut;
  return <><Header title={`Good morning, ${employee.name.split(" ")[0]} 👋`} subtitle="Here's what's happening with your work today." onMenu={() => {}} notifications={2} /><section className="welcome-strip"><div className="attendance-day"><strong>{formatDate()}</strong><div className="attendance-status"><Badge tone={active || completed ? "green" : "neutral"}>{active ? "● Checked in" : completed ? "● Day complete" : "● Not checked in"}</Badge>{attendance.checkIn && isToday && <span>Since {formatTime(attendance.checkIn)}</span>}</div></div><div className="attendance-actions">{active ? <Button variant="secondary" onClick={onCheckOut}>Check out</Button> : <Button variant={completed ? "danger" : "primary"} onClick={onCheckIn} disabled={completed}>{completed ? "Checked out" : "Check in"}</Button>}</div></section><div className="stats-grid"><StatCard label="To do" value={mine.filter((t) => t.status === "todo").length} note="2 due this week" icon="tasks" /><StatCard label="In progress" value={mine.filter((t) => t.status === "progress").length} note="Keep it up!" icon="chart" tone="orange" /><StatCard label="KPI score" value={kpi.toFixed(1)} note="+4.2 this month" icon="chart" tone="purple" /><StatCard label="Growth points" value={points} note={`Level ${level.index + 1} · ${level.title}`} icon="users" tone="green" /></div><div className="content-grid"><section className="panel"><div className="panel-header"><div><h2>Your tasks</h2><p>Stay on top of your assigned work.</p></div><button className="link-button" onClick={() => setPage("tasks")}>View all <Icon name="arrow" /></button></div><div className="task-list">{mine.filter((t) => t.status !== "approved").slice(0, 3).map((task) => <TaskCard key={task.id} task={task} onOpen={onOpen} onStart={onStart} onSubmit={onSubmit} />)}</div></section><section className="panel growth-panel"><div className="panel-header"><div><h2>Your growth</h2><p>W2G performance overview.</p></div><button className="link-button" onClick={() => setPage("performance")}>Details <Icon name="arrow" /></button></div><div className="growth-score"><div className="score-ring"><strong>{kpi.toFixed(0)}</strong><small>/ 100</small></div><div><strong>Great progress!</strong><p>Your score is above the team average of 81.4.</p></div></div><div className="metric-list">{dimensions.map(([name, weight], i) => <div className="metric" key={name}><div><span>{name}</span><b>{employee.scores[i]}</b></div><ProgressBar value={employee.scores[i]} color={i === 1 ? "purple" : "blue"} /><small>Weight {weight}%</small></div>)}</div></section></div></>;
}

function TasksPage({ tasks, employees, role, employee, delegationRequests = [], onDelegation, onStart, onSubmit, onCreate, onOpen }) {
  const [query, setQuery] = useState("");
  const filtered = tasks.filter((task) => (role === "employee" ? task.employeeId === employee.id || (task.status === "handoff" && task.reviewerId === employee.id) : true) && `${task.title} ${task.id}`.toLowerCase().includes(query.toLowerCase()));
  const columns = role === "manager" ? [["todo", "To do"], ["delegation", "Delegation requests"], ["review", "Pending review"]] : [["todo", "To do"], ["progress", "In progress"], ["review", "Submitted"]];
  const pendingDelegations = delegationRequests.filter((request) => request.status === "pending");
  return <><Header title={role === "employee" ? "My tasks" : "All tasks"} subtitle={role === "employee" ? "Manage your work and keep moving forward." : "Monitor work and review employee delegation requests."} onMenu={() => {}} onCreate={role === "manager" ? onCreate : null} notifications={role === "manager" ? 3 + pendingDelegations.length : 2} /><div className="toolbar"><div className="search"><span>⌕</span><input placeholder="Search tasks..." value={query} onChange={(e) => setQuery(e.target.value)} /></div><select><option>All priorities</option><option>Critical</option><option>High</option><option>Medium</option></select><button className="filter-button">☷ Filters</button></div><div className="kanban">{columns.map(([status, title]) => <section className="kanban-column" key={status}><div className="column-heading"><h2>{title}</h2><span>{status === "delegation" ? pendingDelegations.length : filtered.filter((t) => t.status === status).length}</span></div>{status === "delegation" ? pendingDelegations.map((request) => <DelegationRequestCard key={request.id} request={request} employees={employees} onApprove={onDelegation ? (id, points) => onDelegation(id, true, points) : () => {}} onReject={onDelegation ? (id) => onDelegation(id, false) : () => {}} />) : filtered.filter((t) => t.status === status).map((task) => <TaskCard key={task.id} task={task} onOpen={onOpen} employeeName={role === "manager" ? employees.find((e) => e.id === task.employeeId)?.name : null} onStart={role === "employee" ? onStart : null} onSubmit={role === "employee" ? onSubmit : null} />)}{status !== "delegation" && !filtered.some((t) => t.status === status) && <div className="empty-column">No tasks here</div>}{status === "delegation" && !pendingDelegations.length && <div className="empty-column">No delegation requests</div>}</section>)}</div></>;
}

function PerformancePage({ employee }) {
  const level = levelFor(employee.points), next = level.next, progress = next ? ((employee.points - levels[level.index][0]) / (next[0] - levels[level.index][0])) * 100 : 100;
  return <><Header title="My performance" subtitle="See how your work is building your professional growth." onMenu={() => {}} notifications={2} /><div className="stats-grid"><StatCard label="KPI score" value={kpiFor(employee).toFixed(1)} note="+4.2 from last month" icon="chart" tone="purple" /><StatCard label="Growth points" value={employee.points} note="+45 this month" icon="users" tone="green" /><StatCard label="Current level" value={`L${level.index + 1}`} note={level.title} icon="check" /><StatCard label="Rank in team" value="#2" note="Top 20% of team" icon="chart" tone="orange" /></div><div className="performance-grid"><section className="panel"><div className="panel-header"><div><h2>W2G score breakdown</h2><p>Weighted across five performance dimensions.</p></div><Badge tone="green">Excellent</Badge></div>{dimensions.map(([name, weight], i) => <div className="score-row" key={name}><div className="score-label"><span>{name}</span><small>{weight}% weight</small><b>{employee.scores[i]}</b></div><ProgressBar value={employee.scores[i]} color={i === 1 ? "purple" : "blue"} /></div>)}</section><section className="panel level-panel"><div className="panel-header"><div><h2>Growth level</h2><p>Keep earning points to level up.</p></div><span className="level-badge">L{level.index + 1}</span></div><div className="level-title">{level.title}</div><p className="muted">{employee.points} points <span>•</span> {next ? `${next[0] - employee.points} points to ${next[1]}` : "Highest level reached"}</p><ProgressBar value={progress} color="green" /><div className="level-markers"><span>L{level.index + 1}<small>{levels[level.index][0]}</small></span>{next && <span>L{level.index + 2}<small>{next[0]}</small></span>}</div></section></div><section className="panel activity-panel"><div className="panel-header"><div><h2>Recent point activity</h2><p>Every transaction is recorded in your growth ledger.</p></div><button className="link-button">View full history <Icon name="arrow" /></button></div>{employee.activity.map((item) => <div className="activity-row" key={item.id}><span className="activity-icon"><Icon name="check" /></span><div><strong>{item.title}</strong><small>{item.reason} · {item.date}</small></div><b className={item.value > 0 ? "positive" : "negative"}>{item.value > 0 ? "+" : ""}{item.value}</b></div>)}</section></>;
}

function HrAnalyticsPage({ employees }) {
  const [department, setDepartment] = useState("All departments");
  const departments = ["All departments", ...new Set(employees.map((employee) => employee.department))];
  const visibleEmployees = employees.filter((employee) => department === "All departments" || employee.department === department).sort((a, b) => kpiFor(b) - kpiFor(a));
  const averageKpi = visibleEmployees.reduce((sum, employee) => sum + kpiFor(employee), 0) / (visibleEmployees.length || 1);
  const departmentStats = [...new Set(employees.map((employee) => employee.department))].map((name) => {
    const members = employees.filter((employee) => employee.department === name);
    return { name, count: members.length, score: members.reduce((sum, employee) => sum + kpiFor(employee), 0) / members.length };
  }).sort((a, b) => b.score - a.score);
  return <><Header title="Analytics & reports" subtitle="Compare performance across every department and employee." onMenu={() => {}} notifications={3} /><div className="analytics-toolbar"><div><Badge tone="blue">ALL DEPARTMENTS</Badge><p>Organization-wide performance snapshot</p></div><select value={department} onChange={(event) => setDepartment(event.target.value)}>{departments.map((name) => <option key={name}>{name}</option>)}</select></div><div className="stats-grid"><StatCard label="Employees tracked" value={visibleEmployees.length} note="Across all active teams" icon="users" /><StatCard label="Average KPI score" value={averageKpi.toFixed(1)} note="+3.8 this month" icon="chart" tone="purple" /><StatCard label="Top performer" value={visibleEmployees[0]?.name.split(" ")[0] || "—"} note={visibleEmployees[0] ? `${kpiFor(visibleEmployees[0]).toFixed(1)} KPI score` : "No employees"} icon="check" tone="green" /><StatCard label="Departments" value={department === "All departments" ? departmentStats.length : 1} note="Performance groups" icon="grid" /></div><section className="panel department-performance"><div className="panel-header"><div><h2>Department performance</h2><p>Average KPI score and employee distribution by department.</p></div><Badge tone="purple">KPI overview</Badge></div><div className="department-performance-grid">{departmentStats.map((item) => <button className={`department-performance-card ${department === item.name ? "selected" : ""}`} key={item.name} onClick={() => setDepartment(item.name)}><div className="department-card-top"><strong>{item.name}</strong><span>{item.count} employee{item.count > 1 ? "s" : ""}</span></div><div className="department-kpi">{item.score.toFixed(1)}<small>/ 100</small></div><ProgressBar value={item.score} color={item.score >= 85 ? "green" : "purple"} /><div className="department-card-footer"><span>{item.score >= 85 ? "High performing" : "Needs focus"}</span><Icon name="arrow" /></div></button>)}</div></section><section className="panel employee-performance"><div className="panel-header"><div><h2>Employee performance</h2><p>Individual KPI score and W2G dimensions for {department}.</p></div><button className="link-button">Export report <Icon name="arrow" /></button></div><div className="table-wrap"><table><thead><tr><th>Employee</th><th>Department</th><th>KPI score</th><th>Productivity</th><th>Quality</th><th>Efficiency</th><th>Reliability</th><th>Level</th></tr></thead><tbody>{visibleEmployees.map((employee, index) => <tr key={employee.id}><td><div className="table-person"><span className="avatar">{employee.initials}</span><div><strong>{index + 1}. {employee.name}</strong><small>{employee.title}</small></div></div></td><td>{employee.department}</td><td><strong className="kpi-number">{kpiFor(employee).toFixed(1)}</strong></td>{employee.scores.slice(0, 4).map((score, scoreIndex) => <td key={`${employee.id}-${scoreIndex}`}><div className="score-cell"><span>{score}</span><ProgressBar value={score} color={score >= 85 ? "green" : score >= 75 ? "purple" : "blue"} /></div></td>)}<td><Badge tone="purple">{levelFor(employee.points).title}</Badge></td></tr>)}</tbody></table></div></section></>;
}

function AttendancePage({ employee, attendance, onCheckIn, onCheckOut }) {
  const isToday = attendance.date === todayKey(), active = isToday && attendance.checkIn && !attendance.checkOut, completed = isToday && attendance.checkIn && attendance.checkOut;
  return <><Header title="Attendance" subtitle="Track your working sessions and attendance history." onMenu={() => {}} notifications={2} /><div className="attendance-hero"><div><div className="attendance-day"><strong>{formatDate()}</strong><Badge tone={active || completed ? "green" : "neutral"}>{active ? "● Checked in" : completed ? "● Day complete" : "● Not checked in"}</Badge></div><h2>{active ? "You're having a productive day." : completed ? "Your session has ended." : "Start your work session."}</h2><p>{active ? "Remember to check out when you finish work." : completed ? "You cannot check in again on the same day." : "Check in when you start work."}</p></div><div className="attendance-actions">{active ? <Button variant="secondary" onClick={onCheckOut}>Check out</Button> : <Button variant={completed ? "danger" : "primary"} onClick={onCheckIn} disabled={completed}>{completed ? "Checked out" : "Check in"}</Button>}</div></div><div className="stats-grid"><StatCard label="Check in" value={isToday ? formatTime(attendance.checkIn) : "—"} note="Today's session" icon="clock" tone="green" /><StatCard label="Check out" value={isToday ? formatTime(attendance.checkOut) : "—"} note={active ? "Still working" : completed ? "Session complete" : "Not started"} icon="clock" /><StatCard label="This week" value="4 / 5 days" note="80% attendance" icon="check" tone="purple" /></div><section className="panel"><div className="panel-header"><div><h2>Attendance history</h2><p>Your recent check-in and check-out records.</p></div><select><option>Last 30 days</option><option>This month</option></select></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Check in</th><th>Check out</th><th>Duration</th><th>Status</th></tr></thead><tbody>{employee.attendance.map((row) => <tr key={row.date}><td><strong>{row.date}</strong></td><td>{row.in}</td><td>{row.out || "Active"}</td><td>{row.duration}</td><td><Badge tone={row.status === "Present" ? "green" : "orange"}>{row.status}</Badge></td></tr>)}</tbody></table></div></section></>;
}

function LeavePage({ employee, isHr = false }) {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ type: "Casual leave", from: "2026-11-16", to: "2026-11-16", reason: "" });
  const update = (key) => (event) => setForm({ ...form, [key]: event.target.value });
  const leaveRows = isHr ? [{ name: "Rahim Uddin", type: "Casual leave", dates: "Nov 16, 2026", status: "Pending" }, { name: "Nusrat Jahan", type: "Annual leave", dates: "Nov 12–14, 2026", status: "Approved" }, { name: "Imran Hossain", type: "Sick leave", dates: "Nov 05, 2026", status: "Approved" }] : [{ name: employee.name, type: "Annual leave", dates: "Oct 21–22, 2026", status: "Approved" }, { name: employee.name, type: "Casual leave", dates: "Sep 08, 2026", status: "Approved" }];
  const submit = (event) => { event.preventDefault(); if (form.reason.trim()) setSubmitted(true); };
  return <><Header title={isHr ? "Leave & attendance" : "Apply leave"} subtitle={isHr ? "Monitor attendance and manage leave requests across the organization." : "Request time off and track your leave history."} onMenu={() => {}} onCreate={!isHr ? undefined : () => {}} notifications={isHr ? 4 : 2} /><div className="stats-grid"><StatCard label={isHr ? "Present today" : "Available leave"} value={isHr ? "116 / 128" : "14 days"} note={isHr ? "90.6% attendance" : "Annual leave balance"} icon="check" tone="green" /><StatCard label={isHr ? "On leave today" : "Used this year"} value={isHr ? "8" : "6 days"} note={isHr ? "Across 5 departments" : "From 20 allocated days"} icon="calendar" tone="purple" /><StatCard label={isHr ? "Pending approvals" : "Pending requests"} value={isHr ? "4" : "1"} note="Needs attention" icon="clock" tone="orange" /></div>{!isHr && <section className="panel leave-form-panel"><div className="panel-header"><div><h2>New leave request</h2><p>Tell your manager when and why you need time off.</p></div><Badge tone="green">14 days available</Badge></div>{submitted && <div className="success-message">✓ Leave request submitted successfully. Your manager will review it shortly.</div>}<form className="leave-form" onSubmit={submit}><label className="field">Leave type<select value={form.type} onChange={update("type")}><option>Casual leave</option><option>Annual leave</option><option>Sick leave</option><option>Emergency leave</option></select></label><label className="field">Start date<input type="date" value={form.from} onChange={update("from")} /></label><label className="field">End date<input type="date" value={form.to} onChange={update("to")} /></label><label className="field full">Reason<textarea value={form.reason} onChange={update("reason")} placeholder="Add a short reason for your leave request" required /></label><div className="form-submit full"><Button type="submit" icon="arrow">Submit leave request</Button></div></form></section>}<section className="panel"><div className="panel-header"><div><h2>{isHr ? "Leave requests" : "My leave history"}</h2><p>{isHr ? "Review employee leave and attendance exceptions." : "Your previous and pending leave requests."}</p></div>{isHr && <select><option>All departments</option><option>Engineering</option><option>Design</option></select>}</div><div className="table-wrap"><table><thead><tr>{isHr && <th>Employee</th>}<th>Leave type</th><th>Date</th><th>Status</th></tr></thead><tbody>{leaveRows.map((row, index) => <tr key={`${row.name}-${index}`}>{isHr && <td><div className="table-person"><span className="avatar">{row.name.split(" ").map((part) => part[0]).join("")}</span><strong>{row.name}</strong></div></td>}<td>{row.type}</td><td>{row.dates}</td><td><Badge tone={row.status === "Approved" ? "green" : "orange"}>{row.status}</Badge></td></tr>)}</tbody></table></div></section>{isHr && <section className="panel attendance-overview-panel"><div className="panel-header"><div><h2>Today's attendance</h2><p>Organization-wide attendance snapshot.</p></div><button className="link-button">View full report <Icon name="arrow" /></button></div><div className="attendance-overview"><div><strong>90.6%</strong><span>Attendance rate</span></div><div><strong>116</strong><span>Present</span></div><div><strong>8</strong><span>On leave</span></div><div><strong>4</strong><span>Incomplete</span></div></div></section>}</>;
}

function ManagerDashboard({ tasks, employees, setPage, onCreate, attendance }) {
  const pending = tasks.filter((t) => t.status === "review");
  return <><Header title="Good morning, Md. Rahman 👋" subtitle="Here's your team's pulse for today." onMenu={() => {}} onCreate={onCreate} notifications={pending.length} /><section className="manager-hero"><div><Badge tone="light">TEAM OVERVIEW</Badge><h2>Make progress visible.</h2><p>Track work, coach your team, and turn performance into growth.</p></div><div className="hero-orb">↗</div></section><div className="stats-grid manager-stats"><StatCard label="Total employees" value={employees.length} note="+2 this month" icon="users" /><StatCard label="Present today" value="12 / 15" note="80% attendance" icon="check" tone="green" /><StatCard label="Active tasks" value={tasks.filter((t) => t.status === "progress").length} note="Across all teams" icon="tasks" tone="orange" /><StatCard label="Pending reviews" value={pending.length} note="Needs your attention" icon="clock" tone="purple" /></div><section className="panel live-attendance-panel"><div className="panel-header"><div><h2>Live attendance</h2><p>Check-in and check-out activity from your team.</p></div><Badge tone="green">Live</Badge></div><div className="live-attendance-row"><span className="avatar">RU</span><div><strong>Rahim Uddin</strong><small>{attendance.checkIn ? `Checked in at ${formatTime(attendance.checkIn)}` : "Not checked in today"}</small></div><Badge tone={attendance.checkOut ? "neutral" : "green"}>{attendance.checkOut ? `Checked out ${formatTime(attendance.checkOut)}` : "Working now"}</Badge></div></section><div className="content-grid manager-content"><section className="panel"><div className="panel-header"><div><h2>Team performance</h2><p>Current KPI score by employee.</p></div><button className="link-button" onClick={() => setPage("employees")}>View team <Icon name="arrow" /></button></div>{employees.map((emp) => <div className="team-row" key={emp.id}><span className="avatar">{emp.initials}</span><div className="team-name"><strong>{emp.name}</strong><small>{emp.title}</small></div><div className="team-progress"><ProgressBar value={kpiFor(emp)} /><small>{kpiFor(emp).toFixed(1)} KPI</small></div><Badge tone={kpiFor(emp) > 85 ? "green" : "orange"}>{kpiFor(emp) > 85 ? "On track" : "Needs focus"}</Badge></div>)}</section><section className="panel"><div className="panel-header"><div><h2>Needs your review</h2><p>Recent task submissions.</p></div><button className="link-button" onClick={() => setPage("reviews")}>See queue <Icon name="arrow" /></button></div>{pending.slice(0, 3).map((task) => <div className="review-row" key={task.id}><span className="avatar">{employees.find((e) => e.id === task.employeeId)?.initials}</span><div><strong>{task.title}</strong><small>{employees.find((e) => e.id === task.employeeId)?.name} · {task.id}</small></div><button className="small-button" onClick={() => setPage("reviews")}>Review</button></div>)}{!pending.length && <div className="empty-column">All caught up.</div>}</section></div></>;
}

function EmployeesPage({ employees, showCreate = true }) {
  return <><Header title="Employees" subtitle="Your team at a glance." onMenu={() => {}} onCreate={showCreate ? () => {} : undefined} notifications={3} /><div className="toolbar"><div className="search"><span>⌕</span><input placeholder="Search employees..." /></div><select><option>All departments</option><option>Design</option><option>Engineering</option></select><Button icon="plus">Add employee</Button></div><section className="panel"><div className="table-wrap"><table><thead><tr><th>Employee</th><th>Department</th><th>KPI score</th><th>Growth points</th><th>Level</th><th>Status</th></tr></thead><tbody>{employees.map((emp) => <tr key={emp.id}><td><div className="table-person"><span className="avatar">{emp.initials}</span><div><strong>{emp.name}</strong><small>{emp.email}</small></div></div></td><td>{emp.department}</td><td><strong>{kpiFor(emp).toFixed(1)}</strong></td><td>{emp.points}</td><td><Badge tone="purple">{levelFor(emp.points).title}</Badge></td><td><Badge tone="green">Active</Badge></td></tr>)}</tbody></table></div></section></>;
}

function ReviewPage({ tasks, employees, delegationRequests, onReview, onDelegation }) {
  const pending = tasks.filter((task) => task.status === "review");
  const pendingDelegations = delegationRequests.filter((request) => request.status === "pending");
  const [delegatedPoints, setDelegatedPoints] = useState({});
  const approveDelegation = (request) => {
    const points = Number(delegatedPoints[request.id]);
    if (!Number.isFinite(points) || points < 1 || points > request.parentPoints) return;
    onDelegation(request.id, true, points);
  };
  return <><Header title="Review queue" subtitle="Review submitted work and delegation requests before points become final." onMenu={() => {}} notifications={pending.length + pendingDelegations.length} />{pendingDelegations.length > 0 && <section className="review-list delegation-review-list"><div className="section-heading"><div><h2>Delegation requests</h2><p>Approve the work split and set the KPI points before the teammate receives a subtask.</p></div><Badge tone="orange">{pendingDelegations.length} pending</Badge></div>{pendingDelegations.map((request) => <article className="review-card delegation-review-card" key={request.id}><div className="review-card-top"><div><Badge tone="orange">Approval needed</Badge><h2>{request.title}</h2><p>{employees.find((e) => e.id === request.fromEmployeeId)?.name} wants to delegate to {employees.find((e) => e.id === request.toEmployeeId)?.name}</p></div><span className="task-points">Parent +{request.parentPoints} pts</span></div><div className="submission-note"><strong>Delegated work</strong><p>{request.details}</p><small>Parent task: {request.parentTaskId} · Manager assigns the subtask KPI here.</small></div><div className="delegation-kpi-review"><label className="field">Delegated KPI points<input type="number" min="1" max={request.parentPoints} required value={delegatedPoints[request.id] || ""} onChange={(event) => setDelegatedPoints((current) => ({ ...current, [request.id]: event.target.value }))} placeholder={`1–${request.parentPoints}`} /></label><small>Must be between 1 and the parent task's {request.parentPoints} points.</small></div><div className="review-actions"><Button variant="secondary" onClick={() => onDelegation(request.id, false)}>Reject</Button><Button onClick={() => approveDelegation(request)}>Approve delegation</Button></div></article>)}</section>}{pending.length > 0 && <div className="review-list"><div className="section-heading"><div><h2>Task submissions</h2><p>Review completed work before points become final.</p></div></div>{pending.map((task) => <article className="review-card" key={task.id}><div className="review-card-top"><div><Badge tone="purple">Pending review</Badge><h2>{task.title}</h2><p>{employees.find((e) => e.id === task.employeeId)?.name} · {task.id}</p></div><span className="task-points">+{task.points} pts</span></div><div className="submission-note"><strong>Completion notes</strong><p>{task.note || "All assigned requirements have been completed. Please review the attached work."}</p></div><div className="review-actions"><label className="field">Quality rating<select defaultValue="4"><option value="5">5 — Exceptional</option><option value="4">4 — Strong</option><option value="3">3 — Meets expectations</option><option value="2">2 — Needs improvement</option></select></label><div><Button variant="secondary" onClick={() => onReview(task.id, false)}>Request rework</Button><Button onClick={() => onReview(task.id, true)}>Approve +{task.points} pts</Button></div></div></article>)}</div>}{!pending.length && !pendingDelegations.length && <div className="panel empty-state"><span className="empty-check">✓</span><h2>You're all caught up</h2><p>No pending reviews or delegation requests.</p></div>}</>;
}

function RequestStatus({ status }) {
  const tone = status === "Completed" ? "green" : status === "In progress" ? "blue" : "orange";
  return <Badge tone={tone}>{status}</Badge>;
}

function RequestDetails({ request, onClose }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="request-details-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><div><div className="task-detail-id">{request.id}</div><h2>{request.requirement}</h2><p>{request.type} · {request.department}</p></div><button className="close-button" onClick={onClose}>×</button></div><div className="request-detail-summary"><RequestStatus status={request.status} /><span>{request.progress}% complete</span><ProgressBar value={request.progress} /></div><div className="request-detail-grid"><div><span className="eyebrow">Requester</span><strong>{request.requester}</strong><small>{request.department}</small></div><div><span className="eyebrow">Department manager</span><strong>{request.manager || request.officer}</strong><small>Approval owner</small></div><div><span className="eyebrow">Required by</span><strong>{request.deadline}</strong><small>Priority: {request.priority}</small></div></div>{request.details && <div className="request-detail-section"><h3>Request details</h3><p>{request.details}</p></div>}<div className="request-detail-section"><h3>Request timeline</h3><div className="timeline"><div className="timeline-item done"><span>✓</span><div><strong>Request created</strong><small>{request.created} · Submitted by {request.requester}</small></div></div><div className={`timeline-item ${request.status !== "Pending approval" ? "done" : ""}`}><span>2</span><div><strong>Manager approval</strong><small>{request.status === "Pending approval" ? "Waiting for department manager review" : "Approved and forwarded to HR"}</small></div></div><div className={`timeline-item ${request.status === "Completed" ? "done" : ""}`}><span>3</span><div><strong>HR processing</strong><small>{request.status === "Completed" ? "Requirement fulfilled and request closed" : request.delay}</small></div></div></div></div><div className="request-detail-section"><h3>Activity & comments <Badge tone="neutral">{request.comments}</Badge></h3><div className="detail-empty">{request.delay}</div></div><div className="modal-footer"><Button variant="secondary" onClick={onClose}>Close</Button><Button>Update request</Button></div></section></div>;
}

function HrDashboard({ requests, employees, setPage, onOpenRequest, onCreate, attendance }) {
  const inProgress = requests.filter((request) => request.status === "In progress").length;
  const pending = requests.filter((request) => request.status === "Pending approval").length;
  return <><Header title="HR command center" subtitle="Organization-wide workforce visibility at a glance." onMenu={() => {}} onCreate={onCreate} createLabel="Create request" notifications={pending} /><section className="hr-hero"><div><Badge tone="light">CORPORATE HR & WORKFORCE PLATFORM</Badge><h2>People operations, made visible.</h2><p>Monitor workforce health, move requests forward, and keep every team supported.</p></div><div className="hr-hero-metrics"><span><strong>15</strong> departments</span><span><strong>128</strong> employees</span></div></section><div className="stats-grid manager-stats"><StatCard label="Total employees" value="128" note="+8 this month" icon="users" /><StatCard label="Present today" value="116 / 128" note="90.6% attendance" icon="check" tone="green" /><StatCard label="Open HR requests" value={requests.filter((request) => request.status !== "Completed").length} note={`${inProgress} in progress`} icon="tasks" tone="orange" /><StatCard label="Needs approval" value={pending} note="Requires attention" icon="clock" tone="purple" /></div><section className="panel live-attendance-panel"><div className="panel-header"><div><h2>Live attendance</h2><p>Employee check-in and check-out is visible in real time.</p></div><Badge tone="green">Live</Badge></div><div className="live-attendance-row"><span className="avatar">RU</span><div><strong>Rahim Uddin</strong><small>{attendance.checkIn ? `Checked in at ${formatTime(attendance.checkIn)}` : "Not checked in today"}</small></div><Badge tone={attendance.checkOut ? "neutral" : "green"}>{attendance.checkOut ? `Checked out ${formatTime(attendance.checkOut)}` : "Working now"}</Badge></div></section><div className="hr-module-grid"><section className="panel"><div className="panel-header"><div><h2>HR request tracking</h2><p>Manpower, recruitment, transfer, training and support requests.</p></div><button className="link-button" onClick={() => setPage("requests")}>View all <Icon name="arrow" /></button></div><div className="request-list">{requests.slice(0, 4).map((request) => <button className="request-row" key={request.id} onClick={() => onOpenRequest(request)}><span className="request-type-icon">{request.type === "Equipment request" ? "▣" : request.type === "Training request" ? "✦" : "♙"}</span><div className="request-main"><div><strong>{request.requirement}</strong><span>{request.id} · {request.department}</span></div><RequestStatus status={request.status} /></div><div className="request-progress"><ProgressBar value={request.progress} /><small>{request.progress}%</small></div></button>)}</div></section><section className="panel workforce-panel"><div className="panel-header"><div><h2>Workforce overview</h2><p>Department health and allocation.</p></div><button className="link-button" onClick={() => setPage("analytics")}>Analytics <Icon name="arrow" /></button></div>{[["Engineering", 42, 91], ["Development", 35, 86], ["Design", 18, 83], ["Marketing", 14, 78]].map(([department, count, score]) => <div className="department-row" key={department}><div><strong>{department}</strong><small>{count} employees</small></div><div className="department-score"><ProgressBar value={score} color={score > 85 ? "green" : "purple"} /><span>{score}%</span></div></div>)}<div className="insight-card"><span>✦</span><div><strong>AI insight</strong><p>Development has 2 open manpower requests and 18% workload growth this month.</p></div></div></section></div><section className="panel command-modules"><div className="panel-header"><div><h2>HR management modules</h2><p>Quick access to the operations your team manages every day.</p></div></div><div className="module-cards">{[["Employee lifecycle", "Profiles, onboarding and status", "users"], ["Attendance & leave", "Presence, leave and policy", "clock"], ["Performance & KPI", "Tasks, reviews and growth", "chart"], ["Employee support", "Helpdesk, documents and issues", "bell"]].map(([title, description, icon]) => <button className="module-card" key={title} onClick={() => setPage(title === "Performance & KPI" ? "analytics" : title === "Attendance & leave" ? "leave" : "employees")}><span className="module-icon"><Icon name={icon} /></span><strong>{title}</strong><small>{description}</small><Icon name="arrow" /></button>)}</div></section></>;
}

function HrRequestsPage({ requests, onOpenRequest, onCreate }) {
  const [query, setQuery] = useState("");
  const filtered = requests.filter((request) => `${request.id} ${request.department} ${request.requirement} ${request.type}`.toLowerCase().includes(query.toLowerCase()));
  return <><Header title="HR requests" subtitle="Track every request from creation to resolution." onMenu={() => {}} onCreate={onCreate} createLabel="Create request" notifications={2} /><div className="toolbar"><div className="search"><span>⌕</span><input placeholder="Search request ID, department..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><select><option>All statuses</option><option>In progress</option><option>Pending approval</option><option>Completed</option></select><select><option>All request types</option><option>Manpower request</option><option>Recruitment request</option></select></div><section className="panel"><div className="table-wrap"><table><thead><tr><th>Request</th><th>Department</th><th>Requester</th><th>Priority</th><th>Progress</th><th>Status</th><th>Owner</th></tr></thead><tbody>{filtered.map((request) => <tr className="clickable-row" key={request.id} onClick={() => onOpenRequest(request)}><td><strong>{request.id}</strong><small className="table-subtext">{request.requirement}</small></td><td>{request.department}<small className="table-subtext">{request.type}</small></td><td>{request.requester}</td><td><Badge tone={request.priority === "High" ? "red" : "neutral"}>{request.priority}</Badge></td><td><div className="table-progress"><ProgressBar value={request.progress} /><small>{request.progress}%</small></div></td><td><RequestStatus status={request.status} /></td><td>{request.officer}</td></tr>)}</tbody></table></div></section></>;
}

function HrRequestModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ requirement: "", department: "Development", type: "Manpower request", priority: "Medium", deadline: "2026-11-30", details: "" });
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const manager = departmentManagers[form.department];
  const submit = (event) => {
    event.preventDefault();
    if (!form.requirement.trim() || !form.details.trim()) return;
    onCreate({ ...form, requirement: form.requirement.trim(), details: form.details.trim(), officer: manager });
  };
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal hr-request-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><div><Badge tone="blue">Department request</Badge><h2>Create a request for a department</h2><p>HR submits the request to the selected department manager for approval.</p></div><button className="close-button" onClick={onClose}>×</button></div><form onSubmit={submit}><div className="request-routing-note"><span className="request-type-icon">↗</span><div><strong>Routes to {manager}</strong><small>{form.department} department manager · Approval required before HR processing</small></div></div><div className="form-grid"><label className="field full">Request title<input autoFocus required value={form.requirement} onChange={update("requirement")} placeholder="e.g. 2 frontend developers" /></label><label className="field">Department<select value={form.department} onChange={update("department")}>{Object.keys(departmentManagers).map((department) => <option key={department}>{department}</option>)}</select></label><label className="field">Request type<select value={form.type} onChange={update("type")}><option>Manpower request</option><option>Recruitment request</option><option>Equipment request</option><option>Training request</option></select></label><label className="field">Priority<select value={form.priority} onChange={update("priority")}><option>Low</option><option>Medium</option><option>High</option></select></label><label className="field">Required by<input type="date" value={form.deadline} onChange={update("deadline")} /></label><label className="field full">Request details<textarea required value={form.details} onChange={update("details")} placeholder="Describe the requirement, quantity, or business need" /></label></div><div className="modal-footer"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" icon="arrow">Send to department manager</Button></div></form></section></div>;
}

function TaskModal({ employees, onClose, onCreate }) {
  const [form, setForm] = useState({ title: "", employeeId: employees[0].id, priority: "Medium", hours: 4, points: 20, deadline: "2026-11-12", attachment: null, attachmentName: "", githubRepo: "" });
  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  const handleFile = (attachment) => setForm({ ...form, attachment, attachmentName: attachment?.name || "" });
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={(e) => e.stopPropagation()}><div className="modal-header"><div><h2>Create a new task</h2><p>Assign work and define expectations clearly.</p></div><button className="close-button" onClick={onClose}>×</button></div><div className="form-grid"><label className="field full">Task title<input autoFocus value={form.title} onChange={update("title")} placeholder="e.g. Design login page" /></label><label className="field">Assign to<select value={form.employeeId} onChange={update("employeeId")}>{employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label><label className="field">Priority<select value={form.priority} onChange={update("priority")}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label><label className="field">Estimated hours<input type="number" value={form.hours} onChange={update("hours")} /></label><label className="field">Base points<input type="number" value={form.points} onChange={update("points")} /></label><label className="field full">Deadline<input type="date" value={form.deadline} onChange={update("deadline")} /></label><div className="field full"><div className="field-label-row"><span>Attachment</span><span className="optional-label">Optional</span></div><AttachmentPicker file={form.attachment} onChange={handleFile} /></div><label className="field full">GitHub repository <span className="optional-label">Optional</span><input type="url" value={form.githubRepo} onChange={update("githubRepo")} placeholder="https://github.com/owner/repository" /></label></div><div className="modal-footer"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => form.title.trim() && onCreate({ ...form, hours: Number(form.hours), points: Number(form.points) })}>Assign task</Button></div></div></div>;
}

function App() {
  const [session, setSession] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [employees, setEmployees] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [requests, setRequests] = useState([]);
  const [delegationRequests, setDelegationRequests] = useState([]);
  const [attendance, setAttendance] = useState({ date: todayKey(), checkIn: `${todayKey()}T08:42:00`, checkOut: null });
  const [modal, setModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [delegationTask, setDelegationTask] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => { Promise.all([api.employees.list(), api.tasks.list(), api.hrRequests.list()]).then(([people, work, hrWork]) => { setEmployees(people); setTasks(work); setRequests(hrWork); }); }, []);
  useEffect(() => { const toggle = () => setSidebarOpen((open) => !open); window.addEventListener("zippio:toggle-menu", toggle); return () => window.removeEventListener("zippio:toggle-menu", toggle); }, []);
  const employee = session?.role === "employee" ? employees.find((e) => e.id === session.userId) : null;
  const activeEmployee = employee || employees[0];
  const login = (role, userId) => { setSession({ role, userId: userId || "manager" }); setPage("dashboard"); };
  const updateTask = (id, patch) => setTasks((current) => current.map((task) => task.id === id ? { ...task, ...patch } : task));
  const start = (id) => {
    const patch = { status: "progress", startedAt: new Date().toISOString() };
    updateTask(id, patch);
    setSelectedTask((current) => current?.id === id ? { ...current, ...patch } : current);
  };
  const submit = (id) => updateTask(id, { status: "review", note: "I completed the assigned work and verified the core requirements." });
  const review = (id, approved) => updateTask(id, { status: approved ? "approved" : "progress" });
  const createDelegationRequest = (data) => {
    setDelegationRequests((current) => [...current, {
      ...data,
      id: `DG-${101 + current.length}`,
      parentTaskId: delegationTask.id,
      parentPoints: delegationTask.points,
      fromEmployeeId: delegationTask.employeeId,
      toEmployeeId: data.employeeId,
      status: "pending",
      createdAt: new Date().toISOString(),
    }]);
    setDelegationTask(null);
    setSelectedTask(null);
  };
  const reviewDelegation = (id, approved, points) => {
    const request = delegationRequests.find((item) => item.id === id);
    if (!request) return;
    setDelegationRequests((current) => current.map((item) => item.id === id ? { ...item, status: approved ? "approved" : "rejected" } : item));
    if (approved) {
      setTasks((current) => [...current, {
        id: `ST-${101 + current.filter((task) => task.parentTaskId).length}`,
        title: request.title,
        employeeId: request.toEmployeeId,
        parentTaskId: request.parentTaskId,
        delegatedFrom: request.fromEmployeeId,
        reviewerId: request.fromEmployeeId,
        priority: "Medium",
        hours: 2,
        points,
        deadline: current.find((task) => task.id === request.parentTaskId)?.deadline || "Nov 30, 2026",
        status: "todo",
        note: request.details,
      }]);
    }
  };
  const uploadToTask = (id, file, githubRepo) => setTasks((current) => current.map((task) => task.id === id ? { ...task, attachment: file || null, attachmentName: file?.name || "", githubRepo: githubRepo || "", status: task.delegatedFrom ? "handoff" : "review", note: task.delegatedFrom ? "Submitted to the task owner for review." : "Submitted for manager review." } : task));
  const reviewHandoff = (id, accepted) => {
    const subtask = tasks.find((task) => task.id === id);
    updateTask(id, { status: accepted ? "approved" : "progress", note: accepted ? "Accepted by task owner." : "Revision requested by task owner." });
    if (accepted && subtask?.parentTaskId) updateTask(subtask.parentTaskId, { delegatedCompleted: true });
  };
  const checkIn = () => setAttendance((current) => {
    const date = todayKey();
    if (current.date === date && (current.checkIn || current.checkOut)) return current;
    return { date, checkIn: new Date().toISOString(), checkOut: null };
  });
  const checkOut = () => setAttendance((current) => {
    if (current.date !== todayKey() || !current.checkIn || current.checkOut) return current;
    return { ...current, checkOut: new Date().toISOString() };
  });
  const createTask = (data) => { setTasks((current) => [...current, { ...data, id: `ZP-${105 + current.length}`, status: "todo" }]); setModal(false); setPage("tasks"); };
  const createHrRequest = (data) => {
    setRequests((current) => [...current, {
      ...data,
      manager: data.officer,
      id: `HR-${106 + current.length}`,
      status: "Pending approval",
      progress: 0,
      requester: "Ayesha Rahman",
      created: "Today",
      delay: `Awaiting approval from ${data.officer}`,
      comments: 0,
    }]);
    setModal(false);
  };
  if (!session) return <Login onLogin={login} />;
  if (!employees.length || !requests.length) return <div className="loading-screen">Loading your workspace…</div>;
  const isManager = session.role === "manager";
  const isHr = session.role === "hr";
  const title = isHr ? (page === "requests" ? "HR requests" : page === "employees" ? "Employees" : page === "analytics" ? "Analytics & reports" : page === "leave" ? "Leave & attendance" : "HR command center") : page === "dashboard" ? "Overview" : page === "tasks" ? (isManager ? "All tasks" : "My tasks") : page === "performance" ? "My performance" : page === "attendance" ? "Attendance" : page === "leave" ? "Apply leave" : page === "employees" ? "Employees" : page === "reviews" ? "Review queue" : "Reports";
  return <div className="app-shell"><Sidebar role={session.role} page={page} setPage={setPage} onLogout={() => setSession(null)} open={sidebarOpen} setOpen={setSidebarOpen} /><main className="main-content"><div className="desktop-context">{title}</div>{isHr && page === "dashboard" && <HrDashboard requests={requests} employees={employees} setPage={setPage} onOpenRequest={setSelectedRequest} onCreate={() => setModal(true)} attendance={attendance} />}{isHr && page === "requests" && <HrRequestsPage requests={requests} onOpenRequest={setSelectedRequest} onCreate={() => setModal(true)} />}{isHr && page === "employees" && <EmployeesPage employees={employees} showCreate={false} />}{isHr && page === "analytics" && <HrAnalyticsPage employees={employees} />}{isHr && page === "leave" && <LeavePage isHr employees={employees} />}{isManager && page === "dashboard" && <ManagerDashboard tasks={tasks} employees={employees} setPage={setPage} onCreate={() => setModal(true)} attendance={attendance} />}{isManager && page === "tasks" && <TasksPage role="manager" tasks={tasks} employees={employees} delegationRequests={delegationRequests} onDelegation={reviewDelegation} onCreate={() => setModal(true)} onOpen={setSelectedTask} />}{isManager && page === "employees" && <EmployeesPage employees={employees} />}{isManager && page === "reviews" && <ReviewPage tasks={tasks} employees={employees} delegationRequests={delegationRequests} onReview={review} onDelegation={reviewDelegation} />}{isManager && page === "reports" && <PerformancePage employee={activeEmployee} />}{!isManager && !isHr && page === "dashboard" && <EmployeeDashboard employee={employee} tasks={tasks} onStart={start} onSubmit={submit} onOpen={setSelectedTask} setPage={setPage} attendance={attendance} onCheckIn={checkIn} onCheckOut={checkOut} />}{!isManager && !isHr && page === "tasks" && <TasksPage role="employee" tasks={tasks} employee={employee} employees={employees} onStart={start} onSubmit={submit} onOpen={setSelectedTask} />}{!isManager && !isHr && page === "performance" && <PerformancePage employee={employee} />}{!isManager && !isHr && page === "attendance" && <AttendancePage employee={employee} attendance={attendance} onCheckIn={checkIn} onCheckOut={checkOut} />}{!isManager && !isHr && page === "leave" && <LeavePage employee={employee} />}</main>{modal && (isHr ? <HrRequestModal onClose={() => setModal(false)} onCreate={createHrRequest} /> : <TaskModal employees={employees} onClose={() => setModal(false)} onCreate={createTask} />)}{selectedTask && <TaskDetails task={selectedTask} employeeName={employees.find((person) => person.id === selectedTask.employeeId)?.name} currentEmployeeId={employee?.id} onClose={() => setSelectedTask(null)} onStart={start} onDelegate={setDelegationTask} onHandoffReview={reviewHandoff} onUpload={uploadToTask} />}{delegationTask && <DelegationModal task={delegationTask} employees={employees} currentEmployeeId={employee?.id} onClose={() => setDelegationTask(null)} onSubmit={createDelegationRequest} />}{selectedRequest && <RequestDetails request={selectedRequest} onClose={() => setSelectedRequest(null)} />}</div>;
}

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
