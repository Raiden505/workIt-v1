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

interface MyFreelancerProfilePayload {
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
  freelancer: {
    hourly_rate: number;
    portfolio_url: string | null;
  } | null;
}

interface SkillOption {
  id: number;
  name: string;
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

export default function FreelancerProfilePage() {
  const { userId, isHydrated } = useSession();
  const [profilePayload, setProfilePayload] = useState<MyFreelancerProfilePayload | null>(null);
  const [skills, setSkills] = useState<SkillOption[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<number[]>([]);
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [hourlyRate, setHourlyRate] = useState("0");
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
      const [profileResponse, skillsResponse, mySkillsResponse] = await Promise.all([
        fetch("/api/profile/me", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${userId}`,
          },
        }),
        fetch("/api/skills", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${userId}`,
          },
        }),
        fetch("/api/freelancer/skills", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${userId}`,
          },
        }),
      ]);

      const [profileData, skillsData, mySkillsData]: [unknown, unknown, unknown] = await Promise.all([
        profileResponse.json(),
        skillsResponse.json(),
        mySkillsResponse.json(),
      ]);

      if (!profileResponse.ok) {
        setErrorMessage(getErrorMessage(profileData, "Failed to load profile."));
        return;
      }
      if (!skillsResponse.ok) {
        setErrorMessage(getErrorMessage(skillsData, "Failed to load skills."));
        return;
      }
      if (!mySkillsResponse.ok) {
        setErrorMessage(getErrorMessage(mySkillsData, "Failed to load freelancer skills."));
        return;
      }

      if (
        typeof skillsData !== "object" ||
        skillsData === null ||
        !("skills" in skillsData) ||
        !Array.isArray(skillsData.skills)
      ) {
        setErrorMessage("Invalid skills response.");
        return;
      }

      if (
        typeof mySkillsData !== "object" ||
        mySkillsData === null ||
        !("skillIds" in mySkillsData) ||
        !Array.isArray(mySkillsData.skillIds)
      ) {
        setErrorMessage("Invalid freelancer skills response.");
        return;
      }

      const parsedProfile = profileData as MyFreelancerProfilePayload;
      setProfilePayload(parsedProfile);
      setBio(parsedProfile.profile.bio ?? "");
      setAvatarUrl(parsedProfile.profile.avatar_url ?? "");
      setPortfolioUrl(parsedProfile.freelancer?.portfolio_url ?? "");
      setHourlyRate(String(parsedProfile.freelancer?.hourly_rate ?? 0));
      setSkills(skillsData.skills as SkillOption[]);
      setSelectedSkillIds((mySkillsData.skillIds as number[]).filter((item) => Number.isInteger(item)));
    } catch {
      setErrorMessage("Network error while loading profile.");
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

  const toggleSkill = (skillId: number, checked: boolean) => {
    const nextSet = new Set(selectedSkillIds);
    if (checked) {
      nextSet.add(skillId);
    } else {
      nextSet.delete(skillId);
    }
    setSelectedSkillIds([...nextSet]);
  };

  const saveProfile = async () => {
    if (!userId) {
      toast.error("You are not logged in.");
      return;
    }

    setIsSaving(true);
    try {
      const profileResponse = await fetch("/api/profile/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify({
          bio: bio.trim().length === 0 ? null : bio.trim(),
          avatarUrl: avatarUrl.trim().length === 0 ? null : avatarUrl.trim(),
          portfolioUrl: portfolioUrl.trim().length === 0 ? null : portfolioUrl.trim(),
          hourlyRate: Number(hourlyRate),
        }),
      });

      const profilePayload: unknown = await profileResponse.json();
      if (!profileResponse.ok) {
        toast.error(getErrorMessage(profilePayload, "Failed to save profile."));
        return;
      }

      const skillsResponse = await fetch("/api/freelancer/skills", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userId}`,
        },
        body: JSON.stringify({
          skillIds: selectedSkillIds,
        }),
      });

      const skillsPayload: unknown = await skillsResponse.json();
      if (!skillsResponse.ok) {
        toast.error(getErrorMessage(skillsPayload, "Failed to save skills."));
        return;
      }

      toast.success("Freelancer profile updated successfully.");
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
          <h1 className="text-2xl font-semibold text-black">Freelancer Profile</h1>
          <p className="text-sm text-emerald-800">Update your bio, portfolio, rate, and skills.</p>
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
                <Label htmlFor="hourlyRate">Hourly Rate (USD)</Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  min={0}
                  step="0.01"
                  value={hourlyRate}
                  onChange={(event) => setHourlyRate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="portfolioUrl">Portfolio URL</Label>
                <Input
                  id="portfolioUrl"
                  value={portfolioUrl}
                  onChange={(event) => setPortfolioUrl(event.target.value)}
                  placeholder="https://portfolio.example.com"
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
                  placeholder="Tell clients about your expertise and services."
                />
              </div>
              <div className="space-y-2">
                <Label>Skills</Label>
                <div className="max-h-44 space-y-2 overflow-y-auto rounded-md border p-3">
                  {skills.map((skill) => {
                    const checked = selectedSkillIds.includes(skill.id);
                    return (
                      <label key={skill.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => toggleSkill(skill.id, event.target.checked)}
                        />
                        {skill.name}
                      </label>
                    );
                  })}
                </div>
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
