import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FiClock, FiInfo } from "react-icons/fi";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useMediaQuery } from "react-responsive";
import LoadingSpinner from "../LoadingSpinner";

// Placeholder data - in a real app, this would come from API
const generateTimelineData = (timeRange) => {
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

  // For demo purposes, generate cumulative data
  let total = Math.floor(Math.random() * 50) + 50; // Start with a random baseline

  for (let i = 0; i < numEntries; i++) {
    const date = new Date();

    if (timeRange === "week") {
      date.setDate(date.getDate() - (numEntries - i - 1));
    } else if (timeRange === "month") {
      date.setDate(date.getDate() - (numEntries - i - 1));
    } else if (timeRange === "year") {
      date.setMonth(date.getMonth() - (numEntries - i - 1));
    } else {
      date.setMonth(date.getMonth() - (numEntries - i - 1) * 3);
    }

    // Format the date based on timeRange
    const formattedDate = formatDate(date, dateFormat);

    // Increase total by a random amount
    total += Math.floor(Math.random() * 10);
    // Add some variability to the read count
    const read = Math.max(0, total - Math.floor(Math.random() * 30) - 20);

    data.push({
      name: formattedDate,
      Total: total,
      Read: read,
    });
  }

  return data;
};

const formatDate = (date, format) => {
  const day = date.getDate();
  const month = date.toLocaleString('default', { month: 'short' });
  const year = date.getFullYear();
  const weekday = date.toLocaleString('default', { weekday: 'short' });

  if (format === 'ddd') return weekday;
  if (format === 'MMM') return month;
  if (format === 'MMM D') return `${month} ${day}`;
  return `${month} ${year}`;
};

const BookmarkTimeline = ({ timeRange = "month" }) => {
  const [timelineData, setTimelineData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);

  const isMobile = useMediaQuery({ maxWidth: 768 });

  useEffect(() => {
    // Simulate API request
    setIsLoading(true);
    setTimeout(() => {
      setTimelineData(generateTimelineData(timeRange));
      setIsLoading(false);
    }, 800);
  }, [timeRange]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 shadow-lg rounded-md">
          <p className="font-medium text-gray-700 dark:text-gray-300">{label}</p>
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
          <FiClock className="w-4 h-4 mr-2 text-green-500" />
          Bookmark Growth Timeline
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
          className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 p-3 rounded-md mb-4 text-sm"
        >
          <p>
            This timeline shows the growth of your bookmark collection over time,
            including the total number of bookmarks and how many you've read.
          </p>
        </motion.div>
      )}

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={timelineData}
            margin={{
              top: 10,
              right: 10,
              left: isMobile ? 0 : 10,
              bottom: 20,
            }}
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
            <Line
              type="monotone"
              dataKey="Total"
              name="Total Bookmarks"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              animationDuration={1000}
            />
            <Line
              type="monotone"
              dataKey="Read"
              name="Read Bookmarks"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
              animationDuration={1500}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default BookmarkTimeline;
