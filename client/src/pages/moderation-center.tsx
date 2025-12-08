import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  import EmptyState from "@/components/EmptyState";

  export default function ModerationCenter() {
    return <EmptyState title="Moderation Center" message="No data available yet." />;
  }
                    </div>
                  )}

                  {/* Final Action */}
                  {report.finalAction && (
                    <div className="border-t pt-4">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-semibold">Final Action:</span>
                        <Badge variant="secondary">{report.finalAction.replace('_', ' ')}</Badge>
                        {report.actionReason && (
                          <span className="text-gray-600">- {report.actionReason}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}