
import React, { useEffect, useMemo, useState } from "react";
import {
  initializeApp,
  getApp,
  getApps,
} from "firebase/app";
import type { FirebaseApp } from "firebase/app";

import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import type { User } from "firebase/auth";

import {
  collection,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  updateDoc,
} from "firebase/firestore";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Bell,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Filter,
  Globe,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Search,
  Settings,
  ShieldCheck,
  SquareTerminal,
  UserRound,
  Wrench,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

/* -------------------------------------------------------
   Firebase setup
------------------------------------------------------- */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* -------------------------------------------------------
   Types
------------------------------------------------------- */
type ComplaintStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "REJECTED";

type ComplaintDoc = {
  id: string;
  title: string;
  description?: string;
  category: string;
  location: string;
  status: ComplaintStatus;
  reportedBy?: string;
  priority?: "Low" | "Medium" | "High";
  createdAt?: Timestamp | number | null;
  updatedAt?: Timestamp | number | null;
  assignedDepartment?: string;
  adminNote?: string;
  departmentRemark?: string;
  assignedAt?: Timestamp | number | null;
  completedAt?: Timestamp | number | null;
  userId?: string;
  imageUrl?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
};

type AdminProfile = {
  role?: string;
  department?: string;
  name?: string;
  email?: string;
};

/* -------------------------------------------------------
   Constants / helpers
------------------------------------------------------- */
const statusStyles: Record<ComplaintStatus, string> = {
  OPEN: "bg-red-500/15 text-red-300 border-red-500/30",
  IN_PROGRESS: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  RESOLVED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  REJECTED: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

const filters: Array<"ALL" | ComplaintStatus> = ["ALL", "OPEN", "IN_PROGRESS", "RESOLVED", "REJECTED"];

function normalizeTimestamp(value: ComplaintDoc["createdAt"]): number {
  if (value == null) return Date.now();
  if (typeof value === "number") return value;
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === "object" && value && "seconds" in value) {
    return (value as Timestamp).toMillis();
  }
  return Date.now();
}

function formatRelativeTime(value: ComplaintDoc["createdAt"]): string {
  const ms = normalizeTimestamp(value);
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  if (hrs < 24) return `${hrs} hr ago`;
  return `${days} day${days > 1 ? "s" : ""} ago`;
}

function AdminStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  accentClass,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  accentClass: string;
}) {
  return (
    <Card className="border-white/10 bg-slate-950/70 text-white shadow-xl shadow-black/20 backdrop-blur">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-400">{title}</p>
            <h3 className="mt-2 text-3xl font-bold tracking-tight">{value}</h3>
            <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
          </div>
          <div className={`rounded-2xl border p-3 ${accentClass}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Sidebar({ onLogout }: { onLogout: () => Promise<void> }) {
  const sidebarItems = [
    { label: "Dashboard", icon: LayoutDashboard, active: true },
    { label: "Complaints", icon: ClipboardList },
    { label: "Departments", icon: SquareTerminal },
    { label: "Map View", icon: MapPinned },
    { label: "Users", icon: UserRound },
    { label: "Settings", icon: Settings },
  ];

  return (
    <aside className="border-r border-white/10 bg-slate-950/90 p-5 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm text-slate-400">FixMyStreet</p>
          <h1 className="text-lg font-semibold">Admin Panel</h1>
        </div>
      </div>

      <Separator className="my-5 bg-white/10" />

      <nav className="space-y-2">
        {sidebarItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${item.active
                ? "bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/20"
                : "text-slate-300 hover:bg-white/5"
                }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-6 rounded-3xl border border-white/10 bg-gradient-to-br from-blue-500/15 to-emerald-500/10 p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Live Status</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          <p className="text-sm font-medium text-slate-100">Firebase Connected</p>
        </div>
        <p className="mt-2 text-sm text-slate-400">Complaints sync in real time.</p>
      </div>

      <button
        onClick={onLogout}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 hover:bg-white/10"
      >
        <LogOut className="h-4 w-4" />
        Logout
      </button>
    </aside>
  );
}

function LoginScreen({
  onLogin,
  loading,
  error,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
  loading: boolean;
  error: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="min-h-screen bg-[#0b1020] px-4 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center justify-center">
        <Card className="w-full border-white/10 bg-slate-950/80 shadow-2xl shadow-black/30 backdrop-blur">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div>
              <CardTitle className="text-2xl">Admin Login</CardTitle>
              <CardDescription className="mt-2 text-slate-400">
                Sign in to manage complaints and departments.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Admin Email</label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@fixmystreet.com"
                type="email"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-300">Password</label>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                type="password"
              />
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            ) : null}

            <Button
              className="w-full"
              onClick={() => onLogin(email, password)}
              disabled={loading}
            >
              {loading ? "Signing in..." : "Login as Admin"}
            </Button>

            <p className="text-center text-xs leading-5 text-slate-500">
              Create an admin Firebase Auth account and add a Firestore user document with role = admin.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ComplaintDetailsPanel({
  complaint,
  onAssign,
  onResolve,
  onReject,
  onReopen,
  onSaveNote,
}: {
  complaint: ComplaintDoc | null;
  onAssign: (complaint: ComplaintDoc) => void;
  onResolve: (complaint: ComplaintDoc) => void;
  onReject: (complaint: ComplaintDoc) => void;
  onReopen: (complaint: ComplaintDoc) => void;
  onSaveNote: (complaint: ComplaintDoc, note: string) => void;
}) {
  const [note, setNote] = useState("");
  const [showDepartments, setShowDepartments] = useState(false);

  useEffect(() => {
    setNote(complaint?.adminNote ?? "");
  }, [complaint?.id, complaint?.adminNote]);

  const statusColor = complaint ? statusStyles[complaint.status] : statusStyles.OPEN;

  if (!complaint) {
    return (
      <Card className="border-white/10 bg-slate-950/70 text-white shadow-xl shadow-black/20 backdrop-blur">
        <CardHeader>
          <CardTitle>Complaint Details</CardTitle>
          <CardDescription className="text-slate-400">
            Select a complaint to view more information.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="border-white/10 bg-slate-950/70 text-white shadow-xl shadow-black/20 backdrop-blur">
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl">Complaint Details</CardTitle>
            <CardDescription className="text-slate-400">Live complaint review panel</CardDescription>
          </div>
          <Badge className={`${statusColor} border`}>{complaint.status.replace("_", " ")}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Complaint ID</p>
          <p className="mt-2 text-sm font-medium text-slate-200">{complaint.id}</p>
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Title</p>
          <p className="text-base font-semibold text-white">{complaint.title}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Category</p>
            <p className="mt-2 text-sm text-slate-200">{complaint.category}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Priority</p>
            <p className="mt-2 text-sm text-slate-200">{complaint.priority ?? "Medium"}</p>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Assigned Department
          </p>

          <p className="mt-3 text-lg font-semibold text-cyan-300">
            {complaint?.assignedDepartment
              ? `${complaint.assignedDepartment} Department`
              : "Not Assigned"}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Location</p>
          <p className="mt-2 text-sm text-slate-200">{complaint.location}</p>
        </div>

        <div className="mt-3 flex gap-2">
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={() =>
              window.open(
                `https://www.google.com/maps?q=${complaint.latitude},${complaint.longitude}`,
                "_blank"
              )
            }
          >
            Open Location
          </Button>

          <Button
            className="bg-green-600 hover:bg-green-700"
            onClick={() =>
              window.open(
                `https://www.google.com/maps/dir/?api=1&destination=${complaint.latitude},${complaint.longitude}`,
                "_blank"
              )
            }
          >
            Navigate
          </Button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Reported By</p>
          <p className="mt-2 text-sm text-slate-200">{complaint.reportedBy ?? "Citizen"}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Submitted</p>
          <p className="mt-2 text-sm text-slate-200">{formatRelativeTime(complaint.createdAt)}</p>
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Description</p>
          <p className="text-sm leading-6 text-slate-300">
            {complaint.description ?? "No description provided."}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Admin Note</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add internal note for this complaint..."
            className="min-h-[110px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500/40"
          />
          <Button
            variant="outline"
            className="w-full border-blue-500/20 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20"
            onClick={() => onSaveNote(complaint, note)}
          >
            Save Note
          </Button>
        </div>


        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Button
            variant="outline"
            className="border-blue-500/20 bg-blue-500/10 text-blue-300"
            onClick={() => setShowDepartments(!showDepartments)}
          >
            Assign
          </Button>

          <Button
            variant="outline"
            className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
            onClick={() => onResolve(complaint)}
          >
            Resolve
          </Button>
          <Button
            variant="outline"
            className="border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20"
            onClick={() => onReject(complaint)}
          >
            Reject
          </Button>
          <Button
            variant="outline"
            className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
            onClick={() => onReopen(complaint)}
          >
            Reopen
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickAction({ label, icon: Icon }: { label: string; icon: React.ElementType }) {
  return (
    <button className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-slate-200 transition hover:bg-white/10">
      <span className="flex items-center gap-3">
        <span className="rounded-xl bg-blue-500/10 p-2 text-blue-300 ring-1 ring-blue-500/20">
          <Icon className="h-4 w-4" />
        </span>
        {label}
      </span>
      <ArrowUpRight className="h-4 w-4 text-slate-500" />
    </button>
  );
}

function AdminDashboardPage({ user }: { user: User }) {
  const [assignMenuComplaint, setAssignMenuComplaint] = useState<string | null>(null);
  const [complaints, setComplaints] = useState<ComplaintDoc[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<"ALL" | ComplaintStatus>("ALL");
  const [searchText, setSearchText] = useState("");
  const [selectedComplaintId, setSelectedComplaintId] = useState<string>("");
  const [loadingComplaints, setLoadingComplaints] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const q = query(collection(db, "complaints"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const liveComplaints = snapshot.docs.map((item) => {
          const data = item.data() as Omit<ComplaintDoc, "id">;
          return { id: item.id, ...data };
        });

        setComplaints(liveComplaints);
        setSelectedComplaintId((prev) => {
          if (prev && liveComplaints.some((item) => item.id === prev)) return prev;
          return liveComplaints[0]?.id ?? "";
        });
        setLoadingComplaints(false);
        setError("");
      },
      (err) => {
        setError(err.message);
        setLoadingComplaints(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const selectedComplaint = useMemo(
    () => complaints.find((item) => item.id === selectedComplaintId) ?? complaints[0] ?? null,
    [complaints, selectedComplaintId]
  );

  const assignDepartment = async (
    complaint: ComplaintDoc,
    department: string
  ) => {

    await updateDoc(
      doc(db, "complaints", complaint.id),
      {
        assignedDepartment: department,
        status: "IN_PROGRESS",
        assignedAt: Date.now(),
        updatedAt: Date.now(),
      }
    );

    setAssignMenuComplaint(null);
  };

  const filteredComplaints = useMemo(() => {
    return complaints.filter((item) => {
      const matchesFilter = selectedFilter === "ALL" ? true : item.status === selectedFilter;
      const q = searchText.trim().toLowerCase();
      const matchesQuery =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.reportedBy ?? "").toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [complaints, searchText, selectedFilter]);

  const totalCount = complaints.length;
  const openCount = complaints.filter((item) => item.status === "OPEN").length;
  const progressCount = complaints.filter((item) => item.status === "IN_PROGRESS").length;
  const resolvedCount = complaints.filter((item) => item.status === "RESOLVED").length;

  const updateComplaint = async (
    complaint: ComplaintDoc,
    payload: Partial<
      Pick<
        ComplaintDoc,
        | "status"
        | "assignedDepartment"
        | "adminNote"
        | "departmentRemark"
      >
    >
  ) => {
    try {
      await updateDoc(doc(db, "complaints", complaint.id), {
        ...payload,
        updatedAt: Date.now(),
      });
      setError("");
    } catch (err: any) {
      setError(err?.message ?? "Failed to update complaint");
    }
  };

  const setStatus = async (
    complaint: ComplaintDoc,
    status: ComplaintStatus
  ) => {
    await updateComplaint(complaint, {
      status,
    });
  };

  const saveNote = async (complaint: ComplaintDoc, note: string) => {
    await updateComplaint(complaint, { adminNote: note });
  };

  return (
    <div className="min-h-screen bg-[#0b1020] text-white">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <Sidebar onLogout={() => signOut(auth)} />

        <main className="p-5 lg:p-8">
          <div className="flex flex-col gap-5">
            <header className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-black/20 backdrop-blur lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Dashboard Overview</span>
                </div>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-white">Complaint Management Console</h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-400">
                  Review complaints, assign departments, and track resolution progress from one place.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Badge className="border-white/10 bg-white/5 text-slate-300">{user.email}</Badge>
                <Button variant="outline" className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10">
                  <MapPinned className="mr-2 h-4 w-4" />
                  Map View
                </Button>
                <Button className="bg-blue-500 text-white hover:bg-blue-600">
                  <ArrowUpRight className="mr-2 h-4 w-4" />
                  Export Report
                </Button>
              </div>
            </header>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <AdminStatCard
                title="Total Complaints"
                value={String(totalCount)}
                subtitle="All civic issues"
                icon={ClipboardList}
                accentClass="border-blue-500/20 bg-blue-500/10 text-blue-300"
              />
              <AdminStatCard
                title="Open Issues"
                value={String(openCount)}
                subtitle="Need immediate action"
                icon={CircleAlert}
                accentClass="border-red-500/20 bg-red-500/10 text-red-300"
              />
              <AdminStatCard
                title="In Progress"
                value={String(progressCount)}
                subtitle="Assigned to departments"
                icon={Wrench}
                accentClass="border-amber-500/20 bg-amber-500/10 text-amber-300"
              />
              <AdminStatCard
                title="Resolved"
                value={String(resolvedCount)}
                subtitle="Completed complaints"
                icon={CheckCircle2}
                accentClass="border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
              />
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.35fr_0.85fr]">
              <Card className="border-white/10 bg-slate-950/70 text-white shadow-xl shadow-black/20 backdrop-blur">
                <CardHeader className="space-y-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <CardTitle className="text-xl">Complaint Queue</CardTitle>
                      <CardDescription className="text-slate-400">
                        Review and manage citizen complaints.
                      </CardDescription>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="relative w-full sm:w-72">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        <Input
                          value={searchText}
                          onChange={(e) => setSearchText(e.target.value)}
                          placeholder="Search complaint, location, ID..."
                          className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-slate-500"
                        />
                      </div>
                      <Button variant="outline" className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10">
                        <Filter className="mr-2 h-4 w-4" />
                        Filters
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {filters.map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setSelectedFilter(filter)}
                        className={`rounded-full border px-4 py-2 text-xs font-semibold tracking-wide transition ${selectedFilter === filter
                          ? "border-blue-500/30 bg-blue-500/15 text-blue-300"
                          : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                          }`}
                      >
                        {filter.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {loadingComplaints ? (
                    <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 text-sm text-slate-400">
                      Loading complaints...
                    </div>
                  ) : filteredComplaints.length === 0 ? (
                    <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 text-sm text-slate-400">
                      No complaints found for the current filter.
                    </div>
                  ) : (
                    filteredComplaints.map((item, index) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.04 }}
                      >
                        <div
                          onClick={() => setSelectedComplaintId(item.id)}
                          className="cursor-pointer rounded-3xl border border-white/10 bg-slate-900/80 p-4 transition hover:border-blue-500/20 hover:bg-slate-900"
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="border-white/10 bg-white/5 text-slate-300">
                                  {item.id}
                                </Badge>
                                <Badge className={statusStyles[item.status]}>{item.status.replace("_", " ")}</Badge>
                                <Badge variant="outline" className="border-blue-500/20 bg-blue-500/10 text-blue-300">
                                  {item.priority ?? "Medium"} Priority
                                </Badge>
                              </div>

                              <div>
                                <h3 className="text-base font-semibold text-white">{item.title}</h3>
                                <p className="mt-1 text-sm text-slate-400">
                                  {item.category} • {item.location}
                                </p>
                                {item.assignedDepartment && (
                                  <p className="mt-2 text-sm font-medium text-cyan-300">
                                    🏢 Assigned to: {item.assignedDepartment} Department
                                  </p>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                                <span>Reported by: {item.reportedBy ?? "Citizen"}</span>
                                <span>Submitted: {formatRelativeTime(item.createdAt)}</span>
                              </div>
                            </div>

                            <div className="flex flex-col gap-2 lg:items-end">
                              <Button size="sm" className="bg-blue-500 text-white hover:bg-blue-600">
                                View Details
                              </Button>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAssignMenuComplaint(
                                      assignMenuComplaint === item.id ? null : item.id
                                    );
                                  }}
                                >
                                  Assign
                                </Button>
                                {assignMenuComplaint === item.id && (

                                  <div className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-slate-700 bg-slate-900 shadow-xl">

                                    <button
                                      className="w-full px-4 py-3 text-left hover:bg-slate-800"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        assignDepartment(item, "Road");
                                      }}
                                    >
                                      🛣️ Road Department
                                    </button>

                                    <button
                                      className="w-full px-4 py-3 text-left hover:bg-slate-800"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        assignDepartment(item, "Water");
                                      }}
                                    >
                                      💧 Water Department
                                    </button>

                                    <button
                                      className="w-full px-4 py-3 text-left hover:bg-slate-800"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        assignDepartment(item, "Garbage");
                                      }}
                                    >
                                      🗑️ Garbage Department
                                    </button>

                                    <button
                                      className="w-full px-4 py-3 text-left hover:bg-slate-800"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        assignDepartment(item, "Street");
                                      }}
                                    >
                                      💡 Street Light Department
                                    </button>

                                    <button
                                      className="w-full px-4 py-3 text-left hover:bg-slate-800"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        assignDepartment(item, "drainage");
                                      }}
                                    >
                                      🌊 Drainage Department
                                    </button>

                                  </div>

                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setStatus(item, "RESOLVED");
                                  }}
                                >
                                  Resolve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setStatus(item, "REJECTED");
                                  }}
                                >
                                  Reject
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}

                  {error ? <p className="text-sm text-red-300">{error}</p> : null}
                </CardContent>
              </Card>

              <div className="space-y-5">
                <ComplaintDetailsPanel
                  complaint={selectedComplaint}
                  onAssign={(complaint) => setStatus(complaint, "IN_PROGRESS")}
                  onResolve={(complaint) => setStatus(complaint, "RESOLVED")}
                  onReject={(complaint) => setStatus(complaint, "REJECTED")}
                  onReopen={(complaint) => setStatus(complaint, "OPEN")}
                  onSaveNote={saveNote}
                />

                <Card className="border-white/10 bg-slate-950/70 text-white shadow-xl shadow-black/20 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Bell className="h-5 w-5 text-blue-300" />
                      Quick Actions
                    </CardTitle>
                    <CardDescription className="text-slate-400">Shortcuts for admin workflow</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <QuickAction label="Assign Selected" icon={ClipboardList} />
                    <QuickAction label="Mark as Resolved" icon={CheckCircle2} />
                    <QuickAction label="Send Alert" icon={Bell} />
                    <QuickAction label="Review Rejected" icon={XCircle} />
                  </CardContent>
                </Card>

                <Card className="border-white/10 bg-slate-950/70 text-white shadow-xl shadow-black/20 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Globe className="h-5 w-5 text-emerald-300" />
                      Department Status
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      Live municipal department overview
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { name: "Roads Department", count: "24 active cases", accent: "text-emerald-300" },
                      { name: "Sanitation", count: "18 active cases", accent: "text-amber-300" },
                      { name: "Water Works", count: "10 active cases", accent: "text-blue-300" },
                    ].map((dept) => (
                      <div key={dept.name} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="font-medium text-white">{dept.name}</p>
                            <p className="mt-1 text-sm text-slate-400">{dept.count}</p>
                          </div>
                          <Badge className={`border-white/10 bg-white/5 ${dept.accent}`}>Online</Badge>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}


function StaffDashboardPage({
  user,
  department,
}: {
  user: User;
  department: string;
}) {
  const [assignMenuComplaint, setAssignMenuComplaint] = useState<string | null>(null);
  const [complaints, setComplaints] = useState<ComplaintDoc[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<"ALL" | ComplaintStatus>("ALL");
  const [searchText, setSearchText] = useState("");
  const [selectedComplaintId, setSelectedComplaintId] = useState<string>("");
  const [loadingComplaints, setLoadingComplaints] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const q = query(
      collection(db, "complaints"),
      where(
        "assignedDepartment",
        "==",
        department
      ),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const liveComplaints = snapshot.docs.map((item) => {
          const data = item.data() as Omit<ComplaintDoc, "id">;
          return { id: item.id, ...data };
        });

        setComplaints(liveComplaints);
        setSelectedComplaintId((prev) => {
          if (prev && liveComplaints.some((item) => item.id === prev)) return prev;
          return liveComplaints[0]?.id ?? "";
        });
        setLoadingComplaints(false);
        setError("");
      },
      (err) => {
        setError(err.message);
        setLoadingComplaints(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const selectedComplaint = useMemo(
    () => complaints.find((item) => item.id === selectedComplaintId) ?? complaints[0] ?? null,
    [complaints, selectedComplaintId]
  );

  const assignDepartment = async (
    complaint: ComplaintDoc,
    department: string
  ) => {

    await updateDoc(
      doc(db, "complaints", complaint.id),
      {
        assignedDepartment: department,
        status: "IN_PROGRESS",
        assignedAt: Date.now(),
        updatedAt: Date.now(),
      }
    );

    setAssignMenuComplaint(null);
  };

  const filteredComplaints = useMemo(() => {
    return complaints.filter((item) => {
      const matchesFilter = selectedFilter === "ALL" ? true : item.status === selectedFilter;
      const q = searchText.trim().toLowerCase();
      const matchesQuery =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.location.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.reportedBy ?? "").toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [complaints, searchText, selectedFilter]);

  const totalCount = complaints.length;
  const openCount = complaints.filter((item) => item.status === "OPEN").length;
  const progressCount = complaints.filter((item) => item.status === "IN_PROGRESS").length;
  const resolvedCount = complaints.filter((item) => item.status === "RESOLVED").length;

  const updateComplaint = async (
    complaint: ComplaintDoc,
    payload: Partial<
      Pick<
        ComplaintDoc,
        | "status"
        | "assignedDepartment"
        | "adminNote"
        | "departmentRemark"
      >
    >
  ) => {
    try {
      await updateDoc(doc(db, "complaints", complaint.id), {
        ...payload,
        updatedAt: Date.now(),
      });
      setError("");
    } catch (err: any) {
      setError(err?.message ?? "Failed to update complaint");
    }
  };

  const setStatus = async (
    complaint: ComplaintDoc,
    status: ComplaintStatus
  ) => {
    await updateComplaint(complaint, {
      status,
    });
  };

  const saveNote = async (complaint: ComplaintDoc, note: string) => {
    await updateComplaint(complaint, { adminNote: note });
  };

  return (
    <div className="min-h-screen bg-[#0b1020] text-white">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <Sidebar onLogout={() => signOut(auth)} />

        <main className="p-5 lg:p-8">
          <div className="flex flex-col gap-5">
            <header className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-xl shadow-black/20 backdrop-blur lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Dashboard Overview</span>
                </div>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-white">Complaint Management Console</h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-400">
                  Review complaints, assign departments, and track resolution progress from one place.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Badge className="border-white/10 bg-white/5 text-slate-300">{user.email}</Badge>
                <Button variant="outline" className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10">
                  <MapPinned className="mr-2 h-4 w-4" />
                  Map View
                </Button>
                <Button className="bg-blue-500 text-white hover:bg-blue-600">
                  <ArrowUpRight className="mr-2 h-4 w-4" />
                  Export Report
                </Button>
              </div>
            </header>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <AdminStatCard
                title="Total Complaints"
                value={String(totalCount)}
                subtitle="All civic issues"
                icon={ClipboardList}
                accentClass="border-blue-500/20 bg-blue-500/10 text-blue-300"
              />
              <AdminStatCard
                title="Open Issues"
                value={String(openCount)}
                subtitle="Need immediate action"
                icon={CircleAlert}
                accentClass="border-red-500/20 bg-red-500/10 text-red-300"
              />
              <AdminStatCard
                title="In Progress"
                value={String(progressCount)}
                subtitle="Assigned to departments"
                icon={Wrench}
                accentClass="border-amber-500/20 bg-amber-500/10 text-amber-300"
              />
              <AdminStatCard
                title="Resolved"
                value={String(resolvedCount)}
                subtitle="Completed complaints"
                icon={CheckCircle2}
                accentClass="border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
              />
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.35fr_0.85fr]">
              <Card className="border-white/10 bg-slate-950/70 text-white shadow-xl shadow-black/20 backdrop-blur">
                <CardHeader className="space-y-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <CardTitle className="text-xl">Complaint Queue</CardTitle>
                      <CardDescription className="text-slate-400">
                        Review and manage citizen complaints.
                      </CardDescription>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="relative w-full sm:w-72">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        <Input
                          value={searchText}
                          onChange={(e) => setSearchText(e.target.value)}
                          placeholder="Search complaint, location, ID..."
                          className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-slate-500"
                        />
                      </div>
                      <Button variant="outline" className="border-white/10 bg-white/5 text-slate-200 hover:bg-white/10">
                        <Filter className="mr-2 h-4 w-4" />
                        Filters
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {filters.map((filter) => (
                      <button
                        key={filter}
                        onClick={() => setSelectedFilter(filter)}
                        className={`rounded-full border px-4 py-2 text-xs font-semibold tracking-wide transition ${selectedFilter === filter
                          ? "border-blue-500/30 bg-blue-500/15 text-blue-300"
                          : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                          }`}
                      >
                        {filter.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {loadingComplaints ? (
                    <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 text-sm text-slate-400">
                      Loading complaints...
                    </div>
                  ) : filteredComplaints.length === 0 ? (
                    <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 text-sm text-slate-400">
                      No complaints found for the current filter.
                    </div>
                  ) : (
                    filteredComplaints.map((item, index) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.04 }}
                      >
                        <div
                          onClick={() => setSelectedComplaintId(item.id)}
                          className="cursor-pointer rounded-3xl border border-white/10 bg-slate-900/80 p-4 transition hover:border-blue-500/20 hover:bg-slate-900"
                        >
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="border-white/10 bg-white/5 text-slate-300">
                                  {item.id}
                                </Badge>
                                <Badge className={statusStyles[item.status]}>{item.status.replace("_", " ")}</Badge>
                                <Badge variant="outline" className="border-blue-500/20 bg-blue-500/10 text-blue-300">
                                  {item.priority ?? "Medium"} Priority
                                </Badge>
                              </div>

                              <div>
                                <h3 className="text-base font-semibold text-white">{item.title}</h3>
                                <p className="mt-1 text-sm text-slate-400">
                                  {item.category} • {item.location}
                                </p>
                              </div>

                              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                                <span>Reported by: {item.reportedBy ?? "Citizen"}</span>
                                <span>Submitted: {formatRelativeTime(item.createdAt)}</span>
                              </div>
                            </div>

                            <div className="flex flex-col gap-2 lg:items-end">
                              <Button size="sm" className="bg-blue-500 text-white hover:bg-blue-600">
                                View Details
                              </Button>
                              <div className="flex flex-wrap gap-2">

                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                                  onClick={(e) => {

                                    e.stopPropagation();

                                    setStatus(item, "RESOLVED");

                                  }}
                                >

                                  Mark Completed

                                </Button>

                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}

                  {error ? <p className="text-sm text-red-300">{error}</p> : null}
                </CardContent>
              </Card>

              <div className="space-y-5">
                <ComplaintDetailsPanel
                  complaint={selectedComplaint}
                  onAssign={(complaint) => setStatus(complaint, "IN_PROGRESS")}
                  onResolve={(complaint) => setStatus(complaint, "RESOLVED")}
                  onReject={(complaint) => setStatus(complaint, "REJECTED")}
                  onReopen={(complaint) => setStatus(complaint, "OPEN")}
                  onSaveNote={saveNote}
                />

              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [ready, setReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setReady(false);
      setAuthError("");

      if (!fbUser) {
        setUser(null);
        setReady(true);
        return;
      }

      try {
        const profileSnap = await getDoc(doc(db, "users", fbUser.uid));
        const profile = profileSnap.exists() ? (profileSnap.data() as AdminProfile) : null;

        if (!profile) {

          await signOut(auth);

          setAuthError("Profile not found.");

          setUser(null);

          setReady(true);

          return;

        }

        setUser(fbUser);

        setRole(profile.role || "");

        setDepartment(profile.department || "");

        setReady(true);
      } catch (err: any) {
        setAuthError(err?.message ?? "Failed to load profile");
        setUser(null);
        setReady(true);
      }
    });

    return () => unsub();
  }, []);

  const handleLogin = async (email: string, password: string) => {
    setAuthLoading(true);
    setAuthError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setAuthError(err?.message ?? "Login failed");
    } finally {
      setAuthLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1020] text-white">
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 px-6 py-5 text-sm text-slate-300 shadow-xl shadow-black/20">
          Loading admin panel...
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} loading={authLoading} error={authError} />;
  }

  if (role === "admin") {

    return <AdminDashboardPage user={user} />;

  }

  if (role === "staff") {

    return <StaffDashboardPage
      user={user}
      department={department}
    />;

  }

  return <div>Access Denied</div>;
}
