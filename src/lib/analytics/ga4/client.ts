import { GoogleAuth } from "google-auth-library";
import type { ServiceAccountCredentials } from "./credentials";
import type { Ga4ReportResponse } from "./map-report";

const GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly";
const GA4_API = "https://analyticsdata.googleapis.com/v1beta";

export type RunReportRequest = {
  dateRanges: Array<{ startDate: string; endDate: string }>;
  dimensions?: Array<{ name: string }>;
  metrics: Array<{ name: string }>;
  limit?: number;
  orderBys?: Array<{
    desc?: boolean;
    metric?: { metricName: string };
    dimension?: { dimensionName: string };
  }>;
};

export type Ga4DataClient = {
  runReport(
    propertyId: string,
    request: RunReportRequest,
  ): Promise<Ga4ReportResponse>;
};

export function createGa4RestClient(
  credentials: ServiceAccountCredentials,
): Ga4DataClient {
  const auth = new GoogleAuth({
    credentials: {
      client_email: credentials.clientEmail,
      private_key: credentials.privateKey,
      project_id: credentials.projectId,
    },
    scopes: [GA4_SCOPE],
  });

  return {
    async runReport(propertyId, request) {
      const client = await auth.getClient();
      const token = await client.getAccessToken();
      if (!token.token) {
        throw new Error("Failed to obtain a Google access token for GA4.");
      }

      const response = await fetch(
        `${GA4_API}/properties/${propertyId}:runReport`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(request),
        },
      );

      if (!response.ok) {
        const details = await response.text();
        throw new Error(
          `GA4 runReport failed (${response.status}): ${details.slice(0, 500)}`,
        );
      }

      return (await response.json()) as Ga4ReportResponse;
    },
  };
}
