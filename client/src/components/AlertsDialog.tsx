import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Check, ExternalLink, Heart } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface AlertsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AlertsDialog({ open, onOpenChange }: AlertsDialogProps) {
  const utils = trpc.useUtils();
  const alertsQuery = trpc.alerts.list.useQuery();
  const deleteAlert = trpc.alerts.delete.useMutation({
    onSuccess: () => {
      utils.alerts.list.invalidate();
      utils.alerts.unreadCount.invalidate();
      toast.success("Alert cleared");
    },
  });

  const handleDeleteAlert = (alertId: string) => {
    deleteAlert.mutate({ id: alertId });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Alerts</DialogTitle>
          <DialogDescription>
            Posts that exceeded your configured reaction thresholds
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {alertsQuery.isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              Loading alerts...
            </div>
          )}

          {!alertsQuery.isLoading && (!alertsQuery.data || alertsQuery.data.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              No alerts yet. Alerts will appear when posts exceed your configured thresholds.
            </div>
          )}

          {alertsQuery.data?.map((alert) => (
            <div
              key={alert.id}
              className="glass-card p-4 rounded-lg space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Heart className="h-4 w-4 text-accent flex-shrink-0" />
                    <span className="font-semibold">
                      {alert.reactionCount.toLocaleString()} reactions
                    </span>
                    <span className="text-muted-foreground text-sm">
                      (threshold: {alert.threshold})
                    </span>
                  </div>
                  
                  {alert.postMessage && (
                    <p className="text-sm line-clamp-2 mb-2">{alert.postMessage}</p>
                  )}

                  {alert.postImage && (
                    <div className="relative w-full aspect-video rounded-lg overflow-hidden mb-2">
                      <img
                        src={alert.postImage}
                        alt="Post preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {alert.postDate && (
                      <span>
                        Posted {formatDistanceToNow(new Date(alert.postDate), { addSuffix: true })}
                      </span>
                    )}
                    {alert.triggeredAt && (
                      <span>
                        Triggered {formatDistanceToNow(new Date(alert.triggeredAt), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDeleteAlert(alert.id)}
                    disabled={deleteAlert.isPending}
                    title="Clear alert"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  {alert.postLink && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => window.open(alert.postLink!, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

