"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ReviewList } from "@/components/reviews/ReviewList";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { useSession } from "@/lib/hooks/useSession";

interface PublicProfilePayload {
  user_id: number;
  first_name: string;
  last_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  client: {
    company_name: string | null;
  } | null;
  freelancer: {
    hourly_rate: number;
    portfolio_url: string | null;
  } | null;
  skills: Array<{ id: number; name: string }>;
  reviews: {
    count: number;
    average_rating: number | null;
    items: Array<{
      id: number;
      reviewer_name: string | null;
      rating: number | null;
      comment: string | null;
      created_at: string;
    }>;
  };
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

export default function FreelancerPublicProfilePage() {
  const params = useParams<{ userId: string }>();
  const profileUserId = useMemo(() => Number(params.userId), [params.userId]);
  const { userId, isHydrated } = useSession();
  const [profilePayload, setProfilePayload] = useState<PublicProfilePayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!userId || !Number.isInteger(profileUserId) || profileUserId <= 0) {
      setErrorMessage("Invalid user id.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/profiles/${profileUserId}`, {
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

      setProfilePayload(payload as PublicProfilePayload);
    } catch {
      setErrorMessage("Network error while loading profile.");
      setProfilePayload(null);
    } finally {
      setIsLoading(false);
    }
  }, [profileUserId, userId]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProfile();
  }, [isHydrated, loadProfile]);

  return (
    <SessionGuard>
      <main className="min-h-screen bg-gradient-to-b from-white via-emerald-50 to-white p-4 md:p-6">
        <div className="mx-auto w-full max-w-4xl space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-black">Freelancer Profile</h1>
            <p className="text-sm text-emerald-800">View freelancer details, skills, and reviews.</p>
          </div>

          {isLoading ? (
            <div className="rounded-lg border bg-background p-5 space-y-3">
              <Skeleton className="h-6 w-52" />
              <Skeleton className="h-4 w-72" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : null}

          {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

          {!isLoading && !errorMessage && profilePayload ? (
            <>
              <div className="rounded-lg border border-emerald-200 bg-white p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-3">
                  <UserAvatar
                    src={profilePayload.avatar_url}
                    name={`${profilePayload.first_name}${profilePayload.last_name ? ` ${profilePayload.last_name}` : ""}`}
                    size="lg"
                  />
                  <h2 className="text-xl font-semibold text-black">
                    {profilePayload.first_name}
                    {profilePayload.last_name ? ` ${profilePayload.last_name}` : ""}
                  </h2>
                </div>
                {profilePayload.freelancer ? (
                  <>
                    <p>Hourly Rate: ${profilePayload.freelancer.hourly_rate}</p>
                    {profilePayload.freelancer.portfolio_url ? (
                      <p>
                        Portfolio:{" "}
                        <a
                          href={profilePayload.freelancer.portfolio_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          {profilePayload.freelancer.portfolio_url}
                        </a>
                      </p>
                    ) : null}
                  </>
                ) : null}
                {profilePayload.bio ? (
                  <p className="text-sm text-black/80">{profilePayload.bio}</p>
                ) : (
                  <p className="text-sm text-black/60">No bio provided.</p>
                )}
                {profilePayload.skills.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {profilePayload.skills.map((skill) => (
                      <Badge key={skill.id} variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800">
                        {skill.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-black/60">No skills listed.</p>
                )}
              </div>

              <section className="space-y-3">
                <h2 className="text-xl font-semibold">Reviews</h2>
                <ReviewList summary={profilePayload.reviews} reviews={profilePayload.reviews.items} />
              </section>
            </>
          ) : null}
        </div>
      </main>
    </SessionGuard>
  );
}
