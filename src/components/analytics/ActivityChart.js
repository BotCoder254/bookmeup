import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FiCalendar, FiActivity, FiInfo } from "react-icons/fi";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useMediaQuery } from "react-responsive";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../utils";
import LoadingSpinner from "../LoadingSpinner";

// Process activity data from the API
const processActivityData = (activities, timeRange) => {
  let data = [];
  let numEntries = 0;
  let dateFormat = "";

  switch (timeRange) {
    case "week":
      numEntries = 7;
      dateFormat = "ddd";
      break;
    case "month":
      numEntries = 30;
      dateFormat = "MMM D";
      break;
    case "year":
      numEntries = 12;
      dateFormat = "MMM";
      break;
    case "all":
      numEntries = 8;
      dateFormat = "MMM YYYY";
      break;
    default:
      numEntries = 30;
      dateFormat = "MMM D";
  }

  // Create date buckets for the time range
  const dateBuckets = new Map();
  const today = new Date();

  // Initialize all buckets with zeros
  for (let i = 0; i < numEntries; i++) {
    const date = new Date(today);

    if (timeRange === "week") {
      date.setDate(date.getDate() - (numEntries - i - 1));
    } else if (timeRange === "month") {
      date.setDate(date.getDate() - (numEntries - i - 1));
    } else if (timeRange === "year") {
      date.setMonth(date.getMonth() - (numEntries - i - 1));
    } else {
      date.setMonth(date.getMonth() - (numEntries - i - 1) * 3);
    }

    const formattedDate = formatDate(date, dateFormat);
    dateBuckets.set(formattedDate, {
      name: formattedDate,
      Added: 0,
      Visited: 0,
    });
  }

  // Process activity data if available
  if (activities && activities.length) {
    activities.forEach((activity) => {
      const date = new Date(activity.timestamp);
      const formattedDate = formatDate(date, dateFormat);

      // Only process if the date is within our range
      if (dateBuckets.has(formattedDate)) {
        const bucket = dateBuckets.get(formattedDate);

        if (activity.activity_type === "created") {
          bucket.Added += 1;
        } else if (activity.activity_type === "visited") {
          bucket.Visited += 1;
        }

        dateBuckets.set(formattedDate, bucket);
      }
    });
  }

  // Convert map to array for the chart
  return Array.from(dateBuckets.values());
};

const formatDate = (date, format) => {
  // Simple date formatter
  const day = date.getDate();
  const month = date.toLocaleString("default", { month: "short" });
  const year = date.getFullYear();
  const weekday = date.toLocaleString("default", { weekday: "short" });

  if (format === "ddd") return weekday;
  if (format === "MMM") return month;
  if (format === "MMM D") return `${month} ${day}`;
  return `${month} ${year}`;
};

const ActivityChart = ({ timeRange = "month" }) => {
  const [activityData, setActivityData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ["activities", timeRange],
    queryFn: async () => {
      // Calculate date range based on timeRange
      const now = new Date();
      let startDate = new Date();

      if (timeRange === "week") {
        startDate.setDate(now.getDate() - 7);
      } else if (timeRange === "month") {
        startDate.setDate(now.getDate() - 30);
      } else if (timeRange === "year") {
        startDate.setMonth(now.getMonth() - 12);
      } else {
        startDate.setFullYear(now.getFullYear() - 3);
      }

      // Format dates for API
      const startDateStr = startDate.toISOString().split("T")[0];

      // Fetch activities within date range
      return await apiClient.getActivities({
        from_date: startDateStr,
        limit: 1000, // Get enough data for meaningful charts
      });
    },
  });

  const isMobile = useMediaQuery({ maxWidth: 768 });

  useEffect(() => {
    if (!activitiesLoading && activities) {
      setIsLoading(true);
      // Process real data instead of generating fake data
      const processedData = processActivityData(activities.results, timeRange);
      setActivityData(processedData);
      setIsLoading(false);
    }
  }, [activities, activitiesLoading, timeRange]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 shadow-lg rounded-md">
          <p className="font-medium text-gray-700 dark:text-gray-300">
            {label}
          </p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center mt-2">
              <div
                className="w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: entry.color }}
              ></div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {`${entry.name}: ${entry.value}`}
              </p>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="md" />
      </div>
    );
  }

  return (
    <div className="h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center">
          <FiActivity className="w-4 h-4 mr-2 text-blue-500" />
          Bookmark Activity
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
            This chart shows the number of bookmarks added and visited over
            time. You can change the time range using the controls above.
          </p>
        </motion.div>
      )}

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={activityData}
            margin={{
              top: 10,
              right: 10,
              left: isMobile ? 0 : 10,
              bottom: 20,
            }}
            barSize={isMobile ? 10 : 20}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{
                fill: "#6b7280",
                fontSize: isMobile ? 10 : 12,
              }}
              axisLine={{ stroke: "#e5e7eb" }}
              tickLine={{ stroke: "#e5e7eb" }}
            />
            <YAxis
              tick={{
                fill: "#6b7280",
                fontSize: isMobile ? 10 : 12,
              }}
              axisLine={{ stroke: "#e5e7eb" }}
              tickLine={{ stroke: "#e5e7eb" }}
              allowDecimals={false}
              width={isMobile ? 30 : 40}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{
                paddingTop: 10,
                fontSize: 12,
              }}
            />
            <Bar
              dataKey="Added"
              name="Added Bookmarks"
              stackId="a"
              fill="#6366f1"
              radius={[4, 4, 0, 0]}
              animationDuration={1000}
            />
            <Bar
              dataKey="Visited"
              name="Visited Bookmarks"
              stackId="a"
              fill="#60a5fa"
              radius={[4, 4, 0, 0]}
              animationDuration={1500}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ActivityChart;
