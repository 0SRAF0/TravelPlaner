import { API } from "./api";
import type { Activity, VoteRequest, VoteResponse } from "../types/activity";
import { authService } from "./authService";

import type { Activity } from "../types/activity";

interface GetActivitiesParams {
  trip_id: string;
  category?: string;
  min_score?: number;
  limit?: number;
}

interface VoteParams {
  trip_id: string;
  activity_name: string;
  user_id: string;
  vote: "up" | "down";
}

class ActivityService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || "http://localhost:8060";
  }

  async getActivities(params: GetActivitiesParams): Promise<Activity[]> {
    const queryParams = new URLSearchParams();
    queryParams.append("trip_id", params.trip_id);

    if (params.category) {
      queryParams.append("category", params.category);
    }
    if (params.min_score !== undefined) {
      queryParams.append("min_score", params.min_score.toString());
    }
    if (params.limit !== undefined) {
      queryParams.append("limit", params.limit.toString());
    }

    const response = await fetch(
      `${this.baseUrl}/activities/?${queryParams.toString()}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch activities: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.code === 0) {
      return result.data || [];
    }

    throw new Error(result.msg || "Failed to fetch activities");
  }

  async vote(params: VoteParams): Promise<void> {
    // TODO: Implement vote endpoint when backend is ready
    // For now, just simulate success
    return new Promise((resolve) => {
      setTimeout(resolve, 300);
    });
  }
}

export const activityService = new ActivityService();
