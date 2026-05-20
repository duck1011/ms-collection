import { useEffect, useMemo } from "react";
import { useReceiptStore } from "@/store/receipts";
import { formatRupiah, formatDateShort } from "@/lib/utils";
import { Receipt } from "@/lib/db";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { subDays, startOfDay, format, parseISO } from "date-fns";
import { id } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";

function isToday(iso: string) {
  const d = parseISO(iso);
  const today = startOfDay(new Date());
  return startOfDay(d).getTime() === today.getTime();
}

function isThisWeek(iso: string) {
  const d = parseISO(iso);
  const weekAgo = startOfDay(subDays(new Date(), 6));
  return d >= weekAgo;
}

function isThisMonth(iso: string) {
  const d = parseISO(iso);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  delay,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="bg-card border border-border rounded-2xl p-5 space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground" data-testid={`stat-${label.replace(/\s/g, "-").toLowerCase()}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </motion.div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  PAID: "#22c55e",
  PARTIALLY_PAID: "#f59e0b",
  UNPAID: "#ef4444",
};

export default function Dashboard() {
  const { receipts, load, loaded } = useReceiptStore();

  useEffect(() => {
    if (!loaded) load();
  }, [load, loaded]);

  const stats = useMemo(() => {
    const revenueToday = receipts
      .filter((r) => isToday(r.createdAt))
      .reduce((s, r) => s + r.paidAmount, 0);
    const revenueWeek = receipts
      .filter((r) => isThisWeek(r.createdAt))
      .reduce((s, r) => s + r.paidAmount, 0);
    const revenueMonth = receipts
      .filter((r) => isThisMonth(r.createdAt))
      .reduce((s, r) => s + r.paidAmount, 0);
    const pending = receipts.filter(
      (r) => r.paymentStatus === "UNPAID" || r.paymentStatus === "PARTIALLY_PAID"
    ).length;
    return { revenueToday, revenueWeek, revenueMonth, pending };
  }, [receipts]);

  const weeklyChartData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const day = subDays(new Date(), 6 - i);
      const label = format(day, "EEE", { locale: id });
      const start = startOfDay(day).getTime();
      const end = start + 86400000;
      const total = receipts
        .filter((r) => {
          const t = parseISO(r.createdAt).getTime();
          return t >= start && t < end;
        })
        .reduce((s, r) => s + r.paidAmount, 0);
      return { label, total };
    });
  }, [receipts]);

  const monthlyChartData = useMemo(() => {
    return Array.from({ length: 4 }, (_, i) => {
      const weekStart = subDays(new Date(), (3 - i) * 7 + 6);
      const weekEnd = subDays(new Date(), (3 - i) * 7);
      const label = `Mgg ${i + 1}`;
      const total = receipts
        .filter((r) => {
          const t = parseISO(r.createdAt);
          return t >= startOfDay(weekStart) && t <= weekEnd;
        })
        .reduce((s, r) => s + r.paidAmount, 0);
      return { label, total };
    });
  }, [receipts]);

  const pieData = useMemo(() => {
    const counts = { PAID: 0, PARTIALLY_PAID: 0, UNPAID: 0 };
    receipts.forEach((r) => counts[r.paymentStatus]++);
    return [
      { name: "Lunas", value: counts.PAID, key: "PAID" },
      { name: "Sebagian", value: counts.PARTIALLY_PAID, key: "PARTIALLY_PAID" },
      { name: "Belum Bayar", value: counts.UNPAID, key: "UNPAID" },
    ].filter((d) => d.value > 0);
  }, [receipts]);

  const healthPct =
    receipts.length === 0
      ? 0
      : (receipts.filter((r) => r.paymentStatus === "UNPAID" || r.paymentStatus === "PARTIALLY_PAID").length /
          receipts.length) *
        100;

  const health =
    healthPct < 20
      ? { label: "Baik Sekali", color: "text-green-500", icon: CheckCircle2, dot: "🟢" }
      : healthPct < 50
      ? { label: "Perlu Perhatian", color: "text-yellow-500", icon: AlertTriangle, dot: "🟡" }
      : { label: "Perlu Tindakan", color: "text-red-500", icon: XCircle, dot: "🔴" };

  const recentReceipts: Receipt[] = [...receipts]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  const customTooltip = ({ active, payload }: { active?: boolean; payload?: { value: number }[] }) => {
    if (active && payload?.length) {
      return (
        <div className="bg-popover border border-border rounded-lg px-3 py-2 text-xs">
          <p className="font-medium">{formatRupiah(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Ringkasan bisnis MS Collection</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Pendapatan Hari Ini"
          value={formatRupiah(stats.revenueToday)}
          icon={TrendingUp}
          delay={0}
        />
        <StatCard
          label="Pendapatan Minggu Ini"
          value={formatRupiah(stats.revenueWeek)}
          icon={Calendar}
          delay={0.05}
        />
        <StatCard
          label="Pendapatan Bulan Ini"
          value={formatRupiah(stats.revenueMonth)}
          icon={TrendingUp}
          delay={0.1}
        />
        <StatCard
          label="Tagihan Tertunda"
          value={String(stats.pending)}
          sub="nota belum lunas"
          icon={AlertCircle}
          delay={0.15}
        />
      </div>

      {/* Business Health */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-card border border-border rounded-2xl p-5 flex items-center gap-4"
      >
        <span className="text-2xl">{health.dot}</span>
        <div>
          <p className="text-sm text-muted-foreground font-medium">Kesehatan Bisnis</p>
          <p className={`text-lg font-bold ${health.color}`}>{health.label}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-muted-foreground">{Math.round(healthPct)}% tagihan tertunda</p>
          <p className="text-xs text-muted-foreground">{receipts.length} total nota</p>
        </div>
      </motion.div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-card border border-border rounded-2xl p-5"
        >
          <p className="text-sm font-semibold text-foreground mb-4">Pendapatan 7 Hari</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weeklyChartData}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip content={customTooltip} />
              <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="hsl(var(--chart-1))" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card border border-border rounded-2xl p-5"
        >
          <p className="text-sm font-semibold text-foreground mb-4">Pendapatan Bulanan</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={monthlyChartData}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip content={customTooltip} />
              <Line type="monotone" dataKey="total" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-card border border-border rounded-2xl p-5"
        >
          <p className="text-sm font-semibold text-foreground mb-4">Status Pembayaran</p>
          {pieData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada data</p>
          ) : (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value">
                    {pieData.map((entry) => (
                      <Cell key={entry.key} fill={STATUS_COLORS[entry.key]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`${v} nota`]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {pieData.map((d) => (
                  <div key={d.key} className="flex items-center gap-2 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLORS[d.key] }} />
                    <span className="text-muted-foreground">{d.name}</span>
                    <span className="font-medium ml-auto pl-4">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-card border border-border rounded-2xl p-5"
        >
          <p className="text-sm font-semibold text-foreground mb-4">Nota Terbaru</p>
          {recentReceipts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada nota</p>
          ) : (
            <div className="space-y-3">
              {recentReceipts.map((r) => (
                <div key={r.receiptCode} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">{r.clientName}</p>
                    <p className="text-xs text-muted-foreground">{r.receiptCode}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatRupiah(r.totalPrice)}</p>
                    <StatusBadge status={r.paymentStatus} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Receipt["paymentStatus"] }) {
  const map = {
    PAID: { label: "Lunas", className: "text-green-500 bg-green-500/10" },
    PARTIALLY_PAID: { label: "Sebagian", className: "text-yellow-500 bg-yellow-500/10" },
    UNPAID: { label: "Belum Bayar", className: "text-red-500 bg-red-500/10" },
  };
  const { label, className } = map[status];
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${className}`}>
      {label}
    </span>
  );
}
