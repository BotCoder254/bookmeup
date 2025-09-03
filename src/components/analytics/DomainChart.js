import React, { useState } from "react";
import { motion } from "framer-motion";
import { FiGlobe, FiInfo } from "react-icons/fi";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Cell,
} from "recharts";
import { useMediaQuery } from "react-responsive";

const DomainChart = ({ domains = [] }) => {
  const [showInfo, setShowInfo] = useState(false);
  const isMobile = useMediaQuery({ maxWidth: 768 });

  // Sort and prepare data for the chart
  const chartData = [...domains]
    .sort((a, b) => b.count - a.count)
    .slice(0, 7)
    .map((item, index) => ({
      name: item.domain || "unknown",
      value: item.count,
      fill: getColorForIndex(index),
    }));

  // Get color based on index
  function getColorForIndex(index) {
    const colors = [
      "#6366f1", // indigo-500
      "#3b82f6", // blue-500
      "#06b6d4", // cyan-500
      "#10b981", // emerald-500
      "#f59e0b", // amber-500
      "#f43f5e", // rose-500
      "#8b5cf6", // violet-500
    ];
    return colors[index % colors.length];
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 shadow-lg rounded-md">
          <p className="font-medium text-gray-700 dark:text-gray-300">
            {label}
          </p>
          <div className="flex items-center mt-2">
            <div
              className="w-3 h-3 rounded-full mr-2"
              style={{ backgroundColor: payload[0].payload.fill }}
            ></div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {`Bookmarks: ${payload[0].value}`}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center">
          <FiGlobe className="w-4 h-4 mr-2 text-blue-500" />
          Domains Distribution
        </h3>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <FiInfo className="w-4 h-4" />
        </button>
      </div>

      {showInfo && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 p-3 rounded-md mb-4 text-sm"
        >
          <p>
            This chart shows the distribution of bookmarks across different
            domains. Only the top 7 domains are shown.
          </p>
        </motion.div>
      )}

      {chartData.length === 0 ? (
        <div className="flex justify-center items-center h-72">
          <p className="text-gray-500 dark:text-gray-400">
            No domain data available
          </p>
        </div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{
                top: 5,
                right: 30,
                left: isMobile ? 70 : 90,
                bottom: 5,
              }}
              barSize={isMobile ? 15 : 25}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={true}
                vertical={false}
                stroke="#e5e7eb"
              />
              <XAxis
                type="number"
                tick={{
                  fill: "#6b7280",
                  fontSize: isMobile ? 10 : 12,
                }}
                axisLine={{ stroke: "#e5e7eb" }}
                tickLine={{ stroke: "#e5e7eb" }}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{
                  fill: "#6b7280",
                  fontSize: isMobile ? 10 : 12,
                }}
                axisLine={{ stroke: "#e5e7eb" }}
                tickLine={{ stroke: "#e5e7eb" }}
                width={isMobile ? 70 : 90}
                tickFormatter={(value) =>
                  value.length > (isMobile ? 8 : 12)
                    ? `${value.substring(0, isMobile ? 8 : 12)}...`
                    : value
                }
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="value"
                name="Bookmarks"
                radius={[0, 4, 4, 0]}
                animationDuration={1000}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
                <LabelList
                  dataKey="value"
                  position="right"
                  fill="#6b7280"
                  fontSize={12}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default DomainChart;
