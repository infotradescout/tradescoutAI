/**
 * Admin Knowledge Manager
 *
 * Dashboard for admins to visualize and manage Scout's intelligence base.
 * Shows what's indexed, what's missing, and allows bulk uploads.
 */

import React, { useState } from "react";
import clsx from "clsx";

export interface KnowledgeCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  fileCount: number;
  lastUpdated: string;
  status: "complete" | "partial" | "empty";
  coverage: number; // 0-100%
}

export interface KnowledgeStats {
  totalFiles: number;
  totalIndexed: number;
  lastIndexed: string;
  indexingProgress: number; // 0-100%
  costSavings: {
    daily: number;
    monthly: number;
    yearly: number;
  };
}

interface AdminKnowledgeManagerProps {
  categories: KnowledgeCategory[];
  stats: KnowledgeStats;
  onUpload: (files: File[]) => void;
  onReindex: () => void;
  onDeleteCategory: (id: string) => void;
  isIndexing?: boolean;
}

const statusColors = {
  complete: "bg-green-900 text-green-200 border-green-700",
  partial: "bg-orange-900 text-orange-200 border-orange-700",
  empty: "bg-red-900 text-red-200 border-red-700",
};

export function AdminKnowledgeManager({
  categories,
  stats,
  onUpload,
  onReindex,
  onDeleteCategory,
  isIndexing = false,
}: AdminKnowledgeManagerProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files);
    onUpload(files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    onUpload(files);
  };

  return (
    <div className="w-full min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900 to-purple-800 px-6 py-8 border-b border-purple-700">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <span className="text-4xl">🧠</span>
          Scout Knowledge Manager
        </h1>
        <p className="text-purple-200">Manage Scout's intelligence base and indexing</p>
      </div>

      {/* Stats Overview */}
      <div className="px-6 py-6 border-b border-gray-700 grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Total Files" value={stats.totalFiles} icon="📁" color="blue" />
        <StatCard
          label="Indexed"
          value={stats.totalIndexed}
          icon="✓"
          color="green"
          subtext={`${Math.round((stats.totalIndexed / Math.max(stats.totalFiles, 1)) * 100)}%`}
        />
        <StatCard
          label="Daily Savings"
          value={`$${stats.costSavings.daily.toFixed(2)}`}
          icon="💰"
          color="purple"
        />
        <StatCard
          label="Yearly Savings"
          value={`$${stats.costSavings.yearly.toFixed(0)}`}
          icon="📈"
          color="orange"
        />
      </div>

      {/* Indexing Status */}
      {isIndexing && (
        <div className="px-6 py-4 bg-blue-900 border-b border-blue-700">
          <div className="flex items-center gap-3 mb-2">
            <span className="inline-block animate-spin">⏳</span>
            <p className="font-semibold">Indexing in progress...</p>
          </div>
          <div className="w-full bg-blue-800 rounded-full h-2">
            <div
              className="bg-blue-400 h-2 rounded-full transition-all"
              style={{ width: `${stats.indexingProgress}%` }}
            />
          </div>
          <p className="text-sm text-blue-200 mt-2">{stats.indexingProgress}% complete</p>
        </div>
      )}

      {/* Upload Area */}
      <div className="px-6 py-6 border-b border-gray-700">
        <h2 className="text-lg font-semibold mb-4 text-gray-300">Upload Knowledge Files</h2>
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={clsx(
            "p-8 border-2 border-dashed rounded-lg text-center transition-colors",
            dragActive
              ? "border-blue-400 bg-blue-900 bg-opacity-20"
              : "border-gray-600 bg-gray-800 hover:border-gray-500"
          )}
        >
          <p className="text-4xl mb-3">📤</p>
          <p className="text-lg font-semibold mb-2">Drag files here or click to upload</p>
          <p className="text-sm text-gray-400 mb-4">Supported: .docx, .pdf, .txt, .md</p>
          <label className="inline-block">
            <input
              type="file"
              multiple
              onChange={handleFileInput}
              className="hidden"
              accept=".docx,.pdf,.txt,.md"
              disabled={isIndexing}
            />
            <span className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold cursor-pointer inline-block transition-colors">
              Choose Files
            </span>
          </label>
        </div>
      </div>

      {/* Categories */}
      <div className="px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-300">Knowledge Categories</h2>
          <button
            onClick={onReindex}
            disabled={isIndexing}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded-lg font-semibold transition-colors"
          >
            🔄 Reindex All
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              isSelected={selectedCategory === category.id}
              onSelect={() =>
                setSelectedCategory(selectedCategory === category.id ? null : category.id)
              }
              onDelete={() => onDeleteCategory(category.id)}
            />
          ))}
        </div>
      </div>

      {/* Category Details */}
      {selectedCategory && (
        <div className="px-6 py-6 border-t border-gray-700 bg-gray-800 rounded-lg mt-6">
          {categories.find((c) => c.id === selectedCategory) && (
            <CategoryDetails category={categories.find((c) => c.id === selectedCategory)!} />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Stat Card Component
 */
function StatCard({
  label,
  value,
  icon,
  color,
  subtext,
}: {
  label: string;
  value: string | number;
  icon: string;
  color: "blue" | "green" | "purple" | "orange";
  subtext?: string;
}) {
  const colorClasses = {
    blue: "bg-blue-900 border-blue-700",
    green: "bg-green-900 border-green-700",
    purple: "bg-purple-900 border-purple-700",
    orange: "bg-orange-900 border-orange-700",
  };

  return (
    <div className={clsx("p-4 rounded-lg border", colorClasses[color])}>
      <div className="text-3xl mb-2">{icon}</div>
      <p className="text-sm text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
    </div>
  );
}

/**
 * Category Card Component
 */
function CategoryCard({
  category,
  isSelected,
  onSelect,
  onDelete,
}: {
  category: KnowledgeCategory;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={clsx(
        "p-4 rounded-lg border-2 cursor-pointer transition-all",
        isSelected
          ? "border-blue-500 bg-blue-900 bg-opacity-20"
          : "border-gray-700 bg-gray-800 hover:border-gray-600"
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="text-3xl">{category.icon}</div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1 hover:bg-red-900 rounded transition-colors text-red-400"
          title="Delete"
        >
          🗑️
        </button>
      </div>
      <h3 className="font-semibold text-white mb-1">{category.name}</h3>
      <p className="text-sm text-gray-400 mb-3">{category.description}</p>

      <div className="space-y-2">
        {/* Coverage Bar */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-400">Coverage</span>
            <span className="text-xs font-semibold text-gray-300">{category.coverage}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className={clsx(
                "h-2 rounded-full transition-all",
                category.coverage === 100
                  ? "bg-green-500"
                  : category.coverage >= 50
                    ? "bg-orange-500"
                    : "bg-red-500"
              )}
              style={{ width: `${category.coverage}%` }}
            />
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center justify-between">
          <span
            className={clsx(
              "px-2 py-1 rounded text-xs font-semibold border",
              statusColors[category.status]
            )}
          >
            {category.status.toUpperCase()}
          </span>
          <span className="text-xs text-gray-500">{category.fileCount} files</span>
        </div>

        {/* Last Updated */}
        <p className="text-xs text-gray-500">
          Updated: {new Date(category.lastUpdated).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

/**
 * Category Details Component
 */
function CategoryDetails({ category }: { category: KnowledgeCategory }) {
  return (
    <div>
      <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
        <span>{category.icon}</span>
        {category.name} Details
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-400">Files</p>
          <p className="text-2xl font-bold">{category.fileCount}</p>
        </div>
        <div>
          <p className="text-sm text-gray-400">Coverage</p>
          <p className="text-2xl font-bold">{category.coverage}%</p>
        </div>
        <div>
          <p className="text-sm text-gray-400">Status</p>
          <p
            className={clsx(
              "font-bold mt-1 inline-block px-2 py-1 rounded",
              statusColors[category.status]
            )}
          >
            {category.status.toUpperCase()}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-400">Last Updated</p>
          <p className="font-bold">{new Date(category.lastUpdated).toLocaleDateString()}</p>
        </div>
      </div>
      <p className="text-sm text-gray-400 mt-4">{category.description}</p>
    </div>
  );
}

// Example usage
export function AdminKnowledgeManagerExample() {
  const [isIndexing, setIsIndexing] = useState(false);

  const categories: KnowledgeCategory[] = [
    {
      id: "1",
      name: "Building Codes",
      icon: "📋",
      description: "Permits, inspections, code requirements",
      fileCount: 24,
      lastUpdated: new Date().toISOString(),
      status: "complete",
      coverage: 100,
    },
    {
      id: "2",
      name: "Pricing Data",
      icon: "💰",
      description: "Materials, labor, market rates",
      fileCount: 18,
      lastUpdated: new Date(Date.now() - 86400000).toISOString(),
      status: "partial",
      coverage: 65,
    },
    {
      id: "3",
      name: "Trade Guides",
      icon: "👷",
      description: "Step-by-step project guides",
      fileCount: 12,
      lastUpdated: new Date(Date.now() - 604800000).toISOString(),
      status: "partial",
      coverage: 50,
    },
  ];

  const stats: KnowledgeStats = {
    totalFiles: 54,
    totalIndexed: 48,
    lastIndexed: new Date().toISOString(),
    indexingProgress: 89,
    costSavings: {
      daily: 7.0,
      monthly: 210.0,
      yearly: 2555.0,
    },
  };

  return (
    <AdminKnowledgeManager
      categories={categories}
      stats={stats}
      onUpload={(files) => {
        console.log("Upload:", files);
        setIsIndexing(true);
        setTimeout(() => setIsIndexing(false), 3000);
      }}
      onReindex={() => {
        console.log("Reindex");
        setIsIndexing(true);
        setTimeout(() => setIsIndexing(false), 5000);
      }}
      onDeleteCategory={(id) => console.log("Delete:", id)}
      isIndexing={isIndexing}
    />
  );
}
