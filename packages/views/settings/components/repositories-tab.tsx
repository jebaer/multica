"use client";

import { useEffect, useState } from "react";
import { Save, Plus, Trash2, Globe, HardDrive, FolderOpen } from "lucide-react";
import { Input } from "@multica/ui/components/ui/input";
import { Button } from "@multica/ui/components/ui/button";
import { Card, CardContent } from "@multica/ui/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@multica/ui/components/ui/select";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@multica/core/auth";
import { useWorkspaceId } from "@multica/core/hooks";
import { useCurrentWorkspace } from "@multica/core/paths";
import { memberListOptions, workspaceKeys } from "@multica/core/workspace/queries";
import { api } from "@multica/core/api";
import type { Workspace, WorkspaceRepo, RepoLinkType } from "@multica/core/types";

export interface RepositoriesTabProps {
  /** Desktop-only: open a system directory picker and return the selected path, or null if cancelled. */
  onBrowseLocalPath?: () => Promise<string | null>;
}

export function RepositoriesTab({ onBrowseLocalPath }: RepositoriesTabProps) {
  const user = useAuthStore((s) => s.user);
  const workspace = useCurrentWorkspace();
  const wsId = useWorkspaceId();
  const qc = useQueryClient();
  const { data: members = [] } = useQuery(memberListOptions(wsId));

  const [repos, setRepos] = useState<WorkspaceRepo[]>(workspace?.repos ?? []);
  const [saving, setSaving] = useState(false);

  const currentMember = members.find((m) => m.user_id === user?.id) ?? null;
  const canManageWorkspace = currentMember?.role === "owner" || currentMember?.role === "admin";

  useEffect(() => {
    setRepos(workspace?.repos ?? []);
  }, [workspace]);

  const handleSave = async () => {
    if (!workspace) return;
    setSaving(true);
    try {
      const updated = await api.updateWorkspace(workspace.id, { repos });
      qc.setQueryData(workspaceKeys.list(), (old: Workspace[] | undefined) =>
        old?.map((ws) => (ws.id === updated.id ? updated : ws)),
      );
      toast.success("Repositories saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save repositories");
    } finally {
      setSaving(false);
    }
  };

  const handleAddRepo = (linkType: RepoLinkType = "remote") => {
    setRepos([...repos, { url: "", description: "", link_type: linkType }]);
  };

  const handleRemoveRepo = (index: number) => {
    setRepos(repos.filter((_, i) => i !== index));
  };

  const handleRepoChange = (index: number, field: keyof WorkspaceRepo, value: string) => {
    setRepos(repos.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  const handleLinkTypeChange = (index: number, linkType: RepoLinkType) => {
    setRepos(repos.map((r, i) => (i === index ? { ...r, link_type: linkType } : r)));
  };

  const handleBrowse = async (index: number) => {
    if (!onBrowseLocalPath) return;
    const path = await onBrowseLocalPath();
    if (path) {
      handleRepoChange(index, "url", path);
    }
  };

  if (!workspace) return null;

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Repositories</h2>

        <Card>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Git repositories associated with this workspace. Agents use these to clone and work on code.
            </p>

            {repos.map((repo, index) => {
              const linkType: RepoLinkType = repo.link_type ?? "remote";
              const isLocal = linkType === "local";

              return (
                <div key={index} className="flex gap-2">
                  <div className="flex-1 space-y-1.5">
                    <div className="flex gap-1.5">
                      <Select
                        value={linkType}
                        onValueChange={(v) => { if (v === "remote" || v === "local") handleLinkTypeChange(index, v); }}
                        disabled={!canManageWorkspace}
                      >
                        <SelectTrigger size="sm" className="w-[110px] shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="remote">
                            <Globe className="mr-1.5 inline h-3 w-3" />
                            Remote
                          </SelectItem>
                          <SelectItem value="local">
                            <HardDrive className="mr-1.5 inline h-3 w-3" />
                            Local
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex flex-1 gap-1">
                        <Input
                          type={isLocal ? "text" : "url"}
                          value={repo.url}
                          onChange={(e) => handleRepoChange(index, "url", e.target.value)}
                          disabled={!canManageWorkspace}
                          placeholder={isLocal ? "/path/to/your/repo" : "https://git.example.com/org/repo.git"}
                          className="text-sm"
                        />
                        {isLocal && onBrowseLocalPath && canManageWorkspace && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="shrink-0"
                            onClick={() => handleBrowse(index)}
                            title="Browse for local repository"
                          >
                            <FolderOpen className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <Input
                      type="text"
                      value={repo.description}
                      onChange={(e) => handleRepoChange(index, "description", e.target.value)}
                      disabled={!canManageWorkspace}
                      placeholder="Description (e.g. Go backend + Next.js frontend)"
                      className="text-sm"
                    />
                  </div>
                  {canManageWorkspace && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="mt-0.5 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveRepo(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}

            {canManageWorkspace && (
              <div className="flex items-center justify-between pt-1">
                <Button variant="outline" size="sm" onClick={() => handleAddRepo("remote")}>
                  <Plus className="h-3 w-3" />
                  Add repository
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                >
                  <Save className="h-3 w-3" />
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            )}

            {!canManageWorkspace && (
              <p className="text-xs text-muted-foreground">
                Only admins and owners can manage repositories.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
