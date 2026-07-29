/**
 * Draggable Data Tray
 *
 * A floating interface showing unassigned or recently uploaded files.
 * Users can drag files onto the heatmap to assign them to specific counties.
 *
 * Features:
 * - Drag-and-drop file assignment
 * - Filter by file type
 * - Search functionality
 * - Batch operations
 * - Visual feedback during drag
 */

import React, { useState } from "react";
import {
  ChevronDown,
  FileText,
  X,
  Search,
  Filter,
  Upload,
  Trash2,
  Copy,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface DraggableFile {
  id: string;
  name: string;
  type: string; // "building-codes", "pricing-data", etc.
  size: number;
  uploadedAt: Date;
  uploadedBy: string;
  assignedCounty?: string;
  relevanceScore?: number;
}

interface DraggableDataTrayProps {
  onFileAssigned?: (fileId: string, countyFips: string) => void;
  onClose?: () => void;
  isOpen?: boolean;
}

export const DraggableDataTray: React.FC<DraggableDataTrayProps> = ({
  onFileAssigned,
  onClose,
  isOpen = true,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [draggedFile, setDraggedFile] = useState<DraggableFile | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Fetch unassigned files
  const { data: files = [] } = useQuery<DraggableFile[]>({
    queryKey: ["/api/scout/unassigned-files"],
    queryFn: () => apiRequest("GET", "/api/scout/unassigned-files"),
  });

  // Filter files
  const filteredFiles = files.filter((file) => {
    const matchesSearch = file.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !filterType || file.type === filterType;
    return matchesSearch && matchesType;
  });

  // Get unique file types
  const fileTypes = Array.from(new Set(files.map((f) => f.type)));

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, file: DraggableFile) => {
    setDraggedFile(file);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/json", JSON.stringify(file));
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedFile(null);
  };

  // Toggle file selection
  const toggleFileSelection = (fileId: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedFiles(newSelected);
  };

  // Select all
  const selectAll = () => {
    setSelectedFiles(new Set(filteredFiles.map((f) => f.id)));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedFiles(new Set());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 left-4 w-96 max-h-96 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl flex flex-col z-40">
      {/* Header */}
      <div className="border-b border-slate-700 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-slate-500 cursor-grab" />
          <h3 className="font-bold text-white text-sm">Data Tray</h3>
          <Badge variant="outline" className="text-xs">
            {filteredFiles.length}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-slate-400 hover:text-white"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform ${isCollapsed ? "-rotate-90" : ""}`}
            />
          </Button>
          {onClose && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {!isCollapsed && (
        <>
          {/* Search and Filter */}
          <div className="border-b border-slate-700 p-3 space-y-2">
            <Input
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-800 border-slate-700 text-white placeholder-slate-500 text-sm"
              prefix={<Search className="w-3 h-3" />}
            />
            <Select
              value={filterType || "all"}
              onValueChange={(v) => setFilterType(v === "all" ? null : v)}
            >
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white text-sm">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {fileTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.replace("-", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Toolbar */}
          {selectedFiles.size > 0 && (
            <div className="border-b border-slate-700 p-2 flex items-center justify-between bg-slate-800">
              <span className="text-xs text-slate-300">{selectedFiles.size} selected</span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={selectAll}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  <Copy className="w-3 h-3 mr-1" />
                  All
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearSelection}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  <X className="w-3 h-3 mr-1" />
                  Clear
                </Button>
              </div>
            </div>
          )}

          {/* Files List */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {filteredFiles.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-sm">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No files to assign</p>
                </div>
              ) : (
                filteredFiles.map((file) => (
                  <div
                    key={file.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, file)}
                    onDragEnd={handleDragEnd}
                    onClick={() => toggleFileSelection(file.id)}
                    className={`p-2 rounded cursor-move transition-colors ${
                      draggedFile?.id === file.id
                        ? "bg-blue-600 opacity-50"
                        : selectedFiles.has(file.id)
                          ? "bg-blue-900 border border-blue-500"
                          : "bg-slate-800 hover:bg-slate-700 border border-slate-700"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={selectedFiles.has(file.id)}
                        onChange={() => toggleFileSelection(file.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{file.name}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {file.type.replace("-", " ")}
                          </Badge>
                          <span className="text-xs text-slate-500">
                            {(file.size / 1024).toFixed(1)} KB
                          </span>
                        </div>
                        {file.relevanceScore && (
                          <p className="text-xs text-slate-400 mt-1">
                            Relevance: {file.relevanceScore}%
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="border-t border-slate-700 p-2 flex gap-1 bg-slate-800">
            <Button size="sm" variant="outline" className="flex-1 text-xs">
              <Upload className="w-3 h-3 mr-1" />
              Upload
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-red-400 hover:text-red-300"
              disabled={selectedFiles.size === 0}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>

          {/* Drag Hint */}
          <div className="border-t border-slate-700 p-2 bg-slate-800 text-center">
            <p className="text-xs text-slate-400">
              💡 Drag files onto the map to assign to counties
            </p>
          </div>
        </>
      )}
    </div>
  );
};
