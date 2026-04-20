"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { useSession } from "@/lib/hooks/useSession";

interface MyProfilePayload {
  user: {
    id: number;
    email: string;
  };
  profile: {
    first_name: string;
    last_name: string | null;
    avatar_url: string | null;
    bio: string | null;
  };
  client: {
    company_name: string | null;
  } | null;
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const errorValue = payload.error;
    if (typeof errorValue === "string") {
      return errorValue;
    }
  }
  return fallback;
}

export default function ClientProfilePage() {
  const { userId, isHydrated } = useSession();
  const [profilePayload, setProfilePayload] = useState<MyProfilePayload | null>(null);
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setErrorMessage("Missing user session.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/profile/me", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${userId}`,
        },
      });

      const payload: unknown = await response.json();
      if (!response.ok) {
        setErrorMessage(getErrorMessage(payload, "Failed to load profile."));
        setProfilePayload(null);
        return;
      }

      const parsedPayload = payload as MyProfilePayload;
      setProfilePayload(parsedPayload);
      setBio(parsedPayload.profile.bio ?? "");
      setAvatarUrl(parsedPayload.profile.avatar_url ?? "");
      setCompanyName(parsedPayload.client?.company_name ?? "");
    } catch {
      setErrorMessage("Network error while loading profile.");
      setProfilePayload(null);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProfile();
  }, [isHydrated, loadProfile]);

  const saveProfile = async () => {
    if (!userId) {
      toast.error("You are not logged in.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/profile/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify({
          bio: bio.trim().length === 0 ? null : bio.trim(),
          avatarUrl: avatarUrl.trim().length === 0 ? null : avatarUrl.trim(),
          companyName: companyName.trim().length === 0 ? null : companyName.trim(),
        }),
      });

      const payload: unknown = await response.json();
      if (!response.ok) {
        toast.error(getErrorMessage(payload, "Failed to save profile."));
        return;
      }

      toast.success("Profile updated successfully.");
      await loadProfile();
    } catch {
      toast.error("Network error while saving profile.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-emerald-50 to-white p-4 md:p-6">
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-black">Client Profile</h1>
          <p className="text-sm text-emerald-800">Update your profile details and company information.</p>
        </div>

        {isLoading ? (
          <div className="rounded-lg border bg-background p-5 space-y-3">
            <Skeleton className="h-5 w-52" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : null}

        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

        {!isLoading && !errorMessage && profilePayload ? (
          <Card className="border-emerald-200 bg-white text-black shadow-sm">
            <CardHeader>
              <CardTitle>Profile Details</CardTitle>
              <CardDescription>
                {profilePayload.profile.first_name}
                {profilePayload.profile.last_name ? ` ${profilePayload.profile.last_name}` : ""} ·{" "}
                {profilePayload.user.email}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <UserAvatar
                  src={avatarUrl || profilePayload.profile.avatar_url}
                  name={`${profilePayload.profile.first_name}${profilePayload.profile.last_name ? ` ${profilePayload.profile.last_name}` : ""}`}
                  size="lg"
                />
                <p className="text-sm text-black/70">Profile picture preview</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder="Acme Studio"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="avatarUrl">Avatar URL</Label>
                <Input
                  id="avatarUrl"
                  value={avatarUrl}
                  onChange={(event) => setAvatarUrl(event.target.value)}
                  placeholder="https://example.com/avatar.png"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  rows={5}
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  placeholder="Tell freelancers about your business and project preferences."
                />
              </div>
              <Button type="button" disabled={isSaving} onClick={saveProfile}>
                {isSaving ? "Saving..." : "Save Profile"}
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </main>
  );
}
