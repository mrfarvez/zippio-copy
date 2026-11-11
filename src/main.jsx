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

function formatDuration(start, end) {
  const minutes = Math.max(0, Math.round((new Date(end) - new Date(start)) / 60000));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function attendanceDate(value) {
  return value ? String(value).slice(0, 10) : "";
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
  return dimensions.reduce((total, [, weight], index) => total + Number(employee.scores?.[index] ?? 0) * weight / 100, 0);
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

function Login({ onLogin, error }) {
  const [role, setRole] = useState("manager");
  const [employee, setEmployee] = useState("e1");
  const [employeeOptions, setEmployeeOptions] = useState([{ id: "e1", name: "Rahim Uddin" }, { id: "e2", name: "Nusrat Jahan" }, { id: "e3", name: "Imran Hossain" }]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  useEffect(() => {
    let active = true;
    api.auth.employees().then((rows) => {
      if (!active || !Array.isArray(rows) || !rows.length) return;
      setEmployeeOptions(rows);
      setEmployee((current) => rows.some((row) => row.id === current) ? current : rows[0].id);
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  const submit = (event) => {
    event.preventDefault();
    onLogin({ role, userId: role === "employee" ? employee : null, email, password });
  };
  return <main className="auth-page"><section className="auth-visual"><div className="brand brand-light"><span className="brand-mark">Z</span>Zippio</div><div className="visual-copy"><Badge tone="light">CORPORATE HR & WORKFORCE PLATFORM</Badge><h1>Make people, work, and <em>growth</em> visible.</h1><p>One calm workspace to align work, manage requests, and help every team member grow.</p></div><div className="visual-footer"><span>Trusted by high-performing teams</span><span>● 99.9% uptime</span><span>● Secure by design</span></div></section><section className="auth-form"><form className="auth-form-inner" onSubmit={submit}><div className="brand"><span className="brand-mark">Z</span>Zippio <span className="version">2.0</span></div><div className="auth-heading"><h2>Welcome back</h2><p>Sign in to continue to your workspace.</p></div><div className="role-switch role-switch-three"><button type="button" className={role === "manager" ? "active" : ""} onClick={() => setRole("manager")}>Manager</button><button type="button" className={role === "employee" ? "active" : ""} onClick={() => setRole("employee")}>Employee</button><button type="button" className={role === "hr" ? "active" : ""} onClick={() => setRole("hr")}>HR</button></div>{role === "employee" ? <label className="field">Choose employee<select value={employee} onChange={(e) => setEmployee(e.target.value)}>{employeeOptions.map((option) => <option key={option.id} value={option.id}>{option.name} ({option.id})</option>)}</select></label> : <label className="field">Work email<input type="email" required autoComplete="username" placeholder={role === "hr" ? "hr@company.com" : "manager@company.com"} value={email} onChange={(e) => setEmail(e.target.value)} /></label>}<label className="field">Password<input type="password" required minLength="8" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} /></label><div className="form-row"><label className="check"><input type="checkbox" defaultChecked /> Remember me</label><a href="#forgot">Forgot password?</a></div>{error && <p className="auth-error" role="alert">{error}</p>}<Button type="submit"><span>Sign in</span><Icon name="arrow" /></Button></form></section></main>;
}

function Sidebar({ role, employee, page, setPage, onLogout, open, setOpen, name = "", jobTitle = "", reviewCount = 0, requestCount = 0 }) {
  const employeeItems = [["dashboard", "Overview", "grid"], ["tasks", "My tasks", "tasks"], ["performance", "Performance", "chart"], ["attendance", "Attendance", "clock"], ["leave", "Apply leave", "calendar"]];
  const managerItems = [["dashboard", "Overview", "grid"], ["tasks", "All tasks", "tasks"], ["employees", "Employees", "users"], ["reviews", "Review queue", "check"], ["reports", "Performance", "chart"]];
  const hrItems = [["dashboard", "Command center", "grid"], ["requests", "HR requests", "tasks"], ["employees", "Employees", "users"], ["analytics", "Performance & analytics", "chart"], ["support", "Helpdesk & support", "bell"]];
  const items = role === "employee" ? employeeItems : role === "hr" ? hrItems : managerItems;
  const isHr = role === "hr";
  const profile = role === "employee"
    ? { initials: employee?.initials || employee?.name?.split(" ").map((part) => part[0]).join("").slice(0, 2) || "EM", name: employee?.name || "Employee", title: employee?.title || "Employee" }
    : isHr
      ? { initials: (name || "HR").split(" ").map((part) => part[0]).join("").slice(0, 2) || "HR", name: name || "HR manager", title: "HR manager" }
      : { initials: (name || "Manager").split(" ").map((part) => part[0]).join("").slice(0, 2) || "M", name: name || "Manager", title: jobTitle || "Manager" };
  return <aside className={`sidebar ${open ? "sidebar-open" : ""}`}><div className="sidebar-top"><div className="brand"><span className="brand-mark">Z</span>Zippio <span className="version">2.0</span></div><button className="mobile-close" onClick={() => setOpen(false)}>×</button></div><div className="workspace"><span className="workspace-avatar">{role === "manager" ? "M" : isHr ? "HR" : profile.initials}</span><div><strong>{role === "manager" ? "Acme workspace" : isHr ? "Acme HR workspace" : profile.name}</strong><small>{role === "manager" ? (jobTitle ? `${jobTitle} workspace` : "Manager workspace") : isHr ? "Human resources" : profile.title}</small></div><span className="chevron">⌄</span></div>{isHr && <div className="sidebar-label">HR OPERATIONS</div>}<nav>{items.map(([id, label, icon]) => <button key={id} className={page === id ? "nav-item active" : "nav-item"} onClick={() => { setPage(id); setOpen(false); }}><Icon name={icon} /><span>{label}</span>{id === "reviews" && reviewCount > 0 && <Badge tone="red">{reviewCount}</Badge>}{id === "requests" && requestCount > 0 && <Badge tone="red">{requestCount}</Badge>}</button>)}</nav>{isHr && <><div className="sidebar-label sidebar-section-label">EMPLOYEE SUPPORT</div><button className={`nav-item ${page === "leave" ? "active" : ""}`} onClick={() => { setPage("leave"); setOpen(false); }}><Icon name="check" /><span>Attendance & leave</span></button></>}<div className="sidebar-bottom"><div className="help-card"><div className="help-icon">?</div><div><strong>Need a hand?</strong><small>Visit our help center</small></div></div><button className="nav-item" onClick={onLogout}><Icon name="logout" /><span>Sign out</span></button><div className="profile-row"><span className="avatar">{profile.initials}</span><div><strong>{profile.name}</strong><small>{profile.title}</small></div><span className="dots">•••</span></div></div></aside>;
}

function Header({ title, subtitle, onMenu, onCreate, createLabel = "Create task", notifications = 0 }) {
  return <header className="topbar"><button className="mobile-menu" onClick={() => window.dispatchEvent(new Event("zippio:toggle-menu"))}><Icon name="menu" /></button><div><h1>{title}</h1><p>{subtitle}</p></div><div className="top-actions"><button className="icon-button notification"><Icon name="bell" />{notifications > 0 && <span>{notifications}</span>}</button>{onCreate && <Button icon="plus" onClick={onCreate}>{createLabel}</Button>}</div></header>;
}

function TaskCard({ task, employeeName, onStart, onSubmit, onOpen }) {
  const status = task.status === "progress" && task.delegationStatus ? taskDelegationChip(task.delegationStatus) : task.status === "todo" ? ["To do", "blue"] : task.status === "progress" ? ["In progress", "orange"] : task.status === "review" ? ["Pending review", "purple"] : task.status === "handoff" ? ["Owner review", "purple"] : ["Approved", "green"];
  return <article className="task-card task-card-clickable" onClick={() => onOpen?.(task)}><div className="task-top"><span className="task-id">{task.id}</span><Badge tone={task.priority === "Critical" || task.priority === "High" ? "red" : "neutral"}>{task.priority}</Badge></div><h3>{task.title}</h3>{employeeName && <p className="task-owner">{employeeName}</p>}<div className="task-meta"><span><Icon name="clock" />{task.hours}h estimate</span><span className={`task-points ${task.kpi?.overdue ? "negative" : ""}`}>{task.kpi?.score >= 0 ? "+" : ""}{task.kpi?.score ?? task.points} KPI</span></div>{task.attachmentName && <div className="task-attachment">📎 {task.attachmentName}</div>}{task.githubRepo && <div className="task-attachment">⌘ {task.githubRepo}</div>}<div className="task-footer"><span className={`task-due ${task.kpi?.overdue ? "negative" : ""}`}>Due {new Date(task.deadline).toLocaleString()}</span><Badge tone={status[1]}>{status[0]}</Badge></div></article>;
}

function delegationStatusTone(status) {
  return status === "approved" ? "green" : status === "rejected" ? "red" : "orange";
}

function delegationStatusLabel(status) {
  return status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Review needed";
}

function taskDelegationChip(status) {
  return status === "approved" ? ["Approved delegation", "green"] : status === "rejected" ? ["Delegation rejected", "red"] : ["Delegated task", "purple"];
}

function DelegationRequestCard({ request, employees, onOpen }) {
  const parentPoints = request.parentPoints || 1;
  const target = employees.find((employee) => employee.id === request.toEmployeeId);
  const requester = employees.find((employee) => employee.id === request.fromEmployeeId);
  return <article className="task-card delegation-task-card task-card-clickable" onClick={() => onOpen?.(request)}><div className="task-top"><span className="task-id">{request.id}</span><Badge tone={delegationStatusTone(request.status)}>{delegationStatusLabel(request.status)}</Badge></div><h3>{request.title}</h3><p className="task-owner">{requester?.name || "Employee"} → {target?.name || "Teammate"}</p><p className="delegation-task-details">{request.details}</p><div className="delegation-task-parent">Parent task: {request.parentTaskId} · Parent KPI +{parentPoints} pts</div></article>;
}

function DelegationDetails({ request, employees, onClose, onApprove, onReject }) {
  const parentPoints = request.parentPoints || 1;
  const [points, setPoints] = useState(String(request.points || parentPoints));
  const target = employees.find((employee) => employee.id === request.toEmployeeId);
  const requester = employees.find((employee) => employee.id === request.fromEmployeeId);
  const isPending = request.status === "pending";
  const tone = delegationStatusTone(request.status);
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="task-details-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><div><div className="task-detail-id">{request.id}</div><h2>{request.title}</h2><p>{requester?.name || "Employee"} → {target?.name || "Teammate"}</p></div><button className="close-button" onClick={onClose}>×</button></div><div className="task-detail-badges"><Badge tone={tone}>{delegationStatusLabel(request.status)}</Badge><Badge tone="purple">Delegation</Badge></div><div className="task-detail-grid"><div><span className="eyebrow">Requested by</span><strong>{requester?.name || "Employee"}</strong></div><div><span className="eyebrow">Delegate to</span><strong>{target?.name || "Teammate"}</strong></div><div><span className="eyebrow">Parent task</span><strong>{request.parentTaskId}</strong><small>Parent KPI +{parentPoints} pts</small></div></div><div className="task-detail-section"><h3>Work to delegate</h3><p>{request.details}</p></div>{isPending ? <><div className="task-detail-section"><h3>Manager KPI points</h3><label className="field"><input type="number" min="1" max={parentPoints} value={points} onChange={(event) => setPoints(event.target.value)} placeholder={`1–${parentPoints}`} /><small>Must be between 1 and {parentPoints} points.</small></label></div><div className="task-detail-actions"><Button variant="secondary" onClick={() => { onReject(request.id); onClose(); }}>Reject</Button><Button disabled={!points || Number(points) < 1 || Number(points) > parentPoints} onClick={() => { onApprove(request.id, Number(points)); onClose(); }}>Approve</Button></div></> : <div className="task-detail-actions"><Badge tone={tone}>{request.status === "approved" ? `Approved · ${request.points || parentPoints} KPI pts` : "Rejected"}</Badge></div>}</section></div>;
}

function AttachmentPicker({ file, onChange }) {
  const size = file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : "";
  return <label className={`upload-box ${file ? "upload-box-selected" : ""}`}><span className="upload-icon">{file ? "✓" : "↑"}</span><strong>{file ? file.name : "Choose a file to attach"}</strong><small>{file ? `${size} · Ready to upload` : "Drag & drop or browse · PDF, DOC, XLS, PNG, JPG or ZIP · Max 10 MB"}</small><input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip" onChange={(event) => onChange(event.target.files?.[0] || null)} /></label>;
}

function TaskDetails({ task, employeeName, currentEmployeeId, onClose, onUpload, onStart, onDelegate, onReview, canReview }) {
  const [file, setFile] = useState(null);
  const [githubRepo, setGithubRepo] = useState(task.githubRepo || "");
  const status = task.status === "progress" && task.delegationStatus ? taskDelegationChip(task.delegationStatus) : task.status === "todo" ? ["To do", "blue"] : task.status === "progress" ? ["In progress", "orange"] : task.status === "review" ? ["Pending review", "purple"] : task.status === "handoff" ? ["Owner review", "purple"] : ["Approved", "green"];
  const submitForReview = () => { onUpload(task.id, file, githubRepo); onClose(); };
  const delegatedLock = task.status === "progress" && (task.delegationStatus === "pending" || task.delegationStatus === "approved");
  const canDelegate = !task.parentTaskId && !delegatedLock && (task.status === "todo" || task.status === "progress");
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="task-details-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><div><div className="task-detail-id">{task.id}</div><h2>{task.title}</h2><p>{employeeName ? `Assigned to ${employeeName}` : "Your assigned task"}</p></div><button className="close-button" onClick={onClose}>×</button></div><div className="task-detail-badges"><Badge tone={status[1]}>{status[0]}</Badge><Badge tone={task.priority === "Critical" || task.priority === "High" ? "red" : "neutral"}>{task.priority} priority</Badge>{task.kpi?.overdue && <Badge tone="red">{task.kpi.lateDays} days overdue</Badge>}{task.parentTaskId && <Badge tone="purple">Subtask</Badge>}</div><div className="task-detail-grid"><div><span className="eyebrow">Deadline</span><strong>{new Date(task.deadline).toLocaleString()}</strong></div><div><span className="eyebrow">Estimated time</span><strong>{task.hours} hours</strong></div><div><span className="eyebrow">Current KPI</span><strong className={task.kpi?.score < 0 ? "negative" : "positive"}>{task.kpi?.score >= 0 ? "+" : ""}{task.kpi?.score ?? task.points} pts</strong><small>{task.kpi?.scoringStatus}</small></div></div><div className="task-detail-section"><h3>Task description</h3><p>{task.description || task.note || "Complete the assigned work according to the agreed requirements and submit it for review before the deadline."}</p></div><div className="task-detail-section"><h3>Submission attachments <span className="optional-label">Optional</span></h3>{task.attachmentName && <div className="existing-attachment">📎 <span>{task.attachmentName}</span><small>Attached to task</small></div>}<AttachmentPicker file={file} onChange={setFile} /><label className="field repo-field">GitHub repository <span className="optional-label">Optional</span><input type="url" value={githubRepo} onChange={(event) => setGithubRepo(event.target.value)} placeholder="https://github.com/owner/repository" /></label></div><div className="task-detail-section"><h3>Work logs</h3><div className="work-started"><span className="work-started-dot" />Task created at {new Date(task.taskCreatedAt).toLocaleString("en-BD", { timeZone: "Asia/Dhaka" })}</div>{task.startedAt ? <div className="work-started"><span className="work-started-dot" />Work started at {formatTime(task.startedAt)}</div> : <div className="detail-empty">Work has not been started yet.</div>}</div>{canReview && task.status === "review" ? <div className="task-detail-actions"><Button variant="secondary" onClick={() => { onReview(task.id, false); onClose(); }}>Request rework</Button><Button onClick={() => { onReview(task.id, true); onClose(); }}>Approve</Button></div> : delegatedLock ? <div className="detail-empty">This task is delegated to a teammate. Manage it from the delegation request.</div> : task.status !== "review" && task.status !== "handoff" && task.status !== "approved" && <div className="task-detail-actions">{canDelegate && <Button variant="secondary" icon="users" onClick={() => onDelegate(task)}>Delegate task</Button>}{task.status === "todo" && <Button variant="green" icon="clock" onClick={() => onStart(task.id)}>Start work</Button>}<Button onClick={submitForReview}>Submit for review</Button></div>}</section></div>;
}

function DelegationModal({ task, employees, currentEmployeeId, onClose, onSubmit }) {
  const teammates = employees.filter((employee) => employee.id !== currentEmployeeId);
  const [form, setForm] = useState({ employeeId: teammates[0]?.id || "", title: `${task.title} — delegated work`, details: "" });
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = (event) => { event.preventDefault(); if (!form.details.trim() || !form.employeeId) return; onSubmit({ ...form, details: form.details.trim() }); };
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal delegation-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><div><Badge tone="purple">Task delegation</Badge><h2>Delegate part of this task</h2><p>Send a request to a teammate. A manager will set the KPI points during approval.</p></div><button className="close-button" onClick={onClose}>×</button></div><div className="delegation-parent"><strong>{task.id} · {task.title}</strong><span>Parent KPI: +{task.points} pts · Delegated KPI will be set by the manager</span></div><form onSubmit={submit}><div className="form-grid"><label className="field full">Assign to teammate<select value={form.employeeId} onChange={update("employeeId")}>{teammates.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.department}</option>)}</select></label><label className="field full">Subtask title<input required value={form.title} onChange={update("title")} /></label><label className="field full">Work to delegate<textarea required value={form.details} onChange={update("details")} placeholder="Explain the exact part, expected output, and handoff requirements" /></label></div><div className="modal-footer"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" icon="arrow">Send delegation request</Button></div></form></section></div>;
}

function EmployeeDashboard({ employee, employees = [], tasks, onStart, onSubmit, onOpen, setPage, attendance, onCheckIn, onCheckOut }) {
  const points = employee.points, level = levelFor(points), kpi = kpiFor(employee), mine = tasks.filter((task) => task.employeeId === employee.id), teamAverage = employees.length ? employees.reduce((sum, person) => sum + kpiFor(person), 0) / employees.length : 0;
  const openTasks = mine.filter((task) => task.status !== "approved").length;
  const dueThisWeek = mine.filter((task) => { if (task.status === "approved" || !task.deadline) return false; const due = new Date(task.deadline); const now = new Date(); const start = new Date(now); start.setDate(now.getDate() - now.getDay()); start.setHours(0, 0, 0, 0); const end = new Date(start); end.setDate(start.getDate() + 7); return due >= start && due < end; }).length;
  const isToday = attendance.date === todayKey(), active = isToday && attendance.checkIn && !attendance.checkOut, completed = isToday && attendance.checkIn && attendance.checkOut;
  return <><Header title={`Good morning, ${employee.name.split(" ")[0]} 👋`} subtitle="Here's what's happening with your work today." onMenu={() => {}} notifications={openTasks} /><section className="welcome-strip"><div className="attendance-day"><strong>{formatDate()}</strong><div className="attendance-status"><Badge tone={active || completed ? "green" : "neutral"}>{active ? "● Checked in" : completed ? "● Day complete" : "● Not checked in"}</Badge>{attendance.checkIn && isToday && <span>Since {formatTime(attendance.checkIn)}</span>}</div></div><div className="attendance-actions">{active ? <Button variant="secondary" onClick={onCheckOut}>Check out</Button> : <Button variant={completed ? "danger" : "primary"} onClick={onCheckIn} disabled={completed}>{completed ? "Checked out" : "Check in"}</Button>}</div></section><div className="stats-grid"><StatCard label="To do" value={mine.filter((t) => t.status === "todo").length} note={`${dueThisWeek} due this week`} icon="tasks" /><StatCard label="In progress" value={mine.filter((t) => t.status === "progress").length} note="Keep it up!" icon="chart" tone="orange" /><StatCard label="KPI score" value={kpi.toFixed(1)} note="Weighted W2G score" icon="chart" tone="purple" /><StatCard label="Growth points" value={points} note={`Level ${level.index + 1} · ${level.title}`} icon="users" tone="green" /></div><div className="content-grid"><section className="panel"><div className="panel-header"><div><h2>Your tasks</h2><p>Stay on top of your assigned work.</p></div><button className="link-button" onClick={() => setPage("tasks")}>View all <Icon name="arrow" /></button></div><div className="task-list">{mine.filter((t) => t.status !== "approved").slice(0, 3).map((task) => <TaskCard key={task.id} task={task} onOpen={onOpen} onStart={onStart} onSubmit={onSubmit} />)}</div></section><section className="panel growth-panel"><div className="panel-header"><div><h2>Your growth</h2><p>W2G performance overview.</p></div><button className="link-button" onClick={() => setPage("performance")}>Details <Icon name="arrow" /></button></div><div className="growth-score"><div className="score-ring"><strong>{kpi.toFixed(0)}</strong><small>/ 100</small></div><div><strong>{kpi >= teamAverage ? "Great progress!" : "Keep pushing!"}</strong><p>Your score is {kpi >= teamAverage ? "above" : "below"} the team average of {teamAverage.toFixed(1)}.</p></div></div><div className="metric-list">{dimensions.map(([name, weight], i) => <div className="metric" key={name}><div><span>{name}</span><b>{employee.scores?.[i] ?? 0}</b></div><ProgressBar value={employee.scores?.[i] ?? 0} color={i === 1 ? "purple" : "blue"} /><small>Weight {weight}%</small></div>)}</div></section></div></>;
}

function TasksPage({ tasks, employees, role, employee, delegationRequests = [], onDelegation, onStart, onSubmit, onCreate, onOpen, onReview }) {
  const [query, setQuery] = useState("");
  const [selectedDelegation, setSelectedDelegation] = useState(null);
  const filtered = tasks.filter((task) => (role === "employee" ? task.employeeId === employee.id || ((task.status === "review" || task.status === "approved") && task.reviewerId === employee.id) : true) && `${task.title} ${task.id}`.toLowerCase().includes(query.toLowerCase()));
  const columns = role === "manager" ? [["todo", "To do"], ["delegation", "Delegation requests"], ["review", "Pending review"]] : [["todo", "To do"], ["progress", "In progress"], ["review", "Submitted"]];
  const pendingDelegations = delegationRequests.filter((request) => request.status === "pending");
  const tasksForColumn = (status) => filtered.filter((task) => status === "review" && role === "employee" ? task.status === "review" || task.status === "approved" : task.status === status);
  return <><Header title={role === "employee" ? "My tasks" : "All tasks"} subtitle={role === "employee" ? "Manage your work and keep moving forward." : "Monitor work and review employee delegation requests."} onMenu={() => {}} onCreate={role === "manager" ? onCreate : null} notifications={role === "manager" ? tasks.filter((task) => task.status === "review").length + pendingDelegations.length : tasks.filter((task) => task.employeeId === employee.id && task.status !== "approved").length} /><div className="toolbar"><div className="search"><span>⌕</span><input placeholder="Search tasks..." value={query} onChange={(e) => setQuery(e.target.value)} /></div><select><option>All priorities</option><option>Critical</option><option>High</option><option>Medium</option></select><button className="filter-button">☷ Filters</button></div><div className="kanban">{columns.map(([status, title]) => <section className="kanban-column" key={status}><div className="column-heading"><h2>{title}</h2><span>{status === "delegation" ? delegationRequests.length : tasksForColumn(status).length}</span></div>{status === "delegation" ? delegationRequests.map((request) => <DelegationRequestCard key={request.id} request={request} employees={employees} onOpen={setSelectedDelegation} />) : tasksForColumn(status).map((task) => <div className="kanban-task" key={task.id}><TaskCard task={task} onOpen={onOpen} employeeName={role === "manager" ? employees.find((e) => e.id === task.employeeId)?.name : null} onStart={role === "employee" ? onStart : null} onSubmit={role === "employee" ? onSubmit : null} /></div>)}{status !== "delegation" && !tasksForColumn(status).length && <div className="empty-column">No tasks here</div>}{status === "delegation" && !delegationRequests.length && <div className="empty-column">No delegation requests</div>}</section>)}</div>{selectedDelegation && <DelegationDetails request={selectedDelegation} employees={employees} onClose={() => setSelectedDelegation(null)} onApprove={(id, points) => onDelegation?.(id, true, points)} onReject={(id) => onDelegation?.(id, false)} />}</>;
}

function PerformancePage({ employee, employees = [], tasks = [], title = "My performance" }) {
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState("");
  useEffect(() => {
    let active = true;
    const load = () => {
      api.performance.get(employee.id)
        .then((data) => { if (active) { setProfile(data); setProfileError(""); } })
        .catch((error) => { if (active) setProfileError(error.message); });
    };
    load();
    const refresh = () => { if (document.visibilityState === "visible") load(); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { active = false; window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [employee.id, employee.points, employee.scores?.[1]]);
  const points = profile?.points ?? employee.points;
  const scores = profile?.scores ?? employee.scores ?? [0, 0, 0, 0, 0];
  const kpi = dimensions.reduce((total, [, weight], index) => total + Number(scores[index] || 0) * weight / 100, 0);
  const activity = (profile?.ledger ?? []).map((item, index) => ({ id: `${item.createdAt}-${index}`, title: item.reason, reason: "Task approved", date: new Date(item.createdAt).toLocaleString(), value: Number(item.value) }));
  const approvedTasks = tasks.filter((task) => task.employeeId === employee.id && task.status === "approved");
  const ranked = [...employees].sort((a, b) => kpiFor(b) - kpiFor(a));
  const rank = ranked.findIndex((person) => person.id === employee.id) + 1;
  const rankNote = rank > 0 ? `Top ${Math.max(1, Math.round((rank / Math.max(1, ranked.length)) * 100))}% of team` : "Team ranking";
  const level = levelFor(points), next = level.next, progress = next ? ((points - levels[level.index][0]) / (next[0] - levels[level.index][0])) * 100 : 100;
  return <><Header title={title} subtitle="See how your work is building your professional growth." onMenu={() => {}} notifications={tasks.filter((task) => task.employeeId === employee.id && task.status !== "approved").length} />{profileError && <div className="detail-empty">{profileError}</div>}<div className="stats-grid"><StatCard label="KPI score" value={kpi.toFixed(1)} note="Weighted across 5 dimensions" icon="chart" tone="purple" /><StatCard label="Growth points" value={points} note={`${approvedTasks.length} approved task${approvedTasks.length === 1 ? "" : "s"}`} icon="users" tone="green" /><StatCard label="Current level" value={`L${level.index + 1}`} note={level.title} icon="check" /><StatCard label="Rank in team" value={rank > 0 ? `#${rank}` : "—"} note={rankNote} icon="chart" tone="orange" /></div><div className="performance-grid"><section className="panel"><div className="panel-header"><div><h2>W2G score breakdown</h2><p>Weighted across five performance dimensions.</p></div><Badge tone={kpi >= 85 ? "green" : kpi >= 70 ? "blue" : "orange"}>{kpi >= 85 ? "Excellent" : kpi >= 70 ? "On track" : "Needs focus"}</Badge></div>{dimensions.map(([name, weight], i) => <div className="score-row" key={name}><div className="score-label"><span>{name}</span><small>{weight}% weight</small><b>{scores[i]}</b></div><ProgressBar value={scores[i]} color={i === 1 ? "purple" : "blue"} /></div>)}</section><section className="panel level-panel"><div className="panel-header"><div><h2>Growth level</h2><p>Keep earning points to level up.</p></div><span className="level-badge">L{level.index + 1}</span></div><div className="level-title">{level.title}</div><p className="muted">{points} points <span>•</span> {next ? `${next[0] - points} points to ${next[1]}` : "Highest level reached"}</p><ProgressBar value={progress} color="green" /><div className="level-markers"><span>L{level.index + 1}<small>{levels[level.index][0]}</small></span>{next && <span>L{level.index + 2}<small>{next[0]}</small></span>}</div></section></div><section className="panel activity-panel"><div className="panel-header"><div><h2>Recent point activity</h2><p>Every transaction is recorded in your growth ledger.</p></div><button className="link-button">View full history <Icon name="arrow" /></button></div>{activity.length ? activity.map((item) => <div className="activity-row" key={item.id}><span className="activity-icon"><Icon name="check" /></span><div><strong>{item.title}</strong><small>{item.reason} · {item.date}</small></div><b className={item.value > 0 ? "positive" : "negative"}>{item.value > 0 ? "+" : ""}{item.value}</b></div>) : <div className="detail-empty">No transactions yet. Complete a task to earn points.</div>}</section></>;
}

function HrAnalyticsPage({ employees }) {
  const [department, setDepartment] = useState("All departments");
  const departments = ["All departments", ...new Set(employees.map((employee) => employee.department))];
  const visibleEmployees = employees.filter((employee) => department === "All departments" || employee.department === department).sort((a, b) => kpiFor(b) - kpiFor(a));
  const averageKpi = visibleEmployees.reduce((sum, employee) => sum + kpiFor(employee), 0) / (visibleEmployees.length || 1);
  const exportCsv = () => {
    const rows = [["Employee", "Email", "Department", "KPI", ...dimensions.map(([name]) => name), "Growth points", "Level"], ...visibleEmployees.map((person) => [person.name, person.email, person.department, kpiFor(person).toFixed(1), ...person.scores, person.points, levelFor(person.points).title])];
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `zippio-performance-${todayKey()}.csv`; link.click(); URL.revokeObjectURL(url);
  };
  const departmentStats = [...new Set(employees.map((employee) => employee.department))].map((name) => {
    const members = employees.filter((employee) => employee.department === name);
    return { name, count: members.length, score: members.reduce((sum, employee) => sum + kpiFor(employee), 0) / members.length };
  }).sort((a, b) => b.score - a.score);
  return <><Header title="Performance & analytics" subtitle="Compare performance across every department and employee." onMenu={() => {}} notifications={0} /><div className="analytics-toolbar"><div><Badge tone="blue">{department.toUpperCase()}</Badge><p>Organization-wide performance snapshot</p></div><select value={department} onChange={(event) => setDepartment(event.target.value)}>{departments.map((name) => <option key={name}>{name}</option>)}</select></div><div className="stats-grid"><StatCard label="Employees tracked" value={visibleEmployees.length} note="Current active employee records" icon="users" /><StatCard label="Average KPI score" value={averageKpi.toFixed(1)} note="Weighted across five dimensions" icon="chart" tone="purple" /><StatCard label="Top performer" value={visibleEmployees[0]?.name?.split(" ")[0] || "—"} note={visibleEmployees[0] ? `${kpiFor(visibleEmployees[0]).toFixed(1)} KPI score` : "No employees"} icon="check" tone="green" /><StatCard label="Departments" value={department === "All departments" ? departmentStats.length : 1} note="Based on employee profiles" icon="grid" /></div><section className="panel department-performance"><div className="panel-header"><div><h2>Department performance</h2><p>Average KPI score and employee distribution by department.</p></div><Badge tone="purple">KPI overview</Badge></div><div className="department-performance-grid">{departmentStats.map((item) => <button className={`department-performance-card ${department === item.name ? "selected" : ""}`} key={item.name} onClick={() => setDepartment(item.name)}><div className="department-card-top"><strong>{item.name}</strong><span>{item.count} employee{item.count > 1 ? "s" : ""}</span></div><div className="department-kpi">{item.score.toFixed(1)}<small>/ 100</small></div><ProgressBar value={item.score} color={item.score >= 85 ? "green" : "purple"} /><div className="department-card-footer"><span>{item.score >= 85 ? "High performing" : "Needs focus"}</span><Icon name="arrow" /></div></button>)}</div></section><section className="panel employee-performance"><div className="panel-header"><div><h2>Employee performance</h2><p>Individual KPI score and W2G dimensions for {department}.</p></div><button className="link-button" onClick={exportCsv}>Export report <Icon name="arrow" /></button></div><div className="table-wrap"><table><thead><tr><th>Employee</th><th>Department</th><th>KPI score</th>{dimensions.map(([name]) => <th key={name}>{name}</th>)}<th>Level</th></tr></thead><tbody>{visibleEmployees.map((employee, index) => <tr key={employee.id}><td><div className="table-person"><span className="avatar">{employee.initials}</span><div><strong>{index + 1}. {employee.name}</strong><small>{employee.title}</small></div></div></td><td>{employee.department}</td><td><strong className="kpi-number">{kpiFor(employee).toFixed(1)}</strong></td>{employee.scores.map((score, scoreIndex) => <td key={`${employee.id}-${scoreIndex}`}><div className="score-cell"><span>{score}</span><ProgressBar value={score} color={score >= 85 ? "green" : score >= 75 ? "purple" : "blue"} /></div></td>)}<td><Badge tone="purple">{levelFor(employee.points).title}</Badge></td></tr>)}</tbody></table></div></section></>;
}

function AttendancePage({ employee, attendance, onCheckIn, onCheckOut }) {
  const isToday = attendance.date === todayKey(), active = isToday && attendance.checkIn && !attendance.checkOut, completed = isToday && attendance.checkIn && attendance.checkOut;
  const weekStart = new Date(); weekStart.setHours(0, 0, 0, 0); weekStart.setDate(weekStart.getDate() - 6);
  const weekRows = (employee.attendance || []).filter((row) => { const day = new Date(`${row.date}T00:00:00`); return day >= weekStart && row.in && row.in !== "—"; });
  const weekDays = new Set(weekRows.map((row) => row.date)).size;
  const weekPercent = Math.min(100, Math.round((weekDays / 5) * 100));
  return <><Header title="Attendance" subtitle="Track your working sessions and attendance history." onMenu={() => {}} notifications={active ? 1 : 0} /><div className="attendance-hero"><div><div className="attendance-day"><strong>{formatDate()}</strong><Badge tone={active || completed ? "green" : "neutral"}>{active ? "● Checked in" : completed ? "● Day complete" : "● Not checked in"}</Badge></div><h2>{active ? "You're having a productive day." : completed ? "Your session has ended." : "Start your work session."}</h2><p>{active ? "Remember to check out when you finish work." : completed ? "You cannot check in again on the same day." : "Check in when you start work."}</p></div><div className="attendance-actions">{active ? <Button variant="secondary" onClick={onCheckOut}>Check out</Button> : <Button variant={completed ? "danger" : "primary"} onClick={onCheckIn} disabled={completed}>{completed ? "Checked out" : "Check in"}</Button>}</div></div><div className="stats-grid"><StatCard label="Check in" value={isToday ? formatTime(attendance.checkIn) : "—"} note="Today's session" icon="clock" tone="green" /><StatCard label="Check out" value={isToday ? formatTime(attendance.checkOut) : "—"} note={active ? "Still working" : completed ? "Session complete" : "Not started"} icon="clock" /><StatCard label="This week" value={`${weekDays} / 5 days`} note={`${weekPercent}% attendance`} icon="check" tone="purple" /></div><section className="panel"><div className="panel-header"><div><h2>Attendance history</h2><p>Your recent check-in and check-out records.</p></div><select><option>Last 30 days</option><option>This month</option></select></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Check in</th><th>Check out</th><th>Duration</th><th>Status</th></tr></thead><tbody>{(employee.attendance || []).map((row) => <tr key={row.date}><td><strong>{row.date}</strong></td><td>{row.in}</td><td>{row.out || "Active"}</td><td>{row.duration}</td><td><Badge tone={row.status === "Present" ? "green" : "orange"}>{row.status}</Badge></td></tr>)}</tbody></table></div></section></>;
}

function LeavePage({ employee, isHr = false, employees = [], leaveRequests = [], leaveTypes = [], attendanceRows = [], onCreate, onReview }) {
  const [form, setForm] = useState({ leaveTypeId: leaveTypes[0]?.id || "", from: todayKey(), to: todayKey(), reason: "" });
  const [department, setDepartment] = useState("All departments");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const myRequests = leaveRequests.filter((request) => isHr || request.employee_code === employee?.id);
  const visibleRequests = myRequests.filter((request) => department === "All departments" || employees.find((person) => person.id === request.employee_code)?.department === department);
  const today = todayKey();
  const present = new Set(attendanceRows.filter((row) => attendanceDate(row.work_date) === today && row.check_in).map((row) => row.employee_code)).size;
  const onLeave = leaveRequests.filter((row) => row.status === "Approved" && row.start_date <= today && row.end_date >= today).length;
  const pending = isHr ? leaveRequests.filter((row) => row.status === "Pending approval").length : myRequests.filter((row) => row.status === "Pending approval").length;
  const submit = async (event) => {
    event.preventDefault(); setError(""); setSaving(true);
    try { await onCreate({ startDate: form.from, endDate: form.to, reason: form.reason.trim(), leaveTypeId: form.leaveTypeId || undefined }); setForm((current) => ({ ...current, reason: "" })); }
    catch (requestError) { setError(requestError.message); }
    finally { setSaving(false); }
  };
  const dateLabel = (row) => `${new Date(`${row.start_date}T00:00:00`).toLocaleDateString()}${row.start_date === row.end_date ? "" : ` – ${new Date(`${row.end_date}T00:00:00`).toLocaleDateString()}`}`;
  return <><Header title={isHr ? "Attendance & leave" : "Apply leave"} subtitle={isHr ? "Manage leave requests and today's attendance." : "Request time off and track your leave history."} onMenu={() => {}} notifications={pending} /><div className="stats-grid"><StatCard label={isHr ? "Present today" : "Leave requests"} value={isHr ? `${present} / ${employees.length}` : myRequests.length} note={isHr ? "Employees checked in" : "Your submitted requests"} icon="check" tone="green" /><StatCard label={isHr ? "On leave today" : "Approved requests"} value={isHr ? onLeave : myRequests.filter((row) => row.status === "Approved").length} note="Current approved leave" icon="calendar" tone="purple" /><StatCard label="Pending approvals" value={pending} note="Needs attention" icon="clock" tone="orange" /></div>{!isHr && <section className="panel leave-form-panel"><div className="panel-header"><div><h2>New leave request</h2><p>Tell your manager when and why you need time off.</p></div></div>{error && <p className="auth-error" role="alert">{error}</p>}<form className="leave-form" onSubmit={submit}><label className="field">Leave type<select required value={form.leaveTypeId} onChange={update("leaveTypeId")}><option value="">Select leave type</option>{leaveTypes.map((type) => <option key={type.id} value={type.id}>{type.name} · {type.annualDays} days/year</option>)}</select></label><label className="field">Start date<input type="date" required min={today} value={form.from} onChange={update("from")} /></label><label className="field">End date<input type="date" required min={form.from} value={form.to} onChange={update("to")} /></label><label className="field full">Reason<textarea value={form.reason} onChange={update("reason")} placeholder="Add a short reason for your leave request" required /></label><div className="form-submit full"><Button type="submit" disabled={saving || !leaveTypes.length} icon="arrow">{saving ? "Submitting…" : "Submit leave request"}</Button></div></form></section>}<section className="panel"><div className="panel-header"><div><h2>{isHr ? "Leave requests" : "My leave history"}</h2><p>{isHr ? "Review requests across the organization." : "Your previous and pending leave requests."}</p></div>{isHr && <select value={department} onChange={(event) => setDepartment(event.target.value)}><option>All departments</option>{[...new Set(employees.map((person) => person.department).filter(Boolean))].map((name) => <option key={name}>{name}</option>)}</select>}</div><div className="table-wrap"><table><thead><tr>{isHr && <th>Employee</th>}<th>Leave type</th><th>Date</th><th>Reason</th><th>Status</th>{isHr && <th>Decision</th>}</tr></thead><tbody>{visibleRequests.map((row) => { const person = employees.find((item) => item.id === row.employee_code); return <tr key={row.id}>{isHr && <td>{person?.name || row.employee_name || "Employee"}<small className="table-subtext">{person?.department || ""}</small></td>}<td>{row.leave_type || "Leave"}</td><td>{dateLabel(row)}</td><td>{row.reason}</td><td><Badge tone={row.status === "Approved" ? "green" : row.status === "Rejected" ? "red" : "orange"}>{row.status}</Badge></td>{isHr && <td>{row.status === "Pending approval" ? <div className="review-row-actions"><button className="small-button small-button-approve" onClick={() => onReview(row.id, "Approved")}>Approve</button><button className="small-button small-button-reject" onClick={() => onReview(row.id, "Rejected")}>Reject</button></div> : "—"}</td>}</tr>; })}{!visibleRequests.length && <tr><td colSpan={isHr ? 6 : 4}><div className="detail-empty">No leave requests found.</div></td></tr>}</tbody></table></div></section>{isHr && <section className="panel attendance-overview-panel"><div className="panel-header"><div><h2>Today's attendance</h2><p>Attendance records for {formatDate()}.</p></div></div><div className="table-wrap"><table><thead><tr><th>Employee</th><th>Department</th><th>Check in</th><th>Check out</th><th>Status</th></tr></thead><tbody>{attendanceRows.filter((row) => attendanceDate(row.work_date) === today).map((row) => { const person = employees.find((item) => item.id === row.employee_code); return <tr key={row.id}><td>{person?.name || row.employee_code}</td><td>{person?.department || "—"}</td><td>{formatTime(row.check_in)}</td><td>{formatTime(row.check_out)}</td><td>{row.check_out ? "Checked out" : row.check_in ? "Working" : "No check-in"}</td></tr>; })}{!attendanceRows.some((row) => attendanceDate(row.work_date) === today) && <tr><td colSpan="5"><div className="detail-empty">No attendance records for today.</div></td></tr>}</tbody></table></div></section>}</>;
}

function ManagerDashboard({ tasks, employees, setPage, onCreate, attendance, attendanceRows = [], leaveRequests = [], managerName = "Manager", onReview, delegationRequests = [], onDelegation }) {
  const pending = tasks.filter((t) => t.status === "review");
  const pendingDelegations = delegationRequests.filter((request) => request.status === "pending");
  const today = todayKey();
  const todayRows = attendanceRows.filter((row) => attendanceDate(row.work_date) === today && row.check_in).sort((a, b) => new Date(b.check_in) - new Date(a.check_in));
  const presentCount = todayRows.length;
  const presentPercent = employees.length ? Math.round((presentCount / employees.length) * 100) : 0;
  const leaveToday = leaveRequests.filter((row) => row.status === "Approved" && row.start_date <= today && row.end_date >= today).length;
  const departmentCount = new Set(employees.map((employee) => employee.department).filter(Boolean)).size;
  const [selectedDelegation, setSelectedDelegation] = useState(null);
  return <><Header title={`Good morning, ${managerName.split(" ")[0]}`} subtitle="Here's your team's pulse for today." onMenu={() => {}} onCreate={onCreate} notifications={pending.length} /><section className="manager-hero"><div><Badge tone="light">TEAM OVERVIEW</Badge><h2>Make progress visible.</h2><p>Track work, coach your team, and turn performance into growth.</p></div><div className="hero-orb">↗</div></section><div className="stats-grid manager-stats"><StatCard label="Total employees" value={employees.length} note={`${departmentCount} departments`} icon="users" /><StatCard label="Present today" value={`${presentCount} / ${employees.length}`} note={`${presentPercent}% attendance - ${leaveToday} on leave`} icon="check" tone="green" /><StatCard label="Active tasks" value={tasks.filter((t) => t.status === "progress").length} note="Across all teams" icon="tasks" tone="orange" /><StatCard label="Pending reviews" value={pending.length} note="Needs your attention" icon="clock" tone="purple" /></div><section className="panel live-attendance-panel"><div className="panel-header"><div><h2>Live attendance</h2><p>Check-in and check-out activity from your team.</p></div><Badge tone="green">Live</Badge></div>{todayRows.length ? todayRows.map((row) => { const person = employees.find((employee) => employee.id === row.employee_code); return <div className="live-attendance-row" key={row.id}><span className="avatar">{person?.initials || "EM"}</span><div><strong>{person?.name || row.employee_code}</strong><small>Checked in at {formatTime(row.check_in)}</small></div><Badge tone={row.check_out ? "neutral" : "green"}>{row.check_out ? `Checked out ${formatTime(row.check_out)}` : "Working now"}</Badge></div>; }) : <p className="detail-empty">No attendance check-ins recorded today.</p>}</section><div className="content-grid manager-content"><section className="panel"><div className="panel-header"><div><h2>Team performance</h2><p>Current KPI score by employee.</p></div><button className="link-button" onClick={() => setPage("employees")}>View team <Icon name="arrow" /></button></div>{employees.map((emp) => <div className="team-row" key={emp.id}><span className="avatar">{emp.initials}</span><div className="team-name"><strong>{emp.name}</strong><small>{emp.title}</small></div><div className="team-progress"><ProgressBar value={kpiFor(emp)} /><small>{kpiFor(emp).toFixed(1)} KPI</small></div><Badge tone={kpiFor(emp) > 85 ? "green" : "orange"}>{kpiFor(emp) > 85 ? "On track" : "Needs focus"}</Badge></div>)}</section><section className="panel"><div className="panel-header"><div><h2>Needs your review</h2><p>Recent task submissions.</p></div><button className="link-button" onClick={() => setPage("reviews")}>See queue <Icon name="arrow" /></button></div>{pending.slice(0, 3).map((task) => <div className="review-row" key={task.id}><span className="avatar">{employees.find((e) => e.id === task.employeeId)?.initials}</span><div><strong>{task.title}</strong><small>{employees.find((e) => e.id === task.employeeId)?.name} · {task.id}</small></div><div className="review-row-actions"><button className="small-button small-button-reject" onClick={() => onReview(task.id, false)}>Reject</button><button className="small-button small-button-approve" onClick={() => onReview(task.id, true)}>Approve</button></div></div>)}{!pending.length && <div className="empty-column">All caught up.</div>}</section></div><section className="panel delegation-dashboard-panel"><div className="panel-header"><div><h2>Delegation requests</h2><p>Approve or reject work your team wants to hand off.</p></div><Badge tone="orange">{pendingDelegations.length} pending</Badge></div><div className="delegation-dashboard-grid">{delegationRequests.slice(0, 4).map((request) => <DelegationRequestCard key={request.id} request={request} employees={employees} onOpen={setSelectedDelegation} />)}{!delegationRequests.length && <div className="empty-column">No delegation requests.</div>}</div></section>{selectedDelegation && <DelegationDetails request={selectedDelegation} employees={employees} onClose={() => setSelectedDelegation(null)} onApprove={(id, points) => onDelegation?.(id, true, points)} onReject={(id) => onDelegation?.(id, false)} />}</>;
}

function CreateEmployeeModal({ employees, onClose, onCreate }) {
  const departments = [...new Set(employees.map((employee) => employee.department).filter(Boolean))];
  const [form, setForm] = useState({ name: "", email: "", password: "", employeeCode: "", title: "Employee", department: "", status: "active" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onCreate({ ...form, employeeCode: form.employeeCode.trim() || undefined, department: form.department.trim() || undefined });
      onClose();
    } catch (requestError) {
      setError(requestError.message || "Could not create the employee.");
    } finally {
      setSaving(false);
    }
  };
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="modal" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><div><h2>Create employee</h2><p>Add a profile and login account for a new team member.</p></div><button type="button" className="close-button" onClick={onClose}>x</button></div><div className="form-grid"><label className="field full">Full name<input autoFocus required minLength="2" value={form.name} onChange={update("name")} placeholder="e.g. Ayesha Karim" /></label><label className="field">Work email<input type="email" required value={form.email} onChange={update("email")} placeholder="name@company.com" /></label><label className="field">Temporary password<input type="password" required minLength="8" value={form.password} onChange={update("password")} placeholder="At least 8 characters" /></label><label className="field">Employee code<input value={form.employeeCode} onChange={update("employeeCode")} placeholder="Auto-generated (e.g. e4)" /></label><label className="field">Job title<select value={form.title} onChange={update("title")}><option value="Employee">Employee</option><option value="Manager">Manager</option><option value="Team lead">Team lead</option></select></label><label className="field">Department<input list="create-employee-departments" value={form.department} onChange={update("department")} placeholder="e.g. Engineering" /><datalist id="create-employee-departments">{departments.map((name) => <option key={name} value={name} />)}</datalist></label><label className="field">Status<select value={form.status} onChange={update("status")}><option value="active">Active</option><option value="on_leave">On leave</option><option value="inactive">Inactive</option></select></label></div>{error && <p className="auth-error" role="alert">{error}</p>}<p className="detail-empty">Employees sign in with their employee code; Managers and Team leads sign in with their work email. Team leads get the same workspace access as Managers.</p><div className="modal-footer"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Creating..." : "Create employee"}</Button></div></form></div>;
}

function EmployeesPage({ employees, showCreate = false, onCreate }) {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("All departments");
  const departments = [...new Set(employees.map((employee) => employee.department).filter(Boolean))];
  const visible = employees.filter((employee) => (department === "All departments" || employee.department === department) && `${employee.name} ${employee.email} ${employee.department}`.toLowerCase().includes(query.toLowerCase()));
  return <><Header title="Employees" subtitle="Your team at a glance." onMenu={() => {}} notifications={0} /><div className="toolbar"><div className="search"><span>⌕</span><input placeholder="Search employees..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><select value={department} onChange={(event) => setDepartment(event.target.value)}><option>All departments</option>{departments.map((name) => <option key={name}>{name}</option>)}</select>{showCreate && <Button icon="plus" onClick={onCreate}>Create employee</Button>}</div><section className="panel"><div className="table-wrap"><table><thead><tr><th>Employee</th><th>Job title</th><th>Department</th><th>KPI score</th><th>Growth points</th><th>Level</th><th>Status</th></tr></thead><tbody>{visible.map((emp) => <tr key={emp.id}><td><div className="table-person"><span className="avatar">{emp.initials}</span><div><strong>{emp.name}</strong><small>{emp.email}</small></div></div></td><td>{emp.title || "Employee"}</td><td>{emp.department || "—"}</td><td><strong>{kpiFor(emp).toFixed(1)}</strong></td><td>{emp.points}</td><td><Badge tone="purple">{levelFor(emp.points).title}</Badge></td><td><Badge tone={emp.status === "Inactive" ? "orange" : emp.status === "On leave" ? "blue" : "green"}>{emp.status || "Active"}</Badge></td></tr>)}{!visible.length && <tr><td colSpan="7"><div className="detail-empty">No employees match your search.</div></td></tr>}</tbody></table></div></section></>;
}

function ReviewPage({ tasks, employees, delegationRequests, onReview, onDelegation }) {
  const pending = tasks.filter((task) => task.status === "review");
  const pendingDelegations = delegationRequests.filter((request) => request.status === "pending");
  const [delegatedPoints, setDelegatedPoints] = useState({});
  const [ratings, setRatings] = useState({});
  const approveDelegation = (request) => {
    const points = Number(delegatedPoints[request.id]);
    if (!Number.isFinite(points) || points < 1 || points > request.parentPoints) return;
    onDelegation(request.id, true, points);
  };
  return <><Header title="Review queue" subtitle="Review submitted work and delegation requests before points become final." onMenu={() => {}} notifications={pending.length + pendingDelegations.length} />{pendingDelegations.length > 0 && <section className="review-list delegation-review-list"><div className="section-heading"><div><h2>Delegation requests</h2><p>Approve the work split and set the KPI points before the teammate receives a subtask.</p></div><Badge tone="orange">{pendingDelegations.length} pending</Badge></div>{pendingDelegations.map((request) => <article className="review-card delegation-review-card" key={request.id}><div className="review-card-top"><div><Badge tone="orange">Approval needed</Badge><h2>{request.title}</h2><p>{employees.find((e) => e.id === request.fromEmployeeId)?.name} wants to delegate to {employees.find((e) => e.id === request.toEmployeeId)?.name}</p></div><span className="task-points">Parent +{request.parentPoints} pts</span></div><div className="submission-note"><strong>Delegated work</strong><p>{request.details}</p><small>Parent task: {request.parentTaskId} · Manager assigns the subtask KPI here.</small></div><div className="delegation-kpi-review"><label className="field">Delegated KPI points<input type="number" min="1" max={request.parentPoints} required value={delegatedPoints[request.id] || ""} onChange={(event) => setDelegatedPoints((current) => ({ ...current, [request.id]: event.target.value }))} placeholder={`1–${request.parentPoints}`} /></label><small>Must be between 1 and the parent task's {request.parentPoints} points.</small></div><div className="review-actions"><Button variant="secondary" onClick={() => onDelegation(request.id, false)}>Reject</Button><Button onClick={() => approveDelegation(request)}>Approve delegation</Button></div></article>)}</section>}{pending.length > 0 && <div className="review-list"><div className="section-heading"><div><h2>Task submissions</h2><p>Review completed work before points become final.</p></div></div>{pending.map((task) => <article className="review-card" key={task.id}><div className="review-card-top"><div><Badge tone="purple">Pending review</Badge><h2>{task.title}</h2><p>{employees.find((e) => e.id === task.employeeId)?.name} · {task.id}</p></div><span className="task-points">+{task.points} pts</span></div><div className="submission-note"><strong>Completion notes</strong><p>{task.note || "All assigned requirements have been completed. Please review the attached work."}</p></div><div className="review-actions"><label className="field">Quality rating<select value={ratings[task.id] || "4"} onChange={(event) => setRatings((current) => ({ ...current, [task.id]: event.target.value }))}><option value="5">5 — Exceptional</option><option value="4">4 — Strong</option><option value="3">3 — Meets expectations</option><option value="2">2 — Needs improvement</option></select></label><div><Button variant="secondary" onClick={() => onReview(task.id, false)}>Request rework</Button><Button onClick={() => onReview(task.id, true, Number(ratings[task.id] || 4))}>Approve</Button></div></div></article>)}</div>}{!pending.length && !pendingDelegations.length && <div className="panel empty-state"><span className="empty-check">✓</span><h2>You're all caught up</h2><p>No pending reviews or delegation requests.</p></div>}</>;
}

function RequestStatus({ status }) {
  const tone = status === "Completed" ? "green" : status === "In progress" ? "blue" : "orange";
  return <Badge tone={tone}>{status}</Badge>;
}

function RequestDetails({ request, onClose, onUpdate, onAddComment }) {
  const [status, setStatus] = useState(request.status);
  const [progress, setProgress] = useState(request.progress ?? 0);
  const [comments, setComments] = useState([]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.hrRequests.comments(request.id).then(setComments).catch(() => setComments([])); }, [request.id]);
  const saveComment = async (event) => {
    event.preventDefault();
    if (!comment.trim()) return;
    setBusy(true);
    try { const added = await onAddComment(request.id, comment.trim()); setComments((current) => [...current, added]); setComment(""); }
    finally { setBusy(false); }
  };
  const saveRequest = async () => { setBusy(true); try { await onUpdate(request.id, { status, progress: Number(progress) }); } finally { setBusy(false); } };
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="request-details-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><div><div className="task-detail-id">{request.id}</div><h2>{request.requirement}</h2><p>{request.type} · {request.department}</p></div><button className="close-button" onClick={onClose}>×</button></div><div className="request-detail-summary"><RequestStatus status={status} /><span>{progress}% complete</span><ProgressBar value={progress} /></div><div className="request-detail-grid"><div><span className="eyebrow">Requester</span><strong>{request.requester || request.manager || "—"}</strong><small>{request.department}</small></div><div><span className="eyebrow">Department manager</span><strong>{request.manager || request.officer || "Unassigned"}</strong><small>Approval owner</small></div><div><span className="eyebrow">Required by</span><strong>{request.deadline ? new Date(request.deadline).toLocaleDateString() : "—"}</strong><small>Priority: {request.priority}</small></div></div>{request.details && <div className="request-detail-section"><h3>Request details</h3><p>{request.details}</p></div>}<div className="request-detail-section"><h3>Update request</h3><div className="form-grid"><label className="field">Status<select value={status} onChange={(event) => setStatus(event.target.value)}><option>Pending approval</option><option>In progress</option><option>Completed</option><option>Rejected</option></select></label><label className="field">Progress (%)<input type="number" min="0" max="100" value={progress} onChange={(event) => setProgress(event.target.value)} /></label></div><Button disabled={busy} onClick={saveRequest}>Save request update</Button></div><div className="request-detail-section"><h3>Activity & comments <Badge tone="neutral">{comments.length}</Badge></h3>{comments.map((item) => <div className="detail-empty" key={item.id} style={{ marginBottom: 8 }}><strong>{item.author || "User"}</strong><p>{item.body}</p><small>{new Date(item.created_at).toLocaleString()}</small></div>)}{!comments.length && <p className="detail-empty">No comments yet.</p>}<form onSubmit={saveComment} style={{ marginTop: 12 }}><label className="field">Add a comment<textarea value={comment} onChange={(event) => setComment(event.target.value)} required maxLength={10000} /></label><Button disabled={busy || !comment.trim()} type="submit">Add comment</Button></form></div><div className="modal-footer"><Button variant="secondary" onClick={onClose}>Close</Button></div></section></div>;
}

function HrDashboard({ requests, employees, attendanceRows, leaveRequests, setPage, onOpenRequest, onCreate }) {
  const inProgress = requests.filter((request) => request.status === "In progress").length;
  const pending = requests.filter((request) => request.status === "Pending approval").length;
  const today = todayKey();
  const presentIds = new Set(attendanceRows.filter((row) => attendanceDate(row.work_date) === today && row.check_in).map((row) => row.employee_code));
  const leaveToday = leaveRequests.filter((row) => row.status === "Approved" && row.start_date <= today && row.end_date >= today).length;
  const departments = [...new Set(employees.map((employee) => employee.department).filter(Boolean))];
  const todayRows = attendanceRows.filter((row) => attendanceDate(row.work_date) === today && row.check_in).sort((a, b) => new Date(b.check_in) - new Date(a.check_in));
  const openRequests = requests.filter((request) => !["Completed", "Rejected"].includes(request.status)).length;
  return <><Header title="HR command center" subtitle="Organization-wide workforce visibility at a glance." onMenu={() => {}} onCreate={onCreate} createLabel="Create request" notifications={pending + leaveRequests.filter((row) => row.status === "Pending approval").length} /><section className="hr-hero"><div><Badge tone="light">CORPORATE HR & WORKFORCE PLATFORM</Badge><h2>People operations, made visible.</h2><p>Monitor workforce health, move requests forward, and keep every team supported.</p></div><div className="hr-hero-metrics"><span><strong>{departments.length}</strong> departments</span><span><strong>{employees.length}</strong> employees</span></div></section><div className="stats-grid manager-stats"><StatCard label="Total employees" value={employees.length} note={`${departments.length} departments`} icon="users" /><StatCard label="Present today" value={`${presentIds.size} / ${employees.length}`} note={employees.length ? `${Math.round(presentIds.size / employees.length * 100)}% checked in` : "No employees"} icon="check" tone="green" /><StatCard label="On leave today" value={leaveToday} note="Approved leave requests" icon="calendar" tone="purple" /><StatCard label="Open HR requests" value={openRequests} note={`${inProgress} in progress · ${pending} pending`} icon="tasks" tone="orange" /></div><section className="panel live-attendance-panel"><div className="panel-header"><div><h2>Today's attendance</h2><p>Check-in records for {formatDate()}.</p></div><Button variant="secondary" onClick={() => setPage("leave")}>Attendance & leave</Button></div>{todayRows.length ? todayRows.map((row) => { const person = employees.find((employee) => employee.id === row.employee_code); return <div className="live-attendance-row" key={row.id}><span className="avatar">{person?.initials || "EM"}</span><div><strong>{person?.name || row.employee_code}</strong><small>{person?.department || ""} · Checked in {formatTime(row.check_in)}</small></div><Badge tone={row.check_out ? "neutral" : "green"}>{row.check_out ? `Checked out ${formatTime(row.check_out)}` : "Working"}</Badge></div>; }) : <p className="detail-empty">No attendance check-ins recorded today.</p>}</section><div className="hr-module-grid"><section className="panel"><div className="panel-header"><div><h2>HR request tracking</h2><p>Latest requests and their current progress.</p></div><button className="link-button" onClick={() => setPage("requests")}>View all <Icon name="arrow" /></button></div><div className="request-list">{requests.slice(0, 5).map((request) => <button className="request-row" key={request.id} onClick={() => onOpenRequest(request)}><span className="request-type-icon">{request.type === "Equipment request" ? "▣" : request.type === "Training request" ? "✦" : "♙"}</span><div className="request-main"><div><strong>{request.requirement}</strong><span>{request.id} · {request.department} · {request.requester || request.manager || "HR team"}</span></div><RequestStatus status={request.status} /></div><div className="request-progress"><ProgressBar value={request.progress} /><small>{request.progress}%</small></div></button>)}{!requests.length && <p className="detail-empty">No HR requests yet.</p>}</div></section><section className="panel workforce-panel"><div className="panel-header"><div><h2>Workforce overview</h2><p>Employee count and KPI by department.</p></div><button className="link-button" onClick={() => setPage("analytics")}>Analytics <Icon name="arrow" /></button></div>{departments.map((name) => { const members = employees.filter((employee) => employee.department === name); const score = members.reduce((sum, employee) => sum + kpiFor(employee), 0) / (members.length || 1); return <div className="department-row" key={name}><div><strong>{name}</strong><small>{members.length} employees</small></div><div className="department-score"><ProgressBar value={score} color={score >= 85 ? "green" : "purple"} /><span>{score.toFixed(1)}</span></div></div>; })}{!departments.length && <p className="detail-empty">No department data available.</p>}</section></div><section className="panel command-modules"><div className="panel-header"><div><h2>HR management modules</h2><p>Open an operational area.</p></div></div><div className="module-cards">{[["Employee lifecycle", "Profiles and performance", "users", "employees"], ["Attendance & leave", "Presence and leave requests", "clock", "leave"], ["Performance & KPI", "Team KPI overview", "chart", "analytics"], ["Helpdesk & support", "Employee tickets and issues", "bell", "support"]].map(([title, description, icon, pageId]) => <button className="module-card" key={title} onClick={() => setPage(pageId)}><span className="module-icon"><Icon name={icon} /></span><strong>{title}</strong><small>{description}</small><Icon name="arrow" /></button>)}</div></section></>;
}

function HrRequestsPage({ requests, onOpenRequest, onCreate }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [type, setType] = useState("All request types");
  const filtered = requests.filter((request) => (status === "All statuses" || request.status === status) && (type === "All request types" || request.type === type) && `${request.id} ${request.department} ${request.requirement} ${request.type} ${request.requester || ""}`.toLowerCase().includes(query.toLowerCase()));
  const types = [...new Set(requests.map((request) => request.type).filter(Boolean))];
  return <><Header title="HR requests" subtitle="Track every request from creation to resolution." onMenu={() => {}} onCreate={onCreate} createLabel="Create request" notifications={requests.filter((request) => request.status === "Pending approval").length} /><div className="toolbar"><div className="search"><span>⌕</span><input placeholder="Search request ID, department..." value={query} onChange={(event) => setQuery(event.target.value)} /></div><select value={status} onChange={(event) => setStatus(event.target.value)}><option>All statuses</option><option>In progress</option><option>Pending approval</option><option>Completed</option><option>Rejected</option></select><select value={type} onChange={(event) => setType(event.target.value)}><option>All request types</option>{types.map((item) => <option key={item}>{item}</option>)}</select></div><section className="panel"><div className="table-wrap"><table><thead><tr><th>Request</th><th>Department</th><th>Requester</th><th>Priority</th><th>Progress</th><th>Status</th><th>Owner</th></tr></thead><tbody>{filtered.map((request) => <tr className="clickable-row" key={request.id} onClick={() => onOpenRequest(request)}><td><strong>{request.id}</strong><small className="table-subtext">{request.requirement}</small></td><td>{request.department}<small className="table-subtext">{request.type}</small></td><td>{request.requester || request.manager || "—"}</td><td><Badge tone={request.priority === "High" ? "red" : "neutral"}>{request.priority}</Badge></td><td><div className="table-progress"><ProgressBar value={request.progress} /><small>{request.progress}%</small></div></td><td><RequestStatus status={request.status} /></td><td>{request.officer || "Unassigned"}</td></tr>)}{!filtered.length && <tr><td colSpan="7"><div className="detail-empty">No requests match these filters.</div></td></tr>}</tbody></table></div></section></>;
}

function HrRequestModal({ employees, onClose, onCreate }) {
  const departments = [...new Set(employees.map((employee) => employee.department).filter(Boolean))];
  const defaultDeadline = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const [form, setForm] = useState({ requirement: "", department: departments[0] || "", type: "Manpower request", priority: "Medium", deadline: defaultDeadline, details: "" });
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = (event) => {
    event.preventDefault();
    if (!form.requirement.trim() || !form.details.trim()) return;
    onCreate({ ...form, requirement: form.requirement.trim(), details: form.details.trim() });
  };
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal hr-request-modal" onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><div><Badge tone="blue">Department request</Badge><h2>Create a request for a department</h2><p>The selected department's configured manager is assigned to the request.</p></div><button className="close-button" onClick={onClose}>×</button></div><form onSubmit={submit}><div className="request-routing-note"><span className="request-type-icon">↗</span><div><strong>Department workflow</strong><small>{form.department || "Choose a department"} · routed using the department's saved manager</small></div></div><div className="form-grid"><label className="field full">Request title<input autoFocus required value={form.requirement} onChange={update("requirement")} placeholder="e.g. 2 frontend developers" /></label><label className="field">Department<select required value={form.department} onChange={update("department")}>{departments.map((department) => <option key={department}>{department}</option>)}</select></label><label className="field">Request type<select value={form.type} onChange={update("type")}><option>Manpower request</option><option>Recruitment request</option><option>Equipment request</option><option>Training request</option></select></label><label className="field">Priority<select value={form.priority} onChange={update("priority")}><option>Low</option><option>Medium</option><option>High</option></select></label><label className="field">Required by<input type="date" value={form.deadline} onChange={update("deadline")} /></label><label className="field full">Request details<textarea required value={form.details} onChange={update("details")} placeholder="Describe the requirement, quantity, or business need" /></label></div><div className="modal-footer"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" icon="arrow">Create request</Button></div></form></section></div>;
}

function SupportPage({ tickets, onCreate, onUpdate }) {
  const [form, setForm] = useState({ subject: "", description: "", priority: "Medium" });
  const [saving, setSaving] = useState(false);
  const updateField = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = async (event) => { event.preventDefault(); setSaving(true); try { await onCreate(form); setForm({ subject: "", description: "", priority: "Medium" }); } finally { setSaving(false); } };
  const statusLabel = { open: "Open", in_progress: "In progress", resolved: "Resolved", closed: "Closed" };
  return <><Header title="Helpdesk & support" subtitle="Track employee support tickets and resolve outstanding issues." onMenu={() => {}} notifications={tickets.filter((ticket) => ticket.status === "open").length} /><section className="panel leave-form-panel"><div className="panel-header"><div><h2>Create support ticket</h2><p>Log an employee question or operational issue.</p></div></div><form className="form-grid" onSubmit={submit}><label className="field full">Subject<input required maxLength="200" value={form.subject} onChange={updateField("subject")} /></label><label className="field">Priority<select value={form.priority} onChange={updateField("priority")}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label><label className="field full">Description<textarea required maxLength="10000" value={form.description} onChange={updateField("description")} /></label><div className="form-submit full"><Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create ticket"}</Button></div></form></section><section className="panel"><div className="panel-header"><div><h2>Support tickets</h2><p>{tickets.length} ticket{tickets.length === 1 ? "" : "s"} in this organization.</p></div></div><div className="table-wrap"><table><thead><tr><th>Ticket</th><th>Requester</th><th>Priority</th><th>Status</th><th>Created</th><th>Update status</th></tr></thead><tbody>{tickets.map((ticket) => <tr key={ticket.id}><td><strong>{ticket.subject}</strong><small className="table-subtext">{ticket.id} · {ticket.description}</small></td><td>{ticket.requester || "—"}</td><td><Badge tone={ticket.priority === "Critical" || ticket.priority === "High" ? "red" : "neutral"}>{ticket.priority}</Badge></td><td><Badge tone={ticket.status === "resolved" || ticket.status === "closed" ? "green" : "orange"}>{statusLabel[ticket.status] || ticket.status}</Badge></td><td>{new Date(ticket.created_at).toLocaleDateString()}</td><td><select aria-label={`Update ${ticket.id}`} value={ticket.status} onChange={(event) => onUpdate(ticket.id, event.target.value)}><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></td></tr>)}{!tickets.length && <tr><td colSpan="6"><div className="detail-empty">No support tickets yet.</div></td></tr>}</tbody></table></div></section></>;
}

function TaskModal({ employees, onClose, onCreate }) {
  const defaultDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  const [form, setForm] = useState({ title: "", employeeId: employees[0].id, priority: "Medium", hours: 4, points: 15, deadlineDate: defaultDeadline.slice(0, 10), deadlineTime: defaultDeadline.slice(11, 16), description: "", attachment: null, attachmentName: "", githubRepo: "", additionalReferenceUrl: "" });
  const update = (key) => (e) => setForm((current) => ({ ...current, [key]: e.target.value }));
  const updatePriority = (event) => {
    const priority = event.target.value;
    const points = { Low: 10, Medium: 15, High: 20, Critical: 30 }[priority];
    setForm((current) => ({ ...current, priority, points }));
  };
  const handleFile = (attachment) => setForm({ ...form, attachment, attachmentName: attachment?.name || "" });
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" onMouseDown={(e) => e.stopPropagation()}><div className="modal-header"><div><h2>Create a new task</h2><p>Assign work and define expectations clearly.</p></div><button className="close-button" onClick={onClose}>×</button></div><div className="form-grid"><label className="field full">Task title<input autoFocus required value={form.title} onChange={update("title")} placeholder="e.g. Design login page" /></label><label className="field">Assign to<select value={form.employeeId} onChange={update("employeeId")}>{employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label><label className="field">Priority<select value={form.priority} onChange={updatePriority}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label><label className="field">Estimated hours<input type="number" min="0.25" step="0.25" required value={form.hours} onChange={update("hours")} /></label><label className="field">Base points<input type="number" min="0" step="1" required value={form.points} onChange={update("points")} /></label><label className="field">Start time<div className="readonly-field"><span>{new Date().toLocaleDateString("en-BD", { timeZone: "Asia/Dhaka" })}</span><span>{new Date().toLocaleTimeString("en-BD", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit" })}</span></div></label><div className="field"><span>Deadline date & time</span><div className="datetime-split"><input type="date" required aria-label="Deadline date" value={form.deadlineDate} onChange={update("deadlineDate")} /><input type="time" required aria-label="Deadline time" value={form.deadlineTime} onChange={update("deadlineTime")} /></div></div><label className="field full">Task description<textarea value={form.description} onChange={update("description")} placeholder="Describe task requirements..." /></label><div className="field full"><div className="field-label-row"><span>Attachment</span><span className="optional-label">Optional</span></div><AttachmentPicker file={form.attachment} onChange={handleFile} /></div><label className="field full">GitHub repository <span className="optional-label">Optional</span><input type="url" value={form.githubRepo} onChange={update("githubRepo")} placeholder="https://github.com/owner/repository" /></label><label className="field full">Additional reference link <span className="optional-label">Optional</span><input type="url" value={form.additionalReferenceUrl} onChange={update("additionalReferenceUrl")} placeholder="https://example.com/resource" /></label></div><div className="modal-footer"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={() => form.title.trim() && onCreate({ ...form, deadline: new Date(`${form.deadlineDate}T${form.deadlineTime}`).toISOString(), hours: Number(form.hours), points: Number(form.points) })}>Create task</Button></div></div></div>;
}

function App() {
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("zippio_session") || "null");
    } catch {
      return null;
    }
  });
  const [page, setPage] = useState(() => window.location.hash.slice(1) || "dashboard");
  const [employees, setEmployees] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [requests, setRequests] = useState([]);
  const [delegationRequests, setDelegationRequests] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [supportTickets, setSupportTickets] = useState([]);
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [reportSummary, setReportSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [attendance, setAttendance] = useState({ date: todayKey(), checkIn: null, checkOut: null });
  const [modal, setModal] = useState(false);
  const [employeeModal, setEmployeeModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [delegationTask, setDelegationTask] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  useEffect(() => {
    const handleHistory = () => setPage(window.location.hash.slice(1) || "dashboard");
    window.addEventListener("popstate", handleHistory);
    return () => window.removeEventListener("popstate", handleHistory);
  }, []);
  const navigatePage = (nextPage) => {
    setPage(nextPage);
    if (window.location.hash !== `#${nextPage}`) window.history.pushState({ page: nextPage }, "", `#${nextPage}`);
  };
  useEffect(() => {
    if (!session) return;
    setIsLoading(true);
    const summaryRequest = session.role === "hr" ? api.reports.summary() : Promise.resolve(null);
    Promise.all([api.employees.list(), api.tasks.list(), api.hrRequests.list(), api.attendance.list(), api.delegations.list(), api.leave.list(), api.leave.types(), api.support.list(), summaryRequest])
      .then(([people, work, hrWork, attendanceData, delegations, leaveData, leaveTypeData, supportData, summary]) => {
        setAttendanceRows(attendanceData);
        const formatAttendance = (row) => ({
          date: attendanceDate(row.work_date),
          in: row.check_in ? formatTime(row.check_in) : "—",
          out: row.check_out ? formatTime(row.check_out) : null,
          duration: row.check_in && row.check_out ? formatDuration(row.check_in, row.check_out) : "Active",
          status: row.status,
        });
        const employeeAttendanceRows = session.role === "employee"
          ? attendanceData.filter((row) => row.employee_code === session.userId)
          : attendanceData;
        const currentAttendance = employeeAttendanceRows.find((row) => attendanceDate(row.work_date) === todayKey());
        setAttendance({
          date: attendanceDate(currentAttendance?.work_date) || todayKey(),
          checkIn: currentAttendance?.check_in || null,
          checkOut: currentAttendance?.check_out || null,
        });
        setEmployees(people.map((person) => ({
          ...person,
          attendance: attendanceData.filter((row) => row.employee_code === person.id).map(formatAttendance),
        })));
        setTasks(work); setRequests(hrWork); setDelegationRequests(delegations); setLeaveRequests(leaveData); setLeaveTypes(leaveTypeData); setSupportTickets(supportData);
        setReportSummary(summary);
      })
      .catch((error) => setLoadError(error.message))
      .finally(() => setIsLoading(false));
  }, [session]);
  useEffect(() => {
    if (session?.role !== "hr") return;
    const refresh = async () => {
      try {
        const [nextRequests, nextAttendance, nextLeave, nextSummary, nextTickets] = await Promise.all([api.hrRequests.list(), api.attendance.list(), api.leave.list(), api.reports.summary(), api.support.list()]);
        setRequests(nextRequests); setAttendanceRows(nextAttendance); setLeaveRequests(nextLeave); setReportSummary(nextSummary); setSupportTickets(nextTickets);
      } catch (error) { setActionError(error.message); }
    };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [session]);
  useEffect(() => { const toggle = () => setSidebarOpen((open) => !open); window.addEventListener("zippio:toggle-menu", toggle); return () => window.removeEventListener("zippio:toggle-menu", toggle); }, []);
  const employee = session?.role === "employee" ? employees.find((e) => e.id === session.userId || e.user_id === session.userId) : null;
  const activeEmployee = employee || employees[0];
  const login = async ({ role, userId, email, password }) => {
    try {
      setLoadError("");
    const auth = await api.auth.login({ role, userId, email, password });
    const nextSession = { role: auth.user?.role || role, userId: userId || auth.user?.userId || "manager", name: auth.user?.displayName || auth.user?.name || "", jobTitle: auth.user?.jobTitle || "" };
      sessionStorage.setItem("zippio_session", JSON.stringify(nextSession));
      setSession(nextSession);
      navigatePage("dashboard");
    } catch (error) {
      setLoadError(error.message);
    }
  };
  const logout = async () => {
    try {
      await api.auth.logout();
    } finally {
      sessionStorage.removeItem("zippio_session");
      setSession(null);
      window.history.replaceState({}, "", window.location.pathname);
    }
  };
  const updateTask = async (id, patch) => {
    try {
      const updated = await api.tasks.update(id, patch);
      setTasks((current) => current.map((task) => task.id === id ? { ...task, ...updated } : task));
      setSelectedTask((current) => current?.id === id ? { ...current, ...updated } : current);
    } catch (error) {
      setActionError(error.message);
    }
  };
  const start = async (id) => {
    const patch = { status: "progress", startedAt: new Date().toISOString() };
    await updateTask(id, patch);
  };
  const submit = (id) => updateTask(id, { status: "review", note: "I completed the assigned work and verified the core requirements." });
  const review = async (id, approved, quality = null) => {
    try {
      const result = await api.reviews.submit(id, { approved, pointsAwarded: approved ? tasks.find((task) => task.id === id)?.points || 0 : 0, note: quality ? `Quality rating: ${quality}/5` : undefined });
      setTasks((current) => current.map((task) => task.id === id ? { ...task, status: approved ? "approved" : "progress" } : task));
      const people = await api.employees.list();
      setEmployees((current) => people.map((person) => ({ ...person, attendance: current.find((item) => item.id === person.id)?.attendance || [] })));
      return result;
    } catch (error) { setActionError(error.message); }
  };
  const createDelegationRequest = async (data) => {
    try {
      const request = await api.delegations.create({ ...data, parentTaskId: delegationTask.id });
      setDelegationRequests((current) => [...current, { ...request, id: request.id || request.request_code, status: request.status || "pending", parentTaskId: delegationTask.id, parentPoints: delegationTask.points, fromEmployeeId: session.userId, toEmployeeId: data.employeeId }]);
      setTasks((current) => current.map((task) => task.id === delegationTask.id && task.status === "todo" ? { ...task, status: "progress" } : task));
      setDelegationTask(null); setSelectedTask(null);
    } catch (error) { setActionError(error.message); }
  };
  const reviewDelegation = async (id, approved, points) => {
    try {
      const updated = await api.delegations.review(id, { status: approved ? "approved" : "rejected", points });
      setDelegationRequests((current) => current.map((item) => item.id === id ? { ...item, ...updated } : item));
      if (approved) setTasks(await api.tasks.list());
    } catch (error) { setActionError(error.message); }
  };
  const uploadToTask = async (id, file, githubRepo) => {
    try {
      if (file) await api.attachments.upload(id, file);
      await updateTask(id, { attachmentName: file?.name || "", githubRepo: githubRepo || "", status: "review", note: "Submitted for manager review." });
    } catch (error) {
      setActionError(error.message);
    }
  };
  const checkIn = async () => {
    let record;
    try { record = await api.attendance.checkIn(); } catch (error) { setActionError(error.message); return; }
    const checkedInAt = new Date().toISOString();
    setAttendance({ date: todayKey(), checkIn: checkedInAt, checkOut: null });
    setEmployees((current) => current.map((person) => person.id !== session.userId ? person : {
      ...person,
      attendance: [{ date: attendanceDate(record.work_date), in: formatTime(record.check_in), out: null, duration: "Active", status: record.status }, ...(person.attendance || []).filter((row) => row.date !== attendanceDate(record.work_date))],
    }));
  };
  const checkOut = async () => {
    let record;
    try { record = await api.attendance.checkOut(); } catch (error) { setActionError(error.message); return; }
    setAttendance((current) => ({ ...current, checkOut: record.check_out }));
    setEmployees((current) => current.map((person) => person.id !== session.userId ? person : {
      ...person,
      attendance: (person.attendance || []).map((row) => row.date === attendanceDate(record.work_date) ? {
        ...row,
        out: formatTime(record.check_out),
        duration: formatDuration(record.check_in, record.check_out),
      } : row),
    }));
  };
  const createTask = async (data) => {
    try {
      const { attachment, ...taskPayload } = data;
      const createdTask = await api.tasks.create(taskPayload);
      let task = createdTask;
      if (attachment) {
        const uploaded = await api.attachments.upload(createdTask.id, attachment);
        task = { ...createdTask, attachmentName: uploaded.file_name || attachment.name };
      }
      setTasks((current) => [...current, task]);
      setModal(false);
      navigatePage("tasks");
    } catch (error) {
      setActionError(error.message);
    }
  };
  const createHrRequest = async (data) => {
    try {
      await api.hrRequests.create(data);
      setRequests(await api.hrRequests.list());
      setModal(false);
    } catch (error) {
      setActionError(error.message);
    }
  };
  const createEmployee = async (data) => {
    try {
      const created = await api.employees.create(data);
      const people = await api.employees.list();
      setEmployees((current) => people.map((person) => ({ ...person, attendance: current.find((item) => item.id === person.id)?.attendance || [] })));
      return created;
    } catch (error) {
      setActionError(error.message);
      throw error;
    }
  };
  const updateHrRequest = async (id, payload) => {
    try {
      const updated = await api.hrRequests.update(id, payload);
      setRequests((current) => current.map((request) => request.id === id ? { ...request, ...updated } : request));
      return updated;
    } catch (error) { setActionError(error.message); throw error; }
  };
  const addHrComment = async (id, body) => {
    try {
      const added = await api.hrRequests.addComment(id, body);
      setRequests((current) => current.map((request) => request.id === id ? { ...request, comments: (request.comments || 0) + 1 } : request));
      return added;
    } catch (error) { setActionError(error.message); throw error; }
  };
  const createLeaveRequest = async (payload) => {
    try {
      const created = await api.leave.create(payload);
      setLeaveRequests(await api.leave.list());
      return created;
    } catch (error) { setActionError(error.message); throw error; }
  };
  const reviewLeaveRequest = async (id, status) => {
    try {
      const updated = await api.leave.review(id, { status });
      setLeaveRequests((current) => current.map((request) => request.id === id ? { ...request, ...updated } : request));
    } catch (error) { setActionError(error.message); }
  };
  const createSupportTicket = async (payload) => {
    try {
      await api.support.create(payload);
      setSupportTickets(await api.support.list());
    } catch (error) { setActionError(error.message); throw error; }
  };
  const updateSupportTicket = async (id, status) => {
    try {
      const updated = await api.support.update(id, { status });
      setSupportTickets((current) => current.map((ticket) => ticket.id === id ? { ...ticket, ...updated } : ticket));
    } catch (error) { setActionError(error.message); }
  };
  if (!session) return <Login onLogin={login} error={loadError} />;
  if (loadError) return <div className="loading-screen">Unable to load your workspace: {loadError}<Button variant="secondary" onClick={logout}>Return to sign in</Button></div>;
  if (isLoading) return <div className="loading-screen">Loading your workspace…</div>;
  const isManager = session.role === "manager";
  const isHr = session.role === "hr";
  if (!isManager && !isHr && !employee) return <div className="loading-screen">Loading your workspace…</div>;
  const title = isHr ? (page === "requests" ? "HR requests" : page === "employees" ? "Employees" : page === "analytics" ? "Performance & analytics" : page === "leave" ? "Attendance & leave" : page === "support" ? "Helpdesk & support" : "HR command center") : page === "dashboard" ? "Overview" : page === "tasks" ? (isManager ? "All tasks" : "My tasks") : page === "performance" ? "My performance" : page === "attendance" ? "Attendance" : page === "leave" ? "Apply leave" : page === "employees" ? "Employees" : page === "reviews" ? "Review queue" : "Performance";
  const delegationRank = { pending: 3, approved: 2, rejected: 1 };
  const delegationStatusByParent = {};
  for (const request of delegationRequests) {
    const current = delegationStatusByParent[request.parentTaskId];
    if (!current || (delegationRank[request.status] || 0) > (delegationRank[current] || 0)) delegationStatusByParent[request.parentTaskId] = request.status;
  }
  const tasksWithDelegation = tasks.map((task) => ({ ...task, delegationStatus: delegationStatusByParent[task.id] }));
  return <>{actionError && <div className="action-error-banner" role="alert"><span>{actionError}</span><button type="button" onClick={() => setActionError("")}>×</button></div>}<div className="app-shell"><Sidebar role={session.role} employee={employee} page={page} setPage={navigatePage} onLogout={logout} open={sidebarOpen} setOpen={setSidebarOpen} name={session.name} jobTitle={session.jobTitle} reviewCount={tasks.filter((task) => task.status === "review").length + delegationRequests.filter((request) => request.status === "pending").length} requestCount={requests.filter((request) => !["Completed", "Rejected"].includes(request.status)).length} /><main className="main-content"><div className="desktop-context">{title}</div>{isHr && page === "dashboard" && <HrDashboard requests={requests} employees={employees} attendanceRows={attendanceRows} leaveRequests={leaveRequests} reportSummary={reportSummary} setPage={navigatePage} onOpenRequest={setSelectedRequest} onCreate={() => setModal(true)} />}{isHr && page === "requests" && <HrRequestsPage requests={requests} onOpenRequest={setSelectedRequest} onCreate={() => setModal(true)} />}{isHr && page === "employees" && <EmployeesPage employees={employees} showCreate onCreate={() => setEmployeeModal(true)} />}{isHr && page === "analytics" && <HrAnalyticsPage employees={employees} />}{isHr && page === "leave" && <LeavePage isHr employees={employees} leaveRequests={leaveRequests} leaveTypes={leaveTypes} attendanceRows={attendanceRows} onReview={reviewLeaveRequest} />}{isHr && page === "support" && <SupportPage tickets={supportTickets} onCreate={createSupportTicket} onUpdate={updateSupportTicket} />}{isManager && page === "dashboard" && <ManagerDashboard tasks={tasksWithDelegation} employees={employees} setPage={navigatePage} onCreate={() => setModal(true)} attendance={attendance} attendanceRows={attendanceRows} leaveRequests={leaveRequests} managerName={session.name || "Manager"} onReview={review} delegationRequests={delegationRequests} onDelegation={reviewDelegation} />}{isManager && page === "tasks" && <TasksPage role="manager" tasks={tasksWithDelegation} employees={employees} delegationRequests={delegationRequests} onDelegation={reviewDelegation} onCreate={() => setModal(true)} onOpen={setSelectedTask} onReview={review} />}{isManager && page === "employees" && <EmployeesPage employees={employees} />}{isManager && page === "reviews" && <ReviewPage tasks={tasksWithDelegation} employees={employees} delegationRequests={delegationRequests} onReview={review} onDelegation={reviewDelegation} />}{isManager && page === "reports" && activeEmployee && <PerformancePage employee={activeEmployee} employees={employees} tasks={tasksWithDelegation} title="Performance" />}{!isManager && !isHr && page === "dashboard" && <EmployeeDashboard employee={employee} employees={employees} tasks={tasksWithDelegation} onStart={start} onSubmit={submit} onOpen={setSelectedTask} setPage={navigatePage} attendance={attendance} onCheckIn={checkIn} onCheckOut={checkOut} />}{!isManager && !isHr && page === "tasks" && <TasksPage role="employee" tasks={tasksWithDelegation} employee={employee} employees={employees} onStart={start} onSubmit={submit} onOpen={setSelectedTask} />}{!isManager && !isHr && page === "performance" && <PerformancePage employee={employee} employees={employees} tasks={tasksWithDelegation} />}{!isManager && !isHr && page === "attendance" && <AttendancePage employee={employee} attendance={attendance} onCheckIn={checkIn} onCheckOut={checkOut} />}{!isManager && !isHr && page === "leave" && <LeavePage employee={employee} leaveRequests={leaveRequests} leaveTypes={leaveTypes} onCreate={createLeaveRequest} />}</main>{modal && (isHr ? <HrRequestModal employees={employees} onClose={() => setModal(false)} onCreate={createHrRequest} /> : <TaskModal employees={employees} onClose={() => setModal(false)} onCreate={createTask} />)}{employeeModal && <CreateEmployeeModal employees={employees} onClose={() => setEmployeeModal(false)} onCreate={createEmployee} />}{selectedTask && <TaskDetails task={selectedTask} employeeName={employees.find((person) => person.id === selectedTask.employeeId)?.name} currentEmployeeId={employee?.id} onClose={() => setSelectedTask(null)} onStart={start} onDelegate={setDelegationTask} onUpload={uploadToTask} onReview={review} canReview={isManager || isHr} />}{delegationTask && <DelegationModal task={delegationTask} employees={employees} currentEmployeeId={employee?.id} onClose={() => setDelegationTask(null)} onSubmit={createDelegationRequest} />}{selectedRequest && <RequestDetails request={selectedRequest} onClose={() => setSelectedRequest(null)} onUpdate={updateHrRequest} onAddComment={addHrComment} />}</div></>;
}

createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
