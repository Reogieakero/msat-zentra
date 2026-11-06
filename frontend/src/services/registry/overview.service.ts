import { apiClient } from "@/lib/api/client";
import type {
  RecordKeeperOverviewData,
  RegistrarOverviewData,
  RegistryOverviewData,
} from "./overview.types";

export type RegistryDesk = "registrar" | "record-keeper";

const OVERVIEW_ENDPOINT: Record<RegistryDesk, string> = {
  registrar: "/api/registrar/overview",
  "record-keeper": "/api/record-keeper/overview",
};

export async function fetchRegistryOverview(
  desk: RegistryDesk,
): Promise<RegistryOverviewData> {
  const { data } = await apiClient.get<RegistryOverviewData>(
    OVERVIEW_ENDPOINT[desk],
  );
  return data;
}

export async function fetchRegistrarOverview(): Promise<RegistrarOverviewData> {
  return fetchRegistryOverview("registrar");
}

export async function fetchRecordKeeperOverview(): Promise<RecordKeeperOverviewData> {
  return fetchRegistryOverview("record-keeper");
}
