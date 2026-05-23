import { PartyManager } from "@/components/forms/party-manager";

export default function SuppliersPage() {
  return <PartyManager endpoint="/api/suppliers" kind="suppliers" title="Suppliers" />;
}
