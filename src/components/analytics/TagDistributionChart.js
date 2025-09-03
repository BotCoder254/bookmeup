import React, { useState, useEffect } from "react";
import { apiClient } from "../../utils";
import { motion } from "framer-motion";
import { FiTag, FiInfo } from "react-icons/fi";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
  Sector,
} from "recharts";
import { useMediaQuery } from "react-responsive";
import { useQuery } from "@tanstack/react-query";
import LoadingSpinner from "../LoadingSpinner";

// Process tag data from the API
const processTagData = (tags) => {
  // Ensure tags is an array
  if (!tags || !Array.isArray(tags) || tags.length === 0) {
    console.log("No valid tags array to process:", tags);
    return [];
  }

  // Create data array for the chart
  return tags
    .filter((tag) => tag && typeof tag === "object") // Ensure each tag is a valid object
    .map((tag) => ({
      name: tag.name || "Unnamed Tag",
      value: tag.bookmark_count || 0,
      color: tag.color || "#6366f1",
    }))
    .sort((a, b) => b.value - a.value);
};

const COLORS = [
  "#6366f1", // indigo-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#f43f5e", // rose-500
  "#f59e0b", // amber-500
  "#10b981", // emerald-500
  "#06b6d4", // cyan-500
  "#3b82f6", // blue-500
  "#a855f7", // purple-500
];

const TagDistributionChart = () => {
  const [tagData, setTagData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showInfo, setShowInfo] = useState(false);

  const isMobile = useMediaQuery({ maxWidth: 768 });

  // Fetch real tag data from API
  const { data: tagApiData, isLoading: tagsLoading } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      return await apiClient.getTags();
    },
  });

  useEffect(() => {
    if (!tagsLoading && tagApiData) {
      setIsLoading(true);
      // Process real data instead of generating fake data
      // Handle different possible response structures
      let tagsToProcess = [];

      // Check if tagApiData is an array directly
      if (Array.isArray(tagApiData)) {
        tagsToProcess = tagApiData;
      }
      // Check if tagApiData has a results array
      else if (tagApiData.results && Array.isArray(tagApiData.results)) {
        tagsToProcess = tagApiData.results;
      }
      // Check if tagApiData has a tags array
      else if (tagApiData.tags && Array.isArray(tagApiData.tags)) {
        tagsToProcess = tagApiData.tags;
      }

      const processedData = processTagData(tagsToProcess);
      setTagData(processedData);
      setIsLoading(false);
    }
  }, [tagApiData, tagsLoading]);

  const onPieEnter = (_, index) => {
    setActiveIndex(index);
  };

  const renderActiveShape = (props) => {
    const {
      cx,
      cy,
      midAngle,
      innerRadius,
      outerRadius,
      startAngle,
      endAngle,
      fill,
      payload,
      percent,
      value,
    } = props;

    const RADIAN = Math.PI / 180;
    const sin = Math.sin(-RADIAN * midAngle);
    const cos = Math.cos(-RADIAN * midAngle);
    const sx = cx + (outerRadius + 10) * cos;
    const sy = cy + (outerRadius + 10) * sin;
    const mx = cx + (outerRadius + 30) * cos;
    const my = cy + (outerRadius + 30) * sin;
    const ex = mx + (cos >= 0 ? 1 : -1) * 22;
    const ey = my;
    const textAnchor = cos >= 0 ? "start" : "end";

    return (
      <g>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
        />
        <Sector
          cx={cx}
          cy={cy}
          startAngle={startAngle}
          endAngle={endAngle}
          innerRadius={outerRadius + 6}
          outerRadius={outerRadius + 10}
          fill={fill}
        />
        {!isMobile && (
          <>
            <path
              d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
              stroke={fill}
              fill="none"
            />
            <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
            <text
              x={ex + (cos >= 0 ? 1 : -1) * 12}
              y={ey}
              textAnchor={textAnchor}
              fill="#333"
              className="text-xs"
            >
              {`${payload.name}: ${value}`}
            </text>
            <text
              x={ex + (cos >= 0 ? 1 : -1) * 12}
              y={ey}
              dy={18}
              textAnchor={textAnchor}
              fill="#999"
              className="text-xs"
            >
              {`(${percent ? (percent * 100).toFixed(2) : 0}%)`}
            </text>
          </>
        )}
      </g>
    );
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const totalValue = tagData.reduce((a, b) => a + (b.value || 0), 0);
      const percentage =
        totalValue > 0
          ? ((payload[0].value / totalValue) * 100).toFixed(1)
          : "0";

      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 shadow-lg rounded-md">
          <p className="font-medium text-gray-700 dark:text-gray-300">
            {payload[0].name}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {`Value: ${payload[0].value} (${percentage}%)`}
          </p>
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
          <FiTag className="w-4 h-4 mr-2 text-purple-500" />
          Tag Distribution
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
          className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 p-3 rounded-md mb-4 text-sm"
        >
          <p>
            This chart shows the distribution of tags across your bookmarks.
            Hover or click on segments to see more details.
          </p>
        </motion.div>
      )}

      {tagData.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-72 text-gray-500 dark:text-gray-400">
          <FiTag className="w-12 h-12 mb-2 opacity-50" />
          <p>No tags data available.</p>
          <p className="text-sm mt-2">
            Add tags to your bookmarks to see them here.
          </p>
        </div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                activeIndex={activeIndex}
                activeShape={renderActiveShape}
                data={tagData}
                cx="50%"
                cy="50%"
                innerRadius={isMobile ? 60 : 70}
                outerRadius={isMobile ? 80 : 90}
                fill="#8884d8"
                dataKey="value"
                onMouseEnter={onPieEnter}
                paddingAngle={1}
              >
                {tagData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color || COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default TagDistributionChart;
