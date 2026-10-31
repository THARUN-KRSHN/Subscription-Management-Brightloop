"use client";
import { Card } from "@/components/Card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

export function ChartCard({ data }: { data: { month: string; invoiced: number; received: number }[] }) {
  return (
    <Card className="h-80">
      <div className="mb-3 text-sm font-medium text-muted-foreground">Invoiced vs received</div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 4, right: 4, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="month" stroke="#64748B" tick={{ fontSize: 12 }} />
            <YAxis stroke="#64748B" tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="invoiced" fill="#16C8A3" radius={[6,6,0,0]} />
            <Bar dataKey="received" fill="#6366F1" radius={[6,6,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
