import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { nanoid } from "nanoid";

interface PagesSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onManualFetch: () => void;
  isFetching: boolean;
}

export default function PagesSettingsDialog({ open, onOpenChange, onManualFetch, isFetching }: PagesSettingsDialogProps) {
  const utils = trpc.useUtils();
  const [pages, setPages] = useState<any[]>([]);
  
  const pagesQuery = trpc.managedPages.list.useQuery();
  const createPage = trpc.managedPages.create.useMutation({
    onSuccess: () => {
      utils.managedPages.list.invalidate();
      toast.success("Page added successfully");
    },
  });
  const updatePage = trpc.managedPages.update.useMutation({
    onSuccess: () => {
      utils.managedPages.list.invalidate();
      toast.success("Page updated successfully");
    },
  });
  const deletePage = trpc.managedPages.delete.useMutation({
    onSuccess: () => {
      utils.managedPages.list.invalidate();
      toast.success("Page deleted successfully");
    },
  });

  useEffect(() => {
    if (pagesQuery.data) {
      setPages(pagesQuery.data);
    }
  }, [pagesQuery.data]);

  const handleAddPage = () => {
    const newPage = {
      id: nanoid(),
      profileId: "",
      profileName: "",
      profilePicture: "",
      borderColor: "#22d3ee",
      network: "facebook",
      isNew: true,
    };
    setPages([...pages, newPage]);
  };

  const handleSavePage = async (page: any) => {
    if (!page.profileId || !page.profileName) {
      toast.error("Profile ID and Name are required");
      return;
    }

    if (page.isNew) {
      const { isNew, ...pageData } = page;
      await createPage.mutateAsync(pageData);
      setPages(pages.filter(p => p.id !== page.id));
    } else {
      await updatePage.mutateAsync(page);
    }
  };

  const handleDeletePage = (pageId: string) => {
    const page = pages.find(p => p.id === pageId);
    if (page?.isNew) {
      setPages(pages.filter(p => p.id !== pageId));
    } else {
      deletePage.mutate({ id: pageId });
    }
  };

  const handleUpdatePage = (pageId: string, field: string, value: any) => {
    setPages(pages.map(p => p.id === pageId ? { ...p, [field]: value } : p));
  };

  const colorOptions = [
    "#22d3ee", // cyan
    "#a855f7", // purple
    "#ec4899", // pink
    "#f59e0b", // amber
    "#10b981", // green
    "#ef4444", // red
    "#3b82f6", // blue
    "#f97316", // orange
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pages Settings</DialogTitle>
          <DialogDescription>
            Configure your Facebook pages for the Pages view
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Controls Section */}
          <div className="space-y-4">
            <Label>Controls</Label>
            <div className="flex gap-3">
              <Button
                onClick={onManualFetch}
                variant="outline"
                size="sm"
                disabled={isFetching}
              >
                {isFetching ? 'Fetching...' : 'Fetch Now'}
              </Button>
            </div>
          </div>

          {/* Facebook Pages Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Facebook Pages (Max 3)</Label>
              <Button onClick={handleAddPage} size="sm" variant="outline" disabled={pages.length >= 3}>
                <Plus className="h-4 w-4 mr-2" />
                Add Page
              </Button>
            </div>
            <div className="space-y-4">
              {pages.map((page) => (
                <div key={page.id} className="glass-card p-4 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Fanpage Karma Profile ID</Label>
                      <Input
                        placeholder="e.g., 6815841748"
                        value={page.profileId}
                        onChange={(e) => handleUpdatePage(page.id, "profileId", e.target.value)}
                        disabled={!page.isNew}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Page Name</Label>
                      <Input
                        placeholder="e.g., Football Funnys"
                        value={page.profileName}
                        onChange={(e) => handleUpdatePage(page.id, "profileName", e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Profile Picture URL (optional)</Label>
                    <Input
                      placeholder="https://..."
                      value={page.profilePicture || ""}
                      onChange={(e) => handleUpdatePage(page.id, "profilePicture", e.target.value)}
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Border Color</Label>
                    <div className="flex gap-2 flex-wrap mt-1">
                      {colorOptions.map((color) => (
                        <button
                          key={color}
                          className={`h-8 w-8 rounded-full border-2 ${
                            page.borderColor === color ? "border-white" : "border-transparent"
                          }`}
                          style={{ backgroundColor: color }}
                          onClick={() => handleUpdatePage(page.id, "borderColor", color)}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    {page.isNew && (
                      <Button
                        size="sm"
                        onClick={() => handleSavePage(page)}
                        disabled={createPage.isPending}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                    )}
                    {!page.isNew && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSavePage(page)}
                        disabled={updatePage.isPending}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Update
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeletePage(page.id)}
                      disabled={deletePage.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

