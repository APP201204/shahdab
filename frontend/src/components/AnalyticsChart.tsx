import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const DEFAULT_COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042"];

type ChartType = "line" | "bar" | "pie";

interface AnalyticsChartProps {
  type: ChartType;
  data: any[];
  xKey?: string;
  yKey?: string;
  nameKey?: string;
  valueKey?: string;
  color?: string;
  colors?: string[];
  height?: number;
  title?: string;
}

export function AnalyticsChart({
  type,
  data,
  xKey = "period",
  yKey = "value",
  nameKey = "name",
  valueKey = "value",
  color = "#8884d8",
  colors = DEFAULT_COLORS,
  height = 256,
  title,
}: AnalyticsChartProps) {
  const chart =
    type === "line" ? (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey={yKey}
            stroke={color}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    ) : type === "bar" ? (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey={yKey} fill={color} />
        </BarChart>
      </ResponsiveContainer>
    ) : (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey={valueKey}
            nameKey={nameKey}
            outerRadius={80}
            label
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      {title && <h3 className="mb-2 text-sm font-medium">{title}</h3>}
      <div className="h-64">{chart}</div>
    </div>
  );
}
