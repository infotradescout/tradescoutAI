import React, { useState } from 'react';
import { Bug, Send, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorReportButton } from "./ErrorReportButton";

export function BugReportButton() {
  const [isOpen, setIsOpen] = useState(false);

  try {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 z-50 bg-red-600 hover:bg-red-700 text-white border-red-500"
        >
          <Bug className="h-4 w-4 mr-2" />
          Report Bug
        </Button>
      </>
    );
  } catch (error) {
    console.error('BugReportButton error:', error);
    return null;
  }
}